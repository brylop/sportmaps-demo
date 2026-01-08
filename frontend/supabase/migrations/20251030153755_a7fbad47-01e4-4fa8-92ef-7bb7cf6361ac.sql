-- Table: children (hijos del padre)
CREATE TABLE public.children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_url TEXT,
  medical_info TEXT,
  school_id UUID,
  team_name TEXT,
  sport TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Policies for children
CREATE POLICY "Parents can view own children"
ON public.children FOR SELECT
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert own children"
ON public.children FOR INSERT
WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update own children"
ON public.children FOR UPDATE
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete own children"
ON public.children FOR DELETE
USING (auth.uid() = parent_id);

-- Table: academic_progress (progreso académico)
CREATE TABLE public.academic_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  skill_level INTEGER NOT NULL CHECK (skill_level >= 0 AND skill_level <= 100),
  coach_id UUID,
  evaluation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.academic_progress ENABLE ROW LEVEL SECURITY;

-- Policies for academic_progress
CREATE POLICY "Parents can view children's progress"
ON public.academic_progress FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.children
  WHERE children.id = academic_progress.child_id
  AND children.parent_id = auth.uid()
));

CREATE POLICY "Coaches can insert progress"
ON public.academic_progress FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own progress records"
ON public.academic_progress FOR UPDATE
USING (auth.uid() = coach_id);

-- Table: attendance (asistencias)
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL,
  class_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('attended', 'absent', 'justified')),
  justification_reason TEXT,
  justified_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies for attendance
CREATE POLICY "Parents can view children's attendance"
ON public.attendance FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.children
  WHERE children.id = attendance.child_id
  AND children.parent_id = auth.uid()
));

CREATE POLICY "Parents can justify absences"
ON public.attendance FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = attendance.child_id
    AND children.parent_id = auth.uid()
  )
  AND status = 'absent'
);

CREATE POLICY "Schools can manage attendance"
ON public.attendance FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'school'
));

-- Table: payments (pagos)
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  concept TEXT NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')),
  receipt_number TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for payments
CREATE POLICY "Parents can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can update own payments"
ON public.payments FOR UPDATE
USING (auth.uid() = parent_id);

CREATE POLICY "Schools can create payments"
ON public.payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'school'
));

-- Triggers for updated_at
CREATE TRIGGER update_children_updated_at
BEFORE UPDATE ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();