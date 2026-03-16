-- ============================================================
-- SPORTMAPS - RESTAURACIÓN DE TRIGGERS Y RLS post-borrado masivo
-- Fecha: 2026-02-25
-- ============================================================

BEGIN;

-- 1. RESTAURAR HANDLE_NEW_USER (Triggers de Auth)
-- Esta es la versión definitiva del trigger de registro.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  meta_role text;
  normalized_role text;
  legacy_role text;
  valid_role_id uuid;
  new_school_id uuid;
  school_name_val text;
BEGIN
  -- A. Obtener datos de metadatos
  meta_role := LOWER(TRIM(new.raw_user_meta_data->>'role'));
  school_name_val := new.raw_user_meta_data->>'school_name';

  -- B. Normalizar y Mapear Roles
  IF meta_role = 'school' OR meta_role = 'admin' THEN
    normalized_role := 'admin';
    legacy_role := 'school';
  ELSIF meta_role = 'admin' OR meta_role = 'super_admin' THEN
    normalized_role := 'super_admin';
    legacy_role := 'admin';
  ELSIF meta_role = 'padre' OR meta_role = 'parent' THEN
     normalized_role := 'parent';
     legacy_role := 'parent';
  ELSE
    normalized_role := meta_role;
    legacy_role := meta_role;
  END IF;

  -- C. Buscar ID del rol
  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;

  -- Fallback a athlete si no se encuentra
  IF valid_role_id IS NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    legacy_role := 'athlete';
  END IF;

  -- D. Insertar en profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    role,      
    role_id,   
    email,
    avatar_url,
    phone,
    date_of_birth,
    invitation_code
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
    legacy_role::public.user_role,
    valid_role_id, 
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'date_of_birth')::date,
    new.raw_user_meta_data->>'invitation_code'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth),
    role = EXCLUDED.role,
    role_id = EXCLUDED.role_id,
    invitation_code = COALESCE(EXCLUDED.invitation_code, profiles.invitation_code),
    updated_at = now();

  -- E. Lógica de creación de escuela automática para roles de escuela
  IF legacy_role = 'school' AND school_name_val IS NOT NULL AND school_name_val <> '' THEN
    INSERT INTO public.schools (
      name,
      owner_id,
      onboarding_status,
      onboarding_step
    ) VALUES (
      school_name_val,
      new.id,
      'in_progress',
      2
    ) ON CONFLICT DO NOTHING RETURNING id INTO new_school_id;

    IF new_school_id IS NOT NULL THEN
        INSERT INTO public.school_branches (
          school_id,
          name,
          is_main,
          status
        ) VALUES (
          new_school_id,
          'Sede Principal',
          true,
          'active'
        ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$function$;

-- 2. RE-ACTIVAR TRIGGER EN AUTH.USERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. FORZAR ACTIVACIÓN DE RLS EN TABLAS CRÍTICAS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'schools', 'school_members', 'children', 'enrollments', 'payments', 
    'facilities', 'school_branches', 'teams', 'invitations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 4. RESTAURAR POLÍTICAS ESENCIALES (por si fueron eliminadas)
-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Schools (Select público)
DROP POLICY IF EXISTS "Public schools are viewable" ON public.schools;
CREATE POLICY "Public schools are viewable" ON public.schools FOR SELECT USING (true);

-- Restore sync triggers mentioned in reset (if needed, but using the new ones is better)
-- Nota: trg_sync_team_students ya existe según auditoría.

COMMIT;
