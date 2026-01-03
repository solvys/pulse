/**
 * News Service
 * Core service for fetching, processing, and storing financial news
 *
 * Schema matches migration 12: news_articles table in Neon PostgreSQL
 */
export interface NewsArticle {
    id: string;
    title: string;
    summary: string | null;
    content: string | null;
    source: string;
    url: string;
    publishedAt: string;
    sentiment: number | null;
    ivImpact: number | null;
    symbols: string[];
    isBreaking: boolean;
    macroLevel: number | null;
    priceBrainSentiment: string | null;
    priceBrainClassification: string | null;
    impliedPoints: number | null;
    instrument: string | null;
    authorHandle: string | null;
}
/**
 * Startup initialization to prefetch Polymarket odds and populate feed
 * Generates 5-10 initial "odds" notifications as requested
 */
export declare function initializePolymarketFeed(): Promise<void>;
/**
 * Fetch fresh news from multiple sources and store in database
 * Priority:
 * 1. Official X API (Speed + Reliability)
 * 2. Polymarket Signals (Macro/Sentiment)
 * 3. FMP News (Tertiary Fallback)
 */
export declare function fetchAndStoreNews(limit?: number): Promise<{
    fetched: number;
    stored: number;
}>;
/**
 * Get news feed from database
 */
export declare function getNewsFeed(options: {
    symbol?: string;
    limit?: number;
    offset?: number;
}): Promise<{
    articles: NewsArticle[];
    total: number;
}>;
/**
 * Get breaking news for autopilot pause decisions
 */
export declare function getBreakingNews(options: {
    symbol?: string;
    minutesBack?: number;
}): Promise<{
    hasBreaking: boolean;
    articles: NewsArticle[];
    pauseUntil: string | null;
}>;
//# sourceMappingURL=news-service%202.d.ts.map