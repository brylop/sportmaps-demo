-- =============================================================================
-- 20261005173001_hour_bank_billing_rounding.sql
-- Autor: judegor99   Fecha: 2026-10-05   Versión anterior: 20261005135530
-- Objetivo: Dreamers y Academia Superior Bogotá manejan HORAS, no minutos
-- (ninguno de sus planes agenda medias horas: los bloques de coach_availability
-- son de 60 y 120 min). Hoy el banco descuenta minutos exactos (tiempo adentro
-- − gracia de entrada − gracia de salida), así que el saldo termina en
-- "1h 43min". Regla pedida por la escuela: pasada la gracia, cualquier exceso
-- sobre la clase cuenta como UNA HORA MÁS — se redondea hacia ARRIBA a hora
-- entera, después de restar las gracias.
--
-- Qué hace:
--   1. school_settings.hours_billing_rounding ('none' | 'hour_up'), default
--      'none' → NINGUNA escuela cambia de comportamiento hasta activarla.
--   2. hour_bank_billed_minutes(): ÚNICA fórmula del cobro. La usan el cron
--      (auto_close_stale_hour_bank_visits, abajo) y el BFF (closeHourBankVisit
--      en access-adms.ts y PATCH /hour-bank-visits/:id/correct) — antes la
--      fórmula estaba copiada en los tres sitios.
--   3. format_hour_bank_minutes(): mismo formato "2h" / "1h 30min" que el
--      frontend, para los textos de notificación generados en SQL.
--   4. auto_close_stale_hour_bank_visits() reemplazada (misma lógica que la
--      viva — verificada con pg_get_functiondef — solo cambia el cálculo del
--      cobro y el texto de la notificación de excedente).
--
-- ORDEN DE DESPLIEGUE (importante): esta migración es inerte por sí sola
-- (default 'none'). Aplicarla → desplegar el BFF → RECIÉN ENTONCES poner
-- hours_billing_rounding='hour_up' en las escuelas. Si se activa antes de que
-- el BFF nuevo esté arriba, el cron redondea y el cierre desde el torniquete
-- no, y el mismo atleta se cobra distinto según quién cierre la visita.
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

-- ── 1. Setting por escuela ───────────────────────────────────────────────────
-- Idempotente a propósito: las partes 1 (esta columna + funciones auxiliares) y
-- 2 (la RPC del cron) se aplicaron por separado con apply_migration el
-- 2026-10-04; este archivo completo sigue siendo la fuente de verdad del repo
-- y debe poder aplicarse en cualquier estado (base nueva, solo parte 1, o nada).
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS hours_billing_rounding text NOT NULL DEFAULT 'none'
        CONSTRAINT chk_school_settings_hours_billing_rounding
        CHECK (hours_billing_rounding IN ('none', 'hour_up'));

COMMENT ON COLUMN public.school_settings.hours_billing_rounding IS
    'Banco de horas: cómo se redondea lo facturado de una visita, DESPUÉS de restar las gracias de entrada/salida. none = minutos exactos. hour_up = hacia arriba a hora entera (cualquier exceso sobre la clase cuenta como una hora más).';

