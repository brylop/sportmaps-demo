-- =============================================================================
-- 20261014212620_contextos_familia_invitaciones.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014212441
-- Objetivo: F0 de docs/specs/cambio-de-rol-atleta-acudiente.md (D3, D4 y
--   «Antes de exponer contextos»). Una persona puede ser staff y familia a la
--   vez sin que aceptar una invitación le pise el rol.
--
--   1. accept_invitation_pro (base: definición VIVA al 2026-10-14, cambio mínimo)
--      · D3: una invitación de familia (parent/athlete) nunca modifica una fila
--        de staff activa en school_members ni baja profiles.role desde un rol de
--        staff/escuela/negocio. parent que acepta athlete (o al revés) conserva
--        su rol; profiles.role solo se fija si está vacío, needs_role_selection,
--        o el rol de familia actual no tiene datos que lo respalden.
--      · D3: ya no se rechaza a perfiles school/school_admin cuando la
--        invitación es de familia (admin + atleta, admin + acudiente). Para
--        invitaciones de staff el rechazo sigue igual.
--      · D4: la rama atleta que adopta la ficha por correo del usuario exige
--        también que coincida el nombre (normalize_athlete_name, como la rama
--        del acudiente).
--      · Lista blanca del rol invitado: parent, athlete, coach, reporter,
--        accountant, school_admin. school_admin solo si lo invitó el dueño.
--   2. create_invitation: la misma lista blanca de p_role; school_admin solo lo
--      invita el dueño de la escuela o un admin de plataforma.
--
--   HALLAZGO que motiva la lista blanca: create_invitation no filtraba p_role e
--   invitations admite INSERT directo por RLS (user_admin_school_ids). Hoy
--   'admin'/'super_admin' ya los frena trg_profiles_guard_role (regla 2) y
--   'owner'/'staff'/'viewer' fallan al castear a user_role, pero un school_admin
--   SÍ podía invitar a otro school_admin (delegar el permiso de otorgar
--   permisos). Datos al 2026-10-14: la única invitación school_admin, las 3
--   reporter y las 43 coach las creó el dueño (radio 0). La pendiente con rol
--   'guest' (1) ya fallaba al aceptarse; ahora falla con un mensaje claro.
--
--   AUDITORÍA (solo lectura, sin cambios aquí) de user_staff_school_ids(): la
--   rama por email da staff a quien tenga en auth.users el mismo correo que una
--   fila activa de school_staff con coach_auth_id NULL. Ver el reporte de la
--   sesión 2026-10-14; queda para una migración aparte.
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

-- ── 1. accept_invitation_pro ────────────────────────────────────────────────
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
    v_role               text;
    v_child_name         text;
    v_ficha_id           uuid;
    v_ficha_name         text;
    v_ficha              public.unregistered_athletes%ROWTYPE;
    -- 20261014212620 (D3/D4)
    v_es_familia         boolean;
    v_needs_role         boolean;
    v_my_name            text;
    v_fijar_rol          boolean;
