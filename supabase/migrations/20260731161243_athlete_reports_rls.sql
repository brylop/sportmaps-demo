-- =============================================================================
-- 20260731161243_athlete_reports_rls.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731161043
-- Objetivo: M2 del Informe Mensual — RLS de las 4 tablas de M1, más los helpers
--           que la hacen posible. SIN RPCs (van en M3/M4).
--
-- Spec: docs/specs/athlete-reports-module.md §9 y D19.
--
-- Quién ve qué:
--   · Padre / atleta adulto → solo informes 'publicado' de su hijo o suyos. Un
--     borrador NUNCA es visible para la familia.
--   · Coach → informes de cualquier atleta que entrene en alguno de SUS equipos
--     en el periodo, vía coach_can_see_report() — NO por athlete_reports.team_id,
--     que solo marca el equipo gobernante (D19). Sin esto, el coach del equipo no
--     gobernante no podía ver el informe DONDE VA SU PROPIA NOTA, y el atleta
--     compartido desaparecía de su tablero.
--   · Admin de escuela y super admin → todo lo de su ámbito.
--
-- §9.1 — NADIE hace UPDATE directo sobre athlete_reports. Las policies de Postgres
--   son por FILA, no por columna: «el coach actualiza solo coach_note» NO se puede
--   expresar con una policy, porque una de UPDATE le deja tocar status y snapshot.
--   M1 ya concedió solo SELECT; acá tampoco se crea policy de escritura. Toda
--   escritura entra por las RPCs de M3/M4.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito (SECURITY DEFINER no exime al caller de tenerlo).
--   · NUNCA revocar EXECUTE de los helpers al rol que las invoca desde policies:
--     rompe con 403 todas las queries de la tabla.
--   · Sin self-recursion: una policy sobre X no hace SELECT FROM X en su USING.
--     coach_can_see_report() SÍ lee athlete_reports, pero es SECURITY DEFINER —
--     salta la RLS, así que no vuelve a disparar la policy. Ese es justamente el
--     patrón que la regla prescribe, no una excepción a ella.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. current_staff_ids() — quién es el caller como STAFF ──────────────────
-- La identidad del coach en este repo NO es auth.uid() sino school_staff.id.
--
-- ⚠️ `school_staff.coach_auth_id` es el join correcto y **no está versionada**:
--   ninguna migración la agrega, solo aparece citada dentro del reporte de linter
--   de 20260503000007. Otra pieza de la misma deriva que M0. Por eso el cuerpo se
--   elige EN TIEMPO DE MIGRACIÓN: si la columna existe se usa (más el email como
--   red), y si no, solo email — el mismo criterio que ya usa user_school_ids()
--   desde 20260301000000.
--
--   El email como fallback no es gratis: un coach que cambia de correo perdería
--   la resolución. Es lo mejor disponible sin versionar la columna primero.
DO $$
DECLARE
    v_tiene_auth_id boolean;
    v_cuerpo        text;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'school_staff'
          AND column_name  = 'coach_auth_id'
    ) INTO v_tiene_auth_id;

    IF v_tiene_auth_id THEN
        v_cuerpo := $body$
            SELECT COALESCE(ARRAY(
                SELECT ss.id
                FROM public.school_staff ss
                WHERE ss.status = 'active'
                  AND (
                        ss.coach_auth_id = auth.uid()
                     OR LOWER(ss.email) = (SELECT LOWER(au.email) FROM auth.users au WHERE au.id = auth.uid())
                  )
            ), '{}'::uuid[]);
        $body$;
    ELSE
        v_cuerpo := $body$
            SELECT COALESCE(ARRAY(
                SELECT ss.id
                FROM public.school_staff ss
                WHERE ss.status = 'active'
                  AND LOWER(ss.email) = (SELECT LOWER(au.email) FROM auth.users au WHERE au.id = auth.uid())
            ), '{}'::uuid[]);
        $body$;
    END IF;

    EXECUTE format($sql$
        CREATE OR REPLACE FUNCTION public.current_staff_ids()
        RETURNS uuid[]
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public, pg_temp
        AS $fn$ %s $fn$;
    $sql$, v_cuerpo);
END $$;

COMMENT ON FUNCTION public.current_staff_ids() IS
    'school_staff.id del caller (puede tener varios: una fila por escuela). '
    'La identidad del coach no es auth.uid(). Helper de policies — no revocar EXECUTE.';

GRANT EXECUTE ON FUNCTION public.current_staff_ids() TO authenticated;


-- ─── 2. current_staff_team_ids() — sus equipos ───────────────────────────────
-- Cubre las dos vías: team_coaches (multi-coach, 20260224000032) y el legacy
-- teams.coach_id, que sigue poblado.
CREATE OR REPLACE FUNCTION public.current_staff_team_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(ARRAY(
        SELECT tc.team_id
        FROM public.team_coaches tc
        WHERE tc.coach_id = ANY (public.current_staff_ids())
        UNION
        SELECT t.id
        FROM public.teams t
        WHERE t.coach_id = ANY (public.current_staff_ids())
    ), '{}'::uuid[]);
