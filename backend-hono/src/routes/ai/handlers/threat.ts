/**
 * Threat Handlers
 * Threat history and analysis endpoints
 */

import { Context } from 'hono';
import { getThreatHistory, getDailyPnL } from '../../../services/threat-service.js';
import { generateThreatAnalysis } from '../../../services/ai-service.js';
import { threatAnalyzeSchema } from '../schemas.js';

export async function handleGetThreatHistory(c: Context) {
  const userId = c.get('userId');
  const activeOnly = c.req.query('active') === 'true';

  try {
    const threatHistory = await getThreatHistory(userId, activeOnly);
    return c.json(threatHistory);
  } catch (error) {
    console.error('Failed to get threat history:', error);
    return c.json({ error: 'Failed to get threat history' }, 500);
  }
}

export async function handleAnalyzeThreats(c: Context) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = threatAnalyzeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const threatHistory = await getThreatHistory(userId, false);
    const dailyPnL = await getDailyPnL(userId);

    if (result.data.includeAnalysis && threatHistory.threats.length > 0) {
      const threatData = JSON.stringify(threatHistory.threats, null, 2);
      const tradingHistory = `Daily P&L: ${dailyPnL}`;

      const analysis = await generateThreatAnalysis(threatData, tradingHistory);
      return c.json({
        ...threatHistory,
        analysis,
      });
    }

    return c.json(threatHistory);
  } catch (error) {
    console.error('Failed to analyze threats:', error);
    return c.json({ error: 'Failed to analyze threats' }, 500);
  }
}
