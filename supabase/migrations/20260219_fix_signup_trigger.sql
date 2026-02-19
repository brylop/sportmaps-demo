-- =============================================================================
-- FIX 4.0: Signup Trigger & Delete User (The Definitive Fix)
-- =============================================================================

-- 1. DELETE USER 'juligrios1999@gmail.com' (Clean start for testing)
BEGIN;
  DELETE FROM public.profiles WHERE email = 'juligrios1999@gmail.com';
  DELETE FROM auth.users WHERE email = 'juligrios1999@gmail.com';
COMMIT;

-- 2. FIX THE TRIGGER (With Role Mapping Logic)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meta_role text;
  normalized_role text; -- For DB Lookup (e.g. 'school_admin')
  legacy_role text;     -- For Frontend Compatibility (e.g. 'school')
  valid_role_id uuid;
BEGIN
  -- 1. Get role from metadata (trim whitespace and lowercase)
  meta_role := LOWER(TRIM(new.raw_user_meta_data->>'role'));

  -- 2. Normalize and Map Roles
  --    This prepares two values:
  --    a) normalized_role: To find the UUID in the 'roles' table.
  --    b) legacy_role: To store in the 'role' column for frontend compatibility.

  IF meta_role = 'school' THEN
    normalized_role := 'school_admin';
    legacy_role := 'school';
  ELSIF meta_role = 'admin' THEN
    normalized_role := 'super_admin';
    legacy_role := 'admin';
  ELSIF meta_role = 'padre' THEN
     normalized_role := 'parent';
     legacy_role := 'parent';
  ELSE
    -- Default case: 'athlete', 'coach', 'parent', etc. where names match
    normalized_role := meta_role;
    legacy_role := meta_role;
  END IF;

  -- 3. Look up the ID in the 'roles' table (Strict Match)
  IF normalized_role IS NOT NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;
  END IF;

  -- 4. VALIDATION
  IF valid_role_id IS NULL AND normalized_role IS NOT NULL THEN
     RAISE EXCEPTION 'Invalid Role: %. Allowed roles are: athlete, parent, coach, school, etc.', meta_role;
  END IF;

  -- 5. Fallback for completely missing role
  IF valid_role_id IS NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    legacy_role := 'athlete';
    
    IF valid_role_id IS NULL THEN
       RAISE EXCEPTION 'Critical Error: Default "athlete" role not found in database.';
    END IF;
  END IF;

  -- 6. Insert into profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    role,      -- Legacy string column (uses 'school', 'admin', etc.)
    role_id,   -- UUID FK (uses the ID of 'school_admin', 'super_admin', etc.)
    email,
    avatar_url,
    phone
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
    legacy_role, -- Saves 'school' so frontend works
    valid_role_id, -- Links to 'school_admin' role so RBAC works
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone'
  );

  RETURN new;
END;
$$;

-- Ensure trigger is bound
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
