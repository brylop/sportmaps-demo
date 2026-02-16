-- ============================================================================
-- MVP SPRINT 1 — CONSOLIDACIÓN DE ESQUEMA Y MULTITENANCY
-- Fecha: 2026-02-16
-- Branch: develop
-- 
-- TAREAS CUBIERTAS:
--   1.1 — Decisión de naming: "children" es la tabla canónica (NO renombrar)
--         Se crea VIEW "students" como alias para UI de escuelas
--   1.2 — Añadir school_id a enrollments (con backfill desde programs)
--   1.3 — Confirmar school_id en payments (ya existe por migración anterior)
--         Añadir backfill para datos existentes
--   1.4 — Crear tabla school_members (relación N:N users ↔ schools)
--   1.8 — RLS Policies fundamentales para multitenancy
--
-- DECISIONES ARQUITECTÓNICAS:
--   • La tabla "children" se mantiene (es lo que tiene Supabase en producción)
--   • El frontend seguirá usando .from('children') para operaciones CRUD
--   • Se crea VIEW "students" para queries tipo escuela (JOIN con enrollments)
--   • "programs" se mantiene (NO crear tabla "classes" separada)
--   • El campo precio se llama "price_monthly" (como está en Supabase)
--   • El campo dueño escuela se llama "owner_id" (como está en Supabase)
--   • Se elimina la dependencia de MongoDB (todo va por Supabase)
--
-- ORDEN DE EJECUCIÓN: 
--   1. school_members (nueva tabla)
--   2. enrollments.school_id (nueva columna + backfill)
--   3. VIEW students (alias para children con info de escuela)
--   4. enrollments.child_id (vincular inscripción con niño específico)
--   5. RLS Policies (seguridad por tenant)
--   6. Helper functions (para queries de permisos)
-- ============================================================================

