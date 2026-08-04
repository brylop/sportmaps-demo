-- ============================================================
-- SPORTMAPS — school_athletes: el plan que se muestra deja de ser aleatorio
-- ------------------------------------------------------------
-- Dos defectos de la vista, ambos con consecuencia en dinero:
--
--  1. NO DETERMINISMO. Cada subquery de plan/equipo hace `LIMIT 1` SIN
--     `ORDER BY`. Con un atleta que arrastra dos inscripciones activas con plan
--     (drift real: 3 atletas hoy en la BD), `offering_plan_id`, `plan_name`,
--     `plan_monthly_fee` y `price_monthly` devuelven el plan que Postgres saque
--     primero — y puede cambiar entre refrescos. Es el "el plan no se agrega y
--     después aparece" que reportó la escuela: la tabla y el editor mostraban
--     planes distintos del mismo atleta. Se fija `ORDER BY e.created_at`
--     (gana la inscripción más antigua, la misma que conserva el BFF al
--     deduplicar).
--
--  2. FUGA ENTRE ESCUELAS EN LA RAMA DE ADULTOS. Los subqueries filtran por
--     `e.user_id = pr.id` pero NUNCA por escuela, mientras la fila sí es por
--     membresía (`school_members`). Un adulto inscrito en dos escuelas mostraba
--     en la escuela A el plan, la cuota y el equipo de la escuela B (hoy hay 2
--     adultos así). Se añade `e.school_id = sm.school_id` a las 22
--     referencias de esa rama. La rama de menores NO se toca: ahí la ausencia de
--     filtro es intencional (soporte multi-escuela de `children.school_id`).
--
-- Único cambio vs 20260730000001: los 48 `ORDER BY e.created_at` y el
-- filtro de escuela en la rama de adultos. Ninguna columna cambia de tipo ni de
-- nombre.
--
-- Migración nueva (timestamp posterior). Fecha: 2026-07-30
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
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT
             CASE WHEN EXISTS ( SELECT 1
                      FROM enrollments ep
                     WHERE ep.child_id = c.id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)
                  -- Con plan activo el equipo es SOLO roster: cuota 0 SIEMPRE
                  -- (el monthly_fee de la fila fusionada es el del plan).
                  THEN 0::numeric
                  ELSE COALESCE(e.monthly_fee, t.price_monthly, 0::numeric)
             END
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.child_id = c.id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.child_id = c.id AND ep.status = 'active'::text AND ep.team_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
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
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    ( SELECT e.id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT
             CASE WHEN EXISTS ( SELECT 1
                      FROM enrollments ep
                     WHERE ep.user_id = pr.id AND ep.school_id = sm.school_id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)
                  THEN 0::numeric
                  ELSE COALESCE(e.monthly_fee, t.price_monthly, 0::numeric)
             END
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.user_id = pr.id AND ep.school_id = sm.school_id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.user_id = pr.id AND ep.school_id = sm.school_id AND ep.status = 'active'::text AND ep.team_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = (( SELECT t.branch_id
                   FROM enrollments e
                     JOIN teams t ON t.id = e.team_id
                  WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
                 ORDER BY e.created_at
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
              WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text)) THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    ( SELECT py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id
          ORDER BY py.created_at DESC
         LIMIT 1) AS payment_due_date
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
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
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_id,
    'active'::text AS enrollment_status,
    ( SELECT e.team_id
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrolled_team_id,
    ( SELECT e.offering_plan_id
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS offering_plan_id,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS enrollment_start_date,
    ( SELECT e.start_date
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS plan_start_date,
    COALESCE(( SELECT
             CASE WHEN EXISTS ( SELECT 1
                      FROM enrollments ep
                     WHERE ep.unregistered_athlete_id = ua.id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)
                  THEN 0::numeric
                  ELSE COALESCE(e.monthly_fee, t.price_monthly, 0::numeric)
             END
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS team_monthly_fee,
    COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1), 0::numeric) AS plan_monthly_fee,
    ( SELECT e.sessions_used
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS sessions_used,
    ( SELECT e.secondary_sessions_used
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS secondary_sessions_used,
    ( SELECT e.expires_at
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS expires_at,
    ( SELECT t.name
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_name,
    ( SELECT t.sport
           FROM enrollments e
             JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
         ORDER BY e.created_at
         LIMIT 1) AS team_sport,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.unregistered_athlete_id = ua.id AND ep.status = 'active'::text AND ep.offering_plan_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, op.price) AS "coalesce"
               FROM enrollments e
                 JOIN offering_plans op ON op.id = e.offering_plan_id
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            WHEN (EXISTS ( SELECT 1
               FROM enrollments ep
              WHERE ep.unregistered_athlete_id = ua.id AND ep.status = 'active'::text AND ep.team_id IS NOT NULL)) THEN COALESCE(( SELECT COALESCE(e.monthly_fee, t.price_monthly) AS "coalesce"
               FROM enrollments e
                 JOIN teams t ON t.id = e.team_id
              WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
             ORDER BY e.created_at
             LIMIT 1), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    ( SELECT op.name
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
         ORDER BY e.created_at
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

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';
