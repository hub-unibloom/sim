import { sql } from '../db/postgres';
import { qdrant, VectorOps } from '../db/qdrant'; // Use VectorOps
import { createLogger } from '@sim/logger';
import { AffectiveVector, MemoryConfig } from '../types';

const logger = createLogger('CheshireDecay');

export class DecayEngine {

    private static readonly BASE_STRENGTH = 1.0;
    private static readonly NOSTALGIA_COEFFICIENT = 3.5;
    private static readonly SURVIVAL_COEFFICIENT = 2.0;
    private static readonly FRESHNESS_GRACE_PERIOD_MS = 1000 * 60 * 60 * 48; // 48 Hours

    /**
     * Executes the pruning cycle for specific project context.
     * Identifies memories with retention < threshold and archives/deletes them.
     */
    public static async runDecayCycle(projectId: string, userUuid: string, config: MemoryConfig) {
        const threshold = config.retention_threshold || 0.15;

        // 1. Fetch Candidates (older than 24h)
        const candidates = await sql`
            SELECT id, timestamp, emotional_homeostasis, created_at
            FROM memories
            WHERE user_uuid = ${userUuid}
            AND project_id = ${projectId}
            AND is_scar = FALSE
            AND timestamp < NOW() - INTERVAL '24 hours'
            LIMIT 100
        `;

        const toPrune: string[] = [];

        for (const mem of candidates) {
            const ageMs = Date.now() - new Date(mem.timestamp).getTime();

            // Re-calc retention probability dynamically
            const retention = this.calculateRetentionProbability(
                ageMs,
                {
                    // Mapper for raw homeostasis array
                    joy: mem.emotional_homeostasis?.[0] || 0,
                    trust: mem.emotional_homeostasis?.[1] || 0,
                    fear: mem.emotional_homeostasis?.[2] || 0,
                    surprise: mem.emotional_homeostasis?.[3] || 0,
                    sadness: mem.emotional_homeostasis?.[4] || 0,
                    disgust: mem.emotional_homeostasis?.[5] || 0,
                    anger: mem.emotional_homeostasis?.[6] || 0,
                    anticipation: mem.emotional_homeostasis?.[7] || 0,
                    arousal: mem.emotional_homeostasis?.[8] || 0.5
                },
                1, // Access count - could be fetched if tracked
                mem.created_at
            );

            if (retention < threshold) {
                toPrune.push(mem.id);
            }
        }

        if (toPrune.length > 0) {
            await this.pruneMemories(projectId, userUuid, toPrune);
            logger.info(`🍂 DECAY :: Pruned ${toPrune.length} memories`, { projectId, userUuid });
        }
    }

    private static async pruneMemories(projectId: string, userUuid: string, memoryIds: string[]) {
        if (memoryIds.length === 0) return;

        // A. Hard Delete from Search Index (Vector Store) via VectorOps
        try {
            await VectorOps.delete(projectId, userUuid, memoryIds);
        } catch (e) {
            logger.warn('DECAY :: Failed to delete from Vector Store', { error: e });
        }

        // B. Soft Delete / Archive in SQL (Optional: Move to 'forgotten_memories' table?)
        // For now, strict delete to save space, assuming they are truly irrelevant.
        await sql`
            DELETE FROM memories 
            WHERE id IN ${sql(memoryIds)} 
            AND project_id = ${projectId}
        `;
    }

    /**
     * Calculates Retention Probability (R) at time t.
     */
    public static calculateRetentionProbability(
        timeDeltaMs: number,
        emotion: AffectiveVector,
        accessCount: number,
        createdAt?: Date
    ): number {

        // 1. Freshness Check (Import Amnesia Fix)
        if (createdAt) {
            const ingestionAge = Date.now() - createdAt.getTime();
            if (ingestionAge < this.FRESHNESS_GRACE_PERIOD_MS) {
                return 1.0;
            }
        }

        // 2. Time Normalization (t in Days)
        const t = timeDeltaMs / (1000 * 60 * 60 * 24);

        // 3. Memory Strength (S)
        const S = this.calculateMemoryStrength(emotion, accessCount);

        // 4. Ebbinghaus Equation: R = e^(-t/S)
        return Math.exp(-t / S);
    }

    private static calculateMemoryStrength(emotion: AffectiveVector, accessCount: number): number {
        let strength = this.BASE_STRENGTH;

        const positiveValence = (emotion.joy * this.NOSTALGIA_COEFFICIENT) + (emotion.trust * 1.5);
        const survivalValence = (emotion.fear * this.SURVIVAL_COEFFICIENT) + (emotion.anger * 1.2);

        strength += positiveValence + survivalValence;
        strength *= (1 + emotion.arousal);
        strength *= Math.log(Math.E + accessCount);

        return strength;
    }

    public static isCoreMemory(emotion: AffectiveVector, accessCount: number): boolean {
        if (emotion.joy > 0.9 && emotion.trust > 0.6) return true;
        if (emotion.arousal > 0.95) return true;
        if (accessCount > 50 && emotion.joy > 0.5) return true;
        return false;
    }
}
