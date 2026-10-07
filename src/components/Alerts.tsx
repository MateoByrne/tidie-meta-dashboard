import type { CpaAlert } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, longDate, money as fmtMoney, signedPct } from "@/lib/format";
import { Card, Section } from "./ui";

export default function Alerts({ alerts, money }: { alerts: CpaAlert[]; money: Money }) {
  const th = "px-4 py-2.5 text-xs font-medium text-ink-2 whitespace-nowrap";
  const td = "px-4 py-3 text-right tabular whitespace-nowrap";

  return (
    <Section
      title="CPA alerts"
      subtitle="Days where account CPA was more than 30% above the CPA of the previous 7 days (7-day spend ÷ 7-day purchases)."
      aside={
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            alerts.length ? "bg-critical-wash text-critical" : "bg-wash text-ink-2"
          }`}
        >
          {alerts.length} {alerts.length === 1 ? "alert" : "alerts"}
        </span>
      }
    >
      <Card className="overflow-x-auto">
        {alerts.length === 0 ? (
          <p className="p-4 text-sm text-ink-2">No CPA spikes in the selected range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={`${th} text-left`}>Day</th>
                <th className={`${th} text-left`}>Signal</th>
                <th className={`${th} text-right`}>Day CPA</th>
                <th className={`${th} text-right`}>7-day CPA</th>
                <th className={`${th} text-right`}>vs. 7-day</th>
                <th className={`${th} text-right`}>Spend</th>
                <th className={`${th} text-right`}>Purchases</th>
                <th className={`${th} text-left`}>Spend by campaign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {alerts.map((a) => (
                <tr key={a.date} className="hover:bg-wash">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{longDate(a.date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-critical">
                      <span aria-hidden>{a.kind === "cpa_spike" ? "▲" : "●"}</span>
                      {a.kind === "cpa_spike" ? "CPA spike" : "Spend, no purchases"}
                    </span>
                  </td>
                  <td className={`${td} font-medium`}>{fmtMoney(a.cpa, money)}</td>
                  <td className={`${td} text-ink-2`}>{fmtMoney(a.baselineCpa, money)}</td>
                  <td className={`${td} font-semibold text-critical`}>
                    {a.overBaseline === null ? "n/a" : signedPct(a.overBaseline)}
                  </td>
                  <td className={td}>{fmtMoney(a.spend, money)}</td>
                  <td className={td}>{int(a.purchases)}</td>
                  <td className="px-4 py-3 text-xs text-ink-2">
                    {a.campaigns.map((c) => (
                      <div key={c.campaign} className="whitespace-nowrap">
                        {c.campaign}: {fmtMoney(c.spend, money)} · {c.purchases} purch.
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Section>
  );
}
