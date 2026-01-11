/**
 * Market Routes
 * Route registration for /api/market endpoints
 */

import { Hono } from 'hono';
import { handleGetVix, handleGetQuote } from './handlers.js';

export function createMarketRoutes(): Hono {
  const router = new Hono();

  // GET /api/market/vix - Get current VIX value
  router.get('/vix', handleGetVix);

  // GET /api/market/quotes/:symbol - Get quote for symbol (future)
  router.get('/quotes/:symbol', handleGetQuote);

  return router;
}
