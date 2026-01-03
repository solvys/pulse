/**
 * Settings Handler
 * Update autopilot settings
 */
import { sql } from '../../../db/index.js';
import { updateSettingsSchema } from '../schemas.js';
import { ensureSettingsExists, getUpdatedSettings } from './settings-updater.js';
const FIELD_MAPPINGS = {
    enabled: 'enabled',
    dailyLossLimit: 'daily_loss_limit',
    maxPositionSize: 'max_position_size',
    defaultOrderType: 'default_order_type',
    requireStopLoss: 'require_stop_loss',
    positionSizingMethod: 'position_sizing_method',
    positionSizingValue: 'position_sizing_value',
    riskLevel: 'risk_level',
    selectedInstrument: 'selected_instrument',
    primaryInstrument: 'primary_instrument',
    correlatedPairSymbol: 'correlated_pair_symbol',
    rsiOverboughtThreshold: 'rsi_overbought_threshold',
    rsiOversoldThreshold: 'rsi_oversold_threshold',
};
export async function handleUpdateSettings(c) {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = updateSettingsSchema.safeParse(body);
    if (!result.success) {
        return c.json({ error: 'Invalid request body', details: result.error.flatten() }, 400);
    }
    const updates = result.data;
    try {
        // Ensure settings row exists first
        await ensureSettingsExists(userId);
        // Update each field individually
        if (updates.enabled !== undefined) {
            await sql `UPDATE autopilot_settings SET enabled = ${updates.enabled}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.dailyLossLimit !== undefined) {
            await sql `UPDATE autopilot_settings SET daily_loss_limit = ${updates.dailyLossLimit}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.maxPositionSize !== undefined) {
            await sql `UPDATE autopilot_settings SET max_position_size = ${updates.maxPositionSize}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.defaultOrderType !== undefined) {
            await sql `UPDATE autopilot_settings SET default_order_type = ${updates.defaultOrderType}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.requireStopLoss !== undefined) {
            await sql `UPDATE autopilot_settings SET require_stop_loss = ${updates.requireStopLoss}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.strategyEnabled !== undefined) {
            await sql `UPDATE autopilot_settings SET strategy_enabled = ${JSON.stringify(updates.strategyEnabled)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.positionSizingMethod !== undefined) {
            await sql `UPDATE autopilot_settings SET position_sizing_method = ${updates.positionSizingMethod}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.positionSizingValue !== undefined) {
            await sql `UPDATE autopilot_settings SET position_sizing_value = ${updates.positionSizingValue}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.riskLevel !== undefined) {
            await sql `UPDATE autopilot_settings SET risk_level = ${updates.riskLevel}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.selectedInstrument !== undefined) {
            await sql `UPDATE autopilot_settings SET selected_instrument = ${updates.selectedInstrument}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.primaryInstrument !== undefined) {
            await sql `UPDATE autopilot_settings SET primary_instrument = ${updates.primaryInstrument}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.correlatedPairSymbol !== undefined) {
            await sql `UPDATE autopilot_settings SET correlated_pair_symbol = ${updates.correlatedPairSymbol}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.rsiOverboughtThreshold !== undefined) {
            await sql `UPDATE autopilot_settings SET rsi_overbought_threshold = ${updates.rsiOverboughtThreshold}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.rsiOversoldThreshold !== undefined) {
            await sql `UPDATE autopilot_settings SET rsi_oversold_threshold = ${updates.rsiOversoldThreshold}, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.semiAutopilotWindow !== undefined) {
            await sql `UPDATE autopilot_settings SET semi_autopilot_window = ${JSON.stringify(updates.semiAutopilotWindow)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        if (updates.fullAutopilotWindow !== undefined) {
            await sql `UPDATE autopilot_settings SET full_autopilot_window = ${JSON.stringify(updates.fullAutopilotWindow)}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
        }
        // Get updated settings
        const updated = await getUpdatedSettings(userId);
        return c.json(updated || {});
    }
    catch (error) {
        console.error('Failed to update settings:', error);
        return c.json({ error: 'Failed to update settings' }, 500);
    }
}
//# sourceMappingURL=settings.js.map