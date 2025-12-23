/**
 * Autopilot Controller - Phase 4
 * Semi-autonomous trading execution with human-in-the-loop validation
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db";
import log from "encore.dev/log";
import { randomUUID } from "crypto";
import * as projectx from "../projectx/projectx_client";

// Action types for the autopilot system
export type ActionType = "place_order" | "modify_order" | "cancel_order";

// Status types for proposed actions
export type ActionStatus = "draft" | "acknowledged" | "rejected" | "executed" | "failed";

// Risk validation result
interface RiskValidation {
  passed: boolean;
  reason?: string;
  maxDailyLoss?: number;
  currentDailyPnl?: number;
  maxPositionSize?: number;
  currentPositionSize?: number;
}

// Proposed action data structure
interface ProposedActionData {
  accountId: number;
  contractId?: string;
  type?: number; // Order type for place_order
  side?: number; // Order side for place_order
  size?: number; // Order size
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  orderId?: number; // For modify_order and cancel_order
  customTag?: string;
  stopLossBracket?: { ticks: number; type: number };
  takeProfitBracket?: { ticks: number; type: number };
}

/**
 * Propose a trading action for human approval
 */
interface ProposeActionRequest {
  actionType: ActionType;
  actionData: ProposedActionData;
}

interface ProposeActionResponse {
  proposalId: string;
  status: ActionStatus;
  riskValidation: RiskValidation;
  message: string;
}

export const proposeAction = api<ProposeActionRequest, ProposeActionResponse>(
  { method: "POST", path: "/trading/autopilot/propose", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;
    const proposalId = randomUUID();

    try {
      // Validate account ownership and autopilot is enabled
      const accountCheck = await db.queryRow<{
        user_id: string;
        autopilot_enabled: boolean;
        max_daily_loss: number;
        max_position_size: number;
      }>`
        SELECT user_id, autopilot_enabled, max_daily_loss, max_position_size
        FROM accounts
        WHERE user_id = ${auth.userID} AND projectx_account_id = ${req.actionData.accountId}
      `;

      if (!accountCheck) {
        throw new Error("Account not found or access denied");
      }

      if (!accountCheck.autopilot_enabled) {
        throw new Error("Autopilot is disabled for this account");
      }

      // Run risk validation
      const riskValidation = await validateRiskLimits(
        auth.userID,
        req.actionData.accountId,
        req.actionType,
        req.actionData,
        accountCheck.max_daily_loss,
        accountCheck.max_position_size
      );

      if (!riskValidation.passed) {
        return {
          proposalId,
          status: "draft",
          riskValidation,
          message: `Risk limit exceeded: ${riskValidation.reason}`,
        };
      }

      // Save the proposed action
      await db.exec`
        INSERT INTO proposed_actions (
          id, user_id, account_id, action_type, status, action_data, risk_validation
        ) VALUES (
          ${proposalId}, ${auth.userID}, ${req.actionData.accountId},
          ${req.actionType}, 'draft', ${JSON.stringify(req.actionData)},
          ${JSON.stringify(riskValidation)}
        )
      `;

      log.info("Trading action proposed", {
        userId: auth.userID,
        proposalId,
        actionType: req.actionType,
        accountId: req.actionData.accountId
      });

      return {
        proposalId,
        status: "draft",
        riskValidation,
        message: "Action proposed successfully. Awaiting human acknowledgment.",
      };

    } catch (error) {
      log.error("Failed to propose trading action", {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userID,
        actionType: req.actionType
      });

      throw error;
    }
  }
);

/**
 * Acknowledge and execute a proposed trading action
 */
interface AcknowledgeActionRequest {
  proposalId: string;
  approved: boolean;
  notes?: string;
}

interface AcknowledgeActionResponse {
  success: boolean;
  status: ActionStatus;
  message: string;
  executionResult?: any;
}

