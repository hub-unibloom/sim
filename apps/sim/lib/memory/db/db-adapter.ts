/**
 * CHESHIRE MEMORY SYSTEM - BaaS Database Adapter
 * 
 * Abstract interface for database operations, enabling the Cheshire system
 * to work with any BaaS provider (Supabase, Neon, PlanetScale, etc.)
 * 
 * This abstraction decouples memory operations from specific database implementations.
 */

import type {
    AffectiveVector,
    CognitiveNode,
    SynapticEdge,
    IngestionPacket,
    VitalState,
    CheshireProject,
} from '../types';

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface CheshireUser {
    uuid: string;
    username?: string;
    email?: string;
    preferences: UserPreferences;
    interaction_rhythm_ms: number;
    last_interaction: Date;
    created_at: Date;
}

export interface UserPreferences {
    allow_proactive?: boolean;
    last_proactive_attempt?: string;
    timezone?: string;
    language?: string;
    [key: string]: unknown;
}

export interface CheshireMemory {
    id: string;
    project_id: string;
    user_uuid: string;
    semantic_text: string;
    type: 'SEMANTIC' | 'EPISODE' | 'SCAR' | 'KAIROS_TRIGGER';
    timestamp: Date;
    raw_content?: Record<string, unknown>;
    emotional_homeostasis?: number[];
    entropy?: number;
    is_scar?: boolean;
    access_count?: number;
}

export interface IngestionLog {
    packet_hash: string;
    packet_id: string;
    project_id: string;
    user_uuid: string;
    status: IngestionPacket['status'];
    semantic_summary: string;
    origin_channel: string;
    entropy_delta: number;
    created_at?: Date;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * CheshireDBAdapter
 * 
 * All database operations for the Cheshire memory system go through this interface.
 * Implementations can target Supabase, Neon, raw PostgreSQL, or any other BaaS.
 */
export interface CheshireDBAdapter {
    // -------------------------------------------------------------------------
    // PROJECT OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * Create a new project
     */
    createProject(project: Omit<CheshireProject, 'id' | 'created_at' | 'updated_at'>): Promise<string>;

    /**
     * Get a project by ID
     */
    getProject(projectId: string): Promise<CheshireProject | null>;

    /**
     * List all projects owned by a user
     */
    listProjectsByOwner(ownerUuid: string): Promise<CheshireProject[]>;

    /**
     * Update project configuration
     */
    updateProject(projectId: string, updates: Partial<CheshireProject>): Promise<void>;

    /**
     * Delete a project and all its data
     */
    deleteProject(projectId: string): Promise<void>;

    // -------------------------------------------------------------------------
    // USER OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * Get a user by UUID
     */
    getUser(uuid: string): Promise<CheshireUser | null>;

    /**
     * Update user preferences (partial update)
     */
    updateUserPreferences(uuid: string, prefs: Partial<UserPreferences>): Promise<void>;

    /**
     * Get users eligible for proactive engagement (Kairos scan)
     * Returns users who haven't been contacted recently and allow proactive messages
     */
    getUsersForProactiveScan(limit?: number): Promise<CheshireUser[]>;

    /**
     * Update user's last interaction timestamp
     */
    touchUserInteraction(uuid: string): Promise<void>;

    // -------------------------------------------------------------------------
    // MEMORY OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * Insert a new memory
     */
    insertMemory(memory: Omit<CheshireMemory, 'id'>): Promise<string>;

    /**
     * Update an existing memory (for scar marking, access count, etc.)
     */
    updateMemory(id: string, updates: Partial<CheshireMemory>): Promise<void>;

    /**
     * Get memories for a user (ordered by timestamp desc)
     */
    getMemoriesByUser(userUuid: string, options?: {
        limit?: number;
        type?: CheshireMemory['type'];
        includeScarred?: boolean;
    }): Promise<CheshireMemory[]>;

    /**
     * Get pending KAIROS_TRIGGER memories that need action dispatch
     */
    getPendingTriggers(limit?: number): Promise<CheshireMemory[]>;

    /**
     * Mark a trigger as processed
     */
    markTriggerProcessed(memoryId: string): Promise<void>;

    // -------------------------------------------------------------------------
    // GRAPH OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * Insert a cognitive node
     */
    insertNode(node: Omit<CognitiveNode, 'uuid'>): Promise<string>;

    /**
     * Insert a synaptic edge between nodes
     */
    insertEdge(edge: Omit<SynapticEdge, 'id'> & { id?: string }): Promise<string>;

    /**
     * Get the full cognitive graph for a user
     */
    getGraphByUser(userUuid: string): Promise<{
        nodes: CognitiveNode[];
        edges: SynapticEdge[];
    }>;

    /**
     * Decay edge weights over time (maintenance job)
     */
    decayEdgeWeights(decayFactor: number, olderThanHours: number): Promise<number>;

    /**
     * Prune weak edges (maintenance job)
     */
    pruneWeakEdges(weightThreshold: number, olderThanDays: number): Promise<number>;

    // -------------------------------------------------------------------------
    // INGESTION LOG OPERATIONS (Thalamus)
    // -------------------------------------------------------------------------

    /**
     * Log an ingestion attempt
     */
    logIngestion(log: IngestionLog): Promise<void>;

    /**
     * Check if an ingestion hash already exists (idempotency check)
     */
    checkIngestionExists(hash: string): Promise<boolean>;

    /**
     * Update ingestion status (PENDING -> PROCESSED/FAILED)
     */
    updateIngestionStatus(hash: string, status: IngestionLog['status']): Promise<void>;

    // -------------------------------------------------------------------------
    // VITAL STATE OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * Get the current vital state (affect, consciousness) for a user in a project
     */
    getVitalState(projectId: string, userUuid: string): Promise<VitalState | null>;

    /**
     * Update vital state
     */
    updateVitalState(projectId: string, userUuid: string, state: Partial<VitalState>): Promise<void>;
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

let activeAdapter: CheshireDBAdapter | null = null;

/**
 * Set the active database adapter
 * Call this during app initialization with your chosen implementation
 */
export function setCheshireDBAdapter(adapter: CheshireDBAdapter): void {
    activeAdapter = adapter;
}

/**
 * Get the active database adapter
 * Throws if no adapter has been set
 */
export function getCheshireDBAdapter(): CheshireDBAdapter {
    if (!activeAdapter) {
        throw new Error(
            'CheshireDBAdapter not initialized. Call setCheshireDBAdapter() during app startup.'
        );
    }
    return activeAdapter;
}

/**
 * Check if an adapter is currently set
 */
export function hasCheshireDBAdapter(): boolean {
    return activeAdapter !== null;
}
