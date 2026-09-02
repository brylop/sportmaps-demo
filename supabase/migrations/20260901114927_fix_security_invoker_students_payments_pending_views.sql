-- =============================================================================
-- 20260901114927_fix_security_invoker_students_payments_pending_views.sql
-- Autor: brylop   Fecha: 2026-09-01   Versión anterior: 20260901112643
-- Objetivo: agregar WITH (security_invoker = true) a 4 vistas que nunca lo
-- tuvieron y que el linter de Supabase NO reporta como security_definer_view
-- (no está claro por qué — posiblemente el advisor no las re-escaneó todavía).
--
-- CÓMO APARECIERON
--   Al armar el invariante I6 (ver docs/auditoria-seguridad-2026-08-14.md §4)
--   para atrapar la próxima regresión de school_athletes, la query de
--   diagnóstico encontró 12 vistas más en el mismo estado (definer de facto +
--   GRANT a anon/authenticated). 8 son de sensibilidad baja o ya
--   intencionalmente públicas (school_public_profile, school_detail_view,
--   school_ratings — schools/reviews/offerings ya tienen policy pública propia;
--   teams_full_view, team_capacity, class_capacity, poll_sessions_summary — sin
--   PII; public_staff — duplicado legacy de v_school_staff_publico, menor
--   severidad, se deja para otra pasada). Las 4 de esta migración leen
--   children/payments/profiles — las MISMAS tablas base que school_athletes,
--   ya endurecidas a solo-staff/parent/self — y sin NINGÚN filtro de escuela:
--
--   students:
--     medical_info, emergency_contact, parent_email, parent_phone de TODOS
--     los niños de TODAS las escuelas. Único consumidor encontrado
--     (bff/src/routes/students.ts:604) selecciona columnas que no existen en
--     esta vista (first_name/last_name/document_id) — ya está roto o es
--     código muerto; de cualquier forma usa el cliente service_role, que
--     bypassa RLS igual con o sin security_invoker, así que este fix no lo
--     afecta en ningún sentido.
--   pending_payments / payments_with_installments:
--     fila completa de payments (montos, receipt_url, wompi_id, reference,
--     child_name, parent_name, school_name) de todo pago pending/overdue de
--     toda la plataforma. Cero consumidores encontrados en frontend/BFF.
--   pending_athletes:
--     full_name/phone/email de cualquier profile con membresía 'pending' en
--     cualquier escuela. Cero consumidores encontrados.
--
-- FIX
--   CREATE OR REPLACE VIEW con el mismo SELECT + WITH (security_invoker=true).
--   Cero cambios de columnas o lógica.
--
-- COBERTURA RLS (ya verificada en vivo para school_athletes, mismas tablas):
--   children/payments/profiles no dan nada a anon (todo depende de
--   auth.uid()/staff_school_ids()). anon → 0 filas. Staff/padre/atleta
--   autenticado sigue viendo exactamente lo suyo vía las policies existentes.
--
-- TESTING POST-DEPLOY:
--   - anon (sin sesión) → select * from students/pending_payments/
--     payments_with_installments/pending_athletes devuelve 0 filas.
--   - GET /api/v1/students (BFF, service_role) sigue respondiendo igual que
--     antes de esta migración (bypassa RLS por service_role, no por vista).
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.students
WITH (security_invoker = true) AS
 SELECT c.id,
    c.full_name,
    c.date_of_birth,
    c.avatar_url,
    c.school_id,
    c.branch_id,
    c.parent_id,
    c.team_id,
    c.grade,
    c.medical_info,
    c.emergency_contact,
    c.created_at,
    c.updated_at,
    c.is_active,
        CASE
            WHEN c.is_active THEN 'active'::text
            ELSE 'inactive'::text
        END AS status,
    p.full_name AS parent_name,
    p.phone AS parent_phone,
    p.avatar_url AS parent_avatar,
    p.email AS parent_email,
    e.id AS enrollment_id,
    e.status AS enrollment_status,
    e.start_date AS enrollment_date,
    t.name AS program_name,
    t.sport AS program_sport,
    0.0 AS price_monthly,
    b.name AS branch_name
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN enrollments e ON e.child_id = c.id AND e.status = 'active'::text
     LEFT JOIN teams t ON t.id = COALESCE(e.team_id, c.team_id)
     LEFT JOIN school_branches b ON b.id = c.branch_id;

