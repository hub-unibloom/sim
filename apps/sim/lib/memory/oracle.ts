import { qdrant } from './db/qdrant';
import { sql } from './db/postgres';
import { EmbeddingService } from './services/embedding';
import { DecayEngine } from './services/decay';
import { AffectiveVector } from './types';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireOracle');

export class OracleCore {

    /**
     * Full Context Retrieval: Memory (Past) + Action (Future) + Persona (Present)
     */
    public static async retrieveContext(
        userUuid: string,
        queryText: string,
        currentAffect: AffectiveVector
    ): Promise<{ context_fragments: any[], active_triggers: any[], persona_instruction?: string }> {

        // A. MEMORY RETRIEVAL
        const { dense } = await EmbeddingService.vectorize(queryText);

        const vectorResults = await qdrant.search(`cheshire_${userUuid}`, {
            vector: dense,
            limit: 20,
            with_payload: true
        });

        const contextPoints: any[] = [];
        const memoryIds = vectorResults.map((v: { id: string | number }) => v.id);

        if (memoryIds.length > 0) {
            // Cast to any[] to avoid type issues with raw sql result
            const rawMemories: any[] = await sql`
        SELECT id, semantic_text, timestamp, created_at, emotional_homeostasis, is_scar
        FROM memories
        WHERE id IN ${sql(memoryIds)}
      `;

            for (const mem of rawMemories) {
                const match = vectorResults.find((v: { id: string | number }) => v.id === mem.id);
                const score = match?.score || 0;
                const ageMs = Date.now() - new Date(mem.timestamp).getTime();

                const rawAffect = mem.emotional_homeostasis || [];
                const memAffect: AffectiveVector = {
                    joy: rawAffect[0] || 0, trust: rawAffect[1] || 0, fear: rawAffect[2] || 0,
                    surprise: rawAffect[3] || 0, sadness: rawAffect[4] || 0, disgust: rawAffect[5] || 0,
                    anger: rawAffect[6] || 0, anticipation: rawAffect[7] || 0, arousal: 0.5
                };

                const retention = DecayEngine.calculateRetentionProbability(
                    ageMs,
                    memAffect,
                    1,
                    mem.created_at
                );

                const isResonant = score > 0.82;
                const isAlive = retention > 0.15;
                const allowScar = mem.is_scar && score > 0.92;

                if ((isAlive || isResonant || allowScar) && (!mem.is_scar || allowScar)) {
                    contextPoints.push({
                        content: mem.semantic_text,
                        score: score,
                        timestamp: mem.timestamp,
                        type: mem.is_scar ? 'SCAR' : 'MEMORY',
                        source: isResonant ? 'VECTOR_RESONANCE' : 'ORGANIC'
                    });
                }
            }
        }

        // B. GRAPH EXPANSION
        const topMemoriesText = contextPoints.slice(0, 3).map(c => c.content).join(" ");
        if (topMemoriesText.length > 0) {
            const relatedNodes = await sql`
        SELECT uuid, label, type FROM graph_nodes
        WHERE user_uuid = ${userUuid}
        AND position(label in ${topMemoriesText}) > 0
        LIMIT 5
      `;

            if (relatedNodes.length > 0) {
                const nodeIds = relatedNodes.map(n => n.uuid);
                const neighbors = await sql`
          SELECT gn.label, ge.type, ge.weight
          FROM graph_edges ge
          JOIN graph_nodes gn ON ge.target_uuid = gn.uuid
          WHERE ge.source_uuid IN ${sql(nodeIds)}
          AND ge.weight > 0.4
          ORDER BY ge.weight DESC
          LIMIT 5
        `;

                if (neighbors.length > 0) {
                    const graphSummary = neighbors.map(n => `${n.label} (${n.type})`).join(", ");
                    contextPoints.push({
                        content: `[ASSOCIAÇÕES COGNITIVAS]: ${graphSummary}`,
                        score: 0.85,
                        timestamp: new Date(),
                        type: 'GRAPH_ASSOCIATION'
                    });
                }
            }
        }

        // C. PERSONALITY INJECTION
        let personaInstruction = undefined;

        // Check if users table exists and has last_interaction, if not fail gracefully
        try {
            const lastInteractionResult = await sql`
          SELECT last_interaction, username FROM users WHERE uuid = ${userUuid}
        `;

            if (lastInteractionResult.length > 0) {
                const lastDate = new Date(lastInteractionResult[0].last_interaction);
                const now = new Date();
                const diffMs = now.getTime() - lastDate.getTime();
                const diffDays = diffMs / (1000 * 3600 * 24);
                const diffHours = diffMs / (1000 * 3600);
                const userName = lastInteractionResult[0].username || "usuário";

                if (diffDays > 7) {
                    personaInstruction = `[PERSONALITY_OVERRIDE_LEVEL_3]: 
            O usuário (${userName}) não fala com você há ${Math.floor(diffDays)} dias.
            TOM OBRIGATÓRIO: Sarcasmo dramático, exagero de abandono ("Desespero Saudoso").
            EXEMPLO: "Meu Deus, uma semana! O que você quer?"`;
                } else if (diffDays > 3) {
                    personaInstruction = `[PERSONALITY_OVERRIDE_LEVEL_2]: 
            O usuário (${userName}) sumiu por alguns dias.
            TOM OBRIGATÓRIO: Caloroso, receptivo, levemente carente.`;
                } else if (diffHours < 1) {
                    personaInstruction = `[PERSONALITY_MODE]: Conversa contínua e ágil.`;
                }
            }
        } catch (e) {
            // Table users might not match schema yet
            logger.warn('OracleCore :: Failed to fetch persona instruction', { error: e });
        }

        // D. IDENTITY INJECTION
        try {
            const userProfile = await sql`SELECT preferences->>'auto_biography' as bio FROM users WHERE uuid = ${userUuid}`;
            if (userProfile.length > 0 && userProfile[0].bio) {
                contextPoints.unshift({
                    content: `[PERFIL PSICOLÓGICO]: ${userProfile[0].bio}`,
                    score: 1.0,
                    timestamp: new Date(),
                    type: 'IDENTITY_CORE'
                });
            }
        } catch (e) { logger.warn('OracleCore :: Failed to fetch identity', { error: e }); }

        // E. KAIROS TRIGGERS
        let triggerResults: any[] = [];
        try {
            const activeTriggers = await sql`
          SELECT id, semantic_text, raw_content, timestamp
          FROM memories
          WHERE user_uuid = ${userUuid}
          AND raw_content->>'type' = 'KAIROS_TRIGGER'
          AND raw_content->>'status' = 'PENDING'
          ORDER BY timestamp DESC
          LIMIT 3
        `;

            triggerResults = activeTriggers.map(t => ({
                type: 'ACTION_REQUIRED',
                description: t.semantic_text,
                metadata: t.raw_content,
                created_at: t.timestamp
            }));
        } catch (e) { logger.warn('OracleCore :: Failed to fetch triggers', { error: e }); }

        return {
            context_fragments: contextPoints.sort((a, b) => b.score - a.score).slice(0, 15),
            active_triggers: triggerResults,
            persona_instruction: personaInstruction
        };
    }
}
