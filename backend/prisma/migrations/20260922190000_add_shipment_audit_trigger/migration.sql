CREATE OR REPLACE FUNCTION audit_shipment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "AuditLog" (
        "userId",
        "action",
        "tableName",
        "recordIdentifier",
        "oldValues",
        "newValues",
        "createdAt"
    )
    VALUES (
        NULL,
        TG_OP,
        'Shipment',
        CASE
            WHEN TG_OP = 'DELETE'
                THEN 'shipment=' || OLD."shipmentNumber"
            ELSE
                'shipment=' || NEW."shipmentNumber"
        END,
        CASE
            WHEN TG_OP IN ('UPDATE', 'DELETE')
                THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP IN ('INSERT', 'UPDATE')
                THEN to_jsonb(NEW)
            ELSE NULL
        END,
        NOW()
    );

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER trg_audit_shipment
AFTER INSERT OR UPDATE OR DELETE
ON "Shipment"
FOR EACH ROW
EXECUTE FUNCTION audit_shipment_changes();