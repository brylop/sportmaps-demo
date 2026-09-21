-- =============================================================================
-- 20260919194236_fix_identity_spoofing_trainer_plans_unblock_payment.sql
-- Autor: brylop   Fecha: 2026-09-20   Versión anterior: 20260919194017
-- Objetivo: 4 funciones SECURITY DEFINER ejecutables por `anon`/`authenticated`
-- (linter de Supabase, categoría anon_security_definer_function_executable)
-- con un bug de autorización real, encontrado auditando el cuerpo de cada una:
--
-- 1) fn_create_plan_from_routine, fn_delete_self_assigned_session,
--    fn_unassign_gym_session: reciben la identidad del actor como PARÁMETRO
--    (p_trainer_id / p_caller_id) y la usan tal cual para decidir permisos,
--    sin contrastarla nunca contra auth.uid(). Cualquiera que conozca (o
--    enumere) el UUID de la víctima puede pasarlo como si fuera su propia
--    sesión — sin haber iniciado sesión como esa persona — para cancelar
--    sesiones auto-asignadas de un padre/atleta, desasociar sesiones de un
--    gimnasio, o crear planes de entrenamiento a nombre de un tercero.
--    Fix: anclar el parámetro a auth.uid() al entrar a la función (se
--    sobreescribe cualquier valor que mande el cliente), sin tocar el resto
--    de la lógica de autorización ni de negocio — los callers legítimos ya
--    mandan su propio id, así que el comportamiento no cambia para ellos.
--
-- 2) unblock_payment: para `p_kind='payment'` y `p_kind='marketplace_transaction'`
--    el OR de autorización incluía el ROL GLOBAL del actor
--    (`v_actor_role IN ('school_admin','owner')`) sin acotarlo a la escuela
--    DEL PAGO. Cualquier school_admin/owner de CUALQUIER escuela podía
--    desbloquear el pago de OTRA escuela, neutralizando `requires_review`
--    (la defensa contra comprobantes adulterados). Fix: usar
--    `is_school_admin(p.school_id)` (ya usa auth.uid() internamente y sí
--    acota por escuela) en vez del rol global; en marketplace_transaction,
--    acotar a `mt.vendor_id = v_actor` (la tabla no existe todavía en este
--    ambiente — ver pg_tables guard en la misma función — así que este
--    branch es hoy código muerto, pero se corrige igual para cuando exista).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1) fn_delete_self_assigned_session ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_delete_self_assigned_session(p_plan_id uuid, p_caller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan RECORD;
  v_authorized BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;
  -- Fix seguridad 2026-09-19: p_caller_id lo manda el cliente, no es de fiar.
  -- Se ancla a la sesión real; cualquier valor spoofeado se descarta acá.
  p_caller_id := auth.uid();

  SELECT * INTO v_plan
  FROM trainer_session_plans
  WHERE id = p_plan_id
    AND assignment_source = 'self'
    AND status IN ('assigned', 'in_progress');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada, no auto-asignada, o ya finalizada.');
  END IF;

  IF v_plan.client_type = 'child' THEN
    SELECT EXISTS (
      SELECT 1 FROM children c WHERE c.id = v_plan.client_id AND c.parent_id = p_caller_id
    ) INTO v_authorized;
  ELSE
    v_authorized := (v_plan.client_id = p_caller_id);
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para eliminar esta sesión.');
  END IF;

  UPDATE trainer_session_plans
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_plan_id;

  IF v_plan.enrollment_id IS NOT NULL THEN
    UPDATE enrollments
    SET sessions_used = GREATEST(0, COALESCE(sessions_used, 0) - 1),
        updated_at    = now()
    WHERE id = v_plan.enrollment_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id);
END;
$function$;

