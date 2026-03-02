-- ============================================================
-- SportMaps — Función de inscripción atómica
-- Pegar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
--
-- ¿Por qué esta función en vez de hacer dos queries desde Node?
--
-- El problema con el approach anterior:
--   1. Node lee: current_enrollments=9, capacity=10 → hay cupo
--   2. Otro request lee LO MISMO al mismo tiempo → también ve cupo
--   3. Ambos insertan → current_enrollments llega a 11 (race condition)
--
-- Con FOR UPDATE, el segundo request espera hasta que el primero
-- termine. Cuando llega su turno, ve current_enrollments=10 y
-- retorna "clase llena" correctamente.
-- ============================================================

CREATE OR REPLACE FUNCTION enroll_student(
  p_student_id UUID,
  p_class_id   UUID,
  p_program_id UUID,
  p_school_id  UUID
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_class   RECORD;
  v_student RECORD;
  v_enroll  RECORD;
BEGIN
  -- 1. Verificar que el estudiante pertenece a la escuela del token
  SELECT id INTO v_student
  FROM students
  WHERE id = p_student_id AND school_id = p_school_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Estudiante no encontrado en esta escuela');
  END IF;

  -- 2. Bloquear la fila de la clase (FOR UPDATE previene race conditions)
  SELECT id, capacity, current_enrollments, school_id
  INTO v_class
  FROM classes
  WHERE id = p_class_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Clase no encontrada en esta escuela');
  END IF;

  -- 3. Verificar capacidad (ahora con datos bloqueados y consistentes)
  IF v_class.current_enrollments >= v_class.capacity THEN
    RETURN json_build_object('error', 'Clase llena');
  END IF;

  -- 4. Insertar enrollment
  INSERT INTO enrollments (
    student_id, class_id, program_id,
    school_id, status, payment_status,
    created_at
  )
  VALUES (
    p_student_id, p_class_id, p_program_id,
    p_school_id, 'active', 'pending',
    NOW()
  )
  RETURNING * INTO v_enroll;

  -- 5. Incrementar contador de forma atómica en la misma transacción
  UPDATE classes
  SET current_enrollments = current_enrollments + 1,
      updated_at = NOW()
  WHERE id = p_class_id;

  RETURN json_build_object(
    'success',    true,
    'enrollment', row_to_json(v_enroll)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'El estudiante ya está inscrito en esta clase');
  WHEN OTHERS THEN
    RETURN json_build_object('error', 'Error inesperado: ' || SQLERRM);
END;
$$;

-- Verificar que la función se creó correctamente:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'enroll_student';
