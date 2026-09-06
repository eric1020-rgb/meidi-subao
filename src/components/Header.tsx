"use client";

export type AppView = "bubbles" | "rankings" | "movers" | "news";

interface Props {
  view: AppView;
  onView: (v: AppView) => void;
  onOpenSettings: () => void;
}

export default function Header({ view, onView, onOpenSettings }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-surface/80 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2">
        <WaveLogo />
        <div>
          <div className="text-sm font-bold tracking-tight text-ink">
            美帝速報 <span className="font-normal text-ink-muted">US Market Brief</span>
          </div>
          <div className="text-[10px] text-ink-faint">Sector rotation · capital-flow proxy</div>
        </div>
      </div>

      <nav className="ml-auto flex items-center gap-1 rounded-lg bg-surface-3 p-0.5">
        <NavBtn active={view === "bubbles"} onClick={() => onView("bubbles")}>
          泡泡圖
        </NavBtn>
        <NavBtn active={view === "rankings"} onClick={() => onView("rankings")}>
          排行榜
        </NavBtn>
        <NavBtn active={view === "movers"} onClick={() => onView("movers")}>
          漲跌榜
        </NavBtn>
        <NavBtn active={view === "news"} onClick={() => onView("news")}>
          當日新聞
        </NavBtn>
      </nav>

      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-3 hover:text-ink"
        aria-label="Settings"
      >
        ⚙️ 設定
      </button>
    </header>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-white/10 text-ink" : "text-ink-muted"}`}
    >
      {children}
    </button>
  );
}

function WaveLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="url(#g)" />
      <path
        d="M4 20c3-4 5-4 8 0s5 4 8 0 5-4 8 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M4 14c3-4 5-4 8 0s5 4 8 0 5-4 8 0"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
