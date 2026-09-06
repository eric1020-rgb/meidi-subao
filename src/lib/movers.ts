import type { MoverItem, MoversPayload } from "./types";
import { fetchQuotes } from "./data";
import { MEGA_CAPS, SECTOR_ETFS } from "./sectors";
import { attachSector, resolveSectors } from "./stockSectors";

const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 45_000;
const LIST_SIZE = 10;

/** Liquid US names for ranking fallback when Yahoo screener is unreachable. */
const LIQUID_UNIVERSE: { symbol: string; name: string }[] = [
  ...MEGA_CAPS.map((m) => ({ symbol: m.symbol, name: m.name })),
  ...SECTOR_ETFS.map((s) => ({ symbol: s.leadTicker, name: s.leadName })),
  { symbol: "BRK-B", name: "Berkshire Hathaway" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "MRK", name: "Merck" },
  { symbol: "ABBV", name: "AbbVie" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "COST", name: "Costco" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "TXN", name: "Texas Instruments" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "CSCO", name: "Cisco" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "WFC", name: "Wells Fargo" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "C", name: "Citigroup" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "HON", name: "Honeywell" },
  { symbol: "UPS", name: "UPS" },
  { symbol: "RTX", name: "RTX" },
  { symbol: "LMT", name: "Lockheed Martin" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "CMCSA", name: "Comcast" },
  { symbol: "T", name: "AT&T" },
  { symbol: "VZ", name: "Verizon" },
  { symbol: "NEE", name: "NextEra Energy" },
  { symbol: "DUK", name: "Duke Energy" },
  { symbol: "SO", name: "Southern Co" },
  { symbol: "PLD", name: "Prologis" },
  { symbol: "AMT", name: "American Tower" },
  { symbol: "SPGI", name: "S&P Global" },
  { symbol: "BLK", name: "BlackRock" },
  { symbol: "SCHW", name: "Charles Schwab" },
  { symbol: "PYPL", name: "PayPal" },
  { symbol: "SQ", name: "Block" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "ABNB", name: "Airbnb" },
  { symbol: "SHOP", name: "Shopify" },
  { symbol: "SNOW", name: "Snowflake" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "MSTR", name: "MicroStrategy" },
  { symbol: "SMCI", name: "Super Micro" },
  { symbol: "ARM", name: "Arm Holdings" },
  { symbol: "MU", name: "Micron" },
  { symbol: "AMAT", name: "Applied Materials" },
  { symbol: "LRCX", name: "Lam Research" },
  { symbol: "KLAC", name: "KLA" },
  { symbol: "NOW", name: "ServiceNow" },
  { symbol: "PANW", name: "Palo Alto Networks" },
  { symbol: "CRWD", name: "CrowdStrike" },
  { symbol: "SPOT", name: "Spotify" },
  { symbol: "RIVN", name: "Rivian" },
  { symbol: "NIO", name: "NIO" },
  { symbol: "BABA", name: "Alibaba" },
  { symbol: "PDD", name: "PDD Holdings" },
  { symbol: "JD", name: "JD.com" },
  { symbol: "GME", name: "GameStop" },
  { symbol: "AMC", name: "AMC Entertainment" },
];

type CacheEntry = { at: number; payload: MoversPayload };
let memoryCache: CacheEntry | null = null;

function dedupeBySymbol(items: { symbol: string; name: string }[]): { symbol: string; name: string }[] {
  const seen = new Set<string>();
  const out: { symbol: string; name: string }[] = [];
  for (const it of items) {
    const sym = it.symbol.toUpperCase();
    if (seen.has(sym)) continue;
    seen.add(sym);
    out.push({ symbol: sym, name: it.name });
  }
  return out;
}

