// Pure, framework-agnostic helpers backing middleware.ts's "agent readiness"
// behavior (real 404s, markdown content negotiation, Organization JSON-LD).
// Kept separate from middleware.ts (which also does Supabase fetches and
// Vercel-specific `next()` wiring) so this logic can be unit tested with
// plain Vitest, no edge-runtime mocking required.
import { SITE_URL } from "./seo";

export { SITE_URL };

// Single source of truth for the business's real contact info — used by the
// Organization JSON-LD and the /privacy, /contact, /policies bot-rendered
// mirrors. Previously this was hand-copied per page and drifted (the phone
// number changed live on 2026-08-26 but middleware.ts's renderPolicies() kept
// the old +92 329 1557509 for months) — one constant means one place to
// update.
export const CONTACT = {
  name: "Wellcare Mart",
  url: SITE_URL,
  telephone: "+923442345500",
  email: "danialansari998@gmail.com",
  streetAddress: "40 Darul Aman, Road 4, Block 3, Delhi Mercantile Society",
  addressLocality: "Karachi",
  addressRegion: "Sindh",
  addressCountry: "PK",
};

// Known-crawler UA substrings — secondary/explicit signal only, see
// isNonInteractiveFetcher.
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|twitterbot|pinterest|embedly|quora link preview|redditbot|applebot|bingpreview|gptbot|chatgpt-user|oai-searchbot|perplexitybot|claudebot|anthropic-ai|ccbot|bytespider|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|yandexbot|baiduspider|duckduckbot|sogou|exabot|ia_archiver/i;

// Primary signal: real interactive browsers send Fetch Metadata headers
// (`Sec-Fetch-Mode: navigate`) on every top-level page load; curl, HTTP
// client libraries, and most agent/crawler tooling don't. See middleware.ts
// for the full rationale — kept here verbatim so it's covered by the same
// unit tests as the rest of this module.
export function isNonInteractiveFetcher(request: { headers: { get(name: string): string | null } }): boolean {
  const userAgent = request.headers.get("user-agent") || "";
  if (!request.headers.get("sec-fetch-mode")) return true;
  return BOT_UA_PATTERN.test(userAgent);
}

// Real app routes that exist and are reachable, but are either
// account/session-scoped or otherwise not content-bearing for an anonymous
// agent (checkout, account, search, wishlist, order tracking/detail) — a
// non-interactive fetcher hitting these should still get the normal SPA
// shell (200), not a 404, since the path genuinely exists. Only paths
// outside this set AND outside the known static/product/category patterns
// are genuinely nonexistent.
const KNOWN_INTERACTIVE_ONLY_PATHS = new Set(["/checkout", "/account", "/search", "/track-order", "/wishlist", "/orders"]);

export function isKnownInteractiveOnlyRoute(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (KNOWN_INTERACTIVE_ONLY_PATHS.has(normalized)) return true;
  return normalized.startsWith("/orders/");
}

// Parses the Accept header well enough to tell whether the caller prefers a
// markdown representation over HTML — per acceptmarkdown.com's content
// negotiation convention. Deliberately simple (no full RFC 7231 media-range
// specificity ordering): good enough for the two media types this site
// actually serves.
export function prefersMarkdown(acceptHeader: string | null | undefined): boolean {
  if (!acceptHeader) return false;
  const entries = acceptHeader.split(",").map((part) => {
    const [rawType, ...params] = part.trim().split(";");
    const type = rawType.trim().toLowerCase();
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key === "q") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }
    return { type, q };
  });
  const qFor = (type: string) => entries.find((e) => e.type === type)?.q ?? -1;
  const markdownQ = Math.max(qFor("text/markdown"), qFor("text/*"));
  const htmlQ = Math.max(qFor("text/html"), qFor("*/*"));
  return markdownQ > -1 && markdownQ >= htmlQ;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Converts the small, self-controlled HTML subset middleware.ts's render*()
// functions emit (h2/h3, p, ul>li, a, img, s, strong, br) into Markdown.
// Not a general HTML-to-Markdown library — only needs to be correct for the
// exact shapes this codebase generates, verified by the unit tests alongside
// this function.
export function htmlFragmentToMarkdown(html: string): string {
  let s = html;
  s = s.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (_m, alt: string) => (alt ? decodeEntities(alt) : ""));
  s = s.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => `[${stripTags(inner)}](${href})`);
  s = s.replace(/<s>([\s\S]*?)<\/s>/gi, (_m, inner: string) => `~~${stripTags(inner)}~~`);
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_m, inner: string) => `**${stripTags(inner)}**`);
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_m, inner: string) => `\n### ${stripTags(inner)}\n`);
  s = s.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_m, inner: string) => `\n## ${stripTags(inner)}\n`);
  s = s.replace(/<li>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `\n- ${inner.replace(/\s*\n\s*/g, " ").trim()}`);
  s = s.replace(/<\/?ul>/gi, "\n");
  s = s.replace(/<p>([\s\S]*?)<\/p>/gi, (_m, inner: string) => `\n\n${inner.trim()}`);
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

export function renderMarkdownDoc(opts: { title: string; description: string; canonical: string; bodyHtml: string }): string {
  const body = htmlFragmentToMarkdown(opts.bodyHtml);
  return `# ${opts.title}\n\n${opts.description}\n\nSource: ${opts.canonical}\n\n${body}\n`;
}

export function notFoundMarkdownBody(pathname: string): string {
  return `# 404 Not Found

The path \`${pathname}\` does not exist on Wellcare Mart.

- [Sitemap](${SITE_URL}/sitemap.xml)
- [Agent instructions (llms.txt)](${SITE_URL}/llms.txt)
- [Browse categories](${SITE_URL}/categories)
- [Homepage](${SITE_URL}/)
`;
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: CONTACT.name,
    url: CONTACT.url,
    description: "Wellcare Mart is Pakistan's online store for home healthcare products, medical equipment, and wellness essentials.",
    logo: `${SITE_URL}/favicon-32x32.png`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT.telephone,
      email: CONTACT.email,
      contactType: "customer service",
      areaServed: "PK",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTACT.streetAddress,
      addressLocality: CONTACT.addressLocality,
      addressRegion: CONTACT.addressRegion,
      addressCountry: CONTACT.addressCountry,
    },
  };
}
