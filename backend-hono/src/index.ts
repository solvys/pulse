import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { env } from './env.js';
import { checkDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { loggerMiddleware, logger } from './middleware/logger.js';
import { registerRoutes } from './routes/index.js';

const app = new Hono();

app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);

app.get('/health', async (c) => {
  const dbHealthy = await checkDatabase();
  return c.json(
    {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    dbHealthy ? 200 : 503
  );
});

app.get('/', (c) => {
  return c.json({
    name: 'Pulse API',
    version: '1.0.0',
    status: 'running',
  });
});

const protectedApp = new Hono();
protectedApp.use('*', authMiddleware);
registerRoutes(protectedApp);

app.route('/', protectedApp);

app.onError((err, c) => {
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

export default app;
