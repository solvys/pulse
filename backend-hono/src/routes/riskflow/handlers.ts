/**
 * RiskFlow Handlers
 * Request handlers for RiskFlow endpoints
 */

import type { Context } from 'hono';
import * as feedService from '../../services/riskflow/feed-service.js';
import * as watchlistService from '../../services/riskflow/watchlist-service.js';
import { addClient, removeClient } from '../../services/riskflow/sse-broadcaster.js';
import { corsConfig } from '../../config/cors.js';
import type { FeedFilters, WatchlistUpdateRequest, NewsSource, MacroLevel } from '../../types/riskflow.js';

/**
 * Internal function to trigger feed pre-fetching
 * This is called by the cron job endpoint
 */
async function preFetchFeed(): Promise<{ success: boolean; itemsFetched: number; error?: string }> {
  try {
    // Force a fresh fetch by calling getFeed with a dummy userId
    // This will trigger the X API fetch and database storage
    const result = await feedService.getFeed('cron-job', { limit: 50 });
    return {
      success: true,
      itemsFetched: result.items.length,
    };
  } catch (error) {
    console.error('[RiskFlow] Pre-fetch error:', error);
    return {
      success: false,
      itemsFetched: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * GET /api/riskflow/feed
 * Get news feed with optional filters
 */
export async function handleGetFeed(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Parse query parameters
    const filters: FeedFilters = {};

    const sources = c.req.query('sources');
    if (sources) {
      filters.sources = sources.split(',') as NewsSource[];
    }

    const symbols = c.req.query('symbols');
    if (symbols) {
      filters.symbols = symbols.split(',');
    }

    const tags = c.req.query('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }

    const breakingOnly = c.req.query('breaking');
    if (breakingOnly === 'true') {
      filters.breakingOnly = true;
    }

    const limit = c.req.query('limit');
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    // Allow override of minMacroLevel via query param (for debugging/fallback)
    const minMacroLevel = c.req.query('minMacroLevel');
    if (minMacroLevel) {
      const level = parseInt(minMacroLevel, 10);
      if (level >= 1 && level <= 4) {
        filters.minMacroLevel = level as MacroLevel;
      }
    }

    console.log(`[RiskFlow] handleGetFeed called for user ${userId} with filters:`, JSON.stringify(filters));
    
    const feed = await feedService.getFeed(userId, filters);
    
    // Log feed response for debugging
    console.log(`[RiskFlow] Feed response for user ${userId}: ${feed.items.length} items (total: ${feed.total}, hasMore: ${feed.hasMore})`);
    if (feed.items.length === 0) {
      console.warn(`[RiskFlow] Empty feed returned - check database cache and filters`);
      console.warn(`[RiskFlow] Feed response structure:`, JSON.stringify({
        items: feed.items,
        total: feed.total,
        hasMore: feed.hasMore,
        fetchedAt: feed.fetchedAt
      }));
    }
    
    // Ensure we always return a valid FeedResponse structure
    const response = {
      items: feed.items || [],
      total: feed.total || 0,
      hasMore: feed.hasMore || false,
      fetchedAt: feed.fetchedAt || new Date().toISOString(),
      ...(feed.nextCursor && { nextCursor: feed.nextCursor })
    };
    
    console.log(`[RiskFlow] Returning response with ${response.items.length} items`);
    return c.json(response);
  } catch (error) {
    console.error('[RiskFlow] Feed error:', error);
    console.error('[RiskFlow] Error stack:', error instanceof Error ? error.stack : 'No stack');
    // Return empty response structure instead of error to prevent frontend crashes
    return c.json({
      items: [],
      total: 0,
      hasMore: false,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to fetch feed'
    }, 500);
  }
}

/**
 * GET /api/riskflow/breaking
 * Get breaking news only
 */
export async function handleGetBreaking(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const feed = await feedService.getBreakingNews(userId);
    return c.json(feed);
  } catch (error) {
    console.error('[RiskFlow] Breaking news error:', error);
    return c.json({ error: 'Failed to fetch breaking news' }, 500);
  }
}

/**
 * GET /api/riskflow/preload
 * Pre-load 15 tweets from last 48 hours, level 3+ only
 */
export async function handlePreload(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const feed = await feedService.getFeed(userId, {
      limit: 15,
      minMacroLevel: 3,
    });
    return c.json({
      ...feed,
      preloaded: true,
      timeWindow: '48h',
    });
  } catch (error) {
    console.error('[RiskFlow] Preload error:', error);
    return c.json({ error: 'Failed to preload feed' }, 500);
  }
}

/**
 * GET /api/riskflow/watchlist
 * Get user watchlist
 */
export async function handleGetWatchlist(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const watchlist = watchlistService.getWatchlist(userId);
  return c.json({ watchlist, success: true });
}

/**
 * POST /api/riskflow/watchlist
 * Update user watchlist
 */
export async function handleUpdateWatchlist(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<WatchlistUpdateRequest>().catch(() => ({}));
    const watchlist = watchlistService.updateWatchlist(userId, body);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Watchlist update error:', error);
    return c.json({ error: 'Failed to update watchlist' }, 500);
  }
}

