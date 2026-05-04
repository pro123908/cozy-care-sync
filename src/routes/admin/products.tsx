import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { Btn, ProductImageFallback } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";
import { useWcm } from "@/wcm/context";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

const EMPTY_DRAFT = {
  id: "",
  name: "",
  brand: "",
  cat: "glucometers",
  price: 0,
  was: "",
  stock: "In stock",
  stock_count: 25,
  blurb: "",
  image_url: "",
  sort_order: 0,
  active: true,
  tags: "",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as
  | string
  | undefined;
const WHATSAPP_IMPORT_TAG = "import:whatsapp";

function isWhatsAppImportedProduct(product: ProductRow) {
  return Array.isArray(product.tags) && product.tags.includes(WHATSAPP_IMPORT_TAG);
}

function getCategoryPrefix(categorySlug: string) {
  const parts = categorySlug
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (parts.length === 0) return "prd";
  if (parts.length === 1) return parts[0].slice(0, 3);
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 4);
}

function getCategoryProductSequence(id: string, prefix: string) {
  const match = new RegExp(`^${prefix}-(\\d+)$`, "i").exec(id.trim());
  return match ? Number(match[1]) : null;
}

function deriveStockStatusFromCount(stockCount: number) {
  if (stockCount <= 0) return "Out of stock";
  if (stockCount <= 5) return "Low stock";
  if (stockCount <= 20) return "Limited";
  return "In stock";
}

function getFallbackCountFromStock(stock: string) {
  if (stock === "Out of stock") return 0;
  if (stock === "Low stock") return 3;
  if (stock === "Limited") return 12;
  return 25;
}

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({
    meta: [{ title: "Admin Products — Wellcare Mart" }],
  }),
});

