import { qdrant, VectorOps } from './db/qdrant';
import { sql } from './db/postgres';
import { EmbeddingService } from './services/embedding';
import { DecayEngine } from './services/decay';
import { AffectiveVector, CheshireProject } from './types';
import { createLogger } from '@sim/logger';
import { hasCheshireDBAdapter, getCheshireDBAdapter } from './db/db-adapter';

const logger = createLogger('CheshireOracle');

export class OracleCore {

    /**
     * Get the current affective state for a user within a project.
     * Uses BaaS adapter if available, calls project config for defaults.
     */
    public static async getUserAffectState(projectId: string, userUuid: string): Promise<AffectiveVector> {
        let defaultAffect: AffectiveVector = {
            joy: 0.5, trust: 0.5, fear: 0, surprise: 0, sadness: 0,
            disgust: 0, anger: 0, anticipation: 0.5, arousal: 0.5
        };

        try {
            // 1. Try to fetch project defaults
            if (hasCheshireDBAdapter()) {
                const adapter = getCheshireDBAdapter();
                const project = await adapter.getProject(projectId);
                if (project?.personality_config?.base_affect) {
                    defaultAffect = project.personality_config.base_affect;
                }

                // 2. Try to fetch active vital state
                const vitalState = await adapter.getVitalState(projectId, userUuid);
                if (vitalState?.emotional_homeostasis) {
                    return vitalState.emotional_homeostasis;
                }
            } else {
                // Direct SQL Fallback (Legacy/Maintenance Mode)
                const result = await sql`
                    SELECT emotional_homeostasis 
                    FROM cheshire_vital_states 
                    WHERE user_uuid = ${userUuid} AND project_id = ${projectId}
                    LIMIT 1
                `;

                if (result.length > 0 && result[0].emotional_homeostasis) {
                    const eh = result[0].emotional_homeostasis;
                    return {
                        joy: eh[0] || 0, trust: eh[1] || 0, fear: eh[2] || 0,
                        surprise: eh[3] || 0, sadness: eh[4] || 0, disgust: eh[5] || 0,
                        anger: eh[6] || 0, anticipation: eh[7] || 0, arousal: eh[8] || 0.5
                    };
                }
            }

        } catch (e) {
            logger.warn('OracleCore :: Failed to fetch affect state, using defaults', { error: e });
        }

        return defaultAffect;
    }

    /**
     * Full Context Retrieval: Memory (Past) + Action (Future) + Persona (Present)
     * Now strictly scoped to Project ID.
     */
    public static async retrieveContext(
        projectId: string,
        userUuid: string,
        queryText: string,
        currentAffect: AffectiveVector
    ): Promise<{ context_fragments: any[], active_triggers: any[], persona_instruction?: string }> {

        // A. MEMORY RETRIEVAL
        const { dense } = await EmbeddingService.vectorize(queryText);

        const vectorResults = await VectorOps.search(projectId, userUuid, {
            vector: dense,
            limit: 20,
            with_payload: true
        });

        const contextPoints: any[] = [];
        const memoryIds = vectorResults.map((v: { id: string | number }) => v.id);

        if (memoryIds.length > 0) {
            // Filter by Project ID to ensure isolation even if vector DB leaks (belt & suspenders)
            const rawMemories: any[] = await sql`
                SELECT id, semantic_text, timestamp, created_at, emotional_homeostasis, is_scar
                FROM memories
                WHERE id IN ${sql(memoryIds)} 
                AND project_id = ${projectId}
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
                    ageMs, memAffect, 1, mem.created_at
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
            // Secure query: using bind params correctly and filtering by project
            // Using STRPOS for standard SQL compatibility instead of 'position in'
            const relatedNodes = await sql`
                SELECT uuid, label, type FROM graph_nodes
                WHERE user_uuid = ${userUuid}
                AND project_id = ${projectId}
                AND STRPOS(${topMemoriesText}, label) > 0
                LIMIT 5
            `;

            if (relatedNodes.length > 0) {
                const nodeIds = relatedNodes.map(n => n.uuid);
                const neighbors = await sql`
                    SELECT gn.label, ge.type, ge.weight
                    FROM graph_edges ge
                    JOIN graph_nodes gn ON ge.target_uuid = gn.uuid
                    WHERE ge.source_uuid IN ${sql(nodeIds)}
                    AND ge.project_id = ${projectId}
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

        // C. PERSONALITY INJECTION (Project-Aware)
        let personaInstruction = undefined;

        try {
            // Fetch Project Personality Config
            let project: CheshireProject | null = null;
            if (hasCheshireDBAdapter()) {
                project = await getCheshireDBAdapter().getProject(projectId);
            } else {
                const pResult = await sql`SELECT id, personality_config FROM workspace WHERE id = ${projectId}`;
                if (pResult.length > 0) {
                    // Manual mapping if adapter missing (fallback)
                    project = { personality_config: pResult[0].personality_config } as CheshireProject;
                }
            }

            const activePersonaConf = project?.personality_config;

            // Check interaction rhythm
            const lastInteractionResult = await sql`
                SELECT last_interaction, username FROM cheshire_users 
                WHERE uuid = ${userUuid}
            `; // Using cheshire_users view/table

            if (lastInteractionResult.length > 0) {
                const lastDate = new Date(lastInteractionResult[0].last_interaction);
                const now = new Date();
                const diffMs = now.getTime() - lastDate.getTime();
                const diffDays = diffMs / (1000 * 3600 * 24);
                const userName = lastInteractionResult[0].username || "usuário";

                if (diffDays > 7) {
                    personaInstruction = `[PERSONALITY_OVERRIDE]: Usuário ausente há ${Math.floor(diffDays)} dias. 
                     TOM: ${activePersonaConf?.tone || 'Sarcasmo dramático'}. 
                     INSTRUÇÃO: Reengajar com urgência.`;
                } else if (activePersonaConf?.custom_instructions) {
                    personaInstruction = `[PERSONALITY_INSTRUCTION]: ${activePersonaConf.custom_instructions}`;
                }
            }
        } catch (e) {
            logger.warn('OracleCore :: Failed to fetch persona instruction', { error: e });
        }

        // D. IDENTITY INJECTION
        try {
            // Identity is now part of the user profile, potentially project-specific?
            // Keeping it user-centric for now
            const userProfile = await sql`SELECT preferences->>'auto_biography' as bio FROM cheshire_users WHERE uuid = ${userUuid}`;
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
                AND project_id = ${projectId}
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
