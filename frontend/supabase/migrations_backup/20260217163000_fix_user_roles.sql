-- FIX: Missing User Roles in ENUM
-- Description: Adds missing roles required by the Frontend to the database ENUM.

-- 1. Add 'wellness_professional' if not exists
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'wellness_professional';

-- 2. Add 'store_owner' if not exists
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'store_owner';

-- 3. Add 'organizer' if not exists
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer';

-- 4. Ensure aliases work at database level if needed (Usually handled by app logic, but good to document)
-- Note: 'school' in frontend maps to 'school_admin' in DB.
-- Note: 'admin' in frontend maps to 'super_admin' in DB.
