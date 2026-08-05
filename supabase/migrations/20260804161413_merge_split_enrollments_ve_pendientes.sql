-- =============================================================================
-- 20260804161413_merge_split_enrollments_ve_pendientes.sql
-- Autor: brylop   Fecha: 2026-08-04   Versión anterior: 20260804125913
-- Objetivo: que la limpieza de inscripciones partidas vea también las `pending`.
--   Hoy filtra `status='active'` y por eso reporta cero sobre 6 atletas partidos.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- EL PUNTO CIEGO
--
-- `submit_qr_signup` crea la inscripción con:
--
--     CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END
--
-- Dynasty usa `require_first_payment`, así que las altas por QR nacen `pending`. Y
-- TODO el andamiaje anti-duplicado mira solo las activas:
--
--   1. Los guards y el merge del BFF `POST /enrollments` (`.eq('status','active')`).
--   2. Los índices únicos `uq_enrollment_child_team` / `uq_enrollment_child_plan`,
--      parciales `WHERE status='active'`.
--   3. Esta función, con `WHERE e.status='active'` en sus cuatro consultas.
--
-- Consecuencia medida en Dynasty el 2026-08-04: al asignarle el plan desde la app, el
-- BFF no encontraba candidato a merge e insertaba una segunda fila. **6 atletas de
-- 418**, todos con forma 1 `active` + 1 `pending`, y **ninguno con dos activas** — por
-- eso esta función reportaba cero: estaba mirando donde no había nada. El productor
-- queda cerrado en el BFF junto a esta migración; esto es la limpieza.
--
-- Cinco de los seis tienen la `pending` huérfana (sin equipo ni plan) y se resuelven
-- por la rama de cancelación. El sexto (`pending`+SENIORS contra `active`+PLAN PRO)
-- sale en `revision`: son dos planes distintos y no se puede saber cuál paga.
--
-- QUÉ CAMBIA EXACTAMENTE
--
--   1. Las cuatro consultas pasan a `status IN ('active','pending')`.
--   2. La superviviente prefiere `active` ANTES que cualquier otro criterio. Sin eso
--      un atleta con `pending`+plan y `active`+equipo perdería la fila activa y
--      quedaría pendiente de pago: se le apagaría el acceso a alguien al día.
--   3. El reporte distingue activas de pendientes, y dice con qué estado queda la
--      superviviente.
--
-- LO QUE NO CAMBIA
--
--   · No se escribe `monthly_fee` (sería una tercera fuente de verdad del cobro — ver
--     el encabezado de 20260803150126).
--   · No se ACTIVA nada. La función solo escribe `status='cancelled'`; una `pending`
--     que sobrevive sigue `pending`. Es la decisión de producto del 2026-08-04: la
--     escuela completa la inscripción, la activación sigue esperando el pago.
--   · Los cobros ya emitidos no se tocan: si hay dos del mismo periodo los anula la
--     escuela. Es plata y puede haber uno pagado.
--   · Cancelar ANTES de consolidar. Con los índices parciales sobre `active`, mover el
--     plan con la duplicada todavía activa revienta con 23505.
--
-- No fusiona nada al aplicarse: `p_dry_run` sigue en `true` por defecto.

BEGIN;

