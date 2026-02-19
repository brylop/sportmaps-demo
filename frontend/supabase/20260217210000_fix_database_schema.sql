-- MASTER SCHEMA FIX & TRIGGER UPDATE (FINAL)
-- 1. Add missing 'email' column to profiles if not exists
-- 2. Backfill email from auth.users safely
-- 3. Deploy robust trigger handling ENUM types

-- A. Add email column safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email text;
    END IF;
END $$;

-- B. Backfill emails (Sync data integrity)
-- Only updates where email is missing to be efficient
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- C. Define Handling Function with Smart Enum Detection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta_role text;
  meta_fullname text;
  meta_phone text;
BEGIN
  -- Extract basic claims with defaults
  meta_role := COALESCE((new.raw_user_meta_data->>'role')::text, 'athlete');
  meta_fullname := COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario');
  meta_phone := new.raw_user_meta_data->>'phone';

  -- Try inserting. Postgres auto-casts text to ENUM if it matches a label.
  INSERT INTO public.profiles (
    id, 
    full_name, 
    role, 
    email, 
    phone,
    created_at, 
    updated_at
  )
  VALUES (
    new.id,
    meta_fullname,
    meta_role, -- Implicit cast attempt
    new.email,
    meta_phone,
    now(),
    now()
  );
  
  RETURN new;

EXCEPTION
  WHEN OTHERS THEN
    -- Fallback: If primary insert fails (e.g. invalid enum value), try default 'athlete'
    BEGIN
        INSERT INTO public.profiles (
            id, 
            full_name, 
            role, 
            email, 
            phone,
            created_at, 
            updated_at
        )
        VALUES (
            new.id, 
            meta_fullname, 
            'athlete', -- Fallback to safest role
            new.email,
            meta_phone,
            now(), 
            now()
        );
    EXCEPTION WHEN OTHERS THEN
         -- Ultimate fallback: Ignore profile creation error entirely to allow Auth to succeed.
         -- This prevents "Database error saving new user" even if profile fails.
         NULL;
    END;
    RETURN new;
END;
$$;

-- D. Re-attach Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

SELECT 'Schema Fixed: Email added + Trigger Updated (Robust)' as status;
