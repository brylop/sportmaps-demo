-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 10 de 14 (orden obligatorio).

-- =============================================================================
-- 20261008163338_tienda_codigo_retiro_regenerable.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008163336
-- Objetivo: el código de retiro de un pedido de la tienda solo vivía en el
--   navegador donde se compró (create_cart_order lo devuelve UNA vez y la base
--   guarda solo su hash). Si el comprador —socio adulto o acudiente— cambia de
--   celular o borra datos, no tiene cómo retirar. Esta RPC le deja generar uno
--   NUEVO desde cualquier dispositivo (invalida el anterior), solo para su
--   pedido de retiro ya pagado y sin entregar, con tope de veces y rastro en
--   order_status_history.
-- Depende de: tienda v2 F0 (orders.pickup_code_hash, order_status_history,
--   _store_actor). Contrato: docs/specs/tienda-v2-contrato-checkout.md §2.3.
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
-- Reglas:
--   · Actor: con JWT es auth.uid() (p_actor se ignora); con service role (BFF)
--     es p_actor. Igual que el resto de RPC de la tienda (_store_actor).
--   · Solo el comprador de la orden. Orden ajena o inexistente → NOT_FOUND
--     (no revela que existe).
--   · Solo retiro en sede (fulfillment_mode = 'pickup') → si no, NOT_A_PICKUP_ORDER.
--   · Solo paid / preparing / ready_for_pickup. Entregada, cancelada, vencida,
--     reembolsada o sin pagar → INVALID_STATE (DETAIL = estado).
--     Nota: el efectivo al retirar (cash_pickup en pending_payment) queda fuera
--     a propósito en esta versión: el código ahí es también la prueba del cobro.
--   · Tope: 3 regeneraciones por orden → PICKUP_CODE_LIMIT. Se cuentan en
--     order_status_history (una fila por regeneración, from = to = estado
--     actual, actor buyer); la fila de la orden queda bloqueada (FOR UPDATE)
--     mientras se cuenta, así dos clics simultáneos no se saltan el tope.
--   · El código anterior deja de servir en el mismo instante (se reemplaza el
--     hash; order_transition / confirm_cash_pickup comparan contra él).
--   · Nunca se guarda el código en claro: sha256(código || ':' || order_id),
--     el mismo formato que create_cart_order.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.regenerate_my_pickup_code(
    p_order_id uuid,
    p_actor    uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    c_max   CONSTANT integer := 3;
    c_note  CONSTANT text    := 'Código de retiro regenerado por el comprador';
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
    v_used  integer;
    v_code  text;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR v_o.user_id IS DISTINCT FROM v_actor OR v_o.vendor_profile_id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_o.fulfillment_mode IS DISTINCT FROM 'pickup' THEN
        RAISE EXCEPTION 'NOT_A_PICKUP_ORDER' USING ERRCODE = 'P0001';
    END IF;
    IF v_o.status NOT IN ('paid', 'preparing', 'ready_for_pickup') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;

    SELECT count(*) INTO v_used
      FROM public.order_status_history h
     WHERE h.order_id = v_o.id
       AND h.actor_role = 'buyer'
       AND h.from_status IS NOT DISTINCT FROM h.to_status
       AND h.note LIKE c_note || '%';
    IF v_used >= c_max THEN
        RAISE EXCEPTION 'PICKUP_CODE_LIMIT' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('max', c_max, 'used', v_used)::text;
    END IF;

    v_code := lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');

    UPDATE public.orders
       SET pickup_code_hash = encode(sha256(convert_to(v_code || ':' || v_o.id::text, 'UTF8')), 'hex'),
           updated_at = now()
     WHERE id = v_o.id;

    -- Auditoría: el cambio de código no cambia el estado, así que el trigger de
    -- historial no corre; la fila se escribe aquí (sin el código, nunca).
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    VALUES (v_o.id, v_o.status, v_o.status, v_actor, 'buyer',
            c_note || ' (' || (v_used + 1) || ' de ' || c_max || '); el anterior dejó de servir');

    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'status', v_o.status,
        'pickup_code', v_code,
        'regenerations_used', v_used + 1,
        'regenerations_left', c_max - (v_used + 1),
        'regenerations_max', c_max
    );
END;
$$;

COMMENT ON FUNCTION public.regenerate_my_pickup_code(uuid, uuid) IS
'Tienda: el comprador genera un código de retiro NUEVO para su pedido de retiro pagado y sin entregar (invalida el anterior). Máx. 3 por orden; auditado en order_status_history. Con JWT el actor es auth.uid(); con service role, p_actor.';

REVOKE ALL ON FUNCTION public.regenerate_my_pickup_code(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerate_my_pickup_code(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.regenerate_my_pickup_code(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_my_pickup_code(uuid, uuid) TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008163338', '20261008163338_tienda_codigo_retiro_regenerable', 'sql-editor 2026-10-08') on conflict (version) do nothing;
