import { createMiddleware } from 'hono/factory';
import { createClerkClient } from '@clerk/backend';
import { env } from '../env.js';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

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
    const { sub: userId } = await clerk.verifyToken(token);

    if (!userId) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    c.set('userId', userId);
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401);
  }
});
