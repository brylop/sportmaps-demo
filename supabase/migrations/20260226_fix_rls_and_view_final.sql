-- =============================================================================
-- MIGRACIÓN CORREGIDA: Corrección Integral de Roles y Pagos
-- 1. RLS Enrollments (Padres)
-- 2. Vista students (Soporte para Teams/Equipos) — Fix JOIN ambiguo + security_invoker
-- 3. RPC enroll_student (Fix doble UPDATE + variable booleana de control)
-- =============================================================================


-- ─── 1. RLS PARA ENROLLMENTS: Permitir que los padres vean las inscripciones de sus hijos ───

CREATE POLICY "enrollments_select_parent"
ON public.enrollments FOR SELECT
USING (
  child_id IN (
    SELECT id FROM public.children
    WHERE parent_id = auth.uid()
  )
);


-- ─── 2. REDEFINICIÓN DE VISTA students ───
-- FIX: JOIN de teams ahora usa COALESCE para evitar duplicados por OR ambiguo.
-- FIX: Se agrega security_invoker para respetar RLS de tablas subyacentes.

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
  -- Datos del padre
  p.full_name    AS parent_name,
  p.phone        AS parent_phone,
  p.avatar_url   AS parent_avatar,
  p.email        AS parent_email,
  -- Datos de inscripción activa
  e.id           AS enrollment_id,
  e.status       AS enrollment_status,
  e.start_date   AS enrollment_date,
  -- Datos del programa / equipo
  -- FIX: COALESCE(pr.name, t.name) sigue igual, pero el JOIN de teams
  --      ahora usa COALESCE(e.program_id, c.team_id) para evitar duplicados.
  COALESCE(pr.name,          t.name)          AS program_name,
  COALESCE(pr.sport,         t.sport)         AS program_sport,
  COALESCE(pr.price_monthly, t.price_monthly) AS price_monthly,
  b.name AS branch_name
FROM public.children c
LEFT JOIN public.profiles        p  ON p.id  = c.parent_id
LEFT JOIN public.enrollments     e  ON e.child_id = c.id AND e.status = 'active'
LEFT JOIN public.programs       pr  ON pr.id = e.program_id
-- ✅ FIX: JOIN sin OR — usa COALESCE para priorizar el enrollment activo,
--    con fallback al team_id directo del child. Elimina riesgo de filas duplicadas.
LEFT JOIN public.teams           t  ON t.id  = COALESCE(e.program_id, c.team_id)
LEFT JOIN public.school_branches b  ON b.id  = c.branch_id;

-- ✅ FIX: security_invoker asegura que la vista respete el RLS
--    de cada tabla subyacente según el usuario que consulta.
ALTER VIEW public.students SET (security_invoker = true);

COMMENT ON VIEW public.students IS
  'Vista enriquecida de estudiantes con soporte para programas, equipos y RLS de padres/escuelas. '
  'security_invoker=true garantiza que RLS se aplique por usuario consultante.';


-- ─── 3. CORRECCIÓN DEL RPC enroll_student ───
-- FIX: Variable booleana v_found_in_teams controla qué tabla actualizar.
--      Evita el doble UPDATE que podía incrementar contadores incorrectos.

CREATE OR REPLACE FUNCTION public.enroll_student(
  p_school_id  UUID,
  p_class_id   UUID,
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id      UUID;
  v_current_count  INTEGER;
  v_max_capacity   INTEGER;
  v_enrollment_id  UUID;
  -- ✅ FIX: Bandera para saber en qué tabla encontramos el registro
  v_found_in_teams BOOLEAN := false;
BEGIN

  -- 1. Buscar primero en 'teams' (esquema actual)
  SELECT school_id, current_students, max_students
  INTO   v_school_id, v_current_count, v_max_capacity
  FROM   public.teams
  WHERE  id = p_class_id;

  IF v_school_id IS NOT NULL THEN
    v_found_in_teams := true;
  ELSE
    -- Fallback: buscar en la tabla legacy 'classes'
    SELECT school_id, enrolled_count, capacity
    INTO   v_school_id, v_current_count, v_max_capacity
    FROM   public.classes
    WHERE  id = p_class_id;
  END IF;

  IF v_school_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Class or Team not found'
    );
  END IF;

  -- 2. Validar que la escuela coincide (seguridad multi-tenant)
  IF v_school_id != p_school_id THEN
    RETURN json_build_object(
      'success', false,
      'error',   'School ID mismatch'
    );
  END IF;

  -- 3. Validar capacidad (✅ Uso de COALESCE para evitar bugs si max_capacity es NULL en BD)
  IF COALESCE(v_current_count, 0) >= COALESCE(v_max_capacity, 999999) THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Class is full'
    );
  END IF;

  -- 4. Evitar inscripción duplicada activa
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE  child_id   = p_student_id
      AND  program_id = p_class_id
      AND  status     = 'active'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Student already enrolled'
    );
  END IF;

  -- 5. Crear la inscripción
  INSERT INTO public.enrollments (
    school_id,
    child_id,
    program_id,
    status,
    start_date
  ) VALUES (
    p_school_id,
    p_student_id,
    p_class_id,
    'active',
    CURRENT_DATE
  )
  RETURNING id INTO v_enrollment_id;

  -- 6. ✅ FIX: Actualizar SOLO la tabla donde se encontró el registro.
  --    El OR anterior podía incrementar ambas tablas si los UUIDs coincidían.
  IF v_found_in_teams THEN
    UPDATE public.teams
    SET    current_students = COALESCE(current_students, 0) + 1
    WHERE  id = p_class_id;
  ELSE
    UPDATE public.classes
    SET    enrolled_count = COALESCE(enrolled_count, 0) + 1
    WHERE  id = p_class_id;
  END IF;

  -- 7. Sincronizar team_id en children para compatibilidad con la vista
  UPDATE public.children
  SET    team_id = p_class_id
  WHERE  id = p_student_id;

  RETURN json_build_object(
    'success',       true,
    'enrollment_id', v_enrollment_id,
    'message',       'Enrollment successful'
  );

END;
$$;
