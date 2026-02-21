-- Migration: Add specific wrapper for parent invitations
-- Description: Matches the frontend snippet provided by the user

CREATE OR REPLACE FUNCTION public.invite_parent_to_school(p_parent_email text)
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
    v_invitation_id uuid;
BEGIN
    -- 1. Identify the school owned by the current user (the one sending the invite)
    SELECT id INTO v_school_id 
    FROM public.schools 
    WHERE owner_id = auth.uid() 
    LIMIT 1;
    
    IF v_school_id IS NULL THEN
        -- Fallback: Check if they are an admin in a school
        SELECT school_id INTO v_school_id 
        FROM public.school_members 
        WHERE profile_id = auth.uid() AND role = 'admin' AND status = 'active'
        LIMIT 1;
    END IF;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una escuela administrada por ti para enviar la invitación.';
    END IF;

    -- 2. Create the invitation
    INSERT INTO public.invitations (email, school_id, role_to_assign, invited_by)
    VALUES (LOWER(TRIM(p_parent_email)), v_school_id, 'parent', auth.uid())
    RETURNING id INTO v_invitation_id;
    
    RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
