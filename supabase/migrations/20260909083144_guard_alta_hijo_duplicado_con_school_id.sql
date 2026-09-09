-- =============================================================================
-- 20260909083144_guard_alta_hijo_duplicado_con_school_id.sql
-- Autor: brylop   Fecha: 2026-09-09   Versión anterior: 20260909080429
-- Objetivo: cerrar la costura por la que todavía entra un atleta duplicado —
--           el alta manual del acudiente que SÍ manda `school_id`.
-- =============================================================================
-- ── La costura ──────────────────────────────────────────────────────────────
-- Sobre `public.children` hay dos guards y entre los dos queda un hueco:
--
--   trg_bloquear_atleta_duplicado (17-ago)  cubre school_id NO nulo, pero
--       exige documento, o nombre + fecha de nacimiento IDÉNTICA.
--   trg_guard_alta_manual_hijo_duplicado (20260909080429)  cubre school_id
--       NULL, y le basta el nombre normalizado.
--
-- Por el medio pasa: `school_id` puesto + sin documento + fecha que no empata.
-- `ChildSelectorModal` inserta exactamente así — `full_name`, `date_of_birth`
-- (que por defecto pone HOY), `parent_id` y `school_id` — o sea que el camino
-- de "Inscribir / Pagar" es hoy la vía limpia para crear la segunda identidad
-- facturable del mismo atleta. El resultado es el de
-- [[project_duplicate_athlete_identities]]: la ficha vieja tiene el dinero, la
-- nueva nace del alta manual, y la cuota se duplica en la siguiente apertura de
-- mes.
--
-- Así que el guard deja de exigir `school_id IS NULL`: aplica a TODO insert con
-- `parent_id` puesto. Sigue exento lo que no tiene `parent_id` — las fichas que
-- crea la escuela y las cargas masivas del BFF con `service_role` (ver
-- `bff/src/routes/students.ts` y `students-create-one.route.ts`, que insertan
-- con `parent_id` nulo y el correo del acudiente en `parent_email_temp`).
--
-- ── Por qué hace falta una bandera de sesión y no un discriminador por datos ─
-- `public.accept_invitation_pro(uuid)`, cuando no encuentra ficha que adoptar,
-- inserta en `children` con `parent_id = auth.uid()` y `school_id =
-- v_invite.school_id`: la MISMA forma exacta que el insert del cliente. Y lo
-- hace mientras la invitación todavía está en `status = 'pending'` (recién la
-- marca 'accepted' en la última línea de la RPC), así que la comprobación (b)
-- del guard —"¿este atleta viene en una invitación pendiente tuya?"— le pega
-- SIEMPRE. No hay ningún dato en la fila insertada que permita distinguir la
-- aceptación legítima del alta manual: ni el rol, ni el correo, ni el
-- `parent_email_temp`, ni la ausencia de columnas. La migración anterior evitó
-- el problema usando `school_id IS NULL` como discriminador, y eso es
-- justamente lo que dejó la costura abierta.
--
-- De ahí las dos piezas de esta migración, que van juntas o no van:
--
--   1. `accept_invitation_pro` marca su propio insert con
--      `set_config('sportmaps.alta_hijo_desde_rpc','on', true)`. El tercer
--      parámetro `true` la hace LOCAL a la transacción, así que no se filtra a
--      otra sesión ni sobrevive al commit; y se apaga en la línea siguiente al
--      INSERT para que tampoco alcance a nada más dentro de la misma
--      transacción.
--   2. El guard sale temprano si la ve en 'on', leyéndola con
--      `current_setting('sportmaps.alta_hijo_desde_rpc', true)` — el segundo
--      parámetro `true` es obligatorio: sin él, `current_setting` revienta con
--      42704 en toda sesión donde la variable nunca se definió, o sea en el
--      99% de los inserts.
--
-- Esto NO es una puerta que pueda abrir el cliente: `set_config` de una
-- variable de sesión no viaja en el JSON de PostgREST, y para colarla haría
-- falta ejecutar SQL arbitrario en la sesión — quien pueda eso ya no necesita
-- saltarse un trigger.
--
-- ── El riesgo que se estaba corriendo hoy ───────────────────────────────────
-- Si el alcance se extendiera SIN esta exención, se rompe la aceptación de
-- invitaciones de CLUB DEPORTIVO BESSER, que justo hoy quedó destrabada y tiene
-- 68 acudientes por entrar: cada aceptación que llega a la rama del INSERT
-- moriría con el mensaje "ese atleta ya viene cargado en la invitación de…",
-- la RPC es atómica, y la invitación se quedaría 'pending' para siempre. Es el
-- mismo modo de falla del 23505 que se arregló hace un rato, con otra causa.
--
-- ── Consecuencia conocida, dejada a propósito ───────────────────────────────
-- `public.submit_qr_signup__interno` también inserta con `parent_id` +
-- `school_id` en su rama "(c) crear de cero", y NO lleva la bandera. Queda
-- sujeta al guard, y eso es lo que se quiere: si llega ahí es porque su match
-- por documento y por correo no encontró nada, y si el guard igual detecta al
-- mismo atleta por nombre normalizado en la cuenta del acudiente, ESE insert es
-- un duplicado. La RPC ya levanta excepciones con mensaje para el acudiente, así
-- que el comportamiento es consistente con lo que esa pantalla ya muestra.
--
-- SECURITY DEFINER en el guard porque necesita leer `invitations` completo:
-- como `authenticated`, la RLS puede esconderle justo la invitación con la que
-- hay que comparar, y un guard que a veces no ve nada no es un guard.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PIEZA 1 — accept_invitation_pro marca su insert.
--
-- Copia literal de la definición VIVA (la base es la fuente de verdad; hay
-- deriva contra el repo). Lo único que cambia respecto de lo que corre hoy son
-- las dos líneas de `set_config` que rodean el `INSERT INTO public.children`
-- de la rama de padres, señaladas con "FIX 2026-09-09 (bandera)". Todo lo demás
-- —ramas de parent / athlete / coach, orden de la migración de la ficha,
-- reconciliación de enrollments (a)(b)(c)(d)— queda idéntico.
-- ─────────────────────────────────────────────────────────────────────────────
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
            -- FIX 2026-09-09 (bandera) — este INSERT tiene la MISMA forma que el
            -- alta manual del acudiente (parent_id + school_id) y ocurre con la
            -- invitación todavía 'pending', así que
            -- fn_guard_alta_manual_hijo_duplicado lo tomaría por un duplicado y
            -- mataría la aceptación entera. No hay dato en la fila que permita
            -- distinguirlos: se marca la operación explícitamente. `true` la deja
            -- local a la transacción, y se apaga enseguida para no cubrir nada más.
            PERFORM set_config('sportmaps.alta_hijo_desde_rpc', 'on', true);

            INSERT INTO public.children (
                parent_id, full_name, school_id, branch_id,
                parent_email_temp, team_id
            )
            VALUES (
                auth.uid(), v_invite.child_name, v_invite.school_id,
                v_invite.branch_id, v_user_email, v_invite.team_id
            )
            RETURNING id INTO v_child_id;

            PERFORM set_config('sportmaps.alta_hijo_desde_rpc', 'off', true);
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
$function$;

