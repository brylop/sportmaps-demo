-- =============================================================================
-- 20260916103807_fix_school_athletes_security_invoker_regression2.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260916102444
-- Objetivo: `npm run seguridad:invariantes` (F5 del spec de descuentos) marcó
-- I6_vista_definer_expuesta sobre public.school_athletes — reloptions venía
-- en NULL, sin `security_invoker=true`.
-- =============================================================================
--
-- LA REGRESIÓN (segunda vez)
--
-- `security_invoker=true` en esta vista NO es un ALTER VIEW aparte: viaja
-- como `WITH (security_invoker = true)` DENTRO del propio CREATE OR REPLACE
-- VIEW (ver 20260901112643, que ya documentó esto la primera vez, y
-- 20260903151225, que lo repite a propósito). Cualquier CREATE OR REPLACE
-- VIEW posterior que no repita esa cláusula la borra en silencio — no hay
-- error, no hay warning, la vista simplemente vuelve a correr con los
-- privilegios del *definer* en vez de el *invoker* (RLS de las tablas base
-- deja de aplicar para quien consulta la vista).
--
-- `20260915113256_fix_school_athletes_becado_no_pending.sql` (un día antes de
-- este módulo, mismo autor) reescribió la vista para el fix de payment_status
-- y NO repitió la cláusula — ese es el commit que reintrodujo la regresión.
-- `20260916102444_discount_type_school_athletes_view.sql` (F3 de este mismo
-- módulo) copió esa misma definición para agregar discount_type y heredó el
-- mismo olvido, sin darse cuenta. `seguridad:invariantes` es la única razón
-- por la que se detectó ahora en vez de en el próximo audit.
--
-- FIX
-- Mismo cuerpo vigente de 20260916102444 (con discount_type), ahora con
-- `WITH (security_invoker = true)` repetido en el CREATE OR REPLACE VIEW.
-- Ninguna columna cambia — solo el reloption.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Repetir SIEMPRE `WITH (security_invoker = true)` en cualquier
--     CREATE OR REPLACE VIEW futuro sobre school_athletes — no es opcional,
--     es la única forma en que Postgres lo recuerda entre reemplazos.
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
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE COALESCE(c.monthly_fee, 0::numeric)
            END
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN (pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0) = 0)
                  OR (pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0) = 0)
                    THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    c.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
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
            e.discount_type,
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
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
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
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN (pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0) = 0)
                  OR (pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0) = 0)
                    THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    sm.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
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
            e.discount_type,
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
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
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
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN (pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0) = 0)
                  OR (pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0) = 0)
                    THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    ua.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
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
            e.discount_type,
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
  'Vista unificada de atletas (child/adult/unregistered) para SchoolStudentsManagementPage. '
  'enrollment_id = COALESCE(inscripción con equipo, inscripción con plan). '
  'fee_is_manual/fee_reason pasan del enrollment que gobierna el precio (plan > equipo) — '
  'permiten mostrar el badge "Becado"/cuota negociada. payment_status no cae a ''pending'' '
  'cuando ese mismo enrollment es cuota manual en 0. hide_money (20260903144504) oculta cifras a '
  'coaches sin permiso financiero. dorsal (20260903151225). discount_type (20260916101241/102444) '
  'distingue primos/referido dentro del mismo mecanismo manual, para el badge y para que la UI '
  'bloquee marcar un segundo tipo (uno solo por atleta). Hermanos NO viaja acá: se calcula en '
  'vivo en open_month, nunca se guarda en el enrollment.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Verificación (correr después de aplicar):
--   SELECT relname, reloptions FROM pg_class WHERE relname = 'school_athletes';
--   -- reloptions debe traer {security_invoker=true}
--   npm run seguridad:invariantes   -- I6_vista_definer_expuesta ya no debe listar school_athletes
-- =============================================================================
