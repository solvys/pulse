import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { env } from '../env.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Skip auth for OPTIONS requests (CORS preflight)
  if (c.req.method === 'OPTIONS') {
    // #region agent log - hypothesis A
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:options',
        message: 'OPTIONS request - skipping auth',
        data: { method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'A'
      })
    }).catch(() => { });
    // #endregion
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');

  // #region agent log - hypothesis C
  fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'auth.ts:header',
      message: 'Auth header check',
      data: { hasHeader: !!authHeader, startsWithBearer: authHeader ? authHeader.startsWith('Bearer ') : false },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'initial',
      hypothesisId: 'C'
    })
  }).catch(() => { });
  // #endregion

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // #region agent log - hypothesis C
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:no-auth',
        message: 'No auth header - returning 401',
        data: { method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'C'
      })
    }).catch(() => { });
    // #endregion
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // #region agent log - hypothesis C
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:verify',
        message: 'Verifying token with Clerk',
        data: { tokenLength: token.length, method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'C'
      })
    }).catch(() => { });
    // #endregion

    console.log(`[AUTH] Verifying token for ${c.req.path}, CLERK_SECRET_KEY prefix: ${env.CLERK_SECRET_KEY?.substring(0, 15)}...`);

    // In @clerk/backend v1.x, verifyToken returns the JWT claims directly
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    console.log(`[AUTH] verifyToken result:`, {
      hasPayload: !!payload,
      sub: (payload as any)?.sub,
    });

    if (!payload || !payload.sub) {
      // #region agent log - hypothesis C
      fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'auth.ts:invalid-token',
          message: 'Token verification failed',
          data: { hasPayload: !!payload, method: c.req.method, path: c.req.path },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'initial',
          hypothesisId: 'C'
        })
      }).catch(() => { });
      // #endregion
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const userId = payload.sub;
    if (!userId) {
      // #region agent log - hypothesis C
      fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'auth.ts:no-userid',
          message: 'No userId in token payload',
          data: { method: c.req.method, path: c.req.path },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'initial',
          hypothesisId: 'C'
        })
      }).catch(() => { });
      // #endregion
      return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
    }

    // #region agent log - hypothesis C
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:success',
        message: 'Auth successful',
        data: { userId, method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'C'
      })
    }).catch(() => { });
    // #endregion

    c.set('userId', userId);
    await next();
    return;
  } catch (error) {
    console.error('Auth error:', error);
    // #region agent log - hypothesis C
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:error',
        message: 'Token verification exception',
        data: { error: error instanceof Error ? error.message : 'Unknown error', method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'C'
      })
    }).catch(() => { });
    // #endregion
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401);
  }
});
