import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { env } from '../env.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Skip auth for development mode if BYPASS_AUTH is enabled
  if (env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    // #region agent log - hypothesis A
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:bypass-dev',
        message: 'Development auth bypass enabled',
        data: { method: c.req.method, path: c.req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'A'
      })
    }).catch(() => {});
    // #endregion

    // Set a mock user ID for development
    c.set('userId', 'dev-user-12345');
    await next();
    return;
  }

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

  let token = authHeader.replace('Bearer ', '').trim();
  
  // Sanitize token - remove any whitespace, newlines, or extra characters
  token = token.replace(/\s+/g, '');

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

    if (!env.CLERK_SECRET_KEY) {
      console.error('[AUTH] CLERK_SECRET_KEY is not set in environment variables');
      return c.json({ error: 'Unauthorized: Server configuration error' }, 401);
    }

    console.log(`[AUTH] Verifying token for ${c.req.path}, CLERK_SECRET_KEY prefix: ${env.CLERK_SECRET_KEY?.substring(0, 15)}...`);
    console.log(`[AUTH] Token preview (first 50 chars): ${token.substring(0, 50)}...`);

    // Validate token format before verification
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('[AUTH] Invalid JWT format - token does not have 3 parts:', {
        partsCount: tokenParts.length,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 100),
      });
      return c.json({ error: 'Unauthorized: Invalid token format. JWT consists of three parts separated by dots.' }, 401);
    }

    // Try to decode token header/payload without verification to see what's in it
    try {
      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      console.log(`[AUTH] Token header:`, header);
      console.log(`[AUTH] Token payload (unverified):`, {
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        aud: payload.aud,
        expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
        now: new Date().toISOString(),
        isExpired: payload.exp ? Date.now() > payload.exp * 1000 : null,
        template: payload.template || 'none', // Check if template is in payload
      });
    } catch (decodeError) {
      console.warn('[AUTH] Could not decode token (this is okay, verification will handle it):', decodeError);
    }

    // In @clerk/backend v1.x, verifyToken returns the JWT claims directly
    // For template tokens, verifyToken should still work with the same secret key
    // Try to extract issuer from token payload if available
    let issuer: string | undefined;
    try {
      const decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      issuer = decodedPayload.iss;
      console.log(`[AUTH] Extracted issuer from token: ${issuer}`);
    } catch (e) {
      // Ignore - we'll verify without issuer
    }

    let payload;
    try {
      // Build verify options
      const verifyOptions: any = {
        secretKey: env.CLERK_SECRET_KEY,
      };
      
      // Add issuer if we extracted it (helps with template tokens)
      if (issuer) {
        verifyOptions.issuer = issuer;
      }

      payload = await verifyToken(token, verifyOptions);
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      console.error('[AUTH] verifyToken threw an error:', {
        error: errorMessage,
        errorName: verifyError instanceof Error ? verifyError.name : undefined,
        tokenLength: token.length,
        tokenParts: tokenParts.length,
        secretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 15),
        issuer,
        tokenHeader: tokenParts[0],
        tokenPayloadPreview: tokenParts[1]?.substring(0, 100),
      });
      throw verifyError; // Re-throw to be caught by outer catch block
    }

    console.log(`[AUTH] verifyToken result:`, {
      hasPayload: !!payload,
      sub: (payload as any)?.sub,
      payloadKeys: payload ? Object.keys(payload as any) : [],
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : undefined;
    
    // Check for specific Clerk error types
    const isExpiredError = errorMessage.includes('expired') || errorMessage.includes('ExpiredToken') || errorMessage.includes('jwt expired');
    const isInvalidError = errorMessage.includes('invalid') || errorMessage.includes('InvalidToken') || errorMessage.includes('jwt malformed');
    const isFormatError = errorMessage.includes('three parts') || errorMessage.includes('JWT format');
    
    console.error('[AUTH] Token verification error:', {
      message: errorMessage,
      name: errorName,
      stack: errorStack,
      path: c.req.path,
      method: c.req.method,
      hasSecretKey: !!env.CLERK_SECRET_KEY,
      secretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 15),
      tokenLength: token.length,
      tokenParts: token.split('.').length,
      tokenPreview: token.substring(0, 50) + '...',
      isExpiredError,
      isInvalidError,
      isFormatError,
    });
    
    // #region agent log - hypothesis C
    fetch('http://127.0.0.1:7244/ingest/fbebf980-5e49-4327-9406-872372234680', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'auth.ts:error',
        message: 'Token verification exception',
        data: { 
          error: errorMessage,
          errorName,
          isExpiredError,
          isInvalidError,
          isFormatError,
          method: c.req.method, 
          path: c.req.path 
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'C'
      })
    }).catch(() => { });
    // #endregion
    
    // Provide more specific error messages
    if (isFormatError) {
      return c.json({ error: `Unauthorized: Invalid token format. ${errorMessage}` }, 401);
    }
    if (isExpiredError) {
      return c.json({ error: 'Unauthorized: Token expired. Please refresh the page and sign in again.' }, 401);
    }
    if (isInvalidError) {
      return c.json({ error: 'Unauthorized: Invalid token format or signature.' }, 401);
    }
    
    return c.json({ error: `Unauthorized: Token verification failed - ${errorMessage}` }, 401);
  }
});
