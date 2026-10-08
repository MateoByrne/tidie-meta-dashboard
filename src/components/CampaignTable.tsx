"use client";

import { useState } from "react";
import type { CampaignSummary, Row, Totals } from "@/lib/metrics";
import { byCampaign, cpa, cpc, cpm, ctr, cvr, roas, sum } from "@/lib/metrics";
import type { Money } from "@/lib/format";
import { int, money as fmtMoney, pct, ratio, shortDate } from "@/lib/format";
import { Card, Section, TypeBadge } from "./ui";

type SortKey = "spend" | "purchases" | "revenue" | "roas" | "cpa" | "cpm" | "cpc" | "ctr" | "cvr";

interface Column {
  key: SortKey;
  label: string;
  title: string;
  value: (t: Totals) => number | null;
  format: (v: number | null, m: Money) => string;
  better?: "up" | "down"; // colors the cell vs. the account total
}

const COLUMNS: Column[] = [
  { key: "purchases", label: "Purch.", title: "Purchases", value: (t) => t.purchases, format: (v) => (v === null ? "—" : int(v)) },
  { key: "revenue", label: "Revenue", title: "Purchase conversion value", value: (t) => t.revenue, format: fmtMoney },
  { key: "roas", label: "ROAS", title: "Revenue ÷ spend", value: roas, format: ratio, better: "up" },
  { key: "cpa", label: "CPA", title: "Spend ÷ purchases", value: cpa, format: fmtMoney, better: "down" },
  { key: "cpm", label: "CPM", title: "Cost per 1,000 impressions", value: cpm, format: fmtMoney },
  { key: "cpc", label: "CPC", title: "Cost per link click", value: cpc, format: fmtMoney },
  { key: "ctr", label: "CTR", title: "Link clicks ÷ impressions", value: ctr, format: (v) => pct(v) },
  { key: "cvr", label: "CVR", title: "Purchases ÷ link clicks", value: cvr, format: (v) => pct(v) },
];

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
  const [sort, setSort] = useState<Sort>({ key: "spend", desc: true });
  const total = sum(rows);

  const valueOf = (c: CampaignSummary, key: SortKey) =>
    key === "spend" ? c.spend : (COLUMNS.find((col) => col.key === key)!.value(c) ?? -Infinity);
  const campaigns = byCampaign(rows)
    .filter((c) => c.spend > 0 || c.purchases > 0)
    .sort((a, b) => (sort.desc ? valueOf(b, sort.key) - valueOf(a, sort.key) : valueOf(a, sort.key) - valueOf(b, sort.key)));

  const th = "px-3 py-2.5 text-xs font-medium text-ink-2 whitespace-nowrap";
  const td = "px-3 py-3 text-right tabular whitespace-nowrap";

  const tone = (col: Column, t: Totals) => {
    if (!col.better) return "";
    const v = col.value(t);
    const base = col.value(total);
    if (v === null || base === null || Math.abs(v / base - 1) < 0.03) return "text-ink";
    const better = col.better === "up" ? v > base : v < base;
    return better ? "text-good" : "text-critical";
  };

  return (
    <Section
      title="Campaigns"
      subtitle="Click a campaign to filter the KPIs, charts and alerts to it. Click a column to sort. ROAS and CPA in green/red = better/worse than the account total."
    >
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className={`${th} pl-4 text-left`}>Campaign</th>
              <SortHeader k="spend" label="Spend · share" title="Ad spend and share of total" sort={sort} onSort={setSort} />
              {COLUMNS.map((c) => (
                <SortHeader key={c.key} k={c.key} label={c.label} title={c.title} sort={sort} onSort={setSort} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {campaigns.map((c) => {
              const share = total.spend ? c.spend / total.spend : 0;
              return (
                <tr
                  key={c.campaign}
                  onClick={() => onSelect(c.campaign)}
                  aria-selected={selected === c.campaign}
                  className={`cursor-pointer transition-opacity hover:bg-wash ${
                    selected === c.campaign ? "bg-wash" : selected ? "opacity-45 hover:opacity-80" : ""
                  }`}
                >
                  <td className={`py-3 pl-4 pr-3 ${selected === c.campaign ? "shadow-[inset_3px_0_0_var(--ink)]" : ""}`}>
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
                    <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs text-ink-muted">
                      <TypeBadge type={c.type} />
                      <span>
                        {shortDate(c.firstDay)} – {shortDate(c.lastDay)}
                      </span>
                    </div>
                  </td>
                  <td className={`${td} min-w-40`}>
                    <div>{fmtMoney(c.spend, money)}</div>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-wash">
                        <div
                          className={`h-full rounded-full ${c.type === "testing" ? "bg-testing" : "bg-scaling"}`}
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-ink-2">{pct(share, 0)}</span>
                    </div>
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={`${td} ${col.better ? "font-medium" : ""} ${tone(col, c)}`}>
                      {col.format(col.value(c), money)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line font-semibold">
            <tr>
              <td className="py-3 pl-4 pr-3 text-ink">Account total</td>
              <td className={td}>{fmtMoney(total.spend, money)}</td>
              {COLUMNS.map((col) => (
                <td key={col.key} className={td}>
                  {col.format(col.value(total), money)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </Card>
    </Section>
  );
}

type Sort = { key: SortKey; desc: boolean };

function SortHeader({
  k,
  label,
  title,
  sort,
  onSort,
}: {
  k: SortKey;
  label: string;
  title: string;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const active = sort.key === k;
  return (
    <th
      className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-ink-2"
      title={title}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
        onClick={() => onSort({ key: k, desc: active ? !sort.desc : true })}
      >
        {label}
        <span aria-hidden className="text-[10px]">{active ? (sort.desc ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );
}
