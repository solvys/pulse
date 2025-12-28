import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from './env.js';
import { checkDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { loggerMiddleware, logger } from './middleware/logger.js';
import { registerRoutes } from './routes/index.js';
import { marketRoutes } from './routes/market.js';
import { fetchAndStoreNews } from './services/news-service.js';

const app = new Hono();

// CORS must be first to handle preflight requests
// Apply CORS to all routes including protected ones
app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);

app.get('/health', async (c) => {
  // Health check should always return 200 for Fly.io routing
  // Database connectivity is checked but doesn't fail the health check
  const dbHealthy = await checkDatabase();
  return c.json(
    {
      status: 'healthy',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    200 // Always return 200 so proxy can route traffic
  );
});

app.get('/', (c) => {
  return c.json({
    name: 'Pulse API',
    version: '1.0.0',
    status: 'running',
  });
});

// Apply auth middleware only to protected routes
const protectedRoutes = [
  '/api/account',
  '/api/projectx',
  '/api/trading',
  '/api/riskflow',
  '/api/journal',
  '/api/er',
  '/api/econ',
  '/api/notifications',
  '/api/events',
  '/api/ai'
];

protectedRoutes.forEach(route => {
  app.use(`${route}/*`, authMiddleware);
});

// Register all routes (this will include both protected and public routes)
registerRoutes(app, true);

// Re-register market routes to ensure they're public (no auth)
app.route('/api/market', marketRoutes);

app.onError((err, c) => {
  // Add CORS headers even on errors (safety net)
  const origin = c.req.header('Origin');
  if (origin && (origin.endsWith('.solvys.io') || origin.endsWith('.vercel.app'))) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  logger.error({ err }, 'Unhandled error');
  return c.json(
    {
      error: 'Internal server error',
      message: env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

app.notFound((c) => {
  // Add CORS headers to 404 responses
  const origin = c.req.header('Origin');
  if (origin && (origin.endsWith('.solvys.io') || origin.endsWith('.vercel.app'))) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  return c.json({ error: 'Not found' }, 404);
});

const port = parseInt(env.PORT, 10);
const host = '0.0.0.0'; // Bind to all interfaces for Fly.io

logger.info({ port, host, env: env.NODE_ENV }, 'Starting Pulse API server');

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

logger.info({ port, host }, `Server running at http://${host}:${port}`);

// Initialize news feed on startup
fetchAndStoreNews(15)
  .then(({ fetched, stored }) => {
    logger.info({ fetched, stored }, 'News feed initialized on startup');
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to initialize news feed on startup');
  });

export default app;
