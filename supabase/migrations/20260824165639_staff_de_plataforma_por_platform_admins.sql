-- "Staff de plataforma" deja de ser un rol y pasa a ser una fila en platform_admins.
--
-- POR QUÉ
--
-- 18 policies definían staff de plataforma como `profiles.role IN ('admin','super_admin')`,
-- en una rama SIN correlacionar con la fila: quien tuviera ese rol leía y escribía las
-- filas de todos. El alcance global es la INTENCIÓN (son tablas de plataforma); el
-- problema es que un rol se asigna por accidente y esto ya pasó:
-- `spiritfontibon@gmail.com`, DUEÑA de una escuela, tenía role='admin' y por esa rama
-- podía escribir `platform_config` — los parámetros de dinero de la plataforma— y leer
-- `vendor_profiles`, `vendor_balances` y `vendor_bank_accounts`.
--
-- Los roles ya se corrigieron (2026-08-21, ambas cuentas a 'school') y `platform_config`
-- y `school_payment_providers` ya se migraron. Esto cierra las 16 restantes.
--
-- Un rol se asigna por accidente. Una fila en platform_admins se concede a propósito.
--
-- QUÉ CAMBIA EXACTAMENTE
--
-- En cada policy se sustituye SOLO la rama de admin:
--
--   EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (...))
--   →  (SELECT public.is_super_admin())
--
-- Todo lo demás se preserva textualmente. Las que mezclan dueño + admin conservan su
-- rama de dueño intacta: `refunds` (quien pidió el reembolso y las partes de la orden),
-- `vendor_payouts` y `vendor_payment_providers` (`vendor_id = auth.uid()`),
-- `school_branches` (miembro de la escuela), `product_reviews` (quien compró y recibió).
--
-- Se envuelve en (SELECT …) para que el planner la evalúe UNA vez por query y no una
-- por fila.
--
-- DE PASO, 6 MENOS EN EL INVARIANTE I3
--
-- Seis de estas eran FOR ALL sin WITH CHECK, o sea que PostgreSQL validaba los INSERT
-- con la expresión de USING. Acá se les pone WITH CHECK explícito con la misma
-- expresión: mismo comportamiento, pero deja de contar como violación
-- (inventory_logs, product_brand_categories, product_brands, product_categories,
-- product_reviews "Admin modera", shipping_zones). El gate debería bajar de 59 a 53.
--
-- RADIO — SE VERIFICÓ QUE NINGUNA TABLA QUEDA HUÉRFANA
--
-- Se listaron TODAS las policies de cada tabla (las permisivas se suman con OR, trampa 1
-- del CLAUDE.md). Cada una conserva su camino para el actor legítimo: "Vendor lee su
-- balance", "Vendor lee sus settlements", "Vendor maneja sus cuentas bancarias",
-- "Marcas/Categorias visibles para todos", pbc_public_read, shipping_zones_public_read,
-- inventory_logs_vendor_read, vendor_profiles_select_own/_public, refunds_owner_insert,
-- y las 6 restantes de school_branches. `external_school_imports` queda solo para
-- plataforma a propósito: es lo que su nombre ya decía.
--
-- Las tablas del marketplace están VACÍAS (marketplace sin desplegar), salvo
-- vendor_profiles y vendor_balances con 30 filas. Por eso este es el momento barato.
--
-- VERIFICAR ANTES DE APLICAR — sin esto, nadie es staff de plataforma y estas 16
-- policies dejan de conceder nada a nadie:
--
--   select count(*) from public.platform_admins where is_active;   -- debe ser >= 1
--
-- Después de aplicar: npm run seguridad:invariantes

BEGIN;

-- ─── Solo plataforma (no tenían más rama que la de admin) ──────────────────

DROP POLICY IF EXISTS esi_super_admin_select ON public.external_school_imports;
CREATE POLICY esi_super_admin_select ON public.external_school_imports
    FOR SELECT USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admin lee settlements" ON public.settlements;
CREATE POLICY "Admin lee settlements" ON public.settlements
    FOR SELECT USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admin lee balances" ON public.vendor_balances;
