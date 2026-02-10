-- =====================================================
-- SECURITY HARDENING: RLS Policies + Public Views
-- Date: 2026-02-09
-- Purpose: Restrict PII exposure on profiles and school_staff
-- =====================================================

-- ============================================================
-- 1. PROFILES: Restrict SELECT to own profile + admin
-- ============================================================

-- Drop the overly permissive "view all" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Own profile: full access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin: can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.role = 'admin'
    )
  );

-- School owners: can view profiles of enrolled students
DROP POLICY IF EXISTS "School owners can view enrolled student profiles" ON public.profiles;
CREATE POLICY "School owners can view enrolled student profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.programs p ON p.id = e.program_id
      JOIN public.schools s ON s.id = p.school_id
      WHERE e.user_id = profiles.id
      AND s.owner_id = auth.uid()
    )
  );

-- Coaches: can view profiles of athletes in their school's programs
DROP POLICY IF EXISTS "Coaches can view athlete profiles in their school" ON public.profiles;
CREATE POLICY "Coaches can view athlete profiles in their school"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.school_staff ss
      WHERE ss.email = (auth.jwt() ->> 'email')
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.programs p ON p.id = e.program_id
        WHERE p.school_id = ss.school_id
        AND e.user_id = profiles.id
      )
    )
  );

-- ============================================================
-- 2. PUBLIC PROFILES VIEW (safe columns only)
-- ============================================================
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  role,
  bio
FROM public.profiles;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================
-- 3. SCHOOL_STAFF: Restrict SELECT to school owners + admin
-- ============================================================

-- Drop the overly permissive "viewable by coaches" policy
DROP POLICY IF EXISTS "Staff is viewable by coaches" ON public.school_staff;

-- Admin: can view all staff
DROP POLICY IF EXISTS "Admins can view all staff" ON public.school_staff;
CREATE POLICY "Admins can view all staff"
  ON public.school_staff FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 4. PUBLIC STAFF VIEW (safe columns only, for microsites)
-- ============================================================
DROP VIEW IF EXISTS public.public_staff;

CREATE VIEW public.public_staff AS
SELECT
  id,
  school_id,
  full_name,
  specialty,
  status
FROM public.school_staff;

GRANT SELECT ON public.public_staff TO anon, authenticated;

-- ============================================================
-- 5. BIO LENGTH CONSTRAINT (prevent storage abuse)
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS bio_max_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT bio_max_length CHECK (char_length(bio) <= 500);

-- ============================================================
-- 6. FACILITIES: Ensure public SELECT exists for microsites
-- ============================================================
-- This policy already exists ("Anyone can view facilities")
-- Verify it's in place:
DROP POLICY IF EXISTS "Anyone can view facilities" ON public.facilities;
CREATE POLICY "Anyone can view facilities" ON public.facilities
  FOR SELECT USING (true);
