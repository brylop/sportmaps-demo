-- PERFORMANCE OPTIMIZATION AUDIT
-- Description: Add missing indexes for high-traffic RLS policies and joins identified during Production Readiness Audit.

-- 1. Optimize school_members Lookups (Critical for RLS)
-- Used by: check_is_school_member_safe, is_branch_admin
CREATE INDEX IF NOT EXISTS idx_school_members_composite_lookup 
ON public.school_members(school_id, profile_id, status);

CREATE INDEX IF NOT EXISTS idx_school_members_branch 
ON public.school_members(branch_id);

-- 2. Optimize Multi-tenant Queries on Schools
-- Used by: Dashboard stats, filtering
CREATE INDEX IF NOT EXISTS idx_schools_owner_id 
ON public.schools(admin_id); -- Ensure ownership checks are fast

-- 3. Optimize Children/Student Lookups
-- Used by: Parents viewing their children
CREATE INDEX IF NOT EXISTS idx_children_parent_lookup 
ON public.children(parent_id);

-- 4. Optimize Notification Fetching
-- Used by: Header notifications (polled frequently)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON public.notifications(user_id, is_read) 
WHERE is_read = false;

-- 5. Optimize Payments by Date (Reporting)
CREATE INDEX IF NOT EXISTS idx_payments_date_range 
ON public.payments(school_id, created_at DESC);

-- 6. Optimize Attendance Reporting
CREATE INDEX IF NOT EXISTS idx_attendance_composite_report
ON public.attendance_records(school_id, attendance_date);
