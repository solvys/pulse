import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const newsRoutes = new Hono();

// GET /news - Main news list endpoint (alias for /news/feed)
newsRoutes.get('/', async (c) => {
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
          id, title, summary, content, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking,
          macro_level, price_brain_sentiment, price_brain_classification,
          implied_points, instrument, author_handle
        FROM news_articles
        WHERE ${symbol} = ANY(symbols)
        ORDER BY macro_level DESC NULLS LAST, published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      news = await sql`
        SELECT
          id, title, summary, content, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking,
          macro_level, price_brain_sentiment, price_brain_classification,
          implied_points, instrument, author_handle
        FROM news_articles
        ORDER BY macro_level DESC NULLS LAST, published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return c.json({
      items: news?.map((n: any) => ({
        id: n.id,
        title: n.title,
        summary: n.summary,
        content: n.content,
        source: n.source,
        url: n.url,
        publishedAt: n.published_at,
        sentiment: n.sentiment,
        ivImpact: n.iv_impact,
        symbols: n.symbols,
        isBreaking: n.is_breaking,
        macroLevel: n.macro_level,
        priceBrainScore: n.price_brain_sentiment || n.price_brain_classification ? {
          sentiment: n.price_brain_sentiment,
          classification: n.price_brain_classification,
          impliedPoints: n.implied_points,
          instrument: n.instrument,
        } : undefined,
        authorHandle: n.author_handle,
      })) || [],
      total: news?.length || 0,
    });
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return c.json({ error: 'Failed to fetch news' }, 500);
  }
});

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
          id, title, summary, content, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking,
          macro_level, price_brain_sentiment, price_brain_classification,
          implied_points, instrument, author_handle
        FROM news_articles
        WHERE ${symbol} = ANY(symbols)
        ORDER BY macro_level DESC NULLS LAST, published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      news = await sql`
        SELECT 
          id, title, summary, content, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking,
          macro_level, price_brain_sentiment, price_brain_classification,
          implied_points, instrument, author_handle
        FROM news_articles
        ORDER BY macro_level DESC NULLS LAST, published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return c.json({
      articles: news.map((n: any) => ({
        id: n.id,
        title: n.title,
        summary: n.summary,
        content: n.content,
        source: n.source,
        url: n.url,
        publishedAt: n.published_at,
        sentiment: n.sentiment,
        ivImpact: n.iv_impact,
        symbols: n.symbols || [],
        isBreaking: n.is_breaking || false,
        macroLevel: n.macro_level,
        priceBrainScore: n.price_brain_sentiment || n.price_brain_classification ? {
          sentiment: n.price_brain_sentiment,
          classification: n.price_brain_classification,
          impliedPoints: n.implied_points,
          instrument: n.instrument,
        } : undefined,
        authorHandle: n.author_handle,
      })),
    });
  } catch (error) {
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
    const events = await sql`
      SELECT 
        id, title, scheduled_time, source, impact, symbols,
        is_commentary, event_type
      FROM scheduled_events
      WHERE scheduled_time >= ${result.data.startTime}::timestamp
        AND scheduled_time <= ${result.data.endTime}::timestamp
      ORDER BY scheduled_time ASC
    `;

    return c.json({
      events: events.map((event: any) => ({
        id: event.id.toString(),
        title: event.title,
        scheduledTime: event.scheduled_time.toISOString(),
        source: event.source || 'unknown',
        impact: event.impact as 'low' | 'medium' | 'high',
        symbols: event.symbols || [],
        isCommentary: event.is_commentary || false,
        eventType: event.event_type,
      })),
    });
  } catch (error) {
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
      breakingNews = await sql`
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
    } else {
      // Get all breaking news
      breakingNews = await sql`
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
    let pausedUntil: string | undefined;
    if (hasBreakingNews && breakingNews[0]) {
      const mostRecent = new Date(breakingNews[0].published_at);
      const pauseDuration = 10 * 60 * 1000; // 10 minutes
      pausedUntil = new Date(mostRecent.getTime() + pauseDuration).toISOString();
    }

    // Map impact from iv_impact to low/medium/high
    const mapImpact = (ivImpact: number | null, sentiment: string | null): 'low' | 'medium' | 'high' => {
      if (ivImpact && ivImpact >= 7) return 'high';
      if (ivImpact && ivImpact >= 4) return 'medium';
      if (sentiment === 'high' || sentiment === 'critical') return 'high';
      return 'low';
    };

    return c.json({
      hasBreakingNews,
      events: breakingNews.map((news: any) => ({
        id: news.id.toString(),
        title: news.title,
        publishedAt: news.published_at.toISOString(),
        impact: mapImpact(news.iv_impact, news.sentiment),
        symbols: news.symbols || [],
      })),
      pausedUntil,
    });
  } catch (error) {
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
    // Sample news data for development
    const sampleNews = [
      {
        title: "Fed Signals Potential Rate Cuts Amid Economic Uncertainty",
        summary: "Federal Reserve officials indicated potential interest rate reductions as inflation shows signs of cooling, though labor market remains strong.",
        source: "Reuters",
        url: "https://example.com/fed-rate-cuts",
        sentiment: 0.3,
        iv_impact: 0.7,
        symbols: ["SPY", "QQQ", "ES"],
        is_breaking: false,
      },
      {
        title: "Tech Earnings Beat Expectations, AI Demand Drives Growth",
        summary: "Major technology companies reported stronger-than-expected quarterly earnings, with artificial intelligence investments showing significant returns.",
        source: "Bloomberg",
        url: "https://example.com/tech-earnings",
        sentiment: 0.8,
        iv_impact: 0.4,
        symbols: ["AAPL", "GOOGL", "MSFT", "NVDA"],
        is_breaking: true,
      },
      {
        title: "Oil Prices Surge on Middle East Tensions",
        summary: "Crude oil futures climbed over 3% following reports of escalated geopolitical tensions in the Middle East region.",
        source: "WSJ",
        url: "https://example.com/oil-prices-surge",
        sentiment: -0.6,
        iv_impact: 0.9,
        symbols: ["USO", "XLE", "WTI"],
        is_breaking: true,
      },
      {
        title: "Bitcoin Tests $100K Resistance Level",
        summary: "Cryptocurrency markets show renewed strength as institutional adoption increases and regulatory clarity improves.",
        source: "CoinDesk",
        url: "https://example.com/bitcoin-100k",
        sentiment: 0.5,
        iv_impact: 0.6,
        symbols: ["BTC", "ETH"],
        is_breaking: false,
      },
      {
        title: "Retail Sales Data Shows Consumer Resilience",
        summary: "Monthly retail sales figures exceeded expectations, indicating continued consumer spending power despite inflationary pressures.",
        source: "CNBC",
        url: "https://example.com/retail-sales",
        sentiment: 0.4,
        iv_impact: 0.3,
        symbols: ["XRT", "AMZN", "WMT"],
        is_breaking: false,
      },
      {
        title: "European Markets React to ECB Policy Shift",
        summary: "European Central Bank surprised markets with a more dovish stance than expected, leading to broad-based equity gains.",
        source: "FT",
        url: "https://example.com/ecb-policy",
        sentiment: 0.6,
        iv_impact: 0.5,
        symbols: ["EFA", "EWG"],
        is_breaking: false,
      },
      {
        title: "VIX Spikes on Market Volatility Concerns",
        summary: "Fear index rises sharply as investors react to mixed economic signals and geopolitical developments.",
        source: "MarketWatch",
        url: "https://example.com/vix-spike",
        sentiment: -0.7,
        iv_impact: 1.0,
        symbols: ["VXX", "SPY", "ES"],
        is_breaking: false,
      },
      {
        title: "Semiconductor Sector Shows Recovery Signs",
        summary: "Chip makers report improved outlook as inventory corrections near completion and demand from AI and cloud computing grows.",
        source: "Seeking Alpha",
        url: "https://example.com/semiconductor-recovery",
        sentiment: 0.7,
        iv_impact: 0.4,
        symbols: ["SOXX", "NVDA", "AMD", "TSM"],
        is_breaking: false,
      }
    ];

    // Insert sample news articles
    for (const article of sampleNews) {
      await sql`
        INSERT INTO news_articles (
          title, summary, source, url, published_at,
          sentiment, iv_impact, symbols, is_breaking
        ) VALUES (
          ${article.title},
          ${article.summary},
          ${article.source},
          ${article.url},
          NOW() - INTERVAL '${Math.floor(Math.random() * 24)} hours',
          ${article.sentiment},
          ${article.iv_impact},
          ${article.symbols},
          ${article.is_breaking}
        )
        ON CONFLICT (url) DO NOTHING
      `;
    }

    return c.json({
      success: true,
      message: 'News data seeded successfully',
      count: sampleNews.length,
    });
  } catch (error) {
    console.error('Failed to seed news:', error);
    return c.json({ error: 'Failed to seed news data' }, 500);
  }
});
export { newsRoutes };
