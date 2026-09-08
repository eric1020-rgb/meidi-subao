import type { NewsItem, NewsPayload } from "./types";
import { translateTitlesToZhHant } from "./translate";

const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 45_000;

/** Public RSS feeds — no API key. Prefer finance/markets-focused sources. */
const FEEDS: { id: string; label: string; url: string }[] = [
  {
    id: "cnbc-business",
    label: "CNBC",
    url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",
  },
  {
    id: "cnbc-finance",
    label: "CNBC",
    url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",
  },
  {
    id: "mw-top",
    label: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
  },
  {
    id: "mw-pulse",
    label: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/marketpulse/",
  },
  {
    id: "yahoo",
    label: "Yahoo Finance",
    url: "https://finance.yahoo.com/rss/topfinstories",
  },
  {
    id: "investing",
    label: "Investing.com",
    url: "https://www.investing.com/rss/news.rss",
  },
];

type CacheEntry = { at: number; payload: NewsPayload };
let memoryCache: CacheEntry | null = null;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

function tagText(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  return decodeXmlEntities(m[1]);
}

function parsePubDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  // Investing.com sometimes uses "YYYY-MM-DD HH:mm:ss"
  const alt = new Date(raw.replace(" ", "T") + "Z");
  if (!Number.isNaN(alt.getTime())) return alt.toISOString();
  return null;
}

function parseRssItems(xml: string, sourceLabel: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = tagText(block, "title");
    let link =
      tagText(block, "link") ||
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
      null;
    if (!title || !link) continue;
    link = link.trim();
    if (!/^https?:\/\//i.test(link)) continue;

    const publishedAt =
      parsePubDate(tagText(block, "pubDate")) ||
      parsePubDate(tagText(block, "published")) ||
      parsePubDate(tagText(block, "dc:date")) ||
      new Date().toISOString();

    const guid = tagText(block, "guid") || link;
    const id = `${sourceLabel}:${guid}`.slice(0, 200);

    items.push({
      id,
      title: title.replace(/\s+/g, " ").trim(),
      source: sourceLabel,
      publishedAt,
      url: link,
    });
  }
  return items;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      // Brief CDN/edge cache hint; we also memoize in-process.
      next: { revalidate: 45 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, feed.label);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .slice(0, 120);
}

function isSameUtcDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function demoItems(): NewsItem[] {
  const now = Date.now();
  return [
    {
      id: "demo-1",
      title: "[Demo] Markets await key US economic data — feed unavailable",
      source: "Demo",
      publishedAt: new Date(now - 15 * 60_000).toISOString(),
      url: "https://finance.yahoo.com/",
    },
    {
      id: "demo-2",
      title: "[Demo] Sector rotation watch: tech vs financials in focus",
      source: "Demo",
      publishedAt: new Date(now - 45 * 60_000).toISOString(),
      url: "https://www.cnbc.com/markets/",
    },
    {
      id: "demo-3",
      title: "[Demo] Sample headline — live RSS will replace this when reachable",
      source: "Demo",
      publishedAt: new Date(now - 90 * 60_000).toISOString(),
      url: "https://www.marketwatch.com/",
    },
  ];
}

export async function loadNews(force = false): Promise<NewsPayload> {
  if (!force && memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.payload;
  }

  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f)));
  const flat = results.flat();
  const okFeeds = FEEDS.filter((_, i) => results[i].length > 0).map((f) => f.label);
  const uniqueSources = Array.from(new Set(okFeeds));

  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of flat) {
    const key = normalizeKey(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  const sameDay = deduped.filter((i) => isSameUtcDay(i.publishedAt));
  // Prefer same-day headlines, then fill with latest so the feed stays useful.
  const sameIds = new Set(sameDay.map((i) => i.id));
  const filler = deduped.filter((i) => !sameIds.has(i.id));
  const items = [...sameDay, ...filler].slice(0, 50);

  // Attach Traditional Chinese titles (best-effort; never fail the feed).
  let withZh = items;
  try {
    const map = await translateTitlesToZhHant(items.map((i) => i.title));
    withZh = items.map((i) => {
      const titleZh = map.get(i.title);
      return titleZh ? { ...i, titleZh } : i;
    });
  } catch {
    withZh = items;
  }

  let payload: NewsPayload;
  if (withZh.length === 0) {
    const demos = demoItems();
    let demoZh = demos;
    try {
      const map = await translateTitlesToZhHant(demos.map((i) => i.title));
      demoZh = demos.map((i) => {
        const titleZh = map.get(i.title);
        return titleZh ? { ...i, titleZh } : i;
      });
    } catch {
      demoZh = demos;
    }
    payload = {
      items: demoZh,
      asOf: new Date().toISOString(),
      source: "demo",
      error: true,
      message: "Upstream RSS feeds unreachable — showing demo stubs",
    };
  } else {
    payload = {
      items: withZh,
      asOf: new Date().toISOString(),
      source: uniqueSources.join("+") || "rss",
      error: false,
    };
  }

  memoryCache = { at: Date.now(), payload };
  return payload;
}
