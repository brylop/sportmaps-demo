-- =============================================================================
-- MIGRACIÓN: RLS Policies + Índices de Performance + Vista students
-- SportMaps MVP — Seguridad y Multitenancy
-- =============================================================================
-- INSTRUCCIONES:
--   1. Ejecutar primero en Supabase Cloud STAGING
--   2. Verificar que los datos se ven correctamente por role
--   3. Ejecutar en PRODUCCIÓN
--   NUNCA ejecutar con service_role directamente en prod sin backup previo.
-- =============================================================================

-- ─── PASO 0: Columnas faltantes en el schema real ────────────────────────────
-- La columna onboarding_completed no existía en profiles (real schema verificado 2026-02-18)
-- El frontend la usa en AuthContext y ProtectedRoute para controlar el gate de onboarding.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- ─── PASO 1: Activar RLS en todas las tablas core ────────────────────────────
ALTER TABLE IF EXISTS children              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS programs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS enrollments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS school_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS school_staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS school_branches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS school_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facilities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facility_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS academic_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wellness_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS health_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS carts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_events       ENABLE ROW LEVEL SECURITY;

-- ─── FUNCIÓN HELPER: Escuelas del usuario actual ──────────────────────────────
-- Supabase no permite CREATE FUNCTION en schema 'auth' desde el SQL Editor.
-- Usamos schema 'public' con SECURITY DEFINER para que siempre corra
-- con permisos del owner (postgres) y pueda leer school_members.
CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.school_members
  WHERE profile_id = auth.uid()
    AND status = 'active';
$$;

-- Dar permiso de ejecución a usuarios autenticados y anónimos
GRANT EXECUTE ON FUNCTION public.user_school_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_school_ids() TO anon;

-- ─── PASO 2: Limpiar políticas anteriores (idempotente) ──────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'children','payments','programs','classes','enrollments',
        'attendance_records','attendance','announcements','school_members',
        'school_settings','school_branches','facilities','teams',
        'academic_progress','carts','calendar_events'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─── PASO 3: school_members — Ver miembros de mis escuelas ───────────────────
CREATE POLICY "sm_select_own_schools"
ON school_members FOR SELECT
USING (
  profile_id = auth.uid()
  OR school_id IN (SELECT public.user_school_ids())
);

CREATE POLICY "sm_insert_owner_only"
ON school_members FOR INSERT
WITH CHECK (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
  )
);

CREATE POLICY "sm_update_owner_only"
ON school_members FOR UPDATE
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'
  )
);

-- ─── PASO 4: schools — Lectura pública; escritura solo owner ─────────────────
-- schools ya debería tener RLS. Aseguramos policies de escritura:
ALTER TABLE IF EXISTS schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_select_public"   ON schools;
DROP POLICY IF EXISTS "schools_update_owner"    ON schools;
DROP POLICY IF EXISTS "schools_delete_owner"    ON schools;

CREATE POLICY "schools_select_public"
ON schools FOR SELECT USING (true);   -- Las escuelas son públicas (explorar)

CREATE POLICY "schools_insert_authenticated"
ON schools FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "schools_update_owner"
ON schools FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "schools_delete_owner"
ON schools FOR DELETE
USING (owner_id = auth.uid());

-- ─── PASO 5: children (estudiantes) ─────────────────────────────────────────
-- Select: Staff de la escuela O padre del hijo
CREATE POLICY "children_select_school_or_parent"
ON children FOR SELECT
USING (
  school_id IN (SELECT public.user_school_ids())
  OR parent_id = auth.uid()
);

-- Insert: Solo admins/coaches de la escuela
CREATE POLICY "children_insert_staff"
ON children FOR INSERT
WITH CHECK (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin','coach')
      AND status = 'active'
  )
);

-- Update: Staff de escuela O el padre (puede actualizar datos de su hijo)
CREATE POLICY "children_update_staff_or_parent"
ON children FOR UPDATE
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin','coach')
      AND status = 'active'
  )
  OR parent_id = auth.uid()
);

-- Delete: Solo admins
CREATE POLICY "children_delete_admin"
ON children FOR DELETE
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

