-- Migration: 20260422000001_enrollment_checkout_v2_1.sql
-- Description: Extiende process_enrollment_checkout para soportar la arquitectura
-- v2.1 (offerings + offering_plans). Si viene p_offering_plan_id, se usa en vez
-- de p_class_id. Retrocompatible: calls existentes siguen funcionando.

CREATE OR REPLACE FUNCTION process_enrollment_checkout(
    p_student_id uuid,
    p_class_id uuid,
    p_school_id uuid,
    p_parent_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_is_child_enrollment boolean,
    p_offering_plan_id uuid DEFAULT NULL
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
    v_plan_duration_days integer;
    v_expires_at date;
BEGIN
    -- 1. Validate inputs
    IF p_student_id IS NULL OR p_school_id IS NULL THEN
        RAISE EXCEPTION 'Missing required fields for checkout';
    END IF;

    -- Al menos uno de los dos: plan (v2.1) o class (legacy)
    IF p_offering_plan_id IS NULL AND p_class_id IS NULL THEN
        RAISE EXCEPTION 'Either p_offering_plan_id or p_class_id is required';
    END IF;

    IF p_is_child_enrollment THEN
        v_child_id := p_student_id;
    ELSE
        v_user_id := p_student_id;
    END IF;

    -- 2. Si es v2.1, calculamos expires_at a partir de duration_days
    IF p_offering_plan_id IS NOT NULL THEN
        SELECT duration_days INTO v_plan_duration_days
        FROM offering_plans
        WHERE id = p_offering_plan_id AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Plan % no encontrado o inactivo', p_offering_plan_id;
        END IF;

        v_expires_at := (CURRENT_DATE + COALESCE(v_plan_duration_days, 30) * INTERVAL '1 day')::date;
    END IF;

    -- 3. Create enrollment
    -- En v2.1: program_id queda NULL, offering_plan_id apunta al plan.
    -- En legacy: program_id = p_class_id (team/program.id), offering_plan_id = NULL.
    INSERT INTO enrollments (
        program_id,
        offering_plan_id,
        school_id,
        status,
        start_date,
        expires_at,
        child_id,
        user_id
    ) VALUES (
        p_class_id,
        p_offering_plan_id,
        p_school_id,
        'active',
        CURRENT_DATE,
        v_expires_at,
        v_child_id,
        v_user_id
    ) RETURNING id INTO v_enrollment_id;

    -- 4. Record payment
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
        CASE
            WHEN p_offering_plan_id IS NOT NULL THEN 'Plan Enrollment'
            ELSE 'Enrollment Fee'
        END,
        now(),
        'one_time'
    ) RETURNING id INTO v_payment_id;

    RETURN json_build_object(
        'success', true,
        'enrollment_id', v_enrollment_id,
        'payment_id', v_payment_id,
        'expires_at', v_expires_at
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION process_enrollment_checkout(uuid, uuid, uuid, uuid, numeric, text, boolean, uuid) TO authenticated;
