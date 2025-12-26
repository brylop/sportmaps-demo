-- Allow everyone (including anonymous visitors) to view schools
-- This is needed for the public explore page

-- First drop the restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view non-demo schools" ON public.schools;
DROP POLICY IF EXISTS "Demo users can view demo schools" ON public.schools;

-- Create a simple public read policy for all schools
CREATE POLICY "Everyone can view schools"
ON public.schools FOR SELECT
USING (true);

-- Also ensure programs are publicly readable
DROP POLICY IF EXISTS "Demo users can view programs for demo schools" ON public.programs;
DROP POLICY IF EXISTS "Users can view programs for schools" ON public.programs;

CREATE POLICY "Everyone can view programs"
ON public.programs FOR SELECT
USING (true);