import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createAiChatRoutes } from './routes/ai-chat.js';

const app = new Hono();
const isDev = process.env.NODE_ENV !== 'production';

const buildRequestId = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }),
);

app.route('/api/ai', createAiChatRoutes());

app.onError((err, c) => {
  const requestId = c.req.header('x-request-id') ?? buildRequestId();
  const status =
    (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode ?? 500;

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
