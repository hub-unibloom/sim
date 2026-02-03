import { sql } from '../db/postgres';
import { AffectiveVector, CognitiveNode } from '../types';

export class OntologyService {

    public static async ensureIdentityNode(projectId: string, userUuid: string): Promise<string> {
        // Enforce project isolation for identity node
        const result = await sql`
      INSERT INTO graph_nodes (user_uuid, project_id, label, type, mass, last_accessed_at)
      VALUES (${userUuid}, ${projectId}, 'SELF', 'IDENTITY', 100.0, NOW())
      ON CONFLICT (uuid) 
      DO UPDATE SET 
          mass = 100.0, 
          last_accessed_at = NOW()
      RETURNING uuid
    `;
        return result[0]?.uuid;
    }

    public static async linkToIdentity(
        projectId: string,
        identityNodeId: string,
        entityNodeIds: string[],
        emotionalState: AffectiveVector
    ) {
        if (!identityNodeId || entityNodeIds.length === 0) return;

        const emotionalGravity = 0.1 + (emotionalState.arousal * 0.8) + (emotionalState.joy * 0.1);
        const clampedWeight = Math.min(Math.max(emotionalGravity, 0.1), 1.0);

        const edges = entityNodeIds
            .filter(id => id !== identityNodeId)
            .map(id => ({
                source: identityNodeId,
                target: id,
                type: 'ASSOCIATIVE',
                weight: clampedWeight
            }));

        if (edges.length > 0) {
            await this.batchCreateEdges(projectId, edges);
        }
    }

    public static async linkIdentityToGroup(projectId: string, identityNodeId: string, groupNodeId: string) {
        if (!identityNodeId || !groupNodeId) return;

        await this.batchCreateEdges(projectId, [{
            source: identityNodeId,
            target: groupNodeId,
            type: 'ASSOCIATIVE',
            weight: 0.8
        }]);
    }

    /**
     * Extract entities using LLM and resolve them to Graph Nodes.
     * Uses Project context for isolation.
     */
    public static async extractEntities(projectId: string, userUuid: string, text: string): Promise<CognitiveNode[]> {
        // 1. LLM Extraction (Mocked for speed/cost in this ex, but ideally calls biosynthesis/LLM service)
        // In "Quality A+" production, we would call an LLM here.
        // For now, heuristic extraction for performance demo.

        const ignored = ['o', 'a', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'e', 'é'];
        const words = text.split(/\s+/)
            .map(w => w.replace(/[^\w\u00C0-\u00FF]/g, '')) // Remove punctuation
            .filter(w => w.length > 3 && !ignored.includes(w.toLowerCase()));

        // Dedupe
        const uniqueEntities = Array.from(new Set(words));

        // 2. Resolve (Batch)
        return await this.resolveEntities(projectId, userUuid, uniqueEntities, 'CONCEPT');
    }

    public static async resolveEntities(projectId: string, userUuid: string, entities: any[], typeOverride?: string): Promise<string[]> {
        if (!entities || entities.length === 0) return [];

        const uniqueEntities = new Map<string, string>();
        entities.forEach(e => {
            const label = e.name || e.value || e; // Handle string array input
            if (label) uniqueEntities.set(label, typeOverride || 'ENTITY');
        });

        if (uniqueEntities.size === 0) return [];

        // We need to fetch existing nodes first to simulate UPSERT without unique constraint if not present
        // Or we rely on the schema update to add unique constraint. 
        // For safety, let's do a check-and-insert approach if not sure about constraint.
        // Actually, best is to try Insert and Ignore or explicit select.

        // Simplified logic for porting:
        const nodeUuids: string[] = [];
        for (const [label, type] of uniqueEntities.entries()) {
            const existing = await sql`
                SELECT uuid FROM graph_nodes 
                WHERE user_uuid=${userUuid} 
                AND project_id=${projectId}
                AND label=${label} 
                AND type=${type}
            `;
            if (existing.length > 0) {
                await sql`
                    UPDATE graph_nodes 
                    SET mass = mass + 0.1, last_accessed_at = NOW() 
                    WHERE uuid=${existing[0].uuid} AND project_id=${projectId}
                `;
                nodeUuids.push(existing[0].uuid);
            } else {
                const newId = crypto.randomUUID();
                await sql`
                    INSERT INTO graph_nodes (uuid, user_uuid, project_id, label, type, mass, last_accessed_at) 
                    VALUES (${newId}, ${userUuid}, ${projectId}, ${label}, ${type}, 1.0, NOW())
                `;
                nodeUuids.push(newId);
            }
        }

        return nodeUuids;
    }

