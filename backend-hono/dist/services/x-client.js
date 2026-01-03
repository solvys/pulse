/**
 * Official X (Twitter) Client
 * Handles direct API interactions with rate limit management
 */
import { env } from '../env.js';
// Financial news accounts to follow (migrated from Nitter client)
export const FINANCIAL_ACCOUNTS = [
    'financialjuice', // Primary - Financial Juice
    'zaboradar', // Walter Bloomberg
    'FirstSquawk', // First Squawk
    'DeItaone', // DeItaOne
    'unusual_whales', // Unusual Whales
];
class XClient {
    rateLimitReset = 0;
    rateLimitRemaining = 100; // Default pessimistic assumption until first call
    constructor() { }
    /**
     * Check if we are currently rate limited
     */
    isRateLimited() {
        return Date.now() < this.rateLimitReset;
    }
    /**
     * Get seconds until rate limit reset
     */
    getSecondsToReset() {
        return Math.max(0, Math.ceil((this.rateLimitReset - Date.now()) / 1000));
    }
    /**
     * Search recent tweets from a specific account
     * Endpoint: GET /2/tweets/search/recent
     */
    async fetchAccountTweets(account, limit = 10) {
        if (!env.X_BEARER_TOKEN) {
            console.warn('X_BEARER_TOKEN missing, skipping X API fetch');
            return [];
        }
        if (this.isRateLimited()) {
            console.warn(`X API Rate Limited. Resets in ${this.getSecondsToReset()}s`);
            return [];
        }
        const query = `from:${account} -is:retweet`;
        try {
            const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,author_id`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${env.X_BEARER_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });
            // Handle Rate Limits headers
            const remaining = response.headers.get('x-rate-limit-remaining');
            const reset = response.headers.get('x-rate-limit-reset');
            if (remaining)
                this.rateLimitRemaining = parseInt(remaining, 10);
            if (reset) {
                // X API sends epoch seconds
                this.rateLimitReset = parseInt(reset, 10) * 1000;
            }
            if (response.status === 429) {
                console.warn(`X API 429 Too Many Requests. Reset at ${new Date(this.rateLimitReset).toISOString()}`);
                return [];
            }
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`X API Error ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            if (!data.data)
                return [];
            return data.data.map((t) => ({
                id: t.id,
                text: this.cleanText(t.text),
                author: account,
                authorHandle: `@${account}`,
                createdAt: new Date(t.created_at),
                url: `https://twitter.com/${account}/status/${t.id}`,
                retweets: t.public_metrics?.retweet_count || 0,
                likes: t.public_metrics?.like_count || 0,
                isRetweet: false,
            }));
        }
        catch (error) {
            console.error(`Failed to fetch from Offical X API for ${account}:`, error);
            return []; // Fail gracefully
        }
    }
    /**
     * Fetch formatted text cleaning (unescape HTML entities)
     */
    cleanText(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Fetch from all monitored accounts in parallel (with concurrency limit optional, but simplified here)
     */
    async fetchAllFinancialNews(limitPerAccount = 5) {
        if (this.isRateLimited())
            return [];
        const promises = FINANCIAL_ACCOUNTS.map(account => this.fetchAccountTweets(account, limitPerAccount));
        const results = await Promise.all(promises);
        const allTweets = results.flat();
        // Sort by newest first
        return allTweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Get current client health/status
     */
    getStatus() {
        return {
            rateLimitRemaining: this.rateLimitRemaining,
            secondsToReset: this.getSecondsToReset(),
            isRateLimited: this.isRateLimited()
        };
    }
}
export const xClient = new XClient();
//# sourceMappingURL=x-client.js.map