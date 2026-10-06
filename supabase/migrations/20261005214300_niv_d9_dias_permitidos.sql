-- =============================================================================
-- 20261005214300_niv_d9_dias_permitidos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261005214258
-- Objetivo: F-F (docs/specs/dreamers-reglas-completas-plan.md) — días permitidos
--   por plan (spec dreamers-niveles-por-horas-y-progresion.md, D9 / D11 / D11b).
--
--   1. offering_plans.allowed_days_of_week integer[]: días de la semana en que
--      el plan permite reservar (0 = domingo … 6 = sábado, igual que
--      Date.getDay() y EXTRACT(DOW)). NULL = sin restricción (hoy, todas).
--      El BFF rechaza con 422 las reservas en días no permitidos.
--   2. access_events.policy_warning text: el torniquete NO puede negar el paso
--      por día (el F22 decide local, D11b = solo registrar y avisar). Una
--      entrada en día no permitido queda access_granted = true con
--      policy_warning = 'day_not_allowed'. NO es denial_reason (ese CHECK
--      tiene 5 valores y significa "se negó"; acá la atleta sí entró).
--
-- Radio: 0 filas tocadas, columnas nullable. access_events (~13k filas) solo
-- valida el CHECK nuevo sobre NULL. Cero school_id en la lógica.
-- =============================================================================

BEGIN;

-- ── 1. Días permitidos por plan (D9) ────────────────────────────────────────
ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS allowed_days_of_week integer[];

ALTER TABLE public.offering_plans
  DROP CONSTRAINT IF EXISTS offering_plans_allowed_days_of_week_check;
ALTER TABLE public.offering_plans
  ADD CONSTRAINT offering_plans_allowed_days_of_week_check
  CHECK (
    allowed_days_of_week IS NULL
    OR (cardinality(allowed_days_of_week) >= 1
        AND allowed_days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6])
  );

COMMENT ON COLUMN public.offering_plans.allowed_days_of_week IS
  'Días de la semana en que el plan permite reservar/entrenar (0=domingo … 6=sábado). NULL = sin restricción (D9). Reserva: 422 day_not_allowed. Torniquete: solo registra policy_warning y avisa (D11b).';

-- ── 2. Advertencia de política en el evento de acceso (D11b) ────────────────
ALTER TABLE public.access_events
  ADD COLUMN IF NOT EXISTS policy_warning text;

ALTER TABLE public.access_events
  DROP CONSTRAINT IF EXISTS access_events_policy_warning_check;
ALTER TABLE public.access_events
  ADD CONSTRAINT access_events_policy_warning_check
  CHECK (policy_warning IS NULL OR policy_warning IN ('day_not_allowed'));

COMMENT ON COLUMN public.access_events.policy_warning IS
  'Advertencia de política sin negar el paso (el F22 decide local). day_not_allowed = entró un día que su plan no permite. Distinto de denial_reason.';

COMMIT;
