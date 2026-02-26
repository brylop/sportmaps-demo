-- Ensure RLS is enabled
ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

-- Re-create the general policy for authenticated users
DROP POLICY IF EXISTS "Enable all for authenticated users" ON team_coaches;
CREATE POLICY "Enable all for authenticated users" ON team_coaches
    FOR ALL USING (auth.role() = 'authenticated');

-- Also check team_branches
ALTER TABLE team_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON team_branches;
CREATE POLICY "Enable all for authenticated users" ON team_branches
    FOR ALL USING (auth.role() = 'authenticated');
