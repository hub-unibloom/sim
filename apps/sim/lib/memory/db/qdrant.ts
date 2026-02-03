/**
 * CHESHIRE MEMORY SYSTEM - Qdrant Vector Database Client
 * 
 * Connects to external Cascata Qdrant for vector similarity search.
 * Implements holographic memory storage with semantic embeddings.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireVector');

class VectorMemory {
    private static client: QdrantClient | null = null;

    public static getInstance(): QdrantClient {
        if (!VectorMemory.client) {
            const url = env.CASCATA_QDRANT_URL || 'http://localhost:6333';

            VectorMemory.client = new QdrantClient({
                url,
                apiKey: env.CASCATA_QDRANT_API_KEY,
            });

            logger.info('🧠 CHESHIRE :: Connected to Cascata Qdrant', { url });
        }
        return VectorMemory.client;
    }

    /**
     * Initializes collections if they don't exist (Bootstrapping).
     * Creates a project-specific collection for holographic memory storage.
     * 
     * @param projectId - Project identifier
     * @param userUuid - User identifier
     */
    public static async ensureProjectCollection(projectId: string, userUuid: string): Promise<void> {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${projectId}_${userUuid}`;
        const embeddingDim = env.CHESHIRE_EMBEDDING_DIM || 1536;

        try {
            const response = await client.getCollections();
            const exists = response.collections.some((c: { name: string }) => c.name === collectionName);

            if (!exists) {
                logger.info(`🧠 CHESHIRE :: Creating collection [${collectionName}] with DIM=${embeddingDim}`);

                await client.createCollection(collectionName, {
                    vectors: {
                        size: embeddingDim,
                        distance: 'Cosine',
                    },
                    optimizers_config: {
                        default_segment_number: 2,
                    },
                    // Enable payload indexing for efficient filtering
                    on_disk_payload: true,
                });

                logger.info(`🧠 CHESHIRE :: Collection created [${collectionName}]`);
            }
        } catch (error) {
            logger.error('🧠 CHESHIRE :: Collection initialization error', { error, collectionName });
            throw error;
        }
    }

    /**
     * Get collection info for health checks
     */
    public static async getCollectionInfo(projectId: string, userUuid: string) {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${projectId}_${userUuid}`;

        try {
            return await client.getCollection(collectionName);
        } catch {
            return null;
        }
    }

    /**
     * Search for similar vectors in a project context
     */
    public static async search(
        projectId: string,
        userUuid: string,
        params: { vector: number[], limit: number, with_payload?: boolean, score_threshold?: number }
    ) {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${projectId}_${userUuid}`;

        try {
            return await client.search(collectionName, params);
        } catch (error) {
            // If collection doesn't exist, try to create it and retry search
            // This is a self-healing mechanism
            logger.warn(`🧠 CHESHIRE :: Collection [${collectionName}] not found during search, attempting to create...`);
            await this.ensureProjectCollection(projectId, userUuid);
            return await client.search(collectionName, params);
        }
    }

    /**
     * Upsert points into a project collection
     */
    public static async upsert(projectId: string, userUuid: string, points: { id: string | number, vector: number[], payload?: any }[]) {
        const collectionName = `cheshire_${projectId}_${userUuid}`;
        await VectorOps.ensureProjectCollection(projectId, userUuid);

        await qdrant.upsert(collectionName, {
            wait: true,
            points: points.map(p => ({
                id: p.id,
                vector: p.vector,
                payload: p.payload
            }))
        });
    }

    /**
     * Dedicated method for updating ONLY payload without re-sending vector.
     * Use this for 'scarring' or metadata updates.
     */
    public static async updatePayload(projectId: string, userUuid: string, points: { id: string | number, payload: any }[]) {
        const collectionName = `cheshire_${projectId}_${userUuid}`;
        // Set payload for multiple points
        for (const p of points) {
            await qdrant.setPayload(collectionName, {
                wait: true,
                payload: p.payload,
                points: [p.id],
            });
        }
    }

    public static async delete(projectId: string, userUuid: string, ids: (string | number)[]) {
        const collectionName = `cheshire_${projectId}_${userUuid}`;
        try {
            await qdrant.delete(collectionName, {
                wait: true,
                points: ids
            });
        } catch (error) {
            // Ignore if collection doesn't exist
        }
    }
}

export const qdrant = VectorMemory.getInstance();
export const VectorOps = VectorMemory;
