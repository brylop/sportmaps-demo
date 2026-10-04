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
