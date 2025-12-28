import { createMiddleware } from 'hono/factory';
import pino from 'pino';
import { env } from '../env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const origin = c.req.header('Origin');
  const authorization = c.req.header('Authorization');
  const userAgent = c.req.header('User-Agent');

  // #region agent log - hypothesis A, B, C
  fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'logger.ts:request',
      message: 'Incoming request',
      data: {
        method,
        path,
        origin: origin || 'none',
        hasAuth: !!authorization,
        authLength: authorization ? authorization.length : 0,
        userAgent: userAgent ? userAgent.substring(0, 50) : 'none'
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'initial',
      hypothesisId: 'A,B,C'
    })
  }).catch(() => {});
  // #endregion

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // #region agent log - hypothesis A, B
  fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'logger.ts:response',
      message: 'Request completed',
      data: { method, path, status, duration, origin: origin || 'none' },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'initial',
      hypothesisId: 'A,B'
    })
  }).catch(() => {});
  // #endregion

  logger.info({ method, path, status, duration }, 'Request completed');
});
