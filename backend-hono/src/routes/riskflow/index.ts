/**
 * RiskFlow Routes
 * Route registration for /api/riskflow endpoints
 */

import { Hono } from 'hono';
import {
  handleGetFeed,
  handleGetBreaking,
  handlePreload,
  handleGetWatchlist,
  handleUpdateWatchlist,
  handleAddSymbols,
  handleRemoveSymbols,
  handleBreakingStream,
} from './handlers.js';

export function createRiskFlowRoutes(): Hono {
  const router = new Hono();

  // GET /api/riskflow/feed - Get news feed
  router.get('/feed', handleGetFeed);

  // GET /api/riskflow/breaking - Get breaking news only
  router.get('/breaking', handleGetBreaking);

  // GET /api/riskflow/stream - Level 4 SSE updates
  router.get('/stream', handleBreakingStream);

  // GET /api/riskflow/preload - Pre-load 15 tweets, last 48h, level 3+
  router.get('/preload', handlePreload);

  // GET /api/riskflow/watchlist - Get user watchlist
  router.get('/watchlist', handleGetWatchlist);

  // POST /api/riskflow/watchlist - Update watchlist
  router.post('/watchlist', handleUpdateWatchlist);

  // POST /api/riskflow/watchlist/symbols - Add symbols
  router.post('/watchlist/symbols', handleAddSymbols);

  // DELETE /api/riskflow/watchlist/symbols - Remove symbols
  router.delete('/watchlist/symbols', handleRemoveSymbols);

  return router;
}