-- La ACL sobrevive a CREATE OR REPLACE, pero se reafirma explícita porque es
-- la RPC que llama el acudiente al aceptar (authenticated) y el BFF cuando
-- acepta en su nombre (service_role).
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_pro(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PIEZA 2 — el guard deja de exigir school_id NULL y respeta la bandera.
--
-- Cambia respecto de 20260909080429:
--   · sale temprano si la bandera está en 'on' (la aceptación de invitaciones);
--   · el corte pasa de `parent_id IS NOT NULL AND school_id IS NULL` a
--     `parent_id IS NOT NULL`, con lo que las dos comprobaciones (a) y (b)
--     ahora también alcanzan al alta con school_id puesto —la costura—;
--   · las comprobaciones (a) y (b) en sí quedan idénticas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_alta_manual_hijo_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_nombre        text;
    v_email         text;
    v_ya_en_cuenta  text;
    v_en_invitacion text;
BEGIN
    -- Exentos por construcción: las fichas que crea la escuela y las cargas
    -- masivas del BFF con service_role, que no traen acudiente todavía.
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Exenta la aceptación de invitaciones. accept_invitation_pro inserta con
    -- parent_id + school_id —idéntico al alta manual— y con la invitación
    -- todavía 'pending', así que la comprobación (b) le pegaría siempre y
    -- mataría la aceptación entera (la RPC es atómica). No hay ningún dato en
    -- la fila que permita distinguirla: la RPC se identifica con esta bandera.
    -- El segundo parámetro `true` de current_setting evita el 42704 en las
    -- sesiones donde la variable nunca se definió, que son casi todas.
    IF COALESCE(current_setting('sportmaps.alta_hijo_desde_rpc', true), 'off') = 'on' THEN
        RETURN NEW;
    END IF;

    v_nombre := public.normalize_athlete_name(NEW.full_name);
    IF v_nombre IS NULL THEN
        RETURN NEW;
    END IF;

    -- (a) ¿Ya lo tiene en la cuenta?
    SELECT c.full_name INTO v_ya_en_cuenta
    FROM public.children c
    WHERE c.parent_id = NEW.parent_id
      AND c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND public.normalize_athlete_name(c.full_name) = v_nombre
    LIMIT 1;

    IF v_ya_en_cuenta IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya tienes a % en tu cuenta. Si querías agregar a otro hijo, escribe su nombre completo.',
            v_ya_en_cuenta;
    END IF;

    -- (b) ¿Viene en una invitación que todavía no aceptó?
    SELECT LOWER(TRIM(u.email)) INTO v_email FROM auth.users u WHERE u.id = NEW.parent_id;

    IF v_email IS NOT NULL THEN
        SELECT s.name INTO v_en_invitacion
        FROM public.invitations i
        JOIN public.schools s ON s.id = i.school_id
        WHERE i.status = 'pending'
          AND i.role_to_assign = 'parent'
          AND LOWER(TRIM(i.email)) = v_email
          AND i.child_name IS NOT NULL
          AND public.normalize_athlete_name(i.child_name) = v_nombre
          -- Acotado a la escuela del alta cuando la hay. Sin esto, una
          -- invitación pendiente de la escuela A bloquea el alta del mismo
          -- atleta en la escuela B, y eso rompería el QR de inscripción, que
          -- está vivo en 6 escuelas y también inserta con parent_id +
          -- school_id (submit_qr_signup__interno, que NO lleva la bandera).
          -- Cuando school_id viene NULL no hay con qué comparar, así que ahí
          -- sigue pesando cualquier invitación pendiente: es el alta manual
          -- del acudiente, el caso que originó todo esto.
          AND (NEW.school_id IS NULL OR i.school_id = NEW.school_id)
        LIMIT 1;

        IF v_en_invitacion IS NOT NULL THEN
            RAISE EXCEPTION
                'Ese atleta ya viene cargado en la invitación de %, con su plan y su equipo. Acepta la invitación desde tu inicio en vez de registrarlo a mano: si lo creas, queda duplicado.',
                v_en_invitacion;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_alta_manual_hijo_duplicado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_guard_alta_manual_hijo_duplicado() FROM anon;

-- El trigger ya existe con esta misma forma desde 20260909080429; se recrea
-- para que la migración sea autosuficiente si se aplica sobre una base donde
-- esa no dejó rastro (ver "El registro de migraciones NO dice qué está
-- aplicado" en CLAUDE.md).
DROP TRIGGER IF EXISTS trg_guard_alta_manual_hijo_duplicado ON public.children;
CREATE TRIGGER trg_guard_alta_manual_hijo_duplicado
    BEFORE INSERT ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_guard_alta_manual_hijo_duplicado();

COMMIT;