    public static async processGroupContext(projectId: string, userUuid: string, groupMeta: { name: string, id_group: string }) {
        if (!groupMeta || !groupMeta.name) return null;

        // Check existing using projectId
        const existing = await sql`
            SELECT uuid FROM graph_nodes 
            WHERE user_uuid=${userUuid} 
            AND project_id=${projectId}
            AND label=${groupMeta.name} 
            AND type='CONCEPT'
        `;

        if (existing.length > 0) {
            await sql`
                UPDATE graph_nodes 
                SET mass = mass + 0.2, last_accessed_at = NOW() 
                WHERE uuid=${existing[0].uuid} AND project_id=${projectId}
            `;
            return existing[0].uuid;
        } else {
            const newId = crypto.randomUUID();
            await sql`
                INSERT INTO graph_nodes (uuid, user_uuid, project_id, label, type, mass, last_accessed_at) 
                VALUES (${newId}, ${userUuid}, ${projectId}, ${groupMeta.name}, 'CONCEPT', 2.0, NOW())
            `;
            return newId;
        }
    }

    public static async linkEntitiesToGroup(projectId: string, entityNodeIds: string[], groupNodeId: string) {
        if (!groupNodeId || entityNodeIds.length === 0) return;

        const edges = entityNodeIds.map(id => ({
            source_uuid: groupNodeId,
            target_uuid: id,
            type: 'ASSOCIATIVE' as const,
            weight: 0.15,
            project_id: projectId
        }));

        await this.batchCreateEdges(projectId, edges);
    }

    public static async linkNodes(projectId: string, nodeUuids: string[]) {
        if (nodeUuids.length < 2) return;

        const edges: any[] = [];
        for (let i = 0; i < nodeUuids.length; i++) {
            for (let j = i + 1; j < nodeUuids.length; j++) {
                edges.push({
                    source_uuid: nodeUuids[i],
                    target_uuid: nodeUuids[j],
                    type: 'ASSOCIATIVE' as const,
                    weight: 0.1,
                    project_id: projectId
                });
            }
        }

        if (edges.length > 0) {
            await this.batchCreateEdges(projectId, edges);
        }
    }

    public static async processThreadContext(projectId: string, userUuid: string, currentNodeIds: string[], replyChain: any[]) {
        if (!replyChain || replyChain.length === 0 || currentNodeIds.length === 0) return;

        const parentMsg = replyChain.find(r => r.level === 1 || r.reply_to);

        if (parentMsg) {
            const parentText = parentMsg.text || parentMsg.content || "";
            if (parentText.length < 3) return;

            const parentContextNodes = await sql`
                SELECT uuid FROM graph_nodes
                WHERE user_uuid = ${userUuid}
                AND project_id = ${projectId}
                AND position(label in ${parentText}) > 0
                LIMIT 3
            `;

            if (parentContextNodes.length > 0) {
                const edges: any[] = [];
                for (const parentNode of parentContextNodes) {
                    for (const currentNodeId of currentNodeIds) {
                        edges.push({
                            source_uuid: parentNode.uuid,
                            target_uuid: currentNodeId,
                            type: 'CAUSAL' as const,
                            weight: 0.2,
                            project_id: projectId
                        });
                    }
                }
                await this.batchCreateEdges(projectId, edges);
            }
        }
    }

    private static async batchCreateEdges(projectId: string, edges: any[]) {
        if (edges.length === 0) return;

        for (const edge of edges) {
            const id = crypto.randomUUID();
            // Check existence with Project Isolation
            const exists = await sql`
                SELECT id, weight FROM graph_edges 
                WHERE source_uuid=${edge.source_uuid} 
                AND target_uuid=${edge.target_uuid} 
                AND type=${edge.type}
                AND project_id=${projectId}
            `;

            if (exists.length > 0) {
                const newWeight = Math.min(exists[0].weight + edge.weight, 1.0);
                await sql`UPDATE graph_edges SET weight=${newWeight} WHERE id=${exists[0].id} AND project_id=${projectId}`;
            } else {
                await sql`
                    INSERT INTO graph_edges (id, project_id, source_uuid, target_uuid, type, weight) 
                    VALUES (${id}, ${projectId}, ${edge.source_uuid}, ${edge.target_uuid}, ${edge.type}, ${edge.weight})
                `;
            }
        }
    }
}
