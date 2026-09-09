import type {
  CalendarEvent,
  CalendarImportance,
  CalendarSummaryPayload,
  DailySummaryPayload,
  HotStockItem,
  MoverItem,
  NewsItem,
  SummaryHighlight,
  SummaryIndexRow,
  WeeklySummaryPayload,
} from "./types";
import { fetchQuotes } from "./data";
import { SECTOR_ETFS } from "./sectors";
import { loadMovers } from "./movers";
import { loadNews } from "./news";
import { buildHotStocks } from "./hotStocks";

const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60_000;

const INDEX_META: { symbol: string; name: string; nameZh: string }[] = [
  { symbol: "SPY", name: "S&P 500", nameZh: "標普500" },
  { symbol: "QQQ", name: "Nasdaq 100", nameZh: "那斯達克100" },
  { symbol: "DIA", name: "Dow Jones", nameZh: "道瓊斯" },
  { symbol: "IWM", name: "Russell 2000", nameZh: "羅素2000" },
];

type CacheEntry<T> = { at: number; payload: T };
let dailyCache: CacheEntry<DailySummaryPayload> | null = null;
let weeklyCache: CacheEntry<WeeklySummaryPayload> | null = null;
let calendarCache: CacheEntry<CalendarSummaryPayload> | null = null;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatHktDate(d = new Date()): string {
  return d.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function weekRangeLabel(): string {
  const now = new Date();
  // Approximate Mon–Fri of current US week in HKT framing
  const hkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const day = hkt.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(hkt);
  mon.setDate(hkt.getDate() + mondayOffset);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "short", day: "numeric" });
  return `${fmt(mon)} – ${fmt(fri)}（本週）`;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Yahoo chart history: returns closes + last price/change for range. */
