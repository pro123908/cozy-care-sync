import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { WellcareLoader } from "@/wcm/loader";
import { Btn, ProductImageFallback } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";
import { useWcm } from "@/wcm/context";
import { useIsMobile } from "@/hooks/use-mobile";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type HomepageBannerRow = Database["public"]["Tables"]["homepage_banners"]["Row"];
type ProductSizeOptionDraft = { id: string; size: string; price: number };
type ProductVariantOptionDraft = { id: string; name: string; price: number };

const EMPTY_DRAFT = {
  id: "",
  name: "",
  brand: "",
  cat: "glucometers",
  price: 0,
  purchase_price: 0,
  was: "",
  stock: "In stock",
  stock_count: 25,
  blurb: "",
  image_url: "",
  sort_order: 0,
  active: true,
  tags: "",
  size_options: [] as ProductSizeOptionDraft[],
  variant_options: [] as ProductVariantOptionDraft[],
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SUPABASE_STORAGE_BUCKET = "product-images";
const WHATSAPP_IMPORT_TAG = "import:whatsapp";
const HOMEPAGE_BANNER_PATH_PREFIX = "homepage-banners";

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

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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

function normalizeSizeOptionsForDraft(
  input?: Array<{ size?: string | null; price?: number | null }> | null,
): ProductSizeOptionDraft[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const normalized: ProductSizeOptionDraft[] = [];

  for (const option of input) {
    const size = typeof option?.size === "string" ? option.size.trim() : "";
    const price = Number(option?.price);
    const key = size.toLowerCase();
    if (!size || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: `${key}-${normalized.length}`,
      size,
      price: Math.round(price),
    });
  }

  return normalized;
}

function normalizeSizeOptionsForSave(
  input: ProductSizeOptionDraft[],
): Array<{ size: string; price: number }> {
  return normalizeSizeOptionsForDraft(input).map((option) => ({
    size: option.size,
    price: option.price,
  }));
}

function normalizeVariantOptionsForDraft(
  input?: Array<{ name?: string | null; price?: number | null }> | null,
): ProductVariantOptionDraft[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const normalized: ProductVariantOptionDraft[] = [];

  for (const option of input) {
    const name = typeof option?.name === "string" ? option.name.trim() : "";
    const price = Number(option?.price);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: `${key}-${normalized.length}`,
      name,
      price: Math.round(price),
    });
  }

  return normalized;
}

function normalizeVariantOptionsForSave(
  input: ProductVariantOptionDraft[],
): Array<{ name: string; price: number }> {
  return normalizeVariantOptionsForDraft(input).map((option) => ({
    name: option.name,
    price: option.price,
  }));
}

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/admin/products") }],
    meta: [{ title: "Admin Products — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
});

