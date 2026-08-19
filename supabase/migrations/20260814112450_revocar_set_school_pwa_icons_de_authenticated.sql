-- =============================================================================
-- 20260814112450_revocar_set_school_pwa_icons_de_authenticated.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814111326
-- Objetivo: dejar set_school_pwa_icons accesible SOLO a service_role.
--
-- Qué pasó: 20260814111324 hizo `REVOKE ALL ... FROM PUBLIC` + `GRANT ... TO
-- service_role` creyendo que con eso alcanzaba. No alcanzó: el esquema public
-- tiene default privileges que otorgan EXECUTE a `authenticated` en cada función
-- nueva, y ese grant es EXPLÍCITO sobre el rol — revocar de PUBLIC no lo toca.
-- Verificado con has_function_privilege('authenticated', ...) = true.
--
-- Por qué importa: la función es SECURITY DEFINER y NO valida membresía; su
-- única defensa es que las URLs pertenezcan al bucket de la escuela indicada.
-- Con EXECUTE abierto, cualquier usuario logueado podía reescribir los iconos de
-- otra escuela apuntando a archivos ya existentes bajo pwa-icons/<esa escuela>/.
-- El icono es lo que las familias ven en su pantalla de inicio.
--
-- Lección para las próximas RPC de solo-servicio: revocar EXPLÍCITAMENTE de
-- authenticated y anon; `REVOKE FROM PUBLIC` no basta en este esquema.
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

REVOKE EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) FROM anon;

-- Se reafirma el único caller legítimo (el BFF con service_role).
GRANT EXECUTE ON FUNCTION public.set_school_pwa_icons(uuid, text, text, uuid) TO service_role;

COMMIT;
