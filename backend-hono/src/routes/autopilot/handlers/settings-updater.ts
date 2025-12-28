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
  // Map field names to database columns
  const fieldMap: Record<string, string> = {
    enabled: 'enabled',
    dailyLossLimit: 'daily_loss_limit',
    maxPositionSize: 'max_position_size',
    defaultOrderType: 'default_order_type',
    requireStopLoss: 'require_stop_loss',
    strategyEnabled: 'strategy_enabled',
    positionSizingMethod: 'position_sizing_method',
    positionSizingValue: 'position_sizing_value',
    riskLevel: 'risk_level',
    selectedInstrument: 'selected_instrument',
    primaryInstrument: 'primary_instrument',
    correlatedPairSymbol: 'correlated_pair_symbol',
    rsiOverboughtThreshold: 'rsi_overbought_threshold',
    rsiOversoldThreshold: 'rsi_oversold_threshold',
    semiAutopilotWindow: 'semi_autopilot_window',
    fullAutopilotWindow: 'full_autopilot_window',
  };

  const dbField = fieldMap[field];
  if (!dbField) {
    throw new Error(`Unknown field: ${field}`);
  }

  // Use individual field updates (Neon doesn't support sql.raw)
  // This function is kept for compatibility but individual updates are preferred
  switch (dbField) {
    case 'enabled':
      await sql`UPDATE autopilot_settings SET enabled = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'daily_loss_limit':
      await sql`UPDATE autopilot_settings SET daily_loss_limit = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'max_position_size':
      await sql`UPDATE autopilot_settings SET max_position_size = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'default_order_type':
      await sql`UPDATE autopilot_settings SET default_order_type = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'require_stop_loss':
      await sql`UPDATE autopilot_settings SET require_stop_loss = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'strategy_enabled':
      await sql`UPDATE autopilot_settings SET strategy_enabled = ${JSON.stringify(value)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'position_sizing_method':
      await sql`UPDATE autopilot_settings SET position_sizing_method = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'position_sizing_value':
      await sql`UPDATE autopilot_settings SET position_sizing_value = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'risk_level':
      await sql`UPDATE autopilot_settings SET risk_level = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'selected_instrument':
      await sql`UPDATE autopilot_settings SET selected_instrument = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'primary_instrument':
      await sql`UPDATE autopilot_settings SET primary_instrument = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'correlated_pair_symbol':
      await sql`UPDATE autopilot_settings SET correlated_pair_symbol = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'rsi_overbought_threshold':
      await sql`UPDATE autopilot_settings SET rsi_overbought_threshold = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'rsi_oversold_threshold':
      await sql`UPDATE autopilot_settings SET rsi_oversold_threshold = ${value}, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'semi_autopilot_window':
      await sql`UPDATE autopilot_settings SET semi_autopilot_window = ${JSON.stringify(value)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    case 'full_autopilot_window':
      await sql`UPDATE autopilot_settings SET full_autopilot_window = ${JSON.stringify(value)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
      break;
    default:
      throw new Error(`Unknown field: ${field}`);
  }
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
