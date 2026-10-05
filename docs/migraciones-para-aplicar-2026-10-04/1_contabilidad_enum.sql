-- =====================================================================
-- PASO 1 — SOLO (ALTER TYPE ADD VALUE no puede ir en la misma transacción que lo usa)
-- Generado 2026-10-04. Pegar COMPLETO en el SQL Editor de Supabase y Run.
-- Cada migración trae su propio BEGIN/COMMIT: si una falla, las anteriores
-- quedan aplicadas y registradas; corregir y seguir desde la que falló.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 20261003202413_finanzas_rol_contador_enum.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003202413_finanzas_rol_contador_enum.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003201142
-- Objetivo: Contabilidad v2 · F0 · M0 (decisión U1 = B). Agrega el valor
--   'accountant' al enum public.user_role para que el contador entre por el
--   flujo normal de invitaciones: accept_invitation_pro hace
--   `profiles.role = role_to_assign::user_role` y sin el valor daría 22P02.
--   Mismo precedente que 'reporter' (está en el enum y en school_members).
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M0.
-- Notas:
--   · Va SOLA: un valor nuevo de enum no se puede usar en la misma transacción
--     en que se crea. La migración siguiente (…202416) es la que lo usa.
--   · Re-ejecutable (IF NOT EXISTS).
--   · Rollback: un valor de enum no se quita. Queda inerte si se revierte M1.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accountant';

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003202413', '20261003202413_finanzas_rol_contador_enum', 'sql-editor 2026-10-04') on conflict (version) do nothing;
