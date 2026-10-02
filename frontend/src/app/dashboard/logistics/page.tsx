"use client";

import { useEffect, useState } from "react";
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

type LogisticsStats = {
  totalShipments: number;
  pendingShipments: number;
  dispatchedShipments: number;
  receivedShipments: number;
  activeDrivers: number;
  availableVehicles: number;
  activeRoutes: number;
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  shipmentType: string;
  status: string;
  scheduledAt: string | null;
  sourceWarehouse: { code: string; name: string } | null;
  destinationWarehouse: { code: string; name: string } | null;
  driver: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    status: string;
  } | null;
  vehicle: {
    vehicleCode: string;
    plateNumber: string;
    status: string;
  } | null;
  route: {
    routeCode: string;
    origin: string;
    destination: string;
  } | null;
};

type Driver = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  licenseExpiry: string;
  phone: string | null;
  status: string;
};

type Vehicle = {
  id: number;
  vehicleCode: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  status: string;
};

type Route = {
  id: number;
  routeCode: string;
  origin: string;
  destination: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  status: string;
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

export default function LogisticsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
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
        const loggedInUser: User = JSON.parse(userData);

        if (
          loggedInUser.role !== "LOGISTICS_MANAGER" &&
          loggedInUser.role !== "SYSTEM_ADMIN"
        ) {
          router.replace("/");
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const responses = await Promise.all([
          fetch(apiUrl("/logistics/dashboard"), { headers }),
          fetch(apiUrl("/logistics/shipments"), { headers }),
          fetch(apiUrl("/logistics/drivers"), { headers }),
          fetch(apiUrl("/logistics/vehicles"), { headers }),
          fetch(apiUrl("/logistics/routes"), { headers }),
        ]);

        const [
          dashboardData,
          shipmentData,
          driverData,
          vehicleData,
          routeData,
        ] = await Promise.all([
          readResponse<LogisticsStats>(responses[0]),
          readResponse<Shipment[]>(responses[1]),
          readResponse<Driver[]>(responses[2]),
          readResponse<Vehicle[]>(responses[3]),
          readResponse<Route[]>(responses[4]),
        ]);

        if (cancelled) {
          return;
        }

        setUser(loggedInUser);
        setStats(dashboardData);
        setShipments(shipmentData);
        setDrivers(driverData);
        setVehicles(vehicleData);
        setRoutes(routeData);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load logistics information.",
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
          Loading logistics operations...
        </div>
      </main>
    );
  }

  return (
    <main className="warehouse-dashboard">
      <header className="warehouse-header">
        <div>
          <p className="warehouse-eyebrow">
            VELTRIX • LOGISTICS OPERATIONS
          </p>
          <h1>Logistics overview</h1>
          <p className="warehouse-subtitle">
            Monitor shipment activity, drivers, vehicles, and routes.
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

      <section className="warehouse-stats logistics-stats">
        <StatCard label="TOTAL SHIPMENTS" value={stats?.totalShipments} />
        <StatCard label="PENDING" value={stats?.pendingShipments} />
        <StatCard label="DISPATCHED" value={stats?.dispatchedShipments} />
        <StatCard label="RECEIVED" value={stats?.receivedShipments} />
        <StatCard label="ACTIVE DRIVERS" value={stats?.activeDrivers} />
        <StatCard label="AVAILABLE VEHICLES" value={stats?.availableVehicles} />
        <StatCard label="ACTIVE ROUTES" value={stats?.activeRoutes} />
      </section>

      <section className="warehouse-section" id="shipments">
        <SectionHeading eyebrow="SHIPMENT MONITORING" title="Recent shipments" />
        {shipments.length === 0 ? (
          <EmptyState message="No shipments are currently recorded." />
        ) : (
          <div className="logistics-table-wrapper">
            <table className="inventory-table logistics-table">
              <thead>
                <tr>
                  <th>SHIPMENT</th>
                  <th>STATUS</th>
                  <th>ORIGIN → DESTINATION</th>
                  <th>DRIVER / VEHICLE</th>
                  <th>ROUTE</th>
                </tr>
              </thead>
              <tbody>
                {shipments.slice(0, 10).map((shipment) => (
                  <tr key={shipment.id}>
                    <td>
                      <strong>{shipment.shipmentNumber}</strong>
                      <br />
                      {shipment.shipmentType}
                    </td>
                    <td><StatusBadge status={shipment.status} /></td>
                    <td>
                      {shipment.sourceWarehouse?.code ?? "Supplier"} →{" "}
                      {shipment.destinationWarehouse?.code ?? "—"}
                    </td>
                    <td>
                      {shipment.driver
                        ? `${shipment.driver.firstName} ${shipment.driver.lastName}`
                        : "Unassigned"}
                      <br />
                      {shipment.vehicle?.plateNumber ?? "No vehicle"}
                    </td>
                    <td>
                      {shipment.route
                        ? `${shipment.route.routeCode}: ${shipment.route.origin} → ${shipment.route.destination}`
                        : "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="logistics-resource-grid">
        <ResourceSection id="drivers" title="Drivers" count={drivers.length}>
          {drivers.length === 0 ? (
            <EmptyState message="No drivers are recorded." />
          ) : (
            drivers.slice(0, 8).map((driver) => (
              <ResourceRow key={driver.id}>
                <strong>
                  {driver.firstName} {driver.lastName}
                </strong>
                <span>
                  {driver.employeeCode} · {driver.status}
                </span>
              </ResourceRow>
            ))
          )}
        </ResourceSection>

        <ResourceSection id="vehicles" title="Vehicles" count={vehicles.length}>
          {vehicles.length === 0 ? (
            <EmptyState message="No vehicles are recorded." />
          ) : (
            vehicles.slice(0, 8).map((vehicle) => (
              <ResourceRow key={vehicle.id}>
                <strong>
                  {vehicle.vehicleCode} · {vehicle.plateNumber}
                </strong>
                <span>
                  {vehicle.vehicleType} · {vehicle.status}
                </span>
              </ResourceRow>
            ))
          )}
        </ResourceSection>

        <ResourceSection id="routes" title="Routes" count={routes.length}>
          {routes.length === 0 ? (
            <EmptyState message="No routes are recorded." />
          ) : (
            routes.slice(0, 8).map((route) => (
              <ResourceRow key={route.id}>
                <strong>{route.routeCode}</strong>
                <span>
                  {route.origin} → {route.destination}
                </span>
              </ResourceRow>
            ))
          )}
        </ResourceSection>
      </div>
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

function ResourceSection({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="warehouse-section logistics-resource">
      <SectionHeading eyebrow={`${count} RECORDS`} title={title} />
      <div className="logistics-resource-list">{children}</div>
    </section>
  );
}

function ResourceRow({ children }: { children: React.ReactNode }) {
  return <div className="logistics-resource-row">{children}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <p className="logistics-empty">{message}</p>;
}
