-- =============================================================================
-- 20260803150126_merge_split_enrollments.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260803114540
-- Objetivo: fusionar las inscripciones partidas que ya existen, con reporte previo
--   y sin decidir por la escuela los casos ambiguos.
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
-- Implementa **M3** de docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md §5.
--
-- Esta migración **solo crea la función**. No fusiona nada al aplicarse: hay que
-- llamarla, y por defecto corre en `dry_run`. Se ejecuta después de que los tres
-- productores estén cerrados (§11.5 del plan) — QR, editor de atletas y POST
-- /enrollments ya lo están; limpiar antes era trapear con la llave abierta.
--
-- QUÉ AUTOMATIZA Y QUÉ NO
--
-- Automatiza solo lo que no tiene ambigüedad de monto:
--   · la huérfana (sin equipo ni plan) se cancela;
--   · el split limpio equipo + plan se fusiona en una fila.
--
-- Manda a revisión, sin tocar:
--   · dos PLANES distintos activos — no se puede saber cuál paga;
--   · dos EQUIPOS distintos — es el caso multi-categoría, cerrado hasta MOD-3.
-- Esos salen listados en el reporte para que la escuela decida. El código no puede
-- adivinar cuál de dos cuotas es la buena, y equivocarse es plata de una familia.
--
-- LA CUOTA NO SE TOCA — Y ES DELIBERADO
--
-- El plan (§5 M3 punto 4) pide que la cuota salga de la fuente propia de la
-- superviviente, NO del máximo entre filas. Esta función no escribe `monthly_fee` en
-- absoluto, lo que satisface esa regla de la forma más fuerte posible:
--
--   · la superviviente es la fila del plan, así que su `monthly_fee` es o un override
--     deliberado (§2 dice que se respeta) o NULL/0;
--   · si es NULL o 0, la cascada de `open_month` ya cae al precio del plan
--     (`NULLIF(e.monthly_fee, 0)` convierte el 0 en NULL);
--   · la huérfana con monto rancio —el caso de los $180.000 contra un plan de
--     $150.000— se cancela, así que su cuota no llega a ninguna parte.
--
-- Escribir la cuota acá agregaría una tercera fuente de verdad sobre cuánto se cobra.
-- En vez de eso, el reporte muestra `cobro_estimado` con la MISMA cascada que
-- `open_month`, para que se vea qué va a pagar cada atleta después del merge.
--
-- ORDEN OBLIGATORIO: CANCELAR ANTES DE MOVER
--
-- Los índices únicos de inscripción son parciales (`WHERE status='active'`). Mover el
-- plan a la fila que se queda con la duplicada todavía activa revienta con 23505 — la
-- trampa ya documentada en 20260730000000 §4.
--
-- COBROS YA EMITIDOS: NO SE TOCAN
--
-- Si un atleta tiene dos cobros del mismo periodo, se listan en el reporte y los anula
-- la escuela. Es plata, y puede haber uno pagado.

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
               count(*) AS activas
        FROM public.enrollments e
        WHERE e.status = 'active'
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
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        -- Ambiguo: dos planes o dos equipos. No se decide por script.
        IF COALESCE(array_length(v_planes, 1), 0) > 1
           OR COALESCE(array_length(v_equipos, 1), 0) > 1 THEN
            v_revision := v_revision || jsonb_build_object(
                'school_id', v_grp.school_id,
                'atleta',    v_grp.subject,
                'activas',   v_grp.activas,
                'planes',    COALESCE(array_length(v_planes, 1), 0),
                'equipos',   COALESCE(array_length(v_equipos, 1), 0),
                'motivo',    CASE
                               WHEN COALESCE(array_length(v_planes, 1), 0) > 1
                                 THEN 'dos planes distintos: no se puede saber cuál paga'
                               ELSE 'dos equipos distintos: multi-categoría, cerrado hasta MOD-3'
                             END
            );
            CONTINUE;
        END IF;

        -- Superviviente: la que tiene plan; si ninguna lo tiene, la más antigua que
        -- al menos tenga equipo; si todas son huérfanas, la más antigua a secas.
        SELECT e.id INTO v_survivor
          FROM public.enrollments e
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject
         ORDER BY (e.offering_plan_id IS NOT NULL) DESC,   -- el plan gobierna el cobro
                  (e.team_id IS NOT NULL)          DESC,   -- antes que una huérfana
                  e.created_at ASC                         -- la más antigua: carga el historial
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
         WHERE e.status = 'active'
           AND e.school_id = v_grp.school_id
           AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) = v_grp.subject;

        v_acciones := v_acciones || jsonb_build_object(
            'school_id',  v_grp.school_id,
            'atleta',     v_grp.subject,
            'activas',    v_grp.activas,
            'sobrevive',  v_survivor,
            'se_cancelan', to_jsonb(v_descartes),
            'queda_con',  jsonb_build_object('team_id', v_team, 'offering_plan_id', v_plan)
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
            --    (ver el encabezado).
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
        'dry_run',          p_dry_run,
        'school_id',        p_school_id,
        'atletas_fusionados', v_fusionados,
        'filas_canceladas', CASE WHEN p_dry_run THEN NULL ELSE v_canceladas END,
        'a_revision',       jsonb_array_length(v_revision),
        'acciones',         v_acciones,
        'revision',         v_revision
    );
END;
$$;

COMMENT ON FUNCTION public.merge_split_enrollments(uuid, boolean) IS
    'Fusiona inscripciones activas partidas (equipo+plan del mismo atleta) en una sola. dry_run=true por defecto: reporta sin escribir. Cancela las descartadas ANTES de consolidar (los índices únicos son parciales sobre status=active). NO escribe monthly_fee: la cascada de open_month resuelve la cuota. Los casos ambiguos —dos planes o dos equipos distintos— NO se tocan y salen en `revision` para que los resuelva la escuela. Implementa M3 de docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md';

REVOKE ALL ON FUNCTION public.merge_split_enrollments(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_split_enrollments(uuid, boolean) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Cómo se usa ────────────────────────────────────────────────────────────
--
-- 1) Reporte, sin escribir nada (Dynasty):
--
--    SELECT public.merge_split_enrollments('2d509571-3238-4c04-ac3f-6dfe20539226', true)
--
--    Revisar `acciones` (qué fusionaría) y sobre todo `revision` (lo que NO toca).
--
-- 2) Antes de ejecutar, ver qué va a pagar cada uno después del merge. Es el mismo
--    preview del generador, y no persiste nada:
--
--    SELECT (public.preview_open_month('2d509571-3238-4c04-ac3f-6dfe20539226', 2026, 8) -> 'count')
--
-- 3) Ejecutar:
--
--    SELECT public.merge_split_enrollments('2d509571-3238-4c04-ac3f-6dfe20539226', false)
--
-- 4) Verificar que no quedan partidos automatizables:
--
--    SELECT school_id, COALESCE(child_id, user_id, unregistered_athlete_id) AS atleta, count(*)
--      FROM public.enrollments WHERE status = 'active'
--       AND school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--     GROUP BY 1, 2 HAVING count(*) > 1
--
--    Lo que quede debe coincidir con los que la función mandó a `revision`.
--
-- Vuelta atrás: las descartadas quedan `cancelled`, no borradas, conservando su
-- offering_plan_id y su team_id como registro de lo que había.
