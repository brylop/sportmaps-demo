-- =============================================================================
-- 20260821141913_hour_bank_reservations.sql
-- Autor: judegor99   Fecha: 2026-08-21   Versión anterior: 20260821133157
-- Objetivo: F4 de docs/specs/dreamers-banco-de-horas-torniquete.md — el guard
-- de saldo al reservar/cancelar.
--
-- Decisión de diseño (D-11, §7 del spec): la reserva es flexible — "hoy voy",
-- sin franja horaria — así que NO se fuerza sobre `session_bookings`, que exige
-- `session_id` con horario fijo en `attendance_sessions`. Se crea una tabla
-- propia y más chica: `hour_bank_reservations` (enrollment_id, fecha, minutos,
-- status). Nace separada de `session_bookings` a propósito — así el resto de
-- escuelas (que sí usan reservas con horario) no ven ningún cambio.
--
-- Dos RPCs, mismo espíritu que move_hour_bank: TODO el ciclo (abrir período +
-- validar saldo + reservar/liberar + escribir la fila) en una sola llamada,
-- una sola transacción — nada de "reservar en el RPC, insertar aparte desde
-- Node" que deje una ventana de reserva sin fila o fila sin reserva.
--   · reserve_hour_bank(enrollment_id, reservation_date, created_by)
--   · cancel_hour_bank_reservation(reservation_id)
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

-- =============================================================================
-- 1. hour_bank_reservations
-- =============================================================================

CREATE TABLE public.hour_bank_reservations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid NOT NULL REFERENCES public.schools(id),
    enrollment_id     uuid NOT NULL REFERENCES public.enrollments(id),
    period_id         uuid NOT NULL REFERENCES public.hour_bank_periods(id),
    reservation_date  date NOT NULL,
    minutes           integer NOT NULL,
    status            text NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'cancelled', 'fulfilled')),
    created_by        uuid REFERENCES public.profiles(id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT hour_bank_reservations_minutes_positive CHECK (minutes > 0)
);

COMMENT ON TABLE public.hour_bank_reservations IS
    'Reserva flexible sin franja horaria (D-11): "este atleta apartó saldo para '
    'una visita en reservation_date". NO referencia attendance_sessions/session_id '
    '— separada a propósito de session_bookings para no tocar el modelo de '
    'reserva con horario fijo del resto de la plataforma. confirmed = activa y '
    'ya reservada en hour_bank_periods.reserved_minutes; fulfilled = una visita '
    'real la consumió (closeHourBankVisit en access-adms.ts la encontró y '
    'liberó); cancelled = el padre/staff la canceló antes de usarla. Un solo '
    'escritor por transición: reserve_hour_bank / cancel_hour_bank_reservation, '
    'o el UPDATE a fulfilled desde access-adms.ts junto al mismo move_hour_bank '
    'que cierra la visita.';

CREATE INDEX hour_bank_reservations_enrollment_idx ON public.hour_bank_reservations (enrollment_id);
CREATE INDEX hour_bank_reservations_school_date_idx ON public.hour_bank_reservations (school_id, reservation_date, status);
CREATE INDEX hour_bank_reservations_period_idx ON public.hour_bank_reservations (period_id);

-- Búsqueda de "¿hay una reserva confirmada de esta inscripción hoy?" desde
-- closeHourBankVisit (F3) — mismo motivo que los otros índices de F1.
CREATE INDEX hour_bank_reservations_enrollment_date_confirmed_idx
    ON public.hour_bank_reservations (enrollment_id, reservation_date)
    WHERE status = 'confirmed';

ALTER TABLE public.hour_bank_reservations ENABLE ROW LEVEL SECURITY;

-- Mismo patrón de visibilidad que hour_bank_periods/visits/segments (F1):
-- staff ve todo lo de su escuela, el dueño de la inscripción ve lo suyo. Solo
-- SELECT — los escritores son las RPCs de abajo y access-adms.ts (F3), no hay
-- INSERT/UPDATE/DELETE directo desde el cliente.
CREATE POLICY "hour_bank_reservations_select" ON public.hour_bank_reservations
    FOR SELECT
    USING (
        school_id = ANY (public.user_staff_school_ids())
        OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.id = hour_bank_reservations.enrollment_id
              AND (e.user_id = auth.uid() OR public.is_parent_of_child(e.child_id))
        )
    );

