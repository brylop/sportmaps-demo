-- =============================================================================
-- 20260909071118_accept_invitation_pro_migrar_ficha_antes_de_inscribir.sql
-- Autor: brylop   Fecha: 2026-09-09   Versión anterior: 20260908152538
-- Objetivo: destrabar la aceptación de invitaciones de acudiente, que fallaba
--           con 23505 uq_enrollment_child_plan para TODA invitación cuyo plan
--           coincide con la inscripción activa de su ficha precargada.
-- =============================================================================
-- El reporte: una mamá de CLUB DEPORTIVO BESSER veía en pantalla
--   "duplicate key value violates unique constraint uq_enrollment_child_plan"
-- cada vez que tocaba «Aceptar Invitación». Reintentar no servía: la RPC es
-- atómica, así que el 23505 revertía TODO y la invitación quedaba 'pending'
-- para siempre. Medido al momento del fix: 69 invitaciones pendientes de Besser
-- —la cohorte completa de acudientes— iban a chocar con lo mismo.
--
-- Causa raíz: el ORDEN dentro de accept_invitation_pro, rama 'parent'.
--   1. adopta o crea al hijo
--   2. crea la inscripción del plan que trae la invitación
--   3. recién después llama a migrate_unregistered_athlete_to_profile, que
--      mueve al hijo la inscripción que la ficha precargada YA tenía con ese
--      mismo plan
-- → dos filas activas con el mismo (child_id, offering_plan_id) → 23505.
--
-- La rama 'athlete' NO tenía el bug porque su búsqueda de inscripción incluye
-- las filas de la ficha (`OR unregistered_athlete_id = v_unregistered_id`), así
-- que el paso 2 encontraba la fila existente en vez de insertar otra. La rama
-- 'parent' solo busca por child_id, y de ahí la asimetría.
--
-- Tres correcciones:
--   1. accept_invitation_pro: migrar la ficha ANTES de reconciliar la
--      inscripción. Así el caso (a) encuentra la fila ya migrada y no inserta
--      nada. Además conserva el historial de la fila original (su start_date y
--      los cobros que ya colgaran de ella) en vez de crear una fila nueva.
--   2. migrate_unregistered_athlete_to_profile: no mover una inscripción si
--      colisionaría con una activa del destino (por plan o por equipo). Red de
--      seguridad para los OTROS llamadores de esta función.
--   3. accept_invitation_pro: adoptar por nombre NORMALIZADO también entre los
--      hijos del propio acudiente. Las dos primeras búsquedas usan LOWER(TRIM())
--      que no quita tildes, y la tercera exige parent_id IS NULL. Por eso el
--      hijo «Jacobo Sánchez Velásquez» que la mamá creó a mano no lo encontraba
--      la invitación que decía «Jacobo Sanchez Velasquez»: ficha duplicada.
-- =============================================================================

BEGIN;

-- ── 1. migrate_unregistered_athlete_to_profile: no colisionar al mover ──────
--
-- El UPDATE de enrollments movía TODA fila de la ficha sin preguntar si el
-- destino ya tenía una activa equivalente. Los índices únicos parciales
-- uq_enrollment_child_plan (child_id, offering_plan_id) y uq_enrollment_child_team
-- (child_id, team_id) —ambos WHERE status='active'— reventaban con 23505.
--
-- La fila que colisionaría se SALTA, no se cancela: cancelarla dispararía
-- trg_cancel_payments_on_enrollment_cancel y anularía cobros pendientes que
-- todavía no se migraron a la persona (los payments se mueven más abajo en esta
-- misma función). Saltarla es reversible y no toca dinero; queda contada en el
-- jsonb de retorno como `enrollments_omitidos` para que se pueda auditar.
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

-- Permisos idénticos a los que ya tenía: solo service_role (y el owner). NO se
-- expone a `authenticated`: se invoca desde RPCs SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_unregistered_athlete_to_profile(uuid, uuid, uuid) TO service_role;


