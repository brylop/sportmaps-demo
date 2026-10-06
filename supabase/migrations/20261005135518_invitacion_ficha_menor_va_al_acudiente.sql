-- =============================================================================
-- 20261005135518_invitacion_ficha_menor_va_al_acudiente.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005133939
-- Objetivo: que invitar a la familia de una ficha sin cuenta (unregistered_athletes)
--   ADOPTE esa ficha —mismo atleta, misma inscripción, mismos cobros— y que el
--   invitado de un MENOR sea siempre su ACUDIENTE (rol parent), nunca un "atleta".
--   Hallazgos H-03 y H-04 de docs/qa/monster-prelanzamiento-2026-10-05.md.
-- =============================================================================
--
-- 1. create_invitation tenía DOS sobrecargas (8 y 9 argumentos, todos con
--    DEFAULT). Cualquier llamada con 8 o menos argumentos con nombre —la de la
--    invitación masiva manda 7— es ambigua en Postgres (42725) y PostgREST
--    responde PGRST203: la invitación masiva fallaba ENTERA. La de 8 era solo un
--    envoltorio que delegaba en la de 9 con NULL, así que se elimina: toda
--    llamada vieja resuelve a la de 9 con el mismo resultado.
--
-- 2. create_invitation (9 args): si trae p_unregistered_athlete_id de una ficha
--    MENOR y rol 'athlete', se registra como invitación al ACUDIENTE ('parent').
--    El diálogo individual mandaba role=athlete para TODA ficha (aunque fuera de
--    una niña de 9 años) y al aceptarla el perfil de la mamá quedaba role=athlete,
--    las fichas de las hermanas pasaban a SU user_id y open_month (DISTINCT ON
--    user_id) emitía un solo cobro por dos niñas a nombre de la mamá.
--
-- 3. accept_invitation_pro:
--    a. Misma regla al aceptar (cubre las invitaciones 'athlete' de menores que ya
--       están pendientes en la viva, creadas antes de este fix).
--    b. Rama parent: resuelve la ficha ANTES de buscar/crear el hijo, por
--       invitation_id → correo del ACUDIENTE + nombre → correo del atleta + nombre
--       → (legado) correo del atleta si hay UNA sola ficha con ese correo. Antes
--       solo miraba unregistered_athletes.email, que es el correo DEL ATLETA: en
--       Monster 62 de 87 menores tienen otro correo que su acudiente, así que la
--       invitación masiva (que no mandaba el id) creaba un hijo nuevo, dejaba la
--       ficha viva y open_month cobraba dos veces a la misma niña.
--    c. El hijo que se crea a partir de la ficha hereda su documento, fecha de
--       nacimiento, género, RH y EPS (antes nacía solo con el nombre, y el guard de
--       duplicados ya no lo podía reconocer como la misma persona).
--
-- Regla "menor": fecha de nacimiento conocida y < 18 años; si la ficha no tiene
-- fecha, se toma como invitación al acudiente cuando el correo invitado es el
-- guardian_email de la ficha y NO el correo del propio atleta. Un adulto sigue
-- invitándose como atleta (M03).
--
-- Pruebas: supabase/tests/monster_cobros/M01, M02, M03 (npm run qa:sql).
-- =============================================================================

BEGIN;

-- ── 1. Fuera la sobrecarga ambigua ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid);

-- ── Helper interno: ¿la invitación de esta ficha es en realidad para su acudiente?
CREATE OR REPLACE FUNCTION public._invitacion_ficha_es_de_acudiente(
    p_unregistered_athlete_id uuid,
    p_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE((
        SELECT CASE
                 WHEN ua.date_of_birth IS NOT NULL
                   THEN ua.date_of_birth > ((now() AT TIME ZONE 'America/Bogota')::date - interval '18 years')::date
                 ELSE NULLIF(LOWER(TRIM(COALESCE(p_email, ''))), '') IS NOT NULL
                      AND LOWER(TRIM(p_email)) = LOWER(TRIM(COALESCE(ua.guardian_email, '')))
                      AND LOWER(TRIM(p_email)) IS DISTINCT FROM LOWER(TRIM(COALESCE(ua.email, '')))
               END
          FROM public.unregistered_athletes ua
         WHERE ua.id = p_unregistered_athlete_id
    ), false);
$$;

REVOKE ALL ON FUNCTION public._invitacion_ficha_es_de_acudiente(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._invitacion_ficha_es_de_acudiente(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._invitacion_ficha_es_de_acudiente(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._invitacion_ficha_es_de_acudiente(uuid, text) TO service_role;

-- ── 2. create_invitation (la única que queda) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email text DEFAULT NULL::text,
    p_role text DEFAULT 'parent'::text,
    p_child_name text DEFAULT NULL::text,
    p_team_id uuid DEFAULT NULL::uuid,
    p_monthly_fee numeric DEFAULT NULL::numeric,
    p_parent_phone text DEFAULT NULL::text,
    p_branch_id uuid DEFAULT NULL::uuid,
    p_offering_plan_id uuid DEFAULT NULL::uuid,
    p_unregistered_athlete_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school_id  uuid;
    v_role       text := p_role;
    v_child_name text := p_child_name;
    v_ficha_name text;
BEGIN
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
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO authenticated, service_role;

-- ── 3. accept_invitation_pro ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation_pro(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

    v_role       := v_invite.role_to_assign;
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

    SELECT id INTO v_role_id FROM public.roles WHERE LOWER(name) = v_role LIMIT 1;
    UPDATE public.profiles
    SET role    = v_role::public.user_role,
        role_id = COALESCE(v_role_id, role_id)
    WHERE id = auth.uid();

    INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id, invited_by)
    VALUES (v_invite.school_id, auth.uid(), v_role, 'active', v_invite.branch_id, v_invite.invited_by)
    ON CONFLICT (school_id, profile_id) DO UPDATE
        SET status    = 'active',
            role      = EXCLUDED.role,
            branch_id = COALESCE(school_members.branch_id, EXCLUDED.branch_id);

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
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO authenticated, service_role;

COMMIT;
