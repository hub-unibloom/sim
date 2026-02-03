-- MIGRATION: 002_cheshire_actions.sql
-- Description: Adds Action Dispatch tables for automation system

CREATE TABLE IF NOT EXISTS cheshire_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_uuid TEXT NOT NULL,
    type TEXT NOT NULL, -- 'FINANCIAL_OPERATION', 'SCHEDULING', etc.
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'FAILED'
    payload JSONB NOT NULL DEFAULT '{}', -- Flexible params for the action
    priority INTEGER DEFAULT 5,
    result_metadata JSONB, -- Store execution results/logs
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cheshire_actions_project_status ON cheshire_actions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_cheshire_actions_user_status ON cheshire_actions(user_uuid, status);
