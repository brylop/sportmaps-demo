-- Pizarra IA: la firma vieja de compatibilidad grant_tactical_ai_credits(uuid, integer)
-- seguía ejecutable por `authenticated`. No es explotable (solo delega en la sobrecarga
-- nueva, que valida service_role / super admin), pero es superficie innecesaria.
--
-- Se revoca SOLO la firma vieja. La sobrecarga nueva (uuid, numeric, uuid, text) la llama
-- el BFF con el JWT del super admin (bff/src/routes/admin-tactical-ai.routes.ts) y trae su
-- propio gate: NO se toca.

REVOKE EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) TO service_role;
