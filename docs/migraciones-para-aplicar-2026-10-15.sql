-- =============================================================================
-- Las 3 migraciones de multirol y multisede (2026-10-15), en orden, para pegar UNA
-- vez en el SQL Editor de Supabase. Cada una se probó en la base viva dentro de una
-- transacción que terminó en ROLLBACK; nada está aplicado todavía.
--
-- Todo va en UNA transacción: si algo falla, no se aplica nada. Al final se anotan
-- en supabase_migrations.schema_migrations para que quede el rastro.
--
--   1. 20261014212620_contextos_familia_invitaciones
--        Aceptar una invitación de familia ya no pisa el rol de staff ni el de
--        familia que la persona ya tiene; la ficha propia se vincula solo si el
--        nombre también coincide; lista blanca de roles al invitar.
--   2. 20261014212627_sede_del_atleta_por_equipo
--        La sede de un atleta es la de su equipo (con respaldo en la ficha) en la
--        vista school_athletes y al abrir el mes; las categorías de Monster sin
--        sede pasan a Suba.
--   3. 20261014215112_staff_no_se_reactiva_ni_cambia_de_escuela
--        Un miembro del staff ya no puede reactivarse ni mudarse de escuela
--        editando su propia ficha (trigger).
--
-- Después de aplicar:  npm run seguridad:invariantes   (debe seguir en 0 críticas)
-- Las fuentes inmutables están en supabase/migrations/; este archivo es la copia
-- para aplicar de una vez.
-- =============================================================================

BEGIN;


-- ▼▼▼ 20261014212620_contextos_familia_invitaciones.sql ▼▼▼

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

-- ▲▲▲ fin 20261014212620_contextos_familia_invitaciones.sql ▲▲▲

-- ▼▼▼ 20261014212627_sede_del_atleta_por_equipo.sql ▼▼▼

-- =============================================================================
-- 20261014212627_sede_del_atleta_por_equipo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014212620
-- Objetivo: S2 (y el backfill de S3) de docs/specs/multisede-selector-y-sede-del-atleta.md.
--   Regla ÚNICA de sede del atleta: la del EQUIPO de la inscripción; si no
--   tiene, la de la ficha (children.branch_id / unregistered_athletes.branch_id).
--   Base: definiciones VIVAS al 2026-10-14; solo cambia la expresión de sede.
--
--   1. Vista school_athletes (security_invoker se mantiene):
--      · niño con cuenta: COALESCE(equipo, c.branch_id, sede única). Antes
--        ignoraba el equipo. El nombre de la sede sale del mismo id (JOIN).
--      · adulto con cuenta: sin cambios (ya era equipo → membresía → única).
--      · ficha: COALESCE(equipo, ua.branch_id, sede única). El nombre pasa de
--        subconsulta escalar a LEFT JOIN (una activación de RLS menos por fila).
--      Sin subconsultas correlacionadas nuevas: la sede del equipo viaja en el
--      LATERAL de equipo que ya existía (patrón del fix 57014).
--   2. open_month y preview_open_month: payments.branch_id y el filtro
--      p_branch_id usan COALESCE(t.branch_id, c.branch_id, ua.branch_id).
--      Antes era COALESCE(c.branch_id, t.branch_id) y nunca usaba ua.branch_id.
--   3. _confirm_overage_into_payment (cobros_f1): la misma regla.
--      NO se toca _plan_charge_operation (56 KB): ya incluye ua.branch_id pero
--      prioriza la ficha sobre el equipo (COALESCE(v_branch, team_branch)).
--      Queda pendiente para una migración propia.
--   4. Backfill acotado:
--      · school_categories de Monster's Volley Club con sede NULL (13, las de
--        Suba) → Sede Suba.
--      · payments con sede NULL cuyo team_id apunta a un equipo de la MISMA
--        escuela con sede: 79 filas en 7 escuelas al 2026-10-14. Las demás
--        (~2.900 sin equipo) no se deducen sin ambigüedad y no se tocan.
--        Los triggers de payments que corren en UPDATE solo reaccionan a
--        cambios de status/monto; este UPDATE solo cambia branch_id.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================