BEGIN
    SELECT LOWER(TRIM(email)) INTO v_user_email FROM auth.users WHERE id = auth.uid();
    SELECT role, COALESCE(needs_role_selection, false), full_name
      INTO v_current_role, v_needs_role, v_my_name
      FROM public.profiles WHERE id = auth.uid();

    -- 20261014212620 (D3): school / school_admin ya NO se rechazan aquí; solo
    -- se rechazan más abajo si la invitación es de STAFF. Una invitación de
    -- familia (admin que además juega o es acudiente) sí se puede aceptar.
    IF v_current_role IN ('admin', 'super_admin', 'organizer') THEN
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

    v_role       := v_invite.role_to_assign;

    -- 20261014212620 — lista blanca del rol que una invitación puede otorgar.
    -- La tabla invitations admite INSERT directo por RLS (user_admin_school_ids)
    -- y create_invitation no filtraba p_role: sin esto, una invitación con
    -- role_to_assign 'admin' / 'super_admin' terminaba en profiles.role de
    -- PLATAFORMA. «Si un permiso permite otorgar permisos, no se delega»:
    -- school_admin solo lo otorga el dueño de la escuela.
    IF v_role IS NULL OR v_role NOT IN ('parent', 'athlete', 'coach', 'reporter', 'accountant', 'school_admin') THEN
        RAISE EXCEPTION 'Esta invitación tiene un rol que no se puede otorgar (%).', v_role
            USING ERRCODE = '42501';
    END IF;
    IF v_role = 'school_admin' AND NOT (
           EXISTS (SELECT 1 FROM public.schools s
                    WHERE s.id = v_invite.school_id AND s.owner_id = v_invite.invited_by)
        OR EXISTS (SELECT 1 FROM public.school_members m
                    WHERE m.school_id = v_invite.school_id AND m.profile_id = v_invite.invited_by
                      AND m.role = 'owner' AND m.status = 'active')
    ) THEN
        RAISE EXCEPTION 'Solo el dueño de la escuela puede invitar administradores.'
            USING ERRCODE = '42501';
    END IF;
    v_child_name := NULLIF(TRIM(COALESCE(v_invite.child_name, '')), '');

    -- FIX 2026-10-05 (H-04) — invitación de "atleta" para la ficha de un MENOR:
    -- el que la acepta es su acudiente. Se acepta como 'parent' y la niña queda
    -- como hijo vinculado. Cubre las pendientes creadas antes del fix.
    IF v_role = 'athlete' THEN
        SELECT ua.id, ua.full_name INTO v_ficha_id, v_ficha_name
          FROM public.unregistered_athletes ua
         WHERE ua.invitation_id = p_invite_id
           AND ua.school_id = v_invite.school_id
           AND ua.linked_profile_id IS NULL
         LIMIT 1;
        IF v_ficha_id IS NOT NULL
           AND public._invitacion_ficha_es_de_acudiente(v_ficha_id, COALESCE(v_invite.email, v_user_email)) THEN
            v_role       := 'parent';
            v_child_name := COALESCE(v_child_name, v_ficha_name);
        END IF;
    END IF;

    -- Oferta detrás del plan invitado, usada para evitar 2 enrollments activos
    -- en la misma oferta con planes distintos.
    IF v_invite.offering_plan_id IS NOT NULL THEN
        SELECT offering_id INTO v_invite_offering_id
        FROM public.offering_plans
        WHERE id = v_invite.offering_plan_id;
    END IF;

    v_es_familia := v_role IN ('parent', 'athlete');

    -- 20261014212620 (D3): una cuenta de escuela sigue sin poder entrar como
    -- staff de OTRA escuela (regla previa), pero sí como familia.
    IF NOT v_es_familia AND v_current_role IN ('school', 'school_admin') THEN
        RAISE EXCEPTION 'Las cuentas administrativas con rol % no pueden unirse a otras escuelas.', v_current_role;
    END IF;

    -- 20261014212620 (D3): profiles.role es el contexto por defecto, no un
    -- permiso. Una invitación de STAFF lo fija como antes. Una de FAMILIA solo
    -- lo fija si está vacío / pendiente de elegir, o si el rol actual es de
    -- familia y no tiene datos que lo respalden (un perfil nuevo nace 'athlete'
    -- por defecto, sin inscripciones). Nunca baja un rol de staff, escuela o
    -- negocio: la familia se deduce de children y enrollments.
    v_fijar_rol := NOT v_es_familia
        OR v_current_role IS NULL
        OR v_needs_role
        OR (v_current_role = 'athlete'
            AND NOT EXISTS (SELECT 1 FROM public.enrollments e
                             WHERE e.user_id = auth.uid() AND e.status = 'active')
            AND NOT EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                             WHERE ua.linked_profile_id = auth.uid()))
        OR (v_current_role = 'parent'
            AND NOT EXISTS (SELECT 1 FROM public.children ch
                             WHERE ch.parent_id = auth.uid()));

    IF v_fijar_rol THEN
        SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_role LIMIT 1;
        UPDATE public.profiles
        SET role    = v_role::public.user_role,
            role_id = COALESCE(v_role_id, role_id)
        WHERE id = auth.uid();
    END IF;

    -- 20261014212620 (D3): una invitación de familia NUNCA modifica una fila de
    -- staff (owner/admin/school_admin/coach/reporter/accountant/staff/super_admin)
    -- salvo que esté 'inactive' (no otorga nada). Sobre una fila de familia
    -- activa conserva el rol que ya tenía (parent que acepta athlete sigue parent).
    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id, invited_by)
    VALUES (v_invite.school_id, auth.uid(), v_role, 'active', v_invite.branch_id, v_invite.invited_by)
    ON CONFLICT (school_id, profile_id) DO UPDATE
        SET status    = 'active',
            role      = CASE
                            WHEN v_es_familia
                             AND school_members.role IN ('parent', 'athlete')
                             AND school_members.status = 'active'
                            THEN school_members.role
                            ELSE EXCLUDED.role
                        END,
            branch_id = COALESCE(school_members.branch_id, EXCLUDED.branch_id)
        WHERE NOT (
                v_es_familia
            AND school_members.role IN ('owner', 'admin', 'school_admin', 'coach', 'reporter',
                                        'accountant', 'staff', 'super_admin')
            AND school_members.status <> 'inactive'
        );

    -- ── Padres ────────────────────────────────────────────────────────────
    IF v_role = 'parent' THEN

        -- FIX 2026-10-05 (H-03) — la ficha se resuelve PRIMERO y con el correo
        -- del ACUDIENTE. Antes solo se miraba unregistered_athletes.email (el
        -- correo del atleta) y la invitación masiva —sin id de ficha— creaba un
        -- hijo nuevo mientras la ficha seguía viva y cobrando.
        v_unregistered_id := NULL;

        -- (1) La ficha que la escuela vinculó al invitar.
        SELECT id INTO v_unregistered_id
        FROM public.unregistered_athletes
        WHERE invitation_id = p_invite_id AND linked_profile_id IS NULL
        LIMIT 1;

        IF v_unregistered_id IS NULL AND v_child_name IS NOT NULL THEN
            -- (2) Correo del ACUDIENTE + nombre del niño (hermanos: mismo correo,
            --     el nombre los separa).
            SELECT id INTO v_unregistered_id
            FROM public.unregistered_athletes
            WHERE school_id = v_invite.school_id
              AND linked_profile_id IS NULL
              AND LOWER(TRIM(COALESCE(guardian_email, ''))) = v_user_email
              AND public.normalize_athlete_name(full_name) = public.normalize_athlete_name(v_child_name)
            ORDER BY is_active DESC, created_at ASC
            LIMIT 1;

            -- (3) Correo del ATLETA + nombre (el acudiente usó el correo del niño
            --     como propio — 25 de 87 menores en Monster).
            IF v_unregistered_id IS NULL THEN
                SELECT id INTO v_unregistered_id
                FROM public.unregistered_athletes
                WHERE school_id = v_invite.school_id
                  AND linked_profile_id IS NULL
                  AND LOWER(TRIM(COALESCE(email, ''))) = v_user_email
                  AND public.normalize_athlete_name(full_name) = public.normalize_athlete_name(v_child_name)
                ORDER BY is_active DESC, created_at ASC
                LIMIT 1;
            END IF;
        END IF;

        -- (4) Legado: solo por correo del atleta, y SOLO si no hay ambigüedad
        --     (con dos hermanas que comparten correo, adivinar cuál es peor que
        --     no vincular: se quedaba con la primera y la otra se duplicaba).
        IF v_unregistered_id IS NULL THEN
            SELECT (array_agg(id))[1] INTO v_unregistered_id
            FROM public.unregistered_athletes
            WHERE LOWER(TRIM(email)) = v_user_email
              AND school_id = v_invite.school_id
              AND linked_profile_id IS NULL
            HAVING count(*) = 1;
        END IF;

        IF v_unregistered_id IS NOT NULL THEN
            SELECT * INTO v_ficha FROM public.unregistered_athletes WHERE id = v_unregistered_id;
            v_child_name := COALESCE(v_child_name, v_ficha.full_name);
        END IF;

        IF v_child_name IS NOT NULL THEN

            SELECT id INTO v_child_id
            FROM public.children
            WHERE parent_id = auth.uid()
              AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_child_name))
              AND (school_id IS NULL OR school_id = v_invite.school_id)
            ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
            LIMIT 1;

            IF v_child_id IS NULL THEN
                SELECT id INTO v_child_id
                FROM public.children
                WHERE LOWER(TRIM(parent_email_temp)) = v_user_email
                  AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_child_name))
                  AND (school_id IS NULL OR school_id = v_invite.school_id)
                ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
                LIMIT 1;
            END IF;

            -- FIX 2026-09-09 — adopción por nombre NORMALIZADO entre los hijos del
            -- PROPIO acudiente (tildes: «Jacobo Sánchez» vs «Jacobo Sanchez»).
            IF v_child_id IS NULL THEN
                SELECT id INTO v_child_id
                FROM public.children
                WHERE (parent_id = auth.uid()
                       OR LOWER(TRIM(COALESCE(parent_email_temp, ''))) = v_user_email)
                  AND public.normalize_athlete_name(full_name)
                      = public.normalize_athlete_name(v_child_name)
                  AND (school_id IS NULL OR school_id = v_invite.school_id)
                ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END,
                         created_at ASC
                LIMIT 1;
            END IF;

            -- Adopción por nombre NORMALIZADO en toda la escuela, solo fichas
            -- LIBRES (parent_id IS NULL). Con otro acudiente no se toca: homónimo
            -- real o disputa, y adivinar ahí es peor que duplicar.
            IF v_child_id IS NULL THEN
                SELECT id INTO v_child_id
                FROM public.children
                WHERE school_id = v_invite.school_id
                  AND parent_id IS NULL
                  AND public.normalize_athlete_name(full_name)
                      = public.normalize_athlete_name(v_child_name)
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
                -- Bandera local a la transacción: este INSERT tiene la forma del
                -- alta manual del acudiente y fn_guard_alta_manual_hijo_duplicado
                -- lo mataría (ver FIX 2026-09-09).
                PERFORM set_config('sportmaps.alta_hijo_desde_rpc', 'on', true);

                -- FIX 2026-10-05 — el hijo nace con los datos de su ficha: es la
                -- MISMA persona, no un registro nuevo con solo el nombre.
                INSERT INTO public.children (
                    parent_id, full_name, school_id, branch_id,
                    parent_email_temp, team_id,
                    date_of_birth, doc_type, doc_number, gender, blood_type, eps_name,
                    parent_name_temp, parent_phone_temp
                )
                VALUES (
                    auth.uid(), v_child_name, v_invite.school_id,
                    COALESCE(v_invite.branch_id, v_ficha.branch_id), v_user_email, v_invite.team_id,
                    v_ficha.date_of_birth, v_ficha.doc_type, v_ficha.doc_number, v_ficha.gender,
                    v_ficha.blood_type, v_ficha.eps_name,
                    v_ficha.guardian_full_name, COALESCE(v_ficha.guardian_phone, v_invite.parent_phone)
                )
                RETURNING id INTO v_child_id;

                PERFORM set_config('sportmaps.alta_hijo_desde_rpc', 'off', true);
            END IF;

            -- FIX 2026-09-09 — la migración de la ficha va ANTES de reconciliar la
            -- inscripción (si no, 23505 uq_enrollment_child_plan y rollback total).
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
    END IF;

    -- ── Atletas adultos ───────────────────────────────────────────────────
    IF v_role = 'athlete' THEN

        SELECT id INTO v_unregistered_id
        FROM public.unregistered_athletes
        WHERE invitation_id = p_invite_id AND linked_profile_id IS NULL
        LIMIT 1;

        -- 20261014212620 (D4): por correo SOLO si además coincide el nombre
        -- (mismo criterio normalizado que la rama del acudiente). Un adulto que
        -- usa el mismo correo que la ficha de su hijo ya no la adopta como propia.
        IF v_unregistered_id IS NULL THEN
            SELECT id INTO v_unregistered_id
            FROM public.unregistered_athletes
            WHERE LOWER(TRIM(email)) = v_user_email
              AND school_id = v_invite.school_id
              AND linked_profile_id IS NULL
              AND public.normalize_athlete_name(full_name) IN (
                    public.normalize_athlete_name(NULLIF(TRIM(COALESCE(v_my_name, '')), '')),
                    public.normalize_athlete_name(v_child_name))
            ORDER BY is_active DESC, created_at ASC
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
    IF v_role = 'coach' THEN
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

    -- Queda registrado con el rol con que realmente se aceptó.
    UPDATE public.invitations
       SET status         = 'accepted',
           role_to_assign = v_role,
           child_name     = COALESCE(child_name, v_child_name)
     WHERE id = p_invite_id;
    RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_invitation_pro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation_pro(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO service_role;

-- ── 2. create_invitation (envoltorio; create_invitation__interno no cambia) ──
CREATE OR REPLACE FUNCTION public.create_invitation(p_email text DEFAULT NULL::text, p_role text DEFAULT 'parent'::text, p_child_name text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_monthly_fee numeric DEFAULT NULL::numeric, p_parent_phone text DEFAULT NULL::text, p_branch_id uuid DEFAULT NULL::uuid, p_offering_plan_id uuid DEFAULT NULL::uuid, p_unregistered_athlete_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_school_id  uuid;
    v_role       text := p_role;
    v_child_name text := p_child_name;
    v_ficha_name text;
BEGIN
    -- 20261014212620 — lista blanca de p_role. Antes cualquier admin de escuela
    -- podía invitar con 'admin' / 'super_admin' / 'owner' (accept_invitation_pro
    -- copiaba 'admin'/'super_admin' a profiles.role). school_admin otorga
    -- permisos: solo el dueño (o un admin de plataforma) lo invita.
    -- accept_invitation_pro repite el control porque invitations admite INSERT
    -- directo por RLS.
    IF p_role IS NULL OR p_role NOT IN ('parent', 'athlete', 'coach', 'reporter', 'accountant', 'school_admin') THEN
        RAISE EXCEPTION 'No se puede invitar con el rol %.', COALESCE(p_role, '(vacío)')
            USING ERRCODE = '42501';
    END IF;

    -- Misma resolución que la función original, no una aproximación: si acá se
    -- resolviera distinto, el guard mediría una escuela y la función escribiría
    -- en otra.
    SELECT school_id INTO v_school_id
      FROM public.school_members
     WHERE profile_id = auth.uid()
       AND role IN ('owner', 'admin', 'super_admin', 'school_admin')
       AND status = 'active'
     LIMIT 1;

    IF v_school_id IS NULL THEN
        SELECT id INTO v_school_id
          FROM public.schools
         WHERE owner_id = auth.uid()
         LIMIT 1;
    END IF;

    IF p_role = 'school_admin' AND NOT public.is_super_admin() AND NOT (
           EXISTS (SELECT 1 FROM public.schools s
                    WHERE s.id = v_school_id AND s.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.school_members m
                    WHERE m.school_id = v_school_id AND m.profile_id = auth.uid()
                      AND m.role = 'owner' AND m.status = 'active')
    ) THEN
        RAISE EXCEPTION 'Solo el dueño de la escuela puede invitar administradores.'
            USING ERRCODE = '42501';
    END IF;

    IF v_school_id IS NOT NULL AND NOT public.school_is_operational(v_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede enviar invitaciones nuevas.'
            USING ERRCODE = '42501';
    END IF;

    -- Ficha de ESTA escuela: el invitado de un menor es su acudiente.
    IF p_unregistered_athlete_id IS NOT NULL AND v_school_id IS NOT NULL THEN
        SELECT ua.full_name INTO v_ficha_name
          FROM public.unregistered_athletes ua
         WHERE ua.id = p_unregistered_athlete_id
           AND ua.school_id = v_school_id;

        IF v_ficha_name IS NOT NULL THEN
            IF v_role = 'athlete'
               AND public._invitacion_ficha_es_de_acudiente(p_unregistered_athlete_id, p_email) THEN
                v_role := 'parent';
            END IF;
            -- child_name es la clave con la que accept_invitation_pro nombra/busca
            -- al hijo y parte de la clave única de la pendiente (dos hermanas = dos
            -- invitaciones al mismo correo).
            IF v_role IN ('parent', 'athlete') AND NULLIF(TRIM(COALESCE(v_child_name, '')), '') IS NULL THEN
                v_child_name := v_ficha_name;
            END IF;
        END IF;
    END IF;

    -- Si no resolvió escuela, NO se decide acá: delega, para que el mensaje sea
    -- el de la función original.
    RETURN public.create_invitation__interno(
        p_email, v_role, v_child_name, p_team_id, p_monthly_fee,
        p_parent_phone, p_branch_id, p_offering_plan_id, p_unregistered_athlete_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO service_role;

COMMIT;
