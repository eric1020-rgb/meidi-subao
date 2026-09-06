"use client";

import type { VoteTally } from "@/lib/types";

interface Props {
  vote: VoteTally;
  onCast: (side: "bull" | "bear") => void;
}

export default function VotePanel({ vote, onCast }: Props) {
  const total = Math.max(1, vote.bull + vote.bear);
  const bullPct = Math.round((vote.bull / total) * 100);
  const bearPct = 100 - bullPct;

  return (
    <div className="rounded-card border border-white/5 bg-surface-2 p-3">
      <h3 className="text-sm font-semibold text-ink">明日 SPX 投票 · Next-day Vote</h3>
      <p className="mt-0.5 text-[11px] text-ink-muted">本機聚合（localStorage），僅供趣味參考</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full">
        <div className="bg-emerald-500 transition-all" style={{ width: `${bullPct}%` }} />
        <div className="bg-rose-500 transition-all" style={{ width: `${bearPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
        <span>🐂 Bull {vote.bull} ({bullPct}%)</span>
        <span>🐻 Bear {vote.bear} ({bearPct}%)</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCast("bull")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            vote.myVote === "bull" ? "bg-emerald-500 text-black" : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          }`}
        >
          Bullish
        </button>
        <button
          type="button"
          onClick={() => onCast("bear")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            vote.myVote === "bear" ? "bg-rose-500 text-white" : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
          }`}
        >
          Bearish
        </button>
      </div>
    </div>
  );
}
