-- =============================================================================
-- 20260827144226_fix_school_athletes_enrollment_id_plan_only.sql
-- Autor: judegor99   Fecha: 2026-08-27   Versión anterior: 20260827131341
-- Objetivo: school_athletes.enrollment_id sale NULL para cualquier atleta
-- inscrito SOLO en un plan, sin equipo (team_id NULL) — encontrado al validar
-- el banco de horas con datos reales: un atleta con `plan_name` correcto
-- (viene del lateral `pe`) pero `enrollment_id` NULL, porque ese lateral NUNCA
-- selecciona `e.id`. La columna de salida solo lee `te.enrollment_id`, el
-- lateral de inscripción CON equipo (`team_id IS NOT NULL`).
--
-- Esto no es un problema acotado al banco de horas: cualquier pantalla que
-- use `school_athletes.enrollment_id` para un atleta de plan-sin-equipo
-- (el caso normal en escuelas tipo academia, no solo Dreamers) recibe NULL
-- donde debería tener el id real. `frontend/src/lib/api/students.ts` lee esta
-- vista directo desde el navegador (no pasa por el BFF).
--
-- Fix: el lateral `pe` (plan) ahora también selecciona `e.id AS
-- enrollment_id`, y la columna de salida usa `COALESCE(te.enrollment_id,
-- pe.enrollment_id)` — prioridad a la inscripción con equipo si existen las
-- dos (mismo comportamiento de hoy para ese caso), y cae al plan cuando no
-- hay equipo. Se repite en las 3 ramas del UNION ALL (child/adult/
-- unregistered) — nada más de la vista cambia.
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

CREATE OR REPLACE VIEW public.school_athletes AS
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
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
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
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
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
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
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
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
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
  WHERE ua.linked_profile_id IS NULL;

COMMENT ON VIEW public.school_athletes IS
  'Vista unificada de atletas (child/adult/unregistered) para SchoolStudentsManagementPage. '
  'enrollment_id = COALESCE(inscripción con equipo, inscripción con plan) — antes solo miraba '
  'la de equipo y quedaba NULL para cualquier atleta inscrito solo en un plan (el caso normal en '
  'escuelas tipo academia). Corregido 2026-08-27, encontrado al validar el banco de horas.';

COMMIT;
