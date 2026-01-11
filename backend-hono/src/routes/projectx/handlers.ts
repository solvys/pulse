/**
 * ProjectX Handlers
 * Request handlers for ProjectX endpoints
 */

import type { Context } from 'hono';
import * as projectxService from '../../services/projectx-service.js';
import type { SyncCredentialsRequest } from '../../types/projectx.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * GET /api/projectx/accounts
 * Get linked ProjectX accounts
 */
export async function handleGetAccounts(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Check if credentials configured
    if (!projectxService.hasCredentials(userId)) {
      // Return mock data in development
      if (isDev) {
        return c.json(projectxService.getMockAccounts());
      }
      return c.json({ error: 'ProjectX not connected', code: 'NOT_CONNECTED' }, 400);
    }

    const accounts = await projectxService.getAccounts(userId);
    return c.json(accounts);
  } catch (error) {
    console.error('[ProjectX] Get accounts error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /api/projectx/sync
 * Sync/store ProjectX credentials
 */
export async function handleSyncCredentials(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<SyncCredentialsRequest>().catch(() => null);

    if (!body?.username || !body?.apiKey) {
      return c.json({ error: 'Username and API key are required' }, 400);
    }

    const result = await projectxService.syncCredentials(userId, {
      username: body.username,
      apiKey: body.apiKey,
    });

    return c.json(result);
  } catch (error) {
    console.error('[ProjectX] Sync error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync credentials';

    // Handle specific auth errors
    if (message.includes('auth failed')) {
      return c.json({ error: 'Invalid credentials', code: 'AUTH_FAILED' }, 401);
    }

    return c.json({ error: message }, 500);
  }
}

/**
 * GET /api/projectx/positions/:accountId
 * Get positions for a specific account
 */
export async function handleGetPositions(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const accountIdParam = c.req.param('accountId');

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const accountId = parseInt(accountIdParam, 10);
  if (isNaN(accountId)) {
    return c.json({ error: 'Invalid account ID' }, 400);
  }

  try {
    if (!projectxService.hasCredentials(userId)) {
      if (isDev) {
        return c.json(projectxService.getMockPositions(accountId));
      }
      return c.json({ error: 'ProjectX not connected', code: 'NOT_CONNECTED' }, 400);
    }

    const positions = await projectxService.getPositions(userId, accountId);
    return c.json(positions);
  } catch (error) {
    console.error('[ProjectX] Get positions error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch positions';
    return c.json({ error: message }, 500);
  }
}

/**
 * GET /api/projectx/status
 * Check connection status
 */
export async function handleCheckConnection(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const connected = projectxService.hasCredentials(userId);

  return c.json({
    connected,
    message: connected ? 'ProjectX connected' : 'Not connected',
  });
}

/**
 * POST /api/projectx/disconnect
 * Clear stored credentials
 */
export async function handleDisconnect(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  projectxService.clearCredentials(userId);

  return c.json({ success: true, message: 'Disconnected from ProjectX' });
}
