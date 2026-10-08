"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CpaAlert, DailyPoint } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, longDate, money as fmtMoney, compact, convert, ratio, shortDate, signedPct } from "@/lib/format";
import { Card, LegendItem, Section, TooltipBox } from "./ui";

const axis = { stroke: "var(--axis)", fontSize: 11, tickLine: false, tick: { fill: "var(--ink-muted)" } };

type LowerMetric = "roas" | "cpa";

/**
 * Daily spend (stacked by campaign type) and daily ROAS or CPA as two charts on a shared,
 * synced time axis — one y-scale per chart instead of a dual-axis chart.
 * Alert days are marked on the lower chart; clicking a day highlights it in both.
 */
export default function DailyCharts({
  daily,
  alerts,
  highlight,
  onDayClick,
  money,
}: {
  daily: DailyPoint[];
  alerts: CpaAlert[];
  highlight: string | null;
  onDayClick: (date: string) => void;
  money: Money;
}) {
  const [lower, setLower] = useState<LowerMetric>("roas");
  const alertByDate = new Map(alerts.map((a) => [a.date, a]));

  const spend = daily.reduce((acc, d) => acc + d.spend, 0);
  const purchases = daily.reduce((acc, d) => acc + d.purchases, 0);
  const periodRoas = spend > 0 ? daily.reduce((acc, d) => acc + d.revenue, 0) / spend : null;
  const periodCpa = purchases > 0 ? spend / purchases : null;

  // Plot values in the selected currency so axis ticks land on round numbers; tooltips read the ARS fields.
  const data = daily.map((d) => ({
    ...d,
    plotTesting: convert(d.testingSpend, money),
    plotScaling: convert(d.scalingSpend, money),
    plotCpa: d.cpa === null ? null : convert(d.cpa, money),
  }));
  const tickEvery = Math.max(0, Math.ceil(daily.length / 10) - 1);

  const handleClick = (state: { activeLabel?: string | number } | null) => {
    if (state?.activeLabel) onDayClick(String(state.activeLabel));
  };

  const highlightLine = highlight && daily.some((d) => d.date === highlight) && (
    <ReferenceLine x={highlight} stroke="var(--critical)" strokeWidth={2} strokeDasharray="3 3" />
  );

  const lowerLabel = lower === "roas" ? "ROAS" : `CPA (${money.currency})`;
  const reference = lower === "roas" ? periodRoas : periodCpa === null ? null : convert(periodCpa, money);

  return (
    <Section
      title="Daily spend vs. performance"
      subtitle="Hover to compare the same day in both charts. Click a day to pin it."
      aside={
        <div className="flex flex-wrap gap-4">
          <LegendItem color="var(--testing)" label="Testing spend" />
          <LegendItem color="var(--scaling)" label="Scaling spend" />
          <LegendItem color="var(--neutral-line)" label={`Daily ${lower === "roas" ? "ROAS" : "CPA"}`} />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="size-2.5 rounded-full border-2 border-surface bg-critical" aria-hidden />
            CPA alert
          </span>
        </div>
      }
    >
      <Card className="p-4 pb-2">
        <div className="mb-1 text-xs font-medium text-ink-2">Ad spend per day ({money.currency})</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              syncId="daily"
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              onClick={handleClick}
              className="cursor-pointer"
            >
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={shortDate} interval={tickEvery} {...axis} />
              <YAxis tickFormatter={compact} width={44} axisLine={false} {...axis} />
              {highlightLine}
              <Tooltip
                cursor={{ fill: "var(--wash)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DailyPoint | undefined;
                  if (!active || !d) return null;
                  return <DayTooltip d={d} alert={alertByDate.get(d.date)} money={money} />;
                }}
              />
              <Bar dataKey="plotTesting" stackId="spend" fill="var(--testing)" stroke="var(--surface)" strokeWidth={1} />
              <Bar
                dataKey="plotScaling"
                stackId="spend"
                fill="var(--scaling)"
                stroke="var(--surface)"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mb-1 mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-2">Per day:</span>
            <div className="flex gap-0.5 rounded-md border border-line p-0.5" role="group" aria-label="Lower chart metric">
              {(["roas", "cpa"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLower(m)}
                  className={`rounded px-2 py-0.5 font-medium ${
                    lower === m ? "bg-ink text-surface" : "text-ink-2 hover:bg-wash"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span className="text-ink-muted">
            Dashed line: {lowerLabel} for the selected period (
            {lower === "roas" ? ratio(periodRoas) : fmtMoney(periodCpa, money)})
          </span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              syncId="daily"
              margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
              onClick={handleClick}
              className="cursor-pointer"
            >
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={shortDate} interval={tickEvery} {...axis} />
              <YAxis
                tickFormatter={lower === "roas" ? (v) => `${v}x` : compact}
                width={44}
                axisLine={false}
                {...axis}
              />
              {reference !== null && <ReferenceLine y={reference} stroke="var(--ink-muted)" strokeDasharray="4 4" />}
              {highlightLine}
              <Tooltip
                cursor={{ stroke: "var(--axis)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DailyPoint | undefined;
                  if (!active || !d) return null;
                  return <DayTooltip d={d} alert={alertByDate.get(d.date)} money={money} />;
                }}
              />
              <Line
                type="monotone"
                dataKey={lower === "roas" ? "roas" : "plotCpa"}
                stroke="var(--neutral-line)"
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                dot={(props: { cx?: number; cy?: number; payload?: DailyPoint; index?: number }) => {
                  const { cx, cy, payload, index } = props;
                  if (cx == null || cy == null || !payload || !alertByDate.has(payload.date)) {
                    return <g key={`dot-${index}`} />;
                  }
                  const pinned = payload.date === highlight;
                  return (
                    <circle
                      key={`dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={pinned ? 6 : 4.5}
                      fill="var(--critical)"
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Section>
  );
}

function DayTooltip({ d, alert, money }: { d: DailyPoint; alert?: CpaAlert; money: Money }) {
  return (
    <div>
      <TooltipBox
        title={longDate(d.date)}
        rows={[
          { label: "Testing spend", value: fmtMoney(d.testingSpend, money), color: "var(--testing)" },
          { label: "Scaling spend", value: fmtMoney(d.scalingSpend, money), color: "var(--scaling)" },
          { label: "Purchases", value: int(d.purchases) },
          { label: "ROAS", value: ratio(d.roas) },
          { label: "CPA", value: fmtMoney(d.cpa, money) },
        ]}
      />
      {alert && (
        <div className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-critical shadow-lg">
          ▲ CPA alert:{" "}
          {alert.overBaseline === null ? "spend with no purchases" : `${signedPct(alert.overBaseline)} vs. prior days`}
        </div>
      )}
    </div>
  );
}
