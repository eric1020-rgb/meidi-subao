import type { ColorScheme, TideState } from "./types";

export const TIDE_LABELS: Record<
  TideState,
  { en: string; zh: string; descEn: string; descZh: string }
> = {
  high: {
    en: "Rising Tide",
    zh: "漲潮",
    descEn: "Inflow accelerating",
    descZh: "資金加速流入",
  },
  rotation: {
    en: "Rotation",
    zh: "輪動",
    descEn: "Inflow but slowing",
    descZh: "資金流入但放緩",
  },
  wait: {
    en: "Wait & See",
    zh: "觀望",
    descEn: "Outflow slowing",
    descZh: "資金流出但放緩",
  },
  low: {
    en: "Ebbing Tide",
    zh: "退潮",
    descEn: "Capital outflow",
    descZh: "資金流出",
  },
};

/** CSS variable names for tide states — values set by color scheme */
export function tideColorVar(state: TideState): string {
  return `var(--tide-${state})`;
}

export const SCHEME_VARS: Record<ColorScheme, Record<string, string>> = {
  /** US convention: green = up/inflow, red = down/outflow */
  us: {
    "--tide-high": "#22c55e",
    "--tide-rotation": "#eab308",
    "--tide-wait": "#94a3b8",
    "--tide-low": "#ef4444",
    "--up": "#22c55e",
    "--down": "#ef4444",
  },
  /** TW convention: red = up/inflow, green = down/outflow */
  tw: {
    "--tide-high": "#ef4444",
    "--tide-rotation": "#f59e0b",
    "--tide-wait": "#94a3b8",
    "--tide-low": "#22c55e",
    "--up": "#ef4444",
    "--down": "#22c55e",
  },
};

export function formatFlow(n: number, unit = "B"): string {
  const sign = n > 0 ? "+" : "";
  const abs = Math.abs(n);
  if (abs >= 100) return `${sign}${n.toFixed(0)}${unit}`;
  if (abs >= 10) return `${sign}${n.toFixed(1)}${unit}`;
  return `${sign}${n.toFixed(1)}${unit}`;
}

export function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
