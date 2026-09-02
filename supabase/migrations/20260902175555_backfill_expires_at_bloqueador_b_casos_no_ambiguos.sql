-- =============================================================================
-- 20260902175555_backfill_expires_at_bloqueador_b_casos_no_ambiguos.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902174423
-- Objetivo: Fase 1 de docs/specs/vigencia-cobranza-y-sesiones-unificado.md §3.2
-- (Bloqueador B) — corrección puntual de expires_at para las inscripciones ya
-- afectadas por el trigger ciego (antes de la migración 20260902174423).
--
-- Alcance: SOLO los casos NO ambiguos — atleta con exactamente UNA inscripción
-- con offering_plan_id en esa escuela. Se replican, en orden cronológico, los
-- pagos 'paid' reales de ese atleta+escuela (con o sin offering_plan_id) con
-- la MISMA fórmula que usa fn_extend_enrollment_on_payment_paid()
-- (GREATEST(expires_at_previo, fecha_del_pago) + duration_days), arrancando
-- desde NULL — igual que si el trigger hubiera disparado en su momento.
--
-- Deliberadamente FUERA de alcance: 63 inscripciones donde el atleta tiene
-- 2+ planes activos en la misma escuela. Un pago histórico sin
-- offering_plan_id no se puede atribuir con certeza a cuál de los dos
-- pertenece — adivinar ahí es peor que dejarlo desactualizado. Quedan
-- documentadas en el spec para revisión manual, no se tocan acá.
--
-- Verificado antes de aplicar (SELECT de conteo, sin UPDATE): 72 filas
-- califican, 61 cambian de valor (11 recalculan al mismo valor que ya tenían
-- — su pago ciego quedó cubierto por un pago posterior que sí disparó bien).
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

WITH RECURSIVE per_athlete AS (
  SELECT school_id,
         coalesce(child_id::text, unregistered_athlete_id::text, user_id::text) as athlete_key,
         count(*) as n_plan_enrollments
  FROM enrollments
  WHERE offering_plan_id IS NOT NULL AND status IN ('active','cancelled')
  GROUP BY 1,2
),
targets AS (
  SELECT
    e.id as enrollment_id, e.school_id, e.offering_plan_id,
    e.child_id, e.user_id, e.unregistered_athlete_id, e.status,
    coalesce(e.child_id::text, e.unregistered_athlete_id::text, e.user_id::text) as athlete_key,
    COALESCE(op.duration_days, 30) as duration_days,
    e.expires_at as current_expires_at,
    ARRAY(
      SELECT coalesce(p.payment_date, p.created_at::date)
      FROM payments p
      WHERE p.status='paid' AND p.school_id = e.school_id
        AND (p.offering_plan_id IS NULL OR p.offering_plan_id = e.offering_plan_id)
        AND (
          (e.child_id IS NOT NULL AND p.child_id = e.child_id)
          OR (e.unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = e.unregistered_athlete_id)
          OR (e.child_id IS NULL AND e.unregistered_athlete_id IS NULL AND p.child_id IS NULL AND p.unregistered_athlete_id IS NULL AND e.user_id IN (p.user_id, p.parent_id))
        )
      ORDER BY coalesce(p.payment_date, p.created_at::date) ASC
    ) as payment_dates
  FROM enrollments e
  LEFT JOIN offering_plans op ON op.id = e.offering_plan_id
  WHERE e.offering_plan_id IS NOT NULL AND e.status IN ('active','cancelled')
),
affected AS (
  SELECT t.* FROM targets t
  JOIN per_athlete pa ON pa.school_id = t.school_id AND pa.athlete_key = t.athlete_key
  WHERE pa.n_plan_enrollments = 1
    AND EXISTS (
      SELECT 1 FROM payments p2
      WHERE p2.status='paid' AND p2.offering_plan_id IS NULL AND p2.school_id = t.school_id
        AND (
          (t.child_id IS NOT NULL AND p2.child_id = t.child_id)
          OR (t.unregistered_athlete_id IS NOT NULL AND p2.unregistered_athlete_id = t.unregistered_athlete_id)
          OR (t.child_id IS NULL AND t.unregistered_athlete_id IS NULL AND p2.child_id IS NULL AND p2.unregistered_athlete_id IS NULL AND t.user_id IN (p2.user_id, p2.parent_id))
        )
    )
),
replay AS (
  SELECT enrollment_id, current_expires_at, duration_days, payment_dates, status,
         1 as idx,
         (payment_dates[1] + duration_days) as running_expires
  FROM affected
  UNION ALL
  SELECT r.enrollment_id, r.current_expires_at, r.duration_days, r.payment_dates, r.status,
         r.idx + 1,
         (GREATEST(r.running_expires, r.payment_dates[r.idx+1]) + r.duration_days)
  FROM replay r
  WHERE r.idx < array_length(r.payment_dates,1)
),
final AS (
  SELECT enrollment_id, new_expires_at FROM (
    SELECT enrollment_id, running_expires as new_expires_at,
           row_number() OVER (PARTITION BY enrollment_id ORDER BY idx DESC) as rn
    FROM replay
  ) x WHERE rn = 1
)
UPDATE public.enrollments e
SET expires_at = f.new_expires_at,
    updated_at = now()
FROM final f
WHERE e.id = f.enrollment_id
  AND e.expires_at IS DISTINCT FROM f.new_expires_at;

COMMIT;
