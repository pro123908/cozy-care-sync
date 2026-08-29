/// <reference types="node" />
import { next } from "@vercel/functions";
import {
  CATEGORIES,
  PKR,
  getDisplayPrice,
  getProductSeoPathSegment,
  resolveProductIdFromParam,
  type Category,
  type Product,
} from "./src/wcm/data";
import {
  CONTACT,
  SITE_URL,
  buildOrganizationJsonLd,
  htmlFragmentToMarkdown,
  isKnownInteractiveOnlyRoute,
  isNonInteractiveFetcher,
  notFoundMarkdownBody,
  prefersMarkdown,
} from "./src/lib/agentReadiness";

// Human-facing pages (no extension — mirrors vercel.json's SPA rewrite
// regex), plus /sitemap.xml explicitly since it has one and would otherwise
// be excluded and fall straight to the static public/sitemap.xml file.
export const config = {
  matcher: ["/((?!.*\\..*).*)", "/sitemap.xml"],
};

// Public content pages with no dynamic id segment — kept in one place so the
// sitemap and any future full-site listing stay in sync.
const STATIC_PAGES = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/categories",
  "/prescription",
  "/faqs",
  "/policies",
  "/map",
  "/deals",
];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// First-party proxy for GA4 hit collection: gtag.js is configured (see
// src/lib/ga.ts, transport_url) to send hits here instead of directly to
// google-analytics.com. Ad/privacy blocklists near-universally target that
// domain by name; they don't (and structurally can't, without breaking the
// rest of the site) block an arbitrary path on our own origin. We just
// relay the request through server-to-server, unmodified, to the real
// endpoint. Known limitation: GA resolves visitor geography from the IP of
// whoever calls its collect endpoint, which after this proxy is Vercel's
// edge IP, not the visitor's — Country/City reports will be inaccurate.
// Everything else (events, e-commerce, device/browser via UA) is unaffected.
async function proxyGaCollect(request: Request, pathname: string, search: string): Promise<Response> {
  const target = `https://www.google-analytics.com${pathname}${search}`;
  try {
    await fetch(target, {
      method: request.method,
      headers: {
        "user-agent": request.headers.get("user-agent") || "",
        "content-type": request.headers.get("content-type") || "text/plain;charset=UTF-8",
      },
      body: request.method === "POST" ? await request.text() : undefined,
    });
  } catch {
    // Best-effort — GA's own collect endpoint doesn't surface errors to
    // callers either, and the client isn't waiting on this response for
    // anything.
  }
  return new Response(null, { status: 204 });
}

// A few minutes of edge caching is fine for crawler traffic — they don't
// need second-fresh prices, and it keeps Supabase load negligible since real
// users never hit this path (they get `next()` below, unchanged). `Accept`
// is in Vary because the same path now serves either HTML or Markdown
// depending on it (acceptmarkdown.com content negotiation) — without this a
// CDN could serve a cached HTML response to a caller asking for markdown,
// or vice versa, depending on which variant happened to populate the cache
// first.
const RESPONSE_HEADERS_BASE = {
  "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
  vary: "User-Agent, Sec-Fetch-Mode, Accept, Accept-Encoding",
};

const HTML_HEADERS = { ...RESPONSE_HEADERS_BASE, "content-type": "text/html; charset=utf-8" };
const MARKDOWN_HEADERS = { ...RESPONSE_HEADERS_BASE, "content-type": "text/markdown; charset=utf-8" };

type LiveProduct = Product;

