
import OpenAI from 'openai';
import { env } from '../config/env';

export class EmbeddingService {
    private static client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.AI_BASE_URL
    });

    private static readonly COMPACT_DIM = 128; // Matryoshka Slice standard

    public static async vectorize(text: string, retries = 3): Promise<{ dense: number[], compact: number[] }> {
        let attempt = 0;
        while (attempt < retries) {
            try {
                const response = await this.client.embeddings.create({
                    model: env.EMBEDDING_MODEL,
                    input: text,
                    dimensions: env.EMBEDDING_DIM
                });

                const dense = response.data[0].embedding;

                // Matryoshka Slicing
                const compact = dense.slice(0, this.COMPACT_DIM);

                return { dense, compact };
            } catch (error) {
                attempt++;
                console.warn(`⚠️ EMBEDDING_SERVICE :: RETRY ${attempt}/${retries} failed.`);
                if (attempt >= retries) {
                    console.error("EMBEDDING_SERVICE :: FATAL_API_FAILURE", error);
                    throw new Error("Failed to vectorize content after multiple attempts");
                }
                await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
            }
        }
        throw new Error("Unreachable");
    }
}
