-- ==========================================
-- FIX COACH RLS POLICIES (Profiles & Certifications)
-- ==========================================

-- 1. COACH PROFILES
ALTER TABLE "public"."coach_profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can view their own profile" ON "public"."coach_profiles";
DROP POLICY IF EXISTS "Coaches can insert their own profile" ON "public"."coach_profiles";
DROP POLICY IF EXISTS "Coaches can update their own profile" ON "public"."coach_profiles";

-- View (Select)
CREATE POLICY "Coaches can view their own profile" 
ON "public"."coach_profiles" 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Insert
CREATE POLICY "Coaches can insert their own profile" 
ON "public"."coach_profiles" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Update
CREATE POLICY "Coaches can update their own profile" 
ON "public"."coach_profiles" 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- 2. COACH CERTIFICATIONS (Consolidado/Refuerzo)
ALTER TABLE "public"."coach_certifications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can view their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can insert their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can update their own certifications" ON "public"."coach_certifications";
DROP POLICY IF EXISTS "Coaches can delete their own certifications" ON "public"."coach_certifications";

-- View
CREATE POLICY "Coaches can view their own certifications" 
ON "public"."coach_certifications" 
FOR SELECT 
TO authenticated 
USING (auth.uid() = coach_id);

-- Insert
CREATE POLICY "Coaches can insert their own certifications" 
ON "public"."coach_certifications" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = coach_id);

-- Update
CREATE POLICY "Coaches can update their own certifications" 
ON "public"."coach_certifications" 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Delete
CREATE POLICY "Coaches can delete their own certifications" 
ON "public"."coach_certifications" 
FOR DELETE 
TO authenticated 
USING (auth.uid() = coach_id);
