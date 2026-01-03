/**
 * Propose Handler
 * Creates a trading proposal with risk validation
 */
import { sql } from '../../../db/index.js';
import { checkThreatHistory, checkBlindSpots, getIVScore, validateTradingFrequency, validateRisk, invalidateCache, } from '../../../services/autopilot-risk.js';
import { proposeSchema } from '../schemas.js';
export async function handlePropose(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = proposeSchema.safeParse(body);
    if (!result.success) {
        return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
    }
    const req = result.data;
    try {
        // Pre-proposal validation (MUST run before creating proposal)
        // Run in parallel for performance
        const [threatCheck, blindSpotCheck, tradingFreqCheck, riskCheck] = await Promise.all([
            checkThreatHistory(userId),
            checkBlindSpots(userId),
            validateTradingFrequency(userId, req.accountId),
            validateRisk(userId, req.accountId, req.size, req.limitPrice || req.stopPrice),
        ]);
        // Check threats
        if (threatCheck.blocked) {
            await sql `
        INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
        VALUES (
          ${userId},
          'autopilot',
          'warning',
          'Proposal Blocked: Threat Detected',
          ${threatCheck.reason || 'Critical threat detected'},
          ${JSON.stringify({ threats: threatCheck.threats })}
        )
      `;
            return c.json({
                success: false,
                error: threatCheck.reason || 'Proposal blocked due to threat detection',
                blocked: true,
                reason: 'threat',
            }, 400);
        }
        // Check blind spots
        if (blindSpotCheck.blocked) {
            await sql `
        INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
        VALUES (
          ${userId},
          'autopilot',
          'warning',
          'Proposal Blocked: Blind Spot Active',
          ${blindSpotCheck.reason || 'Guard-railed blind spot active'},
          ${JSON.stringify({ blindSpots: blindSpotCheck.blindSpots })}
        )
      `;
            invalidateCache(userId);
            return c.json({
                success: false,
                error: blindSpotCheck.reason || 'Proposal blocked due to active blind spot',
                blocked: true,
                reason: 'blind_spot',
            }, 400);
        }
        // Check trading frequency
        if (!tradingFreqCheck.valid) {
            return c.json({
                success: false,
                error: tradingFreqCheck.reason || 'Trading frequency limit exceeded',
                blocked: true,
                reason: 'trading_frequency',
            }, 400);
        }
        // Check standard risk validation
        if (!riskCheck.valid) {
            return c.json({
                success: false,
                error: 'Risk validation failed',
                reasons: riskCheck.reasons,
                blocked: true,
                reason: 'risk',
            }, 400);
        }
        // Check IV score for VIX strategies
        let ivScore = null;
        if (req.strategyName.toLowerCase().includes('vix') || req.strategyName === '22 VIX Fix') {
            ivScore = await getIVScore(userId, req.symbol);
            // For 22 VIX Fix, require score >= 8.5
            if (ivScore.score < 8.5) {
                return c.json({
                    success: false,
                    error: `VIX strategy entry criteria not met: IV score ${ivScore.score} < 8.5`,
                    blocked: true,
                    reason: 'iv_score',
                }, 400);
            }
        }
        // Calculate expiry time (15 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        // Create proposal
        const [proposal] = await sql `
      INSERT INTO autopilot_proposals (
        user_id, account_id, strategy_name, contract_id, symbol,
        side, size, order_type, limit_price, stop_price,
        stop_loss_ticks, take_profit_ticks, status, risk_metrics, reasoning, expires_at
      )
      VALUES (
        ${userId}, ${req.accountId}, ${req.strategyName}, ${req.contractId || null}, ${req.symbol},
        ${req.side}, ${req.size}, ${req.orderType}, ${req.limitPrice || null}, ${req.stopPrice || null},
        ${req.stopLossTicks || null}, ${req.takeProfitTicks || null}, 'pending',
        ${JSON.stringify(riskCheck.riskMetrics || {})}, ${req.reasoning || null}, ${expiresAt.toISOString()}
      )
      RETURNING id, status, expires_at
    `;
        // Log system event
        await sql `
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'autopilot',
        'info',
        'Proposal Created',
        ${`New ${req.strategyName} proposal: ${req.side.toUpperCase()} ${req.size} ${req.symbol}`},
        ${JSON.stringify({ proposalId: proposal.id, strategy: req.strategyName })}
      )
    `;
        return c.json({
            success: true,
            proposalId: proposal.id,
            status: proposal.status,
            riskMetrics: riskCheck.riskMetrics,
            expiresAt: proposal.expires_at,
            ivScore: ivScore ? { score: ivScore.score, level: ivScore.level } : null,
        });
    }
    catch (error) {
        console.error('Failed to create proposal:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create proposal',
        }, 500);
    }
}
//# sourceMappingURL=propose.js.map