-- =========================================================================
-- FIX: usuarios que se registraron via /join-team y quedaron con role
-- incorrecto en profiles (trigger handle_new_user uso otro default).
--
-- Cualquier profile cuyo ID este vinculado como parent_id en children
-- debe tener role='parent'.
-- =========================================================================

UPDATE public.profiles p
   SET role = 'parent',
       updated_at = now()
  FROM public.children c
 WHERE c.parent_id = p.id
   AND (p.role IS NULL OR p.role NOT IN ('parent', 'admin', 'super_admin'));

-- Verificar
SELECT p.id, p.email, p.full_name, p.role, COUNT(c.id) AS hijos
FROM public.profiles p
JOIN public.children c ON c.parent_id = p.id
GROUP BY p.id, p.email, p.full_name, p.role
ORDER BY p.updated_at DESC
LIMIT 10;
