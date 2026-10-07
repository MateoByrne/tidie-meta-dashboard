"use client";

import { useMemo, useState } from "react";
import type { Row } from "@/lib/metrics";
import { addDays, cpaAlerts, dailySeries, inRange } from "@/lib/metrics";
import type { Currency, Money } from "@/lib/format";
import { longDate } from "@/lib/format";
import Controls from "./Controls";
import KpiTiles from "./KpiTiles";
import DailyCharts from "./DailyCharts";
import TestVsScale from "./TestVsScale";
import CampaignTable from "./CampaignTable";
import Alerts from "./Alerts";

export const DEFAULT_FX = 1450;

export default function Dashboard({ rows }: { rows: Row[] }) {
  // Data bounds = first and last day with spend.
  const bounds = useMemo(() => {
    const active = rows.filter((r) => r.spend > 0).map((r) => r.date).sort();
    return { min: active[0], max: active.at(-1)! };
  }, [rows]);

  const [range, setRange] = useState({ from: bounds.min, to: bounds.max });
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [fx, setFx] = useState(DEFAULT_FX);
  const money: Money = { currency, fx };

  const filtered = useMemo(() => inRange(rows, range.from, range.to), [rows, range]);
  const daily = useMemo(() => dailySeries(rows, range.from, range.to), [rows, range]);
  const alerts = useMemo(() => cpaAlerts(rows, range.from, range.to), [rows, range]);

  if (rows.length === 0) {
    return <p className="p-8 text-ink-2">No data yet — run <code>npm run import</code>.</p>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Tidie · Meta Ads</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Performance dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">
            {longDate(range.from)} – {longDate(range.to)} · campaign-level daily data
          </p>
        </div>
      </header>

      <Controls
        bounds={bounds}
        range={range}
        onRange={setRange}
        currency={currency}
        onCurrency={setCurrency}
        fx={fx}
        onFx={setFx}
        presets={[
          { label: "Full period", from: bounds.min, to: bounds.max },
          { label: "November", from: clamp("2025-11-01", bounds), to: clamp("2025-11-30", bounds) },
          { label: "December", from: clamp("2025-12-01", bounds), to: clamp("2025-12-31", bounds) },
          { label: "Last 14 days", from: clamp(addDays(bounds.max, -13), bounds), to: bounds.max },
        ]}
      />

      <KpiTiles rows={filtered} money={money} />
      <DailyCharts daily={daily} money={money} />
      <TestVsScale rows={filtered} money={money} />
      <CampaignTable rows={filtered} money={money} />
      <Alerts alerts={alerts} money={money} />

      <footer className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
        Source: Meta Ads Manager export (campaign level, daily breakdown), stored in Supabase. Attribution: 7-day click,
        1-day view. Revenue = purchase conversion value. ROAS, CPA and CTR are computed as totals over the selected
        range (sum ÷ sum), not averages of daily values. CTR uses link clicks. USD figures use a fixed rate of{" "}
        {fx.toLocaleString("en-US")} ARS/USD.
      </footer>
    </main>
  );
}

function clamp(date: string, { min, max }: { min: string; max: string }) {
  return date < min ? min : date > max ? max : date;
}
