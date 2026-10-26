-- =============================================================================
-- 20261025205957_payments_monto_servidor_despues_de_s4.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025205955
-- Objetivo: alinear la marca amount_source (20261025205952, «monto del
--   servidor», viva desde el 10-24/25) con S4 (20261010145241 +
--   20261013192856, viva desde el 10-10), que ya pone el monto del servidor en
--   los INSERT del navegador. Hoy las dos conviven mal:
--
--   1. ORDEN. Los BEFORE disparan en orden alfabético:
--        trg_zz_payments_monto_servidor  ('_' = 0x5F)   ← marca (02)
--        trg_zzy_monto_cobro_cliente     ('y' = 0x79)   ← S4 pone el monto
--      La marca mira el monto que mandó el NAVEGADOR y S4 lo reemplaza
--      después: una mensualidad que S4 dejó con la tarifa correcta puede quedar
--      'cliente' (sin auto-aprobación) y, al revés, la marca no ve el monto
--      final.
--   2. REGLA DISTINTA. La marca compara contra payments_montos_mensualidad_validos
--      (solo inscripciones ACTIVAS; orden monthly_fee > plan > equipo > ficha;
--      variante con descuento de hermanos). S4 tarifa con activa > pending >
--      cancelada y orden monthly_fee > equipo > plan, sin descuento de hermanos.
--      Consecuencias medibles:
--        · Primera mensualidad de una inscripción PENDING (justo la que
--          auto_approve_payment activa): S4 la tarifa, la marca no encuentra
--          tarifa → 'cliente' → nunca se auto-aprueba.
--        · Inscripción y seguro: S4 los tarifa con el plan; la marca los deja
--          'cliente' siempre.
--
-- Arreglo: la marca corre DESPUÉS de S4 (trg_zzyz_…: 'z' > '_' de trg_zzy_, y
--   'y' < 'z' de trg_zzz_, así que sigue ANTES de descuentos y pronto pago) y
--   usa la MISMA tarifa que S4 (_payments_cobro_cliente_normalizar):
--     · mensualidad (o categoría NULL, como S4): 'servidor' si el monto final
--       es la tarifa de S4.
--     · inscripción / seguro: 'servidor' si S4 encontró el valor en el plan
--       (deja offering_plan_id) y el monto es ese.
--     · resto (otro/abono, artículos, torneo, clase extra…): 'cliente'.
--   Si S4 no está (trigger apagado) o la normalizadora falla, la marca no
--   rechaza nada: queda 'cliente' (falla cerrado para la auto-aprobación).
--   Se conserva: monto <= 0 → PAYMENT_AMOUNT_INVALID; amount_source no se
--   cambia desde el navegador (PAYMENT_FIELD_LOCKED); staff y RPC/BFF no se
--   tocan. auto_approve_payment no cambia.
--
-- Radio (medido 2026-10-25, solo lectura, audit_logs de los últimos 30 días):
--   1.054 INSERT de payments: 539 sin usuario (cron/BFF/RPC), 494 de staff,
--   8 por QR (RPC), 13 directos del navegador de no-staff (todos Dynasty,
--   transferencia/«otro», escuela sin auto-aprobación). Con la regla viva: 11
--   'servidor' + 2 'cliente'; con esta: 12 'servidor' (las 12 mensualidades,
--   tarifadas por S4) + 1 'cliente' (el «otro»). 3 escuelas con
--   auto_approve_enabled (Besser, GYM RM, Escuela Demo): 0 auto-aprobaciones
--   en 30 días. Nadie queda bloqueado: ninguna de las dos reglas rechaza.
--
-- payments_montos_mensualidad_validos queda sin uso (no se borra: es de solo
--   lectura y solo responde al acudiente/atleta/staff del atleta).
--
-- Reversa: volver a crear el trigger viejo y la función de 20261025205952
--   (ver docs/migraciones-pendientes-2026-10-25/cobros-seguridad/LEEME.md).
-- =============================================================================
-- Recordatorios (CLAUDE.md): search_path fijo; GRANT/REVOKE explícitos.
-- =============================================================================

