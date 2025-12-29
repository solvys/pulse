import { createClient } from 'redis';
import { env } from '../env.js';

// Connection pool configuration for serverless
let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: env.REDIS_URL,
            socket: {
                connectTimeout: 5000,
                keepAlive: true,
            },
        });

        redisClient.on('error', (err) => console.log('Redis Client Error', err));

        await redisClient.connect();
    }
    return redisClient;
}
