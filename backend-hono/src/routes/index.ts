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
import { createAiRoutes } from './ai/index.js';
import { createAgentRoutes } from './agents/index.js';

export function registerRoutes(app: Hono): void {
  // Public routes (no auth required)
  // Phase 2: Market routes - VIX is public
  app.route('/api/market', createMarketRoutes());

  // Protected routes (auth required)
  app.use('/api/account/*', authMiddleware);
  app.use('/api/notifications/*', authMiddleware);
  app.use('/api/trading/*', authMiddleware);
  app.use('/api/projectx/*', authMiddleware);
  // RiskFlow routes - exclude cron endpoint from auth
  app.use('/api/riskflow/*', async (c, next) => {
    // Skip auth for cron endpoints (they use secret token)
    if (c.req.path.includes('/cron/')) {
      return next();
    }
    return authMiddleware(c, next);
  });
  app.use('/api/psych/*', authMiddleware);
  app.use('/api/ai/*', authMiddleware);
  app.use('/api/agents/*', authMiddleware);

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

  // Phase 5: AI routes
  app.route('/api/ai', createAiRoutes());

  // Phase 6: Agent routes
  app.route('/api/agents', createAgentRoutes());
}
