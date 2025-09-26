-- SportMaps Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (authentication + profile)
CREATE TABLE spm_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'player', -- player|coach|parent|admin
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clubs / Organizations
CREATE TABLE spm_clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  city TEXT,
  country TEXT,
  created_by UUID REFERENCES spm_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Teams
CREATE TABLE spm_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES spm_clubs(id),
  name TEXT NOT NULL,
  category TEXT, -- U12, Adulto, Femenino, etc.
  coach_id UUID REFERENCES spm_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Players (extended profile)
CREATE TABLE spm_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES spm_users(id) UNIQUE,
  nickname TEXT,
  birthdate DATE,
  position TEXT,
  height_cm INT,
  weight_kg INT,
  dominant_foot TEXT,
  statistics JSONB DEFAULT '{}'::jsonb,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Team Memberships
CREATE TABLE spm_team_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES spm_teams(id),
  player_id UUID REFERENCES spm_players(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'player' -- player|captain|substitute
);

-- Events (training / matches / tournaments)
CREATE TABLE spm_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES spm_teams(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- training|match|tournament
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  external_ref JSONB,
  created_by UUID REFERENCES spm_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Matches / Results
CREATE TABLE spm_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES spm_events(id) UNIQUE,
  home_team_id UUID REFERENCES spm_teams(id),
  away_team_id UUID REFERENCES spm_teams(id),
  home_score SMALLINT,
  away_score SMALLINT,
  status TEXT DEFAULT 'scheduled', -- scheduled|live|finished|cancelled
  recorded_by UUID REFERENCES spm_users(id),
  recorded_at TIMESTAMP WITH TIME ZONE
);

-- Attendance
CREATE TABLE spm_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES spm_events(id),
  player_id UUID REFERENCES smp_players(id),
  status TEXT DEFAULT 'absent', -- present|late|absent|excused
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Player Stats (per match)
CREATE TABLE spm_player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES spm_matches(id),
  player_id UUID REFERENCES spm_players(id),
  stats JSONB DEFAULT '{}'::jsonb, -- {goals:0, assists:0, minutes:90,...}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscriptions / Payments
CREATE TABLE spm_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES spm_clubs(id),
  stripe_subscription_id TEXT,
  plan TEXT,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Notifications
CREATE TABLE spm_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES spm_users(id),
  title TEXT,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_spm_events_team_starts ON smp_events(team_id, starts_at);
CREATE INDEX idx_spm_matches_status ON smp_matches(status);
CREATE INDEX idx_spm_team_memberships_team ON spm_team_memberships(team_id);
CREATE INDEX idx_spm_notifications_user ON spm_notifications(user_id, read);

-- RLS Policies
ALTER TABLE spm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE spm_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spm_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE spm_players ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON spm_users
  FOR SELECT USING (auth.uid() = id::text);

CREATE POLICY "Users can update own profile" ON spm_users
  FOR UPDATE USING (auth.uid() = id::text);

-- Players can view their own data
CREATE POLICY "Players can view own data" ON spm_players
  FOR SELECT USING (auth.uid() = user_id::text);

CREATE POLICY "Players can update own data" ON spm_players
  FOR UPDATE USING (auth.uid() = user_id::text);