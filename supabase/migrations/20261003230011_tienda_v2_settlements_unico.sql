-- =============================================================================
-- 20261003230011_tienda_v2_settlements_unico.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230007
-- Objetivo: M-F0-5 de docs/specs/tienda-v2-f0-plan-migraciones.md. Hoy corren
--   DOS motores en cada pago (T7): split_order_payment (vendor_payouts por
--   orden, 5 % + 2,65 % sobre subtotal+IVA) y compute_settlements_for_order
--   (agrupa por vendor_id, sin redondeo, acredita saldo "por pagar al
--   vendedor"). Y release_settlements_for_vendor suma TODO lo que esté en
--   'processing', no solo lo recién liberado → una segunda llamada duplica el
--   saldo (T22).
--
--   1. settlements.status: enum settlement_status → text + CHECK (lección de
--      payments.status) con 'reversed'. collected_by ('seller'|'platform'),
--      payout_id, discount_amount, commission_rate (foto),
--      gateway_fee_estimated. Un settlement por ítem (UNIQUE order_item_id).
--   2. vendor_balances.commission_due: comisión que el vendedor le debe a
--      SportMaps cuando él cobra (collected_by='seller').
--   3. compute_settlements_for_order reescrita: por ítem, pesos enteros,
--      idempotente, comisión de la foto de order_items.commission_rate.
--      collected_by='seller' NO toca available/pending_balance.
--   4. release_settlements_for_vendor: suma solo las filas que liberó esta
--      llamada (T22) y solo collected_by='platform'.
--   5. _store_reverse_settlements(order): reverso al reembolso total.
--   6. vendor_payouts.kind ('order'|'batch') reemplaza CHECK one_origin.
--   7. split_order_payment queda NO-OP (mismo contrato, no crea payouts) para
--      que el BFF desplegado deje de correr el segundo motor desde ya; se
--      revoca admin_generate_pending_payouts a authenticated. DROP de ambas
--      en M-F0-9 (después del deploy del BFF).
--
--   DECISIONES PROVISIONALES (2026-10-03):
--   · D-5 = A: todo settlement nuevo nace collected_by='seller' (el vendedor
--     cobró con sus llaves). La comisión queda "adeudada" en
--     vendor_balances.commission_due; no se descuenta de ningún payout.
--   · D-3: comisión 0 % tienda escolar; externo commission_rate (foto).
--   · gateway_fee = ESTIMADO (platform_config.gateway_fee_rate sobre el bruto
--     del ítem; transferencia/efectivo = 0), gateway_fee_estimated=true. El
--     fee real de Wompi/MP queda para cuando el webhook lo traiga.
--   · Reembolso parcial: no reversa settlements (abierto: prorrateo).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DO $pre$
BEGIN
    IF to_regclass('public.stock_holds') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-4 (20261003230007): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. settlements ──────────────────────────────────────────────────────────
ALTER TABLE public.settlements ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.settlements ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.settlements ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_status_check
        CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'reversed'));

ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS collected_by          text NOT NULL DEFAULT 'seller',
    ADD COLUMN IF NOT EXISTS payout_id             uuid REFERENCES public.vendor_payouts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discount_amount       numeric(12,0) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS commission_rate       numeric(5,4),
    ADD COLUMN IF NOT EXISTS gateway_fee_estimated boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS reversed_at           timestamptz;
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_collected_by_check CHECK (collected_by IN ('seller', 'platform'));

CREATE UNIQUE INDEX IF NOT EXISTS settlements_order_item_uniq
    ON public.settlements (order_item_id) WHERE order_item_id IS NOT NULL;

COMMENT ON COLUMN public.settlements.collected_by IS
  'Quién cobró la venta. seller (D-5 = A): el vendedor cobró con sus llaves y platform_fee es comisión ADEUDADA a SportMaps. platform: SportMaps recaudó y le debe net al vendedor.';

-- ─── 2. vendor_balances.commission_due ───────────────────────────────────────
ALTER TABLE public.vendor_balances
    ADD COLUMN IF NOT EXISTS commission_due numeric(14,0) NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_balances
    ADD CONSTRAINT vendor_balances_commission_due_nonneg CHECK (commission_due >= 0);

COMMENT ON COLUMN public.vendor_balances.commission_due IS
  'Comisión que el vendedor le debe a SportMaps por ventas que cobró él (Σ platform_fee de settlements collected_by=seller no reversados).';

