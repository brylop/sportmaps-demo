-- =========================================================================
-- Obtiene los IDs reales de jreyes@gmail.com: user, escuela y sede.
-- Copia el output y pasamelo para regenerar el SQL con IDs hardcoded.
-- =========================================================================

-- Info completa: user + escuela(s) + sede(s)
SELECT
    u.id            AS user_id,
    u.email         AS user_email,
    s.id            AS school_id,
    s.name          AS school_name,
    s.is_demo       AS school_is_demo,
    b.id            AS branch_id,
    b.name          AS branch_name,
    b.is_main       AS branch_is_main,
    b.status        AS branch_status
FROM auth.users u
LEFT JOIN public.schools s         ON s.owner_id  = u.id
LEFT JOIN public.school_branches b ON b.school_id = s.id
WHERE u.email = 'jreyes@gmail.com'
ORDER BY s.created_at, b.is_main DESC NULLS LAST, b.created_at;

-- Si no aparece escuela como owner, revisar si es school_member
SELECT
    u.id            AS user_id,
    u.email         AS user_email,
    sm.school_id    AS school_id,
    s.name          AS school_name,
    sm.role         AS member_role,
    sm.branch_id    AS member_branch_id,
    b.name          AS member_branch_name
FROM auth.users u
JOIN public.school_members sm ON sm.profile_id = u.id
LEFT JOIN public.schools s   ON s.id = sm.school_id
LEFT JOIN public.school_branches b ON b.id = sm.branch_id
WHERE u.email = 'jreyes@gmail.com';

-- Tambien lo mismo para mancipechirivi28 (para el script 04 de migracion)
SELECT
    'mancipechirivi28' AS owner,
    u.id               AS user_id,
    s.id               AS school_id,
    s.name             AS school_name,
    b.id               AS branch_id,
    b.name             AS branch_name,
    b.is_main          AS branch_is_main
FROM auth.users u
LEFT JOIN public.schools s         ON s.owner_id  = u.id
LEFT JOIN public.school_branches b ON b.school_id = s.id
WHERE u.email = 'mancipechirivi28@gmail.com'
ORDER BY b.is_main DESC NULLS LAST, b.created_at;