function AdminProductsPage() {
  const { push } = useWcm();
  const isMobile = useIsMobile();
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
  const [uploadingHomepageBannerId, setUploadingHomepageBannerId] = useState<string | null>(null);
  const [savingHomepageBannerId, setSavingHomepageBannerId] = useState<string | null>(null);
  const [deletingHomepageBannerId, setDeletingHomepageBannerId] = useState<string | null>(null);
  const [creatingHomepageBanner, setCreatingHomepageBanner] = useState(false);
  const [categoryImageDrafts, setCategoryImageDrafts] = useState<Record<string, string>>({});
  const [categoryNameDrafts, setCategoryNameDrafts] = useState<Record<string, string>>({});
  const [categoryTopDrafts, setCategoryTopDrafts] = useState<Record<string, boolean>>({});
  const [categorySlugDrafts, setCategorySlugDrafts] = useState<Record<string, string>>({});
  const [categorySortDrafts, setCategorySortDrafts] = useState<Record<string, number>>({});
  const [savingCategoryAllId, setSavingCategoryAllId] = useState<string | null>(null);
  const [homepageBanners, setHomepageBanners] = useState<HomepageBannerRow[]>([]);
  const [homepageBannerImageDrafts, setHomepageBannerImageDrafts] = useState<
    Record<string, string>
  >({});
  const [homepageBannerAltDrafts, setHomepageBannerAltDrafts] = useState<Record<string, string>>(
    {},
  );
  const [homepageBannerSortDrafts, setHomepageBannerSortDrafts] = useState<Record<string, number>>(
    {},
  );
  const [homepageBannerActiveDrafts, setHomepageBannerActiveDrafts] = useState<
    Record<string, boolean>
  >({});
  const [savingCategoryNameId, setSavingCategoryNameId] = useState<string | null>(null);
  const [savingCategoryTopId, setSavingCategoryTopId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState(0);
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState("");
  const [newCategoryTopCategory, setNewCategoryTopCategory] = useState(false);
  const [newCategorySlugManuallyEdited, setNewCategorySlugManuallyEdited] = useState(false);
  const [showCategoryImages, setShowCategoryImages] = useState(false);
  const [openSections, setOpenSections] = useState({ products: true, categories: true, banners: true });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));
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
      .select("id, name, slug, sort_order, image_url, top_category, created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      push("Failed to load categories");
      return;
    }

    setCategories(data || []);
  };

  const loadHomepageBanners = async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("homepage_banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      // Ignore missing table errors before migration is applied.
      if (error.code !== "42P01") {
        push(error.message || "Failed to load homepage banners", { tone: "red" });
      }
      setHomepageBanners([]);
      return;
    }

    setHomepageBanners(data || []);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadHomepageBanners();
  }, []);

  useEffect(() => {
    setCategoryNameDrafts(Object.fromEntries(categories.map((c) => [c.id, c.name])));
    setCategoryImageDrafts(
      Object.fromEntries(categories.map((category) => [category.id, category.image_url || ""])),
    );
    setCategoryTopDrafts(
      Object.fromEntries(categories.map((category) => [category.id, category.top_category])),
    );
  }, [categories]);

  useEffect(() => {
    setHomepageBannerImageDrafts(
      Object.fromEntries(homepageBanners.map((banner) => [banner.id, banner.image_url || ""])),
    );
    setHomepageBannerAltDrafts(
      Object.fromEntries(homepageBanners.map((banner) => [banner.id, banner.alt_text || ""])),
    );
    setHomepageBannerSortDrafts(
      Object.fromEntries(homepageBanners.map((banner) => [banner.id, banner.sort_order || 0])),
    );
    setHomepageBannerActiveDrafts(
      Object.fromEntries(homepageBanners.map((banner) => [banner.id, banner.active])),
    );
  }, [homepageBanners]);

  const categoryBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const nextCategorySortOrder = useMemo(
    () =>
      categories.length > 0
        ? Math.max(...categories.map((category) => category.sort_order || 0)) + 1
        : 1,
    [categories],
  );

  useEffect(() => {
    if (newCategorySlugManuallyEdited) return;
    setNewCategorySlug(slugifyCategory(newCategoryName));
  }, [newCategoryName, newCategorySlugManuallyEdited]);

  useEffect(() => {
    setNewCategorySortOrder((current) => (current > 0 ? current : nextCategorySortOrder));
  }, [nextCategorySortOrder]);

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
      purchase_price: p.purchase_price ?? 0,
      was: p.was === null ? "" : String(p.was),
      stock: p.stock,
      stock_count: p.stock_count ?? getFallbackCountFromStock(p.stock),
      blurb: p.blurb,
      image_url: p.image_url || "",
      sort_order: p.sort_order,
      active: p.active,
      tags: (p.tags || []).join(", "),
      size_options: normalizeSizeOptionsForDraft(
        Array.isArray((p as ProductRow & { size_options?: unknown }).size_options)
          ? ((p as ProductRow & { size_options?: unknown }).size_options as Array<{
              size?: string | null;
              price?: number | null;
            }>)
          : [],
      ),
      variant_options: normalizeVariantOptionsForDraft(
        Array.isArray((p as ProductRow & { variant_options?: unknown }).variant_options)
          ? ((p as ProductRow & { variant_options?: unknown }).variant_options as Array<{
              name?: string | null;
              price?: number | null;
            }>)
          : [],
      ),
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
      purchase_price: Math.max(0, Number(draft.purchase_price) || 0),
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
      size_options: normalizeSizeOptionsForSave(draft.size_options),
      variant_options: normalizeVariantOptionsForSave(draft.variant_options),
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

  const uploadImageToSupabase = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      push("Please select a valid image file.");
      return;
    }
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      push(`Image must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadingImage(true);
    try {
      const supabase = await getSupabase();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `products/${draft.id || "new"}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "31536000" });
      if (uploadError) {
        push(uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
      setDraft((d) => ({ ...d, image_url: urlData.publicUrl }));
      push("Image uploaded");
    } catch {
      push("Could not upload image right now. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadCategoryImageToSupabase = async (categoryId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      push("Please select a valid image file.");
      return;
    }
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      push(`Image must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadingCategoryId(categoryId);
    try {
      const supabase = await getSupabase();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `categories/${categoryId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "31536000" });
      if (uploadError) {
        push(uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
      setCategoryImageDrafts((prev) => ({ ...prev, [categoryId]: urlData.publicUrl }));
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

  const saveCategoryTopCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    const nextTopCategory = !!categoryTopDrafts[categoryId];

    setSavingCategoryTopId(categoryId);
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("categories")
      .update({ top_category: nextTopCategory })
      .eq("id", categoryId)
      .select("id");

    const matchedById = Array.isArray(data) && data.length > 0;

    if (!error && !matchedById && category?.slug) {
      const { data: slugData, error: slugError } = await supabase
        .from("categories")
        .update({ top_category: nextTopCategory })
        .eq("slug", category.slug)
        .select("id");

      setSavingCategoryTopId(null);
      if (slugError) {
        push(slugError.message || "Failed to save top category", { tone: "red" });
        return;
      }

      if (!Array.isArray(slugData) || slugData.length === 0) {
        push("Top category was not saved (no row matched update).", { tone: "red" });
        return;
      }

      push("Top category updated");
      await loadCategories();
      return;
    }

    setSavingCategoryTopId(null);
    if (error) {
      push(error.message || "Failed to save top category", { tone: "red" });
      return;
    }

    if (!matchedById) {
      push("Top category was not saved (no row matched update).", { tone: "red" });
      return;
    }

    push("Top category updated");
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

  const saveCategoryAll = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const name = (categoryNameDrafts[categoryId] ?? category.name).trim();
    const slug = slugifyCategory(categorySlugDrafts[categoryId] ?? category.slug);
    const sort_order = categorySortDrafts[categoryId] ?? category.sort_order ?? 0;
    const top_category = categoryTopDrafts[categoryId] ?? category.top_category;
    const image_url = (categoryImageDrafts[categoryId] ?? category.image_url ?? "").trim() || null;
    if (!name) { push("Category name cannot be empty", { tone: "red" }); return; }
    if (!slug) { push("Category slug cannot be empty", { tone: "red" }); return; }
    setSavingCategoryAllId(categoryId);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("categories")
      .update({ name, slug, sort_order, top_category, image_url })
      .eq("id", categoryId);
    setSavingCategoryAllId(null);
    if (error) { push(error.message || "Failed to save category", { tone: "red" }); return; }
    push("Category saved");
    await loadCategories();
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    const slug = slugifyCategory(newCategorySlug);

    if (!name) {
      push("Category name is required", { tone: "red" });
      return;
    }

    if (!slug) {
      push("Category slug is required", { tone: "red" });
      return;
    }

    if (categories.some((category) => category.slug === slug)) {
      push("A category with this slug already exists", { tone: "red" });
      return;
    }

    const sortOrder = Math.max(0, Math.round(Number(newCategorySortOrder) || 0));
    const imageUrl = newCategoryImageUrl.trim() || null;

    let id = `cat-${slug}`;
    let attempt = 2;
    while (categories.some((category) => category.id === id)) {
      id = `cat-${slug}-${attempt}`;
      attempt += 1;
    }

    setCreatingCategory(true);
    const supabase = await getSupabase();
    const { error } = await supabase.from("categories").insert({
      id,
      name,
      slug,
      sort_order: sortOrder,
      image_url: imageUrl,
      top_category: newCategoryTopCategory,
    });
    setCreatingCategory(false);

    if (error) {
      push(error.message || "Failed to create category", { tone: "red" });
      return;
    }

    push("Category created");
    setNewCategoryName("");
    setNewCategorySlug("");
    setNewCategorySortOrder(sortOrder + 1);
    setNewCategoryImageUrl("");
    setNewCategoryTopCategory(false);
    setNewCategorySlugManuallyEdited(false);
    await loadCategories();
  };

  const createHomepageBanner = async () => {
    setCreatingHomepageBanner(true);
    const nextSortOrder =
      homepageBanners.length > 0
        ? Math.max(...homepageBanners.map((banner) => banner.sort_order || 0)) + 1
        : 1;

    const supabase = await getSupabase();
    const { error } = await supabase.from("homepage_banners").insert({
      image_url: "",
      alt_text: "Homepage banner",
      sort_order: nextSortOrder,
      active: true,
      updated_at: new Date().toISOString(),
    });

    setCreatingHomepageBanner(false);

    if (error) {
      push(error.message || "Failed to create homepage banner", { tone: "red" });
      return;
    }

    push("Homepage banner created");
    await loadHomepageBanners();
  };

  const saveHomepageBanner = async (bannerId: string) => {
    const imageUrl = (homepageBannerImageDrafts[bannerId] || "").trim();
    const altText = (homepageBannerAltDrafts[bannerId] || "Homepage banner").trim();
    const sortOrder = Math.max(0, Math.round(Number(homepageBannerSortDrafts[bannerId]) || 0));
    const active = !!homepageBannerActiveDrafts[bannerId];

    if (!imageUrl) {
      push("Banner image URL is required", { tone: "red" });
      return;
    }

    setSavingHomepageBannerId(bannerId);

    const supabase = await getSupabase();
    const { error } = await supabase
      .from("homepage_banners")
      .update({
        image_url: imageUrl,
        alt_text: altText,
        sort_order: sortOrder,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bannerId);

    setSavingHomepageBannerId(null);

    if (error) {
      push(error.message || "Failed to save homepage banner", { tone: "red" });
      return;
    }

    push("Homepage banner saved");
    await loadHomepageBanners();
  };

  const deleteHomepageBanner = async (bannerId: string) => {
    setDeletingHomepageBannerId(bannerId);

    const supabase = await getSupabase();
    const { error } = await supabase.from("homepage_banners").delete().eq("id", bannerId);

    setDeletingHomepageBannerId(null);

    if (error) {
      push(error.message || "Failed to delete homepage banner", { tone: "red" });
      return;
    }

    push("Homepage banner removed");
    await loadHomepageBanners();
  };

  const uploadHomepageBannerImageToSupabase = async (bannerId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      push("Please select a valid image file.");
      return;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      push(`Image must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploadingHomepageBannerId(bannerId);

    try {
      const supabase = await getSupabase();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${HOMEPAGE_BANNER_PATH_PREFIX}/${bannerId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "31536000" });

      if (uploadError) {
        push(uploadError.message || "Failed to upload banner image", { tone: "red" });
        return;
      }

      const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
      setHomepageBannerImageDrafts((prev) => ({
        ...prev,
        [bannerId]: urlData.publicUrl,
      }));
      push("Banner image uploaded");
    } catch {
      push("Could not upload banner image right now. Please try again.", { tone: "red" });
    } finally {
      setUploadingHomepageBannerId(null);
    }
  };

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "0" : "30px 20px 90px" }}>
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, letterSpacing: -0.4, color: "var(--ink)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── All Products ── */}
            <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #6366f1, #06b6d4)" }} />
              <div
                style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSection("products")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--ink-4)", display: "inline-block", transform: openSections.products ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", lineHeight: 1 }}>▼</span>
                  <h2 style={sectionTitleStyle}>All products</h2>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); resetForm(); setViewMode("editor"); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  style={miniBtnStyle}
                >
                  + New product
                </button>
              </div>
              {openSections.products && (<>
              <div style={{ padding: 16 }}>
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "flex-end", gap: 10, marginBottom: 8 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by id, name, brand, category"
                  style={{ ...searchInputStyle, flex: 1, width: isMobile ? "100%" : 260, boxSizing: "border-box" }}
                />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: isMobile ? 1 : undefined }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12, whiteSpace: "nowrap" }}>Category</span>
                  <CustomSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={listCategoryFilterOptions}
                    style={isMobile ? { ...filterSelectTriggerStyle, width: "auto", flex: 1 } : filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: isMobile ? 1 : undefined }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12, whiteSpace: "nowrap" }}>Source</span>
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
                    style={isMobile ? { ...filterSelectTriggerStyle, width: "auto", flex: 1 } : filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: isMobile ? 1 : undefined }}>
                  <span style={{ color: "var(--ink-4)", fontSize: 12, whiteSpace: "nowrap" }}>Stock</span>
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
                    style={isMobile ? { ...filterSelectTriggerStyle, width: "auto", flex: 1 } : filterSelectTriggerStyle}
                  />
                </div>
                <div style={{ marginLeft: isMobile ? 0 : "auto", display: "flex", alignItems: "center", gap: 8 }}>
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
              </div>{/* end filter card inner */}
              <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
              <div style={{ padding: "0 16px 16px" }}>
              {loading ? (
                <WellcareLoader label="Loading products" compact />
              ) : isMobile ? (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {pageRows.length === 0 ? (
                    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                      No products found.
                    </div>
                  ) : pageRows.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 14,
                        background: selectedId === p.id ? "var(--bg-elev)" : "var(--card)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          style={{ marginTop: 2, flexShrink: 0 }}
                        />
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 10,
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
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            <ProductImageFallback cat={p.cat} name={p.name} brand={p.brand} compact />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", flex: 1, minWidth: 0 }}>{p.name}</div>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                                background: p.active ? "var(--pill-success-bg)" : "var(--pill-rose-bg)",
                                color: p.active ? "var(--pill-success-fg)" : "var(--pill-rose-fg)",
                              }}
                            >
                              {p.active ? "Active" : "Archived"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 4 }}>
                            {p.brand || "-"} · {categoryBySlug.get(p.cat)?.name || p.cat}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                              Rs {p.price.toLocaleString()}
                            </span>
                            {p.purchase_price > 0 && (
                              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                                Cost Rs {p.purchase_price.toLocaleString()} · Profit{" "}
                                <span style={{ color: "var(--pill-success-fg)", fontWeight: 600 }}>
                                  Rs {(p.price - p.purchase_price).toLocaleString()}
                                </span>
                                {" "}({Math.round(((p.price - p.purchase_price) / p.price) * 100)}%)
                              </span>
                            )}
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  p.stock === "In stock" ? "var(--pill-success-bg)"
                                  : p.stock === "Out of stock" ? "var(--pill-rose-bg)"
                                  : p.stock === "Low stock" ? "var(--pill-warn-bg)"
                                  : "var(--pill-info-bg)",
                                color:
                                  p.stock === "In stock" ? "var(--pill-success-fg)"
                                  : p.stock === "Out of stock" ? "var(--pill-rose-fg)"
                                  : p.stock === "Low stock" ? "var(--pill-warn-fg)"
                                  : "var(--pill-info-fg)",
                              }}
                            >
                              {p.stock}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{p.stock_count} units</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button onClick={() => loadDraftFromProduct(p)} style={{ ...miniBtnStyle, flex: 1 }}>
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
                            style={{ ...miniDangerBtnStyle, flex: 1 }}
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
                            style={{ ...miniBtnStyle, flex: 1 }}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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
                  <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 1350, borderCollapse: "collapse", fontSize: 13 }}>
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
                        <th style={thStyle}>Purchase</th>
                        <th style={thStyle}>Selling</th>
                        <th style={thStyle}>Profit</th>
                        <th style={thStyle}>Margin</th>
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
                          <td style={{ ...tdStyle, maxWidth: 220 }}>
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
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                <div style={{ color: "var(--ink-4)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                          <td style={tdStyle}>
                            <span style={{ color: "var(--ink-3)" }}>
                              {p.purchase_price ? `Rs ${p.purchase_price.toLocaleString()}` : "—"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 3 }}>
                              <span>Rs {p.price.toLocaleString()}</span>
                              {Array.isArray(
                                (p as ProductRow & { size_options?: unknown }).size_options,
                              ) &&
                              (p as ProductRow & { size_options?: Array<{ size?: string }> })
                                .size_options?.length ? (
                                <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                                  Size pricing enabled
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            {p.purchase_price > 0 ? (
                              <span style={{ color: "var(--pill-success-fg)", fontWeight: 600 }}>
                                Rs {(p.price - p.purchase_price).toLocaleString()}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={tdStyle}>
                            {p.purchase_price > 0 ? (
                              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                                {Math.round(((p.price - p.purchase_price) / p.price) * 100)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  width: "fit-content",
                                  whiteSpace: "nowrap",
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
              </div>
              </>)}
            </section>


            {/* ── Category Management ── */}
            <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #10b981, #059669)" }} />
              <div
                style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSection("categories")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--ink-4)", display: "inline-block", transform: openSections.categories ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", lineHeight: 1 }}>▼</span>
                  <div>
                    <h2 style={sectionTitleStyle}>🏷️ Category Management</h2>
                    {openSections.categories && <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>Edit categories — name, slug, sort order, image and visibility</div>}
                  </div>
                </div>
              </div>
              {openSections.categories && (
              <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>

                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>
                    Add new category
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 120px",
                      gap: 8,
                    }}
                  >
                    <input
                      value={newCategoryName}
                      placeholder="Category name"
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createCategory();
                      }}
                      disabled={creatingCategory}
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <input
                      value={newCategorySlug}
                      placeholder="category-slug"
                      onChange={(e) => {
                        setNewCategorySlugManuallyEdited(true);
                        setNewCategorySlug(slugifyCategory(e.target.value));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createCategory();
                      }}
                      disabled={creatingCategory}
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      min={0}
                      value={newCategorySortOrder}
                      onChange={(e) =>
                        setNewCategorySortOrder(Math.max(0, Number(e.target.value) || 0))
                      }
                      disabled={creatingCategory}
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 8 }}>
                    <input
                      value={newCategoryImageUrl}
                      placeholder="Image URL (optional)"
                      onChange={(e) => setNewCategoryImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createCategory();
                      }}
                      disabled={creatingCategory}
                      style={{ ...inputStyle, height: 34, fontSize: 12 }}
                    />
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--ink-3)",
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newCategoryTopCategory}
                        onChange={(e) => setNewCategoryTopCategory(e.target.checked)}
                        disabled={creatingCategory}
                      />
                      Top category
                    </label>
                    <button
                      type="button"
                      onClick={createCategory}
                      disabled={creatingCategory}
                      style={{ ...miniBtnStyle, opacity: creatingCategory ? 0.6 : 1 }}
                    >
                      {creatingCategory ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    {categories.map((category) => {
                      const draftImage = categoryImageDrafts[category.id] ?? (category.image_url || "");
                      const draftName = categoryNameDrafts[category.id] ?? category.name;
                      const draftSlug = categorySlugDrafts[category.id] ?? category.slug;
                      const draftSort = categorySortDrafts[category.id] ?? (category.sort_order ?? 0);
                      const draftTopCategory = categoryTopDrafts[category.id] ?? category.top_category;
                      const isSavingAll = savingCategoryAllId === category.id;
                      const isUploadingCategory = uploadingCategoryId === category.id;
                      const isBusy = isSavingAll || isUploadingCategory;

                      return (
                        <div
                          key={category.id}
                          style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            {/* Image preview */}
                            <div
                              style={{
                                width: 64, height: 64, borderRadius: 10, overflow: "hidden",
                                border: "1px solid var(--line)", background: "var(--bg-elev)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {draftImage ? (
                                <img src={draftImage} alt={category.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <span style={{ fontSize: 22, color: "var(--ink-4)" }}>🏷️</span>
                              )}
                            </div>

                            {/* Fields */}
                            <div style={{ flex: 1, display: "grid", gap: 7, minWidth: 0 }}>
                              {/* Name + Sort order */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 7 }}>
                                <input
                                  value={draftName}
                                  placeholder="Category name"
                                  disabled={isBusy}
                                  onChange={(e) => setCategoryNameDrafts((p) => ({ ...p, [category.id]: e.target.value }))}
                                  style={{ ...inputStyle, height: 32, fontSize: 13, fontWeight: 700, boxSizing: "border-box" }}
                                />
                                <input
                                  type="number" min={0}
                                  value={draftSort}
                                  placeholder="Order"
                                  disabled={isBusy}
                                  onChange={(e) => setCategorySortDrafts((p) => ({ ...p, [category.id]: Math.max(0, Number(e.target.value) || 0) }))}
                                  style={{ ...inputStyle, height: 32, fontSize: 12, boxSizing: "border-box" }}
                                />
                              </div>

                              {/* Slug */}
                              <input
                                value={draftSlug}
                                placeholder="category-slug"
                                disabled={isBusy}
                                onChange={(e) => setCategorySlugDrafts((p) => ({ ...p, [category.id]: slugifyCategory(e.target.value) }))}
                                style={{ ...inputStyle, height: 32, fontSize: 11, fontFamily: "JetBrains Mono, monospace", boxSizing: "border-box" }}
                              />

                              {/* Image URL */}
                              <input
                                value={draftImage}
                                placeholder="https://... (image URL)"
                                disabled={isBusy}
                                onChange={(e) => setCategoryImageDrafts((p) => ({ ...p, [category.id]: e.target.value }))}
                                style={{ ...inputStyle, height: 32, fontSize: 12, boxSizing: "border-box" }}
                              />

                              {/* Top category + actions */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink-3)", cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={draftTopCategory}
                                    disabled={isBusy}
                                    onChange={(e) => setCategoryTopDrafts((p) => ({ ...p, [category.id]: e.target.checked }))}
                                  />
                                  Top category
                                </label>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <label
                                    style={{ ...miniBtnStyle, cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1, textAlign: "center" }}
                                  >
                                    {isUploadingCategory ? "Uploading..." : "Upload image"}
                                    <input
                                      type="file" accept="image/*" disabled={isBusy}
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCategoryImageToSupabase(category.id, f); e.currentTarget.value = ""; }}
                                      style={{ display: "none" }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => saveCategoryAll(category.id)}
                                    disabled={isBusy}
                                    style={{ ...miniBtnStyle, opacity: isBusy ? 0.6 : 1 }}
                                  >
                                    {isSavingAll ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>
              )}
            </section>{/* end Category Management */}

            {/* ── Banner Management ── */}
            <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
              <div
                style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSection("banners")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--ink-4)", display: "inline-block", transform: openSections.banners ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", lineHeight: 1 }}>▼</span>
                  <div>
                    <h2 style={sectionTitleStyle}>🖼️ Homepage Banners</h2>
                    {openSections.banners && <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>Manage dynamic homepage images shown in the storefront hero.</div>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); createHomepageBanner(); }}
                  disabled={creatingHomepageBanner}
                  style={{ ...miniBtnStyle, opacity: creatingHomepageBanner ? 0.6 : 1 }}
                >
                  {creatingHomepageBanner ? "Adding..." : "+ Add banner"}
                </button>
              </div>
              {openSections.banners && (
              <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>

                {homepageBanners.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-4)",
                      border: "1px dashed var(--line)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "var(--bg-elev)",
                    }}
                  >
                    No homepage banners yet. Add a banner to enable dynamic carousel images.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {homepageBanners.map((banner) => {
                      const draftImage = homepageBannerImageDrafts[banner.id] || "";
                      const draftAlt = homepageBannerAltDrafts[banner.id] || "";
                      const draftSortOrder = homepageBannerSortDrafts[banner.id] ?? 0;
                      const draftActive = homepageBannerActiveDrafts[banner.id] ?? banner.active;
                      const isSavingBanner = savingHomepageBannerId === banner.id;
                      const isDeletingBanner = deletingHomepageBannerId === banner.id;
                      const isUploadingBanner = uploadingHomepageBannerId === banner.id;

                      return isMobile ? (
                        <div
                          key={banner.id}
                          style={{
                            border: "1px solid var(--line)",
                            borderRadius: 10,
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div
                              style={{
                                width: 72,
                                height: 52,
                                borderRadius: 8,
                                overflow: "hidden",
                                flexShrink: 0,
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
                                  alt={draftAlt || "Homepage banner preview"}
                                  loading="lazy"
                                  decoding="async"
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <span style={{ fontSize: 10, color: "var(--ink-4)" }}>No image</span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", fontWeight: 700 }}>
                                Sort order
                                <input
                                  type="number"
                                  min={0}
                                  value={draftSortOrder}
                                  onChange={(e) => setHomepageBannerSortDrafts((prev) => ({ ...prev, [banner.id]: Math.max(0, Number(e.target.value) || 0) }))}
                                  style={{ ...inputStyle, width: 64, height: 30, padding: "0 8px", fontSize: 12, boxSizing: "border-box" }}
                                />
                              </label>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                                <input
                                  type="checkbox"
                                  checked={draftActive}
                                  onChange={(e) => setHomepageBannerActiveDrafts((prev) => ({ ...prev, [banner.id]: e.target.checked }))}
                                />
                                Active
                              </label>
                            </div>
                          </div>
                          <input
                            value={draftImage}
                            placeholder="Image URL (https://...)"
                            onChange={(e) => setHomepageBannerImageDrafts((prev) => ({ ...prev, [banner.id]: e.target.value }))}
                            style={{ ...inputStyle, height: 34, fontSize: 12, boxSizing: "border-box" }}
                          />
                          <input
                            value={draftAlt}
                            placeholder="Alt text"
                            onChange={(e) => setHomepageBannerAltDrafts((prev) => ({ ...prev, [banner.id]: e.target.value }))}
                            style={{ ...inputStyle, height: 34, fontSize: 12, boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <label style={{ ...miniBtnStyle, textAlign: "center", flex: 1, opacity: !isUploadingBanner && !isSavingBanner && !isDeletingBanner ? 1 : 0.6, cursor: !isUploadingBanner && !isSavingBanner && !isDeletingBanner ? "pointer" : "not-allowed" }}>
                              {isUploadingBanner ? "Uploading..." : "Upload"}
                              <input type="file" accept="image/*" disabled={isUploadingBanner || isSavingBanner || isDeletingBanner} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadHomepageBannerImageToSupabase(banner.id, file); e.currentTarget.value = ""; }} style={{ display: "none" }} />
                            </label>
                            <button type="button" onClick={() => saveHomepageBanner(banner.id)} disabled={isSavingBanner || isUploadingBanner || isDeletingBanner} style={{ ...miniBtnStyle, flex: 1, opacity: isSavingBanner || isUploadingBanner || isDeletingBanner ? 0.6 : 1 }}>
                              {isSavingBanner ? "Saving..." : "Save"}
                            </button>
                            <button type="button" onClick={() => setConfirmAction({ title: "Delete homepage banner", body: "This will remove the selected banner image from the homepage carousel.", onConfirm: async () => deleteHomepageBanner(banner.id) })} disabled={isDeletingBanner || isSavingBanner || isUploadingBanner} style={{ ...miniDangerBtnStyle, flex: 1, opacity: isDeletingBanner || isSavingBanner || isUploadingBanner ? 0.6 : 1 }}>
                              {isDeletingBanner ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={banner.id}
                          style={{
                            border: "1px solid var(--line)",
                            borderRadius: 10,
                            padding: 10,
                            display: "grid",
                            gridTemplateColumns: "96px 1fr auto",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 96,
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
                                alt={draftAlt || "Homepage banner preview"}
                                loading="lazy"
                                decoding="async"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>No image</span>
                            )}
                          </div>

                          <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                            <input
                              value={draftImage}
                              placeholder="https://..."
                              onChange={(e) =>
                                setHomepageBannerImageDrafts((prev) => ({
                                  ...prev,
                                  [banner.id]: e.target.value,
                                }))
                              }
                              style={{ ...inputStyle, height: 34, fontSize: 12 }}
                            />
                            <input
                              value={draftAlt}
                              placeholder="Alt text"
                              onChange={(e) =>
                                setHomepageBannerAltDrafts((prev) => ({
                                  ...prev,
                                  [banner.id]: e.target.value,
                                }))
                              }
                              style={{ ...inputStyle, height: 34, fontSize: 12 }}
                            />
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  color: "var(--ink-3)",
                                  fontWeight: 700,
                                }}
                              >
                                Sort order
                                <input
                                  type="number"
                                  min={0}
                                  value={draftSortOrder}
                                  onChange={(e) =>
                                    setHomepageBannerSortDrafts((prev) => ({
                                      ...prev,
                                      [banner.id]: Math.max(0, Number(e.target.value) || 0),
                                    }))
                                  }
                                  style={{
                                    ...inputStyle,
                                    width: 92,
                                    height: 30,
                                    padding: "0 8px",
                                    fontSize: 12,
                                  }}
                                />
                              </label>
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: "var(--ink-3)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={draftActive}
                                  onChange={(e) =>
                                    setHomepageBannerActiveDrafts((prev) => ({
                                      ...prev,
                                      [banner.id]: e.target.checked,
                                    }))
                                  }
                                />
                                Active
                              </label>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label
                              style={{
                                ...miniBtnStyle,
                                textAlign: "center",
                                opacity:
                                  !isUploadingBanner && !isSavingBanner && !isDeletingBanner
                                    ? 1
                                    : 0.6,
                                cursor:
                                  !isUploadingBanner && !isSavingBanner && !isDeletingBanner
                                    ? "pointer"
                                    : "not-allowed",
                              }}
                            >
                              {isUploadingBanner ? "Uploading..." : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingBanner || isSavingBanner || isDeletingBanner}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadHomepageBannerImageToSupabase(banner.id, file);
                                  e.currentTarget.value = "";
                                }}
                                style={{ display: "none" }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => saveHomepageBanner(banner.id)}
                              disabled={isSavingBanner || isUploadingBanner || isDeletingBanner}
                              style={{
                                ...miniBtnStyle,
                                opacity:
                                  isSavingBanner || isUploadingBanner || isDeletingBanner ? 0.6 : 1,
                              }}
                            >
                              {isSavingBanner ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  title: "Delete homepage banner",
                                  body: "This will remove the selected banner image from the homepage carousel.",
                                  onConfirm: async () => deleteHomepageBanner(banner.id),
                                })
                              }
                              disabled={isDeletingBanner || isSavingBanner || isUploadingBanner}
                              style={{
                                ...miniDangerBtnStyle,
                                opacity:
                                  isDeletingBanner || isSavingBanner || isUploadingBanner ? 0.6 : 1,
                              }}
                            >
                              {isDeletingBanner ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </section>

            </div>
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
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
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
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)" }}>
                  <Field label="Purchase Price (Cost)">
                    <input
                      type="number"
                      min={0}
                      value={draft.purchase_price}
                      onChange={(e) => setDraft((d) => ({ ...d, purchase_price: Math.max(0, Number(e.target.value)) }))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Selling Price">
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
                <Field label="Optional size pricing">
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 10,
                      background: "var(--bg-elev)",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {draft.size_options.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                        No size pricing configured. Product uses base price only.
                      </div>
                    ) : (
                      draft.size_options.map((option) => (
                        <div
                          key={option.id}
                          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "1fr 150px auto", gap: 8 }}
                        >
                          <input
                            value={option.size}
                            onChange={(e) =>
                              setDraft((current) => ({
                                ...current,
                                size_options: current.size_options.map((row) =>
                                  row.id === option.id ? { ...row, size: e.target.value } : row,
                                ),
                              }))
                            }
                            placeholder="Size (e.g. S, M, L, XL, 2XL)"
                            style={inputStyle}
                          />
                          <input
                            type="number"
                            min={0}
                            value={option.price}
                            onChange={(e) =>
                              setDraft((current) => ({
                                ...current,
                                size_options: current.size_options.map((row) =>
                                  row.id === option.id
                                    ? {
                                        ...row,
                                        price: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                      }
                                    : row,
                                ),
                              }))
                            }
                            placeholder="Price"
                            style={inputStyle}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                size_options: current.size_options.filter(
                                  (row) => row.id !== option.id,
                                ),
                              }))
                            }
                            style={miniDangerBtnStyle}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            size_options: [
                              ...current.size_options,
                              {
                                id: `size-${Date.now()}-${current.size_options.length}`,
                                size: "",
                                price: current.price || 0,
                              },
                            ],
                          }))
                        }
                        style={miniBtnStyle}
                      >
                        + Add size row
                      </button>
                      {draft.size_options.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, size_options: [] }))}
                          style={miniDangerBtnStyle}
                        >
                          Clear size pricing
                        </button>
                      )}
                    </div>
                    <span style={fieldHintStyle}>
                      Example: belts can use S/M/L/XL/2XL with different prices; first-aid kits can
                      use S/M/L.
                    </span>
                  </div>
                </Field>
                <Field label="Optional variant pricing">
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 10,
                      background: "var(--bg-elev)",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {draft.variant_options.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                        No named variants configured. Product uses base price only.
                      </div>
                    ) : (
                      draft.variant_options.map((option) => (
                        <div
                          key={option.id}
                          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "1fr 150px auto", gap: 8 }}
                        >
                          <input
                            value={option.name}
                            onChange={(e) =>
                              setDraft((current) => ({
                                ...current,
                                variant_options: current.variant_options.map((row) =>
                                  row.id === option.id ? { ...row, name: e.target.value } : row,
                                ),
                              }))
                            }
                            placeholder="Variant name (e.g. Standard, Premium)"
                            style={inputStyle}
                          />
                          <input
                            type="number"
                            min={0}
                            value={option.price}
                            onChange={(e) =>
                              setDraft((current) => ({
                                ...current,
                                variant_options: current.variant_options.map((row) =>
                                  row.id === option.id
                                    ? {
                                        ...row,
                                        price: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                      }
                                    : row,
                                ),
                              }))
                            }
                            placeholder="Price"
                            style={inputStyle}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                variant_options: current.variant_options.filter(
                                  (row) => row.id !== option.id,
                                ),
                              }))
                            }
                            style={miniDangerBtnStyle}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            variant_options: [
                              ...current.variant_options,
                              {
                                id: `variant-${Date.now()}-${current.variant_options.length}`,
                                name: "",
                                price: current.price || 0,
                              },
                            ],
                          }))
                        }
                        style={miniBtnStyle}
                      >
                        + Add variant row
                      </button>
                      {draft.variant_options.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({ ...current, variant_options: [] }))
                          }
                          style={miniDangerBtnStyle}
                        >
                          Clear variant pricing
                        </button>
                      )}
                    </div>
                    <span style={fieldHintStyle}>
                      Example: Standard / Premium / Gift Pack, each with its own price.
                    </span>
                  </div>
                </Field>
                <Field label="Product image">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label
                      style={{
                        ...miniBtnStyle,
                        opacity: !uploadingImage ? 1 : 0.6,
                        cursor: !uploadingImage ? "pointer" : "not-allowed",
                      }}
                    >
                      {uploadingImage ? "Uploading..." : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImageToSupabase(file);
                          e.currentTarget.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
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
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  color: "var(--ink)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
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
