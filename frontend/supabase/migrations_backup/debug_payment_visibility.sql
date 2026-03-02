-- DIAGNOSTIC SCRIPT: Payment Visibility
-- Run this in the SQL Editor and check the "Results" tab (bottom right).

DO $$
DECLARE
    v_school_email TEXT := 'spoortmaps+school@gmail.com';
    v_parent_email TEXT := 'spoortmaps@gmail.com';
    v_school_user_id UUID;
    v_parent_user_id UUID;
    v_school_record_id UUID;
    v_school_owner_id UUID;
    v_payment_count INTEGER;
    v_payment_school_id UUID;
BEGIN
    RAISE NOTICE '--- DIAGNOSTIC START ---';

    -- 1. Check School User
    SELECT id INTO v_school_user_id FROM auth.users WHERE email = v_school_email;
    RAISE NOTICE 'School User ID (Auth): %', v_school_user_id;

    -- 2. Check Parent User
    SELECT id INTO v_parent_user_id FROM auth.users WHERE email = v_parent_email;
    RAISE NOTICE 'Parent User ID (Auth): %', v_parent_user_id;

    -- 3. Check School Record
    SELECT id, owner_id INTO v_school_record_id, v_school_owner_id 
    FROM public.schools 
    WHERE id = v_school_user_id; -- Checking if ID matches
    
    RAISE NOTICE 'School Record ID: %', v_school_record_id;
    RAISE NOTICE 'School Record Owner ID: %', v_school_owner_id;

    IF v_school_record_id IS NULL THEN
        RAISE NOTICE 'CRITICAL: School record NOT found with ID matching Auth User ID!';
        -- Fallback check by email if stored
        SELECT id, owner_id INTO v_school_record_id, v_school_owner_id 
        FROM public.schools 
        WHERE email = v_school_email;
        RAISE NOTICE 'Fallback: Search by email found School ID: %', v_school_record_id;
    END IF;

    -- 4. Check Relationships
    IF v_school_user_id = v_school_owner_id THEN
        RAISE NOTICE '✅ School Owner Matches Auth User.';
    ELSE
        RAISE NOTICE '❌ MISMATCH: School Owner (%) != Auth User (%). RLS will fail.', v_school_owner_id, v_school_user_id;
    END IF;

    -- 5. Check Payments
    SELECT count(*) INTO v_payment_count
    FROM public.payments
    WHERE parent_id = v_parent_user_id;

    SELECT school_id INTO v_payment_school_id
    FROM public.payments
    WHERE parent_id = v_parent_user_id
    LIMIT 1;

    RAISE NOTICE 'Parent has % payments.', v_payment_count;
    RAISE NOTICE 'Sample Payment School ID: %', v_payment_school_id;

    IF v_payment_school_id = v_school_record_id THEN
        RAISE NOTICE '✅ Payment is linked to the correct School Record.';
    ELSE
        RAISE NOTICE '❌ MISMATCH: Payment School ID (%) != School Record ID (%).', v_payment_school_id, v_school_record_id;
        
        -- AUTO-FIX ATTEMPT 2 (Aggressive)
        IF v_school_record_id IS NOT NULL THEN
             UPDATE public.payments 
             SET school_id = v_school_record_id 
             WHERE parent_id = v_parent_user_id;
             RAISE NOTICE '⚡ Auto-Fix: Updated payments to point to School ID %', v_school_record_id;
        END IF;
    END IF;

    RAISE NOTICE '--- DIAGNOSTIC END ---';
END $$;
