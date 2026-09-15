-- =============================================================================
-- 20260915095800_fix_migrate_unregistered_no_propaga_parent_id.sql
-- Autor: brylop   Fecha: 2026-09-15   Versión anterior: 20260914234010
-- Objetivo: migrate_unregistered_athlete_to_profile deja pagos sin pagador al
--           migrar una ficha (unregistered_athletes) a un hijo ya vinculado.
-- =============================================================================
-- SÍNTOMA
-- CLUB DEPORTIVO BESSER reporta un pago aprobado (Michelle López Molano) sin
-- "Padre" en la UI. Al revisar: payments.parent_id NULL con children.parent_id
-- SÍ poblado — el mismo síntoma que 20260730194230_adopt_orphan_payments_on_
-- child_link.sql ya arregló para 4 caminos, pero aquí reaparece.
--
-- CAUSA RAÍZ
-- 20260909071118_accept_invitation_pro_migrar_ficha_antes_de_inscribir.sql
-- reordenó accept_invitation_pro: ahora primero vincula/crea el hijo (dispara
-- trg_adopt_orphan_payments_on_child_link, que busca payments.child_id = hijo
-- y no encuentra nada porque el pago TODAVÍA cuelga de unregistered_athlete_id)
-- y RECIÉN DESPUÉS llama a migrate_unregistered_athlete_to_profile, que mueve
-- el pago de unregistered_athlete_id → child_id con un UPDATE directo sobre
-- payments. Ese UPDATE no dispara ningún trigger de children, así que el
-- parent_id nunca se propaga. El pago queda con el niño correcto y el padre en
-- NULL para siempre — invisible en el historial del padre y sin "Padre" en la
-- UI de la escuela.
--
-- ALCANCE MEDIDO (2026-09-15): 14 pagos de CLUB DEPORTIVO BESSER, $4.505.000,
-- todos pending/overdue (aparte del de Michelle, ya corregido a mano). Ninguna
-- otra escuela tiene el patrón todavía: Besser fue el primer caso que ejercitó
-- este camino desde el 9-sept.
--
-- FIX
--   1. migrate_unregistered_athlete_to_profile: al mover child_id, si el pago
--      queda sin pagador (parent_id y user_id NULL), tomar el parent_id del
--      hijo destino en el mismo UPDATE. Mismo criterio que el trigger de
--      20260730194230 (nunca pisa un pagador ya asignado).
--   2. Backfill de lo que ya quedó colgado, con el mismo criterio del trigger.
--
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. migrate_unregistered_athlete_to_profile: propagar parent_id ──────────
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

  -- FIX 2026-09-15: al mover child_id, propagar parent_id del hijo destino
  -- cuando el pago queda sin pagador. Sin esto, un pago colgado de una ficha
  -- (unregistered_athlete_id) que migra a un hijo ya vinculado a un acudiente
  -- queda con child_id correcto pero parent_id NULL para siempre — el UPDATE
  -- de abajo no dispara trg_adopt_orphan_payments_on_child_link (ese trigger
  -- es AFTER UPDATE OF parent_id ON children, no ve UPDATEs sobre payments).
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

  UPDATE public.unregistered_athletes
  SET linked_profile_id = COALESCE(p_new_user_id, p_new_child_id),
      is_active         = false
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

-- ── 2. Backfill de lo que ya quedó colgado ───────────────────────────────────
-- Mismo criterio que trg_adopt_orphan_payments_on_child_link: solo toca pagos
-- con parent_id Y user_id en NULL, nunca pisa un pagador ya asignado.
UPDATE public.payments p
   SET parent_id  = c.parent_id,
       updated_at = now()
  FROM public.children c
 WHERE p.child_id  = c.id
   AND p.parent_id IS NULL
   AND p.user_id   IS NULL
   AND c.parent_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── 3. Verificación ──────────────────────────────────────────────────────────
-- Debe devolver 0 filas: ya no debe quedar ningún pago de un menor con
-- acudiente vinculado que siga sin pagador.
SELECT s.name AS escuela, count(*) AS pagos_sin_pagador_restantes
  FROM public.payments p
  JOIN public.children c ON c.id = p.child_id
  JOIN public.schools  s ON s.id = p.school_id
 WHERE p.parent_id IS NULL
   AND p.user_id   IS NULL
   AND c.parent_id IS NOT NULL
 GROUP BY s.name;
