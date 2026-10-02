# VELTRIX

VELTRIX is a logistics, warehouse, and supply-chain management system for an
Advanced Database Systems course. The current implementation supports JWT
authentication, warehouse inventory visibility, shipment operations, immediate
stock transfers, and read-only logistics and system-administration dashboards.

## Architecture

```text
Browser → Next.js App Router → NestJS REST API → Prisma 7.10.0 → PostgreSQL
```

The frontend never connects directly to PostgreSQL. The backend obtains its
database connection from `DATABASE_URL`; do not place that value in frontend
configuration or commit it.

## Local development

Use the existing package manifests and lockfiles:

```powershell
npm --prefix backend run start:dev
npm --prefix frontend run dev
```

The backend listens on port `3001` by default and the frontend on port `3000`.
Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` when the API uses a different
URL. `frontend/.env.example` shows the local default. The backend accepts
comma-separated frontend origins through `CORS_ORIGINS`; its default is
`http://localhost:3000`.

The backend requires server-side `DATABASE_URL` and `JWT_SECRET` values. Use a
private random JWT secret and the appropriate Neon connection URL in the
backend's local environment. `backend/.env.example` contains placeholders only.
Never copy real credentials into example files, documentation, or frontend
variables.

## Database design

The Prisma schema maps the existing 15-table relational design:

1. `Role`
2. `User`
3. `Warehouse`
4. `Category`
5. `Item`
6. `Supplier`
7. `WarehouseStock`
8. `Shipment`
9. `ShipmentItem`
10. `Driver`
11. `Vehicle`
12. `Route`
13. `StockTransfer`
14. `StockTransferItem`
15. `AuditLog`

The design is intended to satisfy 3NF by keeping facts about users, roles,
warehouses, items, suppliers, and operational records in their respective
tables, with relationships represented by foreign keys rather than duplicated
descriptive data. Composite-key junction tables represent many-to-many associations:
`ShipmentItem` links shipments and items, `StockTransferItem` links transfers
and items, and `WarehouseStock` links warehouses and items while storing
warehouse-specific quantities. No schema changes are part of the current
application work.

Foreign keys have explicit delete behavior in the migrations. In particular,
warehouse stock and transfer warehouse references restrict deletion; shipment
and transfer item rows cascade when their parent record is deleted; optional
supplier, driver, vehicle, route, and approver references are nullable and use
`SET NULL` where defined.

## Roles and authorization

The backend recognizes three roles:

- `SYSTEM_ADMIN`: system-wide read access to the available administrative and
  operational views.
- `WAREHOUSE_STAFF`: inventory and shipment/transfer access scoped to the
  assigned warehouse. The server derives identity and warehouse assignment
  from the JWT.
- `LOGISTICS_MANAGER`: shipment/logistics monitoring and transfer history;
  this role does not receive system-administration access or permission to
  create stock transfers.

Frontend role checks are for navigation and user experience only. Protected
backend endpoints use JWT authentication and role guards, while inventory,
shipment, and transfer services apply warehouse-level query scoping.

## API routes

Authentication:

- `POST /auth/login`

Inventory:

- `GET /inventory/stock`
- `GET /inventory/dashboard`

Shipments:

- `GET /shipments`
- `POST /shipments`
- `POST /shipments/:shipmentNumber/receive`
- `POST /shipments/:shipmentNumber/dispatch`

Stock transfers:

- `POST /transfers`
- `GET /transfers`
- `GET /transfers/:transferNumber`
- `GET /transfers/warehouses` (active warehouse choices)

The transfer create request contains `transferNumber`, source and destination
warehouse IDs, and item/quantity pairs. The requester is taken from the
authenticated JWT, not from request JSON. The existing database function
completes the stock movement immediately; there is no approve or in-transit
workflow.

Logistics monitoring (system admin and logistics manager):

- `GET /logistics/dashboard`
- `GET /logistics/shipments`
- `GET /logistics/drivers`
- `GET /logistics/vehicles`
- `GET /logistics/routes`

System-administration views (system admin only):

- `GET /admin/dashboard`
- `GET /admin/warehouses`
- `GET /admin/roles`
- `GET /admin/audit-logs`

The admin dashboard and these routes are read-only. Audit responses intentionally
omit `oldValues` and `newValues`. The existing user-audit trigger stores full
user row JSON in those database columns; that trigger should be reviewed and
updated through an approved migration before exposing audit payloads or
deploying to production. No migration is included or applied here.

