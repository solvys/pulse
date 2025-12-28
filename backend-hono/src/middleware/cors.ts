import { cors } from 'hono/cors';
import { env } from '../env.js';

const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin: (origin) => {
    // Always allow requests with no origin (e.g., Postman, curl)
    if (!origin) return origins[0] || '*';
    
    // Check explicit allowlist
    if (origins.includes(origin)) return origin;
    
    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) return origin;
    
    // Allow production and staging Solvys domains
    if (origin.endsWith('.solvys.io')) return origin;
    
    // Default to first allowed origin (or allow all in development)
    return env.NODE_ENV === 'development' ? origin : origins[0] || origin;
  },
  credentials: true,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Session-ID',
    'X-Conversation-Id',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  exposeHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Request-Id',
    'X-Conversation-Id',
    'X-References',
  ],
  maxAge: 86400, // Cache preflight requests for 24 hours
});
