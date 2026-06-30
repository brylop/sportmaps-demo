-- ============================================================
-- Fix QR de inscripción: 404 en rpc/list_school_join_qrs
-- Causa: cache de esquema de PostgREST desactualizado tras aplicar
--   20260424000005_school_join_qr.sql (ese archivo no hace NOTIFY).
-- Las funciones YA existen; esto re-afirma los GRANT (idempotente) y
-- fuerza el reload del cache. Pegar en el SQL editor de Supabase.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_join_qr_public(text)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_qr_paid_conversion(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_school_join_qrs(uuid, boolean, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr(text, text, text, text, text, text, text, boolean, boolean, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
