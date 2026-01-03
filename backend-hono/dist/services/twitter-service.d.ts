/**
 * Twitter/X API Service
 * Fetches tweets, analyzes sentiment, and provides market insights from social media
 */
export interface Tweet {
    id: string;
    text: string;
    authorId: string;
    authorUsername: string;
    authorName: string;
    createdAt: string;
    publicMetrics: {
        retweetCount: number;
        replyCount: number;
        likeCount: number;
        quoteCount: number;
        bookmarkCount: number;
        impressionCount: number;
    };
    sentiment?: 'positive' | 'negative' | 'neutral';
    sentimentScore?: number;
    hashtags?: string[];
    symbols?: string[];
}
export interface TwitterSearchResult {
    tweets: Tweet[];
    meta: {
        count: number;
        nextToken?: string;
    };
}
export interface MarketSentiment {
    overall: 'bullish' | 'bearish' | 'neutral';
    score: number;
    tweetCount: number;
    positiveTweets: number;
    negativeTweets: number;
    neutralTweets: number;
    topSymbols: Array<{
        symbol: string;
        mentions: number;
        sentiment: number;
    }>;
    timestamp: string;
}
/**
 * Get market sentiment from Twitter data
 */
export declare function getMarketSentiment(symbols?: string[], hoursBack?: number): Promise<MarketSentiment>;
/**
 * Search for tweets about specific topics
 */
export declare function searchFinancialTweets(query: string, maxResults?: number): Promise<TwitterSearchResult>;
/**
 * Get tweets from influential financial accounts
 */
export declare function getInfluentialTweets(usernames?: string[], maxResults?: number): Promise<Tweet[]>;
//# sourceMappingURL=twitter-service.d.ts.map