function AdminProductsPage() {
  const { push } = useWcm();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "limited" | "low" | "out">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "whatsapp" | "manual">("all");
  const [bulkStockCount, setBulkStockCount] = useState(25);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCategoryId, setUploadingCategoryId] = useState<string | null>(null);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [categoryImageDrafts, setCategoryImageDrafts] = useState<Record<string, string>>({});
  const [categoryNameDrafts, setCategoryNameDrafts] = useState<Record<string, string>>({});
  const [savingCategoryNameId, setSavingCategoryNameId] = useState<string | null>(null);
  const [showCategoryImages, setShowCategoryImages] = useState(false);
  const [productIdManuallyEdited, setProductIdManuallyEdited] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    body: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadProducts = async () => {
    const supabase = await getSupabase();
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

  const loadCategories = async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, sort_order, image_url, created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      push("Failed to load categories");
      return;
    }

    setCategories(data || []);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    setCategoryNameDrafts(Object.fromEntries(categories.map((c) => [c.id, c.name])));
    setCategoryImageDrafts(
      Object.fromEntries(categories.map((category) => [category.id, category.image_url || ""])),
    );
  }, [categories]);

  const categoryBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const categoryOptions = useMemo(() => {
    const options = categories.map((c) => ({ id: c.slug, label: c.name }));
    if (draft.cat && !options.some((c) => c.id === draft.cat)) {
      options.unshift({ id: draft.cat, label: draft.cat });
    }
    return options;
  }, [categories, draft.cat]);

  const listCategoryFilterOptions = useMemo(() => {
    const options = categories.map((c) => ({ value: c.slug, label: c.name }));
    for (const row of rows) {
      if (row.cat && !options.some((option) => option.value === row.cat)) {
        options.push({ value: row.cat, label: row.cat });
      }
    }
    return [{ value: "all", label: "All categories" }, ...options];
  }, [categories, rows]);

  const activeCategory = categoryBySlug.get(draft.cat);
  const activeCategoryPrefix = getCategoryPrefix(draft.cat || EMPTY_DRAFT.cat);
  const whatsappImportedCount = useMemo(
    () => rows.filter((row) => isWhatsAppImportedProduct(row)).length,
    [rows],
  );

  const nextGeneratedProductId = useMemo(() => {
    const categorySlug = draft.cat || EMPTY_DRAFT.cat;
    const prefix = getCategoryPrefix(categorySlug);
    const rowsInCategory = rows.filter((row) => row.cat === categorySlug);
    const highestSequence = rowsInCategory.reduce((max, row) => {
      const sequence = getCategoryProductSequence(row.id, prefix);
      return sequence == null ? max : Math.max(max, sequence);
    }, 0);
    const nextSequence = Math.max(rowsInCategory.length, highestSequence) + 1;
    return `${prefix}-${String(nextSequence).padStart(3, "0")}`;
  }, [draft.cat, rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.cat.toLowerCase().includes(q) ||
        (categoryBySlug.get(r.cat)?.name.toLowerCase().includes(q) ?? false);
      const matchesCategory = categoryFilter === "all" || r.cat === categoryFilter;
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "whatsapp"
          ? isWhatsAppImportedProduct(r)
          : !isWhatsAppImportedProduct(r));
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? r.active : !r.active);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && r.stock_count > 20) ||
        (stockFilter === "limited" && r.stock_count >= 6 && r.stock_count <= 20) ||
        (stockFilter === "low" && r.stock_count >= 1 && r.stock_count <= 5) ||
        (stockFilter === "out" && r.stock_count <= 0);
      return matchesQuery && matchesCategory && matchesSource && matchesStatus && matchesStock;
    });
  }, [rows, search, categoryFilter, sourceFilter, statusFilter, stockFilter, categoryBySlug]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, sourceFilter, statusFilter, stockFilter, pageSize]);

  const stockBuckets = useMemo(
    () => ({
      inStock: rows.filter((r) => r.stock_count > 20).length,
      limited: rows.filter((r) => r.stock_count >= 6 && r.stock_count <= 20).length,
      low: rows.filter((r) => r.stock_count >= 1 && r.stock_count <= 5).length,
      out: rows.filter((r) => r.stock_count <= 0).length,
    }),
    [rows],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((r) => r.id === id)));
  }, [filtered]);

  useEffect(() => {
    if (selectedId || productIdManuallyEdited || viewMode !== "editor") return;
    setDraft((prev) =>
      prev.id === nextGeneratedProductId ? prev : { ...prev, id: nextGeneratedProductId },
    );
  }, [nextGeneratedProductId, productIdManuallyEdited, selectedId, viewMode]);

  const loadDraftFromProduct = (p: ProductRow) => {
    const categoryFromId = p.category_id ? categoryById.get(p.category_id) : null;
    const resolvedCatSlug = categoryFromId?.slug || p.cat || EMPTY_DRAFT.cat;

    setDraft({
      id: p.id,
      name: p.name,
      brand: p.brand,
      cat: resolvedCatSlug,
      price: p.price,
      was: p.was === null ? "" : String(p.was),
      stock: p.stock,
      stock_count: p.stock_count ?? getFallbackCountFromStock(p.stock),
      blurb: p.blurb,
      image_url: p.image_url || "",
      sort_order: p.sort_order,
      active: p.active,
      tags: (p.tags || []).join(", "),
    });
    setProductIdManuallyEdited(true);
    setSelectedId(p.id);
    setViewMode("editor");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetForm = () => {
    setDraft({ ...EMPTY_DRAFT, id: nextGeneratedProductId });
    setProductIdManuallyEdited(false);
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

    const selectedCategory = categoryBySlug.get(draft.cat.trim());

    const payload = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      cat: draft.cat.trim(),
      category_id: selectedCategory?.id ?? null,
      price: Number(draft.price) || 0,
      was: draft.was === "" ? null : Math.max(Number(draft.was), 0),
      stock: deriveStockStatusFromCount(Math.max(0, Number(draft.stock_count) || 0)),
      stock_count: Math.max(0, Number(draft.stock_count) || 0),
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

    const supabase = await getSupabase();
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
    const supabase = await getSupabase();
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
    const supabase = await getSupabase();
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

  const setSelectedStockCount = async (ids: string[], stockCount: number) => {
    const normalized = Math.max(0, Math.round(stockCount));
    const stock = deriveStockStatusFromCount(normalized);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("products")
      .update({ stock_count: normalized, stock, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      push("Failed to update stock count for selected products");
      return;
    }

    push(`Stock count updated to ${normalized} for ${ids.length} product(s)`);
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

  const uploadCategoryImageToCloudinary = async (categoryId: string, file: File) => {
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

    setUploadingCategoryId(categoryId);
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

      setCategoryImageDrafts((prev) => ({ ...prev, [categoryId]: payload.secure_url as string }));
      push("Category image uploaded");
    } catch {
      push("Could not upload category image right now. Please try again.");
    } finally {
      setUploadingCategoryId(null);
    }
  };

  const saveCategoryName = async (categoryId: string) => {
    const name = categoryNameDrafts[categoryId]?.trim();
    if (!name) {
      push("Category name cannot be empty", { tone: "red" });
      return;
    }
    setSavingCategoryNameId(categoryId);
    const supabase = await getSupabase();
    const { error } = await supabase.from("categories").update({ name }).eq("id", categoryId);
    setSavingCategoryNameId(null);
    if (error) {
      push(error.message || "Failed to save category name", { tone: "red" });
      return;
    }
    push("Category name saved");
    await loadCategories();
  };

  const saveCategoryImage = async (categoryId: string) => {
    setSavingCategoryId(categoryId);
    const supabase = await getSupabase();
    const nextUrl = categoryImageDrafts[categoryId]?.trim() || null;
    const category = categories.find((c) => c.id === categoryId);
    const { data, error } = await supabase
      .from("categories")
      .update({ image_url: nextUrl })
      .eq("id", categoryId)
      .select("id");

    const matchedById = Array.isArray(data) && data.length > 0;

    // Some category datasets may use slug-based references in admin forms.
    // Try one fallback update by slug when id update affects no rows.
    if (!error && !matchedById && category?.slug) {
      const { data: slugData, error: slugError } = await supabase
        .from("categories")
        .update({ image_url: nextUrl })
        .eq("slug", category.slug)
        .select("id");

      setSavingCategoryId(null);
      if (slugError) {
        push(slugError.message || "Failed to save category image", { tone: "red" });
        return;
      }
      if (!Array.isArray(slugData) || slugData.length === 0) {
        push("Category image was not saved (no row matched update).", { tone: "red" });
        return;
      }

      push("Category image saved");
      await loadCategories();
      return;
    }

    setSavingCategoryId(null);
    if (error) {
      push(error.message || "Failed to save category image", { tone: "red" });
      return;
    }

    if (!matchedById) {
      push("Category image was not saved (no row matched update).", { tone: "red" });
      return;
    }

    push("Category image saved");
    await loadCategories();
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
                    placeholder="Search by id, name, brand, category"
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>Category</span>
                  <CustomSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={listCategoryFilterOptions}
                    style={filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>Source</span>
                  <CustomSelect
                    value={sourceFilter}
                    onChange={(value) => setSourceFilter(value as "all" | "whatsapp" | "manual")}
                    options={[
                      { value: "all", label: "All sources" },
                      { value: "whatsapp", label: `WhatsApp (${whatsappImportedCount})` },
                      {
                        value: "manual",
                        label: `Manual (${rows.length - whatsappImportedCount})`,
                      },
                    ]}
                    style={filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>Stock</span>
                  <CustomSelect
                    value={stockFilter}
                    onChange={(value) =>
                      setStockFilter(value as "all" | "in-stock" | "limited" | "low" | "out")
                    }
                    options={[
                      { value: "all", label: "All stock" },
                      { value: "in-stock", label: `In stock (${stockBuckets.inStock})` },
                      { value: "limited", label: `Limited (${stockBuckets.limited})` },
                      { value: "low", label: `Low stock (${stockBuckets.low})` },
                      { value: "out", label: `Out of stock (${stockBuckets.out})` },
                    ]}
                    style={filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12 }}>Rows</span>
                  <CustomSelect
                    value={String(pageSize)}
                    onChange={(v) => setPageSize(Number(v))}
                    options={PAGE_SIZE_OPTIONS.map((option) => ({
                      value: String(option),
                      label: String(option),
                    }))}
                    style={compactSelectTriggerStyle}
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min={0}
                    value={bulkStockCount}
                    onChange={(e) => setBulkStockCount(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      ...inputStyle,
                      width: 94,
                      height: 33,
                      fontSize: 12,
                      padding: "0 10px",
                    }}
                    aria-label="Bulk stock count"
                  />
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Update stock count",
                        body: `Set stock count to ${Math.max(0, Math.round(bulkStockCount))} for ${selectedIds.length} selected product(s)?`,
                        onConfirm: async () =>
                          setSelectedStockCount(
                            selectedIds,
                            Math.max(0, Math.round(bulkStockCount)),
                          ),
                      })
                    }
                    disabled={selectedIds.length === 0}
                    style={{ ...miniBtnStyle, opacity: selectedIds.length ? 1 : 0.6 }}
                  >
                    Set stock for selected
                  </button>
                </div>
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

              <div
                style={{
                  marginTop: 14,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                    Category images
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {!cloudinaryReady && (
                      <span style={{ fontSize: 12, color: "var(--pill-rose-fg)" }}>
                        Cloudinary env vars missing
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCategoryImages((prev) => !prev)}
                      style={miniBtnStyle}
                    >
                      {showCategoryImages ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {showCategoryImages && (
                  <div style={{ display: "grid", gap: 10 }}>
                    {categories.map((category) => {
                      const draftImage = categoryImageDrafts[category.id] || "";
                      const isSavingCategory = savingCategoryId === category.id;
                      const isUploadingCategory = uploadingCategoryId === category.id;

                      const draftName = categoryNameDrafts[category.id] ?? category.name;
                      const isSavingCategoryName = savingCategoryNameId === category.id;

                      return (
                        <div
                          key={category.id}
                          style={{
                            border: "1px solid var(--line)",
                            borderRadius: 10,
                            padding: 10,
                            display: "grid",
                            gridTemplateColumns: "64px 1fr auto",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 10,
                              overflow: "hidden",
                              border: "1px solid var(--line)",
                              background: "var(--bg-elev)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {draftImage ? (
                              <img
                                src={draftImage}
                                alt={category.name}
                                loading="lazy"
                                decoding="async"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: 18, color: "var(--ink-4)" }}>🏷️</span>
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                alignItems: "center",
                                marginBottom: 4,
                              }}
                            >
                              <input
                                value={draftName}
                                onChange={(e) =>
                                  setCategoryNameDrafts((prev) => ({
                                    ...prev,
                                    [category.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveCategoryName(category.id);
                                }}
                                disabled={
                                  isSavingCategoryName || isSavingCategory || isUploadingCategory
                                }
                                style={{
                                  ...inputStyle,
                                  height: 30,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  flex: 1,
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => saveCategoryName(category.id)}
                                disabled={
                                  isSavingCategoryName ||
                                  isSavingCategory ||
                                  isUploadingCategory ||
                                  draftName === category.name
                                }
                                style={{
                                  ...miniBtnStyle,
                                  opacity:
                                    isSavingCategoryName || draftName === category.name ? 0.5 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isSavingCategoryName ? "Saving…" : "Rename"}
                              </button>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-4)",
                                marginBottom: 6,
                                fontFamily: "JetBrains Mono, monospace",
                              }}
                            >
                              {category.slug}
                            </div>
                            <input
                              value={draftImage}
                              placeholder="https://..."
                              onChange={(e) =>
                                setCategoryImageDrafts((prev) => ({
                                  ...prev,
                                  [category.id]: e.target.value,
                                }))
                              }
                              style={{ ...inputStyle, height: 34, fontSize: 12 }}
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label
                              style={{
                                ...miniBtnStyle,
                                textAlign: "center",
                                opacity:
                                  cloudinaryReady && !isUploadingCategory && !isSavingCategory
                                    ? 1
                                    : 0.6,
                                cursor:
                                  cloudinaryReady && !isUploadingCategory && !isSavingCategory
                                    ? "pointer"
                                    : "not-allowed",
                              }}
                            >
                              {isUploadingCategory ? "Uploading..." : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={
                                  !cloudinaryReady || isUploadingCategory || isSavingCategory
                                }
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadCategoryImageToCloudinary(category.id, file);
                                  e.currentTarget.value = "";
                                }}
                                style={{ display: "none" }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => saveCategoryImage(category.id)}
                              disabled={isSavingCategory || isUploadingCategory}
                              style={{
                                ...miniBtnStyle,
                                opacity: isSavingCategory || isUploadingCategory ? 0.6 : 1,
                              }}
                            >
                              {isSavingCategory ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setCategoryImageDrafts((prev) => ({ ...prev, [category.id]: "" }))
                              }
                              disabled={isSavingCategory || isUploadingCategory}
                              style={{
                                ...miniDangerBtnStyle,
                                opacity: isSavingCategory || isUploadingCategory ? 0.6 : 1,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {loading ? (
                <div
                  style={{
                    color: "var(--ink-4)",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "6px 0",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 3a9 9 0 0 1 9 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 12"
                        to="360 12 12"
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </svg>
                  Loading products...
                </div>
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
                        <th style={thStyle}>Category</th>
                        <th style={thStyle}>Source</th>
                        <th style={thStyle}>Price</th>
                        <th style={thStyle}>Stock</th>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  flexShrink: 0,
                                  background: "var(--bg-elev)",
                                  border: "1px solid var(--line)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {p.image_url ? (
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                ) : (
                                  <ProductImageFallback
                                    cat={p.cat}
                                    name={p.name}
                                    brand={p.brand}
                                    compact
                                  />
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700 }}>{p.name}</div>
                                <div style={{ color: "var(--ink-4)", fontSize: 12 }}>
                                  {p.brand || "-"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={tdStyle}>{categoryBySlug.get(p.cat)?.name || p.cat}</td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: isWhatsAppImportedProduct(p)
                                  ? "var(--pill-info-bg)"
                                  : "var(--bg-elev)",
                                color: isWhatsAppImportedProduct(p)
                                  ? "var(--blue-700)"
                                  : "var(--ink-3)",
                                border: "1px solid var(--line)",
                              }}
                            >
                              {isWhatsAppImportedProduct(p) ? "WhatsApp" : "Manual"}
                            </span>
                          </td>
                          <td style={tdStyle}>Rs {p.price.toLocaleString()}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  width: "fit-content",
                                  background:
                                    p.stock === "In stock"
                                      ? "var(--pill-success-bg)"
                                      : p.stock === "Out of stock"
                                        ? "var(--pill-rose-bg)"
                                        : p.stock === "Low stock"
                                          ? "var(--pill-warn-bg)"
                                          : "var(--pill-info-bg)",
                                  color:
                                    p.stock === "In stock"
                                      ? "var(--pill-success-fg)"
                                      : p.stock === "Out of stock"
                                        ? "var(--pill-rose-fg)"
                                        : p.stock === "Low stock"
                                          ? "var(--pill-warn-fg)"
                                          : "var(--pill-info-fg)",
                                }}
                              >
                                {p.stock}
                              </span>
                              <span style={{ color: "var(--ink-4)", fontSize: 12 }}>
                                {p.stock_count} units
                              </span>
                            </div>
                          </td>
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
                  <>
                    <input
                      value={draft.id}
                      onChange={(e) => {
                        setProductIdManuallyEdited(true);
                        setDraft((d) => ({ ...d, id: e.target.value }));
                      }}
                      placeholder="Auto-generated from selected category"
                      style={inputStyle}
                    />
                    <span style={fieldHintStyle}>
                      {selectedId
                        ? `Existing product ID. Category prefix for ${activeCategory?.name || draft.cat} is ${activeCategoryPrefix}.`
                        : productIdManuallyEdited
                          ? `Manual override active. Suggested next ID for ${activeCategory?.name || draft.cat}: ${nextGeneratedProductId}.`
                          : `Next ID for ${activeCategory?.name || draft.cat}: ${nextGeneratedProductId} (${activeCategoryPrefix} prefix).`}
                    </span>
                  </>
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
                    <CustomSelect
                      value={draft.cat}
                      onChange={(value) =>
                        setDraft((d) => ({
                          ...d,
                          cat: value,
                          id: selectedId || productIdManuallyEdited ? d.id : nextGeneratedProductId,
                        }))
                      }
                      options={categoryOptions.map((cat) => ({ value: cat.id, label: cat.label }))}
                      placeholder="Select a category"
                      style={selectTriggerStyle}
                    />
                  </Field>
                  <Field label="Stock status (auto)">
                    <input
                      value={deriveStockStatusFromCount(
                        Math.max(0, Number(draft.stock_count) || 0),
                      )}
                      readOnly
                      style={{ ...inputStyle, background: "var(--bg-elev)", color: "var(--ink-3)" }}
                    />
                  </Field>
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
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
                  <Field label="Stock count">
                    <input
                      type="number"
                      min={0}
                      value={draft.stock_count}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          stock_count: Math.max(0, Number(e.target.value)),
                        }))
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
                        loading="lazy"
                        decoding="async"
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

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const active = options.find((opt) => opt.value === value);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active?.label || placeholder || "Select"}
        </span>
        <span
          style={{
            display: "inline-flex",
            transition: "transform .16s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {Icons.chevD}
        </span>
      </button>

      {open && (
        <div role="listbox" style={selectMenuStyle}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{ ...selectOptionStyle, ...(isActive ? activeSelectOptionStyle : {}) }}
              >
                <span>{opt.label}</span>
                {isActive && <span>{Icons.check}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
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

const baseSelectTriggerStyle: CSSProperties = {
  ...inputStyle,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  textAlign: "left",
  lineHeight: 1.2,
};

const selectTriggerStyle: CSSProperties = {
  ...baseSelectTriggerStyle,
  minHeight: 38,
};

const compactSelectTriggerStyle: CSSProperties = {
  ...baseSelectTriggerStyle,
  width: 80,
  padding: "6px 8px",
  fontSize: 12,
  minHeight: 32,
};

const filterSelectTriggerStyle: CSSProperties = {
  ...baseSelectTriggerStyle,
  width: 190,
  padding: "6px 10px",
  fontSize: 12,
  minHeight: 32,
};

const fieldHintStyle: CSSProperties = {
  fontSize: 11.5,
  color: "var(--ink-4)",
  lineHeight: 1.45,
};

const selectMenuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  maxHeight: 280,
  overflowY: "auto",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  boxShadow: "var(--shadow-lg)",
  zIndex: 80,
  padding: 6,
};

const selectOptionStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--ink)",
  textAlign: "left",
  fontSize: 13,
  fontFamily: "inherit",
  padding: "8px 10px",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  cursor: "pointer",
};

const activeSelectOptionStyle: CSSProperties = {
  background: "var(--pill-info-bg)",
  color: "var(--blue-700)",
  fontWeight: 700,
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
