-- =============================================================================
-- 20260902181143_backfill_expires_at_resto_ambiguos_mma_academia_demo.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902180236
-- Objetivo: cierra los 8 atletas ambiguos restantes de Bloqueador B fuera de
-- Dynasty (MMA Blair Team 6, Academia Superior Bogotá 1, Escuela Demo
-- SportMaps 1) — docs/specs/vigencia-cobranza-y-sesiones-unificado.md §3.2.
--
-- GUARDA DE SEGURIDAD NUEVA (aprendida en esta misma migración, antes de
-- aplicar nada): al revisar MMA Blair Team, reproducir el historial completo
-- de pagos de 4 de sus 6 atletas daba un expires_at MENOR al que ya tienen
-- guardado (ej. david Lopez: guardado 2026-08-17, recomputado 2026-07-24).
-- Eso significa que el valor actual ya refleja algo que el replay de pagos no
-- ve — probablemente una corrección manual de un admin. Bajarlo sería
-- EMPEORAR el dato, no corregirlo. Por eso el UPDATE de abajo usa
-- GREATEST(expires_at_actual, recomputado): solo sube, nunca baja.
--
-- Auditoría retroactiva de 20260902175555 + 20260902180236 (73 filas
-- tocadas): 71/73 dan el mismo valor al recomputar hoy; las 2 únicas
-- distintas son Gabriela Soracá Plaza y Solangye Andulce Morales Morales —
-- las 2 que ya se trataron aparte ("extender desde hoy", no replay completo)
-- precisamente por este mismo motivo. Cero filas dañadas por las migraciones
-- anteriores.
--
-- Con la guarda GREATEST, de los 6 de MMA Blair Team solo cambian 2 (Carlos
-- Martinez Perez de Escuela Demo y "sdfsdfsdfsdf", cuenta de prueba) — los
-- otros 4 (Brayan Steven López, Cristian Pineda, david Lopez, Luis Lopez) no
-- se tocan: su valor actual ya es igual o mejor que el replay. "pruebas"
-- (MMA Blair) se excluye por completo — no tiene ninguna inscripción activa,
-- nada que corregir.
--
-- Academia Superior Bogotá — David Junior Andrade tiene 3 planes distintos
-- (GOLD, Sub-10, Basico) sin patrón de duplicado huérfano — mismo tratamiento
-- que Gabriela Soracá/Solangye: extender la inscripción activa desde HOY.
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

-- 1. MMA Blair Team + Escuela Demo — replay guardado con GREATEST (nunca baja).
WITH RECURSIVE targets AS (
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
    AND e.school_id != '2d509571-3238-4c04-ac3f-6dfe20539226'
),
per_athlete AS (
  SELECT school_id,
         coalesce(child_id::text, unregistered_athlete_id::text, user_id::text) as athlete_key,
         count(*) as n_plan_enrollments
  FROM enrollments
  WHERE offering_plan_id IS NOT NULL AND status IN ('active','cancelled')
  GROUP BY 1,2
),
affected AS (
  SELECT t.* FROM targets t
  JOIN per_athlete pa ON pa.school_id = t.school_id AND pa.athlete_key = t.athlete_key
  WHERE pa.n_plan_enrollments > 1
    AND t.athlete_key != 'da64854c-a9bd-4921-908e-acd1b1356236' -- David Junior Andrade, se maneja aparte abajo
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
SET expires_at = GREATEST(e.expires_at, f.new_expires_at),
    updated_at = now()
FROM final f
WHERE e.id = f.enrollment_id
  AND e.expires_at IS DISTINCT FROM GREATEST(e.expires_at, f.new_expires_at);

-- 2. Academia Superior Bogotá — David Junior Andrade, cambio de plan real
--    (GOLD -> Sub-10 -> Basico, sin patrón de duplicado). Extender la activa
--    desde hoy, igual que Gabriela Soracá/Solangye en Dynasty.
UPDATE public.enrollments e
SET expires_at = GREATEST(COALESCE(e.expires_at, CURRENT_DATE), CURRENT_DATE)
                  + COALESCE((SELECT op.duration_days FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 30),
    updated_at = now()
WHERE e.id = '2b3d5da2-1b98-4a49-b505-c58a80324144'; -- David Junior Andrade, activa: Sub-10 (Beginners)

COMMIT;
