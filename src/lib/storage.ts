import type { AppSettings, VoteTally } from "./types";

const WATCHLIST_KEY = "meidi-subao-watchlist";
const SETTINGS_KEY = "meidi-subao-settings";
const VOTE_KEY = "meidi-subao-vote";

export const DEFAULT_SETTINGS: AppSettings = {
  colorScheme: "us",
  theme: "dark",
  fontSize: "md",
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function loadWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(tickers: string[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadVote(): VoteTally {
  const empty: VoteTally = { bull: 12, bear: 8, myVote: null, dateKey: todayKey() };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(VOTE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as VoteTally;
    if (parsed.dateKey !== todayKey()) {
      return { bull: 12 + Math.floor(Math.random() * 20), bear: 8 + Math.floor(Math.random() * 15), myVote: null, dateKey: todayKey() };
    }
    return parsed;
  } catch {
    return empty;
  }
}

export function saveVote(v: VoteTally) {
  localStorage.setItem(VOTE_KEY, JSON.stringify(v));
}
