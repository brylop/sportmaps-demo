-- ============================================================
-- SPORTMAPS — UNA inscripción activa por atleta (plan manda, equipo = roster)
-- ------------------------------------------------------------
-- Caso Dynasty (2026-07-29): la escuela asigna un plan a un atleta que ya está
-- inscrito en su equipo y se abre una SEGUNDA inscripción activa (equipo sin
-- plan + plan sin equipo). Resultado: roster inflado, la vista y el motor de
-- cobros discrepan, y al aceptar la invitación se apila una tercera.
--
-- Origen doble:
--   1. BFF POST /api/v1/enrollments — insertaba siempre; sus guards solo miran
--      "¿ya está en ESTE equipo?" y "¿ya está en ESTE plan?" (arreglado aparte).
--   2. accept_invitation_pro — el guard comparaba plan/equipo con IS NOT
--      DISTINCT FROM, así que una invitación con team_id suelto nunca reconocía
--      la fila existente que ya traía equipo + plan.
--
-- Esta migración:
--   1. Reconcilia el drift: invitations.team_id / offering_plan_id.
--   2. claim_orphan_children — trim() además de lower() al comparar el correo.
--   3. accept_invitation_pro — completa la inscripción activa existente en vez
--      de insertar una segunda.
--   4. Fusiona las inscripciones ya partidas (equipo-solo + plan-solo).
--   5. Índice único parcial en invitations: mata la invitación pendiente repetida.
--      (enrollments NO necesita índices nuevos: ya tiene uq_enrollment_child_team,
--       uq_enrollment_child_plan y gemelos, todos parciales WHERE status='active'.
--       El caso equipo-solo + plan-solo no es "fila repetida", por eso pasaba.)
--
-- Migración nueva (timestamp posterior). Fecha: 2026-07-30
-- ============================================================

BEGIN;

-- ── 1. Drift: columnas que la función en BD ya usa y no estaban versionadas ──
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS team_id          uuid REFERENCES public.teams(id),
    ADD COLUMN IF NOT EXISTS offering_plan_id uuid REFERENCES public.offering_plans(id);


