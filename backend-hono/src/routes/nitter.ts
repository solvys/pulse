import { Hono } from 'hono';
import { z } from 'zod';
import { fetchNitterNews, getNitterTrends, DEFAULT_NITTER_SOURCES } from '../services/nitter-service.js';

const nitterRoutes = new Hono();

// GET /nitter/news - Fetch latest news from Nitter sources
const newsSchema = z.object({
  sources: z.string().optional(), // comma-separated list of sources
  limit: z.coerce.number().min(1).max(50).default(20),
});

nitterRoutes.get('/news', async (c) => {
  const result = newsSchema.safeParse({
    sources: c.req.query('sources'),
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
    const { sources, limit } = result.data;

    // Parse sources or use defaults
    let nitterSources = DEFAULT_NITTER_SOURCES;
    if (sources) {
      const sourceHandles = sources.split(',').map(s => s.trim());
      nitterSources = DEFAULT_NITTER_SOURCES.filter(source =>
        sourceHandles.includes(source.handle)
      );
    }

    const news = await fetchNitterNews(nitterSources, Math.ceil(limit / nitterSources.length));

    // Limit total results
    const limitedNews = news.slice(0, limit);

    return c.json({
      success: true,
      data: {
        news: limitedNews,
        count: limitedNews.length,
        sources: nitterSources.map(s => s.handle),
      },
    });
  } catch (error) {
    console.error('Failed to fetch Nitter news:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch news from Nitter',
    }, 500);
  }
});

// GET /nitter/trends - Get trending topics from Nitter
nitterRoutes.get('/trends', async (c) => {
  try {
    const trends = await getNitterTrends();

    return c.json({
      success: true,
      data: {
        trends,
        count: trends.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Nitter trends:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch trends from Nitter',
    }, 500);
  }
});

// GET /nitter/sources - Get available Nitter sources
nitterRoutes.get('/sources', async (c) => {
  return c.json({
    success: true,
    data: {
      sources: DEFAULT_NITTER_SOURCES,
      count: DEFAULT_NITTER_SOURCES.length,
    },
  });
});

// POST /nitter/seed - Seed news database with Nitter data
nitterRoutes.post('/seed', async (c) => {
  try {
    // This will be implemented when the user provides their sources
    return c.json({
      success: true,
      message: 'Nitter seeding ready - waiting for source configuration',
    });
  } catch (error) {
    console.error('Failed to seed Nitter data:', error);
    return c.json({
      success: false,
      error: 'Failed to seed news data',
    }, 500);
  }
});

export { nitterRoutes };