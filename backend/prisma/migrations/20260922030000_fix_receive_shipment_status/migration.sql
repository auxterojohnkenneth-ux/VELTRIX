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
    SELECT
        s."id",
        s."destinationWarehouseId",
        s."status"
    INTO
        v_shipment_id,
        v_destination_warehouse_id,
        v_status
    FROM "Shipment" s
    WHERE s."shipmentNumber" = p_shipment_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shipment % does not exist', p_shipment_number;
    END IF;

    IF v_status NOT IN ('PENDING', 'DISPATCHED') THEN
        RAISE EXCEPTION
            'Shipment % cannot be received because its current status is %',
            p_shipment_number,
            v_status;
    END IF;

    IF v_destination_warehouse_id IS NULL THEN
        RAISE EXCEPTION
            'Shipment % has no destination warehouse',
            p_shipment_number;
    END IF;

    SELECT COUNT(*)
    INTO v_item_count
    FROM "ShipmentItem" si
    WHERE si."shipmentId" = v_shipment_id;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION
            'Shipment % contains no items',
            p_shipment_number
        ;
    END IF;

    FOR v_item IN
        SELECT
            si."itemId",
            si."quantity"
        FROM "ShipmentItem" si
        WHERE si."shipmentId" = v_shipment_id
        ORDER BY si."itemId"
    LOOP
        IF v_item."quantity" <= 0 THEN
            RAISE EXCEPTION
                'Shipment % contains an invalid quantity for item %',
                p_shipment_number,
                v_item."itemId";
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM "Item" i
            WHERE i."id" = v_item."itemId"
        ) THEN
            RAISE EXCEPTION
                'Shipment % references item % which does not exist',
                p_shipment_number,
                v_item."itemId";
        END IF;

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

    UPDATE "Shipment"
    SET
        "status" = 'RECEIVED',
        "receivedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = v_shipment_id;

    shipment_id := v_shipment_id;
    shipment_number := p_shipment_number;
    status := 'RECEIVED';

    RETURN NEXT;
END;
$$;