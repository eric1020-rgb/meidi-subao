/**
 * Free Traditional Chinese (zh-TW) machine translation for news headlines.
 * Primary: MyMemory free tier (no user API key).
 * Fallback: Google Translate unofficial gtx endpoint (demo-style, may rate-limit).
 * Failures return null — callers must keep English title and never break the page.
 */

import { createHash } from "crypto";

const TRANSLATE_TIMEOUT_MS = 4_500;
const CONCURRENCY = 5;
const BATCH_GAP_MS = 80;
const CACHE_MAX = 500;
const USER_AGENT = "Mozilla/5.0 (compatible; MeidiSubao/1.0; +https://meidi-subao.vercel.app)";

type CacheEntry = { zh: string; at: number };
const memoryCache = new Map<string, CacheEntry>();

function titleHash(title: string): string {
  return createHash("sha256").update(title.trim()).digest("hex").slice(0, 24);
}

function looksMostlyChinese(s: string): boolean {
  const chars = s.replace(/\s+/g, "");
  if (!chars) return false;
  let cjk = 0;
  for (const ch of chars) {
    if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
  }
  return cjk / chars.length >= 0.4;
}

function trimCache() {
  if (memoryCache.size <= CACHE_MAX) return;
  const entries = Array.from(memoryCache.entries()).sort((a, b) => a[1].at - b[1].at);
  const drop = entries.slice(0, memoryCache.size - CACHE_MAX);
  for (const [k] of drop) memoryCache.delete(k);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TRANSLATE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(init?.headers || {}),
      },
      // Short Next Data Cache helps Vercel cold starts; plus in-process Map by hash.
      next: { revalidate: 86_400 },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function translateMyMemory(text: string): Promise<string | null> {
  const q = encodeURIComponent(text.slice(0, 450));
  const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=en|zh-TW`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  const zh = data?.responseData?.translatedText?.trim();
  if (!zh || data.responseStatus === 403) return null;
  // MyMemory sometimes echoes the source or returns MYMEMORY WARNING…
  if (/^MYMEMORY WARNING/i.test(zh)) return null;
  if (zh.toLowerCase() === text.toLowerCase()) return null;
  return zh;
}

async function translateGoogleGtx(text: string): Promise<string | null> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: "zh-TW",
    dt: "t",
    q: text.slice(0, 450),
  });
  const url = `https://translate.googleapis.com/translate_a/single?${params}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const parts: string[] = [];
  for (const row of data[0]) {
    if (Array.isArray(row) && typeof row[0] === "string") parts.push(row[0]);
  }
  const zh = parts.join("").trim();
  return zh || null;
}

async function translateOne(text: string): Promise<string | null> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (looksMostlyChinese(trimmed)) return trimmed;

  const key = titleHash(trimmed);
  const hit = memoryCache.get(key);
  if (hit) return hit.zh;

  let zh: string | null = null;
  try {
    zh = await translateMyMemory(trimmed);
  } catch {
    zh = null;
  }
  if (!zh) {
    try {
      zh = await translateGoogleGtx(trimmed);
    } catch {
      zh = null;
    }
  }
  if (!zh) return null;

  memoryCache.set(key, { zh, at: Date.now() });
  trimCache();
  return zh;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Translate many English titles to Traditional Chinese.
 * Returns a map of original title → zh string (only successful ones).
 */
export async function translateTitlesToZhHant(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of titles) {
    const k = t.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const key = titleHash(k);
    const hit = memoryCache.get(key);
    if (hit) {
      out.set(k, hit.zh);
      continue;
    }
    if (looksMostlyChinese(k)) {
      out.set(k, k);
      continue;
    }
    unique.push(k);
  }

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (title) => {
        const zh = await translateOne(title);
        return { title, zh };
      })
    );
    for (const { title, zh } of results) {
      if (zh) out.set(title, zh);
    }
    if (i + CONCURRENCY < unique.length) await sleep(BATCH_GAP_MS);
  }

  return out;
}

export function getTranslationCacheSize(): number {
  return memoryCache.size;
}