General:

- `GET /` (API status)
- `GET /health/database` (database connectivity check)

## Database functions and transactional behavior

The existing PostgreSQL functions remain authoritative for inventory-changing
operations:

- `process_stock_transfer(p_transfer_number TEXT, p_source_warehouse_id
  INTEGER, p_destination_warehouse_id INTEGER, p_requested_by INTEGER,
  p_items JSONB)` returns `transfer_id INTEGER`, `transfer_number TEXT`, and
  `status TEXT`. `p_items` is a non-empty array of `{ "itemId": integer,
  "quantity": integer }` objects. The function locks source stock rows with
  `FOR UPDATE`, prevents negative stock, changes both warehouse balances,
  records transfer items, and sets status to `COMPLETED`.
- `dispatch_shipment(p_shipment_number TEXT)` locks the shipment and source
  stock rows, validates availability, deducts inventory, and marks the
  shipment dispatched.
- `receive_shipment(p_shipment_number TEXT)` locks the shipment, adds inventory
  at its destination, and marks it received.

PostgreSQL function failures roll back their transaction. The current transfer
API translates known business-rule failures, including insufficient stock,
into `400 Bad Request` and duplicate transfer numbers into `409 Conflict`.
Other unexpected database errors are logged server-side and returned as a
generic server error without exposing a stack trace.

No approval, dispatch, or in-transit transfer state is implemented because the
stock-transfer function moves inventory and completes the transfer in one
transaction.

## Triggers and indexes

Existing migrations define audit triggers for warehouse-stock, shipment, and
user changes, plus `updatedAt` triggers for users, warehouses, items, suppliers,
drivers, vehicles, routes, shipments, and stock transfers.

Performance indexes include:

- `WarehouseStock(itemId)`
- Shipment status, source, destination, creator, and shipment-item item indexes
- `StockTransfer(status, sourceWarehouseId, destinationWarehouseId, requestedBy)`
- `AuditLog(tableName, recordIdentifier)` and `AuditLog(createdAt)`
- `Shipment(status, createdAt DESC)`

Indexes and PostgreSQL functions are retained; no migration was created.

### Query-plan observations

Read-only `EXPLAIN (ANALYZE, BUFFERS)` checks were run against the configured
database for warehouse stock, pending shipments, shipment warehouse filtering,
stock-transfer warehouse filtering, and audit-log filtering. At the observed
small table sizes, PostgreSQL selected sequential scans for the stock,
shipment, transfer, and audit tables; it used the `Item` primary-key index for
item joins. Observed execution times were below approximately 2.1 ms in that
run. This is consistent with the planner preferring scans for small tables and
is not evidence that the existing indexes should be removed or that more
indexes are currently warranted. Re-run the plans against representative
production-sized data before changing index strategy.

The checks used `EXPLAIN ANALYZE`, which executes the corresponding SELECT
queries. They did not call a stock-changing function, insert test records, or
run a migration.

## Tests and checks

From the repository root:

```powershell
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend test
npm --prefix backend run test:e2e
npm --prefix frontend run lint
npm --prefix frontend run build
```

Unit tests use mocks for Prisma and do not write to the database. The end-to-end
smoke test exercises the API status route only. The stock-transfer function's
row-locking and rollback behavior was not re-exercised against the configured
cloud database during this work; concurrency testing should use a disposable,
isolated PostgreSQL database with a copied test schema and data, never the
Neon production-like database.

## Deployment

The frontend is configured for static export; `npm --prefix frontend run build`
produces `frontend/out` for a static host such as Cloudflare Pages. Set
`NEXT_PUBLIC_API_URL` to the deployed NestJS API origin. For the backend host,
configure `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGINS`, and `PORT` as server-side environment variables.
The backend CORS allow-list must include the exact deployed frontend origin.
Do not put database credentials or the JWT secret in any `NEXT_PUBLIC_*`
variable.

Deployment has not been performed. Review environment configuration, database
branching, migration status, and the user-audit trigger finding before
production.

## Git workflow status

This checkout was not a Git working tree at inspection time. A local empty
`feature/veltrix-completion` branch has since been initialized, with no commit
or remote configured. Existing history, branch protections, GitHub connection,
and pull-request workflow therefore could not be verified. Do not publish
credentials; configure the intended remote and review the staged/unstaged
changes before committing or opening a pull request.
