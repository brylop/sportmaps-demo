-- =============================================================================
-- 20261014153533_rol_facility_manager.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014152937
-- Objetivo: rol para clubes que solo alquilan canchas (SportMaps Canchas).
--   Plan: docs/specs/reservas-canchas-f0-plan-migraciones.md §2 M1.
--
-- DEPLOY FIRST, standalone: ALTER TYPE ... ADD VALUE no puede usarse en la
-- misma transacción que lo agrega (gate G-ENUM). Nada en este lote lo referencia.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'facility_manager';