function mapQuote(q: Record<string, unknown>): MoverItem | null {
  const symbol = typeof q.symbol === "string" ? q.symbol : null;
  if (!symbol) return null;
  const price =
    typeof q.regularMarketPrice === "number"
      ? q.regularMarketPrice
      : typeof q.intradayprice === "number"
        ? q.intradayprice
        : null;
  const changePct =
    typeof q.regularMarketChangePercent === "number"
      ? q.regularMarketChangePercent
      : typeof q.percentchange === "number"
        ? q.percentchange
        : null;
  if (price == null || changePct == null) return null;
  const name =
    (typeof q.displayName === "string" && q.displayName) ||
    (typeof q.shortName === "string" && q.shortName) ||
    (typeof q.longName === "string" && q.longName) ||
    (typeof q.companyshortname === "string" && q.companyshortname) ||
    symbol;
  const volume =
    typeof q.regularMarketVolume === "number"
      ? q.regularMarketVolume
      : typeof q.dayvolume === "number"
        ? q.dayvolume
        : undefined;
  const sectorRaw =
    (typeof q.sectorDisp === "string" && q.sectorDisp) ||
    (typeof q.sector === "string" && q.sector) ||
    undefined;
  return {
    symbol,
    name: String(name).replace(/\s+/g, " ").trim(),
    price: Math.round(price * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    volume,
    ...(sectorRaw ? { sector: sectorRaw } : {}),
  };
}

async function fetchScreener(scrId: "day_gainers" | "day_losers", count: number): Promise<MoverItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved` +
      `?formatted=false&lang=en-US&region=US&scrIds=${scrId}&count=${count}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const quotes: Record<string, unknown>[] = json?.finance?.result?.[0]?.quotes ?? [];
    const items: MoverItem[] = [];
    for (const q of quotes) {
      const item = mapQuote(q);
      if (item) items.push(item);
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function demoMovers(): { gainers: MoverItem[]; losers: MoverItem[] } {
  const rand = (i: number) => {
    const x = Math.sin(i * 12.9898 + Date.now() / 8.64e7) * 43758.5453;
    return x - Math.floor(x);
  };
  const names = dedupeBySymbol(LIQUID_UNIVERSE).slice(0, 24);
  const gainers: MoverItem[] = [];
  const losers: MoverItem[] = [];
  for (let i = 0; i < LIST_SIZE; i++) {
    const g = names[i % names.length];
    const l = names[(i + 12) % names.length];
    gainers.push({
      symbol: g.symbol,
      name: g.name,
      price: Math.round((50 + rand(i) * 400) * 100) / 100,
      changePct: Math.round((3 + rand(i + 1) * 9) * 100) / 100,
      volume: Math.round(1e6 + rand(i + 2) * 2e7),
    });
    losers.push({
      symbol: l.symbol,
      name: l.name,
      price: Math.round((40 + rand(i + 3) * 350) * 100) / 100,
      changePct: Math.round((-3 - rand(i + 4) * 9) * 100) / 100,
      volume: Math.round(8e5 + rand(i + 5) * 1.5e7),
    });
  }
  return { gainers, losers };
}

async function loadFromUniverse(): Promise<{ gainers: MoverItem[]; losers: MoverItem[] } | null> {
  const universe = dedupeBySymbol(LIQUID_UNIVERSE);
  const nameMap = Object.fromEntries(universe.map((u) => [u.symbol, u.name]));
  // Cap concurrent Yahoo chart calls — take a liquid subset
  const symbols = universe.slice(0, 80).map((u) => u.symbol);
  const quotes = await fetchQuotes(symbols);
  const items: MoverItem[] = Object.entries(quotes).map(([symbol, q]) => ({
    symbol,
    name: nameMap[symbol] || symbol,
    price: Math.round(q.price * 100) / 100,
    changePct: Math.round(q.changePct * 100) / 100,
    volume: q.volume,
  }));
  if (items.length < 10) return null;
  const sortedAsc = [...items].sort((a, b) => a.changePct - b.changePct);
  const sortedDesc = [...items].sort((a, b) => b.changePct - a.changePct);
  return {
    gainers: sortedDesc.slice(0, LIST_SIZE),
    losers: sortedAsc.slice(0, LIST_SIZE),
  };
}

export async function loadMovers(force = false): Promise<MoversPayload> {
  if (!force && memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.payload;
  }

  let gainers = await fetchScreener("day_gainers", LIST_SIZE);
  let losers = await fetchScreener("day_losers", LIST_SIZE);
  let source = "yahoo-screener";
  let error = false;
  let message: string | undefined;

  if (gainers.length < 3 || losers.length < 3) {
    const fallback = await loadFromUniverse();
    if (fallback) {
      if (gainers.length < 3) gainers = fallback.gainers;
      if (losers.length < 3) losers = fallback.losers;
      source = "yahoo-quotes-universe";
      if (gainers.length < LIST_SIZE || losers.length < LIST_SIZE) {
        error = true;
        message = "Screener partial — ranked liquid universe quotes";
      }
    }
  }

  if (gainers.length === 0 && losers.length === 0) {
    const demo = demoMovers();
    gainers = demo.gainers;
    losers = demo.losers;
    source = "demo";
    error = true;
    message = "Upstream quotes unreachable — showing demo stubs";
  }

  gainers = gainers.slice(0, LIST_SIZE);
  losers = losers.slice(0, LIST_SIZE);

  // Attach sector (local map + Yahoo assetProfile for unknowns)
  try {
    const symbols = Array.from(new Set([...gainers, ...losers].map((m) => m.symbol)));
    const sectorMap = await resolveSectors(symbols, { fetchRemote: true });
    gainers = gainers.map((m) => attachSector(m, sectorMap));
    losers = losers.map((m) => attachSector(m, sectorMap));
  } catch {
    const empty = {};
    gainers = gainers.map((m) => attachSector(m, empty));
    losers = losers.map((m) => attachSector(m, empty));
  }

  const payload: MoversPayload = {
    gainers,
    losers,
    asOf: new Date().toISOString(),
    source,
    error: error || undefined,
    message,
  };

  memoryCache = { at: Date.now(), payload };
  return payload;
}