export const acknowledgeAction = api<AcknowledgeActionRequest, AcknowledgeActionResponse>(
  { method: "POST", path: "/trading/autopilot/acknowledge", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;

    try {
      // Get and validate the proposed action
      const action = await db.queryRow<{
        id: string;
        user_id: string;
        account_id: number;
        action_type: string;
        status: string;
        action_data: any;
      }>`
        SELECT id, user_id, account_id, action_type, status, action_data
        FROM proposed_actions
        WHERE id = ${req.proposalId} AND user_id = ${auth.userID}
      `;

      if (!action) {
        throw new Error("Proposed action not found");
      }

      if (action.status !== "draft") {
        throw new Error(`Action is already ${action.status}`);
      }

      // Handle rejection
      if (!req.approved) {
        await db.exec`
          UPDATE proposed_actions
          SET status = 'rejected', updated_at = NOW()
          WHERE id = ${req.proposalId}
        `;

        return {
          success: true,
          status: "rejected",
          message: "Action rejected by user",
        };
      }

      // Handle approval - execute the action
      await db.exec`
        UPDATE proposed_actions
        SET status = 'acknowledged', updated_at = NOW()
        WHERE id = ${req.proposalId}
      `;

      let executionResult: any = null;
      let newStatus: ActionStatus = "executed";
      let errorMessage: string | undefined;

      try {
        // Execute based on action type
        switch (action.action_type) {
          case "place_order":
            executionResult = await executePlaceOrder(action.action_data);
            break;
          case "modify_order":
            executionResult = await executeModifyOrder(action.action_data);
            break;
          case "cancel_order":
            executionResult = await executeCancelOrder(action.action_data);
            break;
          default:
            throw new Error(`Unknown action type: ${action.action_type}`);
        }

        log.info("Trading action executed successfully", {
          proposalId: req.proposalId,
          actionType: action.action_type,
          result: executionResult
        });

      } catch (error) {
        newStatus = "failed";
        errorMessage = error instanceof Error ? error.message : String(error);

        log.error("Trading action execution failed", {
          error: errorMessage,
          proposalId: req.proposalId,
          actionType: action.action_type
        });
      }

      // Update final status
      await db.exec`
        UPDATE proposed_actions
        SET status = ${newStatus}, executed_at = NOW(), error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${req.proposalId}
      `;

      return {
        success: newStatus === "executed",
        status: newStatus,
        message: newStatus === "executed"
          ? "Action executed successfully"
          : `Action execution failed: ${errorMessage}`,
        executionResult,
      };

    } catch (error) {
      log.error("Failed to acknowledge trading action", {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userID,
        proposalId: req.proposalId
      });

      throw error;
    }
  }
);

/**
 * Get proposed actions for the current user
 */
interface GetProposedActionsRequest {
  status?: ActionStatus;
  limit?: number;
  offset?: number;
}

interface ProposedAction {
  id: string;
  actionType: ActionType;
  status: ActionStatus;
  actionData: ProposedActionData;
  riskValidation: RiskValidation;
  createdAt: string;
  executedAt?: string;
  errorMessage?: string;
}

interface GetProposedActionsResponse {
  actions: ProposedAction[];
  total: number;
}

export const getProposedActions = api<GetProposedActionsRequest, GetProposedActionsResponse>(
  { method: "GET", path: "/trading/autopilot/proposed", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = Math.min(req.limit || 50, 100);
    const offset = req.offset || 0;

    let whereClause = "user_id = $1";
    const params: any[] = [auth.userID];

    if (req.status) {
      whereClause += " AND status = $2";
      params.push(req.status);
    }

    // Fire-and-forget telemetry POST before proposed actions query
    fetch('http://127.0.0.1:7245/ingest/7f0acc2c-8c83-40f0-80db-c91ba3178310', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'autopilot.ts:getProposedActions',
        message: 'Querying proposed actions',
        data: {
          userId: auth.userID,
          status: req.status,
          limit: limit,
          offset: offset
        },
        timestamp: Date.now(),
        sessionId: 'autopilot-session',
        runId: 'production-query'
      })
    }).catch(() => {}); // Fire-and-forget

    const actions = await db.query<{
      id: string;
      action_type: string;
      status: string;
      action_data: any;
      risk_validation: any;
      created_at: string;
      executed_at?: string;
      error_message?: string;
    }>`
      SELECT id, action_type, status, action_data, risk_validation,
             created_at, executed_at, error_message
      FROM proposed_actions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM proposed_actions
      WHERE ${whereClause}
    `(...params);

    return {
      actions: actions.map(action => ({
        id: action.id,
        actionType: action.action_type as ActionType,
        status: action.status as ActionStatus,
        actionData: action.action_data,
        riskValidation: action.risk_validation,
        createdAt: action.created_at,
        executedAt: action.executed_at,
        errorMessage: action.error_message,
      })),
      total: countResult?.count || 0,
    };
  }
);

