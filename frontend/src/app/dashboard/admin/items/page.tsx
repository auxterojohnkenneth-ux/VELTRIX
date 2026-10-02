"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminManagementFeedback,
  AdminManagementHeader,
} from "@/components/admin-management-ui";
import { StatusBadge } from "@/components/dashboard-ui";
import { apiUrl } from "@/lib/api";

type Category = {
  id: number;
  name: string;
};

type Item = {
  id: number;
  categoryId: number;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  weight: number | string | null;
  reorderLevel: number;
  isActive: boolean;
  category: Category;
  _count: {
    warehouseStock: number;
    shipmentItems: number;
    stockTransferItems: number;
  };
};

type ItemForm = {
  categoryId: string;
  sku: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  weight: string;
  reorderLevel: string;
  isActive: boolean;
};

const emptyForm: ItemForm = {
  categoryId: "",
  sku: "",
  name: "",
  description: "",
  unitOfMeasure: "",
  weight: "",
  reorderLevel: "0",
  isActive: true,
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

export default function AdminItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
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
        const [itemsResponse, categoriesResponse] = await Promise.all([
          fetch(apiUrl("/admin/items"), { headers }),
          fetch(apiUrl("/admin/categories"), { headers }),
        ]);
        const [itemData, categoryData] = await Promise.all([
          readResponse<Item[]>(itemsResponse),
          readResponse<Category[]>(categoriesResponse),
        ]);
        if (!cancelled) {
          setItems(itemData);
          setCategories(categoryData);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load items.",
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

  function beginEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      categoryId: String(item.categoryId),
      sku: item.sku,
      name: item.name,
      description: item.description ?? "",
      unitOfMeasure: item.unitOfMeasure,
      weight: item.weight === null ? "" : String(item.weight),
      reorderLevel: String(item.reorderLevel),
      isActive: item.isActive,
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

    const reorderLevel = Number(form.reorderLevel);
    const weight = form.weight.trim() === "" ? null : Number(form.weight);
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
      setError("Reorder level must be a non-negative whole number.");
      return;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
      setError("Weight must be a non-negative number.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        apiUrl(
          editingId === null
            ? "/admin/items"
            : `/admin/items/${editingId}`,
        ),
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            categoryId: Number(form.categoryId),
            sku: form.sku.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            unitOfMeasure: form.unitOfMeasure.trim(),
            weight,
            reorderLevel,
            isActive: form.isActive,
          }),
        },
      );
      const savedItem = await readResponse<Item>(response);
      setSuccess(editingId === null ? "Item added." : "Item updated.");
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      try {
        const updatedResponse = await fetch(apiUrl("/admin/items"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(await readResponse<Item[]>(updatedResponse));
      } catch (refreshError) {
        setItems((current) =>
          current.some((item) => item.id === savedItem.id)
            ? current.map((item) =>
                item.id === savedItem.id ? savedItem : item,
              )
            : [...current, savedItem].sort((left, right) =>
                left.sku.localeCompare(right.sku),
              ),
        );
        setError(
          `Item was saved, but the list could not be refreshed: ${
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
          : "Unable to save item.",
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
        <div className="dashboard-loading">Loading items...</div>
      </main>
    );
  }

  return (
    <main className="warehouse-dashboard">
      <AdminManagementHeader
        eyebrow="SYSTEM ADMINISTRATION"
        title="Items"
        description="Maintain the item catalog and update descriptive information without changing stock."
        action={
          <button
            type="button"
            className="primary-action"
            onClick={beginCreate}
            disabled={categories.length === 0}
          >
            Add item
          </button>
        }
      />

      <AdminManagementFeedback error={error} success={success} />

      {categories.length === 0 && (
        <p className="management-note">
          An item cannot be created until at least one category exists.
        </p>
      )}

      {formOpen && (
        <form className="management-form" onSubmit={handleSubmit}>
          <div className="management-form-heading">
            <div>
              <p className="section-eyebrow">
                {editingId === null ? "NEW CATALOG RECORD" : "EDIT CATALOG RECORD"}
              </p>
              <h3>{editingId === null ? "Add item" : `Edit ${form.sku}`}</h3>
            </div>
            <span className="management-note">Item ID is not editable</span>
          </div>
          <div className="management-form-grid">
            <label className="input-group">
              <span>Category *</span>
              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm({ ...form, categoryId: event.target.value })
                }
                required
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>SKU *</span>
              <input
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                maxLength={100}
                required
              />
            </label>
            <label className="input-group">
              <span>Item name *</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="input-group">
              <span>Unit of measure *</span>
              <input
                value={form.unitOfMeasure}
                onChange={(event) =>
                  setForm({ ...form, unitOfMeasure: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <span>Weight</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.weight}
                onChange={(event) => setForm({ ...form, weight: event.target.value })}
              />
            </label>
            <label className="input-group">
              <span>Reorder level *</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.reorderLevel}
                onChange={(event) =>
                  setForm({ ...form, reorderLevel: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group management-wide">
              <span>Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <label className="management-checkbox">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
              />
              <span>Item is active</span>
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
                  ? "Add item"
                  : "Save changes"}
            </button>
          </div>
        </form>
      )}

      <section className="management-table-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">ITEM CATALOG</p>
            <h2>Existing items</h2>
          </div>
          <span className="status-badge">{items.length} records</span>
        </div>
        <div className="data-table-scroll" role="region" aria-label="Items" tabIndex={0}>
          <table className="inventory-table management-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>ITEM</th>
                <th>CATEGORY</th>
                <th>UNIT</th>
                <th>WEIGHT</th>
                <th>REORDER</th>
                <th>STATUS</th>
                <th>REFERENCES</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="inventory-empty">
                    No items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku}</td>
                    <td>
                      <strong>{item.name}</strong>
                      {item.description && <small>{item.description}</small>}
                    </td>
                    <td>{item.category.name}</td>
                    <td>{item.unitOfMeasure}</td>
                    <td>{item.weight ?? "—"}</td>
                    <td>{item.reorderLevel}</td>
                    <td>
                      <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td>
                      {item._count.warehouseStock} stock ·{" "}
                      {item._count.shipmentItems} shipment ·{" "}
                      {item._count.stockTransferItems} transfer
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => beginEdit(item)}
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
