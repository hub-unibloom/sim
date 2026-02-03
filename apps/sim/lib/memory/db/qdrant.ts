
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env';

class VectorMemory {
    private static client: QdrantClient;

    public static getInstance(): QdrantClient {
        if (!VectorMemory.client) {
            VectorMemory.client = new QdrantClient({
                url: env.QDRANT_URL,
                apiKey: env.QDRANT_API_KEY,
            });
            console.log("🧠 QDRANT :: VECTOR_CORTEX_CONNECTED");
        }
        return VectorMemory.client;
    }

    /**
     * Initializes collections if they don't exist (Bootstrapping).
     */
    public static async ensureCollections(userSlug: string) {
        const client = VectorMemory.getInstance();
        const collectionName = `cheshire_${userSlug}`;

        try {
            // @ts-ignore - Qdrant client types might differ slightly, checking for existence safely
            const response = await client.getCollections();
            const exists = response.collections.some((c: any) => c.name === collectionName);

            if (!exists) {
                console.log(`🧠 QDRANT :: INITIALIZING [${collectionName}] with DIM=${env.EMBEDDING_DIM}...`);

                await client.createCollection(collectionName, {
                    vectors: {
                        size: env.EMBEDDING_DIM,
                        distance: 'Cosine',
                    },
                    optimizers_config: {
                        default_segment_number: 2,
                    }
                });
                console.log(`🧠 QDRANT :: COLLECTION_CREATED [${collectionName}]`);
            }
        } catch (error) {
            console.error("🧠 QDRANT :: INIT_ERROR", error);
        }
    }
}

export const qdrant = VectorMemory.getInstance();
export const VectorOps = VectorMemory;
