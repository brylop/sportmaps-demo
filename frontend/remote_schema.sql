-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.academic_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  skill_name text NOT NULL,
  skill_level integer NOT NULL CHECK (skill_level >= 0 AND skill_level <= 100),
  coach_id uuid,
  evaluation_date timestamp with time zone NOT NULL DEFAULT now(),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_progress_pkey PRIMARY KEY (id)
);
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  program_id uuid,
  title text NOT NULL,
  description text,
  activity_type text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::activity_status,
  scheduled_at timestamp with time zone NOT NULL,
  duration_minutes integer,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT activities_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id)
);
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  child_id uuid,
  class_date date NOT NULL,
  status text CHECK (status = ANY (ARRAY['attended'::text, 'absent'::text, 'justified'::text, 'late'::text])),
  justification_reason text,
  justified_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_justified_by_fkey FOREIGN KEY (justified_by) REFERENCES auth.users(id),
  CONSTRAINT attendance_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  team_id uuid,
  title text NOT NULL,
  description text,
  event_type text CHECK (event_type = ANY (ARRAY['training'::text, 'match'::text, 'meeting'::text, 'evaluation'::text, 'other'::text])),
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  all_day boolean DEFAULT false,
  is_demo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.children (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  avatar_url text,
  medical_info text,
  school_id uuid,
  team_name text,
  sport text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT children_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['general'::text, 'technical'::text, 'business'::text, 'partnership'::text, 'feedback'::text, 'other'::text])),
  message text NOT NULL,
  status text DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  assigned_to uuid,
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contact_messages_pkey PRIMARY KEY (id),
  CONSTRAINT contact_messages_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  program_id uuid,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'completed'::text, 'pending'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id)
);
CREATE TABLE public.join_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  experience text CHECK (experience = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'professional'::text])),
  interests text NOT NULL,
  motivation text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT join_applications_pkey PRIMARY KEY (id),
  CONSTRAINT join_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT join_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.match_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  opponent text NOT NULL,
  home_score integer DEFAULT 0,
  away_score integer DEFAULT 0,
  is_home boolean DEFAULT true,
  match_date date NOT NULL,
  match_type text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  opponent_team_id uuid,
  CONSTRAINT match_results_pkey PRIMARY KEY (id),
  CONSTRAINT match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT match_results_opponent_team_id_fkey FOREIGN KEY (opponent_team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  subject text NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id),
  CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text,
  read boolean DEFAULT false,
  link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  product_id uuid,
  quantity integer,
  unit_price numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  total_amount numeric NOT NULL,
  status text DEFAULT 'pending'::text,
  shipping_address jsonb,
  contact_phone text,
  contact_email text,
  payment_method text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  amount numeric NOT NULL,
  concept text NOT NULL,
  due_date date NOT NULL,
  payment_date date,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text])),
  receipt_number text,
  receipt_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_owner_id uuid,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_store_owner_id_fkey FOREIGN KEY (store_owner_id) REFERENCES auth.users(id),
  CONSTRAINT products_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  bio text,
  role USER-DEFINED NOT NULL DEFAULT 'athlete'::user_role,
  is_demo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  location text,
  sports_interests ARRAY,
  experience_level text CHECK (experience_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'professional'::text])),
  is_verified boolean DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  name text NOT NULL,
  description text,
  sport text NOT NULL,
  schedule jsonb,
  price_monthly numeric NOT NULL DEFAULT 0,
  age_min integer,
  age_max integer,
  max_participants integer,
  current_participants integer DEFAULT 0,
  active boolean DEFAULT true,
  image_url text,
  is_demo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT programs_pkey PRIMARY KEY (id),
  CONSTRAINT programs_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  description text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  cover_image_url text,
  sports ARRAY,
  amenities ARRAY,
  rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  verified boolean DEFAULT false,
  is_demo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  school_type text DEFAULT 'academy'::text,
  category_id uuid,
  schedule jsonb,
  pricing jsonb,
  CONSTRAINT schools_pkey PRIMARY KEY (id),
  CONSTRAINT schools_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT schools_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.sports_categories(id)
);
CREATE TABLE public.spm_users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'athlete'::text CHECK (role = ANY (ARRAY['athlete'::text, 'parent'::text, 'coach'::text, 'school'::text, 'wellness_professional'::text, 'store_owner'::text, 'admin'::text])),
  avatar_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT spm_users_pkey PRIMARY KEY (id),
  CONSTRAINT spm_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.sports_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sports_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sports_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid,
  brand text,
  price numeric,
  currency text DEFAULT 'COP'::text,
  image_url text,
  specifications jsonb,
  is_available boolean DEFAULT true,
  stock_quantity integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sports_equipment_pkey PRIMARY KEY (id),
  CONSTRAINT sports_equipment_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.sports_categories(id)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  player_name text NOT NULL,
  player_number integer,
  position text,
  parent_contact text,
  created_at timestamp with time zone DEFAULT now(),
  profile_id uuid,
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid,
  name text NOT NULL,
  sport text NOT NULL,
  age_group text,
  season text,
  is_demo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'hr'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.wellness_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  professional_id uuid,
  athlete_id uuid,
  date date NOT NULL,
  type text CHECK (type = ANY (ARRAY['Fisioterapia'::text, 'Nutrición'::text, 'Psicología'::text, 'Medicina Deportiva'::text])),
  notes text,
  status text DEFAULT 'completed'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wellness_evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT wellness_evaluations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES auth.users(id),
  CONSTRAINT wellness_evaluations_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id)
);
