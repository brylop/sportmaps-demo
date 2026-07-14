-- ============================================================
-- SPORTMAPS — Fix: school_addons.enabled_at debe ser NULLABLE
-- ------------------------------------------------------------
-- BUG: admin_set_school_addon() (mig 20260713000006) al INSERTAR una fila
-- nueva con el módulo APAGADO hace enabled_at = CASE WHEN p_enabled THEN now()
-- ELSE NULL → inserta NULL en una columna NOT NULL y revienta con:
--   "null value in column enabled_at of relation school_addons violates
--    not-null constraint".
-- Ocurre al APAGAR desde el panel super-admin un add-on que nunca tuvo fila.
--
-- FIX: un add-on deshabilitado legítimamente no tiene enabled_at. Se permite NULL.
-- No se edita la migración/RPC viejos (regla de migraciones inmutables); el RPC
-- ya funciona correcto una vez que la columna admite NULL.
-- Fecha: 2026-07-14
-- ============================================================

ALTER TABLE public.school_addons ALTER COLUMN enabled_at DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
