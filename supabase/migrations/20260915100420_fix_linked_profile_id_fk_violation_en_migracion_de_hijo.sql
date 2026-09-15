-- =============================================================================
-- 20260915100420_fix_linked_profile_id_fk_violation_en_migracion_de_hijo.sql
-- Autor: brylop   Fecha: 2026-09-15   Versión anterior: 20260915095800
-- Objetivo: revertir una regresión introducida por la migración anterior:
--           migrate_unregistered_athlete_to_profile rompía con FK 23503 al
--           migrar una ficha hacia un HIJO (rama 'parent' de accept_invitation_pro).
-- =============================================================================
-- CÓMO SE DETECTÓ
-- Prueba de humo (transacción con ROLLBACK, sin tocar datos reales) sobre la
-- función recién desplegada en 20260915095800: al llamarla con p_new_child_id
-- reventó con
--   ERROR 23503: insert or update on table "unregistered_athletes" violates
--   foreign key constraint "unregistered_athletes_linked_profile_id_fkey"
--   Key (linked_profile_id)=(<child_id>) is not present in table "profiles"
-- porque unregistered_athletes.linked_profile_id tiene FK a profiles(id), y la
-- última línea de la función hacía:
--   SET linked_profile_id = COALESCE(p_new_user_id, p_new_child_id)
-- que para la rama de hijos (p_new_user_id NULL) intenta guardar un children.id
-- ahí — nunca es un profiles.id válido.
--
-- CÓMO NO SE HABÍA VISTO ANTES
-- El dato real de Michelle López Molano (CLUB DEPORTIVO BESSER, migrada el
-- 9-sept) tiene linked_profile_id = el profile de su papá (Carlos López
-- Forero), NO su children.id. Eso solo es posible si la función que de verdad
-- corrió el 9-sept en Supabase YA resolvía esto distinto al archivo del repo
-- 20260909071118 — drift ya documentado en
-- 20260717171019_sync_generate_monthly_charges.sql (un segundo agente aplica
-- fixes directo en Supabase sin dejar el .sql). El CREATE OR REPLACE de
-- 20260915095800 pisó esa versión parchada con la del repo, reintroduciendo el
-- bug: cualquier aceptación de invitación de un HIJO con ficha precargada
-- desde ese despliegue habría fallado con 23503, revirtiendo accept_invitation_pro
-- completa (RPC atómica) y dejando la invitación 'pending' para siempre — el
-- mismo síntoma que 20260909071118 vino a resolver. Se detectó en la prueba de
-- humo antes de que ningún padre real lo disparara.
--
-- FIX
-- Para la rama de hijos, linked_profile_id debe apuntar al PADRE (children.
-- parent_id), no al niño. Se resuelve con un subselect en vez de asumir que
-- p_new_child_id ya es un profile id.
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

  -- FIX 2026-09-15 (20260915095800): al mover child_id, propagar parent_id del
  -- hijo destino cuando el pago queda sin pagador.
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

  -- FIX 2026-09-15 (esta migración): linked_profile_id tiene FK a profiles(id).
  -- Para un adulto (p_new_user_id) eso ya es un profile válido. Para un HIJO
  -- (p_new_child_id) NO lo es — children.id no es profiles.id — así que hay
  -- que resolver el profile del PADRE de ese niño. Si el niño todavía no tiene
  -- padre vinculado, se deja NULL (no hay profile al que apuntar todavía; la
  -- columna es nullable con ON DELETE SET NULL, así que no rompe nada dejarlo
  -- así hasta que se vincule).
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
    'zk_user_mappings',     v_rows_zk_mappings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
