-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure memories table exists with vector support
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
    access_count INTEGER DEFAULT 0,
    embedding vector(1536) -- OpenAI embedding dimension
);

-- Create indexes for vector search and metadata filtering
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING hnsw (embedding vector_cosine_ops);
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
