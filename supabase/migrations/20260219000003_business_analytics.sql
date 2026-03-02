-- Migration: Business Analytics Views
-- Description: Adds views for financial health, student risk, and program performance.
-- Author: Antigravity
-- Date: 2026-02-19

-- ==============================================================================
-- 1. View: view_school_financial_health
-- Computes real vs projected income for the current month.
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_school_financial_health 
WITH (security_invoker = true) -- Enforce RLS based on the user querying the view
AS
SELECT 
    school_id,
    COUNT(id) FILTER (WHERE status = 'paid') as transactions_count,
    COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_collected,
    COALESCE(SUM(amount) FILTER (WHERE status IN ('pending')), 0) as total_outstanding,
    COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) as total_at_risk,
    CASE 
        WHEN SUM(amount) > 0 THEN 
            ROUND((SUM(amount) FILTER (WHERE status = 'paid') * 100.0 / SUM(amount)), 2)
        ELSE 0 
    END as collection_rate_percentage
FROM public.payments
WHERE created_at >= date_trunc('month', now())
GROUP BY school_id;

COMMENT ON VIEW public.view_school_financial_health IS 'Financial health overview for the current month per school.';

-- ==============================================================================
-- 2. View: view_student_risk_alert
-- Identifies students with high absence rate (>30%) in the last 30 days.
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_student_risk_alert 
WITH (security_invoker = true)
AS
SELECT 
    ar.child_id as student_id,
    c.full_name as student_name,
    c.school_id,
    COUNT(ar.id) as total_sessions,
    COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as total_absences,
    CASE 
        WHEN COUNT(ar.id) > 0 THEN 
            ROUND((COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::numeric / COUNT(ar.id) * 100), 2)
        ELSE 0 
    END as absence_rate
FROM public.attendance_records ar
JOIN public.children c ON ar.child_id = c.id
WHERE ar.attendance_date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY ar.child_id, c.id, c.school_id
HAVING (COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::float / NULLIF(COUNT(ar.id), 0)) > 0.3;

COMMENT ON VIEW public.view_student_risk_alert IS 'Students with >30% absence rate in the last 30 days.';

-- ==============================================================================
-- 3. View: view_program_performance
-- Top 5 most profitable programs.
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_program_performance 
WITH (security_invoker = true)
AS
SELECT 
    p.name as program_name,
    p.school_id,
    (
        SELECT COUNT(*) 
        FROM public.enrollments e 
        WHERE e.program_id = p.id AND e.status = 'active'
    ) as active_enrollments,
    COALESCE((
        SELECT SUM(t.amount)
        FROM public.payments t
        WHERE t.program_id = p.id AND t.status = 'paid'
    ), 0) as total_revenue
FROM public.programs p
ORDER BY total_revenue DESC
LIMIT 5;

COMMENT ON VIEW public.view_program_performance IS 'Top 5 programs by total revenue generated.';

-- ==============================================================================
-- 4. Permissions
-- ==============================================================================

-- Grant access to authenticated users (RLS will filter the data)
GRANT SELECT ON public.view_school_financial_health TO authenticated;
GRANT SELECT ON public.view_student_risk_alert TO authenticated;
GRANT SELECT ON public.view_program_performance TO authenticated;
