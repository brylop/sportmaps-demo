-- =============================================================================
-- 20260825181210_unregistered_athletes_avatar_url.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260825151250
-- Objetivo: la vista school_athletes hoy hardcodea NULL::text como avatar_url
--   para el sujeto 'unregistered' (unregistered_athletes no tenía la columna).
--   Con Monster Volley ya trayendo la foto del deportista al importar, esto
--   dejaba la foto cargada como documento sin poder mostrarse como avatar en
--   el roster. Se agrega la columna y se recablea la vista SIN retranscribirla
--   a mano (riesgo de errores en una vista de 150+ líneas, "query #1 de la
--   app"): se lee la definición viva, se reemplaza el único literal
--   'NULL::text AS avatar_url' por 'ua.avatar_url', y se re-crea con EXECUTE.
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

ALTER TABLE public.unregistered_athletes
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.unregistered_athletes.avatar_url IS
  'URL pública (bucket avatars) de la foto del atleta. Mismo vocabulario/uso que children.avatar_url y profiles.avatar_url.';

DO $$
DECLARE
  v_def     text;
  v_new_def text;
  v_pattern text := 'NULL::text AS avatar_url';
BEGIN
  SELECT pg_get_viewdef('public.school_athletes'::regclass, true) INTO v_def;

  IF v_def NOT LIKE '%' || v_pattern || '%' THEN
    RAISE EXCEPTION 'school_athletes ya no contiene "%": la vista cambió, revisar a mano antes de aplicar esta migración.', v_pattern;
  END IF;

  v_new_def := replace(v_def, v_pattern, 'ua.avatar_url');

  EXECUTE 'CREATE OR REPLACE VIEW public.school_athletes AS ' || v_new_def;
END $$;

COMMIT;
