"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { StatusBadge } from "@/components/dashboard-ui";

type User = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  warehouseId: number | null;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

type AvailableStock = {
  warehouseId: number;
  itemId: number;
  quantityOnHand: number;
  warehouse: Warehouse;
  item: {
    id: number;
    sku: string;
    name: string;
    unitOfMeasure: string;
  };
};

type Transfer = {
  id: number;
  transferNumber: string;
  status: string;
  createdAt: string;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  items: {
    quantityRequested: number;
    quantityTransferred: number;
    item: {
      id: number;
      sku: string;
      name: string;
      unitOfMeasure: string;
    };
  }[];
};

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      (typeof data.message === "string" ||
        Array.isArray(data.message))
        ? data.message
        : "The request could not be completed.";

    throw new Error(
      Array.isArray(message) ? message.join(", ") : message,
    );
  }

  return data as T;
}

export default function WarehouseTransfers() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [stock, setStock] = useState<AvailableStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferNumber, setTransferNumber] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] =
    useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      const token = sessionStorage.getItem("accessToken");
      const userData = sessionStorage.getItem("user");

      if (!token || !userData) {
        router.replace("/");
        return;
      }

      try {
        const loggedInUser: User = JSON.parse(userData);

        if (
          loggedInUser.role !== "WAREHOUSE_STAFF" ||
          loggedInUser.warehouseId === null
        ) {
          router.replace("/");
          return;
        }

        const [stockResponse, warehouseResponse, transferResponse] =
          await Promise.all([
            fetch(apiUrl("/inventory/stock"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(apiUrl("/transfers/warehouses"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(apiUrl("/transfers"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        const [stockData, warehouseData, transferData] =
          await Promise.all([
            readResponse<AvailableStock[]>(stockResponse),
            readResponse<Warehouse[]>(warehouseResponse),
            readResponse<Transfer[]>(transferResponse),
          ]);

        if (cancelled) {
          return;
        }

        setUser(loggedInUser);
        setStock(stockData);
        setWarehouses(warehouseData);
        setTransfers(transferData);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load transfer information.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const availableItems = stock.filter(
    (record) => record.quantityOnHand > 0,
  );
  const selectedStock = availableItems.find(
    (record) => record.itemId.toString() === itemId,
  );
  const destinations = warehouses.filter(
    (warehouse) => warehouse.id !== user?.warehouseId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = sessionStorage.getItem("accessToken");
    const parsedQuantity = Number(quantity);

    if (!token) {
      router.replace("/");
      return;
    }

    if (!user || !selectedStock) {
      setError("Select an item with available stock.");
      return;
    }

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0 ||
      parsedQuantity > selectedStock.quantityOnHand
    ) {
      setError(
        `Enter a quantity between 1 and ${selectedStock.quantityOnHand}.`,
      );
      return;
    }

    if (!destinationWarehouseId) {
      setError("Select a destination warehouse.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(apiUrl("/transfers"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transferNumber,
          sourceWarehouseId: user.warehouseId,
          destinationWarehouseId: Number(destinationWarehouseId),
          items: [
            {
              itemId: selectedStock.itemId,
              quantity: parsedQuantity,
            },
          ],
        }),
      });

      await readResponse(response);
      setSuccess(
        `Transfer ${transferNumber} completed successfully.`,
      );
      setTransferNumber("");
      setQuantity("1");

      const [stockResponse, transferResponse] = await Promise.all([
        fetch(apiUrl("/inventory/stock"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl("/transfers"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [stockData, transferData] = await Promise.all([
        readResponse<AvailableStock[]>(stockResponse),
        readResponse<Transfer[]>(transferResponse),
      ]);
      setStock(stockData);
      setTransfers(transferData);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to process the stock transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">
          Loading stock transfers...
        </div>
      </main>
    );
  }

  return (
    <main className="warehouse-dashboard">
      <header className="warehouse-header">
        <div>
          <p className="warehouse-eyebrow">
            VELTRIX • WAREHOUSE OPERATIONS
          </p>
          <h1>Stock transfers</h1>
          <p className="warehouse-subtitle">
            Move available stock to another active warehouse and review
            completed transfers.
          </p>
        </div>
        <button
          type="button"
          className="logout-button"
          onClick={() => router.push("/dashboard/warehouse")}
        >
          ← Dashboard
        </button>
      </header>

      <section className="warehouse-location">
        <div>
          <p className="location-label">SOURCE WAREHOUSE</p>
          <h2>
            {stock[0]?.warehouse.code
              ? `${stock[0].warehouse.code} — ${stock[0].warehouse.name}`
              : `Warehouse #${user.warehouseId}`}
          </h2>
        </div>
        <span className="status-badge">
          {availableItems.length} stocked items
        </span>
      </section>

      {error && <div className="login-error">{error}</div>}
      {success && <div className="shipment-success">{success}</div>}

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">INVENTORY MOVEMENT</p>
            <h2>Create a transfer</h2>
          </div>
          <p>
            Transfers immediately move stock and are recorded as
            completed.
          </p>
        </div>

        {availableItems.length === 0 ? (
          <div className="empty-activity">
            <span>NO AVAILABLE STOCK</span>
            <p>
              There are no items with positive stock available to
              transfer.
            </p>
          </div>
        ) : (
          <form
            className="transfer-form"
            onSubmit={handleSubmit}
          >
            <div className="transfer-form-grid">
              <label className="input-group">
                <span>Transfer number</span>
                <input
                  type="text"
                  value={transferNumber}
                  onChange={(event) =>
                    setTransferNumber(event.target.value)
                  }
                  maxLength={100}
                  required
                />
              </label>

              <label className="input-group">
                <span>Destination warehouse</span>
                <select
                  value={destinationWarehouseId}
                  onChange={(event) =>
                    setDestinationWarehouseId(event.target.value)
                  }
                  required
                >
                  <option value="">Select destination</option>
                  {destinations.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} — {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-group">
                <span>Item</span>
                <select
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                  required
                >
                  <option value="">Select item</option>
                  {availableItems.map((record) => (
                    <option
                      key={record.itemId}
                      value={record.itemId}
                    >
                      {record.item.sku} — {record.item.name} (
                      {record.quantityOnHand}{" "}
                      {record.item.unitOfMeasure} available)
                    </option>
                  ))}
                </select>
              </label>

              <label className="input-group">
                <span>Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={selectedStock?.quantityOnHand ?? undefined}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="receive-button"
              disabled={
                submitting ||
                destinations.length === 0 ||
                availableItems.length === 0
              }
            >
              {submitting ? "Processing transfer..." : "Transfer stock"}
            </button>

            {destinations.length === 0 && (
              <p className="transfer-note">
                No other active warehouses are available.
              </p>
            )}
          </form>
        )}
      </section>

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">TRANSFER HISTORY</p>
            <h2>Warehouse transfers</h2>
          </div>
          <p>
            Only transfers involving your assigned warehouse are shown.
          </p>
        </div>

        <div className="shipment-list">
          {transfers.length === 0 ? (
            <div className="empty-activity">
              <span>NO TRANSFERS FOUND</span>
              <p>
                Completed transfers involving this warehouse will
                appear here.
              </p>
            </div>
          ) : (
            transfers.map((transfer) => (
              <article
                key={transfer.id}
                className="shipment-card"
              >
                <div className="shipment-card-header">
                  <div>
                    <span className="operation-number">
                      {transfer.transferNumber}
                    </span>
                    <h3>
                      {new Date(transfer.createdAt).toLocaleString()}
                    </h3>
                  </div>
                  <StatusBadge status={transfer.status} />
                </div>

                <div className="shipment-details">
                  <div>
                    <span>SOURCE</span>
                    <strong>
                      {transfer.sourceWarehouse.code} —{" "}
                      {transfer.sourceWarehouse.name}
                    </strong>
                  </div>
                  <div>
                    <span>DESTINATION</span>
                    <strong>
                      {transfer.destinationWarehouse.code} —{" "}
                      {transfer.destinationWarehouse.name}
                    </strong>
                  </div>
                </div>

                <div className="shipment-items">
                  {transfer.items.map((transferItem) => (
                    <div
                      key={`${transfer.id}-${transferItem.item.id}`}
                      className="shipment-item"
                    >
                      <div>
                        <strong>{transferItem.item.name}</strong>
                        <span>{transferItem.item.sku}</span>
                      </div>
                      <strong>
                        Requested {transferItem.quantityRequested} ·
                        transferred {transferItem.quantityTransferred}{" "}
                        {transferItem.item.unitOfMeasure}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
