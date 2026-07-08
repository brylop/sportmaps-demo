-- ============================================================
-- SPORTMAPS — Fix: "Sede Principal" duplicada al registrar escuela
--
-- CAUSA:
--   handle_new_user() (signup con school_name) inserta la escuela Y ADEMÁS
--   inserta explícitamente la "Sede Principal". Pero el INSERT en schools
--   dispara el trigger on_school_created -> handle_new_school(), que YA crea
--   school_settings + "Sede Principal" + membresía owner. Resultado: DOS
--   "Sede Principal" (no hay constraint único que lo evite).
--
-- FIX:
--   Redefinir handle_new_user() para que SOLO inserte la escuela. La creación
--   de sede/settings/membresía queda 100% en handle_new_school() (fuente única).
--   Mantiene idéntica el resto de la lógica (mapeo de rol, resiliencia, etc.).
--
-- Los registros duplicados existentes se limpian aparte (query manual revisada).
-- ============================================================

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

  v_needs_role := (meta_role IS NULL OR meta_role = '');

  BEGIN
    v_dob := NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

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

  -- Auto-creación de escuela AISLADA. NO se crea la sede aquí: el trigger
  -- on_school_created (handle_new_school) crea Sede Principal + settings +
  -- membresía owner. Insertarla aquí también duplicaba la "Sede Principal".
  IF legacy_role = 'school' AND school_name_val IS NOT NULL AND school_name_val <> '' THEN
    BEGIN
      INSERT INTO public.schools (name, owner_id, onboarding_status, onboarding_step)
      VALUES (school_name_val, new.id, 'in_progress', 2)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL;  -- el perfil school ya quedó; la escuela se crea luego en onboarding
    END;
  END IF;

  RETURN new;

EXCEPTION WHEN others THEN
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
