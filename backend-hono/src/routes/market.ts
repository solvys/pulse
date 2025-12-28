import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const marketRoutes = new Hono();

// GET /market/data/:symbol - Get market data
marketRoutes.get('/data/:symbol', async (c) => {
  const symbol = c.req.param('symbol');

  try {
    const [contract] = await sql`
      SELECT id, name, symbol, description, tick_size, tick_value
      FROM contracts
      WHERE symbol ILIKE ${symbol} OR name ILIKE ${`%${symbol}%`}
      LIMIT 1
    `;

    if (!contract) {
      return c.json({ error: `No contract found for symbol: ${symbol}` }, 404);
    }

    return c.json({
      symbol: contract.symbol,
      name: contract.name,
      tickSize: contract.tick_size,
      tickValue: contract.tick_value,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get market data:', error);
    return c.json({ error: 'Failed to get market data' }, 500);
  }
});

// GET /market/bars/:symbol - Get historical bars
const barsSchema = z.object({
  unit: z.enum(['minute', 'hour', 'day', 'week']).default('minute'),
  barsBack: z.coerce.number().min(1).max(1000).default(100),
});

marketRoutes.get('/bars/:symbol', async (c) => {
  const symbol = c.req.param('symbol');

  const result = barsSchema.safeParse({
    unit: c.req.query('unit'),
    barsBack: c.req.query('barsBack'),
  });

  if (!result.success) {
    return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
  }

  const { unit, barsBack } = result.data;

  try {
    const bars = await sql`
      SELECT 
        timestamp, open, high, low, close, volume
      FROM market_bars
      WHERE symbol = ${symbol} AND unit = ${unit}
      ORDER BY timestamp DESC
      LIMIT ${barsBack}
    `;

    return c.json({
      symbol,
      unit,
      bars: bars.reverse(),
    });
  } catch (error) {
    console.error('Failed to get bars:', error);
    return c.json({ error: 'Failed to get historical bars' }, 500);
  }
});

// GET /market/vix - Get VIX data
marketRoutes.get('/vix', async (c) => {
  try {
    const [vix] = await sql`
      SELECT value, timestamp
      FROM market_indicators
      WHERE indicator = 'VIX'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    if (!vix) {
      return c.json({
        value: 15.0,
        timestamp: new Date().toISOString(),
        source: 'default',
      });
    }

    return c.json({
      value: vix.value,
      timestamp: vix.timestamp,
      source: 'database',
    });
  } catch (error) {
    console.error('Failed to get VIX:', error);
    return c.json({
      value: 15.0,
      timestamp: new Date().toISOString(),
      source: 'fallback',
    });
  }
});

// GET /market/contracts/search - Search contracts
marketRoutes.get('/contracts/search', async (c) => {
  const searchText = c.req.query('searchText') || '';
  const live = c.req.query('live') !== 'false';

  const contracts = await sql`
    SELECT id, name, symbol, description, tick_size, tick_value, active
    FROM contracts
    WHERE (symbol ILIKE ${`%${searchText}%`} OR name ILIKE ${`%${searchText}%`})
      AND (${!live} OR active = true)
    LIMIT 20
  `;

  return c.json({
    contracts: contracts.map((c: any) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      description: c.description,
      tickSize: c.tick_size,
      tickValue: c.tick_value,
      activeContract: c.active,
    })),
  });
});

export { marketRoutes };
