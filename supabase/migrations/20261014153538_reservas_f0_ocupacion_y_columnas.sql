-- =============================================================================
-- 20261014153538_reservas_f0_ocupacion_y_columnas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014153533
-- Objetivo: base de datos de SportMaps Canchas, fase F0 (M2, M4, M5, M6 del plan
--   docs/specs/reservas-canchas-f0-plan-migraciones.md):
--
--   M2  facility_occupancy: UNA tabla donde todo lo que ocupa una cancha
--       (alquiler, clase, evento, bloqueo, banco de horas) escribe su franja.
--       EXCLUDE USING gist hace imposible que dos ocupaciones activas se crucen,
--       venga de la app, la página pública, WhatsApp o recepción.
--   M4  columnas nuevas en facility_reservations (rango con zona horaria, hold,
--       idempotencia, canal, invitado, pago, snapshot de precio, recurrencia),
--       estados nuevos y guest_bookers.
--   M5  payments.payment_category += 'reserva'.
--   M6  expirar_holds(): creada, SIN programar (se programa en F1).
--
-- Nada de esto cambia el comportamiento de hoy: las tablas nuevas nacen vacías
-- (hoy hay 0 reservas futuras y 0 clases futuras con cancha, verificado en vivo)
-- y las columnas son nullable. El índice único por hora de inicio y el trigger
-- de solapamiento viejos se quedan hasta que las RPCs de F1 escriban ocupación.
-- =============================================================================

BEGIN;

-- ── M2. Ocupación única por cancha ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facility_occupancy (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid        NOT NULL REFERENCES public.schools(id),
  facility_id     uuid        NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  slot            tstzrange   NOT NULL,
  source_kind     text        NOT NULL CHECK (source_kind IN ('rental','class','event','blackout','hour_bank')),
  source_id       uuid        NOT NULL,
  status          text        NOT NULL CHECK (status IN ('hold','active','released')),
  hold_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_occupancy_slot_valido CHECK (NOT isempty(slot) AND lower(slot) IS NOT NULL AND upper(slot) IS NOT NULL),
  CONSTRAINT facility_occupancy_hold_con_vencimiento CHECK (status <> 'hold' OR hold_expires_at IS NOT NULL),
  -- '[)' por defecto en tstzrange: 8:00–9:00 y 9:00–10:00 NO chocan.
  CONSTRAINT facility_occupancy_sin_cruces
    EXCLUDE USING gist (facility_id WITH =, slot WITH &&)
    WHERE (status IN ('hold','active'))
);

COMMENT ON TABLE public.facility_occupancy IS
  'Ocupación única por cancha (SportMaps Canchas). Alquiler, clase, evento, bloqueo y banco de horas escriben aquí; el EXCLUDE impide cruces entre canales. Solo se escribe por RPC.';

CREATE INDEX IF NOT EXISTS idx_facility_occupancy_source ON public.facility_occupancy (source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_facility_occupancy_school ON public.facility_occupancy (school_id);
CREATE INDEX IF NOT EXISTS idx_facility_occupancy_holds  ON public.facility_occupancy (hold_expires_at) WHERE status = 'hold';

ALTER TABLE public.facility_occupancy ENABLE ROW LEVEL SECURITY;
-- Sin policies de cliente: la disponibilidad sale por RPC con columnas publicables.
REVOKE ALL ON public.facility_occupancy FROM PUBLIC, anon, authenticated;

-- ── M4. Invitados sin cuenta ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_bookers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone              text        NOT NULL,
  email              text,
  full_name          text        NOT NULL,
  document_type      text,
  document_id        text,
  verified_phone_at  timestamptz,
  verified_email_at  timestamptz,
  marketing_opt_in   boolean     NOT NULL DEFAULT false,
  linked_profile_id  uuid        REFERENCES public.profiles(id),
  linked_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_bookers_phone_unico UNIQUE (phone)
);

COMMENT ON TABLE public.guest_bookers IS
  'Quien reserva sin cuenta. Identidad = teléfono verificado (OTP por WhatsApp o número del bot). Se liga a profiles si después crea cuenta.';

