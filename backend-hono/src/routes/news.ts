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
      news = await sql`
        SELECT 
          id, title, summary, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking
        FROM news_articles
        WHERE ${symbol} = ANY(symbols)
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      news = await sql`
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
  } catch (error) {
    console.error('Failed to get news feed:', error);
    return c.json({ error: 'Failed to get news feed' }, 500);
  }
});

export { newsRoutes };
