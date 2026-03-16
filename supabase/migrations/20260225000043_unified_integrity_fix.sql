-- ============================================================
-- SPORTMAPS - REFUERZO DE INTEGRIDAD Y UNIFICACIÓN TOTAL DE DB
-- Propósito: Consolidar SCHEMA REFACTORED + Lógica de Automatización.
-- Fecha: 2026-02-25
-- ============================================================

BEGIN;

-- 1. LIMPIEZA DE POLÍTICAS EXISTENTES
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. LIMPIEZA DE TRIGGERS EXISTENTES (updated_at y otros redundantes)
DO $$
DECLARE
    trg record;
BEGIN
    FOR trg IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_schema = 'public' AND trigger_name LIKE '%updated_at%') LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg.trigger_name, trg.event_object_table);
    END LOOP;
END $$;

-- 3. FUNCIONES HELPERS Y LÓGICA DE NEGOCIO

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.user_school_ids() CASCADE;
CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(ARRAY(SELECT school_id FROM public.school_members WHERE profile_id = auth.uid() AND status = 'active'), '{}'::uuid[]);
$$;

DROP FUNCTION IF EXISTS public.is_school_admin(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_members WHERE profile_id = auth.uid() AND school_id = p_school_id AND role IN ('owner','admin') AND status = 'active');
$$;

DROP FUNCTION IF EXISTS public.fn_is_admin_of_school(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.fn_is_admin_of_school(p_school_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_members WHERE profile_id = auth.uid() AND school_id = p_school_id AND role IN ('owner','admin') AND status = 'active');
$$;

-- Automatización: Asignar escuela a inscripción si no viene
CREATE OR REPLACE FUNCTION public.auto_set_enrollment_school_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.program_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.programs WHERE id = NEW.program_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Automatización: Agregar padre a school_members al crear child
CREATE OR REPLACE FUNCTION public.auto_add_parent_to_school()
RETURNS trigger AS $$
BEGIN
  IF NEW.school_id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
    INSERT INTO public.school_members (profile_id, school_id, role, status)
    VALUES (NEW.parent_id, NEW.school_id, 'parent', 'active')
    ON CONFLICT (profile_id, school_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Automatización: Sincronizar conteo de estudiantes en equipos
CREATE OR REPLACE FUNCTION public.sync_team_student_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    IF OLD.team_id IS NOT NULL THEN
      UPDATE public.teams SET current_students = (SELECT count(*) FROM public.children WHERE team_id = OLD.team_id) WHERE id = OLD.team_id;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    IF NEW.team_id IS NOT NULL THEN
      UPDATE public.teams SET current_students = (SELECT count(*) FROM public.children WHERE team_id = NEW.team_id) WHERE id = NEW.team_id;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- 4. RE-HABILITAR RLS EN TABLAS EXISTENTES (con IF EXISTS)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','schools','school_settings','school_branches',
    'school_members','facilities','programs',
    'enrollments','children','attendance_records','teams','team_members',
    'training_sessions','session_attendance','training_plans','match_results','academic_progress',
    'payments','payment_reminders','products','orders',
    'messages','announcements','notifications','activities','calendar_events',
    'reviews','events','event_registrations','wellness_appointments','wellness_evaluations',
    'health_records','athlete_stats','invitations'
  ]
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 5. POLÍTICAS UNIFICADAS

-- PROFILES
CREATE POLICY "Profiles: select own or admin" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SCHOOLS & SETTINGS
CREATE POLICY "Schools: select public" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Schools: manage owner" ON public.schools FOR ALL USING (auth.uid() = owner_id);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'school_settings') THEN
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_settings') THEN EXECUTE 'CREATE POLICY "Settings: manage admin" ON public.school_settings FOR ALL USING (public.is_school_admin(school_id))'';'; END IF; END $wrap$;
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='school_settings') THEN EXECUTE 'CREATE POLICY "Settings: select staff" ON public.school_settings FOR SELECT USING (school_id = ANY(public.user_school_ids()))'';'; END IF; END $wrap$;
  END IF;
END $$;

-- MEMBERS
CREATE POLICY "Members: select school" ON public.school_members FOR SELECT USING (school_id = ANY(public.user_school_ids()));
CREATE POLICY "Members: manage admin" ON public.school_members FOR ALL USING (public.is_school_admin(school_id));

-- BRANCHES & FACILITIES
CREATE POLICY "Branches: select public" ON public.school_branches FOR SELECT USING (true);
CREATE POLICY "Branches: manage admin" ON public.school_branches FOR ALL USING (public.is_school_admin(school_id));
CREATE POLICY "Facilities: select public" ON public.facilities FOR SELECT USING (true);
CREATE POLICY "Facilities: manage admin" ON public.facilities FOR ALL USING (public.is_school_admin(school_id));

-- CHILDREN
CREATE POLICY "Children: select staff" ON public.children FOR SELECT USING (school_id = ANY(public.user_school_ids()));
CREATE POLICY "Children: select parent" ON public.children FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "Children: manage staff" ON public.children FOR ALL USING (public.is_school_admin(school_id));
CREATE POLICY "Children: update parent" ON public.children FOR UPDATE USING (auth.uid() = parent_id);
CREATE POLICY "Children: insert parent" ON public.children FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- ENROLLMENTS
CREATE POLICY "Enrollments: select staff" ON public.enrollments FOR SELECT USING (school_id = ANY(public.user_school_ids()));
CREATE POLICY "Enrollments: select parent" ON public.enrollments FOR SELECT USING (user_id = auth.uid() OR child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));
CREATE POLICY "Enrollments: manage staff" ON public.enrollments FOR ALL USING (public.is_school_admin(school_id));

