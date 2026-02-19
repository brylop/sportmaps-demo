-- CONSOLIDATE DEMO SCHOOL
-- Purpose: "Absorb" all data into the official Demo School and delete other schools to prevent errors.

DO $$
DECLARE
    v_demo_email TEXT := 'spoortmaps+school@gmail.com';
    v_target_school_id UUID;
    v_rows_updated INT;
BEGIN
    -- 1. Identify the Official Demo School ID from Auth
    SELECT id INTO v_target_school_id FROM auth.users WHERE email = v_demo_email;

    IF v_target_school_id IS NULL THEN
        RAISE EXCEPTION 'CRITICAL: Demo school user (%) not found in auth.users!', v_demo_email;
    END IF;

    RAISE NOTICE 'Target Official School ID: %', v_target_school_id;

    -- 2. "Absorb" Payments
    -- Move any payment that isn't already assigned to this school
    UPDATE public.payments
    SET school_id = v_target_school_id
    WHERE school_id IS DISTINCT FROM v_target_school_id;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Moved % payments to the official school.', v_rows_updated;

    -- 3. "Absorb" Programs (and connected Enrollments)
    -- This ensures all classes/programs belong to the demo school
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'programs') THEN
        UPDATE public.programs
        SET school_id = v_target_school_id
        WHERE school_id IS DISTINCT FROM v_target_school_id;
        
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        RAISE NOTICE 'Moved % programs to the official school.', v_rows_updated;
    END IF;
    
    -- 4. "Absorb" Coaches/Staff (if linked via school_id in profiles?)
    -- Assuming profiles might have school_id or similar, but simplified for now.
    -- If there is a 'school_coaches' junction table:
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_coaches') THEN
        UPDATE public.school_coaches
        SET school_id = v_target_school_id
        WHERE school_id IS DISTINCT FROM v_target_school_id;
    END IF;

    -- 5. DELETE all other schools
    -- Eliminate "Ghost" schools so they don't cause confusion
    DELETE FROM public.schools
    WHERE id != v_target_school_id;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Deleted % other/ghost school records.', v_rows_updated;

    -- 6. Ensure Official School Record exists and is correct
    INSERT INTO public.schools (id, owner_id, name, description, address, city, phone, email, is_demo)
    VALUES (
        v_target_school_id, 
        v_target_school_id, -- Owner matches ID
        'Spirit All Stars', 
        'Academia Oficial del Demo', 
        'Calle 100 # 15-20', 
        'Bogotá', 
        '3001234567', 
        v_demo_email,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        name = EXCLUDED.name,
        is_demo = true;

    -- 7. Refresh RLS
    PERFORM pg_notify('pgrst', 'reload config');
    
    RAISE NOTICE '✅ CONSOLIDATION COMPLETE: Only one school remains.';

END $$;
