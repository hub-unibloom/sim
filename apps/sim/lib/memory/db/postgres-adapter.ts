
import { createLogger } from '@sim/logger';
import { sql } from './postgres';
import type {
    CheshireDBAdapter,
    CheshireUser,
    CheshireMemory,
    UserPreferences,
    IngestionLog,
} from './db-adapter';
import type {
    CognitiveNode,
    SynapticEdge,
    VitalState,
    CheshireProject,
    PersonalityConfig,
    MemoryConfig,
} from '../types';

const logger = createLogger('CheshirePostgres');

export class PostgresCheshireAdapter implements CheshireDBAdapter {

    // -------------------------------------------------------------------------
    // PROJECT OPERATIONS
    // -------------------------------------------------------------------------

    async createProject(project: Omit<CheshireProject, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
        const result = await sql`
            INSERT INTO projects (
                name, description, owner_user_uuid, 
                personality_config, memory_config, is_active
            )
            VALUES (
                ${project.name}, ${project.description || null}, ${project.owner_user_uuid},
                ${sql.json(project.personality_config)}, ${sql.json(project.memory_config)}, ${project.is_active}
            )
            RETURNING id
        `;
        return result[0].id;
    }

    async getProject(projectId: string): Promise<CheshireProject | null> {
        const result = await sql`
            SELECT * FROM projects WHERE id = ${projectId}
        `;

        if (result.length === 0) return null;

        return this.mapProject(result[0]);
    }

    async listProjectsByOwner(ownerUuid: string): Promise<CheshireProject[]> {
        const result = await sql`
            SELECT * FROM projects 
            WHERE owner_user_uuid = ${ownerUuid} 
            AND is_active = true
            ORDER BY created_at DESC
        `;
        return result.map(this.mapProject);
    }

    async updateProject(projectId: string, updates: Partial<CheshireProject>): Promise<void> {
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.description) updateData.description = updates.description;
        if (updates.personality_config) updateData.personality_config = sql.json(updates.personality_config);
        if (updates.memory_config) updateData.memory_config = sql.json(updates.memory_config);
        if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

        if (Object.keys(updateData).length === 0) return;

        updateData.updated_at = new Date(); // Update timestamp

