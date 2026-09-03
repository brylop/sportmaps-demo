-- =============================================================================
-- 20260903144504_coach_besser_financial_categoria.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903134834
-- Objetivo: Club Deportivo Besser pidió que sus entrenadores NO vean mensualidad
--   ni estado de pago de sus atletas en ninguna pantalla, y a cambio SÍ puedan
--   reasignar la categoría (equipo) de cada uno — hoy no tienen forma de
--   hacerlo desde la UI y todos quedaron en el equipo placeholder "Sin
--   categoría asignada" del import inicial (scripts/besser-import/01_cargar_atletas.mjs).
--
-- Contexto: ya era una decisión de producto diferida a propósito — el
--   comentario de 20260803111843_payments_rls_solo_staff.sql documenta
--   explícitamente que "los coaches siguen viendo la cartera... queda como
--   decisión de producto aparte, no se cuela acá". Besser resuelve esa
--   decisión, pero SOLO para sí misma — el resto de escuelas no cambia.
--
-- Mismo patrón que 20260731152955 (coach_can_enroll_paid_teams),
--   20260828174117 (coach_can_create_athletes) y 20260831191515
--   (coach_can_create_teams_carmel): dos toggles nuevos en school_settings,
--   default false = comportamiento de HOY para todas las escuelas. Sin UI de
--   toggle todavía (igual que coach_can_create_athletes) — se activan para
--   Besser (759eee9d-05cb-4958-b84a-2560f77e3683, verificado contra la base,
--   nombre único "CLUB DEPORTIVO BESSER") con el UPDATE de abajo.
--
-- coach_hide_financial_info: a diferencia de los flags anteriores (que solo
--   gatean el BFF, porque los endpoints de escritura corren con service role
--   y saltan RLS), este SÍ toca la vista `school_athletes` — es una lectura
--   directa desde el frontend contra Supabase (SchoolStudentsManagementPage),
--   no pasa por el BFF, así que RLS/la vista es el único lugar donde se puede
--   enmascarar el dato para esa lectura. RLS es de FILA, no de COLUMNA, así
--   que no se puede ocultar `price_monthly` sin ocultar la fila entera desde
--   una policy — por eso el enmascarado va en el SELECT de la vista (CASE por
--   columna de dinero), no en una policy nueva. El resto de las superficies
--   (BFF: attendance roster, students PUT, invitations) se cierran en el
--   commit de BFF que sigue a esta migración.
--
-- coach_can_edit_categories: habilita que el BFF (PUT /api/v1/students/:id)
--   acepte de un coach el campo de reasignación de equipo/categoría, sin
--   habilitar ningún campo de dinero en el mismo payload — ver commit de BFF.
--   Es independiente de coach_can_create_athletes (una escuela puede tener
--   uno sin el otro).
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
    ADD COLUMN IF NOT EXISTS coach_hide_financial_info boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS coach_can_edit_categories boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_hide_financial_info IS
    'Si true, un entrenador (coach) de la escuela NO ve mensualidad/plan/estado '
    'de pago de sus atletas en ninguna pantalla. Enmascara (NULL) las columnas '
    'de dinero de la vista public.school_athletes para coach cuando este flag '
    'está activo (lectura directa frontend->Supabase, RLS es de fila no de '
    'columna). También gatea, en el BFF, GET /attendance/roster/:contextType/'
    ':contextId, GET/PUT de invitations (monthly_fee/offering_plans.price) y '
    'PUT /api/v1/students/:id (rechaza campos de dinero del payload si el '
    'caller es coach). Default false = comportamiento previo a 2026-09-03 en '
    'todas las escuelas.';

COMMENT ON COLUMN public.school_settings.coach_can_edit_categories IS
    'Si true, un entrenador (coach) de la escuela puede reasignar la categoría '
    '(equipo) de un atleta existente vía PUT /api/v1/students/:id — el BFF '
    'acepta enrollment.team_id de un coach pero sigue rechazando cualquier '
    'campo de dinero del mismo payload (monthly_fee, fee_is_manual, '
    'fee_reason, offering_plan_id), sin importar este flag. Independiente de '
    'coach_can_create_athletes. Default false = comportamiento previo a '
    '2026-09-03 en todas las escuelas.';

UPDATE public.school_settings
SET coach_hide_financial_info = true,
    coach_can_edit_categories = true
WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683'; -- CLUB DEPORTIVO BESSER, verificado contra la base (nombre único)

