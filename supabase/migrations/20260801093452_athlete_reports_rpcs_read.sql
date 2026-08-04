-- =============================================================================
-- 20260801093452_athlete_reports_rpcs_read.sql
-- Autor: brylop   Fecha: 2026-08-01   Versión anterior: 20260731183142
-- Objetivo: M4 del Informe Mensual — lectura, medición y adopción.
--
-- Spec: docs/specs/athlete-reports-module.md §10 y §10.2.
-- Plan: docs/plan-f1-informes-backend.md §1.
--
-- Funciones:
--   _report_attended_subjects       helper de asistencia (cuerpo según deriva)
--   mark_report_viewed              viewed_at + view_count, solo el destinatario
--   report_coverage                 los buckets del tablero (§10.2)
--   adopt_reports_on_child_link     trigger: al vincular acudiente (F6)
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC. SECURITY DEFINER NO exime al caller.
--
-- §10.1 — LA AUTORIZACIÓN VA DENTRO DE CADA FUNCIÓN, SIN EXCEPCIÓN.
--   El caso que la spec marca como el más fácil de subestimar es justo de acá:
--   `mark_report_viewed` sin check interno deja a cualquier autenticado marcar
--   informes ajenos adivinando UUIDs. Y como `viewed_at` gobierna la cascada de
--   §7.1, eso además SUPRIME el correo de otra familia — no es solo un fallo de
--   integridad, es de disponibilidad.
-- =============================================================================
-- DERIVA DE ESQUEMA — por qué el helper de asistencia se construye en runtime
--
--   Los buckets `sin_mediciones_con_asistencia` y `sin_actividad` (§10.2) leen
--   `attendance_records`. El esquema VERSIONADO de esa tabla (20260217000001)
--   tiene un solo eje de sujeto: `child_id NOT NULL`. La base real tiene además
--   `user_id` y `unregistered_athlete_id`, que ninguna migración crea — la misma
--   deriva que motivó D-G.
--
--   Escribirlo contra las columnas reales funcionaría hoy y reventaría en una
--   base limpia; escribirlo contra las versionadas dejaría a los atletas adultos
--   fuera del tablero en la base real. Se usa el patrón que ya aplica M2 en
--   `current_staff_ids()`: el cuerpo se decide EN LA MIGRACIÓN según el catálogo.
--   Toda la fealdad queda en un helper y `report_coverage` es una función normal.
--
--   Es un parche, no una solución: lo correcto es la migración de regularización
--   consolidada (plan §1, «inventario de deriva»). Cuando exista, este helper se
--   reescribe plano.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. _report_attended_subjects — quién pisó el gimnasio en el periodo ─────
-- Devuelve (subject_type, subject_id) de los que tienen AL MENOS un registro de
-- asistencia efectiva en el rango. 'absent' no cuenta: el bucket que importa es
-- «vino y nadie lo midió», no «lo marcaron ausente».
DO $$
DECLARE
    v_tiene_user  boolean;
    v_tiene_unreg boolean;
    v_ramas       text;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'attendance_records'
           AND column_name  = 'user_id'
    ) INTO v_tiene_user;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'attendance_records'
           AND column_name  = 'unregistered_athlete_id'
    ) INTO v_tiene_unreg;

    -- La rama de menores existe siempre: child_id está en el esquema versionado.
    v_ramas := $rama$
        SELECT DISTINCT 'child'::text, ar.child_id
          FROM public.attendance_records ar
         WHERE ar.school_id = p_school_id
           AND ar.attendance_date BETWEEN p_inicio AND p_fin
           AND ar.status::text IN ('present','late','justified')
           AND ar.child_id IS NOT NULL
    $rama$;

    IF v_tiene_user THEN
        v_ramas := v_ramas || $rama$
        UNION
        SELECT DISTINCT 'profile'::text, ar.user_id
          FROM public.attendance_records ar
         WHERE ar.school_id = p_school_id
           AND ar.attendance_date BETWEEN p_inicio AND p_fin
           AND ar.status::text IN ('present','late','justified')
           AND ar.user_id IS NOT NULL
        $rama$;
    END IF;

    IF v_tiene_unreg THEN
        v_ramas := v_ramas || $rama$
        UNION
        SELECT DISTINCT 'unregistered'::text, ar.unregistered_athlete_id
          FROM public.attendance_records ar
         WHERE ar.school_id = p_school_id
           AND ar.attendance_date BETWEEN p_inicio AND p_fin
           AND ar.status::text IN ('present','late','justified')
           AND ar.unregistered_athlete_id IS NOT NULL
        $rama$;
    END IF;

    EXECUTE format($sql$
        CREATE OR REPLACE FUNCTION public._report_attended_subjects(
            p_school_id uuid, p_inicio date, p_fin date
        )
        RETURNS TABLE (subject_type text, subject_id uuid)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public, pg_temp
        AS $fn$ %s $fn$;
    $sql$, v_ramas);
