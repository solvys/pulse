import type { Context } from 'hono'
import { fetchPolymarket } from '../../services/polymarket-service.js'

/**
 * GET /api/polymarket/odds
 */
export async function handleGetOdds(c: Context) {
  try {
    const data = await fetchPolymarket()
    return c.json(data)
  } catch (error) {
    console.error('[Polymarket] odds error:', error)
    return c.json({ error: 'Failed to fetch Polymarket odds' }, 500)
  }
}

/**
 * GET /api/polymarket/updates
 * Alias to odds for now
 */
export async function handleGetUpdates(c: Context) {
  return handleGetOdds(c)
}

/**
 * POST /api/polymarket/sync
 * Forces cache refresh by bypassing cache on next call
 */
export async function handleSync(c: Context) {
  try {
    // simple refresh: fetch and drop result (fetchPolymarket caches internally)
    const data = await fetchPolymarket()
    return c.json({ success: true, markets: data.markets.length })
  } catch (error) {
    console.error('[Polymarket] sync error:', error)
    return c.json({ error: 'Failed to sync Polymarket data' }, 500)
  }
}
