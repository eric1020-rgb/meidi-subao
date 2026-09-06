/**
 * Resolve GICS-style sector for equity tickers (movers).
 * Priority: local map → Yahoo quoteSummary assetProfile (crumb) → Unknown.
 * No paid API keys.
 */

export type SectorInfo = { sector: string; sectorZh?: string };

/** Yahoo / GICS sector display → Traditional Chinese */
const SECTOR_ZH: Record<string, string> = {
  Technology: "科技",
  "Financial Services": "金融",
  Financials: "金融",
  Healthcare: "醫療保健",
  "Health Care": "醫療保健",
  Energy: "能源",
  Industrials: "工業",
  "Consumer Cyclical": "非必需消費",
  "Consumer Discretionary": "非必需消費",
  "Consumer Defensive": "必需消費",
  "Consumer Staples": "必需消費",
  Utilities: "公用事業",
  "Real Estate": "房地產",
  "Basic Materials": "原物料",
  Materials: "原物料",
  "Communication Services": "通訊服務",
  Communication: "通訊服務",
};

/** Common liquid US names → Yahoo-style sector (English). */
const SYMBOL_SECTOR: Record<string, string> = {
  // Mega / tech
  AAPL: "Technology",
  MSFT: "Technology",
  NVDA: "Technology",
  AVGO: "Technology",
  AMD: "Technology",
  INTC: "Technology",
  QCOM: "Technology",
  TXN: "Technology",
  IBM: "Technology",
  CSCO: "Technology",
  ORCL: "Technology",
  ADBE: "Technology",
  CRM: "Technology",
  NOW: "Technology",
  PANW: "Technology",
  CRWD: "Technology",
  SNOW: "Technology",
  PLTR: "Technology",
  MU: "Technology",
  AMAT: "Technology",
  LRCX: "Technology",
  KLAC: "Technology",
  ARM: "Technology",
  SMCI: "Technology",
  // Communication
  META: "Communication Services",
  GOOGL: "Communication Services",
  GOOG: "Communication Services",
  NFLX: "Communication Services",
  DIS: "Communication Services",
  CMCSA: "Communication Services",
  T: "Communication Services",
  VZ: "Communication Services",
  SPOT: "Communication Services",
  // Consumer cyclical
  AMZN: "Consumer Cyclical",
  TSLA: "Consumer Cyclical",
  HD: "Consumer Cyclical",
  NKE: "Consumer Cyclical",
  SBUX: "Consumer Cyclical",
  MCD: "Consumer Cyclical",
  LOW: "Consumer Cyclical",
  TJX: "Consumer Cyclical",
  BKNG: "Consumer Cyclical",
  UBER: "Consumer Cyclical",
  ABNB: "Consumer Cyclical",
  RIVN: "Consumer Cyclical",
  NIO: "Consumer Cyclical",
  GME: "Consumer Cyclical",
  AMC: "Communication Services",
  // Consumer defensive
  WMT: "Consumer Defensive",
  PG: "Consumer Defensive",
  KO: "Consumer Defensive",
  PEP: "Consumer Defensive",
  COST: "Consumer Defensive",
  PM: "Consumer Defensive",
  MO: "Consumer Defensive",
  CL: "Consumer Defensive",
  // Financials
  JPM: "Financial Services",
  BAC: "Financial Services",
  WFC: "Financial Services",
  GS: "Financial Services",
  MS: "Financial Services",
  C: "Financial Services",
  "BRK-B": "Financial Services",
  BRK_B: "Financial Services",
  V: "Financial Services",
  MA: "Financial Services",
  AXP: "Financial Services",
  BLK: "Financial Services",
  SCHW: "Financial Services",
  SPGI: "Financial Services",
  PYPL: "Financial Services",
  SQ: "Financial Services",
  COIN: "Financial Services",
  MSTR: "Technology",
  // Healthcare
  UNH: "Healthcare",
  JNJ: "Healthcare",
  MRK: "Healthcare",
  ABBV: "Healthcare",
  LLY: "Healthcare",
  PFE: "Healthcare",
  TMO: "Healthcare",
  ABT: "Healthcare",
  DHR: "Healthcare",
  AMGN: "Healthcare",
  GILD: "Healthcare",
  VRTX: "Healthcare",
  ISRG: "Healthcare",
  // Energy
  XOM: "Energy",
  CVX: "Energy",
  COP: "Energy",
  SLB: "Energy",
  EOG: "Energy",
  OXY: "Energy",
  // Industrials
  CAT: "Industrials",
  BA: "Industrials",
  GE: "Industrials",
  HON: "Industrials",
  UPS: "Industrials",
  RTX: "Industrials",
  LMT: "Industrials",
  DE: "Industrials",
  UNP: "Industrials",
  // Utilities
  NEE: "Utilities",
  DUK: "Utilities",
  SO: "Utilities",
  D: "Utilities",
  AEP: "Utilities",
  // Real estate
  PLD: "Real Estate",
  AMT: "Real Estate",
  CCI: "Real Estate",
  EQIX: "Real Estate",
  SPG: "Real Estate",
  // Materials
  LIN: "Basic Materials",
  APD: "Basic Materials",
  SHW: "Basic Materials",
  FCX: "Basic Materials",
  NEM: "Basic Materials",
  // China / ADRs often Consumer Cyclical or Tech-ish
  BABA: "Consumer Cyclical",
  PDD: "Consumer Cyclical",
  JD: "Consumer Cyclical",
  BIDU: "Communication Services",
  SHOP: "Technology",
  // Sector ETFs — label by theme
  XLK: "Technology",
  XLF: "Financial Services",
  XLE: "Energy",
  XLV: "Healthcare",
  XLI: "Industrials",
  XLY: "Consumer Cyclical",
  XLP: "Consumer Defensive",
  XLU: "Utilities",
  XLRE: "Real Estate",
  XLB: "Basic Materials",
  XLC: "Communication Services",
  SMH: "Technology",
  XBI: "Healthcare",
  ARKK: "Technology",
  KWEB: "Communication Services",
  ITA: "Industrials",
  XRT: "Consumer Cyclical",
  GDX: "Basic Materials",
  TAN: "Technology",
  BOTZ: "Technology",
};

