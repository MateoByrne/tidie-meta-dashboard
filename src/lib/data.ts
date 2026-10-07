import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { CampaignType, Row } from "./metrics";

/**
 * Reads all daily campaign rows from Supabase (server-side only).
 * Uses the publishable key — RLS allows read-only access to this table.
 * Cached for an hour; the dataset is small (one row per campaign per day).
 */
export async function getDailyRows(): Promise<Row[]> {
  "use cache";
  cacheLife("hours");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY environment variables");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("meta_ads_daily")
    .select("date, campaign_name, campaign_type, spend, purchases, revenue, impressions, link_clicks")
    .order("date");

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  // numeric columns arrive as strings from PostgREST
  return (data ?? []).map((r) => ({
    date: r.date,
    campaign: r.campaign_name,
    type: r.campaign_type as CampaignType,
    spend: Number(r.spend),
    purchases: Number(r.purchases),
    revenue: Number(r.revenue),
    impressions: Number(r.impressions),
    clicks: Number(r.link_clicks),
  }));
}
