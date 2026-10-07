"use client";

import type { Currency } from "@/lib/format";

interface Range {
  from: string;
  to: string;
}

export default function Controls({
  bounds,
  range,
  onRange,
  presets,
  currency,
  onCurrency,
  fx,
  onFx,
}: {
  bounds: { min: string; max: string };
  range: Range;
  onRange: (r: Range) => void;
  presets: (Range & { label: string })[];
  currency: Currency;
  onCurrency: (c: Currency) => void;
  fx: number;
  onFx: (fx: number) => void;
}) {
  const segment = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-surface" : "text-ink-2 hover:bg-wash"
    }`;

  return (
    <div className="z-10 lg:sticky lg:top-0 -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-page/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Date presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={segment(range.from === p.from && range.to === p.to)}
              onClick={() => onRange({ from: p.from, to: p.to })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-ink-2">
          <input
            type="date"
            aria-label="From"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink"
            min={bounds.min}
            max={range.to}
            value={range.from}
            onChange={(e) => e.target.value && onRange({ ...range, from: e.target.value })}
          />
          <span aria-hidden>–</span>
          <input
            type="date"
            aria-label="To"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink"
            min={range.from}
            max={bounds.max}
            value={range.to}
            onChange={(e) => e.target.value && onRange({ ...range, to: e.target.value })}
          />
        </div>
      </div>

      {/* Currency */}
      <div className="flex items-center gap-3 sm:ml-auto">
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Currency">
          {(["ARS", "USD"] as const).map((c) => (
            <button key={c} type="button" className={segment(currency === c)} onClick={() => onCurrency(c)}>
              {c}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          1 USD =
          <input
            type="number"
            min={1}
            step={10}
            className="tabular w-20 rounded-md border border-line bg-surface px-2 py-1.5 text-ink"
            value={fx}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > 0) onFx(v);
            }}
          />
          ARS
        </label>
      </div>
    </div>
  );
}
