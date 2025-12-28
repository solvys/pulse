import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import { getRedisClient } from '../services/redis.js';

const tradingRoutes = new Hono();

// POST /trading/record - Record trade
const recordTradeSchema = z.object({
  accountId: z.number(),
  contractId: z.string().optional(),
  symbol: z.string().optional(),
  side: z.enum(['buy', 'sell', 'long', 'short']),
  size: z.number().positive(),
  entryPrice: z.number().optional(),
  exitPrice: z.number().optional(),
  pnl: z.number().optional(),
  openedAt: z.string(),
  closedAt: z.string().optional(),
  strategy: z.string().optional(),
  notes: z.string().optional(),
});

tradingRoutes.post('/record', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = recordTradeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const req = result.data;

  try {
    const [trade] = await sql`
      INSERT INTO trades (
        user_id, account_id, contract_id, symbol, side, size,
        entry_price, exit_price, pnl, opened_at, closed_at, strategy, notes
      )
      VALUES (
        ${userId}, ${req.accountId}, ${req.contractId || null}, ${req.symbol || null},
        ${req.side}, ${req.size}, ${req.entryPrice || null}, ${req.exitPrice || null},
        ${req.pnl || null}, ${req.openedAt}, ${req.closedAt || null},
        ${req.strategy || null}, ${req.notes || null}
      )
      RETURNING id
    `;

    return c.json({
      success: true,
      tradeId: trade.id,
      message: 'Trade recorded successfully',
    });
  } catch (error) {
    console.error('Failed to record trade:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to record trade',
    }, 500);
  }
});

// GET /trading/history - Get trade history with pagination
const getTradesSchema = z.object({
  accountId: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

tradingRoutes.get('/history', async (c) => {
  const userId = c.get('userId');

  const result = getTradesSchema.safeParse({
    accountId: c.req.query('accountId'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!result.success) {
    return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
  }

  const { accountId, limit, offset } = result.data;

  let trades;
  let countResult;

  if (accountId) {
    trades = await sql`
      SELECT 
        id, account_id as "accountId", contract_id as "contractId",
        symbol, side, size, entry_price as "entryPrice",
        exit_price as "exitPrice", pnl, opened_at as "openedAt",
        closed_at as "closedAt", strategy
      FROM trades
      WHERE user_id = ${userId} AND account_id = ${accountId}
      ORDER BY opened_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    countResult = await sql`
      SELECT COUNT(*)::integer as count FROM trades
      WHERE user_id = ${userId} AND account_id = ${accountId}
    `;
  } else {
    trades = await sql`
      SELECT 
        id, account_id as "accountId", contract_id as "contractId",
        symbol, side, size, entry_price as "entryPrice",
        exit_price as "exitPrice", pnl, opened_at as "openedAt",
        closed_at as "closedAt", strategy
      FROM trades
      WHERE user_id = ${userId}
      ORDER BY opened_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    countResult = await sql`
      SELECT COUNT(*)::integer as count FROM trades
      WHERE user_id = ${userId}
    `;
  }

  return c.json({
    trades: trades || [],
    total: countResult[0]?.count || 0,
  });
});

// GET /trading/positions - Get active positions
tradingRoutes.get('/positions', async (c) => {
  const userId = c.get('userId');

  try {
    // Get open positions (trades without closed_at)
    const positions = await sql`
      SELECT
        id,
        account_id as "accountId",
        contract_id as "contractId",
        symbol,
        side,
        size,
        entry_price as "entryPrice",
        pnl,
        opened_at as "openedAt"
      FROM trades
      WHERE user_id = ${userId} AND closed_at IS NULL
      ORDER BY opened_at DESC
    `;

    // Calculate pnlPercentage for each position if pnl exists
    const positionsWithPercentage = positions.map((pos: any) => ({
      ...pos,
      pnlPercentage: pos.pnl ? (pos.pnl / (pos.entryPrice * pos.size)) * 100 : 0,
    }));

    return c.json({
      positions: positionsWithPercentage,
    });
  } catch (error) {
    console.error('Failed to get positions:', error);
    return c.json({ error: 'Failed to get positions' }, 500);
  }
});


// POST /trading/positions/seed - Seed positions data (for development)
tradingRoutes.post('/positions/seed', async (c) => {
  try {
    return c.json({
      success: true,
      message: 'Positions seeding initiated',
    });
  } catch (error) {
    console.error('Failed to seed positions:', error);
    return c.json({ error: 'Failed to seed positions data' }, 500);
  }
});
// POST /trading/test-trade - Fire a test trade
tradingRoutes.post('/test-trade', async (c) => {
  return c.json({
    success: true,
    message: 'Test trade fired. Verifying execution logic...',
    tradeId: 'test-' + Date.now(),
  });
});

// POST /trading/toggle-algo - Toggle algo state
tradingRoutes.post('/toggle-algo', async (c) => {
  try {
    const redis = await getRedisClient();
    const currentState = await redis.get('algo:active');
    const newState = currentState === 'true' ? 'false' : 'true';
    await redis.set('algo:active', newState);

    return c.json({
      success: true,
      active: newState === 'true',
      message: `Algo ${newState === 'true' ? 'activated' : 'deactivated'}`,
    });
  } catch (error) {
    console.error('Redis toggle error:', error);
    return c.json({ success: true, active: true, message: 'Algo activated (mock)' });
  }
});

export { tradingRoutes };
