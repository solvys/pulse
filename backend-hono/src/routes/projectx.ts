import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const projectxRoutes = new Hono();

// GET /projectx/accounts - List user accounts
projectxRoutes.get('/accounts', async (c) => {
  const userId = c.get('userId');

  const rows = await sql`
    SELECT 
      id,
      account_id,
      account_name,
      account_type,
      balance,
      equity,
      margin_used,
      buying_power,
      last_synced_at
    FROM broker_accounts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return c.json({
    accounts: rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      accountName: row.account_name,
      accountType: row.account_type || undefined,
      balance: row.balance,
      equity: row.equity,
      marginUsed: row.margin_used,
      buyingPower: row.buying_power,
      provider: 'projectx',
      isPaper: false,
      lastSyncedAt: row.last_synced_at || undefined,
    })),
  });
});

// POST /projectx/sync - Sync TopStepX accounts
const syncSchema = z.object({
  username: z.string().min(1),
  apiKey: z.string().min(1),
});

projectxRoutes.post('/sync', async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const result = syncSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { username, apiKey } = result.data;

  try {
    await sql`
      INSERT INTO projectx_credentials (user_id, username, api_key)
      VALUES (${userId}, ${username}, ${apiKey})
      ON CONFLICT (user_id) 
      DO UPDATE SET username = ${username}, api_key = ${apiKey}, updated_at = NOW()
    `;

    return c.json({
      success: true,
      message: 'ProjectX credentials saved. Account sync initiated.',
    });
  } catch (error) {
    console.error('Failed to sync ProjectX:', error);
    return c.json({ error: 'Failed to sync accounts' }, 500);
  }
});

// GET /projectx/orders - List orders
const listOrdersSchema = z.object({
  accountId: z.coerce.number(),
});

projectxRoutes.get('/orders', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('accountId');

  if (!accountId) {
    return c.json({ error: 'accountId query parameter required' }, 400);
  }

  const result = listOrdersSchema.safeParse({ accountId });
  if (!result.success) {
    return c.json({ error: 'Invalid accountId' }, 400);
  }

  const orders = await sql`
    SELECT 
      id, account_id, contract_id, symbol, side, 
      order_type, size, limit_price, stop_price,
      status, filled_size, avg_fill_price,
      created_at, updated_at
    FROM orders
    WHERE user_id = ${userId} AND account_id = ${result.data.accountId}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return c.json({ orders });
});

// POST /projectx/order - Place order
const placeOrderSchema = z.object({
  accountId: z.number(),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  size: z.number().positive(),
  orderType: z.enum(['market', 'limit', 'stop', 'trailingStop', 'joinBid', 'joinAsk']),
  limitPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  trailPrice: z.number().optional(),
  customTag: z.string().optional(),
  stopLossTicks: z.number().optional(),
  takeProfitTicks: z.number().optional(),
});

projectxRoutes.post('/order', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = placeOrderSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const req = result.data;

  if (req.orderType === 'trailingStop' && !req.trailPrice) {
    return c.json({ error: 'trailPrice is required for trailingStop order type' }, 400);
  }

  if ((req.orderType === 'joinBid' || req.orderType === 'joinAsk') && !req.limitPrice) {
    return c.json({ error: 'limitPrice is required for joinBid and joinAsk order types' }, 400);
  }

  try {
    const [order] = await sql`
      INSERT INTO orders (
        user_id, account_id, symbol, side, order_type, size,
        limit_price, stop_price, status
      )
      VALUES (
        ${userId}, ${req.accountId}, ${req.symbol}, ${req.side}, 
        ${req.orderType}, ${req.size}, ${req.limitPrice || null}, 
        ${req.stopPrice || null}, 'pending'
      )
      RETURNING id
    `;

    await sql`
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'trade',
        'success',
        'Order Placed',
        ${`Order placed: ${req.side.toUpperCase()} ${req.size} ${req.symbol} @ ${req.orderType}`},
        ${JSON.stringify({ orderId: order.id, customTag: req.customTag })}
      )
    `;

    return c.json({
      orderId: order.id,
      status: 'submitted',
      message: 'Order placed successfully',
    });
  } catch (error) {
    console.error('Failed to place order:', error);
    return c.json({ error: 'Failed to place order' }, 500);
  }
});

// GET /projectx/contracts/:symbol - Get contract info
projectxRoutes.get('/contracts/:symbol', async (c) => {
  const symbol = c.req.param('symbol');

  const contracts = await sql`
    SELECT id, name, symbol, description, tick_size, tick_value, active
    FROM contracts
    WHERE symbol ILIKE ${`%${symbol}%`} OR name ILIKE ${`%${symbol}%`}
    LIMIT 10
  `;

  return c.json({ contracts });
});

export { projectxRoutes };
