/**
 * ProjectX Routes
 * Route registration for /api/projectx endpoints
 */

import { Hono } from 'hono';
import {
  handleGetAccounts,
  handleSyncCredentials,
  handleGetPositions,
  handleCheckConnection,
  handleDisconnect,
} from './handlers.js';

export function createProjectXRoutes(): Hono {
  const router = new Hono();

  // GET /api/projectx/accounts - List linked accounts
  router.get('/accounts', handleGetAccounts);

  // POST /api/projectx/sync - Sync/store credentials
  router.post('/sync', handleSyncCredentials);

  // GET /api/projectx/positions/:accountId - Get positions for account
  router.get('/positions/:accountId', handleGetPositions);

  // GET /api/projectx/status - Check connection status
  router.get('/status', handleCheckConnection);

  // POST /api/projectx/disconnect - Clear credentials
  router.post('/disconnect', handleDisconnect);

  return router;
}
