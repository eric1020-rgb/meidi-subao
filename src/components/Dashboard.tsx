"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketPayload, SectorPoint, TideState } from "@/lib/types";
import { useSettings } from "@/hooks/useSettings";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useVote } from "@/hooks/useVote";
import Header, { type AppView } from "./Header";
import TideSidebar from "./TideSidebar";
import BubbleChart from "./BubbleChart";
import Rankings from "./Rankings";
import NewsFeed from "./NewsFeed";
import Movers from "./Movers";
import Watchlist from "./Watchlist";
import Highlights from "./Highlights";
import VotePanel from "./VotePanel";
import SettingsPanel from "./SettingsPanel";
import Disclaimer from "./Disclaimer";

interface Props {
  initialData: MarketPayload;
}

export default function Dashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<AppView>("bubbles");
  const [filter, setFilter] = useState<TideState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update } = useSettings();
  const watch = useWatchlist();
  const { vote, cast } = useVote();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as MarketPayload;
        if (!cancelled && json?.sectors?.length) setData(json);
      } catch {
        /* keep SSR/demo payload */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectors = useMemo(() => {
    if (!filter) return data.sectors;
    return data.sectors.filter((s) => s.state === filter);
  }, [data.sectors, filter]);

  const onSelect = useCallback((s: SectorPoint | null) => {
    setSelected(s?.symbol ?? null);
  }, []);

  const showMarketChrome = view !== "news" && view !== "movers";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col">
      <Header view={view} onView={setView} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="space-y-3 p-3">
        {showMarketChrome && (
          <Highlights
            items={data.highlights}
            spxChangePct={data.spxChangePct}
            asOf={data.asOf}
            source={data.source}
          />
        )}

        {view === "news" ? (
          <main className="min-h-[480px]">
            <NewsFeed />
          </main>
        ) : view === "movers" ? (
          <main className="min-h-[480px]">
            <Movers />
          </main>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_1fr_280px]">
            <TideSidebar sectors={data.sectors} active={filter} onFilter={setFilter} />

            <main className="min-h-[480px]">
              {view === "bubbles" ? (
                <BubbleChart sectors={sectors} selected={selected} onSelect={onSelect} />
              ) : (
                <Rankings
                  sectors={data.sectors}
                  filterState={filter}
                  onSelect={(s) => {
                    setSelected(s.symbol);
                    setView("bubbles");
                  }}
                />
              )}
            </main>

            <div className="flex flex-col gap-3">
              <Watchlist
                watchlist={watch.list}
                onAdd={watch.add}
                onRemove={watch.remove}
                onToggle={watch.toggle}
                megaCaps={data.megaCaps}
                sectors={data.sectors}
              />
              <VotePanel vote={vote} onCast={cast} />
            </div>
          </div>
        )}

        {selected && showMarketChrome && (
          <SelectedCard
            sector={data.sectors.find((s) => s.symbol === selected)}
            onClose={() => setSelected(null)}
            onWatch={() => selected && watch.toggle(selected)}
            watched={watch.list.includes(selected)}
          />
        )}
      </div>

      <Disclaimer />
      <SettingsPanel
        settings={settings}
        onChange={update}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function SelectedCard({
  sector,
  onClose,
  onWatch,
  watched,
}: {
  sector?: SectorPoint;
  onClose: () => void;
  onWatch: () => void;
  watched: boolean;
}) {
  if (!sector) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-card border border-white/10 bg-surface-2 p-3 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--tide-${sector.state})` }} />
            <span className="text-lg font-bold text-ink">{sector.symbol}</span>
            <span className="text-sm text-ink-muted">
              {sector.nameZh} · {sector.name}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            5d flow {sector.flow5d >= 0 ? "+" : ""}
            {sector.flow5d} · accel {sector.acceleration.toFixed(1)} · mag20d {sector.magnitude20d.toFixed(1)}
          </p>
          <p className="text-xs text-ink-faint">
            Lead {sector.leadTicker} {sector.leadName} · {sector.advancing}/{sector.total} advancing
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
          ✕
        </button>
      </div>
      <button
        type="button"
        onClick={onWatch}
        className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-medium text-ink hover:bg-white/15"
      >
        {watched ? "從觀察清單移除" : "+ 加入觀察清單"}
      </button>
    </div>
  );
}
