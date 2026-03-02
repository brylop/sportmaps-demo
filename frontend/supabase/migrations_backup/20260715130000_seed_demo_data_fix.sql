-- Migration to seed demo data, add program relations, and fix visibility/deletion issues
-- Timestamp: 20260715130000

-- 1. Schema Changes (Add coach_id and facility_id to programs if not exists)
ALTER TABLE public.programs
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.school_staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

DO $$
DECLARE
    v_school_user_id UUID;
    v_athlete_user_id UUID;
    v_school_id UUID;
    v_facility_id_1 UUID;
    v_facility_id_2 UUID;
    v_team_id UUID;
BEGIN
    -- 2. Get User IDs
    SELECT id INTO v_school_user_id FROM auth.users WHERE email = 'academia.elite@sportmaps-demo.com';
    SELECT id INTO v_athlete_user_id FROM auth.users WHERE email = 'carlos.martinez@sportmaps-demo.com';

    -- If school user doesn't exist, we can't seed properly. Log warning.
    IF v_school_user_id IS NULL THEN
        RAISE WARNING 'Demo user academia.elite@sportmaps-demo.com not found. Skipping seed.';
        RETURN;
    END IF;

    -- 3. Ensure School exists and is owned by the demo user
    SELECT id INTO v_school_id FROM public.schools WHERE owner_id = v_school_user_id LIMIT 1;

    IF v_school_id IS NULL THEN
        INSERT INTO public.schools (owner_id, name, description, address, city, phone, email, is_demo, certifications)
        VALUES (
            v_school_user_id,
            'Academia Elite Spirit',
            'Formación integral en cheerleading y gimnasia.',
            'Calle 123 # 45-67',
            'Bogotá',
            '+57 300 123 4567',
            'academia.elite@sportmaps-demo.com',
            true,
            ARRAY['IDRD Certificado', 'Mindeportes']
        )
        RETURNING id INTO v_school_id;
    END IF;

    -- 4. Seed Facilities (Installationes)
    
    -- Facility 1: Gimnasio Principal
    SELECT id INTO v_facility_id_1 FROM public.facilities WHERE school_id = v_school_id AND name = 'Gimnasio de Acrobacia' LIMIT 1;
    IF v_facility_id_1 IS NULL THEN
         INSERT INTO public.facilities (school_id, name, type, capacity, description, hourly_rate, booking_enabled)
        VALUES (v_school_id, 'Gimnasio de Acrobacia', 'indoor_gym', 50, 'Pista de spring floor completa, fosa de espuma.', 150000, true)
        RETURNING id INTO v_facility_id_1;
    END IF;

    -- Facility 2: Salón de Danza
    SELECT id INTO v_facility_id_2 FROM public.facilities WHERE school_id = v_school_id AND name = 'Salón de Danza' LIMIT 1;
    IF v_facility_id_2 IS NULL THEN
         INSERT INTO public.facilities (school_id, name, type, capacity, description, hourly_rate, booking_enabled)
        VALUES (v_school_id, 'Salón de Danza', 'studio', 20, 'Espejos de pared a pared, piso de madera.', 80000, true)
        RETURNING id INTO v_facility_id_2;
    END IF;

    -- Facility 3: Cancha Múltiple (New Request)
    INSERT INTO public.facilities (school_id, name, type, capacity, description, hourly_rate, booking_enabled)
    VALUES (v_school_id, 'Cancha Múltiple', 'outdoor_field', 22, 'Cancha para baloncesto, voleibol y fútbol sala.', 120000, true)
    ON CONFLICT DO NOTHING;

    -- 5. Seed Reservations for Facility 1
    INSERT INTO public.facility_reservations (facility_id, user_id, reservation_date, start_time, end_time, status, notes)
    VALUES 
    (v_facility_id_1, v_school_user_id, CURRENT_DATE + INTERVAL '1 day', '14:00', '16:00', 'confirmed', 'Entrenamiento Equipo Elite'),
    (v_facility_id_1, v_school_user_id, CURRENT_DATE + INTERVAL '2 day', '10:00', '12:00', 'pending', 'Reserva pendiente de confirmación')
    ON CONFLICT (facility_id, reservation_date, start_time) DO NOTHING;

    -- 6. Seed Teams (Equipos)
    -- Team 1: Thunder (Senior)
    SELECT id INTO v_team_id FROM public.teams WHERE coach_id = v_school_user_id AND name = 'Thunder' LIMIT 1;
    IF v_team_id IS NULL THEN
        INSERT INTO public.teams (coach_id, name, sport, age_group, season)
        VALUES (v_school_user_id, 'Thunder', 'Cheerleading', 'Senior', '2025')
        RETURNING id INTO v_team_id;
    END IF;

    -- Seed Members for Team 1
    INSERT INTO public.team_members (team_id, player_name, position, parent_contact)
    VALUES 
    (v_team_id, 'Carlos Martínez', 'Flyer', 'Carlos Padre - 3001112233'),
    (v_team_id, 'Ana López', 'Base', 'María Madre - 3004445566'),
    (v_team_id, 'Juan Pérez', 'Backspot', 'Pedro Padre - 3007778899'),
    (v_team_id, 'Laura Torres', 'Base', 'Luisa Madre - 3009990011'),
    (v_team_id, 'Sofía Ramírez', 'Flyer', 'Jorge Padre - 3002223344');
    -- Note: No unique constraint on member name/team, usually fine for demo seed.

    -- Team 2: Lightning (Junior)
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE coach_id = v_school_user_id AND name = 'Lightning') THEN
        INSERT INTO public.teams (coach_id, name, sport, age_group, season)
        VALUES (v_school_user_id, 'Lightning', 'Cheerleading', 'Junior', '2025');
        
        -- Get new ID
        SELECT id INTO v_team_id FROM public.teams WHERE coach_id = v_school_user_id AND name = 'Lightning' LIMIT 1;

        INSERT INTO public.team_members (team_id, player_name, position, parent_contact)
        VALUES 
        (v_team_id, 'Valentina Ruiz', 'Flyer', '3101234567'),
        (v_team_id, 'Camilav Vargas', 'Base', '3109876543'),
        (v_team_id, 'Mateo Gómez', 'Backspot', '3105556677');
    END IF;

    -- 7. Seed School Staff (Coaches) - New Request (8 Coaches)
    -- Using INSERT ... ON CONFLICT DO NOTHING implies we might need unique constraint.
    -- Assuming email is unique or we just check existence. Let's filter by email to be safe.
    
    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'martin.gomez@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Martín Gómez', 'martin.gomez@demo.com', '3001234567', 'Cheerleading - Nivel 5', 'active', ARRAY['USASF Level 5', 'Primeros Auxilios']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'andrea.pineda@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Andrea Pineda', 'andrea.pineda@demo.com', '3002345678', 'Gimnasia', 'active', ARRAY['FIG Level 2']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'carlos.ruiz@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Carlos Ruiz', 'carlos.ruiz@demo.com', '3003456789', 'Acondicionamiento Físico', 'active', ARRAY['CrossFit L1']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'laura.torres@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Laura Torres', 'laura.torres@demo.com', '3004567890', 'Baile Deportivo', 'active', ARRAY['WDSF Certified']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'javier.mendez@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Javier Méndez', 'javier.mendez@demo.com', '3005678901', 'Cheerleading - Base', 'active', ARRAY['USASF Level 3']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'sofia.castro@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Sofía Castro', 'sofia.castro@demo.com', '3006789012', 'Flexibilidad', 'active', ARRAY['Yoga Alliance']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'diego.vargas@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Diego Vargas', 'diego.vargas@demo.com', '3007890123', 'Acrobacia', 'active', ARRAY['Gimnasia Artística']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.school_staff WHERE email = 'valentina.rios@demo.com') THEN
        INSERT INTO public.school_staff (school_id, full_name, email, phone, specialty, status, certifications)
        VALUES (v_school_id, 'Valentina Ríos', 'valentina.rios@demo.com', '3008901234', 'Coreografía', 'active', ARRAY['Danza Contemporánea']);
    END IF;

    RAISE NOTICE 'Demo data (Facilities, Teams, Coaches) seeded successfully for academia.elite@sportmaps-demo.com';

END $$;
