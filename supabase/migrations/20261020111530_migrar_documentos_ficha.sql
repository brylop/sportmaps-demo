-- ============================================================================
-- Los documentos de la ficha viajan con el atleta al vincular la cuenta.
--
-- migrate_unregistered_athlete_to_profile movía inscripciones, asistencia,
-- reservas, pagos y mapeos ZKTeco, pero NO athlete_documents: al aceptar la
-- invitación los documentos quedaban colgados de la ficha inactiva (y con
-- ON DELETE CASCADE hacia unregistered_athletes). Monster tiene 1.009.
--
-- athlete_documents_subject_xor exige exactamente un dueño (child_id,
-- user_id o unregistered_athlete_id), así que mover = poner el dueño nuevo y
-- dejar NULL la ficha. No hay unicidad por tipo de documento: sin conflictos.
-- Solo cambia el cuerpo; firma, SECURITY DEFINER y search_path se conservan.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.migrate_unregistered_athlete_to_profile(
  p_unregistered_id uuid,
  p_new_user_id uuid DEFAULT NULL::uuid,
  p_new_child_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows_enrollments   int;
  v_rows_omitidos      int;
  v_rows_records       int;
  v_rows_bookings      int;
  v_rows_payments      int;
  v_rows_zk_mappings   int;
  v_rows_documents     int;
BEGIN
  IF p_new_user_id IS NULL AND p_new_child_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere p_new_user_id o p_new_child_id';
  END IF;

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.enrollments e
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE e.unregistered_athlete_id = p_unregistered_id
      AND e.user_id IS NULL
      AND (
        e.status <> 'active'
        OR NOT EXISTS (
          SELECT 1
          FROM public.enrollments dup
          WHERE dup.user_id = p_new_user_id
            AND dup.status  = 'active'
            AND dup.id     <> e.id
            AND (
                 (dup.offering_plan_id IS NOT NULL AND dup.offering_plan_id = e.offering_plan_id)
              OR (dup.team_id          IS NOT NULL AND dup.team_id          = e.team_id)
            )
        )
      );
  ELSE
    UPDATE public.enrollments e
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE e.unregistered_athlete_id = p_unregistered_id
      AND e.child_id IS NULL
      AND (
        e.status <> 'active'
        OR NOT EXISTS (
          SELECT 1
          FROM public.enrollments dup
          WHERE dup.child_id = p_new_child_id
            AND dup.status   = 'active'
            AND dup.id      <> e.id
            AND (
                 (dup.offering_plan_id IS NOT NULL AND dup.offering_plan_id = e.offering_plan_id)
              OR (dup.team_id          IS NOT NULL AND dup.team_id          = e.team_id)
            )
        )
      );
  END IF;
  GET DIAGNOSTICS v_rows_enrollments = ROW_COUNT;

  SELECT count(*) INTO v_rows_omitidos
  FROM public.enrollments e
  WHERE e.unregistered_athlete_id = p_unregistered_id
    AND (
         (p_new_user_id IS NOT NULL AND e.user_id  IS NULL)
      OR (p_new_user_id IS NULL     AND e.child_id IS NULL)
    );

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.attendance_records
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.attendance_records
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_records = ROW_COUNT;

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.session_bookings
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.session_bookings
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_bookings = ROW_COUNT;

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.payments
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  ELSE
    UPDATE public.payments p
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL,
        parent_id               = COALESCE(p.parent_id, c.parent_id)
    FROM public.children c
    WHERE c.id = p_new_child_id
      AND p.unregistered_athlete_id = p_unregistered_id
      AND p.child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_payments = ROW_COUNT;

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.zk_user_mappings
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_zk_mappings = ROW_COUNT;

  -- NUEVO: los documentos de la ficha pasan al nuevo dueño (athlete_documents
  -- tiene CHECK de un solo dueño: se limpia la ficha al asignar el otro).
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.athlete_documents
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id;
  ELSE
    UPDATE public.athlete_documents
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id;
  END IF;
  GET DIAGNOSTICS v_rows_documents = ROW_COUNT;

  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.profiles pr
    SET
      date_of_birth = COALESCE(pr.date_of_birth, ua.date_of_birth),
      phone         = COALESCE(pr.phone,         ua.phone),
      updated_at    = now()
    FROM public.unregistered_athletes ua
    WHERE pr.id = p_new_user_id
      AND ua.id = p_unregistered_id
      AND (ua.date_of_birth IS NOT NULL OR ua.phone IS NOT NULL);
  END IF;

  UPDATE public.unregistered_athletes
  SET linked_profile_id = COALESCE(
        p_new_user_id,
        (SELECT c.parent_id FROM public.children c WHERE c.id = p_new_child_id)
      ),
      is_active = false
  WHERE id = p_unregistered_id;

  RETURN jsonb_build_object(
    'unregistered_id',      p_unregistered_id,
    'migrated_to_user',     p_new_user_id,
    'migrated_to_child',    p_new_child_id,
    'enrollments',          v_rows_enrollments,
    'enrollments_omitidos', v_rows_omitidos,
    'attendance_records',   v_rows_records,
    'session_bookings',     v_rows_bookings,
    'payments',             v_rows_payments,
    'zk_user_mappings',     v_rows_zk_mappings,
    'athlete_documents',    v_rows_documents
  );
END;
$function$;
