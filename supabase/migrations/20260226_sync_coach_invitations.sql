-- Migration: Sync Coach Invitations and Auto-assignment
-- Description: Ensures coaches are added to school_staff on joining and auto-assigned to teams if specified in invite.

BEGIN;

-- 1. Function to sync school_members (coaches) to school_staff
CREATE OR REPLACE FUNCTION public.sync_coach_to_staff()
RETURNS TRIGGER AS $$
DECLARE
    v_profile RECORD;
BEGIN
    -- Only act on 'coach' role and 'active' status
    IF NEW.role = 'coach' AND NEW.status = 'active' THEN
        -- Get profile info
        SELECT full_name, email, phone INTO v_profile FROM public.profiles WHERE id = NEW.profile_id;
        
        -- Insert into school_staff if not exists (by email/school combo)
        INSERT INTO public.school_staff (school_id, branch_id, full_name, email, phone, status)
        VALUES (NEW.school_id, NEW.branch_id, v_profile.full_name, v_profile.email, v_profile.phone, 'active')
        ON CONFLICT (email, school_id) DO UPDATE 
        SET status = 'active',
            branch_id = COALESCE(school_staff.branch_id, EXCLUDED.branch_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add UNIQUE constraint to school_staff if missing for proper sync
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_staff_email_school_id_key') THEN
        ALTER TABLE public.school_staff ADD CONSTRAINT school_staff_email_school_id_key UNIQUE (email, school_id);
    END IF;
END $$;

-- 2. Trigger on school_members
DROP TRIGGER IF EXISTS trg_sync_coach_to_staff ON public.school_members;
CREATE TRIGGER trg_sync_coach_to_staff
AFTER INSERT OR UPDATE OF status, role ON public.school_members
FOR EACH ROW EXECUTE FUNCTION public.sync_coach_to_staff();

DROP FUNCTION IF EXISTS public.accept_invitation(uuid);
DROP FUNCTION IF EXISTS public.accept_invitation_pro(uuid);

-- 3. Robust accept_invitation_pro (consolidated version)
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

    -- 4. Logic for Athletes/Parents (Student Linking)
    IF v_invite.role_to_assign IN ('parent', 'athlete') THEN
        -- Handle children linking
        IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
            UPDATE public.children 
            SET parent_id = auth.uid(),
                school_id = v_invite.school_id,
                branch_id = COALESCE(branch_id, v_invite.branch_id)
            WHERE (parent_email_temp = v_user_email OR parent_id IS NULL)
            AND LOWER(full_name) = LOWER(v_invite.child_name)
            RETURNING id INTO v_child_id;
        END IF;

        -- Create active enrollment if team/program specified
        IF v_invite.program_id IS NOT NULL THEN
            IF v_child_id IS NOT NULL THEN
                INSERT INTO public.enrollments (school_id, program_id, child_id, status, start_date)
                VALUES (v_invite.school_id, v_invite.program_id, v_child_id, 'active', CURRENT_DATE)
                ON CONFLICT DO NOTHING;
            ELSIF v_invite.role_to_assign = 'athlete' THEN
                INSERT INTO public.enrollments (school_id, program_id, user_id, status, start_date)
                VALUES (v_invite.school_id, v_invite.program_id, auth.uid(), 'active', CURRENT_DATE)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    -- 5. Logic for Coaches (Auto-assignment to Team)
    IF v_invite.role_to_assign = 'coach' AND v_invite.program_id IS NOT NULL THEN
        -- Identify the staff record (created by trigger above)
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

-- Also update standard accept_invitation to point to _pro or have same logic
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN public.accept_invitation_pro(p_invite_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
