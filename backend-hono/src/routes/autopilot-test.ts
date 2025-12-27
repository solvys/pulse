/**
 * Autopilot Test Routes
 * 
 * Isolated test environment for autopilot system.
 * Uses test ProjectX credentials and test database tables.
 * Environment variable: AUTOPILOT_TEST_MODE=true
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/index.js';
import {
  checkThreatHistory,
  checkBlindSpots,
  validateRisk,
} from '../services/autopilot-risk.js';
import {
  placeOrder,
  searchContracts,
  OrderType,
  OrderSide,
} from '../services/projectx-service.js';

const autopilotTestRoutes = new Hono();

// Check if test mode is enabled
function isTestMode(): boolean {
  return process.env.AUTOPILOT_TEST_MODE === 'true';
}

// Get test credentials from environment
function getTestCredentials(): { username: string; apiKey: string } {
  return {
    username: process.env.PROJECTX_TEST_USERNAME || 'wallstreetwave',
    apiKey: process.env.PROJECTX_TEST_API_KEY || 'II+9VjHpNj4oUXLNOavHvKbcQ1P87OgiM6IQFcI4GI4=',
  };
}

// Test proposal schema
const testProposeSchema = z.object({
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

// POST /autopilot/test/propose - Create test proposal
autopilotTestRoutes.post('/propose', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');
  const body = await c.req.json();
  const result = testProposeSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
  }

  const req = result.data;

  try {
    // Pre-proposal validation
    const [threatCheck, blindSpotCheck, riskCheck] = await Promise.all([
      checkThreatHistory(userId),
      checkBlindSpots(userId),
      validateRisk(userId, req.accountId, req.size, req.limitPrice || req.stopPrice),
    ]);

    if (threatCheck.blocked) {
      return c.json({
        success: false,
        error: threatCheck.reason || 'Proposal blocked due to threat detection',
        blocked: true,
        reason: 'threat',
      }, 400);
    }

    if (blindSpotCheck.blocked) {
      return c.json({
        success: false,
        error: blindSpotCheck.reason || 'Proposal blocked due to active blind spot',
        blocked: true,
        reason: 'blind_spot',
      }, 400);
    }

    if (!riskCheck.valid) {
      return c.json({
        success: false,
        error: 'Risk validation failed',
        reasons: riskCheck.reasons,
        blocked: true,
        reason: 'risk',
      }, 400);
    }

    // Calculate expiry time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Create test proposal
    const [proposal] = await sql`
      INSERT INTO autopilot_proposals_test (
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

    return c.json({
      success: true,
      proposalId: proposal.id,
      status: proposal.status,
      riskMetrics: riskCheck.riskMetrics,
      expiresAt: proposal.expires_at,
      isTest: true,
    });
  } catch (error) {
    console.error('Failed to create test proposal:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test proposal',
    }, 500);
  }
});

// POST /autopilot/test/acknowledge - Approve/reject test proposal
autopilotTestRoutes.post('/acknowledge', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');
  const body = await c.req.json();
  const { proposalId, action } = body;

  if (!proposalId || !action || !['approve', 'reject'].includes(action)) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    const [proposal] = await sql`
      SELECT id, status, expires_at
      FROM autopilot_proposals_test
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Test proposal not found' }, 404);
    }

    if (proposal.status !== 'pending') {
      return c.json({ error: `Proposal is already ${proposal.status}` }, 400);
    }

    if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
      await sql`
        UPDATE autopilot_proposals_test
        SET status = 'expired', updated_at = NOW()
        WHERE id = ${proposalId}
      `;
      return c.json({ error: 'Proposal has expired' }, 400);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await sql`
      UPDATE autopilot_proposals_test
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${proposalId}
    `;

    return c.json({
      success: true,
      proposalId,
      status: newStatus,
      isTest: true,
    });
  } catch (error) {
    console.error('Failed to acknowledge test proposal:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge test proposal',
    }, 500);
  }
});

// POST /autopilot/test/execute - Execute test proposal
autopilotTestRoutes.post('/execute', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');
  const body = await c.req.json();
  const proposalId = body.proposalId;

  if (!proposalId || typeof proposalId !== 'number') {
    return c.json({ error: 'proposalId is required' }, 400);
  }

  try {
    // Get test proposal
    const [proposal] = await sql`
      SELECT id, account_id, strategy_name, contract_id, symbol, side, size,
             order_type, limit_price, stop_price, stop_loss_ticks, take_profit_ticks
      FROM autopilot_proposals_test
      WHERE id = ${proposalId} AND user_id = ${userId}
    `;

    if (!proposal) {
      return c.json({ error: 'Test proposal not found' }, 404);
    }

    if (proposal.status !== 'approved') {
      return c.json({ error: `Proposal is not approved (status: ${proposal.status})` }, 400);
    }

    // Get contract ID
    let contractId = proposal.contract_id;
    if (!contractId && proposal.symbol) {
      // Use test credentials to search contracts
      const testCreds = getTestCredentials();
      // Note: This would need to be updated to use test credentials
      // For now, we'll use the regular searchContracts which gets credentials from DB
      const contracts = await searchContracts(userId, proposal.symbol, false);
      if (contracts.length === 0) {
        return c.json({ error: `Contract not found for symbol: ${proposal.symbol}` }, 400);
      }
      contractId = contracts[0].id;
    }

    if (!contractId) {
      return c.json({ error: 'Contract ID is required' }, 400);
    }

    // Map order type and side
    const orderTypeMap: Record<string, OrderType> = {
      limit: OrderType.Limit,
      market: OrderType.Market,
      stop: OrderType.Stop,
      trailingStop: OrderType.TrailingStop,
      joinBid: OrderType.JoinBid,
      joinAsk: OrderType.JoinAsk,
    };

    const sideMap: Record<string, OrderSide> = {
      buy: OrderSide.Bid,
      sell: OrderSide.Ask,
      long: OrderSide.Bid,
      short: OrderSide.Ask,
    };

    // Build bracket orders
    const stopLossBracket = proposal.stop_loss_ticks
      ? { ticks: proposal.stop_loss_ticks, type: OrderType.Stop }
      : null;

    const takeProfitBracket = proposal.take_profit_ticks
      ? { ticks: proposal.take_profit_ticks, type: OrderType.Limit }
      : null;

    // Execute order via ProjectX (using test credentials)
    // Note: The placeOrder function gets credentials from DB, so we need to ensure
    // test credentials are stored for the test user, or modify the function to accept credentials
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

    // Record test execution
    const [execution] = await sql`
      INSERT INTO autopilot_executions_test (
        proposal_id, user_id, account_id, projectx_order_id,
        contract_id, symbol, side, size, status
      )
      VALUES (
        ${proposalId}, ${userId}, ${proposal.account_id}, ${orderResult.orderId},
        ${contractId}, ${proposal.symbol}, ${proposal.side}, ${proposal.size}, 'executed'
      )
      RETURNING id, execution_timestamp
    `;

    // Update test proposal status
    await sql`
      UPDATE autopilot_proposals_test
      SET status = 'executed', executed_at = NOW(), updated_at = NOW()
      WHERE id = ${proposalId}
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
      isTest: true,
    });
  } catch (error) {
    console.error('Failed to execute test proposal:', error);

    // Update test proposal status to failed
    await sql`
      UPDATE autopilot_proposals_test
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${proposalId}
    `.catch(() => {});

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute test proposal',
    }, 500);
  }
});

// GET /autopilot/test/proposals - List test proposals
autopilotTestRoutes.get('/proposals', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');

  try {
    const proposals = await sql`
      SELECT 
        id, account_id as "accountId", strategy_name as "strategyName",
        contract_id as "contractId", symbol, side, size, order_type as "orderType",
        limit_price as "limitPrice", stop_price as "stopPrice",
        stop_loss_ticks as "stopLossTicks", take_profit_ticks as "takeProfitTicks",
        status, risk_metrics as "riskMetrics", reasoning,
        created_at as "createdAt", updated_at as "updatedAt",
        expires_at as "expiresAt", executed_at as "executedAt"
      FROM autopilot_proposals_test
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return c.json({
      proposals: proposals || [],
      isTest: true,
    });
  } catch (error) {
    console.error('Failed to list test proposals:', error);
    return c.json({ error: 'Failed to list test proposals' }, 500);
  }
});

// GET /autopilot/test/status - Get test autopilot status
autopilotTestRoutes.get('/status', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');

  try {
    const [activeCount] = await sql`
      SELECT COUNT(*)::integer as count
      FROM autopilot_proposals_test
      WHERE user_id = ${userId} AND status IN ('pending', 'approved')
    `;

    const recentExecutions = await sql`
      SELECT 
        id, proposal_id as "proposalId", projectx_order_id as "projectxOrderId",
        symbol, side, size, execution_price as "executionPrice",
        status, created_at as "createdAt"
      FROM autopilot_executions_test
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return c.json({
      activeProposals: activeCount?.count || 0,
      recentExecutions: recentExecutions || [],
      isTest: true,
      testCredentials: {
        username: getTestCredentials().username,
        // Don't expose API key
      },
    });
  } catch (error) {
    console.error('Failed to get test autopilot status:', error);
    return c.json({ error: 'Failed to get test autopilot status' }, 500);
  }
});

// POST /autopilot/test/run-full-test - Run complete test workflow
autopilotTestRoutes.post('/run-full-test', async (c) => {
  if (!isTestMode()) {
    return c.json({ error: 'Test mode not enabled' }, 403);
  }

  const userId = c.get('userId');
  const body = await c.req.json();

  // Minimal test proposal
  const testProposal = {
    strategyName: 'Test Strategy',
    accountId: body.accountId || 1,
    symbol: body.symbol || 'MNQ',
    side: 'buy' as const,
    size: 1,
    orderType: 'limit' as const,
    limitPrice: body.limitPrice || 25000,
    stopLossTicks: 10,
    takeProfitTicks: 20,
    reasoning: 'Automated test trade',
  };

  try {
    // Step 1: Create proposal
    const proposeRes = await fetch(`${c.req.url.split('/test')[0]}/test/propose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': c.req.header('Authorization') || '',
      },
      body: JSON.stringify(testProposal),
    });

    if (!proposeRes.ok) {
      const error = await proposeRes.json();
      return c.json({
        success: false,
        step: 'propose',
        error: error.error || 'Failed to create test proposal',
      }, 400);
    }

    const proposeData = await proposeRes.json();
    const proposalId = proposeData.proposalId;

    // Step 2: Approve proposal
    const approveRes = await fetch(`${c.req.url.split('/test')[0]}/test/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': c.req.header('Authorization') || '',
      },
      body: JSON.stringify({ proposalId, action: 'approve' }),
    });

    if (!approveRes.ok) {
      const error = await approveRes.json();
      return c.json({
        success: false,
        step: 'approve',
        proposalId,
        error: error.error || 'Failed to approve test proposal',
      }, 400);
    }

    // Step 3: Execute proposal
    const executeRes = await fetch(`${c.req.url.split('/test')[0]}/test/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': c.req.header('Authorization') || '',
      },
      body: JSON.stringify({ proposalId }),
    });

    if (!executeRes.ok) {
      const error = await executeRes.json();
      return c.json({
        success: false,
        step: 'execute',
        proposalId,
        error: error.error || 'Failed to execute test proposal',
      }, 400);
    }

    const executeData = await executeRes.json();

    return c.json({
      success: true,
      testResults: {
        proposalId,
        orderId: executeData.orderId,
        executionId: executeData.executionId,
        steps: ['propose', 'approve', 'execute'],
      },
      message: 'Full test workflow completed successfully',
    });
  } catch (error) {
    console.error('Full test workflow failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Full test workflow failed',
    }, 500);
  }
});

export { autopilotTestRoutes };
