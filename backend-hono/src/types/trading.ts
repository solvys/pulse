/**
 * Trading Types
 * Type definitions for trading operations
 */

export type PositionSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed' | 'pending';

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: PositionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionListResponse {
  positions: Position[];
  total: number;
  totalUnrealizedPnl: number;
}

export interface AlgoStatus {
  enabled: boolean;
  lastTriggered?: Date;
  activeStrategy?: string;
}

export interface ToggleAlgoRequest {
  enabled: boolean;
  strategy?: string;
}

export interface ToggleAlgoResponse {
  success: boolean;
  algoStatus: AlgoStatus;
}
