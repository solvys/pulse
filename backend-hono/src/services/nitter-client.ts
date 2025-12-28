/**
 * Nitter Client
 * Manages multiple Nitter instances with rotation and fallback
 */

interface NitterInstance {
    url: string;
    healthy: boolean;
    lastCheck: Date;
    failureCount: number;
}

interface Tweet {
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

import { env } from '../env.js';

// Public Nitter instances - rotated to avoid rate limits
// Updated list based on recent availability
const NITTER_INSTANCES: string[] = [
    'https://nitter.lucabased.xyz',
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.woodland.cafe',
    'https://nitter.esmailelbob.xyz',
    'https://nitter.soopy.moe',
];

// Financial news accounts to follow
const FINANCIAL_ACCOUNTS = [
    'financialjuice', // Primary - Financial Juice
    'zaboradar',      // Walter Bloomberg
    'FirstSquawk',    // First Squawk
    'DeItaone',       // DeItaOne
    'unusual_whales', // Unusual Whales
];

class NitterClient {
    private instances: NitterInstance[];
    private currentIndex: number = 0;
    private useOfficialApi: boolean = false;

    constructor() {
        this.instances = NITTER_INSTANCES.map(url => ({
            url,
            healthy: true,
            lastCheck: new Date(),
            failureCount: 0,
        }));
    }

