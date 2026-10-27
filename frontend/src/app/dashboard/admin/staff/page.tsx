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
  status: "ACTIVE" | "INACTIVE";
};

type WarehouseStaff = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isActive: boolean;
  warehouse: Pick<Warehouse, "id" | "code" | "name"> | null;
};

type StaffForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  warehouseId: string;
};

const emptyForm: StaffForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  warehouseId: "",
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

export default function AdminStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<WarehouseStaff[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [assignmentSelection, setAssignmentSelection] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
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

        const headers = { Authorization: `Bearer ${token}` };
        const [staffResponse, warehouseResponse] = await Promise.all([
          fetch(apiUrl("/admin/warehouse-staff"), { headers }),
          fetch(apiUrl("/admin/warehouses"), { headers }),
        ]);
        const [staffRecords, warehouseRecords] = await Promise.all([
          readResponse<WarehouseStaff[]>(staffResponse),
          readResponse<Warehouse[]>(warehouseResponse),
        ]);

        if (!cancelled) {
          setStaff(staffRecords);
          setWarehouses(warehouseRecords.filter((row) => row.status === "ACTIVE"));
          setAssignmentSelection(
            Object.fromEntries(
              staffRecords.map((record) => [
                record.id,
                record.warehouse ? String(record.warehouse.id) : "",
              ]),
            ),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load warehouse staff.",
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      router.replace("/");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await readResponse<WarehouseStaff>(
        await fetch(apiUrl("/admin/warehouse-staff"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            warehouseId: Number(form.warehouseId),
          }),
        }),
      );
      setStaff((current) => [...current, saved]);
      setAssignmentSelection((current) => ({
        ...current,
        [saved.id]: saved.warehouse ? String(saved.warehouse.id) : "",
      }));
      setForm(emptyForm);
      setSuccess(`Account for ${saved.firstName} ${saved.lastName} created.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create the account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateWarehouse(record: WarehouseStaff) {
    const warehouseId = Number(assignmentSelection[record.id]);
    if (!warehouseId || warehouseId === record.warehouse?.id) {
      return;
    }
    const warehouse = warehouses.find((row) => row.id === warehouseId);
    if (!warehouse || !window.confirm(
      `Reassign ${record.firstName} ${record.lastName} to ${warehouse.name}?`,
    )) {
      return;
    }

    await updateStaffRecord(
      record.id,
      `/admin/warehouse-staff/${record.id}/warehouse`,
      { warehouseId },
      `Assigned ${record.firstName} ${record.lastName} to ${warehouse.name}.`,
    );
  }

  async function updateStatus(record: WarehouseStaff) {
    const nextActive = !record.isActive;
    const action = nextActive ? "activate" : "deactivate";
    if (!window.confirm(
      `Are you sure you want to ${action} ${record.firstName} ${record.lastName}'s account?`,
    )) {
      return;
    }
    await updateStaffRecord(
      record.id,
      `/admin/warehouse-staff/${record.id}/status`,
      { isActive: nextActive },
      `Account ${nextActive ? "activated" : "deactivated"}.`,
    );
  }

  async function updateStaffRecord(
    id: number,
    path: string,
    body: Record<string, number | boolean>,
    message: string,
  ) {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      router.replace("/");
      return;
    }

    setError("");
    setSuccess("");
    try {
      const updated = await readResponse<WarehouseStaff>(
        await fetch(apiUrl(path), {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
      setStaff((current) =>
        current.map((record) => (record.id === id ? updated : record)),
      );
      if (updated.warehouse) {
        setAssignmentSelection((current) => ({
          ...current,
          [id]: String(updated.warehouse!.id),
        }));
      }
      setSuccess(message);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the staff account.",
      );
    }
  }

  if (loading) {
    return (
      <main className="warehouse-dashboard">
        <div className="dashboard-loading">Loading warehouse staff...</div>
      </main>
    );
  }

  return (
    <main className="warehouse-dashboard">
      <AdminManagementHeader
        eyebrow="SYSTEM ADMINISTRATION"
        title="Warehouse staff"
        description="Create staff accounts and manage warehouse assignments and access."
      />
      <AdminManagementFeedback error={error} success={success} />

      <form className="management-form" onSubmit={handleSubmit}>
        <div className="management-form-heading">
          <div>
            <p className="section-eyebrow">NEW ACCOUNT</p>
            <h3>Create warehouse staff account</h3>
          </div>
        </div>
        <div className="management-form-grid">
          <label className="input-group">
            <span>First name *</span>
            <input
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              maxLength={100}
              autoComplete="given-name"
              required
            />
          </label>
          <label className="input-group">
            <span>Last name *</span>
            <input
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              maxLength={100}
              autoComplete="family-name"
              required
            />
          </label>
          <label className="input-group">
            <span>Username *</span>
            <input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              maxLength={64}
              autoComplete="username"
              required
            />
          </label>
          <label className="input-group">
            <span>Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              maxLength={254}
              autoComplete="email"
              required
            />
          </label>
          <label className="input-group">
            <span>Initial password * (12+ characters)</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="input-group">
            <span>Warehouse *</span>
            <select
              value={form.warehouseId}
              onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
              required
            >
              <option value="">Select an active warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="management-form-actions">
          <button
            type="submit"
            className="primary-action"
            disabled={saving || warehouses.length === 0}
          >
            {saving ? "Creating..." : "Create account"}
          </button>
        </div>
        {warehouses.length === 0 && (
          <p className="management-note">
            Add an active warehouse before creating a staff account.
          </p>
        )}
      </form>

      <section className="management-table-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">STAFF DIRECTORY</p>
            <h2>Warehouse staff accounts</h2>
          </div>
          <span className="status-badge">{staff.length} accounts</span>
        </div>
        <div
          className="data-table-scroll"
          role="region"
          aria-label="Warehouse staff accounts"
          tabIndex={0}
        >
          <table className="inventory-table management-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>USERNAME</th>
                <th>EMAIL</th>
                <th>WAREHOUSE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="inventory-empty">
                    No warehouse staff accounts found.
                  </td>
                </tr>
              ) : (
                staff.map((record) => (
                  <tr key={record.id}>
                    <td>{record.firstName} {record.lastName}</td>
                    <td>{record.username}</td>
                    <td>{record.email}</td>
                    <td>
                      <div className="staff-assignment">
                        <select
                          aria-label={`Warehouse for ${record.username}`}
                          value={assignmentSelection[record.id] ?? ""}
                          onChange={(event) =>
                            setAssignmentSelection((current) => ({
                              ...current,
                              [record.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select warehouse</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="secondary-action"
                          disabled={
                            !assignmentSelection[record.id] ||
                            Number(assignmentSelection[record.id]) === record.warehouse?.id
                          }
                          onClick={() => void updateWarehouse(record)}
                        >
                          Assign
                        </button>
                      </div>
                    </td>
                    <td><StatusBadge status={record.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void updateStatus(record)}
                      >
                        {record.isActive ? "Deactivate" : "Activate"}
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
