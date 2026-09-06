/** US sector ETF universe + mega-cap seeds */

export interface SectorMeta {
  symbol: string;
  name: string;
  nameZh: string;
  leadTicker: string;
  leadName: string;
  /** For demo seed bias */
  bias: number;
}

export const SECTOR_ETFS: SectorMeta[] = [
  { symbol: "XLK", name: "Technology", nameZh: "科技", leadTicker: "NVDA", leadName: "NVIDIA", bias: 0.8 },
  { symbol: "XLF", name: "Financials", nameZh: "金融", leadTicker: "JPM", leadName: "JPMorgan", bias: 0.2 },
  { symbol: "XLE", name: "Energy", nameZh: "能源", leadTicker: "XOM", leadName: "Exxon", bias: -0.3 },
  { symbol: "XLV", name: "Health Care", nameZh: "醫療保健", leadTicker: "UNH", leadName: "UnitedHealth", bias: 0.1 },
  { symbol: "XLI", name: "Industrials", nameZh: "工業", leadTicker: "CAT", leadName: "Caterpillar", bias: 0.15 },
  { symbol: "XLY", name: "Consumer Disc.", nameZh: "非必需消費", leadTicker: "AMZN", leadName: "Amazon", bias: 0.35 },
  { symbol: "XLP", name: "Consumer Staples", nameZh: "必需消費", leadTicker: "PG", leadName: "Procter & Gamble", bias: -0.1 },
  { symbol: "XLU", name: "Utilities", nameZh: "公用事業", leadTicker: "NEE", leadName: "NextEra", bias: -0.25 },
  { symbol: "XLRE", name: "Real Estate", nameZh: "房地產", leadTicker: "PLD", leadName: "Prologis", bias: -0.2 },
  { symbol: "XLB", name: "Materials", nameZh: "原物料", leadTicker: "LIN", leadName: "Linde", bias: 0.05 },
  { symbol: "XLC", name: "Communication", nameZh: "通訊服務", leadTicker: "META", leadName: "Meta", bias: 0.55 },
  { symbol: "SMH", name: "Semiconductors", nameZh: "半導體", leadTicker: "NVDA", leadName: "NVIDIA", bias: 0.9 },
  { symbol: "XBI", name: "Biotech", nameZh: "生技", leadTicker: "VRTX", leadName: "Vertex", bias: 0.25 },
  { symbol: "ARKK", name: "Innovation", nameZh: "創新成長", leadTicker: "TSLA", leadName: "Tesla", bias: 0.4 },
  { symbol: "KWEB", name: "China Internet", nameZh: "中概互聯網", leadTicker: "BABA", leadName: "Alibaba", bias: -0.15 },
  { symbol: "ITA", name: "Aerospace & Def.", nameZh: "航太防衛", leadTicker: "LMT", leadName: "Lockheed", bias: 0.3 },
  { symbol: "XRT", name: "Retail", nameZh: "零售", leadTicker: "COST", leadName: "Costco", bias: 0.1 },
  { symbol: "GDX", name: "Gold Miners", nameZh: "黃金礦業", leadTicker: "NEM", leadName: "Newmont", bias: -0.35 },
  { symbol: "TAN", name: "Solar", nameZh: "太陽能", leadTicker: "ENPH", leadName: "Enphase", bias: -0.4 },
  { symbol: "BOTZ", name: "Robotics & AI", nameZh: "機器人與AI", leadTicker: "NVDA", leadName: "NVIDIA", bias: 0.7 },
];

export const MEGA_CAPS = [
  { symbol: "AAPL", name: "Apple", sector: "XLK" },
  { symbol: "MSFT", name: "Microsoft", sector: "XLK" },
  { symbol: "NVDA", name: "NVIDIA", sector: "SMH" },
  { symbol: "AMZN", name: "Amazon", sector: "XLY" },
  { symbol: "META", name: "Meta", sector: "XLC" },
  { symbol: "GOOGL", name: "Alphabet", sector: "XLC" },
  { symbol: "TSLA", name: "Tesla", sector: "XLY" },
  { symbol: "JPM", name: "JPMorgan", sector: "XLF" },
];

export function classifyTide(flow5d: number, acceleration: number): import("./types").TideState {
  if (flow5d >= 0 && acceleration >= 0) return "high";
  if (flow5d >= 0 && acceleration < 0) return "rotation";
  if (flow5d < 0 && acceleration >= 0) return "wait";
  return "low";
}
