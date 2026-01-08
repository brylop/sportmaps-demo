-- Create facilities table for school sports facilities
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- School owners can manage their facilities
CREATE POLICY "School owners can manage facilities" 
ON public.facilities 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.schools 
  WHERE schools.id = facilities.school_id 
  AND schools.owner_id = auth.uid()
));

-- Anyone can view facilities (for public listing)
CREATE POLICY "Anyone can view facilities" 
ON public.facilities 
FOR SELECT 
USING (true);

-- Create staff table for school employees/coaches
CREATE TABLE public.school_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  certifications TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.school_staff ENABLE ROW LEVEL SECURITY;

-- School owners can manage their staff
CREATE POLICY "School owners can manage staff" 
ON public.school_staff 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.schools 
  WHERE schools.id = school_staff.school_id 
  AND schools.owner_id = auth.uid()
));

-- Coaches can view staff in their school
CREATE POLICY "Staff is viewable by coaches" 
ON public.school_staff 
FOR SELECT 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_school_staff_updated_at
  BEFORE UPDATE ON public.school_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();