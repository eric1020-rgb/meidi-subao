export type TideState = "high" | "rotation" | "wait" | "low";

export type ColorScheme = "us" | "tw";
export type ThemeMode = "dark" | "light";
export type FontSize = "sm" | "md" | "lg";

export interface SectorPoint {
  symbol: string;
  name: string;
  nameZh: string;
  /** ~5d net flow proxy (arbitrary units, e.g. $B relative) */
  flow5d: number;
  /** Flow acceleration (today vs prior window) */
  acceleration: number;
  /** ~20d magnitude for bubble size */
  magnitude20d: number;
  /** Price change % today */
  changePct: number;
  /** Buy/hold ratio proxy: stocks advancing in sector */
  advancing: number;
  total: number;
  leadTicker: string;
  leadName: string;
  state: TideState;
  /** Synthetic institutional flow in $M */
  instFlowM: number;
}

export interface StockHighlight {
  symbol: string;
  name: string;
  changePct: number;
  flowProxyM: number;
  sector: string;
}

export interface MarketPayload {
  asOf: string;
  source: "live-quotes+synthetic-flow" | "demo";
  sectors: SectorPoint[];
  highlights: StockHighlight[];
  megaCaps: StockHighlight[];
  spxChangePct: number;
}

export interface AppSettings {
  colorScheme: ColorScheme;
  theme: ThemeMode;
  fontSize: FontSize;
}

export interface VoteTally {
  bull: number;
  bear: number;
  myVote: "bull" | "bear" | null;
  dateKey: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface NewsPayload {
  items: NewsItem[];
  asOf: string;
  source: string;
  error?: boolean;
  message?: string;
}
