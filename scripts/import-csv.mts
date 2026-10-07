/**
 * Imports a Meta Ads Manager CSV export (Spanish UI, campaign level,
 * broken down by day) into Supabase.
 *
 *   npm run import                       # uses data/meta-ads-daily.csv
 *   npm run import -- path/to/export.csv
 *   npm run import -- --dry-run          # parse + validate, don't write
 *
 * Idempotent: rows are upserted on (date, campaign_name).
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const csvPath = args.find((a) => !a.startsWith("--")) ?? "data/meta-ads-daily.csv";

// Spanish column names as exported by Ads Manager.
const COL = {
  dateStart: "Inicio del informe",
  dateEnd: "Fin del informe",
  campaign: "Nombre de la campaña",
  spend: "Monto gastado (ARS)",
  purchases: "Resultados",
  resultIndicator: "Indicador de resultado",
  roas: "ROAS de resultados",
  impressions: "Impresiones",
  linkClicks: "Clics en el enlace",
} as const;

// Optional revenue columns, in order of preference.
const REVENUE_TOTAL_COL = "Valor de conversión de compras";
const AVG_VALUE_COL_PREFIX = "Valor de conversión de compras promedio";

type CampaignType = "testing" | "scaling";

/** Campaign naming convention: anything with ESCALADO is scaling, TESTEO is testing. */
function classify(name: string): CampaignType | null {
  const n = name.toUpperCase();
  if (n.includes("ESCALADO")) return "scaling";
  if (n.includes("TESTEO")) return "testing";
  return null;
}

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "" || v.trim() === "-") return 0;
  const parsed = Number(v);
  if (Number.isNaN(parsed)) throw new Error(`Not a number: "${v}"`);
  return parsed;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const records: Record<string, string>[] = parse(readFileSync(csvPath), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
});
if (records.length === 0) throw new Error(`No rows in ${csvPath}`);

const headers = Object.keys(records[0]);
for (const col of Object.values(COL)) {
  if (!headers.includes(col)) throw new Error(`Missing column "${col}" in ${csvPath}`);
}
const avgValueCol = headers.find((h) => h.startsWith(AVG_VALUE_COL_PREFIX));
const hasRevenueTotal = headers.includes(REVENUE_TOTAL_COL);

const warnings: string[] = [];
const rows = [];

for (const r of records) {
  const date = r[COL.dateStart];
  if (date !== r[COL.dateEnd]) {
    throw new Error(
      `Row for "${r[COL.campaign]}" spans ${date} → ${r[COL.dateEnd]}. ` +
        `Export with Breakdown → By time → Day.`,
    );
  }

  const spend = num(r[COL.spend]);
  const purchases = num(r[COL.purchases]);
  const impressions = num(r[COL.impressions]);
  const linkClicks = num(r[COL.linkClicks]);

  // Skip days where the campaign had no activity at all.
  if (spend === 0 && purchases === 0 && impressions === 0) continue;

  const type = classify(r[COL.campaign]);
  if (!type) throw new Error(`Can't classify campaign "${r[COL.campaign]}" as testing/scaling`);

  if (purchases > 0 && !r[COL.resultIndicator].includes("purchase")) {
    throw new Error(`"${r[COL.campaign]}" on ${date}: result is not purchases (${r[COL.resultIndicator]})`);
  }

  // Revenue: exact column if present, otherwise ROAS × spend (same attribution as Meta's ROAS).
  // When spend is 0 Meta leaves ROAS empty, so purchases attributed on a no-spend day
  // fall back to average purchase value × purchases.
  let revenue: number;
  if (hasRevenueTotal) {
    revenue = num(r[REVENUE_TOTAL_COL]);
  } else if (spend > 0 || purchases === 0) {
    revenue = spend * num(r[COL.roas]);
  } else if (avgValueCol && num(r[avgValueCol]) > 0) {
    revenue = num(r[avgValueCol]) * purchases;
    warnings.push(
      `${date} ${r[COL.campaign]}: ${purchases} purchase(s) with $0 spend → revenue from avg purchase value (${revenue})`,
    );
  } else {
    revenue = 0;
    warnings.push(`${date} ${r[COL.campaign]}: ${purchases} purchase(s) with $0 spend and no value → revenue 0`);
  }

  rows.push({
    date,
    campaign_name: r[COL.campaign],
    campaign_type: type,
    spend: round2(spend),
    purchases,
    revenue: round2(revenue),
    impressions,
    link_clicks: linkClicks,
  });
}

// Summary, so totals can be checked against Ads Manager.
const byCampaign = new Map<string, { spend: number; purchases: number; revenue: number; days: number }>();
for (const row of rows) {
  const t = byCampaign.get(row.campaign_name) ?? { spend: 0, purchases: 0, revenue: 0, days: 0 };
  t.spend += row.spend;
  t.purchases += row.purchases;
  t.revenue += row.revenue;
  t.days += 1;
  byCampaign.set(row.campaign_name, t);
}
console.log(`\nParsed ${records.length} CSV rows → ${rows.length} active campaign-days\n`);
console.table(
  [...byCampaign].map(([campaign, t]) => ({
    campaign,
    days: t.days,
    spend: round2(t.spend),
    purchases: t.purchases,
    revenue: round2(t.revenue),
    roas: round2(t.revenue / t.spend),
  })),
);
warnings.forEach((w) => console.warn(`⚠️  ${w}`));

if (dryRun) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
const { error } = await supabase.from("meta_ads_daily").upsert(rows, { onConflict: "date,campaign_name" });
if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

const { count } = await supabase.from("meta_ads_daily").select("*", { count: "exact", head: true });
console.log(`\n✅ Upserted ${rows.length} rows. Table now has ${count} rows.`);
