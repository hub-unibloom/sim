-- MIGRATION: 001_cheshire_multi_project.sql
-- Description: Adds multi-project support to Cheshire Memory System

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_user_uuid TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Configuração de personalidade da IA
    personality_config JSONB DEFAULT '{
        "base_affect": {
            "joy": 0.5, "trust": 0.5, "fear": 0.0,
            "surprise": 0.0, "sadness": 0.0, "disgust": 0.0,
            "anger": 0.0, "anticipation": 0.5, "arousal": 0.5
        },
        "tone": "professional",
        "expertise_areas": []
    }',
    
    -- Configuração de memória
    memory_config JSONB DEFAULT '{
        "retention_threshold": 0.15,
        "max_context_memories": 15,
        "enable_graph": true,
        "enable_affective": true
    }',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(owner_user_uuid, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_uuid);

-- 2. Update Memories Table
ALTER TABLE memories ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_memories_project_user ON memories(project_id, user_uuid);

-- 3. Update Graph Nodes Table
ALTER TABLE graph_nodes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_user ON graph_nodes(project_id, user_uuid);

-- 4. Update Graph Edges Table
ALTER TABLE graph_edges ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON graph_edges(project_id);

-- 5. Update Vital States Table (Renaming to match usage in code if needed, assuming cheshire_vital_states exists or created here)
CREATE TABLE IF NOT EXISTS cheshire_vital_states (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_uuid TEXT NOT NULL,
    consciousness_level FLOAT DEFAULT 0.5,
    emotional_homeostasis FLOAT[] DEFAULT '{0.5, 0.5, 0, 0, 0, 0, 0, 0.5, 0.5}',
    affective_signature FLOAT[],
    interaction_rhythm FLOAT DEFAULT 100,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_uuid)
);

-- 6. Update Ingestion Logs
CREATE TABLE IF NOT EXISTS cheshire_ingestion_logs (
    packet_hash TEXT PRIMARY KEY,
    packet_id TEXT NOT NULL,
    project_id TEXT, -- Loose reference valid for logs
    user_uuid TEXT NOT NULL,
    status TEXT NOT NULL,
    semantic_summary TEXT,
    origin_channel TEXT,
    entropy_delta FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. View for Cheshire Users (if needed to bridge Sim users)
-- Assuming 'users' table exists from Sim core
CREATE OR REPLACE VIEW cheshire_users AS
SELECT 
    uuid, 
    username, 
    email, 
    preferences, 
    COALESCE(preferences->>'interaction_rhythm_ms', '0')::int as interaction_rhythm_ms,
    COALESCE((preferences->>'last_interaction')::timestamp, created_at) as last_interaction,
    created_at
FROM users;