CREATE OR REPLACE FUNCTION public.merge_split_enrollments(
    p_school_id uuid    DEFAULT NULL,   -- NULL = todas las escuelas
    p_dry_run   boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller     uuid := auth.uid();
    v_grp        record;
    v_survivor   uuid;
    v_surv_state text;
    v_team       uuid;
    v_plan       uuid;
    v_sessions   int;
    v_sessions2  int;
    v_descartes  uuid[];
    v_planes     uuid[];
    v_equipos    uuid[];
    v_acciones   jsonb := '[]'::jsonb;
    v_revision   jsonb := '[]'::jsonb;
    v_fusionados int := 0;
    v_canceladas int := 0;
BEGIN
    -- Autorización: super admin siempre; admin de escuela solo sobre la suya. Sin
    -- p_school_id hace falta ser super admin: fusionar a ciegas toda la base no es
    -- algo que deba poder disparar el admin de un club.
    IF v_caller IS NOT NULL THEN
        IF p_school_id IS NULL THEN
            IF NOT public.is_super_admin() THEN
                RAISE EXCEPTION 'Sin p_school_id hace falta ser super admin.';
            END IF;
        ELSIF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
            RAISE EXCEPTION 'No autorizado para esta escuela.';
        END IF;
    END IF;

    FOR v_grp IN
        SELECT e.school_id,
               COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS subject,
               count(*)                                     AS abiertas,
               count(*) FILTER (WHERE e.status = 'active')   AS activas,
               count(*) FILTER (WHERE e.status = 'pending')  AS pendientes
        FROM public.enrollments e
        WHERE e.status IN ('active', 'pending')
          AND (p_school_id IS NULL OR e.school_id = p_school_id)
          AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
        GROUP BY 1, 2
        HAVING count(*) > 1
        ORDER BY 1, 2
    LOOP
        -- Planes y equipos DISTINTOS que tiene el atleta ahora mismo.
        SELECT array_agg(DISTINCT e.offering_plan_id) FILTER (WHERE e.offering_plan_id IS NOT NULL),
               array_agg(DISTINCT e.team_id)          FILTER (WHERE e.team_id IS NOT NULL)
          INTO v_planes, v_equipos
          FROM public.enrollments e
         WHERE e.status IN ('active', 'pending')
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        -- Ambiguo: dos planes o dos equipos. No se decide por script.
        IF COALESCE(array_length(v_planes, 1), 0) > 1
           OR COALESCE(array_length(v_equipos, 1), 0) > 1 THEN
            v_revision := v_revision || jsonb_build_object(
                'school_id',  v_grp.school_id,
                'atleta',     v_grp.subject,
                'abiertas',   v_grp.abiertas,
                'activas',    v_grp.activas,
                'pendientes', v_grp.pendientes,
                'planes',     COALESCE(array_length(v_planes, 1), 0),
                'equipos',    COALESCE(array_length(v_equipos, 1), 0),
                'motivo',     CASE
                                WHEN COALESCE(array_length(v_planes, 1), 0) > 1
                                  THEN 'dos planes distintos: no se puede saber cuál paga'
                                ELSE 'dos equipos distintos: multi-categoría, cerrado hasta MOD-3'
                              END
            );
            CONTINUE;
        END IF;

        -- Superviviente: primero la ACTIVA (cancelarla y dejar viva una pendiente le
        -- apagaría el acceso a un atleta al día); después la que tiene plan; después
        -- la que al menos tenga equipo; y a igualdad, la más antigua, que es la que
        -- carga el historial.
        SELECT e.id, e.status INTO v_survivor, v_surv_state
          FROM public.enrollments e
         WHERE e.status IN ('active', 'pending')
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject
         ORDER BY (e.status = 'active')             DESC,   -- nunca degradar a pending
                  (e.offering_plan_id IS NOT NULL)  DESC,   -- el plan gobierna el cobro
                  (e.team_id IS NOT NULL)           DESC,   -- antes que una huérfana
                  e.created_at                      ASC     -- la más antigua
         LIMIT 1;

        -- Lo que la superviviente debe absorber, y los créditos ya consumidos: se
        -- toma el GREATEST, si no el atleta recupera sesiones que ya usó.
        SELECT v_planes[1],
               v_equipos[1],
               max(COALESCE(e.sessions_used, 0)),
               max(COALESCE(e.secondary_sessions_used, 0)),
               array_agg(e.id) FILTER (WHERE e.id <> v_survivor)
          INTO v_plan, v_team, v_sessions, v_sessions2, v_descartes
          FROM public.enrollments e
         WHERE e.status IN ('active', 'pending')
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        v_acciones := v_acciones || jsonb_build_object(
            'school_id',            v_grp.school_id,
            'atleta',               v_grp.subject,
            'abiertas',             v_grp.abiertas,
            'activas',              v_grp.activas,
            'pendientes',           v_grp.pendientes,
            'sobrevive',            v_survivor,
            'estado_superviviente', v_surv_state,
            'se_cancelan',          to_jsonb(v_descartes),
            'queda_con',            jsonb_build_object('team_id', v_team, 'offering_plan_id', v_plan)
        );

        IF NOT p_dry_run THEN
            -- 1) Cancelar PRIMERO. Los índices únicos son parciales (status='active'):
            --    al revés, mover el plan revienta con 23505.
            UPDATE public.enrollments
               SET status = 'cancelled',
                   end_date = CURRENT_DATE,
                   updated_at = now()
             WHERE id = ANY (v_descartes);
            v_canceladas := v_canceladas + COALESCE(array_length(v_descartes, 1), 0);

            -- 2) Y recién ahora consolidar en la que queda. `monthly_fee` no se toca
            --    y `status` tampoco: una pendiente sigue pendiente.
            UPDATE public.enrollments
               SET team_id                 = COALESCE(team_id, v_team),
                   offering_plan_id        = COALESCE(offering_plan_id, v_plan),
                   sessions_used           = GREATEST(COALESCE(sessions_used, 0), COALESCE(v_sessions, 0)),
                   secondary_sessions_used = GREATEST(COALESCE(secondary_sessions_used, 0), COALESCE(v_sessions2, 0)),
                   updated_at              = now()
             WHERE id = v_survivor;
            v_fusionados := v_fusionados + 1;
        ELSE
            v_fusionados := v_fusionados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'dry_run',            p_dry_run,
        'school_id',          p_school_id,
        'atletas_fusionados', v_fusionados,
        'filas_canceladas',   CASE WHEN p_dry_run THEN NULL ELSE v_canceladas END,
        'a_revision',         jsonb_array_length(v_revision),
        'acciones',           v_acciones,
        'revision',           v_revision
    );
END;
$$;

COMMENT ON FUNCTION public.merge_split_enrollments(uuid, boolean) IS
    'Fusiona inscripciones partidas (equipo+plan del mismo atleta) en una sola. Mira ACTIVE y PENDING: filtrar solo active era el punto ciego por el que las altas por QR con require_first_payment no se detectaban (6 atletas en Dynasty al 2026-08-04). dry_run=true por defecto. La superviviente prefiere la activa, para no degradar a pendiente a un atleta al día. Cancela las descartadas ANTES de consolidar (índices únicos parciales sobre status=active). NO escribe monthly_fee ni activa nada: una pendiente que sobrevive sigue pendiente. Los casos ambiguos —dos planes o dos equipos distintos— salen en `revision` para que los resuelva la escuela. Implementa M3 de docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md';

REVOKE ALL ON FUNCTION public.merge_split_enrollments(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_split_enrollments(uuid, boolean) TO authenticated, service_role;

COMMIT;
