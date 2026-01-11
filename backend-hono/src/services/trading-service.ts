/**
 * Trading Service
 * Business logic for trading operations
 */

import type {
  Position,
  PositionListResponse,
  AlgoStatus,
  ToggleAlgoResponse,
} from '../types/trading.js';

// In-memory store for algo status (per user)
const algoStatusStore = new Map<string, AlgoStatus>();

/**
 * Get positions for a user
 * Currently returns mock data - will integrate with ProjectX in Phase 3
 */
export async function getPositions(userId: string): Promise<PositionListResponse> {
  // TODO: Integrate with ProjectX API in Phase 3
  const mockPositions = generateMockPositions(userId);

  const totalUnrealizedPnl = mockPositions.reduce(
    (sum, pos) => sum + pos.unrealizedPnl,
    0
  );

  return {
    positions: mockPositions,
    total: mockPositions.length,
    totalUnrealizedPnl,
  };
}

/**
 * Toggle algo trading status
 */
export async function toggleAlgo(
  userId: string,
  enabled: boolean,
  strategy?: string
): Promise<ToggleAlgoResponse> {
  const currentStatus = algoStatusStore.get(userId) || {
    enabled: false,
    activeStrategy: undefined,
  };

  const newStatus: AlgoStatus = {
    enabled,
    activeStrategy: enabled ? (strategy || currentStatus.activeStrategy) : undefined,
    lastTriggered: enabled ? new Date() : currentStatus.lastTriggered,
  };

  algoStatusStore.set(userId, newStatus);

  return {
    success: true,
    algoStatus: newStatus,
  };
}

/**
 * Get current algo status for a user
 */
export async function getAlgoStatus(userId: string): Promise<AlgoStatus> {
  return algoStatusStore.get(userId) || {
    enabled: false,
    activeStrategy: undefined,
  };
}

/**
 * Generate mock positions for development
 */
function generateMockPositions(userId: string): Position[] {
  const now = new Date();
  const symbols = ['ES', 'NQ', 'YM', 'RTY'];
  const positions: Position[] = [];

  // Generate 0-3 random open positions
  const positionCount = Math.floor(Math.random() * 4);

  for (let i = 0; i < positionCount; i++) {
    const symbol = symbols[i % symbols.length];
    const side = Math.random() > 0.5 ? 'long' : 'short';
    const quantity = Math.floor(Math.random() * 5) + 1;
    const entryPrice = getBasePrice(symbol) + (Math.random() * 20 - 10);
    const currentPrice = entryPrice + (Math.random() * 40 - 20);
    const priceDiff = side === 'long'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;
    const unrealizedPnl = priceDiff * quantity * getMultiplier(symbol);

    positions.push({
      id: `pos-${userId}-${i}`,
      userId,
      symbol,
      side: side as 'long' | 'short',
      quantity,
      entryPrice: Math.round(entryPrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      realizedPnl: 0,
      status: 'open',
      createdAt: new Date(now.getTime() - Math.random() * 3600_000),
      updatedAt: now,
    });
  }

  return positions;
}

function getBasePrice(symbol: string): number {
  const basePrices: Record<string, number> = {
    ES: 5200,
    NQ: 18500,
    YM: 39000,
    RTY: 2050,
  };
  return basePrices[symbol] || 1000;
}

function getMultiplier(symbol: string): number {
  const multipliers: Record<string, number> = {
    ES: 50,
    NQ: 20,
    YM: 5,
    RTY: 50,
  };
  return multipliers[symbol] || 1;
}
