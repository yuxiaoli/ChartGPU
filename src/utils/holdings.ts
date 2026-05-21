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

// import bundled from "../../data/arkk_holdings.json";

const ARKK_SOURCE =
  "https://proxy.cf-io.workers.dev/?url=https://assets.ark-funds.com/fund-documents/funds-etf-csv/ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv&format=json";

const CACHE_NAME = "arkk-holdings-v2";
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHED_AT_HEADER = "x-arkk-cached-at";

function normalize(raw: RawHolding[]): Holding[] {
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

async function fetchAndCache(
  cache: Cache | null,
): Promise<RawHolding[] | null> {
  const res = await fetch(ARKK_SOURCE, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.clone().text();
  if (cache) {
    const headers = new Headers(res.headers);
    headers.set("content-type", "application/json");
    headers.set(CACHED_AT_HEADER, String(Date.now()));
    await cache.put(
      ARKK_SOURCE,
      new Response(body, { status: 200, headers }),
    );
  }
  return JSON.parse(body) as RawHolding[];
}

async function readFromCache(cache: Cache): Promise<{
  raw: RawHolding[];
  age: number;
} | null> {
  const hit = await cache.match(ARKK_SOURCE);
  if (!hit) return null;
  const cachedAt = Number(hit.headers.get(CACHED_AT_HEADER) ?? "0");
  const age = Date.now() - cachedAt;
  const raw = (await hit.json()) as RawHolding[];
  return { raw, age };
}

export type LoadResult = {
  holdings: Holding[];
  source: "network" | "cache" | "stale-cache";
  fetchedAt?: number;
};

export async function loadHoldings(): Promise<LoadResult> {
  const supportsCache = typeof caches !== "undefined";
  const cache = supportsCache ? await caches.open(CACHE_NAME) : null;

  // Clean up old caches
  if (supportsCache) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith("arkk-holdings-") && key !== CACHE_NAME) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.warn("Failed to clean up old caches", e);
    }
  }

  if (cache) {
    const cached = await readFromCache(cache);
    if (cached && cached.age < CACHE_TTL_MS) {
      return {
        holdings: normalize(cached.raw),
        source: "cache",
        fetchedAt: Date.now() - cached.age,
      };
    }
    try {
      const raw = await fetchAndCache(cache);
      if (raw) {
        return {
          holdings: normalize(raw),
          source: "network",
          fetchedAt: Date.now(),
        };
      }
    } catch (err) {
      if (cached) {
        return {
          holdings: normalize(cached.raw),
          source: "stale-cache",
          fetchedAt: Date.now() - cached.age,
        };
      }
      throw err;
    }
  } else {
    const raw = await fetchAndCache(null);
    if (raw) {
      return {
        holdings: normalize(raw),
        source: "network",
        fetchedAt: Date.now(),
      };
    }
  }

  throw new Error("Failed to load holdings: No data available.");
}