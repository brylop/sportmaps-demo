-- ============================================================
-- Fix para 20260511000008_payouts_functions_unconditional.sql
--
-- La migracion 008 falla con `42P13 cannot change return type
-- of existing function` porque la 005 ya creo request_payout(numeric)
-- con RETURNS public.vendor_payouts, y CREATE OR REPLACE no permite
-- cambiar el return type — hay que DROP primero.
--
-- Esta migracion DEBE aplicarse ANTES de re-ejecutar la 008.
-- Orden: 005 (aplicada) -> 008 (parcial, fallo en req_payout) ->
--        009 (este) -> re-aplicar 008 (ahora exitosa).
--
-- Las otras funciones del archivo 008 ya son CREATE OR REPLACE con
-- el mismo return type que la 005, asi que no necesitan DROP.
-- ============================================================

DROP FUNCTION IF EXISTS public.request_payout(numeric);
