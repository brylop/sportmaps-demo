-- =============================================================================
-- 20260930131401_seg26_seg15_revoke_release_settlements_y_join_qr.sql
-- Autor: brylop   Fecha: 2026-09-30   Versión anterior: 20260930080227
-- Objetivo: cerrar SEG-26 y la cola de SEG-15 que seguían abiertas en la base.
--
--   SEG-26 · release_settlements_all() es SECURITY DEFINER, no valida al que
--            llama, y conservaba EXECUTE para `authenticated`: cualquier cuenta
--            liberaba el saldo pending de TODOS los vendors en una llamada. El
--            único llamador es el BFF (vendor-payouts.routes.ts, POST
--            /admin/payouts/release-all), que ya chequea el rol y usa
--            service_role. Queda solo para service_role.
--
--   SEG-15 · create_school_join_qr(...) seguía ejecutable por `anon` y PUBLIC
--            (el REVOKE de 902d6512 no llegó a esta firma). Valida admin por
--            dentro con auth.uid(), así que el riesgo era bajo, pero no debe
--            depender de eso. La única llamada es SchoolJoinQRsPage.tsx, con
--            sesión: `authenticated` conserva EXECUTE.
--
-- Trampa 3 del CLAUDE.md: REVOKE FROM PUBLIC no alcanza, se revoca explícito.
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.release_settlements_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_settlements_all() TO service_role;

REVOKE ALL ON FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamp with time zone, text, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamp with time zone, text, numeric
) TO authenticated, service_role;

COMMIT;
