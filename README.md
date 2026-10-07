# Tidie · Meta Ads Performance Dashboard

**Live demo:** https://tidie-meta-dashboard.vercel.app

A one-page performance dashboard for **Tidie**, an Argentine e-commerce brand, built on real Meta Ads data (Nov 2 – Dec 24, 2025, in ARS).

It answers the questions a media buyer asks every morning:

- **How are we doing overall?** Spend, purchases, revenue, ROAS, CPA and CTR, in ARS or USD (configurable exchange rate, default 1,450).
- **What happened day by day?** Daily spend (split by testing vs. scaling) and daily ROAS on a shared, synced time axis.
- **Is the testing → scaling structure working?** Side-by-side comparison of testing campaigns (`ABO TESTEO`, `2DA DE TESTEO`) vs. the scaling campaign (`ESCALADO`), plus weekly CPA by type.
- **Which campaigns carry the account?** Campaign table with spend share, ROAS, CPA and CTR.
- **When did something go wrong?** Automatic alerts for days where CPA exceeded the trailing 7-day CPA by more than 30%.
- All of it filterable by date range.

**Headline from the data:** the scaling campaign ran at a **30% lower CPA** (AR$ 36.6K vs. AR$ 52.0K) and **42% higher ROAS** (2.63x vs. 1.84x) than testing, while absorbing 61% of the budget.

## Stack

| Layer | Tech |
|---|---|
| Data | Meta Ads Manager CSV export → **Supabase** (Postgres) |
| Ingestion | TypeScript import script (`scripts/import-csv.mts`) |
| App | **Next.js 16** (App Router, Server Components, Cache Components) + **TypeScript** + **Tailwind CSS v4** |
| Charts | **Recharts** |
| Hosting | **Vercel** |
| Built with | **Claude Code** |

## How it works

```
Meta Ads Manager CSV (campaign level, daily breakdown)
   │  npm run import         — local only, uses the Supabase SECRET key
   ▼
Supabase · table meta_ads_daily (one row per campaign per day)
   │  RLS: public read-only, no public writes
   ▼
Next.js Server Component     — reads with the PUBLISHABLE key, cached 1h
   │
   ▼
Client dashboard             — filters, currency toggle and alerts computed in the browser
```

The dataset is small (~80 campaign-days), so the page loads it once and every interaction (date filter, ARS/USD) is instant, with no API round-trips.

### Metric definitions

All metric logic lives in [`src/lib/metrics.ts`](src/lib/metrics.ts) as pure functions.

- **ROAS** = revenue ÷ spend · **CPA** = spend ÷ purchases · **CTR** = link clicks ÷ impressions.
- Ratios are always computed as **sum ÷ sum over the selected range**, never as averages of daily ratios (which would over-weight low-spend days).
- **Revenue** is the purchase conversion value under Meta's default attribution (7-day click, 1-day view), reconstructed as `ROAS × spend` from the export.
- **CPA alert:** a day is flagged when its CPA is more than 30% above the CPA of the 7 previous calendar days (7-day spend ÷ 7-day purchases). Days with spend but zero purchases are flagged when spend alone already exceeds that limit. Baselines look outside the selected date range, so filtering never hides context.
- **Campaign type** comes from the naming convention: names containing `ESCALADO` → scaling, `TESTEO` → testing.

### Data notes

- The import validates that the export is broken down by day and that the result metric is purchases, and prints per-campaign totals so they can be checked against Ads Manager. Totals match the Ads Manager period view exactly.
- On Dec 5, `ESCALADO` had AR$ 0 spend but 1 attributed purchase. Meta leaves ROAS empty when spend is 0, so that purchase's value (AR$ 84,877) is taken from the export's average purchase value column. The script logs a warning when this happens.
- The raw CSV is **not** committed (real business data); `data/` is git-ignored.

## Running it locally

**Requirements:** Node 20+, a free [Supabase](https://supabase.com) project.

```bash
git clone <this-repo>
cd tidie-meta-dashboard
npm install
```

1. **Create the table:** open Supabase → SQL Editor, paste [`supabase/schema.sql`](supabase/schema.sql), run it.
2. **Environment variables:** `cp .env.example .env.local` and fill in the values from Supabase → Project Settings → API Keys:

   | Variable | Used by | Notes |
   |---|---|---|
   | `SUPABASE_URL` | app + import | Project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | app | Read-only via RLS |
   | `SUPABASE_SECRET_KEY` | import script only | Bypasses RLS. Never deploy it, never commit it |

3. **Import data:** export from Meta Ads Manager at campaign level with **Breakdown → By time → Day**, save it as `data/meta-ads-daily.csv`, then:

   ```bash
   npm run import -- --dry-run   # parse and validate, print totals
   npm run import                # upsert into Supabase (idempotent)
   ```

4. **Run:** `npm run dev`, then open http://localhost:3000.

### Deploying to Vercel

Import the GitHub repo in Vercel and set **only** `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as environment variables. The secret key stays on your machine.

## Next steps

1. **Automated daily ingestion via the Meta Marketing API**, replacing the manual CSV:
   - A scheduled job (Vercel Cron or a Supabase Edge Function + `pg_cron`) calls the Insights endpoint once a day:
     `GET /act_<AD_ACCOUNT_ID>/insights?level=campaign&time_increment=1&fields=campaign_name,spend,impressions,inline_link_clicks,actions,action_values&date_preset=last_7d`
   - Purchases and revenue come from `actions` / `action_values` where `action_type = offsite_conversion.fb_pixel_purchase`.
   - Re-pulling the last 7 days each run catches late-attributed conversions; the `(date, campaign_name)` upsert already makes this safe.
   - Use a System User token from Business Manager stored as a server-side secret, and key rows on `campaign_id` instead of the name so renames don't split history.
2. **Ad-set and ad-level tables**, to rank creatives inside the testing campaigns and show which winners were promoted to scaling.
3. **Alert delivery:** push CPA alerts to Slack or email the morning after, instead of only showing them on the page.
4. **Live exchange rate:** pull the daily ARS/USD rate and convert each day at its own rate instead of a single fixed one.
5. **Multi-channel:** add Google Ads and TikTok Ads to the same schema with a `platform` column.

## Project structure

```
supabase/schema.sql        table, index, RLS policy
scripts/import-csv.mts     CSV → Supabase import with validation
src/lib/metrics.ts         all metric, series and alert logic (pure functions)
src/lib/data.ts            server-side Supabase read (cached)
src/lib/format.ts          currency / number / date formatting
src/components/            Dashboard, Controls, KpiTiles, DailyCharts, TestVsScale, CampaignTable, Alerts
```