/**
 * POST /api/riskflow/watchlist/symbols
 * Add symbols to watchlist
 */
export async function handleAddSymbols(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<{ symbols: string[] }>().catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: 'Symbols array is required' }, 400);
    }

    const watchlist = watchlistService.addSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Add symbols error:', error);
    return c.json({ error: 'Failed to add symbols' }, 500);
  }
}

/**
 * DELETE /api/riskflow/watchlist/symbols
 * Remove symbols from watchlist
 */
export async function handleRemoveSymbols(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<{ symbols: string[] }>().catch(() => ({ symbols: [] }));

    if (!body.symbols?.length) {
      return c.json({ error: 'Symbols array is required' }, 400);
    }

    const watchlist = watchlistService.removeSymbols(userId, body.symbols);
    return c.json({ watchlist, success: true });
  } catch (error) {
    console.error('[RiskFlow] Remove symbols error:', error);
    return c.json({ error: 'Failed to remove symbols' }, 500);
  }
}

/**
 * GET /api/riskflow/stream
 * SSE stream for Level 4 alerts
 * Note: EventSource doesn't support custom headers, so auth token is passed via query param
 */
export async function handleBreakingStream(c: Context) {
  const userId = c.get('userId') || 'anonymous';
  console.log(`[SSE] New connection from user: ${userId}`);
  
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  // Get origin from request for CORS
  const origin = c.req.header('origin') || c.req.header('Origin');
  // Check if origin is in allowed list, otherwise use first allowed origin
  const allowedOrigins = Array.isArray(corsConfig.origin) ? corsConfig.origin : [corsConfig.origin];
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Stream started for user: ${userId}`);
      addClient(controller, userId);
      
      // Send initial connection message to confirm stream is working
      try {
        controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      } catch (error) {
        console.error('[SSE] Failed to send initial message', error);
      }
      
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch (error) {
          console.warn('[SSE] Heartbeat failed, closing stream', error);
          heartbeatId && clearInterval(heartbeatId);
          removeClient(controller);
        }
      }, 30000);
    },
    cancel(controller) {
      console.log(`[SSE] Stream cancelled for user: ${userId}`);
      if (heartbeatId) {
        clearInterval(heartbeatId);
      }
      removeClient(controller);
    },
  });

  // Set CORS headers on context first (Hono will merge with response headers)
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Cache-Control');
  c.header('X-Accel-Buffering', 'no'); // Disable buffering in nginx/proxy

  console.log(`[SSE] Returning SSE response for user: ${userId}, origin: ${origin}`);
  
  // Return the stream response - Hono will handle it correctly
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * GET /api/riskflow/debug
 * Debug endpoint to check database state
 */
export async function handleDebug(c: Context) {
  const userId = c.get('userId') as string | undefined;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { sql, isDatabaseAvailable } = await import('../../config/database.js');
    
    if (!isDatabaseAvailable() || !sql) {
      return c.json({ error: 'Database not available' }, 503);
    }

    // Get raw counts
    const totalCount = await sql`SELECT COUNT(*) as count FROM news_feed_items`;
    const recentCount = await sql`
      SELECT COUNT(*) as count FROM news_feed_items 
      WHERE published_at >= NOW() - INTERVAL '48 hours'
    `;
    const level3Count = await sql`
      SELECT COUNT(*) as count FROM news_feed_items 
      WHERE published_at >= NOW() - INTERVAL '48 hours' 
        AND (macro_level IS NULL OR macro_level >= 3)
    `;
    const sampleItems = await sql`
      SELECT id, headline, source, macro_level, published_at, is_breaking
      FROM news_feed_items
      ORDER BY published_at DESC
      LIMIT 5
    `;

    return c.json({
      database: {
        total: Number(totalCount[0]?.count ?? 0),
        recent48h: Number(recentCount[0]?.count ?? 0),
        level3Plus: Number(level3Count[0]?.count ?? 0),
      },
      sample: sampleItems,
      env: {
        hasXApiToken: !!process.env.X_API_BEARER_TOKEN,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  } catch (error) {
    console.error('[RiskFlow] Debug error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Debug failed' }, 500);
  }
}

/**
 * POST /api/riskflow/cron/prefetch
 * Cron job endpoint to pre-fetch and store news items
 * Protected by CRON_SECRET_TOKEN environment variable
 */
export async function handleCronPrefetch(c: Context) {
  // Verify cron secret token
  const providedToken = c.req.header('X-Cron-Secret') || c.req.query('token');
  const expectedToken = process.env.CRON_SECRET_TOKEN;

  if (!expectedToken) {
    console.warn('[RiskFlow] CRON_SECRET_TOKEN not configured');
    return c.json({ error: 'Cron job not configured' }, 500);
  }

  if (providedToken !== expectedToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await preFetchFeed();
  const statusCode = result.success ? 200 : 500;
  return c.json(result, statusCode);
}
