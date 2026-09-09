-- =============================================================================
-- 20260909072259_fix_linked_profile_id_en_migracion_de_ficha_a_hijo.sql
-- Autor: brylop   Fecha: 2026-09-09   Versión anterior: 20260909071118
-- Objetivo: migrate_unregistered_athlete_to_profile no podía cerrar el camino
--           de HIJO: escribía el child_id en linked_profile_id, que tiene FK a
--           profiles, y reventaba con 23503.
-- =============================================================================
-- Cómo apareció: la migración anterior (20260909071118) destrabó el 23505 de
-- uq_enrollment_child_plan, y al avanzar más lejos en la misma función salió el
-- bug que estaba detrás:
--
--   UPDATE public.unregistered_athletes
--   SET linked_profile_id = COALESCE(p_new_user_id, p_new_child_id)
--
-- En el camino de acudiente p_new_user_id es NULL, así que el COALESCE dejaba
-- el p_new_child_id — un id de `children` — en una columna con FK a
-- `profiles(id)`:
--   23503 ... "Key (linked_profile_id)=(9f705f5f-…) is not present in table profiles"
--
-- Medido antes del fix: 477 fichas, 22 con vínculo, y las 22 apuntando a un
-- perfil real (camino de atleta adulto). CERO apuntando a un hijo. O sea que el
-- camino de acudiente NUNCA completó desde que existe la migración de fichas:
-- el 23505 abortaba la transacción antes de llegar acá y tapaba este otro.
--
-- Qué guarda ahora: la cuenta que RECLAMÓ la ficha, que en el camino de hijo es
-- el acudiente (children.parent_id). Con eso la columna cumple el FK y la ficha
-- deja de estar reclamable — importante, porque accept_invitation_pro decide si
-- una ficha está libre con `linked_profile_id IS NULL`, y dejarla en NULL la
-- haría re-migrable en cada aceptación posterior.
--
-- Se descartó agregar una columna linked_child_id: qué hijo terminó siendo la
-- ficha ya queda registrado en las filas que la propia función mueve
-- (enrollments, payments, attendance_records, session_bookings, todas con
-- child_id), así que sería un segundo lugar donde guardar lo mismo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.migrate_unregistered_athlete_to_profile(
    p_unregistered_id uuid,
    p_new_user_id     uuid DEFAULT NULL::uuid,
    p_new_child_id    uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_rows_enrollments   int;
  v_rows_omitidos      int;
  v_rows_records       int;
  v_rows_bookings      int;
  v_rows_payments      int;
  v_rows_zk_mappings   int;
  v_claimed_by         uuid;
BEGIN
  IF p_new_user_id IS NULL AND p_new_child_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere p_new_user_id o p_new_child_id';
  END IF;

  -- La fila que colisionaría se SALTA, no se cancela: cancelarla dispararía
  -- trg_cancel_payments_on_enrollment_cancel y anularía cobros pendientes que
  -- todavía no se migraron (los payments se mueven más abajo).
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

  -- Lo que quedó sin mover por colisión: sigue colgando de la ficha.
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
    UPDATE public.payments
    SET child_id                = p_new_child_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND child_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_payments = ROW_COUNT;

  -- Torniquete: zk_user_mappings (FIX 2026-09-05)
  IF p_new_user_id IS NOT NULL THEN
    UPDATE public.zk_user_mappings
    SET user_id                 = p_new_user_id,
        unregistered_athlete_id = NULL
    WHERE unregistered_athlete_id = p_unregistered_id
      AND user_id IS NULL;
  END IF;
  GET DIAGNOSTICS v_rows_zk_mappings = ROW_COUNT;

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

  -- FIX 2026-09-09 — quién reclamó la ficha. linked_profile_id tiene FK a
  -- profiles, así que en el camino de hijo NO puede recibir el child_id (era el
  -- 23503). Recibe la cuenta del acudiente, que es la que efectivamente la
  -- reclamó; qué hijo terminó siendo queda en las filas ya migradas arriba.
  v_claimed_by := COALESCE(
      p_new_user_id,
      (SELECT c.parent_id FROM public.children c WHERE c.id = p_new_child_id)
  );

  UPDATE public.unregistered_athletes
  SET linked_profile_id = COALESCE(v_claimed_by, linked_profile_id),
      is_active         = false
  WHERE id = p_unregistered_id;

  RETURN jsonb_build_object(
    'unregistered_id',      p_unregistered_id,
    'migrated_to_user',     p_new_user_id,
    'migrated_to_child',    p_new_child_id,
    'claimed_by',           v_claimed_by,
    'enrollments',          v_rows_enrollments,
    'enrollments_omitidos', v_rows_omitidos,
    'attendance_records',   v_rows_records,
    'session_bookings',     v_rows_bookings,
    'payments',             v_rows_payments,
    'zk_user_mappings',     v_rows_zk_mappings
  );
END;
$$;

-- Permisos idénticos a los que ya tenía: solo service_role (y el owner).
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) TO service_role;

COMMIT;
