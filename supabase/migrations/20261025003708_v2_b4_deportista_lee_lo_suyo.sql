-- =============================================================================
-- 20261025003708_v2_b4_deportista_lee_lo_suyo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025003657
-- Objetivo: B4 del contrato docs/specs/entrenador-deportista-v2.md (decisión 9):
--           el deportista con cuenta lee SUS informes publicados por las mismas
--           lecturas que usa el acudiente.
--
-- Qué faltaba (medido): el caso subject_type='profile' YA estaba cubierto por
-- athlete_reports_select_family (subject_id = auth.uid()) y mark_report_viewed.
-- El hueco es el deportista con FICHA (subject_type='unregistered') vinculada a
-- su cuenta por unregistered_athletes.linked_profile_id — el caso común en las
-- escuelas que cargan por ficha (Monster, Besser): 75 fichas vinculadas en 11
-- escuelas, 3 informes publicados que hoy su dueño NO puede abrir.
--
--   1. Policy NUEVA athlete_reports_select_linked_athlete (SELECT, publicado,
--      ficha vinculada a mí). No se toca athlete_reports_select_family.
--   2. mark_report_viewed: misma función (cuerpo vivo verificado = repo
--      20260801093452) + la rama de la ficha vinculada.
--   3. performance_entries: policy NUEVA de SELECT para la ficha vinculada, con
--      la misma regla de partido que la familia (publicado y compartido). Es lo
--      que lee «Progreso» del deportista V2.
--   4. attendance_records: policy NUEVA de SELECT para la ficha vinculada (la
--      racha, decisión 7, se cuenta de attendance_records). El adulto con
--      user_id ya tenía atleta_ve_su_propia_asistencia.
--   Las policies usan my_linked_unregistered_ids() envuelto en (SELECT …)
--   (20261025003634, SECURITY DEFINER; se evalúa una vez por consulta): sin
--   self-recursion, ninguna policy lee su propia tabla.
--
-- «Informe del entreno» (informe grupal post-entrenamiento): no es RLS, lo arma
-- el BFF (GET /school/reports/team/:teamId/preview-for-parent). Se amplió en el
-- BFF para que el deportista lo pida para sí mismo (sin child_id).
--
-- RADIO (base viva, 2026-10-25, solo lectura):
--   · athlete_reports: +3 filas visibles (publicadas de fichas vinculadas); los
--     borradores siguen invisibles (la policy exige 'publicado').
--   · performance_entries: hasta 95 filas de fichas vinculadas pasan a ser
--     legibles por SU dueño (y solo por él).
--   · attendance_records: 6 filas, idem.
--   · Las policies son PERMISIVAS: solo suman lectura a la cuenta vinculada; no
--     quitan nada a nadie. Ninguna de escritura.
--
-- VERIFICACIÓN: ver el informe del agente (sesión simulada, BEGIN … ROLLBACK).
--   select tablename, policyname, cmd, roles, qual from pg_policies
--    where policyname in ('athlete_reports_select_linked_athlete',
--                         'performance_entries_select_linked_athlete',
--                         'attendance_records_select_linked_athlete');
--
-- REVERSA:
--   DROP POLICY IF EXISTS athlete_reports_select_linked_athlete     ON public.athlete_reports;
--   DROP POLICY IF EXISTS performance_entries_select_linked_athlete ON public.performance_entries;
--   DROP POLICY IF EXISTS attendance_records_select_linked_athlete  ON public.attendance_records;
--   mark_report_viewed: re-crear el cuerpo de 20260801093452 (§2) tal cual.
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

-- Por si B1 no se aplicó antes: mismo helper, mismo cuerpo (idempotente).
CREATE OR REPLACE FUNCTION public.is_linked_unregistered_athlete(p_unregistered_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unregistered_athletes ua
     WHERE ua.id = p_unregistered_id
       AND ua.linked_profile_id IS NOT NULL
       AND ua.linked_profile_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_linked_unregistered_athlete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_linked_unregistered_athlete(uuid) TO authenticated;

-- Variante en arreglo para policies: se envuelve en (SELECT …) y se evalúa una
-- vez por consulta, no una vez por fila.
CREATE OR REPLACE FUNCTION public.my_linked_unregistered_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    SELECT ua.id FROM public.unregistered_athletes ua
     WHERE ua.linked_profile_id IS NOT NULL
       AND ua.linked_profile_id = auth.uid()
  ), '{}'::uuid[]);
$$;
REVOKE ALL ON FUNCTION public.my_linked_unregistered_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_linked_unregistered_ids() TO authenticated;

-- ─── 1. athlete_reports ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS athlete_reports_select_linked_athlete ON public.athlete_reports;
CREATE POLICY athlete_reports_select_linked_athlete
  ON public.athlete_reports
  FOR SELECT
  TO authenticated
  USING (
    status = 'publicado'
    AND subject_type = 'unregistered'
    AND subject_id = ANY ((SELECT public.my_linked_unregistered_ids())::uuid[])
  );

-- ─── 2. mark_report_viewed (+ ficha vinculada) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_report_viewed(p_report_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_subject_type text;
    v_subject_id   uuid;
    v_recipient    uuid;
    v_status       text;
    v_viewed       timestamptz;
BEGIN
    SELECT ar.subject_type, ar.subject_id, ar.recipient_id, ar.status
      INTO v_subject_type, v_subject_id, v_recipient, v_status
      FROM public.athlete_reports ar
     WHERE ar.id = p_report_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El informe no existe.' USING ERRCODE = 'P0002';
    END IF;

    -- Cuatro formas legítimas de ser «el destinatario»: el acudiente resuelto,
    -- el acudiente del menor, el atleta adulto (su propio sujeto) y — B4 V2 —
    -- la cuenta vinculada a la ficha del deportista. Coach y admin NO cuentan.
    IF NOT (
           (v_recipient IS NOT NULL AND v_recipient = auth.uid())
        OR (v_subject_type = 'child'        AND public.is_parent_of_child(v_subject_id))
        OR (v_subject_type = 'profile'      AND v_subject_id = auth.uid())
        OR (v_subject_type = 'unregistered' AND public.is_linked_unregistered_athlete(v_subject_id))
    ) THEN
        RAISE EXCEPTION 'Este informe no es tuyo.' USING ERRCODE = '42501';
    END IF;

    IF v_status <> 'publicado' THEN
        RETURN NULL;
    END IF;

    UPDATE public.athlete_reports
       SET viewed_at  = COALESCE(viewed_at, now()),
           view_count = view_count + 1,
           updated_at = now()
     WHERE id = p_report_id
    RETURNING viewed_at INTO v_viewed;

    RETURN v_viewed;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_report_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_report_viewed(uuid) TO authenticated;

-- ─── 3. performance_entries ─────────────────────────────────────────────────
DROP POLICY IF EXISTS performance_entries_select_linked_athlete ON public.performance_entries;
CREATE POLICY performance_entries_select_linked_athlete
  ON public.performance_entries
  FOR SELECT
  TO authenticated
  USING (
    subject_type = 'unregistered'
    AND subject_id = ANY ((SELECT public.my_linked_unregistered_ids())::uuid[])
    AND (context_type <> 'competition' OR public.match_evaluation_visible_to_family(context_id))
  );

-- ─── 4. attendance_records ──────────────────────────────────────────────────
DROP POLICY IF EXISTS attendance_records_select_linked_athlete ON public.attendance_records;
CREATE POLICY attendance_records_select_linked_athlete
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    unregistered_athlete_id IS NOT NULL
    AND unregistered_athlete_id = ANY ((SELECT public.my_linked_unregistered_ids())::uuid[])
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
