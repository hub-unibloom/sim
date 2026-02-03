/**
 * CHESHIRE MEMORY SYSTEM - Redis Cache Client
 * 
 * Connects to external Cascata Redis for:
 * - Thalamus consciousness caching
 * - Session state management
 * - Rate limiting for memory operations
 * 
 * Uses lazy initialization to avoid blocking module loading.
 */

import { createClient, type RedisClientType } from 'redis';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireCache');

class CascataRedis {
    private static client: RedisClientType | null = null;
    private static connecting = false;
    private static connectionPromise: Promise<RedisClientType> | null = null;

    /**
     * Get the Redis client instance (lazy initialization).
     * Multiple calls while connecting will await the same promise.
     */
    public static async getInstance(): Promise<RedisClientType> {
        // Return existing connected client
        if (CascataRedis.client?.isOpen) {
            return CascataRedis.client;
        }

        // If already connecting, wait for the existing connection
        if (CascataRedis.connecting && CascataRedis.connectionPromise) {
            return CascataRedis.connectionPromise;
        }

        // Start new connection
        CascataRedis.connecting = true;
        CascataRedis.connectionPromise = CascataRedis.connect();

        try {
            const client = await CascataRedis.connectionPromise;
            return client;
        } finally {
            CascataRedis.connecting = false;
        }
    }

    private static async connect(): Promise<RedisClientType> {
        const url = env.CASCATA_REDIS_URL || env.REDIS_URL || 'redis://localhost:6379';

        const client = createClient({
            url,
            socket: {
                reconnectStrategy: (retries: number) => {
                    if (retries > 10) {
                        logger.error('⚡ CHESHIRE :: Redis max retries exceeded');
                        return new Error('Max retries exceeded');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        client.on('error', (err: Error) => {
            logger.error('⚡ CHESHIRE :: Redis connection error', { error: err.message });
        });

        client.on('reconnecting', () => {
            logger.warn('⚡ CHESHIRE :: Redis reconnecting...');
        });

        await client.connect();

        logger.info('⚡ CHESHIRE :: Connected to Cascata Redis', {
            host: url.includes('@') ? url.split('@')[1]?.split(':')[0] : 'localhost'
        });

        CascataRedis.client = client as RedisClientType;
        return CascataRedis.client;
    }

    /**
     * Gracefully close the Redis connection
     */
    public static async close(): Promise<void> {
        if (CascataRedis.client?.isOpen) {
            await CascataRedis.client.quit();
            CascataRedis.client = null;
            logger.info('⚡ CHESHIRE :: Redis connection closed');
        }
    }

    /**
     * Check if Redis is currently connected
     */
    public static isConnected(): boolean {
        return CascataRedis.client?.isOpen ?? false;
    }
}

export const getRedis = CascataRedis.getInstance;
export const CascataCache = CascataRedis;