-- ── 1. Vista school_athletes ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true) AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(te.team_branch_id, c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE COALESCE(c.monthly_fee, 0::numeric)
            END
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.email, c.parent_email_temp)
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.phone, c.parent_phone_temp)
        END AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    c.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN school_branches b ON b.id = COALESCE(te.team_branch_id, c.branch_id)
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(c.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = c.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(c.school_id) THEN NOT (COALESCE(c.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]), false) OR (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.child_id = c.id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[])))))
                    ELSE false
                END AS hide_contact) hc ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    sm.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(sm.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = sm.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(sm.school_id) THEN NOT (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]))))
                    ELSE false
                END AS hide_contact) hc ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(te.team_branch_id, ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.phone
        END AS parent_phone,
    COALESCE(bua.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    ua.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN school_branches bua ON bua.id = COALESCE(te.team_branch_id, ua.branch_id)
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(ua.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = ua.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN coach_contact_masked_school(ua.school_id) THEN NOT (EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND (e.team_id = ANY ((( SELECT user_coached_team_ids() AS user_coached_team_ids))::uuid[]))))
                    ELSE false
                END AS hide_contact) hc ON true
  WHERE ua.linked_profile_id IS NULL;

-- ── 2. open_month / preview_open_month ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_created          int := 0;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );
  -- FIX 2026-10-05 (H-01): un cobro NUEVO nunca nace vencido. Si el corte del
  -- mes ya pasó (el cron abre el mes en curso todos los días, y una escuela que
  -- pone precio el 8 con corte el 1 recibía cobros vencidos esa misma noche), el
  -- vencimiento pasa a hoy + días de gracia: la MISMA regla que billingDue
  -- (bff/src/services/enrollmentBilling.ts) y qr_first_charge_due_date. El
  -- PERIODO no cambia: sigue siendo p_year/p_month.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  -- 20261014212627 (S2): sede = la del EQUIPO de la inscripción; si no hay,
  -- la de la ficha (children.branch_id / unregistered_athletes.branch_id).
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(t.branch_id, c.branch_id, ua.branch_id)                             AS branch_id,
      c.parent_id,
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount,
      fee.sibling_discount_applied                                   AS sibling_discount_applied
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(t.branch_id, c.branch_id, ua.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- 20261007095911: tampoco artículos, torneo, clase extra, vacacional
          -- ni viaje (cobros sueltos de servicio, ventas por WhatsApp).
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category, sibling_discount_applied
    )
    SELECT
      el.school_id, el.branch_id, el.parent_id, el.child_id, el.user_id,
      el.unregistered_athlete_id, el.team_id, el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount, v_due, 'pending', 'subscription',
      p_year::smallint, p_month::smallint, 'mensualidad', el.sibling_discount_applied
    FROM elegibles el
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date',  v_due, 'generados', v_created
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.preview_open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_items            jsonb;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));
  -- Mismo piso que open_month (FIX 2026-10-05, H-01): lo que se previsualiza es
  -- lo que se emite.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  -- 20261014212627 (S2): mismo filtro de sede que open_month.
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount,
      fee.sibling_discount_applied                                 AS sibling_discount_applied
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(t.branch_id, c.branch_id, ua.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- F2 hermanos escalonado (20261013192955): misma lista que open_month
          -- (20261007095911) para que lo previsualizado sea lo que se emite.
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'sibling_discount_applied', el.sibling_discount_applied,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO service_role;

-- ── 3. _confirm_overage_into_payment (interna: solo service_role) ───────────
CREATE OR REPLACE FUNCTION public._confirm_overage_into_payment(p_id uuid, p_actor uuid, p_amount numeric DEFAULT NULL::numeric, p_due_date date DEFAULT NULL::date, p_batch_id uuid DEFAULT NULL::uuid, p_payment_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_row        public.hour_bank_overage_charges%ROWTYPE;
  v_period     record;
  v_enr        record;
  v_payment_id uuid;
  v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_months     text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
BEGIN
  SELECT * INTO v_row
    FROM public.hour_bank_overage_charges
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.status <> 'suggested' THEN
    RETURN jsonb_build_object('error', 'not_suggested', 'status', v_row.status,
                              'payment_id', v_row.payment_id);
  END IF;
  IF COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT period_start INTO v_period
    FROM public.hour_bank_periods WHERE id = v_row.period_id;

  -- Mismo armado de pagador que open_month: parent_id = acudiente del menor;
  -- el adulto paga como user_id; el no registrado queda sin parent_id.
  SELECT e.child_id, e.user_id, e.unregistered_athlete_id, e.team_id,
         c.parent_id,
         -- 20261014212627 (S2): sede del equipo; si no, la de la ficha.
         COALESCE(t.branch_id, c.branch_id, ua.branch_id) AS branch_id
    INTO v_enr
    FROM public.enrollments e
    LEFT JOIN public.children c ON c.id = e.child_id
    LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams    t ON t.id = e.team_id
   WHERE e.id = v_row.enrollment_id;

  INSERT INTO public.payments (
    id,
    school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
    team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
    payment_category, period_year, period_month, period_uniqueness_exempt,
    charge_batch_id, created_by, notes
  ) VALUES (
    COALESCE(p_payment_id, gen_random_uuid()),
    v_row.school_id,
    v_enr.branch_id,
    v_enr.parent_id,
    v_enr.child_id,
    v_enr.user_id,
    v_enr.unregistered_athlete_id,
    v_enr.team_id,
    NULL,                                   -- sin plan: no extiende vigencia (B3)
    COALESCE(p_amount, v_row.amount),
    format('Horas por encima del plan — %s %s — %s h × $%s',
           v_months[extract(month FROM v_period.period_start)::int],
           extract(year FROM v_period.period_start)::int,
           public.hour_bank_fmt_es(v_row.billable_hours),
           public.hour_bank_fmt_es(v_row.hourly_rate)),
    COALESCE(p_due_date, v_today + 5),      -- decisión usuario 2026-10-05
    'pending',
    'one_time',
    'excedente',                            -- requiere F-A (CHECK)
    extract(year  FROM v_period.period_start)::smallint,
    extract(month FROM v_period.period_start)::smallint,
    true,                                   -- convive con la mensualidad del mes
    p_batch_id,
    CASE WHEN p_batch_id IS NOT NULL THEN p_actor END,
    p_notes
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.hour_bank_overage_charges
     SET status     = 'confirmed',
         payment_id = v_payment_id,
         decided_by = p_actor,
         decided_at = now(),
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('payment_id', v_payment_id);
END;
$function$;

REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text) TO service_role;

-- ── 4. Backfill acotado ─────────────────────────────────────────────────────
-- 4a. Categorías de Suba (Monster's Volley Club) sin sede → Sede Suba.
UPDATE public.school_categories
   SET branch_id = '531a2df9-dab4-47bb-a1cf-5a904b276c46'
 WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   AND branch_id IS NULL;

-- 4b. Cobros sin sede cuyo equipo (de la misma escuela) sí la tiene.
UPDATE public.payments p
   SET branch_id = t.branch_id
  FROM public.teams t
  JOIN public.school_branches sb ON sb.id = t.branch_id
 WHERE p.branch_id IS NULL
   AND p.team_id   = t.id
   AND t.school_id = p.school_id
   AND sb.school_id = p.school_id;

-- ▲▲▲ fin 20261014212627_sede_del_atleta_por_equipo.sql ▲▲▲

-- ▼▼▼ 20261014215112_staff_no_se_reactiva_ni_cambia_de_escuela.sql ▼▼▼

-- =============================================================================
-- 20261014215112_staff_no_se_reactiva_ni_cambia_de_escuela.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014212627
-- Objetivo: que un miembro del staff, editando SU PROPIA ficha de school_staff,
--           no pueda reactivarse ni mudarse a otra escuela.
-- =============================================================================
-- El agujero (hallado el 2026-10-14 al auditar contextos de rol):
--
--   La policy "Staff manage themselves" (20260814184728) es:
--     FOR UPDATE TO authenticated
--     USING      (email = auth.email())
--     WITH CHECK (email = auth.email() AND school_id = ANY (user_school_ids()))
--
--   user_school_ids() incluye escuelas donde la persona es solo PADRE o ATLETA.
--   Un ex-coach (fila 'inactive') que además es acudiente en otra escuela podía
--   hacer UPDATE de su propia fila a status='active' y school_id = esa escuela.
--   Como user_staff_school_ids() resuelve staff por school_staff (incluso por
--   correo), eso le daba permisos de STAFF en una escuela donde nadie se los dio.
--
-- Por qué un trigger y no otra policy: RLS no puede comparar OLD con NEW. La
-- policy se deja (puede haber clientes que actualicen datos de contacto de su
-- ficha), pero los campos que definen QUIÉN es staff y DÓNDE quedan inmutables
-- para el propio interesado. Quien administra la escuela de la fila
-- (user_admin_school_ids) y los procesos sin JWT (service_role del BFF, SQL)
-- siguen pudiendo cambiarlos.
--
-- Verificado antes de escribir esto: el frontend no hace UPDATE de school_staff
-- en ningún lado; el BFF (bff/src/routes/school-staff.ts) usa service_role.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.school_staff_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Sin usuario (service_role del BFF, migraciones, SQL): no aplica.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Administración de la escuela de la fila: puede cambiar todo, como hoy.
  IF OLD.school_id = ANY (public.user_admin_school_ids()) THEN
    RETURN NEW;
  END IF;

  IF NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Solo la administración de la escuela puede cambiar la escuela, la sede, el estado o el correo de una ficha de staff'
      USING ERRCODE = '42501';
  END IF;

  -- coach_auth_id: solo se puede VINCULAR a uno mismo (de NULL a auth.uid()).
  IF NEW.coach_auth_id IS DISTINCT FROM OLD.coach_auth_id
     AND NOT (OLD.coach_auth_id IS NULL AND NEW.coach_auth_id = auth.uid()) THEN
    RAISE EXCEPTION 'No se puede cambiar la cuenta vinculada a esta ficha de staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.school_staff_guard_self_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_school_staff_guard_self_update ON public.school_staff;
CREATE TRIGGER trg_school_staff_guard_self_update
  BEFORE UPDATE ON public.school_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.school_staff_guard_self_update();

-- ▲▲▲ fin 20261014215112_staff_no_se_reactiva_ni_cambia_de_escuela.sql ▲▲▲

-- Rastro en el registro de migraciones
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261014212620', 'contextos_familia_invitaciones'),
  ('20261014212627', 'sede_del_atleta_por_equipo'),
  ('20261014215112', 'staff_no_se_reactiva_ni_cambia_de_escuela')
ON CONFLICT (version) DO NOTHING;

COMMIT;