-- PAYMENTS
CREATE POLICY "Payments: select staff" ON public.payments FOR SELECT USING (school_id = ANY(public.user_school_ids()));
CREATE POLICY "Payments: select parent" ON public.payments FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Payments: manage staff" ON public.payments FOR ALL USING (public.is_school_admin(school_id));

-- PROGRAMS & TEAMS & ATTENDANCE
CREATE POLICY "Programs: select public" ON public.programs FOR SELECT USING (true);
CREATE POLICY "Programs: manage admin" ON public.programs FOR ALL USING (public.is_school_admin(school_id));
CREATE POLICY "Teams: select staff" ON public.teams FOR SELECT USING (school_id = ANY(public.user_school_ids()));
CREATE POLICY "Teams: manage admin" ON public.teams FOR ALL USING (public.is_school_admin(school_id));
CREATE POLICY "Attendance: select parent" ON public.attendance_records FOR SELECT USING (child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid()));
CREATE POLICY "Attendance: manage staff" ON public.attendance_records FOR ALL USING (school_id = ANY(public.user_school_ids()));

-- INVITATIONS
CREATE POLICY "Invitations: select own" ON public.invitations FOR SELECT USING (
    LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
    OR public.fn_is_admin_of_school(school_id)
);
CREATE POLICY "Invitations: manage admin" ON public.invitations FOR ALL USING (public.fn_is_admin_of_school(school_id));

-- 6. TRIGGERS UNIFICADOS (con IF EXISTS)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','schools','school_settings','school_branches','school_members',
    'facilities','programs','teams','children','enrollments',
    'payments','products','orders','activities','calendar_events','reviews'
  ]
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      BEGIN
        EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Lógica de automatización
DROP TRIGGER IF EXISTS trg_auto_enrollment_school_id ON public.enrollments;
CREATE TRIGGER trg_auto_enrollment_school_id BEFORE INSERT ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.auto_set_enrollment_school_id();

DROP TRIGGER IF EXISTS trg_auto_parent_school_member ON public.children;
CREATE TRIGGER trg_auto_parent_school_member AFTER INSERT OR UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.auto_add_parent_to_school();

DROP TRIGGER IF EXISTS trg_sync_team_students ON public.children;
CREATE TRIGGER trg_sync_team_students AFTER INSERT OR UPDATE OR DELETE ON public.children FOR EACH ROW EXECUTE FUNCTION public.sync_team_student_count();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: Obtener estado de onboarding
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_school_id uuid;
  v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  
  SELECT school_id INTO v_school_id 
  FROM public.school_members 
  WHERE profile_id = v_user_id 
  ORDER BY status = 'active' DESC, joined_at DESC 
  LIMIT 1;

  SELECT jsonb_build_object(
    'has_school', (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (SELECT EXISTS(SELECT 1 FROM public.school_branches b JOIN public.schools s ON b.school_id = s.id WHERE s.owner_id = v_user_id OR s.id = v_school_id)),
    'has_teams', (SELECT EXISTS(SELECT 1 FROM public.teams WHERE school_id = v_school_id OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id)))),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'admin'))),
    'has_children', (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_accepted_invite', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),
    'has_medical_records', (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    'profile_complete', (SELECT (full_name IS NOT NULL AND phone IS NOT NULL) FROM public.profiles WHERE id = v_user_id),
    'role', v_role,
    'school_id', v_school_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: Aceptar Invitación
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invite RECORD;
    v_user_email text;
    v_child_id uuid;
    v_role_id uuid;
BEGIN
    SELECT LOWER(email) INTO v_user_email FROM auth.users WHERE id = auth.uid();

    SELECT * INTO v_invite FROM public.invitations 
    WHERE id = p_invite_id AND LOWER(email) = v_user_email AND status = 'pending';

    IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no válida o ya procesada.'; END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_invite.role_to_assign LIMIT 1;
    
    UPDATE public.profiles 
    SET role = v_invite.role_to_assign::public.user_role,
        role_id = COALESCE(v_role_id, role_id)
    WHERE id = auth.uid();

    INSERT INTO public.school_members (school_id, profile_id, role, status)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active')
    ON CONFLICT (school_id, profile_id) DO UPDATE SET status = 'active', role = EXCLUDED.role;

    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN
        UPDATE public.children 
        SET parent_id = auth.uid(),
            school_id = v_invite.school_id
        WHERE (LOWER(parent_email_temp) = v_user_email OR parent_email_temp IS NULL)
        AND LOWER(full_name) = LOWER(v_invite.child_name)
        RETURNING id INTO v_child_id;
    END IF;

    UPDATE public.children SET parent_id = auth.uid()
    WHERE LOWER(parent_email_temp) = v_user_email AND parent_id IS NULL;

    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;

    RETURN true;
END;
$$;

COMMIT;
