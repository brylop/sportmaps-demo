-- Migration: Aggressive Duplicate Invitations Cleanup and Upsert fix
-- Description: Unifies duplicates ignoring case sensitivity, whitespace, and program_id variations. Updates create_invitation to be robust.

BEGIN;

-- 1. Aggressive Cleanup for 'pending'
WITH aggressive_pending_duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY 
                   school_id, 
                   LOWER(TRIM(email)), 
                   role_to_assign, 
                   LOWER(TRIM(COALESCE(child_name, '')))
               ORDER BY created_at DESC -- Keep the newest
           ) as rn
    FROM public.invitations
    WHERE status = 'pending'
)
DELETE FROM public.invitations
WHERE id IN (SELECT id FROM aggressive_pending_duplicates WHERE rn > 1);

-- 2. Aggressive Cleanup for 'accepted'
WITH aggressive_accepted_duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY 
                   school_id, 
                   LOWER(TRIM(email)), 
                   role_to_assign, 
                   LOWER(TRIM(COALESCE(child_name, '')))
               ORDER BY created_at ASC -- Keep the oldest (first one accepted)
           ) as rn
    FROM public.invitations
    WHERE status = 'accepted'
)
DELETE FROM public.invitations
WHERE id IN (SELECT id FROM aggressive_accepted_duplicates WHERE rn > 1);


-- 3. Update create_invitation RPC to completely prevent duplicates ignoring program_id differences
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

    -- Check if a pending invitation already exists for this exact person/role/child
    SELECT id INTO v_id 
    FROM public.invitations
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND school_id = v_school_id
      AND role_to_assign = p_role
      AND LOWER(TRIM(COALESCE(child_name, ''))) = LOWER(TRIM(COALESCE(p_child_name, '')))
      AND status = 'pending'
    LIMIT 1;

    IF v_id IS NOT NULL THEN
        -- Update the existing invitation with latest details (price, phone, branch, program)
        -- This ensures if we invite again with a different program, it just updates the pending ticket
        UPDATE public.invitations
        SET monthly_fee = p_monthly_fee,
            parent_phone = p_parent_phone,
            branch_id = p_branch_id,
            program_id = p_program_id
        WHERE id = v_id;
        
        RETURN v_id;
    END IF;

    -- Create new invitation
    INSERT INTO public.invitations (
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
        LOWER(TRIM(p_email)), 
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

COMMIT;
