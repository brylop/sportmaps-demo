-- ===========================================
-- WELLNESS MODULE TABLES
-- ===========================================

-- Table for health records / patient files
CREATE TABLE public.health_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    athlete_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    record_type TEXT NOT NULL, -- 'initial', 'follow_up', 'injury', 'nutrition'
    diagnosis TEXT,
    treatment TEXT,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for wellness evaluations
CREATE TABLE public.wellness_evaluations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    health_record_id UUID REFERENCES public.health_records(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL,
    athlete_id UUID NOT NULL,
    evaluation_type TEXT NOT NULL, -- 'physical', 'nutritional', 'psychological', 'performance'
    evaluation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metrics JSONB DEFAULT '{}'::jsonb, -- flexible metrics storage
    score INTEGER CHECK (score >= 0 AND score <= 100),
    recommendations TEXT,
    follow_up_date DATE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for wellness appointments
CREATE TABLE public.wellness_appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL,
    athlete_id UUID,
    athlete_name TEXT, -- for non-registered athletes
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    service_type TEXT NOT NULL, -- 'evaluation', 'therapy', 'nutrition', 'follow_up'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
    notes TEXT,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===========================================
-- RLS POLICIES FOR WELLNESS TABLES
-- ===========================================

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_appointments ENABLE ROW LEVEL SECURITY;

-- Health Records: Professionals can manage their own records
CREATE POLICY "Wellness professionals can manage own health records"
ON public.health_records
FOR ALL
USING (auth.uid() = professional_id);

-- Health Records: Athletes can view their own records
CREATE POLICY "Athletes can view own health records"
ON public.health_records
FOR SELECT
USING (auth.uid() = athlete_id);

-- Evaluations: Professionals can manage their own evaluations
CREATE POLICY "Wellness professionals can manage own evaluations"
ON public.wellness_evaluations
FOR ALL
USING (auth.uid() = professional_id);

-- Evaluations: Athletes can view their own evaluations
CREATE POLICY "Athletes can view own evaluations"
ON public.wellness_evaluations
FOR SELECT
USING (auth.uid() = athlete_id);

-- Appointments: Professionals can manage their own appointments
CREATE POLICY "Wellness professionals can manage own appointments"
ON public.wellness_appointments
FOR ALL
USING (auth.uid() = professional_id);

-- Appointments: Athletes can view their own appointments
CREATE POLICY "Athletes can view own appointments"
ON public.wellness_appointments
FOR SELECT
USING (auth.uid() = athlete_id);

-- ===========================================
-- TRIGGERS FOR updated_at
-- ===========================================

CREATE TRIGGER update_health_records_updated_at
BEFORE UPDATE ON public.health_records
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_wellness_evaluations_updated_at
BEFORE UPDATE ON public.wellness_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_wellness_appointments_updated_at
BEFORE UPDATE ON public.wellness_appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_health_records_professional ON public.health_records(professional_id);
CREATE INDEX idx_health_records_athlete ON public.health_records(athlete_id);
CREATE INDEX idx_wellness_evaluations_professional ON public.wellness_evaluations(professional_id);
CREATE INDEX idx_wellness_evaluations_athlete ON public.wellness_evaluations(athlete_id);
CREATE INDEX idx_wellness_appointments_professional ON public.wellness_appointments(professional_id);
CREATE INDEX idx_wellness_appointments_date ON public.wellness_appointments(appointment_date);