-- Migration: Add atomic RPC for checkouts to prevent silent payment failures (Axis 5)

CREATE OR REPLACE FUNCTION process_enrollment_checkout(
    p_student_id uuid,
    p_class_id uuid,
    p_school_id uuid,
    p_parent_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_is_child_enrollment boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enrollment_id uuid;
    v_payment_id uuid;
    v_user_id uuid := NULL;
    v_child_id uuid := NULL;
BEGIN
    -- 1. Validate inputs
    IF p_student_id IS NULL OR p_class_id IS NULL OR p_school_id IS NULL THEN
        RAISE EXCEPTION 'Missing required fields for checkout';
    END IF;

    IF p_is_child_enrollment THEN
        v_child_id := p_student_id;
    ELSE
        v_user_id := p_student_id;
    END IF;

    -- 2. Create Enrollment
    INSERT INTO enrollments (
        program_id,
        school_id,
        status,
        start_date,
        child_id,
        user_id
    ) VALUES (
        p_class_id,
        p_school_id,
        'active',
        now(),
        v_child_id,
        v_user_id
    ) RETURNING id INTO v_enrollment_id;

    -- 3. Record Payment
    INSERT INTO payments (
        amount,
        status,
        payment_method,
        parent_id,
        school_id,
        concept,
        due_date,
        payment_type
    ) VALUES (
        p_amount,
        'completed',
        p_payment_method,
        p_parent_id,
        p_school_id,
        'Enrollment Fee',
        now(),
        'one_time'
    ) RETURNING id INTO v_payment_id;

    -- 4. Audit Log (Implicitly handled by Triggers if they exist, but we ensure payment succeeds)
    -- If we get here, both inserts succeeded. Postgres auto-commits.
    
    RETURN json_build_object(
        'success', true,
        'enrollment_id', v_enrollment_id,
        'payment_id', v_payment_id
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Postgres will automatically rollback the transaction
        RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;
