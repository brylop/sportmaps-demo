-- ============================================================
-- SPORTMAPS — handle_new_user resiliente (snapshot canónico)
-- Propósito:
--   El trigger de signup NO tenía bloque EXCEPTION y casteaba
--   date_of_birth sin sanear → un dato malformado en raw_user_meta_data
--   (típico en OAuth/Google) abortaba el INSERT en auth.users y rompía
--   TODOS los registros (500). Aquí:
--     1. Cast seguro de fecha (malformada → NULL, no rompe).
--     2. EXCEPTION WHEN others con insert mínimo de fallback: el alta de
--        auth.users JAMÁS se rompe por un fallo en el perfil.
--     3. Re-bind explícito del trigger (garantiza binding tras 9 redefs).
--     4. Elimina la rama muerta del mapeo de roles ('admin' inalcanzable).
--   Mantiene 100% la lógica vigente de 20260617000001 (roles, OAuth
--   needs_role_selection, auto-creación de escuela).
-- Fecha: 2026-06-17
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

  -- Selección de rol diferida: true cuando no llega rol (signup OAuth).
  v_needs_role := (meta_role IS NULL OR meta_role = '');

  -- Cast seguro de fecha: si llega malformada (OAuth/cliente), NULL en vez
  -- de abortar todo el signup.
  BEGIN
    v_dob := NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  -- Mapeo de roles (sin la rama muerta 'admin' que nunca se alcanzaba)
  IF meta_role IN ('school', 'admin') THEN
    normalized_role := 'admin';        legacy_role := 'school';
  ELSIF meta_role = 'super_admin' THEN
    normalized_role := 'super_admin';  legacy_role := 'admin';
  ELSIF meta_role IN ('padre', 'parent') THEN
    normalized_role := 'parent';       legacy_role := 'parent';
  ELSE
    normalized_role := meta_role;      legacy_role := meta_role;
  END IF;

  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;

  -- Fallback a athlete si no se encuentra (incluye OAuth sin rol)
  IF valid_role_id IS NULL THEN
    SELECT id INTO valid_role_id FROM public.roles WHERE name = 'athlete' LIMIT 1;
    legacy_role := 'athlete';
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

  -- Auto-creación de escuela para rol school
  IF legacy_role = 'school' AND school_name_val IS NOT NULL AND school_name_val <> '' THEN
    INSERT INTO public.schools (name, owner_id, onboarding_status, onboarding_step)
    VALUES (school_name_val, new.id, 'in_progress', 2)
    ON CONFLICT DO NOTHING RETURNING id INTO new_school_id;

    IF new_school_id IS NOT NULL THEN
      INSERT INTO public.school_branches (school_id, name, is_main, status)
      VALUES (new_school_id, 'Sede Principal', true, 'active')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;

EXCEPTION WHEN others THEN
  -- RESILIENCIA: pase lo que pase, el alta en auth.users NO se rompe.
  -- Insert mínimo de fallback; el usuario completará/elegirá rol después.
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, email, needs_role_selection)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
      'athlete'::public.user_role,
      new.email,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    NULL;  -- ni el fallback debe abortar el signup
  END;
  RETURN new;
END;
$function$;

-- Re-bind explícito del trigger (garantiza binding tras múltiples redefiniciones)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
