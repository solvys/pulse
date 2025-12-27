/**
 * API Type Definitions
 * 
 * These types match the expected API responses from your Hono backend.
 * Update these to match your actual backend response types.
 */

export interface NewsItem {
  id: string | number;
  title: string;
  content?: string;
  summary?: string;
  source: string;
  url?: string;
  publishedAt: Date | string;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'bullish' | 'bearish';
  ivImpact?: number;
  ivScore?: number;
  impact?: 'high' | 'medium' | 'low';
  symbols?: string[];
  isBreaking?: boolean;
  category?: string;
}

export interface Account {
  id: string | number | null;
  accountId?: string | number | null;
  accountName?: string | null;
  accountType?: string | null;
  userId?: string;
  balance: number;
  equity?: number;
  marginUsed?: number;
  buyingPower?: number;
  dailyPnl?: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: boolean;
  provider?: string;
  isPaper?: boolean;
  lastSyncedAt?: Date | string | null;
  algoEnabled?: boolean;
}

export interface Position {
  id: string | number;
  accountId?: number;
  contractId?: string;
  symbol?: string;
  quantity?: number;
  size?: number;
  entryPrice?: number;
  exitPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  side: string;
  openedAt: Date | string;
  closedAt?: Date | string | null;
  status?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  tiltWarning?: {
    detected: boolean;
    message?: string;
  };
}

export interface NTNReport {
  report: {
    content: string;
  };
}

export interface ProjectXAccount {
  accountId: string;
  accountName: string;
  balance?: number;
  provider?: string;
  isPaper?: boolean;
}

export interface BrokerAccount {
  accountId: string;
  accountName: string;
  balance?: number;
  provider?: string;
  isPaper?: boolean;
}
