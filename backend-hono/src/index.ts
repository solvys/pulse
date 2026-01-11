/**
 * Pulse API - Main Entry Point
 * Hono backend on Fly.io
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { corsConfig } from './config/cors.js';
import { getEnvConfig, isDev } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { createHealthService } from './services/health-service.js';

const app = new Hono();
const healthService = createHealthService();
const config = getEnvConfig();

// CORS middleware
app.use('*', cors(corsConfig));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.header('X-Request-Id', requestId);
  await next();
});

// Health check endpoint
app.get('/health', async (c) => {
  const health = await healthService.checkAll();
  const statusCode: ContentfulStatusCode =
    health.status === 'ok' ? 200 : health.status === 'degraded' ? 207 : 503;
  return c.json(health, statusCode);
});

// Register all API routes
registerRoutes(app);

// Global error handler
app.onError((err, c) => {
  const requestId = c.req.header('x-request-id') || 'unknown';
  const status = ((err as { status?: number }).status ?? 500) as ContentfulStatusCode;

  console.error('[API] Error:', {
    requestId,
    status,
    method: c.req.method,
    path: c.req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: isDev && err instanceof Error ? err.stack : undefined,
  });

  return c.json(
    {
      error: status >= 500 ? 'Internal server error' : err.message,
      requestId,
    },
    status
  );
});

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Start server
serve({ fetch: app.fetch, port: config.PORT });

console.log(`[API] Server started on port ${config.PORT}`);
console.log(`[API] Environment: ${config.NODE_ENV}`);

export default app;
