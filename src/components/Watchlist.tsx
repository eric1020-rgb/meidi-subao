"use client";

import { useMemo, useState } from "react";
import type { SectorPoint, StockHighlight } from "@/lib/types";
import { formatFlow, formatPct } from "@/lib/colors";

interface Props {
  watchlist: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  onToggle: (t: string) => void;
  megaCaps: StockHighlight[];
  sectors: SectorPoint[];
}

export default function Watchlist({
  watchlist,
  onAdd,
  onRemove,
  onToggle,
  megaCaps,
  sectors,
}: Props) {
  const [input, setInput] = useState("");

  const watched = useMemo(() => {
    return watchlist.map((sym) => {
      const mega = megaCaps.find((m) => m.symbol === sym);
      const sector = sectors.find((s) => s.symbol === sym);
      if (mega) return { symbol: sym, name: mega.name, flow: mega.flowProxyM / 100, changePct: mega.changePct };
      if (sector)
        return {
          symbol: sym,
          name: sector.name,
          flow: sector.flow5d,
          changePct: sector.changePct,
        };
      return { symbol: sym, name: sym, flow: 0, changePct: 0 };
    });
  }, [watchlist, megaCaps, sectors]);

  const suggestions = megaCaps.filter((m) => !watchlist.includes(m.symbol)).slice(0, 6);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col rounded-card border border-white/5 bg-surface-2">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">觀察清單 · Watchlist</h2>
        <form onSubmit={submit} className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-20 rounded-md border border-white/10 bg-surface-3 px-2 py-1 text-xs text-ink outline-none focus:border-white/30"
            aria-label="Add ticker"
          />
          <button type="submit" className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-ink hover:bg-white/15">
            + 添加
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {watched.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-ink-muted">
            <p>尚未有自選股</p>
            <p className="mt-1 text-ink-faint">輸入代碼或點下方 + 加入觀察清單（存於本機 localStorage）</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {watched.map((w) => (
              <li key={w.symbol} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{w.symbol}</div>
                  <div className="truncate text-[10px] text-ink-muted">{w.name}</div>
                </div>
                <div className="text-right text-xs tabular-nums" style={{ color: w.flow >= 0 ? "var(--up)" : "var(--down)" }}>
                  {formatFlow(w.flow)}
                  <div className="text-[10px]">{formatPct(w.changePct)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(w.symbol)}
                  className="rounded px-1.5 text-xs text-ink-faint hover:bg-white/10 hover:text-ink"
                  aria-label={`Remove ${w.symbol}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <p className="mb-1.5 px-1 text-[11px] text-ink-muted">
            {watched.length === 0 ? "還沒有自選？今天動能較強的大型股…" : "快速添加"}
          </p>
          <ul className="space-y-0.5">
            {suggestions.map((m) => (
              <li key={m.symbol} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-3">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{m.symbol}</span>
                  <span className="ml-1.5 text-[10px] text-ink-muted">{m.name}</span>
                </div>
                <span className="text-xs tabular-nums" style={{ color: m.flowProxyM >= 0 ? "var(--up)" : "var(--down)" }}>
                  {formatFlow(m.flowProxyM / 100)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(m.symbol)}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-sm font-bold text-amber-400 hover:bg-amber-500/30"
                  aria-label={`Add ${m.symbol}`}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