-- ── 2) fn_unassign_gym_session ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_unassign_gym_session(p_plan_id uuid, p_caller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan RECORD;
  v_authorized BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;
  -- Fix seguridad 2026-09-19: mismo patrón que fn_delete_self_assigned_session.
  p_caller_id := auth.uid();

  SELECT * INTO v_plan
  FROM trainer_session_plans
  WHERE id = p_plan_id
    AND assignment_source = 'gym_staff'
    AND status IN ('assigned', 'in_progress');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada, no asignada por el gimnasio, o ya finalizada.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM school_members sm
    WHERE sm.profile_id = p_caller_id
      AND sm.school_id = v_plan.school_id
      AND sm.status = 'active'
      AND sm.role IN ('owner','admin','coach','staff')
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para desasociar esta sesión.');
  END IF;

  UPDATE trainer_session_plans
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_plan_id;

  IF v_plan.enrollment_id IS NOT NULL THEN
    UPDATE enrollments
    SET sessions_used = GREATEST(0, COALESCE(sessions_used, 0) - 1),
        updated_at    = now()
    WHERE id = v_plan.enrollment_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id);
END;
$function$;

-- ── 3) fn_create_plan_from_routine ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_create_plan_from_routine(p_routine_id uuid, p_client_id uuid, p_client_type text, p_session_date date, p_trainer_id uuid, p_school_id uuid, p_enrollment_id uuid DEFAULT NULL::uuid, p_assignment_source text DEFAULT 'pt'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_routine RECORD;
  v_plan_id UUID;
  v_resolved_enrollment_id UUID := p_enrollment_id;
  v_authorized BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;
  -- Fix seguridad 2026-09-19: p_trainer_id hace doble función (identidad para
  -- TODAS las ramas de autorización de abajo, y valor que queda guardado en
  -- trainer_session_plans.trainer_id). Al anclarlo a auth.uid() se cierran las
  -- dos cosas a la vez sin tocar ninguna rama de negocio: los callers
  -- legítimos ya mandan su propio id.
  p_trainer_id := auth.uid();

  IF p_assignment_source NOT IN ('pt','gym_staff','self') THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_source inválido');
  END IF;

  SELECT * INTO v_routine
  FROM public.trainer_routines
  WHERE id = p_routine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rutina no encontrada');
  END IF;

  -- ── Autorización (en orden de más específico a más general) ──────────
  -- 1) Legacy PT: dueño directo de la rutina
  IF v_routine.trainer_id = p_trainer_id THEN
    v_authorized := true;
  END IF;

  -- 2) Catálogo global: cualquiera puede asignarla (staff o self, según p_assignment_source)
  IF NOT v_authorized AND v_routine.scope = 'global' THEN
    IF p_assignment_source = 'self' THEN
      -- Auto-asignación de catálogo global: solo requiere ser el propio
      -- atleta o el padre del menor. No requiere revisar visibilidad de
      -- escuela porque global es visible para todos.
      v_authorized := (
        (p_client_type = 'child' AND EXISTS (
          SELECT 1 FROM public.children c WHERE c.id = p_client_id AND c.parent_id = p_trainer_id
        ))
        OR (p_client_type <> 'child' AND p_client_id = p_trainer_id)
      );
    ELSE
      v_authorized := true;
    END IF;
  END IF;

  -- 3) Rutina 'school': el caller debe ser staff activo de esa escuela
  IF NOT v_authorized AND v_routine.scope = 'school' AND v_routine.school_id = p_school_id
     AND p_assignment_source = 'gym_staff' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.profile_id = p_trainer_id
        AND sm.school_id = p_school_id
        AND sm.status = 'active'
        AND sm.role IN ('owner','admin','coach','staff')
    ) INTO v_authorized;
  END IF;

  -- 4) Auto-asignación de rutina 'school': el propio atleta (o su padre)
  --    con inscripción activa en esa escuela, y la rutina debe estar
  --    marcada como visible_to_athletes.
  IF NOT v_authorized AND v_routine.scope = 'school' AND v_routine.school_id = p_school_id
     AND p_assignment_source = 'self' AND v_routine.visible_to_athletes = true THEN
    IF p_client_type = 'child' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_client_id AND c.parent_id = p_trainer_id
      ) INTO v_authorized;
    ELSE
      v_authorized := (p_client_id = p_trainer_id);
    END IF;

    IF v_authorized THEN
      SELECT EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.school_id = p_school_id AND e.status = 'active'
          AND (
            (p_client_type = 'child' AND e.child_id = p_client_id)
            OR (p_client_type <> 'child' AND e.user_id = p_client_id)
          )
      ) INTO v_authorized;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rutina no encontrada');
  END IF;

  -- ✅ Auto-resolver enrollment_id si no se pasa explícitamente
  IF v_resolved_enrollment_id IS NULL THEN
    SELECT e.id INTO v_resolved_enrollment_id
    FROM enrollments e
    JOIN offering_plans op ON op.id = e.offering_plan_id
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND (
        (p_client_type = 'child'        AND e.child_id = p_client_id)
        OR (p_client_type = 'unregistered' AND e.unregistered_athlete_id = p_client_id)
        OR (p_client_type NOT IN ('child', 'unregistered')
            AND e.user_id = p_client_id AND e.child_id IS NULL)
      )
    ORDER BY e.created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.trainer_session_plans (
    school_id, trainer_id, client_id, client_type,
    routine_id, session_date, status, name, blocks,
    enrollment_id, assignment_source
  ) VALUES (
    p_school_id, p_trainer_id, p_client_id, p_client_type,
    p_routine_id, p_session_date, 'assigned',
    v_routine.name, v_routine.blocks,
    v_resolved_enrollment_id, p_assignment_source
  )
  RETURNING id INTO v_plan_id;

  RETURN jsonb_build_object(
    'success',       true,
    'plan_id',       v_plan_id,
    'name',          v_routine.name,
    'enrollment_id', v_resolved_enrollment_id
  );
