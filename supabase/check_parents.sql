-- Script para consultar padres registrados en la base de datos

-- 1. Listar todos los perfiles de usuarios que son Padres (tienen hijos asociados)
SELECT 
    p.id AS parent_id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at,
    COUNT(c.id) AS children_count
FROM profiles p
JOIN children c ON p.id = c.parent_id
GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at
ORDER BY p.created_at DESC;

-- 2. Listar usuarios con rol 'parent' en alguna escuela (tabla school_members)
SELECT 
    p.full_name,
    p.email,
    s.name AS school_name,
    sm.status,
    sm.created_at AS member_since
FROM school_members sm
JOIN profiles p ON sm.profile_id = p.id
JOIN schools s ON sm.school_id = s.id
WHERE sm.role = 'parent'
ORDER BY sm.created_at DESC;

-- 3. Ver todos los perfiles (si quieres identificar posibles padres sin rol aun)
-- SELECT * FROM profiles LIMIT 20;

-- 4. Ver tabla children para ver si hay hijos sin padre asignado (parent_id IS NULL)
SELECT 
    id, 
    full_name, 
    parent_email_temp, -- Email temporal usado para invitar
    school_id 
FROM children 
WHERE parent_id IS NULL;
