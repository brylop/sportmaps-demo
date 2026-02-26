-- =============================================================================
-- MIGRACIÓN CORREGIDA: Transición Segura de Programs a Teams
-- Enfoque: Sincronización Bidireccional por Triggers (100% Retrocompatible)
-- Fecha: 2026-02-26
-- =============================================================================
-- CORRECCIONES APLICADAS:
--   [1] Eliminado JOIN a public.programs (no existe en el esquema real)
--   [2] Eliminadas columnas c.sport y c.team_name (no existen en children)
--   [3] Trigger ahora maneja el caso de conflicto (ambos presentes y distintos)
--   [4] UPDATE histórico de attendance_records en batches (seguro para tablas grandes)
-- =============================================================================

BEGIN;

--------------------------------------------------------------------------------
-- 1. ESTRUCTURAS BÁSICAS
--------------------------------------------------------------------------------

-- Enrollments: agregar team_id como columna preferencial nueva
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

CREATE INDEX IF NOT EXISTS idx_enrollments_team_id
  ON public.enrollments(team_id);

-- Attendance: agregar team_id para sincronización
-- NOTA: program_id en esta tabla ya apunta a teams (FK real del esquema).
--       team_id es un alias explícito para compatibilidad con código nuevo.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_team_id
  ON public.attendance_records(team_id);


--------------------------------------------------------------------------------
-- 2. MIGRACIÓN HISTÓRICA DE DATOS
--------------------------------------------------------------------------------

-- Enrollments: copiar program_id → team_id donde team_id aún no tiene valor
UPDATE public.enrollments
SET    team_id = program_id
WHERE  team_id IS NULL
  AND  program_id IS NOT NULL;

-- Attendance: program_id es NOT NULL en el esquema real, por lo que
-- todos los registros históricos serán actualizados.
-- Si la tabla tiene muchos registros, ejecutar en batches:
DO $$
DECLARE
  v_batch     integer := 5000;
  v_updated   integer := 1;
  v_total     integer := 0;
BEGIN
  WHILE v_updated > 0 LOOP
    UPDATE public.attendance_records
    SET    team_id = program_id
    WHERE  id IN (
      SELECT id FROM public.attendance_records
      WHERE  team_id IS NULL AND program_id IS NOT NULL
      LIMIT  v_batch
    );
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    v_total := v_total + v_updated;
  END LOOP;
  RAISE NOTICE 'Migración attendance_records completada: % filas actualizadas.', v_total;
END $$;

-- Verificación post-migración histórica
DO $$
DECLARE
  v_pending_enr integer;
  v_pending_att integer;
BEGIN
  SELECT COUNT(*) INTO v_pending_enr
  FROM public.enrollments
  WHERE team_id IS NULL AND program_id IS NOT NULL;

  SELECT COUNT(*) INTO v_pending_att
  FROM public.attendance_records
  WHERE team_id IS NULL AND program_id IS NOT NULL;

  IF v_pending_enr > 0 OR v_pending_att > 0 THEN
    RAISE EXCEPTION 'ABORT: quedan filas sin migrar — enrollments: %, attendance_records: %',
      v_pending_enr, v_pending_att;
  END IF;

  RAISE NOTICE 'Migración histórica OK — enrollments y attendance_records sincronizados.';
END $$;


--------------------------------------------------------------------------------
-- 3. TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA
--------------------------------------------------------------------------------
-- Garantiza que código legacy (escribe program_id) y código nuevo (escribe team_id)
-- siempre mantengan ambas columnas consistentes.
--
-- Casos cubiertos:
--   A) Solo program_id llega (código legacy)   → team_id    := program_id
--   B) Solo team_id llega (código nuevo)        → program_id := team_id
--   C) Ambos llegan pero con valores distintos  → program_id := team_id (team_id gana)
--   D) Ambos llegan con el mismo valor          → sin cambio

CREATE OR REPLACE FUNCTION public.sync_program_team_id()
RETURNS trigger AS $$
BEGIN
  -- Caso A: código legacy escribe solo program_id
  IF NEW.program_id IS NOT NULL AND NEW.team_id IS NULL THEN
    NEW.team_id := NEW.program_id;

  -- Caso B: código nuevo escribe solo team_id
  ELSIF NEW.team_id IS NOT NULL AND NEW.program_id IS NULL THEN
    NEW.program_id := NEW.team_id;

  -- ✅ FIX [3]: Caso C — ambos presentes pero distintos (conflicto)
  -- team_id es la fuente de verdad nueva; program_id se alinea a él.
  ELSIF NEW.team_id IS NOT NULL
    AND NEW.program_id IS NOT NULL
    AND NEW.team_id != NEW.program_id THEN
    NEW.program_id := NEW.team_id;
  END IF;

  -- Caso D: ambos iguales o ambos NULL → sin cambio

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a enrollments
DROP TRIGGER IF EXISTS trg_sync_enrollments_team ON public.enrollments;
CREATE TRIGGER trg_sync_enrollments_team
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.sync_program_team_id();

