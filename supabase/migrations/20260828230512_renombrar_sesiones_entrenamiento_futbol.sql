-- =============================================================================
-- 20260828230512_renombrar_sesiones_entrenamiento_futbol.sql
-- Autor: judegor99   Fecha: 2026-08-28   Versión anterior: 20260828224353
-- Objetivo: "Plan de Entrenamiento" pasa a llamarse "Sesión" en Métricas y
--   Rendimiento. Resuelve de una vez la colisión de nombres que ya documentaba
--   docs/specs/periodizacion-microciclos-y-carga.md §1: existían DOS tablas de
--   nombre casi idéntico que modelaban cosas distintas y no se conocían entre
--   sí — `training_sessions` (cupos/reservas) y `training_plans` (contenido).
--
-- Medido contra la base viva antes de aplicar (luebjarufsiadojhvxgi):
--   training_sessions (cupos) = 0 filas · session_attendance = 0 filas ·
--   training_plans (contenido) = 3 filas · match_lineups con
--   source_type='training_session' = 0 filas. Sin código en bff/ que use
--   training_sessions o session_attendance (confirmado por grep). Riesgo de
--   dato: nulo.
--
-- Qué hace:
--   1. Libera el nombre "training_sessions": la tabla de cupos (vacía, sin
--      consumidores) pasa a `training_slots`. session_attendance.session_id
--      sigue apuntando a la misma tabla — Postgres sigue las FKs por OID, no
--      por nombre, así que el rename no rompe la referencia.
--   2. El contenido real (3 filas) toma el nombre `training_sessions` — es lo
--      que el producto llama "Sesión" de ahora en más. `plan_date` pasa a
--      `session_date` por la misma razón: una columna `plan_date` dentro de
--      una tabla `training_sessions` sería la misma inconsistencia que se
--      corrige acá.
--   3. Agrega contenido específico de fútbol, nullable — no aplica a otros
--      deportes (fuente: Excel "Sesión Diaria Fútbol C.C.C", Club Carmel):
--        · session_blocks jsonb — bloques editables por el coach (no fijos):
--          [{name, minutes, activity, objective, description, tactical_lineup_id}]
--        · game_principles text — "Principios de juego a trabajar" del Excel
--        · evaluation jsonb — post-sesión, opcional, se completa cuando el
--          coach pueda: {objectives_met, team_rating, highlights, improvements}
--
-- No requiere tocar RLS ni grants: las policies y triggers de ambas tablas
-- están atados por OID, no por nombre, y sobreviven el rename sin recrearse
-- (verificado: pg_policies de training_plans usa JOIN a teams/school_members,
-- ninguna referencia textual a "training_plans" desde otra tabla).
--
-- tactical_lineup_id (dentro de session_blocks, JSON) referencia
-- match_lineups.id sin FK — mismo eje polimórfico sin FK que performance_entries
-- (Postgres no admite FK dentro de un jsonb). El diagrama de cada bloque es una
-- jugada ya guardada en el Tablero Táctico, no una imagen nueva.
--
-- Aplicada en luebjarufsiadojhvxgi vía apply_migration (Supabase MCP) el
-- 2026-08-28. Verificación post-aplicación: list_tables confirma
-- training_slots (0 filas) y training_sessions (3 filas, la ex training_plans).
-- =============================================================================

BEGIN;

ALTER TABLE public.training_sessions RENAME TO training_slots;
ALTER TABLE public.training_plans RENAME TO training_sessions;
ALTER TABLE public.training_sessions RENAME COLUMN plan_date TO session_date;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS session_blocks   jsonb,
  ADD COLUMN IF NOT EXISTS game_principles  text,
  ADD COLUMN IF NOT EXISTS evaluation       jsonb;

COMMIT;