CREATE POLICY "Admin lee balances" ON public.vendor_balances
    FOR SELECT USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admin lee todas las cuentas bancarias" ON public.vendor_bank_accounts;
CREATE POLICY "Admin lee todas las cuentas bancarias" ON public.vendor_bank_accounts
    FOR SELECT USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS vendor_profiles_admin_read ON public.vendor_profiles;
CREATE POLICY vendor_profiles_admin_read ON public.vendor_profiles
    FOR SELECT USING ((SELECT public.is_super_admin()));

-- ─── FOR ALL: además se les pone WITH CHECK explícito (I3) ─────────────────

DROP POLICY IF EXISTS inventory_logs_admin_all ON public.inventory_logs;
CREATE POLICY inventory_logs_admin_all ON public.inventory_logs
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS pbc_admin_write ON public.product_brand_categories;
CREATE POLICY pbc_admin_write ON public.product_brand_categories
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Solo admin modifica marcas" ON public.product_brands;
CREATE POLICY "Solo admin modifica marcas" ON public.product_brands
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Solo admin modifica categorias" ON public.product_categories;
CREATE POLICY "Solo admin modifica categorias" ON public.product_categories
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Admin modera reviews" ON public.product_reviews;
CREATE POLICY "Admin modera reviews" ON public.product_reviews
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS shipping_zones_admin_all ON public.shipping_zones;
CREATE POLICY shipping_zones_admin_all ON public.shipping_zones
    FOR ALL USING ((SELECT public.is_super_admin()))
        WITH CHECK ((SELECT public.is_super_admin()));

-- ─── Mezcladas: la rama del dueño se conserva textual ──────────────────────

DROP POLICY IF EXISTS refunds_owner_read ON public.refunds;
CREATE POLICY refunds_owner_read ON public.refunds
    FOR SELECT USING (
        auth.uid() = requested_by
        OR EXISTS (
            SELECT 1 FROM public.orders o
             WHERE o.id = refunds.order_id
               AND (o.user_id = auth.uid() OR o.vendor_id = auth.uid())
        )
        OR (SELECT public.is_super_admin())
    );

DROP POLICY IF EXISTS vendor_payouts_owner_read ON public.vendor_payouts;
CREATE POLICY vendor_payouts_owner_read ON public.vendor_payouts
    FOR SELECT USING (
        auth.uid() = vendor_id
        OR (SELECT public.is_super_admin())
    );

-- Esta tabla guarda access_token/webhook_secret EN CLARO (el camino vendor quedó
-- fuera del cifrado de Fase 0). La rama global permitía escribir la fila de OTRO
-- vendor, o sea redirigir su dinero. Vacía hoy, pero es la que más urgía cerrar.
DROP POLICY IF EXISTS vendor_payment_providers_owner_all ON public.vendor_payment_providers;
CREATE POLICY vendor_payment_providers_owner_all ON public.vendor_payment_providers
    FOR ALL USING (
        auth.uid() = vendor_id
        OR (SELECT public.is_super_admin())
    ) WITH CHECK (
        auth.uid() = vendor_id
        OR (SELECT public.is_super_admin())
    );

DROP POLICY IF EXISTS school_branches_read_policy ON public.school_branches;
CREATE POLICY school_branches_read_policy ON public.school_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_members sm
             WHERE sm.school_id = school_branches.school_id
               AND sm.profile_id = auth.uid()
        )
        OR (SELECT public.is_super_admin())
    );

DROP POLICY IF EXISTS "Solo verified purchasers crean reviews" ON public.product_reviews;
CREATE POLICY "Solo verified purchasers crean reviews" ON public.product_reviews
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1
                  FROM public.orders o
                  JOIN public.order_items oi ON oi.order_id = o.id
                 WHERE oi.product_id = product_reviews.product_id
                   AND o.user_id = auth.uid()
                   AND o.status = 'delivered'
            )
            OR (SELECT public.is_super_admin())
        )
    );

COMMIT;
