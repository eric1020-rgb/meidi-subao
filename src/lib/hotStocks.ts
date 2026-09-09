/**
 * Build standout / hot stocks for daily wrap:
 * pick notable movers, match same-day RSS / Yahoo search headlines,
 * machine-translate reasons to zh-Hant. Never throws — callers get [].
 */

import type { HotStockItem, MoverItem, NewsItem } from "./types";
import { translateTitlesToZhHant } from "./translate";

const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";
const YAHOO_TIMEOUT_MS = 4_000;
const OVERALL_BUDGET_MS = 14_000;
const MAX_HOT = 8;

const CORP_SUFFIXES =
  /\b(inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|holdings?|group|plc|nv|sa|ag|llc|lp|class\s+[a-z])\b/gi;

type NewsHit = { title: string; titleZh?: string; url: string; source: string };

function stripCompanyNoise(name: string): string {
  return name
    .replace(CORP_SUFFIXES, " ")
    .replace(/[.,]/g, " ")
    .replace(new RegExp(String.fromCharCode(39), "g"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Significant name tokens for matching (skip very short / generic). */
function nameTokens(name: string): string[] {
  const cleaned = stripCompanyNoise(name);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length < 3) continue;
    if (/^(the|and|of|for|new)$/i.test(p)) continue;
    out.push(p.toLowerCase());
  }
  // Prefer longer multi-word phrase if available
  if (cleaned.length >= 4) out.unshift(cleaned.toLowerCase());
  return Array.from(new Set(out));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleMatchesMover(title: string, symbol: string, name: string): boolean {
  const t = title.toLowerCase();
  const sym = symbol.toUpperCase();
  // $TICKER or (TICKER) always counts
  if (new RegExp(`\\$${escapeRegExp(sym)}\\b`, "i").test(title)) return true;
  if (new RegExp(`\\(${escapeRegExp(sym)}\\)`, "i").test(title)) return true;

  // Whole-word ticker — only for length >= 3 to avoid T/C/V false positives
  if (sym.length >= 3) {
    if (new RegExp(`\\b${escapeRegExp(sym)}\\b`, "i").test(title)) return true;
  }

  const tokens = nameTokens(name);
  for (const tok of tokens) {
    if (tok.length < 4 && !tok.includes(" ")) continue;
    if (t.includes(tok)) return true;
  }
  return false;
}

function isSameUtcDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function pickCandidates(
  gainers: MoverItem[],
  losers: MoverItem[]
): { item: MoverItem; kind: "gainer" | "loser" | "active" }[] {
  const bySym = new Map<string, { item: MoverItem; kind: "gainer" | "loser" | "active" }>();

  const add = (m: MoverItem, kind: "gainer" | "loser" | "active") => {
    const sym = m.symbol.toUpperCase();
    if (bySym.has(sym)) return;
    bySym.set(sym, { item: { ...m, symbol: sym }, kind });
  };

  for (const m of gainers.slice(0, 4)) add(m, "gainer");
  for (const m of losers.slice(0, 4)) add(m, "loser");

  // High-volume movers among remaining (if volume present)
  const pool = [...gainers, ...losers]
    .filter((m) => typeof m.volume === "number" && (m.volume as number) > 0)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0));
  for (const m of pool.slice(0, 6)) {
    if (bySym.size >= MAX_HOT) break;
    add(m, "active");
  }

  // If still short, fill by absolute % move
  const absSorted = [...gainers, ...losers].sort(
    (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)
  );
  for (const m of absSorted) {
    if (bySym.size >= MAX_HOT) break;
    add(m, m.changePct >= 0 ? "gainer" : "loser");
  }

  return Array.from(bySym.values()).slice(0, MAX_HOT);
}

function matchFromRss(mover: MoverItem, news: NewsItem[]): NewsHit | null {
  const sameDay = news.filter((n) => isSameUtcDay(n.publishedAt));
  const pool = sameDay.length ? [...sameDay, ...news] : news;
  const seen = new Set<string>();
  for (const n of pool) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    if (titleMatchesMover(n.title, mover.symbol, mover.name)) {
      return {
        title: n.title,
        titleZh: n.titleZh,
        url: n.url,
        source: n.source,
      };
    }
  }
  return null;
}

