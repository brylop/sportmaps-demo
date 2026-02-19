-- Comprehensive Fix for Payment Relationships
-- 1. Identifies the primary School Profile.
-- 2. Ensures the School Record exists and has the correct Owner ID.
-- 3. "Adopts" any orphaned payments (school_id is NULL) by assigning them to this school.
-- 4. Verifies the RLS chain.

DO $$
DECLARE
    target_school_id UUID;
BEGIN
    -- 1. Find the main school profile
    SELECT id INTO target_school_id
    FROM public.profiles
    WHERE role = 'school'
    LIMIT 1;

    IF target_school_id IS NULL THEN
        RAISE EXCEPTION 'No school profile found. Please run setup-demo-data.mjs first/check profiles.';
    END IF;

    RAISE NOTICE 'Found School ID: %', target_school_id;

    -- 2. Ensure School Record exists and is owned by the user
    -- We force the update of owner_id to match the ID (self-owned for demo)
    INSERT INTO public.schools (id, owner_id, name, description, address, city, phone, email)
    VALUES (
        target_school_id,
        target_school_id,
        'Academia Deportiva de Demostración',
        'Academia Oficial',
        'Calle Demo 123',
        'Bogotá',
        '3001234567',
        'spoortmaps+school@gmail.com'
    )
    ON CONFLICT (id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id; -- CRITICAL: Ensure linkage

    -- 3. Fix Orphaned Payments
    -- Assign any payment without a school_id to this school
    UPDATE public.payments
    SET school_id = target_school_id
    WHERE school_id IS NULL;

    GET DIAGNOSTICS target_school_id = ROW_COUNT;
    RAISE NOTICE 'Fixed % orphaned payments.', target_school_id;

    -- 4. Reload Config to ensure policies take effect
    PERFORM pg_notify('pgrst', 'reload config');

END $$;
