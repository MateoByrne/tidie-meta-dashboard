// Pure metric logic — no React, no Supabase. Everything the dashboard shows is derived here.
//
// Ratios (ROAS, CPA, CTR) are always computed as sum/sum over the selected rows,
// never as an average of daily ratios.

export type CampaignType = "testing" | "scaling";

export interface Row {
  date: string; // YYYY-MM-DD
  campaign: string;
  type: CampaignType;
  spend: number; // ARS
  purchases: number;
  revenue: number; // ARS
  impressions: number;
  clicks: number; // link clicks
}

export interface Totals {
  spend: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
}

export const TYPE_LABEL: Record<CampaignType, string> = {
  testing: "Testing",
  scaling: "Scaling",
};

export function sum(rows: Row[]): Totals {
  const t: Totals = { spend: 0, purchases: 0, revenue: 0, impressions: 0, clicks: 0 };
  for (const r of rows) {
    t.spend += r.spend;
    t.purchases += r.purchases;
    t.revenue += r.revenue;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
  }
  return t;
}

export const roas = (t: Totals) => (t.spend > 0 ? t.revenue / t.spend : null);
export const cpa = (t: Totals) => (t.purchases > 0 ? t.spend / t.purchases : null);
export const ctr = (t: Totals) => (t.impressions > 0 ? t.clicks / t.impressions : null);
export const cpm = (t: Totals) => (t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null);
export const cpc = (t: Totals) => (t.clicks > 0 ? t.spend / t.clicks : null);
/** Conversion rate: purchases per link click. */
export const cvr = (t: Totals) => (t.clicks > 0 ? t.purchases / t.clicks : null);

/** Relative change from `base` to `value` (e.g. -0.3 = 30% lower). */
export const change = (value: number | null, base: number | null) =>
  value === null || base === null || base === 0 ? null : value / base - 1;

// ---------- dates (UTC, string-based to avoid timezone drift) ----------

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const inRange = (rows: Row[], from: string, to: string) =>
  rows.filter((r) => r.date >= from && r.date <= to);