-- ─── 3. Un solo motor ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_settlements_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o        record;
    v_it       record;
    v_gw_rate  numeric := 0;
    v_rate     numeric;
    v_gross    numeric;
    v_fee      numeric;
    v_gwfee    numeric;
    v_net      numeric;
    v_id       uuid;
    v_count    integer := 0;
    v_total    numeric := 0;
    v_collect  text := 'seller';   -- D-5 = A (provisional)
BEGIN
    SELECT id, status, payment_method INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RETURN jsonb_build_object('error', 'order_not_found');
    END IF;

    IF v_o.payment_method IN ('wompi', 'mercadopago') THEN
        SELECT COALESCE((value ->> v_o.payment_method)::numeric, 0) INTO v_gw_rate
          FROM public.platform_config WHERE key = 'gateway_fee_rate';
        v_gw_rate := COALESCE(v_gw_rate, 0);
    END IF;

    FOR v_it IN
        SELECT oi.id, oi.vendor_profile_id,
               COALESCE(oi.line_total, round(oi.unit_price * oi.quantity)) AS gross,
               COALESCE(oi.line_total - oi.line_base, oi.tax_amount, 0)    AS tax,
               COALESCE(oi.discount_amount, 0)                             AS disc,
               oi.commission_rate
          FROM public.order_items oi
         WHERE oi.order_id = p_order_id AND oi.vendor_profile_id IS NOT NULL
         ORDER BY oi.id
    LOOP
        v_rate  := COALESCE(v_it.commission_rate, public._store_commission_rate(v_it.vendor_profile_id), 0);
        v_gross := round(v_it.gross);
        v_fee   := round(v_gross * v_rate);
        v_gwfee := round(v_gross * v_gw_rate);
        v_net   := GREATEST(v_gross - v_fee - v_gwfee, 0);

        INSERT INTO public.settlements (
            vendor_profile_id, order_id, order_item_id, gross_amount, platform_fee, gateway_fee,
            tax_amount, net_amount, status, collected_by, discount_amount, commission_rate,
            gateway_fee_estimated
        ) VALUES (
            v_it.vendor_profile_id, p_order_id, v_it.id, v_gross, v_fee, v_gwfee,
            round(v_it.tax), v_net, 'pending', v_collect, round(v_it.disc), v_rate, true
        )
        ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NULL THEN
            CONTINUE;   -- ya liquidado (idempotente)
        END IF;

        INSERT INTO public.vendor_balances (vendor_profile_id) VALUES (v_it.vendor_profile_id)
        ON CONFLICT (vendor_profile_id) DO NOTHING;

        IF v_collect = 'seller' THEN
            UPDATE public.vendor_balances
               SET commission_due = commission_due + v_fee,
                   total_earned   = total_earned + v_gross,
                   total_fees     = total_fees + v_fee + v_gwfee,
                   updated_at     = now()
             WHERE vendor_profile_id = v_it.vendor_profile_id;
        ELSE
            UPDATE public.vendor_balances
               SET pending_balance = pending_balance + v_net,
                   total_earned    = total_earned + v_gross,
                   total_fees      = total_fees + v_fee + v_gwfee,
                   updated_at      = now()
             WHERE vendor_profile_id = v_it.vendor_profile_id;
        END IF;

        v_count := v_count + 1;
        v_total := v_total + v_net;
    END LOOP;

    RETURN jsonb_build_object('settlements_created', v_count, 'total_net_amount', v_total,
                              'collected_by', v_collect);
END;
$fn$;

COMMENT ON FUNCTION public.compute_settlements_for_order(uuid) IS
  'Tienda v2 M-F0-5: UN motor. Un settlement por ítem, pesos enteros, idempotente. collected_by=seller (D-5 = A) acumula commission_due.';

