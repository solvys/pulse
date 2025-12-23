// Core types for Pulse frontend

export type LayoutMode = 'combined' | 'tickers-only' | 'moveable';

export type NavSection = 'tape' | 'price' | 'riskflow' | 'journal' | 'econ';

export interface UserTier {
  label: string;
  value: string;
}

export interface VIXData {
  value: number;
  change: number;
  changePercent: number;
}

export interface IVScore {
  value: number;
  symbol: string;
}

// Journal types
export interface JournalStats {
  winRate: number;
  avgPnL: number;
  totalTrades: number;
  totalPnL: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  currentStreak: {
    type: 'win' | 'loss';
    count: number;
  };
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  pnl: number;
  tradeCount: number;
  status: 'profitable' | 'loss' | 'breakeven' | 'no-trades';
}

export interface DayDetail {
  date: string;
  netPnL: number;
  pnlByTime: Array<{ hour: number; pnl: number }>;
  orders: Array<{
    id: number;
    time: string;
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
  }>;
}

export interface ERData {
  erByTime: Array<{
    hour: number;
    score: number; // 0-10
  }>;
}

export interface BlindspotData {
  score: number; // 0-10
  summary: string;
}

// RiskFlow types
export interface SelectedInstrument {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface KPIData {
  label: string;
  value: number;
  data: Array<{ time: string; value: number }>;
}

export interface NewsPlanForDay {
  plan: string;
  events: Array<{
    time: string;
    currency: string;
    impact: 'low' | 'medium' | 'high';
    title: string;
  }>;
}

// Econ Calendar types
export interface EconPlan {
  date: string;
  plan: string;
  events: Array<{
    time: string;
    currency: string;
    impact: 'low' | 'medium' | 'high';
    title: string;
  }>;
  source: 'tradingview_screenshot' | 'manual';
  cachedAt: string;
}

// News/Tape types
export interface NewsItem {
  id: string;
  time: string;
  source: string;
  headline: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  ivImpact: number; // 0-10
  isBreaking?: boolean;
}
