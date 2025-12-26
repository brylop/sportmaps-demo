-- =============================================
-- SPORTMAPS EVOLUTION: Database Schema Updates
-- =============================================

-- 1. Add certifications/endorsements to schools
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS levels_offered text[] DEFAULT ARRAY['iniciacion', 'intermedio', 'avanzado'],
ADD COLUMN IF NOT EXISTS accepts_reservations boolean DEFAULT true;

-- 2. Add level and real-time availability to programs
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS level text DEFAULT 'iniciacion' CHECK (level IN ('iniciacion', 'intermedio', 'avanzado', 'alto_rendimiento')),
ADD COLUMN IF NOT EXISTS spots_available integer GENERATED ALWAYS AS (GREATEST(0, COALESCE(max_participants, 30) - COALESCE(current_participants, 0))) STORED;

-- 3. Add payment type to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'one_time' CHECK (payment_type IN ('one_time', 'subscription')),
ADD COLUMN IF NOT EXISTS subscription_start_date date,
ADD COLUMN IF NOT EXISTS subscription_end_date date;

-- 4. Create facility reservations table
CREATE TABLE IF NOT EXISTS public.facility_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE NOT NULL,
    user_id uuid NOT NULL,
    reservation_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    price numeric DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(facility_id, reservation_date, start_time)
);

-- 5. Enable RLS on facility_reservations
ALTER TABLE public.facility_reservations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for facility_reservations
CREATE POLICY "Users can view own reservations"
ON public.facility_reservations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create reservations"
ON public.facility_reservations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reservations"
ON public.facility_reservations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can cancel own reservations"
ON public.facility_reservations FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "School owners can manage facility reservations"
ON public.facility_reservations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM facilities f
        JOIN schools s ON s.id = f.school_id
        WHERE f.id = facility_reservations.facility_id
        AND s.owner_id = auth.uid()
    )
);

-- 7. Add hourly rates and availability to facilities
ALTER TABLE public.facilities 
ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_hours jsonb DEFAULT '{"monday": ["06:00-22:00"], "tuesday": ["06:00-22:00"], "wednesday": ["06:00-22:00"], "thursday": ["06:00-22:00"], "friday": ["06:00-22:00"], "saturday": ["07:00-20:00"], "sunday": ["08:00-18:00"]}',
ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT true;

-- 8. Create trigger for updated_at on facility_reservations
CREATE TRIGGER update_facility_reservations_updated_at
    BEFORE UPDATE ON public.facility_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Update demo schools with certifications
UPDATE public.schools 
SET certifications = ARRAY['IDRD Certificado', 'Mindeportes', 'Liga Distrital'],
    levels_offered = ARRAY['iniciacion', 'intermedio', 'avanzado']
WHERE is_demo = true;

-- 10. Update demo programs with levels
UPDATE public.programs 
SET level = CASE 
    WHEN name ILIKE '%sub-8%' OR name ILIKE '%sub-10%' OR name ILIKE '%iniciación%' THEN 'iniciacion'
    WHEN name ILIKE '%sub-12%' OR name ILIKE '%sub-14%' THEN 'intermedio'
    WHEN name ILIKE '%sub-17%' OR name ILIKE '%juvenil%' THEN 'avanzado'
    ELSE 'iniciacion'
END
WHERE is_demo = true;