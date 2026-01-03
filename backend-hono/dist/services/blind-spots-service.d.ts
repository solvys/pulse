/**
 * Blind Spots Service
 * Manages user blind spots (AI-determined and custom)
 */
import type { BlindSpot, BlindSpotsResponse, BlindSpotRequest } from '../types/ai.js';
/**
 * Get all blind spots for a user
 * Returns data formatted for 3-column checkbox dropdown
 */
export declare function getUserBlindSpots(userId: string): Promise<BlindSpotsResponse>;
/**
 * Get active blind spots only (for autopilot/threat checking)
 */
export declare function getActiveBlindSpots(userId: string): Promise<BlindSpot[]>;
/**
 * Add or update a blind spot
 */
export declare function upsertBlindSpot(userId: string, blindSpotId: string | undefined, data: BlindSpotRequest): Promise<BlindSpot>;
/**
 * Delete a blind spot (cannot delete guard-railed ones)
 */
export declare function deleteBlindSpot(userId: string, blindSpotId: string): Promise<void>;
/**
 * Create AI-determined blind spot
 */
export declare function createAIDeterminedBlindSpot(userId: string, name: string, category?: 'behavioral' | 'risk' | 'execution'): Promise<BlindSpot>;
/**
 * Toggle blind spot active status
 */
export declare function toggleBlindSpot(userId: string, blindSpotId: string, isActive: boolean): Promise<BlindSpot>;
//# sourceMappingURL=blind-spots-service.d.ts.map