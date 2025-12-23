/**
 * PsychAssist / Coaching System
 * Trading psychology endpoints that help prevent tilting/overtrading.
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db";
import log from "encore.dev/log";
import { bedrock } from "./bedrock_agent";
import { randomUUID } from "crypto";

/**
 * PsychAssist: Detect and prevent tilting behavior
 * Monitors trading patterns and emotional state
 */
export const checkTiltStatus = api<
  { accountId: number },
  {
    tiltRisk: "low" | "medium" | "high";
    reason?: string;
    recommendation?: string;
  }
>(
  { method: "GET", path: "/ai/psychassist/tilt-check", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;

    log.info("PsychAssist tilt check", { userId: auth.userID, accountId: req.accountId });

    // Query recent trading activity
    const recentTrades = await db.query<{
      trade_count: number;
      loss_streak: number;
      avg_hold_time_seconds: number;
    }>`
      SELECT 
        COUNT(*) as trade_count,
        COALESCE(SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END), 0) as loss_streak,
        COALESCE(AVG(EXTRACT(EPOCH FROM (closed_at - opened_at))), 0) as avg_hold_time_seconds
      FROM trades
      WHERE user_id = ${auth.userID}
        AND account_id = ${req.accountId}
        AND opened_at > NOW() - INTERVAL '1 hour'
    `;

    const stats = recentTrades[0] || { trade_count: 0, loss_streak: 0, avg_hold_time_seconds: 0 };

    // Tilt detection logic
    let tiltRisk: "low" | "medium" | "high" = "low";
    let reason: string | undefined;
    let recommendation: string | undefined;

    // High frequency trading (more than 10 trades/hour)
    if (stats.trade_count > 10) {
      tiltRisk = "high";
      reason = "High frequency trading detected - possible overtrading";
      recommendation = "Take a 15-minute break. Review your trading plan before continuing.";
    }
    // Multiple consecutive losses
    else if (stats.loss_streak >= 3) {
      tiltRisk = "high";
      reason = "Multiple consecutive losses detected";
      recommendation = "Step away from the screen. Losses compound when emotions are high.";
    }
    // Very short hold times (less than 30 seconds average)
    else if (stats.avg_hold_time_seconds > 0 && stats.avg_hold_time_seconds < 30) {
      tiltRisk = "medium";
      reason = "Very short hold times - possible revenge trading";
      recommendation = "Slow down. Wait for A+ setups only.";
    }
    // Elevated activity
    else if (stats.trade_count > 5) {
      tiltRisk = "medium";
      reason = "Elevated trading activity";
      recommendation = "Check in with yourself - are you following your plan?";
    }

    return {
      tiltRisk,
      reason,
      recommendation,
    };
  }
);

/**
 * Start a new chat thread
 */
export const startChat = api<
  { title?: string },
  { threadId: string }
>(
  { method: "POST", path: "/ai/chat/start", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;
    const threadId = randomUUID();
    const title = req.title || "New Chat";

    await db.exec`
      INSERT INTO chat_threads (id, user_id, title)
      VALUES (${threadId}, ${auth.userID}, ${title})
    `;

    return { threadId };
  }
);

/**
 * Send a message to the AI agent
 */
export const sendMessage = api<
  { threadId: string; message: string },
  { response: string }
>(
  { method: "POST", path: "/ai/chat/send", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;

    // 1. Verify thread ownership
    const thread = await db.queryRow`
      SELECT id FROM chat_threads 
      WHERE id = ${req.threadId} AND user_id = ${auth.userID}
    `;
    if (!thread) {
      throw new Error("Chat thread not found or unauthorized");
    }

    // 2. Store user message
    await db.exec`
      INSERT INTO chat_messages (thread_id, role, content)
      VALUES (${req.threadId}, 'user', ${req.message})
    `;

    // 3. Invoke Bedrock Agent
    const responseText = await bedrock.invokeAgent(req.message, req.threadId);

    // 4. Store assistant response
    await db.exec`
      INSERT INTO chat_messages (thread_id, role, content)
      VALUES (${req.threadId}, 'assistant', ${responseText})
    `;

    return { response: responseText };
  }
);

/**
 * Get chat history for a thread
 */
export const getChatHistory = api<
  { threadId: string },
  { messages: { role: string; content: string; created_at: string }[] }
>(
  { method: "GET", path: "/ai/chat/history/:threadId", auth: true, expose: true },
  async (req) => {
    const auth = getAuthData()!;

    const rows = await db.query<{ role: string; content: string; created_at: Date }>`
      SELECT m.role, m.content, m.created_at
      FROM chat_messages m
      JOIN chat_threads t ON m.thread_id = t.id
      WHERE t.id = ${req.threadId} AND t.user_id = ${auth.userID}
      ORDER BY m.created_at ASC
    `;

    const messages = [];
    for (const row of rows) {
      messages.push({
        role: row.role,
        content: row.content,
        created_at: row.created_at.toISOString(),
      });
    }

    return { messages };
  }
);
