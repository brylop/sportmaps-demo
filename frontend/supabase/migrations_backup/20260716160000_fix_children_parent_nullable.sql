-- Make children.parent_id nullable to allow School Admins to upload students 
-- without requiring an existing parent account immediately.
ALTER TABLE public.children ALTER COLUMN parent_id DROP NOT NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
