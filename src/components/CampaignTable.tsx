import type { Row } from "@/lib/metrics";
import { byCampaign, cpa, ctr, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, pct, ratio, shortDate } from "@/lib/format";
import { Card, Section, TypeBadge } from "./ui";

export default function CampaignTable({ rows, money }: { rows: Row[]; money: Money }) {
  const campaigns = byCampaign(rows).filter((c) => c.spend > 0 || c.purchases > 0);
  const total = sum(rows);

  const th = "px-4 py-2.5 text-xs font-medium text-ink-2 whitespace-nowrap";
  const td = "px-4 py-3 text-right tabular whitespace-nowrap";

  return (
    <Section title="Campaigns" subtitle="Sorted by spend. ROAS, CPA and CTR are computed over the selected range.">
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
              <tr key={c.campaign} className="hover:bg-wash">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{c.campaign}</div>
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