-- ============================================================================
-- 1. TABLA: school_members (relación N:N entre usuarios y escuelas)
-- 
-- Esta es la tabla CLAVE para multitenancy. Resuelve:
-- - ¿A qué escuela(s) pertenece un usuario?
-- - ¿Qué rol tiene en cada escuela?
-- - ¿Tiene acceso a ver/editar datos de esa escuela?
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.school_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  school_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' 
    CHECK (role IN ('owner', 'admin', 'coach', 'staff', 'parent', 'athlete', 'viewer')),
  status text NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT school_members_pkey PRIMARY KEY (id),
  CONSTRAINT school_members_unique_membership UNIQUE (profile_id, school_id),
  CONSTRAINT school_members_profile_id_fkey FOREIGN KEY (profile_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT school_members_school_id_fkey FOREIGN KEY (school_id) 
    REFERENCES public.schools(id) ON DELETE CASCADE,
  CONSTRAINT school_members_invited_by_fkey FOREIGN KEY (invited_by) 
    REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_school_members_profile_id ON public.school_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_school_members_school_id ON public.school_members(school_id);
CREATE INDEX IF NOT EXISTS idx_school_members_role ON public.school_members(role);
CREATE INDEX IF NOT EXISTS idx_school_members_status ON public.school_members(status);

-- Backfill: Registrar owners actuales como miembros
INSERT INTO public.school_members (profile_id, school_id, role, status)
SELECT owner_id, id, 'owner', 'active'
FROM public.schools
WHERE owner_id IS NOT NULL
ON CONFLICT (profile_id, school_id) DO NOTHING;

-- Backfill: Registrar padres con hijos en escuelas como miembros
INSERT INTO public.school_members (profile_id, school_id, role, status)
SELECT DISTINCT c.parent_id, c.school_id, 'parent', 'active'
FROM public.children c
WHERE c.parent_id IS NOT NULL 
  AND c.school_id IS NOT NULL
ON CONFLICT (profile_id, school_id) DO NOTHING;

-- Backfill: Registrar usuarios con enrollments como miembros
INSERT INTO public.school_members (profile_id, school_id, role, status)
SELECT DISTINCT e.user_id, p.school_id, 'athlete', 'active'
FROM public.enrollments e
JOIN public.programs p ON p.id = e.program_id
WHERE e.user_id IS NOT NULL 
  AND p.school_id IS NOT NULL
ON CONFLICT (profile_id, school_id) DO NOTHING;

-- Backfill: Registrar staff como miembros (por email match)
INSERT INTO public.school_members (profile_id, school_id, role, status)
SELECT DISTINCT au.id, ss.school_id, 'coach', 'active'
FROM public.school_staff ss
JOIN auth.users au ON au.email = ss.email
WHERE ss.school_id IS NOT NULL
ON CONFLICT (profile_id, school_id) DO NOTHING;

-- ============================================================================
-- 2. ENROLLMENTS: Añadir school_id para filtrado directo por tenant
-- ============================================================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS school_id uuid;

-- FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'enrollments_school_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_school_id ON public.enrollments(school_id);

-- Backfill: Copiar school_id desde programs
UPDATE public.enrollments e
SET school_id = p.school_id
FROM public.programs p
WHERE e.program_id = p.id
  AND e.school_id IS NULL
  AND p.school_id IS NOT NULL;

-- ============================================================================
-- 3. ENROLLMENTS: Añadir child_id para vincular inscripción con niño
-- ============================================================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS child_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'enrollments_child_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_child_id_fkey
      FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_child_id ON public.enrollments(child_id);

-- ============================================================================
-- 4. PAYMENTS: Confirmar school_id y backfill
-- (La columna ya fue creada por migración 20260210203000)
-- ============================================================================

-- Backfill payments que no tienen school_id pero tienen child_id
UPDATE public.payments pay
SET school_id = c.school_id
FROM public.children c
WHERE pay.child_id = c.id
  AND pay.school_id IS NULL
  AND c.school_id IS NOT NULL;

-- Backfill fallback: para payments sin child_id, intentar por parent + children
UPDATE public.payments pay
SET school_id = (
  SELECT c.school_id 
  FROM public.children c 
  WHERE c.parent_id = pay.parent_id 
    AND c.school_id IS NOT NULL 
  LIMIT 1
)
WHERE pay.school_id IS NULL
  AND pay.parent_id IS NOT NULL;

-- ============================================================================
-- 5. VIEW: students (alias amigable para la UI de escuelas)
-- 
-- Esta view resuelve el conflicto de naming:
-- - La tabla física es "children" (padres registran hijos)
-- - La UI de escuelas gestiona "estudiantes"
-- - Esta view une children + enrollment info para la perspectiva escolar
-- ============================================================================
DROP VIEW IF EXISTS public.students;

CREATE VIEW public.students AS
SELECT 
  c.id,
  c.full_name,
  c.date_of_birth,
  c.avatar_url,
  c.medical_info,
  c.sport,
  c.parent_id,
  c.school_id,
  c.team_name,
  c.is_demo,
  c.created_at,
  c.updated_at,
  -- Info del padre
  pp.full_name AS parent_name,
  pp.phone AS parent_phone,
  pp.avatar_url AS parent_avatar,
  -- Info de enrollment activa (si existe)
  e.id AS enrollment_id,
  e.program_id,
  e.status AS enrollment_status,
  e.start_date AS enrollment_start,
  -- Info del programa
  pr.name AS program_name,
  pr.sport AS program_sport,
  pr.price_monthly
FROM public.children c
LEFT JOIN public.profiles pp ON pp.id = c.parent_id
LEFT JOIN public.enrollments e ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN public.programs pr ON pr.id = e.program_id;

-- Permisos para la view
GRANT SELECT ON public.students TO authenticated;

-- ============================================================================
-- 6. HELPER FUNCTIONS para queries de permisos
-- ============================================================================

-- Función: ¿El usuario es miembro de esta escuela?
CREATE OR REPLACE FUNCTION public.is_school_member(
  _user_id uuid,
  _school_id uuid
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = _user_id
      AND school_id = _school_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función: ¿El usuario tiene este rol en esta escuela?
CREATE OR REPLACE FUNCTION public.has_school_role(
  _user_id uuid,
  _school_id uuid,
  _role text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.school_members
    WHERE profile_id = _user_id
      AND school_id = _school_id
      AND role = _role
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función: Obtener school_ids donde el usuario es miembro
CREATE OR REPLACE FUNCTION public.get_user_school_ids(
  _user_id uuid
) RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT school_id FROM public.school_members
  WHERE profile_id = _user_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función: Obtener school_ids donde el usuario es owner o admin
CREATE OR REPLACE FUNCTION public.get_user_admin_school_ids(
  _user_id uuid
) RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT school_id FROM public.school_members
  WHERE profile_id = _user_id
    AND role IN ('owner', 'admin')
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 7. RLS POLICIES para school_members
-- ============================================================================
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias membresías
DROP POLICY IF EXISTS "Users can view own memberships" ON public.school_members;
CREATE POLICY "Users can view own memberships"
  ON public.school_members FOR SELECT
  USING (profile_id = auth.uid());

-- School owners/admins ven todos los miembros de su escuela
DROP POLICY IF EXISTS "School admins can view school members" ON public.school_members;
CREATE POLICY "School admins can view school members"
  ON public.school_members FOR SELECT
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School owners/admins pueden insertar miembros
DROP POLICY IF EXISTS "School admins can insert members" ON public.school_members;
CREATE POLICY "School admins can insert members"
  ON public.school_members FOR INSERT
  WITH CHECK (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School owners/admins pueden actualizar miembros de su escuela
DROP POLICY IF EXISTS "School admins can update members" ON public.school_members;
CREATE POLICY "School admins can update members"
  ON public.school_members FOR UPDATE
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School owners pueden eliminar miembros
DROP POLICY IF EXISTS "School owners can delete members" ON public.school_members;
CREATE POLICY "School owners can delete members"
  ON public.school_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.profile_id = auth.uid()
        AND sm.school_id = school_members.school_id
        AND sm.role = 'owner'
        AND sm.status = 'active'
    )
  );

-- Platform admins ven todo
DROP POLICY IF EXISTS "Platform admins full access to school_members" ON public.school_members;
CREATE POLICY "Platform admins full access to school_members"
  ON public.school_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 8. RLS POLICIES para children (multitenancy)
-- ============================================================================
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Padres ven sus propios hijos
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  USING (parent_id = auth.uid());

-- Padres pueden crear hijos
DROP POLICY IF EXISTS "Parents can create children" ON public.children;
CREATE POLICY "Parents can create children"
  ON public.children FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Padres pueden actualizar sus hijos
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  USING (parent_id = auth.uid());

-- School admins ven niños de su escuela
DROP POLICY IF EXISTS "School admins can view school children" ON public.children;
CREATE POLICY "School admins can view school children"
  ON public.children FOR SELECT
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School admins pueden actualizar niños de su escuela
DROP POLICY IF EXISTS "School admins can update school children" ON public.children;
CREATE POLICY "School admins can update school children"
  ON public.children FOR UPDATE
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- Coaches ven niños de escuelas donde son coaches
DROP POLICY IF EXISTS "Coaches can view school children" ON public.children;
CREATE POLICY "Coaches can view school children"
  ON public.children FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.school_members
      WHERE profile_id = auth.uid()
        AND role IN ('coach', 'staff')
        AND status = 'active'
    )
  );

