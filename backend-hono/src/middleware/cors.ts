import { cors } from 'hono/cors';
import { env } from '../env.js';

const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return origins[0];
    if (origins.includes(origin)) return origin;
    if (origin.endsWith('.vercel.app')) return origin;
    return origins[0];
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
