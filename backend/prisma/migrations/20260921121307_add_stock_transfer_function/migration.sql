-- ============================================================
-- VELTRIX
-- Stock Transfer Transaction Function
-- ============================================================

CREATE OR REPLACE FUNCTION process_stock_transfer(
    p_transfer_number TEXT,
    p_source_warehouse_id INTEGER,
    p_destination_warehouse_id INTEGER,
    p_requested_by INTEGER,
    p_items JSONB
)
RETURNS TABLE (
    transfer_id INTEGER,
    transfer_number TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_transfer_id INTEGER;
    v_item JSONB;
    v_item_id INTEGER;
    v_quantity INTEGER;
    v_source_quantity INTEGER;
BEGIN
    -- --------------------------------------------------------
    -- 1. Source and destination must be different
    -- --------------------------------------------------------

    IF p_source_warehouse_id = p_destination_warehouse_id THEN
        RAISE EXCEPTION
            'Source and destination warehouses must be different';
    END IF;

    -- --------------------------------------------------------
    -- 2. At least one item is required
    -- --------------------------------------------------------

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION
            'At least one transfer item is required';
    END IF;

    -- --------------------------------------------------------
    -- 3. Validate every requested item
    -- --------------------------------------------------------

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item ->> 'itemId')::INTEGER;
        v_quantity := (v_item ->> 'quantity')::INTEGER;

        IF v_item_id IS NULL OR v_quantity IS NULL THEN
            RAISE EXCEPTION
                'Each transfer item must contain itemId and quantity';
        END IF;

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION
                'Transfer quantity must be greater than zero';
        END IF;
    END LOOP;

    -- --------------------------------------------------------
    -- 4. Create the transfer record
    -- --------------------------------------------------------

    INSERT INTO "StockTransfer" (
        "transferNumber",
        "sourceWarehouseId",
        "destinationWarehouseId",
        "requestedBy",
        "status",
        "requestedAt",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        p_transfer_number,
        p_source_warehouse_id,
        p_destination_warehouse_id,
        p_requested_by,
        'COMPLETED',
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING "id"
    INTO v_transfer_id;

    -- --------------------------------------------------------
    -- 5. Process every item
    --
    -- FOR UPDATE locks the source inventory row.
    -- This prevents concurrent transactions from modifying
    -- the same inventory row at the same time.
    -- --------------------------------------------------------

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
        ORDER BY (value ->> 'itemId')::INTEGER
    LOOP
        v_item_id := (v_item ->> 'itemId')::INTEGER;
        v_quantity := (v_item ->> 'quantity')::INTEGER;

        -- ----------------------------------------------------
        -- Lock the source warehouse inventory row
        -- ----------------------------------------------------

        SELECT "quantityOnHand"
        INTO v_source_quantity
        FROM "WarehouseStock"
        WHERE "warehouseId" = p_source_warehouse_id
          AND "itemId" = v_item_id
        FOR UPDATE;

        -- ----------------------------------------------------
        -- 6. Item must exist in source warehouse
        -- ----------------------------------------------------

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Item % does not exist in source warehouse %',
                v_item_id,
                p_source_warehouse_id;
        END IF;

        -- ----------------------------------------------------
        -- 7. Prevent negative inventory
        -- ----------------------------------------------------

        IF v_source_quantity < v_quantity THEN
            RAISE EXCEPTION
                'Insufficient stock for item %. Available: %, requested: %',
                v_item_id,
                v_source_quantity,
                v_quantity;
        END IF;

        -- ----------------------------------------------------
        -- 8. Deduct stock from source warehouse
        -- ----------------------------------------------------

        UPDATE "WarehouseStock"
        SET
            "quantityOnHand" = "quantityOnHand" - v_quantity,
            "updatedAt" = NOW()
        WHERE "warehouseId" = p_source_warehouse_id
          AND "itemId" = v_item_id;

        -- ----------------------------------------------------
        -- 9. Add stock to destination warehouse
        -- ----------------------------------------------------

        INSERT INTO "WarehouseStock" (
            "warehouseId",
            "itemId",
            "quantityOnHand",
            "reorderLevel",
            "lastRestockedAt",
            "updatedAt"
        )
        SELECT
            p_destination_warehouse_id,
            i."id",
            v_quantity,
            i."reorderLevel",
            NOW(),
            NOW()
        FROM "Item" i
        WHERE i."id" = v_item_id
        ON CONFLICT ("warehouseId", "itemId")
        DO UPDATE SET
            "quantityOnHand" =
                "WarehouseStock"."quantityOnHand"
                + EXCLUDED."quantityOnHand",
            "updatedAt" = NOW();

        -- ----------------------------------------------------
        -- 10. Record the transferred item
        -- ----------------------------------------------------

        INSERT INTO "StockTransferItem" (
            "transferId",
            "itemId",
            "quantityRequested",
            "quantityTransferred"
        )
        VALUES (
            v_transfer_id,
            v_item_id,
            v_quantity,
            v_quantity
        );
    END LOOP;

    -- --------------------------------------------------------
    -- 11. Mark transfer as completed
    -- --------------------------------------------------------

    UPDATE "StockTransfer"
    SET
        "completedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = v_transfer_id;

    -- --------------------------------------------------------
    -- 12. Return transfer information
    -- --------------------------------------------------------

    RETURN QUERY
    SELECT
        st."id",
        st."transferNumber",
        st."status"
    FROM "StockTransfer" st
    WHERE st."id" = v_transfer_id;

END;
$$;