import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';

const ivScoringRoutes = new Hono();

// GET /iv-scoring/calculate - Calculate IV score + implied points
const calculateSchema = z.object({
  symbol: z.string().min(1),
});

ivScoringRoutes.get('/calculate', async (c) => {
  const result = calculateSchema.safeParse({
    symbol: c.req.query('symbol'),
  });

  if (!result.success) {
    return c.json({ error: 'symbol query parameter required' }, 400);
  }

  const { symbol } = result.data;

  try {
    const [vix] = await sql`
      SELECT value FROM market_indicators
      WHERE indicator = 'VIX'
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const vixValue = vix?.value || 15;

    const [contract] = await sql`
      SELECT tick_value, tick_size FROM contracts
      WHERE symbol ILIKE ${symbol}
      LIMIT 1
    `;

    const tickValue = contract?.tick_value || 5;
    const tickSize = contract?.tick_size || 0.25;

    const ivScore = calculateIVScore(vixValue);
    const impliedPoints = calculateImpliedPoints(vixValue, tickValue, tickSize, symbol);

    return c.json({
      symbol,
      vixValue,
      ivScore,
      impliedPoints,
      riskLevel: getRiskLevel(ivScore),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to calculate IV score:', error);
    return c.json({ error: 'Failed to calculate IV score' }, 500);
  }
});

function calculateIVScore(vix: number): number {
  if (vix < 12) return 1;
  if (vix < 15) return 2;
  if (vix < 18) return 3;
  if (vix < 22) return 4;
  if (vix < 26) return 5;
  if (vix < 30) return 6;
  if (vix < 35) return 7;
  if (vix < 40) return 8;
  if (vix < 50) return 9;
  return 10;
}

function calculateImpliedPoints(
  vix: number,
  tickValue: number,
  tickSize: number,
  symbol: string
): { daily: number; session: number } {
  const contractMultipliers: Record<string, number> = {
    MNQ: 2,
    NQ: 20,
    MES: 5,
    ES: 50,
    MCL: 100,
    CL: 1000,
  };

  const multiplier = contractMultipliers[symbol.toUpperCase()] || 5;

  const dailyImplied = (vix / 16) * multiplier;
  const sessionImplied = dailyImplied * 0.6;

  return {
    daily: Math.round(dailyImplied * 100) / 100,
    session: Math.round(sessionImplied * 100) / 100,
  };
}

function getRiskLevel(ivScore: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (ivScore <= 3) return 'low';
  if (ivScore <= 5) return 'medium';
  if (ivScore <= 7) return 'high';
  return 'extreme';
}

export { ivScoringRoutes };
