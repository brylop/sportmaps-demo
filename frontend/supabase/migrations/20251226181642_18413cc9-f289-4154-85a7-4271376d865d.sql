-- ============================================
-- TABLAS FALTANTES: training_logs y athlete_stats
-- ============================================

-- Tabla para registrar entrenamientos individuales de atletas
CREATE TABLE IF NOT EXISTS public.training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL,
    training_date DATE NOT NULL DEFAULT CURRENT_DATE,
    exercise_type TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    intensity TEXT CHECK (intensity IN ('low', 'medium', 'high', 'max')) DEFAULT 'medium',
    calories_burned INTEGER,
    notes TEXT,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla para métricas de rendimiento del atleta
CREATE TABLE IF NOT EXISTS public.athlete_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL,
    stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
    stat_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_stats ENABLE ROW LEVEL SECURITY;

-- Políticas para training_logs
CREATE POLICY "Athletes can view own training logs"
ON public.training_logs FOR SELECT
USING (auth.uid() = athlete_id OR is_demo_user(auth.uid()));

CREATE POLICY "Athletes can create own training logs"
ON public.training_logs FOR INSERT
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can update own training logs"
ON public.training_logs FOR UPDATE
USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can delete own training logs"
ON public.training_logs FOR DELETE
USING (auth.uid() = athlete_id);

-- Políticas para athlete_stats
CREATE POLICY "Athletes can view own stats"
ON public.athlete_stats FOR SELECT
USING (auth.uid() = athlete_id OR is_demo_user(auth.uid()));

CREATE POLICY "Athletes can manage own stats"
ON public.athlete_stats FOR ALL
USING (auth.uid() = athlete_id);

-- Triggers para updated_at
CREATE TRIGGER update_training_logs_updated_at
    BEFORE UPDATE ON public.training_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_athlete_stats_updated_at
    BEFORE UPDATE ON public.athlete_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();