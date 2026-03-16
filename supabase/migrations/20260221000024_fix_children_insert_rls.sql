-- Fix: Permitir a los padres autenticados insertar hijos
-- La política existente "children_insert_staff" solo permite a owner/admin/coach
-- Los padres necesitan poder registrar a sus propios hijos

-- Permitir INSERT a padres autenticados (parent_id debe ser su propio uid)
CREATE POLICY "children_insert_parent"
ON children FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND parent_id = auth.uid()
);

-- Reload schema cache
NOTIFY pgrst, 'reload config';
