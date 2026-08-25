-- =============================================================================
-- 20260825183159_unregistered_athletes_guardian_full_name.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260825181210
-- Objetivo: el formulario de afiliación de Monster Volley nunca pregunta el
--   nombre del acudiente como campo — solo su teléfono, correo y ocupación.
--   Pero Google Forms sufija cada archivo subido con el nombre de la cuenta
--   de Google que lo subió ("... - Sandra Liliana Castillo Barrero.jpg"), así
--   que el dato existe, solo no estaba modelado. Se agrega la columna para
--   poder mostrarlo en la sección Acudiente (hoy el front verificó que
--   faltaba exactamente esto).
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
  ADD COLUMN IF NOT EXISTS guardian_full_name text;

COMMENT ON COLUMN public.unregistered_athletes.guardian_full_name IS
  'Nombre del acudiente. El formulario de origen no lo pregunta directo — se rescata del sufijo con el que Google Forms nombra cada archivo subido ("... - Nombre Apellido.ext").';

COMMIT;
