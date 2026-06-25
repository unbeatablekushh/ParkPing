-- Create user queries table for Contact Us page
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_queries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public contact form)
CREATE POLICY "Anyone can insert queries"
  ON user_queries FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admins) can view queries
-- (You can refine this later to specific admin IDs)
CREATE POLICY "Authenticated users can view queries"
  ON user_queries FOR SELECT
  USING (auth.role() = 'authenticated');
