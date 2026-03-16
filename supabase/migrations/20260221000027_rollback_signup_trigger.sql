-- =============================================================================
-- ROLLBACK 5.0: Restore Previous Signup Trigger Logic
-- Use this if the new trigger causes issues with user roles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role public.user_role := 'athlete';
  v_meta_role text;
BEGIN
  -- 1. Extract role from metadata
  v_meta_role := NEW.raw_user_meta_data ->> 'role';

  -- 2. Validate role against original enum values
  IF v_meta_role IS NOT NULL AND v_meta_role IN ('admin', 'owner', 'coach', 'parent', 'athlete', 'admin', 'store_owner') THEN
    v_role := v_meta_role::public.user_role;
  END IF;

  -- 3. Restore original insert block (Missing date_of_birth and phone)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
    
  RETURN NEW;
END;
$$;

-- Note: This rollback restores the 'role' as a string/enum but DOES NOT 
-- restore missing date_of_birth or phone as they weren't being captured before.
