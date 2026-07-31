-- =============================================================================
-- 20260731163725_athlete_reports_rpcs_write.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731161243
-- Objetivo: M3 del Informe Mensual — las RPCs de ESCRITURA. Son la única vía de
--           escritura sobre athlete_reports (M1 solo concedió SELECT).
--
-- Spec: docs/specs/athlete-reports-module.md §10. Plan: docs/plan-f1-informes-backend.md
--
-- Funciones:
--   _report_send_day / _report_scheduled_for   helpers de fecha (D17 + D-C)
--   generate_report_drafts                     crea borradores, idempotente
--   set_athlete_report_note                    nota individual
--   publish_athlete_report                     congela y publica (FOR UPDATE)
--   publish_team_reports                       lote por equipo
--   hold_athlete_report                        retiene con motivo
--   regenerate_report_snapshot                 versiona y archiva el anterior
--   reschedule_pending_reports                 re-fecha lo no publicado (D18)
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC. SECURITY DEFINER NO exime al caller.
--
-- §10.1 — LA AUTORIZACIÓN VA DENTRO DE CADA FUNCIÓN, SIN EXCEPCIÓN.
--   `SECURITY DEFINER` corre con los privilegios del dueño y SALTA la RLS. Con
--   `GRANT EXECUTE … TO authenticated`, cualquier usuario autenticado puede
--   invocar cualquiera de estas RPCs con cualquier UUID. Cada una valida al
--   caller en su cuerpo.
-- =============================================================================
-- DECISIÓN D-G — el snapshot lo arma el LLAMADOR, no la RPC
--
--   La spec §10 sugiere que `publish_athlete_report` calcule el snapshot. Acá lo
--   recibe como parámetro. Razones:
--
--   · El cálculo (destacados con su delta, métricas a trabajar, bandas, radar
--     normalizado) YA existe y está en uso en `frontend/src/lib/school/
--     performanceDisplay.ts` — `pickHighlights`, `pickToWorkOn`, `computeDelta`,
--     `sortedThresholds`. Reimplementarlo en SQL crea DOS rankings que pueden
--     divergir, y el día que divergen el padre y el coach ven números distintos
--     del mismo mes. Una sola implementación.
--   · Varias columnas que el cálculo necesita NO están versionadas
--     (`attendance_records.user_id`, `.unregistered_athlete_id`, `.session_id`),
--     así que SQL escrito contra ellas funcionaría en la base real y fallaría en
--     una limpia. Misma deriva de M0.
--
--   Lo que la RPC sigue garantizando, que es lo que importa: autorización,
--   `SELECT … FOR UPDATE`, validación de estado, resolución del destinatario y la
--   transición atómica. El snapshot es un dato de entrada; la máquina de estados
--   sigue siendo del servidor.
--
--   Riesgo aceptado: un caller autorizado podría pasar un snapshot fabricado.
--   Pero es admin o coach de esa escuela y ya puede escribir las mediciones
--   subyacentes, así que no gana capacidad nueva. Se exige que el snapshot sea un
--   objeto no vacío para atajar el error honesto (mandar null y publicar un
--   informe vacío), no al malicioso.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Helpers de fecha ─────────────────────────────────────────────────────

-- Día de envío EFECTIVO de un equipo: el del calendario, o el default de la
-- escuela si ese equipo no tiene fila. Con team_id NULL devuelve el default —
-- que es el caso del atleta sin equipo (D-C).
CREATE OR REPLACE FUNCTION public._report_send_day(p_school_id uuid, p_team_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT rts.send_day
           FROM public.report_team_schedule rts
          WHERE rts.school_id = p_school_id
            AND rts.team_id   = p_team_id),
        (SELECT ss.reports_default_send_day
           FROM public.school_settings ss
          WHERE ss.school_id = p_school_id),
        28::smallint
    );
$$;

