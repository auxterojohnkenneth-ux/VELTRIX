"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminManagementFeedback,
  AdminManagementHeader,
} from "@/components/admin-management-ui";
import { StatusBadge } from "@/components/dashboard-ui";
import { apiUrl } from "@/lib/api";

type Warehouse = {
  id: number;
  code: string;
  name: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  contactNumber: string;
  status: "ACTIVE" | "INACTIVE";
  _count: {
    users: number;
    warehouseStock: number;
    sourceShipments: number;
    destinationShipments: number;
    sourceTransfers: number;
    destinationTransfers: number;
  };
};

type WarehouseForm = Omit<Warehouse, "id" | "_count">;

const emptyForm: WarehouseForm = {
  code: "",
  name: "",
  addressLine: "",
  city: "",
  province: "",
  postalCode: "",
  contactNumber: "",
  status: "ACTIVE",
};

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      (typeof data.message === "string" || Array.isArray(data.message))
        ? data.message
        : "The request could not be completed.";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return data as T;
}

export default function AdminWarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = sessionStorage.getItem("accessToken");
      const userData = sessionStorage.getItem("user");

      if (!token || !userData) {
        router.replace("/");
        return;
      }

      try {
        const user: { role?: string } = JSON.parse(userData);
        if (user.role !== "SYSTEM_ADMIN") {
          router.replace("/");
          return;
        }

        const response = await fetch(apiUrl("/admin/warehouses"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readResponse<Warehouse[]>(response);
        if (!cancelled) {
          setWarehouses(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load warehouses.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function beginEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      addressLine: warehouse.addressLine,
      city: warehouse.city,
      province: warehouse.province,
      postalCode: warehouse.postalCode,
      contactNumber: warehouse.contactNumber,
      status: warehouse.status,
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      router.replace("/");
      return;
    }

    const trimmedForm: WarehouseForm = {
      code: form.code.trim(),
      name: form.name.trim(),
      addressLine: form.addressLine.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
      contactNumber: form.contactNumber.trim(),
      status: form.status,
    };

    if (Object.entries(trimmedForm).some(([key, value]) => key !== "status" && !value)) {
      setError("Complete all required warehouse fields.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        apiUrl(
          editingId === null
            ? "/admin/warehouses"
            : `/admin/warehouses/${editingId}`,
        ),
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trimmedForm),
        },
      );
      const savedWarehouse = await readResponse<Warehouse>(response);
      setSuccess(
        editingId === null ? "Warehouse added." : "Warehouse updated.",
      );
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      try {
        const updatedResponse = await fetch(apiUrl("/admin/warehouses"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWarehouses(await readResponse<Warehouse[]>(updatedResponse));
      } catch (refreshError) {
        setWarehouses((current) =>
          current.some((warehouse) => warehouse.id === savedWarehouse.id)
            ? current.map((warehouse) =>
                warehouse.id === savedWarehouse.id ? savedWarehouse : warehouse,
              )
            : [...current, savedWarehouse].sort((left, right) =>
                left.code.localeCompare(right.code),
              ),
        );
        setError(
          `Warehouse was saved, but the list could not be refreshed: ${
            refreshError instanceof Error
              ? refreshError.message
              : "request failed"
          }`,
        );
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save warehouse.",
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  if (loading) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">Loading warehouses...</div>
      </main>
    );
  }

  return (
    <main className="warehouse-dashboard">
      <AdminManagementHeader
        eyebrow="SYSTEM ADMINISTRATION"
        title="Warehouses"
        description="Maintain warehouse locations and contact details. Existing stock, shipment, transfer, and user relationships are preserved."
        action={
          <button type="button" className="primary-action" onClick={beginCreate}>
            Add warehouse
          </button>
        }
      />

      <AdminManagementFeedback error={error} success={success} />

      {formOpen && (
        <form className="management-form" onSubmit={handleSubmit}>
          <div className="management-form-heading">
            <div>
              <p className="section-eyebrow">
                {editingId === null ? "NEW LOCATION" : "EDIT LOCATION"}
              </p>
              <h3>
                {editingId === null ? "Add warehouse" : `Edit ${form.code}`}
              </h3>
            </div>
            <span className="management-note">Warehouse ID is not editable</span>
          </div>
          <div className="management-form-grid">
            <label className="input-group">
              <span>Warehouse code *</span>
              <input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
              />
            </label>
            <label className="input-group">
              <span>Name *</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="input-group management-wide">
              <span>Address line *</span>
              <input
                value={form.addressLine}
                onChange={(event) =>
                  setForm({ ...form, addressLine: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <span>City *</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                required
              />
            </label>
            <label className="input-group">
              <span>Province *</span>
              <input
                value={form.province}
                onChange={(event) =>
                  setForm({ ...form, province: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <span>Postal code *</span>
              <input
                value={form.postalCode}
                onChange={(event) =>
                  setForm({ ...form, postalCode: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <span>Contact number *</span>
              <input
                value={form.contactNumber}
                onChange={(event) =>
                  setForm({ ...form, contactNumber: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <span>Status *</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as WarehouseForm["status"],
                  })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>
          <div className="management-form-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={cancelForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId === null
                  ? "Add warehouse"
                  : "Save changes"}
            </button>
          </div>
        </form>
      )}

      <section className="management-table-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">LOCATION DIRECTORY</p>
            <h2>Existing warehouses</h2>
          </div>
          <span className="status-badge">{warehouses.length} records</span>
        </div>
        <div
          className="data-table-scroll"
          role="region"
          aria-label="Warehouses"
          tabIndex={0}
        >
          <table className="inventory-table management-table">
            <thead>
              <tr>
                <th>CODE</th>
                <th>WAREHOUSE</th>
                <th>LOCATION</th>
                <th>CONTACT</th>
                <th>STATUS</th>
                <th>ASSOCIATED RECORDS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="inventory-empty">
                    No warehouses found.
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => (
                  <tr key={warehouse.id}>
                    <td>{warehouse.code}</td>
                    <td>
                      <strong>{warehouse.name}</strong>
                      <small>{warehouse.addressLine}</small>
                    </td>
                    <td>
                      {warehouse.city}, {warehouse.province}{" "}
                      {warehouse.postalCode}
                    </td>
                    <td>{warehouse.contactNumber}</td>
                    <td><StatusBadge status={warehouse.status} /></td>
                    <td>
                      {warehouse._count.users} users ·{" "}
                      {warehouse._count.warehouseStock} stock ·{" "}
                      {warehouse._count.sourceShipments +
                        warehouse._count.destinationShipments}{" "}
                      shipments ·{" "}
                      {warehouse._count.sourceTransfers +
                        warehouse._count.destinationTransfers}{" "}
                      transfers
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => beginEdit(warehouse)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
