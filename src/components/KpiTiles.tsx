import type { Row } from "@/lib/metrics";
import { cpa, ctr, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, moneyCompact, pct, ratio } from "@/lib/format";
import { Card } from "./ui";

export default function KpiTiles({ rows, money }: { rows: Row[]; money: Money }) {
  const t = sum(rows);
  const activeDays = new Set(rows.filter((r) => r.spend > 0).map((r) => r.date)).size;

  const tiles = [
    { label: "Ad spend", value: moneyCompact(t.spend, money), detail: fmtMoney(t.spend, money) },
    { label: "Purchases", value: int(t.purchases), detail: `${activeDays} active days` },
    { label: "Revenue", value: moneyCompact(t.revenue, money), detail: fmtMoney(t.revenue, money) },
    { label: "ROAS", value: ratio(roas(t)), detail: "revenue ÷ spend" },
    { label: "CPA", value: moneyCompact(cpa(t), money), detail: fmtMoney(cpa(t), money) },
    { label: "CTR (link)", value: pct(ctr(t)), detail: `${int(t.clicks)} link clicks` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((k) => (
        <Card key={k.label} className="p-4">
          <div className="text-xs font-medium text-ink-2">{k.label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{k.value}</div>
          <div className="tabular mt-0.5 truncate text-xs text-ink-muted" title={k.detail}>
            {k.detail}
          </div>
        </Card>
      ))}
    </div>
  );
}
