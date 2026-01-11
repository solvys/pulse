/**
 * CORS Configuration
 * Allowed origins for cross-origin requests
 */

export const corsConfig = {
  origin: [
    'https://app.pricedinresearch.io',
    'https://pulse.solvys.io',
    'https://pulse-solvys.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Conversation-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Conversation-Id', 'X-Model', 'X-Provider'],
  credentials: true,
  maxAge: 86400,
};
