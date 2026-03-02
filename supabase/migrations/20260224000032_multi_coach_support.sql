-- Create a junction table for multiple coaches per team
CREATE TABLE IF NOT EXISTS team_coaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES school_staff(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, coach_id)
);

-- Index for faster filtering by coach
CREATE INDEX IF NOT EXISTS idx_team_coaches_coach_id ON team_coaches(coach_id);
CREATE INDEX IF NOT EXISTS idx_team_coaches_team_id ON team_coaches(team_id);

-- Migrate existing coach_id data from teams table
INSERT INTO team_coaches (team_id, coach_id, school_id)
SELECT id, coach_id, school_id 
FROM teams 
WHERE coach_id IS NOT NULL
ON CONFLICT (team_id, coach_id) DO NOTHING;

-- Enable RLS
ALTER TABLE IF EXISTS public.team_coaches ENABLE ROW LEVEL SECURITY;

-- Simple policies for team_coaches
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'DROP POLICY IF EXISTS "Enable all for authenticated users" ON team_coaches;'; END IF; END $wrap$;
DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "Enable all for authenticated users" ON team_coaches
    FOR ALL USING (auth.role() = ''authenticated'');'; END IF; END $wrap$;
