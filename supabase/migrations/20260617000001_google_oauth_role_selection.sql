-- ============================================================
-- SPORTMAPS — Login social (Google OAuth) + selección de rol diferida
-- Propósito:
--   Los usuarios que entran por un proveedor OAuth (Google) NO traen
--   `role` en raw_user_meta_data. El trigger handle_new_user los caía a
--   'athlete' por defecto, impidiendo distinguir "eligió athlete" de
--   "nunca eligió rol". Aquí marcamos esos perfiles con
--   needs_role_selection=true para forzar la pantalla de selección de rol,
--   y añadimos un RPC para que el propio usuario fije su rol.
-- Fecha: 2026-06-17
-- ============================================================

BEGIN;

-- 1. Columna bandera (idempotente). Default false => signups por formulario
--    (que SIEMPRE traen rol) quedan en false y no ven la pantalla.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS needs_role_selection boolean NOT NULL DEFAULT false;

-- 2. Redefinir handle_new_user preservando la lógica existente y añadiendo
--    la marca needs_role_selection cuando el signup no trae rol (OAuth).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  meta_role text;
  normalized_role text;
  legacy_role text;
  valid_role_id uuid;
  new_school_id uuid;
  school_name_val text;
  v_needs_role boolean;
BEGIN
  -- A. Obtener datos de metadatos
  meta_role := LOWER(TRIM(new.raw_user_meta_data->>'role'));
  school_name_val := new.raw_user_meta_data->>'school_name';

  -- Marca de selección diferida: true cuando no llega rol (signup OAuth).
  v_needs_role := (meta_role IS NULL OR meta_role = '');

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

  -- Fallback a athlete si no se encuentra (incluye el caso OAuth sin rol)
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
    invitation_code,
    needs_role_selection
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
    legacy_role::public.user_role,
    valid_role_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'date_of_birth')::date,
    new.raw_user_meta_data->>'invitation_code',
    v_needs_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth),
    role = EXCLUDED.role,
    role_id = EXCLUDED.role_id,
    invitation_code = COALESCE(EXCLUDED.invitation_code, profiles.invitation_code),
    updated_at = now();
    -- NOTA: needs_role_selection NO se toca en conflicto: respeta la
    -- decisión ya tomada por un usuario existente.

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

-- 3. RPC: el usuario fija su propio rol tras un login OAuth.
--    Espeja la normalización de handle_new_user para mantener consistencia
--    entre profiles.role (enum legacy) y profiles.role_id (tabla roles).
CREATE OR REPLACE FUNCTION public.complete_role_selection(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  meta_role text := LOWER(TRIM(p_role));
  normalized_role text;
  legacy_role text;
  valid_role_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Sólo roles auto-asignables por el usuario (nunca admin/super_admin/reporter).
  IF meta_role NOT IN (
    'athlete','parent','coach','school',
    'wellness_professional','store_owner','personal_trainer','organizer'
  ) THEN
    RAISE EXCEPTION 'Rol no permitido: %', p_role;
  END IF;

  IF meta_role = 'school' THEN
    normalized_role := 'admin';  legacy_role := 'school';
  ELSIF meta_role = 'parent' THEN
    normalized_role := 'parent'; legacy_role := 'parent';
  ELSE
    normalized_role := meta_role; legacy_role := meta_role;
  END IF;

  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;
  IF valid_role_id IS NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    legacy_role := 'athlete';
  END IF;

  UPDATE public.profiles
     SET role = legacy_role::public.user_role,
         role_id = valid_role_id,
         needs_role_selection = false,
         updated_at = now()
   WHERE id = v_uid;

  RETURN jsonb_build_object('role', legacy_role, 'needs_role_selection', false);
END;
$function$;

-- SECURITY DEFINER no exime al caller de EXECUTE: hay que otorgarlo.
GRANT EXECUTE ON FUNCTION public.complete_role_selection(text) TO authenticated;

COMMIT;
