"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MoverItem, MoversPayload } from "@/lib/types";
import { formatPct } from "@/lib/colors";

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

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

function formatVolume(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

type Tab = "both" | "gainers" | "losers";

export default function Movers() {
  const [data, setData] = useState<MoversPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientAsOf, setClientAsOf] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("both");
  const mounted = useRef(true);
  const hasData = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else if (!hasData.current) setLoading(true);
    try {
      const url = manual ? "/api/movers?refresh=1" : "/api/movers";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as MoversPayload;
      if (!mounted.current) return;
      hasData.current = true;
      setData(json);
      setClientAsOf(new Date().toISOString());
    } catch {
      if (!mounted.current) return;
      setData((prev) =>
        prev ?? {
          gainers: [],
          losers: [],
          asOf: new Date().toISOString(),
          source: "error",
          error: true,
          message: "無法載入漲跌榜",
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
          <h2 className="text-sm font-semibold text-ink">漲跌榜 · Movers</h2>
          <p className="text-[10px] text-ink-faint">
            當日 |漲跌幅| 最大 · Top {data?.gainers?.length ?? 10} 漲 / Top {data?.losers?.length ?? 10}{" "}
            跌 · 約每 {REFRESH_MS / 1000}s 自動更新
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

      <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-3 py-2">
        <SubTab active={tab === "both"} onClick={() => setTab("both")}>
          漲跌並列
        </SubTab>
        <SubTab active={tab === "gainers"} onClick={() => setTab("gainers")}>
          漲幅榜
        </SubTab>
        <SubTab active={tab === "losers"} onClick={() => setTab("losers")}>
          跌幅榜
        </SubTab>
      </div>

      {data?.error && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200/90">
          {data.message || "部分來源暫時無法取得，顯示備援內容。"}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {loading && !data ? (
          <ul className="space-y-2 p-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="animate-pulse rounded-lg bg-surface-3/80 px-3 py-3">
                <div className="mb-2 h-3 w-[60%] rounded bg-white/10" />
                <div className="h-2 w-[40%] rounded bg-white/5" />
              </li>
            ))}
          </ul>
        ) : tab === "both" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MoverTable title="Top Gainers · 漲幅" items={data?.gainers ?? []} positive />
            <MoverTable title="Top Losers · 跌幅" items={data?.losers ?? []} positive={false} />
          </div>
        ) : tab === "gainers" ? (
          <MoverTable title="Top Gainers · 漲幅" items={data?.gainers ?? []} positive />
        ) : (
          <MoverTable title="Top Losers · 跌幅" items={data?.losers ?? []} positive={false} />
        )}
      </div>

      <p className="border-t border-white/5 px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
        漲跌榜僅供資訊參考，<strong className="text-ink-muted">並非投資建議</strong>
        。資料來自公開報價來源，可能延遲。Movers for information only — not investment advice.
      </p>
    </section>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
        active ? "bg-white/10 text-ink" : "text-ink-muted hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function MoverTable({
  title,
  items,
  positive,
}: {
  title: string;
  items: MoverItem[];
  positive: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface/40">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <h3 className="text-xs font-semibold text-ink">{title}</h3>
        <span
          className="text-[10px] font-medium"
          style={{ color: positive ? "var(--up)" : "var(--down)" }}
        >
          {positive ? "▲" : "▼"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-ink-faint">
              <th className="px-2 py-1.5 font-medium">#</th>
              <th className="px-2 py-1.5 font-medium">代號</th>
              <th className="px-2 py-1.5 font-medium">名稱</th>
              <th className="px-2 py-1.5 text-right font-medium">價格</th>
              <th className="px-2 py-1.5 text-right font-medium">漲跌%</th>
              <th className="px-2 py-1.5 text-right font-medium">成交量</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const up = row.changePct >= 0;
              return (
                <tr key={row.symbol} className="border-t border-white/[0.04] hover:bg-white/[0.03]">
                  <td className="px-2 py-2 tabular-nums text-ink-faint">{i + 1}</td>
                  <td className="px-2 py-2 font-semibold text-ink">{row.symbol}</td>
                  <td className="max-w-[120px] truncate px-2 py-2 text-ink-muted" title={row.name}>
                    {row.name}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink">{formatPrice(row.price)}</td>
                  <td
                    className="px-2 py-2 text-right font-semibold tabular-nums"
                    style={{ color: up ? "var(--up)" : "var(--down)" }}
                  >
                    {formatPct(row.changePct)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-faint">
                    {formatVolume(row.volume)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">
                  目前沒有資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
