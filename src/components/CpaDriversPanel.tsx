import type { CampaignType, Row, Totals } from "@/lib/metrics";
import { TYPE_LABEL, byType, change, cpa, ctr, cvr, driverEffects, drivers, cpm } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { compact, money as fmtMoney, moneyCompact, int, pct, signedPct } from "@/lib/format";
import { Card } from "./ui";

/**
 * Funnel (impressions → link clicks → purchases) per campaign type, and the CPA decomposition
 * CPA = CPM ÷ (1000 × CTR × CVR): how much each driver moved scaling's CPA vs. testing's.
 */
export default function CpaDriversPanel({ rows, money }: { rows: Row[]; money: Money }) {
  const t = byType(rows);
  if (t.testing.purchases === 0 || t.scaling.purchases === 0) return null;

  const from = drivers(t.testing);
  const to = drivers(t.scaling);
  const fx = driverEffects(to, from);
  const total = change(to.cpa, from.cpa);

  const items = [
    {
      key: "CPM",
      label: "CPM",
      hint: "cost per 1,000 impressions",
      testing: fmtMoney(cpm(t.testing), money),
      scaling: fmtMoney(cpm(t.scaling), money),
      delta: change(to.cpm, from.cpm),
      effect: fx.cpm,
    },
    {
      key: "CTR",
      label: "CTR",
      hint: "link clicks ÷ impressions",
      testing: pct(ctr(t.testing)),
      scaling: pct(ctr(t.scaling)),
      delta: change(to.ctr, from.ctr),
      effect: fx.ctr,
    },
    {
      key: "CVR",
      label: "CVR",
      hint: "purchases ÷ link clicks",
      testing: pct(cvr(t.testing)),
      scaling: pct(cvr(t.scaling)),
      delta: change(to.cvr, from.cvr),
      effect: fx.cvr,
    },
  ];
  const maxEffect = Math.max(0.05, ...items.map((i) => (i.effect ? Math.abs(i.effect - 1) : 0)), Math.abs(total ?? 0));

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Funnel by campaign type</h3>
        <p className="mb-4 text-xs text-ink-muted">Impressions → link clicks → purchases, with the conversion rate at each step.</p>
        <div className="space-y-5">
          {(["testing", "scaling"] as const).map((type) => (
            <FunnelRow key={type} type={type} t={t[type]} money={money} />
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Why scaling&apos;s CPA is different</h3>
        <p className="mb-4 text-xs text-ink-muted">
          CPA = CPM ÷ (1000 × CTR × CVR). Each bar is that driver&apos;s effect on CPA, scaling vs. testing.
        </p>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold text-ink">{i.label}</span>{" "}
                  <span className="text-xs text-ink-muted">{i.hint}</span>
                </span>
                <span className="tabular text-xs text-ink-2">
                  {i.testing} → <span className="font-semibold text-ink">{i.scaling}</span> ({signedPct(i.delta)})
                </span>
              </div>
              <EffectBar effect={i.effect === null ? null : i.effect - 1} max={maxEffect} />
            </div>
          ))}
          <div className="border-t border-line pt-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">= CPA</span>
              <span className="tabular text-xs text-ink-2">
                {fmtMoney(from.cpa, money)} → <span className="font-semibold text-ink">{fmtMoney(to.cpa, money)}</span>
              </span>
            </div>
            <EffectBar effect={total} max={maxEffect} strong />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Diverging bar around a center line: left/green = lowers CPA, right/red = raises CPA. */
function EffectBar({ effect, max, strong = false }: { effect: number | null; max: number; strong?: boolean }) {
  if (effect === null) return <div className="mt-1.5 h-5 text-xs text-ink-muted">n/a</div>;
  const width = Math.min(50, (Math.abs(effect) / max) * 50);
  const lowers = effect < 0;
  return (
    <div className="mt-1.5 flex items-center gap-3">
      <div className="relative h-5 flex-1 rounded bg-wash">
        <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--axis)]" aria-hidden />
        <span
          className={`absolute inset-y-0.5 rounded-sm ${lowers ? "bg-good" : "bg-critical"} ${strong ? "" : "opacity-80"}`}
          style={lowers ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
        />
      </div>
      <span className={`tabular w-24 text-right text-xs font-semibold ${lowers ? "text-good" : "text-critical"}`}>
        {lowers ? "▼" : "▲"} {signedPct(effect)} CPA
      </span>
    </div>
  );
}

function FunnelRow({ type, t, money }: { type: CampaignType; t: Totals; money: Money }) {
  const steps = [
    { label: "Impressions", value: t.impressions },
    { label: "Link clicks", value: t.clicks, rate: ctr(t), rateLabel: "CTR" },
    { label: "Purchases", value: t.purchases, rate: cvr(t), rateLabel: "CVR" },
  ];
  const color = type === "testing" ? "bg-testing" : "bg-scaling";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
        <span className={`h-3 w-1 rounded-full ${color}`} aria-hidden />
        {TYPE_LABEL[type]}
        <span className="font-normal text-ink-muted">· CPA {moneyCompact(cpa(t), money)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        {steps.map((s, i) => (
          <FunnelStep key={s.label} {...s} index={i} />
        ))}
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  rate,
  rateLabel,
  index,
}: {
  label: string;
  value: number;
  rate?: number | null;
  rateLabel?: string;
  index: number;
}) {
  return (
    <>
      {index > 0 && (
        <div className="flex flex-col items-center text-center" aria-label={`${rateLabel} ${pct(rate ?? null)}`}>
          <span className="tabular text-xs font-semibold text-ink">{pct(rate ?? null)}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">{rateLabel} →</span>
        </div>
      )}
      <div className="min-w-0 rounded-lg bg-wash px-2 py-2 sm:px-3">
        <div className="tabular text-lg font-semibold leading-tight text-ink">
          {value >= 10_000 ? compact(value) : int(value)}
        </div>
        <div className="truncate text-xs text-ink-2">{label}</div>
      </div>
    </>
  );
}
