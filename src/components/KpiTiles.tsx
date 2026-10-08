import type { DailyPoint, Row, Totals } from "@/lib/metrics";
import { change, cpa, ctr, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, moneyCompact, pct, ratio, shortDate, signedPct } from "@/lib/format";
import { Card } from "./ui";

type Better = "up" | "down" | "neutral";

interface Tile {
  label: string;
  value: string;
  detail: string;
  metric: (t: Totals) => number | null;
  daily: (d: DailyPoint) => number | null;
  better: Better;
}

export default function KpiTiles({
  rows,
  prevRows,
  prevRange,
  daily,
  money,
}: {
  rows: Row[];
  prevRows: Row[];
  prevRange: { from: string; to: string };
  daily: DailyPoint[];
  money: Money;
}) {
  const t = sum(rows);
  const p = sum(prevRows);
  const hasPrev = p.spend > 0;

  const tiles: Tile[] = [
    {
      label: "Ad spend",
      value: moneyCompact(t.spend, money),
      detail: fmtMoney(t.spend, money),
      metric: (x) => x.spend,
      daily: (d) => d.spend,
      better: "neutral",
    },
    {
      label: "Purchases",
      value: int(t.purchases),
      detail: `${new Set(rows.filter((r) => r.spend > 0).map((r) => r.date)).size} active days`,
      metric: (x) => x.purchases,
      daily: (d) => d.purchases,
      better: "up",
    },
    {
      label: "Revenue",
      value: moneyCompact(t.revenue, money),
      detail: fmtMoney(t.revenue, money),
      metric: (x) => x.revenue,
      daily: (d) => d.revenue,
      better: "up",
    },
    { label: "ROAS", value: ratio(roas(t)), detail: "revenue ÷ spend", metric: roas, daily: (d) => d.roas, better: "up" },
    {
      label: "CPA",
      value: moneyCompact(cpa(t), money),
      detail: fmtMoney(cpa(t), money),
      metric: cpa,
      daily: (d) => d.cpa,
      better: "down",
    },
    {
      label: "CTR (link)",
      value: pct(ctr(t)),
      detail: `${int(t.clicks)} link clicks`,
      metric: ctr,
      daily: (d) => d.ctr,
      better: "up",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((k) => {
          const delta = hasPrev ? change(k.metric(t), k.metric(p)) : null;
          return (
            <Card key={k.label} className="flex flex-col p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-ink-2">{k.label}</span>
                <Delta value={delta} better={k.better} />
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{k.value}</div>
              <div className="tabular mt-0.5 truncate text-xs text-ink-muted" title={k.detail}>
                {k.detail}
              </div>
              <Sparkline values={daily.map(k.daily)} />
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">
        {hasPrev
          ? `▲▼ vs. previous period of equal length (${shortDate(prevRange.from)} – ${shortDate(prevRange.to)}). Lines show the daily trend.`
          : "No data for the previous period of equal length, so there is nothing to compare against. Pick a shorter range (e.g. December) to see changes. Lines show the daily trend."}
      </p>
    </div>
  );
}

function Delta({ value, better }: { value: number | null; better: Better }) {
  if (value === null || !Number.isFinite(value)) return null;
  const good = better === "neutral" ? null : better === "up" ? value > 0 : value < 0;
  const color = good === null || Math.abs(value) < 0.005 ? "text-ink-2" : good ? "text-good" : "text-critical";
  return (
    <span className={`tabular text-xs font-semibold ${color}`} title="vs. previous period">
      {value > 0 ? "▲" : value < 0 ? "▼" : ""} {signedPct(value)}
    </span>
  );
}

/** Tiny daily trend line. Gaps (days without a value) break the line. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const defined = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (defined.length < 2) return <div className="mt-3 h-7" aria-hidden />;

  const w = 100;
  const h = 28;
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const x = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * w);
  const y = (v: number) => (max === min ? h / 2 : h - 2 - ((v - min) / (max - min)) * (h - 4));

  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
    pen = true;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
