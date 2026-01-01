/**
 * Official X (Twitter) Client
 * Handles direct API interactions with rate limit management
 */

import { env } from '../env.js';

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

// Financial news accounts to follow (migrated from Nitter client)
export const FINANCIAL_ACCOUNTS = [
    'financialjuice', // Primary - Financial Juice
    'insiderwire',    // Insider Wire
    'zaboradar',      // Walter Bloomberg
    'FirstSquawk',    // First Squawk
    'DeItaone',       // DeItaOne
    'unusual_whales', // Unusual Whales
];

// High-priority accounts for Level 3-4 prefetch
export const HIGH_PRIORITY_ACCOUNTS = [
    'financialjuice',
    'insiderwire',
];

class XClient {
    private rateLimitReset: number = 0;
    private rateLimitRemaining: number = 100; // Default pessimistic assumption until first call

    constructor() { }

    /**
     * Check if we are currently rate limited
     */
    private isRateLimited(): boolean {
        return Date.now() < this.rateLimitReset;
    }

    /**
     * Get seconds until rate limit reset
     */
    private getSecondsToReset(): number {
        return Math.max(0, Math.ceil((this.rateLimitReset - Date.now()) / 1000));
    }

    /**
     * Search recent tweets from a specific account with retry logic
     * Endpoint: GET /2/tweets/search/recent
     */
    async fetchAccountTweets(account: string, limit: number = 10, retryCount: number = 0): Promise<Tweet[]> {
        if (!env.X_BEARER_TOKEN) {
            console.error('[XClient] X_BEARER_TOKEN missing! Set X_BEARER_TOKEN in Fly.io secrets to enable X API fetching.');
            throw new Error('X_BEARER_TOKEN not configured. Please set it in Fly.io secrets.');
        }
        
        // Validate token format (should start with AAAA... for Bearer tokens)
        if (!env.X_BEARER_TOKEN.startsWith('AAAA')) {
            console.warn('[XClient] X_BEARER_TOKEN format may be incorrect. Bearer tokens typically start with "AAAA"');
        }

        if (this.isRateLimited()) {
            const secondsToReset = this.getSecondsToReset();
            console.warn(`[XClient] Rate Limited for ${account}. Resets in ${secondsToReset}s`);
            return [];
        }

        const query = `from:${account} -is:retweet`;
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second base delay

        try {
            // X API v2 endpoint - api.twitter.com is still the correct endpoint
            const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,author_id`;

            console.log(`[XClient] Fetching tweets from ${account} (attempt ${retryCount + 1}/${maxRetries + 1})`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${env.X_BEARER_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            // Handle Rate Limits headers
            const remaining = response.headers.get('x-rate-limit-remaining');
            const reset = response.headers.get('x-rate-limit-reset');

            if (remaining !== null) {
                this.rateLimitRemaining = parseInt(remaining, 10);
                console.log(`[XClient] Rate limit remaining: ${this.rateLimitRemaining}`);
            }
            
            if (reset !== null) {
                // X API sends epoch seconds - convert to milliseconds
                const resetSeconds = parseInt(reset, 10);
                this.rateLimitReset = resetSeconds * 1000;
                console.log(`[XClient] Rate limit resets at: ${new Date(this.rateLimitReset).toISOString()}`);
            }

            // Handle 429 Too Many Requests with exponential backoff retry
            if (response.status === 429) {
                const resetTime = reset ? parseInt(reset, 10) * 1000 : Date.now() + 900000; // Default 15 min if no header
                this.rateLimitReset = resetTime;
                
                if (retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
                    console.warn(`[XClient] 429 Too Many Requests for ${account}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.fetchAccountTweets(account, limit, retryCount + 1);
                } else {
                    console.error(`[XClient] 429 Too Many Requests for ${account}. Max retries reached. Reset at ${new Date(this.rateLimitReset).toISOString()}`);
                    return [];
                }
            }

            // Handle other non-OK responses
            if (!response.ok) {
                const errorText = await response.text();
                let errorData: any;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText };
                }
                
                // Log detailed error information
                console.error(`[XClient] X API Error ${response.status} for ${account}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData,
                    account,
                    url: url.substring(0, 100), // Log partial URL for debugging
                });

                // Handle 401/403 - Authentication errors (don't retry, token is invalid)
                if (response.status === 401 || response.status === 403) {
                    console.error(`[XClient] Authentication failed for ${account}. Check X_BEARER_TOKEN. Error:`, errorData);
                    throw new Error(`X API Authentication failed (${response.status}): ${JSON.stringify(errorData)}`);
                }

                // Retry on 5xx errors with exponential backoff
                if (response.status >= 500 && retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount);
                    console.warn(`[XClient] Server error for ${account}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.fetchAccountTweets(account, limit, retryCount + 1);
                }

                // For 4xx errors (except 401/403), throw to be caught by outer handler
                throw new Error(`X API Error ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json() as any;

            if (!data.data) {
                console.log(`[XClient] No data returned for ${account}`);
                return [];
            }

            const tweets = data.data.map((t: any) => ({
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

            console.log(`[XClient] Successfully fetched ${tweets.length} tweets from ${account}`);
            return tweets;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            // Don't retry on authentication errors (401/403)
            const isAuthError = errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Authentication');
            
            console.error(`[XClient] Failed to fetch from X API for ${account}:`, {
                account,
                error: errorMessage,
                stack: errorStack,
                retryCount,
                isAuthError,
            });

            // If it's an auth error, throw it up so caller knows the token is invalid
            if (isAuthError) {
                throw error; // Re-throw auth errors so they're visible
            }

            // Retry on network errors with exponential backoff
            if (retryCount < maxRetries && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
                const delay = baseDelay * Math.pow(2, retryCount);
                console.warn(`[XClient] Network error for ${account}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchAccountTweets(account, limit, retryCount + 1);
            }

            // Return empty array on final failure (fail gracefully for non-critical errors)
            console.warn(`[XClient] Returning empty array for ${account} after ${retryCount + 1} attempts`);
            return [];
        }
    }

    /**
     * Fetch formatted text cleaning (unescape HTML entities)
     */
    private cleanText(text: string): string {
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
    async fetchAllFinancialNews(limitPerAccount: number = 5): Promise<Tweet[]> {
        if (this.isRateLimited()) return [];

        const promises = FINANCIAL_ACCOUNTS.map(account =>
            this.fetchAccountTweets(account, limitPerAccount)
        );

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
