-- =============================================================================
-- 20260814174607_add_team_image_url.sql
-- Autor: judegor99   Fecha: 2026-08-14   Versión anterior: 20260814173709
-- Objetivo: TODO — qué problema resuelve esta migración.
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'teams'
          AND column_name  = 'image_url'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN image_url text;
    END IF;
END $$;

COMMIT;
