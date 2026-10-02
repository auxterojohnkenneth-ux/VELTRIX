"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { StatusBadge } from "@/components/dashboard-ui";

type LoggedInUser = {
  role: string;
};

type UserRecord = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: { name: string };
  warehouse: { code: string; name: string } | null;
  isActive: boolean;
};

type AdminStats = {
  totalUsers: number;
  totalWarehouses: number;
  totalItems: number;
  totalStock: number;
  lowStockRecords: number;
  totalShipments: number;
  pendingShipments: number;
  dispatchedShipments: number;
  receivedShipments: number;
  totalTransfers: number;
  completedTransfers: number;
  auditLogEntries: number;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
  city: string;
  province: string;
  status: string;
  _count: {
    users: number;
    warehouseStock: number;
  };
};

type Role = {
  id: number;
  name: string;
  description: string | null;
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  shipmentType: string;
  status: string;
  createdAt: string;
};

type AuditEntry = {
  id: number;
  userId: number | null;
  action: string;
  tableName: string;
  recordIdentifier: string;
  createdAt: string;
  user: { id: number; username: string } | null;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const token = sessionStorage.getItem("accessToken");
      const userData = sessionStorage.getItem("user");

      if (!token || !userData) {
        router.replace("/");
        return;
      }

      try {
        const loggedInUser: LoggedInUser = JSON.parse(userData);

        if (loggedInUser.role !== "SYSTEM_ADMIN") {
          router.replace("/");
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const responses = await Promise.all([
          fetch(apiUrl("/admin/dashboard"), { headers }),
          fetch(apiUrl("/users"), { headers }),
          fetch(apiUrl("/admin/warehouses"), { headers }),
          fetch(apiUrl("/admin/roles"), { headers }),
          fetch(apiUrl("/shipments"), { headers }),
          fetch(apiUrl("/admin/audit-logs"), { headers }),
        ]);

        const [
          dashboardData,
          userDataResult,
          warehouseData,
          roleData,
          shipmentData,
          auditData,
        ] = await Promise.all([
          readResponse<AdminStats>(responses[0]),
          readResponse<UserRecord[]>(responses[1]),
          readResponse<Warehouse[]>(responses[2]),
          readResponse<Role[]>(responses[3]),
          readResponse<Shipment[]>(responses[4]),
          readResponse<AuditEntry[]>(responses[5]),
        ]);

        if (cancelled) {
          return;
        }

        setUser(loggedInUser);
        setStats(dashboardData);
        setUsers(userDataResult);
        setWarehouses(warehouseData);
        setRoles(roleData);
        setShipments(shipmentData);
        setAuditLogs(auditData);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load administration data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
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
          Loading administration overview...
        </div>
      </main>
    );
  }

  const latestUsers = [...users].reverse().slice(0, 8);

  return (
    <main className="warehouse-dashboard">
      <header className="warehouse-header">
        <div>
          <p className="warehouse-eyebrow">
            VELTRIX • SYSTEM ADMINISTRATION
          </p>
          <h1>System overview</h1>
          <p className="warehouse-subtitle">
            Review users, warehouses, inventory, shipments, and system
            audit activity.
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

      {error && <div className="login-error">{error}</div>}

      <section className="warehouse-stats admin-stats" id="overview">
        <StatCard label="USERS" value={stats?.totalUsers} />
        <StatCard label="WAREHOUSES" value={stats?.totalWarehouses} />
        <StatCard label="ITEMS" value={stats?.totalItems} />
        <StatCard label="TOTAL STOCK" value={stats?.totalStock} />
        <StatCard label="LOW-STOCK RECORDS" value={stats?.lowStockRecords} />
        <StatCard label="SHIPMENTS" value={stats?.totalShipments} />
        <StatCard label="PENDING SHIPMENTS" value={stats?.pendingShipments} />
        <StatCard
          label="DISPATCHED / RECEIVED"
          value={
            stats
              ? stats.dispatchedShipments + stats.receivedShipments
              : undefined
          }
        />
        <StatCard label="TRANSFERS" value={stats?.totalTransfers} />
        <StatCard label="COMPLETED TRANSFERS" value={stats?.completedTransfers} />
        <StatCard label="AUDIT ENTRIES" value={stats?.auditLogEntries} />
      </section>

      <section className="warehouse-section" id="warehouses">
        <SectionHeading eyebrow="LOCATIONS" title="Warehouses" />
        {warehouses.length === 0 ? (
          <EmptyState message="No warehouses are recorded." />
        ) : (
          <div className="admin-card-grid">
            {warehouses.map((warehouse) => (
              <article className="admin-record-card" key={warehouse.id}>
                <div className="admin-record-heading">
                  <strong>{warehouse.code}</strong>
                  <StatusBadge status={warehouse.status} />
                </div>
                <h3>{warehouse.name}</h3>
                <p>
                  {warehouse.city}, {warehouse.province}
                </p>
                <p>
                  {warehouse._count.users} users ·{" "}
                  {warehouse._count.warehouseStock} stock records
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="admin-content-grid">
        <section className="warehouse-section" id="users">
          <SectionHeading eyebrow="ACCESS" title="Recent users" />
          {latestUsers.length === 0 ? (
            <EmptyState message="No users are recorded." />
          ) : (
            <div className="admin-record-list">
              {latestUsers.map((record) => (
                <div className="logistics-resource-row" key={record.id}>
                  <strong>
                    {record.firstName} {record.lastName} · {record.username}
                  </strong>
                  <span>
                    {record.role.name} ·{" "}
                    {record.warehouse
                      ? record.warehouse.code
                      : "No assigned warehouse"}{" "}
                    · {record.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="warehouse-section" id="roles">
          <SectionHeading eyebrow="AUTHORIZATION" title="System roles" />
          {roles.length === 0 ? (
            <EmptyState message="No roles are recorded." />
          ) : (
            <div className="admin-record-list">
              {roles.map((role) => (
                <div className="logistics-resource-row" key={role.id}>
                  <strong>{role.name}</strong>
                  <span>{role.description ?? "No description provided."}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="warehouse-section" id="shipments">
        <SectionHeading eyebrow="OPERATIONS" title="Recent shipments" />
        {shipments.length === 0 ? (
          <EmptyState message="No shipments are recorded." />
        ) : (
          <div className="logistics-table-wrapper">
            <table className="inventory-table logistics-table">
              <thead>
                <tr>
                  <th>SHIPMENT</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {shipments.slice(0, 10).map((shipment) => (
                  <tr key={shipment.id}>
                    <td>{shipment.shipmentNumber}</td>
                    <td>{shipment.shipmentType}</td>
                    <td><StatusBadge status={shipment.status} /></td>
                    <td>{new Date(shipment.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="warehouse-section" id="audit">
        <SectionHeading eyebrow="TRACEABILITY" title="Recent audit activity" />
        {auditLogs.length === 0 ? (
          <EmptyState message="No audit entries are recorded." />
        ) : (
          <div className="admin-record-list">
            {auditLogs.map((entry) => (
              <div className="logistics-resource-row" key={entry.id}>
                <strong>
                  {entry.action} · {entry.tableName} ·{" "}
                  {entry.recordIdentifier}
                </strong>
                <span>
                  {entry.user?.username ?? "System"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="warehouse-stat-card">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <p>Current database total</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="logistics-empty">{message}</p>;
}
