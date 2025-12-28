/**
 * Status Handler
 * Get autopilot status and settings
 */

import { Context } from 'hono';
import { sql } from '../../../db/index.js';

export async function handleStatus(c: Context) {
  const userId = c.get('userId');

  try {
    // Get settings
    const [settings] = await sql`
      SELECT 
        enabled, daily_loss_limit as "dailyLossLimit", max_position_size as "maxPositionSize",
        default_order_type as "defaultOrderType", require_stop_loss as "requireStopLoss",
        strategy_enabled as "strategyEnabled", position_sizing_method as "positionSizingMethod",
        position_sizing_value as "positionSizingValue", risk_level as "riskLevel",
        selected_instrument as "selectedInstrument", primary_instrument as "primaryInstrument",
        correlated_pair_symbol as "correlatedPairSymbol",
        rsi_overbought_threshold as "rsiOverboughtThreshold",
        rsi_oversold_threshold as "rsiOversoldThreshold",
        semi_autopilot_window as "semiAutopilotWindow",
        full_autopilot_window as "fullAutopilotWindow"
      FROM autopilot_settings
      WHERE user_id = ${userId}
    `;

    // Get active proposals count
    const [activeCount] = await sql`
      SELECT COUNT(*)::integer as count
      FROM autopilot_proposals
      WHERE user_id = ${userId} AND status IN ('pending', 'approved')
    `;

    // Get recent executions
    const recentExecutions = await sql`
      SELECT 
        id, proposal_id as "proposalId", projectx_order_id as "projectxOrderId",
        symbol, side, size, execution_price as "executionPrice",
        status, created_at as "createdAt"
      FROM autopilot_executions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Get risk metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [riskMetrics] = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END), 0)::decimal as "dailyLoss",
        COUNT(*)::integer as "tradesToday"
      FROM trades
      WHERE user_id = ${userId}
        AND opened_at >= ${today.toISOString()}
        AND strategy LIKE 'autopilot%'
    `;

    return c.json({
      enabled: settings?.enabled || false,
      settings: settings || null,
      activeProposals: activeCount?.count || 0,
      recentExecutions: recentExecutions || [],
      riskMetrics: {
        dailyLoss: Number(riskMetrics?.dailyLoss || 0),
        tradesToday: riskMetrics?.tradesToday || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get autopilot status:', error);
    return c.json({ error: 'Failed to get autopilot status' }, 500);
  }
}
