-- Fix: students view had price_monthly hardcoded as 0.0
-- Now it reads the actual price from teams.price_monthly or children.monthly_fee
CREATE OR REPLACE VIEW public.students AS
SELECT c.id,
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
    p.full_name AS parent_name,
    p.phone AS parent_phone,
    p.avatar_url AS parent_avatar,
    p.email AS parent_email,
    e.id AS enrollment_id,
    e.status AS enrollment_status,
    e.start_date AS enrollment_date,
    t.name AS program_name,
    t.sport AS program_sport,
    COALESCE(t.price_monthly, c.monthly_fee, 0) AS price_monthly,
    b.name AS branch_name
FROM children c
    LEFT JOIN profiles p ON p.id = c.parent_id
    LEFT JOIN enrollments e ON e.child_id = c.id AND e.status = 'active'::text
    LEFT JOIN teams t ON t.id = COALESCE(e.team_id, e.program_id, c.team_id)
    LEFT JOIN school_branches b ON b.id = c.branch_id;
