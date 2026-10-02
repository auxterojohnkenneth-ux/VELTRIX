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
    /*
     * Lock the shipment row so two receiving requests
     * cannot process the same shipment at the same time.
     */
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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Shipment % does not exist',
            p_shipment_number;
    END IF;

    /*
     * Only pending or dispatched shipments can be received.
     */
    IF v_status NOT IN ('PENDING', 'DISPATCHED') THEN
        RAISE EXCEPTION
            'Shipment % cannot be received because its current status is %',
            p_shipment_number,
            v_status;
    END IF;

    /*
     * A shipment must have a destination warehouse
     * before it can be received.
     */
    IF v_destination_warehouse_id IS NULL THEN
        RAISE EXCEPTION
            'Shipment % has no destination warehouse',
            p_shipment_number;
    END IF;

    /*
     * Make sure the shipment contains at least one item.
     */
    SELECT COUNT(*)
    INTO v_item_count
    FROM "ShipmentItem"
    WHERE "shipmentId" = v_shipment_id;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION
            'Shipment % contains no items',
            p_shipment_number;
    END IF;

    /*
     * Process every item belonging to the shipment.
     */
    FOR v_item IN
        SELECT
            "itemId",
            "quantity"
        FROM "ShipmentItem"
        WHERE "shipmentId" = v_shipment_id
        ORDER BY "itemId"
    LOOP

        IF v_item."quantity" <= 0 THEN
            RAISE EXCEPTION
                'Shipment % contains an invalid quantity for item %',
                p_shipment_number,
                v_item."itemId";
        END IF;

        /*
         * Add the received quantity to the destination warehouse.
         * If the item already exists there, increase its stock.
         * Otherwise, create the warehouse-stock record.
         *
         * The WarehouseStock audit trigger will automatically
         * create an AuditLog record for this inventory change.
         */
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

    /*
     * Mark the shipment as received.
     */
    UPDATE "Shipment"
    SET
        "status" = 'RECEIVED',
        "receivedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = v_shipment_id;

    /*
     * Return the completed shipment information.
     */
    RETURN QUERY
    SELECT
        s."id",
        s."shipmentNumber",
        s."status"
    FROM "Shipment" s
    WHERE s."id" = v_shipment_id;

END;
$$;