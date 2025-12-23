/**
 * Trading Service
 * Handles trade execution, position management, and order flow
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { db } from "../db";

// Re-export service functions from projectx
export { executeTestTrade, processTradingSignal } from "../projectx/service";

// Re-export autopilot functions
export { proposeAction, acknowledgeAction, getProposedActions } from "./autopilot";

/**
 * Record a trade for analytics and PsychAssist tracking
 */
interface RecordTradeRequest {
  accountId: number;
  contractId?: string;
  symbol?: string;
  side: "buy" | "sell" | "long" | "short";
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  openedAt: string;
  closedAt?: string;
  strategy?: string;
  notes?: string;
}

interface RecordTradeResponse {
  success: boolean;
  tradeId?: number;
  message: string;
}

export const recordTrade = api<RecordTradeRequest, RecordTradeResponse>(
  { method: "POST", path: "/trading/record", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;

    try {
      const result = await db.queryRow<{ id: number }>`
        INSERT INTO trades (
          user_id, account_id, contract_id, symbol, side, size,
          entry_price, exit_price, pnl, opened_at, closed_at, strategy, notes
        )
        VALUES (
          ${auth.userID}, ${req.accountId}, ${req.contractId || null}, ${req.symbol || null},
          ${req.side}, ${req.size}, ${req.entryPrice || null}, ${req.exitPrice || null},
          ${req.pnl || null}, ${req.openedAt}, ${req.closedAt || null},
          ${req.strategy || null}, ${req.notes || null}
        )
        RETURNING id
      `;

      log.info("Trade recorded", { userId: auth.userID, tradeId: result?.id });

      return {
        success: true,
        tradeId: result?.id,
        message: "Trade recorded successfully",
      };
    } catch (error) {
      log.error("Failed to record trade", {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userID,
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to record trade",
      };
    }
  }
);

/**
 * Get trading history for the authenticated user
 */
interface GetTradesRequest {
  accountId?: number;
  limit?: number;
  offset?: number;
}

interface Trade {
  id: number;
  accountId: number;
  contractId?: string;
  symbol?: string;
  side: string;
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  openedAt: string;
  closedAt?: string;
  strategy?: string;
}

interface GetTradesResponse {
  trades: Trade[];
  total: number;
}

export const getTrades = api<GetTradesRequest, GetTradesResponse>(
  { method: "GET", path: "/trading/history", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = Math.min(req.limit || 50, 100);
    const offset = req.offset || 0;

    let trades: Trade[];
    let countResult: { count: number } | null;

    if (req.accountId) {
      trades = await db.query<Trade>`
        SELECT 
          id, account_id as "accountId", contract_id as "contractId",
          symbol, side, size, entry_price as "entryPrice",
          exit_price as "exitPrice", pnl, opened_at as "openedAt",
          closed_at as "closedAt", strategy
        FROM trades
        WHERE user_id = ${auth.userID} AND account_id = ${req.accountId}
        ORDER BY opened_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM trades
        WHERE user_id = ${auth.userID} AND account_id = ${req.accountId}
      `;
    } else {
      trades = await db.query<Trade>`
        SELECT 
          id, account_id as "accountId", contract_id as "contractId",
          symbol, side, size, entry_price as "entryPrice",
          exit_price as "exitPrice", pnl, opened_at as "openedAt",
          closed_at as "closedAt", strategy
        FROM trades
        WHERE user_id = ${auth.userID}
        ORDER BY opened_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM trades
        WHERE user_id = ${auth.userID}
      `;
    }

    return {
      trades: trades || [],
      total: countResult?.count || 0,
    };
  }
);
