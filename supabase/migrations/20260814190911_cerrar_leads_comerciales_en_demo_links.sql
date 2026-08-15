-- =============================================================================
-- 20260814190911_cerrar_leads_comerciales_en_demo_links.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814190601
-- Objetivo: que los datos de contacto de los prospectos comerciales no queden
--           públicos cada vez que hay un link de demo activo.
--
-- ── El hallazgo ─────────────────────────────────────────────────────────────
-- La policy "public can read active demo link by token" es
-- USING (is_active = true AND expires_at > now()) para el rol `public`, y anon
-- tiene SELECT sobre la tabla. Filtra por vigencia, no por token — el nombre
-- promete algo que la expresión no hace, igual que pasaba con
-- payment_links_select_by_token.
--
-- demo_links guarda `prospect_name`, `prospect_phone` y `prospect_email`: es la
-- lista de a quién se le está vendiendo. Cada vez que hay un link de demo
-- vigente, ese contacto queda legible por cualquiera con la llave anónima.
--
-- Hoy hay 0 links activos, así que la exposición está en cero EN ESTE MOMENTO —
-- no porque esté cerrada, sino porque no hay nada que mostrar. Vuelve sola en
-- cuanto alguien genere un link.
--
-- ── Por qué se puede cerrar sin más ─────────────────────────────────────────
-- No hay UN SOLO lector: cero coincidencias de `demo_links` en frontend/src y en
-- bff/src. La policy no habilita ningún flujo, solo expone.
--
-- Si más adelante se implementa la apertura del demo por token, la forma
-- correcta NO es una policy: en RLS no hay manera limpia de comparar contra un
-- token que viene en la query. Va con una RPC SECURITY DEFINER que reciba el
-- token y devuelva solo los campos de presentación (school_name, primary_color,
-- logo_url), nunca los del prospecto.
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

DROP POLICY IF EXISTS "public can read active demo link by token" ON public.demo_links;

COMMIT;
