-- =============================================================================
-- 20260921130849_mesociclo_fk_dia_sesion_invertido.sql
-- Autor: brylop   Fecha: 2026-09-21   Versión anterior: 20260921120707
-- Objetivo: corrige la causa de fondo del §8.2 de
--   docs/specs/periodizacion-microciclos-y-carga.md — el FK día↔sesión
--   quedó en la tabla equivocada desde el plan de ejecución original
--   (docs/plan-mesociclo-carmel-2026-08-31.md §1.2). El spec (§3.2) siempre
--   dijo que la sesión apunta al día (`microcycle_day_id` en
--   `training_sessions`), nunca al revés.
--
--   Estaba: `training_microcycle_days.session_id` -> `training_sessions.id`,
--   con `UNIQUE(microcycle_id, day_date)` de por medio -- un día admitía
--   UNA sola sesión, y crear+enganchar eran dos escrituras separadas sin
--   transacción (causa raíz del bug de sesiones huérfanas del 18-sep,
--   mitigado ese día ocultando el botón que las creaba, nunca corregido de
--   raíz). Además impedía modelar un club que entrena dos veces el mismo
--   día (gimnasio AM + cancha PM, caso normal en fútbol juvenil).
--
--   Queda: `training_sessions.microcycle_day_id` -> `training_microcycle_days.id`,
--   nullable, sin UNIQUE -- un día admite cualquier cantidad de sesiones, y
--   crear una sesión para un día es UN solo INSERT (ya no dos escrituras).
--
--   Migración de datos: 11 filas reales con `training_microcycle_days.session_id`
--   poblado (verificado antes de escribir esto -- ninguna colisión, cada
--   session_id aparece una sola vez), todas migradas 1:1 a la columna nueva.
--   `training_microcycle_days.session_id` se borra en la MISMA migración
--   (no hay período de convivencia: el frontend que lo escribe/lee se
--   actualiza en el mismo commit, y dejar la columna vieja viva invitaría a
--   que algo la siga escribiendo por error).
--
--   `v_session_load` (CAR-8) no se toca: se arma solo desde `training_sessions`,
--   nunca hizo JOIN a `training_microcycle_days` (verificado leyendo su
--   definición antes de escribir esto).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Columna nueva en el lado correcto ───────────────────────────────────
ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS microcycle_day_id uuid REFERENCES public.training_microcycle_days(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_microcycle_day ON public.training_sessions (microcycle_day_id);

-- ─── 2. Backfill 1:1 desde los enganches existentes ─────────────────────────
UPDATE public.training_sessions ts
SET microcycle_day_id = d.id
FROM public.training_microcycle_days d
WHERE d.session_id = ts.id;

-- ─── 3. Retirar el FK viejo (mismo commit, sin período de convivencia) ──────
DROP INDEX IF EXISTS idx_training_microcycle_days_session;
ALTER TABLE public.training_microcycle_days DROP COLUMN IF EXISTS session_id;

COMMIT;

NOTIFY pgrst, 'reload schema';
