-- Run this in your Supabase SQL Editor to fix Chat and Alerts

-- 1. Create messages table for chat (missing from initial setup)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES scan_logs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('owner', 'scanner')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Force cache refresh so Supabase API recognizes the new table
NOTIFY pgrst, 'reload schema';
