-- Migration: Fix accept_invitation RPC after programs to teams unification
-- Description: Updates the accept_invitation function to query the new public.teams table instead of the removed public.programs

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
    v_child_id uuid;
    v_program_price numeric;
BEGIN
    -- Get user email
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

    -- Get program price if available (from teams table)
    IF v_invite.program_id IS NOT NULL THEN
        SELECT price_monthly INTO v_program_price FROM public.teams WHERE id = v_invite.program_id;
    END IF;

    -- 2. Create official membership (if not exists)
    INSERT INTO public.school_members (school_id, profile_id, role, status)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active')
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = EXCLUDED.role;

    -- 3. LINK CHILDREN & PROGRAMS (Global Fix)
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
        -- Match by name and temp email
        UPDATE public.children 
        SET parent_id = auth.uid(),
            school_id = v_invite.school_id,
            program_id = COALESCE(program_id, v_invite.program_id),
            -- Prioritize program price, then invite price, then existing price
            monthly_fee = COALESCE(v_program_price, v_invite.monthly_fee, monthly_fee)
        WHERE LOWER(parent_email_temp) = v_user_email
        AND LOWER(full_name) = LOWER(v_invite.child_name)
        RETURNING id INTO v_child_id;

        -- Create active enrollment if it doesn't exist
        IF v_child_id IS NOT NULL AND v_invite.program_id IS NOT NULL THEN
            INSERT INTO public.enrollments (school_id, program_id, user_id, child_id, status, start_date)
            VALUES (v_invite.school_id, v_invite.program_id, auth.uid(), v_child_id, 'active', CURRENT_DATE)
            ON CONFLICT (school_id, program_id, child_id) DO UPDATE SET status = 'active'
            WHERE enrollments.status != 'active';
        END IF;
    END IF;

    -- 3.1 Fallback: Link any other children by email
    UPDATE public.children 
    SET parent_id = auth.uid()
    WHERE LOWER(parent_email_temp) = v_user_email
    AND parent_id IS NULL;

    -- 4. Mark invitation as accepted
    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;

    -- 5. Audit log
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action)
    VALUES (v_invite.school_id, auth.uid(), 'invitations', p_invite_id::text, 'ACCEPTED_GLOBAL_PRICE_SYNC');

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
