-- =============================================================================
-- 20260902180236_backfill_expires_at_dynasty_casos_resueltos.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902175555
-- Objetivo: cierra los 15 casos "ambiguos" de Dynasty que quedaron fuera de la
-- migración 20260902175555 (esa solo corrigió atletas con UNA sola inscripción
-- con plan). Usuario: "dynasty son las mas importantes" — revisión caso por
-- caso en vivo, 2026-09-02.
--
-- 13 de los 15 resultaron ser el mismo patrón conocido de inscripciones
-- duplicadas huérfanas ([[project_f0_duplicate_enrollments_audit]]): un
-- UPDATE que debía cambiar la inscripción existente (asignar equipo) en su
-- lugar creó una fila nueva, dejando la vieja huérfana y cancelada. En los 13,
-- la inscripción 'active' es siempre la real (coincide con tener equipo
-- asignado en 12/13; el 13vo — Darwin Hernández — tiene equipo en ambas, pero
-- la cancelada quedó con expires_at NULL, o sea nunca tuvo vigencia real).
-- Se corrigen reproduciendo sus pagos 'paid' reales en orden cronológico,
-- igual que 20260902175555, apuntando siempre a la inscripción 'active'.
--
-- Los otros 2 NO son duplicados — son cambios reales de plan sin patrón
-- automático confiable:
--   - Gabriela Soracá Plaza: "PLAN ELITE" (cancelada) -> "SENIORS 8 Clases"
--     (activa, otro equipo)
--   - Solangye Andulce Morales Morales: "SENIORS 8 Clases" (cancelada) ->
--     "PLAN BASIC SENIORS -4 CLASES AL MES" (activa, mismo equipo — downgrade)
-- Decisión del usuario: asumir que el plan ACTIVO hoy es el correcto y
-- extenderlo desde HOY (no reproducir el historial completo, que mezclaría
-- pagos de dos planes distintos de forma no confiable).
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

-- 1. Los 13 casos de duplicado huérfano — reproducir pagos reales apuntando
--    siempre a la inscripción 'active'.
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
    e.child_id, e.user_id, e.unregistered_athlete_id,
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
  WHERE e.offering_plan_id IS NOT NULL AND e.status = 'active'
    AND e.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
),
affected AS (
  SELECT t.* FROM targets t
  JOIN per_athlete pa ON pa.school_id = t.school_id AND pa.athlete_key = t.athlete_key
  WHERE pa.n_plan_enrollments > 1
    AND t.athlete_key NOT IN ('0feb1e3a-27f1-4da7-b96c-21dfa5b8d901', 'eccb4b32-fc82-4f7a-91c1-d0bff07c530f')
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
  SELECT enrollment_id, current_expires_at, duration_days, payment_dates,
         1 as idx,
         (payment_dates[1] + duration_days) as running_expires
  FROM affected
  UNION ALL
  SELECT r.enrollment_id, r.current_expires_at, r.duration_days, r.payment_dates,
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

-- 2. Los 2 casos de cambio de plan real — extender desde hoy, no reproducir
--    historial completo (mezclaría pagos de dos planes distintos).
UPDATE public.enrollments e
SET expires_at = GREATEST(COALESCE(e.expires_at, CURRENT_DATE), CURRENT_DATE)
                  + COALESCE((SELECT op.duration_days FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 30),
    updated_at = now()
WHERE e.id IN (
  '4953eb0a-6c38-412b-a2a3-4ddf80c37e25', -- Gabriela Soracá Plaza, activa: SENIORS 8 Clases
  '0b7c5e0d-5856-486c-aa18-71824bf6c5b2'  -- Solangye Andulce Morales Morales, activa: PLAN BASIC SENIORS -4 CLASES AL MES
);

COMMIT;
