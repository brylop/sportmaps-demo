-- ============================================================
-- SPORTMAPS PLATFORM — SCHEMA REFACTORIZADO (MULTI-TENANT)
-- MASTER PLAN v2.0
-- ============================================================

-- ============================================================
-- 0. EXTENSIONES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. ENUMS (Safe Creation)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'school', 'coach', 'parent', 'athlete', 'wellness_professional', 'store_owner');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.sub_tier AS ENUM ('free', 'basic', 'premium');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.exp_level AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'coach', 'staff', 'parent', 'athlete', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'pending', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.activity_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.attend_status AS ENUM ('present', 'absent', 'late', 'excused', 'justified');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.enroll_status AS ENUM ('active', 'cancelled', 'completed', 'pending');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.pay_status AS ENUM ('pending', 'paid', 'overdue', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.pay_method AS ENUM ('pse', 'card', 'transfer', 'cash', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.pay_type AS ENUM ('one_time', 'subscription');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.resv_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.event_kind AS ENUM ('tournament', 'clinic', 'tryout', 'camp', 'match', 'training', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'closed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.train_intensity AS ENUM ('low', 'medium', 'high', 'max');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.program_level AS ENUM ('iniciacion', 'intermedio', 'avanzado', 'alto_rendimiento');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 2. FUNCIÓN UTILITARIA: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- 3. CAPA A — CATÁLOGOS GLOBALES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sports_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  icon        text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text        NOT NULL UNIQUE,
  display_name text        NOT NULL,
  description  text,
  is_visible   boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sports_equipment (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid        REFERENCES public.sports_categories(id),
  name           text        NOT NULL,
  description    text,
  brand          text,
  price          numeric,
  currency       text        NOT NULL DEFAULT 'COP',
  image_url      text,
  specifications jsonb,
  is_available   boolean     NOT NULL DEFAULT true,
  stock_quantity integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. CAPA A — USUARIOS / PERFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text          NOT NULL,
  full_name            text,
  phone                text,
  avatar_url           text,
  bio                  text          CHECK (char_length(bio) <= 500),
  role                 public.user_role NOT NULL DEFAULT 'athlete',
  role_id              uuid          REFERENCES public.roles(id),
  date_of_birth        date,
  location             text,
  sports_interests     text[]        NOT NULL DEFAULT '{}',
  experience_level     public.exp_level,
  subscription_tier    public.sub_tier NOT NULL DEFAULT 'free',
  sportmaps_points     integer       NOT NULL DEFAULT 0,
  is_verified          boolean       NOT NULL DEFAULT false,
  onboarding_completed boolean       NOT NULL DEFAULT false,
  invitation_code      text,
  metadata             jsonb         NOT NULL DEFAULT '{}',
  is_demo              boolean       NOT NULL DEFAULT false,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('admin', 'hr')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.user_search_preferences (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_sports    text[]      NOT NULL DEFAULT '{}',
  preferred_cities    text[]      NOT NULL DEFAULT '{}',
  preferred_amenities text[]      NOT NULL DEFAULT '{}',
  max_price           numeric,
  min_age             integer,
  max_age             integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. CAPA B — ESCUELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.schools (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid        REFERENCES auth.users(id),
  category_id          uuid        REFERENCES public.sports_categories(id),
  name                 text        NOT NULL,
  description          text,
  school_type          text        NOT NULL DEFAULT 'academy',
  city                 text,
  address              text,
  phone                text,
  email                text,
  website              text,
  logo_url             text,
  cover_image_url      text,
  sports               text[]      NOT NULL DEFAULT '{}',
  amenities            text[]      NOT NULL DEFAULT '{}',
  certifications       text[]      NOT NULL DEFAULT '{}',
  levels_offered       text[]      NOT NULL DEFAULT ARRAY['iniciacion','intermedio','avanzado'],
  schedule             jsonb,
  pricing              jsonb,
  payment_settings     jsonb       NOT NULL DEFAULT '{"allow_manual": true, "allow_online": false}',
  accepts_reservations boolean     NOT NULL DEFAULT true,
  verified             boolean     NOT NULL DEFAULT false,
  onboarding_status    text        NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending','in_progress','completed')),
  onboarding_step      integer     NOT NULL DEFAULT 1,
  is_demo              boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_settings (
  school_id                   uuid    PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  responsible_payment_policy  text    NOT NULL DEFAULT 'primary_acudiente' CHECK (responsible_payment_policy IN ('primary_acudiente','any_acudiente','student')),
  payment_grace_days          integer NOT NULL DEFAULT 5,
  payment_cutoff_day          integer NOT NULL DEFAULT 10,
  allow_multiple_enrollments  boolean NOT NULL DEFAULT false,
  coach_can_send_reminders    boolean NOT NULL DEFAULT false,
  coach_can_request_reminders boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_branches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  city       text,
  phone      text,
  lat        numeric,
  lng        numeric,
  is_main    boolean     NOT NULL DEFAULT false,
  status     text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance')),
  capacity   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_members (
  id         uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid                   NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id uuid                   NOT NULL REFERENCES auth.users(id),
  branch_id  uuid                   REFERENCES public.school_branches(id),
  role       public.member_role     NOT NULL DEFAULT 'viewer',
  status     public.member_status   NOT NULL DEFAULT 'active',
  invited_by uuid                   REFERENCES auth.users(id),
  joined_at  timestamptz            NOT NULL DEFAULT now(),
  created_at timestamptz            NOT NULL DEFAULT now(),
  updated_at timestamptz            NOT NULL DEFAULT now(),
  UNIQUE (school_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.school_staff (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES public.schools(id),
  branch_id      uuid        REFERENCES public.school_branches(id),
  full_name      text        NOT NULL,
  email          text        NOT NULL,
  phone          text,
  specialty      text,
  certifications text[]      NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. CAPA B — INSTALACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facilities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid        NOT NULL REFERENCES public.schools(id),
  branch_id       uuid        REFERENCES public.school_branches(id),
  name            text        NOT NULL,
  type            text        NOT NULL,
  capacity        integer     NOT NULL DEFAULT 0,
  description     text,
  status          text        NOT NULL DEFAULT 'available',
  hourly_rate     numeric     NOT NULL DEFAULT 0,
  available_hours jsonb       NOT NULL DEFAULT '{
    "monday":    ["06:00-22:00"], "tuesday":   ["06:00-22:00"],
    "wednesday": ["06:00-22:00"], "thursday":  ["06:00-22:00"],
    "friday":    ["06:00-22:00"], "saturday":  ["07:00-20:00"],
    "sunday":    ["08:00-18:00"]
  }'::jsonb,
  booking_enabled boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 7. CAPA B — PROGRAMAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.programs (
  id               uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid                  NOT NULL REFERENCES public.schools(id),
  branch_id        uuid                  REFERENCES public.school_branches(id),
  coach_id         uuid                  REFERENCES public.school_staff(id),
  facility_id      uuid                  REFERENCES public.facilities(id),
  name             text                  NOT NULL,
  description      text,
  sport            text                  NOT NULL,
  level            public.program_level  NOT NULL DEFAULT 'iniciacion',
  schedule         jsonb,
  price_monthly    numeric               NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  age_min          integer,
  age_max          integer,
  max_participants integer,
  image_url        text,
  active           boolean               NOT NULL DEFAULT true,
  is_demo          boolean               NOT NULL DEFAULT false,
  created_at       timestamptz           NOT NULL DEFAULT now(),
  updated_at       timestamptz           NOT NULL DEFAULT now()
);


-- ============================================================
-- 8. CAPA B — EQUIPOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES public.schools(id),
  branch_id    uuid        REFERENCES public.school_branches(id),
  program_id   uuid        REFERENCES public.programs(id),
  coach_id     uuid        REFERENCES auth.users(id),
  name         text        NOT NULL,
  sport        text        NOT NULL,
  age_group    text,
  season       text,
  max_students integer     NOT NULL DEFAULT 20,
  is_demo      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 9. CAPA B — CLASES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES public.schools(id),
  program_id   uuid        NOT NULL REFERENCES public.programs(id),
  coach_id     uuid        REFERENCES public.profiles(id),
  name         text,
  day_of_week  text        NOT NULL,
  start_time   time        NOT NULL,
  end_time     time        NOT NULL,
  max_capacity integer     NOT NULL DEFAULT 20,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 10. CAPA B — ESTUDIANTES / NIÑOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.children (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id         uuid        REFERENCES auth.users(id),
  school_id         uuid        NOT NULL REFERENCES public.schools(id),
  branch_id         uuid        REFERENCES public.school_branches(id),
  team_id           uuid        REFERENCES public.teams(id),
  program_id        uuid        REFERENCES public.programs(id),
  full_name         text        NOT NULL,
  date_of_birth     date        NOT NULL,
  grade             text,
  doc_type          text,
  doc_number        text,
  avatar_url        text,
  medical_info      text,
  emergency_contact text,
  monthly_fee       numeric     NOT NULL DEFAULT 0,
  is_demo           boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Schema Evolution Safety: Convert medical_info to JSONB if needed (optional optimization)
-- DO $$ ... (Omitted to respect user's schema using text for now)

-- MIGRATION HELPER: Sync data from 'students' -> 'children'
-- Este bloque rescata los datos si existe la tabla students
DO $$
DECLARE
    s_full_name_expr text;
    has_full_name boolean;
    has_first_name boolean;
BEGIN
    -- Check if 'students' exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students')
       OR EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'students') THEN

    -- Drop redundant columns in children if they exist from previous schema versions
    -- We use CASCADE because 'students' view might depend on them
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'team_name') THEN
        DROP VIEW IF EXISTS public.students CASCADE;
        ALTER TABLE public.children DROP COLUMN team_name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'sport') THEN
        DROP VIEW IF EXISTS public.students CASCADE;
        ALTER TABLE public.children DROP COLUMN sport;
    END IF;

        -- Check columns
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'full_name') INTO has_full_name;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'first_name') INTO has_first_name;

        IF has_full_name THEN
            s_full_name_expr := 's.full_name';
        ELSIF has_first_name THEN
            s_full_name_expr := 's.first_name || '' '' || s.last_name';
        ELSE
            s_full_name_expr := '''Estudiante''';
        END IF;

        -- Safe Insert
        EXECUTE format('
            INSERT INTO public.children (id, school_id, parent_id, full_name, date_of_birth, created_at)
            SELECT s.id, s.school_id, s.parent_id, %s, s.date_of_birth, s.created_at
            FROM public.students s
            WHERE s.parent_id IS NOT NULL
            ON CONFLICT (id) DO NOTHING', s_full_name_expr);
    END IF;
END $$;


-- ============================================================
-- 11. CAPA B — INSCRIPCIONES Y ASISTENCIA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  id         uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid                  NOT NULL REFERENCES public.schools(id),
  program_id uuid                  REFERENCES public.programs(id),
  child_id   uuid                  REFERENCES public.children(id),
  user_id    uuid                  REFERENCES auth.users(id),
  start_date date                  NOT NULL DEFAULT CURRENT_DATE,
  end_date   date,
  status     public.enroll_status  NOT NULL DEFAULT 'active',
  created_at timestamptz           NOT NULL DEFAULT now(),
  updated_at timestamptz           NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_has_subject CHECK (child_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid        NOT NULL REFERENCES public.classes(id),
  enrollment_id uuid        NOT NULL REFERENCES public.enrollments(id),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                   uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid                  NOT NULL REFERENCES public.schools(id),
  program_id           uuid                  REFERENCES public.programs(id),
  class_id             uuid                  REFERENCES public.classes(id),
  child_id             uuid                  NOT NULL REFERENCES public.children(id),
  attendance_date      date                  NOT NULL DEFAULT CURRENT_DATE,
  status               public.attend_status  NOT NULL,
  justification_reason text,
  marked_by            uuid                  REFERENCES auth.users(id),
  notes                text,
  created_at           timestamptz           NOT NULL DEFAULT now(),
  updated_at           timestamptz           NOT NULL DEFAULT now()
);


-- ============================================================
-- 12. CAPA B — ENTRENAMIENTOS Y PARTIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        uuid        NOT NULL REFERENCES public.teams(id),
  profile_id     uuid        REFERENCES public.profiles(id),
  player_name    text        NOT NULL,
  player_number  integer,
  position       text,
  parent_contact text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES public.schools(id),
  team_id      uuid        NOT NULL REFERENCES public.teams(id),
  session_date date        NOT NULL,
  session_time time,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_attendance (
  id         uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid                  NOT NULL REFERENCES public.training_sessions(id),
  player_id  uuid                  NOT NULL REFERENCES public.profiles(id),
  status     public.attend_status  NOT NULL,
  created_at timestamptz           NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.training_plans (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL REFERENCES public.schools(id),
  team_id    uuid        NOT NULL REFERENCES public.teams(id),
  plan_date  date        NOT NULL,
  objectives text        NOT NULL,
  warmup     text,
  drills     jsonb,
  materials  text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES public.schools(id),
  team_id          uuid        REFERENCES public.teams(id),
  opponent_team_id uuid        REFERENCES public.teams(id),
  opponent         text        NOT NULL,
  home_score       integer     NOT NULL DEFAULT 0,
  away_score       integer     NOT NULL DEFAULT 0,
  is_home          boolean     NOT NULL DEFAULT true,
  match_date       date        NOT NULL,
  match_type       text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 13. CAPA B — PROGRESO ACADÉMICO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academic_progress (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid        NOT NULL REFERENCES public.children(id),
  coach_id        uuid        REFERENCES auth.users(id),
  skill_name      text        NOT NULL,
  skill_level     integer     NOT NULL CHECK (skill_level BETWEEN 0 AND 100),
  evaluation_date timestamptz NOT NULL DEFAULT now(),
  comments        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 14. CAPA B — PAGOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id                      uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid                NOT NULL REFERENCES public.schools(id),
  branch_id               uuid                REFERENCES public.school_branches(id),
  parent_id               uuid                NOT NULL REFERENCES auth.users(id),
  child_id                uuid                REFERENCES public.children(id),
  program_id              uuid                REFERENCES public.programs(id),
  team_id                 uuid                REFERENCES public.teams(id),
  coach_id                uuid                REFERENCES auth.users(id),
  concept                 text                NOT NULL,
  amount                  numeric             NOT NULL CHECK (amount > 0),
  amount_paid             numeric,
  due_date                date                NOT NULL,
  payment_date            date,
  status                  public.pay_status   NOT NULL,
  payment_type            public.pay_type     NOT NULL DEFAULT 'one_time',
  payment_method          public.pay_method,
  subscription_start_date date,
  subscription_end_date   date,
  reference               text                UNIQUE,
  wompi_id                text,
  receipt_number          text,
  receipt_url             text,
  approved_by             uuid                REFERENCES auth.users(id),
  approved_at             timestamptz,
  rejection_reason        text,
  created_at              timestamptz         NOT NULL DEFAULT now(),
  updated_at              timestamptz         NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    uuid        NOT NULL REFERENCES public.payments(id),
  reminder_type text        NOT NULL,
  sent          boolean     NOT NULL DEFAULT false,
  reminded_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 15. CAPA B — COMERCIO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL REFERENCES auth.users(id),
  school_id   uuid        REFERENCES public.schools(id),
  name        text        NOT NULL,
  description text,
  price       numeric     NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock       integer     NOT NULL DEFAULT 0,
  category    text,
  image_url   text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  items      jsonb       NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES auth.users(id),
  total_amount     numeric     NOT NULL CHECK (total_amount >= 0),
  status           text        NOT NULL DEFAULT 'pending',
  shipping_address jsonb,
  contact_phone    text,
  contact_email    text,
  payment_method   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid        NOT NULL REFERENCES public.orders(id),
  product_id uuid        NOT NULL REFERENCES public.products(id),
  quantity   integer     NOT NULL CHECK (quantity > 0),
  unit_price numeric     NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 16. CAPA B — COMUNICACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES public.schools(id),
  sender_id    uuid        REFERENCES public.profiles(id),
  recipient_id uuid        REFERENCES public.profiles(id),
  subject      text        NOT NULL,
  content      text        NOT NULL,
  read         boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name  text        NOT NULL,
  file_url   text        NOT NULL,
  file_type  text        NOT NULL,
  file_size  integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid        NOT NULL REFERENCES public.schools(id),
  coach_id  uuid        NOT NULL REFERENCES auth.users(id),
  team_id   uuid        REFERENCES public.teams(id),
  subject   text        NOT NULL,
  message   text        NOT NULL,
  audience  text        NOT NULL CHECK (audience IN ('parents','players','both')),
  sent_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES public.profiles(id),
  school_id  uuid        REFERENCES public.schools(id),
  title      text        NOT NULL,
  message    text        NOT NULL,
  type       text        NOT NULL DEFAULT 'info',
  read       boolean     NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 17. CAPA B — ACTIVIDADES Y CALENDARIO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activities (
  id               uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid                   NOT NULL REFERENCES public.schools(id),
  user_id          uuid                   REFERENCES public.profiles(id),
  program_id       uuid                   REFERENCES public.programs(id),
  title            text                   NOT NULL,
  description      text,
  activity_type    text                   NOT NULL,
  status           public.activity_status NOT NULL DEFAULT 'scheduled',
  scheduled_at     timestamptz            NOT NULL,
  duration_minutes integer,
  location         text,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        REFERENCES public.schools(id),
  user_id     uuid        REFERENCES auth.users(id),
  team_id     uuid        REFERENCES public.teams(id),
  title       text        NOT NULL,
  description text,
  event_type  text        CHECK (event_type IN ('training','match','meeting','evaluation','other')),
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  location    text,
  all_day     boolean     NOT NULL DEFAULT false,
  is_demo     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 18. CAPA B — RESERVAS DE INSTALACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facility_reservations (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid               NOT NULL REFERENCES public.facilities(id),
  user_id          uuid               NOT NULL REFERENCES auth.users(id),
  team_id          uuid               REFERENCES public.teams(id),
  reservation_date date               NOT NULL,
  start_time       time               NOT NULL,
  end_time         time               NOT NULL,
  status           public.resv_status NOT NULL DEFAULT 'pending',
  price            numeric            NOT NULL DEFAULT 0,
  participants     integer            NOT NULL DEFAULT 0,
  notes            text,
  approved_by      uuid               REFERENCES auth.users(id),
  approved_at      timestamptz,
  created_at       timestamptz        NOT NULL DEFAULT now(),
  updated_at       timestamptz        NOT NULL DEFAULT now()
);


-- ============================================================
-- 19. CAPA B — RESEÑAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL REFERENCES public.schools(id),
  user_id    uuid        REFERENCES public.profiles(id),
  rating     integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 20. CAPA A — EVENTOS (marketplace global)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
  id                 uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         uuid                  NOT NULL REFERENCES auth.users(id),
  slug               text                  NOT NULL UNIQUE,
  title              text                  NOT NULL,
  description        text,
  sport              text                  NOT NULL,
  creator_role       text                  NOT NULL CHECK (creator_role IN ('school','organizer')),
  event_type         public.event_kind     NOT NULL DEFAULT 'tournament',
  status             public.event_status   NOT NULL DEFAULT 'active',
  event_date         date                  NOT NULL,
  start_time         time                  NOT NULL,
  end_time           time,
  address            text                  NOT NULL,
  city               text                  NOT NULL,
  lat                numeric,
  lng                numeric,
  capacity           integer               NOT NULL DEFAULT 50,
  price              numeric               NOT NULL DEFAULT 0,
  currency           text                  NOT NULL DEFAULT 'COP',
  registrations_open boolean               NOT NULL DEFAULT true,
  image_url          text,
  notes              text,
  contact_phone      text,
  contact_email      text,
  created_at         timestamptz           NOT NULL DEFAULT now(),
  updated_at         timestamptz           NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES public.events(id),
  user_id           uuid        REFERENCES auth.users(id),
  participant_name  text        NOT NULL,
  participant_email text,
  participant_phone text        NOT NULL,
  participant_role  text        NOT NULL DEFAULT 'athlete' CHECK (participant_role IN ('athlete','parent','coach','other')),
  participant_age   integer,
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  payment_status    text        NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','verified','rejected','not_required')),
  payment_proof_url text,
  notes             text,
  rejection_reason  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_telemetry (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        REFERENCES public.events(id),
  user_id    uuid        REFERENCES auth.users(id),
  event_type text        NOT NULL CHECK (event_type IN ('event_created','event_viewed','link_shared','registration_created','registration_approved')),
  metadata   jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 21. CAPA C — BIENESTAR Y SALUD
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wellness_appointments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid        NOT NULL REFERENCES auth.users(id),
  athlete_id       uuid        REFERENCES public.profiles(id),
  athlete_name     text,
  appointment_date date        NOT NULL,
  appointment_time time        NOT NULL,
  duration_minutes integer     NOT NULL DEFAULT 60,
  service_type     text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending',
  notes            text,
  is_demo          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness_evaluations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid        REFERENCES auth.users(id),
  athlete_id      uuid        REFERENCES public.profiles(id),
  appointment_id  uuid        REFERENCES public.wellness_appointments(id),
  date            date        NOT NULL,
  type            text        CHECK (type IN ('Fisioterapia','Nutrición','Psicología','Medicina Deportiva')),
  notes           text,
  status          text        NOT NULL DEFAULT 'completed',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_records (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid        NOT NULL REFERENCES public.profiles(id),
  professional_id uuid        NOT NULL REFERENCES auth.users(id),
  record_type     text        NOT NULL,
  diagnosis       text,
  treatment       text,
  notes           text,
  attachments     jsonb       NOT NULL DEFAULT '[]',
  is_demo         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 22. CAPA C — SEGUIMIENTO DE ATLETA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.athlete_stats (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid        NOT NULL REFERENCES public.profiles(id),
  stat_date   date        NOT NULL DEFAULT CURRENT_DATE,
  stat_type   text        NOT NULL,
  value       numeric     NOT NULL,
  unit        text        NOT NULL,
  notes       text,
  is_demo     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_logs (
  id               uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid                   NOT NULL REFERENCES public.profiles(id),
  training_date    date                   NOT NULL DEFAULT CURRENT_DATE,
  exercise_type    text                   NOT NULL,
  duration_minutes integer                NOT NULL,
  intensity        public.train_intensity NOT NULL DEFAULT 'medium',
  calories_burned  integer,
  notes            text,
  is_demo          boolean                NOT NULL DEFAULT false,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now()
);


-- ============================================================
-- 23. CAPA A — SOLICITUDES Y SOPORTE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.join_applications (
  id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid              REFERENCES auth.users(id),
  full_name   text              NOT NULL,
  email       text              NOT NULL,
  phone       text,
  experience  public.exp_level,
  interests   text              NOT NULL,
  motivation  text              NOT NULL,
  status      text              NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','approved','rejected')),
  reviewed_by uuid              REFERENCES auth.users(id),
  reviewed_at timestamptz,
  notes       text,
  created_at  timestamptz       NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to  uuid        REFERENCES auth.users(id),
  name         text        NOT NULL,
  email        text        NOT NULL,
  subject      text        NOT NULL,
  message      text        NOT NULL,
  category     text        NOT NULL CHECK (category IN ('general','technical','business','partnership','feedback','other')),
  status       text        NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','closed')),
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 24. CAPA A — INFRAESTRUCTURA Y TELEMETRÍA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id),
  event_type text        NOT NULL,
  event_data jsonb       NOT NULL DEFAULT '{}',
  page_url   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        REFERENCES public.schools(id),
  profile_id uuid        REFERENCES public.profiles(id),
  table_name text        NOT NULL,
  record_id  text        NOT NULL,
  action     text        NOT NULL,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FUNCIÓN DE AUDITORÍA UNIVERSAL
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Intentar obtener school_id solo si la columna existe en la tabla que dispara
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_school_id := OLD.school_id;
    ELSE
      v_school_id := NEW.school_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    v_school_id := NULL; -- Si la tabla no tiene school_id (como profiles), usamos NULL
  END;

  INSERT INTO public.audit_logs (
    school_id,
    profile_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  ) VALUES (
    v_school_id,
    auth.uid(),
    TG_TABLE_NAME,
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::text,
    TG_OP,
    (CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END),
    (CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END)
  );
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TABLE IF NOT EXISTS public.system_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL,
  error_message text,
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 25. ÍNDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_children_school ON public.children(school_id);
CREATE INDEX IF NOT EXISTS idx_children_parent ON public.children(parent_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_school ON public.enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_child ON public.enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_transactions_school ON public.payments(school_id);
CREATE INDEX IF NOT EXISTS idx_transactions_child ON public.payments(child_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_products_school ON public.products(school_id);


-- ============================================================
-- 26. VISTAS (reemplazan columnas computadas eliminadas)
-- ============================================================

CREATE OR REPLACE VIEW public.school_ratings AS
  SELECT school_id,
         ROUND(AVG(rating)::numeric, 2) AS rating,
         COUNT(*)                        AS total_reviews
  FROM public.reviews
  GROUP BY school_id;

CREATE OR REPLACE VIEW public.program_capacity AS
  SELECT p.id                                                                    AS program_id,
         p.max_participants,
         COUNT(e.id) FILTER (WHERE e.status = 'active')                         AS current_participants,
         GREATEST(0, p.max_participants - COUNT(e.id) FILTER (WHERE e.status = 'active')) AS spots_available
  FROM public.programs p
  LEFT JOIN public.enrollments e ON e.program_id = p.id
  GROUP BY p.id, p.max_participants;

CREATE OR REPLACE VIEW public.class_capacity AS
  SELECT c.id                                              AS class_id,
         c.max_capacity,
         COUNT(ce.id)                                     AS current_enrollment,
         GREATEST(0, c.max_capacity - COUNT(ce.id))       AS spots_available
  FROM public.classes c
  LEFT JOIN public.class_enrollments ce ON ce.class_id = c.id
  GROUP BY c.id, c.max_capacity;

CREATE OR REPLACE VIEW public.team_capacity AS
  SELECT t.id                                              AS team_id,
         t.max_students,
         COUNT(c.id)                                      AS current_students,
         GREATEST(0, t.max_students - COUNT(c.id))        AS spots_available
  FROM public.teams t
  LEFT JOIN public.children c ON c.team_id = t.id
  GROUP BY t.id, t.max_students;

DROP VIEW IF EXISTS public.children_full;
CREATE OR REPLACE VIEW public.children_full AS
  SELECT ch.*,
         t.name       AS team_name,
         t.sport      AS sport,
         pr.name      AS program_name,
         sb.name      AS branch_name
  FROM public.children ch
  LEFT JOIN public.teams    t  ON t.id  = ch.team_id
  LEFT JOIN public.programs pr ON pr.id = ch.program_id
  LEFT JOIN public.school_branches sb ON sb.id = ch.branch_id;

CREATE OR REPLACE VIEW public.pending_payments AS
  SELECT p.*,
         c.full_name     AS child_name,
         sc.name         AS school_name,
         pr.full_name    AS parent_name
  FROM public.payments p
  LEFT JOIN public.children ch ON ch.id   = p.child_id
  LEFT JOIN public.children c  ON c.id    = p.child_id
  LEFT JOIN public.schools sc  ON sc.id   = p.school_id
  LEFT JOIN public.profiles pr ON pr.id   = p.parent_id
  WHERE p.status IN ('pending','overdue');


-- ============================================================
-- 27. FUNCIONES HELPER PARA RLS (En schema public por permisos del editor)
-- ============================================================

-- Limpiar funciones anteriores para evitar conflictos de tipo de retorno
DROP FUNCTION IF EXISTS public.user_school_ids() CASCADE;
DROP FUNCTION IF EXISTS public.user_school_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_school_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_school_coach(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT school_id
      FROM public.school_members
      WHERE profile_id = auth.uid()
        AND status = 'active'
    ),
    '{}'::uuid[]
  );
$$;

CREATE OR REPLACE FUNCTION public.user_school_role(p_school_id uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role::text
  FROM public.school_members
  WHERE profile_id = auth.uid()
    AND school_id   = p_school_id
    AND status      = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = auth.uid()
      AND school_id   = p_school_id
      AND role       IN ('owner','admin')
      AND status      = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_coach(p_school_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = auth.uid()
      AND school_id   = p_school_id
      AND role       IN ('owner','admin','coach')
      AND status      = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role    = 'admin'
  );
$$;



-- ============================================================
-- 28. ROW LEVEL SECURITY — POLÍTICAS & ENABLE RLS
-- ============================================================

-- Macro para habilitar RLS en todas las tablas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sports_categories','roles','sports_equipment','profiles','user_roles','user_search_preferences',
    'schools','school_settings','school_branches','school_members','school_staff',
    'facilities','facility_reservations','programs','classes','enrollments','class_enrollments',
    'children','attendance_records','teams','team_members','training_sessions','session_attendance',
    'training_plans','match_results','academic_progress','payments','payment_reminders',
    'products','carts','orders','order_items','messages','message_attachments','announcements','notifications',
    'activities','calendar_events','reviews','events','event_registrations','event_telemetry',
    'wellness_appointments','wellness_evaluations','health_records','athlete_stats','training_logs',
    'join_applications','contact_messages','analytics_events','audit_logs','system_errors'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================
-- 28. ROW LEVEL SECURITY — POLÍTICAS
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- ROLES (Public Read)
DROP POLICY IF EXISTS "Public roles are viewable" ON public.roles;
CREATE POLICY "Public roles are viewable" ON public.roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SCHOOLS
DROP POLICY IF EXISTS "Public schools are viewable" ON public.schools;
CREATE POLICY "Public schools are viewable" ON public.schools FOR SELECT USING (true);

DROP POLICY IF EXISTS "School owners can update" ON public.schools;
CREATE POLICY "School owners can update" ON public.schools FOR UPDATE USING (auth.uid() = owner_id);

-- CHILDREN
DROP POLICY IF EXISTS "Parents view own children" ON public.children;
CREATE POLICY "Parents view own children" ON public.children FOR SELECT USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "School staff view school children" ON public.children;
CREATE POLICY "School staff view school children" ON public.children FOR SELECT USING (school_id = ANY(auth.user_school_ids()));

DROP POLICY IF EXISTS "Parents update own children" ON public.children;
CREATE POLICY "Parents update own children" ON public.children FOR UPDATE USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "School admin update school children" ON public.children;
CREATE POLICY "School admin update school children" ON public.children FOR UPDATE USING (auth.is_school_admin(school_id));

-- ENROLLMENTS
DROP POLICY IF EXISTS "Parents view own enrollments" ON public.enrollments;
CREATE POLICY "Parents view own enrollments" ON public.enrollments FOR SELECT USING (user_id = auth.uid() OR child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

DROP POLICY IF EXISTS "School staff view school enrollments" ON public.enrollments;
CREATE POLICY "School staff view school enrollments" ON public.enrollments FOR SELECT USING (school_id = ANY(auth.user_school_ids()));

-- PAYMENTS
DROP POLICY IF EXISTS "Parents view own payments" ON public.payments;
CREATE POLICY "Parents view own payments" ON public.payments FOR SELECT USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "School staff view school payments" ON public.payments;
CREATE POLICY "School staff view school payments" ON public.payments FOR SELECT USING (school_id = ANY(auth.user_school_ids()));

-- ATTENDANCE
DROP POLICY IF EXISTS "Parents view own child attendance" ON public.attendance_records;
CREATE POLICY "Parents view own child attendance" ON public.attendance_records FOR SELECT USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));

DROP POLICY IF EXISTS "School staff manage attendance" ON public.attendance_records;
CREATE POLICY "School staff manage attendance" ON public.attendance_records FOR ALL USING (school_id = ANY(auth.user_school_ids()));



-- ============================================================
-- 29. TRIGGERS
-- ============================================================

-- Macro para triggers updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_search_preferences',
    'schools','school_settings','school_branches','school_members','school_staff',
    'facilities','facility_reservations',
    'programs','classes','teams',
    'children','enrollments','attendance_records',
    'training_plans','match_results',
    'payments','products','orders',
    'events','event_registrations',
    'wellness_appointments','health_records',
    'athlete_stats','training_logs',
    'reviews','sports_equipment',
    'activities'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 30. TRIGGERS — AUTOMATIZACIÓN DE APLICACIÓN
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role public.user_role := 'athlete';
  v_meta_role text;
BEGIN
  -- Extract role from metadata
  v_meta_role := NEW.raw_user_meta_data ->> 'role';

  -- Validate role against enum
  IF v_meta_role IS NOT NULL AND v_meta_role IN ('admin', 'school', 'coach', 'parent', 'athlete', 'wellness_professional', 'store_owner') THEN
    v_role := v_meta_role::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
    
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_school()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.school_settings (school_id)
  VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;

  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.school_members (school_id, profile_id, role, status)
    VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
    ON CONFLICT (school_id, profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_school_created ON public.schools;
CREATE TRIGGER on_school_created
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_school();

-- Trigger para auditar cambios en pagos
DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
