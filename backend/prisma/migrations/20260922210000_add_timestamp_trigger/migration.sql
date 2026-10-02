CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE
ON "User"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_warehouses_updated_at
BEFORE UPDATE
ON "Warehouse"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_items_updated_at
BEFORE UPDATE
ON "Item"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE
ON "Supplier"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_drivers_updated_at
BEFORE UPDATE
ON "Driver"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
BEFORE UPDATE
ON "Vehicle"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_routes_updated_at
BEFORE UPDATE
ON "Route"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shipments_updated_at
BEFORE UPDATE
ON "Shipment"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_transfers_updated_at
BEFORE UPDATE
ON "StockTransfer"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();