ALTER TABLE public.guest_bookers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_bookers FROM PUBLIC, anon, authenticated;

-- ── M4. Columnas nuevas en facility_reservations ─────────────────────────────
ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS starts_at        timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at          timestamptz,
  ADD COLUMN IF NOT EXISTS hold_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key  text,
  ADD COLUMN IF NOT EXISTS channel          text,
  ADD COLUMN IF NOT EXISTS guest_booker_id  uuid REFERENCES public.guest_bookers(id),
  ADD COLUMN IF NOT EXISTS payment_id       uuid REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS price_snapshot   jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_id    uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by     uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS refund_status    text;

ALTER TABLE public.facility_reservations
  DROP CONSTRAINT IF EXISTS facility_reservations_channel_check,
  ADD  CONSTRAINT facility_reservations_channel_check
       CHECK (channel IS NULL OR channel IN ('app','public','whatsapp','admin','landing'));

ALTER TABLE public.facility_reservations
  DROP CONSTRAINT IF EXISTS facility_reservations_refund_status_check,
  ADD  CONSTRAINT facility_reservations_refund_status_check
       CHECK (refund_status IS NULL OR refund_status IN ('none','credit','pending_gateway','refunded','manual'));

-- Estados: se conservan los 4 actuales y se agregan los del motor de reservas.
ALTER TABLE public.facility_reservations
  DROP CONSTRAINT IF EXISTS facility_reservations_status_check,
  ADD  CONSTRAINT facility_reservations_status_check
       CHECK (status IN ('hold','pending','pending_payment','confirmed','pending_reconciliation',
                         'cancelled','expired','completed','no_show'));

ALTER TABLE public.facility_reservations
  DROP CONSTRAINT IF EXISTS facility_reservations_rango_check,
  ADD  CONSTRAINT facility_reservations_rango_check
       CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);

-- Idempotencia: repetir la misma llave en la misma escuela = la misma reserva.
CREATE UNIQUE INDEX IF NOT EXISTS uq_facility_reservations_idempotency
  ON public.facility_reservations (school_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facility_reservations_hold
  ON public.facility_reservations (hold_expires_at) WHERE status = 'hold';

-- Rango real para las filas históricas (hora de Colombia). Se hace con la guarda
-- de M0 activa: corre como postgres (auth.uid() nulo), así que no la dispara.
UPDATE public.facility_reservations
   SET starts_at = (reservation_date + start_time) AT TIME ZONE 'America/Bogota',
       ends_at   = (reservation_date + end_time)   AT TIME ZONE 'America/Bogota'
 WHERE starts_at IS NULL;

-- La guarda de M0 debe tratar las columnas nuevas como "no editables por el
-- cliente" sin cambios: compara to_jsonb(NEW) contra to_jsonb(OLD) completo,
-- así que las columnas nuevas quedan cubiertas automáticamente.

-- ── M5. Categoría de pago ────────────────────────────────────────────────────
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_category_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_category_check
  CHECK (payment_category IS NULL OR payment_category IN
    ('mensualidad','inscripcion','articulos','torneo','otro','seguro','excedente',
     'clase_extra','vacacional','viaje','reserva'));

-- ── M6. Expiración de holds (creada, sin programar) ──────────────────────────
CREATE OR REPLACE FUNCTION public.expirar_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_n integer;
BEGIN
  -- En lote, sin N+1 (regla de Disk IO). La correctitud NO depende de esto:
  -- la disponibilidad ignora holds vencidos aunque este job no haya corrido.
  WITH vencidas AS (
    UPDATE public.facility_reservations
       SET status = 'expired', updated_at = now()
     WHERE status = 'hold' AND hold_expires_at < now()
    RETURNING id
  )
  UPDATE public.facility_occupancy o
     SET status = 'released', updated_at = now()
    FROM vencidas v
   WHERE o.source_kind = 'rental' AND o.source_id = v.id AND o.status = 'hold';

  UPDATE public.facility_occupancy
     SET status = 'released', updated_at = now()
   WHERE status = 'hold' AND hold_expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.expirar_holds() FROM PUBLIC, anon, authenticated;

COMMIT;
