
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

export interface CognitiveNode {
    uuid: string;
    label: string;
    type: 'ENTITY' | 'CONCEPT' | 'EVENT' | 'AFFECT' | 'SCAR' | 'IDENTITY';
    mass: number;
    activationEnergy: number;
    coordinates: { x: number; y: number };
    last_accessed_at: string;
}

export interface SynapticEdge {
    source_uuid: string;
    target_uuid: string;
    weight: number;
    type: 'CAUSAL' | 'ASSOCIATIVE' | 'TEMPORAL' | 'CONTRADICTORY';
}

export interface VitalState {
    uuid: string;
    consciousness_level: number;
    emotional_homeostasis: AffectiveVector;
    affective_signature: Vector512;
    interaction_rhythm: number;
    last_update: string;
    plano: 'free' | 'premium';
}

export interface IngestionPacket {
    packet_id: string;
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
    }
}
