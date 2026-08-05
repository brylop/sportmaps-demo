-- =============================================================================
-- 20260804204905_backfill_pagador_al_vincular_acudiente.sql
-- Autor: brylop   Fecha: 2026-08-05   Versión anterior: 20260804202714
-- Objetivo: cuando un menor queda vinculado a la cuenta de su acudiente, sus
--   cobros vivos heredan el pagador — para que la familia pueda pagar de una,
--   sin esperar a la siguiente apertura de mes ni a un backfill manual.
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
-- EL PROBLEMA
--
-- `payments.parent_id` se copia de `children.parent_id` EN EL MOMENTO DE GENERAR
-- el cobro (open_month, createPendingPayment, las vías del QR). Es una copia
-- congelada: si el acudiente vincula su cuenta DESPUÉS, el cobro se queda con
-- `parent_id` en NULL para siempre, y el guard anti-IDOR de `create-session`
-- responde 403 "No tienes permiso para pagar este registro" al propio acudiente.
-- La familia entra a pagar y no puede.
--
-- POR QUÉ AHORA, SI HOY NO HAY NINGÚN CASO
--
-- Medido en Dynasty el 2026-08-04: 422 menores activos, 221 con cuenta vinculada
-- y 201 con el acudiente solo en `parent_email_temp` (invitación sin aceptar).
-- Esos 201 tienen 201 cobros sin pagador por $30.320.000 — el 60% de la cartera
-- pendiente. Y los cobros huérfanos entre los YA vinculados son CERO.
--
-- Ese cero no es tranquilizador, es el reloj: significa que nadie aceptó su
-- invitación después de que se le generara el cobro. En cuanto la escuela salga a
-- perseguir a esas 201 familias — que es justo lo que tiene que hacer — cada una
-- que acepte va a quedar con un cobro huérfano hasta la siguiente apertura de mes.
-- 201 casos en potencia, todos evitables si el trigger está puesto ANTES.
--
-- POR QUÉ UN TRIGGER Y NO UN PARCHE AL FLUJO DE ACEPTACIÓN
--
-- `children.parent_id` pasa de NULL a poblado por varias vías: aceptar la
-- invitación, el registro por QR, una edición del staff. La lección de la
-- auditoría del 2026-08-04 es que cada vía nueva se olvida de algo (el alta
-- duplicaba identidades porque no consultaba las otras tablas; la rama
-- `unregistered_adult` insertaba sin verificar nada). Cubrir la invariante en la
-- base la hace válida para todas las vías, incluidas las que no existen todavía.
--
-- ALCANCE DELIBERADO
--
--   · Solo NULL → poblado. Un cambio de acudiente (A → B, p.ej. merge de cuentas
--     duplicadas) NO se toca: un cobro en `awaiting_approval` con comprobante que
--     subió A no debe pasar a nombre de B, y reasignar deuda entre adultos es una
--     decisión de negocio, no una invariante de datos.
--   · Solo cobros con `parent_id` en NULL. Nunca se pisa un pagador existente.
--   · Solo estados sobre los que la familia puede ACTUAR: pending,
--     awaiting_approval, overdue, partial, glosado.
--   · Los `paid` quedan FUERA a propósito. No hay nada que pagar, y las policies
--     de storage de `payment-receipts` autorizan la lectura cruzando
--     `payments.parent_id = auth.uid()` (mig 20260422000004): poblar el pagador en
--     un cobro viejo ya pagado le abriría el comprobante — que pudo subir la
--     escuela u otro adulto — a alguien que no lo subió. Sin beneficio funcional,
--     con costo de privacidad.
--   · `unregistered_athletes.linked_profile_id` tiene la MISMA clase de problema
--     (el caso Dai Vázquez / DAIMARIS VASQUEZ PEREZ), pero ahí no alcanza con
--     heredar el pagador: hay que trasplantar equipo, cuota, inscripción y cobros
--     de una identidad a la otra. Es una fusión, no un backfill. Queda aparte.
--
-- SECURITY DEFINER porque quien dispara esto es el acudiente aceptando su
-- invitación, y no tiene UPDATE sobre `payments`.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_backfill_payment_payer_on_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    UPDATE public.payments p
       SET parent_id  = NEW.parent_id,
           updated_at = now()
     WHERE p.child_id  = NEW.id
       AND p.parent_id IS NULL
       AND p.status IN ('pending', 'awaiting_approval', 'overdue', 'partial', 'glosado');

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_backfill_payment_payer_on_link() IS
  'Al vincular un menor a la cuenta de su acudiente, sus cobros vivos heredan el pagador. Sin esto el cobro queda con parent_id NULL para siempre y el guard anti-IDOR de create-session responde 403 al propio acudiente. Excluye los cobros pagados a proposito: no hay nada que pagar y poblar el pagador les abriria el comprobante via las policies de storage.';

