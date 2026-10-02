CREATE OR REPLACE FUNCTION audit_warehouse_stock_changes()
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
        CASE
            WHEN TG_OP = 'INSERT' THEN 'INSERT'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        'WarehouseStock',
        CASE
            WHEN TG_OP = 'DELETE'
                THEN 'warehouse=' || OLD."warehouseId" || ',item=' || OLD."itemId"
            ELSE
                'warehouse=' || NEW."warehouseId" || ',item=' || NEW."itemId"
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

CREATE TRIGGER trg_audit_warehouse_stock
AFTER INSERT OR UPDATE OR DELETE
ON "WarehouseStock"
FOR EACH ROW
EXECUTE FUNCTION audit_warehouse_stock_changes();