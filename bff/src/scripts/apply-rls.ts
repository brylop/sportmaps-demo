import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://luebjarufsiadojhvxgi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Restore Missing RLS Policies
BEGIN;

-- 1. school_staff policies
ALTER TABLE public.school_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff: select school" ON public.school_staff;
CREATE POLICY "Staff: select school" ON public.school_staff FOR SELECT USING (school_id = ANY(public.user_school_ids()));
DROP POLICY IF EXISTS "Staff: manage admin" ON public.school_staff;
CREATE POLICY "Staff: manage admin" ON public.school_staff FOR ALL USING (public.is_school_admin(school_id));

-- 2. team_coaches policies
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team Coaches: select school" ON public.team_coaches;
CREATE POLICY "Team Coaches: select school" ON public.team_coaches FOR SELECT USING (school_id = ANY(public.user_school_ids()));
DROP POLICY IF EXISTS "Team Coaches: manage admin" ON public.team_coaches;
CREATE POLICY "Team Coaches: manage admin" ON public.team_coaches FOR ALL USING (public.is_school_admin(school_id));

-- 3. team_branches policies
ALTER TABLE public.team_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team Branches: select school" ON public.team_branches;
CREATE POLICY "Team Branches: select school" ON public.team_branches FOR SELECT USING (school_id = ANY(public.user_school_ids()));
DROP POLICY IF EXISTS "Team Branches: manage admin" ON public.team_branches;
CREATE POLICY "Team Branches: manage admin" ON public.team_branches FOR ALL USING (public.is_school_admin(school_id));

COMMIT;
`;

// Note: This requires a custom 'execute_sql' RPC if we want to run raw SQL.
// If it doesn't exist, we will have to ask the user.
async function run() {
    console.log('Applying RLS policies...');
    try {
        // We attempt to call the execute_sql RPC which is often present in these templates
        const { data, error } = await (supabase as any).rpc('execute_sql', { sql });

        if (error) {
            console.error('Error applying SQL:', error);
            // If the RPC doesn't exist, this will fail.
        } else {
            console.log('Policies applied successfully!');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();
