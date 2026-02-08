/**
 * CHESHIRE MEMORY SYSTEM - In-Memory Cache Client (Mocking Redis)
 * 
 * Replaces external Redis dependency with local Map for "trimmed" Sim deployment.
 * Note: Data will not persist across restarts and won't scale horizontally.
 */

import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireCache');

// Mock Redis client interface
export interface MockRedisClient {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: any) => Promise<string | null>;
    del: (key: string) => Promise<number>;
    quit: () => Promise<void>;
    isOpen: boolean;
    connect: () => Promise<void>;
    on: (event: string, callback: any) => void;
}

class InMemoryCache {
    private static store = new Map<string, { value: string, expiry?: number }>();
    private static isOpen = false;

    public static async getInstance(): Promise<MockRedisClient> {
        if (!InMemoryCache.isOpen) {
            await InMemoryCache.connect();
        }
        return InMemoryCache.client;
    }

    private static client: MockRedisClient = {
        isOpen: true,
        connect: async () => { InMemoryCache.isOpen = true; },
        on: () => { }, // No-op for event listeners
        quit: async () => {
            InMemoryCache.isOpen = false;
            logger.info('⚡ CHESHIRE :: In-Memory Cache closed');
        },
        get: async (key: string) => {
            const item = InMemoryCache.store.get(key);
            if (!item) return null;
            if (item.expiry && Date.now() > item.expiry) {
                InMemoryCache.store.delete(key);
                return null;
            }
            return item.value;
        },
        set: async (key: string, value: string, options?: { EX?: number }) => {
            const expiry = options?.EX ? Date.now() + (options.EX * 1000) : undefined;
            InMemoryCache.store.set(key, { value, expiry });
            return 'OK';
        },
        del: async (key: string) => {
            return InMemoryCache.store.delete(key) ? 1 : 0;
        }
    };

    private static async connect(): Promise<void> {
        InMemoryCache.isOpen = true;
        logger.info('⚡ CHESHIRE :: Using In-Memory Cache (Redis Removed)');
    }
}

export const getRedis = InMemoryCache.getInstance;
export const CascataCache = InMemoryCache;
