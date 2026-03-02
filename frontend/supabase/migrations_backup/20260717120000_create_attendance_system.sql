-- Create robust attendance system linked to programs and children
-- This replaces/supercedes any previous simple attendance table

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_school_id ON public.attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_program_id ON public.attendance_records(program_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records(date);

-- Policies

-- 1. School Staff (Owner, Admin, Coach, Staff) can view and manage attendance for their school
DROP POLICY IF EXISTS "School staff manage attendance" ON public.attendance_records;
CREATE POLICY "School staff manage attendance"
ON public.attendance_records
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.school_id = attendance_records.school_id
      AND sm.role IN ('owner', 'admin', 'coach', 'staff')
      AND sm.status = 'active'
  )
);

-- 2. Parents can view attendance for their own children
DROP POLICY IF EXISTS "Parents view own children attendance" ON public.attendance_records;
CREATE POLICY "Parents view own children attendance"
ON public.attendance_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = attendance_records.student_id
      AND c.parent_id = auth.uid()
  )
);

-- 3. Athletes (if they have user accounts linked) can view their own attendance
-- (Assuming children table has a user_id or we link via profile, but currently children table is just records)
-- Skipping for now until athlete accounts are fully defined.
