/**
 * Environment Configuration
 * Validates required environment variables
 */

export interface EnvConfig {
  NODE_ENV: 'development' | 'production';
  PORT: number;
  DATABASE_URL: string | undefined;
  CLERK_SECRET_KEY: string | undefined;
  VERCEL_AI_GATEWAY_API_KEY: string | undefined;
}

export function getEnvConfig(): EnvConfig {
  return {
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    PORT: Number(process.env.PORT || 8080),
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    VERCEL_AI_GATEWAY_API_KEY: process.env.VERCEL_AI_GATEWAY_API_KEY,
  };
}

export function validateEnv(): string[] {
  const missing: string[] = [];
  const config = getEnvConfig();

  if (!config.DATABASE_URL) missing.push('DATABASE_URL');
  if (!config.CLERK_SECRET_KEY) missing.push('CLERK_SECRET_KEY');

  return missing;
}

export const isDev = process.env.NODE_ENV !== 'production';
