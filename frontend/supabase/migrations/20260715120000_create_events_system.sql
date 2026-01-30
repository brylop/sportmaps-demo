-- =====================================================================
-- SPORTMAPS EVENTS SYSTEM - MVP Organizer
-- Tablas para gestión de eventos deportivos
-- =====================================================================

-- Agregar rol 'organizer' al enum user_role si no existe
DO $$ 
BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- TABLA: events (Eventos deportivos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_role TEXT NOT NULL CHECK (creator_role IN ('school', 'organizer')),
    
    -- Información básica
    title TEXT NOT NULL,
    description TEXT,
    sport TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'tournament' CHECK (event_type IN ('tournament', 'clinic', 'tryout', 'camp', 'match', 'training', 'other')),
    
    -- Fecha y hora
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    
    -- Ubicación con geo
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    
    -- Capacidad y precio
    capacity INTEGER DEFAULT 50,
    price DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'COP',
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'cancelled', 'completed')),
    registrations_open BOOLEAN DEFAULT true,
    
    -- Metadata
    image_url TEXT,
    notes TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: event_registrations (Inscripciones a eventos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    
    -- Información del inscrito (no requiere cuenta)
    participant_name TEXT NOT NULL,
    participant_email TEXT,
    participant_phone TEXT NOT NULL,
    participant_role TEXT DEFAULT 'athlete' CHECK (participant_role IN ('athlete', 'parent', 'coach', 'other')),
    participant_age INTEGER,
    
    -- Estado de la inscripción
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    -- Comprobante de pago
    payment_proof_url TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'rejected', 'not_required')),
    
    -- Notas
    notes TEXT,
    rejection_reason TEXT,
    
    -- Usuario registrado (opcional)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: event_telemetry (Métricas de eventos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.event_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('event_created', 'event_viewed', 'link_shared', 'registration_created', 'registration_approved')),
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- ÍNDICES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_events_creator ON public.events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_city ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_sport ON public.events(sport);
CREATE INDEX IF NOT EXISTS idx_events_geo ON public.events(lat, lng);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(status);

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_telemetry ENABLE ROW LEVEL SECURITY;

-- Políticas para events
CREATE POLICY "Anyone can view active events"
ON public.events FOR SELECT
USING (status = 'active' OR creator_id = auth.uid());

CREATE POLICY "Creators can manage own events"
ON public.events FOR ALL
USING (creator_id = auth.uid());

CREATE POLICY "Anyone can create events"
ON public.events FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para event_registrations
CREATE POLICY "Event creators can view registrations"
ON public.event_registrations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = event_registrations.event_id
        AND events.creator_id = auth.uid()
    )
);

CREATE POLICY "Anyone can create registrations"
ON public.event_registrations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Event creators can update registrations"
ON public.event_registrations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = event_registrations.event_id
        AND events.creator_id = auth.uid()
    )
);

-- Políticas para telemetry
CREATE POLICY "Anyone can insert telemetry"
ON public.event_telemetry FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creators can view own telemetry"
ON public.event_telemetry FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = event_telemetry.event_id
        AND events.creator_id = auth.uid()
    )
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_event_registrations_updated_at
    BEFORE UPDATE ON public.event_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================================
-- FUNCIÓN: Generar slug único
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_event_slug(title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Crear slug base
    base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    base_slug := substring(base_slug from 1 for 50);
    
    final_slug := base_slug;
    
    -- Verificar unicidad y agregar sufijo si es necesario
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$;

-- =====================================================================
-- FUNCIÓN: Contar registros aprobados
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_event_approved_count(event_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.event_registrations
    WHERE event_id = event_uuid
    AND status = 'approved';
$$;

-- =====================================================================
-- FUNCIÓN: Obtener cupos disponibles
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_event_available_spots(event_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT GREATEST(0, e.capacity - public.get_event_approved_count(event_uuid))::INTEGER
    FROM public.events e
    WHERE e.id = event_uuid;
$$;
