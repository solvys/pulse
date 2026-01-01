import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { env } from '../env.js';
import { logger } from './logger.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Skip auth for development mode if BYPASS_AUTH is enabled
  if (env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    logger.debug({ method: c.req.method, path: c.req.path }, 'Development auth bypass enabled');
    // Set a mock user ID for development
    c.set('userId', 'dev-user-12345');
    await next();
    return;
  }

  // Skip auth for OPTIONS requests (CORS preflight)
  if (c.req.method === 'OPTIONS') {
    logger.debug({ method: c.req.method, path: c.req.path }, 'OPTIONS request - skipping auth');
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');

  logger.debug({ 
    hasHeader: !!authHeader, 
    startsWithBearer: authHeader ? authHeader.startsWith('Bearer ') : false,
    path: c.req.path 
  }, 'Auth header check');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ 
      method: c.req.method, 
      path: c.req.path,
      hasHeader: !!authHeader,
      headerPreview: authHeader ? authHeader.substring(0, 20) : 'none'
    }, 'Missing or invalid Authorization header');
    return c.json({ 
      error: 'Unauthorized: Missing or invalid token',
      code: 'missing_token',
      message: 'Authorization header must be in format: Bearer <token>'
    }, 401);
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
      logger.error({ path: c.req.path }, 'CLERK_SECRET_KEY is not set in environment variables');
      return c.json({ 
        error: 'Unauthorized: Server configuration error',
        code: 'server_config_error',
        message: 'Authentication service is not properly configured'
      }, 401);
    }

    logger.debug({ 
      path: c.req.path,
      secretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 15),
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20)
    }, 'Verifying token');

    // Validate token format before verification
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logger.error({ 
        partsCount: tokenParts.length,
        tokenLength: token.length,
        path: c.req.path
      }, 'Invalid JWT format - token does not have 3 parts');
      return c.json({ 
        error: 'Unauthorized: Invalid token format',
        code: 'invalid_token_format',
        message: 'JWT token must consist of three parts separated by dots (header.payload.signature)'
      }, 401);
    }

    // Try to decode token header/payload without verification for debugging
    try {
      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      logger.debug({ 
        path: c.req.path,
        header,
        payload: {
          sub: payload.sub,
          exp: payload.exp,
          iat: payload.iat,
          iss: payload.iss,
          aud: payload.aud,
          expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          now: new Date().toISOString(),
          isExpired: payload.exp ? Date.now() > payload.exp * 1000 : null,
        }
      }, 'Token decoded (unverified)');
    } catch (decodeError) {
      logger.warn({ error: decodeError, path: c.req.path }, 'Could not decode token (verification will handle it)');
    }

    // In @clerk/backend v1.x, verifyToken returns the JWT claims directly
    // For template tokens, verifyToken should still work with the same secret key
    // Try to extract issuer from token payload if available
    let issuer: string | undefined;
    try {
      const decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      issuer = decodedPayload.iss;
      logger.debug({ issuer, path: c.req.path }, 'Extracted issuer from token');
    } catch (e) {
      // Ignore - we'll verify without issuer
      logger.debug({ path: c.req.path }, 'Could not extract issuer from token');
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
      
      logger.debug({ 
        hasPayload: !!payload,
        userId: (payload as any)?.sub,
        path: c.req.path
      }, 'Token verified successfully');
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      const errorName = verifyError instanceof Error ? verifyError.name : undefined;
      
      logger.error({ 
        error: errorMessage,
        errorName,
        tokenLength: token.length,
        tokenParts: tokenParts.length,
        secretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 15),
        issuer,
        path: c.req.path
      }, 'Token verification failed');
      
      throw verifyError; // Re-throw to be caught by outer catch block
    }

    if (!payload || !payload.sub) {
      logger.warn({ 
        hasPayload: !!payload,
        method: c.req.method, 
        path: c.req.path 
      }, 'Token verification returned invalid payload');
      return c.json({ 
        error: 'Unauthorized: Invalid token',
        code: 'invalid_token',
        message: 'Token verification failed - token may be expired or invalid'
      }, 401);
    }

    const userId = payload.sub;
    if (!userId) {
      logger.warn({ 
        method: c.req.method, 
        path: c.req.path,
        payloadKeys: payload ? Object.keys(payload as any) : []
      }, 'No userId in token payload');
      return c.json({ 
        error: 'Unauthorized: Invalid token payload',
        code: 'missing_user_id',
        message: 'Token does not contain user identification'
      }, 401);
    }

    logger.debug({ userId, path: c.req.path }, 'Authentication successful');
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
    const isSignatureError = errorMessage.includes('signature') || errorMessage.includes('Signature');
    
    logger.error({ 
      error: errorMessage,
      errorName,
      stack: errorStack,
      path: c.req.path,
      method: c.req.method,
      hasSecretKey: !!env.CLERK_SECRET_KEY,
      secretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 15),
      tokenLength: token?.length || 0,
      tokenParts: token ? token.split('.').length : 0,
      isExpiredError,
      isInvalidError,
      isFormatError,
      isSignatureError,
    }, 'Token verification error');
    
    // Provide more specific error messages
    if (isFormatError) {
      return c.json({ 
        error: 'Unauthorized: Invalid token format',
        code: 'invalid_token_format',
        message: errorMessage
      }, 401);
    }
    if (isExpiredError) {
      return c.json({ 
        error: 'Unauthorized: Token expired',
        code: 'token_expired',
        message: 'Please refresh the page and sign in again'
      }, 401);
    }
    if (isSignatureError) {
      return c.json({ 
        error: 'Unauthorized: Token signature verification failed',
        code: 'invalid_signature',
        message: 'Token may be from a different Clerk instance or secret key mismatch'
      }, 401);
    }
    if (isInvalidError) {
      return c.json({ 
        error: 'Unauthorized: Invalid token',
        code: 'invalid_token',
        message: 'Token format or signature is invalid'
      }, 401);
    }
    
    return c.json({ 
      error: 'Unauthorized: Token verification failed',
      code: 'verification_failed',
      message: errorMessage
    }, 401);
  }
});
