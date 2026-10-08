"use client";

import { useMemo, useRef, useState } from "react";
import type { Row } from "@/lib/metrics";
import { addDays, cpaAlerts, dailySeries, inRange, previousRange } from "@/lib/metrics";
import type { Currency, Money } from "@/lib/format";
import { longDate } from "@/lib/format";
import Controls from "./Controls";
import KpiTiles from "./KpiTiles";
import DailyCharts from "./DailyCharts";
import TestVsScale from "./TestVsScale";
import CampaignTable from "./CampaignTable";
import Alerts from "./Alerts";
import Insights from "./Insights";
import CumulativeChart from "./CumulativeChart";

export const DEFAULT_FX = 1450;

export interface AlertRule {
  threshold: number; // 0.3 = 30% above baseline
  windowDays: number;
}

export default function Dashboard({ rows }: { rows: Row[] }) {
  // Data bounds = first and last day with spend.
  const bounds = useMemo(() => {
    const active = rows.filter((r) => r.spend > 0).map((r) => r.date).sort();
    return { min: active[0], max: active.at(-1)! };
  }, [rows]);

  const [range, setRange] = useState({ from: bounds.min, to: bounds.max });
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [fx, setFx] = useState(DEFAULT_FX);
  const [campaign, setCampaign] = useState<string | null>(null);
  const [rule, setRule] = useState<AlertRule>({ threshold: 0.3, windowDays: 7 });
  const [highlight, setHighlight] = useState<string | null>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const money: Money = { currency, fx };

  // Campaign filter applies to KPIs, daily charts and alerts.
  // Testing vs. Scaling and the campaign table always show every campaign (that's their point).
  const scoped = useMemo(() => (campaign ? rows.filter((r) => r.campaign === campaign) : rows), [rows, campaign]);
  const prev = previousRange(range.from, range.to);

  const filtered = useMemo(() => inRange(rows, range.from, range.to), [rows, range]);
  const scopedInRange = useMemo(() => inRange(scoped, range.from, range.to), [scoped, range]);
  const scopedPrev = useMemo(() => inRange(scoped, prev.from, prev.to), [scoped, prev.from, prev.to]);
  const daily = useMemo(() => dailySeries(scoped, range.from, range.to), [scoped, range]);
  const alerts = useMemo(() => cpaAlerts(scoped, range.from, range.to, rule), [scoped, range, rule]);

  const toggleCampaign = (name: string) => {
    setCampaign((c) => (c === name ? null : name));
    setHighlight(null);
  };

  const showDay = (date: string) => {
    setHighlight((d) => (d === date ? null : date));
    chartsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            {longDate(range.from)} – {longDate(range.to)} · {campaign ?? "all campaigns"}
          </p>
        </div>
      </header>

      <Controls
        bounds={bounds}
        range={range}
        onRange={(r) => {
          setRange(r);
          setHighlight(null);
        }}
        currency={currency}
        onCurrency={setCurrency}
        fx={fx}
        onFx={setFx}
        campaign={campaign}
        onClearCampaign={() => setCampaign(null)}
        presets={[
          { label: "Full period", from: bounds.min, to: bounds.max },
          { label: "November", from: clamp("2025-11-01", bounds), to: clamp("2025-11-30", bounds) },
          { label: "December", from: clamp("2025-12-01", bounds), to: clamp("2025-12-31", bounds) },
          { label: "Last 14 days", from: clamp(addDays(bounds.max, -13), bounds), to: bounds.max },
        ]}
      />

      <Insights
        allInRange={filtered}
        scopedInRange={scopedInRange}
        scopedPrev={scopedPrev}
        prevRange={prev}
        range={range}
        alerts={alerts}
        campaign={campaign}
        money={money}
      />
      <KpiTiles rows={scopedInRange} prevRows={scopedPrev} prevRange={prev} daily={daily} money={money} />
      <div ref={chartsRef} className="scroll-mt-44">
        <DailyCharts daily={daily} alerts={alerts} highlight={highlight} onDayClick={showDay} money={money} />
      </div>
      <CumulativeChart daily={daily} money={money} />
      <TestVsScale rows={filtered} money={money} />
      <CampaignTable rows={filtered} money={money} selected={campaign} onSelect={toggleCampaign} />
      <Alerts
        alerts={alerts}
        rule={rule}
        onRule={setRule}
        highlight={highlight}
        onShowDay={showDay}
        campaign={campaign}
        money={money}
      />

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