-- Platform admins ven todo
DROP POLICY IF EXISTS "Platform admins full access to children" ON public.children;
CREATE POLICY "Platform admins full access to children"
  ON public.children FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 9. RLS POLICIES para enrollments (multitenancy)
-- ============================================================================
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias inscripciones
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (user_id = auth.uid());

-- Usuarios pueden crear sus propias inscripciones
DROP POLICY IF EXISTS "Users can create own enrollments" ON public.enrollments;
CREATE POLICY "Users can create own enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- School admins ven inscripciones de su escuela
DROP POLICY IF EXISTS "School admins can view school enrollments" ON public.enrollments;
CREATE POLICY "School admins can view school enrollments"
  ON public.enrollments FOR SELECT
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School admins pueden gestionar inscripciones de su escuela
DROP POLICY IF EXISTS "School admins can manage school enrollments" ON public.enrollments;
CREATE POLICY "School admins can manage school enrollments"
  ON public.enrollments FOR ALL
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- Platform admins ven todo
DROP POLICY IF EXISTS "Platform admins full access to enrollments" ON public.enrollments;
CREATE POLICY "Platform admins full access to enrollments"
  ON public.enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 10. RLS POLICIES para payments (multitenancy)
-- ============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Padres ven sus propios pagos
DROP POLICY IF EXISTS "Parents can view own payments" ON public.payments;
CREATE POLICY "Parents can view own payments"
  ON public.payments FOR SELECT
  USING (parent_id = auth.uid());

-- Padres pueden crear pagos
DROP POLICY IF EXISTS "Parents can create payments" ON public.payments;
CREATE POLICY "Parents can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- School admins ven pagos de su escuela
DROP POLICY IF EXISTS "School admins can view school payments" ON public.payments;
CREATE POLICY "School admins can view school payments"
  ON public.payments FOR SELECT
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School admins pueden gestionar pagos de su escuela
DROP POLICY IF EXISTS "School admins can manage school payments" ON public.payments;
CREATE POLICY "School admins can manage school payments"
  ON public.payments FOR ALL
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- Platform admins ven todo
DROP POLICY IF EXISTS "Platform admins full access to payments" ON public.payments;
CREATE POLICY "Platform admins full access to payments"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 11. RLS POLICIES para programs (multitenancy)
-- ============================================================================
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver programas activos (para exploración pública)
DROP POLICY IF EXISTS "Anyone can view active programs" ON public.programs;
CREATE POLICY "Anyone can view active programs"
  ON public.programs FOR SELECT
  USING (active = true);

