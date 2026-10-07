"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CampaignType, Row, Totals, WeeklyPoint } from "@/lib/metrics";
import { TYPE_LABEL, byType, change, cpa, ctr, roas, weeklyByType } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, compact, convert, moneyCompact, pct, ratio, shortDate, signedPct } from "@/lib/format";
import { Card, LegendItem, Section, TooltipBox } from "./ui";

const axis = { stroke: "var(--axis)", fontSize: 11, tickLine: false, tick: { fill: "var(--ink-muted)" } };

export default function TestVsScale({ rows, money }: { rows: Row[]; money: Money }) {
  const t = byType(rows);
  const weekly = weeklyByType(rows);
  const both = t.testing.spend > 0 && t.scaling.spend > 0;

  const cpaChange = change(cpa(t.scaling), cpa(t.testing));
  const roasChange = change(roas(t.scaling), roas(t.testing));

  return (
    <Section
      title="Testing vs. Scaling"
      subtitle="Testing campaigns (ABO TESTEO, 2DA DE TESTEO) find winning ads; the scaling campaign (ESCALADO) puts budget behind them."
    >
      {both ? (
        <p className="text-sm text-ink">
          Scaling delivered a{" "}
          <strong className={cpaChange! < 0 ? "text-good" : "text-critical"}>
            {signedPct(cpaChange)} CPA
          </strong>{" "}
          ({moneyCompact(cpa(t.testing), money)} → {moneyCompact(cpa(t.scaling), money)}) and{" "}
          <strong className={roasChange! > 0 ? "text-good" : "text-critical"}>{signedPct(roasChange)} ROAS</strong> (
          {ratio(roas(t.testing))} → {ratio(roas(t.scaling))}) compared with testing, on{" "}
          {pct(t.scaling.spend / (t.scaling.spend + t.testing.spend), 0)} of total spend.
        </p>
      ) : (
        <p className="text-sm text-ink-2">The selected range only includes one campaign type — widen it to compare.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
        <TypeCard type="testing" t={t.testing} money={money} />
        <TypeCard type="scaling" t={t.scaling} money={money} deltaVs={both ? t.testing : undefined} />
        <WeeklyCpa weekly={weekly} money={money} />
      </div>
    </Section>
  );
}

function TypeCard({ type, t, money, deltaVs }: { type: CampaignType; t: Totals; money: Money; deltaVs?: Totals }) {
  const metrics: { label: string; value: string; delta?: number | null; goodWhen?: "up" | "down" }[] = [
    { label: "Spend", value: moneyCompact(t.spend, money) },
    { label: "Purchases", value: int(t.purchases) },
    { label: "CPA", value: fmtMoney(cpa(t), money), delta: deltaVs && change(cpa(t), cpa(deltaVs)), goodWhen: "down" },
    { label: "ROAS", value: ratio(roas(t)), delta: deltaVs && change(roas(t), roas(deltaVs)), goodWhen: "up" },
    { label: "CTR (link)", value: pct(ctr(t)) },
  ];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-3 w-1 rounded-full ${type === "testing" ? "bg-testing" : "bg-scaling"}`} aria-hidden />
        <h3 className="text-sm font-semibold text-ink">{TYPE_LABEL[type]}</h3>
      </div>
      {t.spend === 0 ? (
        <p className="text-sm text-ink-muted">No spend in the selected range.</p>
      ) : (
        <dl className="space-y-2">
          {metrics.map((m) => {
            const good = m.delta != null && (m.goodWhen === "up" ? m.delta > 0 : m.delta < 0);
            return (
              <div key={m.label} className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="text-ink-2">{m.label}</dt>
                <dd className="tabular flex items-baseline gap-2 font-medium text-ink">
                  {m.value}
                  {m.delta != null && (
                    <span
                      className={`rounded px-1 text-xs font-semibold ${good ? "text-good" : "text-critical"}`}
                      title="vs. testing"
                    >
                      {m.delta < 0 ? "▼" : "▲"} {signedPct(m.delta)}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </Card>
  );
}

function WeeklyCpa({ weekly, money }: { weekly: WeeklyPoint[]; money: Money }) {
  const toView = (v: number | null) => (v === null ? null : convert(v, money));
  const data = weekly.map((w) => ({ ...w, plotTesting: toView(w.testingCpa), plotScaling: toView(w.scalingCpa) }));
  return (
    <Card className="p-4 pb-2">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">Weekly CPA by campaign type, {money.currency} (lower is better)</span>
        <span className="flex gap-3">
          <LegendItem color="var(--testing)" label="Testing" />
          <LegendItem color="var(--scaling)" label="Scaling" />
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="week" tickFormatter={(w) => shortDate(w)} {...axis} />
            <YAxis tickFormatter={compact} width={44} axisLine={false} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--axis)" }}
              content={({ active, payload }) => {
                const w = payload?.[0]?.payload as WeeklyPoint | undefined;
                if (!active || !w) return null;
                return (
                  <TooltipBox
                    title={`Week from ${shortDate(w.week)}`}
                    rows={[
                      { label: "Testing CPA", value: fmtMoney(w.testingCpa, money), color: "var(--testing)" },
                      { label: "Scaling CPA", value: fmtMoney(w.scalingCpa, money), color: "var(--scaling)" },
                      { label: "Testing ROAS", value: ratio(w.testingRoas) },
                      { label: "Scaling ROAS", value: ratio(w.scalingRoas) },
                    ]}
                  />
                );
              }}
            />
            {(["testing", "scaling"] as const).map((type) => (
              <Line
                key={type}
                type="monotone"
                dataKey={type === "testing" ? "plotTesting" : "plotScaling"}
                stroke={`var(--${type})`}
                strokeWidth={2}
                dot={{ r: 4, fill: `var(--${type})`, stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