/**
 * Validate risk limits before proposing an action
 */
async function validateRiskLimits(
  userId: string,
  accountId: number,
  actionType: ActionType,
  actionData: ProposedActionData,
  maxDailyLoss: number,
  maxPositionSize: number
): Promise<RiskValidation> {

  // Get current daily P&L
  const dailyPnL = await db.queryRow<{ daily_pnl: number }>`
    SELECT COALESCE(daily_pnl, 0) as daily_pnl
    FROM accounts
    WHERE user_id = ${userId} AND projectx_account_id = ${accountId}
  `;

  const currentDailyPnl = dailyPnL?.daily_pnl || 0;

  // For place_order actions, check position size limits
  if (actionType === "place_order") {
    try {
      // Get current open positions
      const positions = await projectx.searchOpenPositions(accountId);
      const currentPositionSize = positions.reduce((sum, pos) => sum + Math.abs(pos.size), 0);

      const newPositionSize = currentPositionSize + (actionData.size || 0);

      if (newPositionSize > maxPositionSize) {
        return {
          passed: false,
          reason: `Position size limit exceeded: ${newPositionSize} > ${maxPositionSize}`,
          maxPositionSize,
          currentPositionSize,
        };
      }
    } catch (error) {
      // If we can't check positions, allow but log warning
      log.warn("Could not validate position size limits", { error, userId, accountId });
    }
  }

  // Check daily loss limit (maxDailyLoss is stored as negative)
  // If current daily P&L is more negative than max allowed loss, block
  if (currentDailyPnl < maxDailyLoss) {
    return {
      passed: false,
      reason: `Daily loss limit exceeded: ${currentDailyPnl} < ${maxDailyLoss}`,
      maxDailyLoss,
      currentDailyPnl,
    };
  }

  return {
    passed: true,
    maxDailyLoss,
    currentDailyPnl,
    maxPositionSize,
  };
}

/**
 * Execute a place order action via ProjectX
 */
async function executePlaceOrder(actionData: ProposedActionData): Promise<any> {
  return await projectx.placeOrder({
    accountId: actionData.accountId,
    contractId: actionData.contractId!,
    type: actionData.type!,
    side: actionData.side!,
    size: actionData.size!,
    limitPrice: actionData.limitPrice,
    stopPrice: actionData.stopPrice,
    trailPrice: actionData.trailPrice,
    customTag: actionData.customTag,
    stopLossBracket: actionData.stopLossBracket,
    takeProfitBracket: actionData.takeProfitBracket,
  });
}

/**
 * Execute a modify order action via ProjectX
 */
async function executeModifyOrder(actionData: ProposedActionData): Promise<any> {
  return await projectx.modifyOrder({
    accountId: actionData.accountId,
    orderId: actionData.orderId!,
    size: actionData.size,
    limitPrice: actionData.limitPrice,
    stopPrice: actionData.stopPrice,
    trailPrice: actionData.trailPrice,
  });
}

/**
 * Execute a cancel order action (placeholder - would need ProjectX API support)
 */
async function executeCancelOrder(actionData: ProposedActionData): Promise<any> {
  // Note: ProjectX API may not have a direct cancel endpoint
  // This would need to be implemented based on available ProjectX methods
  throw new Error("Cancel order not yet implemented in ProjectX integration");
}