"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalendarEvent,
  CalendarSummaryPayload,
  DailySummaryPayload,
  SummaryIndexRow,
  WeeklySummaryPayload,
} from "@/lib/types";
import { formatPct } from "@/lib/colors";

const DAILY_REFRESH_MS = 120_000;

type SubTab = "daily" | "weekly" | "calendar";

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

function pctColor(n: number): string {
  return n >= 0 ? "var(--up)" : "var(--down)";
}

export default function Summary() {
  const [tab, setTab] = useState<SubTab>("daily");
  const [daily, setDaily] = useState<DailySummaryPayload | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummaryPayload | null>(null);
  const [calendar, setCalendar] = useState<CalendarSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientAsOf, setClientAsOf] = useState<string | null>(null);
  const mounted = useRef(true);
  const hasData = useRef(false);

  const loadDaily = useCallback(async (manual = false) => {
    const url = manual ? "/api/summary/daily?refresh=1" : "/api/summary/daily";
    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as DailySummaryPayload;
  }, []);

  const loadWeekly = useCallback(async (manual = false) => {
    const url = manual ? "/api/summary/weekly?refresh=1" : "/api/summary/weekly";
    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as WeeklySummaryPayload;
  }, []);

  const loadCalendar = useCallback(async (manual = false) => {
    const url = manual ? "/api/summary/calendar?refresh=1" : "/api/summary/calendar";
    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as CalendarSummaryPayload;
  }, []);

  const loadAll = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else if (!hasData.current) setLoading(true);
      try {
        const [d, w, c] = await Promise.all([
          loadDaily(manual),
          loadWeekly(manual),
          loadCalendar(manual),
        ]);
        if (!mounted.current) return;
        hasData.current = true;
        setDaily(d);
        setWeekly(w);
        setCalendar(c);
        setClientAsOf(new Date().toISOString());
      } catch {
        if (!mounted.current) return;
        if (!hasData.current) {
          setDaily({
            asOf: new Date().toISOString(),
            source: "error",
            sessionLabel: "美股盤後總結",
            indices: [],
            sectorLeaders: [],
            sectorLaggards: [],
            topGainers: [],
            topLosers: [],
            highlights: [{ text: "無法載入總結", kind: "neutral" }],
            error: true,
            message: "無法載入總結",
          });
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loadDaily, loadWeekly, loadCalendar]
  );

  useEffect(() => {
    mounted.current = true;
    void loadAll(false);
    const id = setInterval(() => {
      // Light auto-refresh for daily wrap only
      void loadDaily(false)
        .then((d) => {
          if (mounted.current) {
            setDaily(d);
            setClientAsOf(new Date().toISOString());
          }
        })
        .catch(() => undefined);
    }, DAILY_REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [loadAll, loadDaily]);

  const activeAsOf =
    clientAsOf ||
    (tab === "daily" ? daily?.asOf : tab === "weekly" ? weekly?.asOf : calendar?.asOf);
  const activeSource =
    tab === "daily" ? daily?.source : tab === "weekly" ? weekly?.source : calendar?.source;
  const activeError =
    tab === "daily" ? daily?.error : tab === "weekly" ? weekly?.error : calendar?.error;
  const activeMessage =
    tab === "daily" ? daily?.message : tab === "weekly" ? weekly?.message : calendar?.message;

  return (
    <section className="flex h-full min-h-[480px] flex-col rounded-card border border-white/5 bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">總結 · Market Wrap</h2>
          <p className="text-[10px] text-ink-faint">
            每日盤後／每周／未來大事 · 每日約每 {DAILY_REFRESH_MS / 1000}s 輕量更新
            {activeSource ? ` · ${activeSource}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeAsOf && (
            <span className="text-[10px] tabular-nums text-ink-faint" title={activeAsOf}>
              更新於 {formatTime(activeAsOf)} HKT
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadAll(true)}
            disabled={refreshing}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            {refreshing ? "更新中…" : "↻ 重新整理"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-3 py-2">
        <SubTabBtn active={tab === "daily"} onClick={() => setTab("daily")}>
          每日盤後
        </SubTabBtn>
        <SubTabBtn active={tab === "weekly"} onClick={() => setTab("weekly")}>
          每周總結
        </SubTabBtn>
        <SubTabBtn active={tab === "calendar"} onClick={() => setTab("calendar")}>
          未來一周大事
        </SubTabBtn>
      </div>

      {activeError && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200/90">
          {activeMessage || "部分來源暫時無法取得，顯示備援內容。"}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {loading && !daily ? (
          <Skeleton />
        ) : tab === "daily" ? (
          <DailyPanel data={daily} />
        ) : tab === "weekly" ? (
          <WeeklyPanel data={weekly} />
        ) : (
          <CalendarPanel data={calendar} />
        )}
      </div>

      <p className="border-t border-white/5 px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
        總結內容由公開行情與日曆彙整，僅供資訊參考，
        <strong className="text-ink-muted">並非投資建議</strong>
        。時間標示以香港時間（HKT）為主。Not investment advice.
      </p>
    </section>
  );
}

function SubTabBtn({
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

function Skeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="animate-pulse rounded-lg bg-surface-3/80 px-3 py-3">
          <div className="mb-2 h-3 w-[70%] rounded bg-white/10" />
          <div className="h-2 w-[40%] rounded bg-white/5" />
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface/40">
      <div className="border-b border-white/5 px-3 py-2">
        <h3 className="text-xs font-semibold text-ink">{title}</h3>
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

function IndexGrid({ rows }: { rows: SummaryIndexRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <div key={r.symbol} className="rounded-md bg-white/[0.03] px-2.5 py-2">
          <div className="text-[10px] text-ink-faint">
            {r.nameZh || r.name} · {r.symbol}
          </div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: pctColor(r.changePct) }}>
            {formatPct(r.changePct)}
          </div>
          {r.price != null && (
            <div className="text-[10px] tabular-nums text-ink-muted">{r.price.toFixed(2)}</div>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="col-span-full text-xs text-ink-muted">暫無指數資料</p>}
    </div>
  );
}

function SectorList({ rows }: { rows: SummaryIndexRow[] }) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.symbol} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03]">
          <span className="text-xs text-ink">
            <span className="font-semibold">{r.symbol}</span>
            <span className="ml-1.5 text-ink-muted">{r.nameZh || r.name}</span>
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: pctColor(r.changePct) }}>
            {formatPct(r.changePct)}
          </span>
        </li>
      ))}
      {rows.length === 0 && <li className="px-2 py-2 text-xs text-ink-muted">暫無資料</li>}
    </ul>
  );
}

function HighlightList({
  items,
}: {
  items: { text: string; kind?: string }[];
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((h, i) => (
        <li key={i} className="flex gap-2 text-xs leading-snug text-ink-muted">
          <span className="mt-0.5 shrink-0 text-ink-faint">•</span>
          <span className={h.kind === "news" ? "text-ink-muted" : "text-ink"}>{h.text}</span>
        </li>
      ))}
    </ul>
  );
}

function MoverMini({
  title,
  items,
}: {
  title: string;
  items: { symbol: string; name: string; changePct: number }[];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-1">
        {items.map((m) => (
          <li key={m.symbol} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
            <span className="truncate text-ink">
              <span className="font-semibold">{m.symbol}</span>
              <span className="ml-1 text-ink-faint">{m.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums" style={{ color: pctColor(m.changePct) }}>
              {formatPct(m.changePct)}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="px-1 py-2 text-ink-muted">暫無</li>}
      </ul>
    </Card>
  );
}

function DailyPanel({ data }: { data: DailySummaryPayload | null }) {
  if (!data) return <p className="text-sm text-ink-muted">尚無每日總結</p>;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-faint">{data.sessionLabel}</p>
      <Card title="主要指數 · 當日漲跌">
        <IndexGrid rows={data.indices} />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="產業領先">
          <SectorList rows={data.sectorLeaders} />
        </Card>
        <Card title="產業落後">
          <SectorList rows={data.sectorLaggards} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MoverMini title="漲幅摘要" items={data.topGainers} />
        <MoverMini title="跌幅摘要" items={data.topLosers} />
      </div>
      <Card title="重點摘要">
        <HighlightList items={data.highlights} />
      </Card>
    </div>
  );
}

function WeeklyPanel({ data }: { data: WeeklySummaryPayload | null }) {
  if (!data) return <p className="text-sm text-ink-muted">尚無每周總結</p>;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-faint">{data.weekLabel} · 近 5 個交易日表現</p>
      <Card title="主要指數 · 本週">
        <IndexGrid rows={data.indices} />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="本週產業領先">
          <SectorList rows={data.sectorLeaders} />
        </Card>
        <Card title="本週產業落後">
          <SectorList rows={data.sectorLaggards} />
        </Card>
      </div>
      <Card title="重點摘要">
        <HighlightList items={data.highlights} />
      </Card>
      <Card title="新聞主題（近期 RSS）">
        <ul className="divide-y divide-white/5">
          {data.themes.map((t, i) => (
            <li key={i}>
              {t.url ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md px-1 py-2 hover:bg-white/[0.03]"
                >
                  <div className="text-xs font-medium leading-snug text-ink">{t.title}</div>
                  {t.source && (
                    <div className="mt-0.5 text-[10px] text-ink-faint">{t.source} · ↗ 原文</div>
                  )}
                </a>
              ) : (
                <div className="px-1 py-2 text-xs text-ink">{t.title}</div>
              )}
            </li>
          ))}
          {data.themes.length === 0 && (
            <li className="px-1 py-3 text-xs text-ink-muted">暫無主題</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function importanceBadge(imp: CalendarEvent["importance"]) {
  if (imp === "high") {
    return (
      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
        高
      </span>
    );
  }
  if (imp === "medium") {
    return (
      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
        中
      </span>
    );
  }
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">低</span>
  );
}

function CalendarPanel({ data }: { data: CalendarSummaryPayload | null }) {
  if (!data) return <p className="text-sm text-ink-muted">尚無行事曆</p>;

  // Group by date label
  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of data.events) {
    const list = groups.get(ev.date) || [];
    list.push(ev);
    groups.set(ev.date, list);
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-faint">{data.rangeLabel}</p>
      <p className="text-[10px] leading-relaxed text-ink-faint">
        以下為公開經濟日曆／預期大事，屬「預期」資訊，實際公布時間可能調整。
      </p>
      {Array.from(groups.entries()).map(([date, events]) => (
        <Card key={date} title={date}>
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md px-1 py-1.5 hover:bg-white/[0.03]"
              >
                <span className="w-12 shrink-0 text-xs tabular-nums text-ink-muted">{ev.timeHkt}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {importanceBadge(ev.importance)}
                    <span className="text-xs font-medium text-ink">{ev.nameZh || ev.name}</span>
                  </div>
                  {ev.nameZh && ev.nameZh !== ev.name && (
                    <div className="mt-0.5 text-[10px] text-ink-faint">{ev.name}</div>
                  )}
                  {(ev.forecast || ev.previous) && (
                    <div className="mt-0.5 text-[10px] text-ink-faint">
                      {ev.forecast ? `預期 ${ev.forecast}` : ""}
                      {ev.forecast && ev.previous ? " · " : ""}
                      {ev.previous ? `前值 ${ev.previous}` : ""}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {data.events.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-muted">本週暫無列出的大事</p>
      )}
    </div>
  );
}
