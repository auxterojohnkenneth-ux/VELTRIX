CREATE OR REPLACE FUNCTION dispatch_shipment(
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
    v_status TEXT;
    v_source_warehouse_id INTEGER;
    v_destination_warehouse_id INTEGER;
    v_item RECORD;
    v_item_count INTEGER;
    v_source_quantity INTEGER;
BEGIN
    SELECT
        s."id",
        s."status",
        s."sourceWarehouseId",
        s."destinationWarehouseId"
    INTO
        v_shipment_id,
        v_status,
        v_source_warehouse_id,
        v_destination_warehouse_id
    FROM "Shipment" s
    WHERE s."shipmentNumber" = p_shipment_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Shipment % does not exist',
            p_shipment_number;
    END IF;

    IF v_status <> 'PENDING' THEN
        RAISE EXCEPTION
            'Shipment % cannot be dispatched because its current status is %',
            p_shipment_number,
            v_status;
    END IF;

    IF v_source_warehouse_id IS NULL THEN
        RAISE EXCEPTION
            'Shipment % has no source warehouse',
            p_shipment_number;
    END IF;

    IF v_destination_warehouse_id IS NULL THEN
        RAISE EXCEPTION
            'Shipment % has no destination warehouse',
            p_shipment_number;
    END IF;

    IF v_source_warehouse_id = v_destination_warehouse_id THEN
        RAISE EXCEPTION
            'Source and destination warehouses must be different';
    END IF;

    SELECT COUNT(*)
    INTO v_item_count
    FROM "ShipmentItem" si
    WHERE si."shipmentId" = v_shipment_id;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION
            'Shipment % contains no items',
            p_shipment_number;
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

        SELECT ws."quantityOnHand"
        INTO v_source_quantity
        FROM "WarehouseStock" ws
        WHERE ws."warehouseId" = v_source_warehouse_id
          AND ws."itemId" = v_item."itemId"
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Item % does not exist in source warehouse %',
                v_item."itemId",
                v_source_warehouse_id;
        END IF;

        IF v_source_quantity < v_item."quantity" THEN
            RAISE EXCEPTION
                'Insufficient stock for item %. Available: %, requested: %',
                v_item."itemId",
                v_source_quantity,
                v_item."quantity";
        END IF;

    END LOOP;

    FOR v_item IN
        SELECT
            si."itemId",
            si."quantity"
        FROM "ShipmentItem" si
        WHERE si."shipmentId" = v_shipment_id
        ORDER BY si."itemId"
    LOOP

        UPDATE "WarehouseStock"
        SET
            "quantityOnHand" =
                "quantityOnHand" - v_item."quantity",
            "updatedAt" = NOW()
        WHERE "warehouseId" = v_source_warehouse_id
          AND "itemId" = v_item."itemId";

    END LOOP;

    UPDATE "Shipment"
    SET
        "status" = 'DISPATCHED',
        "dispatchedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = v_shipment_id;

    shipment_id := v_shipment_id;
    shipment_number := p_shipment_number;
    status := 'DISPATCHED';

    RETURN NEXT;
END;
$$;
