/**
 * Anti-Lag Detection Service
 *
 * Detects synchronized tick rate increases between correlated pairs.
 * Threshold: Both instruments must exceed 30% increase in ticks/second simultaneously.
 * Confirmation: Primary instrument candle closes with >1000 ticks.
 */
interface AntiLagEvent {
    primarySymbol: string;
    correlatedSymbol: string;
    eventType: 'anti_lag' | 'contra_anti_lag';
    tickRatePrimary: number;
    tickRateCorrelated: number;
    tickRateIncreasePrimary: number;
    tickRateIncreaseCorrelated: number;
    candleTicksPrimary: number;
    confirmed: boolean;
}
interface AntiLagDetectionResult {
    detected: boolean;
    eventType?: 'anti_lag' | 'contra_anti_lag';
    metrics?: {
        tickRateIncreasePrimary: number;
        tickRateIncreaseCorrelated: number;
        candleTicksPrimary: number;
    };
    confidence: number;
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
export declare function detectAntiLag(userId: string, primarySymbol: string, correlatedSymbol: string, lookbackSeconds?: number): Promise<AntiLagDetectionResult>;
/**
 * Record anti-lag event in database
 */
export declare function recordAntiLagEvent(userId: string, event: AntiLagEvent): Promise<void>;
/**
 * Get available correlated pairs for an instrument
 */
export declare function getAvailableCorrelatedPairs(symbol: string): Array<{
    symbol: string;
    assetClass: 'risk' | 'safe_haven' | 'unknown';
    recommended: boolean;
}>;
/**
 * Check if asset classes match (for warnings)
 */
export declare function checkAssetClassMatch(primarySymbol: string, correlatedSymbol: string): {
    match: boolean;
    warning?: string;
};
export {};
//# sourceMappingURL=anti-lag-detector.d.ts.map