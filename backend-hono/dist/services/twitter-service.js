/**
 * Twitter/X API Service
 * Fetches tweets, analyzes sentiment, and provides market insights from social media
 */
import { sql } from '../db/index.js';
/**
 * Twitter API v2 client
 */
class TwitterAPIClient {
    bearerToken;
    baseUrl = 'https://api.twitter.com/2';
    constructor(bearerToken) {
        this.bearerToken = bearerToken;
    }
    async request(endpoint, params) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Search for recent tweets
     */
    async searchTweets(query, maxResults = 100) {
        const params = {
            query,
            'tweet.fields': 'id,text,author_id,created_at,public_metrics,entities',
            'user.fields': 'id,username,name',
            'expansions': 'author_id',
            'max_results': maxResults.toString(),
        };
        const data = await this.request('/tweets/search/recent', params);
        const tweets = data.data?.map((tweet) => {
            const author = data.includes?.users?.find((user) => user.id === tweet.author_id);
            return {
                id: tweet.id,
                text: tweet.text,
                authorId: tweet.author_id,
                authorUsername: author?.username || 'unknown',
                authorName: author?.name || 'Unknown',
                createdAt: tweet.created_at,
                publicMetrics: tweet.public_metrics,
                hashtags: tweet.entities?.hashtags?.map((h) => h.tag) || [],
                symbols: this.extractSymbols(tweet.text),
            };
        }) || [];
        return {
            tweets,
            meta: {
                count: tweets.length,
                nextToken: data.meta?.next_token,
            },
        };
    }
    /**
     * Get user tweets
     */
    async getUserTweets(username, maxResults = 10) {
        // First get user ID
        const userData = await this.request('/users/by/username/' + username);
        const userId = userData.data?.id;
        if (!userId) {
            throw new Error(`User ${username} not found`);
        }
        const params = {
            'tweet.fields': 'id,text,author_id,created_at,public_metrics,entities',
            'user.fields': 'id,username,name',
            'expansions': 'author_id',
            'max_results': maxResults.toString(),
        };
        const data = await this.request(`/users/${userId}/tweets`, params);
        const tweets = data.data?.map((tweet) => {
            const author = data.includes?.users?.find((user) => user.id === tweet.author_id);
            return {
                id: tweet.id,
                text: tweet.text,
                authorId: tweet.author_id,
                authorUsername: author?.username || username,
                authorName: author?.name || 'Unknown',
                createdAt: tweet.created_at,
                publicMetrics: tweet.public_metrics,
                hashtags: tweet.entities?.hashtags?.map((h) => h.tag) || [],
                symbols: this.extractSymbols(tweet.text),
            };
        }) || [];
        return {
            tweets,
            meta: {
                count: tweets.length,
                nextToken: data.meta?.next_token,
            },
        };
    }
    /**
     * Extract stock symbols from tweet text
     */
    extractSymbols(text) {
        // Match $SYMBOL pattern and common stock tickers
        const symbolRegex = /\$([A-Z]{1,5})/g;
        const matches = text.match(symbolRegex) || [];
        return matches.map(match => match.substring(1)); // Remove the $
    }
}
/**
 * Analyze sentiment of tweet text
 */
function analyzeTweetSentiment(text) {
    const lowerText = text.toLowerCase();
    // Positive indicators
    const positiveWords = ['bullish', 'buy', 'long', 'up', 'gain', 'profit', 'moon', 'pump', 'green', 'higher', 'rally', 'breakout', 'surge', 'soar'];
    const negativeWords = ['bearish', 'sell', 'short', 'down', 'loss', 'crash', 'dump', 'red', 'lower', 'drop', 'fall', 'plunge', 'tank', 'bleed'];
    let score = 0;
    positiveWords.forEach(word => {
        const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
        score += count * 0.1;
    });
    negativeWords.forEach(word => {
        const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
        score -= count * 0.1;
    });
    // Add intensity based on exclamation marks and caps
    const exclamationCount = (text.match(/!/g) || []).length;
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (exclamationCount > 0)
        score += exclamationCount * 0.05;
    if (capsRatio > 0.3)
        score += 0.1; // YELLING = more intense
    // Normalize score
    score = Math.max(-1, Math.min(1, score));
    let sentiment;
    if (score > 0.1)
        sentiment = 'positive';
    else if (score < -0.1)
        sentiment = 'negative';
    else
        sentiment = 'neutral';
    return { sentiment, score };
}
/**
 * Get market sentiment from Twitter data
 */