-- ── 2. accept_invitation_pro: migrar la ficha ANTES de reconciliar ──────────
CREATE OR REPLACE FUNCTION public.accept_invitation_pro(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_invite             RECORD;
    v_user_email         text;
    v_child_id           uuid;
    v_role_id            uuid;
    v_staff_id           uuid;
    v_current_role       public.user_role;
    v_unregistered_id    uuid;
    v_migration_result   jsonb;
    v_enrollment_id      uuid;
    v_invite_offering_id uuid;
BEGIN
    SELECT LOWER(TRIM(email)) INTO v_user_email FROM auth.users WHERE id = auth.uid();
    SELECT role INTO v_current_role FROM public.profiles WHERE id = auth.uid();

    IF v_current_role IN ('admin', 'super_admin', 'school', 'school_admin', 'organizer') THEN
        RAISE EXCEPTION 'Las cuentas administrativas con rol % no pueden unirse a otras escuelas.', v_current_role;
    END IF;

    SELECT * INTO v_invite
    FROM public.invitations
    WHERE id = p_invite_id
      AND (email IS NULL OR LOWER(TRIM(email)) = v_user_email)
      AND status = 'pending';

    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM public.invitations WHERE id = p_invite_id AND status = 'accepted') THEN
            RETURN true;
        END IF;
        RAISE EXCEPTION 'Invitación no válida o ya procesada.';
    END IF;

    -- Oferta detrás del plan invitado, usada para evitar 2 enrollments activos
    -- en la misma oferta con planes distintos.
    IF v_invite.offering_plan_id IS NOT NULL THEN
        SELECT offering_id INTO v_invite_offering_id
        FROM public.offering_plans
        WHERE id = v_invite.offering_plan_id;
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_invite.role_to_assign LIMIT 1;
    UPDATE public.profiles
    SET role    = v_invite.role_to_assign::public.user_role,
        role_id = COALESCE(v_role_id, role_id)
    WHERE id = auth.uid();

    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id, invited_by)
    VALUES (v_invite.school_id, auth.uid(), v_invite.role_to_assign, 'active', v_invite.branch_id, v_invite.invited_by)
    ON CONFLICT (school_id, profile_id) DO UPDATE
        SET status    = 'active',
            role      = EXCLUDED.role,
            branch_id = COALESCE(school_members.branch_id, EXCLUDED.branch_id);

    -- ── Padres ────────────────────────────────────────────────────────────
    IF v_invite.role_to_assign = 'parent' AND v_invite.child_name IS NOT NULL THEN

        SELECT id INTO v_child_id
        FROM public.children
        WHERE parent_id = auth.uid()
          AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_invite.child_name))
          AND (school_id IS NULL OR school_id = v_invite.school_id)
        ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE LOWER(TRIM(parent_email_temp)) = v_user_email
              AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_invite.child_name))
              AND (school_id IS NULL OR school_id = v_invite.school_id)
            ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
            LIMIT 1;
        END IF;

        -- FIX 2026-09-09 — adopción por nombre NORMALIZADO entre los hijos del
        -- PROPIO acudiente. Las dos búsquedas de arriba usan LOWER(TRIM()), que
        -- no quita tildes, y la de abajo exige parent_id IS NULL (ficha libre de
        -- la escuela). Entre las dos quedaba un hueco: el hijo que el acudiente
        -- ya creó a mano con tildes —«Jacobo Sánchez Velásquez»— era invisible
        -- para la invitación que traía «Jacobo Sanchez Velasquez», y el ELSE de
        -- más abajo le insertaba una ficha nueva. Resultado: dos hijos para la
        -- misma persona, uno con el plan y otro con los documentos que subió el
        -- acudiente.
        IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE (parent_id = auth.uid()
                   OR LOWER(TRIM(COALESCE(parent_email_temp, ''))) = v_user_email)
              AND public.normalize_athlete_name(full_name)
                  = public.normalize_athlete_name(v_invite.child_name)
              AND (school_id IS NULL OR school_id = v_invite.school_id)
            ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END,
                     created_at ASC
            LIMIT 1;
        END IF;

        -- Adopcion por nombre NORMALIZADO en toda la escuela.
        --
        -- Solo adopta fichas LIBRES (parent_id IS NULL). Si ya tiene otro
        -- acudiente no toca nada: eso es un homonimo real o una disputa, y
        -- adivinar ahi es peor que duplicar.
        IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE school_id = v_invite.school_id
              AND parent_id IS NULL
              AND public.normalize_athlete_name(full_name)
                  = public.normalize_athlete_name(v_invite.child_name)
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF v_child_id IS NOT NULL THEN
            UPDATE public.children
            SET parent_id         = auth.uid(),
                school_id         = v_invite.school_id,
                branch_id         = COALESCE(branch_id, v_invite.branch_id),
                parent_email_temp = COALESCE(parent_email_temp, v_user_email),
                team_id           = COALESCE(team_id, v_invite.team_id)
            WHERE id = v_child_id;
        ELSE
            INSERT INTO public.children (
                parent_id, full_name, school_id, branch_id,
                parent_email_temp, team_id
            )
            VALUES (
                auth.uid(), v_invite.child_name, v_invite.school_id,
                v_invite.branch_id, v_user_email, v_invite.team_id
            )
            RETURNING id INTO v_child_id;
        END IF;

        -- FIX 2026-09-09 — la migración de la ficha precargada va ANTES de
        -- reconciliar la inscripción, no después.
        --
        -- Antes: el bloque de abajo insertaba una inscripción para el plan de la
        -- invitación y RECIÉN DESPUÉS esta migración le pasaba al hijo la
        -- inscripción que la ficha ya tenía con ESE MISMO plan → dos filas
        -- activas con el mismo (child_id, offering_plan_id) → 23505
        -- uq_enrollment_child_plan, y como la RPC es atómica se revertía todo:
        -- la invitación quedaba 'pending' y el acudiente no podía entrar nunca.
        --
        -- Ahora, al migrar primero, el caso (a) encuentra la fila que ya existe
        -- y no inserta nada. De paso sobrevive la fila ORIGINAL, con su
        -- start_date real y los cobros que ya colgaran de ella, en vez de una
        -- fila nueva con la fecha de hoy.
        SELECT id INTO v_unregistered_id
        FROM public.unregistered_athletes
        WHERE invitation_id = p_invite_id AND linked_profile_id IS NULL
        LIMIT 1;

        IF v_unregistered_id IS NULL THEN
            SELECT id INTO v_unregistered_id
            FROM public.unregistered_athletes
            WHERE LOWER(TRIM(email)) = v_user_email
              AND school_id = v_invite.school_id
              AND linked_profile_id IS NULL
            LIMIT 1;
        END IF;

        IF v_unregistered_id IS NOT NULL AND v_child_id IS NOT NULL THEN
            SELECT public.migrate_unregistered_athlete_to_profile(
                v_unregistered_id, NULL, v_child_id
            ) INTO v_migration_result;
        END IF;

        IF (v_invite.team_id IS NOT NULL OR v_invite.offering_plan_id IS NOT NULL) AND v_child_id IS NOT NULL THEN

            -- (a) ¿Ya hay una fila activa que cubra exactamente lo que trae la invitación?
            v_enrollment_id := NULL;
            SELECT id INTO v_enrollment_id
            FROM public.enrollments
            WHERE child_id = v_child_id
              AND school_id = v_invite.school_id
              AND status    = 'active'
              AND (v_invite.team_id          IS NULL OR team_id          = v_invite.team_id)
              AND (v_invite.offering_plan_id IS NULL OR offering_plan_id = v_invite.offering_plan_id)
            ORDER BY created_at
            LIMIT 1;

            IF v_enrollment_id IS NULL THEN
                -- (b) ¿Hay una activa a la que solo le falta ese dato? Completarla.
                SELECT id INTO v_enrollment_id
                FROM public.enrollments
                WHERE child_id = v_child_id
                  AND school_id = v_invite.school_id
                  AND status    = 'active'
                  AND (v_invite.team_id          IS NULL OR team_id          IS NULL)
                  AND (v_invite.offering_plan_id IS NULL OR offering_plan_id IS NULL)
                ORDER BY created_at
                LIMIT 1;

                IF v_enrollment_id IS NOT NULL THEN
                    UPDATE public.enrollments
                    SET team_id          = COALESCE(team_id, v_invite.team_id),
                        offering_plan_id = COALESCE(offering_plan_id, v_invite.offering_plan_id)
                    WHERE id = v_enrollment_id;
                ELSE
                    -- (c) ¿Ya tiene un enrollment activo en la MISMA oferta pero con otro plan?
                    --     Reemplazar el plan en vez de duplicar.
                    v_enrollment_id := NULL;
                    IF v_invite_offering_id IS NOT NULL THEN
                        SELECT e.id INTO v_enrollment_id
                        FROM public.enrollments e
                        JOIN public.offering_plans op ON op.id = e.offering_plan_id
                        WHERE e.child_id = v_child_id
                          AND e.school_id = v_invite.school_id
                          AND e.status = 'active'
                          AND op.offering_id = v_invite_offering_id
                        ORDER BY e.created_at
                        LIMIT 1;
                    END IF;

                    IF v_enrollment_id IS NOT NULL THEN
                        UPDATE public.enrollments
                        SET offering_plan_id = v_invite.offering_plan_id,
                            team_id          = COALESCE(v_invite.team_id, team_id)
                        WHERE id = v_enrollment_id;
                    ELSE
                        -- (d) Sin nada que completar ni reemplazar: recién ahí se crea.
                        INSERT INTO public.enrollments (
                            school_id, team_id, child_id, status, start_date, offering_plan_id
                        )
                        VALUES (
                            v_invite.school_id, v_invite.team_id, v_child_id,
                            'active', CURRENT_DATE, v_invite.offering_plan_id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    -- ── Atletas adultos ───────────────────────────────────────────────────
    -- Esta rama NO tenía el bug del 23505: su búsqueda de inscripción incluye
    -- las filas de la ficha (`OR unregistered_athlete_id = v_unregistered_id`),
    -- así que el caso (a) ya encontraba la existente en vez de insertar otra.
    -- Se deja tal cual para no cambiar un camino que hoy funciona.
    IF v_invite.role_to_assign = 'athlete' THEN

        SELECT id INTO v_unregistered_id
        FROM public.unregistered_athletes
        WHERE invitation_id = p_invite_id AND linked_profile_id IS NULL
        LIMIT 1;

        IF v_unregistered_id IS NULL THEN
            SELECT id INTO v_unregistered_id
            FROM public.unregistered_athletes
            WHERE LOWER(TRIM(email)) = v_user_email
              AND school_id = v_invite.school_id
              AND linked_profile_id IS NULL
            LIMIT 1;
        END IF;

        IF v_invite.team_id IS NOT NULL OR v_invite.offering_plan_id IS NOT NULL THEN

            v_enrollment_id := NULL;
            SELECT id INTO v_enrollment_id
            FROM public.enrollments
            WHERE (
                    user_id = auth.uid()
                    OR (v_unregistered_id IS NOT NULL AND unregistered_athlete_id = v_unregistered_id)
                  )
              AND school_id = v_invite.school_id
              AND status    = 'active'
              AND (v_invite.team_id          IS NULL OR team_id          = v_invite.team_id)
              AND (v_invite.offering_plan_id IS NULL OR offering_plan_id = v_invite.offering_plan_id)
            ORDER BY created_at
            LIMIT 1;

            IF v_enrollment_id IS NULL THEN
                SELECT id INTO v_enrollment_id
                FROM public.enrollments
                WHERE (
                        user_id = auth.uid()
                        OR (v_unregistered_id IS NOT NULL AND unregistered_athlete_id = v_unregistered_id)
                      )
                  AND school_id = v_invite.school_id
                  AND status    = 'active'
                  AND (v_invite.team_id          IS NULL OR team_id          IS NULL)
                  AND (v_invite.offering_plan_id IS NULL OR offering_plan_id IS NULL)
                ORDER BY created_at
                LIMIT 1;

                IF v_enrollment_id IS NOT NULL THEN
                    UPDATE public.enrollments
                    SET team_id          = COALESCE(team_id, v_invite.team_id),
                        offering_plan_id = COALESCE(offering_plan_id, v_invite.offering_plan_id)
                    WHERE id = v_enrollment_id;
                ELSE
                    -- ¿Ya tiene un enrollment activo en la MISMA oferta pero con otro plan?
                    -- Reemplazar el plan en vez de duplicar (evita el caso de dos
                    -- invitaciones distintas para la misma oferta quedando ambas activas).
                    v_enrollment_id := NULL;
                    IF v_invite_offering_id IS NOT NULL THEN
                        SELECT e.id INTO v_enrollment_id
                        FROM public.enrollments e
                        JOIN public.offering_plans op ON op.id = e.offering_plan_id
                        WHERE (
                                e.user_id = auth.uid()
                                OR (v_unregistered_id IS NOT NULL AND e.unregistered_athlete_id = v_unregistered_id)
                              )
                          AND e.school_id = v_invite.school_id
                          AND e.status = 'active'
                          AND op.offering_id = v_invite_offering_id
                        ORDER BY e.created_at
                        LIMIT 1;
                    END IF;

                    IF v_enrollment_id IS NOT NULL THEN
                        UPDATE public.enrollments
                        SET offering_plan_id = v_invite.offering_plan_id,
                            team_id          = COALESCE(v_invite.team_id, team_id)
                        WHERE id = v_enrollment_id;
                    ELSE
                        INSERT INTO public.enrollments (
                            school_id, team_id, user_id, status, start_date, offering_plan_id
                        )
                        VALUES (
                            v_invite.school_id, v_invite.team_id, auth.uid(),
                            'active', CURRENT_DATE, v_invite.offering_plan_id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;

        IF v_unregistered_id IS NOT NULL THEN
            SELECT public.migrate_unregistered_athlete_to_profile(
                v_unregistered_id, auth.uid(), NULL
            ) INTO v_migration_result;
        END IF;
    END IF;

    -- ── Coaches ───────────────────────────────────────────────────────────
    IF v_invite.role_to_assign = 'coach' THEN
        INSERT INTO public.school_staff (
            school_id, full_name, email, branch_id, coach_auth_id, status
        )
        SELECT v_invite.school_id, COALESCE(p.full_name, v_user_email),
               v_user_email, v_invite.branch_id, auth.uid(), 'active'
        FROM public.profiles p WHERE p.id = auth.uid()
        ON CONFLICT (email, school_id) DO UPDATE
            SET coach_auth_id = auth.uid(),
                status        = 'active',
                branch_id     = COALESCE(school_staff.branch_id, EXCLUDED.branch_id)
        RETURNING id INTO v_staff_id;

        IF v_invite.team_id IS NOT NULL AND v_staff_id IS NOT NULL THEN
            INSERT INTO public.team_coaches (team_id, coach_id, school_id)
            VALUES (v_invite.team_id, v_staff_id, v_invite.school_id)
            ON CONFLICT (team_id, coach_id) DO NOTHING;
        END IF;
    END IF;

    UPDATE public.invitations SET status = 'accepted' WHERE id = p_invite_id;
    RETURN true;
END;
$$;

-- Permisos: los mismos que ya tenía la función (la invoca el acudiente logueado).
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO service_role;

COMMIT;
