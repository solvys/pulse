import type { Context, Next } from 'hono';
import { createRemoteJWKSet, importSPKI, jwtVerify } from 'jose';
import { retryWithBackoff } from './auth-retry';

class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}

let secretChecked = false;

const warnMissingSecret = () => {
  if (secretChecked) {
    return;
  }
  secretChecked = true;
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('[auth] CLERK_SECRET_KEY is missing');
  } else if (!process.env.CLERK_SECRET_KEY.startsWith('sk_')) {
    console.warn('[auth] CLERK_SECRET_KEY does not look like a Clerk secret key');
  }
};

const getBearerToken = (c: Context) => {
  const authHeader = c.req.header('authorization') || '';
  const [type, token] = authHeader.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
};

/**
 * Derive JWKS URL from Clerk secret key if not explicitly set
 * Format: https://<domain>/.well-known/jwks.json
 * Domain can be extracted from secret key or publishable key
 */
const deriveJwksUrl = (): string | null => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const clerkDomain = process.env.CLERK_DOMAIN;

  // If domain is explicitly set, use it
  if (clerkDomain) {
    return `https://${clerkDomain}/.well-known/jwks.json`;
  }

  // Try to extract domain from publishable key (format: pk_test_... or pk_live_...)
  if (publishableKey) {
    // Publishable keys don't contain domain, but we can try to infer from secret key
    // For now, return null and require explicit CLERK_JWKS_URL or CLERK_DOMAIN
  }

  // Clerk secret keys don't contain domain info directly
  // We need either CLERK_JWKS_URL, CLERK_DOMAIN, or CLERK_PUBLISHABLE_KEY with domain extraction
  return null;
};

const getVerifier = async () => {
  let jwksUrl = process.env.CLERK_JWKS_URL;
  const jwtKey = process.env.CLERK_JWT_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  // Try to derive JWKS URL if not explicitly set
  if (!jwksUrl) {
    jwksUrl = deriveJwksUrl();
  }

  // Prefer JWKS URL for template tokens (RS256)
  if (jwksUrl) {
    try {
      return createRemoteJWKSet(new URL(jwksUrl));
    } catch (error) {
      console.error('[auth] Invalid CLERK_JWKS_URL:', jwksUrl, error);
      throw new AuthConfigError(`Invalid CLERK_JWKS_URL: ${jwksUrl}`);
    }
  }

  // Fallback to JWT public key
  if (jwtKey) {
    try {
      return await importSPKI(jwtKey, 'RS256');
    } catch (error) {
      console.error('[auth] Failed to import JWT key:', error);
      throw new AuthConfigError('Failed to import CLERK_JWT_KEY');
    }
  }

  // Secret key only works for HS256 tokens, not template tokens
  // This is a fallback for backward compatibility
  if (secretKey) {
    warnMissingSecret();
    console.warn('[auth] Using CLERK_SECRET_KEY for verification. Template tokens require JWKS URL or JWT key.');
    return new TextEncoder().encode(secretKey);
  }

  throw new AuthConfigError(
    'Missing Clerk JWT verification key. Template tokens require CLERK_JWKS_URL or CLERK_JWT_KEY. CLERK_SECRET_KEY only works for HS256 tokens.',
  );
};

const shouldRetryAuthError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  const message = 'message' in error ? String(error.message) : '';
  const combined = `${name} ${message}`.toLowerCase();
  return (
    combined.includes('jwks') ||
    combined.includes('fetch') ||
    combined.includes('network') ||
    combined.includes('timeout')
  );
};

export const authMiddleware = async (c: Context, next: Next) => {
  warnMissingSecret();
  const token = getBearerToken(c);
  if (!token) {
    return c.json({ error: 'Missing Authorization bearer token' }, 401);
  }

  const issuer = process.env.CLERK_JWT_ISSUER;
  const audience = process.env.CLERK_JWT_AUDIENCE;

  try {
    const key = await getVerifier();
    const { payload } = await retryWithBackoff(
      async () =>
        jwtVerify(token, key, {
          issuer: issuer || undefined,
          audience: audience || undefined,
          clockTolerance: 5,
        }),
      { label: 'clerk-jwt', shouldRetry: shouldRetryAuthError },
    );

    c.set('auth', payload);
    return await next();
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);
    
    // Enhanced error logging for debugging
    console.error(`[auth] JWT verification failed: ${name}: ${message}`, {
      hasIssuer: !!issuer,
      hasAudience: !!audience,
      hasJwksUrl: !!process.env.CLERK_JWKS_URL,
      hasJwtKey: !!process.env.CLERK_JWT_KEY,
      hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'missing',
    });

    if (error instanceof AuthConfigError) {
      return c.json({ 
        error: 'Auth configuration error',
        details: message 
      }, 500);
    }

    if (shouldRetryAuthError(error)) {
      return c.json({ error: 'Auth verification temporarily unavailable' }, 503);
    }

    // Provide more specific error message
    const errorMessage = name === 'JWTExpired' 
      ? 'Token expired'
      : name === 'JWTInvalid' || name === 'JWSSignatureVerificationFailed'
      ? 'Token verification failed. Ensure CLERK_JWKS_URL is set for template tokens.'
      : 'Invalid or expired token';

    return c.json({ 
      error: 'Unauthorized: Token verification failed',
      details: errorMessage 
    }, 401);
  }
};
