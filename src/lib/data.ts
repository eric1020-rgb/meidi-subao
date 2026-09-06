import { SECTOR_ETFS, MEGA_CAPS, classifyTide } from "./sectors";
import type { MarketPayload, SectorPoint, StockHighlight } from "./types";

/** Deterministic PRNG so demo data is stable within a day */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daySeed(extra = 0): number {
  const d = new Date();
  const key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return key + extra * 9973;
}

/**
 * Build synthetic sector-flow metrics.
 * Methodology (documented in README):
 * - flow5d ≈ short-window momentum × volume proxy × sector bias
 * - acceleration ≈ today momentum − prior-window momentum
 * - magnitude20d ≈ abs(cumulative momentum) scaled for bubble size
 * When live quotes are available, changePct seeds the momentum; otherwise
 * we use a seeded pseudo-random walk so the chart is never empty.
 */
export function synthesizeMarket(
  quoteMap?: Record<string, { price: number; changePct: number; volume?: number }>
): MarketPayload {
  const rand = mulberry32(daySeed(1));
  const source: MarketPayload["source"] = quoteMap && Object.keys(quoteMap).length > 0
    ? "live-quotes+synthetic-flow"
    : "demo";

  const sectors: SectorPoint[] = SECTOR_ETFS.map((meta, i) => {
    const q = quoteMap?.[meta.symbol];
    const r1 = rand() * 2 - 1;
    const r2 = rand() * 2 - 1;
    const r3 = rand();

    const changePct = q?.changePct ?? (meta.bias * 1.2 + r1 * 1.8);
    const volFactor = q?.volume ? Math.log10(Math.max(q.volume, 1e5)) / 7 : 0.8 + r3 * 0.4;

    // 5d flow proxy in "relative $B" units
    const flow5d = (changePct * 3.5 + meta.bias * 8 + r2 * 6) * volFactor;
    // Acceleration: today impulse vs lagged
    const lagged = meta.bias * 4 + (rand() * 2 - 1) * 5;
    const acceleration = changePct * 2.2 + meta.bias * 3 - lagged * 0.55 + (rand() * 2 - 1) * 2;
    const magnitude20d = Math.max(4, Math.abs(flow5d) * (2.2 + rand()) + Math.abs(acceleration) * 1.5 + 8 + i);

    const advancing = Math.max(1, Math.min(28, Math.round(12 + changePct * 2.5 + meta.bias * 4 + rand() * 6)));
    const total = 20 + Math.round(rand() * 12);
    const instFlowM = flow5d * 120; // scale to $M-ish for display

    return {
      symbol: meta.symbol,
      name: meta.name,
      nameZh: meta.nameZh,
      flow5d: Math.round(flow5d * 10) / 10,
      acceleration: Math.round(acceleration * 10) / 10,
      magnitude20d: Math.round(magnitude20d * 10) / 10,
      changePct: Math.round(changePct * 100) / 100,
      advancing: Math.min(advancing, total),
      total,
      leadTicker: meta.leadTicker,
      leadName: meta.leadName,
      state: classifyTide(flow5d, acceleration),
      instFlowM: Math.round(instFlowM),
    };
  });

  const megaCaps: StockHighlight[] = MEGA_CAPS.map((m) => {
    const q = quoteMap?.[m.symbol];
    const changePct = q?.changePct ?? (rand() * 4 - 1.5);
    const flowProxyM = Math.round((changePct * 80 + (rand() * 2 - 0.5) * 40) * 10);
    return {
      symbol: m.symbol,
      name: m.name,
      changePct: Math.round(changePct * 100) / 100,
      flowProxyM,
      sector: m.sector,
    };
  }).sort((a, b) => b.flowProxyM - a.flowProxyM);

  const highlights = [...megaCaps]
    .sort((a, b) => Math.abs(b.flowProxyM) - Math.abs(a.flowProxyM))
    .slice(0, 8);

  const spxQ = quoteMap?.["SPY"];
  const spxChangePct = spxQ?.changePct ?? sectors.reduce((s, x) => s + x.changePct, 0) / sectors.length;

  return {
    asOf: new Date().toISOString(),
    source,
    sectors,
    highlights,
    megaCaps,
    spxChangePct: Math.round(spxChangePct * 100) / 100,
  };
}

/** Try Yahoo Finance chart API (no key). Fail soft → demo. */
export async function fetchQuotes(
  symbols: string[]
): Promise<Record<string, { price: number; changePct: number; volume?: number }>> {
  const map: Record<string, { price: number; changePct: number; volume?: number }> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          symbol
        )}?interval=1d&range=5d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 TideUS/1.0" },
          next: { revalidate: 300 },
        });
        if (!res.ok) return;
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        const meta = result?.meta;
        if (!meta?.regularMarketPrice) return;
        const prev = meta.chartPreviousClose ?? meta.previousClose;
        const price = meta.regularMarketPrice as number;
        const changePct = prev ? ((price - prev) / prev) * 100 : 0;
        const volumes: number[] = result?.indicators?.quote?.[0]?.volume ?? [];
        const volume = volumes.filter((v: number) => typeof v === "number").pop();
        map[symbol] = { price, changePct, volume };
      } catch {
        /* ignore single-symbol failures */
      }
    })
  );

  return map;
}

export async function loadMarketData(): Promise<MarketPayload> {
  const symbols = [
    ...SECTOR_ETFS.map((s) => s.symbol),
    ...MEGA_CAPS.map((m) => m.symbol),
    "SPY",
  ];

  try {
    const quotes = await fetchQuotes(symbols);
    if (Object.keys(quotes).length >= 3) {
      return synthesizeMarket(quotes);
    }
  } catch {
    /* fall through */
  }
  return synthesizeMarket();
}