-- ── 2. claim_orphan_children: el correo pre-cargado puede traer espacios ─────
-- LOWER() sin TRIM() dejaba al hijo inadoptable para siempre si el CSV traía
-- " papa@correo.com". Hoy en Dynasty son 0 casos; el trim lo vuelve imposible.
CREATE OR REPLACE FUNCTION public.claim_orphan_children(p_school_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_email   text;
    v_count   int := 0;
BEGIN
    IF v_user_id IS NULL THEN RETURN 0; END IF;
    SELECT LOWER(TRIM(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;

    UPDATE public.children c
       SET parent_id  = v_user_id,
           updated_at = now()
     WHERE c.parent_id IS NULL
       AND LOWER(TRIM(c.parent_email_temp)) = v_email
       AND (p_school_id IS NULL OR c.school_id = p_school_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_orphan_children(uuid) TO authenticated;


-- ── 3. accept_invitation_pro: completar, no apilar ──────────────────────────
-- Base: la versión viva en BD (no versionada). Único cambio de fondo: los dos
-- bloques que creaban enrollments (menores y adultos) ahora buscan una fila
-- activa a la que solo le falte el dato que trae la invitación y la completan.
CREATE OR REPLACE FUNCTION public.accept_invitation_pro(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_invite            RECORD;
    v_user_email        text;
    v_child_id          uuid;
    v_role_id           uuid;
    v_staff_id          uuid;
    v_current_role      public.user_role;
    v_unregistered_id   uuid;
    v_migration_result  jsonb;
    v_enrollment_id     uuid;
BEGIN
    SELECT LOWER(TRIM(email)) INTO v_user_email FROM auth.users WHERE id = auth.uid();
    SELECT role INTO v_current_role FROM public.profiles WHERE id = auth.uid();

    IF v_current_role IN ('admin', 'super_admin', 'school', 'school_admin', 'organizer') THEN
        RAISE EXCEPTION 'Las cuentas administrativas con rol % no pueden unirse a otras escuelas.', v_current_role;
    END IF;

    -- Si la invitación no tiene email (solo teléfono), aceptar por ID únicamente
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

            -- (a) ¿Ya hay una fila activa que cubra lo que trae la invitación?
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
                    -- (c) Sin nada que completar: recién ahí se crea.
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
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO authenticated;


-- ── 4. Fusionar las inscripciones ya partidas ───────────────────────────────
-- Patrón exacto: el atleta tiene DOS activas en la misma escuela, una con
-- equipo y sin plan, otra con plan y sin equipo. Sobrevive la más antigua (la
-- del roster, a la que cuelga el historial) y absorbe el plan; la otra se
-- cancela. La cuota se conserva: gana el override no-cero que hubiera.
-- Se resuelve en un único DO: el editor SQL de Supabase ejecuta sentencia por
-- sentencia, así que una tabla temporal ON COMMIT DROP no sobrevive entre ellas.
-- Además el orden importa dentro de CADA par: ya existe uq_enrollment_child_plan
-- UNIQUE (child_id, offering_plan_id) WHERE status='active', así que primero hay
-- que cancelar la fila descartada y solo después pasarle el plan a la que queda,
-- o revienta con 23505.
DO $$
DECLARE
    r record;
    v_merged int := 0;
BEGIN
    FOR r IN
        SELECT team_row.id            AS keep_id,
               plan_row.id            AS drop_id,
               plan_row.offering_plan_id,
               plan_row.expires_at,
               GREATEST(COALESCE(team_row.sessions_used, 0),           COALESCE(plan_row.sessions_used, 0))           AS sessions_used,
               GREATEST(COALESCE(team_row.secondary_sessions_used, 0), COALESCE(plan_row.secondary_sessions_used, 0)) AS secondary_sessions_used,
               COALESCE(NULLIF(plan_row.monthly_fee, 0), NULLIF(team_row.monthly_fee, 0)) AS monthly_fee
        FROM public.enrollments team_row
        JOIN public.enrollments plan_row
          ON plan_row.child_id  = team_row.child_id
         AND plan_row.school_id = team_row.school_id
         AND plan_row.id       <> team_row.id
        WHERE team_row.child_id         IS NOT NULL
          AND team_row.status            = 'active'
          AND team_row.team_id          IS NOT NULL
          AND team_row.offering_plan_id IS NULL
          AND plan_row.status            = 'active'
          AND plan_row.team_id          IS NULL
          AND plan_row.offering_plan_id IS NOT NULL
          -- solo el caso limpio de exactamente dos filas activas
          AND (SELECT count(*) FROM public.enrollments e
                WHERE e.child_id = team_row.child_id
                  AND e.school_id = team_row.school_id
                  AND e.status = 'active') = 2
    LOOP
        -- 1) cancelar la descartada libera el índice parcial
        --    (conserva su offering_plan_id como registro de lo que pasó)
        UPDATE public.enrollments
           SET status   = 'cancelled',
               end_date = COALESCE(end_date, CURRENT_DATE)
         WHERE id = r.drop_id;

        -- 2) la fila del roster absorbe el plan
        UPDATE public.enrollments
           SET offering_plan_id        = r.offering_plan_id,
               expires_at              = COALESCE(expires_at, r.expires_at),
               sessions_used           = r.sessions_used,
               secondary_sessions_used = r.secondary_sessions_used,
               monthly_fee             = r.monthly_fee
         WHERE id = r.keep_id;

        v_merged := v_merged + 1;
    END LOOP;

    RAISE NOTICE 'Inscripciones partidas fusionadas: %', v_merged;
END $$;


-- ── 5. Índice anti-duplicado en invitaciones ────────────────────────────────
-- NO se agregan índices a `enrollments`: la tabla ya trae uq_enrollment_child_team,
-- uq_enrollment_child_plan, uq_enrollment_user_team, uq_enrollment_user_plan y sus
-- gemelos para unregistered_athletes, todos UNIQUE parciales WHERE status='active'.
-- Repetir el mismo equipo o el mismo plan ya era imposible. Lo que esas constraints
-- NO cubren es el caso equipo-solo + plan-solo (dos filas distintas, ninguna
-- repetida) — y eso no se arregla con un índice sino con la lógica de los puntos
-- 3 y 4 más el merge del BFF.

-- Invitación pendiente repetida (doble clic del admin). Solo 'pending': las ya
-- aceptadas históricas no se tocan.
-- Pre-limpieza: sin esto el índice no se puede crear si algún tenant ya tiene
-- pendientes duplicadas. Sobrevive la más reciente (la del último reenvío).
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY school_id, LOWER(TRIM(email)), role_to_assign,
                            LOWER(TRIM(COALESCE(child_name, '')))
               ORDER BY created_at DESC
           ) AS rn
    FROM public.invitations
    WHERE status = 'pending' AND email IS NOT NULL
)
UPDATE public.invitations i
   SET status = 'declined'
  FROM ranked r WHERE i.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invitations_pending_unique
    ON public.invitations (school_id, LOWER(TRIM(email)), role_to_assign, LOWER(TRIM(COALESCE(child_name, ''))))
    WHERE status = 'pending' AND email IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
