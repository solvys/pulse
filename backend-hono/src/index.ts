import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { serve } from '@hono/node-server';
import { createAiChatRoutes } from './routes/ai-chat.js';
import { createPsychAssistRoutes } from './routes/psych-assist.js';
import { createAnalystRoutes } from './routes/analysts.js';
import { createHealthService } from './services/health-service.js';

const app = new Hono();
const isDev = process.env.NODE_ENV !== 'production';
const healthService = createHealthService();

// CORS configuration - allow requests from frontend domains
app.use('*', cors({
  origin: [
    'https://app.pricedinresearch.io',
    'https://pulse.solvys.io',
    'https://pulse-solvys.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Conversation-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Conversation-Id', 'X-Model', 'X-Provider'],
  credentials: true,
  maxAge: 86400,
}));

const buildRequestId = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

app.get('/health', async (c) => {
  const health = await healthService.checkAll();
  const statusCode: ContentfulStatusCode =
    health.status === 'ok' ? 200 : health.status === 'degraded' ? 207 : 503;
  return c.json(health, statusCode);
});

app.route('/api/ai', createAiChatRoutes());
app.route('/api/psych', createPsychAssistRoutes());
app.route('/api/agents', createAnalystRoutes());

app.onError((err, c) => {
  const requestId = c.req.header('x-request-id') ?? buildRequestId();
  const status =
    ((err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500) as ContentfulStatusCode;

  console.error('[api] unhandled error', {
    requestId,
    status,
    method: c.req.method,
    path: c.req.path,
    message: err instanceof Error ? err.message : String(err),
    name: err instanceof Error ? err.name : 'UnknownError',
    stack: isDev && err instanceof Error ? err.stack : undefined,
  });

  return c.json(
    {
      error: status >= 500 ? 'Internal server error' : err instanceof Error ? err.message : String(err),
      requestId,
      ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
    },
    status,
    { 'X-Request-Id': requestId },
  );
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = Number(process.env.PORT || 8080);

serve({
  fetch: app.fetch,
  port,
});

export default app;
