/**
 * CHESHIRE MEMORY SYSTEM
 * 
 * Central export for all Cheshire memory components.
 * Provides unified access to core systems, services, and DB clients.
 */

// Core Systems
export * from './core/ontology';
export * from './core/guardian';
export * from './core/limbic';
export * from './core/thalamus';
export * from './core/silence';

// Services
export * from './services/biosynthesis';
export * from './services/decay';
export * from './services/embedding';
export * from './services/affective-engine';

// DB Clients
export { qdrant, VectorOps } from './db/qdrant';
export { sql, CascataDatabase } from './db/postgres';
export { getRedis, CascataCache } from './db/redis';

// Oracles
export * from './oracle';

// Types
export * from './types';

// ============================================================================
// INITIALIZATION
// ============================================================================
import { setCheshireDBAdapter } from './db/db-adapter';
import { PostgresCheshireAdapter } from './db/postgres-adapter';

// Auto-initialize adapter on module load (Singleton pattern)
try {
    const { env } = require('@/lib/core/config/env');
    if (!env.CASCATA_POSTGRES_URL && !env.DATABASE_URL) {
        console.warn('⚠️ CHESHIRE :: Missing CASCATA_POSTGRES_URL or DATABASE_URL. Memory system might fail.');
    }
    if (!env.CASCATA_QDRANT_URL) {
        console.warn('⚠️ CHESHIRE :: Missing CASCATA_QDRANT_URL. Vector operations will fail.');
    }

    const adapter = new PostgresCheshireAdapter();
    setCheshireDBAdapter(adapter);
    // console.log('✅ CHESHIRE :: Postgres Adapter Initialized');
} catch (e) {
    console.warn('⚠️ CHESHIRE :: Failed to auto-initialize adapter:', e);
}

