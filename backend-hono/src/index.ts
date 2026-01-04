import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createAiChatRoutes } from './routes/ai-chat.js';

const app = new Hono();

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }),
);

app.route('/api/ai', createAiChatRoutes());

app.onError((err, c) => {
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = Number(process.env.PORT || 8080);

serve({
  fetch: app.fetch,
  port,
});

export default app;
