export type Currency = "ARS" | "USD";

export interface Money {
  currency: Currency;
  fx: number; // ARS per 1 USD
}

export const convert = (ars: number, { currency, fx }: Money) => (currency === "USD" ? ars / fx : ars);
const prefix = (c: Currency) => (c === "USD" ? "US$" : "AR$");

/** Full amount, e.g. AR$ 1,234,567 / US$ 851.42 */
export function money(ars: number | null, m: Money): string {
  if (ars === null) return "—";
  const v = convert(ars, m);
  const digits = m.currency === "USD" && Math.abs(v) < 1000 ? 2 : 0;
  return `${prefix(m.currency)} ${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Compact number for chart axes (currency shown in the chart title), e.g. 800K */
export const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Compact amount for tiles, e.g. AR$ 23.9M / US$ 16.5K */
export function moneyCompact(ars: number | null, m: Money): string {
  if (ars === null) return "—";
  return `${prefix(m.currency)} ${convert(ars, m).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

export const int = (n: number) => n.toLocaleString("en-US");
export const ratio = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}x`);
export const pct = (n: number | null, digits = 2) => (n === null ? "—" : `${(n * 100).toFixed(digits)}%`);
export const signedPct = (n: number | null) =>
  n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(0)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2025-11-06 → "Nov 6" */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** 2025-11-06 → "Thu, Nov 6, 2025" */
export function longDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
