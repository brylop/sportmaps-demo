-- Migration: Unified Invitation System (Schema & RPCs)
-- Description: Adds linking fields to invitations and children, and updates RPCs for automated parent-student linking.

BEGIN;

-- 1. Update Invitations Table
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS child_name text,
ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id),
ADD COLUMN IF NOT EXISTS monthly_fee numeric;

-- 2. Update Children Table (Temp fields for matching)
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS parent_email_temp text,
ADD COLUMN IF NOT EXISTS parent_phone_temp text;

-- 3. Solidify invite_parent_to_school RPC
DROP FUNCTION IF EXISTS public.invite_parent_to_school(text);
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
    -- Identify the school managed by the sender
    SELECT id INTO v_school_id 
    FROM public.schools 
    WHERE owner_id = auth.uid() 
    LIMIT 1;
    
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id 
        FROM public.school_members 
        WHERE profile_id = auth.uid() AND role IN ('admin', 'school_admin', 'owner') AND status = 'active'
        LIMIT 1;
    END IF;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una escuela administrada por ti para enviar la invitación.';
    END IF;

    -- Create or UPDATE existing pending invitation for this email/school
    INSERT INTO public.invitations (email, school_id, role_to_assign, invited_by, child_name, program_id, monthly_fee, status)
    VALUES (LOWER(TRIM(p_parent_email)), v_school_id, 'parent', auth.uid(), p_child_name, p_program_id, p_monthly_fee, 'pending')
    ON CONFLICT (email, school_id, role_to_assign) WHERE status = 'pending' 
    DO UPDATE SET 
        child_name = EXCLUDED.child_name,
        program_id = EXCLUDED.program_id,
        monthly_fee = EXCLUDED.monthly_fee,
        created_at = now()
    RETURNING id INTO v_invitation_id;
    
    RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update accept_invitation to handle automated linking
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
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

    -- 2. Create official membership (if not exists)
    INSERT INTO public.school_members (school_id, profile_id, role, status)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active')
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = EXCLUDED.role;

    -- 3. LINK CHILDREN (The core of the request)
    -- Update any child records that were created with this parent's email
    UPDATE public.children 
    SET parent_id = auth.uid()
    WHERE LOWER(parent_email_temp) = v_user_email
    AND school_id = v_invite.school_id
    AND parent_id IS NULL; -- Only link if not already linked

    -- 3.1 LINK PAYMENTS (Synchronize pending payments created during pre-registration)
    UPDATE public.payments
    SET parent_id = auth.uid()
    WHERE child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
    AND parent_id IS NULL;

    -- 4. Mark invitation as accepted
    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;

    -- 5. Audit log
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action)
    VALUES (v_invite.school_id, auth.uid(), 'invitations', p_invite_id::text, 'ACCEPTED');

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure UNIQUE constraint for the UPSERT logic if needed, 
-- or just rely on the existing logic if we don't want strict uniqueness.
-- Actually, a partial unique index on pending invitations is good.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_invites ON public.invitations (email, school_id, role_to_assign) WHERE status = 'pending';

COMMIT;
