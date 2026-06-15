export const SITE_URL = "https://wellcaremart.pk";

export const NOINDEX_FOLLOW_META = { name: "robots", content: "noindex, follow" } as const;

export function canonicalUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
