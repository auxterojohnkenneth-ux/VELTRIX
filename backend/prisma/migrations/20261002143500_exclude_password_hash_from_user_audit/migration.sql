CREATE OR REPLACE FUNCTION audit_user_changes()
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
        'User',
        CASE
            WHEN TG_OP = 'DELETE'
                THEN 'user=' || OLD."id"
            ELSE
                'user=' || NEW."id"
        END,
        CASE
            WHEN TG_OP IN ('UPDATE', 'DELETE')
                THEN to_jsonb(OLD) - 'passwordHash'
            ELSE NULL
        END,
        CASE
            WHEN TG_OP IN ('INSERT', 'UPDATE')
                THEN to_jsonb(NEW) - 'passwordHash'
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
