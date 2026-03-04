-- Migration: Fix accept_invitation_pro - overly broad child linking condition
-- Problem: UPDATE condition `OR parent_id IS NULL` was matching children from other
--          parents/schools with the same name, potentially linking the wrong child
--          (and thus showing the wrong date_of_birth) in the parent's module.
-- Fix: Only match children by parent_email_temp AND school_id. Remove the unsafe
--      OR parent_id IS NULL fallback from the name-based UPDATE.

CREATE OR REPLACE FUNCTION public.accept_invitation_pro(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
    v_child_id uuid;
    v_role_id uuid;
    v_staff_id uuid;
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
        -- Fallback: check if already accepted to avoid frontend errors on double clicks
        SELECT status INTO v_role_id FROM public.invitations WHERE id = p_invite_id;
        IF v_role_id::text = 'accepted' THEN RETURN true; END IF;
        RAISE EXCEPTION 'Invitación no válida o ya procesada.';
    END IF;

    -- 2. Update Profile Role
    SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_invite.role_to_assign LIMIT 1;
    UPDATE public.profiles
    SET role = v_invite.role_to_assign::public.user_role,
        role_id = COALESCE(v_role_id, role_id)
    WHERE id = auth.uid();

    -- 3. Create/Update Membership
    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id, invited_by)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active', v_invite.branch_id, v_invite.invited_by)
    ON CONFLICT (school_id, profile_id) DO UPDATE
    SET status = 'active',
        role = EXCLUDED.role,
        branch_id = COALESCE(school_members.branch_id, EXCLUDED.branch_id);

    -- 4. Logic for Parents (Student Linking)
    -- FIX: Only match by parent_email_temp + school_id to avoid linking wrong children.
    --      Removed the unsafe `OR parent_id IS NULL` fallback that could accidentally
    --      link a child from another family with the same name.
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
        UPDATE public.children
        SET parent_id = auth.uid(),
            school_id = v_invite.school_id,
            branch_id = COALESCE(branch_id, v_invite.branch_id)
        WHERE LOWER(parent_email_temp) = v_user_email
          AND LOWER(full_name) = LOWER(v_invite.child_name)
          AND school_id = v_invite.school_id
        RETURNING id INTO v_child_id;

        -- Create active enrollment if team/program specified
        IF v_invite.program_id IS NOT NULL AND v_child_id IS NOT NULL THEN
            INSERT INTO public.enrollments (school_id, program_id, child_id, status, start_date)
            VALUES (v_invite.school_id, v_invite.program_id, v_child_id, 'active', CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- 4b. Athletes: create enrollment directly on the user
    IF v_invite.role_to_assign = 'athlete' AND v_invite.program_id IS NOT NULL THEN
        INSERT INTO public.enrollments (school_id, program_id, user_id, status, start_date)
        VALUES (v_invite.school_id, v_invite.program_id, auth.uid(), 'active', CURRENT_DATE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 5. Logic for Coaches (Auto-assignment to Team)
    IF v_invite.role_to_assign = 'coach' AND v_invite.program_id IS NOT NULL THEN
        SELECT id INTO v_staff_id FROM public.school_staff WHERE email = v_user_email AND school_id = v_invite.school_id;

        IF v_staff_id IS NOT NULL THEN
            INSERT INTO public.team_coaches (team_id, coach_id, school_id)
            VALUES (v_invite.program_id, v_staff_id, v_invite.school_id)
            ON CONFLICT (team_id, coach_id) DO NOTHING;
        END IF;
    END IF;

    -- 6. Mark invitation as accepted
    UPDATE public.invitations
    SET status = 'accepted'
    WHERE id = p_invite_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- accept_invitation delegates to accept_invitation_pro (unchanged)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN public.accept_invitation_pro(p_invite_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
