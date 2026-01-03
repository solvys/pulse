import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
const newsRoutes = new Hono();
// GET /news/feed - News feed with IV impact + sentiment
const feedSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    symbol: z.string().optional(),
});
newsRoutes.get('/feed', async (c) => {
    const result = feedSchema.safeParse({
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
        symbol: c.req.query('symbol'),
    });
    if (!result.success) {
        return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
    }
    const { limit, offset, symbol } = result.data;
    try {
        let news;
        if (symbol) {
            news = await sql `
        SELECT 
          id, title, summary, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking
        FROM news_articles
        WHERE ${symbol} = ANY(symbols)
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }
        else {
            news = await sql `
        SELECT 
          id, title, summary, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking
        FROM news_articles
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }
        return c.json({
            articles: news.map((n) => ({
                id: n.id,
                title: n.title,
                summary: n.summary,
                source: n.source,
                url: n.url,
                publishedAt: n.published_at,
                sentiment: n.sentiment,
                ivImpact: n.iv_impact,
                symbols: n.symbols || [],
                isBreaking: n.is_breaking || false,
            })),
        });
    }
    catch (error) {
        console.error('Failed to get news feed:', error);
        return c.json({ error: 'Failed to get news feed' }, 500);
    }
});
// ============================================================================
// Scheduled Events Endpoints (for Autopilot Integration)
// ============================================================================
// GET /news/scheduled - Get scheduled news events
const scheduledSchema = z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
});
newsRoutes.get('/scheduled', async (c) => {
    const result = scheduledSchema.safeParse({
        startTime: c.req.query('startTime'),
        endTime: c.req.query('endTime'),
    });
    if (!result.success) {
        return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
    }
    try {
        // Query scheduled_events table for future events
        const events = await sql `
      SELECT 
        id, title, scheduled_time, source, impact, symbols,
        is_commentary, event_type
      FROM scheduled_events
      WHERE scheduled_time >= ${result.data.startTime}::timestamp
        AND scheduled_time <= ${result.data.endTime}::timestamp
      ORDER BY scheduled_time ASC
    `;
        return c.json({
            events: events.map((event) => ({
                id: event.id.toString(),
                title: event.title,
                scheduledTime: event.scheduled_time.toISOString(),
                source: event.source || 'unknown',
                impact: event.impact,
                symbols: event.symbols || [],
                isCommentary: event.is_commentary || false,
                eventType: event.event_type,
            })),
        });
    }
    catch (error) {
        console.error('Failed to get scheduled events:', error);
        // Fallback: return empty array (assume no scheduled events)
        return c.json({ events: [] });
    }
});
// ============================================================================
// Breaking News Endpoints (for Autopilot Integration)
// ============================================================================
// GET /news/breaking - Get breaking news for symbol
newsRoutes.get('/breaking', async (c) => {
    const symbol = c.req.query('symbol');
    try {
        // Get breaking news from last 5-10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        let breakingNews;
        if (symbol) {
            // Get symbol-specific + general market breaking news
            breakingNews = await sql `
        SELECT 
          id, title, published_at, sentiment, iv_impact, symbols, is_breaking
        FROM news_articles
        WHERE is_breaking = true
          AND published_at >= ${tenMinutesAgo}
          AND (
            ${symbol} = ANY(symbols)
            OR symbols IS NULL
            OR array_length(symbols, 1) IS NULL
          )
          AND (
            iv_impact >= 4
            OR sentiment IN ('high', 'critical')
          )
        ORDER BY published_at DESC
        LIMIT 10
      `;
        }
        else {
            // Get all breaking news
            breakingNews = await sql `
        SELECT 
          id, title, published_at, sentiment, iv_impact, symbols, is_breaking
        FROM news_articles
        WHERE is_breaking = true
          AND published_at >= ${tenMinutesAgo}
          AND (
            iv_impact >= 4
            OR sentiment IN ('high', 'critical')
          )
        ORDER BY published_at DESC
        LIMIT 10
      `;
        }
        const hasBreakingNews = breakingNews.length > 0;
        // Calculate pause duration (5-10 minutes from most recent breaking news)
        let pausedUntil;
        if (hasBreakingNews && breakingNews[0]) {
            const mostRecent = new Date(breakingNews[0].published_at);
            const pauseDuration = 10 * 60 * 1000; // 10 minutes
            pausedUntil = new Date(mostRecent.getTime() + pauseDuration).toISOString();
        }
        // Map impact from iv_impact to low/medium/high
        const mapImpact = (ivImpact, sentiment) => {
            if (ivImpact && ivImpact >= 7)
                return 'high';
            if (ivImpact && ivImpact >= 4)
                return 'medium';
            if (sentiment === 'high' || sentiment === 'critical')
                return 'high';
            return 'low';
        };
        return c.json({
            hasBreakingNews,
            events: breakingNews.map((news) => ({
                id: news.id.toString(),
                title: news.title,
                publishedAt: news.published_at.toISOString(),
                impact: mapImpact(news.iv_impact, news.sentiment),
                symbols: news.symbols || [],
            })),
            pausedUntil,
        });
    }
    catch (error) {
        console.error('Failed to get breaking news:', error);
        // Fallback: assume no breaking news
        return c.json({
            hasBreakingNews: false,
            events: [],
        });
    }
});
// POST /news/seed - Seed news data (for development)
newsRoutes.post('/seed', async (c) => {
    try {
        return c.json({
            success: true,
            message: 'News seeding initiated',
        });
    }
    catch (error) {
        console.error('Failed to seed news:', error);
        return c.json({ error: 'Failed to seed news data' }, 500);
    }
});
export { newsRoutes };
//# sourceMappingURL=news.js.map