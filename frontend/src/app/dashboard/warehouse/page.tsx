"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type User = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  warehouseId: number | null;
};

type DashboardStats = {
  totalStock: number;
  lowStock: number;
  incomingShipments: number;
  activeTransfers: number;
};

export default function WarehouseDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");

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

      fetch(apiUrl("/inventory/dashboard"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || "Unable to load dashboard data.",
            );
          }

          return data;
        })
        .then((data: DashboardStats) => {
          setUser(loggedInUser);
          setStats(data);
        })
        .catch((error) => {
          setUser(loggedInUser);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard data.",
          );
        })
        .finally(() => {
          setStatsLoading(false);
        });
    } catch {
      sessionStorage.clear();
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");

    router.replace("/");
  }

  if (loading || !user) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">
          Loading your workspace...
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

          <h1>Good day, {user.firstName}.</h1>

          <p className="warehouse-subtitle">
            Monitor inventory, shipments, and warehouse activity.
          </p>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Sign out
        </button>
      </header>

      <section className="warehouse-location">
        <div>
          <p className="location-label">ASSIGNED WAREHOUSE</p>

          <h2>
            Warehouse #{user.warehouseId}
          </h2>
        </div>

        <span className="status-badge">
          Operational
        </span>
      </section>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      <section className="warehouse-stats">
        <div className="warehouse-stat-card">
          <span>TOTAL STOCK</span>

          <strong>
            {statsLoading ? "..." : stats?.totalStock ?? 0}
          </strong>

          <p>Items currently assigned</p>
        </div>

        <div className="warehouse-stat-card">
          <span>LOW STOCK</span>

          <strong>
            {statsLoading ? "..." : stats?.lowStock ?? 0}
          </strong>

          <p>Items requiring attention</p>
        </div>

        <div className="warehouse-stat-card">
          <span>INCOMING</span>

          <strong>
            {statsLoading
              ? "..."
              : stats?.incomingShipments ?? 0}
          </strong>

          <p>Shipments arriving</p>
        </div>

        <div className="warehouse-stat-card">
          <span>TRANSFERS</span>

          <strong>
            {statsLoading
              ? "..."
              : stats?.activeTransfers ?? 0}
          </strong>

          <p>Active stock transfers</p>
        </div>
      </section>

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">OPERATIONS</p>

            <h2>Warehouse workspace</h2>
          </div>

          <p>
            Manage the activities assigned to your warehouse.
          </p>
        </div>

        <div className="warehouse-actions">
          <button
            type="button"
            className="operation-card"
            onClick={() =>
              router.push("/dashboard/warehouse/inventory")
            }
          >
            <div>
              <span className="operation-number">01</span>

              <h3>Inventory</h3>

              <p>
                View warehouse stock and monitor item quantities.
              </p>
            </div>

            <span className="operation-arrow">→</span>
          </button>

          <button
            type="button"
            className="operation-card"
            onClick={() =>
              router.push("/dashboard/warehouse/shipments")
            }
          >
            <div>
              <span className="operation-number">02</span>

              <h3>Incoming shipments</h3>

              <p>
                Review shipments and receive incoming inventory.
              </p>
            </div>

            <span className="operation-arrow">→</span>
          </button>

          <button
            type="button"
            className="operation-card"
            onClick={() =>
              router.push("/dashboard/warehouse/transfers")
            }
          >
            <div>
              <span className="operation-number">03</span>

              <h3>Stock transfers</h3>

              <p>
                Request and monitor inventory transfers.
              </p>
            </div>

            <span className="operation-arrow">→</span>
          </button>
        </div>
      </section>

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">ACTIVITY</p>

            <h2>Recent warehouse activity</h2>
          </div>
        </div>

        <div className="empty-activity">
          <span>NO RECENT ACTIVITY</span>

          <p>
            Warehouse activity will appear here as inventory,
            shipments, and transfers are processed.
          </p>
        </div>
      </section>
    </main>
  );
}