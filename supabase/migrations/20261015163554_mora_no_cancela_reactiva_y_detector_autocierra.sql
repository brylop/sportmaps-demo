-- =============================================================================
-- 20261014130128_mora_no_cancela_reactiva_y_detector_autocierra.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125527
-- Objetivo: la mora NO cancela inscripciones. Revertir lo que el cron ya
--   canceló y dejar el panel «Integridad de inscripciones» limpio.
-- =============================================================================
-- Contexto (panel super-admin, 158 hallazgos abiertos el 2026-10-14):
--   fn_expire_overdue_enrollments (pg_cron, 03:00 Bogotá) cancelaba la
--   inscripción vencida (expires_at + grace + 7) y el trigger
--   fn_cancel_payments_on_enrollment_cancel anulaba sus cobros pendientes.
--   El atleta seguía activo y entrenando, pero ya no se le cobraba nada:
--   Besser perdió 18 inscripciones el 2026-10-10 (~$4,6 M/mes).
--
-- DECISIÓN DE PRODUCTO (2026-10-14) — reemplaza la D1 del 2026-09-02:
--   la mora NUNCA cancela. El vencido sigue activo con su cobro vivo y, si la
--   escuela tiene late_fee_enabled, apply_late_fees le suma el recargo.
--   Cancelar es una decisión humana de la escuela.
--
-- 1. auto_cancel_overdue_enabled = false en todas las escuelas y como default;
--    fn_expire_overdue_enrollments queda SOLO para despausar.
-- 2. Se revierten las cancelaciones del cron desde 2026-09-02 cuyo atleta
--    sigue activo y sin otra inscripción viva (sin escuelas is_demo): la
--    inscripción vuelve a 'active' y cada cobro que anuló el trigger en esa
--    misma transacción (mismo updated_at) vuelve a su estado anterior según
--    payment_audit_logs. Medido: Besser 18 / Dynasty 2 / GYM RM 3; 37 cobros.
-- 3. detect_enrollment_integrity_issues ignora escuelas is_demo y cierra solo
--    los hallazgos abiertos que ya no se cumplen.
-- 4. Se borran los hallazgos (NO los atletas) de escuelas de prueba.
-- =============================================================================

BEGIN;

-- 1. La mora no cancela --------------------------------------------------------
ALTER TABLE public.school_settings
    ALTER COLUMN auto_cancel_overdue_enabled SET DEFAULT false;

UPDATE public.school_settings
   SET auto_cancel_overdue_enabled = false,
       updated_at = now()
 WHERE auto_cancel_overdue_enabled IS DISTINCT FROM false;

-- La mora NUNCA cancela. Lo único que hace la mora es el recargo de
-- apply_late_fees() si la escuela tiene late_fee_enabled. Esta función queda
-- solo para despausar: las pausas de vacaciones que ya terminaron.
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_despausadas integer;
  v_today_col   date;
BEGIN
  v_today_col := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;

  UPDATE enrollments e
  SET paused_reason    = NULL,
      paused_at        = NULL,
      paused_until     = NULL,
      paused_by        = NULL,
      pause_request_id = NULL,
      updated_at       = now()
  WHERE e.paused_reason IS NOT NULL
    AND e.paused_until IS NOT NULL
    AND (e.paused_until AT TIME ZONE 'America/Bogota')::date <= v_today_col;

  GET DIAGNOSTICS v_despausadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',     true,
    'expired',     0,
    'despausadas', v_despausadas,
    'ran_at',      now(),
    'date_used',   v_today_col
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_expire_overdue_enrollments() IS
  'Solo despausa inscripciones cuya pausa terminó. NO cancela por mora (decisión 2026-10-14): la mora solo suma recargo vía apply_late_fees().';

-- 2. Revertir lo que el cron canceló ------------------------------------------
-- Un solo statement: ambos UPDATE ven la misma foto, así el match de cobros por
-- updated_at ocurre antes de que reactivar la inscripción lo cambie.
WITH ce AS (
    SELECT e.id, e.school_id, e.updated_at,
           COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS athlete_id
    FROM public.enrollments e
    JOIN public.schools s ON s.id = e.school_id
    WHERE e.status = 'cancelled'
      AND e.updated_at >= '2026-09-02'
      AND to_char(e.updated_at AT TIME ZONE 'America/Bogota', 'HH24:MI') = '03:00'
      AND NOT COALESCE(s.is_demo, false)
      AND EXISTS (
          SELECT 1 FROM public.school_athletes sa
          WHERE sa.school_id = e.school_id
            AND sa.id = COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)
            AND sa.is_active
            AND sa.enrollment_id IS NULL)
      AND NOT EXISTS (
          SELECT 1 FROM public.enrollments e2
          WHERE e2.school_id = e.school_id
            AND e2.id <> e.id
            AND e2.status IN ('active', 'pending')
            AND COALESCE(e2.child_id, e2.user_id, e2.unregistered_athlete_id)
              = COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
), cobros AS (
    SELECT p.id,
           (SELECT l.old_status FROM public.payment_audit_logs l
             WHERE l.payment_id = p.id AND l.new_status = 'cancelled'
             LIMIT 1) AS old_status,
           p.amount_paid
    FROM ce
    JOIN public.payments p
      ON p.school_id = ce.school_id
     AND p.status = 'cancelled'
     AND p.updated_at = ce.updated_at
     AND COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id) = ce.athlete_id
), rp AS (
    UPDATE public.payments p
       SET status = COALESCE(c.old_status,
                             CASE WHEN COALESCE(c.amount_paid, 0) > 0 THEN 'partial' ELSE 'pending' END)
      FROM cobros c
     WHERE p.id = c.id
    RETURNING p.id
), re AS (
    UPDATE public.enrollments e
       SET status = 'active'
      FROM ce
     WHERE e.id = ce.id
    RETURNING e.id
)
SELECT (SELECT count(*) FROM re) AS inscripciones_reactivadas,
       (SELECT count(*) FROM rp) AS cobros_restaurados;