REVOKE ALL ON public.hour_bank_reservations FROM anon;

-- =============================================================================
-- 2. reserve_hour_bank — abre período + valida saldo + reserva + inserta la
--    fila, todo en una sola transacción (una sola llamada = atómico de punta
--    a punta, sin ventana entre "ya reservé" y "ya quedó la fila").
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reserve_hour_bank(
    p_enrollment_id     uuid,
    p_reservation_date  date,
    p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id        uuid;
    v_block_minutes    integer;
    v_period_id        uuid;
    v_move             jsonb;
    v_reservation_id   uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.enrollments WHERE id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'enrollment_not_found');
    END IF;

    SELECT COALESCE(hours_session_block_minutes, 120)
      INTO v_block_minutes
      FROM public.school_settings
     WHERE school_id = v_school_id;

    v_period_id := public.get_or_open_hour_bank_period(p_enrollment_id);
    IF v_period_id IS NULL THEN
        RETURN jsonb_build_object('reserved', false, 'reason', 'not_hours_plan');
    END IF;

    -- El gate de saldo (D-2) vive en move_hour_bank — reserved_delta > 0 se
    -- rechaza solo si no alcanza. No se duplica esa lógica acá.
    v_move := public.move_hour_bank(v_period_id, v_block_minutes, 0);

    IF NOT (v_move->>'moved')::boolean THEN
        RETURN v_move || jsonb_build_object('reserved', false);
    END IF;

    INSERT INTO public.hour_bank_reservations
        (school_id, enrollment_id, period_id, reservation_date, minutes, status, created_by)
    VALUES
        (v_school_id, p_enrollment_id, v_period_id, p_reservation_date, v_block_minutes, 'confirmed', p_created_by)
    RETURNING id INTO v_reservation_id;

    RETURN v_move || jsonb_build_object(
        'reserved',        true,
        'reservation_id',  v_reservation_id,
        'minutes',         v_block_minutes
    );
END;
$$;

COMMENT ON FUNCTION public.reserve_hour_bank(uuid, date, uuid) IS
    'F4: abre/resuelve el período, valida saldo y reserva vía move_hour_bank, e '
    'inserta la fila en hour_bank_reservations — todo en una transacción. '
    'reserved=false + reason=insufficient_balance (con available_minutes) si no '
    'alcanza el saldo (D-2). Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.reserve_hour_bank(uuid, date, uuid) TO authenticated;

-- =============================================================================
-- 3. cancel_hour_bank_reservation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_hour_bank_reservation(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_res   record;
    v_move  jsonb;
BEGIN
    SELECT id, period_id, minutes, status
      INTO v_res
      FROM public.hour_bank_reservations
     WHERE id = p_reservation_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'not_found');
    END IF;

    IF v_res.status <> 'confirmed' THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'not_confirmed', 'status', v_res.status);
    END IF;

    -- Liberar nunca se bloquea (reserved_delta negativo, mismo espíritu D-3/D-10).
    v_move := public.move_hour_bank(v_res.period_id, -v_res.minutes, 0);

    UPDATE public.hour_bank_reservations
       SET status = 'cancelled', updated_at = now()
     WHERE id = p_reservation_id;

    RETURN v_move || jsonb_build_object('cancelled', true);
END;
$$;

COMMENT ON FUNCTION public.cancel_hour_bank_reservation(uuid) IS
    'F4: libera reserved_minutes vía move_hour_bank y marca la reserva '
    'cancelled. Solo actúa sobre reservas confirmed — no se puede cancelar dos '
    'veces ni cancelar una ya fulfilled. Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

GRANT EXECUTE ON FUNCTION public.cancel_hour_bank_reservation(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
