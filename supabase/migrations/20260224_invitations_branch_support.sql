-- Migration: Consolidate Invitation RPCs and Add Multi-Branch Support
-- Description: Ensures all invitation flows capture the branch (sede) and correctly associate accepted users.

BEGIN;

-- 1. Consolidate create_invitation to handle ALL roles and branch_id
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email text,
    p_role text,
    p_child_name text DEFAULT NULL,
    p_program_id uuid DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL,
    p_parent_phone text DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
    v_id uuid;
BEGIN
    -- Find school managed by current user
    SELECT school_id INTO v_school_id FROM public.school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner', 'admin', 'school_admin', 'super_admin')
      AND status = 'active'
    LIMIT 1;

    IF v_school_id IS NULL THEN
        SELECT id INTO v_school_id FROM schools WHERE owner_id = auth.uid() LIMIT 1;
    END IF;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una escuela administrada por ti.';
    END IF;

    -- Create invitation with branch_id
    INSERT INTO invitations (
        email, 
        school_id, 
        role_to_assign, 
        invited_by, 
        child_name, 
        program_id, 
        monthly_fee, 
        parent_phone, 
        branch_id,
        status
    )
    VALUES (
        lower(trim(p_email)), 
        v_school_id, 
        p_role, 
        auth.uid(), 
        p_child_name, 
        p_program_id, 
        p_monthly_fee, 
        p_parent_phone, 
        p_branch_id,
        'pending'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Consolidate invite_parent_to_school to use the same logic or just call create_invitation
CREATE OR REPLACE FUNCTION public.invite_parent_to_school(
    p_parent_email text,
    p_child_name text DEFAULT NULL,
    p_program_id uuid DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL,
    p_parent_phone text DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
BEGIN
    RETURN public.create_invitation(
        p_parent_email,
        'parent',
        p_child_name,
        p_program_id,
        p_monthly_fee,
        p_parent_phone,
        p_branch_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update accept_invitation to handle branch_id association
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
    v_child_id uuid;
    v_program_price numeric;
BEGIN
    -- Get current user email
    SELECT LOWER(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();

    -- 1. Validate invitation
    SELECT * INTO v_invite 
    FROM public.invitations 
    WHERE id = p_invite_id 
    AND LOWER(email) = v_user_email
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitación no válida o ya procesada.';
    END IF;

    -- Get program price if available
    IF v_invite.program_id IS NOT NULL THEN
        SELECT price_monthly INTO v_program_price FROM public.programs WHERE id = v_invite.program_id;
    END IF;

    -- 2. Create membership WITH branch_id
    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active', v_invite.branch_id)
    ON CONFLICT (school_id, profile_id) DO UPDATE 
    SET status = 'active', 
        role = EXCLUDED.role,
        branch_id = COALESCE(v_invite.branch_id, school_members.branch_id);

    -- 3. LINK CHILDREN & PROGRAMS (Global Fix)
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
        -- Match by name and temp email
        UPDATE public.children 
        SET parent_id = auth.uid(),
            school_id = v_invite.school_id,
            branch_id = COALESCE(v_invite.branch_id, branch_id),
            program_id = COALESCE(program_id, v_invite.program_id),
            monthly_fee = COALESCE(v_program_price, v_invite.monthly_fee, monthly_fee)
        WHERE LOWER(parent_email_temp) = v_user_email
        AND LOWER(full_name) = LOWER(v_invite.child_name)
        RETURNING id INTO v_child_id;

        -- Create active enrollment if it doesn't exist
        IF v_child_id IS NOT NULL AND v_invite.program_id IS NOT NULL THEN
            INSERT INTO public.enrollments (school_id, program_id, user_id, child_id, status, start_date, branch_id)
            VALUES (v_invite.school_id, v_invite.program_id, auth.uid(), v_child_id, 'active', CURRENT_DATE, v_invite.branch_id)
            ON CONFLICT (school_id, program_id, child_id) DO UPDATE 
            SET status = 'active',
                branch_id = COALESCE(v_invite.branch_id, enrollments.branch_id)
            WHERE enrollments.status != 'active';
        END IF;
    END IF;

    -- 3.1 Fallback: Link any other children by email
    UPDATE public.children 
    SET parent_id = auth.uid(),
        school_id = v_invite.school_id,
        branch_id = COALESCE(v_invite.branch_id, branch_id)
    WHERE LOWER(parent_email_temp) = v_user_email
    AND parent_id IS NULL;

    -- 4. Mark invitation as accepted
    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;

    -- 5. Audit log
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action)
    VALUES (v_invite.school_id, auth.uid(), 'invitations', p_invite_id::text, 'ACCEPTED_WITH_BRANCH_SUPPORT');

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
