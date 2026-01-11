/**
 * Route Aggregation
 * Central registration of all API routes
 */

import type { Hono } from 'hono';
import { createAccountRoutes } from './account/index.js';
import { createPsychAssistRoutes } from './psych-assist.js';

export function registerRoutes(app: Hono): void {
  // Account routes
  app.route('/api/account', createAccountRoutes());

  // Psych assist routes (existing)
  app.route('/api/psych', createPsychAssistRoutes());

  // Placeholder routes - return proper 501 Not Implemented
  app.all('/api/market/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/notifications/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/projectx/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/trading/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/riskflow/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/ai/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
  app.all('/api/agents/*', (c) => c.json({ error: 'Not implemented yet' }, 501));
}