END;
$function$;

-- ── 4) unblock_payment ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unblock_payment(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor UUID;
    v_actor_role TEXT;
    v_authorized BOOLEAN := false;
BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor;

    -- Admin global pasa siempre
    IF v_actor_role = 'admin' THEN
        v_authorized := true;
    END IF;

    IF p_kind = 'payment' THEN
        IF NOT v_authorized THEN
            -- Fix seguridad 2026-09-19: el rol GLOBAL de school_admin/owner no
            -- basta — dejaba a cualquier admin de CUALQUIER escuela desbloquear
            -- el pago de OTRA. is_school_admin(school_id) ya usa auth.uid() y
            -- acota a la escuela del pago.
            SELECT EXISTS (
                SELECT 1 FROM public.payments p
                JOIN public.schools s ON s.id = p.school_id
                WHERE p.id = p_id
                  AND (s.owner_id = v_actor OR public.is_school_admin(p.school_id))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.payments
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSIF p_kind = 'marketplace_transaction' THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'marketplace_transactions_not_available');
        END IF;
        IF NOT v_authorized THEN
            -- Fix seguridad 2026-09-19: mismo problema que 'payment' — el rol
            -- global dejaba desbloquear la transacción de CUALQUIER vendor.
            -- Se acota a ser el vendor dueño de ESA transacción.
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = $1 AND mt.vendor_id = $2)'
                INTO v_authorized USING p_id, v_actor;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        EXECUTE 'UPDATE public.marketplace_transactions SET requires_review = false, unblocked_at = NOW(), unblocked_by = $1, updated_at = NOW() WHERE id = $2'
            USING v_actor, p_id;

    ELSIF p_kind = 'order' THEN
        IF NOT v_authorized THEN
            -- Vendor de la orden o de algun item
            SELECT EXISTS (
                SELECT 1 FROM public.orders o
                WHERE o.id = p_id
                  AND (o.vendor_id = v_actor
                       OR EXISTS (SELECT 1 FROM public.order_items oi
                                  WHERE oi.order_id = o.id AND oi.vendor_id = v_actor))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.orders
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind');
    END IF;

    RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'unblocked_by', v_actor);
END;
$function$;

COMMIT;
