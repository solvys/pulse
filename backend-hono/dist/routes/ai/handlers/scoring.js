/**
 * Scoring Handlers
 * IV score and VIX endpoints
 */
import { calculateIVScore, getCurrentIVScore, getIVScoreHistory, getCurrentVIX, } from '../../../services/scoring-service.js';
import { scoreRequestSchema, historySchema } from '../schemas.js';
export async function handleCalculateScore(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = scoreRequestSchema.safeParse(body);
    if (!result.success) {
        return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
    }
    try {
        const score = await calculateIVScore(userId, result.data.symbol, result.data.instrument);
        return c.json(score);
    }
    catch (error) {
        console.error('Failed to calculate IV score:', error);
        return c.json({ error: 'Failed to calculate IV score' }, 500);
    }
}
export async function handleGetScore(c) {
    const userId = c.get('userId');
    const symbol = c.req.query('symbol');
    if (!symbol) {
        return c.json({ error: 'Symbol parameter is required' }, 400);
    }
    try {
        const score = await getCurrentIVScore(userId, symbol);
        return c.json(score);
    }
    catch (error) {
        console.error('Failed to get IV score:', error);
        return c.json({
            score: 5,
            level: 'medium',
            timestamp: new Date().toISOString(),
        });
    }
}
export async function handleGetCurrentScore(c) {
    const userId = c.get('userId');
    try {
        const score = await getCurrentIVScore(userId);
        return c.json(score);
    }
    catch (error) {
        console.error('Failed to get current IV score:', error);
        return c.json({ error: 'Failed to get current IV score' }, 500);
    }
}
export async function handleGetScoreHistory(c) {
    const userId = c.get('userId');
    const result = historySchema.safeParse({
        symbol: c.req.query('symbol'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
    });
    if (!result.success) {
        return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
    }
    try {
        const history = await getIVScoreHistory(userId, result.data.symbol, result.data.limit, result.data.offset);
        return c.json(history);
    }
    catch (error) {
        console.error('Failed to get IV score history:', error);
        return c.json({ error: 'Failed to get IV score history' }, 500);
    }
}
export async function handleGetVIX(c) {
    try {
        const vix = await getCurrentVIX();
        return c.json(vix);
    }
    catch (error) {
        console.error('Failed to get VIX:', error);
        return c.json({ error: 'Failed to get VIX' }, 500);
    }
}
//# sourceMappingURL=scoring.js.map