COMMENT ON VIEW public.students IS
    'Listado de atletas (legacy, ver también public.school_athletes). '
    'SECURITY INVOKER agregado 2026-09-01 — nunca lo tuvo, encontrado al armar '
    'el invariante I6 tras la regresión de school_athletes. RLS de tablas base manda.';

CREATE OR REPLACE VIEW public.pending_payments
WITH (security_invoker = true) AS
 SELECT p.id,
    p.parent_id,
    p.amount,
    p.concept,
    p.due_date,
    p.payment_date,
    p.status,
    p.receipt_number,
    p.receipt_url,
    p.created_at,
    p.updated_at,
    p.payment_type,
    p.subscription_start_date,
    p.subscription_end_date,
    p.payment_method,
    p.school_id,
    p.child_id,
    p.coach_id,
    p.team_id,
    p.branch_id,
    p.approved_by,
    p.approved_at,
    p.rejection_reason,
    p.reference,
    p.wompi_id,
    p.amount_paid,
    c.full_name AS child_name,
    sc.name AS school_name,
    pr.full_name AS parent_name
   FROM payments p
     LEFT JOIN children c ON c.id = p.child_id
     LEFT JOIN schools sc ON sc.id = p.school_id
     LEFT JOIN profiles pr ON pr.id = p.parent_id
  WHERE p.status = ANY (ARRAY['pending'::text, 'overdue'::text]);

COMMENT ON VIEW public.pending_payments IS
    'Pagos pending/overdue con nombre de hijo/escuela/padre resuelto. '
    'SECURITY INVOKER agregado 2026-09-01 — nunca lo tuvo, sin consumidor '
    'conocido en frontend/BFF. RLS de tablas base manda.';

CREATE OR REPLACE VIEW public.payments_with_installments
WITH (security_invoker = true) AS
 SELECT p.id,
    p.school_id,
    p.branch_id,
    p.parent_id,
    p.child_id,
    p.team_id,
    p.coach_id,
    p.concept,
    p.amount,
    p.amount_paid,
    p.due_date,
    p.payment_date,
    p.status,
    p.payment_type,
    p.payment_method,
    p.subscription_start_date,
    p.subscription_end_date,
    p.reference,
    p.wompi_id,
    p.receipt_number,
    p.receipt_url,
    p.approved_by,
    p.approved_at,
    p.rejection_reason,
    p.created_at,
    p.updated_at,
    p.amount - COALESCE(p.amount_paid, 0::numeric) AS balance_pending,
    round(COALESCE(p.amount_paid, 0::numeric) / NULLIF(p.amount, 0::numeric) * 100::numeric, 1) AS pct_paid,
    count(i.id) AS installments_count,
    count(i.id) FILTER (WHERE i.status = 'pending_review'::text) AS installments_pending,
    count(i.id) FILTER (WHERE i.status = 'approved'::text) AS installments_approved,
    count(i.id) FILTER (WHERE i.status = 'rejected'::text) AS installments_rejected,
    bool_or(i.orc_mismatch_reason IS NOT NULL AND i.status = 'pending_review'::text) AS has_orc_warnings
   FROM payments p
     LEFT JOIN payment_installments i ON i.payment_id = p.id
  GROUP BY p.id;

COMMENT ON VIEW public.payments_with_installments IS
    'Pagos con agregados de cuotas (installments). '
    'SECURITY INVOKER agregado 2026-09-01 — nunca lo tuvo, sin consumidor '
    'conocido en frontend/BFF. RLS de tablas base manda.';

CREATE OR REPLACE VIEW public.pending_athletes
WITH (security_invoker = true) AS
 SELECT p.id AS profile_id,
    p.full_name,
    p.phone,
    p.email,
    p.created_at AS registered_at,
    sm.school_id,
    sm.id AS member_id,
    sm.status AS member_status
   FROM profiles p
     JOIN school_members sm ON sm.profile_id = p.id
  WHERE sm.status = 'pending'::text AND NOT (EXISTS ( SELECT 1
           FROM enrollments e
          WHERE e.user_id = p.id AND e.school_id = sm.school_id AND e.status = 'active'::text))
  ORDER BY p.created_at DESC;

COMMENT ON VIEW public.pending_athletes IS
    'Profiles con membresía pending sin enrollment activo. '
    'SECURITY INVOKER agregado 2026-09-01 — nunca lo tuvo, sin consumidor '
    'conocido en frontend/BFF. RLS de tablas base manda.';

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';

COMMIT;
