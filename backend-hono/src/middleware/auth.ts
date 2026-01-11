import type { Context, Next } from 'hono';
import { ClerkConfigError, verifyClerkToken } from '../services/clerk-auth.js';

const getBearerToken = (c: Context) => {
  const authHeader = c.req.header('authorization') || '';
  const [type, token] = authHeader.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
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
  const token = getBearerToken(c);
  if (!token) {
    return buildUnauthorizedResponse(c, 'Missing Authorization bearer token');
  }

  try {
    const payload = await verifyClerkToken(token);
    c.set('auth', payload);
    return await next();
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);

    console.error('[auth] clerk verification failed', {
      name,
      message,
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