-- Aplicar a attendance_records
DROP TRIGGER IF EXISTS trg_sync_attendance_team ON public.attendance_records;
CREATE TRIGGER trg_sync_attendance_team
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_program_team_id();


--------------------------------------------------------------------------------
-- 4. VISTA students CORREGIDA
--------------------------------------------------------------------------------
-- FIX [1]: Eliminado JOIN a public.programs (tabla inexistente).
--          Toda la información de nombre/deporte/precio viene de public.teams.
-- FIX [2]: Eliminadas c.sport y c.team_name (no existen en children).
--          Se obtienen desde el JOIN a teams como t.sport y t.name.
-- MEJORA:  La vista usa e.team_id (nuevo, preferencial) con fallback a
--          e.program_id y luego a c.team_id para máxima compatibilidad.

DROP VIEW IF EXISTS public.students;

CREATE VIEW public.students AS
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
  c.monthly_fee,
  c.doc_type,
  c.doc_number,
  c.is_demo,
  c.medical_info,
  c.emergency_contact,
  c.created_at,
  c.updated_at,
  -- Datos del padre
  p.full_name   AS parent_name,
  p.phone       AS parent_phone,
  p.avatar_url  AS parent_avatar,
  p.email       AS parent_email,
  -- Datos de inscripción activa
  e.id          AS enrollment_id,
  e.status      AS enrollment_status,
  e.start_date  AS enrollment_date,
  -- Datos del equipo
  -- Prioridad: team_id del enrollment (nuevo) → program_id del enrollment (legacy) → team_id del child
  t.name          AS program_name,
  t.sport         AS program_sport,
  t.price_monthly AS price_monthly,
  b.name          AS branch_name
FROM public.children c
LEFT JOIN public.profiles        p  ON p.id = c.parent_id
LEFT JOIN public.enrollments     e  ON e.child_id = c.id AND e.status = 'active'
-- ✅ Cadena de fallback limpia sin OR ambiguo ni joins a tablas inexistentes
LEFT JOIN public.teams           t  ON t.id = COALESCE(e.team_id, e.program_id, c.team_id)
LEFT JOIN public.school_branches b  ON b.id = c.branch_id;

-- Respetar RLS del usuario que consulta (no del creador de la vista)
ALTER VIEW public.students SET (security_invoker = true);

COMMENT ON VIEW public.students IS
  'Vista enriquecida de estudiantes. '
  'Usa COALESCE(e.team_id, e.program_id, c.team_id) para máxima compatibilidad '
  'con código legacy (program_id) y código nuevo (team_id). '
  'security_invoker=true — RLS aplicado por usuario consultante.';


COMMIT;

-- =============================================================================
-- VERIFICACIÓN FINAL (fuera de transacción — estado real post-commit)
-- =============================================================================

-- 1. Confirmar nuevas columnas en enrollments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'enrollments'
  AND column_name IN ('program_id', 'team_id');
-- → Debe retornar 2 filas

-- 2. Confirmar nuevas columnas en attendance_records
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attendance_records'
  AND column_name IN ('program_id', 'team_id');
-- → Debe retornar 2 filas

-- 3. Confirmar que los triggers existen
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_sync_enrollments_team', 'trg_sync_attendance_team');
-- → Debe retornar 4 filas (INSERT + UPDATE por cada tabla)

-- 4. Confirmar que la vista compila y devuelve datos
SELECT COUNT(*) AS total_students FROM public.students;
-- → Debe retornar sin error

-- 5. Verificar consistencia post-migración (debe retornar 0 en ambas)
SELECT
  (SELECT COUNT(*) FROM public.enrollments
   WHERE program_id != team_id AND program_id IS NOT NULL AND team_id IS NOT NULL
  ) AS enrollments_inconsistentes,
  (SELECT COUNT(*) FROM public.attendance_records
   WHERE program_id != team_id AND program_id IS NOT NULL AND team_id IS NOT NULL
  ) AS attendance_inconsistentes;
-- → Debe retornar 0, 0
