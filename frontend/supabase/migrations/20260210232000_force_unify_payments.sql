-- FORCE UNIFY PAYMENTS
-- The issue: Payments are split between two different School IDs.
-- The fix: Move ALL payments to the School ID that actually belongs to the user.

DO $$
DECLARE
    v_school_email TEXT := 'spoortmaps+school@gmail.com';
    v_parent_email TEXT := 'spoortmaps@gmail.com';
    v_school_id UUID;
    v_parent_id UUID;
    v_count_updated INTEGER;
BEGIN
    -- 1. Get the REAL School ID (the one the user logs in with)
    SELECT id INTO v_school_id FROM auth.users WHERE email = v_school_email;
    SELECT id INTO v_parent_id FROM auth.users WHERE email = v_parent_email;

    RAISE NOTICE 'Target School ID (Login): %', v_school_id;
    RAISE NOTICE 'Parent ID: %', v_parent_id;

    IF v_school_id IS NOT NULL AND v_parent_id IS NOT NULL THEN
        -- 2. Update ALL payments for this parent to point to this school
        UPDATE public.payments
        SET school_id = v_school_id
        WHERE parent_id = v_parent_id
        AND school_id != v_school_id; -- Only update if they differ

        GET DIAGNOSTICS v_count_updated = ROW_COUNT;
        RAISE NOTICE 'Moved % payments to the correct School ID.', v_count_updated;
    END IF;

    -- 3. Ensure Self-Ownership of School Record again (just to be safe)
    UPDATE public.schools
    SET owner_id = v_school_id
    WHERE id = v_school_id;
    
    PERFORM pg_notify('pgrst', 'reload config');

END $$;
