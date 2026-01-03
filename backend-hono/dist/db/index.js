import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '../env.js';
neonConfig.fetchConnectionCache = true;
// Create SQL client with error handling
let sqlClient = null;
let connectionError = null;
try {
    if (!env.NEON_DATABASE_URL) {
        throw new Error('NEON_DATABASE_URL is not set');
    }
    sqlClient = neon(env.NEON_DATABASE_URL);
}
catch (error) {
    console.error('Failed to create database client:', error);
    connectionError = error;
}
export const sql = sqlClient;
export async function checkDatabase() {
    if (connectionError) {
        console.error('Database client creation failed:', connectionError);
        return false;
    }
    if (!sqlClient) {
        console.error('Database client not initialized');
        return false;
    }
    try {
        await sql `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
}
//# sourceMappingURL=index.js.map