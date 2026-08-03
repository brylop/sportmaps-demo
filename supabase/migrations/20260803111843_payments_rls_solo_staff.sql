-- =============================================================================
-- 20260803111843_payments_rls_solo_staff.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260803110621
-- Objetivo: cerrar el acceso de acudientes y atletas a la cartera COMPLETA de su
--   club, y el hueco que les deja crear cobros a nombre de otras familias.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- HALLAZGO
--
-- Mismo patrón que `children` (mig 20260802224625): dos policies dicen "staff" en el
-- nombre pero usan `user_school_ids()`, que devuelve toda escuela donde el usuario tenga
-- `school_members` activo **sin mirar el rol**. Los acudientes y atletas tienen fila ahí.
--
--   "Payments: select staff"  SELECT  USING       (school_id = ANY (user_school_ids()))
--   "Payments: insert staff"  INSERT  WITH CHECK  (school_id = ANY (user_school_ids()))
--
-- Verificado el 2026-08-03 con logins reales sobre el club demo
-- (`scripts/demo-club-campestre/check-isolation.mjs`): un acudiente y dos atletas leyeron
-- los **226 cobros del club entero** — montos, conceptos y quién debe de todas las
-- familias. Quien no es miembro ve 0, así que el gate efectivo era "es miembro".
--
-- La de INSERT es peor que una fuga de lectura: habilita a un acudiente a **crear cobros
-- a nombre de cualquier atleta del club**.
--
-- QUÉ NO SE TOCA, Y POR QUÉ
--
--   · "Payments: select athlete" (user_id = auth.uid()) y "Payments: select parent"
--     (parent_id propio OR child_id entre sus hijos) ya cubren lo propio. El atleta
--     adulto NO pierde sus cobros — se verificó antes de escribir esto, porque las
--     migraciones del repo no mostraban la policy de athlete y la base sí la tiene.
--   · "Payments: insert parent" / "insert athlete": el checkout crea el cobro desde el
--     cliente (PaymentCheckoutModal), así que esa escritura es legítima.
--   · "Payments: update admin": usa user_school_ids() pero lo cruza con un EXISTS que
--     exige rol owner/admin/school_admin/super_admin. Ya está gateada.
--
-- LOS COACHES SIGUEN VIENDO LA CARTERA
--
-- `staff_school_ids()` excluye solo las membresías de consumo (parent/athlete), así que
-- 'coach' pasa. El diseño dice que un entrenador va "sin cartera", pero la vista
-- `school_athletes` expone `payment_status` leyendo esta tabla, así que sacarlos puede
-- vaciar pantallas de entrenador. Queda como decisión de producto aparte, no se cuela acá.

BEGIN;

-- Fallar rápido y con error claro en vez de colgarse bloqueando la app: esta base
-- sirve tráfico real (Dynasty está en producción sobre ella) y un DROP/CREATE POLICY
-- pide AccessExclusiveLock. Ya hubo un 40P01 el 2026-07-31 por no acotar esto.
SET LOCAL lock_timeout = '5s';

-- Cada DROP se pregunta primero al catálogo. `DROP POLICY IF EXISTS` evita el ERROR
-- pero NO el LOCK: pide AccessExclusiveLock aunque la policy no exista, y basta que
-- otra sesión esté leyendo `payments` para cruzar el orden de adquisición.
-- Receta de docs/... y de la migración 20260731160301.
DO $mig$
BEGIN
    -- ── SELECT ─────────────────────────────────────────────────────────────
    -- El hueco: cualquier miembro (incluido acudiente y atleta) leía la cartera
    -- completa del club. Pasa a exigir membresía de staff.
    IF EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'payments'
                  AND policyname = 'Payments: select staff') THEN
        DROP POLICY "Payments: select staff" ON public.payments;
    END IF;

    CREATE POLICY "Payments: select staff"
        ON public.payments
        FOR SELECT
        USING (school_id = ANY (public.staff_school_ids()));

    -- Legado de 20260217000001: mismo hueco con otro nombre. En esta base al
    -- 2026-08-03 no está, pero se limpia si aparece en otro ambiente.
    IF EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'payments'
                  AND policyname = 'School staff view school payments') THEN
        DROP POLICY "School staff view school payments" ON public.payments;
    END IF;

    -- ── INSERT ─────────────────────────────────────────────────────────────
    -- El hueco de escritura: un acudiente podía crear cobros a nombre de
    -- cualquier atleta del club.
    IF EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'payments'
                  AND policyname = 'Payments: insert staff') THEN
        DROP POLICY "Payments: insert staff" ON public.payments;
    END IF;

    CREATE POLICY "Payments: insert staff"
        ON public.payments
        FOR INSERT
        WITH CHECK (school_id = ANY (public.staff_school_ids()));
END $mig$;

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Las policies quedaron apuntando al helper nuevo:
--
--    SELECT policyname, cmd, qual, with_check FROM pg_policies
--     WHERE tablename = 'payments' AND policyname LIKE '%staff%'
--
-- 2) Prueba de comportamiento con logins reales (la que vale):
--
--    node scripts/demo-club-campestre/check-isolation.mjs
--
--    Esperado en la columna `cobros`: gerencia y coordinadores siguen en 226; el
--    acudiente pasa de 226 a solo los de sus hijos; los dos atletas pasan de 226 a
--    solo los propios; la externa sigue en 0.
--
-- 3) Un cobro sin pagador (parent_id y user_id en NULL, 584 en la base al 2026-08-03)
--    solo debe verse desde staff. El trigger trg_adopt_orphan_payments_on_child_link
--    le pone el parent_id cuando el acudiente se vincula, y ahí pasa a verlo.
--
-- Vuelta atrás: migración nueva con las dos policies apuntando de nuevo a
-- `user_school_ids()`. Sin pérdida de datos.
