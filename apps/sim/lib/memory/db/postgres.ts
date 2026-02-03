/**
 * CHESHIRE MEMORY SYSTEM - PostgreSQL Client
 * 
 * Connects to external Cascata PostgreSQL database orchestrator.
 * Uses PgBouncer for connection pooling in production.
 */

import postgres from 'postgres';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireDB');

class CascataDB {
    private static instance: postgres.Sql | null = null;

    public static getInstance(): postgres.Sql {
        if (!CascataDB.instance) {
            // Prefer Cascata dedicated URL, fallback to main DATABASE_URL
            const url = env.CASCATA_POSTGRES_URL || env.DATABASE_URL;

            if (!url) {
                throw new Error('CHESHIRE :: No database URL configured. Set CASCATA_POSTGRES_URL or DATABASE_URL.');
            }

            CascataDB.instance = postgres(url, {
                max: 20,
                idle_timeout: 30,
                connect_timeout: 10,
                // Enable SSL if URL contains sslmode=require
                ssl: url.includes('sslmode=require') ? 'require' : false,
            });

            logger.info('🔌 CHESHIRE :: Connected to Cascata PostgreSQL', {
                host: url.includes('@') ? url.split('@')[1]?.split('/')[0] : 'localhost'
            });
        }
        return CascataDB.instance;
    }

    /**
     * Gracefully close the connection pool
     */
    public static async close(): Promise<void> {
        if (CascataDB.instance) {
            await CascataDB.instance.end();
            CascataDB.instance = null;
            logger.info('🔌 CHESHIRE :: PostgreSQL connection closed');
        }
    }
}

export const sql = CascataDB.getInstance();
export const CascataDatabase = CascataDB;
