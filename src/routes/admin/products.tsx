import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";
import { useWcm } from "@/wcm/context";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

const EMPTY_DRAFT = {
  id: "",
  name: "",
  brand: "",
  cat: "monitoring",
  price: 0,
  was: "",
  stock: "In stock",
  blurb: "",
  image_url: "",
  sort_order: 0,
  active: true,
  tags: "",
};

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({
    meta: [{ title: "Admin Products — Wellcare Mart" }],
  }),
});

function AdminProductsPage() {
  const { push } = useWcm();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      push("Failed to load products");
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.cat.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const loadDraftFromProduct = (p: ProductRow) => {
    setDraft({
      id: p.id,
      name: p.name,
      brand: p.brand,
      cat: p.cat,
      price: p.price,
      was: p.was === null ? "" : String(p.was),
      stock: p.stock,
      blurb: p.blurb,
      image_url: p.image_url || "",
      sort_order: p.sort_order,
      active: p.active,
      tags: (p.tags || []).join(", "),
    });
    setSelectedId(p.id);
  };

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setSelectedId(null);
  };

  const saveProduct = async () => {
    if (!draft.id.trim() || !draft.name.trim()) {
      push("Product id and name are required");
      return;
    }

    setSaving(true);

    const payload = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      cat: draft.cat.trim(),
      price: Number(draft.price) || 0,
      was: draft.was === "" ? null : Number(draft.was),
      stock: draft.stock.trim(),
      blurb: draft.blurb.trim(),
      image_url: draft.image_url.trim() || null,
      sort_order: Number(draft.sort_order) || 0,
      active: draft.active,
      tags: draft.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(payload);

    setSaving(false);

    if (error) {
      push("Failed to save product");
      return;
    }

    push(selectedId ? "Product updated" : "Product created");
    await loadProducts();
    resetForm();
  };

  const archiveProduct = async (id: string) => {
    const { error } = await supabase
      .from("products")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      push("Failed to archive product");
      return;
    }

    push("Product archived");
    await loadProducts();
    if (selectedId === id) resetForm();
  };

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 90px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4, color: "var(--ink)" }}>
              Products
            </h1>
            <p style={{ marginTop: 6, marginBottom: 0, color: "var(--ink-4)", fontSize: 14 }}>
              Create, edit, and archive products in your catalog.
            </p>
          </div>
          <Link to="/admin/" style={linkBtnStyle}>
            Dashboard
          </Link>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 14, gridTemplateColumns: "1.2fr 1fr" }}>
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <h2 style={sectionTitleStyle}>All products</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by id, name, brand"
                style={searchInputStyle}
              />
            </div>

            {loading ? (
              <div style={{ color: "var(--ink-4)", fontSize: 14 }}>Loading products…</div>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elev)", color: "var(--ink-3)" }}>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Price</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={tdStyle}>{p.id}</td>
                        <td style={tdStyle}>{p.name}</td>
                        <td style={tdStyle}>Rs {p.price.toLocaleString()}</td>
                        <td style={tdStyle}>{p.active ? "Active" : "Archived"}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => loadDraftFromProduct(p)} style={miniBtnStyle}>
                              Edit
                            </button>
                            {p.active && (
                              <button
                                onClick={() => archiveProduct(p.id)}
                                style={miniDangerBtnStyle}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>{selectedId ? "Edit product" : "Create product"}</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <Field label="Product ID">
                <input
                  value={draft.id}
                  onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                  placeholder="p32"
                  style={inputStyle}
                />
              </Field>
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Brand">
                <input
                  value={draft.brand}
                  onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Category">
                  <input
                    value={draft.cat}
                    onChange={(e) => setDraft((d) => ({ ...d, cat: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Stock">
                  <input
                    value={draft.stock}
                    onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <Field label="Price">
                  <input
                    type="number"
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Was">
                  <input
                    type="number"
                    value={draft.was}
                    onChange={(e) => setDraft((d) => ({ ...d, was: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Sort order">
                  <input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="Image URL">
                <input
                  value={draft.image_url}
                  onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Tags (comma separated)">
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={draft.blurb}
                  onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
                  rows={3}
                  style={inputStyle}
                />
              </Field>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink-3)",
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                />
                Active product
              </label>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <Btn onClick={saveProduct} icon={Icons.check} disabled={saving}>
                {saving ? "Saving…" : selectedId ? "Save changes" : "Create product"}
              </Btn>
              {selectedId && (
                <Btn variant="outline" onClick={resetForm}>
                  Cancel edit
                </Btn>
              )}
            </div>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "var(--ink)",
};

const searchInputStyle: CSSProperties = {
  width: 260,
  maxWidth: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  fontSize: 13,
  background: "var(--bg-elev)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  fontSize: 13,
  background: "var(--bg-elev)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  padding: "9px 12px",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  color: "var(--ink)",
  verticalAlign: "top",
};

const miniBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const miniDangerBtnStyle: CSSProperties = {
  ...miniBtnStyle,
  border: "1px solid var(--pill-rose-fg)",
  color: "var(--pill-rose-fg)",
};

const linkBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  textDecoration: "none",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
};
