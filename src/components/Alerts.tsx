import type { CpaAlert } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, longDate, money as fmtMoney, signedPct } from "@/lib/format";
import type { AlertRule } from "./Dashboard";
import { Card, Section } from "./ui";

export default function Alerts({
  alerts,
  rule,
  onRule,
  highlight,
  onShowDay,
  campaign,
  money,
}: {
  alerts: CpaAlert[];
  rule: AlertRule;
  onRule: (rule: AlertRule) => void;
  highlight: string | null;
  onShowDay: (date: string) => void;
  campaign: string | null;
  money: Money;
}) {
  const th = "px-4 py-2.5 text-xs font-medium text-ink-2 whitespace-nowrap";
  const td = "px-4 py-3 text-right tabular whitespace-nowrap";
  const w = rule.windowDays;
  const scope = campaign ? `${campaign} CPA` : "Account CPA";

  return (
    <Section
      title="CPA alerts"
      subtitle={`${scope} more than ${Math.round(rule.threshold * 100)}% above the CPA of the previous ${w} days (${w}-day spend ÷ ${w}-day purchases). Click a row to pin that day on the charts.`}
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
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 text-sm">
        <label className="flex flex-1 items-center gap-3 text-ink-2 sm:min-w-72 sm:flex-none">
          <span className="whitespace-nowrap">Alert when CPA is above baseline by</span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(rule.threshold * 100)}
            onChange={(e) => onRule({ ...rule, threshold: Number(e.target.value) / 100 })}
            className="w-32 accent-[var(--critical)]"
            aria-label="Alert threshold"
          />
          <span className="tabular w-12 font-semibold text-ink">+{Math.round(rule.threshold * 100)}%</span>
        </label>
        <div className="flex items-center gap-2 text-ink-2">
          Baseline
          <div className="flex gap-0.5 rounded-md border border-line p-0.5" role="group" aria-label="Baseline window">
            {[7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onRule({ ...rule, windowDays: d })}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  rule.windowDays === d ? "bg-ink text-surface" : "text-ink-2 hover:bg-wash"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
        {(rule.threshold !== 0.3 || rule.windowDays !== 7) && (
          <button
            type="button"
            onClick={() => onRule({ threshold: 0.3, windowDays: 7 })}
            className="text-xs font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Reset to default (30%, 7 days)
          </button>
        )}
      </Card>

      <Card className="overflow-x-auto">
        {alerts.length === 0 ? (
          <p className="p-4 text-sm text-ink-2">No CPA spikes in the selected range with this rule.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={`${th} text-left`}>Day</th>
                <th className={`${th} text-left`}>Signal</th>
                <th className={`${th} text-right`}>Day CPA</th>
                <th className={`${th} text-right`}>{w}-day CPA</th>
                <th className={`${th} text-right`}>vs. {w}-day</th>
                <th className={`${th} text-right`}>Spend</th>
                <th className={`${th} text-right`}>Purchases</th>
                <th className={`${th} text-left`}>Spend by campaign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {alerts.map((a) => (
                <tr
                  key={a.date}
                  onClick={() => onShowDay(a.date)}
                  aria-selected={highlight === a.date}
                  className={`cursor-pointer hover:bg-wash ${highlight === a.date ? "bg-critical-wash" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowDay(a.date);
                      }}
                    >
                      {longDate(a.date)}
                    </button>
                  </td>
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
