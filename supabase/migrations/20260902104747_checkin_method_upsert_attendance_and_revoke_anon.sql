-- =============================================================================
-- 20260902104747_checkin_method_upsert_attendance_and_revoke_anon.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260901115207
--
-- Objetivo: habilitar `upsert_attendance_record` para que el puente
-- ZKTeco→asistencia (docs/specs/asistencia-rapida-checkin.md, Fase 2) pueda
-- marcar `check_in_method = 'turnstile'|'qr'` en vez de que TODO llegue como
-- 'manual' — hoy el INSERT del RPC ni siquiera setea la columna, cae al
-- DEFAULT sin importar quién llame.
--
-- De paso, cierra un hueco de seguridad real encontrado auditando esta misma
-- función para extenderla: es SECURITY DEFINER y tenía EXECUTE otorgado a
-- PUBLIC, anon Y authenticated — sin NINGÚN chequeo de autorización adentro.
-- Cualquiera con la anon key (pública, va en el bundle del frontend) podía
-- marcar presente/ausente a cualquier atleta de cualquier escuela llamando el
-- RPC directo por REST, sin pasar por el BFF ni por sus roles. La única vía
-- legítima es el BFF con service_role (`bff/src/routes/attendance.ts`,
-- `bff/src/routes/access-adms.ts`) — mismo patrón que `apply_late_fees()`:
-- GRANT solo a service_role, REVOKE del resto.
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

CREATE OR REPLACE FUNCTION public.upsert_attendance_record(
    p_school_id        uuid,
    p_session_id       uuid,
    p_attendance_date  date,
    p_status           text,
    p_team_id          uuid DEFAULT NULL,
    p_marked_by        uuid DEFAULT NULL,
    p_child_id         uuid DEFAULT NULL,
    p_user_id          uuid DEFAULT NULL,
    p_unregistered_id  uuid DEFAULT NULL,
    p_check_in_method  text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Siempre buscamos por session_id — permite múltiples bloques por día
  -- Para equipos: session_id + team_id + persona
  -- Para offerings: session_id + persona

  IF p_child_id IS NOT NULL THEN
    UPDATE attendance_records
      SET status = p_status, marked_by = p_marked_by, check_in_method = p_check_in_method
      WHERE child_id = p_child_id AND session_id = p_session_id
      RETURNING id INTO v_id;

  ELSIF p_user_id IS NOT NULL THEN
    UPDATE attendance_records
      SET status = p_status, marked_by = p_marked_by, check_in_method = p_check_in_method
      WHERE user_id = p_user_id AND session_id = p_session_id
      RETURNING id INTO v_id;

  ELSIF p_unregistered_id IS NOT NULL THEN
    UPDATE attendance_records
      SET status = p_status, marked_by = p_marked_by, check_in_method = p_check_in_method
      WHERE unregistered_athlete_id = p_unregistered_id AND session_id = p_session_id
      RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Se requiere child_id, user_id o unregistered_athlete_id';
  END IF;

  -- Si no actualizó nada, INSERT
  IF v_id IS NULL THEN
    INSERT INTO attendance_records (
      school_id, child_id, user_id, unregistered_athlete_id,
      team_id, session_id, attendance_date, status, marked_by, check_in_method
    ) VALUES (
      p_school_id, p_child_id, p_user_id, p_unregistered_id,
      p_team_id, p_session_id, p_attendance_date, p_status, p_marked_by, p_check_in_method
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_attendance_record(uuid, uuid, date, text, uuid, uuid, uuid, uuid, uuid, text) IS
  'Upsert de un registro de asistencia por session_id+atleta. p_check_in_method distingue manual/turnstile/qr (CHECK en attendance_records). Solo el BFF con service_role debe llamarla — no tiene chequeo de autorización propio.';

-- Cierra el hueco: solo service_role. El BFF (POST /session, /walk-in,
-- access-adms.ts) es el único llamador legítimo; ninguno de los tres corre
-- con la sesión del usuario final.
REVOKE ALL ON FUNCTION public.upsert_attendance_record(uuid, uuid, date, text, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_attendance_record(uuid, uuid, date, text, uuid, uuid, uuid, uuid, uuid, text) TO service_role;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Firma nueva con el parámetro y search_path correcto.
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'upsert_attendance_record';

-- 2. Grants: SOLO service_role debe quedar.
SELECT grantee, privilege_type
  FROM information_schema.role_routine_grants
 WHERE routine_name = 'upsert_attendance_record'
 ORDER BY grantee;
