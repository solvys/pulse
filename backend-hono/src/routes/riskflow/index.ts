/**
 * RiskFlow Routes
 * Route registration for /api/riskflow endpoints
 */

import { Hono } from 'hono';
import {
  handleGetFeed,
  handleGetBreaking,
  handleGetWatchlist,
  handleUpdateWatchlist,
  handleAddSymbols,
  handleRemoveSymbols,
} from './handlers.js';

export function createRiskFlowRoutes(): Hono {
  const router = new Hono();

  // GET /api/riskflow/feed - Get news feed
  router.get('/feed', handleGetFeed);

  // GET /api/riskflow/breaking - Get breaking news only
  router.get('/breaking', handleGetBreaking);

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
