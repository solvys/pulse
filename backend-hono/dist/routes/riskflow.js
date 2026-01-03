/**
 * RiskFlow Routes
 * News feed endpoints for financial news aggregation
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getNewsFeed, getBreakingNews, fetchAndStoreNews, } from '../services/news-service.js';
const riskflowRoutes = new Hono();
// Track if initial fetch has been done
let initialFetchDone = false;
// Query schemas
const feedQuerySchema = z.object({
    symbol: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(15),
    offset: z.coerce.number().min(0).default(0),
});
/**
 * Initialize news feed on first request (lazy initialization)
 * Fetches 15 articles if database is empty
 */
async function ensureNewsInitialized() {
    if (initialFetchDone)
        return;
    try {
        const { articles } = await getNewsFeed({ limit: 1 });
        if (articles.length === 0) {
            console.log('[RiskFlow] No news in database, fetching initial batch...');
            const result = await fetchAndStoreNews(15);
            console.log(`[RiskFlow] Initial fetch complete: ${result.fetched} fetched, ${result.stored} stored`);
        }
        initialFetchDone = true;
    }
    catch (error) {
        console.warn('[RiskFlow] Initial fetch failed:', error);
        initialFetchDone = true; // Don't retry every request
    }
}
/**
 * GET /riskflow/feed
 * Get paginated news feed with optional symbol filter
 */
riskflowRoutes.get('/feed', async (c) => {
    await ensureNewsInitialized();
    const query = feedQuerySchema.safeParse({
        symbol: c.req.query('symbol'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
    });
    if (!query.success) {
        return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400);
    }
    try {
        const { articles, total } = await getNewsFeed(query.data);
        return c.json({
            articles: articles.map(a => ({
                id: a.id,
                title: a.title,
                summary: a.summary,
                content: a.content,
                source: a.source,
                url: a.url,
                publishedAt: a.publishedAt,
                sentiment: a.sentiment,
                ivImpact: a.ivImpact,
                symbols: a.symbols,
                isBreaking: a.isBreaking,
                macroLevel: a.macroLevel,
                priceBrainSentiment: a.priceBrainSentiment,
                priceBrainClassification: a.priceBrainClassification,
                impliedPoints: a.impliedPoints,
                authorHandle: a.authorHandle,
            })),
            total,
            hasMore: query.data.offset + articles.length < total,
        });
    }
    catch (error) {
        console.error('Failed to get RiskFlow feed:', error);
        return c.json({ error: 'Failed to get RiskFlow feed' }, 500);
    }
});
/**
 * GET /riskflow - Alias for /feed (legacy support)
 */
riskflowRoutes.get('/', async (c) => {
    await ensureNewsInitialized();
    const query = feedQuerySchema.safeParse({
        symbol: c.req.query('symbol'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
    });
    if (!query.success) {
        return c.json({ error: 'Invalid query parameters' }, 400);
    }
    try {
        const { articles, total } = await getNewsFeed(query.data);
        return c.json({
            items: articles.map(a => ({
                id: a.id,
                title: a.title,
                content: a.content,
                source: a.source,
                author: a.authorHandle,
                url: a.url,
                timestamp: a.publishedAt,
                macroLevel: a.macroLevel,
                symbols: a.symbols,
                sentiment: a.priceBrainSentiment,
            })),
            total,
        });
    }
    catch (error) {
        return c.json({ error: 'Failed to get RiskFlow' }, 500);
    }
});
/**
 * GET /riskflow/breaking
 * Get breaking news for autopilot pause decisions
 */
riskflowRoutes.get('/breaking', async (c) => {
    const symbol = c.req.query('symbol');
    const minutesBack = c.req.query('minutesBack');
    try {
        const { hasBreaking, articles, pauseUntil } = await getBreakingNews({
            symbol,
            minutesBack: minutesBack ? parseInt(minutesBack) : 10,
        });
        return c.json({
            hasBreakingRiskFlow: hasBreaking,
            events: articles.map(a => ({
                id: a.id,
                title: a.title,
                macroLevel: a.macroLevel,
                publishedAt: a.publishedAt,
                sentiment: a.priceBrainSentiment,
            })),
            pauseUntil,
            pauseDurationMs: pauseUntil ? Math.max(0, new Date(pauseUntil).getTime() - Date.now()) : 0,
        });
    }
    catch (error) {
        return c.json({ hasBreakingRiskFlow: false, events: [], pauseUntil: null, pauseDurationMs: 0 });
    }
});
/**
 * POST /riskflow/refresh
 * Manually refresh news feed from X API
 */
riskflowRoutes.post('/refresh', async (c) => {
    try {
        const result = await fetchAndStoreNews(15);
        return c.json({ success: true, ...result });
    }
    catch (error) {
        return c.json({ success: false, error: 'Failed to refresh' }, 500);
    }
});
export { riskflowRoutes };
//# sourceMappingURL=riskflow.js.map