async function fetchProducts(): Promise<LiveProduct[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,brand,cat,price,was,stock,blurb,image_url,tags,delivered_sales_count,size_options,variant_options&active=eq.true&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      cat: r.cat,
      price: r.price,
      was: r.was ?? undefined,
      rating: 0,
      reviews: 0,
      delivered_sales_count: Number(r.delivered_sales_count ?? 0),
      stock: r.stock,
      tags: r.tags ?? [],
      blurb: r.blurb,
      swatch: "",
      image_url: r.image_url ?? undefined,
      size_options: Array.isArray(r.size_options) ? r.size_options : [],
      variant_options: Array.isArray(r.variant_options) ? r.variant_options : [],
    }));
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<Category[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return CATEGORIES;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/categories?select=id,name,slug,image_url,top_category&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return CATEGORIES;
    const rows = (await res.json()) as any[];
    if (!rows.length) return CATEGORIES;
    return rows.map((r) => ({ id: r.id, name: r.name, count: 0, image_url: r.image_url ?? undefined }));
  } catch {
    return CATEGORIES;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// What every render*() function below produces — one structured object per
// page, rendered to either HTML (pageShell) or Markdown (renderMarkdownDoc)
// depending on what the caller's Accept header asked for. Keeping content
// and presentation separate (rather than each render function building a
// final HTML string, as before) is what makes markdown negotiation possible
// without duplicating every page's copy in two formats.
type PageContent = {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  jsonLd?: unknown | unknown[];
  bodyHtml: string;
};

function pageShell(content: PageContent): string {
  const { title, description, canonical, ogImage, bodyHtml, jsonLd } = content;
  const jsonLdBlocks = jsonLd == null ? [] : Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  const jsonLdHtml = jsonLdBlocks.map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage || `${SITE_URL}/og-image.png`}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="robots" content="index, follow" />
${jsonLdHtml}
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</main>
</body>
</html>`;
}

function renderMarkdownDoc(content: PageContent): string {
  return `# ${content.title}\n\n${content.description}\n\nSource: ${content.canonical}\n\n${htmlFragmentToMarkdown(content.bodyHtml)}\n`;
}

function productCardHtml(p: LiveProduct, allProducts: LiveProduct[]): string {
  const slug = getProductSeoPathSegment(p, allProducts);
  const price = PKR(getDisplayPrice(p));
  const wasHtml = p.was && p.was > p.price ? `<s>${PKR(p.was)}</s> ` : "";
  return `<li>
  <a href="/products/${slug}">
    ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" width="120" />` : ""}
    <h3>${escapeHtml(p.name)}</h3>
    <p>${wasHtml}${price}</p>
    ${p.stock === "Out of stock" ? "<p>Out of stock</p>" : ""}
  </a>
</li>`;
}

function renderHome(products: LiveProduct[], categories: Category[]): PageContent {
  const featured = [...products]
    .sort((a, b) => (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0))
    .slice(0, 16);

  const categoriesHtml = categories
    .map((c) => `<li><a href="/categories/${c.id}">${escapeHtml(c.name)}</a></li>`)
    .join("");

  const productsHtml = featured.map((p) => productCardHtml(p, products)).join("");

  return {
    title: "Wellcare Mart — Medical Supplies & Equipment",
    description:
      "Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.",
    canonical: `${SITE_URL}/`,
    jsonLd: buildOrganizationJsonLd(),
    bodyHtml: `
<p>Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.</p>
<h2>Categories</h2>
<ul>${categoriesHtml}</ul>
<h2>Popular products</h2>
<ul>${productsHtml}</ul>`,
  };
}

// Static-content pages (no Supabase lookup) — text mirrors the live
// src/routes/*.tsx components. Kept as a second copy here rather than a
// shared import because these are JSX components with inline styling; if
// the copy wording changes, update both. Contact details (phone/email/
// address) are pulled from the shared CONTACT constant instead of being
// hand-typed here, specifically so they can't drift the way the phone
// number previously did.
function renderAbout(): PageContent {
  return {
    title: "About Wellcare Mart",
    description: "Learn about Wellcare Mart — Pakistan's trusted home healthcare products store.",
    canonical: `${SITE_URL}/about`,
    bodyHtml: `
