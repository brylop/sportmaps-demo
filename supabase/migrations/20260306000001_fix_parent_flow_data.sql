-- Migration to fix parent name display in students view and get_invitation_details returns

-- 1. Update the 'students' view to use parent_name_temp if profile is not linked
DROP VIEW IF EXISTS public.students;

CREATE OR REPLACE VIEW public.students AS
SELECT 
    c.id,
    c.full_name,
    c.date_of_birth,
    c.avatar_url,
    c.school_id,
    c.branch_id,
    c.parent_id,
    c.program_id,
    c.team_id,
    c.grade,
    c.medical_info,
    c.emergency_contact,
    c.created_at,
    c.updated_at,
    c.is_active,
    CASE
        WHEN c.is_active THEN 'active'::text
        ELSE 'inactive'::text
    END AS status,
    
    -- The core fix: Fallback to the temporary name created by the admin
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    p.avatar_url AS parent_avatar,
    
    e.id AS enrollment_id,
    e.status AS enrollment_status,
    e.start_date AS enrollment_date,
    
    t.name AS program_name,
    t.sport AS program_sport,
    COALESCE(t.price_monthly, c.monthly_fee, 0::numeric) AS price_monthly,
    
    b.name AS branch_name
FROM children c
LEFT JOIN profiles p ON p.id = c.parent_id
LEFT JOIN enrollments e ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN teams t ON t.id = COALESCE(e.team_id, e.program_id, c.team_id)
LEFT JOIN school_branches b ON b.id = c.branch_id;

-- Ensure view acts as invoker to respect RLS (from earlier security fixes)
ALTER VIEW public.students SET (security_invoker = true);


-- 2. Update get_invitation_details to include team name and monthly fee
DROP FUNCTION IF EXISTS public.get_invitation_details(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_details(p_invite_id uuid)
RETURNS TABLE (
    school_name text,
    role_to_assign text,
    child_name text,
    status text,
    program_name text,
    monthly_fee numeric,
    branch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.name as school_name,
        i.role_to_assign,
        i.child_name,
        i.status,
        t.name as program_name,
        COALESCE(i.monthly_fee, t.price_monthly, 0) as monthly_fee,
        b.name as branch_name
    FROM public.invitations i
    JOIN public.schools s ON i.school_id = s.id
    LEFT JOIN public.teams t ON t.id = i.program_id
    LEFT JOIN public.school_branches b ON b.id = i.branch_id
    WHERE i.id = p_invite_id;
END;
$$;
