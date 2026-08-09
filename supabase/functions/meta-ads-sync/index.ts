import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Scheduled by pg_cron (see supabase/migrations/*_meta_ads_sync_cron.sql) to
// snapshot Meta Ads data into our own tables — Meta's /ads edge permanently
// refuses to return deleted ad objects ("Cannot request deleted objects",
// error_subcode 1815001, confirmed live against this account), so without a
// snapshot, a deleted ad's history is gone forever. Mirrors the field-shaping
// logic already proven in admin-app's app/api/meta-ads/route.ts and
// app/api/meta-ads/daily/route.ts — same Graph API version and fields, just
// running server-to-server with a service-role client instead of returning
// JSON to a browser.

const META_ADS_SYNC_SECRET = Deno.env.get("META_ADS_SYNC_SECRET") || "";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_AD_ACCOUNT_ID = Deno.env.get("META_AD_ACCOUNT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GRAPH_API_VERSION = "v21.0";

// Every effective_status Meta will actually let this endpoint query — DELETED
// is real but hard-rejected by the API itself, so it's excluded here too
// (matches admin-app's app/api/meta-ads/route.ts ALL_QUERYABLE_STATUSES).
const ALL_QUERYABLE_STATUSES = [
  "ACTIVE", "PAUSED", "ARCHIVED", "PENDING_REVIEW", "DISAPPROVED",
  "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED",
  "IN_PROCESS", "WITH_ISSUES",
];

// Same overlapping action_type handling as lib/meta-ads/purchases.ts on the
// admin-app side (take the max across recognized types, not the sum, since
// they're overlapping attributions of the same conversion, not distinct ones).
const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase",
  "purchase",
];
function maxPurchaseAction(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  let max = 0;
  for (const a of actions) {
    if (PURCHASE_ACTION_TYPES.includes(a.action_type)) max = Math.max(max, Number(a.value) || 0);
  }
  return max;
}

type MetaTargeting = {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: { key: string; name: string }[];
    cities?: { key: string; name: string; region?: string }[];
  };
};

function locationsFromTargeting(geo: MetaTargeting["geo_locations"]): string[] {
  if (!geo) return [];
  if (geo.cities?.length) return geo.cities.map((c) => c.name);
  if (geo.regions?.length) return geo.regions.map((r) => r.name);
  if (geo.countries?.length) return geo.countries.map((c) => c);
  return [];
}

function gendersLabel(genders: number[] | undefined): string {
  if (!genders || genders.length === 0) return "All genders";
  const has = (n: number) => genders.includes(n);
  if (has(1) && has(2)) return "All genders";
  if (has(1)) return "Men";
  if (has(2)) return "Women";
  return "All genders";
}

function linkFromCreative(creative: MetaAdRaw["creative"]): string | null {
  return creative?.object_story_spec?.link_data?.link ?? null;
}

type MetaAdRaw = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset?: { name?: string; targeting?: MetaTargeting };
  campaign?: { name?: string; objective?: string; daily_budget?: string; lifetime_budget?: string };
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    object_story_spec?: { link_data?: { name?: string; message?: string; link?: string } };
  };
};

type MetaDailyInsightRaw = {
  ad_id: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  date_start: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

async function fetchAllAds(): Promise<MetaAdRaw[]> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_AD_ACCOUNT_ID}/ads`);
  url.searchParams.set(
    "fields",
    "id,name,status,effective_status,adset{name,targeting{age_min,age_max,genders,geo_locations}},campaign{name,objective,daily_budget,lifetime_budget},creative{thumbnail_url,image_url,object_story_spec{link_data}}",
  );
  url.searchParams.set("effective_status", JSON.stringify(ALL_QUERYABLE_STATUSES));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", META_ACCESS_TOKEN);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `Failed to fetch ads (${res.status})`);
  return (json.data as MetaAdRaw[]) || [];
}

async function fetchDailyInsights(days: number): Promise<MetaDailyInsightRaw[]> {
  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_AD_ACCOUNT_ID}/insights`);
  url.searchParams.set("level", "ad");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", "ad_id,spend,impressions,reach,clicks,actions,action_values");
  url.searchParams.set("time_range", JSON.stringify({ since: fmt(since), until: fmt(until) }));
  url.searchParams.set("limit", "5000");
  url.searchParams.set("access_token", META_ACCESS_TOKEN);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `Failed to fetch insights (${res.status})`);
  return (json.data as MetaDailyInsightRaw[]) || [];
}

Deno.serve(
  {
    onError: (err) => {
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  async (req: Request) => {
    if (!META_ADS_SYNC_SECRET || req.headers.get("x-meta-ads-sync-secret") !== META_ADS_SYNC_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
      return new Response(JSON.stringify({ error: "Meta ads integration isn't configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let days = 10;
    try {
      const body = await req.json();
      if (typeof body?.days === "number" && body.days > 0) days = Math.min(body.days, 1100);
    } catch {
      // No/invalid body — use the default trailing window.
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [ads, insights] = await Promise.all([fetchAllAds(), fetchDailyInsights(days)]);

    const now = new Date().toISOString();
    const cacheRows = ads.map((ad) => {
      const targeting = ad.adset?.targeting;
      const linkData = ad.creative?.object_story_spec?.link_data;
      return {
        ad_id: ad.id,
        name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        campaign_name: ad.campaign?.name ?? null,
        objective: ad.campaign?.objective ?? null,
        adset_name: ad.adset?.name ?? null,
        age_min: targeting?.age_min ?? null,
        age_max: targeting?.age_max ?? null,
        genders: gendersLabel(targeting?.genders),
        locations: locationsFromTargeting(targeting?.geo_locations),
        daily_budget: ad.campaign?.daily_budget ? Number(ad.campaign.daily_budget) / 100 : null,
        lifetime_budget: ad.campaign?.lifetime_budget ? Number(ad.campaign.lifetime_budget) / 100 : null,
        thumbnail_url: ad.creative?.thumbnail_url ?? null,
        image_url: ad.creative?.image_url ?? null,
        headline: linkData?.name ?? null,
        message: linkData?.message ?? null,
        link: linkFromCreative(ad.creative),
        last_seen_at: now,
        updated_at: now,
      };
    });

    const statsRows = insights.map((row) => ({
      ad_id: row.ad_id,
      date: row.date_start,
      spend: row.spend ? Number(row.spend) : 0,
      impressions: row.impressions ? Number(row.impressions) : 0,
      reach: row.reach ? Number(row.reach) : 0,
      clicks: row.clicks ? Number(row.clicks) : 0,
      purchases: maxPurchaseAction(row.actions),
      purchase_value: maxPurchaseAction(row.action_values),
      synced_at: now,
    }));

    // meta_ads_daily_stats.ad_id references meta_ads_cache.ad_id — cache
    // rows must land first, or a stats row for an ad not in this sync's ad
    // list (shouldn't happen, but insights and the ad list are two separate
    // calls) would violate the FK.
    if (cacheRows.length > 0) {
      const { error: cacheErr } = await supabase.from("meta_ads_cache").upsert(cacheRows, { onConflict: "ad_id" });
      if (cacheErr) throw new Error(`meta_ads_cache upsert failed: ${cacheErr.message}`);
    }
    if (statsRows.length > 0) {
      const { error: statsErr } = await supabase
        .from("meta_ads_daily_stats")
        .upsert(statsRows, { onConflict: "ad_id,date" });
      if (statsErr) throw new Error(`meta_ads_daily_stats upsert failed: ${statsErr.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, adsSynced: cacheRows.length, dailyRowsSynced: statsRows.length, days }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
);
