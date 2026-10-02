"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type StockItem = {
  warehouseId: number;
  itemId: number;
  quantityOnHand: number;
  warehouse: {
    id: number;
    code: string;
    name: string;
  };
  item: {
    id: number;
    sku: string;
    name: string;
    unitOfMeasure: string;
    reorderLevel: number;
    category: {
      id: number;
      name: string;
    };
  };
};

type User = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  warehouseId: number | null;
};

export default function WarehouseInventory() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
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

      fetch(apiUrl("/inventory/stock"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || "Unable to load inventory.",
            );
          }

          return data;
        })
        .then((data: StockItem[]) => {
          setUser(loggedInUser);
          setStock(data);
        })
        .catch((error) => {
          setUser(loggedInUser);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load inventory.",
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

  if (!user || loading) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">
          Loading inventory...
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

          <h1>Inventory</h1>

          <p className="warehouse-subtitle">
            View and monitor inventory assigned to your warehouse.
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
          <p className="location-label">
            ASSIGNED WAREHOUSE
          </p>

          <h2>
            Warehouse #{user.warehouseId}
          </h2>
        </div>

        <span className="status-badge">
          {stock.length} records
        </span>
      </section>

      {error && (
        <div className="login-error">
          {error}
        </div>
      )}

      <section className="warehouse-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">
              CURRENT STOCK
            </p>

            <h2>Warehouse inventory</h2>
          </div>

          <p>
            Stock visibility is restricted to your assigned
            warehouse.
          </p>
        </div>

        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>ITEM</th>
                <th>CATEGORY</th>
                <th>STOCK</th>
                <th>REORDER LEVEL</th>
                <th>STATUS</th>
              </tr>
            </thead>

            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="inventory-empty"
                  >
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                stock.map((record) => {
                  const isLowStock =
                    record.quantityOnHand <=
                    record.item.reorderLevel;

                  return (
                    <tr
                      key={`${record.warehouseId}-${record.itemId}`}
                    >
                      <td>{record.item.sku}</td>

                      <td>
                        <strong>
                          {record.item.name}
                        </strong>
                      </td>

                      <td>
                        {record.item.category.name}
                      </td>

                      <td>
                        {record.quantityOnHand}{" "}
                        {record.item.unitOfMeasure}
                      </td>

                      <td>
                        {record.item.reorderLevel}
                      </td>

                      <td>
                        <span
                          className={
                            isLowStock
                              ? "inventory-status low"
                              : "inventory-status normal"
                          }
                        >
                          {isLowStock
                            ? "Low stock"
                            : "Normal"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}