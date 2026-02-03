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
     * Creates a user-specific collection for holographic memory storage.
     * 
     * @param userSlug - User identifier for collection naming
     */
    public static async ensureCollections(userSlug: string): Promise<void> {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${userSlug}`;
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
    public static async getCollectionInfo(userSlug: string) {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${userSlug}`;

        try {
            return await client.getCollection(collectionName);
        } catch {
            return null;
        }
    }
}

export const qdrant = VectorMemory.getInstance();
export const VectorOps = VectorMemory;