-- -----------------------------------------------------------------------------
-- Enmascarar las columnas de dinero de school_athletes para coach cuando la
-- escuela tiene coach_hide_financial_info=true. Se copia la definición VIVA
-- (pg_get_viewdef, no la del repo: incluye `dorsal` al final de cada rama,
-- agregado por una migración concurrente ya aplicada y sin commitear en el
-- repo al momento de escribir esta — CREATE OR REPLACE VIEW no permite dropear
-- columnas, así que había que partir de la definición real) y se envuelve
-- cada columna de dinero (team_monthly_fee, plan_monthly_fee, price_monthly,
-- payment_status, payment_due_date, fee_is_manual, fee_reason) en
-- CASE WHEN hm.hide_money THEN NULL ELSE <expr original> END, en las 3 ramas
-- del UNION ALL. hm.hide_money se calcula una sola vez por fila vía LATERAL
-- contra school_settings (tabla distinta de school_athletes -> no viola la
-- regla de no-self-recursion en RLS) + is_school_coach() (ya vigente en la
-- base, usado hoy por la policy "Staff can manage enrollments"). No cambia
-- ninguna columna, tipo ni lógica de negocio para el resto de los roles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true) AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric)) END AS team_monthly_fee,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)) END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END) END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END)) END AS payment_status,
    CASE WHEN hm.hide_money THEN NULL ELSE pay.due_date END AS payment_due_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END) END AS fee_is_manual,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END) END AS fee_reason,
    c.dorsal
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(c.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = c.school_id) hm ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric)) END AS team_monthly_fee,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)) END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END) END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END)) END AS payment_status,
    CASE WHEN hm.hide_money THEN NULL ELSE pay.due_date END AS payment_due_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END) END AS fee_is_manual,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END) END AS fee_reason,
    sm.dorsal
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(sm.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = sm.school_id) hm ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric)) END AS team_monthly_fee,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)) END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END) END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
    CASE WHEN hm.hide_money THEN NULL ELSE (COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END)) END AS payment_status,
    CASE WHEN hm.hide_money THEN NULL ELSE pay.due_date END AS payment_due_date,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END) END AS fee_is_manual,
    CASE WHEN hm.hide_money THEN NULL ELSE (
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END) END AS fee_reason,
    ua.dorsal
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(ua.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = ua.school_id) hm ON true
  WHERE ua.linked_profile_id IS NULL;

COMMENT ON VIEW public.school_athletes IS
    'Vista unificada de atletas: children + adult profiles (school_members role=athlete) + unregistered_athletes. '
    'SECURITY INVOKER (restaurado 2026-09-01, ver 20260901112643). RLS de tablas base manda. '
    'Desde 2026-09-03: columnas de dinero (team_monthly_fee, plan_monthly_fee, price_monthly, payment_status, '
    'payment_due_date, fee_is_manual, fee_reason) salen NULL para coach cuando school_settings.coach_hide_financial_info '
    'de esa escuela es true (hoy solo Besser) — enmascarado en el SELECT, no en RLS de fila. '
    'Riesgo conocido heredado: unregistered_athletes vía roles no-staff (school_admin/organizer/super_admin) — ver 20260511000012.';

-- -----------------------------------------------------------------------------
-- Exponer ambos flags al frontend vía v_school_entitlements. CREATE OR REPLACE
-- VIEW no permite reordenar/renombrar columnas (42P16), así que se copia la
-- definición vigente completa (20260903134834) y se agregan las columnas
-- nuevas al final.
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
    COALESCE(sset.parent_email_optional, false) AS parent_email_optional,
    COALESCE(sset.coach_hide_financial_info, false) AS coach_hide_financial_info,
    COALESCE(sset.coach_can_edit_categories, false) AS coach_can_edit_categories
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

-- =============================================================================
-- Verificación (correr después de aplicar):
--   npm run seguridad:invariantes
--
--   -- Simular sesión de un coach de Besser y confirmar que el dinero sale NULL:
--   select set_config('request.jwt.claims',
--     json_build_object('sub', '<uuid del coach de Besser>')::text, true);
--   select price_monthly, payment_status, team_monthly_fee
--   from school_athletes where school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';
--   -- debe devolver NULL en las tres columnas para todas las filas.
--
--   -- Confirmar que un coach de OTRA escuela (flag en false) sigue viendo el
--   -- dinero como antes -- no debe haber regresión fuera de Besser.
--
--   select school_id, coach_hide_financial_info, coach_can_edit_categories
--   from v_school_entitlements where coach_hide_financial_info = true;
--   -- debe devolver 1 fila (Besser).
-- =============================================================================
