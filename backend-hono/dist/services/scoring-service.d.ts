/**
 * IV Scoring Service
 * Handles IV score calculation, caching, and symbol-specific scoring
 */
import type { IVScore, IVScoreResponse } from '../types/ai.js';
/**
 * Calculate IV score for a symbol or general market
 * Uses formula-based calculation with optional AI enhancement
 */
export declare function calculateIVScore(userId?: string, symbol?: string, instrument?: string): Promise<IVScoreResponse>;
/**
 * Get current IV score (cached or fresh)
 */
export declare function getCurrentIVScore(userId?: string, symbol?: string): Promise<IVScoreResponse>;
/**
 * Get IV score history
 */
export declare function getIVScoreHistory(userId: string, symbol?: string, limit?: number, offset?: number): Promise<{
    scores: IVScore[];
    total: number;
}>;
/**
 * Get current VIX level
 */
export declare function getCurrentVIX(): Promise<{
    value: number;
    timestamp: string;
    source: string;
}>;
/**
 * Clear score cache (useful for testing or manual refresh)
 */
export declare function clearScoreCache(symbol?: string): void;
//# sourceMappingURL=scoring-service.d.ts.map