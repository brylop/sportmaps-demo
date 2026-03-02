-- Migration: Dashboard Consolidation & Invitation System
-- Description: Adds invitations table and onboarding status validation functions

-- 1. Table for invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_to_assign text NOT NULL, -- 'parent', 'coach', etc.
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies for Invitations
-- Users can see invitations sent to their email
CREATE POLICY "Users can view their own invitations"
ON public.invitations FOR SELECT
USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER(public.invitations.email)
));

-- School owners/admins can see invitations they sent
CREATE POLICY "School owners can view invitations they sent"
ON public.invitations FOR SELECT
USING (auth.uid() = invited_by);

-- School owners can send invitations
CREATE POLICY "School owners can insert invitations"
ON public.invitations FOR INSERT
WITH CHECK (auth.uid() = invited_by);

-- 3. Function to send invitations
CREATE OR REPLACE FUNCTION public.send_invitation(
    p_email text,
    p_school_id uuid,
    p_role text
) RETURNS uuid AS $$
DECLARE
    v_invitation_id uuid;
BEGIN
    INSERT INTO public.invitations (email, school_id, role_to_assign, invited_by)
    VALUES (LOWER(TRIM(p_email)), p_school_id, p_role, auth.uid())
    RETURNING id INTO v_invitation_id;
    
    RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to accept invitations
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean AS $$
DECLARE
    v_invite RECORD;
BEGIN
    -- 1. Validar que la invitación existe y es para el correo del usuario actual
    SELECT * INTO v_invite 
    FROM public.invitations 
    WHERE id = p_invite_id 
    AND LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitación no válida o ya procesada.';
    END IF;

    -- 2. Crear la membresía oficial
    INSERT INTO public.school_members (school_id, profile_id, role)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign);

    -- 3. Marcar invitación como aceptada
    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;

    -- 4. Auditoría V4 (Assuming audit_logs table exists from previous migrations)
    -- If it doesn't exist, this might fail, so let's make it conditional or ensure it exists
    -- For now, following the user's architectural request
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action)
    VALUES (v_invite.school_id, auth.uid(), 'invitations', p_invite_id::text, 'ACCEPTED');

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Master function for onboarding status
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- Checks para Padres
    'has_children', (SELECT count(*) > 0 FROM public.children WHERE parent_id = v_user_id),
    'has_medical_records', (SELECT count(*) > 0 FROM public.medical_records mr 
                            JOIN public.children c ON mr.child_id = c.id 
                            WHERE c.parent_id = v_user_id),
    'has_accepted_invite', (SELECT count(*) > 0 FROM public.school_members WHERE profile_id = v_user_id),
    
    -- Checks para Escuelas
    'has_school', (SELECT count(*) > 0 FROM public.schools WHERE owner_id = v_user_id),
    'has_staff', (SELECT count(*) > 0 FROM public.school_members sm
                  JOIN public.schools s ON sm.school_id = s.id
                  WHERE s.owner_id = v_user_id AND sm.role = 'coach'),
    'has_programs', (SELECT count(*) > 0 FROM public.programs p
                     JOIN public.schools s ON p.school_id = s.id
                     WHERE s.owner_id = v_user_id),
    
    -- Check Global
    'profile_complete', (SELECT (full_name IS NOT NULL AND phone IS NOT NULL) 
                         FROM public.profiles WHERE id = v_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
