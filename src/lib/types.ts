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

export interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume?: number;
  /** GICS-style sector (English), e.g. Technology */
  sector?: string;
  /** Optional Traditional Chinese sector label */
  sectorZh?: string;
}

export interface MoversPayload {
  gainers: MoverItem[];
  losers: MoverItem[];
  asOf: string;
  source: string;
  error?: boolean;
  message?: string;
}

/** Index / ETF performance row used in daily & weekly wraps */
export interface SummaryIndexRow {
  symbol: string;
  name: string;
  nameZh?: string;
  changePct: number;
  price?: number;
}

export interface SummaryHighlight {
  text: string;
  kind?: "up" | "down" | "neutral" | "news";
}

export interface DailySummaryPayload {
  asOf: string;
  source: string;
  sessionLabel: string;
  indices: SummaryIndexRow[];
  sectorLeaders: SummaryIndexRow[];
  sectorLaggards: SummaryIndexRow[];
  topGainers: { symbol: string; name: string; changePct: number }[];
  topLosers: { symbol: string; name: string; changePct: number }[];
  highlights: SummaryHighlight[];
  error?: boolean;
  message?: string;
}

export interface WeeklySummaryPayload {
  asOf: string;
  source: string;
  weekLabel: string;
  indices: SummaryIndexRow[];
  sectorLeaders: SummaryIndexRow[];
  sectorLaggards: SummaryIndexRow[];
  themes: { title: string; source?: string; url?: string }[];
  highlights: SummaryHighlight[];
  error?: boolean;
  message?: string;
}

export type CalendarImportance = "high" | "medium" | "low";

export interface CalendarEvent {
  id: string;
  date: string;
  /** Display time in HKT, e.g. "08:30" or "全天" */
  timeHkt: string;
  /** ISO timestamp if known */
  atIso?: string;
  name: string;
  nameZh?: string;
  country?: string;
  importance: CalendarImportance;
  forecast?: string;
  previous?: string;
}

export interface CalendarSummaryPayload {
  asOf: string;
  source: string;
  rangeLabel: string;
  events: CalendarEvent[];
  error?: boolean;
  message?: string;
}
