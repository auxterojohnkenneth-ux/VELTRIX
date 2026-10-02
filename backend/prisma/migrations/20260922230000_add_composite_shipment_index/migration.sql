CREATE INDEX "idx_shipment_status_created_at"
ON "Shipment" ("status", "createdAt" DESC);