-- Add is_demo flag to identify demo data
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Update existing schools policy to exclude demo data for non-demo users
DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools;

CREATE POLICY "Users can view non-demo schools"
ON public.schools
FOR SELECT
USING (
  is_demo = false 
  OR auth.uid() = owner_id
);

CREATE POLICY "Demo users can view demo schools"
ON public.schools
FOR SELECT
USING (
  is_demo = true 
  AND EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email LIKE '%@demo.sportmaps.com'
  )
);

-- Update programs policy to exclude demo data
DROP POLICY IF EXISTS "Anyone can view active programs" ON public.programs;

CREATE POLICY "Users can view non-demo programs"
ON public.programs
FOR SELECT
USING (
  (is_demo = false AND active = true)
  OR EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = programs.school_id 
    AND schools.owner_id = auth.uid()
  )
);

-- Ensure school owners only see their own data
DROP POLICY IF EXISTS "School owners can manage programs" ON public.programs;

CREATE POLICY "School owners can manage own programs"
ON public.programs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = programs.school_id 
    AND schools.owner_id = auth.uid()
  )
);

-- Update children policies to exclude demo data
CREATE POLICY "Parents can view non-demo children"
ON public.children
FOR SELECT
USING (
  (auth.uid() = parent_id AND is_demo = false)
  OR (is_demo = true AND EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email LIKE '%@demo.sportmaps.com'
  ))
);

-- Update teams policies
CREATE POLICY "Coaches can view non-demo teams"
ON public.teams
FOR SELECT
USING (
  (auth.uid() = coach_id AND is_demo = false)
  OR (is_demo = true AND EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email LIKE '%@demo.sportmaps.com'
  ))
);