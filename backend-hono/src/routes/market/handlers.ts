/**
 * Market Handlers
 * Request handlers for market data endpoints
 */

import type { Context } from 'hono';
import * as marketService from '../../services/market-service.js';

/**
 * GET /api/market/vix
 * Get current VIX value
 */
export async function handleGetVix(c: Context) {
  try {
    const vixData = await marketService.getVix();
    return c.json(vixData);
  } catch (error) {
    console.error('[Market] VIX fetch error:', error);
    // If missing API key or upstream failure, return 503 so frontend doesn't trust mock data
    return c.json({ error: 'Failed to fetch VIX data (upstream unavailable)' }, 503);
  }
}

/**
 * GET /api/market/quotes/:symbol
 * Get quote for a specific symbol (placeholder for future)
 */
export async function handleGetQuote(c: Context) {
  const symbol = c.req.param('symbol');

  if (!symbol) {
    return c.json({ error: 'Symbol is required' }, 400);
  }

  try {
    const quote = await marketService.getQuote(symbol.toUpperCase());
    return c.json(quote);
  } catch (error) {
    console.error('[Market] Quote fetch error:', error);
    return c.json({ error: 'Failed to fetch quote' }, 500);
  }
}
