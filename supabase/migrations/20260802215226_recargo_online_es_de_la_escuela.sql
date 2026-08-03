-- =============================================================================
-- 20260802215226_recargo_online_es_de_la_escuela.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260801103846
-- Objetivo: fijar por escrito el modelo de cobro vigente — el recargo por pago
--   online es de la ESCUELA, no de SportMaps — y corregir el ledger que lo venía
--   anotando como una cuenta por cobrar contra ella.
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
-- CONTEXTO
--
-- El modelo original asumía que SportMaps era el agregador: recaudaba, retenía un
-- porcentaje y giraba el neto a la escuela. Eso nunca se construyó. Lo que corre hoy
-- es lo contrario: el Widget de Wompi cobra contra el comercio de la ESCUELA y el
-- bruto (mensualidad + recargo) entra completo a su cuenta. No hay split en la
-- pasarela ni proceso de dispersión — `transfer_status` no sale de 'pending' en
-- ningún punto del sistema.
--
-- Decisión (2026-08-02): se formaliza lo que ya ocurre en la práctica. El recargo es
-- de la escuela y está para compensarle la comisión que la pasarela le descuenta al
-- liquidar. SportMaps no participa de la transacción: monetiza la integración por
-- fuera, vía addon del plan.
--
-- Los nombres `sportmaps_fee` / `sportmaps_receives` quedan del modelo anterior. No
-- se renombran acá (hay código, tipos generados y respuestas de API colgando de
-- ellos); se documentan para que nadie los vuelva a leer como "esto es de SportMaps".

BEGIN;

-- ── 1. Semántica de las columnas ────────────────────────────────────────────

COMMENT ON COLUMN public.payment_links.sportmaps_fee IS
    'Recargo por pago online sumado a base_amount. Pese al nombre, NO es ingreso de '
    'SportMaps: es de la escuela y entra a su cuenta en la pasarela junto con el resto '
    'del pago, para compensarle la comisión que esta le descuenta.';

COMMENT ON COLUMN public.payment_links.fee_pct IS
    'Porcentaje del recargo congelado al crear el link. create-session lo revalida '
    'contra school_settings.online_fee_pct antes de reusar el link: si cambió, expira '
    'el link y crea uno nuevo (si no, el checkout cobraría la tarifa vieja hasta 72h).';

COMMENT ON COLUMN public.payments.sportmaps_fee IS
    'Recargo por pago online efectivamente cobrado. Ingreso de la ESCUELA, no de '
    'SportMaps. Ver comentario en payment_links.sportmaps_fee.';

COMMENT ON COLUMN public.payment_splits.school_receives IS
    'Monto que le queda a la escuela: el bruto completo, porque el dinero entra directo '
    'a su comercio. La pasarela descuenta su comisión al liquidar y eso no se refleja '
    'acá (la API de transacciones no la expone).';

COMMENT ON COLUMN public.payment_splits.sportmaps_receives IS
    'Siempre 0 bajo el modelo vigente: SportMaps no retiene nada de la transacción. Se '
    'conserva la columna por historial y por si se adopta un modelo con split real '
    '(MercadoPago application_fee o Wompi Pagos a Terceros).';

COMMENT ON COLUMN public.school_settings.online_fee_pct IS
    'Porcentaje de recargo que la escuela suma a los pagos online, para compensar la '
    'comisión de la pasarela. Lo recibe la escuela.';

COMMENT ON COLUMN public.school_settings.transfer_day IS
    'OBSOLETO. Venía del modelo agregador (SportMaps giraba fondos acumulados a la '
    'escuela), que nunca existió. Sin lectores desde 2026-08-02.';

-- ── 2. Corrección del ledger histórico ──────────────────────────────────────
--
-- NO mueve dinero: corrige una anotación. Esas filas venían registrando el recargo
-- como "a cobrar a SportMaps", generando una cuenta por cobrar contra la escuela que
-- nadie iba a liquidar — cuando el dinero ya había entrado a la cuenta de la escuela
-- y, según la decisión de arriba, siempre fue suyo.

UPDATE public.payment_splits
   SET school_receives    = gross_amount,
       sportmaps_receives = 0
 WHERE sportmaps_receives <> 0;

COMMIT;
