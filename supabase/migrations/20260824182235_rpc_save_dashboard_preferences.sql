-- =============================================================================
-- 20260824182235_rpc_save_dashboard_preferences.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260824180914
-- Objetivo: RPC hermana de save_notification_preferences/save_privacy_preferences
-- (mismo patrón exacto, ver hooks/useSettings.ts) para que el usuario pueda
-- guardar cuáles "Acciones Rápidas" quiere ver en su Dashboard. Se guarda en
-- profiles.preferences (jsonb, ya existe, sin migración de columna) bajo la
-- clave plana 'dashboard_quick_actions' (array de ids), mismo merge superficial
-- que ya usan las otras dos RPCs de preferencias.
--
-- Nota: save_notification_preferences (la que se copia) usa
-- `SET search_path TO ''` (estilo legacy) — esta migración sigue la convención
-- vigente de CLAUDE.md (`pg_catalog, public, pg_temp`) para código nuevo, y el
-- patrón de REVOKE/GRANT explícito más estricto que ya usan migraciones
-- financieras recientes, no el `GRANT ... TO authenticated` desnudo de la RPC
-- vieja.
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

CREATE OR REPLACE FUNCTION public.save_dashboard_preferences(p_preferences jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    UPDATE public.profiles
    SET
        preferences = (COALESCE(preferences, '{}'::jsonb) || p_preferences),
        updated_at = now()
    WHERE id = auth.uid();

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.save_dashboard_preferences(jsonb) IS
    'Guarda preferencias de UI del dashboard del propio usuario (ej. dashboard_quick_actions: string[]) en profiles.preferences. Merge superficial de claves top-level, mismo patrón que save_notification_preferences/save_privacy_preferences.';

REVOKE ALL ON FUNCTION public.save_dashboard_preferences(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_dashboard_preferences(jsonb) TO authenticated;

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--   select public.save_dashboard_preferences('{"dashboard_quick_actions":["students","calendar"]}'::jsonb);
--   (como el propio usuario autenticado) y luego:
--   select preferences->'dashboard_quick_actions' from profiles where id = auth.uid();