-- ─── PASO 6: payments ────────────────────────────────────────────────────────
CREATE POLICY "payments_select_school_or_parent"
ON payments FOR SELECT
USING (
  school_id IN (SELECT public.user_school_ids())
  OR parent_id = auth.uid()
);

CREATE POLICY "payments_insert_staff"
ON payments FOR INSERT
WITH CHECK (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

CREATE POLICY "payments_update_admin"
ON payments FOR UPDATE
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

-- ─── PASO 7: programs y classes ──────────────────────────────────────────────
CREATE POLICY "programs_select_school"
ON programs FOR SELECT
USING (school_id IN (SELECT public.user_school_ids()) OR true); -- Lectura pública para explorar

CREATE POLICY "programs_write_admin"
ON programs FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

CREATE POLICY "classes_select_school"
ON classes FOR SELECT
USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "classes_write_staff"
ON classes FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin','coach')
      AND status = 'active'
  )
);

-- ─── PASO 8: enrollments ─────────────────────────────────────────────────────
CREATE POLICY "enrollments_select_school"
ON enrollments FOR SELECT
USING (
  school_id IN (SELECT public.user_school_ids())
  OR user_id = auth.uid()
);

CREATE POLICY "enrollments_write_staff"
ON enrollments FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin','coach')
      AND status = 'active'
  )
);

-- ─── PASO 9: attendance_records ──────────────────────────────────────────────
CREATE POLICY "attendance_select_school"
ON attendance_records FOR SELECT
USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "attendance_write_coach"
ON attendance_records FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin','coach')
      AND status = 'active'
  )
);

-- ─── PASO 10: announcements ──────────────────────────────────────────────────
-- School_id no existe en tabla. Coach_id define pertenencia.
-- Por ahora: visible a miembros de la misma escuela que el coach
CREATE POLICY "announcements_select_members"
ON announcements FOR SELECT
USING (
  coach_id IN (
    SELECT sm.profile_id FROM school_members sm
    WHERE sm.school_id IN (SELECT public.user_school_ids())
      AND sm.status = 'active'
  )
);

CREATE POLICY "announcements_write_coach"
ON announcements FOR ALL
USING (coach_id = auth.uid());

-- ─── PASO 11: carts — cada usuario ve solo su carrito ────────────────────────
CREATE POLICY "carts_own_only"
ON carts FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ─── PASO 12: school_branches — lectura pública; escritura owner ─────────────
CREATE POLICY "branches_select_public"
ON school_branches FOR SELECT USING (true);

CREATE POLICY "branches_write_owner"
ON school_branches FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

-- ─── PASO 13: school_settings ────────────────────────────────────────────────
CREATE POLICY "settings_school_staff"
ON school_settings FOR ALL
USING (
  school_id IN (
    SELECT school_id FROM school_members
    WHERE profile_id = auth.uid()
      AND role IN ('owner','admin')
      AND status = 'active'
  )
);

-- ─── PASO 14: academic_progress ──────────────────────────────────────────────
CREATE POLICY "academic_progress_school_or_parent"
ON academic_progress FOR SELECT
USING (
  child_id IN (
    SELECT id FROM children
    WHERE school_id IN (SELECT public.user_school_ids())
      OR parent_id = auth.uid()
  )
);

CREATE POLICY "academic_progress_write_coach"
ON academic_progress FOR ALL
USING (coach_id = auth.uid());