/** The range of equal length right before [from, to], e.g. Dec 1–31 → Oct 31–Nov 30. */
export function previousRange(from: string, to: string) {
  const length = eachDay(from, to).length;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

function groupBy<K>(rows: Row[], key: (r: Row) => K): Map<K, Row[]> {
  const m = new Map<K, Row[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ---------- series & breakdowns ----------

export interface DailyPoint {
  date: string;
  testingSpend: number;
  scalingSpend: number;
  spend: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
}

/** One point per calendar day in [from, to], including days with no activity. */
export function dailySeries(rows: Row[], from: string, to: string): DailyPoint[] {
  const byDate = groupBy(inRange(rows, from, to), (r) => r.date);
  return eachDay(from, to).map((date) => {
    const day = byDate.get(date) ?? [];
    const t = sum(day);
    return {
      date,
      testingSpend: sum(day.filter((r) => r.type === "testing")).spend,
      scalingSpend: sum(day.filter((r) => r.type === "scaling")).spend,
      spend: t.spend,
      purchases: t.purchases,
      revenue: t.revenue,
      impressions: t.impressions,
      clicks: t.clicks,
      roas: roas(t),
      cpa: cpa(t),
      ctr: ctr(t),
    };
  });
}

export interface CampaignSummary extends Totals {
  campaign: string;
  type: CampaignType;
  firstDay: string;
  lastDay: string;
}

export function byCampaign(rows: Row[]): CampaignSummary[] {
  return [...groupBy(rows, (r) => r.campaign)]
    .map(([campaign, list]) => {
      const active = list.filter((r) => r.spend > 0).map((r) => r.date).sort();
      return {
        campaign,
        type: list[0].type,
        firstDay: active[0] ?? list[0].date,
        lastDay: active.at(-1) ?? list[0].date,
        ...sum(list),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function byType(rows: Row[]): Record<CampaignType, Totals> {
  return {
    testing: sum(rows.filter((r) => r.type === "testing")),
    scaling: sum(rows.filter((r) => r.type === "scaling")),
  };
}

export interface WeeklyPoint {
  week: string; // first day of the 7-day bucket, YYYY-MM-DD
  testingCpa: number | null;
  scalingCpa: number | null;
  testingRoas: number | null;
  scalingRoas: number | null;
}

/**
 * CPA and ROAS per campaign type in 7-day buckets counted from the first day in `rows`
 * (daily values are too noisy to compare). The last bucket may be shorter.
 */
export function weeklyByType(rows: Row[]): WeeklyPoint[] {
  if (rows.length === 0) return [];
  const start = rows.reduce((min, r) => (r.date < min ? r.date : min), rows[0].date);
  const dayMs = 86_400_000;
  const bucket = (date: string) => {
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs);
    return addDays(start, Math.floor(days / 7) * 7);
  };
  return [...groupBy(rows, (r) => bucket(r.date))]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => {
      const t = byType(list);
      return {
        week,
        testingCpa: cpa(t.testing),
        scalingCpa: cpa(t.scaling),
        testingRoas: roas(t.testing),
        scalingRoas: roas(t.scaling),
      };
    });
}

// ---------- alerts ----------

export interface CpaAlert {
  date: string;
  kind: "cpa_spike" | "no_purchases";
  spend: number;
  purchases: number;
  cpa: number | null;
  baselineCpa: number;
  overBaseline: number | null; // 0.45 = 45% above baseline
  campaigns: { campaign: string; spend: number; purchases: number }[];
}

/**
 * Flags days (account level) where CPA exceeded the trailing 7-day CPA by more than `threshold`.
 * Baseline = spend / purchases over the 7 previous calendar days (not an average of daily CPAs).
 * Baselines use ALL rows, so a filtered range still compares against the days before it.
 * Days with spend but zero purchases are flagged separately when spend alone already exceeds
 * the threshold (CPA is undefined, but it would be at least that high with a single purchase).
 */
export function cpaAlerts(
  allRows: Row[],
  from: string,
  to: string,
  { threshold = 0.3, windowDays = 7 } = {},
): CpaAlert[] {
  const daily = new Map(dailySeries(allRows, addDays(from, -windowDays), to).map((d) => [d.date, d]));
  const byDate = groupBy(allRows, (r) => r.date);
  const firstActive = allRows.filter((r) => r.spend > 0).map((r) => r.date).sort()[0];
  if (!firstActive) return [];

  const alerts: CpaAlert[] = [];
  for (const date of eachDay(from, to)) {
    const day = daily.get(date);
    if (!day || day.spend === 0) continue;

    // Need a full window of history after the account started spending.
    const windowStart = addDays(date, -windowDays);
    if (windowStart < firstActive) continue;

    let wSpend = 0;
    let wPurchases = 0;
    for (const d of eachDay(windowStart, addDays(date, -1))) {
      wSpend += daily.get(d)?.spend ?? 0;
      wPurchases += daily.get(d)?.purchases ?? 0;
    }
    if (wPurchases === 0) continue;
    const baselineCpa = wSpend / wPurchases;
    const limit = baselineCpa * (1 + threshold);

    const isSpike = day.cpa !== null && day.cpa > limit;
    const isDry = day.purchases === 0 && day.spend > limit;
    if (!isSpike && !isDry) continue;

    alerts.push({
      date,
      kind: isSpike ? "cpa_spike" : "no_purchases",
      spend: day.spend,
      purchases: day.purchases,
      cpa: day.cpa,
      baselineCpa,
      overBaseline: day.cpa === null ? null : day.cpa / baselineCpa - 1,
      campaigns: (byDate.get(date) ?? [])
        .filter((r) => r.spend > 0)
        .map((r) => ({ campaign: r.campaign, spend: r.spend, purchases: r.purchases }))
        .sort((a, b) => b.spend - a.spend),
    });
  }
  return alerts.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- CPA drivers ----------

/**
 * CPA = CPM ÷ (1000 × CTR × CVR). Comparing the three drivers between two sets of rows
 * tells you WHY CPA moved: cheaper/pricier reach, better/worse click-through, or better/worse conversion.
 */
export interface CpaDrivers {
  cpm: number | null;
  ctr: number | null;
  cvr: number | null;
  cpa: number | null;
}

export const drivers = (t: Totals): CpaDrivers => ({ cpm: cpm(t), ctr: ctr(t), cvr: cvr(t), cpa: cpa(t) });

/**
 * Effect of each driver on CPA, as a CPA multiplier (0.8 = that driver alone cut CPA by 20%).
 * The three effects multiply to the total CPA change.
 */
export function driverEffects(to: CpaDrivers, from: CpaDrivers) {
  const ok = (a: number | null, b: number | null): a is number => a !== null && b !== null && a > 0 && b > 0;
  return {
    cpm: ok(to.cpm, from.cpm) ? to.cpm / from.cpm! : null, // higher CPM → higher CPA
    ctr: ok(to.ctr, from.ctr) ? from.ctr! / to.ctr : null, // higher CTR → lower CPA
    cvr: ok(to.cvr, from.cvr) ? from.cvr! / to.cvr : null, // higher CVR → lower CPA
  };
}

// ---------- cumulative ----------

export interface CumulativePoint {
  date: string;
  spend: number;
  revenue: number;
}

export function cumulative(daily: DailyPoint[]): CumulativePoint[] {
  let spend = 0;
  let revenue = 0;
  return daily.map((d) => {
    spend += d.spend;
    revenue += d.revenue;
    return { date: d.date, spend, revenue };
  });
}
