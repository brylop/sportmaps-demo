-- Migration to fix auth trigger and ensure profiles table exists
-- Timestamp: 20260209170000

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure user_role type exists along with all values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'athlete', 'parent', 'coach', 'school', 'wellness_professional', 'store_owner', 'admin'
        );
    ELSE
        -- Attempt to add missing values if any (Postgres doesn't support IF NOT EXISTS for enum values easily, catch errors)
        BEGIN ALTER TYPE public.user_role ADD VALUE 'athlete'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'parent'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'coach'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'school'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'wellness_professional'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'store_owner'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE 'admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;

-- 3. Ensure other enums exist (from previous migrations)
DO $$ BEGIN
    CREATE TYPE public.subscription_tier AS ENUM ('free', 'basic', 'premium', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'athlete',
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  date_of_birth DATE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  sportmaps_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Enable RLS on profiles if not already
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Recreate Policies (idempotent)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    
    CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
END $$;

-- 7. Robust handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
  v_role user_role;
BEGIN
  -- Extract role from metadata, default to athlete if missing
  role_text := NULLIF(NEW.raw_user_meta_data->>'role', '');
  
  -- Validate and cast role
  IF role_text IS NOT NULL AND role_text = ANY (ARRAY['athlete','parent','coach','school','wellness_professional','store_owner','admin']) THEN
    v_role := role_text::user_role;
  ELSE
    v_role := 'athlete'::user_role;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error (visible in Supabase logs)
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  -- Return NEW anyway to allow user creation to succeed (profile might be missing, but user exists)
  RETURN NEW; 
END;
$$;

-- 8. Recreate Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. Seed Demo Data (Safe Insert)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user exists by email
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'academia.elite@sportmaps-demo.com') THEN
    
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      uuid_generate_v4(),
      'authenticated',
      'authenticated',
      'academia.elite@sportmaps-demo.com',
      crypt('SportMapsDemo2025!', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Spirit All Stars","role":"school"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Created demo user: academia.elite@sportmaps-demo.com';
  ELSE
    RAISE NOTICE 'Demo user already exists: academia.elite@sportmaps-demo.com';
  END IF;
END $$;

