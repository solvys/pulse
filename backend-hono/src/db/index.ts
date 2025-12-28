import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '../env.js';

neonConfig.fetchConnectionCache = true;

// Create SQL client with error handling
let sqlClient: any = null;
let connectionError: Error | null = null;

try {
  sqlClient = neon(env.NEON_DATABASE_URL);
} catch (error) {
  console.error('Failed to create database client:', error);
  connectionError = error as Error;
}

export const sql = sqlClient;

export async function checkDatabase(): Promise<boolean> {
  if (connectionError) {
    console.error('Database client creation failed:', connectionError);
    return false;
  }

  if (!sqlClient) {
    console.error('Database client not initialized');
    return false;
  }

  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
