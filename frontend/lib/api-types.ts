// API Type Definitions - matching Hono backend responses

export interface Account {
  id: number;
  userId: string;
  tier: string;
  balance: number;
  equity: number;
  dailyPnl: number;
  marginUsed: number;
  algoEnabled: boolean;
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrokerAccount {
  id: number;
  accountId: string;
  accountName: string;
  accountType?: string;
  balance: number;
  equity: number;
  marginUsed: number;
  buyingPower: number;
  provider: string;
  isPaper: boolean;
  lastSyncedAt?: Date;
}

export interface Position {
  id: number;
  accountId: number;
  contractId?: string;
  symbol?: string;
  side: string;
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  openedAt: Date;
  closedAt?: Date;
  status: string;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  source: string;
  url?: string;
  publishedAt: Date;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'bullish' | 'bearish';
  symbols?: string[];
  ivScore?: number;
  impact?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface SystemEvent {
  id: number;
  userId: string;
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
}

export interface Trade {
  id: number;
  accountId: number;
  contractId?: string;
  symbol?: string;
  side: string;
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  openedAt: string;
  closedAt?: string;
  strategy?: string;
}

export interface ERSession {
  id: number;
  sessionStart: Date;
  sessionEnd: Date | null;
  finalScore: number;
  timeInTiltSeconds: number;
  infractionCount: number;
  sessionDurationSeconds: number;
  sessionDurationFormatted: string;
  maxTiltScore: number | null;
  maxTiltTime: Date | null;
  createdAt: Date;
}

export interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  read: boolean;
  createdAt: Date;
}

export interface Contract {
  id: number;
  name: string;
  symbol: string;
  description: string;
  tickSize: number;
  tickValue: number;
  active: boolean;
}

export interface Order {
  id: number;
  accountId: number;
  contractId?: string;
  symbol: string;
  side: string;
  orderType: string;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  status: string;
  filledSize: number;
  avgFillPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OvertradingStatus {
  isOvertrading: boolean;
  tradesInWindow: number;
  windowMinutes: number;
  threshold: number;
  recentTrades: Array<{
    symbol: string;
    openedAt: Date;
    side: string;
  }>;
  warning?: string;
}

export interface NewsNotification {
  id: number;
  title: string;
  message: string;
  ivScore?: number;
  type: string;
  read: boolean;
  createdAt: Date;
}