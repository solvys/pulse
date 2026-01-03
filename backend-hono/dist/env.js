import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NEON_DATABASE_URL: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    PROJECTX_USERNAME: z.string().optional(),
    PROJECTX_API_KEY: z.string().optional(),
    // Option 1: Use Vercel AI Gateway (recommended for centralized billing)
    VERCEL_AI_GATEWAY_API_KEY: z.string().default(''),
    // Option 2: Use provider API keys directly (if not using gateway)
    OPENROUTER_API_KEY: z.string().default(''),
    ANTHROPIC_API_KEY: z.string().default(''),
    XAI_API_KEY: z.string().default(''),
    GROQ_API_KEY: z.string().default(''),
    // Twitter/X API credentials
    X_BEARER_TOKEN: z.string().default(''),
    X_API_KEY: z.string().default(''),
    X_API_SECRET: z.string().default(''),
    X_ACCESS_TOKEN: z.string().default(''),
    X_ACCESS_TOKEN_SECRET: z.string().default(''),
    // Additional API keys
    FMP_API_KEY: z.string().default(''),
    REDIS_URL: z.string().default(''),
    CLAUDE_API_KEY: z.string().default(''),
    POLYMARKET_API_KEY: z.string().default(''),
    DEFAULT_AI_MODEL: z.string().default('grok-4'),
    PORT: z.string().default('8080'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    BYPASS_AUTH: z.string().default('false'),
});
function loadEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('Invalid environment variables:');
        console.error(result.error.format());
        process.exit(1);
    }
    const env = result.data;
    // Set default values for development with auth bypass
    const bypassAuth = process.env.BYPASS_AUTH === 'true';
    const isDevelopment = env.NODE_ENV === 'development';
    if (bypassAuth && isDevelopment) {
        return {
            ...env,
            NEON_DATABASE_URL: env.NEON_DATABASE_URL || 'postgres://dev:dev@localhost:5432/dev',
            CLERK_SECRET_KEY: env.CLERK_SECRET_KEY || 'dev-secret-key',
        };
    }
    // Validate required fields when not in bypass mode
    if (!env.NEON_DATABASE_URL) {
        console.error('NEON_DATABASE_URL is required when not in development with auth bypass');
        process.exit(1);
    }
    if (!env.CLERK_SECRET_KEY) {
        console.error('CLERK_SECRET_KEY is required when not in development with auth bypass');
        process.exit(1);
    }
    return env;
}
export const env = loadEnv();
//# sourceMappingURL=env.js.map