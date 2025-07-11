-- Simple SQL script to create interaction streams table
-- Run this directly in your database if the migration script fails

-- Create the enums if they don't exist
DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM ('note', 'call', 'email', 'in_person');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interaction_status AS ENUM ('active', 'archived', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create interaction_streams table if it doesn't exist
CREATE TABLE IF NOT EXISTS interaction_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    interaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status interaction_status NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Ensure either contact_id or business_id is provided
    CONSTRAINT check_entity_reference CHECK (
        (contact_id IS NOT NULL AND business_id IS NULL) OR 
        (contact_id IS NULL AND business_id IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_interaction_streams_workspace_id ON interaction_streams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_contact_id ON interaction_streams(contact_id);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_business_id ON interaction_streams(business_id);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_interaction_date ON interaction_streams(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_type ON interaction_streams(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_status ON interaction_streams(status);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_interaction_streams_workspace_date ON interaction_streams(workspace_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_streams_contact_date ON interaction_streams(contact_id, interaction_date DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interaction_streams_business_date ON interaction_streams(business_id, interaction_date DESC) WHERE business_id IS NOT NULL;