export async function getMarketSentiment(symbols = ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA'], hoursBack = 24) {
    try {
        // Create Twitter client (bearer token from env)
        const bearerToken = process.env.X_BEARER_TOKEN || process.env.xBearerToken;
        if (!bearerToken) {
            throw new Error('Twitter Bearer Token not configured');
        }
        const twitter = new TwitterAPIClient(bearerToken);
        // Build search query for financial symbols
        const symbolQueries = symbols.map(symbol => `$${symbol}`).join(' OR ');
        const query = `(${symbolQueries}) -is:retweet -is:reply lang:en`;
        // Search for tweets
        const searchResult = await twitter.searchTweets(query, 100);
        // Analyze sentiment
        const tweetsWithSentiment = searchResult.tweets.map(tweet => ({
            ...tweet,
            ...analyzeTweetSentiment(tweet.text),
        }));
        // Calculate overall sentiment
        const totalTweets = tweetsWithSentiment.length;
        const positiveTweets = tweetsWithSentiment.filter(t => t.sentiment === 'positive').length;
        const negativeTweets = tweetsWithSentiment.filter(t => t.sentiment === 'negative').length;
        const neutralTweets = tweetsWithSentiment.filter(t => t.sentiment === 'neutral').length;
        const avgScore = tweetsWithSentiment.reduce((sum, t) => sum + t.sentimentScore, 0) / totalTweets;
        // Determine overall sentiment
        let overall;
        if (avgScore > 0.05)
            overall = 'bullish';
        else if (avgScore < -0.05)
            overall = 'bearish';
        else
            overall = 'neutral';
        // Analyze symbol mentions
        const symbolStats = new Map();
        tweetsWithSentiment.forEach(tweet => {
            tweet.symbols?.forEach(symbol => {
                if (!symbolStats.has(symbol)) {
                    symbolStats.set(symbol, { mentions: 0, totalSentiment: 0 });
                }
                const stats = symbolStats.get(symbol);
                stats.mentions++;
                stats.totalSentiment += tweet.sentimentScore;
            });
        });
        const topSymbols = Array.from(symbolStats.entries())
            .map(([symbol, stats]) => ({
            symbol,
            mentions: stats.mentions,
            sentiment: stats.totalSentiment / stats.mentions,
        }))
            .sort((a, b) => b.mentions - a.mentions)
            .slice(0, 10);
        // Cache results in database
        try {
            await sql `
        INSERT INTO market_indicators (symbol, indicator_type, value, timestamp, metadata)
        VALUES ('MARKET_SENTIMENT', 'TWITTER_SENTIMENT', ${avgScore}, NOW(), ${JSON.stringify({
                overall,
                positiveTweets,
                negativeTweets,
                neutralTweets,
                topSymbols,
                tweetCount: totalTweets
            })})
        ON CONFLICT (symbol, indicator_type, timestamp)
        DO NOTHING
      `;
        }
        catch (dbError) {
            console.warn('Failed to cache Twitter sentiment:', dbError);
        }
        return {
            overall,
            score: avgScore,
            tweetCount: totalTweets,
            positiveTweets,
            negativeTweets,
            neutralTweets,
            topSymbols,
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error('Failed to get market sentiment from Twitter:', error);
        // Return cached or default data
        try {
            const [cached] = await sql `
        SELECT value, metadata, timestamp
        FROM market_indicators
        WHERE indicator_type = 'TWITTER_SENTIMENT'
        ORDER BY timestamp DESC
        LIMIT 1
      `;
            if (cached) {
                const metadata = typeof cached.metadata === 'string'
                    ? JSON.parse(cached.metadata)
                    : cached.metadata;
                return {
                    overall: metadata.overall || 'neutral',
                    score: cached.value,
                    tweetCount: metadata.tweetCount || 0,
                    positiveTweets: metadata.positiveTweets || 0,
                    negativeTweets: metadata.negativeTweets || 0,
                    neutralTweets: metadata.neutralTweets || 0,
                    topSymbols: metadata.topSymbols || [],
                    timestamp: cached.timestamp,
                };
            }
        }
        catch (dbError) {
            console.error('Failed to get cached sentiment:', dbError);
        }
        // Return default
        return {
            overall: 'neutral',
            score: 0,
            tweetCount: 0,
            positiveTweets: 0,
            negativeTweets: 0,
            neutralTweets: 0,
            topSymbols: [],
            timestamp: new Date().toISOString(),
        };
    }
}
/**
 * Search for tweets about specific topics
 */
export async function searchFinancialTweets(query, maxResults = 50) {
    try {
        const bearerToken = process.env.X_BEARER_TOKEN || process.env.xBearerToken;
        if (!bearerToken) {
            throw new Error('Twitter Bearer Token not configured');
        }
        const twitter = new TwitterAPIClient(bearerToken);
        // Add financial context to query
        const financialQuery = `${query} (stock OR market OR trading OR finance OR economy) -is:retweet lang:en`;
        const result = await twitter.searchTweets(financialQuery, maxResults);
        // Analyze sentiment for each tweet
        const tweetsWithSentiment = result.tweets.map(tweet => ({
            ...tweet,
            ...analyzeTweetSentiment(tweet.text),
        }));
        return {
            tweets: tweetsWithSentiment,
            meta: result.meta,
        };
    }
    catch (error) {
        console.error('Failed to search financial tweets:', error);
        return {
            tweets: [],
            meta: { count: 0 },
        };
    }
}
/**
 * Get tweets from influential financial accounts
 */
export async function getInfluentialTweets(usernames = ['cnbc', 'business', 'WSJmarkets', 'FinancialTimes', 'BloombergTV'], maxResults = 5) {
    try {
        const bearerToken = process.env.X_BEARER_TOKEN || process.env.xBearerToken;
        if (!bearerToken) {
            throw new Error('Twitter Bearer Token not configured');
        }
        const twitter = new TwitterAPIClient(bearerToken);
        const allTweets = [];
        for (const username of usernames.slice(0, 3)) { // Limit to 3 accounts to avoid rate limits
            try {
                const result = await twitter.getUserTweets(username, maxResults);
                const tweetsWithSentiment = result.tweets.map(tweet => ({
                    ...tweet,
                    ...analyzeTweetSentiment(tweet.text),
                }));
                allTweets.push(...tweetsWithSentiment);
            }
            catch (error) {
                console.warn(`Failed to get tweets from ${username}:`, error);
            }
        }
        // Sort by engagement (likes + retweets)
        return allTweets
            .sort((a, b) => {
            const aEngagement = a.publicMetrics.likeCount + a.publicMetrics.retweetCount;
            const bEngagement = b.publicMetrics.likeCount + b.publicMetrics.retweetCount;
            return bEngagement - aEngagement;
        })
            .slice(0, maxResults * 3);
    }
    catch (error) {
        console.error('Failed to get influential tweets:', error);
        return [];
    }
}
//# sourceMappingURL=twitter-service.js.map