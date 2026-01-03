/**
 * Threat History Service
 * Tracks and analyzes trading threats (overtrading, emotional indicators, consecutive losses)
 */
import type { Threat, ThreatHistoryResponse, ThreatMetadata } from '../types/ai.js';
/**
 * Get threat history for a user
 * Optionally filter to active threats (last 24 hours)
 */
export declare function getThreatHistory(userId: string, activeOnly?: boolean): Promise<ThreatHistoryResponse>;
/**
 * Detect overtrading threat
 * Compares current trade count to user's "usual trades per duration" setting
 */
export declare function detectOvertrading(userId: string, usualTradesPerDuration: number, durationWindow?: string): Promise<Threat | null>;
/**
 * Detect consecutive losses
 */
export declare function detectConsecutiveLosses(userId: string): Promise<Threat | null>;
/**
 * Detect emotional trading indicators
 * Based on blind spots triggered and trading patterns
 */
export declare function detectEmotionalTrading(userId: string): Promise<Threat | null>;
/**
 * Get daily P&L for threat analysis
 */
export declare function getDailyPnL(userId: string, date?: string): Promise<number>;
/**
 * Run comprehensive threat detection
 */
export declare function detectThreats(userId: string, usualTradesPerDuration?: number, durationWindow?: string): Promise<Threat[]>;
/**
 * Log a threat (for autopilot proposal rejections)
 */
export declare function logThreat(userId: string, type: 'overtrading' | 'emotional' | 'consecutive_losses', severity: 'low' | 'medium' | 'high' | 'critical', description: string, metadata?: ThreatMetadata): Promise<Threat>;
//# sourceMappingURL=threat-service.d.ts.map