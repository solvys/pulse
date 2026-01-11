import type { Context, Next } from 'hono';
import { ClerkConfigError, verifyClerkToken } from '../services/clerk-auth.js';

const getBearerToken = (c: Context) => {
  // First try Authorization header (standard)
  const authHeader = c.req.header('authorization') || '';
  const [type, token] = authHeader.split(' ');
  if (type?.toLowerCase() === 'bearer' && token) {
    return token.trim();
  }
  
  // For SSE endpoints, EventSource can't send headers, so check query param
  // This is less secure but necessary for EventSource compatibility
  if (c.req.path.includes('/stream')) {
    const queryToken = c.req.query('token');
    if (queryToken) {
      return queryToken.trim();
    }
  }
  
  return null;
};

const buildUnauthorizedResponse = (c: Context, details?: string) =>
  c.json(
    {
      error: 'Unauthorized',
      ...(details ? { details } : {}),
    },
    401,
  );

export const authMiddleware = async (c: Context, next: Next) => {
  const isSSE = c.req.path.includes('/stream');
  const token = getBearerToken(c);
  
  if (!token) {
    if (isSSE) {
      console.warn('[auth] SSE endpoint missing token, path:', c.req.path);
    }
    return buildUnauthorizedResponse(c, 'Missing Authorization bearer token');
  }

  try {
    const payload = await verifyClerkToken(token);
    c.set('auth', payload);
    // Extract userId for convenience (Clerk uses 'sub' or 'userId')
    const userId = (payload as { userId?: string; sub?: string }).userId ||
                   (payload as { sub?: string }).sub;
    if (userId) {
      c.set('userId', userId);
      if (isSSE) {
        console.log(`[auth] SSE auth successful for user: ${userId}`);
      }
    }
    // Extract email if available
    const email = (payload as { email?: string }).email;
    if (email) {
      c.set('email', email);
    }
    return await next();
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);

    console.error('[auth] clerk verification failed', {
      name,
      message,
      path: c.req.path,
      isSSE,
    });

    if (error instanceof ClerkConfigError) {
      return c.json(
        {
          error: 'Auth configuration error',
          details: message,
        },
        500,
      );
    }

    if (name === 'TokenExpiredError') {
      return buildUnauthorizedResponse(c, 'Token expired');
    }

    return buildUnauthorizedResponse(
      c,
      name === 'TokenVerificationError' ? 'Token verification failed' : undefined,
    );
  }
};
