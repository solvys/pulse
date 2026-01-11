/**
 * Route Aggregation
 * Central registration of all API routes
 */

import type { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { createAccountRoutes } from './account/index.js';
import { createMarketRoutes } from './market/index.js';
import { createNotificationRoutes } from './notifications/index.js';
import { createTradingRoutes } from './trading/index.js';
import { createProjectXRoutes } from './projectx/index.js';
import { createRiskFlowRoutes } from './riskflow/index.js';
import { createPsychAssistRoutes } from './psych-assist.js';

export function registerRoutes(app: Hono): void {
  // Public routes (no auth required)
  // Phase 2: Market routes - VIX is public
  app.route('/api/market', createMarketRoutes());

  // Protected routes (auth required)
  app.use('/api/account/*', authMiddleware);
  app.use('/api/notifications/*', authMiddleware);
  app.use('/api/trading/*', authMiddleware);
  app.use('/api/projectx/*', authMiddleware);
  app.use('/api/riskflow/*', authMiddleware);
  app.use('/api/psych/*', authMiddleware);

  // Phase 1: Account routes
  app.route('/api/account', createAccountRoutes());

  // Phase 2: Notification routes
  app.route('/api/notifications', createNotificationRoutes());

  // Phase 2: Trading routes
  app.route('/api/trading', createTradingRoutes());

  // Phase 3: ProjectX routes
  app.route('/api/projectx', createProjectXRoutes());

  // Phase 4: RiskFlow routes
  app.route('/api/riskflow', createRiskFlowRoutes());

  // Psych assist routes (existing)
  app.route('/api/psych', createPsychAssistRoutes());

  // Placeholder routes - return proper 501 Not Implemented
  app.all('/api/ai/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/agents/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
}