<p>Wellcare Mart is focused on making home healthcare products easier to discover, compare, and order. We help families, caregivers, and clinics find trusted solutions for daily monitoring, mobility, respiratory care, and recovery support.</p>
<h2>What we do</h2>
<p>We curate practical medical and wellness essentials, keep availability updated, and provide a smooth checkout and order tracking experience.</p>
<h2>Our promise</h2>
<p>Reliable products, transparent information, and responsive customer support.</p>
<h2>Serving Karachi and beyond</h2>
<p>Wellcare Mart ships blood pressure monitors, glucometers, nebulizers, weight scales, orthopedic supports, and other home-care essentials across Pakistan, with free same-day delivery in Karachi on orders above Rs 2,000. If you're unsure which product fits your needs, our team is happy to help — see the <a href="/contact">Contact page</a> for phone, WhatsApp, and email details.</p>`,
  };
}

function renderContact(): PageContent {
  return {
    title: "Contact Wellcare Mart",
    description: "Get in touch with Wellcare Mart for order support, product questions, or general inquiries.",
    canonical: `${SITE_URL}/contact`,
    jsonLd: buildOrganizationJsonLd(),
    bodyHtml: `
<p>Have a question about an order, a product, or delivery? Reach Wellcare Mart's team directly using any of the channels below.</p>
<h2>Phone &amp; WhatsApp</h2>
<p><a href="tel:${CONTACT.telephone}">${CONTACT.telephone}</a></p>
<h2>Email</h2>
<p><a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
<h2>Address</h2>
<p>${escapeHtml(CONTACT.name)}<br>${escapeHtml(CONTACT.streetAddress)}<br>${escapeHtml(CONTACT.addressLocality)}, ${escapeHtml(CONTACT.addressRegion)}, Pakistan</p>
<h2>Support hours</h2>
<p>Our team responds to calls, WhatsApp messages, and emails throughout the week to help with orders, product questions, and delivery updates.</p>
<h2>What we can help with</h2>
<p>Placing or changing an order, tracking a delivery, choosing between similar products (for example, a digital vs. manual blood pressure monitor), reporting a damaged or incorrect item, or asking about bulk orders for a clinic or caregiver. See our <a href="/faqs">FAQs</a> for quick answers to common questions.</p>`,
  };
}

function renderPrivacy(): PageContent {
  return {
    title: "Privacy Policy - Wellcare Mart",
    description: "How Wellcare Mart collects, uses, and protects customer information.",
    canonical: `${SITE_URL}/privacy`,
    bodyHtml: `
<p>Wellcare Mart respects your privacy. We collect basic customer information such as name, phone number, delivery address, and order details only for processing orders, deliveries, customer support, and service improvement.</p>
<p>We do not sell or misuse customer data. Customer information may only be shared with delivery partners or service providers when required to complete an order.</p>
<p>We may also collect basic technical information (such as pages visited and device/browser type) to keep the store working correctly and to understand how it's used.</p>
<p>Customers can contact us anytime for questions related to their personal information using the details on our <a href="/contact">Contact page</a>.</p>
<h2>Full policies</h2>
<p>Return/refund, shipping, and terms &amp; conditions are covered on our <a href="/policies">Policies page</a>.</p>`,
  };
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How can I track my order?",
    a: "Go to Orders from your account and open the order details page to see current status updates.",
  },
  {
    q: "What are your delivery timelines?",
    a: "Most orders are delivered within 3 to 5 working days depending on your city and product availability.",
  },
  { q: "Can I return a product?", a: "Yes, eligible products can be returned according to our Returns & Refund policy." },
  {
    q: "How do I contact support?",
    a: "You can use the Contact/Map page for location details and support channels.",
  },
  {
    q: "Are product images and descriptions accurate?",
    a: "We try to keep listings up to date. Minor packaging or brand updates may vary by batch.",
  },
];

function renderFaqs(): PageContent {
  const itemsHtml = FAQS.map((item) => `<h2>${escapeHtml(item.q)}</h2><p>${escapeHtml(item.a)}</p>`).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return {
    title: "FAQs - Wellcare Mart",
    description: "Frequently asked questions about orders, delivery, returns, and products at Wellcare Mart.",
    canonical: `${SITE_URL}/faqs`,
    jsonLd,
    bodyHtml: `<p>Quick answers about orders, shipping, returns, and support.</p>\n${itemsHtml}`,
  };
}

