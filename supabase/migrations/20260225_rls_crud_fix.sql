-- RLS CRUD FIXES - 2026-02-25
-- Purpose: Restore and enhance RLS policies for core modules where CRUD was failing.

-- 1. UTILITY: Ensure helper functions are available
-- (These should already exist, but ensuring they are usable in policies)

-- 2. ACADEMIC & CLASSES
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classes_admin_all" ON classes;
CREATE POLICY "classes_admin_all" ON classes
    FOR ALL USING (is_school_admin(school_id));

DROP POLICY IF EXISTS "classes_coach_read" ON classes;
CREATE POLICY "classes_coach_read" ON classes
    FOR SELECT USING (is_school_coach(school_id));

-- 3. ATTENDANCE
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_admin_all" ON attendance;
CREATE POLICY "attendance_admin_all" ON attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM children 
            WHERE children.id = attendance.child_id 
            AND is_school_admin(children.school_id)
        )
    );

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_records_admin_all" ON attendance_records;
CREATE POLICY "attendance_records_admin_all" ON attendance_records
    FOR ALL USING (is_school_admin(school_id));

-- 4. PERFORMANCE & PROGRESS
ALTER TABLE academic_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academic_progress_admin_all" ON academic_progress;
CREATE POLICY "academic_progress_admin_all" ON academic_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM children 
            WHERE children.id = academic_progress.child_id 
            AND is_school_admin(children.school_id)
        )
    );

DROP POLICY IF EXISTS "academic_progress_parent_read" ON academic_progress;
CREATE POLICY "academic_progress_parent_read" ON academic_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM children 
            WHERE children.id = academic_progress.child_id 
            AND children.parent_id = auth.uid()
        )
    );

-- 5. TEAMS & SESSIONS
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_sessions_admin_all" ON training_sessions;
CREATE POLICY "training_sessions_admin_all" ON training_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams 
            WHERE teams.id = training_sessions.team_id 
            AND is_school_admin(teams.school_id)
        )
    );

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_results_admin_all" ON match_results;
CREATE POLICY "match_results_admin_all" ON match_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams 
            WHERE teams.id = match_results.team_id 
            AND is_school_admin(teams.school_id)
        )
    );

-- 6. HEALTH & WELLNESS (Re-validating)
ALTER TABLE wellness_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wellness_evaluations_access" ON wellness_evaluations;
CREATE POLICY "wellness_evaluations_access" ON wellness_evaluations
    FOR ALL USING (
        auth.uid() = professional_id 
        OR auth.uid() = athlete_id
        OR EXISTS (
            SELECT 1 FROM children 
            WHERE children.id = wellness_evaluations.athlete_id 
            AND (children.parent_id = auth.uid() OR is_school_admin(children.school_id))
        )
    );

-- 7. ACTIVITIES & EVENTS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_access" ON activities;
CREATE POLICY "activities_access" ON activities
    FOR ALL USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM teams 
            WHERE teams.id = activities.program_id 
            AND is_school_admin(teams.school_id)
        )
    );

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_all_access" ON events;
CREATE POLICY "events_all_access" ON events
    FOR ALL USING (
        creator_id = auth.uid() 
        OR is_platform_admin()
    );

DROP POLICY IF EXISTS "events_public_read" ON events;
CREATE POLICY "events_public_read" ON events
    FOR SELECT USING (status = 'published' OR status = 'ongoing');

-- 8. SCHOOL MEMBERS (Enable CRUD for Admins if missing)
DROP POLICY IF EXISTS "school_members_admin_crud" ON school_members;
CREATE POLICY "school_members_admin_crud" ON school_members
    FOR ALL USING (is_school_admin(school_id));
