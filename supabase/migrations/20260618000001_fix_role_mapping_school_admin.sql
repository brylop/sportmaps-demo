-- ============================================================
-- SPORTMAPS — Fix: school se creaba como athlete (mapeo de rol roto)
-- Causa raíz:
--   El catálogo public.roles usa el nombre 'school_admin' (NO 'admin').
--   handle_new_user y complete_role_selection mapeaban school -> 'admin' y
--   buscaban roles.name='admin' → NULL → caían al fallback que DEGRADA el
--   rol a 'athlete'. Resultado: registrarse como escuela creaba un atleta.
--   (Regresión introducida por 20260617000001/000002.)
--
-- Esta migración corrige AMBAS funciones:
--   1. Mapea school -> 'school_admin' (nombre real del catálogo).
--   2. Blindaje: NO se degrada el rol a athlete cuando el catálogo no tiene
--      el nombre; solo se usa athlete cuando de verdad no vino rol (OAuth).
--      Así ningún rol futuro vuelve a "perderse" por un desajuste de catálogo.
--   3. Aísla la auto-creación de escuela en un sub-bloque: si algo en la
--      cascada (schools/school_members/school_branches) falla, NO revierte el
--      perfil ni el rol.
-- Fecha: 2026-06-18
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  meta_role       text;
  normalized_role text;
  legacy_role     text;
  valid_role_id   uuid;
  new_school_id   uuid;
  school_name_val text;
  v_needs_role    boolean;
  v_dob           date;
BEGIN
  meta_role       := LOWER(TRIM(new.raw_user_meta_data->>'role'));
  school_name_val := new.raw_user_meta_data->>'school_name';

  -- Selección de rol diferida: true cuando no llega rol (signup OAuth/Google).
  v_needs_role := (meta_role IS NULL OR meta_role = '');

  -- Cast seguro de fecha (malformada → NULL, no aborta el signup).
  BEGIN
    v_dob := NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  -- Mapeo rol del front (enum legacy user_role) → nombre del catálogo roles.
  -- IMPORTANTE: el catálogo usa 'school_admin' para academias (NO 'admin').
  IF meta_role IN ('school', 'school_admin', 'admin') THEN
    normalized_role := 'school_admin';  legacy_role := 'school';
  ELSIF meta_role = 'super_admin' THEN
    normalized_role := 'super_admin';   legacy_role := 'admin';
  ELSIF meta_role IN ('padre', 'parent') THEN
    normalized_role := 'parent';        legacy_role := 'parent';
  ELSE
    normalized_role := meta_role;       legacy_role := meta_role;
  END IF;

  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;

  -- Solo se degrada a athlete cuando NO vino rol (OAuth). Si vino un rol válido
  -- pero el catálogo no lo tiene, se RESPETA el legacy_role (enum) y role_id
  -- queda NULL — nunca se convierte en athlete. (Fix del bug school→athlete.)
  IF legacy_role IS NULL OR legacy_role = '' THEN
    legacy_role := 'athlete';
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, role, role_id, email,
    avatar_url, phone, date_of_birth, invitation_code, needs_role_selection
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
    legacy_role::public.user_role,
    valid_role_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_user_meta_data->>'phone',
    v_dob,
    new.raw_user_meta_data->>'invitation_code',
    v_needs_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    phone            = COALESCE(EXCLUDED.phone, profiles.phone),
    date_of_birth    = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth),
    role             = EXCLUDED.role,
    role_id          = EXCLUDED.role_id,
    invitation_code  = COALESCE(EXCLUDED.invitation_code, profiles.invitation_code),
    updated_at       = now();
    -- needs_role_selection NO se toca en conflicto: respeta decisión previa.

  -- Auto-creación de escuela AISLADA: un fallo aquí (schools/school_members/
  -- school_branches) NUNCA revierte el perfil ni cambia el rol.
  IF legacy_role = 'school' AND school_name_val IS NOT NULL AND school_name_val <> '' THEN
    BEGIN
      INSERT INTO public.schools (name, owner_id, onboarding_status, onboarding_step)
      VALUES (school_name_val, new.id, 'in_progress', 2)
      ON CONFLICT DO NOTHING RETURNING id INTO new_school_id;

      IF new_school_id IS NOT NULL THEN
        INSERT INTO public.school_branches (school_id, name, is_main, status)
        VALUES (new_school_id, 'Sede Principal', true, 'active')
        ON CONFLICT DO NOTHING;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;  -- el perfil school ya quedó; la escuela se crea luego en onboarding
    END;
  END IF;

  RETURN new;

EXCEPTION WHEN others THEN
  -- RESILIENCIA: el alta en auth.users NO se rompe, y se PRESERVA el rol
  -- pretendido (no se degrada a athlete salvo que de verdad no haya rol).
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, role_id, email, needs_role_selection)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
      COALESCE(NULLIF(legacy_role, ''), 'athlete')::public.user_role,
      valid_role_id,
      new.email,
      COALESCE(v_needs_role, true)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    BEGIN
      INSERT INTO public.profiles (id, full_name, role, email, needs_role_selection)
      VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        'athlete'::public.user_role,
        new.email,
        true
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END;
  RETURN new;
END;
$function$;

-- Re-bind explícito del trigger.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── complete_role_selection: misma corrección (flujo Google) ────────────────
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

  IF meta_role NOT IN (
    'athlete','parent','coach','school',
    'wellness_professional','store_owner','personal_trainer','organizer'
  ) THEN
    RAISE EXCEPTION 'Rol no permitido: %', p_role;
  END IF;

  IF meta_role = 'school' THEN
    normalized_role := 'school_admin';  legacy_role := 'school';   -- FIX: era 'admin'
  ELSIF meta_role = 'parent' THEN
    normalized_role := 'parent';        legacy_role := 'parent';
  ELSE
    normalized_role := meta_role;       legacy_role := meta_role;
  END IF;

  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;
  -- No degradar el rol si el catálogo no lo tiene: se respeta legacy_role y
  -- role_id queda NULL (el rol elegido por el usuario manda).

  UPDATE public.profiles
     SET role = legacy_role::public.user_role,
         role_id = valid_role_id,
         needs_role_selection = false,
         updated_at = now()
   WHERE id = v_uid;

  RETURN jsonb_build_object('role', legacy_role, 'needs_role_selection', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_role_selection(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
