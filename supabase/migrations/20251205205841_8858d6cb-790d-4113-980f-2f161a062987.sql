-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('athlete', 'parent', 'coach', 'school', 'wellness_professional', 'store_owner', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable Row-Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
-- Users can only view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can manage roles (via has_role function)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
);

-- Create SECURITY DEFINER function to check roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
$$;

-- Migrate existing roles from profiles table to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
    id as user_id,
    role::text::app_role as role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Create trigger to automatically assign default role on new user creation
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_text text;
    v_role app_role;
BEGIN
    -- Get role from user metadata
    role_text := NEW.raw_user_meta_data->>'role';
    
    -- Validate and set role (exclude admin from self-assignment)
    IF role_text = ANY (ARRAY['athlete','parent','coach','school','wellness_professional','store_owner']) THEN
        v_role := role_text::app_role;
    ELSE
        v_role := 'athlete'::app_role;
    END IF;
    
    -- Insert into user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_default_role();