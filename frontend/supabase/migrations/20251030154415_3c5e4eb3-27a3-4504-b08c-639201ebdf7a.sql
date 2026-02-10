-- Table: teams (equipos del coach)
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  age_group TEXT,
  season TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Policies for teams
DO $$ BEGIN
  CREATE POLICY "Coaches can view own teams" ON public.teams FOR SELECT USING (auth.uid() = coach_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches can create own teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = coach_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches can update own teams" ON public.teams FOR UPDATE USING (auth.uid() = coach_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: team_members (roster de jugadores)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  player_number INTEGER,
  position TEXT,
  parent_contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policies for team_members
DO $$ BEGIN
  CREATE POLICY "Coaches can view team members" ON public.team_members FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches can manage team members" ON public.team_members FOR ALL USING (EXISTS (
    SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: training_sessions (sesiones de entrenamiento)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for training_sessions
DO $$ BEGIN
  CREATE POLICY "Coaches can manage sessions" ON public.training_sessions FOR ALL USING (EXISTS (
    SELECT 1 FROM public.teams WHERE teams.id = training_sessions.team_id AND teams.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: session_attendance (asistencia por sesión)
CREATE TABLE IF NOT EXISTS public.session_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  player_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- Policies for session_attendance
DO $$ BEGIN
  CREATE POLICY "Coaches can manage attendance" ON public.session_attendance FOR ALL USING (EXISTS (
    SELECT 1 FROM public.training_sessions ts JOIN public.teams t ON t.id = ts.team_id
    WHERE ts.id = session_attendance.session_id AND t.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: match_results (resultados de partidos)
CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  match_date DATE NOT NULL,
  opponent TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  is_home BOOLEAN NOT NULL DEFAULT true,
  match_type TEXT NOT NULL CHECK (match_type IN ('league', 'friendly', 'tournament')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- Policies for match_results
DO $$ BEGIN
  CREATE POLICY "Coaches can manage results" ON public.match_results FOR ALL USING (EXISTS (
    SELECT 1 FROM public.teams WHERE teams.id = match_results.team_id AND teams.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: training_plans (planes de entrenamiento)
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  objectives TEXT NOT NULL,
  warmup TEXT,
  drills JSONB,
  notes TEXT,
  materials TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- Policies for training_plans
DO $$ BEGIN
  CREATE POLICY "Coaches can manage training plans" ON public.training_plans FOR ALL USING (EXISTS (
    SELECT 1 FROM public.teams WHERE teams.id = training_plans.team_id AND teams.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table: announcements (anuncios)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  team_id UUID,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('parents', 'players', 'both')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policies for announcements
DO $$ BEGIN
  CREATE POLICY "Coaches can create announcements" ON public.announcements FOR INSERT WITH CHECK (auth.uid() = coach_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches can view own announcements" ON public.announcements FOR SELECT USING (auth.uid() = coach_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;