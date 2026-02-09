-- Enable Extensions for Graph Search (Trigram) and Vector
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Vectors handled by Qdrant, but kept here just in case user wants hybrid later
-- CREATE EXTENSION IF NOT EXISTS vector; 

-- Ensure memories table exists for metadata (Vectors stored in Qdrant)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    semantic_text TEXT NOT NULL,
    type TEXT NOT NULL, -- 'SEMANTIC', 'EPISODE', 'SCAR', 'KAIROS_TRIGGER'
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_content JSONB DEFAULT '{}',
    emotional_homeostasis FLOAT[] DEFAULT NULL,
    entropy FLOAT DEFAULT 0,
    is_scar BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0
);

-- Create indexes for metadata filtering
CREATE INDEX IF NOT EXISTS idx_memories_user_project ON memories (user_uuid, project_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (type);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories (timestamp DESC);

-- Ensure other Cheshire tables exist
CREATE TABLE IF NOT EXISTS cheshire_vital_states (
    user_uuid TEXT NOT NULL,
    project_id TEXT NOT NULL,
    consciousness_level FLOAT DEFAULT 0.5,
    interaction_rhythm INTEGER DEFAULT 100,
    emotional_homeostasis FLOAT[],
    affective_signature JSONB,
    last_update TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_uuid, project_id)
);

-- Graph Memory (The "Continuous" aspect)
CREATE TABLE IF NOT EXISTS graph_nodes (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid TEXT NOT NULL,
    project_id TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CONCEPT', 'PERSON', 'EVENT', 'LOCATION'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_uuid UUID NOT NULL REFERENCES graph_nodes(uuid) ON DELETE CASCADE,
    target_uuid UUID NOT NULL REFERENCES graph_nodes(uuid) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'IS_A', 'HAS_A', 'RELATED_TO', 'CAUSES'
    weight FLOAT DEFAULT 1.0,
    project_id TEXT NOT NULL,
    bidirectional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_label ON graph_nodes USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges (source_uuid);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges (target_uuid);

-- Cheshire User View (Unified Profile)
CREATE OR REPLACE VIEW cheshire_users AS
SELECT 
    u.id as uuid,
    u.name as username,
    u.email,
    u.image as avatar,
    u.preferences,
    u.last_interaction,
    u.emotional_homeostasis
FROM "user" u;

-- Add Personality to Workspace (Project)
ALTER TABLE "workspace" ADD COLUMN IF NOT EXISTS "personality_config" JSONB DEFAULT '{}';


CREATE TABLE IF NOT EXISTS graph_nodes (
    uuid TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    mass FLOAT DEFAULT 1.0,
    activation_energy FLOAT DEFAULT 0.5,
    coordinates JSONB,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_uuid TEXT NOT NULL REFERENCES graph_nodes(uuid) ON DELETE CASCADE,
    target_uuid TEXT NOT NULL REFERENCES graph_nodes(uuid) ON DELETE CASCADE,
    weight FLOAT DEFAULT 0.0,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion logs
CREATE TABLE IF NOT EXISTS cheshire_ingestion_logs (
    packet_hash TEXT PRIMARY KEY,
    packet_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    status TEXT NOT NULL,
    semantic_summary TEXT,
    origin_channel TEXT,
    entropy_delta FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
