-- Migration: fix_accept_invitation_pro_offering_dedup_and_payment_cancel_scope
-- Applied to Supabase project: luebjarufsiadojhvxgi (brylop's Project)
-- Date: 2026-07-30
--
-- Contexto: la atleta Ana Amaya (escuela VOLK FIT CLUB) terminó con 2
-- enrollments activos (SCALE + INITIATION) para la misma oferta CROSSFIT,
-- porque el dueño de la escuela generó dos invitaciones distintas (una por
-- plan) y ambas terminaron aceptadas. accept_invitation_pro() no tenía
-- ningún chequeo de "ya existe un enrollment activo en esta oferta" antes
-- de insertar uno nuevo, así que creó un duplicado en vez de reemplazar el
-- plan. Al cancelar el duplicado, además se descubrió que el trigger
-- fn_cancel_payments_on_enrollment_cancel cancela TODOS los pagos pendientes
-- del atleta en la escuela (sin filtrar por plan), así que de paso canceló
-- el pago legítimo del enrollment que sí debía quedar activo.
--
-- Este archivo corrige ambas funciones.

-- ============================================================================
-- Fix 1: accept_invitation_pro
-- ============================================================================
-- Bug: si un atleta/hijo ya tiene un enrollment ACTIVO en una escuela, y se
-- acepta una segunda invitación para la MISMA oferta pero con un plan
-- DISTINTO (ej: dos invitaciones creadas con minutos de diferencia para
-- "INITIATION" y "SCALE" dentro de la misma oferta CrossFit), la función
-- solo reutilizaba un enrollment existente si coincidía exactamente el
-- offering_plan_id o si el enrollment tenía el plan en NULL. En cualquier
-- otro caso caía al INSERT y creaba un enrollment duplicado.
--
-- Fix: antes de insertar, se agrega un paso que busca un enrollment activo
-- en la MISMA oferta (vía offering_plans.offering_id) y, si lo encuentra,
-- le reemplaza el plan en vez de crear una fila nueva. Se aplicó tanto en
-- la rama de "padres/hijos" como en la de "atletas adultos".

CREATE OR REPLACE FUNCTION public.accept_invitation_pro(p_invite_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    END IF;

    -- ── Atletas adultos ───────────────────────────────────────────────────
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
