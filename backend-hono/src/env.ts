import { z } from 'zod';

const envSchema = z.object({
  NEON_DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  PROJECTX_USERNAME: z.string().optional(),
  PROJECTX_API_KEY: z.string().optional(),
  // Option 1: Use Vercel AI Gateway (recommended for centralized billing)
  VERCEL_AI_GATEWAY_API_KEY: z.string().default(''),
  
  // Option 2: Use provider API keys directly (if not using gateway)
  ANTHROPIC_API_KEY: z.string().default(''),
  XAI_API_KEY: z.string().default(''),
  
  DEFAULT_AI_MODEL: z.string().default('grok-4'),
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
