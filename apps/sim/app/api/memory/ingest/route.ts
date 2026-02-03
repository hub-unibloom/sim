
import { NextRequest, NextResponse } from 'next/server';
import {
    ThalamusCore,
    LimbicCore,
    GuardianCore,
    OntologyService,
    EmbeddingService,
    BioSynthesisService,
    sql,
    qdrant,
    getRedis,
    AffectiveVector
} from '../../../../lib/memory';

interface IngestionBody {
    semantic_text: string;
    metadata: {
        timestamp: string;
        channel: string;
        user: {
            uuid: string;
            plano?: string;
            last_interation?: string;
        };
        group?: {
            name: string;
            id_group: string;
        };
    };
    sentiment_analysis?: {
        primary_emotion?: string;
        secondary_emotion?: string;
        magnitude?: number;
        overall_score?: number;
    };
    content_extraction?: {
        entities?: {
            contacts?: any[];
            urls?: string[];
            files?: string[];
        };
    };
    contextual_history?: {
        reply_chain?: any[];
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const packet = body as IngestionBody;

        // 1. THALAMUS: Idempotency Check
        const check = await ThalamusCore.processIngestion(packet);
        if (!check.accepted) {
            return NextResponse.json({ status: 'IGNORED', reason: check.reason, hash: check.hash }, { status: 200 });
        }
        const originPacketId = check.packetId ?? crypto.randomUUID();

        try {
            // 2. EMBEDDING: Generate Vectors
            const { dense, compact } = await EmbeddingService.vectorize(packet.semantic_text);

            // 3. LIMBIC: Emotional Analysis
            const affectiveState: AffectiveVector = LimbicCore.synthesizeEmotionFromPacket(packet.sentiment_analysis);

            // 4. GUARDIAN: Truth Arbitration
            const verdict = await GuardianCore.arbitrateReality(
                packet.metadata.user.uuid,
                dense,
                packet.semantic_text,
                {
                    timestamp: packet.metadata.timestamp,
                    channel: packet.metadata.channel,
                    group_id: packet.metadata.group?.id_group
                }
            );

            // 5. TRANSACTIONAL CORE
            let memoryId: string = '';

            // Note: postgres.js TransactionSql is callable (supports template literals)
            // but TypeScript types may not recognize this, so we use type assertion
            await sql.begin(async (tx: ReturnType<typeof sql.begin> extends Promise<infer R> ? R : typeof sql) => {
                // Cast tx to sql-compatible callable type  
                const txSql = tx as unknown as typeof sql;

                // 4.5 UPSERT USER IDENTITY
                const explicitLastInteraction = packet.metadata.user.last_interation
                    ? new Date(packet.metadata.user.last_interation)
                    : new Date();
                const validLastInteraction = isNaN(explicitLastInteraction.getTime()) ? new Date() : explicitLastInteraction;

                const newHomeostasis = JSON.stringify([
                    affectiveState.joy, affectiveState.trust, affectiveState.fear, affectiveState.surprise,
                    affectiveState.sadness, affectiveState.disgust, affectiveState.anger, affectiveState.anticipation,
                    affectiveState.arousal
                ]);

                // Ensure user exists or update. 
                // Note: Sim schema might have different fields. We align with schema.ts we saw earlier.
                // Schema has: uuid, username, interaction_rhythm_ms, last_interaction, emotional_homeostasis, preferences.
                // Assuming 'plano' is in schema too (added in step 103 check).

                await txSql`
          INSERT INTO users (uuid, username, last_interaction, emotional_homeostasis)
          VALUES (
            ${packet.metadata.user.uuid}, 
            'User ' || ${packet.metadata.user.uuid},
            ${validLastInteraction},
            ${newHomeostasis}::vector
          )
          ON CONFLICT (uuid) DO UPDATE SET
            last_interaction = EXCLUDED.last_interaction,
            emotional_homeostasis = CASE 
                WHEN users.emotional_homeostasis IS NULL THEN EXCLUDED.emotional_homeostasis
                ELSE (users.emotional_homeostasis * 0.95) + (EXCLUDED.emotional_homeostasis * 0.05)
            END,
            preferences = jsonb_set(
              COALESCE(users.preferences, '{}'::jsonb), 
              '{accumulated_entropy}', 
              (COALESCE((users.preferences->>'accumulated_entropy')::float, 0) + ${verdict.confidenceDelta})::text::jsonb
            )
        `;

                // 5. CASCATA: Persist Memory
                const memoryResult = await txSql`
          INSERT INTO memories (
            user_uuid, semantic_text, raw_content, 
            embedding_dense, embedding_compact, 
            timestamp, entropy, origin_packet_id
          ) VALUES (
            ${packet.metadata.user.uuid}, ${packet.semantic_text}, ${JSON.stringify(packet)},
            ${JSON.stringify(dense)}, ${JSON.stringify(compact)},
            ${packet.metadata.timestamp}, ${verdict.confidenceDelta}, ${originPacketId}
          )
          RETURNING id
        `;
                memoryId = memoryResult[0].id;

                // 6. QDRANT: Persist Vector
                await qdrant.upsert(`cheshire_${packet.metadata.user.uuid}`, {
                    points: [{
                        id: memoryId,
                        vector: dense,
                        payload: {
                            timestamp: packet.metadata.timestamp,
                            type: 'EPISODIC',
                            group_id: packet.metadata.group?.id_group || null
                        }
                    }]
                });

                // 7. CORTEX: Ontology Mapping
                if (packet.content_extraction?.entities) {
                    const identityNodeId = await OntologyService.ensureIdentityNode(packet.metadata.user.uuid);

                    const pEntities = packet.content_extraction.entities;
                    const entities = [
                        ...(pEntities.contacts || []),
                        ...(pEntities.urls || []).map((u: string) => ({ value: u, name: u })),
                        ...(pEntities.files || []).map((f: string) => ({ value: f, name: f }))
                    ];

                    const nodeIds = await OntologyService.resolveEntities(packet.metadata.user.uuid, entities);
                    await OntologyService.linkNodes(nodeIds);
                    await OntologyService.linkToIdentity(identityNodeId, nodeIds, affectiveState);

                    if (nodeIds.length > 0) {
                        // Creating memory-node associations relies on memories_nodes table.
                        // We need to ensure that table exists in schema (it was added in step 107).
                        // Since logic is dynamic, we do a loop or batch insert logic.
                        // Note: `sql` helper for batch insert might work if properly typed, otherwise loop.
                        for (const nid of nodeIds) {
                            await txSql`
                    INSERT INTO memories_nodes (memory_id, node_id) VALUES (${memoryId}, ${nid})
                    ON CONFLICT DO NOTHING
                 `;
                        }
                    }

                    if (packet.metadata.group) {
                        const groupNodeId = await OntologyService.processGroupContext(
                            packet.metadata.user.uuid,
                            packet.metadata.group
                        );
                        if (groupNodeId) {
                            await OntologyService.linkEntitiesToGroup(nodeIds, groupNodeId);
                            await OntologyService.linkIdentityToGroup(identityNodeId, groupNodeId);
                        }
                    }

                    if (packet.contextual_history?.reply_chain) {
                        await OntologyService.processThreadContext(
                            packet.metadata.user.uuid,
                            nodeIds,
                            packet.contextual_history.reply_chain
                        );
                    }
                }
            });

            // 8. REDIS INVALIDATION
            // Only if we use redis cache keys, which Thalamus does.

            // 9. THALAMUS: Close Loop
            await ThalamusCore.completeProcessing(check.hash, 'PROCESSED');

            // 10. BACKGROUND JOBS
            BioSynthesisService.synthesizePersona(packet.metadata.user.uuid)
                .catch(err => console.error(`🧬 BIOSYNTHESIS_ERROR`, err));

            return NextResponse.json({ status: 'PROCESSED', memory_id: memoryId, verdict: verdict.action });

        } catch (metricError) {
            console.error("INGESTION_CRITICAL_FAILURE", metricError);
            await ThalamusCore.completeProcessing(check.hash, 'FAILED');
            return NextResponse.json({ status: 'FAILED', error: String(metricError) }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
