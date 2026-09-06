"use client";

import type { SectorPoint, TideState } from "@/lib/types";
import { TIDE_LABELS } from "@/lib/colors";

const ORDER: TideState[] = ["high", "rotation", "wait", "low"];

interface Props {
  sectors: SectorPoint[];
  active?: TideState | null;
  onFilter?: (s: TideState | null) => void;
}

export default function TideSidebar({ sectors, active, onFilter }: Props) {
  const counts = ORDER.reduce(
    (acc, s) => {
      acc[s] = sectors.filter((x) => x.state === s).length;
      return acc;
    },
    {} as Record<TideState, number>
  );

  return (
    <aside className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ORDER.map((state) => {
        const meta = TIDE_LABELS[state];
        const selected = active === state;
        return (
          <button
            key={state}
            type="button"
            onClick={() => onFilter?.(selected ? null : state)}
            className={`min-w-[140px] flex-1 rounded-card border p-3 text-left transition lg:min-w-0 ${
              selected
                ? "border-white/20 bg-surface-3 ring-1 ring-white/10"
                : "border-white/5 bg-surface-2 hover:border-white/10"
            }`}
            style={{ borderLeftWidth: 4, borderLeftColor: `var(--tide-${state})` }}
          >
            <div className="text-xs font-medium text-ink-muted">
              {meta.zh} · {meta.en}
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-ink" style={{ color: `var(--tide-${state})` }}>
              {counts[state]}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-ink-faint">{meta.descZh}</div>
            <div className="text-[10px] text-ink-faint">{meta.descEn}</div>
          </button>
        );
      })}
    </aside>
  );
}
