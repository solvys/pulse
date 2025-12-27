/**
 * Autopilot & Trading Automation Routes
 * 
 * Backend API for autopilot trading system with human-in-the-loop approval workflow.
 * All trades must pass risk validation and receive explicit user approval before execution.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import {
  checkThreatHistory,
  checkBlindSpots,
  getIVScore,
  validateTradingFrequency,
  validateRisk,
  invalidateCache,
} from '../services/autopilot-risk.js';
import {
  placeOrder,
  searchContracts,
  OrderType,
  OrderSide,
} from '../services/projectx-service.js';
import {
  detectAntiLag,
  getAvailableCorrelatedPairs,
  checkAssetClassMatch,
} from '../services/anti-lag-detector.js';

const autopilotRoutes = new Hono();

// Proposal creation schema
const proposeSchema = z.object({
  strategyName: z.string().min(1),
  accountId: z.number(),
  contractId: z.string().optional(),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell', 'long', 'short']),
  size: z.number().positive(),
  orderType: z.enum(['limit', 'market', 'stop', 'trailingStop', 'joinBid', 'joinAsk']),
  limitPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  stopLossTicks: z.number().optional(),
  takeProfitTicks: z.number().optional(),
  reasoning: z.string().optional(),
});

// POST /autopilot/propose - Create a trading proposal
autopilotRoutes.post('/propose', async (c) => {
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
      await sql`
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
      await sql`
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
    const [proposal] = await sql`
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
    await sql`
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
  } catch (error) {
    console.error('Failed to create proposal:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create proposal',
    }, 500);
  }
});

// Acknowledge schema
const acknowledgeSchema = z.object({
  proposalId: z.number(),
  action: z.enum(['approve', 'reject']),
});

// POST /autopilot/acknowledge - Approve/reject a proposal
autopilotRoutes.post('/acknowledge', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = acknowledgeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const { proposalId, action } = result.data;

  try {
    // Get proposal and verify ownership
    const [proposal] = await sql`
      SELECT id, status, account_id, side, size, symbol, contract_id, order_type,
             limit_price, stop_price, stop_loss_ticks, take_profit_ticks, expires_at,
             created_at
      FROM autopilot_proposals
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }

    if (proposal.status !== 'pending') {
      return c.json({ error: `Proposal is already ${proposal.status}` }, 400);
    }

    // Check if expired
    if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
      await sql`
        UPDATE autopilot_proposals
        SET status = 'expired', updated_at = NOW()
        WHERE id = ${proposalId}
      `;
      return c.json({ error: 'Proposal has expired' }, 400);
    }

    // Re-check blind spots if >30 seconds since approval or >5 minutes old
    const proposalAge = Date.now() - new Date(proposal.created_at).getTime();
    if (action === 'approve' && (proposalAge > 30000 || proposalAge > 300000)) {
      const blindSpotCheck = await checkBlindSpots(userId);
      if (blindSpotCheck.blocked) {
        await sql`
          UPDATE autopilot_proposals
          SET status = 'rejected', updated_at = NOW()
          WHERE id = ${proposalId}
        `;
        return c.json({
          success: false,
          error: blindSpotCheck.reason || 'Proposal blocked due to active blind spot',
          blocked: true,
          reason: 'blind_spot',
        }, 400);
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await sql`
      UPDATE autopilot_proposals
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${proposalId}
    `;

    // Log system event
    await sql`
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'autopilot',
        ${action === 'approve' ? 'success' : 'info'},
        ${action === 'approve' ? 'Proposal Approved' : 'Proposal Rejected'},
        ${`Proposal ${proposalId} ${action === 'approve' ? 'approved' : 'rejected'}`},
        ${JSON.stringify({ proposalId, action })}
      )
    `;

    // If rejected, invalidate cache
    if (action === 'reject') {
      invalidateCache(userId);
    }

    return c.json({
      success: true,
      proposalId,
      status: newStatus,
    });
  } catch (error) {
    console.error('Failed to acknowledge proposal:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge proposal',
    }, 500);
  }
});

// GET /autopilot/proposals - List user's proposals
const listProposalsSchema = z.object({
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'expired', 'executed', 'failed']).optional(),
  strategy: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

autopilotRoutes.get('/proposals', async (c) => {
  const userId = c.get('userId');

  const result = listProposalsSchema.safeParse({
    status: c.req.query('status'),
    strategy: c.req.query('strategy'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!result.success) {
    return c.json({ error: 'Invalid query parameters', details: result.error.flatten() }, 400);
  }

  const { status, strategy, limit, offset } = result.data;

  try {
    let query = sql`
      SELECT 
        id, account_id as "accountId", strategy_name as "strategyName",
        contract_id as "contractId", symbol, side, size, order_type as "orderType",
        limit_price as "limitPrice", stop_price as "stopPrice",
        stop_loss_ticks as "stopLossTicks", take_profit_ticks as "takeProfitTicks",
        status, risk_metrics as "riskMetrics", reasoning,
        created_at as "createdAt", updated_at as "updatedAt",
        expires_at as "expiresAt", executed_at as "executedAt"
      FROM autopilot_proposals
      WHERE user_id = ${userId}
    `;

    if (status) {
      query = sql`${query} AND status = ${status}`;
    }

    if (strategy) {
      query = sql`${query} AND strategy_name = ${strategy}`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const proposals = await query;

    // Get total count
    let countQuery = sql`SELECT COUNT(*)::integer as count FROM autopilot_proposals WHERE user_id = ${userId}`;
    if (status) {
      countQuery = sql`${countQuery} AND status = ${status}`;
    }
    if (strategy) {
      countQuery = sql`${countQuery} AND strategy_name = ${strategy}`;
    }

    const [countResult] = await countQuery;

    return c.json({
      proposals: proposals || [],
      total: countResult?.count || 0,
    });
  } catch (error) {
    console.error('Failed to list proposals:', error);
    return c.json({ error: 'Failed to list proposals' }, 500);
  }
});

// GET /autopilot/proposals/:id - Get proposal details
autopilotRoutes.get('/proposals/:id', async (c) => {
  const userId = c.get('userId');
  const proposalId = c.req.param('id');

  const id = parseInt(proposalId, 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid proposal ID' }, 400);
  }

  try {
    const [proposal] = await sql`
      SELECT 
        id, account_id as "accountId", strategy_name as "strategyName",
        contract_id as "contractId", symbol, side, size, order_type as "orderType",
        limit_price as "limitPrice", stop_price as "stopPrice",
        stop_loss_ticks as "stopLossTicks", take_profit_ticks as "takeProfitTicks",
        status, risk_metrics as "riskMetrics", reasoning,
        created_at as "createdAt", updated_at as "updatedAt",
        expires_at as "expiresAt", executed_at as "executedAt"
      FROM autopilot_proposals
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }

    return c.json(proposal);
  } catch (error) {
    console.error('Failed to get proposal:', error);
    return c.json({ error: 'Failed to get proposal' }, 500);
  }
});

// POST /autopilot/execute - Execute approved proposal
autopilotRoutes.post('/execute', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const proposalId = body.proposalId;

  if (!proposalId || typeof proposalId !== 'number') {
    return c.json({ error: 'proposalId is required' }, 400);
  }

  try {
    // Get proposal and verify it's approved
    const [proposal] = await sql`
      SELECT id, account_id, strategy_name, contract_id, symbol, side, size,
             order_type, limit_price, stop_price, stop_loss_ticks, take_profit_ticks
      FROM autopilot_proposals
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }

    if (proposal.status !== 'approved') {
      return c.json({ error: `Proposal is not approved (status: ${proposal.status})` }, 400);
    }

    // Get contract ID if not provided
    let contractId = proposal.contract_id;
    if (!contractId && proposal.symbol) {
      const contracts = await searchContracts(userId, proposal.symbol, false);
      if (contracts.length === 0) {
        return c.json({ error: `Contract not found for symbol: ${proposal.symbol}` }, 400);
      }
      contractId = contracts[0].id;
    }

    if (!contractId) {
      return c.json({ error: 'Contract ID is required' }, 400);
    }

    // Map order type to ProjectX enum
    const orderTypeMap: Record<string, OrderType> = {
      limit: OrderType.Limit,
      market: OrderType.Market,
      stop: OrderType.Stop,
      trailingStop: OrderType.TrailingStop,
      joinBid: OrderType.JoinBid,
      joinAsk: OrderType.JoinAsk,
    };

    // Map side to ProjectX enum
    const sideMap: Record<string, OrderSide> = {
      buy: OrderSide.Bid,
      sell: OrderSide.Ask,
      long: OrderSide.Bid,
      short: OrderSide.Ask,
    };

    // Build bracket orders if provided
    const stopLossBracket = proposal.stop_loss_ticks
      ? { ticks: proposal.stop_loss_ticks, type: OrderType.Stop }
      : null;

    const takeProfitBracket = proposal.take_profit_ticks
      ? { ticks: proposal.take_profit_ticks, type: OrderType.Limit }
      : null;

    // Execute order via ProjectX
    const orderResult = await placeOrder(userId, {
      accountId: proposal.account_id,
      contractId: contractId,
      type: orderTypeMap[proposal.order_type] || OrderType.Limit,
      side: sideMap[proposal.side] || OrderSide.Bid,
      size: proposal.size,
      limitPrice: proposal.limit_price || null,
      stopPrice: proposal.stop_price || null,
      stopLossBracket,
      takeProfitBracket,
    });

    // Record execution
    const [execution] = await sql`
      INSERT INTO autopilot_executions (
        proposal_id, user_id, account_id, projectx_order_id,
        contract_id, symbol, side, size, status
      )
      VALUES (
        ${proposalId}, ${userId}, ${proposal.account_id}, ${orderResult.orderId},
        ${contractId}, ${proposal.symbol}, ${proposal.side}, ${proposal.size}, 'executed'
      )
      RETURNING id, execution_timestamp
    `;

    // Update proposal status
    await sql`
      UPDATE autopilot_proposals
      SET status = 'executed', executed_at = NOW(), updated_at = NOW()
      WHERE id = ${proposalId}
    `;

    // Record trade in trades table
    await sql`
      INSERT INTO trades (
        user_id, account_id, contract_id, symbol, side, size,
        entry_price, strategy, opened_at
      )
      VALUES (
        ${userId}, ${proposal.account_id}, ${contractId}, ${proposal.symbol},
        ${proposal.side}, ${proposal.size}, ${proposal.limit_price || proposal.stop_price},
        ${`autopilot:${proposal.strategy_name}`}, NOW()
      )
    `;

    // Log system event
    await sql`
      INSERT INTO system_events (user_id, event_type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'trade',
        'success',
        'Autopilot Trade Executed',
        ${`Executed: ${proposal.side.toUpperCase()} ${proposal.size} ${proposal.symbol} via ${proposal.strategy_name}`},
        ${JSON.stringify({ proposalId, orderId: orderResult.orderId, executionId: execution.id })}
      )
    `;

    return c.json({
      success: true,
      orderId: orderResult.orderId,
      executionId: execution.id,
      executionDetails: {
        proposalId,
        contractId,
        symbol: proposal.symbol,
        side: proposal.side,
        size: proposal.size,
      },
    });
  } catch (error) {
    console.error('Failed to execute proposal:', error);

    // Update proposal status to failed
    await sql`
      UPDATE autopilot_proposals
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${proposalId}
    `.catch(() => {});

    // Record failed execution
    await sql`
      INSERT INTO autopilot_executions (
        proposal_id, user_id, account_id, status, error_message
      )
      VALUES (
        ${proposalId}, ${userId}, body.accountId || 0, 'failed',
        ${error instanceof Error ? error.message : 'Unknown error'}
      )
    `.catch(() => {});

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute proposal',
    }, 500);
  }
});

// GET /autopilot/status - Get autopilot status and settings
autopilotRoutes.get('/status', async (c) => {
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
});

// POST /autopilot/settings - Update autopilot settings
const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  dailyLossLimit: z.number().optional(),
  maxPositionSize: z.number().optional(),
  defaultOrderType: z.string().optional(),
  requireStopLoss: z.boolean().optional(),
  strategyEnabled: z.record(z.boolean()).optional(),
  positionSizingMethod: z.string().optional(),
  positionSizingValue: z.number().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  selectedInstrument: z.string().optional(),
  primaryInstrument: z.string().optional(),
  correlatedPairSymbol: z.string().optional(),
  rsiOverboughtThreshold: z.number().optional(),
  rsiOversoldThreshold: z.number().optional(),
  semiAutopilotWindow: z.any().optional(),
  fullAutopilotWindow: z.any().optional(),
});

autopilotRoutes.post('/settings', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = updateSettingsSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const updates = result.data;

  try {
    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.enabled !== undefined) {
      updateFields.push('enabled');
      updateValues.push(updates.enabled);
    }
    if (updates.dailyLossLimit !== undefined) {
      updateFields.push('daily_loss_limit');
      updateValues.push(updates.dailyLossLimit);
    }
    if (updates.maxPositionSize !== undefined) {
      updateFields.push('max_position_size');
      updateValues.push(updates.maxPositionSize);
    }
    if (updates.defaultOrderType !== undefined) {
      updateFields.push('default_order_type');
      updateValues.push(updates.defaultOrderType);
    }
    if (updates.requireStopLoss !== undefined) {
      updateFields.push('require_stop_loss');
      updateValues.push(updates.requireStopLoss);
    }
    if (updates.strategyEnabled !== undefined) {
      updateFields.push('strategy_enabled');
      updateValues.push(JSON.stringify(updates.strategyEnabled));
    }
    if (updates.positionSizingMethod !== undefined) {
      updateFields.push('position_sizing_method');
      updateValues.push(updates.positionSizingMethod);
    }
    if (updates.positionSizingValue !== undefined) {
      updateFields.push('position_sizing_value');
      updateValues.push(updates.positionSizingValue);
    }
    if (updates.riskLevel !== undefined) {
      updateFields.push('risk_level');
      updateValues.push(updates.riskLevel);
    }
    if (updates.selectedInstrument !== undefined) {
      updateFields.push('selected_instrument');
      updateValues.push(updates.selectedInstrument);
    }
    if (updates.primaryInstrument !== undefined) {
      updateFields.push('primary_instrument');
      updateValues.push(updates.primaryInstrument);
    }
    if (updates.correlatedPairSymbol !== undefined) {
      updateFields.push('correlated_pair_symbol');
      updateValues.push(updates.correlatedPairSymbol);
    }
    if (updates.rsiOverboughtThreshold !== undefined) {
      updateFields.push('rsi_overbought_threshold');
      updateValues.push(updates.rsiOverboughtThreshold);
    }
    if (updates.rsiOversoldThreshold !== undefined) {
      updateFields.push('rsi_oversold_threshold');
      updateValues.push(updates.rsiOversoldThreshold);
    }
    if (updates.semiAutopilotWindow !== undefined) {
      updateFields.push('semi_autopilot_window');
      updateValues.push(JSON.stringify(updates.semiAutopilotWindow));
    }
    if (updates.fullAutopilotWindow !== undefined) {
      updateFields.push('full_autopilot_window');
      updateValues.push(JSON.stringify(updates.fullAutopilotWindow));
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    // Ensure settings row exists first
    await sql`
      INSERT INTO autopilot_settings (user_id, updated_at)
      VALUES (${userId}, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Build individual update statements for each field
    // This is simpler and more reliable than trying to build dynamic queries
    if (updates.enabled !== undefined) {
      await sql`UPDATE autopilot_settings SET enabled = ${updates.enabled}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.dailyLossLimit !== undefined) {
      await sql`UPDATE autopilot_settings SET daily_loss_limit = ${updates.dailyLossLimit}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.maxPositionSize !== undefined) {
      await sql`UPDATE autopilot_settings SET max_position_size = ${updates.maxPositionSize}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.defaultOrderType !== undefined) {
      await sql`UPDATE autopilot_settings SET default_order_type = ${updates.defaultOrderType}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.requireStopLoss !== undefined) {
      await sql`UPDATE autopilot_settings SET require_stop_loss = ${updates.requireStopLoss}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.strategyEnabled !== undefined) {
      await sql`UPDATE autopilot_settings SET strategy_enabled = ${JSON.stringify(updates.strategyEnabled)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.positionSizingMethod !== undefined) {
      await sql`UPDATE autopilot_settings SET position_sizing_method = ${updates.positionSizingMethod}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.positionSizingValue !== undefined) {
      await sql`UPDATE autopilot_settings SET position_sizing_value = ${updates.positionSizingValue}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.riskLevel !== undefined) {
      await sql`UPDATE autopilot_settings SET risk_level = ${updates.riskLevel}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.selectedInstrument !== undefined) {
      await sql`UPDATE autopilot_settings SET selected_instrument = ${updates.selectedInstrument}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.primaryInstrument !== undefined) {
      await sql`UPDATE autopilot_settings SET primary_instrument = ${updates.primaryInstrument}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.correlatedPairSymbol !== undefined) {
      await sql`UPDATE autopilot_settings SET correlated_pair_symbol = ${updates.correlatedPairSymbol}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.rsiOverboughtThreshold !== undefined) {
      await sql`UPDATE autopilot_settings SET rsi_overbought_threshold = ${updates.rsiOverboughtThreshold}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.rsiOversoldThreshold !== undefined) {
      await sql`UPDATE autopilot_settings SET rsi_oversold_threshold = ${updates.rsiOversoldThreshold}, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.semiAutopilotWindow !== undefined) {
      await sql`UPDATE autopilot_settings SET semi_autopilot_window = ${JSON.stringify(updates.semiAutopilotWindow)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
    }
    if (updates.fullAutopilotWindow !== undefined) {
      await sql`UPDATE autopilot_settings SET full_autopilot_window = ${JSON.stringify(updates.fullAutopilotWindow)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
    }

    // Get updated settings
    const [updated] = await sql`
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

    return c.json(updated || {});
  } catch (error) {
    console.error('Failed to update settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// GET /autopilot/correlated-pairs - Get available correlated pairs for an instrument
autopilotRoutes.get('/correlated-pairs', async (c) => {
  const symbol = c.req.query('symbol');

  if (!symbol) {
    return c.json({ error: 'symbol query parameter required' }, 400);
  }

  try {
    const availablePairs = getAvailableCorrelatedPairs(symbol);
    const warnings: string[] = [];

    // Check asset class matches for each pair
    availablePairs.forEach(pair => {
      const match = checkAssetClassMatch(symbol, pair.symbol);
      if (!match.match && match.warning) {
        warnings.push(match.warning);
      }
    });

    // Determine asset class
    const assetClass = symbol.toUpperCase().includes('GOLD') || symbol.toUpperCase().includes('SILVER')
      ? 'safe_haven'
      : 'risk';

    return c.json({
      instrument: symbol,
      assetClass,
      availablePairs,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('Failed to get correlated pairs:', error);
    return c.json({ error: 'Failed to get correlated pairs' }, 500);
  }
});

// POST /autopilot/detect-anti-lag - Detect anti-lag between primary and correlated pair
const detectAntiLagSchema = z.object({
  primarySymbol: z.string().min(1),
  correlatedSymbol: z.string().min(1),
  lookbackSeconds: z.number().optional(),
});

autopilotRoutes.post('/detect-anti-lag', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const result = detectAntiLagSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  try {
    const detection = await detectAntiLag(
      userId,
      result.data.primarySymbol,
      result.data.correlatedSymbol,
      result.data.lookbackSeconds
    );

    return c.json(detection);
  } catch (error) {
    console.error('Failed to detect anti-lag:', error);
    return c.json({ error: 'Failed to detect anti-lag' }, 500);
  }
});

// GET /autopilot/time-windows - Get configured time windows
autopilotRoutes.get('/time-windows', async (c) => {
  const userId = c.get('userId');

  try {
    const [settings] = await sql`
      SELECT 
        semi_autopilot_window as "semiAutopilotWindow",
        full_autopilot_window as "fullAutopilotWindow",
        placeholder_window_3 as "placeholderWindow3"
      FROM autopilot_settings
      WHERE user_id = ${userId}
    `;

    return c.json({
      semiAutopilotWindow: settings?.semiAutopilotWindow || null,
      fullAutopilotWindow: settings?.fullAutopilotWindow || null,
      placeholderWindow3: settings?.placeholderWindow3 || null,
    });
  } catch (error) {
    console.error('Failed to get time windows:', error);
    return c.json({ error: 'Failed to get time windows' }, 500);
  }
});

export { autopilotRoutes };