-- School admins ven TODOS sus programas (incluyendo inactivos)
DROP POLICY IF EXISTS "School admins can view all school programs" ON public.programs;
CREATE POLICY "School admins can view all school programs"
  ON public.programs FOR SELECT
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- School admins pueden gestionar programas
DROP POLICY IF EXISTS "School admins can manage programs" ON public.programs;
CREATE POLICY "School admins can manage programs"
  ON public.programs FOR ALL
  USING (
    school_id IN (SELECT public.get_user_admin_school_ids(auth.uid()))
  );

-- Platform admins ven todo
DROP POLICY IF EXISTS "Platform admins full access to programs" ON public.programs;
CREATE POLICY "Platform admins full access to programs"
  ON public.programs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 12. TRIGGER: Auto-set school_id en enrollments al insertar
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_set_enrollment_school_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si no se provee school_id, tomarlo del programa
  IF NEW.school_id IS NULL AND NEW.program_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM public.programs
    WHERE id = NEW.program_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_enrollment_school_id ON public.enrollments;
CREATE TRIGGER trg_auto_enrollment_school_id
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_enrollment_school_id();

-- ============================================================================
-- 13. TRIGGER: Auto-add parent to school_members when child is assigned
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_add_parent_to_school()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando un child se asigna a una escuela, agregar al padre como miembro
  IF NEW.school_id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
    INSERT INTO public.school_members (profile_id, school_id, role, status)
    VALUES (NEW.parent_id, NEW.school_id, 'parent', 'active')
    ON CONFLICT (profile_id, school_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_parent_school_member ON public.children;
CREATE TRIGGER trg_auto_parent_school_member
  AFTER INSERT OR UPDATE OF school_id ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_parent_to_school();

-- ============================================================================
-- 14. TRIGGER: updated_at automático en school_members
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_school_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_school_members_updated_at ON public.school_members;
CREATE TRIGGER trg_school_members_updated_at
  BEFORE UPDATE ON public.school_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_school_members_updated_at();

-- ============================================================================
-- 15. DICCIONARIO DE NAMING (para referencia del equipo)
-- ============================================================================
COMMENT ON TABLE public.children IS 'Tabla principal de estudiantes/hijos. La UI de escuelas los llama "estudiantes". La UI de padres los llama "hijos". La tabla es la misma.';
COMMENT ON TABLE public.school_members IS 'Relación N:N entre usuarios y escuelas. Define qué usuarios tienen acceso a qué escuelas y con qué rol.';
COMMENT ON VIEW public.students IS 'Vista de "estudiantes" para la UI de escuelas. Combina children + enrollment + program info. Es un alias de la tabla children.';
COMMENT ON TABLE public.enrollments IS 'Inscripciones de usuarios a programas. school_id se auto-llena desde el programa.';
COMMENT ON TABLE public.payments IS 'Pagos de padres por servicios. school_id identifica a qué escuela corresponde.';

COMMENT ON COLUMN public.children.school_id IS 'Escuela a la que está asignado el niño/estudiante';
COMMENT ON COLUMN public.enrollments.school_id IS 'Auto-llenado desde programs.school_id via trigger';
COMMENT ON COLUMN public.enrollments.child_id IS 'El niño/estudiante específico inscrito (NULL si inscripción directa de usuario)';
COMMENT ON COLUMN public.payments.school_id IS 'Escuela que recibe el pago';

-- ============================================================================
-- 16. AUDIT: Verificar resultado
-- ============================================================================
DO $$
DECLARE
  v_sm_count integer;
  v_enroll_with_school integer;
  v_pay_with_school integer;
BEGIN
  SELECT count(*) INTO v_sm_count FROM public.school_members;
  SELECT count(*) INTO v_enroll_with_school FROM public.enrollments WHERE school_id IS NOT NULL;
  SELECT count(*) INTO v_pay_with_school FROM public.payments WHERE school_id IS NOT NULL;

  RAISE NOTICE '=== MVP SPRINT 1 MIGRATION COMPLETE ===';
  RAISE NOTICE 'school_members records: %', v_sm_count;
  RAISE NOTICE 'enrollments with school_id: %', v_enroll_with_school;
  RAISE NOTICE 'payments with school_id: %', v_pay_with_school;
  RAISE NOTICE 'Tables: school_members (new), children (existing), enrollments (updated), payments (updated)';
  RAISE NOTICE 'Views: students (new)';
  RAISE NOTICE 'Functions: is_school_member, has_school_role, get_user_school_ids, get_user_admin_school_ids';
  RAISE NOTICE 'RLS: school_members, children, enrollments, payments, programs';
END $$;

-- ============================================================================
-- FIN DE MIGRACIÓN MVP SPRINT 1
-- ============================================================================
