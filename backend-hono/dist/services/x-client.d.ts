/**
 * Official X (Twitter) Client
 * Handles direct API interactions with rate limit management
 */
export interface Tweet {
    id: string;
    text: string;
    author: string;
    authorHandle: string;
    createdAt: Date;
    url: string;
    retweets: number;
    likes: number;
    isRetweet: boolean;
}
export declare const FINANCIAL_ACCOUNTS: string[];
declare class XClient {
    private rateLimitReset;
    private rateLimitRemaining;
    constructor();
    /**
     * Check if we are currently rate limited
     */
    private isRateLimited;
    /**
     * Get seconds until rate limit reset
     */
    private getSecondsToReset;
    /**
     * Search recent tweets from a specific account
     * Endpoint: GET /2/tweets/search/recent
     */
    fetchAccountTweets(account: string, limit?: number): Promise<Tweet[]>;
    /**
     * Fetch formatted text cleaning (unescape HTML entities)
     */
    private cleanText;
    /**
     * Fetch from all monitored accounts in parallel (with concurrency limit optional, but simplified here)
     */
    fetchAllFinancialNews(limitPerAccount?: number): Promise<Tweet[]>;
    /**
     * Get current client health/status
     */
    getStatus(): {
        rateLimitRemaining: number;
        secondsToReset: number;
        isRateLimited: boolean;
    };
}
export declare const xClient: XClient;
export {};
//# sourceMappingURL=x-client.d.ts.map