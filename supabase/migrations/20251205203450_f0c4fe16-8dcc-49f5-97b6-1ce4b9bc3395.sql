-- Remove the overly permissive public policy that exposes contact info
DROP POLICY IF EXISTS "Public can view non-demo schools" ON public.schools;

-- Update the existing policy to require authentication for viewing schools
-- Authenticated users can view non-demo schools
DROP POLICY IF EXISTS "Users can view non-demo schools" ON public.schools;

CREATE POLICY "Authenticated users can view non-demo schools" 
ON public.schools 
FOR SELECT 
TO authenticated
USING ((is_demo = false) OR (auth.uid() = owner_id));

-- Keep demo users policy as is (already requires authentication via is_demo_user function)
-- The "Demo users can view demo schools" policy is fine

-- School owners policies remain unchanged as they require auth.uid()