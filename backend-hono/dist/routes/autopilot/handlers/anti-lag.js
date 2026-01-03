/**
 * Anti-Lag Handler
 * Detect anti-lag between primary and correlated pair
 */
import { detectAntiLag } from '../../../services/anti-lag-detector.js';
import { detectAntiLagSchema } from '../schemas.js';
export async function handleDetectAntiLag(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = detectAntiLagSchema.safeParse(body);
    if (!result.success) {
        return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
    }
    try {
        const detection = await detectAntiLag(userId, result.data.primarySymbol, result.data.correlatedSymbol, result.data.lookbackSeconds);
        return c.json(detection);
    }
    catch (error) {
        console.error('Failed to detect anti-lag:', error);
        return c.json({ error: 'Failed to detect anti-lag' }, 500);
    }
}
//# sourceMappingURL=anti-lag.js.map