function renderMap(): PageContent {
  return {
    title: "Store Location - Wellcare Mart",
    description: "Find Wellcare Mart's store location and get directions.",
    canonical: `${SITE_URL}/map`,
    bodyHtml: `
<p>Visit us or use map directions for pickup and support.</p>
<p><strong>${escapeHtml(CONTACT.name)}</strong><br>${escapeHtml(CONTACT.addressLocality)}, Pakistan</p>
<p><a href="https://www.google.com/maps">Open in Google Maps</a></p>`,
  };
}

function renderPolicies(): PageContent {
  return {
    title: "Policies - Wellcare Mart",
    description: "Privacy, return/refund, shipping, and terms & conditions for Wellcare Mart.",
    canonical: `${SITE_URL}/policies`,
    bodyHtml: `
<h2>Privacy Policy</h2>
<p>Wellcare Mart respects your privacy. We collect basic customer information such as name, phone number, delivery address, and order details only for processing orders, deliveries, customer support, and service improvement.</p>
<p>We do not sell or misuse customer data. Customer information may only be shared with delivery partners or service providers when required to complete an order.</p>
<p>Customers can contact us anytime for questions related to their personal information.</p>
<h2>Return / Refund Policy</h2>
<p>At Wellcare Mart, we aim to provide reliable medical and healthcare products at affordable prices.</p>
<p>Returns &amp; exchanges are accepted only if the product is damaged, defective, or incorrect at delivery; the issue is reported within 24 hours of receiving the product; and the product is unused, unopened, and in its original packaging.</p>
<p>Due to the nature of medical and healthcare products, some items such as masks, gloves, diapers, hygiene products, disposable items, and personal-use medical products may not be returnable once opened or used.</p>
<p>Refunds, replacements, or exchanges will be processed after verification by our team.</p>
<h2>Shipping / Service Policy</h2>
<p>Wellcare Mart provides doorstep delivery of medical and healthcare products.</p>
<p>Orders are typically delivered within 3 to 5 working days, though delivery time may vary based on product availability, customer location, and courier service.</p>
<p>Customers will be contacted to confirm their order before dispatch. Delivery charges may apply depending on location and order size.</p>
<p>For urgent medical product requirements, customers are encouraged to contact us directly before placing an order.</p>
<h2>Terms &amp; Conditions</h2>
<p>By using the Wellcare Mart website or placing an order, customers agree that product prices and availability may change without prior notice; product images are for reference and may slightly differ from the actual product; customers are responsible for providing accurate contact and delivery details; Wellcare Mart reserves the right to cancel any order due to stock unavailability, pricing errors, or delivery limitations; medical equipment and healthcare products should be used according to manufacturer instructions or professional guidance; and Wellcare Mart is not responsible for misuse of any product after delivery.</p>
<h2>Contact Us</h2>
<p>${escapeHtml(CONTACT.name)}<br>${escapeHtml(CONTACT.streetAddress)}<br>${escapeHtml(CONTACT.telephone)}<br>${escapeHtml(CONTACT.email)}</p>`,
  };
}

function renderPrescription(): PageContent {
  return {
    title: "Upload Prescription — Wellcare Mart",
    description: "Upload your prescription or medicine list and our team will review it and contact you for order confirmation.",
    canonical: `${SITE_URL}/prescription`,
    bodyHtml: `<p>Upload a photo or PDF of your prescription or medicine list, along with your contact details, and our team will review it and reach out to confirm your order.</p>`,
  };
}

function renderCategoriesIndex(categories: Category[]): PageContent {
  const itemsHtml = categories
    .map((c) => `<li><a href="/categories/${c.id}">${escapeHtml(c.name)}</a></li>`)
    .join("");
  return {
    title: "Shop by Category — Wellcare Mart",
    description: "Browse all product categories at Wellcare Mart.",
    canonical: `${SITE_URL}/categories`,
    bodyHtml: `<ul>${itemsHtml}</ul>`,
  };
}

