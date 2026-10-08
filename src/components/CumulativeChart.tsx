"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/lib/metrics";
import { cumulative } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { compact, convert, longDate, money as fmtMoney, moneyCompact, ratio, shortDate } from "@/lib/format";
import { Card, LegendItem, Section, TooltipBox } from "./ui";

const axis = { stroke: "var(--axis)", fontSize: 11, tickLine: false, tick: { fill: "var(--ink-muted)" } };

/** Running totals of spend and revenue: the gap between the two lines is gross return on ad spend. */
export default function CumulativeChart({ daily, money }: { daily: DailyPoint[]; money: Money }) {
  const points = cumulative(daily);
  const last = points.at(-1);
  if (!last || last.spend === 0) return null;

  const data = points.map((p) => ({ ...p, plotSpend: convert(p.spend, money), plotRevenue: convert(p.revenue, money) }));
  const tickEvery = Math.max(0, Math.ceil(points.length / 8) - 1);

  return (
    <Section
      title="Cumulative spend vs. revenue"
      subtitle="Running totals over the selected range. The space between the lines is revenue generated above ad spend."
      aside={
        <div className="flex gap-4">
          <LegendItem color="var(--revenue)" label="Revenue" />
          <LegendItem color="var(--neutral-line)" label="Ad spend" />
        </div>
      }
    >
      <Card className="grid gap-4 p-4 lg:grid-cols-[1fr_15rem]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--revenue)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--revenue)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="date" tickFormatter={shortDate} interval={tickEvery} {...axis} />
              <YAxis tickFormatter={compact} width={44} axisLine={false} {...axis} />
              <Tooltip
                cursor={{ stroke: "var(--axis)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof points)[number] | undefined;
                  if (!active || !p) return null;
                  return (
                    <TooltipBox
                      title={`Through ${longDate(p.date)}`}
                      rows={[
                        { label: "Revenue", value: fmtMoney(p.revenue, money), color: "var(--revenue)" },
                        { label: "Ad spend", value: fmtMoney(p.spend, money), color: "var(--neutral-line)" },
                        { label: "Revenue − spend", value: fmtMoney(p.revenue - p.spend, money) },
                        { label: "ROAS to date", value: ratio(p.spend ? p.revenue / p.spend : null) },
                      ]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="plotRevenue"
                stroke="var(--revenue)"
                strokeWidth={2}
                fill="url(#revFill)"
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="plotSpend"
                stroke="var(--neutral-line)"
                strokeWidth={2}
                fill="var(--surface)"
                fillOpacity={0.85}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <dl className="grid grid-cols-3 gap-3 self-center lg:grid-cols-1">
          <div>
            <dt className="text-xs text-ink-2">Revenue</dt>
            <dd className="text-xl font-semibold text-revenue-ink">{moneyCompact(last.revenue, money)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Ad spend</dt>
            <dd className="text-xl font-semibold text-ink">{moneyCompact(last.spend, money)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Revenue above spend</dt>
            <dd className="text-xl font-semibold text-ink">{moneyCompact(last.revenue - last.spend, money)}</dd>
            <dd className="text-xs text-ink-muted">before product costs, shipping and fees</dd>
          </div>
        </dl>
      </Card>
    </Section>
  );
}
