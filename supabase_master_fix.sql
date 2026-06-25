-- MASTER FIX SCRIPT: Run this in your Supabase SQL Editor

-- 1. Create profiles table (since the app uses 'profiles', not 'users')
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    age INTEGER,
    gender TEXT,
    date_of_birth TEXT,
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns exist in profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- 2. Add all missing columns to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS chassis_number TEXT,
ADD COLUMN IF NOT EXISTS engine_number TEXT,
ADD COLUMN IF NOT EXISTS purchase_year INTEGER,
ADD COLUMN IF NOT EXISTS fuel_type TEXT;

-- 3. Add all missing columns to qr_codes table
ALTER TABLE qr_codes 
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS car_number TEXT,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS qr_code_string TEXT;

-- 4. Fix Foreign Key constraint for vehicles to point to profiles instead of public.users
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_user_id_fkey;

-- 5. Force schema cache refresh
NOTIFY pgrst, 'reload schema';
