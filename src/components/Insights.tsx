import type React from "react";
import type { CpaAlert, Row, Totals } from "@/lib/metrics";
import { addDays, byType, change, cpa, driverEffects, drivers, eachDay, inRange, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { longDate, moneyCompact, ratio, shortDate, signedPct } from "@/lib/format";

type Tone = "good" | "bad" | "neutral";

const TONE_COLOR: Record<Tone, string> = { good: "var(--good)", bad: "var(--critical)", neutral: "var(--ink-2)" };

interface Insight {
  tone: Tone;
  kicker: string;
  title: string;
  body: string;
}

/**
 * Plain-language takeaways, computed from the data on screen. Nothing here is hard-coded:
 * every number comes from the rows passed in, so the cards change with the filters.
 */
export default function Insights({
  allInRange,
  scopedInRange,
  scopedPrev,
  prevRange,
  range,
  alerts,
  campaign,
  money,
}: {
  allInRange: Row[];
  scopedInRange: Row[];
  scopedPrev: Row[];
  prevRange: { from: string; to: string };
  range: { from: string; to: string };
  alerts: CpaAlert[];
  campaign: string | null;
  money: Money;
}) {
  const insights = [
    testingVsScaling(allInRange, money),
    whyScalingWins(allInRange),
    trend(scopedInRange, scopedPrev, prevRange, range, campaign),
    alertSummary(alerts, campaign),
  ].filter((x): x is Insight => x !== null);

  if (insights.length === 0) return null;

  return (
    <section aria-label="Key takeaways" className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Key takeaways</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((i) => (
          <article
            key={i.kicker}
            className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 pl-5"
            style={{ "--accent": TONE_COLOR[i.tone] } as React.CSSProperties}
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" aria-hidden />
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
              <span aria-hidden>{i.tone === "good" ? "▲" : i.tone === "bad" ? "▼" : "●"}</span>
              {i.kicker}
            </div>
            <h3 className="mt-1.5 text-base font-semibold leading-snug text-ink">{i.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{i.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function testingVsScaling(rows: Row[], money: Money): Insight | null {
  const t = byType(rows);
  const cT = cpa(t.testing);
  const cS = cpa(t.scaling);
  if (cT === null || cS === null) return null;
  const cpaChange = change(cS, cT)!;
  const roasChange = change(roas(t.scaling), roas(t.testing));
  const better = cpaChange < 0;
  return {
    tone: better ? "good" : "bad",
    kicker: "Testing → Scaling",
    title: `Scaling ${better ? "cut" : "raised"} CPA by ${Math.abs(Math.round(cpaChange * 100))}%`,
    body: `${moneyCompact(cT, money)} in testing vs. ${moneyCompact(cS, money)} in scaling, with ROAS ${ratio(
      roas(t.testing),
    )} → ${ratio(roas(t.scaling))} (${signedPct(roasChange)}).`,
  };
}

function whyScalingWins(rows: Row[]): Insight | null {
  const t = byType(rows);
  if (t.testing.purchases === 0 || t.scaling.purchases === 0) return null;
  const from = drivers(t.testing);
  const to = drivers(t.scaling);
  const fx = driverEffects(to, from);
  const parts: { name: string; delta: number | null; effect: number | null; phrase: (d: string) => string }[] = [
    { name: "CPM", delta: change(to.cpm, from.cpm), effect: fx.cpm, phrase: (d) => `CPM ${d}` },
    { name: "CTR", delta: change(to.ctr, from.ctr), effect: fx.ctr, phrase: (d) => `CTR ${d}` },
    { name: "CVR", delta: change(to.cvr, from.cvr), effect: fx.cvr, phrase: (d) => `conversion rate ${d}` },
  ];
  const valid = parts.filter((p) => p.effect !== null && p.delta !== null);
  if (valid.length === 0) return null;

  // the driver that moved CPA the most, in either direction
  const main = valid.reduce((a, b) => (Math.abs(Math.log(b.effect!)) > Math.abs(Math.log(a.effect!)) ? b : a));
  const helped = valid.filter((p) => p.effect! < 1);
  const hurt = valid.filter((p) => p.effect! > 1);
  const list = (ps: typeof valid) => ps.map((p) => p.phrase(signedPct(p.delta))).join(", ");

  return {
    tone: "neutral",
    kicker: "CPA drivers",
    title:
      main.name === "CPM"
        ? `Scaling's CPA is mostly a media-cost story`
        : `Scaling wins on ${main.name === "CTR" ? "click-through" : "conversion"}, not on cheaper reach`,
    body: [
      helped.length ? `Helped: ${list(helped)}.` : "",
      hurt.length ? `Hurt: ${list(hurt)}.` : "",
      "CPA = CPM ÷ (CTR × CVR).",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function trend(
  rows: Row[],
  prevRows: Row[],
  prevRange: { from: string; to: string },
  range: { from: string; to: string },
  campaign: string | null,
): Insight | null {
  const subject = campaign ?? "Account";
  let cur: Totals;
  let base: Totals;
  let label: string;

  if (sum(prevRows).spend > 0) {
    cur = sum(rows);
    base = sum(prevRows);
    label = `vs. ${shortDate(prevRange.from)} – ${shortDate(prevRange.to)}`;
  } else {
    // No earlier data: compare the second half of the selected range with the first half.
    const days = eachDay(range.from, range.to);
    if (days.length < 4) return null;
    const mid = addDays(range.from, Math.floor(days.length / 2) - 1);
    base = sum(inRange(rows, range.from, mid));
    cur = sum(inRange(rows, addDays(mid, 1), range.to));
    label = `2nd half vs. 1st half of the range (split on ${shortDate(mid)})`;
  }

  const cpaChange = change(cpa(cur), cpa(base));
  const roasChange = change(roas(cur), roas(base));
  if (cpaChange === null) return null;
  const improving = cpaChange < 0;
  return {
    tone: Math.abs(cpaChange) < 0.03 ? "neutral" : improving ? "good" : "bad",
    kicker: "Trend",
    title: `${subject} CPA ${improving ? "down" : "up"} ${Math.abs(Math.round(cpaChange * 100))}%`,
    body: `${label}. ROAS ${signedPct(roasChange)}, spend ${signedPct(change(cur.spend, base.spend))}.`,
  };
}

function alertSummary(alerts: CpaAlert[], campaign: string | null): Insight {
  if (alerts.length === 0) {
    return {
      tone: "good",
      kicker: "CPA alerts",
      title: "No CPA spikes",
      body: `${campaign ?? "Account"} CPA stayed within the alert threshold every day in this range.`,
    };
  }
  const spikes = alerts.filter((a) => a.overBaseline !== null);
  const worst = spikes.reduce<CpaAlert | null>((w, a) => (!w || a.overBaseline! > w.overBaseline! ? a : w), null);
  const latest = alerts[0]; // sorted newest first
  return {
    tone: "bad",
    kicker: "CPA alerts",
    title: `${alerts.length} day${alerts.length === 1 ? "" : "s"} with a CPA spike`,
    body: [
      worst ? `Worst: ${longDate(worst.date)} (${signedPct(worst.overBaseline)} vs. prior days).` : "",
      latest && latest !== worst ? `Latest: ${shortDate(latest.date)}.` : "",
      "See the alert table below.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
