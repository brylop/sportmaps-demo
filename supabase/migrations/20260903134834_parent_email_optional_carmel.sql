-- =============================================================================
-- 20260903134834_parent_email_optional_carmel.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903131025
-- Objetivo: Club Campestre Carmel, por política interna de manejo de datos
--   personales, no quiere pedirle el correo del acudiente al dar de alta un
--   menor (sus entrenadores no tienen ese dato y no quieren solicitarlo).
--   Mismo patrón que 20260828174117_coach_can_create_athletes.sql y
--   20260831191515_coach_can_create_teams_carmel.sql: toggle en
--   school_settings, evaluado en el BFF (que corre con service role), no en RLS.
--
-- Alcance: solo el correo del ACUDIENTE en el alta de un MENOR (ChildSchema,
--   POST /api/v1/students/create-one). El correo del propio atleta ADULTO
--   (UnregisteredAdultSchema) ya es opcional hoy en ambas capas — no requiere
--   cambio. `children` no tiene columna de email propia (el menor no tiene
--   correo), así que "correo del deportista" del pedido original se resuelve
--   con el caso adulto, ya cubierto.
--
-- Consecuencia de no pedirlo: sin parent_email no hay invitación al acudiente
--   (bff/src/routes/students-create-one.route.ts, bloque "Invitación al
--   acudiente") — el menor queda registrado sin que ningún padre reciba acceso
--   a la cuenta. Es el comportamiento esperado: si Carmel no quiere recolectar
--   el dato, tampoco hay a quién invitar.
--
-- Default `false` = comportamiento de HOY para todas las escuelas. Solo se
--   activa para Carmel Club (374a6716-af42-4745-afe1-8d089153e01b, verificado
--   contra la base — nombre único, sin ambigüedad) en el UPDATE de abajo.
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

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS parent_email_optional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.parent_email_optional IS
    'Si true, el alta de un MENOR (POST /api/v1/students/create-one, type '
    '"child") no exige el correo del acudiente — excepción de política de '
    'datos de Carmel Club. Sin el correo no se crea invitación para el '
    'acudiente (bloque "Invitación al acudiente" de '
    'students-create-one.route.ts): el menor queda sin padre con acceso a la '
    'cuenta, que es la consecuencia esperada. Gate en el BFF, NO en RLS ni en '
    'DB (children.parent_email_temp ya es nullable). Default false = '
    'comportamiento previo a 2026-09-03 en todas las escuelas.';

UPDATE public.school_settings
SET parent_email_optional = true
WHERE school_id = '374a6716-af42-4745-afe1-8d089153e01b'; -- Carmel Club, verificado contra la base (nombre único)

-- -----------------------------------------------------------------------------
-- Exponer el flag al frontend vía v_school_entitlements, para que el campo del
-- correo del acudiente se oculte en el formulario sin depender solo del 400
-- del BFF. CREATE OR REPLACE VIEW no permite reordenar/renombrar columnas
-- (42P16), así que se copia la definición vigente completa (confirmada contra
-- la base con pg_get_viewdef, coincidía con 20260831191515) y se agrega la
-- columna nueva al final.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_school_entitlements AS
 SELECT s.id AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter'::text) AS plan_code,
    COALESCE(sub.tier, 'free'::text) AS tier,
    COALESCE(sub.status, 'trialing'::text) AS subscription_status,
    COALESCE(sub.trial_ends_at, s.created_at + '1 mon'::interval) AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    s.school_type IS NULL OR (s.school_type = ANY (ARRAY['academy'::text, 'hybrid'::text, 'club'::text, 'escuela'::text, 'gimnasio'::text, 'personal_trainer'::text])) AS has_academy,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_reservations,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_wallet,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'tournaments'::text AND a.enabled)) AS has_tournaments,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'access_control'::text AND a.enabled)) AS has_access_control,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'biomech'::text AND a.enabled)) AS has_biomech,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'nutrition'::text AND a.enabled)) AS has_nutrition,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'::text AND a.enabled)) AS has_whitelabel,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'::text AND a.enabled)) AS has_whatsapp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'wompi'::text AND a.enabled)) AS has_wompi,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'mp'::text AND a.enabled)) AS has_mp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'store'::text AND a.enabled)) AS has_store,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'accounting'::text AND a.enabled)) AS has_accounting,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'invoicing'::text AND a.enabled)) AS has_invoicing,
    s.created_at AS school_created_at,
    s.account_type,
    sub.school_id IS NOT NULL AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false) AS blocking_exempt,
    sub.blocking_exempt_reason,
    school_is_operational(s.id) AS is_operational,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND (a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])) AND a.enabled)) AS has_pwa_branding,
    COALESCE(sset.billing_enabled, true) AS has_billing,
    ( SELECT jsonb_object_agg(m.module_key, m.enabled) AS jsonb_object_agg
           FROM school_module_overrides m
          WHERE m.school_id = s.id) AS module_overrides,
    COALESCE(sset.coach_can_create_athletes, false) AS coach_can_create_athletes,
    COALESCE(sset.coach_can_create_teams, false) AS coach_can_create_teams,
    COALESCE(sset.parent_email_optional, false) AS parent_email_optional
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- Verificación (correr después):
--   select school_id, parent_email_optional from v_school_entitlements
--   where parent_email_optional = true; -- debe devolver 1 fila (Carmel)
-- =============================================================================