async function fetchYahooNewsForSymbol(symbol: string): Promise<NewsHit | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), YAHOO_TIMEOUT_MS);
  try {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(symbol)}&lang=en-US&region=US` +
      `&quotesCount=0&newsCount=5&listsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      news?: { title?: string; link?: string; publisher?: string }[];
    };
    const news = json?.news;
    if (!Array.isArray(news) || news.length === 0) return null;
    for (const row of news) {
      const title = (row.title || "").replace(/\s+/g, " ").trim();
      const link = (row.link || "").trim();
      if (!title || !/^https?:\/\//i.test(link)) continue;
      // Prefer titles that mention the ticker/name; otherwise take first
      return {
        title,
        url: link,
        source: row.publisher || "Yahoo Finance",
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function directionPhrase(changePct: number): string {
  if (changePct >= 3) return "大漲";
  if (changePct >= 0.5) return "走高";
  if (changePct <= -3) return "大跌";
  if (changePct <= -0.5) return "走低";
  return "波動";
}

function reasonFromHeadline(
  changePct: number,
  headlineZh: string | null,
  headlineEn: string,
  kind: "gainer" | "loser" | "active"
): string {
  const dir = directionPhrase(changePct);
  const label =
    kind === "gainer" ? "漲幅突出" : kind === "loser" ? "跌幅突出" : "交投／波動活躍";
  const zh = (headlineZh || "").trim();
  if (zh) {
    const short = zh.length > 80 ? `${zh.slice(0, 78)}…` : zh;
    return `${label}（${dir}）：相關新聞指「${short}」`;
  }
  const enShort = headlineEn.length > 90 ? `${headlineEn.slice(0, 88)}…` : headlineEn;
  return `${label}（${dir}）：見英文頭條「${enShort}」`;
}

function noCatalystReason(mover: MoverItem): string {
  const sectorHint =
    mover.sectorZh || mover.sector
      ? `；所屬板塊：${mover.sectorZh || mover.sector}`
      : "";
  return `暫未找到明確新聞催化，或屬大盤／板塊跟動${sectorHint}`;
}

async function withBudget<T>(ms: number, work: () => Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Select notable movers and attach grounded zh-Hant reasons from free news.
 * Soft-fails to empty array; never breaks daily wrap.
 */
export async function buildHotStocks(opts: {
  gainers: MoverItem[];
  losers: MoverItem[];
  newsItems: NewsItem[];
}): Promise<HotStockItem[]> {
  return withBudget(
    OVERALL_BUDGET_MS,
    async () => {
      const candidates = pickCandidates(opts.gainers, opts.losers);
      if (candidates.length === 0) return [];

      const hits = new Map<string, NewsHit>();
      const needYahoo: string[] = [];

      for (const { item } of candidates) {
        const hit = matchFromRss(item, opts.newsItems);
        if (hit) hits.set(item.symbol, hit);
        else needYahoo.push(item.symbol);
      }

      // Yahoo search news only for unmatched (bounded concurrency)
      const CONC = 3;
      for (let i = 0; i < needYahoo.length; i += CONC) {
        const batch = needYahoo.slice(i, i + CONC);
        const results = await Promise.all(
          batch.map(async (sym) => {
            const hit = await fetchYahooNewsForSymbol(sym);
            return { sym, hit };
          })
        );
        for (const { sym, hit } of results) {
          if (hit) hits.set(sym, hit);
        }
      }

      // Translate English headlines that lack titleZh
      const toTranslate: string[] = [];
      for (const hit of Array.from(hits.values())) {
        if (!hit.titleZh) toTranslate.push(hit.title);
      }
      let zhMap = new Map<string, string>();
      try {
        zhMap = await translateTitlesToZhHant(toTranslate);
      } catch {
        zhMap = new Map();
      }

      const out: HotStockItem[] = [];
      for (const { item, kind } of candidates) {
        const hit = hits.get(item.symbol);
        let reasonZh: string;
        let headline: string | undefined;
        let link: string | undefined;
        if (hit) {
          const zh = hit.titleZh || zhMap.get(hit.title) || null;
          reasonZh = reasonFromHeadline(item.changePct, zh, hit.title, kind);
          headline = hit.title;
          link = hit.url;
        } else {
          reasonZh = noCatalystReason(item);
        }
        out.push({
          symbol: item.symbol,
          name: item.name,
          changePct: item.changePct,
          reasonZh,
          headline,
          link,
          kind,
        });
      }

      // Prefer names with catalysts first, then by |changePct|
      out.sort((a, b) => {
        const ac = a.headline ? 1 : 0;
        const bc = b.headline ? 1 : 0;
        if (bc !== ac) return bc - ac;
        return Math.abs(b.changePct) - Math.abs(a.changePct);
      });

      return out.slice(0, MAX_HOT);
    },
    []
  );
}
