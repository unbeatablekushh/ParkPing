-- Add new columns for vehicle registration
-- Run this in your Supabase SQL Editor

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS purchase_year INTEGER,
ADD COLUMN IF NOT EXISTS fuel_type TEXT,
ADD COLUMN IF NOT EXISTS chassis_number TEXT,
ADD COLUMN IF NOT EXISTS engine_number TEXT;

-- Update types for order identification 
-- (If not already present from previous steps)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);

-- Force cache refresh
NOTIFY pgrst, 'reload schema';
