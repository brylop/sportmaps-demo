-- platform_config: quitar la lectura pública y atar la escritura a platform_admins.
--
-- QUÉ ESTABA MAL
--
-- La tabla tenía DOS policies que se sumaban con OR:
--
--   'Config visible publicamente'  SELECT  USING (true)
--   'Solo admin modifica config'   ALL     USING (profiles.role IN ('admin','super_admin'))
--
-- y `anon` con GRANT. Probado con `SET LOCAL ROLE anon`: devolvía las 4 filas.
-- O sea que la comisión por defecto de SportMaps, las tarifas negociadas con cada
-- pasarela (wompi 2.5%, mercadopago 2.9%, epayco 2.9%), los días de escrow y el
-- mínimo de liquidación eran legibles SIN AUTENTICARSE.
--
-- Es el caso de la trampa 1 del CLAUDE.md: endurecer una policy no sirve si queda
-- otra abierta sobre la misma tabla. Endurecer la de admin no cerraba nada mientras
-- viviera el USING(true).
--
-- Y encaja con la forma mecánica del invariante I1 (datos privados + USING(true) +
-- alcance a anon + GRANT a anon).
--
-- QUÉ QUEDA
--
--   · sin lectura para anon ni para clientes: nadie de la app la lee. Verificado —
--     no aparece en frontend/src (solo en los tipos generados) ni en bff/src.
--   · los ÚNICOS lectores son 5 funciones SECURITY DEFINER, que no pasan por RLS:
--     compute_settlements_for_order, release_settlements_for_vendor,
--     admin_generate_pending_payouts, vendor_payout_summary, invariantes_seguridad.
--   · la escritura pasa de `profiles.role` a `is_super_admin()`.
--
-- POR QUÉ SE CAMBIA EL CRITERIO DE ADMIN
--
-- Definir "staff de plataforma" con profiles.role resultó frágil: una cuenta DUEÑA
-- de escuela tenía role='admin' y por esa rama alcanzaba 18 policies globales,
-- entre ellas ESTA — es decir, podía escribir los parámetros de dinero de la
-- plataforma. El rol de esas cuentas ya se corrigió a 'school' (2026-08-21), pero
-- la lección es que un rol se asigna por accidente y una fila en platform_admins
-- se concede a propósito. Este es el primer paso de mover las 18 a is_super_admin().
--
-- VERIFICAR ANTES DE APLICAR — si platform_admins queda vacía, nadie puede editar:
--
--   select count(*) from public.platform_admins where is_active;   -- debe ser >= 1
--
-- No se revoca el GRANT de `authenticated`: el GRANT se evalúa ANTES que RLS, así
-- que quitárselo dejaría sin lectura también al super admin, que llega como
-- `authenticated`. El filtro correcto es la policy, no el GRANT.
--
-- Después de aplicar: npm run seguridad:invariantes

BEGIN;

-- La lectura pública. Es la que de verdad estaba abierta.
DROP POLICY IF EXISTS "Config visible publicamente" ON public.platform_config;

-- Escritura + lectura, solo staff de plataforma de verdad.
DROP POLICY IF EXISTS "Solo admin modifica config" ON public.platform_config;

CREATE POLICY platform_config_solo_plataforma
    ON public.platform_config
    FOR ALL
    USING ((SELECT public.is_super_admin()))
    -- WITH CHECK explícito: sin él, PostgreSQL valida los INSERT con la expresión
    -- de USING (invariante I3).
    WITH CHECK ((SELECT public.is_super_admin()));

-- Cinturón sobre la policy: anon no tiene nada que hacer acá.
REVOKE ALL ON public.platform_config FROM anon;

COMMIT;
