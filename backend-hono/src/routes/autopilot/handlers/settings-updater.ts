/**
 * Settings Updater
 * Helper functions for updating autopilot settings
 */

import { sql } from '../../../db/index.js';

export async function updateSettingsField(
  userId: string,
  field: string,
  value: any
): Promise<void> {
  await sql`UPDATE autopilot_settings SET ${sql.raw(field)} = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
}

export async function ensureSettingsExists(userId: string): Promise<void> {
  await sql`
    INSERT INTO autopilot_settings (user_id, updated_at)
    VALUES (${userId}, NOW())
    ON CONFLICT (user_id) DO NOTHING
  `;
}

export async function getUpdatedSettings(userId: string) {
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
  return updated;
}
