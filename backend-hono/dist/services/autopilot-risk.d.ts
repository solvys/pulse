/**
 * Autopilot Risk Validation Service
 *
 * Validates proposals before creation and execution.
 * Includes pre-proposal validation (threats, blind spots, IV scores) and standard risk checks.
 */
interface ThreatCheckResult {
    blocked: boolean;
    reason?: string;
    threats: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
}
interface BlindSpotCheckResult {
    blocked: boolean;
    reason?: string;
    blindSpots: Array<{
        name: string;
        category: string;
        isGuardRailed: boolean;
    }>;
}
interface IVScoreResult {
    score: number;
    level: 'low' | 'medium' | 'high' | 'good';
    vix?: number;
}
interface RiskValidationResult {
    valid: boolean;
    reasons: string[];
    riskMetrics?: {
        dailyLoss: number;
        positionSize: number;
        accountBalance: number;
        concurrentPositions: number;
    };
}
/**
 * Check threat history (stub implementation - will be replaced with real endpoint)
 */
export declare function checkThreatHistory(userId: string): Promise<ThreatCheckResult>;
/**
 * Check blind spots (stub implementation - will be replaced with real endpoint)
 */
export declare function checkBlindSpots(userId: string): Promise<BlindSpotCheckResult>;
/**
 * Get IV score (stub implementation - will be replaced with real endpoint)
 */
export declare function getIVScore(userId: string, symbol: string): Promise<IVScoreResult>;
/**
 * Validate trading frequency
 */
export declare function validateTradingFrequency(userId: string, accountId: number): Promise<{
    valid: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
}>;
/**
 * Validate standard risk parameters
 */
export declare function validateRisk(userId: string, accountId: number, proposalSize: number, proposalPrice?: number): Promise<RiskValidationResult>;
/**
 * Invalidate cache for a user (call when proposal is rejected)
 */
export declare function invalidateCache(userId: string): void;
export {};
//# sourceMappingURL=autopilot-risk.d.ts.map