$$;

COMMENT ON FUNCTION public.current_staff_team_ids() IS
    'Equipos que dirige el caller, por team_coaches y por el legacy teams.coach_id. '
    'Helper de policies — no revocar EXECUTE.';

GRANT EXECUTE ON FUNCTION public.current_staff_team_ids() TO authenticated;


-- ─── 3. coach_can_see_report() — D19 ─────────────────────────────────────────
-- ¿El caller entrena alguno de los equipos donde el sujeto del informe estuvo
-- inscrito DURANTE el periodo? Se resuelve por membresía real, no por
-- athlete_reports.team_id: ese solo dice cuál equipo manda la FECHA.
--
-- Se mantiene D17 sin tabla de relación: una función, no un esquema nuevo.
CREATE OR REPLACE FUNCTION public.coach_can_see_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH r AS (
        SELECT ar.school_id,
               ar.subject_type,
               ar.subject_id,
               make_date(ar.period_year, ar.period_month, 1)                          AS inicio,
               (make_date(ar.period_year, ar.period_month, 1)
                    + INTERVAL '1 month' - INTERVAL '1 day')::date                    AS fin
        FROM public.athlete_reports ar
        WHERE ar.id = p_report_id
    )
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e, r
        WHERE e.school_id = r.school_id
          AND e.team_id   = ANY (public.current_staff_team_ids())
          -- Solapamiento con el periodo, no «vigente hoy»: el informe de agosto
          -- lo escribe el coach que lo tuvo en agosto, aunque en octubre ya no.
          AND e.start_date <= r.fin
          AND (e.end_date IS NULL OR e.end_date >= r.inicio)
          -- Cast a text a propósito: la columna es enum en el esquema versionado
          -- y TEXT en la base real. Comparar con literal funciona en ambos.
          AND e.status::text <> 'cancelled'
          AND (
                (r.subject_type = 'child'        AND e.child_id                 = r.subject_id)
             OR (r.subject_type = 'profile'      AND e.user_id                  = r.subject_id)
             OR (r.subject_type = 'unregistered' AND e.unregistered_athlete_id  = r.subject_id)
          )
    );
$$;

COMMENT ON FUNCTION public.coach_can_see_report(uuid) IS
    'D19: el coach ve el informe de cualquier atleta que entrenó en alguno de sus '
    'equipos en el periodo, no solo del equipo gobernante. SECURITY DEFINER para '
    'evitar self-recursion en la policy de athlete_reports. No revocar EXECUTE.';

GRANT EXECUTE ON FUNCTION public.coach_can_see_report(uuid) TO authenticated;


