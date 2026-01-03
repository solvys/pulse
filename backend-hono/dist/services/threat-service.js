/**
 * Threat History Service
 * Tracks and analyzes trading threats (overtrading, emotional indicators, consecutive losses)
 */
import { sql } from '../db/index.js';
import { getActiveBlindSpots } from './blind-spots-service.js';
/**
 * Get threat history for a user
 * Optionally filter to active threats (last 24 hours)
 */
export async function getThreatHistory(userId, activeOnly = false) {
    let threats;
    if (activeOnly) {
        // Get threats from last 24 hours
        threats = await sql `
      SELECT 
        id, user_id as "userId", type, severity, description,
        metadata, created_at as "createdAt"
      FROM threat_history
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `;
    }
    else {
        threats = await sql `
      SELECT 
        id, user_id as "userId", type, severity, description,
        metadata, created_at as "createdAt"
      FROM threat_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    }
    const formatted = threats.map((row) => ({
        id: row.id.toString(),
        type: row.type,
        severity: row.severity,
        description: row.description || '',
        timestamp: row.createdAt.toISOString(),
        metadata: row.metadata || {},
    }));
    return {
        threats: formatted,
    };
}
/**
 * Detect overtrading threat
 * Compares current trade count to user's "usual trades per duration" setting
 */
export async function detectOvertrading(userId, usualTradesPerDuration, durationWindow = '24 hours') {
    // Get trade count within duration window
    const [tradeCount] = await sql `
    SELECT COUNT(*)::integer as count
    FROM trades
    WHERE user_id = ${userId}
      AND opened_at >= NOW() - INTERVAL ${durationWindow}
  `;
    const currentCount = tradeCount?.count || 0;
    if (currentCount > usualTradesPerDuration) {
        const excess = currentCount - usualTradesPerDuration;
        const severity = excess > usualTradesPerDuration * 0.5
            ? 'critical'
            : excess > usualTradesPerDuration * 0.25
                ? 'high'
                : 'medium';
        const [threat] = await sql `
      INSERT INTO threat_history (
        user_id, type, severity, description, metadata
      )
      VALUES (
        ${userId},
        'overtrading',
        ${severity},
        ${`Overtrading detected: ${currentCount} trades vs usual ${usualTradesPerDuration} in ${durationWindow}`},
        ${JSON.stringify({
            tradeCount: currentCount,
            usualCount: usualTradesPerDuration,
            excess,
        })}
      )
      RETURNING 
        id, user_id as "userId", type, severity, description,
        metadata, created_at as "createdAt"
    `;
        return {
            id: threat.id.toString(),
            type: 'overtrading',
            severity: threat.severity,
            description: threat.description || '',
            timestamp: threat.createdAt.toISOString(),
            metadata: threat.metadata || {},
        };
    }
    return null;
}
/**
 * Detect consecutive losses
 */
export async function detectConsecutiveLosses(userId) {
    // Get recent trades ordered by opened_at
    const trades = await sql `
    SELECT pnl, opened_at
    FROM trades
    WHERE user_id = ${userId}
      AND closed_at IS NOT NULL
      AND pnl IS NOT NULL
    ORDER BY opened_at DESC
    LIMIT 10
  `;
    let consecutiveLosses = 0;
    let consecutiveLosingDays = 0;
    let lastDate = null;
    for (const trade of trades) {
        if (trade.pnl < 0) {
            consecutiveLosses++;
            const tradeDate = new Date(trade.opened_at).toDateString();
            if (tradeDate !== lastDate) {
                consecutiveLosingDays++;
                lastDate = tradeDate;
            }
        }
        else {
            break; // Stop counting on first win
        }
    }
    if (consecutiveLosses >= 3) {
        const severity = consecutiveLosses >= 7
            ? 'critical'
            : consecutiveLosses >= 5
                ? 'high'
                : 'medium';
        const [threat] = await sql `
      INSERT INTO threat_history (
        user_id, type, severity, description, metadata
      )
      VALUES (
        ${userId},
        'consecutive_losses',
        ${severity},
        ${`${consecutiveLosses} consecutive losses detected (${consecutiveLosingDays} losing days)`},
        ${JSON.stringify({
            consecutiveLosses,
            consecutiveLosingDays,
        })}
      )
      RETURNING 
        id, user_id as "userId", type, severity, description,
        metadata, created_at as "createdAt"
    `;
        return {
            id: threat.id.toString(),
            type: 'consecutive_losses',
            severity: threat.severity,
            description: threat.description || '',
            timestamp: threat.createdAt.toISOString(),
            metadata: threat.metadata || {},
        };
    }
    return null;
}
/**
 * Detect emotional trading indicators
 * Based on blind spots triggered and trading patterns
 */
export async function detectEmotionalTrading(userId) {
    // Get active blind spots
    const activeBlindSpots = await getActiveBlindSpots(userId);
    // Get recent trades for pattern analysis
    const recentTrades = await sql `
    SELECT pnl, opened_at, size, strategy
    FROM trades
    WHERE user_id = ${userId}
      AND opened_at >= NOW() - INTERVAL '24 hours'
    ORDER BY opened_at DESC
    LIMIT 20
  `;
    // Check for emotional patterns
    const emotionalIndicators = [];
    // Check for revenge trading (loss followed immediately by another trade)
    for (let i = 0; i < recentTrades.length - 1; i++) {
        const current = recentTrades[i];
        const next = recentTrades[i + 1];
        if (current.pnl < 0 && next) {
            const timeDiff = new Date(current.opened_at).getTime() -
                new Date(next.opened_at).getTime();
            if (timeDiff < 5 * 60 * 1000) {
                // Less than 5 minutes
                emotionalIndicators.push('revenge_trading');
                break;
            }
        }
    }
    // Check for size escalation after losses
    let hasSizeEscalation = false;
    for (let i = 0; i < recentTrades.length - 1; i++) {
        const current = recentTrades[i];
        const next = recentTrades[i + 1];
        if (current.pnl < 0 && next && next.size > current.size * 1.5) {
            hasSizeEscalation = true;
            emotionalIndicators.push('size_escalation');
            break;
        }
    }
    // Check blind spots triggered
    const triggeredBlindSpots = activeBlindSpots
        .filter((spot) => spot.isActive)
        .map((spot) => spot.name);
    if (emotionalIndicators.length > 0 || triggeredBlindSpots.length > 0) {
        const severity = emotionalIndicators.length >= 2 || triggeredBlindSpots.length >= 3
            ? 'high'
            : 'medium';
        const [threat] = await sql `
      INSERT INTO threat_history (
        user_id, type, severity, description, metadata
      )
      VALUES (
        ${userId},
        'emotional',
        ${severity},
        ${`Emotional trading indicators detected: ${emotionalIndicators.join(', ')}`},
        ${JSON.stringify({
            indicators: emotionalIndicators,
            blindSpotsTriggered: triggeredBlindSpots,
        })}
      )
      RETURNING 
        id, user_id as "userId", type, severity, description,
        metadata, created_at as "createdAt"
    `;
        return {
            id: threat.id.toString(),
            type: 'emotional',
            severity: threat.severity,
            description: threat.description || '',
            timestamp: threat.createdAt.toISOString(),
            metadata: threat.metadata || {},
        };
    }
    return null;
}
/**
 * Get daily P&L for threat analysis
 */
export async function getDailyPnL(userId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const [result] = await sql `
    SELECT COALESCE(SUM(pnl), 0) as daily_pnl
    FROM trades
    WHERE user_id = ${userId}
      AND DATE(opened_at) = ${targetDate}::date
      AND pnl IS NOT NULL
  `;
    return parseFloat(result?.daily_pnl || '0');
}
/**
 * Run comprehensive threat detection
 */
export async function detectThreats(userId, usualTradesPerDuration, durationWindow) {
    const threats = [];
    // Detect consecutive losses
    const consecutiveLosses = await detectConsecutiveLosses(userId);
    if (consecutiveLosses) {
        threats.push(consecutiveLosses);
    }
    // Detect emotional trading
    const emotional = await detectEmotionalTrading(userId);
    if (emotional) {
        threats.push(emotional);
    }
    // Detect overtrading (if settings provided)
    if (usualTradesPerDuration) {
        const overtrading = await detectOvertrading(userId, usualTradesPerDuration, durationWindow);
        if (overtrading) {
            threats.push(overtrading);
        }
    }
    return threats;
}
/**
 * Log a threat (for autopilot proposal rejections)
 */
export async function logThreat(userId, type, severity, description, metadata) {
    const [threat] = await sql `
    INSERT INTO threat_history (
      user_id, type, severity, description, metadata
    )
    VALUES (
      ${userId}, ${type}, ${severity}, ${description},
      ${metadata ? JSON.stringify(metadata) : null}
    )
    RETURNING 
      id, user_id as "userId", type, severity, description,
      metadata, created_at as "createdAt"
  `;
    return {
        id: threat.id.toString(),
        type: threat.type,
        severity: threat.severity,
        description: threat.description || '',
        timestamp: threat.createdAt.toISOString(),
        metadata: threat.metadata || {},
    };
}
//# sourceMappingURL=threat-service.js.map