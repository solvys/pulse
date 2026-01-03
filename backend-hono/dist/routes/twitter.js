import { Hono } from 'hono';
import { z } from 'zod';
import { getMarketSentiment, searchFinancialTweets, getInfluentialTweets } from '../services/twitter-service.js';
const twitterRoutes = new Hono();
// GET /twitter/sentiment - Get market sentiment from Twitter
twitterRoutes.get('/sentiment', async (c) => {
    try {
        const symbols = c.req.query('symbols')?.split(',') || ['SPY', 'QQQ', 'TSLA', 'AAPL', 'NVDA'];
        const hoursBack = parseInt(c.req.query('hoursBack') || '24', 10);
        const sentiment = await getMarketSentiment(symbols, hoursBack);
        return c.json({
            success: true,
            data: sentiment,
        });
    }
    catch (error) {
        console.error('Failed to get Twitter sentiment:', error);
        return c.json({
            success: false,
            error: 'Failed to get market sentiment from Twitter',
        }, 500);
    }
});
// GET /twitter/search - Search for financial tweets
const searchSchema = z.object({
    query: z.string().min(1),
    limit: z.coerce.number().min(1).max(100).default(50),
});
twitterRoutes.get('/search', async (c) => {
    const result = searchSchema.safeParse({
        query: c.req.query('query'),
        limit: c.req.query('limit'),
    });
    if (!result.success) {
        return c.json({
            success: false,
            error: 'Invalid query parameters',
            details: result.error.flatten(),
        }, 400);
    }
    try {
        const { query, limit } = result.data;
        const searchResult = await searchFinancialTweets(query, limit);
        return c.json({
            success: true,
            data: searchResult,
        });
    }
    catch (error) {
        console.error('Failed to search tweets:', error);
        return c.json({
            success: false,
            error: 'Failed to search tweets',
        }, 500);
    }
});
// GET /twitter/influential - Get tweets from influential financial accounts
const influentialSchema = z.object({
    accounts: z.string().optional(), // comma-separated list of usernames
    limit: z.coerce.number().min(1).max(50).default(10),
});
twitterRoutes.get('/influential', async (c) => {
    const result = influentialSchema.safeParse({
        accounts: c.req.query('accounts'),
        limit: c.req.query('limit'),
    });
    if (!result.success) {
        return c.json({
            success: false,
            error: 'Invalid query parameters',
            details: result.error.flatten(),
        }, 400);
    }
    try {
        const { accounts, limit } = result.data;
        const usernames = accounts ? accounts.split(',').map(u => u.trim()) : undefined;
        const tweets = await getInfluentialTweets(usernames, limit);
        return c.json({
            success: true,
            data: {
                tweets,
                count: tweets.length,
            },
        });
    }
    catch (error) {
        console.error('Failed to get influential tweets:', error);
        return c.json({
            success: false,
            error: 'Failed to get influential tweets',
        }, 500);
    }
});
export { twitterRoutes };
//# sourceMappingURL=twitter.js.map