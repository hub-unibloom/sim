/**
 * CHESHIRE MEMORY SYSTEM - Embedding Service
 * 
 * Vectorization service using OpenAI embeddings with:
 * - Matryoshka Representation Learning (compact slicing)
 * - Exponential backoff retry logic
 * - Configurable dimensions
 */

import OpenAI from 'openai';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireEmbedding');

export class EmbeddingService {
    private static client: OpenAI | null = null;
    private static readonly COMPACT_DIM = 128; // Matryoshka Slice standard

    private static getClient(): OpenAI {
        if (!EmbeddingService.client) {
            EmbeddingService.client = new OpenAI({
                apiKey: env.OPENAI_API_KEY,
            });
        }
        return EmbeddingService.client;
    }

    public static async vectorize(text: string, retries = 3): Promise<{ dense: number[]; compact: number[] }> {
        const client = this.getClient();
        const model = env.CHESHIRE_EMBEDDING_MODEL || 'text-embedding-3-small';
        const dimensions = env.CHESHIRE_EMBEDDING_DIM || 1536;

        let attempt = 0;
        while (attempt < retries) {
            try {
                const response = await client.embeddings.create({
                    model,
                    input: text,
                    dimensions,
                });

                const dense = response.data[0].embedding;

                // Matryoshka Slicing - Creates compact representation for fast filtering
                const compact = dense.slice(0, this.COMPACT_DIM);

                logger.debug('🔮 EMBEDDING :: Vectorized', {
                    textLength: text.length,
                    denseDim: dense.length,
                    compactDim: compact.length
                });

                return { dense, compact };
            } catch (error) {
                attempt++;
                logger.warn(`⚠️ EMBEDDING :: RETRY ${attempt}/${retries}`, { error });
                if (attempt >= retries) {
                    logger.error('EMBEDDING :: FATAL_API_FAILURE', { error });
                    throw new Error('Failed to vectorize content after multiple attempts');
                }
                await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
            }
        }
        throw new Error('Unreachable');
    }
}
