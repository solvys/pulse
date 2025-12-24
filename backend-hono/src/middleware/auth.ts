import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { env } from '../env.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const result = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    if (!result || result.errors || !result.payload) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const userId = (result.payload as { sub?: string }).sub;
    if (!userId) {
      return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
    }

    c.set('userId', userId);
    await next();
    return;
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401);
  }
});
