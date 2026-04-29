import { useEffect, useMemo, useRef, useState } from "react";
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

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const CATEGORY_OPTIONS = [
  "monitoring",
  "mobility",
  "respiratory",
  "patient-care",
  "therapy",
  "consumables",
];
const STOCK_OPTIONS = ["In stock", "Low stock", "Limited", "Out of stock"];
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as
  | string
  | undefined;

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    body: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

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
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.cat.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? r.active : !r.active);
      return matchesQuery && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((r) => r.id === id)));
  }, [filtered]);

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
    setViewMode("editor");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (Number(draft.price) < 0) {
      push("Price cannot be negative");
      return;
    }

    setSaving(true);

    const payload = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      cat: draft.cat.trim(),
      price: Number(draft.price) || 0,
      was: draft.was === "" ? null : Math.max(Number(draft.was), 0),
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
    setViewMode("list");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const setProductActive = async (ids: string[], active: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ active, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      push(`Failed to ${active ? "activate" : "archive"} selected products`);
      return;
    }

    push(active ? "Products activated" : "Products archived");
    setSelectedIds([]);
    await loadProducts();
    if (selectedId && ids.includes(selectedId)) resetForm();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedCountOnPage = pageRows.filter((r) => selectedIds.includes(r.id)).length;
  const allOnPageSelected = pageRows.length > 0 && selectedCountOnPage === pageRows.length;

  const togglePageSelection = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageRows.some((r) => r.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageRows.map((r) => r.id)])));
  };

  const cloudinaryReady = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

  const uploadImageToCloudinary = async (file: File) => {
    if (!cloudinaryReady) {
      push(
        "Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.",
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      push("Please select a valid image file.");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET!);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload?.secure_url) {
        const reason = payload?.error?.message || "Upload failed";
        push(reason);
        return;
      }

      setDraft((d) => ({ ...d, image_url: payload.secure_url as string }));
      push("Image uploaded to Cloudinary");
    } catch {
      push("Could not upload image right now. Please try again.");
    } finally {
      setUploadingImage(false);
    }
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

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => setViewMode("list")}
            style={viewMode === "list" ? activeTabBtnStyle : tabBtnStyle}
          >
            Product list
          </button>
          <button
            onClick={() => setViewMode("editor")}
            style={viewMode === "editor" ? activeTabBtnStyle : tabBtnStyle}
          >
            {selectedId ? "Edit product" : "Create product"}
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          {viewMode === "list" && (
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
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      resetForm();
                      setViewMode("editor");
                      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={miniBtnStyle}
                  >
                    + New product
                  </button>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by id, name, brand"
                    style={searchInputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  label={`All (${rows.length})`}
                />
                <FilterChip
                  active={statusFilter === "active"}
                  onClick={() => setStatusFilter("active")}
                  label={`Active (${rows.filter((r) => r.active).length})`}
                />
                <FilterChip
                  active={statusFilter === "archived"}
                  onClick={() => setStatusFilter("archived")}
                  label={`Archived (${rows.filter((r) => !r.active).length})`}
                />
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{ ...inputStyle, width: 80, padding: "6px 8px", fontSize: 12 }}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() =>
                    setConfirmAction({
                      title: "Archive selected products",
                      body: `This will hide ${selectedIds.length} product(s) from the storefront.`,
                      onConfirm: async () => setProductActive(selectedIds, false),
                    })
                  }
                  disabled={selectedIds.length === 0}
                  style={{ ...miniDangerBtnStyle, opacity: selectedIds.length ? 1 : 0.6 }}
                >
                  Archive selected ({selectedIds.length})
                </button>
                <button
                  onClick={() =>
                    setConfirmAction({
                      title: "Activate selected products",
                      body: `This will make ${selectedIds.length} product(s) visible in the storefront.`,
                      onConfirm: async () => setProductActive(selectedIds, true),
                    })
                  }
                  disabled={selectedIds.length === 0}
                  style={{ ...miniBtnStyle, opacity: selectedIds.length ? 1 : 0.6 }}
                >
                  Activate selected
                </button>
                {selectedIds.length > 0 && (
                  <button onClick={() => setSelectedIds([])} style={miniBtnStyle}>
                    Clear selection
                  </button>
                )}
                <span style={{ marginLeft: "auto", color: "var(--ink-4)", fontSize: 12 }}>
                  Showing {filtered.length === 0 ? 0 : pageStart + 1}-
                  {Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
                </span>
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
                        <th style={thStyle}>
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            onChange={togglePageSelection}
                          />
                        </th>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Price</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((p) => (
                        <tr
                          key={p.id}
                          style={{
                            borderTop: "1px solid var(--line)",
                            background: selectedId === p.id ? "var(--bg-elev)" : "transparent",
                          }}
                        >
                          <td style={tdStyle}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => toggleSelect(p.id)}
                            />
                          </td>
                          <td style={tdStyle}>{p.id}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                            <div style={{ color: "var(--ink-4)", fontSize: 12 }}>
                              {p.brand || "-"}
                            </div>
                          </td>
                          <td style={tdStyle}>Rs {p.price.toLocaleString()}</td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: p.active
                                  ? "var(--pill-success-bg)"
                                  : "var(--pill-rose-bg)",
                                color: p.active ? "var(--pill-success-fg)" : "var(--pill-rose-fg)",
                              }}
                            >
                              {p.active ? "Active" : "Archived"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => loadDraftFromProduct(p)} style={miniBtnStyle}>
                                Edit
                              </button>
                              {p.active ? (
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      title: "Archive product",
                                      body: `Archive ${p.name}? It will be hidden from storefront users.`,
                                      onConfirm: async () => archiveProduct(p.id),
                                    })
                                  }
                                  style={miniDangerBtnStyle}
                                >
                                  Archive
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      title: "Activate product",
                                      body: `Activate ${p.name}? It will be visible in storefront.`,
                                      onConfirm: async () => setProductActive([p.id], true),
                                    })
                                  }
                                  style={miniBtnStyle}
                                >
                                  Activate
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

              {!loading && filtered.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ ...miniBtnStyle, opacity: page === 1 ? 0.5 : 1 }}
                  >
                    Previous
                  </button>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ ...miniBtnStyle, opacity: page === totalPages ? 0.5 : 1 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          )}

          {viewMode === "editor" && (
            <section ref={formRef} style={cardStyle}>
              <h2 style={sectionTitleStyle}>{selectedId ? "Edit product" : "Create product"}</h2>
              <p style={{ margin: "6px 0 0", color: "var(--ink-4)", fontSize: 12 }}>
                {selectedId
                  ? `Editing ${selectedId}`
                  : "Fill details and save to publish in catalog"}
              </p>
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
                    <select
                      value={draft.cat}
                      onChange={(e) => setDraft((d) => ({ ...d, cat: e.target.value }))}
                      style={inputStyle}
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Stock">
                    <select
                      value={draft.stock}
                      onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                      style={inputStyle}
                    >
                      {STOCK_OPTIONS.map((stock) => (
                        <option key={stock} value={stock}>
                          {stock}
                        </option>
                      ))}
                    </select>
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
                <Field label="Product image">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label
                      style={{
                        ...miniBtnStyle,
                        opacity: cloudinaryReady && !uploadingImage ? 1 : 0.6,
                        cursor: cloudinaryReady && !uploadingImage ? "pointer" : "not-allowed",
                      }}
                    >
                      {uploadingImage ? "Uploading..." : "Upload to Cloudinary"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={!cloudinaryReady || uploadingImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImageToCloudinary(file);
                          e.currentTarget.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                    {!cloudinaryReady && (
                      <span style={{ fontSize: 12, color: "var(--pill-rose-fg)" }}>
                        Missing Cloudinary env vars
                      </span>
                    )}
                    {draft.image_url.trim() && (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, image_url: "" }))}
                        style={miniDangerBtnStyle}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {draft.image_url.trim() && (
                    <div
                      style={{
                        marginTop: 8,
                        width: 220,
                        maxWidth: "100%",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "var(--bg-elev)",
                      }}
                    >
                      <img
                        src={draft.image_url}
                        alt="Product preview"
                        style={{
                          width: "100%",
                          height: 140,
                          display: "block",
                          objectFit: "contain",
                          background: "var(--bg-elev)",
                        }}
                      />
                    </div>
                  )}
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
                <Btn
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setViewMode("list");
                  }}
                >
                  Back to list
                </Btn>
              </div>
            </section>
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          body={confirmAction.body}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction.onConfirm();
            setConfirmAction(null);
          }}
        />
      )}
    </AdminGate>
  );
}

function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>{title}</h3>
        <p style={{ marginTop: 8, marginBottom: 16, color: "var(--ink-4)", fontSize: 14 }}>
          {body}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={miniBtnStyle}>
            Cancel
          </button>
          <button onClick={onConfirm} style={miniDangerBtnStyle}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--blue-500)" : "var(--line)"}`,
        background: active ? "var(--pill-info-bg)" : "var(--card)",
        color: active ? "var(--blue-700)" : "var(--ink-3)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
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

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(10,15,28,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 120,
};

const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
};

const tabBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink-3)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const activeTabBtnStyle: CSSProperties = {
  ...tabBtnStyle,
  border: "1px solid var(--blue-500)",
  background: "var(--pill-info-bg)",
  color: "var(--blue-700)",
};
