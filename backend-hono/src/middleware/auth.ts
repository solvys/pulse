import type { Context, Next } from 'hono';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importSPKI,
  jwtVerify,
} from 'jose';
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

type JwksResolution = {
  jwksUrl: string | null;
  source: 'CLERK_JWKS_URL' | 'CLERK_JWT_ISSUER' | 'CLERK_ISSUER' | 'CLERK_DOMAIN' | 'none';
};

const normalizeIssuer = (issuer: string) => issuer.replace(/\/+$/, '');

const buildJwksUrlFromIssuer = (issuer: string) => {
  const normalized = normalizeIssuer(issuer);
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return `${normalized}/.well-known/jwks.json`;
  }
  return `https://${normalized}/.well-known/jwks.json`;
};

/**
 * Derive JWKS URL from explicit config, issuer, or Clerk domain.
 * Format: https://<domain>/.well-known/jwks.json
 */
const deriveJwksUrl = (): JwksResolution => {
  const explicitJwks = process.env.CLERK_JWKS_URL;
  const issuer = process.env.CLERK_JWT_ISSUER || process.env.CLERK_ISSUER;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const clerkDomain = process.env.CLERK_DOMAIN;

  if (explicitJwks) {
    return { jwksUrl: explicitJwks, source: 'CLERK_JWKS_URL' };
  }

  if (issuer) {
    return {
      jwksUrl: buildJwksUrlFromIssuer(issuer),
      source: process.env.CLERK_JWT_ISSUER ? 'CLERK_JWT_ISSUER' : 'CLERK_ISSUER',
    };
  }

  // If domain is explicitly set, use it
  if (clerkDomain) {
    return { jwksUrl: buildJwksUrlFromIssuer(clerkDomain), source: 'CLERK_DOMAIN' };
  }

  // Try to extract domain from publishable key (format: pk_test_... or pk_live_...)
  if (publishableKey) {
    // Publishable keys don't contain domain, but we can try to infer from secret key
    // For now, return null and require explicit CLERK_JWKS_URL or CLERK_DOMAIN
  }

  // Clerk secret keys don't contain domain info directly
  // We need either CLERK_JWKS_URL, CLERK_DOMAIN, or CLERK_PUBLISHABLE_KEY with domain extraction
  return { jwksUrl: null, source: 'none' };
};

const isHmacAlg = (alg: string | null) => !!alg && alg.startsWith('HS');
const isAsymmetricAlg = (alg: string | null) =>
  !!alg && (alg.startsWith('RS') || alg.startsWith('PS') || alg.startsWith('ES'));

const resolveJwtKeyAlg = (tokenAlg: string | null) =>
  tokenAlg && /^(RS|PS|ES)\d{3}$/.test(tokenAlg) ? tokenAlg : 'RS256';

const getVerifier = async (tokenAlg: string | null, jwks: JwksResolution) => {
  const jwksUrl = jwks.jwksUrl;
  const jwtKey = process.env.CLERK_JWT_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const wantsHmac = isHmacAlg(tokenAlg);
  const wantsAsymmetric = isAsymmetricAlg(tokenAlg);

  if (wantsHmac) {
    if (secretKey) {
      warnMissingSecret();
      return new TextEncoder().encode(secretKey);
    }
    throw new AuthConfigError('Missing CLERK_SECRET_KEY for HS256 tokens.');
  }

  if (wantsAsymmetric && !jwksUrl && !jwtKey) {
    if (secretKey) {
      warnMissingSecret();
    }
    throw new AuthConfigError(
      'Missing Clerk JWT verification key. Set CLERK_JWKS_URL (or CLERK_JWT_ISSUER/CLERK_DOMAIN to derive it) or CLERK_JWT_KEY.',
    );
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
      return await importSPKI(jwtKey, resolveJwtKeyAlg(tokenAlg));
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
    'Missing Clerk JWT verification key. Set CLERK_JWKS_URL (or CLERK_JWT_ISSUER/CLERK_DOMAIN to derive it) or CLERK_JWT_KEY. CLERK_SECRET_KEY only works for HS256 tokens.',
  );
};

const getTokenAlgorithm = (token: string) => {
  try {
    const header = decodeProtectedHeader(token);
    return typeof header.alg === 'string' ? header.alg : null;
  } catch (error) {
    console.warn('[auth] Failed to decode token header', error);
    return null;
  }
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
  const jwks = deriveJwksUrl();
  const tokenAlg = getTokenAlgorithm(token);

  try {
    const key = await getVerifier(tokenAlg, jwks);
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
      hasJwksUrl: !!jwks.jwksUrl,
      jwksSource: jwks.source,
      jwksUrl: jwks.jwksUrl ?? 'missing',
      hasJwtKey: !!process.env.CLERK_JWT_KEY,
      hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      tokenAlg: tokenAlg ?? 'unknown',
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
      ? 'Token verification failed. Ensure CLERK_JWKS_URL (or CLERK_JWT_ISSUER/CLERK_DOMAIN) is set for template tokens.'
      : 'Invalid or expired token';

    return c.json({ 
      error: 'Unauthorized: Token verification failed',
      details: errorMessage 
    }, 401);
  }
};
