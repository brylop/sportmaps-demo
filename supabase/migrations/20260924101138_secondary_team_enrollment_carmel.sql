-- =============================================================================
-- 20260924101138_secondary_team_enrollment_carmel.sql
-- Autor: brylop   Fecha: 2026-09-24   Versión anterior: 20260924100845
-- Objetivo: que una escuela pueda tener a un deportista en un SEGUNDO equipo
-- (grupo de trabajo transversal: arqueros, preparación física, selección) sin
-- sacarlo de su categoría y sin que ese segundo equipo cobre nunca.
--
-- Caso que lo dispara: Club Carmel (2026-09-24) creó "EQUIPO ARQUERO" y al
-- inscribir a un arquero que ya está en su categoría el BFF respondía 409
-- "El atleta ya tiene una inscripción activa en esta escuela". Esa regla (una
-- inscripción activa por atleta) es deliberada — de ella cuelga el cobro — y
-- NO se relaja acá: solo se abre, por escuela y con flag, un carril explícito
-- (`POST /enrollments` con `secondary: true`) que inserta la segunda fila con
-- `monthly_fee = 0` y `fee_is_manual = true`, lo que la deja fuera de
-- open_month (COALESCE(e.monthly_fee, …) = 0 → no se cobra) aunque el equipo
-- tenga precio o `children.monthly_fee` esté cargado.
--
-- Por qué una segunda fila en `enrollments` y no `enrollment_categories`
-- (MOD-3 F3): esa tabla exige `category_id NOT NULL` (Carmel no tiene
-- catálogo), "arquero" no es una categoría (el precio por tramos lo contaría
-- como 2ª categoría), y hoy NINGÚN lector la mira (school_athletes, asistencia,
-- mesociclos, informes). Una segunda `enrollments` con otro `team_id` sí la
-- leen todos: es exactamente el estado que ya tienen 14 menores en 6 escuelas
-- (Solo Millos ×7, MMA Blair ×3, Academia Superior ×2, Dojo Fénix, Demo), y el
-- editor de atletas (`readActiveEnrollments` en students.ts) solo cancela
-- duplicados EXACTOS (mismo team_id), así que la fila sobrevive a una edición.
--
-- Los índices únicos parciales de enrollments (`uq_enrollment_*_team`) solo
-- chocan por el MISMO equipo, así que la segunda fila no necesita cambios de
-- esquema. Los triggers de la tabla no hacen nada relevante (sync_program_team_id
-- solo toca updated_at) y el cron semanal detect_enrollment_integrity_issues
-- solo reporta atletas SIN inscripción.
--
-- Gate: en el BFF (POST /enrollments lee el flag), no en RLS — la escritura a
-- enrollments ya pasa por el BFF con service role. Default false = el 409 de
-- siempre para toda escuela que no lo prenda.
--
-- Radio: solo Carmel queda en true. Para cualquier otra escuela el flag es
-- false y el comportamiento es idéntico al de hoy.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · No se crea ninguna función acá.
--   · CREATE OR REPLACE VIEW no permite reordenar ni renombrar columnas
--     (42P16): se copia la definición vigente completa (pg_get_viewdef contra
--     la base el 2026-09-24) y se agrega la columna nueva AL FINAL — mismo
--     patrón que 20260831191515 y 20260903144504.
-- =============================================================================

BEGIN;

-- ── 1. Toggle en school_settings ─────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS allow_secondary_team_enrollment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.allow_secondary_team_enrollment IS
    'Si true, un deportista de la escuela puede tener una SEGUNDA inscripción '
    'activa en otro equipo (grupo de trabajo transversal: arqueros, '
    'preparación física, selección) sin salir de su categoría. La segunda '
    'fila se crea SOLO por POST /enrollments con `secondary: true` y nace con '
    'monthly_fee = 0 y fee_is_manual = true: ese equipo nunca cobra. La regla '
    'general (una inscripción activa por atleta) sigue igual para todo lo '
    'demás. Default false = el 409 de siempre. Caso Carmel Club, 2026-09-24.';

UPDATE public.school_settings
SET allow_secondary_team_enrollment = true
WHERE school_id = '374a6716-af42-4745-afe1-8d089153e01b'; -- Carmel Club (verificado contra la base: fila existe)

-- ── 2. Exponer el flag a v_school_entitlements ───────────────────────────────
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
    COALESCE(sset.parent_email_optional, false) AS parent_email_optional,
    COALESCE(sset.coach_hide_financial_info, false) AS coach_hide_financial_info,
    COALESCE(sset.coach_can_edit_categories, false) AS coach_can_edit_categories,
    COALESCE(sset.military_discount_enabled, false) AS military_discount_enabled,
    COALESCE(sset.allow_secondary_team_enrollment, false) AS allow_secondary_team_enrollment
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verificación (correr después) ────────────────────────────────────────────
-- 1. Solo Carmel en true:
--    select school_id, allow_secondary_team_enrollment from v_school_entitlements
--    where allow_secondary_team_enrollment = true; -- 1 fila (374a6716-…)
--
-- 2. Cualquier otra escuela sigue en false (default de la columna):
--    select count(*) from school_settings where allow_secondary_team_enrollment; -- 1
--
-- 3. La vista conserva sus columnas en el mismo orden y la nueva va al final:
--    select column_name, ordinal_position from information_schema.columns
--    where table_name = 'v_school_entitlements' order by ordinal_position desc limit 2;