-- ── 2. Fórmula única del cobro ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hour_bank_billed_minutes(
    p_raw_minutes  integer,
    p_entry_grace  integer,
    p_exit_grace   integer,
    p_rounding     text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
             WHEN p_rounding = 'hour_up'
               THEN (CEIL(GREATEST(0, p_raw_minutes - p_entry_grace - p_exit_grace) / 60.0))::integer * 60
             ELSE GREATEST(0, p_raw_minutes - p_entry_grace - p_exit_grace)
           END;
$$;

COMMENT ON FUNCTION public.hour_bank_billed_minutes(integer, integer, integer, text) IS
    'Única fórmula de minutos facturados de una visita del banco de horas: max(0, raw − gracia_entrada − gracia_salida), y con p_rounding=hour_up redondeado hacia arriba a múltiplo de 60. Usada por el cron de auto-cierre y por el BFF.';

REVOKE ALL ON FUNCTION public.hour_bank_billed_minutes(integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hour_bank_billed_minutes(integer, integer, integer, text) TO service_role;

-- ── 3. Formato legible para textos generados en SQL ─────────────────────────
CREATE OR REPLACE FUNCTION public.format_hour_bank_minutes(p_minutes integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
             WHEN p_minutes IS NULL THEN NULL
             WHEN abs(p_minutes) / 60 = 0
               THEN (CASE WHEN p_minutes < 0 THEN '-' ELSE '' END) || (abs(p_minutes) % 60)::text || ' min'
             WHEN abs(p_minutes) % 60 = 0
               THEN (CASE WHEN p_minutes < 0 THEN '-' ELSE '' END) || (abs(p_minutes) / 60)::text || 'h'
             ELSE (CASE WHEN p_minutes < 0 THEN '-' ELSE '' END) || (abs(p_minutes) / 60)::text || 'h ' || (abs(p_minutes) % 60)::text || 'min'
           END;
$$;

COMMENT ON FUNCTION public.format_hour_bank_minutes(integer) IS
    'Mismo formato que formatMinutes del frontend (HourBankBalanceCard): 2h, 1h 30min, 45 min, -30 min.';

REVOKE ALL ON FUNCTION public.format_hour_bank_minutes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_hour_bank_minutes(integer) TO service_role;

-- ── 4. Cron de auto-cierre: usa la fórmula única ────────────────────────────
DROP FUNCTION public.auto_close_stale_hour_bank_visits();

CREATE FUNCTION public.auto_close_stale_hour_bank_visits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_visit             record;
    v_now               timestamptz := now();
    v_start_date        date;
    v_closing_instant   timestamptz;
    v_max_instant       timestamptz;
    v_exit_cutoff       timestamptz;
    v_cutoff            timestamptz;
    v_closed_count      integer := 0;
    v_review_count      integer := 0;
    v_last_seg_id       uuid;
    v_last_seg_exited   timestamptz;
    v_raw_minutes       integer;
    v_billed_minutes    integer;
    v_reservation_id    uuid;
    v_reservation_min   integer;
    v_move              jsonb;
    v_athlete_name      text;
BEGIN
    FOR v_visit IN
        SELECT hbv.id, hbv.enrollment_id, hbv.school_id, hbv.period_id, hbv.started_at,
               ss.hours_closing_time, ss.hours_max_visit_minutes,
               ss.hours_entry_grace_minutes, ss.hours_exit_grace_minutes,
               ss.hours_reentry_merge_minutes, ss.hours_billing_rounding
          FROM public.hour_bank_visits hbv
          JOIN public.school_settings ss ON ss.school_id = hbv.school_id
         WHERE hbv.status = 'open'
           AND ss.hours_plan_enabled = true
           FOR UPDATE OF hbv SKIP LOCKED
    LOOP
        SELECT id, exited_at
          INTO v_last_seg_id, v_last_seg_exited
          FROM public.hour_bank_visit_segments
         WHERE visit_id = v_visit.id
         ORDER BY entered_at DESC
         LIMIT 1;

        -- Mismo ancla de siempre para el cutoff de seguridad: el DÍA EN QUE
        -- ARRANCÓ la visita, no "hoy".
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

        -- Si ya hay salida real registrada, un cutoff mucho más corto también
        -- cuenta (fix 2026-09-05): salida + ventana de reingreso sin volver.
        IF v_last_seg_exited IS NOT NULL THEN
            v_exit_cutoff := v_last_seg_exited + make_interval(mins => v_visit.hours_reentry_merge_minutes);
            IF v_now >= v_exit_cutoff AND (v_cutoff IS NULL OR v_exit_cutoff < v_cutoff) THEN
                v_cutoff := v_exit_cutoff;
            END IF;
        END IF;

        IF v_cutoff IS NULL THEN
            CONTINUE; -- todavía no está stale, se deja abierta
        END IF;

        IF v_last_seg_exited IS NOT NULL THEN
            -- Caso normal: el atleta YA marcó salida real. Se cierra y factura.
            SELECT COALESCE(SUM(GREATEST(0, ROUND((EXTRACT(EPOCH FROM (exited_at - entered_at)) / 60)::numeric))), 0)::integer
              INTO v_raw_minutes
              FROM public.hour_bank_visit_segments
             WHERE visit_id = v_visit.id
               AND exited_at IS NOT NULL;

            v_billed_minutes := public.hour_bank_billed_minutes(
                v_raw_minutes,
                v_visit.hours_entry_grace_minutes,
                v_visit.hours_exit_grace_minutes,
                v_visit.hours_billing_rounding
            );

            SELECT id, minutes INTO v_reservation_id, v_reservation_min
              FROM public.hour_bank_reservations
             WHERE enrollment_id = v_visit.enrollment_id
               AND reservation_date = v_start_date
               AND status = 'confirmed'
             LIMIT 1;

            SELECT public.move_hour_bank(
                       v_visit.period_id,
                       CASE WHEN v_reservation_id IS NOT NULL THEN -v_reservation_min ELSE 0 END,
                       v_billed_minutes
                   )
              INTO v_move;

            IF v_reservation_id IS NOT NULL THEN
                UPDATE public.hour_bank_reservations
                   SET status = 'fulfilled', updated_at = now()
                 WHERE id = v_reservation_id;
            END IF;

            UPDATE public.hour_bank_visits
               SET status = 'closed', ended_at = v_last_seg_exited,
                   billed_minutes = v_billed_minutes, updated_at = now()
             WHERE id = v_visit.id;

            v_closed_count := v_closed_count + 1;

            -- D-10: solo notifica el excedente, sin bloqueo automático.
            -- Defensivo: un fallo acá no debe tumbar el cierre ya aplicado.
            IF COALESCE((v_move->>'available_minutes')::integer, 0) < 0 THEN
                BEGIN
                    SELECT COALESCE(p.full_name, c.full_name, ua.full_name, 'Atleta')
                      INTO v_athlete_name
                      FROM public.enrollments e
                      LEFT JOIN public.profiles p ON p.id = e.user_id
                      LEFT JOIN public.children c ON c.id = e.child_id
                      LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
                     WHERE e.id = v_visit.enrollment_id;

                    INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
                    SELECT s.owner_id, v_visit.school_id, 'hour_bank_overage',
                           '⏱️ Banco de horas — saldo excedido',
                           format('%s consumió %s y dejó el banco del período en %s (excedido).',
                                  COALESCE(v_athlete_name, 'Atleta'),
                                  public.format_hour_bank_minutes(v_billed_minutes),
                                  public.format_hour_bank_minutes((v_move->>'available_minutes')::integer)),
                           '/school/access-control'
                      FROM public.schools s
                     WHERE s.id = v_visit.school_id
                       AND s.owner_id IS NOT NULL;
                EXCEPTION WHEN OTHERS THEN
                    NULL; -- nunca revertir el cierre/facturación por un fallo de notificación
                END;
            END IF;
        ELSE
            -- Caso anómalo real: nunca marcó salida. Cutoff de siempre +
            -- revisión del owner (D-8), sin facturar todavía.
            UPDATE public.hour_bank_visit_segments
               SET exited_at = v_cutoff
             WHERE id = v_last_seg_id
               AND exited_at IS NULL;

            UPDATE public.hour_bank_visits
               SET status = 'pending_review', auto_closed = true,
                   ended_at = v_cutoff, updated_at = now()
             WHERE id = v_visit.id;

            v_review_count := v_review_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('closed', v_closed_count, 'pending_review', v_review_count);
END;
$$;

COMMENT ON FUNCTION public.auto_close_stale_hour_bank_visits() IS
    'Cron: para hour_bank_visits open, cierra+factura apenas se sepa la hora real '
    'de salida y pase hours_reentry_merge_minutes sin una nueva entrada. El cobro '
    'sale de hour_bank_billed_minutes() (gracias + redondeo por escuela, '
    'school_settings.hours_billing_rounding). Para quien nunca marcó salida, '
    'cutoff largo + pending_review (D-8). Restringida a service_role.';

-- DROP + CREATE pierde los grants: los default privileges del esquema le darían
-- EXECUTE a anon/authenticated, así que se revoca explícito (ver CLAUDE.md,
-- trampa 3).
REVOKE ALL ON FUNCTION public.auto_close_stale_hour_bank_visits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
