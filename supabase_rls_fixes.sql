-- Fix for Vehicle Deletion Persistent Bug
-- Run this in your Supabase SQL Editor

-- 1. Correct RLS for Vehicles Deletion
DROP POLICY IF EXISTS "Users can delete own vehicles" ON vehicles;

CREATE POLICY "Users can delete own vehicles"
  ON vehicles FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Ensure QR codes can be deleted (Cascade usually handles this, but just in case)
DROP POLICY IF EXISTS "Users can delete own qr_codes" ON qr_codes;

CREATE POLICY "Users can delete own qr_codes"
  ON qr_codes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vehicles 
      WHERE vehicles.id = qr_codes.vehicle_id 
      AND vehicles.user_id = auth.uid()
    )
  );

-- 3. Force cache refresh
NOTIFY pgrst, 'reload schema';
