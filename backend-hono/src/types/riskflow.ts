/**
 * RiskFlow Types
 * Type definitions for RiskFlow news feed
 */

export type NewsSource = 'FinancialJuice' | 'InsiderWire' | 'Reuters' | 'Bloomberg' | 'Custom';
export type UrgencyLevel = 'immediate' | 'high' | 'normal';
export type SentimentDirection = 'bullish' | 'bearish' | 'neutral';

export interface FeedItem {
  id: string;
  source: NewsSource;
  headline: string;
  body?: string;
  symbols: string[];
  tags: string[];
  isBreaking: boolean;
  urgency: UrgencyLevel;
  sentiment?: SentimentDirection;
  ivScore?: number;
  publishedAt: string;
  analyzedAt?: string;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  fetchedAt: string;
}

export interface FeedFilters {
  sources?: NewsSource[];
  symbols?: string[];
  tags?: string[];
  breakingOnly?: boolean;
  minIvScore?: number;
  limit?: number;
  cursor?: string;
}

export interface Watchlist {
  userId: string;
  symbols: string[];
  tags: string[];
  sources: NewsSource[];
  updatedAt: string;
}

export interface WatchlistUpdateRequest {
  symbols?: string[];
  tags?: string[];
  sources?: NewsSource[];
}

export interface WatchlistResponse {
  watchlist: Watchlist;
  success: boolean;
}
