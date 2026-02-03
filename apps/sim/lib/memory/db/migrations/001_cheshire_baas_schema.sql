-- ============================================================================
-- CHESHIRE MEMORY SYSTEM - BaaS Schema
-- 
-- Run this in your Supabase/Neon/PostgreSQL database to create the tables
-- required by the Cheshire memory system.
-- 
-- Prerequisites: None (Vector operations handled by Qdrant)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_users (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT,
    email TEXT,
    preferences JSONB DEFAULT '{"allow_proactive": true}'::jsonb,
    interaction_rhythm_ms INTEGER DEFAULT 86400000, -- 24 hours default
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_users_last_interaction 
    ON cheshire_users (last_interaction DESC);

CREATE INDEX IF NOT EXISTS idx_cheshire_users_proactive 
    ON cheshire_users ((preferences->>'allow_proactive'));

-- ============================================================================
-- MEMORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID NOT NULL REFERENCES cheshire_users(uuid) ON DELETE CASCADE,
    project_id TEXT NOT NULL DEFAULT 'default', -- Critical for multi-tenant isolation
    semantic_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('SEMANTIC', 'EPISODE', 'SCAR', 'KAIROS_TRIGGER')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_content JSONB DEFAULT '{}',
    emotional_homeostasis REAL[],
    entropy REAL DEFAULT 0.0,
    is_scar BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cheshire_memories_user 
    ON cheshire_memories (user_uuid);

CREATE INDEX IF NOT EXISTS idx_cheshire_memories_project 
    ON cheshire_memories (project_id);

CREATE INDEX IF NOT EXISTS idx_cheshire_memories_timestamp 
    ON cheshire_memories (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cheshire_memories_type 
    ON cheshire_memories (type);

CREATE INDEX IF NOT EXISTS idx_cheshire_memories_triggers 
    ON cheshire_memories (type, (raw_content->>'status'))
    WHERE type = 'KAIROS_TRIGGER';

-- ============================================================================
-- COGNITIVE GRAPH NODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_graph_nodes (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID NOT NULL REFERENCES cheshire_users(uuid) ON DELETE CASCADE,
    project_id TEXT NOT NULL DEFAULT 'default',
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ENTITY', 'CONCEPT', 'EVENT', 'AFFECT', 'SCAR', 'IDENTITY')),
    mass REAL DEFAULT 1.0,
    activation_energy REAL DEFAULT 0.0,
    coordinates JSONB DEFAULT '{"x": 0, "y": 0}',
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_nodes_user 
    ON cheshire_graph_nodes (user_uuid);

CREATE INDEX IF NOT EXISTS idx_cheshire_nodes_project 
    ON cheshire_graph_nodes (project_id);

CREATE INDEX IF NOT EXISTS idx_cheshire_nodes_type 
    ON cheshire_graph_nodes (type);

-- ============================================================================
-- COGNITIVE GRAPH EDGES (SYNAPSES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_uuid UUID NOT NULL REFERENCES cheshire_graph_nodes(uuid) ON DELETE CASCADE,
    target_uuid UUID NOT NULL REFERENCES cheshire_graph_nodes(uuid) ON DELETE CASCADE,
    weight REAL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    type TEXT NOT NULL CHECK (type IN ('CAUSAL', 'ASSOCIATIVE', 'TEMPORAL', 'CONTRADICTORY')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_edges_source 
    ON cheshire_graph_edges (source_uuid);

CREATE INDEX IF NOT EXISTS idx_cheshire_edges_target 
    ON cheshire_graph_edges (target_uuid);

CREATE INDEX IF NOT EXISTS idx_cheshire_edges_weight 
    ON cheshire_graph_edges (weight);

CREATE INDEX IF NOT EXISTS idx_cheshire_edges_updated_at
    ON cheshire_graph_edges (updated_at); -- Critical for decay performance

-- ============================================================================
-- ACTION DISPATCHER (Added for Automation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID NOT NULL REFERENCES cheshire_users(uuid) ON DELETE CASCADE,
    project_id TEXT NOT NULL DEFAULT 'default',
    trigger_content TEXT,
    action_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'FAILED')),
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cheshire_actions_status
    ON cheshire_actions (status);

CREATE INDEX IF NOT EXISTS idx_cheshire_actions_project
    ON cheshire_actions (project_id);

-- ============================================================================
-- INGESTION LOGS (THALAMUS IDEMPOTENCY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_ingestion_logs (
    packet_hash TEXT PRIMARY KEY,
    packet_id UUID NOT NULL,
    project_id TEXT, 
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSED', 'IDEMPOTENT_REJECTION', 'FAILED')),
    semantic_summary TEXT,
    origin_channel TEXT,
    entropy_delta REAL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_ingestion_status 
    ON cheshire_ingestion_logs (status);

-- ============================================================================
-- VITAL STATE (CONSCIOUSNESS / AFFECT STATE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cheshire_vital_states (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID UNIQUE NOT NULL REFERENCES cheshire_users(uuid) ON DELETE CASCADE,
    consciousness_level REAL DEFAULT 1.0 CHECK (consciousness_level >= 0 AND consciousness_level <= 1),
    emotional_homeostasis REAL[] DEFAULT ARRAY[0.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.5],
    affective_signature REAL[] DEFAULT ARRAY[]::REAL[],
    interaction_rhythm INTEGER DEFAULT 86400000,
    plano TEXT DEFAULT 'free' CHECK (plano IN ('free', 'premium')),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_vital_user 
    ON cheshire_vital_states (user_uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to decay edge weights (called by maintenance job)
CREATE OR REPLACE FUNCTION decay_edge_weights(decay_factor REAL, cutoff_time TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE cheshire_graph_edges 
    SET weight = weight * decay_factor,
        updated_at = CURRENT_TIMESTAMP
    WHERE updated_at < cutoff_time;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- Function to merge JSONB (for partial preference updates)
CREATE OR REPLACE FUNCTION jsonb_merge(target_column TEXT, source JSONB)
RETURNS JSONB AS $$
BEGIN
    RETURN target_column::JSONB || source;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - for Supabase)
-- ============================================================================

-- Uncomment if using Supabase RLS
-- ALTER TABLE cheshire_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cheshire_memories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cheshire_graph_nodes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cheshire_graph_edges ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cheshire_vital_states ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cheshire_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GRANTS (adjust as needed for your setup)
-- ============================================================================

-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
