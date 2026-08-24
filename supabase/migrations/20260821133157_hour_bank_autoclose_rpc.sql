-- =============================================================================
-- 20260821133157_hour_bank_autoclose_rpc.sql
-- Autor: judegor99   Fecha: 2026-08-21   Versión anterior: 20260821131412
-- Objetivo: F5 de docs/specs/dreamers-banco-de-horas-torniquete.md — la RPC que
-- corre el cron de auto-cierre (D-7). NO factura nada: solo corta visitas que
-- se quedaron 'open' de más y las manda a 'pending_review', para que el owner
-- (D-8) las corrija después. La facturación real (move_hour_bank) pasa recién
-- cuando el owner corrige — eso vive en el endpoint del BFF, no acá.
--
-- Dos gatillos, el que se cumpla primero (D-7):
--   1. Pasó la hora de cierre de la sede (school_settings.hours_closing_time),
--      anclada al DÍA EN QUE ARRANCÓ la visita — no "hoy" a secas, para que una
--      visita que empezó a las 8pm y sigue abierta pasada la medianoche no
--      espere hasta el cierre del día SIGUIENTE.
--   2. Tope de seguridad absoluto (hours_max_visit_minutes) desde started_at,
--      por si el cron falla un día o el cierre nunca llega a activarse.
--
-- FOR UPDATE ... SKIP LOCKED: si el flujo normal (access-adms.ts,
-- trackHourBankVisit/closeHourBankVisit) está cerrando esa misma visita justo
-- en este instante por una reentrada real, el cron la salta esta pasada y la
-- recoge en la siguiente si sigue open.
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

CREATE OR REPLACE FUNCTION public.auto_close_stale_hour_bank_visits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_visit            record;
    v_now              timestamptz := now();
    v_start_date       date;
    v_closing_instant  timestamptz;
    v_max_instant      timestamptz;
    v_cutoff           timestamptz;
    v_count            integer := 0;
BEGIN
    FOR v_visit IN
        SELECT hbv.id, hbv.started_at,
               ss.hours_closing_time, ss.hours_max_visit_minutes
          FROM public.hour_bank_visits hbv
          JOIN public.school_settings ss ON ss.school_id = hbv.school_id
         WHERE hbv.status = 'open'
           AND ss.hours_plan_enabled = true
           FOR UPDATE OF hbv SKIP LOCKED
    LOOP
        -- Ancla del cierre diario: el DÍA EN QUE ARRANCÓ la visita, no "hoy" —
        -- si arrancó a las 8pm y sigue abierta a las 00:30, el corte que aplica
        -- es el cierre de AYER (8pm + N horas), no esperar al cierre de hoy.
        v_start_date      := (v_visit.started_at AT TIME ZONE 'America/Bogota')::date;
        v_closing_instant := (v_start_date + v_visit.hours_closing_time) AT TIME ZONE 'America/Bogota';
        v_max_instant     := v_visit.started_at + make_interval(mins => v_visit.hours_max_visit_minutes);

        v_cutoff := NULL;
        IF v_now >= v_closing_instant THEN
            v_cutoff := v_closing_instant;
        END IF;
        IF v_now >= v_max_instant AND (v_cutoff IS NULL OR v_max_instant < v_cutoff) THEN
            v_cutoff := v_max_instant;
        END IF;

        IF v_cutoff IS NULL THEN
            CONTINUE; -- todavía no está stale, se deja abierta
        END IF;

        -- Cierra el último segmento si seguía abierto (se le "olvidó" salir).
        -- Si ya tenía exited_at (salió y nunca volvió), no se toca — el
        -- segmento ya refleja la hora real de salida.
        UPDATE public.hour_bank_visit_segments
           SET exited_at = v_cutoff
         WHERE visit_id = v_visit.id
           AND exited_at IS NULL;

        UPDATE public.hour_bank_visits
           SET status      = 'pending_review',
               auto_closed = true,
               ended_at    = v_cutoff,
               updated_at  = now()
         WHERE id = v_visit.id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.auto_close_stale_hour_bank_visits() IS
    'Cron (F5): corta a pending_review las hour_bank_visits open que pasaron la '
    'hora de cierre de su día de inicio o el tope de seguridad hours_max_visit_minutes. '
    'NO llama move_hour_bank — no factura nada, eso pasa cuando el owner corrige '
    '(D-8). FOR UPDATE SKIP LOCKED para no chocar con un cierre real concurrente '
    'desde access-adms.ts. Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
