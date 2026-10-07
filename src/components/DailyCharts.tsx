"use client";

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
import type { DailyPoint } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, longDate, money as fmtMoney, compact, convert, ratio, shortDate } from "@/lib/format";
import { Card, LegendItem, Section, TooltipBox } from "./ui";

const axis = { stroke: "var(--axis)", fontSize: 11, tickLine: false, tick: { fill: "var(--ink-muted)" } };

/**
 * Daily spend (stacked by campaign type) and daily ROAS as two charts on a shared,
 * synced time axis — one y-scale per chart instead of a dual-axis chart.
 */
export default function DailyCharts({ daily, money }: { daily: DailyPoint[]; money: Money }) {
  const spend = daily.reduce((acc, d) => acc + d.spend, 0);
  const periodRoas = spend > 0 ? daily.reduce((acc, d) => acc + d.revenue, 0) / spend : null;
  // Plot values in the selected currency so axis ticks land on round numbers; tooltips read the ARS fields.
  const data = daily.map((d) => ({
    ...d,
    plotTesting: convert(d.testingSpend, money),
    plotScaling: convert(d.scalingSpend, money),
  }));
  const tickEvery = Math.max(0, Math.ceil(daily.length / 10) - 1);

  return (
    <Section
      title="Daily spend vs. ROAS"
      subtitle="Hover either chart to see the same day in both."
      aside={
        <div className="flex gap-4">
          <LegendItem color="var(--testing)" label="Testing spend" />
          <LegendItem color="var(--scaling)" label="Scaling spend" />
          <LegendItem color="var(--neutral-line)" label="Daily ROAS" />
        </div>
      }
    >
      <Card className="p-4 pb-2">
        <div className="mb-1 text-xs font-medium text-ink-2">Ad spend per day ({money.currency})</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} syncId="daily" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={shortDate} interval={tickEvery} {...axis} />
              <YAxis tickFormatter={compact} width={44} axisLine={false} {...axis} />
              <Tooltip
                cursor={{ fill: "var(--wash)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DailyPoint | undefined;
                  if (!active || !d) return null;
                  return (
                    <TooltipBox
                      title={longDate(d.date)}
                      rows={[
                        { label: "Testing", value: fmtMoney(d.testingSpend, money), color: "var(--testing)" },
                        { label: "Scaling", value: fmtMoney(d.scalingSpend, money), color: "var(--scaling)" },
                        { label: "Total spend", value: fmtMoney(d.spend, money) },
                        { label: "Purchases", value: int(d.purchases) },
                        { label: "ROAS", value: ratio(d.roas) },
                      ]}
                    />
                  );
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

        <div className="mb-1 mt-4 flex items-baseline justify-between text-xs">
          <span className="font-medium text-ink-2">ROAS per day</span>
          <span className="text-ink-muted">Dashed line: ROAS for the selected period ({ratio(periodRoas)})</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId="daily" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={shortDate} interval={tickEvery} {...axis} />
              <YAxis tickFormatter={(v) => `${v}x`} width={44} axisLine={false} {...axis} />
              {periodRoas !== null && (
                <ReferenceLine y={periodRoas} stroke="var(--ink-muted)" strokeDasharray="4 4" />
              )}
              <Tooltip
                cursor={{ stroke: "var(--axis)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DailyPoint | undefined;
                  if (!active || !d) return null;
                  return (
                    <TooltipBox
                      title={longDate(d.date)}
                      rows={[
                        { label: "ROAS", value: ratio(d.roas), color: "var(--neutral-line)" },
                        { label: "Revenue", value: fmtMoney(d.revenue, money) },
                        { label: "Spend", value: fmtMoney(d.spend, money) },
                      ]}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="roas"
                stroke="var(--neutral-line)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Section>
  );
}
