import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '../env.js';

neonConfig.fetchConnectionCache = true;

export const sql = neon(env.NEON_DATABASE_URL);

export async function checkDatabase(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
