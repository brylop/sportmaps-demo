-- =============================================================================
-- 20260901112643_fix_school_athletes_security_invoker_regression.sql
-- Autor: brylop   Fecha: 2026-09-01   Versión anterior: 20260831191515
-- Objetivo: restaurar `WITH (security_invoker = true)` en public.school_athletes,
-- perdido silenciosamente en 20260827144226_fix_school_athletes_enrollment_id_plan_only.sql.
--
-- QUÉ PASÓ
--   La migración 20260511000012_school_athletes_security_invoker.sql cerró el
--   único ERROR del linter (security_definer_view) agregando
--   WITH (security_invoker = true) a esta vista, con testing explícito:
--   "Anon -> ve 0 filas". Un CREATE OR REPLACE VIEW no conserva reloptions si
--   la nueva definición no los repite — 20260827144226 hizo
--   `CREATE OR REPLACE VIEW public.school_athletes AS ...` (fix legítimo de
--   enrollment_id para atletas de plan-sin-equipo) sin repetir el WITH, y eso
--   revirtió la vista a SECURITY DEFINER de facto sin que ningún test lo
--   notara. Confirmado en vivo el 2026-09-01: la vista corre como `postgres`
--   (bypassa RLS) y `anon`/`authenticated` tienen SELECT por privilegio de
--   esquema (nunca revocado explícitamente) — cualquiera sin login puede leer
--   medical_info, parent_email, parent_phone y payment_status de TODOS los
--   niños de TODAS las escuelas. Ya estaba documentado como pendiente en
--   20260831095348_cerrar_brechas_seg22_seg1_seg2.sql (§4, SEG-2): "la tercera
--   vista que marca el linter, school_athletes, NO se toca acá: sigue
--   pendiente de resolver de verdad".
--
-- FIX
--   Se re-crea la vista con el SELECT actual (incluye el fix de enrollment_id
--   de 20260827144226 y todos los cambios posteriores — es exactamente lo que
--   devuelve pg_get_viewdef hoy) + WITH (security_invoker = true). No cambia
--   ninguna columna ni lógica de negocio.
--
-- COBERTURA RLS VERIFICADA EN VIVO (2026-09-01) — igual o mejor que en mayo:
--   children:    "Children: select staff/parent/coach" -> staff_school_ids()/
--                auth.uid()=parent_id/coach_school_ids(). Nada para anon.
--   payments:    "Payments: select staff/parent/athlete" -> staff_school_ids()/
--                parent_id/child_id de sus hijos/user_id=auth.uid(). Nada para anon.
--   enrollments: coach_team_ids()/user_id=auth.uid()/hijos del padre. Nada para anon.
--   profiles:    same-school members / auth.uid()=id. Nada para anon.
--   teams, offering_plans, school_branches: scoped a school member o admin.
--   anon no tiene fila que matchee ninguna de estas policies -> 0 filas, como
--   en el testing original.
--
-- RIESGO YA CONOCIDO (heredado del fix original, no nuevo de esta migración):
--   unregistered_athletes solo tiene policy ALL para roles staff
--   (admin/coach/staff) + schools.owner_id. Roles 'school_admin'/'organizer'/
--   'super_admin' sin ese rol de staff dejan de ver unregistered athletes vía
--   esta vista. Si la UX lo requiere, ampliar esa policy en migración aparte.
--
-- TESTING POST-DEPLOY (repetir el del 2026-05-11):
--   - Login escuela X -> StudentsPage ve solo sus atletas (no de Y).
--   - Login coach -> ve solo atletas de sus teams.
--   - Login padre -> ve solo sus hijos.
--   - Anon (sin sesión) -> select * from school_athletes devuelve 0 filas.
-- =============================================================================

BEGIN;

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
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
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
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
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
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
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
  WHERE ua.linked_profile_id IS NULL;

COMMENT ON VIEW public.school_athletes IS
    'Vista unificada de atletas: children + adult profiles (school_members role=athlete) + unregistered_athletes. '
    'SECURITY INVOKER restaurado 2026-09-01 (fix regresión de 20260827144226 — el CREATE OR REPLACE de ese día '
    'perdió el WITH(security_invoker=true) del fix original 20260511000012). RLS de tablas base manda. '
    'Riesgo conocido: unregistered_athletes vía roles no-staff (school_admin/organizer/super_admin) — heredado '
    'del fix original, ver 20260511000012.';

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';

COMMIT;
