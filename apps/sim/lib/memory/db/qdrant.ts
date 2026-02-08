/**
 * CHESHIRE MEMORY SYSTEM - Vector Database Facade
 * 
 * Originally connected to Qdrant.
 * NOW REDIRECTS to Postgres (pgvector) for "trimmed" deployment.
 * Maintains the same API surface (mostly) to avoid breaking Guardian/Limbic.
 */

import { createLogger } from '@sim/logger';
import { getCheshireDBAdapter } from './db-adapter';
// import { qdrant, VectorOps } from './db/qdrant'; // Self-reference removed

const logger = createLogger('CheshireVector');

export class VectorOps {

    /**
     * Initializes collections - No-op for Postgres (handled by migrations)
     */
    public static async ensureProjectCollection(projectId: string, userUuid: string): Promise<void> {
        // No-op: Postgres table 'memories' is shared and indexed
        logger.debug('🧠 CHESHIRE :: Vector collection check skipped (using Postgres)');
    }

    /**
     * Get collection info - Mock response
     */
    public static async getCollectionInfo(projectId: string, userUuid: string) {
        return { status: 'ok', vectors_count: 0 };
    }

    /**
     * Search for similar vectors in a project context
     * Redirects to PostgresCheshireAdapter.searchMemories
     */
    public static async search(
        projectId: string,
        userUuid: string,
        params: { vector: number[], limit: number, with_payload?: boolean, score_threshold?: number }
    ) {
        const db = getCheshireDBAdapter();

        // We need to cast the adapter to access the specific pgvector method
        // In a strictly typed system, we should add this to the interface, 
        // but for this refactor we assume the active adapter is PostgresCheshireAdapter
        // or supports compatible method.

        // @ts-ignore - searchMemories added in PostgresCheshireAdapter
        if (typeof db.searchMemories !== 'function') {
            logger.warn('🧠 CHESHIRE :: DB Adapter does not support vector search!');
            return [];
        }

        // @ts-ignore
        const results = await db.searchMemories(
            projectId,
            userUuid,
            params.vector,
            params.limit,
            params.score_threshold
        );

        // Map Postgres result to Qdrant-like structure for compatibility
        return results.map((r: any) => ({
            id: r.id,
            score: r.score,
            payload: r.raw_content || {}, // raw_content maps to payload
            version: 0
        }));
    }

    /**
     * Upsert points
     * In Cheshire, memories are created via insertMemory. 
     * If this is called directly, it's likely for updating embeddings or external sync.
     * We map this to updating the 'embedding' column of existing memories.
     */
    public static async upsert(projectId: string, userUuid: string, points: { id: string | number, vector: number[], payload?: any }[]) {
        const db = getCheshireDBAdapter();

        // @ts-ignore
        if (typeof db.upsertMemoryEmbedding !== 'function') return;

        for (const p of points) {
            // Ideally we'd use a batch update, but for now loop is safer for migration
            if (p.vector) {
                // @ts-ignore
                await db.upsertMemoryEmbedding(p.id.toString(), p.vector);
            }
        }
    }

    /**
     * Update payload
     * Maps to updateMemory in adapter
     */
    public static async updatePayload(projectId: string, userUuid: string, points: { id: string | number, payload: any }[]) {
        const db = getCheshireDBAdapter();

        for (const p of points) {
            await db.updateMemory(p.id.toString(), {
                raw_content: p.payload // Map payload back to raw_content
            });
        }
    }

    public static async delete(projectId: string, userUuid: string, ids: (string | number)[]) {
        // Not implemented in postgres adapter yet, usually memories are soft deleted or retained
        logger.warn('🧠 CHESHIRE :: Vector delete not fully implemented for Postgres adapter');
    }
}

// Export singleton-like (though purely static now)
export const qdrant = {
    getCollections: async () => ({ collections: [] }),
    createCollection: async () => { },
    search: async () => [],
    upsert: async () => { },
    setPayload: async () => { },
    delete: async () => { }
}; 
