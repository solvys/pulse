/**
 * ProjectX Service
 * Business logic for ProjectX/TopStepX integration
 */

import * as projectxClient from './projectx/client.js';
import { clearToken } from './projectx/auth.js';
import type {
  ProjectXCredentials,
  ProjectXAccount,
  ProjectXPosition,
  AccountsResponse,
  PositionsResponse,
  SyncResponse,
} from '../types/projectx.js';

// In-memory credential store (per user)
// In production, these should be stored securely in the database
const credentialStore = new Map<string, ProjectXCredentials>();

/**
 * Store credentials for a user
 */
export function storeCredentials(userId: string, credentials: ProjectXCredentials): void {
  credentialStore.set(userId, credentials);
}

/**
 * Get credentials for a user
 */
export function getCredentials(userId: string): ProjectXCredentials | null {
  // Try in-memory store first
  const stored = credentialStore.get(userId);
  if (stored) return stored;

  // Fallback to environment variables (global credentials)
  const username = process.env.PROJECTX_USERNAME;
  const apiKey = process.env.PROJECTX_API_KEY;

  if (username && apiKey) {
    return { username, apiKey };
  }

  return null;
}

/**
 * Check if user has credentials configured
 */
export function hasCredentials(userId: string): boolean {
  return getCredentials(userId) !== null;
}

/**
 * Clear credentials for a user
 */
export function clearCredentials(userId: string): void {
  credentialStore.delete(userId);
  clearToken(userId);
}

/**
 * Sync credentials and validate by fetching accounts
 */
export async function syncCredentials(
  userId: string,
  credentials: ProjectXCredentials
): Promise<SyncResponse> {
  // Test credentials by fetching accounts
  const accounts = await projectxClient.searchAccounts(userId, credentials, true);

  // Store credentials if successful
  storeCredentials(userId, credentials);

  return {
    success: true,
    accountCount: accounts.length,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Get linked accounts for a user
 */
export async function getAccounts(userId: string): Promise<AccountsResponse> {
  const credentials = getCredentials(userId);

  if (!credentials) {
    throw new Error('ProjectX credentials not configured');
  }

  const accounts = await projectxClient.searchAccounts(userId, credentials, true);

  return {
    accounts,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Get positions for an account
 */
export async function getPositions(
  userId: string,
  accountId: number
): Promise<PositionsResponse> {
  const credentials = getCredentials(userId);

  if (!credentials) {
    throw new Error('ProjectX credentials not configured');
  }

  const positions = await projectxClient.searchOpenPositions(userId, credentials, accountId);

  return {
    positions,
    accountId,
  };
}

/**
 * Generate mock accounts for development/demo
 */
export function getMockAccounts(): AccountsResponse {
  const mockAccounts: ProjectXAccount[] = [
    {
      id: 1001,
      name: 'TopStep Funded Account',
      balance: 50000,
      canTrade: true,
      isVisible: true,
    },
    {
      id: 1002,
      name: 'Practice Account',
      balance: 100000,
      canTrade: true,
      isVisible: true,
    },
  ];

  return {
    accounts: mockAccounts,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Generate mock positions for development/demo
 */
export function getMockPositions(accountId: number): PositionsResponse {
  const mockPositions: ProjectXPosition[] = [
    {
      id: 5001,
      accountId,
      contractId: 'CON.F.US.EP.H26',
      creationTimestamp: new Date(Date.now() - 3600_000).toISOString(),
      type: 1, // Long
      size: 2,
      averagePrice: 5210.50,
    },
  ];

  return {
    positions: mockPositions,
    accountId,
  };
}