function renderCategory(rawCategoryId: string, products: LiveProduct[], categories: Category[]): PageContent | null {
  const resolvedCategoryId =
    rawCategoryId === "weight-scale-digital" || rawCategoryId === "weight-scale-manual"
      ? "weight-scale"
      : rawCategoryId === "ortho-belts" || rawCategoryId === "supports"
        ? "orthobelts-supports"
        : rawCategoryId;

  const category =
    categories.find((c) => c.id === resolvedCategoryId) ||
    (resolvedCategoryId === "orthobelts-supports"
      ? { id: "orthobelts-supports", name: "Orthobelts and Supports", count: 0 }
      : undefined);
  if (!category) return null;

  const categoryIds =
    resolvedCategoryId === "orthobelts-supports"
      ? ["orthobelts-supports", "ortho-belts", "supports"]
      : [resolvedCategoryId];

  const categoryProducts = products.filter((p) => categoryIds.includes(p.cat));
  const itemsHtml = categoryProducts.map((p) => productCardHtml(p, products)).join("");

  return {
    title: `${category.name} — Wellcare Mart`,
    description: `Browse ${category.name} products at Wellcare Mart.`,
    canonical: `${SITE_URL}/categories/${rawCategoryId}`,
    bodyHtml: categoryProducts.length ? `<ul>${itemsHtml}</ul>` : `<p>No products currently listed in this category.</p>`,
  };
}

function renderDeals(products: LiveProduct[]): PageContent {
  const deals = products
    .filter((p) => p.was != null && p.was > p.price)
    .sort((a, b) => (1 - b.price / b.was!) - (1 - a.price / a.was!));
  const itemsHtml = deals.map((p) => productCardHtml(p, products)).join("");
  return {
    title: "Deals & Offers — Wellcare Mart",
    description: "Shop discounted medical supplies and equipment at Wellcare Mart.",
    canonical: `${SITE_URL}/deals`,
    bodyHtml: `<ul>${itemsHtml}</ul>`,
  };
}

function getSeoSuffix(cat?: string): string {
  switch (cat) {
    case "glucometers":
      return "Blood Glucose Meter";
    case "bp-digital":
      return "Digital Blood Pressure Monitor";
    case "bp-manual":
      return "Manual BP Apparatus";
    case "weight-scale":
      return "Weight Scale";
    case "nebulizer":
      return "Nebulizer";
    case "orthobelts-supports":
      return "Orthobelt";
    default:
      return "Medical Product";
  }
}

function renderProduct(rawProductId: string, products: LiveProduct[]): PageContent | null {
  const resolvedId = resolveProductIdFromParam(rawProductId, products);
  const product = resolvedId ? products.find((p) => p.id === resolvedId) : undefined;
  if (!product) return null;

  const seoSuffix = getSeoSuffix(product.cat);
  const title = `${product.name} ${seoSuffix} — Wellcare Mart`;
  const description = product.blurb?.trim() || `${product.name} ${seoSuffix} available at Wellcare Mart with trusted delivery across Pakistan.`;
  const canonicalPath = getProductSeoPathSegment(product, products);
  const canonical = `${SITE_URL}/products/${canonicalPath}`;
  const price = PKR(getDisplayPrice(product));
  const wasHtml = product.was && product.was > product.price ? `<s>${PKR(product.was)}</s> ` : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.name} ${seoSuffix}`,
    alternateName: product.name,
    description,
    brand: product.brand || undefined,
    sku: product.id,
    category: product.category_name || product.cat,
    url: canonical,
    image: product.image_url ? [product.image_url] : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "PKR",
      price: product.price,
      availability: product.stock === "Out of stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return {
    title,
    description,
    canonical,
    ogImage: product.image_url || undefined,
    jsonLd,
    bodyHtml: `
