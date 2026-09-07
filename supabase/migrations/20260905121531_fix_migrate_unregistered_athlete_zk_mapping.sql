-- =============================================================================
-- 20260905121531_fix_migrate_unregistered_athlete_zk_mapping.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260905111458
-- Objetivo: bug real encontrado en vivo en Dreamers (Fabio Cardona → Fabio
-- Cardona Murcia, 2026-09-05 ~12:00): al adoptar una ficha precargada
-- (unregistered_athletes) a una cuenta real, migrate_unregistered_athlete_to_profile()
-- migra enrollments/attendance_records/session_bookings/payments/profiles, pero
-- NUNCA tocaba zk_user_mappings. El PIN de huella queda apuntando al
-- unregistered_athlete_id viejo (que se queda sin inscripción, porque la
-- inscripción real se migró al user_id nuevo) — el torniquete sigue resolviendo
-- la identidad vieja y access-adms.ts la rechaza con denial_reason='no_enrollment',
-- aunque la persona tenga plan activo y pago al día bajo su cuenta nueva.
--
-- Esta función NO estaba en el repo (drift — aplicada fuera de migraciones en
-- algún momento anterior). Esta migración la trae a control de versiones
-- completa (mismo cuerpo, `pg_get_functiondef` contra la base viva 2026-09-05)
-- + el fix.
--
-- Fix: agrega un UPDATE de zk_user_mappings, mismo condicional que ya usa la
-- función para enrollments/attendance_records/etc (solo cuando p_new_user_id
-- IS NOT NULL — zk_user_mappings no tiene columna child_id, así que el caso
-- p_new_child_id no aplica acá, un menor no tiene fila propia en esa tabla).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.migrate_unregistered_athlete_to_profile(p_unregistered_id uuid, p_new_user_id uuid DEFAULT NULL::uuid, p_new_child_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows_enrollments   int;
  v_rows_records       int;
  v_rows_bookings      int;
  v_rows_payments      int;
  v_rows_zk_mappings   int;
BEGIN
  IF p_new_user_id IS NULL AND p_new_child_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere p_new_user_id o p_new_child_id';
  END IF;

  -- ── Enrollments ──────────────────────────────────────────────────────────
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.enrollments
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.enrollments
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_enrollments = ROW_COUNT;

  -- ── Attendance records ───────────────────────────────────────────────────
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.attendance_records
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.attendance_records
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_records = ROW_COUNT;

  -- ── Session bookings ─────────────────────────────────────────────────────
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.session_bookings
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.session_bookings
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_bookings = ROW_COUNT;

  -- ── Payments ─────────────────────────────────────────────────────────────
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.payments
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.payments
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_payments = ROW_COUNT;

  -- ── Torniquete: zk_user_mappings (FIX 2026-09-05) ────────────────────────
  -- Sin esto, la huella del atleta sigue resolviendo al unregistered_athlete_id
  -- viejo (sin inscripción tras la migración de arriba) y access-adms.ts lo
  -- rechaza con 'no_enrollment' pese a tener plan activo bajo la cuenta nueva.
  -- zk_user_mappings no tiene columna child_id (un menor no tiene fila propia
  -- ahí) — el UPDATE solo aplica cuando migra a un adulto (p_new_user_id).
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.zk_user_mappings
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_zk_mappings = ROW_COUNT;

  -- ── Copiar campos de perfil al profiles (solo si migra a adulto) ─────────
  -- Usa COALESCE para no sobreescribir datos que el atleta ya ingresó
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.profiles pr
    SET
      date_of_birth = COALESCE(pr.date_of_birth, ua.date_of_birth),
      phone         = COALESCE(pr.phone,         ua.phone),
      updated_at    = now()
    FROM public.unregistered_athletes ua
    WHERE pr.id = p_new_user_id
      AND ua.id = p_unregistered_id
      AND (ua.date_of_birth IS NOT NULL OR ua.phone IS NOT NULL);
  END IF;

  -- ── Marcar como migrado ──────────────────────────────────────────────────
  UPDATE public.unregistered_athletes
  SET linked_profile_id = COALESCE(p_new_user_id, p_new_child_id),
      is_active         = false
  WHERE id = p_unregistered_id;

  RETURN jsonb_build_object(
    'unregistered_id',    p_unregistered_id,
    'migrated_to_user',   p_new_user_id,
    'migrated_to_child',  p_new_child_id,
    'enrollments',        v_rows_enrollments,
    'attendance_records', v_rows_records,
    'session_bookings',   v_rows_bookings,
    'payments',           v_rows_payments,
    'zk_user_mappings',   v_rows_zk_mappings
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) IS
  'Adopta una ficha precargada (unregistered_athletes) a una cuenta real, migrando '
  'enrollments/attendance_records/session_bookings/payments/zk_user_mappings y '
  'marcando linked_profile_id. Fix 2026-09-05: agrega zk_user_mappings (antes '
  'quedaba huérfana, apuntando al unregistered_athlete_id viejo sin inscripción — '
  'el torniquete rechazaba con no_enrollment a alguien con plan activo).';

-- ── Backfill: mapeos huérfanos de adopciones anteriores a este fix ─────────
-- Cualquier PIN que hoy apunte a un unregistered_athlete_id ya migrado
-- (linked_profile_id IS NOT NULL) quedó con el mismo problema que Fabio antes
-- de este fix — se repunta al perfil real.
UPDATE public.zk_user_mappings zm
SET user_id                 = ua.linked_profile_id,
    unregistered_athlete_id = NULL
FROM public.unregistered_athletes ua
WHERE zm.unregistered_athlete_id = ua.id
  AND ua.linked_profile_id IS NOT NULL
  AND zm.user_id IS NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
