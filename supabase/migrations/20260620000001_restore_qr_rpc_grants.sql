-- ============================================================
-- SPORTMAPS — Restaurar grants de los RPCs del QR de inscripción
-- Propósito:
--   La migración de hardening 20260513000005_linter_fase3bcd_revoke_rpcs
--   revocó EXECUTE sobre los RPCs del QR. Resultado: PostgREST devolvía
--   404 en /rest/v1/rpc/list_school_join_qrs (cuando el rol pierde EXECUTE,
--   PostgREST responde 404, no 403). La página de creación de QR —por donde
--   entra el padre de la escuela— quedaba rota.
--   Estos RPCs ya validan autorización internamente (is_super_admin /
--   is_school_admin), así que otorgar EXECUTE a authenticated es correcto.
-- Fecha: 2026-06-20
-- ============================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.list_school_join_qrs(uuid, boolean, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr(text, text, text, text, text, text, text, boolean, boolean, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_qr_paid_conversion(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text)                           TO anon, authenticated;

COMMIT;

-- Recargar el cache de PostgREST (fuera de la transacción)
NOTIFY pgrst, 'reload schema';
