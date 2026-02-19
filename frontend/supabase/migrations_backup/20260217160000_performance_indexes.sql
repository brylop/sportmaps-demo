CREATE INDEX IF NOT EXISTS idx_school_members_composite_lookup ON public.school_members(school_id, profile_id, status);
CREATE INDEX IF NOT EXISTS idx_school_members_branch ON public.school_members(branch_id);
-- Fixed: admin_id -> owner_id
CREATE INDEX IF NOT EXISTS idx_schools_owner_id ON public.schools(owner_id);
-- Removed redundant children index
-- Fixed: is_read -> read (as per schema)
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_payments_date_range ON public.payments(school_id, created_at DESC);
-- Fixed: attendance_date -> date (as per schema)
CREATE INDEX IF NOT EXISTS idx_attendance_composite_report ON public.attendance_records(school_id, date);