async function fetchHistoryChange(
  symbol: string,
  range: "5d" | "1mo" = "5d"
): Promise<{ price: number; changePct: number; weekChangePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=${range}`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
    if (!meta?.regularMarketPrice || valid.length < 2) return null;
    const price = meta.regularMarketPrice as number;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const weekChangePct = first ? ((last - first) / first) * 100 : changePct;
    return { price, changePct, weekChangePct };
  } catch {
    return null;
  }
}

function demoIndices(dayBias = 0): SummaryIndexRow[] {
  const seeds = [0.35, 0.55, 0.15, -0.25];
  return INDEX_META.map((m, i) => ({
    ...m,
    changePct: round2(seeds[i] + dayBias * 0.1 + (i % 2 === 0 ? 0.12 : -0.08)),
    price: undefined,
  }));
}

function demoSectors(): { leaders: SummaryIndexRow[]; laggards: SummaryIndexRow[] } {
  const rows: SummaryIndexRow[] = SECTOR_ETFS.slice(0, 8).map((s, i) => ({
    symbol: s.symbol,
    name: s.name,
    nameZh: s.nameZh,
    changePct: round2(1.8 - i * 0.45 + (i % 3 === 0 ? 0.3 : -0.2)),
  }));
  const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
  return { leaders: sorted.slice(0, 3), laggards: sorted.slice(-3).reverse() };
}

function buildSectorRows(
  quoteMap: Record<string, { price: number; changePct: number }>
): SummaryIndexRow[] {
  return SECTOR_ETFS.map((s) => {
    const q = quoteMap[s.symbol];
    return {
      symbol: s.symbol,
      name: s.name,
      nameZh: s.nameZh,
      changePct: round2(q?.changePct ?? 0),
      price: q?.price,
    };
  }).filter((r) => Number.isFinite(r.changePct));
}

function pickLeadersLaggards(rows: SummaryIndexRow[], n = 3) {
  const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
  return {
    leaders: sorted.slice(0, n),
    laggards: sorted.slice(-n).reverse(),
  };
}

function dailyHighlights(
  indices: SummaryIndexRow[],
  leaders: SummaryIndexRow[],
  laggards: SummaryIndexRow[],
  newsTitles: string[]
): SummaryHighlight[] {
  const out: SummaryHighlight[] = [];
  const spy = indices.find((i) => i.symbol === "SPY");
  const qqq = indices.find((i) => i.symbol === "QQQ");
  if (spy) {
    out.push({
      text:
        spy.changePct >= 0
          ? `標普500（SPY）盤後約 ${spy.changePct >= 0 ? "+" : ""}${spy.changePct.toFixed(2)}%，大盤偏強`
          : `標普500（SPY）盤後約 ${spy.changePct.toFixed(2)}%，大盤承壓`,
      kind: spy.changePct >= 0 ? "up" : "down",
    });
  }
  if (qqq && spy && Math.abs(qqq.changePct - spy.changePct) >= 0.15) {
    out.push({
      text:
        qqq.changePct > spy.changePct
          ? `科技／那指（QQQ）相對強於大盤`
          : `科技／那指（QQQ）相對落後大盤`,
      kind: qqq.changePct >= spy.changePct ? "up" : "down",
    });
  }
  if (leaders[0]) {
    out.push({
      text: `產業領先：${leaders[0].nameZh || leaders[0].name}（${leaders[0].symbol}）${leaders[0].changePct >= 0 ? "+" : ""}${leaders[0].changePct.toFixed(2)}%`,
      kind: "up",
    });
  }
  if (laggards[0]) {
    out.push({
      text: `產業落後：${laggards[0].nameZh || laggards[0].name}（${laggards[0].symbol}）${laggards[0].changePct >= 0 ? "+" : ""}${laggards[0].changePct.toFixed(2)}%`,
      kind: "down",
    });
  }
  for (const t of newsTitles.slice(0, 2)) {
    out.push({ text: t, kind: "news" });
  }
  if (out.length === 0) {
    out.push({ text: "今日盤後重點整理中 — 請稍後重新整理", kind: "neutral" });
  }
  return out.slice(0, 6);
}

export async function loadDailySummary(force = false): Promise<DailySummaryPayload> {
  if (!force && dailyCache && Date.now() - dailyCache.at < CACHE_TTL_MS) {
    return dailyCache.payload;
  }

  let error = false;
  let message: string | undefined;
  let source = "yahoo+movers+rss";

  const indexSymbols = INDEX_META.map((m) => m.symbol);
  const sectorSymbols = SECTOR_ETFS.map((s) => s.symbol);

  let indices: SummaryIndexRow[] = [];
  let sectorRows: SummaryIndexRow[] = [];

  try {
    const quotes = await fetchQuotes([...indexSymbols, ...sectorSymbols]);
    if (Object.keys(quotes).length >= 3) {
      indices = INDEX_META.map((m) => {
        const q = quotes[m.symbol];
        return {
          ...m,
          changePct: round2(q?.changePct ?? 0),
          price: q?.price,
        };
      }).filter((r) => quotes[r.symbol]);
      sectorRows = buildSectorRows(quotes).filter((r) => quotes[r.symbol]);
    }
  } catch {
    /* fall through */
  }

  if (indices.length < 2) {
    indices = demoIndices();
    const demo = demoSectors();
    sectorRows = [...demo.leaders, ...demo.laggards];
    source = "demo";
    error = true;
    message = "行情來源暫時無法取得 — 顯示示範盤後總結";
  }

  const { leaders, laggards } = pickLeadersLaggards(
    sectorRows.length ? sectorRows : demoSectors().leaders.concat(demoSectors().laggards)
  );

  let topGainers: DailySummaryPayload["topGainers"] = [];
  let topLosers: DailySummaryPayload["topLosers"] = [];
  let moverGainers: MoverItem[] = [];
  let moverLosers: MoverItem[] = [];
  try {
    const movers = await loadMovers(force);
    moverGainers = movers.gainers;
    moverLosers = movers.losers;
    topGainers = movers.gainers.slice(0, 5).map((m) => ({
      symbol: m.symbol,
      name: m.name,
      changePct: m.changePct,
    }));
    topLosers = movers.losers.slice(0, 5).map((m) => ({
      symbol: m.symbol,
      name: m.name,
      changePct: m.changePct,
    }));
    if (movers.error && !error) {
      error = true;
      message = movers.message || "部分漲跌榜來源降級";
    }
  } catch {
    /* optional */
  }

  let newsTitles: string[] = [];
  let newsItems: NewsItem[] = [];
  try {
    const news = await loadNews(false);
    newsItems = news.items;
    newsTitles = news.items.slice(0, 4).map((i) => i.title);
  } catch {
    /* optional */
  }

  // Hot / standout stocks with grounded reasons — soft-fail never breaks wrap
  let hotStocks: HotStockItem[] = [];
  try {
    hotStocks = await buildHotStocks({
      gainers: moverGainers,
      losers: moverLosers,
      newsItems,
    });
  } catch {
    hotStocks = [];
  }

  const payload: DailySummaryPayload = {
    asOf: new Date().toISOString(),
    source,
    sessionLabel: `美股盤後總結 · ${formatHktDate()}`,
    indices,
    sectorLeaders: leaders,
    sectorLaggards: laggards,
    topGainers,
    topLosers,
    hotStocks,
    highlights: dailyHighlights(indices, leaders, laggards, newsTitles),
    error: error || undefined,
    message,
  };

  dailyCache = { at: Date.now(), payload };
  return payload;
}

export async function loadWeeklySummary(force = false): Promise<WeeklySummaryPayload> {
  if (!force && weeklyCache && Date.now() - weeklyCache.at < CACHE_TTL_MS) {
    return weeklyCache.payload;
  }

  let error = false;
  let message: string | undefined;
  let source = "yahoo-5d+rss";

  const symbols = [...INDEX_META.map((m) => m.symbol), ...SECTOR_ETFS.map((s) => s.symbol)];
  const hist = await Promise.all(
    symbols.map(async (symbol) => {
      const h = await fetchHistoryChange(symbol, "5d");
      return [symbol, h] as const;
    })
  );
  const histMap = Object.fromEntries(hist.filter(([, h]) => h != null)) as Record<
    string,
    { price: number; changePct: number; weekChangePct: number }
  >;

  let indices: SummaryIndexRow[] = INDEX_META.map((m) => {
    const h = histMap[m.symbol];
    return {
      ...m,
      changePct: round2(h?.weekChangePct ?? 0),
      price: h?.price,
    };
  }).filter((r) => histMap[r.symbol]);

  let sectorRows: SummaryIndexRow[] = SECTOR_ETFS.map((s) => {
    const h = histMap[s.symbol];
    return {
      symbol: s.symbol,
      name: s.name,
      nameZh: s.nameZh,
      changePct: round2(h?.weekChangePct ?? 0),
      price: h?.price,
    };
  }).filter((r) => histMap[r.symbol]);

  if (indices.length < 2) {
    indices = demoIndices(0.4).map((r) => ({ ...r, changePct: round2(r.changePct * 2.2) }));
    const demo = demoSectors();
    sectorRows = [...demo.leaders, ...demo.laggards].map((r) => ({
      ...r,
      changePct: round2(r.changePct * 2),
    }));
    source = "demo";
    error = true;
    message = "週線行情暫時無法取得 — 顯示示範每周總結";
  }

  const { leaders, laggards } = pickLeadersLaggards(sectorRows, 4);

  let themes: WeeklySummaryPayload["themes"] = [];
  try {
    const news = await loadNews(false);
    themes = news.items.slice(0, 8).map((i) => ({
      title: i.title,
      source: i.source,
      url: i.url,
    }));
  } catch {
    /* optional */
  }

  if (themes.length === 0) {
    themes = [
      { title: "[Demo] Fed / rates narrative in focus this week", source: "Demo" },
      { title: "[Demo] Tech earnings & AI capex remains a market theme", source: "Demo" },
      { title: "[Demo] Macro data calendar: inflation & labor prints", source: "Demo" },
    ];
    if (!error) {
      error = true;
      message = "新聞來源暫時無法取得 — 主題為示範內容";
    }
  }

  const highlights: SummaryHighlight[] = [];
  const spy = indices.find((i) => i.symbol === "SPY");
  if (spy) {
    highlights.push({
      text: `本週 SPY 約 ${spy.changePct >= 0 ? "+" : ""}${spy.changePct.toFixed(2)}%（近 5 個交易日）`,
      kind: spy.changePct >= 0 ? "up" : "down",
    });
  }
  if (leaders[0]) {
    highlights.push({
      text: `本週產業最強：${leaders[0].nameZh || leaders[0].name}（${leaders[0].symbol}）`,
      kind: "up",
    });
  }
  if (laggards[0]) {
    highlights.push({
      text: `本週產業最弱：${laggards[0].nameZh || laggards[0].name}（${laggards[0].symbol}）`,
      kind: "down",
    });
  }
  if (themes[0]) {
    highlights.push({ text: `新聞主題：${themes[0].title}`, kind: "news" });
  }

  const payload: WeeklySummaryPayload = {
    asOf: new Date().toISOString(),
    source,
    weekLabel: weekRangeLabel(),
    indices,
    sectorLeaders: leaders,
    sectorLaggards: laggards,
    themes,
    highlights: highlights.slice(0, 6),
    error: error || undefined,
    message,
  };

  weeklyCache = { at: Date.now(), payload };
  return payload;
}

function mapImpact(raw: string): CalendarImportance {
  const s = (raw || "").toLowerCase();
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

function toHktTimeLabel(isoLike: string): { timeHkt: string; atIso: string; dateKey: string } {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) {
    return { timeHkt: "—", atIso: new Date().toISOString(), dateKey: "unknown" };
  }
  const timeHkt = d.toLocaleTimeString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateKey = d.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" }); // YYYY-MM-DD
  return { timeHkt, atIso: d.toISOString(), dateKey };
}

function formatDateZh(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Curated expected US catalysts (fallback / hybrid filler). */
function curatedExpectedEvents(): CalendarEvent[] {
  const now = new Date();
  // Build next 7 calendar days placeholders framed as "expected"
  const out: CalendarEvent[] = [];
  const templates: { dow: number; name: string; nameZh: string; importance: CalendarImportance; hourHkt: number }[] = [
    { dow: 3, name: "ADP / mid-week labor proxies (expected)", nameZh: "ADP／週中就業相關數據（預期）", importance: "medium", hourHkt: 20 },
    { dow: 4, name: "Initial Jobless Claims (typical Thu)", nameZh: "初次申請失業救濟（通常週四）", importance: "medium", hourHkt: 20 },
    { dow: 5, name: "US CPI / inflation print window (watch)", nameZh: "美國 CPI／通膨數據窗口（關注）", importance: "high", hourHkt: 20 },
    { dow: 5, name: "FOMC / Fed speakers (if scheduled)", nameZh: "FOMC／聯準會官員談話（若有排程）", importance: "high", hourHkt: 2 },
  ];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const hktStr = d.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" });
    const hkt = new Date(hktStr);
    const dow = hkt.getDay();
    for (const t of templates) {
      if (t.dow !== dow) continue;
      const at = new Date(hkt);
      at.setHours(t.hourHkt, 30, 0, 0);
      const { timeHkt, atIso, dateKey } = toHktTimeLabel(at.toISOString());
      out.push({
        id: `curated-${dateKey}-${t.name}`,
        date: formatDateZh(atIso),
        timeHkt,
        atIso,
        name: t.name,
        nameZh: t.nameZh,
        country: "USD",
        importance: t.importance,
      });
    }
  }
  return out;
}

type FfRow = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
};

async function fetchFfCalendar(): Promise<CalendarEvent[]> {
  const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as FfRow[];
  if (!Array.isArray(rows)) return [];

  const now = Date.now() - 60 * 60_000; // include last hour
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    const country = (row.country || "").toUpperCase();
    if (!["USD", "USA", "US"].includes(country)) continue;
    if (!row.title || !row.date) continue;
    const importance = mapImpact(row.impact || "Low");
    // Prefer high/medium; keep a few lows if sparse
    const { timeHkt, atIso, dateKey } = toHktTimeLabel(row.date);
    const t = new Date(atIso).getTime();
    if (Number.isNaN(t) || t < now) continue;
    // Skip bank holidays titled only "Bank Holiday" noise unless Holiday impact
    events.push({
      id: `ff-${dateKey}-${row.title}-${timeHkt}`,
      date: formatDateZh(atIso),
      timeHkt: row.impact === "Holiday" ? "全天" : timeHkt,
      atIso,
      name: row.title,
      country: "USD",
      importance,
      forecast: row.forecast || undefined,
      previous: row.previous || undefined,
    });
  }

  // Sort by time; prefer high/medium first in display by filtering later
  events.sort((a, b) => +new Date(a.atIso || 0) - +new Date(b.atIso || 0));
  return events;
}

export async function loadCalendarSummary(force = false): Promise<CalendarSummaryPayload> {
  if (!force && calendarCache && Date.now() - calendarCache.at < CACHE_TTL_MS) {
    return calendarCache.payload;
  }

  let error = false;
  let message: string | undefined;
  let source = "forexfactory-week+curated";
  let events: CalendarEvent[] = [];

  try {
    events = await fetchFfCalendar();
  } catch {
    events = [];
  }

  if (events.length === 0) {
    events = curatedExpectedEvents();
    source = "curated-expected";
    error = true;
    message = "公開經濟日曆暫時無法取得 — 顯示預期大事（示意）";
  } else {
    // Hybrid: if few high/medium, keep lows; also merge curated high if missing themes
    const hiMed = events.filter((e) => e.importance === "high" || e.importance === "medium");
    const display = (hiMed.length >= 3 ? hiMed : events).slice(0, 40);
    events = display;
  }

  // Deduplicate by name+date
  const seen = new Set<string>();
  events = events.filter((e) => {
    const key = `${e.date}|${e.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const payload: CalendarSummaryPayload = {
    asOf: new Date().toISOString(),
    source,
    rangeLabel: `未來數日／本週剩餘 · ${formatHktDate()} 起（時間標示 HKT）`,
    events,
    error: error || undefined,
    message,
  };

  calendarCache = { at: Date.now(), payload };
  return payload;
}
