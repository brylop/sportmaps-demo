-- Migration: Fix invitation RPC roles and identification
-- Description: Ensures school_admin and other admin roles can send invitations correctly.

CREATE OR REPLACE FUNCTION public.invite_parent_to_school(
    p_parent_email text,
    p_child_name text DEFAULT NULL,
    p_program_id uuid DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
    v_invitation_id uuid;
BEGIN
    -- 1. Identify the school managed by the sender
    -- Check if owner
    SELECT id INTO v_school_id 
    FROM public.schools 
    WHERE owner_id = auth.uid() 
    LIMIT 1;
    
    -- Check if member with admin roles
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id 
        FROM public.school_members 
        WHERE profile_id = auth.uid() 
          AND role IN ('admin', 'admin', 'owner') 
          AND status = 'active'
        LIMIT 1;
    END IF;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una escuela administrada por ti para enviar la invitación.';
    END IF;

    -- 2. Create or UPDATE existing pending invitation for this email/school
    -- We use LOWER(TRIM()) to avoid duplicates due to casing/whitespace
    INSERT INTO public.invitations (
        email, 
        school_id, 
        role_to_assign, 
        invited_by, 
        child_name, 
        program_id, 
        monthly_fee, 
        status
    )
    VALUES (
        LOWER(TRIM(p_parent_email)), 
        v_school_id, 
        'parent', 
        auth.uid(), 
        p_child_name, 
        p_program_id, 
        p_monthly_fee, 
        'pending'
    )
    ON CONFLICT (email, school_id, role_to_assign) WHERE status = 'pending' 
    DO UPDATE SET 
        child_name = EXCLUDED.child_name,
        program_id = EXCLUDED.program_id,
        monthly_fee = EXCLUDED.monthly_fee,
        invited_by = EXCLUDED.invited_by,
        created_at = now()
    RETURNING id INTO v_invitation_id;
    
    RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
