-- Create student_invitations table for school invitations
CREATE TABLE IF NOT EXISTS public.student_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  invited_email TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT email_or_child CHECK (
    (invited_email IS NOT NULL AND child_id IS NULL) OR 
    (invited_email IS NULL AND child_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.student_invitations ENABLE ROW LEVEL SECURITY;

-- School owners can view, create, and manage invitations for their schools
CREATE POLICY "School owners can manage invitations"
ON public.student_invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.schools
    WHERE schools.id = student_invitations.school_id
    AND schools.owner_id = auth.uid()
  )
);

-- Parents can view invitations sent to their children
CREATE POLICY "Parents can view invitations to their children"
ON public.student_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = student_invitations.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Parents can update invitation status (accept/reject)
CREATE POLICY "Parents can update invitation status"
ON public.student_invitations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = student_invitations.child_id
    AND children.parent_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('accepted', 'rejected')
);

-- Create trigger for updated_at
CREATE TRIGGER update_student_invitations_updated_at
BEFORE UPDATE ON public.student_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_student_invitations_school_id ON public.student_invitations(school_id);
CREATE INDEX idx_student_invitations_child_id ON public.student_invitations(child_id);
CREATE INDEX idx_student_invitations_status ON public.student_invitations(status);