-- Inventory lookups
CREATE INDEX "idx_warehouse_stock_item"
ON "WarehouseStock" ("itemId");

-- Shipment filtering
CREATE INDEX "idx_shipment_status"
ON "Shipment" ("status");

CREATE INDEX "idx_shipment_source_warehouse"
ON "Shipment" ("sourceWarehouseId");

CREATE INDEX "idx_shipment_destination_warehouse"
ON "Shipment" ("destinationWarehouseId");

CREATE INDEX "idx_shipment_created_by"
ON "Shipment" ("createdBy");

-- Shipment item lookups
CREATE INDEX "idx_shipment_item_item"
ON "ShipmentItem" ("itemId");

-- Stock transfer filtering
CREATE INDEX "idx_stock_transfer_status"
ON "StockTransfer" ("status");

CREATE INDEX "idx_stock_transfer_source"
ON "StockTransfer" ("sourceWarehouseId");

CREATE INDEX "idx_stock_transfer_destination"
ON "StockTransfer" ("destinationWarehouseId");

CREATE INDEX "idx_stock_transfer_requested_by"
ON "StockTransfer" ("requestedBy");

-- Audit log investigation
CREATE INDEX "idx_audit_log_table_record"
ON "AuditLog" ("tableName", "recordIdentifier");

CREATE INDEX "idx_audit_log_created_at"
ON "AuditLog" ("createdAt");