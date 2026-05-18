export type Holding = {
  date: string;
  fund: string;
  company: string;
  ticker: string;
  cusip: string;
  shares: number;
  marketValue: number;
  weight: number;
};

type RawHolding = {
  date?: string;
  fund?: string;
  company?: string;
  ticker?: string;
  cusip?: string;
  shares?: string | number;
  "market value ($)"?: string | number;
  "weight (%)"?: string | number;
};

const stripNumber = (v: string | number | undefined): number => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v.replace(/[^0-9eE+\-.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

import bundled from "../../data/arkk_holdings.json";

const ARKK_SOURCE =
  "https://proxy.cf-io.workers.dev/?url=https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv&format=json";

export async function loadHoldings(): Promise<Holding[]> {
  let raw: RawHolding[] = [];
  try {
    const res = await fetch(ARKK_SOURCE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = (await res.json()) as RawHolding[];
  } catch {
    raw = bundled as RawHolding[];
  }
  return raw
    .filter((r) => r && r.ticker)
    .map<Holding>((r) => ({
      date: r.date ?? "",
      fund: r.fund ?? "",
      company: (r.company ?? "").trim(),
      ticker: (r.ticker ?? "").trim(),
      cusip: r.cusip ?? "",
      shares: stripNumber(r.shares),
      marketValue: stripNumber(r["market value ($)"]),
      weight: stripNumber(r["weight (%)"]),
    }))
    .filter((h) => h.weight > 0 || h.marketValue > 0);
}