const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";
const FETCH_TIMEOUT_MS = 10_000;
const SECTOR_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type CacheEntry = { info: SectorInfo; at: number };
const sectorCache = new Map<string, CacheEntry>();

type CrumbState = { crumb: string; cookie: string; at: number } | null;
let crumbState: CrumbState = null;
const CRUMB_TTL_MS = 55 * 60 * 1000; // ~55 min

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\./g, "-");
}

export function sectorZhFor(sector: string): string | undefined {
  return SECTOR_ZH[sector] ?? SECTOR_ZH[sector.replace(/\.$/, "")];
}

export function lookupLocalSector(symbol: string): SectorInfo | null {
  const sym = normalizeSymbol(symbol);
  const sector = SYMBOL_SECTOR[sym] ?? SYMBOL_SECTOR[sym.replace(/-/g, "_")];
  if (!sector) return null;
  return { sector, sectorZh: sectorZhFor(sector) };
}

async function ensureCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbState && Date.now() - crumbState.at < CRUMB_TTL_MS) {
    return { crumb: crumbState.crumb, cookie: crumbState.cookie };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const fc = await fetch("https://fc.yahoo.com", {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      cache: "no-store",
    });
    const setCookies = typeof fc.headers.getSetCookie === "function"
      ? fc.headers.getSetCookie()
      : [];
    // Node fetch may expose set-cookie as single header
    const raw = setCookies.length
      ? setCookies
      : [fc.headers.get("set-cookie")].filter(Boolean) as string[];
    const cookie = raw
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      cache: "no-store",
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<") || crumb.length > 80) return null;
    crumbState = { crumb, cookie, at: Date.now() };
    return { crumb, cookie };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooSector(symbol: string): Promise<SectorInfo | null> {
  const auth = await ensureCrumb();
  if (!auth) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
      `?modules=assetProfile&crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(auth.cookie ? { Cookie: auth.cookie } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      // Crumb may have expired — bust and retry once
      if (res.status === 401 || res.status === 403) {
        crumbState = null;
      }
      return null;
    }
    const json = await res.json();
    const profile = json?.quoteSummary?.result?.[0]?.assetProfile;
    const sector =
      (typeof profile?.sectorDisp === "string" && profile.sectorDisp) ||
      (typeof profile?.sector === "string" && profile.sector) ||
      null;
    if (!sector) return null;
    return { sector, sectorZh: sectorZhFor(sector) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve sectors for many symbols. Local map first; Yahoo for misses.
 * Never throws — missing → Unknown.
 */
export async function resolveSectors(
  symbols: string[],
  opts?: { fetchRemote?: boolean }
): Promise<Record<string, SectorInfo>> {
  const fetchRemote = opts?.fetchRemote !== false;
  const out: Record<string, SectorInfo> = {};
  const needFetch: string[] = [];
  const now = Date.now();

  for (const raw of symbols) {
    const sym = normalizeSymbol(raw);
    if (!sym || out[sym]) continue;

    const cached = sectorCache.get(sym);
    if (cached && now - cached.at < SECTOR_CACHE_TTL_MS) {
      out[sym] = cached.info;
      continue;
    }

    const local = lookupLocalSector(sym);
    if (local) {
      sectorCache.set(sym, { info: local, at: now });
      out[sym] = local;
      continue;
    }

    needFetch.push(sym);
  }

  if (fetchRemote && needFetch.length > 0) {
    // Concurrency-limited Yahoo fetches
    const CONCURRENCY = 4;
    for (let i = 0; i < needFetch.length; i += CONCURRENCY) {
      const batch = needFetch.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (sym) => {
          const info = await fetchYahooSector(sym);
          if (info) {
            sectorCache.set(sym, { info, at: Date.now() });
            out[sym] = info;
          } else {
            const fallback: SectorInfo = { sector: "Unknown", sectorZh: "未知" };
            // short TTL for unknowns so we retry later
            sectorCache.set(sym, { info: fallback, at: Date.now() - SECTOR_CACHE_TTL_MS + 15 * 60_000 });
            out[sym] = fallback;
          }
        })
      );
    }
  } else {
    for (const sym of needFetch) {
      out[sym] = { sector: "Unknown", sectorZh: "未知" };
    }
  }

  return out;
}

export function attachSector<T extends { symbol: string; sector?: string; sectorZh?: string }>(
  item: T,
  map: Record<string, SectorInfo>
): T & SectorInfo {
  const sym = normalizeSymbol(item.symbol);
  // Prefer sector already on the item (e.g. screener field)
  if (item.sector && item.sector !== "Unknown") {
    const sectorZh = item.sectorZh ?? sectorZhFor(item.sector);
    const info = { sector: item.sector, sectorZh };
    sectorCache.set(sym, { info, at: Date.now() });
    return { ...item, ...info };
  }
  const info = map[sym] ?? lookupLocalSector(sym) ?? { sector: "Unknown", sectorZh: "未知" };
  return { ...item, sector: info.sector, sectorZh: info.sectorZh };
}
