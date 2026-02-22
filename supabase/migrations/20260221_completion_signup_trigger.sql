-- DEFINITIVE FIX: handle_new_user trigger with ALL fields
-- This includes: date_of_birth, invitation_code, phone, role_id + school creation logic
-- Applied: 2026-02-22

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
  -- 1. Obtener datos de metadatos
  meta_role := LOWER(TRIM(new.raw_user_meta_data->>'role'));
  school_name_val := new.raw_user_meta_data->>'school_name';

  -- 2. Normalizar y Mapear Roles
  IF meta_role = 'school' OR meta_role = 'school_admin' THEN
    normalized_role := 'school_admin';
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

  -- 3. Buscar ID del rol
  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;

  -- Fallback a athlete si no se encuentra
  IF valid_role_id IS NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    legacy_role := 'athlete';
  END IF;

  -- 4. Insertar en profiles (con date_of_birth, invitation_code, ON CONFLICT)
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

  -- 5. Lógica de creación de escuela automática
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
    ) RETURNING id INTO new_school_id;

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
    );
  END IF;

  RETURN new;
END;
$function$;

-- DATA REPAIR: Backfill date_of_birth from auth.users metadata
UPDATE public.profiles p
SET date_of_birth = (u.raw_user_meta_data->>'date_of_birth')::date
FROM auth.users u
WHERE p.id = u.id 
  AND p.date_of_birth IS NULL 
  AND u.raw_user_meta_data->>'date_of_birth' IS NOT NULL;

-- DATA REPAIR: Backfill phone
UPDATE public.profiles p
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE p.id = u.id 
  AND p.phone IS NULL 
  AND u.raw_user_meta_data->>'phone' IS NOT NULL;
