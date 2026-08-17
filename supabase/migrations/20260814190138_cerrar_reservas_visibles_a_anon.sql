-- =============================================================================
-- 20260814190138_cerrar_reservas_visibles_a_anon.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814185532
-- Objetivo: dejar de exponer las reservas de instalaciones a internet.
--
-- ── El hallazgo ─────────────────────────────────────────────────────────────
-- La policy `facility_resv_public_read` era FOR SELECT TO public USING (true),
-- y `anon` tiene el privilegio SELECT sobre la tabla: 60 reservas legibles sin
-- autenticarse, con `user_id`, `notes`, `price`, `amount_paid`,
-- `payment_status`, `external_org_name` y `cancellation_reason`.
--
-- Es la tercera del mismo patrón encontrado hoy, después de payment_links y
-- school_staff: una policy `USING (true)` sobre una tabla con datos personales,
-- y la llave anónima viaja en el bundle del frontend.
--
-- ── Por qué se puede borrar sin romper nada ─────────────────────────────────
-- Verificado antes de aplicar:
--
--   · Los usuarios autenticados NO dependen de ella. Quedan vigentes
--     `facility_resv_select_own` (user_id = auth.uid()) y `reservations_select`
--     (propias + miembros activos de la escuela dueña de la instalación), que
--     es exactamente quien debe verlas.
--
--   · El flujo de reserva PÚBLICA no pasa por RLS: vive en el BFF
--     (routes/public-booking.routes.ts), que usa `service_role` y la ignora.
--
--   · No hay ninguna pantalla del frontend que lea reservas sin sesión. Los dos
--     lectores (FacilityReservationModal y useFacilityReservations) son de
--     contexto autenticado.
--
-- A diferencia de school_staff, acá NO hace falta una vista pública: la
-- disponibilidad que necesita mostrar la web pública ya la resuelve el BFF.
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

DROP POLICY IF EXISTS "facility_resv_public_read" ON public.facility_reservations;

COMMIT;
