-- Migration: 20260422000002_facility_reservations_public_insert.sql
-- Description: Permite a cualquier usuario autenticado enviar solicitud de
-- reserva de facility (status='pending'). La aprobacion sigue siendo del admin
-- de la escuela. Antes la RLS exigia ser school_member, impidiendo que un
-- visitante de Explorar enviara su solicitud.

DROP POLICY IF EXISTS "reservations_insert"               ON public.facility_reservations;
DROP POLICY IF EXISTS "reservations_insert_request"       ON public.facility_reservations;

-- Cualquier authenticated puede enviar su propia solicitud, solo como 'pending'.
CREATE POLICY "reservations_insert_request"
  ON public.facility_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.facilities f
      WHERE f.id = facility_reservations.facility_id
        AND f.status = 'active'
    )
  );

-- Mantener la policy de SELECT (el usuario ve sus propias + los school_members
-- ven las de su escuela). Si no existe, la creamos defensiva.
DROP POLICY IF EXISTS "reservations_select" ON public.facility_reservations;
CREATE POLICY "reservations_select"
  ON public.facility_reservations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.facilities f
      JOIN public.school_members sm ON sm.school_id = f.school_id
      WHERE f.id = facility_reservations.facility_id
        AND sm.profile_id = auth.uid()
        AND sm.status = 'active'
    )
  );

COMMENT ON POLICY "reservations_insert_request" ON public.facility_reservations IS
  'Cualquier usuario autenticado puede enviar solicitud de reserva (status=pending). El admin de la escuela debe aprobarla.';