BEGIN;

-- DROP/CREATE TRIGGER sobre payments (tabla caliente) pide AccessExclusiveLock:
-- por debajo de deadlock_timeout (1 s) para fallar con 55P03 reintentable en vez
-- de colgar la app o deadlockear. Si falla, volver a correrlo.
SET LOCAL lock_timeout = '900ms';

-- S4 tiene que estar viva: esta marca se apoya en su tarifa.
DO $guard$
BEGIN
    IF to_regprocedure('public._payments_cobro_cliente_normalizar(public.payments)') IS NULL THEN
        RAISE EXCEPTION 'Falta S4 (_payments_cobro_cliente_normalizar): aplicar 20261010145241 antes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = 'public.payments'::regclass
                      AND tgname = 'trg_zzy_monto_cobro_cliente'
                      AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'Falta el trigger de S4 trg_zzy_monto_cobro_cliente';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'payments'
                      AND column_name = 'amount_source') THEN
        RAISE EXCEPTION 'Falta payments.amount_source: aplicar 20261025205952 antes';
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.fn_payments_monto_servidor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_cat  text;
    v_norm public.payments;
BEGIN
    -- RPC SECURITY DEFINER (postgres), BFF (service_role), SQL editor: no aplica.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Staff de la escuela del cobro: opera como hoy (mismo criterio que DIN-24 y S4).
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount_source IS DISTINCT FROM OLD.amount_source THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: amount_source' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- ── INSERT (ya pasó por S4: NEW.amount es el monto final) ───────────────
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = '42501',
            HINT = 'El valor del pago debe ser mayor que cero.';
    END IF;

    NEW.amount_source := 'cliente';
    v_cat := coalesce(NEW.payment_category, 'mensualidad');   -- misma lectura que S4

    IF v_cat IN ('mensualidad', 'inscripcion', 'seguro') THEN
        BEGIN
            -- La MISMA tarifa que acaba de aplicar S4. Re-calcularla (y no fiarse
            -- de que S4 corrió) mantiene la marca correcta si su trigger se apaga.
            v_norm := public._payments_cobro_cliente_normalizar(NEW);
            IF v_norm.amount = NEW.amount
               AND (v_cat = 'mensualidad' OR v_norm.offering_plan_id IS NOT NULL) THEN
                NEW.amount_source := 'servidor';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Sin tarifa o vínculo raro: no se rechaza aquí (eso es de S4); queda
            -- 'cliente' y lo revisa una persona.
            NEW.amount_source := 'cliente';
        END;
    END IF;

    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_payments_monto_servidor() IS
  'Marca amount_source en INSERT directos de quien no es staff, DESPUÉS de S4: ''servidor'' si el monto es la tarifa de _payments_cobro_cliente_normalizar (mensualidad; inscripción/seguro con plan), ''cliente'' en lo demás (auto_approve_payment no lo aprueba). Monto <= 0 se rechaza; amount_source no se cambia desde el navegador. SECURITY INVOKER a propósito.';

REVOKE ALL ON FUNCTION public.fn_payments_monto_servidor() FROM PUBLIC, anon, authenticated;

-- Renombrar = cambiar el orden: después de trg_zzy_monto_cobro_cliente (S4),
-- antes de trg_zzz_payments_descuentos_automaticos y trg_zzz_pronto_pago_servidor.
DROP TRIGGER IF EXISTS trg_zz_payments_monto_servidor ON public.payments;
DROP TRIGGER IF EXISTS trg_zzyz_payments_monto_servidor ON public.payments;
CREATE TRIGGER trg_zzyz_payments_monto_servidor
    BEFORE INSERT OR UPDATE OF amount_source ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_monto_servidor();

COMMIT;
