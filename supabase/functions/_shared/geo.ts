// Best-effort IP -> city/region/country lookup. Vercel's free geo headers
// (x-vercel-ip-city etc.) never reach these functions since the storefront
// SPA calls Supabase directly, bypassing Vercel's edge network entirely —
// so geo has to be resolved from the IP here instead.
const PRIVATE_IPS = new Set(["", "127.0.0.1", "::1", "localhost"]);

export async function resolveGeo(ip: string): Promise<{
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
}> {
  const empty = { geo_city: null, geo_region: null, geo_country: null };
  if (!ip || PRIVATE_IPS.has(ip)) return empty;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`,
      { signal: AbortSignal.timeout(1200) },
    );
    if (!res.ok) return empty;
    const data = await res.json();
    if (data.status !== "success") return empty;
    return {
      geo_city: data.city || null,
      geo_region: data.regionName || null,
      geo_country: data.country || null,
    };
  } catch {
    return empty;
  }
}
