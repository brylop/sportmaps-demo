-- =============================================================================
-- 20260829011715_comentario_subscription_plans_deprecada.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829010122
-- Objetivo: subscription_plans quedó como tabla zombi — el catálogo vigente
--   de planes escuela→familias es offering_plans desde hace semanas (commits
--   f300860a, c6a024c0), pero el COMMENT ON TABLE que quedaba (o su ausencia
--   en esta base — se verificó NULL en vivo el 2026-08-29) no lo decía.
--   Quien lea el schema por primera vez puede terminar escribiendo sobre la
--   tabla equivocada. Solo documentación: no toca datos, RLS ni GRANTs.
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

COMMENT ON TABLE public.subscription_plans IS
  'DEPRECADA para escuela→familias: ese catálogo es public.offering_plans '
  'desde 2026-08 (commits f300860a, c6a024c0). Sigue viva solo para '
  'vendor_profiles (trainers/wellness/stores) vía la policy sub_plans_owner. '
  'No escribir acá para planes de escuela.';

COMMIT;
