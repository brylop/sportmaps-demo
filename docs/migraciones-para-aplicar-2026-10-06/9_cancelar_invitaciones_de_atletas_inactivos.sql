-- =============================================================================
-- Limpieza única de DATOS (no es migración): cancelar invitaciones de acudiente
-- pendientes cuyo atleta ya está inactivo. Aplicar DESPUÉS de
-- 20261006101735_desactivar_atleta_cancela_invitacion (que evita casos nuevos).
--
-- Corte 2026-10-06 10:20: 55 filas (54 DYNASTY VOLLEY CLUB, 1 Dreamers
-- Gymnastics). Todas de menores (`children`) inactivos, ninguna con homónimo
-- activo en la escuela. Incluye a sarmientobeverly@gmail.com (Isabella Mancera).
-- No borra nada: solo pasa status 'pending' → 'cancelled'.
-- =============================================================================

-- 1) Previsualizar (debe dar 55 o menos si alguna ya se aceptó/canceló)
WITH objetivo AS (
    SELECT i.id
      FROM public.invitations i
     WHERE i.status = 'pending'
       AND i.role_to_assign = 'parent'
       AND btrim(coalesce(i.child_name, '')) <> ''
       -- hay al menos un menor con ese nombre en la escuela…
       AND EXISTS (
           SELECT 1 FROM public.children c
            WHERE lower(btrim(c.full_name)) = lower(btrim(i.child_name))
              AND (c.school_id = i.school_id
                   OR EXISTS (SELECT 1 FROM public.enrollments e
                               WHERE e.child_id = c.id AND e.school_id = i.school_id)))
       -- …y ninguno activo (ni menor ni ficha sin cuenta)
       AND NOT EXISTS (
           SELECT 1 FROM public.children c
            WHERE c.is_active
              AND lower(btrim(c.full_name)) = lower(btrim(i.child_name))
              AND (c.school_id = i.school_id
                   OR EXISTS (SELECT 1 FROM public.enrollments e
                               WHERE e.child_id = c.id AND e.school_id = i.school_id)))
       AND NOT EXISTS (
           SELECT 1 FROM public.unregistered_athletes u
            WHERE u.school_id = i.school_id
              AND u.is_active
              AND (u.invitation_id = i.id
                   OR lower(btrim(u.full_name)) = lower(btrim(i.child_name))))
)
SELECT s.name, i.child_name, i.email
  FROM public.invitations i
  JOIN public.schools s ON s.id = i.school_id
 WHERE i.id IN (SELECT id FROM objetivo)
 ORDER BY s.name, i.child_name;

-- 2) Aplicar (mismo filtro)
BEGIN;
UPDATE public.invitations i
   SET status = 'cancelled'
 WHERE i.status = 'pending'
   AND i.role_to_assign = 'parent'
   AND btrim(coalesce(i.child_name, '')) <> ''
   AND EXISTS (
       SELECT 1 FROM public.children c
        WHERE lower(btrim(c.full_name)) = lower(btrim(i.child_name))
          AND (c.school_id = i.school_id
               OR EXISTS (SELECT 1 FROM public.enrollments e
                           WHERE e.child_id = c.id AND e.school_id = i.school_id)))
   AND NOT EXISTS (
       SELECT 1 FROM public.children c
        WHERE c.is_active
          AND lower(btrim(c.full_name)) = lower(btrim(i.child_name))
          AND (c.school_id = i.school_id
               OR EXISTS (SELECT 1 FROM public.enrollments e
                           WHERE e.child_id = c.id AND e.school_id = i.school_id)))
   AND NOT EXISTS (
       SELECT 1 FROM public.unregistered_athletes u
        WHERE u.school_id = i.school_id
          AND u.is_active
          AND (u.invitation_id = i.id
               OR lower(btrim(u.full_name)) = lower(btrim(i.child_name))));
-- Esperado: UPDATE 55 (o menos). Si da más, ROLLBACK.
COMMIT;

-- 3) Verificar: la de Beverly quedó cancelada
SELECT id, status FROM public.invitations WHERE id = '28c7071d-5341-40fc-98f6-954405fedc31';