-- ─── 4. Helper de admin, cubriendo la inconsistencia de los dos helpers ──────
-- `is_school_admin()` acepta owner/admin/super_admin y **NO** 'school_admin';
-- `is_school_admin_of()` (20260714000002) sí lo acepta. Si un dueño está guardado
-- en school_members como 'school_admin', el primero lo deja afuera. Se usan los
-- DOS en OR para no quedar del lado equivocado de esa diferencia, y sin tocar
-- ninguno de los dos: modificarlos rompería con 403 todo lo que ya los usa.
CREATE OR REPLACE FUNCTION public.can_manage_reports(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT public.is_super_admin()
        OR public.is_school_admin(p_school_id)
        OR public.is_school_admin_of(p_school_id);
$$;

COMMENT ON FUNCTION public.can_manage_reports(uuid) IS
    'Admin de la escuela para el módulo de informes. Usa is_school_admin Y '
    'is_school_admin_of porque sus listas de roles difieren en school_admin. '
    'Helper de policies — no revocar EXECUTE.';

GRANT EXECUTE ON FUNCTION public.can_manage_reports(uuid) TO authenticated;


-- ─── 5. Policies: athlete_reports ────────────────────────────────────────────
-- Solo SELECT. Ninguna de escritura, a propósito (§9.1).

DROP POLICY IF EXISTS athlete_reports_select_family ON public.athlete_reports;
CREATE POLICY athlete_reports_select_family
    ON public.athlete_reports
    FOR SELECT
    TO authenticated
    USING (
        status = 'publicado'
        AND (
              (subject_type = 'child'   AND public.is_parent_of_child(subject_id))
           OR (subject_type = 'profile' AND subject_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS athlete_reports_select_coach ON public.athlete_reports;
CREATE POLICY athlete_reports_select_coach
    ON public.athlete_reports
    FOR SELECT
    TO authenticated
    USING (public.coach_can_see_report(id));

DROP POLICY IF EXISTS athlete_reports_select_admin ON public.athlete_reports;
CREATE POLICY athlete_reports_select_admin
    ON public.athlete_reports
    FOR SELECT
    TO authenticated
    USING (public.can_manage_reports(school_id));


-- ─── 6. Policies: team_report_notes ──────────────────────────────────────────
-- Acá sí hay escritura directa del coach: es texto plano sin máquina de estados,
-- y la policy por fila (su equipo, su escuela) alcanza. Sin DELETE — M1 no lo
-- concedió: una nota no se borra, se reescribe.

DROP POLICY IF EXISTS team_report_notes_select ON public.team_report_notes;
CREATE POLICY team_report_notes_select
    ON public.team_report_notes
    FOR SELECT
    TO authenticated
    USING (
        team_id = ANY (public.current_staff_team_ids())
        OR public.can_manage_reports(school_id)
    );

DROP POLICY IF EXISTS team_report_notes_insert ON public.team_report_notes;
CREATE POLICY team_report_notes_insert
    ON public.team_report_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        team_id = ANY (public.current_staff_team_ids())
        OR public.can_manage_reports(school_id)
    );

DROP POLICY IF EXISTS team_report_notes_update ON public.team_report_notes;
CREATE POLICY team_report_notes_update
    ON public.team_report_notes
    FOR UPDATE
    TO authenticated
    USING (
        team_id = ANY (public.current_staff_team_ids())
        OR public.can_manage_reports(school_id)
    )
    WITH CHECK (
        team_id = ANY (public.current_staff_team_ids())
        OR public.can_manage_reports(school_id)
    );


-- ─── 7. Policies: report_team_schedule ───────────────────────────────────────
-- El coach necesita LEER qué día le toca; escribirlo es del admin.

DROP POLICY IF EXISTS report_team_schedule_select ON public.report_team_schedule;
CREATE POLICY report_team_schedule_select
    ON public.report_team_schedule
    FOR SELECT
    TO authenticated
    USING (school_id = ANY (public.user_school_ids()));

DROP POLICY IF EXISTS report_team_schedule_manage ON public.report_team_schedule;
CREATE POLICY report_team_schedule_manage
    ON public.report_team_schedule
    FOR ALL
    TO authenticated
    USING (public.can_manage_reports(school_id))
    WITH CHECK (public.can_manage_reports(school_id));


-- ─── 8. Policies: athlete_report_snapshots ───────────────────────────────────
-- Histórico de versiones congeladas. Solo el admin lo lee: a la familia se le
-- muestra la versión vigente, no el rastro de correcciones. Sin policies de
-- escritura — es append-only desde RPC, y M1 solo concedió SELECT.
--
-- No hay school_id en la tabla, así que el ámbito se resuelve por el informe
-- padre. Es SELECT sobre athlete_reports desde una policy de OTRA tabla, así que
-- no hay self-recursion.
DROP POLICY IF EXISTS athlete_report_snapshots_select_admin ON public.athlete_report_snapshots;
CREATE POLICY athlete_report_snapshots_select_admin
    ON public.athlete_report_snapshots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.athlete_reports ar
            WHERE ar.id = athlete_report_snapshots.report_id
              AND public.can_manage_reports(ar.school_id)
        )
    );

COMMIT;

-- =============================================================================
-- Repaso línea por línea, lo que hay que verificar al probar (§18 del spec):
--
--   1. Padre con hijo en la escuela → ve SOLO 'publicado' de SU hijo. Un
--      'borrador' del mismo hijo NO aparece. Otro niño de la escuela, tampoco.
--   2. Coach del equipo GOBERNANTE → ve el informe.
--   3. Coach del equipo NO gobernante (atleta compartido) → TAMBIÉN lo ve. Es el
--      caso que motivó D19 y el que fallaba resolviendo por team_id.
--   4. Coach de un tercer equipo, sin ese atleta → NO lo ve.
--   5. Coach que tuvo al atleta en agosto pero ya no en octubre → SÍ ve el
--      informe de AGOSTO (el solapamiento es con el periodo, no con hoy).
--   6. Admin de la escuela → ve todo lo suyo; de otra escuela, nada.
--   7. authenticated NO puede UPDATE athlete_reports ni con SQL directo: no hay
--      grant (M1) ni policy (acá). Debe fallar por privilegio, no por policy.
--   8. Dueño guardado como 'school_admin' en school_members → puede administrar,
--      vía can_manage_reports (es lo que is_school_admin sola no cubre).
--
-- Pendiente relacionado, NO resuelto acá: versionar school_staff.coach_auth_id.
-- Mientras no exista en migraciones, current_staff_ids() cae al email en una base
-- limpia y un coach que cambie de correo pierde la resolución. Va en migración
-- aparte, junto con el resto de la deriva.
-- =============================================================================
