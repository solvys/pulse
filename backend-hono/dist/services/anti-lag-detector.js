/**
 * Anti-Lag Detection Service
 *
 * Detects synchronized tick rate increases between correlated pairs.
 * Threshold: Both instruments must exceed 30% increase in ticks/second simultaneously.
 * Confirmation: Primary instrument candle closes with >1000 ticks.
 */
import { sql } from '../db/index.js';
// Asset class categorization
const RISK_ASSETS = ['ES', 'NQ', 'YM', 'RTY'];
const SAFE_HAVENS = ['GOLD', 'SILVER', 'PLATINUM', 'XAU', 'XAG', 'XPT'];
function getAssetClass(symbol) {
    const upperSymbol = symbol.toUpperCase();
    if (RISK_ASSETS.some(asset => upperSymbol.includes(asset))) {
        return 'risk';
    }
    if (SAFE_HAVENS.some(asset => upperSymbol.includes(asset))) {
        return 'safe_haven';
    }
    return 'unknown';
}
/**
 * Detect anti-lag between primary and correlated pair
 *
 * This is a placeholder implementation. Real implementation would:
 * 1. Monitor tick rates (ticks/second) for both instruments
 * 2. Calculate baseline tick rate (average over recent period)
 * 3. Calculate percentage increase
 * 4. Check if both exceed 30% simultaneously
 * 5. Check if primary candle has >1000 ticks
 */
export async function detectAntiLag(userId, primarySymbol, correlatedSymbol, lookbackSeconds = 60) {
    // TODO: Implement real tick rate monitoring
    // This requires real-time market data from ProjectX SignalR or similar
    // For now, return a placeholder that indicates detection logic would go here
    const primaryAssetClass = getAssetClass(primarySymbol);
    const correlatedAssetClass = getAssetClass(correlatedSymbol);
    // Determine event type based on asset classes
    let eventType = 'anti_lag';
    if (primaryAssetClass === 'safe_haven' && correlatedAssetClass === 'risk') {
        eventType = 'contra_anti_lag';
    }
    else if (primaryAssetClass === 'risk' && correlatedAssetClass === 'safe_haven') {
        eventType = 'contra_anti_lag';
    }
    // Placeholder: In real implementation, this would:
    // 1. Get tick rate data for both symbols over lookbackSeconds
    // 2. Calculate baseline (average tick rate over last N seconds)
    // 3. Calculate current tick rate
    // 4. Calculate percentage increase: (current - baseline) / baseline * 100
    // 5. Check if both exceed 30%
    // 6. Check if primary candle has >1000 ticks
    // 7. Return detection result
    // For now, return not detected (placeholder)
    return {
        detected: false,
        confidence: 0,
    };
}
/**
 * Record anti-lag event in database
 */
export async function recordAntiLagEvent(userId, event) {
    await sql `
    INSERT INTO autopilot_anti_lag_events (
      user_id, primary_symbol, correlated_symbol, event_type,
      tick_rate_primary, tick_rate_correlated,
      tick_rate_increase_primary, tick_rate_increase_correlated,
      candle_ticks_primary, confirmed, metadata
    )
    VALUES (
      ${userId}, ${event.primarySymbol}, ${event.correlatedSymbol}, ${event.eventType},
      ${event.tickRatePrimary}, ${event.tickRateCorrelated},
      ${event.tickRateIncreasePrimary}, ${event.tickRateIncreaseCorrelated},
      ${event.candleTicksPrimary}, ${event.confirmed}, ${JSON.stringify({})}
    )
  `;
}
/**
 * Get available correlated pairs for an instrument
 */
export function getAvailableCorrelatedPairs(symbol) {
    const assetClass = getAssetClass(symbol);
    const upperSymbol = symbol.toUpperCase();
    if (assetClass === 'risk') {
        // For risk assets, recommend other risk assets
        return RISK_ASSETS
            .filter(asset => !upperSymbol.includes(asset))
            .map(asset => ({
            symbol: asset,
            assetClass: 'risk',
            recommended: true,
        }));
    }
    if (assetClass === 'safe_haven') {
        // For safe havens, recommend other safe havens or risk assets (for contra anti-lag)
        const safeHavens = SAFE_HAVENS
            .filter(asset => !upperSymbol.includes(asset))
            .map(asset => ({
            symbol: asset,
            assetClass: 'safe_haven',
            recommended: true,
        }));
        const riskAssets = RISK_ASSETS.map(asset => ({
            symbol: asset,
            assetClass: 'risk',
            recommended: false, // Not recommended but valid for contra anti-lag
        }));
        return [...safeHavens, ...riskAssets];
    }
    return [];
}
/**
 * Check if asset classes match (for warnings)
 */
export function checkAssetClassMatch(primarySymbol, correlatedSymbol) {
    const primaryClass = getAssetClass(primarySymbol);
    const correlatedClass = getAssetClass(correlatedSymbol);
    if (primaryClass === 'unknown' || correlatedClass === 'unknown') {
        return { match: true }; // Don't warn if we can't determine
    }
    if (primaryClass !== correlatedClass) {
        return {
            match: false,
            warning: 'Autopilot functions may be affected because you\'re not choosing assets from the same asset class (risk assets vs safe havens). This is valid for contra anti-lag but may affect detection accuracy.',
        };
    }
    return { match: true };
}
//# sourceMappingURL=anti-lag-detector.js.map