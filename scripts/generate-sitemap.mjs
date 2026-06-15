import { writeFileSync } from "node:fs";
import { PRODUCTS, getProductSeoPathSegment } from "../src/wcm/data.ts";

const baseUrl = "https://wellcaremart.pk";
const today = new Date().toISOString().slice(0, 10);

const staticUrls = [
  { loc: `${baseUrl}/`, priority: "1.0" },
  { loc: `${baseUrl}/about`, priority: "0.7" },
  { loc: `${baseUrl}/categories`, priority: "0.7" },
  { loc: `${baseUrl}/prescription`, priority: "0.6" },
  { loc: `${baseUrl}/faqs`, priority: "0.7" },
  { loc: `${baseUrl}/policies`, priority: "0.6" },
  { loc: `${baseUrl}/map`, priority: "0.6" },
  { loc: `${baseUrl}/deals`, priority: "0.8" },
];

const productUrls = PRODUCTS.map((product) => ({
  loc: `${baseUrl}/products/${getProductSeoPathSegment(product, PRODUCTS)}`,
  priority: "0.9",
}));

const urls = [...staticUrls, ...productUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, priority }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`Wrote ${urls.length} sitemap URLs to public/sitemap.xml`);
