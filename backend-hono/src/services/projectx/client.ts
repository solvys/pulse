/**
 * ProjectX Client Service
 * API client for TopStepX trading operations
 */

import type {
  ProjectXAccount,
  ProjectXPosition,
  ProjectXOrder,
  ProjectXContract,
  ProjectXCredentials,
} from '../../types/projectx.js';
import { getToken, clearToken } from './auth.js';

const BASE_URL = 'https://api.topstepx.com';

interface ApiResponse<T> {
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
  accounts?: T[];
  positions?: T[];
  orders?: T[];
  contracts?: T[];
}

/**
 * Make authenticated API request with retry on auth failure
 */
async function apiRequest<T>(
  endpoint: string,
  userId: string,
  credentials: ProjectXCredentials,
  body: Record<string, unknown> = {}
): Promise<T> {
  const token = await getToken(userId, credentials);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Accept': 'text/plain',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    // Token expired, clear and retry once
    clearToken(userId);
    const newToken = await getToken(userId, credentials);

    const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!retryResponse.ok) {
      throw new Error(`ProjectX API error: ${retryResponse.status}`);
    }

    return retryResponse.json() as Promise<T>;
  }

  if (response.status === 429) {
    throw new Error('Rate limit exceeded for ProjectX API');
  }

  if (!response.ok) {
    throw new Error(`ProjectX API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search for accounts
 */
export async function searchAccounts(
  userId: string,
  credentials: ProjectXCredentials,
  onlyActive = true
): Promise<ProjectXAccount[]> {
  const response = await apiRequest<ApiResponse<ProjectXAccount>>(
    '/api/Account/search',
    userId,
    credentials,
    { onlyActiveAccounts: onlyActive }
  );

  if (!response.success) {
    throw new Error(`Failed to search accounts: ${response.errorMessage}`);
  }

  return response.accounts || [];
}

/**
 * Search for open positions
 */
export async function searchOpenPositions(
  userId: string,
  credentials: ProjectXCredentials,
  accountId: number
): Promise<ProjectXPosition[]> {
  const response = await apiRequest<ApiResponse<ProjectXPosition>>(
    '/api/Position/searchOpen',
    userId,
    credentials,
    { accountId }
  );

  if (!response.success) {
    throw new Error(`Failed to search positions: ${response.errorMessage}`);
  }

  return response.positions || [];
}

/**
 * Search for open orders
 */
export async function searchOpenOrders(
  userId: string,
  credentials: ProjectXCredentials,
  accountId: number
): Promise<ProjectXOrder[]> {
  const response = await apiRequest<ApiResponse<ProjectXOrder>>(
    '/api/Order/searchOpen',
    userId,
    credentials,
    { accountId }
  );

  if (!response.success) {
    throw new Error(`Failed to search orders: ${response.errorMessage}`);
  }

  return response.orders || [];
}

/**
 * Get available contracts
 */
export async function getAvailableContracts(
  userId: string,
  credentials: ProjectXCredentials,
  live = false
): Promise<ProjectXContract[]> {
  const response = await apiRequest<ApiResponse<ProjectXContract>>(
    '/api/Contract/available',
    userId,
    credentials,
    { live }
  );

  if (!response.success) {
    throw new Error(`Failed to get contracts: ${response.errorMessage}`);
  }

  return response.contracts || [];
}

/**
 * Close a position
 */
export async function closePosition(
  userId: string,
  credentials: ProjectXCredentials,
  accountId: number,
  contractId: string
): Promise<void> {
  const response = await apiRequest<{ success: boolean; errorMessage?: string }>(
    '/api/Position/closeContract',
    userId,
    credentials,
    { accountId, contractId }
  );

  if (!response.success) {
    throw new Error(`Failed to close position: ${response.errorMessage}`);
  }
}
