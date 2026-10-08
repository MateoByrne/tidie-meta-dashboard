import type { Row } from "@/lib/metrics";
import { byCampaign, cpa, ctr, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, pct, ratio, shortDate } from "@/lib/format";
import { Card, Section, TypeBadge } from "./ui";

export default function CampaignTable({
  rows,
  money,
  selected,
  onSelect,
}: {
  rows: Row[];
  money: Money;
  selected: string | null;
  onSelect: (campaign: string) => void;
}) {
  const campaigns = byCampaign(rows).filter((c) => c.spend > 0 || c.purchases > 0);
  const total = sum(rows);

  const th = "px-4 py-2.5 text-xs font-medium text-ink-2 whitespace-nowrap";
  const td = "px-4 py-3 text-right tabular whitespace-nowrap";

  return (
    <Section title="Campaigns" subtitle="Click a campaign to filter the KPIs, daily charts and alerts to it. Click again to clear.">
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={`${th} text-left`}>Campaign</th>
              <th className={`${th} text-right`}>Spend</th>
              <th className={`${th} text-right`}>Share</th>
              <th className={`${th} text-right`}>Purchases</th>
              <th className={`${th} text-right`}>Revenue</th>
              <th className={`${th} text-right`}>ROAS</th>
              <th className={`${th} text-right`}>CPA</th>
              <th className={`${th} text-right`}>CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {campaigns.map((c) => (
              <tr
                key={c.campaign}
                onClick={() => onSelect(c.campaign)}
                aria-selected={selected === c.campaign}
                className={`cursor-pointer transition-opacity hover:bg-wash ${
                  selected === c.campaign ? "bg-wash" : selected ? "opacity-45 hover:opacity-80" : ""
                }`}
              >
                <td className={`px-4 py-3 ${selected === c.campaign ? "shadow-[inset_3px_0_0_var(--ink)]" : ""}`}>
                  <button
                    type="button"
                    className="text-left font-medium text-ink underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(c.campaign);
                    }}
                  >
                    {c.campaign}
                  </button>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                    <TypeBadge type={c.type} />
                    <span>
                      {shortDate(c.firstDay)} – {shortDate(c.lastDay)}
                    </span>
                  </div>
                </td>
                <td className={td}>{fmtMoney(c.spend, money)}</td>
                <td className={`${td} text-ink-2`}>{pct(total.spend ? c.spend / total.spend : null, 0)}</td>
                <td className={td}>{int(c.purchases)}</td>
                <td className={td}>{fmtMoney(c.revenue, money)}</td>
                <td className={`${td} font-medium`}>{ratio(roas(c))}</td>
                <td className={`${td} font-medium`}>{fmtMoney(cpa(c), money)}</td>
                <td className={td}>{pct(ctr(c))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line font-semibold">
            <tr>
              <td className="px-4 py-3 text-ink">Total</td>
              <td className={td}>{fmtMoney(total.spend, money)}</td>
              <td className={`${td} text-ink-2`}>100%</td>
              <td className={td}>{int(total.purchases)}</td>
              <td className={td}>{fmtMoney(total.revenue, money)}</td>
              <td className={td}>{ratio(roas(total))}</td>
              <td className={td}>{fmtMoney(cpa(total), money)}</td>
              <td className={td}>{pct(ctr(total))}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </Section>
  );
}
