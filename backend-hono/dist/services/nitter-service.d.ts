/**
 * Nitter Service
 * Scrapes news from Nitter (Twitter alternative) sources
 */
export interface NitterNewsItem {
    id: string;
    title: string;
    content: string;
    author: string;
    authorHandle: string;
    url: string;
    timestamp: string;
    likes: number;
    retweets: number;
    replies: number;
    images?: string[];
    hashtags?: string[];
    symbols?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    sentimentScore?: number;
    source: string;
    macroLevel?: 1 | 2 | 3 | 4;
}
export interface NitterSource {
    handle: string;
    name: string;
    category: 'financial' | 'business' | 'crypto' | 'politics' | 'general';
    priority: number;
}
/**
 * Default Nitter sources to follow
 * Updated with specified accounts for macroeconomic data tracking
 */
export declare const DEFAULT_NITTER_SOURCES: NitterSource[];
/**
 * Determine macroeconomic data level (1, 2, 3, or 4)
 * Level 4 is highest (emoji indicators), Level 1 is lowest (contextual)
 */
export declare function isMacroEconomicData(content: string): {
    isMacro: boolean;
    level: 1 | 2 | 3 | 4;
};
export declare function deduplicateNewsItems(items: NitterNewsItem[]): NitterNewsItem[];
/**
 * Classify emoji level (Level 4 importance)
 * Items with 🔴, ⚠️, or [🔴⚠️] are classified as Level 4
 */
export declare function classifyEmojiLevel(content: string): 4 | null;
/**
 * Fetch news from all configured Nitter sources
 * Applies macro filtering, deduplication, and emoji classification
 */
export declare function fetchNitterNews(sources?: NitterSource[], limitPerSource?: number): Promise<NitterNewsItem[]>;
/**
 * Store Nitter news items in the database with Price Brain scores
 */
export declare function storeNitterNewsInDatabase(items: NitterNewsItem[], priceBrainScores?: Map<string, {
    sentiment: string;
    classification: string;
    impliedPoints: number | null;
    instrument: string | null;
}>): Promise<void>;
/**
 * Process and store Nitter news end-to-end
 * Fetches, filters, scores, and stores news items
 */
export declare function processAndStoreNitterNews(userInstrument?: string): Promise<{
    count: number;
    items: NitterNewsItem[];
}>;
/**
 * Get trending financial topics from Nitter
 */
export declare function getNitterTrends(): Promise<string[]>;
//# sourceMappingURL=nitter-service.d.ts.map