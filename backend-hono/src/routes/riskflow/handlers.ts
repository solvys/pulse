/**
 * RiskFlow Handlers
 * Request handlers for RiskFlow endpoints
 */

import type { Context } from 'hono';
import * as feedService from '../../services/riskflow/feed-service.js';
import * as watchlistService from '../../services/riskflow/watchlist-service.js';
import { addClient, removeClient } from '../../services/riskflow/sse-broadcaster.js';
import type { FeedFilters, WatchlistUpdateRequest, NewsSource } from '../../types/riskflow.js';

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

    const feed = await feedService.getFeed(userId, filters);
    return c.json(feed);
  } catch (error) {
    console.error('[RiskFlow] Feed error:', error);
    return c.json({ error: 'Failed to fetch feed' }, 500);
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
 */
export async function handleBreakingStream(c: Context) {
  const userId = c.get('userId') || 'anonymous';
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      addClient(controller, userId);
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
      if (heartbeatId) {
        clearInterval(heartbeatId);
      }
      removeClient(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
