/**
 * Database Configuration
 * Neon PostgreSQL connection
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('[DB] DATABASE_URL not set - database features will be unavailable');
}

export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

export function isDatabaseAvailable(): boolean {
  return sql !== null;
}
