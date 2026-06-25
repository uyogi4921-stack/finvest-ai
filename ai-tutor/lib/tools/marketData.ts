/**
 * market_data(ticker) — current price + basic fundamentals from Yahoo Finance
 * (no API key; server-side fetch avoids CORS). Short-TTL in-memory cache.
 *
 * Honesty contract: we only return what the source actually provides. PE and
 * market cap come from Yahoo's auth-walled quoteSummary, so they are often
 * `null` here — the model must then say it doesn't have them rather than invent.
 */

export interface MarketQuote {
  ok: boolean;
  ticker: string;
  resolvedSymbol?: string;
  price?: number;
  currency?: string;
  changePct?: number;
  change?: number;
  prevClose?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  pe?: number | null;
  marketCap?: number | null;
  source?: string;
  asOf?: string;
  error?: string;
}

type FetchLike = typeof fetch;

const CACHE = new Map<string, { t: number; data: MarketQuote }>();
const TTL_MS = 30_000;
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

// Disable switch for tests / outages → forces the "unavailable" path.
function disabled(): boolean {
  return process.env.MARKET_DATA_DISABLED === "1";
}

async function fetchYahooChart(symbol: string, doFetch: FetchLike): Promise<MarketQuote | null> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?interval=1d&range=1d";
  const r = await doFetch(url, { headers: UA });
  if (!r.ok) return null;
  const j: any = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  return {
    ok: true,
    ticker: symbol,
    resolvedSymbol: meta.symbol ?? symbol,
    price,
    currency: meta.currency,
    prevClose: prev,
    change: +(price - prev).toFixed(4),
    changePct: prev ? +(((price - prev) / prev) * 100).toFixed(2) : undefined,
    dayHigh: meta.regularMarketDayHigh,
    dayLow: meta.regularMarketDayLow,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    pe: null,
    marketCap: null,
    source: "yahoo",
    asOf: new Date().toISOString(),
  };
}

/** Candidate symbols to try, in order (raw, then NSE, then BSE). */
function candidates(ticker: string): string[] {
  const t = ticker.trim().toUpperCase();
  if (t.includes(".") || t.startsWith("^")) return [t];
  return [t, `${t}.NS`, `${t}.BO`];
}

export async function marketData(
  ticker: string,
  deps: { fetch?: FetchLike } = {},
): Promise<MarketQuote> {
  const doFetch = deps.fetch ?? fetch;
  const key = ticker.trim().toUpperCase();
  if (!key) return { ok: false, ticker, error: "ticker required" };
  if (disabled()) return { ok: false, ticker: key, error: "market data unavailable" };

  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.data;

  try {
    for (const sym of candidates(key)) {
      const q = await fetchYahooChart(sym, doFetch);
      if (q) {
        const data = { ...q, ticker: key };
        CACHE.set(key, { t: Date.now(), data });
        return data;
      }
    }
    return { ok: false, ticker: key, error: "no data found for ticker" };
  } catch (e) {
    return { ok: false, ticker: key, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export function _clearMarketCache() {
  CACHE.clear();
}
