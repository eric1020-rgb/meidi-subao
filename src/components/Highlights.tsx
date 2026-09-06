"use client";

import type { StockHighlight } from "@/lib/types";
import { formatFlow, formatPct } from "@/lib/colors";

interface Props {
  items: StockHighlight[];
  spxChangePct: number;
  asOf: string;
  source: string;
}

export default function Highlights({ items, spxChangePct, asOf, source }: Props) {
  const asOfLocal = new Date(asOf).toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-card border border-white/5 bg-surface-2 px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink">今日亮點 · Today Highlights</span>
        <span
          className="rounded-full px-2 py-0.5 font-medium tabular-nums"
          style={{
            background: spxChangePct >= 0 ? "color-mix(in srgb, var(--up) 20%, transparent)" : "color-mix(in srgb, var(--down) 20%, transparent)",
            color: spxChangePct >= 0 ? "var(--up)" : "var(--down)",
          }}
        >
          SPX proxy {formatPct(spxChangePct)}
        </span>
        <span className="ml-auto text-[10px] text-ink-faint" title="Daily snapshot refreshed after US market close (cron); not live tick data">
          資料快照 · snapshot {asOfLocal} HKT · {source === "demo" ? "demo data" : "quotes + synthetic flow"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((h) => (
          <div
            key={h.symbol}
            className="min-w-[120px] shrink-0 rounded-lg border border-white/5 bg-surface-3 px-2.5 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-ink">{h.symbol}</span>
              <span className="text-[10px] text-ink-faint">{h.sector}</span>
            </div>
            <div className="truncate text-[10px] text-ink-muted">{h.name}</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-semibold tabular-nums" style={{ color: h.flowProxyM >= 0 ? "var(--up)" : "var(--down)" }}>
                {formatFlow(h.flowProxyM / 100)}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: h.changePct >= 0 ? "var(--up)" : "var(--down)" }}>
                {formatPct(h.changePct)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
