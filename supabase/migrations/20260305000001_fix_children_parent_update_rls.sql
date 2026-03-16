-- Fix: Parent UPDATE policy needs explicit WITH CHECK
-- The previous policy had no WITH CHECK, causing 403 on PATCH
DROP POLICY IF EXISTS "Children: update parent" ON public.children;

CREATE POLICY "Children: update parent"
ON public.children
FOR UPDATE
TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);
