-- Migration: Fix accept_invitation_pro - CREATE child if no pre-existing match
-- Problem: When a school invites a parent but the child was NOT pre-loaded
--          (no CSV import, no manual student creation), the UPDATE finds no
--          matching row and the parent ends up with no child linked.
-- Fix: After the UPDATE attempt, if v_child_id IS NULL, INSERT a new child
--      with minimal data (full_name, parent_id, school_id, branch_id).
--      The parent can complete date_of_birth and other details later.

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
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN

        -- 4a. Try to link a PRE-EXISTING child (loaded via CSV or manual student creation)
        UPDATE public.children
        SET parent_id = auth.uid(),
            school_id = v_invite.school_id,
            branch_id = COALESCE(branch_id, v_invite.branch_id)
        WHERE LOWER(parent_email_temp) = v_user_email
          AND LOWER(full_name) = LOWER(v_invite.child_name)
          AND school_id = v_invite.school_id
        RETURNING id INTO v_child_id;

        -- 4b. If no pre-existing child found, CREATE a new one with minimal data.
        --     The parent will complete date_of_birth and other details later.
        IF v_child_id IS NULL THEN
            INSERT INTO public.children (
                parent_id,
                full_name,
                school_id,
                branch_id,
                parent_email_temp
            )
            VALUES (
                auth.uid(),
                v_invite.child_name,
                v_invite.school_id,
                v_invite.branch_id,
                v_user_email
            )
            RETURNING id INTO v_child_id;
        END IF;

        -- 4c. Create active enrollment if team/program specified
        IF v_invite.program_id IS NOT NULL AND v_child_id IS NOT NULL THEN
            INSERT INTO public.enrollments (school_id, program_id, child_id, status, start_date)
            VALUES (v_invite.school_id, v_invite.program_id, v_child_id, 'active', CURRENT_DATE)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- 4d. Athletes: create enrollment directly on the user
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
