"use client";

import { useMemo, useState } from "react";
import type { SectorPoint, TideState } from "@/lib/types";
import { formatFlow, formatPct, TIDE_LABELS } from "@/lib/colors";

interface Props {
  sectors: SectorPoint[];
  filterState?: TideState | null;
  onSelect?: (s: SectorPoint) => void;
}

type Mode = "netBuy" | "netSell";
type Window = "today" | "5d";

export default function Rankings({ sectors, filterState, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>("netBuy");
  const [win, setWin] = useState<Window>("5d");

  const rows = useMemo(() => {
    let list = [...sectors];
    if (filterState) list = list.filter((s) => s.state === filterState);
    list.sort((a, b) => {
      const av = win === "5d" ? a.flow5d : a.changePct;
      const bv = win === "5d" ? b.flow5d : b.changePct;
      return mode === "netBuy" ? bv - av : av - bv;
    });
    return list;
  }, [sectors, filterState, mode, win]);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(win === "5d" ? r.flow5d : r.changePct * 10)));

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-card border border-white/5 bg-surface-2">
      <div className="border-b border-white/5 px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">板塊排行榜 · Sector Rankings</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Toggle active={mode === "netBuy"} onClick={() => setMode("netBuy")}>
            Net Buy
          </Toggle>
          <Toggle active={mode === "netSell"} onClick={() => setMode("netSell")}>
            Net Sell
          </Toggle>
          <span className="mx-1 w-px self-stretch bg-white/10" />
          <Toggle active={win === "today"} onClick={() => setWin("today")}>
            Today
          </Toggle>
          <Toggle active={win === "5d"} onClick={() => setWin("5d")}>
            5 Days
          </Toggle>
        </div>
        {filterState && (
          <p className="mt-1 text-[11px] text-ink-muted">
            Filter: {TIDE_LABELS[filterState].zh} — click tide card again to clear
          </p>
        )}
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {rows.map((s, i) => {
          const val = win === "5d" ? s.flow5d : s.changePct;
          const width = `${Math.min(100, (Math.abs(val) / maxAbs) * 100)}%`;
          const positive = val >= 0;
          return (
            <li key={s.symbol}>
              <button
                type="button"
                onClick={() => onSelect?.(s)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-3"
              >
                <span className="w-5 text-xs tabular-nums text-ink-faint">{i + 1}</span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--tide-${s.state})` }}
                  title={TIDE_LABELS[s.state].zh}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-ink">{s.symbol}</span>
                    <span className="truncate text-xs text-ink-muted">
                      {s.nameZh} · {s.name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-ink-faint">
                    <span>
                      {s.advancing}/{s.total} advancing
                    </span>
                    <span>
                      Lead {s.leadTicker} {s.leadName}
                    </span>
                    <span style={{ color: positive ? "var(--up)" : "var(--down)" }}>{formatPct(s.changePct)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width,
                        background: positive ? "var(--up)" : "var(--down)",
                        opacity: 0.85,
                        marginLeft: positive ? 0 : "auto",
                      }}
                    />
                  </div>
                </div>
                <div
                  className="shrink-0 text-right text-sm font-semibold tabular-nums"
                  style={{ color: positive ? "var(--up)" : "var(--down)" }}
                >
                  {win === "5d" ? formatFlow(s.flow5d) : formatPct(s.changePct)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Toggle({
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
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        active ? "bg-white/10 text-ink" : "text-ink-muted hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
