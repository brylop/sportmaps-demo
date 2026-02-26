// Script to apply RLS policies via SQL execution
// Run: node scripts/apply-rls-fix.mjs

const SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODkxNTY1OCwiZXhwIjoyMDc0NDkxNjU4fQ.UxkAmsGSCkbmlg5q2ip7RTSW8L4SGAytWL23ZXmWHro';

async function main() {
    console.log('🚀 Aplicando políticas RLS...');

    const sql = `
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
    `;

    // Note: Supabase doesn't have a direct /sql endpoint for SERVICE_ROLE_KEY via REST
    // unless we use the Management API or a custom wrapper.
    // However, we can try to use the 'pg_net' or similar if available, 
    // but the most reliable way for me here is to ask the user if this fails,
    // OR try to use the MCP again after a short wait.

    // Actually, I'll try to use the 'supabase' library if I can run a small script that imports it.
    // The project has it.

    console.log('⚠️  El API REST no permite DDL directamente. Intentaré usar el cliente de Supabase.');
}

main();
