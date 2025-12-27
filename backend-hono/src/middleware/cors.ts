import { cors } from 'hono/cors';
import { env } from '../env.js';

const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return origins[0];
    // Check explicit allowlist
    if (origins.includes(origin)) return origin;
    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) return origin;
    // Allow production and staging Solvys domains
    if (origin.endsWith('.solvys.io')) return origin;
    // Default to first allowed origin
    return origins[0];
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Session-ID'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  exposeHeaders: ['Content-Length', 'Content-Type', 'X-Request-Id', 'X-Conversation-Id'],
  maxAge: 86400, // Cache preflight requests for 24 hours
});