-- 3. Detector: sin escuelas demo y con auto-cierre ----------------------------
CREATE OR REPLACE FUNCTION public.detect_enrollment_integrity_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_row record;
    v_last record;
    v_was_insert boolean;
    v_new_count integer := 0;
    v_auto_closed integer := 0;
    v_run_at timestamptz := clock_timestamp();
BEGIN
    FOR v_row IN
        SELECT sa.school_id, sa.id AS athlete_id, sa.full_name,
               CASE sa.athlete_type
                   WHEN 'child' THEN 'child_id'
                   WHEN 'adult' THEN 'user_id'
                   ELSE 'unregistered_athlete_id'
               END AS athlete_col
        FROM public.school_athletes sa
        JOIN public.schools s ON s.id = sa.school_id
        WHERE sa.is_active = true
          AND sa.enrollment_id IS NULL
          AND sa.school_id IS NOT NULL
          -- Escuelas de prueba/demo: ruido, no hay a quién cobrarle.
          AND NOT COALESCE(s.is_demo, false)
    LOOP
        SELECT t.name AS team_name, op.name AS plan_name, e.monthly_fee, e.status
        INTO v_last
        FROM public.enrollments e
        LEFT JOIN public.teams t ON t.id = e.team_id
        LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
        WHERE (v_row.athlete_col = 'child_id' AND e.child_id = v_row.athlete_id)
           OR (v_row.athlete_col = 'user_id' AND e.user_id = v_row.athlete_id)
           OR (v_row.athlete_col = 'unregistered_athlete_id' AND e.unregistered_athlete_id = v_row.athlete_id)
        ORDER BY e.updated_at DESC LIMIT 1;

        INSERT INTO public.enrollment_integrity_findings AS f (
            school_id, athlete_col, athlete_id, athlete_name,
            last_team_name, last_plan_name, last_monthly_fee, last_enrollment_status,
            last_seen_at
        ) VALUES (
            v_row.school_id, v_row.athlete_col, v_row.athlete_id, v_row.full_name,
            v_last.team_name, v_last.plan_name, v_last.monthly_fee, v_last.status,
            v_run_at
        )
        ON CONFLICT (school_id, athlete_col, athlete_id) DO UPDATE
        SET last_seen_at = v_run_at,
            athlete_name = EXCLUDED.athlete_name,
            last_team_name = EXCLUDED.last_team_name,
            last_plan_name = EXCLUDED.last_plan_name,
            last_monthly_fee = EXCLUDED.last_monthly_fee,
            last_enrollment_status = EXCLUDED.last_enrollment_status,
            -- 'ignored' es decisión humana: no se pisa. 'resolved' que reaparece se reabre.
            status = CASE WHEN f.status = 'resolved' THEN 'open' ELSE f.status END,
            resolved_by = CASE WHEN f.status = 'resolved' THEN NULL ELSE f.resolved_by END,
            resolved_at = CASE WHEN f.status = 'resolved' THEN NULL ELSE f.resolved_at END,
            resolution_note = CASE WHEN f.status = 'resolved' THEN NULL ELSE f.resolution_note END
        RETURNING (xmax = 0) INTO v_was_insert;

        IF v_was_insert THEN
            v_new_count := v_new_count + 1;
        END IF;
    END LOOP;

    -- Auto-cierre: lo abierto que esta corrida no volvió a ver ya no se cumple.
    UPDATE public.enrollment_integrity_findings
       SET status = 'resolved',
           resolved_at = now(),
           resolution_note = 'Auto: el atleta ya tiene inscripción activa o dejó de estar activo.'
     WHERE status = 'open'
       AND last_seen_at < v_run_at;
    GET DIAGNOSTICS v_auto_closed = ROW_COUNT;

    RETURN jsonb_build_object(
        'checked_at', now(),
        'new_findings', v_new_count,
        'auto_closed', v_auto_closed,
        'open_findings', (SELECT count(*) FROM public.enrollment_integrity_findings WHERE status = 'open')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_enrollment_integrity_issues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_enrollment_integrity_issues() TO service_role;

-- 4. Hallazgos de escuelas de prueba: se borra solo el hallazgo ----------------
DELETE FROM public.enrollment_integrity_findings f
 USING public.schools s
 WHERE s.id = f.school_id
   AND (COALESCE(s.is_demo, false)
        OR s.name IN ('Pruebas 15', 'pruebas demo', 'pruebas 12', 'Escuela pruebas 12')
        OR f.athlete_name = 'PRUEBA QA - NO BORRAR NOMBRE');

-- 5. Refrescar el panel --------------------------------------------------------
SELECT public.detect_enrollment_integrity_issues();

COMMIT;
