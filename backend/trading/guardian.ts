/**
 * Guardian Sub-routine - Phase 4
 * Emergency risk management system that monitors tilt levels and executes protective actions
 */

import { CronJob } from "encore.dev/cron";
import { db } from "../db";
import log from "encore.dev/log";
import * as projectx from "../projectx/projectx_client";

// Extract tilt check logic into a reusable function
async function checkTiltRisk(userId: string, accountId: number): Promise<{
  tiltRisk: "low" | "medium" | "high";
  reason?: string;
  recommendation?: string;
}> {
  // Query recent trading activity (last 1 hour)
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

  // Tilt detection logic
  let tiltRisk: "low" | "medium" | "high" = "low";
  let reason: string | undefined;
  let recommendation: string | undefined;

  // High frequency trading (more than 10 trades/hour)
  if (stats.trade_count > 10) {
    tiltRisk = "high";
    reason = "High frequency trading detected - possible overtrading";
    recommendation = "Emergency liquidation initiated. Take a 15-minute break.";
  }
  // Multiple consecutive losses
  else if (stats.loss_streak >= 3) {
    tiltRisk = "high";
    reason = "Multiple consecutive losses detected";
    recommendation = "Emergency liquidation initiated. Step away from the screen.";
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

  return { tiltRisk, reason, recommendation };
}

/**
 * Guardian Cron Job - Runs every minute to monitor tilt risk
 * Automatically liquidates positions when high tilt risk is detected
 */
export const guardianMonitor = new CronJob("guardian-monitor", {
  schedule: "*/1 * * * *", // Every minute
  title: "Guardian Risk Monitor",
  handler: async () => {
    log.info("Guardian: Starting tilt risk monitoring cycle");

    try {
    // Get all accounts with autopilot enabled
    const autopilotAccounts = await db.query<{
      user_id: string;
      projectx_account_id: number;
      max_daily_loss: number;
      autopilot_enabled: boolean;
    }>`
      SELECT user_id, projectx_account_id, max_daily_loss, autopilot_enabled
      FROM accounts
      WHERE autopilot_enabled = true AND projectx_account_id IS NOT NULL
    `;

    let monitoredAccounts = 0;
    let emergencyActions = 0;

    for (const account of autopilotAccounts) {
      try {
        monitoredAccounts++;

        // Check tilt risk for this account
        const tiltCheck = await checkTiltRisk(account.user_id, account.projectx_account_id);

        if (tiltCheck.tiltRisk === "high") {
          log.warn("Guardian: HIGH TILT RISK detected - initiating emergency liquidation", {
            userId: account.user_id,
            accountId: account.projectx_account_id,
            reason: tiltCheck.reason,
            recommendation: tiltCheck.recommendation,
          });

          // Get all open positions for this account
          const openPositions = await projectx.searchOpenPositions(account.projectx_account_id);

          if (openPositions.length > 0) {
            log.info("Guardian: Liquidating positions", {
              userId: account.user_id,
              accountId: account.projectx_account_id,
              positionCount: openPositions.length,
            });

            // Close all positions
            for (const position of openPositions) {
              try {
                await projectx.closePosition(
                  account.projectx_account_id,
                  position.contractId
                );

                log.info("Guardian: Position closed successfully", {
                  userId: account.user_id,
                  accountId: account.projectx_account_id,
                  contractId: position.contractId,
                  size: position.size,
                });

                emergencyActions++;
              } catch (error) {
                log.error("Guardian: Failed to close position", {
                  error: error instanceof Error ? error.message : String(error),
                  userId: account.user_id,
                  accountId: account.projectx_account_id,
                  contractId: position.contractId,
                });
              }
            }

            // Record the emergency action in tilt_events
            await db.exec`
              INSERT INTO tilt_events (
                user_id, account_id, risk_level, reason, recommendation, acknowledged
              ) VALUES (
                ${account.user_id}, ${account.projectx_account_id}, 'high',
                ${tiltCheck.reason}, ${tiltCheck.recommendation}, true
              )
            `;

          } else {
            log.info("Guardian: No open positions to liquidate", {
              userId: account.user_id,
              accountId: account.projectx_account_id,
            });
          }
        }

      } catch (error) {
        log.error("Guardian: Error monitoring account", {
          error: error instanceof Error ? error.message : String(error),
          userId: account.user_id,
          accountId: account.projectx_account_id,
        });
      }
    }

    log.info("Guardian: Monitoring cycle completed", {
      monitoredAccounts,
      emergencyActions,
      totalAccounts: autopilotAccounts.length,
    });

    } catch (error) {
      log.error("Guardian: Critical error in monitoring cycle", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
