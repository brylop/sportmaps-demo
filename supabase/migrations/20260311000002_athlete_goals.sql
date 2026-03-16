-- ============================================================
-- MIGRACIÓN: Tabla athlete_goals
-- Fecha: 2026-03-11
-- Descripción: Tabla para objetivos/metas del atleta con CRUD
-- ============================================================

CREATE TABLE IF NOT EXISTS athlete_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_date DATE,
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'pending', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE athlete_goals ENABLE ROW LEVEL SECURITY;

-- El atleta solo ve sus propios objetivos
CREATE POLICY "athlete_goals_select_own" ON athlete_goals
  FOR SELECT USING (athlete_id = auth.uid());

CREATE POLICY "athlete_goals_insert_own" ON athlete_goals
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "athlete_goals_update_own" ON athlete_goals
  FOR UPDATE USING (athlete_id = auth.uid());

CREATE POLICY "athlete_goals_delete_own" ON athlete_goals
  FOR DELETE USING (athlete_id = auth.uid());

-- Índice
CREATE INDEX IF NOT EXISTS idx_athlete_goals_athlete ON athlete_goals(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_goals_status ON athlete_goals(status);
