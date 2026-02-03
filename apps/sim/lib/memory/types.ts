
// ONTOLOGY DEFINITIONS :: SINGULARITY STANDARD V10

export type Vector512 = number[];

export interface AffectiveVector {
    joy: number;
    trust: number;
    fear: number;
    surprise: number;
    sadness: number;
    disgust: number;
    anger: number;
    anticipation: number;
    arousal: number;
}

export enum MemoryPhase {
    ENCODING = 'synaptic_formation',
    CONSOLIDATION = 'protein_synthesis',
    RETRIEVAL = 'neural_reactivation',
    SCARRING = 'entropic_residue'
}

// ============================================================================
// MULTI-PROJECT SUPPORT
// ============================================================================

export interface PersonalityConfig {
    base_affect: AffectiveVector;
    tone: 'professional' | 'friendly' | 'casual' | 'technical' | 'empathetic';
    expertise_areas: string[];
    custom_instructions?: string;
}

export interface MemoryConfig {
    retention_threshold: number;
    max_context_memories: number;
    enable_graph: boolean;
    enable_affective: boolean;
    enable_proactive: boolean;
}

export interface CheshireProject {
    id: string;
    name: string;
    description?: string;
    owner_user_uuid: string;
    personality_config: PersonalityConfig;
    memory_config: MemoryConfig;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// CORE TYPES (Updated with project_id)
// ============================================================================

export interface CognitiveNode {
    uuid: string;
    project_id: string;
    user_uuid: string;
    label: string;
    type: 'ENTITY' | 'CONCEPT' | 'EVENT' | 'AFFECT' | 'SCAR' | 'IDENTITY';
    mass: number;
    activationEnergy: number;
    coordinates: { x: number; y: number };
    last_accessed_at: string;
}

export interface SynapticEdge {
    id?: string;
    project_id: string;
    source_uuid: string;
    target_uuid: string;
    weight: number;
    type: 'CAUSAL' | 'ASSOCIATIVE' | 'TEMPORAL' | 'CONTRADICTORY';
}

export interface VitalState {
    uuid: string;
    project_id: string;
    user_uuid: string;
    consciousness_level: number;
    emotional_homeostasis: AffectiveVector;
    affective_signature: Vector512;
    interaction_rhythm: number;
    last_update: string;
}

export interface IngestionPacket {
    packet_id: string;
    project_id: string;
    user_uuid: string;
    timestamp: string;
    entropy_delta: number;
    status: 'PENDING' | 'PROCESSED' | 'IDEMPOTENT_REJECTION' | 'FAILED';
    semantic_summary: string;
    origin_channel: string;
}

export interface CortexResponse<T> {
    success: boolean;
    data: T;
    meta: {
        latency_ms: number;
        version: string;
        project_id?: string;
    }
}
