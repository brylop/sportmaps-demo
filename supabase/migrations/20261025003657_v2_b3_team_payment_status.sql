-- =============================================================================
-- 20261025003657_v2_b3_team_payment_status.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025003647
-- Objetivo: B3 del contrato docs/specs/entrenador-deportista-v2.md (decisión 5):
--           el profe ve SOLO el estado de pago de cada deportista de un equipo
--           — Al día · Pendiente · Vencido —, sin montos ni conceptos.
--
--   team_payment_status(p_team_id uuid)
--     → subject_type, subject_id, athlete_key ('child:<uuid>' …), athlete_name, estado
--   estado:
--     'vencido'   algún cobro 'overdue', o abierto (pending/partial/rejected) con
--                 due_date anterior a hoy (hora Colombia)
--     'pendiente' algún cobro abierto (pending/partial/rejected) no vencido
--     'al_dia'    lo demás (pagado, anulado, en revisión 'awaiting_approval', o sin cobros)
--   'rejected' cuenta como abierto: el comprobante se rechazó y el cobro sigue
--   debiéndose. 'awaiting_approval' NO: la familia ya pagó y la escuela revisa.
--
--   Plantel = inscripciones del equipo en active/pending/paused + menores con
--   ese equipo en la ficha (children.team_id, activos) sin inscripción — el
--   mismo criterio de calendar_event_recipients. Cobros solo de la escuela del
--   equipo. Solo staff de esa escuela (user_staff_school_ids) o plataforma.
--
-- RADIO (base viva, 2026-10-25, solo lectura): función nueva de solo lectura.
--   165 equipos, 127 con inscritos. Ninguna tabla, policy ni función existente cambia.
--
-- VERIFICACIÓN: ver el informe del agente (sesión simulada, BEGIN … ROLLBACK).
--   select proname, proacl from pg_proc where proname = 'team_payment_status';
--
-- REVERSA:
--   DROP FUNCTION IF EXISTS public.team_payment_status(uuid);
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

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.team_payment_status(p_team_id uuid)
RETURNS TABLE (
  subject_type text,
  subject_id   uuid,
  athlete_key  text,
  athlete_name text,
  estado       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school uuid;
  v_hoy    date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT t.school_id INTO v_school FROM public.teams t WHERE t.id = p_team_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Equipo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH plantel AS (
    SELECT DISTINCT
           CASE WHEN e.child_id IS NOT NULL THEN 'child'
                WHEN e.user_id  IS NOT NULL THEN 'profile'
                ELSE 'unregistered' END                                   AS st,
           COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)     AS sid
      FROM public.enrollments e
     WHERE e.team_id = p_team_id
       AND e.status IN ('active', 'pending', 'paused')
       AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
    UNION
    SELECT 'child', c.id
      FROM public.children c
     WHERE c.team_id = p_team_id AND c.is_active
  ),
  cobros AS (
    SELECT pl.st, pl.sid,
           bool_or(p.status = 'overdue'
                   OR (p.status IN ('pending', 'partial', 'rejected') AND p.due_date < v_hoy)) AS vencido,
           bool_or(p.status IN ('pending', 'partial', 'rejected'))                            AS abierto
      FROM plantel pl
      JOIN public.payments p
        ON p.school_id = v_school
       AND (   (pl.st = 'child'        AND p.child_id = pl.sid)
            OR (pl.st = 'profile'      AND p.user_id = pl.sid AND p.child_id IS NULL AND p.unregistered_athlete_id IS NULL)
            OR (pl.st = 'unregistered' AND p.unregistered_athlete_id = pl.sid))
     WHERE p.status IN ('overdue', 'pending', 'partial', 'rejected')
     GROUP BY pl.st, pl.sid
  )
  SELECT pl.st,
         pl.sid,
         pl.st || ':' || pl.sid,
         COALESCE(c.full_name, pr.full_name, ua.full_name, 'Deportista')::text,
         CASE WHEN COALESCE(cb.vencido, false) THEN 'vencido'
              WHEN COALESCE(cb.abierto, false) THEN 'pendiente'
              ELSE 'al_dia' END
    FROM plantel pl
    LEFT JOIN cobros cb                       ON cb.st = pl.st AND cb.sid = pl.sid
    LEFT JOIN public.children c               ON pl.st = 'child'        AND c.id  = pl.sid
    LEFT JOIN public.profiles pr              ON pl.st = 'profile'      AND pr.id = pl.sid
    LEFT JOIN public.unregistered_athletes ua ON pl.st = 'unregistered' AND ua.id = pl.sid
   ORDER BY 4;
END;
$$;
COMMENT ON FUNCTION public.team_payment_status(uuid) IS
  'B3 V2: estado de pago por deportista de un equipo (al_dia | pendiente | vencido), '
  'SIN montos ni conceptos. Solo staff de la escuela del equipo.';

REVOKE ALL ON FUNCTION public.team_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_payment_status(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
