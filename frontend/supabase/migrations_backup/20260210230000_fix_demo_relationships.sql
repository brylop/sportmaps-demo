-- FIX DEMO RELATIONSHIPS
-- Links specific demo accounts (School & Parent) to ensure data visibility.

DO $$
DECLARE
    v_school_email TEXT := 'spoortmaps+school@gmail.com';
    v_parent_email TEXT := 'spoortmaps@gmail.com';
    v_school_id UUID;
    v_parent_id UUID;
    v_program_id UUID;
BEGIN
    ---------------------------------------------------------------------------
    -- 1. IDENTIFY USERS
    ---------------------------------------------------------------------------
    SELECT id INTO v_school_id FROM auth.users WHERE email = v_school_email LIMIT 1;
    SELECT id INTO v_parent_id FROM auth.users WHERE email = v_parent_email LIMIT 1;

    IF v_school_id IS NULL THEN
        RAISE NOTICE 'School user (%) not found. Skipping school fixes.', v_school_email;
    ELSE
        RAISE NOTICE 'Found School ID: %', v_school_id;
    END IF;

    IF v_parent_id IS NULL THEN
        RAISE NOTICE 'Parent user (%) not found. Skipping parent fixes.', v_parent_email;
    ELSE
        RAISE NOTICE 'Found Parent ID: %', v_parent_id;
    END IF;

    ---------------------------------------------------------------------------
    -- 2. FIX SCHOOL RECORD & PROFILE (If School Exists)
    ---------------------------------------------------------------------------
    IF v_school_id IS NOT NULL THEN
        -- Link Profile
        UPDATE public.profiles 
        SET role = 'school', full_name = 'Spirit All Stars' 
        WHERE id = v_school_id;

        -- Ensure School Record Matches Owner
        INSERT INTO public.schools (id, owner_id, name, description, address, city, phone, email, is_demo)
        VALUES (
            v_school_id, -- Use User ID as School ID for 1:1 simplicity in demo
            v_school_id, -- CRITICAL: Owner must match Auth User
            'Spirit All Stars',
            'Academia de Porras y Baile',
            'Calle 123 # Demo',
            'Bogotá',
            '3001234567',
            v_school_email,
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            owner_id = EXCLUDED.owner_id,
            email = EXCLUDED.email;
            
        -- Ensure at least one Program exists for this school
        SELECT id INTO v_program_id FROM public.programs WHERE school_id = v_school_id LIMIT 1;
        
        IF v_program_id IS NULL THEN
             INSERT INTO public.programs (school_id, name, sport, price_monthly, active)
             VALUES (v_school_id, 'Cheerleading Nivel 1', 'Cheerleading', 220000, true)
             RETURNING id INTO v_program_id;
        END IF;
    END IF;

    ---------------------------------------------------------------------------
    -- 3. FIX PARENT RELATIONSHIPS (If Parent & School Exist)
    ---------------------------------------------------------------------------
    IF v_parent_id IS NOT NULL AND v_school_id IS NOT NULL THEN
        -- Link Payments: Parent -> School
        UPDATE public.payments
        SET school_id = v_school_id
        WHERE parent_id = v_parent_id;
        
        RAISE NOTICE 'Linked payments for parent % to school %', v_parent_id, v_school_id;

        -- Link Enrollments: Parent -> School Program
        -- Check if enrollment exists, if not create one
        IF NOT EXISTS (
            SELECT 1 FROM public.enrollments 
            WHERE user_id = v_parent_id 
              AND program_id IN (SELECT id FROM public.programs WHERE school_id = v_school_id)
        ) THEN
            INSERT INTO public.enrollments (user_id, program_id, status, start_date)
            VALUES (v_parent_id, v_program_id, 'active', CURRENT_DATE);
            RAISE NOTICE 'Created enrollment for parent % in program %', v_parent_id, v_program_id;
        END IF;
    END IF;

    -- Reload config for RLS
    PERFORM pg_notify('pgrst', 'reload config');

END $$;