        await sql`
            UPDATE projects SET ${sql(updateData)}
            WHERE id = ${projectId}
        `;
    }

    async deleteProject(projectId: string): Promise<void> {
        await sql`DELETE FROM projects WHERE id = ${projectId}`;
    }

    // -------------------------------------------------------------------------
    // USER OPERATIONS
    // -------------------------------------------------------------------------

    async getUser(uuid: string): Promise<CheshireUser | null> {
        // Users are global in Sim, but CheshireUser creates a view for memory context
        // Assuming 'cheshire_users' view or table acts as extension
        const result = await sql`SELECT * FROM cheshire_users WHERE uuid = ${uuid}`;
        if (result.length === 0) return null;
        return this.mapUser(result[0]);
    }

    async updateUserPreferences(uuid: string, prefs: Partial<UserPreferences>): Promise<void> {
        // Merge preferences
        const existing = await this.getUser(uuid);
        const newPrefs = { ...(existing?.preferences || {}), ...prefs };

        await sql`
            UPDATE cheshire_users 
            SET preferences = ${sql.json(newPrefs)}
            WHERE uuid = ${uuid}
        `;
    }

    async getUsersForProactiveScan(limit = 100): Promise<CheshireUser[]> {
        const result = await sql`
            SELECT * FROM cheshire_users
            WHERE preferences->>'allow_proactive' = 'true'
            ORDER BY last_interaction ASC
            LIMIT ${limit}
        `;
        return result.map(this.mapUser);
    }

    async touchUserInteraction(uuid: string): Promise<void> {
        await sql`
            UPDATE cheshire_users 
            SET last_interaction = NOW() 
            WHERE uuid = ${uuid}
        `;
    }

    // -------------------------------------------------------------------------
    // MEMORY OPERATIONS
    // -------------------------------------------------------------------------

    async insertMemory(memory: Omit<CheshireMemory, 'id'>): Promise<string> {
        const result = await sql`
            INSERT INTO memories (
                user_uuid, project_id, semantic_text, type, 
                timestamp, raw_content, emotional_homeostasis, 
                entropy, is_scar, access_count
            )
            VALUES (
                ${memory.user_uuid}, ${memory.project_id}, ${memory.semantic_text}, ${memory.type},
                ${memory.timestamp}, ${sql.json(memory.raw_content || {})}, ${memory.emotional_homeostasis || null},
                ${memory.entropy || 0}, ${memory.is_scar || false}, ${memory.access_count || 0}
            )
            RETURNING id
        `;
        return result[0].id;
    }

    async updateMemory(id: string, updates: Partial<CheshireMemory>): Promise<void> {
        const updateData: any = {};
        if (updates.is_scar !== undefined) updateData.is_scar = updates.is_scar;
        if (updates.entropy !== undefined) updateData.entropy = updates.entropy;
        if (updates.access_count !== undefined) updateData.access_count = updates.access_count;
        if (updates.raw_content) updateData.raw_content = sql.json(updates.raw_content);

        if (Object.keys(updateData).length === 0) return;

        await sql`
            UPDATE memories SET ${sql(updateData)}
            WHERE id = ${id}
        `;
    }

    async getMemoriesByUser(
        userUuid: string,
        options?: { limit?: number; type?: CheshireMemory['type']; includeScarred?: boolean; projectId?: string }
    ): Promise<CheshireMemory[]> {
        let query = sql`SELECT * FROM memories WHERE user_uuid = ${userUuid}`;

        if (options?.projectId) {
            query = sql`${query} AND project_id = ${options.projectId}`;
        }
        if (options?.type) {
            query = sql`${query} AND type = ${options.type}`;
        }
        if (!options?.includeScarred) {
            query = sql`${query} AND is_scar = false`;
        }

        query = sql`${query} ORDER BY timestamp DESC`;

        if (options?.limit) {
            query = sql`${query} LIMIT ${options.limit}`;
        }

        const result = await query;
        return result.map(this.mapMemory);
    }

    async getPendingTriggers(limit = 50): Promise<CheshireMemory[]> {
        const result = await sql`
            SELECT * FROM memories 
            WHERE type = 'KAIROS_TRIGGER' 
            AND raw_content->>'status' = 'PENDING'
            ORDER BY timestamp ASC
            LIMIT ${limit}
        `;
        return result.map(this.mapMemory);
    }

    async markTriggerProcessed(memoryId: string): Promise<void> {
        const memory = await sql`SELECT raw_content FROM memories WHERE id = ${memoryId}`;
        if (memory.length === 0) return;

        const content = memory[0].raw_content;
        content.status = 'PROCESSED';

        await sql`
            UPDATE memories 
            SET raw_content = ${sql.json(content)}
            WHERE id = ${memoryId}
        `;
    }

    // -------------------------------------------------------------------------
    // GRAPH OPERATIONS
    // -------------------------------------------------------------------------

    async insertNode(node: Omit<CognitiveNode, 'uuid'>): Promise<string> {
        const result = await sql`
            INSERT INTO graph_nodes (
                user_uuid, project_id, label, type, 
                mass, activation_energy, coordinates, last_accessed_at
            )
            VALUES (
                ${node.user_uuid}, ${node.project_id}, ${node.label}, ${node.type},
                ${node.mass}, ${node.activationEnergy}, ${sql.json(node.coordinates)}, ${node.last_accessed_at}
            )
            RETURNING uuid
        `;
        return result[0].uuid;
    }

    async insertEdge(edge: Omit<SynapticEdge, 'id'> & { id?: string }): Promise<string> {
        const result = await sql`
            INSERT INTO graph_edges (
                id, project_id, source_uuid, target_uuid, weight, type
            )
            VALUES (
                ${edge.id || crypto.randomUUID()}, ${edge.project_id}, ${edge.source_uuid}, ${edge.target_uuid}, 
                ${edge.weight}, ${edge.type}
            )
            RETURNING id
        `;
        return result[0].id;
    }

    async getGraphByUser(userUuid: string, projectId?: string): Promise<{ nodes: CognitiveNode[]; edges: SynapticEdge[] }> {
        let nodeQuery = sql`SELECT * FROM graph_nodes WHERE user_uuid = ${userUuid}`;

        if (projectId) {
            nodeQuery = sql`${nodeQuery} AND project_id = ${projectId}`;
        }

        const nodes = await nodeQuery;

        if (nodes.length === 0) return { nodes: [], edges: [] };

        const nodeIds = nodes.map(n => n.uuid);
        const edges = await sql`
            SELECT * FROM graph_edges 
            WHERE source_uuid IN ${sql(nodeIds)}
        `;

        return {
            nodes: nodes.map(this.mapNode),
            edges: edges.map(this.mapEdge)
        };
    }

    async decayEdgeWeights(decayFactor: number, olderThanHours: number): Promise<number> {
        // Implementation would use database function or complex update
        // Placeholder for now
        return 0;
    }

    async pruneWeakEdges(weightThreshold: number, olderThanDays: number): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const result = await sql`
            DELETE FROM graph_edges
            WHERE weight < ${weightThreshold}
            AND created_at < ${cutoff}
            RETURNING id
         `;
        return result.length;
    }

    // -------------------------------------------------------------------------
    // INGESTION LOG OPERATIONS
    // -------------------------------------------------------------------------

    async logIngestion(log: IngestionLog): Promise<void> {
        await sql`
            INSERT INTO cheshire_ingestion_logs (
                packet_hash, packet_id, project_id, user_uuid, 
                status, semantic_summary, origin_channel, entropy_delta
            )
            VALUES (
                ${log.packet_hash}, ${log.packet_id}, ${log.project_id}, ${log.user_uuid},
                ${log.status}, ${log.semantic_summary}, ${log.origin_channel}, ${log.entropy_delta}
            )
        `;
    }

    async checkIngestionExists(hash: string): Promise<boolean> {
        const result = await sql`SELECT 1 FROM cheshire_ingestion_logs WHERE packet_hash = ${hash} LIMIT 1`;
        return result.length > 0;
    }

    async updateIngestionStatus(hash: string, status: IngestionLog['status']): Promise<void> {
        await sql`UPDATE cheshire_ingestion_logs SET status = ${status} WHERE packet_hash = ${hash}`;
    }

    // -------------------------------------------------------------------------
    // VITAL STATE OPERATIONS
    // -------------------------------------------------------------------------

    async getVitalState(projectId: string, userUuid: string): Promise<VitalState | null> {
        const result = await sql`
            SELECT * FROM cheshire_vital_states 
            WHERE user_uuid = ${userUuid} AND project_id = ${projectId}
            LIMIT 1
        `;
        if (result.length === 0) return null;
        return this.mapVitalState(result[0]);
    }

    async updateVitalState(projectId: string, userUuid: string, state: Partial<VitalState>): Promise<void> {
        const updateData: any = {};
        if (state.consciousness_level !== undefined) updateData.consciousness_level = state.consciousness_level;
        if (state.interaction_rhythm !== undefined) updateData.interaction_rhythm = state.interaction_rhythm;
        if (state.emotional_homeostasis) {
            const eh = state.emotional_homeostasis;
            updateData.emotional_homeostasis = [
                eh.joy, eh.trust, eh.fear, eh.surprise, eh.sadness,
                eh.disgust, eh.anger, eh.anticipation, eh.arousal
            ];
        }
        if (state.affective_signature) updateData.affective_signature = state.affective_signature;

        if (Object.keys(updateData).length === 0) return;

        updateData.last_update = new Date();

        // Upsert logic
        const exists = await this.getVitalState(projectId, userUuid);
        if (exists) {
            await sql`
                UPDATE cheshire_vital_states SET ${sql(updateData)}
                WHERE user_uuid = ${userUuid} AND project_id = ${projectId}
            `;
        } else {
            await sql`
                INSERT INTO cheshire_vital_states (
                    user_uuid, project_id, consciousness_level, interaction_rhythm,
                    emotional_homeostasis, affective_signature, last_update
                ) VALUES (
                    ${userUuid}, ${projectId}, 
                    ${updateData.consciousness_level || 0.5}, ${updateData.interaction_rhythm || 100},
                    ${updateData.emotional_homeostasis || null}, ${updateData.affective_signature || null},
                    ${updateData.last_update}
                )
            `;
        }
    }

    // -------------------------------------------------------------------------
    // MAPPERS
    // -------------------------------------------------------------------------

    private mapProject(row: any): CheshireProject {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            owner_user_uuid: row.owner_user_uuid,
            personality_config: row.personality_config,
            memory_config: row.memory_config,
            is_active: row.is_active,
            created_at: row.created_at.toISOString(),
            updated_at: row.updated_at.toISOString()
        };
    }

    private mapUser(row: any): CheshireUser {
        return {
            uuid: row.uuid,
            username: row.username,
            email: row.email,
            preferences: row.preferences,
            interaction_rhythm_ms: row.interaction_rhythm_ms,
            last_interaction: new Date(row.last_interaction),
            created_at: new Date(row.created_at)
        };
    }

    private mapMemory(row: any): CheshireMemory {
        return {
            id: row.id,
            project_id: row.project_id,
            user_uuid: row.user_uuid,
            semantic_text: row.semantic_text,
            type: row.type,
            timestamp: new Date(row.timestamp),
            raw_content: row.raw_content,
            emotional_homeostasis: row.emotional_homeostasis,
            entropy: row.entropy,
            is_scar: row.is_scar,
            access_count: row.access_count
        };
    }

    private mapNode(row: any): CognitiveNode {
        return {
            uuid: row.uuid,
            project_id: row.project_id,
            user_uuid: row.user_uuid,
            label: row.label,
            type: row.type,
            mass: row.mass,
            activationEnergy: row.activation_energy,
            coordinates: row.coordinates,
            last_accessed_at: row.last_accessed_at
        };
    }

    private mapEdge(row: any): SynapticEdge {
        return {
            id: row.id,
            project_id: row.project_id,
            source_uuid: row.source_uuid,
            target_uuid: row.target_uuid,
            weight: row.weight,
            type: row.type
        };
    }

    private mapVitalState(row: any): VitalState {
        const eh = row.emotional_homeostasis || [];
        return {
            uuid: row.uuid,
            project_id: row.project_id,
            user_uuid: row.user_uuid,
            consciousness_level: row.consciousness_level,
            interaction_rhythm: row.interaction_rhythm,
            last_update: row.last_update,
            emotional_homeostasis: {
                joy: eh[0] || 0, trust: eh[1] || 0, fear: eh[2] || 0,
                surprise: eh[3] || 0, sadness: eh[4] || 0, disgust: eh[5] || 0,
                anger: eh[6] || 0, anticipation: eh[7] || 0, arousal: eh[8] || 0.5
            },
            affective_signature: row.affective_signature
        };
    }
}
