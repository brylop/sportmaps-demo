-- Migration: Add Classes and Class Enrollments (20260717140000)
-- Description: Adds tables for managing class schedules and student enrollment in specific classes, essential for attendance.

-- 1. Create 'classes' table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Assigned coach
    name TEXT, -- Optional name like "Group A - Beginners"
    day_of_week TEXT NOT NULL, -- 'Monday', 'Tuesday', etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INTEGER DEFAULT 20,
    current_enrollment INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create 'class_enrollments' junction table (Enrollment <-> Class)
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE, -- Links to the main program enrollment
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, enrollment_id)
);

-- 3. Add 'class_id' to 'attendance_records'
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- 4. Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- 5. Policies for 'classes'

-- View: Everyone in the school (staff, parents, students) should be able to view classes
DROP POLICY IF EXISTS "View classes for school members" ON public.classes;
CREATE POLICY "View classes for school members"
ON public.classes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = classes.school_id
      AND sm.status = 'active'
  ) OR 
  EXISTS ( -- Parents can view classes their children might be in
      SELECT 1 FROM public.children c
      WHERE c.parent_id = auth.uid()
      AND c.school_id = classes.school_id
  )
);

-- Manage: Only Staff (Owner, Admin, Coach)
DROP POLICY IF EXISTS "Manage classes for school staff" ON public.classes;
CREATE POLICY "Manage classes for school staff"
ON public.classes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = classes.school_id
      AND sm.role IN ('owner', 'admin', 'coach', 'staff')
      AND sm.status = 'active'
  )
);

-- 6. Policies for 'class_enrollments'

-- View: Staff and Parents (of enrolled child)
DROP POLICY IF EXISTS "View class enrollments" ON public.class_enrollments;
CREATE POLICY "View class enrollments"
ON public.class_enrollments
FOR SELECT
USING (
  -- Staff
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.school_members sm ON sm.school_id = c.school_id
    WHERE c.id = class_enrollments.class_id
      AND sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'admin', 'coach', 'staff')
  ) OR
  -- Parent
  EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.children ch ON ch.id = e.child_id -- assuming enrollment links to child/student
    WHERE e.id = class_enrollments.enrollment_id
      AND ch.parent_id = auth.uid()
  )
);

-- Manage: Staff only
DROP POLICY IF EXISTS "Manage class enrollments for staff" ON public.class_enrollments;
CREATE POLICY "Manage class enrollments for staff"
ON public.class_enrollments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.school_members sm ON sm.school_id = c.school_id
    WHERE c.id = class_enrollments.class_id
      AND sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'admin', 'coach', 'staff')
  )
);
