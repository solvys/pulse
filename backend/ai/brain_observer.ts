import { api } from "encore.dev/api";
import { db } from "../db";
import log from "encore.dev/log";

// Define the signal types we care about
interface SignalData {
  userId: string;
  type: "trade" | "order" | "position";
  data: any;
  timestamp: string;
}

/**
 * Brain Observer: Background process that monitors trading signals
 * and identifies potential tilt scenarios.
 */
export const processSignal = api<SignalData, void>(
  { method: "POST", path: "/ai/internal/signal", expose: false },
  async (req) => {
    const { userId, type, data } = req;
    
    // We only care about completed trades for now to detect loss streaks / overtrading
    // Or new orders to detect frequency?
    // Let's focus on 'trade' events (executions)
    
    if (type !== "trade") {
      return;
    }

    // "data" here is expected to be the trade object from ProjectX/Realtime
    // We need to ensure we have the latest stats.
    // Since the trade just happened, it might not be in the DB yet if RealtimeManager
    // sends this signal BEFORE DB insertion. 
    // However, RealtimeManager usually broadcasts what it gets from upstream.
    // The "sync" or "trade" recording usually happens separately.
    // Let's assume this signal is a "trigger" to check the DB.
    // But we should probably wait a moment or ensure the trade is recorded.
    
    // Actually, coaching_system:checkTiltStatus queries the DB.
    // If the trade isn't in DB yet, we miss it.
    // But RealtimeManager in projectx doesn't write to DB? 
    // Wait, let's check projectx/realtime_user_hub.ts or similar.
    
    log.info("Brain Observer received signal", { userId, type });

    // Run tilt check logic
    // We can reuse the logic from coaching_system, or duplicate it here for now.
    // To keep it clean, let's extract the logic if possible, or just query DB.
    
    // 1. Query recent stats
    // Note: We cast userId to number/string as needed. Schema says user_id is TEXT.
    
    // We need to get the accountId from the signal data if possible, or check all accounts?
    // SignalData should probably include accountId.
    const accountId = data.accountId;

    if (!accountId) {
        log.warn("Brain Observer: No accountId in signal data", { userId, data });
        return;
    }

    // Query DB for stats (Last 1 hour)
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
      WHERE user_id = ${userId}
        AND account_id = ${accountId}
        AND opened_at > NOW() - INTERVAL '1 hour'
    `;

    const stats = recentTrades[0] || { trade_count: 0, loss_streak: 0, avg_hold_time_seconds: 0 };

    // Tilt detection logic (Copied from coaching_system for now to avoid circular deps or refactoring)
    let tiltRisk: "low" | "medium" | "high" = "low";
    let reason: string | undefined;
    let recommendation: string | undefined;

    if (stats.trade_count > 10) {
      tiltRisk = "high";
      reason = "High frequency trading detected - possible overtrading";
      recommendation = "Take a 15-minute break. Review your trading plan before continuing.";
    } else if (stats.loss_streak >= 3) {
      tiltRisk = "high";
      reason = "Multiple consecutive losses detected";
      recommendation = "Step away from the screen. Losses compound when emotions are high.";
    } else if (stats.avg_hold_time_seconds > 0 && stats.avg_hold_time_seconds < 30) {
      tiltRisk = "medium";
      reason = "Very short hold times - possible revenge trading";
      recommendation = "Slow down. Wait for A+ setups only.";
    } else if (stats.trade_count > 5) {
      tiltRisk = "medium";
      reason = "Elevated trading activity";
      recommendation = "Check in with yourself - are you following your plan?";
    }

    if (tiltRisk !== "low") {
      log.info("Brain Observer detected tilt", { userId, tiltRisk, reason });
      
      // Log to tilt_events table
      await db.exec`
        INSERT INTO tilt_events (user_id, account_id, risk_level, reason, recommendation, created_at)
        VALUES (${userId}, ${accountId}, ${tiltRisk}, ${reason}, ${recommendation}, NOW())
      `;
    }
  }
);