${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" width="320" />` : ""}
<p>${wasHtml}${price}</p>
<p>${escapeHtml(description)}</p>
${product.stock === "Out of stock" ? "<p>Out of stock</p>" : "<p>In stock</p>"}
${product.brand ? `<p>Brand: ${escapeHtml(product.brand)}</p>` : ""}
<p>Free same-day delivery in Karachi on orders above Rs 2,000.</p>`,
  };
}

// Regenerated live on every request (edge-cached for an hour) so new/renamed
// products are discoverable immediately instead of waiting on a manual
// regeneration of the old static public/sitemap.xml — confirmed 2026-07-24
// via Search Console that a real product was invisible to Google ("no
// referring sitemaps detected") because that file was frozen at 2026-06-12
// and never listed it.
async function renderSitemap(): Promise<Response | null> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  if (!products.length) return null;

  const urls = [
    ...STATIC_PAGES.map((path) => `${SITE_URL}${path}`),
    ...categories.map((c) => `${SITE_URL}/categories/${c.id}`),
    ...products.map((p) => `${SITE_URL}/products/${getProductSeoPathSegment(p, products)}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      vary: "User-Agent, Sec-Fetch-Mode",
    },
  });
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/g/")) {
    return proxyGaCollect(request, pathname, url.search);
  }

  if (pathname === "/sitemap.xml") {
    // Always dynamic regardless of fetcher type — a browser opening this URL
    // directly should see the same live list a crawler does. Falls back to
    // the static file (via next()) only if the live data fetch itself fails,
    // rather than ever serving an empty/broken sitemap.
    return (await renderSitemap()) || next();
  }

  const wantsMarkdown = prefersMarkdown(request.headers.get("accept"));

  // Real browsers (Sec-Fetch-Mode present, not asking for markdown) always
  // get the unchanged SPA shell — none of the logic below ever runs for
  // them, so none of it can regress the normal app experience.
  if (!wantsMarkdown && !isNonInteractiveFetcher(request)) {
    return next();
  }

  // Real, reachable app routes that just aren't content-bearing for an
  // anonymous agent (session/account state) — not a 404, still the SPA.
  if (isKnownInteractiveOnlyRoute(pathname)) {
    return next();
  }

  if (pathname === "/products" || pathname === "/products/") {
    return Response.redirect(`${SITE_URL}/`, 308);
  }

  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  const categoryMatch = pathname.match(/^\/categories\/([^/]+)\/?$/);

  let content: PageContent | null = null;

  if (pathname === "/") {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    content = renderHome(products, categories);
  } else if (pathname === "/categories" || pathname === "/categories/") {
    content = renderCategoriesIndex(await fetchCategories());
  } else if (categoryMatch) {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    content = renderCategory(decodeURIComponent(categoryMatch[1]), products, categories);
  } else if (pathname === "/deals" || pathname === "/deals/") {
    content = renderDeals(await fetchProducts());
  } else if (productMatch) {
    content = renderProduct(decodeURIComponent(productMatch[1]), await fetchProducts());
  } else if (pathname === "/about") {
    content = renderAbout();
  } else if (pathname === "/contact") {
    content = renderContact();
  } else if (pathname === "/privacy") {
    content = renderPrivacy();
  } else if (pathname === "/faqs") {
    content = renderFaqs();
  } else if (pathname === "/map") {
    content = renderMap();
  } else if (pathname === "/policies") {
    content = renderPolicies();
  } else if (pathname === "/prescription") {
    content = renderPrescription();
  }
  // Anything else (unmatched product/category id included, via `content`
  // staying null) is a genuinely nonexistent path for a non-interactive
  // fetcher — real HTTP 404 instead of the old soft-404 (200 + empty SPA
  // shell), so agents probing for resources can tell what actually exists.

  if (!content) {
    return new Response(notFoundMarkdownBody(pathname), { status: 404, headers: MARKDOWN_HEADERS });
  }

  if (wantsMarkdown) {
    return new Response(renderMarkdownDoc(content), { headers: MARKDOWN_HEADERS });
  }

  return new Response(pageShell(content), { headers: HTML_HEADERS });
}