END $$;

COMMENT ON FUNCTION public._report_attended_subjects(uuid, date, date) IS
    'Sujetos con asistencia efectiva (present/late/justified) en el rango. El '
    'cuerpo se arma en la migración según qué ejes de sujeto tenga '
    'attendance_records en esta base — la tabla versionada solo tiene child_id.';

GRANT EXECUTE ON FUNCTION public._report_attended_subjects(uuid, date, date) TO authenticated;


-- ─── 2. mark_report_viewed ───────────────────────────────────────────────────
-- La llama el padre (o el atleta adulto) al abrir su informe. Idempotente en
-- `viewed_at`: solo la PRIMERA apertura la fija, porque lo que mide es cuánto
-- tarda la familia en leerlo y pisarla en cada apertura borraría esa métrica.
-- `view_count` sí sube siempre.
CREATE OR REPLACE FUNCTION public.mark_report_viewed(p_report_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_subject_type text;
    v_subject_id   uuid;
    v_recipient    uuid;
    v_status       text;
    v_viewed       timestamptz;
BEGIN
    SELECT ar.subject_type, ar.subject_id, ar.recipient_id, ar.status
      INTO v_subject_type, v_subject_id, v_recipient, v_status
      FROM public.athlete_reports ar
     WHERE ar.id = p_report_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El informe no existe.' USING ERRCODE = 'P0002';
    END IF;

    -- §10.1 + H4. Tres formas legítimas de ser «el destinatario»:
    --   · el acudiente al que se le resolvió el envío,
    --   · el acudiente del menor aunque el envío no se le haya resuelto (D16: el
    --     informe pudo publicarse antes de que la familia se vinculara),
    --   · el atleta adulto, que es su propio sujeto.
    -- El coach y el admin NO entran acá: que ellos abran el informe no es una
    -- lectura de la familia, y contarla falsearía justo la métrica que decide si
    -- el canal funciona.
    IF NOT (
           (v_recipient IS NOT NULL AND v_recipient = auth.uid())
        OR (v_subject_type = 'child'   AND public.is_parent_of_child(v_subject_id))
        OR (v_subject_type = 'profile' AND v_subject_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Este informe no es tuyo.' USING ERRCODE = '42501';
    END IF;

    -- Un borrador o un retenido no se «leyeron»: la familia no debería poder
    -- verlos (la policy de M2 exige 'publicado') y marcarlos ensuciaría el
    -- tablero. Se corta devolviendo NULL, no con excepción: el frontend llama a
    -- esto al abrir la pantalla y no debe romperse por eso.
    IF v_status <> 'publicado' THEN
        RETURN NULL;
    END IF;

    UPDATE public.athlete_reports
       SET viewed_at  = COALESCE(viewed_at, now()),
           view_count = view_count + 1,
           updated_at = now()
     WHERE id = p_report_id
    RETURNING viewed_at INTO v_viewed;

    RETURN v_viewed;
END;
$$;

COMMENT ON FUNCTION public.mark_report_viewed(uuid) IS
    'Marca la primera apertura del informe por parte de la familia y suma una '
    'vista. Solo el destinatario, el acudiente del menor o el atleta adulto. '
    'Coach y admin NO cuentan como lectura. Devuelve el viewed_at vigente.';

GRANT EXECUTE ON FUNCTION public.mark_report_viewed(uuid) TO authenticated;


-- ─── 3. report_coverage — el tablero (§10.2) ─────────────────────────────────
-- Agregado por equipo. Los tres últimos buckets son los que le dan sentido al
-- tablero: sin ellos solo se ve lo que YA existe, y lo que el admin necesita
-- saber es qué NO se hizo.
--
-- Universo de cada equipo = inscripciones que SOLAPAN el periodo (mismo criterio
-- que `generate_report_drafts`, no «vigente hoy»). Un atleta en dos equipos
-- cuenta en los dos: el tablero es la lista de trabajo de cada coach, no un
-- censo sin repetidos. La fila con `team_id` NULL son los atletas sin equipo en
-- el periodo (D-C).
CREATE OR REPLACE FUNCTION public.report_coverage(
    p_school_id uuid,
    p_year      smallint,
    p_month     smallint
)
RETURNS TABLE (
    team_id                       uuid,
    team_name                     text,
    total                         integer,
    listos                        integer,
    faltan_nota                   integer,
    publicados                    integer,
    leidos                        integer,
    sin_destinatario              integer,
    sin_mediciones_con_asistencia integer,
    sin_actividad                 integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_inicio   date := make_date(p_year::int, p_month::int, 1);
    v_fin      date := (make_date(p_year::int, p_month::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_es_admin boolean;
    v_equipos  uuid[];
BEGIN
    IF p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'Mes inválido: %', p_month USING ERRCODE = '22003';
    END IF;

    -- §10.1 — el admin ve toda la escuela; el coach, solo sus equipos.
    v_es_admin := public.can_manage_reports(p_school_id);

    IF NOT v_es_admin THEN
        v_equipos := public.current_staff_team_ids();
        IF v_equipos IS NULL OR cardinality(v_equipos) = 0 THEN
            RAISE EXCEPTION 'No tienes equipos en esta escuela.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN QUERY
    WITH
    universo AS (
        SELECT DISTINCT
               CASE
                   WHEN e.child_id IS NOT NULL THEN 'child'
                   WHEN e.user_id  IS NOT NULL THEN 'profile'
                   ELSE 'unregistered'
               END                                                         AS subject_type,
               COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)  AS subject_id,
               e.team_id
          FROM public.enrollments e
         WHERE e.school_id  = p_school_id
           AND e.start_date <= v_fin
           AND (e.end_date IS NULL OR e.end_date >= v_inicio)
           -- Cast a text a propósito: la columna es enum en el esquema
           -- versionado y TEXT en la base real. El literal funciona en ambas.
           AND e.status::text <> 'cancelled'
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
           AND (v_es_admin OR e.team_id = ANY (v_equipos))
    ),
    asistieron AS (
        SELECT a.subject_type, a.subject_id
          FROM public._report_attended_subjects(p_school_id, v_inicio, v_fin) a
    ),
    -- Nota de equipo del periodo: define el bucket `faltan_nota`.
    notas AS (
        SELECT trn.team_id
          FROM public.team_report_notes trn
         WHERE trn.school_id    = p_school_id
           AND trn.period_year  = p_year
           AND trn.period_month = p_month
    ),
    -- Se une por SUJETO, no por athlete_reports.team_id: ese solo dice qué
    -- equipo gobierna la FECHA (D17). Un atleta en dos equipos tiene UN informe
    -- y debe aparecer en la línea de los dos coaches.
    filas AS (
        SELECT u.team_id,
               ar.status,
               ar.recipient_id,
               ar.viewed_at,
               (n.team_id IS NOT NULL)                       AS tiene_nota,
               EXISTS (SELECT 1 FROM asistieron a
                        WHERE a.subject_type = u.subject_type
                          AND a.subject_id   = u.subject_id)  AS asistio
          FROM universo u
          LEFT JOIN public.athlete_reports ar
                 ON ar.school_id    = p_school_id
                AND ar.period_year  = p_year
                AND ar.period_month = p_month
                AND ar.subject_type = u.subject_type
                AND ar.subject_id   = u.subject_id
          LEFT JOIN notas n ON n.team_id = u.team_id
    )
    SELECT f.team_id,
           COALESCE(t.name, 'Sin equipo')                                     AS team_name,
           count(*)::integer                                                  AS total,
           -- «Listo» = el coach ya hizo su parte y el informe espera su día. El
           -- estado 'listo' de la tabla existe pero hoy nadie lo escribe, así
           -- que se deriva de la nota de equipo, que es lo que el admin persigue.
           count(*) FILTER (WHERE f.status IN ('borrador','listo')
                              AND f.tiene_nota)::integer                      AS listos,
           count(*) FILTER (WHERE f.status IN ('borrador','listo')
                              AND NOT f.tiene_nota)::integer                  AS faltan_nota,
           count(*) FILTER (WHERE f.status = 'publicado')::integer            AS publicados,
           count(*) FILTER (WHERE f.viewed_at IS NOT NULL)::integer           AS leidos,
           -- D16: publicado y sin acudiente activo. Para el admin es el mejor
           -- argumento para perseguir a las familias que no activaron cuenta.
           count(*) FILTER (WHERE f.status = 'publicado'
                              AND f.recipient_id IS NULL)::integer            AS sin_destinatario,
           -- D12: vino y nadie lo midió. Es acción pendiente del coach, no
           -- ausencia del atleta — y sin este bucket los dos se ven idénticos.
           count(*) FILTER (WHERE f.status IS NULL AND f.asistio)::integer     AS sin_mediciones_con_asistencia,
           count(*) FILTER (WHERE f.status IS NULL AND NOT f.asistio)::integer AS sin_actividad
      FROM filas f
      LEFT JOIN public.teams t ON t.id = f.team_id
     GROUP BY f.team_id, t.name
     -- Los sin equipo al final: son el caso raro (D-C), no el encabezado.
     ORDER BY (f.team_id IS NULL), COALESCE(t.name, '');
END;
$$;

COMMENT ON FUNCTION public.report_coverage(uuid, smallint, smallint) IS
    'Tablero de cobertura del periodo, agregado por equipo (spec §10.2). Admin '
    've toda la escuela; coach solo sus equipos. El universo sale de las '
    'inscripciones que solapan el mes, así que incluye a los atletas SIN informe '
    '— que es lo que el tablero existe para mostrar.';

GRANT EXECUTE ON FUNCTION public.report_coverage(uuid, smallint, smallint) TO authenticated;


-- ─── 4. adopt_reports_on_child_link — F6 ─────────────────────────────────────
-- Al vincular un menor a su acudiente, el informe publicado más reciente que
-- quedó sin destinatario (D16) pasa a tenerlo, y se le avisa.
--
-- POR QUÉ SOLO EL MÁS RECIENTE
-- En Dynasty el 78% de los menores no tiene acudiente vinculado, así que un
-- menor puede acumular varios informes publicados sin destinatario. Adoptarlos
-- todos le dispararía a la familia un correo por cada mes atrasado en la
-- siguiente corrida del emisor: una bienvenida en forma de bandeja llena.
--
-- No se pierde nada. `recipient_id` gobierna a quién se le MANDA, no quién puede
-- VER: la policy `athlete_reports_select_family` resuelve por
-- `is_parent_of_child()`, así que el histórico completo ya le aparece en la app
-- desde el momento del enganche.
--
-- POR QUÉ UN TRIGGER Y NO UN PARCHE EN CADA RPC
-- El mismo argumento de 20260730194230: hay cuatro caminos que setean
-- `children.parent_id` (claim_orphan_children, accept_invitation,
-- accept_invitation_pro, UPDATE directo) y parchear uno por uno deja el hueco
-- abierto para el quinto que alguien agregue mañana. El invariante es de la
-- tabla, no de la función.
CREATE OR REPLACE FUNCTION public.adopt_reports_on_child_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_report record;
BEGIN
    SELECT ar.id, ar.school_id, ar.period_year, ar.period_month
      INTO v_report
      FROM public.athlete_reports ar
     WHERE ar.subject_type  = 'child'
       AND ar.subject_id    = NEW.id
       AND ar.status        = 'publicado'
       AND ar.recipient_id IS NULL
     ORDER BY ar.period_year DESC, ar.period_month DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.athlete_reports
       SET recipient_id = NEW.parent_id,
           updated_at   = now()
     WHERE id = v_report.id;

    -- El aviso in-app es un efecto secundario deseable, no una condición del
    -- enganche. Si `notifications` cambia de forma o rechaza la fila, vincular a
    -- la familia NO puede fallar por eso: sería cambiar «un informe sin avisar»
    -- por «un menor que no se puede vincular».
    BEGIN
        INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
        VALUES (
            NEW.parent_id,
            v_report.school_id,
            'Tienes un informe esperándote',
            format('Ya puedes ver el informe de %s.',
                   to_char(make_date(v_report.period_year, v_report.period_month, 1), 'TMMonth YYYY')),
            'report',
            format('/children/%s/progress', NEW.id)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'adopt_reports_on_child_link: no se pudo notificar (%): %',
            SQLSTATE, SQLERRM;
    END;

    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora.
END;
$$;

COMMENT ON FUNCTION public.adopt_reports_on_child_link() IS
    'Trigger AFTER UPDATE en children: al vincular acudiente, asigna '
    'recipient_id al informe publicado MÁS RECIENTE que quedó sin destinatario '
    '(D16) y notifica solo ese, para no disparar el histórico completo por '
    'correo. El resto del histórico ya es visible por RLS.';

-- Mismo WHEN que el trigger de cobros: solo el enganche inicial. Va con nombre
-- propio y no se toca `trg_adopt_orphan_payments_on_child_link` — dos triggers
-- independientes sobre el mismo evento, para que un fallo de uno no arrastre al
-- otro ni obligue a releer el de pagos al cambiar el de informes.
DROP TRIGGER IF EXISTS trg_adopt_reports_on_child_link ON public.children;

CREATE TRIGGER trg_adopt_reports_on_child_link
    AFTER UPDATE OF parent_id ON public.children
    FOR EACH ROW
    WHEN (OLD.parent_id IS NULL AND NEW.parent_id IS NOT NULL)
    EXECUTE FUNCTION public.adopt_reports_on_child_link();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Las 4 funciones existen y `authenticated` puede invocarlas:
--
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS puede_authenticated
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('_report_attended_subjects','mark_report_viewed',
--                      'report_coverage','adopt_reports_on_child_link')
--  ORDER BY 1;
--
-- El tablero del mes (como admin de la escuela):
--   SELECT * FROM public.report_coverage('<school_id>'::uuid, 2026::smallint, 7::smallint);
--
-- Qué ejes de sujeto tomó el helper de asistencia en ESTA base:
--   SELECT pg_get_functiondef('public._report_attended_subjects(uuid,date,date)'::regprocedure);
-- =============================================================================
-- TESTS DE AUTORIZACIÓN (R8 de la spec — uno por RPC, con JWT real)
--
--   1. mark_report_viewed con el id de un informe de OTRA familia → 42501.
--   2. Llamarla dos veces: `viewed_at` NO cambia entre la primera y la segunda;
--      `view_count` pasa de 1 a 2.
--   3. Sobre un 'borrador' → devuelve NULL y no toca la fila.
--   4. Como coach del equipo → 42501 (no es lectura de la familia).
--   5. report_coverage como coach → solo sus equipos; como admin, todos. Con un
--      school_id ajeno → 42501.
--   6. Un atleta con inscripción en el periodo y sin mediciones cae en
--      `sin_mediciones_con_asistencia` si tiene asistencia y en `sin_actividad`
--      si no. Los buckets de estado más esos dos deben sumar `total`.
--
-- TEST DEL TRIGGER
--   Publicar dos informes de un menor sin acudiente (recipient_id NULL),
--   vincularlo, y verificar que SOLO el del periodo más reciente quedó con
--   recipient_id, que hay UNA notificación, y que la RLS le muestra los dos.
-- =============================================================================