-- ─── 4. Liberación sin duplicar (T22) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_settlements_for_vendor(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_physical integer;
    v_digital  integer;
    v_service  integer;
    v_count    integer := 0;
    v_net      numeric := 0;
BEGIN
    SELECT (value ->> 'physical')::int, (value ->> 'digital')::int, (value ->> 'service')::int
      INTO v_physical, v_digital, v_service
      FROM public.platform_config WHERE key = 'escrow_release_days';
    v_physical := COALESCE(v_physical, 7);
    v_digital  := COALESCE(v_digital, 1);
    v_service  := COALESCE(v_service, 1);

    WITH eligible AS (
        SELECT s.id
          FROM public.settlements s
          JOIN public.orders o ON o.id = s.order_id
         WHERE s.vendor_profile_id = p_vendor_profile_id
           AND s.status = 'pending'
           AND s.collected_by = 'platform'
           AND o.status = 'delivered'
           AND o.updated_at <= now() - make_interval(days =>
                 CASE COALESCE(o.fulfillment_type::text, 'physical')
                     WHEN 'digital' THEN v_digital
                     WHEN 'service' THEN v_service
                     ELSE v_physical END)
         FOR UPDATE OF s
    ), upd AS (
        UPDATE public.settlements s
           SET status = 'processing', updated_at = now()
          FROM eligible e
         WHERE s.id = e.id
        RETURNING s.net_amount
    )
    SELECT count(*), COALESCE(sum(net_amount), 0) INTO v_count, v_net FROM upd;

    IF v_count > 0 THEN
        UPDATE public.vendor_balances
           SET pending_balance   = GREATEST(pending_balance - v_net, 0),
               available_balance = available_balance + v_net,
               updated_at        = now()
         WHERE vendor_profile_id = p_vendor_profile_id;
    END IF;

    RETURN jsonb_build_object('released_count', v_count, 'released_amount', v_net);
END;
$fn$;

-- ─── 5. Reverso al reembolso total ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._store_reverse_settlements(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s   record;
    v_n   integer := 0;
BEGIN
    FOR v_s IN
        UPDATE public.settlements
           SET status = 'reversed', reversed_at = now(), updated_at = now()
         WHERE order_id = p_order_id AND status IN ('pending', 'processing')
        RETURNING vendor_profile_id, collected_by, gross_amount, platform_fee, gateway_fee, net_amount, status
    LOOP
        IF v_s.collected_by = 'seller' THEN
            UPDATE public.vendor_balances
               SET commission_due = GREATEST(commission_due - v_s.platform_fee, 0),
                   total_earned   = GREATEST(total_earned - v_s.gross_amount, 0),
                   total_fees     = GREATEST(total_fees - v_s.platform_fee - v_s.gateway_fee, 0),
                   updated_at     = now()
             WHERE vendor_profile_id = v_s.vendor_profile_id;
        ELSE
            UPDATE public.vendor_balances
               SET pending_balance = GREATEST(pending_balance - v_s.net_amount, 0),
                   total_earned    = GREATEST(total_earned - v_s.gross_amount, 0),
                   total_fees      = GREATEST(total_fees - v_s.platform_fee - v_s.gateway_fee, 0),
                   updated_at      = now()
             WHERE vendor_profile_id = v_s.vendor_profile_id;
        END IF;
        v_n := v_n + 1;
    END LOOP;
    RETURN jsonb_build_object('reversed', v_n);
END;
$fn$;

-- ─── 6. vendor_payouts por lote ──────────────────────────────────────────────
ALTER TABLE public.vendor_payouts
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'order';
ALTER TABLE public.vendor_payouts DROP CONSTRAINT IF EXISTS one_origin;
ALTER TABLE public.vendor_payouts
    ADD CONSTRAINT vendor_payouts_kind_check CHECK (kind IN ('order', 'batch')),
    ADD CONSTRAINT vendor_payouts_origin_check CHECK (
        (kind = 'order' AND ((order_id IS NOT NULL)::int + (transaction_id IS NOT NULL)::int) = 1)
     OR (kind = 'batch' AND order_id IS NULL AND transaction_id IS NULL));

-- ─── 7. Segundo motor apagado ────────────────────────────────────────────────
-- Mismo contrato que la viva (el BFF desplegado la sigue llamando hasta su
-- deploy): ya no crea vendor_payouts. DROP en M-F0-9.
CREATE OR REPLACE FUNCTION public.split_order_payment(
    p_order_id uuid, p_sportmaps_fee_pct numeric DEFAULT 5.0,
    p_provider_fee_pct numeric DEFAULT NULL::numeric, p_provider text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'payouts_created', 0,
                              'order_id', p_order_id, 'reason', 'single_engine_compute_settlements');
END;
$fn$;

REVOKE ALL ON FUNCTION public.split_order_payment(uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.split_order_payment(uuid, numeric, numeric, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_generate_pending_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_pending_payouts() TO service_role;

REVOKE ALL ON FUNCTION public.compute_settlements_for_order(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_settlements_for_vendor(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_reverse_settlements(uuid)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_settlements_for_order(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_settlements_for_vendor(uuid) TO service_role;

-- Lectura de settlements por quien administra la tienda (admins de la escuela
-- incluidos), además del dueño legacy. Sin escritura del cliente.
DROP POLICY IF EXISTS settlements_select_store ON public.settlements;
CREATE POLICY settlements_select_store ON public.settlements
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id));
REVOKE INSERT, UPDATE, DELETE ON public.settlements, public.vendor_balances, public.vendor_payouts FROM anon, authenticated;

COMMIT;