    /**
     * Get next healthy instance using round-robin
     */
    private getNextInstance(): NitterInstance | null {
        const startIndex = this.currentIndex;

        do {
            const instance = this.instances[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.instances.length;

            if (instance.healthy) {
                return instance;
            }

            // Check if enough time has passed to retry failed instance (5 minutes)
            const timeSinceLastCheck = Date.now() - instance.lastCheck.getTime();
            if (!instance.healthy && timeSinceLastCheck > 5 * 60 * 1000) {
                instance.healthy = true;
                instance.failureCount = 0;
                return instance;
            }
        } while (this.currentIndex !== startIndex);

        // All instances unhealthy - try the one with lowest failure count
        return this.instances.reduce((best, current) =>
            current.failureCount < best.failureCount ? current : best
        );
    }

    /**
     * Mark instance as failed
     */
    private markFailed(instance: NitterInstance): void {
        instance.failureCount++;
        instance.lastCheck = new Date();

        if (instance.failureCount >= 3) {
            instance.healthy = false;
            console.warn(`Nitter instance marked unhealthy: ${instance.url}`);
        }
    }

    /**
     * Mark instance as successful
     */
    private markSuccess(instance: NitterInstance): void {
        instance.healthy = true;
        instance.failureCount = 0;
        instance.lastCheck = new Date();
    }

    /**
     * Fetch from Official X API
     */
    private async fetchFromOfficialApi(account: string, limit: number): Promise<Tweet[]> {
        if (!env.X_BEARER_TOKEN) {
            throw new Error('No X API Bearer Token provided');
        }

        // Search recent tweets from user
        // Note: Free/Basic tier access is limited
        try {
            const query = `from:${account} -is:retweet`;
            const response = await fetch(
                `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,author_id,public_metrics,entities`,
                {
                    headers: {
                        'Authorization': `Bearer ${env.X_BEARER_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`X API Error ${response.status}: ${error}`);
            }

            const data = await response.json() as any;
            if (!data.data) return [];

            return data.data.map((t: any) => ({
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
        } catch (error) {
            console.error('Official X API fetch failed:', error);
            throw error;
        }
    }

    /**
     * Fetch tweets from a specific account
     */
    async fetchAccountTweets(account: string, limit: number = 20): Promise<Tweet[]> {
        // Try Official API first if enabled or if cached failure mode
        if (this.useOfficialApi) {
            try {
                return await this.fetchFromOfficialApi(account, limit);
            } catch (error) {
                console.warn('Official API failed, falling back to Nitter', error);
                this.useOfficialApi = false; // Switch back to Nitter
            }
        }

        const instance = this.getNextInstance();
        if (!instance) {
            // If all Nitter instances are down, try Official API as last resort
            if (env.X_BEARER_TOKEN) {
                console.log('All Nitter instances down, trying Official API...');
                try {
                    const tweets = await this.fetchFromOfficialApi(account, limit);
                    this.useOfficialApi = true; // Stick to official API for now
                    return tweets;
                } catch (err) {
                    console.error('Both Nitter and Official API failed');
                }
            }
            throw new Error('No healthy Nitter instances available');
        }

        try {
            const response = await fetch(`${instance.url}/${account}/rss`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0)',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const xml = await response.text();
            const tweets = this.parseRSS(xml, account);

            this.markSuccess(instance);
            return tweets.slice(0, limit);
        } catch (error) {
            console.error(`Nitter fetch failed (${instance.url}):`, error);
            this.markFailed(instance);

            // Retry with next instance
            const nextInstance = this.getNextInstance();
            if (nextInstance && nextInstance.url !== instance.url) {
                return this.fetchAccountTweets(account, limit);
            }

            // Final fallback to Official API
            if (env.X_BEARER_TOKEN) {
                try {
                    return await this.fetchFromOfficialApi(account, limit);
                } catch (apiErr) {
                    throw error; // Throw original Nitter error if API also fails
                }
            }

            throw error;
        }
    }

    /**
     * Parse RSS feed into tweets
     */
    private parseRSS(xml: string, defaultAuthor: string): Tweet[] {
        const tweets: Tweet[] = [];

        // Simple regex-based RSS parsing (avoids XML parser dependency)
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/;
        const linkRegex = /<link>([\s\S]*?)<\/link>/;
        const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
        const guidRegex = /<guid[^>]*>([\s\S]*?)<\/guid>/;

        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const item = match[1];

            const titleMatch = item.match(titleRegex);
            const linkMatch = item.match(linkRegex);
            const pubDateMatch = item.match(pubDateRegex);
            const guidMatch = item.match(guidRegex);

            if (titleMatch && linkMatch) {
                const text = (titleMatch[1] || titleMatch[2] || '').trim();
                const url = linkMatch[1].trim();
                const guid = guidMatch ? guidMatch[1].trim() : url;

                // Extract tweet ID from URL
                const idMatch = url.match(/\/status\/(\d+)/);
                const id = idMatch ? idMatch[1] : guid;

                // Check if it's a retweet
                const isRetweet = text.startsWith('RT @') || text.startsWith('RT by');

                tweets.push({
                    id,
                    text: this.cleanText(text),
                    author: defaultAuthor,
                    authorHandle: `@${defaultAuthor}`,
                    createdAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
                    url,
                    retweets: 0,
                    likes: 0,
                    isRetweet,
                });
            }
        }

        return tweets;
    }

    /**
     * Clean tweet text
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
     * Fetch tweets from all financial accounts
     */
    async fetchAllFinancialNews(limitPerAccount: number = 10): Promise<Tweet[]> {
        const results: Tweet[] = [];

        // Fetch from each account in parallel
        const promises = FINANCIAL_ACCOUNTS.map(async (account) => {
            try {
                const tweets = await this.fetchAccountTweets(account, limitPerAccount);
                return tweets;
            } catch (error) {
                console.warn(`Failed to fetch from @${account}:`, error);
                return [];
            }
        });

        const allTweets = await Promise.all(promises);

        for (const tweets of allTweets) {
            results.push(...tweets);
        }

        // Sort by date, newest first
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Deduplicate by ID
        const seen = new Set<string>();
        return results.filter(tweet => {
            if (seen.has(tweet.id)) return false;
            seen.add(tweet.id);
            return true;
        });
    }

    /**
     * Get instance health status
     */
    getHealthStatus(): { url: string; healthy: boolean; failures: number }[] {
        return this.instances.map(i => ({
            url: i.url,
            healthy: i.healthy,
            failures: i.failureCount,
        }));
    }
}

// Singleton instance
export const nitterClient = new NitterClient();

export { NitterClient, Tweet, FINANCIAL_ACCOUNTS };
