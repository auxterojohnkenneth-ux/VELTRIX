"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { StatusBadge } from "@/components/dashboard-ui";

type ShipmentItem = {
  shipmentId: number;
  itemId: number;
  quantity: number;
  item: {
    id: number;
    sku: string;
    name: string;
    unitOfMeasure: string;
  };
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  shipmentType: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  supplier: {
    id: number;
    supplierCode: string;
    companyName: string;
  } | null;
  sourceWarehouse: {
    id: number;
    code: string;
    name: string;
  } | null;
  destinationWarehouse: {
    id: number;
    code: string;
    name: string;
  } | null;
  shipmentItems: ShipmentItem[];
};

type User = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  warehouseId: number | null;
};

export default function WarehouseShipments() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    const userData = sessionStorage.getItem("user");

    if (!token || !userData) {
      router.replace("/");
      return;
    }

    try {
      const loggedInUser: User = JSON.parse(userData);

      if (loggedInUser.role !== "WAREHOUSE_STAFF") {
        router.replace("/");
        return;
      }

      fetch(apiUrl("/shipments"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || "Unable to load shipments.",
            );
          }

          return data;
        })
        .then((data: Shipment[]) => {
          setUser(loggedInUser);
          setShipments(data);
        })
        .catch((error) => {
          setUser(loggedInUser);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load shipments.",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    } catch {
      sessionStorage.clear();
      router.replace("/");
    }
  }, [router]);

  async function handleReceive(shipmentNumber: string) {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      router.replace("/");
      return;
    }

    setReceiving(shipmentNumber);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        apiUrl(`/shipments/${encodeURIComponent(
          shipmentNumber,
        )}/receive`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to receive shipment.",
        );
      }

      setSuccess(
        `Shipment ${shipmentNumber} was successfully received.`,
      );

      setShipments((currentShipments) =>
        currentShipments.map((shipment) =>
          shipment.shipmentNumber === shipmentNumber
            ? {
                ...shipment,
                status: "RECEIVED",
              }
            : shipment,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to receive shipment.",
      );
    } finally {
      setReceiving("");
    }
  }

  if (!user || loading) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">
          Loading shipments...
        </div>
      </main>
    );
  }

  const incomingShipments = shipments.filter(
    (shipment) =>
      shipment.destinationWarehouse?.id === user.warehouseId,
  );

  return (
    <main className="warehouse-dashboard">
      <header className="warehouse-header">
        <div>
          <p className="warehouse-eyebrow">
            VELTRIX • WAREHOUSE OPERATIONS
          </p>

          <h1>Incoming shipments</h1>

          <p className="warehouse-subtitle">
            Review and receive shipments assigned to your warehouse.
          </p>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={() =>
            router.push("/dashboard/warehouse")
          }
        >
          ← Dashboard
        </button>
      </header>

      <section className="warehouse-location">
        <div>
          <p className="location-label">
            DESTINATION WAREHOUSE
          </p>

          <h2>
            Warehouse #{user.warehouseId}
          </h2>
        </div>

        <span className="status-badge">
          {incomingShipments.length} shipments
        </span>
      </section>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      {success && (
        <div className="shipment-success">
          {success}
        </div>
      )}

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">
              INCOMING LOGISTICS
            </p>

            <h2>Shipment queue</h2>
          </div>

          <p>
            Only shipments destined for your assigned warehouse
            are displayed.
          </p>
        </div>

        <div className="shipment-list">
          {incomingShipments.length === 0 ? (
            <div className="empty-activity">
              <span>NO INCOMING SHIPMENTS</span>

              <p>
                There are currently no shipments assigned to
                this warehouse.
              </p>
            </div>
          ) : (
            incomingShipments.map((shipment) => {
              const isPending =
                shipment.status === "PENDING";

              return (
                <article
                  key={shipment.id}
                  className="shipment-card"
                >
                  <div className="shipment-card-header">
                    <div>
                      <span className="operation-number">
                        {shipment.shipmentNumber}
                      </span>

                      <h3>
                        {shipment.shipmentType}
                      </h3>
                    </div>

                    <StatusBadge status={shipment.status} />
                  </div>

                  <div className="shipment-details">
                    <div>
                      <span>SUPPLIER</span>

                      <strong>
                        {shipment.supplier?.companyName ??
                          "Internal transfer"}
                      </strong>
                    </div>

                    <div>
                      <span>SOURCE</span>

                      <strong>
                        {shipment.sourceWarehouse
                          ? `${shipment.sourceWarehouse.code} — ${shipment.sourceWarehouse.name}`
                          : "External supplier"}
                      </strong>
                    </div>

                    <div>
                      <span>SCHEDULED</span>

                      <strong>
                        {shipment.scheduledAt
                          ? new Date(
                              shipment.scheduledAt,
                            ).toLocaleDateString()
                          : "Not scheduled"}
                      </strong>
                    </div>

                    <div>
                      <span>ITEMS</span>

                      <strong>
                        {shipment.shipmentItems.length}
                      </strong>
                    </div>
                  </div>

                  <div className="shipment-items">
                    {shipment.shipmentItems.map(
                      (shipmentItem) => (
                        <div
                          key={`${shipmentItem.shipmentId}-${shipmentItem.itemId}`}
                          className="shipment-item"
                        >
                          <div>
                            <strong>
                              {shipmentItem.item.name}
                            </strong>

                            <span>
                              {shipmentItem.item.sku}
                            </span>
                          </div>

                          <strong>
                            {shipmentItem.quantity}{" "}
                            {shipmentItem.item.unitOfMeasure}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>

                  {isPending && (
                    <button
                      type="button"
                      className="receive-button"
                      disabled={
                        receiving ===
                        shipment.shipmentNumber
                      }
                      onClick={() =>
                        handleReceive(
                          shipment.shipmentNumber,
                        )
                      }
                    >
                      {receiving ===
                      shipment.shipmentNumber
                        ? "Receiving..."
                        : "Receive shipment"}
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}