-- ─── PASO 15: calendar_events ────────────────────────────────────────────────
CREATE POLICY "calendar_own_events"
ON calendar_events FOR ALL
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- ÍNDICES DE PERFORMANCE (faltaban en schema real)
-- NOTA: Se usa CREATE INDEX sin CONCURRENTLY porque el SQL Editor de Supabase
-- envuelve todo en una transacción, y CONCURRENTLY no puede correr dentro
-- de un bloque transaccional (error 25001).
-- En tablas pequeñas/nuevas el comportamiento es idéntico.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_school_status_date
  ON payments (school_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_payments_parent_status
  ON payments (parent_id, status);

CREATE INDEX IF NOT EXISTS idx_children_school_parent
  ON children (school_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_children_school_id
  ON children (school_id);

CREATE INDEX IF NOT EXISTS idx_school_members_profile_status
  ON school_members (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_school_members_school_role
  ON school_members (school_id, role, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_school_program
  ON enrollments (school_id, program_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_child_id
  ON enrollments (child_id);

-- attendance_records: columna de fecha se llama 'date' (NO 'attendance_date')
CREATE INDEX IF NOT EXISTS idx_attendance_records_school_student
  ON attendance_records (school_id, student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_class_id
  ON attendance_records (class_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date
  ON attendance_records (student_id, date DESC);

-- attendance (tabla simple): usa child_id + class_date
CREATE INDEX IF NOT EXISTS idx_attendance_child_date
  ON attendance (child_id, class_date);

CREATE INDEX IF NOT EXISTS idx_classes_school_program
  ON classes (school_id, program_id);

-- schools: columnas confirmadas en schema real = city, name
-- NO existe 'slug' ni 'status' en la tabla real
CREATE INDEX IF NOT EXISTS idx_schools_city
  ON schools (city);

-- Índice de texto para búsqueda de escuelas (requiere pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm
  ON schools USING GIN (name gin_trgm_ops);

-- Índices adicionales confirmados
CREATE INDEX IF NOT EXISTS idx_teams_school_id
  ON teams (school_id);

CREATE INDEX IF NOT EXISTS idx_programs_school_active
  ON programs (school_id, active);

-- =============================================================================
-- COLUMNAS FALTANTES EN payments (necesarias para integración Wompi)
-- El schema real no tiene: reference, wompi_id, amount_paid, ni statuses
-- 'failed'/'cancelled'. Se añaden aquí para completar la integración.
-- =============================================================================

-- Campo referencia única de Wompi (formato SPM-XXXXX)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference text UNIQUE;

-- ID de la transacción en Wompi (para trazabilidad)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS wompi_id text;

-- Monto efectivamente pagado (puede diferir de amount por descuentos)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_paid numeric;

-- Extender el CHECK de status para incluir 'failed' y 'cancelled'
-- (el schema real solo tenía 'pending','paid','overdue')
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'paid'::text,
    'overdue'::text,
    'failed'::text,
    'cancelled'::text
  ]));

-- Índice en reference ahora que existe la columna
CREATE INDEX IF NOT EXISTS idx_payments_wompi_reference
  ON payments (reference) WHERE reference IS NOT NULL;

-- =============================================================================
-- VISTA students — basada en schema real confirmado
-- profiles.id = auth.users.id (via FK profiles_id_fkey)
-- children.parent_id → auth.users(id) → se puede unir a profiles por id
--
-- NOTA: Se hace DROP + CREATE en lugar de CREATE OR REPLACE porque PostgreSQL
-- no permite cambiar nombres de columnas con OR REPLACE (error 42P16).
-- DROP IF EXISTS es seguro: no falla si la vista no existe.
-- =============================================================================

-- Eliminar vista anterior (puede tener distinto orden/nombre de columnas)
DROP VIEW IF EXISTS students;

-- Crear la vista actualizada con el schema real verificado
CREATE VIEW students AS
SELECT
  c.id,
  c.full_name,
  c.date_of_birth,
  c.avatar_url,
  c.school_id,
  c.branch_id,
  c.parent_id,
  c.program_id,
  c.team_id,
  c.grade,
  c.sport,
  c.team_name,
  c.medical_info,
  c.monthly_fee,
  c.doc_type,
  c.doc_number,
  c.is_demo,
  c.emergency_contact,
  c.created_at,
  c.updated_at,
  -- Datos del padre (profiles.id = auth.users.id)
  p.full_name    AS parent_name,
  p.phone        AS parent_phone,
  p.avatar_url   AS parent_avatar,
  p.email        AS parent_email,
  -- Datos de inscripción activa
  e.id           AS enrollment_id,
  e.status       AS enrollment_status,
  e.start_date   AS enrollment_date,
  -- Datos del programa
  pr.name        AS program_name,
  pr.sport       AS program_sport,
  pr.price_monthly
FROM children c
LEFT JOIN profiles    p  ON p.id  = c.parent_id
LEFT JOIN enrollments e  ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN programs    pr ON pr.id = e.program_id;

COMMENT ON VIEW students IS
  'Vista enriquecida de children con datos de padre (via profiles), programa e inscripción activa. Solo lectura. Schema real verificado 2026-02-18.';


