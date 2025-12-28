import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import { getCurrentVIX } from '../services/scoring-service.js';

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
    // Get current VIX data
    const vixData = await getCurrentVIX();
    const vixValue = vixData.value;

    // Get contract data for the symbol
    const [contract] = await sql`
      SELECT tick_value, tick_size FROM contracts
      WHERE symbol ILIKE ${symbol}
      LIMIT 1
    `;

    const tickValue = contract?.tick_value || 5;
    const tickSize = contract?.tick_size || 0.25;

    // Calculate IV score (0-10 scale based on VIX)
    const ivScore = Math.min(10, Math.max(1, Math.round((vixValue / 22) * 10 * 10) / 10));

    // Calculate implied points (volatility expectation)
    const impliedPoints = (vixValue / 100) * tickValue;

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    if (ivScore <= 3) riskLevel = 'low';
    else if (ivScore <= 6) riskLevel = 'medium';
    else if (ivScore <= 8) riskLevel = 'high';
    else riskLevel = 'extreme';

    return c.json({
      symbol,
      vix: vixValue,
      ivScore,
      impliedPoints,
      riskLevel,
      timestamp: new Date().toISOString(),
      source: vixData.source,
    });
  } catch (error) {
    console.error('Failed to calculate IV score:', error);
    return c.json({ error: 'Failed to calculate IV score' }, 500);
  }
});

// GET /iv-scoring/current - Get current market IV score
ivScoringRoutes.get('/current', async (c) => {
  try {
    const vixData = await getCurrentVIX();
    const vixValue = vixData.value;

    // Calculate overall market IV score
    const ivScore = Math.min(10, Math.max(1, Math.round((vixValue / 22) * 10 * 10) / 10));

    let marketCondition: 'calm' | 'normal' | 'volatile' | 'crisis';
    if (ivScore <= 2) marketCondition = 'calm';
    else if (ivScore <= 5) marketCondition = 'normal';
    else if (ivScore <= 8) marketCondition = 'volatile';
    else marketCondition = 'crisis';

    return c.json({
      vix: vixValue,
      ivScore,
      marketCondition,
      timestamp: new Date().toISOString(),
      source: vixData.source,
      interpretation: ivScore > 7 ? 'Bearish/Uncertain' : ivScore > 4 ? 'Neutral' : 'Bullish/Stable',
    });
  } catch (error) {
    console.error('Failed to get current IV score:', error);
    return c.json({ error: 'Failed to get current IV score' }, 500);
  }
});

export { ivScoringRoutes };