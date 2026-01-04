import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from './env.js';
import { checkDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { loggerMiddleware, logger } from './middleware/logger.js';
import { registerRoutes } from './routes/index.js';
import { marketRoutes } from './routes/market.js';
import { fetchAndStoreNews, initializePolymarketFeed } from './services/news-service.js';
const sentryEnabled = Boolean(process.env.SENTRY_DSN);
if (sentryEnabled) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: env.NODE_ENV,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
        profilesSampleRate: Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.1')
    });
}
const app = new Hono();
if (sentryEnabled) {
    app.use('*', async (c, next) => Sentry.runWithAsyncContext(async () => {
        Sentry.setContext('request', {
            method: c.req.method,
            path: c.req.path
        });
        try {
            await next();
        }
        catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }));
}
// CORS must be first to handle preflight requests
// Apply CORS to all routes including protected ones
app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);
app.get('/health', async (c) => {
    // Health check should always return 200 for Fly.io routing
    // Database connectivity is checked but doesn't fail the health check
    const dbHealthy = await checkDatabase();
    return c.json({
        status: 'healthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    }, 200 // Always return 200 so proxy can route traffic
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
    '/api/ai',
    '/api/chat'
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
    if (sentryEnabled) {
        Sentry.captureException(err, {
            tags: { path: c.req.path }
        });
    }
    logger.error({ err }, 'Unhandled error');
    return c.json({
        error: 'Internal server error',
        message: env.NODE_ENV === 'development' ? err.message : undefined,
    }, 500);
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
Promise.all([
    initializePolymarketFeed(),
    fetchAndStoreNews(15)
])
    .then(([_, { fetched, stored }]) => {
    logger.info({ fetched, stored }, 'News feed initialized on startup');
    // Schedule background refresh every 5 minutes
    setInterval(async () => {
        try {
            logger.info('Starting background news refresh...');
            // Refresh 15 items to keep feed fresh
            const result = await fetchAndStoreNews(15);
            logger.info({ fetched: result.fetched, stored: result.stored }, 'Background news refresh complete');
        }
        catch (err) {
            logger.error({ err }, 'Background news refresh failed');
            if (sentryEnabled) {
                Sentry.captureException(err, { tags: { task: 'background-news-refresh' } });
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
})
    .catch((err) => {
    logger.error({ err }, 'Failed to initialize news feed on startup');
    if (sentryEnabled) {
        Sentry.captureException(err, { tags: { task: 'startup-news-init' } });
    }
});
export default app;
//# sourceMappingURL=index.js.map