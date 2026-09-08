"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsItem, NewsPayload } from "@/lib/types";

const REFRESH_MS = 90_000;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.max(0, Math.floor(diff / 60_000));
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

export default function NewsFeed() {
  const [data, setData] = useState<NewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientAsOf, setClientAsOf] = useState<string | null>(null);
  const mounted = useRef(true);
  const hasData = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else if (!hasData.current) setLoading(true);
    try {
      const url = manual ? "/api/news?refresh=1" : "/api/news";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as NewsPayload;
      if (!mounted.current) return;
      hasData.current = true;
      setData(json);
      setClientAsOf(new Date().toISOString());
    } catch {
      if (!mounted.current) return;
      setData((prev) =>
        prev ?? {
          items: [],
          asOf: new Date().toISOString(),
          source: "error",
          error: true,
          message: "無法載入新聞",
        }
      );
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(false);
    const id = setInterval(() => void load(false), REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load]);

  const asOfLabel = clientAsOf || data?.asOf;

  return (
    <section className="flex h-full min-h-[480px] flex-col rounded-card border border-white/5 bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">當日新聞 · Today&apos;s News</h2>
          <p className="text-[10px] text-ink-faint">
            美股／財經頭條（中英對照） · 約每 {REFRESH_MS / 1000}s 自動更新
            {data?.source ? ` · ${data.source}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {asOfLabel && (
            <span className="text-[10px] tabular-nums text-ink-faint" title={asOfLabel}>
              更新於 {formatTime(asOfLabel)} HKT
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            {refreshing ? "更新中…" : "↻ 重新整理"}
          </button>
        </div>
      </div>

      {data?.error && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200/90">
          {data.message || "部分來源暫時無法取得，顯示備援內容。"}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {loading && !data ? (
          <ul className="space-y-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="animate-pulse rounded-lg bg-surface-3/80 px-3 py-3">
                <div className="mb-2 h-3 w-[75%] rounded bg-white/10" />
                <div className="h-2 w-[33%] rounded bg-white/5" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-white/5">
            {(data?.items ?? []).map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
            {(data?.items?.length ?? 0) === 0 && (
              <li className="px-3 py-8 text-center text-sm text-ink-muted">目前沒有新聞項目</li>
            )}
          </ul>
        )}
      </div>

      <p className="border-t border-white/5 px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
        新聞彙整僅供資訊參考，<strong className="text-ink-muted">並非投資建議</strong>
        。中文標題為機器翻譯（繁體），僅供參考；原文來自公開 RSS，點擊將離開本站。News
        aggregated for information only — not investment advice. Chinese titles are machine-translated.
      </p>
    </section>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const hasZh = Boolean(item.titleZh && item.titleZh.trim() && item.titleZh !== item.title);
  return (
    <li>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg px-3 py-2.5 transition hover:bg-white/[0.04]"
      >
        {hasZh ? (
          <>
            <div className="text-sm font-medium leading-snug text-ink">{item.titleZh}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-ink-muted/90">{item.title}</div>
          </>
        ) : (
          <div className="text-sm font-medium leading-snug text-ink">{item.title}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-faint">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-ink-muted">{item.source}</span>
          <span className="tabular-nums" title={formatTime(item.publishedAt) + " HKT"}>
            {relativeTime(item.publishedAt)} · {formatTime(item.publishedAt)} HKT
          </span>
          <span className="text-ink-faint/80">↗ 原文</span>
        </div>
      </a>
    </li>
  );
}
