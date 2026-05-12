-- ============================================================
-- SPORTMAPS — Linter Fase 2
-- Convierte la vista public.school_athletes a SECURITY INVOKER
-- para cerrar el unico ERROR del Supabase linter (security_definer_view).
--
-- POR QUE
--   La vista venia con SECURITY DEFINER, bypasseaba RLS de las
--   tablas base. Cualquier authenticated que pudiera consultarla
--   veia todas las filas, no solo las que su rol/escuela permite.
--
-- ANALISIS DE COBERTURA RLS (2026-05-11)
--   Tablas leidas por la vista:
--     children, profiles, school_branches, enrollments, teams,
--     offering_plans, payments, school_members, unregistered_athletes
--   Las 4 flujos del frontend (escuela / coach / padre / lookup por id)
--   estan cubiertos por las policies existentes.
--
-- RIESGOS CONOCIDOS
--   1) unregistered_athletes: la policy ALL solo cubre roles
--      ('admin','coach','staff') + schools.owner_id. Staff con role
--      'school_admin','organizer','super_admin' dejara de ver
--      unregistered athletes via esta vista. Si la UX lo requiere,
--      ampliar esa policy en migracion aparte.
--   2) parent_name / parent_email: si el padre NO es school_member,
--      el LEFT JOIN profiles no resuelve (RLS) y caen a los campos
--      _temp de children. No rompe, solo cambia el valor mostrado.
--
-- TESTING POST-DEPLOY
--   - Login escuela X -> StudentsPage ve solo sus atletas (no de Y).
--   - Login coach -> ve solo atletas de sus teams.
--   - Login padre -> ve solo sus hijos.
--   - Anon -> ve 0 filas.
--   - Verificar unregistered_athletes con cada rol staff.
--
-- DEFINICION
--   Es la misma que devuelve pg_get_viewdef('public.school_athletes')
--   al 2026-05-11. No se cambia el SELECT, solo se agrega
--   WITH (security_invoker = true).
-- ============================================================

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
    ( SELECT e.id
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.child_id = c.id AND e.status = 'active'::text AND (e.team_id IS NOT NULL OR e.offering_plan_id IS NOT NULL))) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             LIMIT 1), 0::numeric) + COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             LIMIT 1), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    COALESCE(( SELECT py.status
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id
          ORDER BY py.created_at DESC
         LIMIT 1),
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.child_id = c.id AND e.status = 'active'::text)) THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    ( SELECT py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id
          ORDER BY py.created_at DESC
         LIMIT 1) AS payment_due_date
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(( SELECT t.branch_id
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1), sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    ( SELECT e.id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.user_id = pr.id AND e.status = 'active'::text AND (e.team_id IS NOT NULL OR e.offering_plan_id IS NOT NULL))) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             LIMIT 1), 0::numeric) + COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             LIMIT 1), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = (( SELECT t.branch_id
                   FROM enrollments e
                     JOIN teams t ON t.id = e.team_id
                  WHERE e.user_id = pr.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
                 LIMIT 1))), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
    COALESCE(( SELECT py.status
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id
          ORDER BY py.created_at DESC
         LIMIT 1),
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.user_id = pr.id AND e.status = 'active'::text)) THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    ( SELECT py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id
          ORDER BY py.created_at DESC
         LIMIT 1) AS payment_due_date
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text AND sm.status = 'active'::text
UNION ALL
 SELECT ua.id,
    ua.full_name,
    NULL::text AS avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    ( SELECT e.id
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND (e.team_id IS NOT NULL OR e.offering_plan_id IS NOT NULL))) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             LIMIT 1), 0::numeric) + COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             LIMIT 1), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         LIMIT 1) AS plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
    COALESCE(( SELECT py.status
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id
          ORDER BY py.created_at DESC
         LIMIT 1),
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments e
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text)) THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    ( SELECT py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id
          ORDER BY py.created_at DESC
         LIMIT 1) AS payment_due_date
   FROM unregistered_athletes ua
  WHERE ua.linked_profile_id IS NULL;


COMMENT ON VIEW public.school_athletes IS
    'Vista unificada de atletas: children + adult profiles (school_members role=athlete) + unregistered_athletes. SECURITY INVOKER desde 2026-05-11 (fix Linter Fase 2). RLS de tablas base manda. Riesgos conocidos en migracion 20260511000012.';


-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';
