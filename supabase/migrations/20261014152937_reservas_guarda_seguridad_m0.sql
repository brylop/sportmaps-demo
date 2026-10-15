-- =============================================================================
-- 20261014152937_reservas_guarda_seguridad_m0.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014130128
-- Objetivo: cerrar dos huecos vivos en reservas de instalaciones (verificados en
--   la base el 2026-10-14, plan en docs/specs/reservas-canchas-f0-plan-migraciones.md §1.1):
--
--   1. facility_reservations: quien pidió la reserva podía cambiarse price,
--      amount_paid y payment_status (las policies de UPDATE no limitan columnas);
--      el atleta podía autoconfirmarse; el precio lo mandaba el cliente al insertar.
--   2. reservation_payments: cualquier autenticado podía insertar un pago con
--      status 'approved' y cualquier monto, incluso sobre una reserva AJENA; el
--      trigger sync_reservation_payment_status (SECURITY DEFINER) la marcaba pagada.
--
--   Más: anon tenía GRANT de escritura en ambas tablas, y tres policies FOR ALL
--   sin WITH CHECK (invariante I3).
--
-- Cómo: triggers de guarda (BEFORE) que aplican a TODAS las policies a la vez
-- (las policies se suman con OR; arreglar una no alcanza). El staff de la escuela
-- (user_staff_school_ids), el super admin, el service_role del BFF (auth.uid() nulo)
-- y los triggers internos (pg_trigger_depth() > 1) pasan sin cambios.
-- La revocación total de escritura directa va en F1 (M7), cuando el código use RPCs.
-- =============================================================================

BEGIN;

-- ── 1. anon fuera ────────────────────────────────────────────────────────────
REVOKE ALL ON public.facility_reservations FROM anon;
REVOKE ALL ON public.reservation_payments  FROM anon;

-- ── 2. Guarda de facility_reservations ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guarda_facility_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school uuid;
  v_hourly numeric;
  v_rental numeric;
  v_rental_enabled boolean;
  v_rate   numeric;
  v_hours  numeric;
  c_libres constant text[] := ARRAY['status','cancellation_reason','cancelled_at','notes','updated_at'];
BEGIN
  -- service_role / postgres (sin JWT de usuario) y triggers internos pasan.
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT f.school_id, f.hourly_rate, f.rental_rate, f.rental_enabled
    INTO v_school, v_hourly, v_rental, v_rental_enabled
    FROM public.facilities f
   WHERE f.id = NEW.facility_id;

  IF v_school IS NULL THEN
    RAISE EXCEPTION 'facility_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Staff de la escuela de la cancha (o super admin): sin restricciones nuevas.
  IF v_school = ANY (public.user_staff_school_ids()) OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- El cliente no decide estado, pago ni precio.
    v_rate := CASE
                WHEN NEW.resv_type::text = 'rental' AND v_rental_enabled AND v_rental IS NOT NULL
                  THEN v_rental
                ELSE COALESCE(v_hourly, 0)
              END;
    v_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;

    NEW.school_id      := v_school;
    NEW.status         := 'pending';
    NEW.amount_paid    := 0;
    NEW.payment_status := 'unpaid';
    NEW.approved_by    := NULL;
    NEW.approved_at    := NULL;
    NEW.price          := ROUND(v_rate * v_hours);
    RETURN NEW;
  END IF;

  -- UPDATE: solo cancelar la propia (y dejar motivo / nota).
  IF (to_jsonb(NEW) - c_libres) IS DISTINCT FROM (to_jsonb(OLD) - c_libres) THEN
    RAISE EXCEPTION 'forbidden_column: solo la escuela puede cambiar horario, precio o pago de una reserva'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (NEW.status = 'cancelled' AND OLD.status IN ('pending','confirmed')) THEN
    RAISE EXCEPTION 'forbidden_status: solo puedes cancelar tu reserva'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guarda_facility_reservations() FROM PUBLIC, anon, authenticated;

-- "aa" para que corra antes que trg_check_facility_overlap (orden alfabético):
-- el chequeo de solapamiento ve ya los valores forzados.
DROP TRIGGER IF EXISTS trg_aa_guarda_facility_reservations ON public.facility_reservations;
CREATE TRIGGER trg_aa_guarda_facility_reservations
  BEFORE INSERT OR UPDATE ON public.facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.guarda_facility_reservations();

-- ── 3. Guarda de reservation_payments ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guarda_reservation_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_owner  uuid;
  v_school uuid;
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT r.user_id, f.school_id
    INTO v_owner, v_school
    FROM public.facility_reservations r
    JOIN public.facilities f ON f.id = r.facility_id
   WHERE r.id = NEW.reservation_id;

  IF v_school IS NULL THEN
    RAISE EXCEPTION 'reservation_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_school = ANY (public.user_staff_school_ids()) OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- No staff: solo reporta un pago de SU reserva, que la escuela revisa.
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: la reserva no es tuya' USING ERRCODE = '42501';
  END IF;

  NEW.user_id          := auth.uid();
  NEW.school_id        := v_school;
  NEW.status           := 'pending_review';
  NEW.reviewed_by      := NULL;
  NEW.reviewed_at      := NULL;
  NEW.rejection_reason := NULL;
  NEW.cash_session_id  := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guarda_reservation_payments() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aa_guarda_reservation_payments ON public.reservation_payments;
CREATE TRIGGER trg_aa_guarda_reservation_payments
  BEFORE INSERT OR UPDATE ON public.reservation_payments
  FOR EACH ROW EXECUTE FUNCTION public.guarda_reservation_payments();

-- ── 4. I3: FOR ALL sin WITH CHECK → WITH CHECK = USING ───────────────────────
ALTER POLICY facility_resv_school_manage ON public.facility_reservations
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.school_members sm
     WHERE sm.school_id = facility_reservations.school_id
       AND sm.profile_id = auth.uid()
       AND sm.role = ANY (ARRAY['owner','admin','staff','school_admin'])
       AND sm.status = 'active'));

ALTER POLICY rp_school ON public.reservation_payments
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.school_members sm
     WHERE sm.school_id = reservation_payments.school_id
       AND sm.profile_id = auth.uid()
       AND sm.role = ANY (ARRAY['owner','admin','staff','school_admin'])
       AND sm.status = 'active'));

ALTER POLICY rp_school_all ON public.reservation_payments
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.school_members sm
     WHERE sm.school_id = reservation_payments.school_id
       AND sm.profile_id = auth.uid()
       AND sm.role = ANY (ARRAY['owner','admin','staff','school_admin'])
       AND sm.status = 'active'));

COMMIT;
