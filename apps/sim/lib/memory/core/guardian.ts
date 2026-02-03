import { qdrant } from '../db/qdrant';
import { sql } from '../db/postgres';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireGuardian');

interface TruthVerdict {
    action: 'UPDATE_EXISTING' | 'CREATE_NEW' | 'SCAR_OLD' | 'COEXIST_POLY_TRUTH';
    confidenceDelta: number;
}

interface ContextMetadata {
    timestamp: string;
    channel: string;
    group_id?: string;
}

export class GuardianCore {

    public static async arbitrateReality(
        userUuid: string,
        newVector: number[],
        newContent: string,
        newContext: ContextMetadata
    ): Promise<TruthVerdict> {

        const similarMemories = await qdrant.search(`cheshire_${userUuid}`, {
            vector: newVector,
            limit: 1,
            score_threshold: 0.82,
            with_payload: true
        });

        if (similarMemories.length === 0) {
            return { action: 'CREATE_NEW', confidenceDelta: 0.1 };
        }

        const existingMemory = similarMemories[0];
        const existingPayload = existingMemory.payload || {};

        const semanticSimilarity = existingMemory.score;
        const rawConflict = this.calculateBayesianConflict(semanticSimilarity);

        const contextCoherence = this.calculateContextCoherence(
            newContext,
            existingPayload as any
        );

        const effectiveConflict = rawConflict * contextCoherence;

        logger.info(`🛡️ GUARDIAN :: ARBITRATION`, { sim: semanticSimilarity.toFixed(2), ctx: contextCoherence.toFixed(2), effectiveConflict: effectiveConflict.toFixed(2) });

        if (effectiveConflict > 0.4) {
            await this.scarMemory(userUuid, existingMemory.id as string);
            return { action: 'SCAR_OLD', confidenceDelta: effectiveConflict };
        }
        else if (rawConflict > 0.4 && contextCoherence < 0.5) {
            return { action: 'COEXIST_POLY_TRUTH', confidenceDelta: 0.05 };
        }
        else {
            return { action: 'UPDATE_EXISTING', confidenceDelta: 0 };
        }
    }

    private static calculateContextCoherence(newCtx: ContextMetadata, oldCtx: any): number {
        let score = 0;
        let totalWeight = 0;

        const normalize = (val: any) => (val?.toString() || '').trim().toUpperCase();
        const isPresent = (val: string) => val.length > 0 && val !== 'UNDEFINED' && val !== 'NULL';

        const newG = normalize(newCtx.group_id);
        const oldG = normalize(oldCtx.group_id);

        const resolvedNewG = isPresent(newG) ? newG : 'PRIVATE_DEFAULT';
        const resolvedOldG = isPresent(oldG) ? oldG : 'PRIVATE_DEFAULT';

        const groupMatch = resolvedNewG === resolvedOldG ? 1.0 : 0.0;
        score += groupMatch * 0.5;
        totalWeight += 0.5;

        if (newCtx.timestamp && oldCtx.timestamp) {
            const t1 = new Date(newCtx.timestamp).getTime();
            const t2 = new Date(oldCtx.timestamp).getTime();

            if (!isNaN(t1) && !isNaN(t2)) {
                const d1 = new Date(t1);
                const d2 = new Date(t2);

                const h1 = d1.getHours();
                const h2 = d2.getHours();

                const diff = Math.abs(h1 - h2);
                const cyclicDiff = Math.min(diff, 24 - diff);

                const timeMatch = Math.max(0, 1 - (cyclicDiff / 8));

                score += timeMatch * 0.3;
                totalWeight += 0.3;
            }
        }

        const newC = normalize(newCtx.channel);
        const oldC = normalize(oldCtx.channel);

        if (isPresent(newC) && isPresent(oldC)) {
            const channelMatch = newC === oldC ? 1.0 : 0.0;
            score += channelMatch * 0.2;
            totalWeight += 0.2;
        }

        return totalWeight > 0 ? score / totalWeight : 1.0;
    }

    private static async scarMemory(userUuid: string, memoryId: string) {
        await sql`
      UPDATE memories 
      SET is_scar = TRUE, entropy = 1.0 
      WHERE id = ${memoryId}
    `;

        try {
            await qdrant.setPayload(`cheshire_${userUuid}`, {
                payload: { type: 'SCAR' },
                points: [memoryId]
            });
        } catch (error) {
            logger.warn(`🛡️ GUARDIAN :: QDRANT_SYNC_WARNING [${memoryId}] - Payload update failed, but SQL is consistent.`, { error });
        }

        logger.info(`🛡️ GUARDIAN :: SCAR_CREATED`, { memoryId });
    }

    private static calculateBayesianConflict(similarity: number): number {
        if (similarity > 0.96) return 0.0;
        if (similarity < 0.75) return 0.0;

        return 1.0 - (Math.abs(similarity - 0.88) * 10);
    }
}
