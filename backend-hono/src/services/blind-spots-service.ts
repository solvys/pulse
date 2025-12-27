/**
 * Blind Spots Service
 * Manages user blind spots (AI-determined and custom)
 */

import { sql } from '../db/index.js';
import type { BlindSpot, BlindSpotsResponse, BlindSpotRequest } from '../types/ai.js';

// Guard-railed blind spots that cannot be deleted
const GUARD_RAILED_BLIND_SPOTS = [
  'Revenge trading',
  'Excessive resetting',
  'Over-trading',
  'Impatient entries',
  'Trading from bad prices',
  'Not honoring the plan',
];

/**
 * Check if a blind spot name is guard-railed
 */
function isGuardRailed(name: string): boolean {
  return GUARD_RAILED_BLIND_SPOTS.some(
    (guarded) => guarded.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all blind spots for a user
 * Returns data formatted for 3-column checkbox dropdown
 */
export async function getUserBlindSpots(userId: string): Promise<BlindSpotsResponse> {
  const blindSpots = await sql`
    SELECT 
      id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
      is_active as "isActive", category, source, created_at as "createdAt",
      updated_at as "updatedAt"
    FROM blind_spots
    WHERE user_id = ${userId}
    ORDER BY is_guard_railed DESC, category, name
  `;

  const formatted: BlindSpot[] = blindSpots.map((row: any) => ({
    id: row.id.toString(),
    name: row.name,
    isGuardRailed: row.isGuardRailed,
    isActive: row.isActive,
    category: row.category || 'custom',
    source: row.source || 'user',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }));

  // Group by category for 3-column layout
  const behavioral: BlindSpot[] = [];
  const risk: BlindSpot[] = [];
  const execution: BlindSpot[] = [];
  const custom: BlindSpot[] = [];

  formatted.forEach((spot) => {
    switch (spot.category) {
      case 'behavioral':
        behavioral.push(spot);
        break;
      case 'risk':
        risk.push(spot);
        break;
      case 'execution':
        execution.push(spot);
        break;
      default:
        custom.push(spot);
    }
  });

  return {
    blindSpots: formatted,
    columns: {
      column1: behavioral,
      column2: risk,
      column3: execution.length > 0 ? execution : custom,
    },
  };
}

/**
 * Get active blind spots only (for autopilot/threat checking)
 */
export async function getActiveBlindSpots(userId: string): Promise<BlindSpot[]> {
  const blindSpots = await sql`
    SELECT 
      id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
      is_active as "isActive", category, source, created_at as "createdAt"
    FROM blind_spots
    WHERE user_id = ${userId} AND is_active = true
    ORDER BY is_guard_railed DESC, category, name
  `;

  return blindSpots.map((row: any) => ({
    id: row.id.toString(),
    name: row.name,
    isGuardRailed: row.isGuardRailed,
    isActive: row.isActive,
    category: row.category || 'custom',
    source: row.source || 'user',
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Add or update a blind spot
 */
export async function upsertBlindSpot(
  userId: string,
  blindSpotId: string | undefined,
  data: BlindSpotRequest
): Promise<BlindSpot> {
  const guardRailed = isGuardRailed(data.name);
  const category = data.category || 'custom';
  const isActive = data.isActive !== undefined ? data.isActive : true;

  if (blindSpotId) {
    // Update existing blind spot
    const [updated] = await sql`
      UPDATE blind_spots
      SET 
        name = ${data.name},
        category = ${category},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${parseInt(blindSpotId)} AND user_id = ${userId}
      RETURNING 
        id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
        is_active as "isActive", category, source, created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!updated) {
      throw new Error('Blind spot not found');
    }

    return {
      id: updated.id.toString(),
      name: updated.name,
      isGuardRailed: updated.isGuardRailed,
      isActive: updated.isActive,
      category: updated.category || 'custom',
      source: updated.source || 'user',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    };
  } else {
    // Create new blind spot
    const [created] = await sql`
      INSERT INTO blind_spots (
        user_id, name, is_guard_railed, is_active, category, source
      )
      VALUES (
        ${userId}, ${data.name}, ${guardRailed}, ${isActive},
        ${category}, 'user'
      )
      RETURNING 
        id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
        is_active as "isActive", category, source, created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    return {
      id: created.id.toString(),
      name: created.name,
      isGuardRailed: created.isGuardRailed,
      isActive: created.isActive,
      category: created.category || 'custom',
      source: created.source || 'user',
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt?.toISOString(),
    };
  }
}

/**
 * Delete a blind spot (cannot delete guard-railed ones)
 */
export async function deleteBlindSpot(userId: string, blindSpotId: string): Promise<void> {
  // Check if guard-railed
  const [spot] = await sql`
    SELECT is_guard_railed, name
    FROM blind_spots
    WHERE id = ${parseInt(blindSpotId)} AND user_id = ${userId}
  `;

  if (!spot) {
    throw new Error('Blind spot not found');
  }

  if (spot.is_guard_railed || isGuardRailed(spot.name)) {
    throw new Error('Cannot delete guard-railed blind spot');
  }

  await sql`
    DELETE FROM blind_spots
    WHERE id = ${parseInt(blindSpotId)} AND user_id = ${userId}
  `;
}

/**
 * Create AI-determined blind spot
 */
export async function createAIDeterminedBlindSpot(
  userId: string,
  name: string,
  category: 'behavioral' | 'risk' | 'execution' = 'behavioral'
): Promise<BlindSpot> {
  const guardRailed = isGuardRailed(name);

  const [created] = await sql`
    INSERT INTO blind_spots (
      user_id, name, is_guard_railed, is_active, category, source
    )
    VALUES (
      ${userId}, ${name}, ${guardRailed}, true, ${category}, 'ai'
    )
    ON CONFLICT (user_id, name) DO UPDATE SET
      is_active = true,
      updated_at = NOW()
    RETURNING 
      id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
      is_active as "isActive", category, source, created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return {
    id: created.id.toString(),
    name: created.name,
    isGuardRailed: created.isGuardRailed,
    isActive: created.isActive,
    category: created.category || category,
    source: 'ai',
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt?.toISOString(),
  };
}

/**
 * Toggle blind spot active status
 */
export async function toggleBlindSpot(
  userId: string,
  blindSpotId: string,
  isActive: boolean
): Promise<BlindSpot> {
  const [updated] = await sql`
    UPDATE blind_spots
    SET is_active = ${isActive}, updated_at = NOW()
    WHERE id = ${parseInt(blindSpotId)} AND user_id = ${userId}
    RETURNING 
      id, user_id as "userId", name, is_guard_railed as "isGuardRailed",
      is_active as "isActive", category, source, created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!updated) {
    throw new Error('Blind spot not found');
  }

  return {
    id: updated.id.toString(),
    name: updated.name,
    isGuardRailed: updated.isGuardRailed,
    isActive: updated.isActive,
    category: updated.category || 'custom',
    source: updated.source || 'user',
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt?.toISOString(),
  };
}
