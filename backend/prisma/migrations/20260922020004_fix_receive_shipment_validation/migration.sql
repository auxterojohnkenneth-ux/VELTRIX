CREATE OR REPLACE FUNCTION receive_shipment(
    p_shipment_number TEXT
)
RETURNS TABLE (
    shipment_id INTEGER,
    shipment_number TEXT,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_shipment_id INTEGER;
    v_destination_warehouse_id INTEGER;
    v_status TEXT;
    v_item RECORD;
    v_item_count INTEGER;
BEGIN
    -- Find and lock the shipment row.
    SELECT
        "id",
        "destinationWarehouseId",
        "status"
    INTO
        v_shipment_id,
        v_destination_warehouse_id,
        v_status
    FROM "Shipment"
    WHERE "shipmentNumber" = p_shipment_number
    FOR UPDATE;

    -- Reject unknown shipment numbers.
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shipment % does not exist', p_shipment_number;
    END IF;

    -- Only pending or dispatched shipments may be received.
    IF v_status NOT IN ('PENDING', 'DISPATCHED') THEN
        RAISE EXCEPTION
            'Shipment % cannot be received because its current status is %',
            p_shipment_number,
            v_status;
    END IF;

    -- A shipment must have a destination warehouse.
    IF v_destination_warehouse_id IS NULL THEN
        RAISE EXCEPTION
            'Shipment % has no destination warehouse',
            p_shipment_number;
    END IF;

    -- A shipment must contain at least one item.
    SELECT COUNT(*)
    INTO v_item_count
    FROM "ShipmentItem"
    WHERE "shipmentId" = v_shipment_id;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION
            'Shipment % contains no items',
            p_shipment_number;
    END IF;

    -- Process every shipment item in a consistent order.
    FOR v_item IN
        SELECT
            "itemId",
            "quantity"
        FROM "ShipmentItem"
        WHERE "shipmentId" = v_shipment_id
        ORDER BY "itemId"
    LOOP

        -- Quantity must be positive.
        IF v_item."quantity" <= 0 THEN
            RAISE EXCEPTION
                'Shipment % contains an invalid quantity for item %',
                p_shipment_number,
                v_item."itemId";
        END IF;

        -- Make sure the referenced item actually exists.
        IF NOT EXISTS (
            SELECT 1
            FROM "Item"
            WHERE "id" = v_item."itemId"
        ) THEN
            RAISE EXCEPTION
                'Shipment % references item % which does not exist',
                p_shipment_number,
                v_item."itemId";
        END IF;

        -- Add the received quantity to destination warehouse stock.
        INSERT INTO "WarehouseStock" (
            "warehouseId",
            "itemId",
            "quantityOnHand",
            "reorderLevel",
            "lastRestockedAt",
            "updatedAt"
        )
        SELECT
            v_destination_warehouse_id,
            i."id",
            v_item."quantity",
            i."reorderLevel",
            NOW(),
            NOW()
        FROM "Item" i
        WHERE i."id" = v_item."itemId"
        ON CONFLICT ("warehouseId", "itemId")
        DO UPDATE SET
            "quantityOnHand" =
                "WarehouseStock"."quantityOnHand"
                + EXCLUDED."quantityOnHand",
            "lastRestockedAt" = NOW(),
            "updatedAt" = NOW();

    END LOOP;

    -- Mark the shipment as received only after every item succeeds.
    UPDATE "Shipment"
    SET
        "status" = 'RECEIVED',
        "receivedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = v_shipment_id;

    -- Return the completed shipment.
    RETURN QUERY
    SELECT
        s."id",
        s."shipmentNumber",
        s."status" AS status
    FROM "Shipment" s
    WHERE s."id" = v_shipment_id;
END;
$$;