DROP TRIGGER IF EXISTS trg_backfill_payment_payer_on_link ON public.children;

CREATE TRIGGER trg_backfill_payment_payer_on_link
    AFTER UPDATE OF parent_id ON public.children
    FOR EACH ROW
    WHEN (OLD.parent_id IS NULL AND NEW.parent_id IS NOT NULL)
    EXECUTE FUNCTION public.fn_backfill_payment_payer_on_link();

COMMENT ON TRIGGER trg_backfill_payment_payer_on_link ON public.children IS
  'Solo NULL -> poblado. Un cambio de acudiente (A -> B) no se toca: reasignar deuda entre adultos es decision de negocio, no invariante de datos.';

-- Backfill de una vez, para los que hayan quedado huérfanos antes del trigger.
-- Medido el 2026-08-04 en Dynasty esto afecta CERO filas — va igual porque es
-- idempotente y cubre la ventana entre esa medición y el momento de aplicar.
UPDATE public.payments p
   SET parent_id  = c.parent_id,
       updated_at = now()
  FROM public.children c
 WHERE c.id = p.child_id
   AND p.parent_id IS NULL
   AND c.parent_id IS NOT NULL
   AND p.status IN ('pending', 'awaiting_approval', 'overdue', 'partial', 'glosado');

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) El trigger quedó con su cláusula WHEN (sin ella se dispararía en cada cambio
--    de acudiente, que es justo lo que NO queremos):
--
--    SELECT tgname, pg_get_triggerdef(oid)
--      FROM pg_trigger
--     WHERE tgrelid = 'public.children'::regclass
--       AND tgname = 'trg_backfill_payment_payer_on_link'
--
-- 2) Cobros huérfanos de menores YA vinculados. Debe ser CERO, ahora y siempre:
--    es el guard de regresión del trigger. Está también como chequeo 9 en
--    scripts/consistency-checks.sql.
--
--    SELECT count(*) AS deberia_ser_cero
--      FROM public.payments p
--      JOIN public.children c ON c.id = p.child_id
--     WHERE p.parent_id IS NULL AND c.parent_id IS NOT NULL
--       AND p.status IN ('pending','awaiting_approval','overdue','partial','glosado')
--
-- 3) Prueba end-to-end sin tocar datos reales — dentro de una transacción que se
--    revierte. Elegir un menor sin acudiente vinculado que tenga cobro vivo:
--
--    BEGIN;
--      SELECT id, full_name FROM public.children
--       WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--         AND parent_id IS NULL AND is_active LIMIT 1;
--      -- con ese id, y cualquier profiles.id de prueba:
--      UPDATE public.children SET parent_id = '<un_profile_id>' WHERE id = '<child_id>';
--      SELECT id, concept, parent_id FROM public.payments WHERE child_id = '<child_id>';
--      -- los cobros vivos deben mostrar el parent_id nuevo
--    ROLLBACK;
--
-- Vuelta atrás: migración nueva con DROP TRIGGER + DROP FUNCTION. El backfill ya
-- aplicado no se revierte (y no habría por qué: poblar el pagador correcto no es
-- un daño).
