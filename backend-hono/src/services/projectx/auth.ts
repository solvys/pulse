/**
 * ProjectX Auth Service
 * Token management for TopStepX API
 */

import type { ProjectXAuthResponse, ProjectXCredentials } from '../../types/projectx.js';

const BASE_URL = 'https://api.topstepx.com';
const TOKEN_EXPIRY_MS = 23 * 60 * 60 * 1000; // 23 hours

// In-memory token cache per user
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get cached token for a user
 */
export function getCachedToken(userId: string): string | null {
  const cached = tokenCache.get(userId);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    tokenCache.delete(userId);
    return null;
  }
  return cached.token;
}

/**
 * Cache a token for a user
 */
export function cacheToken(userId: string, token: string): void {
  tokenCache.set(userId, {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  });
}

/**
 * Clear cached token for a user
 */
export function clearToken(userId: string): void {
  tokenCache.delete(userId);
}

/**
 * Authenticate with ProjectX API and get token
 */
export async function authenticate(credentials: ProjectXCredentials): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/Auth/loginKey`, {
    method: 'POST',
    headers: {
      'Accept': 'text/plain',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userName: credentials.username,
      apiKey: credentials.apiKey,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded for ProjectX API');
    }
    throw new Error(`ProjectX auth failed: ${response.status}`);
  }

  const data = await response.json() as ProjectXAuthResponse;

  if (!data.success || data.errorCode !== 0) {
    throw new Error(`ProjectX auth failed: ${data.errorMessage || 'Unknown error'}`);
  }

  return data.token;
}

/**
 * Validate an existing token
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/Auth/validate`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get or refresh token for a user
 */
export async function getToken(
  userId: string,
  credentials: ProjectXCredentials
): Promise<string> {
  // Check cache first
  const cached = getCachedToken(userId);
  if (cached) return cached;

  // Authenticate and cache
  const token = await authenticate(credentials);
  cacheToken(userId, token);

  return token;
}