-- Fecha concreta del envío, con el día recortado al último del mes: send_day = 31
-- en febrero no puede producir 2026-02-31.
CREATE OR REPLACE FUNCTION public._report_scheduled_for(
    p_year smallint, p_month smallint, p_send_day smallint
)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT make_date(p_year::int, p_month::int, 1)
         + (LEAST(
                GREATEST(p_send_day, 1),
                EXTRACT(DAY FROM (make_date(p_year::int, p_month::int, 1)
                                  + INTERVAL '1 month' - INTERVAL '1 day'))::int
            ) - 1) * INTERVAL '1 day';
$$;

GRANT EXECUTE ON FUNCTION public._report_send_day(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public._report_scheduled_for(smallint, smallint, smallint) TO authenticated;


-- ─── 2. generate_report_drafts ───────────────────────────────────────────────
-- Crea un borrador por atleta CON MEDICIONES en el periodo. Idempotente: se puede
-- correr todos los días del mes sin duplicar ni pisar notas ya escritas.
--
-- D17 — equipo GOBERNANTE = el del `send_day` más TARDÍO entre sus equipos del
--   periodo. Con el más temprano el snapshot se congelaba antes de vencer el plazo
--   del segundo coach y su nota se perdía SIEMPRE. Empate → el team_id menor, para
--   que dos corridas den el mismo resultado.
-- D-C — sin equipo en el periodo: team_id NULL y el día por defecto de la escuela.
--   Antes ese atleta no tenía fecha y su informe no publicaba nunca, en silencio.
CREATE OR REPLACE FUNCTION public.generate_report_drafts(
    p_school_id uuid,
    p_year      smallint,
    p_month     smallint
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_inicio date := make_date(p_year::int, p_month::int, 1);
    v_fin    date := (make_date(p_year::int, p_month::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    v_creados integer := 0;
BEGIN
    -- §10.1 — autorización DENTRO. Sin esto cualquier autenticado genera
    -- borradores en cualquier escuela pasando su UUID.
    IF NOT public.can_manage_reports(p_school_id) THEN
        RAISE EXCEPTION 'No tienes permisos para generar informes de esta escuela.'
            USING ERRCODE = '42501';
    END IF;

    IF p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'Mes inválido: %', p_month USING ERRCODE = '22003';
    END IF;

    WITH medidos AS (
        -- El sujeto entra si tiene AL MENOS una medición en el periodo. Sin
        -- mediciones no hay informe que mandar (los buckets del tablero de M4
        -- distinguen «no vino» de «vino y nadie lo midió»).
        SELECT DISTINCT pe.subject_type, pe.subject_id
        FROM public.performance_entries pe
        WHERE pe.school_id = p_school_id
          AND pe.recorded_at >= v_inicio
          AND pe.recorded_at <  (v_fin + INTERVAL '1 day')
    ),
    -- Equipos del sujeto vigentes en el periodo, con su día efectivo.
    equipos AS (
        SELECT m.subject_type,
               m.subject_id,
               e.team_id,
               public._report_send_day(p_school_id, e.team_id) AS send_day
        FROM medidos m
        JOIN public.enrollments e
          ON e.school_id = p_school_id
         AND e.team_id IS NOT NULL
         AND e.start_date <= v_fin
         AND (e.end_date IS NULL OR e.end_date >= v_inicio)
         AND e.status::text <> 'cancelled'
         AND (
               (m.subject_type = 'child'        AND e.child_id                = m.subject_id)
            OR (m.subject_type = 'profile'      AND e.user_id                 = m.subject_id)
            OR (m.subject_type = 'unregistered' AND e.unregistered_athlete_id = m.subject_id)
         )
    ),
    -- D17: el más tardío gobierna. DISTINCT ON con ORDER BY determinista.
    gobernante AS (
        SELECT DISTINCT ON (subject_type, subject_id)
               subject_type, subject_id, team_id, send_day
        FROM equipos
        ORDER BY subject_type, subject_id, send_day DESC, team_id ASC
    ),
    -- Los medidos SIN equipo en el periodo también llevan informe (D-C).
    final AS (
        SELECT m.subject_type,
               m.subject_id,
               g.team_id,
               COALESCE(g.send_day, public._report_send_day(p_school_id, NULL)) AS send_day
        FROM medidos m
        LEFT JOIN gobernante g
               ON g.subject_type = m.subject_type
              AND g.subject_id   = m.subject_id
    )
    INSERT INTO public.athlete_reports (
        school_id, team_id, subject_type, subject_id,
        period_year, period_month, status, scheduled_for
    )
    SELECT p_school_id,
           f.team_id,
           f.subject_type,
           f.subject_id,
           p_year,
           p_month,
           'borrador',
           public._report_scheduled_for(p_year, p_month, f.send_day)
    FROM final f
    -- Idempotencia real: si ya hay informe para ese atleta y periodo no se toca
    -- NADA. Nunca pisa una nota ya escrita ni devuelve a 'borrador' algo
    -- publicado. El índice único de M1 es la red.
    ON CONFLICT (school_id, subject_type, subject_id, period_year, period_month)
        DO NOTHING;

    GET DIAGNOSTICS v_creados = ROW_COUNT;
    RETURN v_creados;
END;
$$;

COMMENT ON FUNCTION public.generate_report_drafts(uuid, smallint, smallint) IS
    'Crea borradores del periodo para atletas con mediciones. Idempotente '
    '(ON CONFLICT DO NOTHING): nunca pisa notas ni revierte publicados. '
    'Resuelve el equipo gobernante (D17, send_day más tardío) y scheduled_for.';

GRANT EXECUTE ON FUNCTION public.generate_report_drafts(uuid, smallint, smallint) TO authenticated;


-- ─── 3. set_athlete_report_note ──────────────────────────────────────────────
-- La nota individual, que es OPCIONAL (la obligatoria es la de equipo).
-- Guarda `coach_note_by` como school_staff.id, no auth.uid().
CREATE OR REPLACE FUNCTION public.set_athlete_report_note(
    p_report_id uuid,
    p_note      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_status    text;
    v_staff_id  uuid;
BEGIN
    SELECT school_id, status INTO v_school_id, v_status
    FROM public.athlete_reports
    WHERE id = p_report_id
    FOR UPDATE;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Informe no encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- Coach que ve ese informe (D19), o admin de la escuela.
    IF NOT (public.coach_can_see_report(p_report_id) OR public.can_manage_reports(v_school_id)) THEN
        RAISE EXCEPTION 'No tienes permisos para escribir la nota de este informe.'
            USING ERRCODE = '42501';
    END IF;

    -- Publicado = congelado. Corregir después de publicar es
    -- regenerate_report_snapshot, que versiona y audita.
    IF v_status = 'publicado' THEN
        RAISE EXCEPTION 'El informe ya está publicado: la nota no se puede cambiar. '
                        'Usa regenerate_report_snapshot si hay que corregirlo.'
            USING ERRCODE = '55000';
    END IF;

    -- Primer school_staff.id del caller en ESA escuela (puede tener varios, uno
    -- por escuela). NULL si quien escribe es un admin que no es staff.
    SELECT ss.id INTO v_staff_id
    FROM public.school_staff ss
    WHERE ss.id = ANY (public.current_staff_ids())
      AND ss.school_id = v_school_id
    LIMIT 1;

    UPDATE public.athlete_reports
       SET coach_note    = NULLIF(btrim(p_note), ''),
           coach_note_by = v_staff_id
     WHERE id = p_report_id;
END;
$$;

COMMENT ON FUNCTION public.set_athlete_report_note(uuid, text) IS
    'Nota individual (opcional). Coach que ve el informe (D19) o admin. '
    'Rechaza si ya está publicado. coach_note_by es school_staff.id.';

GRANT EXECUTE ON FUNCTION public.set_athlete_report_note(uuid, text) TO authenticated;


-- ─── 4. publish_athlete_report ───────────────────────────────────────────────
-- Congela el snapshot, resuelve el destinatario y pasa a 'publicado'.
-- El snapshot llega del llamador (D-G).
CREATE OR REPLACE FUNCTION public.publish_athlete_report(
    p_report_id     uuid,
    p_snapshot      jsonb,
    p_override_note boolean DEFAULT false,
    p_reason        text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r               public.athlete_reports;
    v_release_by    text;
    v_es_admin      boolean;
    v_tiene_nota    boolean;
    v_recipient     uuid;
BEGIN
    -- FOR UPDATE serializa dos publicaciones simultáneas del mismo informe: la
    -- segunda espera, ve status='publicado' y sale por el rechazo de abajo. Sin
    -- esto las dos pasaban la validación y se encolaban DOS notificaciones.
    SELECT * INTO r
    FROM public.athlete_reports
    WHERE id = p_report_id
    FOR UPDATE;

    IF r.id IS NULL THEN
        RAISE EXCEPTION 'Informe no encontrado.' USING ERRCODE = 'P0002';
    END IF;

    v_es_admin := public.can_manage_reports(r.school_id);

    SELECT COALESCE(ss.reports_release_by, 'school') INTO v_release_by
    FROM public.school_settings ss WHERE ss.school_id = r.school_id;
    v_release_by := COALESCE(v_release_by, 'school');

    -- Publica el admin; el coach solo si la escuela lo configuró así. Coach =
    -- autor y escuela = publica son responsabilidades distintas: un solo botón
    -- para ambas es el error que este flag evita.
    IF NOT (v_es_admin
            OR (v_release_by = 'coach' AND public.coach_can_see_report(p_report_id))) THEN
        RAISE EXCEPTION 'No tienes permisos para publicar este informe.'
            USING ERRCODE = '42501';
    END IF;

    IF r.status = 'publicado' THEN
        RAISE EXCEPTION 'El informe ya fue publicado el %.', r.published_at
            USING ERRCODE = '55000';
    END IF;

    IF r.status = 'retenido' AND NOT v_es_admin THEN
        RAISE EXCEPTION 'El informe está retenido: solo la escuela puede publicarlo.'
            USING ERRCODE = '42501';
    END IF;

    -- El snapshot es la ÚNICA fuente de la vista del padre y del PDF, así que un
    -- snapshot vacío publica un informe sin contenido. Se ataja el error honesto.
    IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR p_snapshot = '{}'::jsonb THEN
        RAISE EXCEPTION 'El snapshot del informe es obligatorio y no puede estar vacío.'
            USING ERRCODE = '22023';
    END IF;

    -- Nota del equipo GOBERNANTE. Exigida salvo override explícito. Si no hay
    -- equipo gobernante (D-C) no hay nota de equipo que exigir.
    v_tiene_nota := r.team_id IS NULL OR EXISTS (
        SELECT 1 FROM public.team_report_notes n
        WHERE n.team_id      = r.team_id
          AND n.period_year  = r.period_year
          AND n.period_month = r.period_month
    );

    IF NOT v_tiene_nota AND NOT p_override_note THEN
        RAISE EXCEPTION 'Falta la nota del equipo gobernante. Publica con override si es a propósito.'
            USING ERRCODE = '55000';
    END IF;

    IF NOT v_tiene_nota AND p_override_note AND COALESCE(btrim(p_reason), '') = '' THEN
        RAISE EXCEPTION 'Publicar sin la nota del equipo exige un motivo.'
            USING ERRCODE = '22023';
    END IF;

    -- Destinatario: el acudiente del menor, o el propio atleta adulto. NULL =
    -- sin destinatario (D16): se publica igual, no cuenta como pendiente de
    -- envío, y F6 lo adopta cuando la familia se vincula.
    v_recipient := CASE
        WHEN r.subject_type = 'child' THEN
            (SELECT c.parent_id FROM public.children c WHERE c.id = r.subject_id)
        WHEN r.subject_type = 'profile' THEN r.subject_id
        ELSE NULL   -- unregistered: por definición no tiene cuenta
    END;

    UPDATE public.athlete_reports
       SET status                 = 'publicado',
           snapshot               = p_snapshot,
           published_at           = now(),
           published_by           = auth.uid(),
           published_without_note = NOT v_tiene_nota,
           recipient_id           = v_recipient,
           hold_reason            = CASE WHEN NOT v_tiene_nota THEN btrim(p_reason) ELSE hold_reason END
     WHERE id = p_report_id;

    -- El despacho (push + correo) NO va acá: lo hace el job del BFF de F5, que es
    -- quien sabe si hay canal de push vivo y aplica la cascada de §7.1. Publicar
    -- ≠ enviar, y por eso sent_at queda NULL hasta que el emisor lo marque.
    RETURN p_report_id;
END;
$$;

COMMENT ON FUNCTION public.publish_athlete_report(uuid, jsonb, boolean, text) IS
    'Congela el snapshot (lo arma el llamador, ver D-G), resuelve recipient_id y '
    'pasa a publicado. SELECT FOR UPDATE contra doble publicación. No despacha: '
    'eso es del job de F5 — publicado no es enviado.';

GRANT EXECUTE ON FUNCTION public.publish_athlete_report(uuid, jsonb, boolean, text) TO authenticated;


-- ─── 5. publish_team_reports ─────────────────────────────────────────────────
-- Lote de un equipo. `p_snapshots` es un objeto {report_id: snapshot}. Los que ya
-- estaban publicados se SALTAN sin abortar el resto — si un informe suelto ya
-- salió, el lote no debe fallar completo por él.
CREATE OR REPLACE FUNCTION public.publish_team_reports(
    p_school_id     uuid,
    p_team_id       uuid,
    p_year          smallint,
    p_month         smallint,
    p_snapshots     jsonb,
    p_override_note boolean DEFAULT false,
    p_reason        text    DEFAULT NULL
)
RETURNS TABLE (report_id uuid, resultado text, detalle text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_snap jsonb;
BEGIN
    IF NOT (public.can_manage_reports(p_school_id)
            OR (p_team_id = ANY (public.current_staff_team_ids())
                AND COALESCE((SELECT ss.reports_release_by FROM public.school_settings ss
                               WHERE ss.school_id = p_school_id), 'school') = 'coach')) THEN
        RAISE EXCEPTION 'No tienes permisos para publicar el lote de este equipo.'
            USING ERRCODE = '42501';
    END IF;

    FOR v_rec IN
        SELECT ar.id, ar.status
        FROM public.athlete_reports ar
        WHERE ar.school_id    = p_school_id
          AND ar.team_id      = p_team_id
          AND ar.period_year  = p_year
          AND ar.period_month = p_month
        ORDER BY ar.id
    LOOP
        IF v_rec.status = 'publicado' THEN
            RETURN QUERY SELECT v_rec.id, 'saltado'::text, 'ya estaba publicado'::text;
            CONTINUE;
        END IF;

        IF v_rec.status IN ('retenido','omitido') THEN
            RETURN QUERY SELECT v_rec.id, 'saltado'::text, ('estado ' || v_rec.status)::text;
            CONTINUE;
        END IF;

        v_snap := p_snapshots -> v_rec.id::text;

        IF v_snap IS NULL THEN
            RETURN QUERY SELECT v_rec.id, 'error'::text, 'sin snapshot en p_snapshots'::text;
            CONTINUE;
        END IF;

        BEGIN
            PERFORM public.publish_athlete_report(v_rec.id, v_snap, p_override_note, p_reason);
            RETURN QUERY SELECT v_rec.id, 'publicado'::text, NULL::text;
        EXCEPTION WHEN OTHERS THEN
            -- Un informe problemático no tumba el lote; se reporta y sigue.
            RETURN QUERY SELECT v_rec.id, 'error'::text, SQLERRM::text;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.publish_team_reports(uuid, uuid, smallint, smallint, jsonb, boolean, text) IS
    'Publica el lote del equipo. p_snapshots = {report_id: snapshot}. Devuelve una '
    'fila por informe: publicado / saltado / error. Un informe con problema no '
    'aborta el resto.';

GRANT EXECUTE ON FUNCTION public.publish_team_reports(uuid, uuid, smallint, smallint, jsonb, boolean, text) TO authenticated;


-- ─── 6. hold_athlete_report ──────────────────────────────────────────────────
-- Retención por excepción: el admin no lee 500 notas, retiene la que no debe
-- salir. Motivo obligatorio (el CHECK de M1 también lo exige) y queda auditado
-- por el trigger de M1.
CREATE OR REPLACE FUNCTION public.hold_athlete_report(
    p_report_id uuid,
    p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_status    text;
BEGIN
    SELECT school_id, status INTO v_school_id, v_status
    FROM public.athlete_reports WHERE id = p_report_id FOR UPDATE;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Informe no encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- Solo admin: retener es decisión de la escuela, no del coach.
    IF NOT public.can_manage_reports(v_school_id) THEN
        RAISE EXCEPTION 'Solo la escuela puede retener un informe.' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(btrim(p_reason), '') = '' THEN
        RAISE EXCEPTION 'Retener exige un motivo.' USING ERRCODE = '22023';
    END IF;

    -- Retener algo ya publicado no tiene sentido: el padre ya lo vio. Para eso
    -- está regenerate_report_snapshot.
    IF v_status = 'publicado' THEN
        RAISE EXCEPTION 'El informe ya está publicado: no se puede retener.'
            USING ERRCODE = '55000';
    END IF;

    UPDATE public.athlete_reports
       SET status = 'retenido', hold_reason = btrim(p_reason)
     WHERE id = p_report_id;
END;
$$;

COMMENT ON FUNCTION public.hold_athlete_report(uuid, text) IS
    'Retiene un informe no publicado. Solo admin, motivo obligatorio, auditado.';

GRANT EXECUTE ON FUNCTION public.hold_athlete_report(uuid, text) TO authenticated;


-- ─── 7. regenerate_report_snapshot ───────────────────────────────────────────
-- Un informe que el padre ya leyó no puede cambiar en silencio si mañana se
-- corrige una medición. Regenerar es explícito, versionado y auditado: la versión
-- vigente se archiva en athlete_report_snapshots y snapshot_version sube.
CREATE OR REPLACE FUNCTION public.regenerate_report_snapshot(
    p_report_id uuid,
    p_snapshot  jsonb,
    p_reason    text
)
RETURNS smallint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r public.athlete_reports;
BEGIN
    -- FOR UPDATE también acá: sin él, dos regeneraciones simultáneas podían
    -- calcular la misma versión y chocar contra el índice único de la tabla de
    -- snapshots, o peor, archivar dos veces la misma.
    SELECT * INTO r FROM public.athlete_reports WHERE id = p_report_id FOR UPDATE;

    IF r.id IS NULL THEN
        RAISE EXCEPTION 'Informe no encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.can_manage_reports(r.school_id) THEN
        RAISE EXCEPTION 'Solo la escuela puede regenerar un informe.' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(btrim(p_reason), '') = '' THEN
        RAISE EXCEPTION 'Regenerar exige un motivo: queda en la auditoría.'
            USING ERRCODE = '22023';
    END IF;

    IF r.status <> 'publicado' THEN
        RAISE EXCEPTION 'Solo se regenera un informe publicado (este está %). '
                        'Antes de publicar basta volver a publicar.', r.status
            USING ERRCODE = '55000';
    END IF;

    IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR p_snapshot = '{}'::jsonb THEN
        RAISE EXCEPTION 'El snapshot nuevo es obligatorio y no puede estar vacío.'
            USING ERRCODE = '22023';
    END IF;

    -- Archivar la versión vigente ANTES de sobreescribirla.
    INSERT INTO public.athlete_report_snapshots (report_id, version, snapshot, reason, archived_by)
    VALUES (r.id, r.snapshot_version, r.snapshot, btrim(p_reason), auth.uid());

    UPDATE public.athlete_reports
       SET snapshot         = p_snapshot,
           snapshot_version = r.snapshot_version + 1
     WHERE id = p_report_id;

    RETURN (r.snapshot_version + 1)::smallint;
END;
$$;

COMMENT ON FUNCTION public.regenerate_report_snapshot(uuid, jsonb, text) IS
    'Archiva el snapshot vigente en athlete_report_snapshots, guarda el nuevo y '
    'sube snapshot_version. Solo admin, motivo obligatorio. FOR UPDATE contra '
    'regeneraciones simultáneas.';

GRANT EXECUTE ON FUNCTION public.regenerate_report_snapshot(uuid, jsonb, text) TO authenticated;


-- ─── 8. reschedule_pending_reports ───────────────────────────────────────────
-- D18: si el admin cambia el calendario a mitad de mes, los borradores ya creados
-- siguen con la fecha vieja. Re-fecha SOLO lo no publicado: un informe que ya
-- salió no se mueve.
CREATE OR REPLACE FUNCTION public.reschedule_pending_reports(
    p_school_id uuid,
    p_year      smallint,
    p_month     smallint
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_afectados integer := 0;
BEGIN
    IF NOT public.can_manage_reports(p_school_id) THEN
        RAISE EXCEPTION 'No tienes permisos para re-agendar informes de esta escuela.'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.athlete_reports ar
       SET scheduled_for = public._report_scheduled_for(
               p_year, p_month, public._report_send_day(p_school_id, ar.team_id))
     WHERE ar.school_id    = p_school_id
       AND ar.period_year  = p_year
       AND ar.period_month = p_month
       AND ar.status IN ('borrador','listo')
       AND ar.scheduled_for <> public._report_scheduled_for(
               p_year, p_month, public._report_send_day(p_school_id, ar.team_id));

    GET DIAGNOSTICS v_afectados = ROW_COUNT;
    RETURN v_afectados;
END;
$$;

COMMENT ON FUNCTION public.reschedule_pending_reports(uuid, smallint, smallint) IS
    'D18: re-fecha los informes no publicados del periodo tras cambiar el '
    'calendario. No mueve lo ya publicado ni lo retenido.';

GRANT EXECUTE ON FUNCTION public.reschedule_pending_reports(uuid, smallint, smallint) TO authenticated;

COMMIT;

-- =============================================================================
-- TESTS DE CONCURRENCIA — obligatorios en la fase de backend (CLAUDE.md).
-- Dos sesiones con BEGIN explícito e interleave deliberado, no dos llamadas en
-- paralelo a ver qué pasa.
--
--   1. publish_athlete_report ×2 sobre el mismo informe:
--        S1: BEGIN; SELECT publish_athlete_report('<id>', '{"x":1}');   -- no commitea
--        S2: BEGIN; SELECT publish_athlete_report('<id>', '{"x":1}');   -- debe BLOQUEARSE
--        S1: COMMIT;
--        S2: debe fallar con 55000 «ya fue publicado», NO con un 500 feo.
--      Verificar además que quedó UNA sola fila publicada y un solo published_at.
--
--   2. generate_report_drafts ×2 en paralelo, mismo periodo:
--        Cero duplicados (índice único de M1 + ON CONFLICT DO NOTHING). La segunda
--        debe devolver 0 creados. Es la clase de bug de open_month con sus tres
--        vías de generación: no repetirlo.
--
--   3. generate_report_drafts DESPUÉS de escribir notas:
--        No debe pisar coach_note ni devolver a 'borrador' un 'publicado'.
--
--   4. regenerate_report_snapshot ×2 simultáneas:
--        snapshot_version no se salta ni se repite; una sola fila archivada por
--        versión (índice único de athlete_report_snapshots).
--
--   5. publish_team_reports sobre un equipo con un informe ya publicado suelto:
--        ese sale 'saltado' y el resto se publica. El lote NO aborta.
--
-- PENDIENTE (M4): mark_report_viewed, report_coverage, adopt_reports_on_child_link.
--   Ojo con mark_report_viewed: sin el check interno cualquier autenticado marca
--   informes ajenos como vistos, y como viewed_at gobierna la cascada de §7.1 eso
--   SUPRIME el correo de otra familia — fallo de disponibilidad, no solo de
--   integridad.
-- =============================================================================
