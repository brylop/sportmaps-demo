-- M-F0-6 (tienda v2 F0) — reembolsos: sin escritura directa (T9/R16), RPC con actor
-- explícito, complete_refund idempotente (C8) y rama payment_id igual que antes.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F06a_refunds.sql
--
-- Casos del plan: comprador INSERT refunds → 42501 (R16); request_order_refund con
-- actor ajeno → forbidden; complete_refund dos veces → stock repuesto 1 vez (C8);
-- complete_refund sobre un refund de payment_id → mismo resultado que hoy
-- (refund completed + payments.status refunded, nada más).

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_b',     (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_ok',    (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_pend',  (select user_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);

-- Orden pagada de padre.a: 1 rodillera (d…006, stock 1 → 0 al pagar).
insert into public.orders (id, user_id, total_amount, vendor_profile_id, vendor_id)
values ('00000000-0000-4000-c000-0000000000e1', current_setting('qa.u_padre')::uuid, 60000,
        current_setting('qa.vp_ok')::uuid, current_setting('qa.u_ok')::uuid);
insert into public.order_items (order_id, product_id, quantity, unit_price, subtotal, vendor_profile_id)
values ('00000000-0000-4000-c000-0000000000e1', '00000000-0000-4000-d000-000000000006', 1, 60000, 60000,
        current_setting('qa.vp_ok')::uuid);
select public.confirm_order_payment('00000000-0000-4000-c000-0000000000e1', 'CART-QA-F06', 'tx-qa-f06', 'CARD', 'wompi');

-- ── R16: el comprador no inserta reembolsos (monto/estado libres) ────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  begin
    insert into public.refunds (order_id, requested_by, reason, refund_amount, status)
    values ('00000000-0000-4000-c000-0000000000e1', auth.uid(), 'quiero mi plata', 999999, 'completed');
    raise exception 'FALLO: R16 el comprador inserto un reembolso';
  exception when insufficient_privilege then raise notice 'OK: R16 INSERT refunds → 42501';
  end;
  begin
    perform public.request_order_refund('00000000-0000-4000-c000-0000000000e1', 'no me llego', auth.uid());
    raise exception 'FALLO: authenticated ejecuta request_order_refund';
  exception when insufficient_privilege then raise notice 'OK: request_order_refund solo service_role';
  end;
  r := public.request_refund('00000000-0000-4000-c000-0000000000e1', null, null, 'no me llego');
  if r->>'error' <> 'USE_request_order_refund' then raise exception 'FALLO: request_refund de orden: %', r; end if;
  raise notice 'OK: request_refund con orden → USE_request_order_refund';
end $$;

-- ── BFF (service role) ───────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb; v_refund uuid; v_stock int; v_logs int;
begin
  r := public.request_order_refund('00000000-0000-4000-c000-0000000000e1', 'no me llego', current_setting('qa.u_b')::uuid);
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: actor ajeno pidió reembolso: %', r; end if;
  raise notice 'OK: request_order_refund con actor ajeno → forbidden';

  r := public.request_order_refund('00000000-0000-4000-c000-0000000000e1', 'no', current_setting('qa.u_padre')::uuid);
  if r->>'error' <> 'reason_too_short' then raise exception 'FALLO: motivo corto aceptado: %', r; end if;

  r := public.request_order_refund('00000000-0000-4000-c000-0000000000e1', 'no me llego el producto', current_setting('qa.u_padre')::uuid);
  if not (r->>'ok')::boolean or (r->>'refund_amount')::numeric <> 60000 then raise exception 'FALLO: pedido de reembolso: %', r; end if;
  v_refund := (r->>'refund_id')::uuid;
  raise notice 'OK: el comprador pide reembolso de su orden pagada (monto = total de la base)';

  r := public.request_order_refund('00000000-0000-4000-c000-0000000000e1', 'otra vez lo mismo', current_setting('qa.u_padre')::uuid);
  if r->>'error' <> 'refund_already_open' then raise exception 'FALLO: segundo reembolso abierto: %', r; end if;
  raise notice 'OK: segundo pedido → refund_already_open';

  r := public.approve_order_refund(v_refund, current_setting('qa.u_padre')::uuid);
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: el comprador aprobó su propio reembolso: %', r; end if;
  r := public.approve_order_refund(v_refund, current_setting('qa.u_pend')::uuid);
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: otro vendedor aprobó: %', r; end if;
  raise notice 'OK: approve_order_refund por comprador u otro vendedor → forbidden';

  r := public.approve_refund(v_refund);
  if r->>'error' not in ('USE_approve_order_refund', 'unauthenticated') then raise exception 'FALLO: approve_refund vieja sobre orden: %', r; end if;

  r := public.approve_order_refund(v_refund, current_setting('qa.u_ok')::uuid);
  if not (r->>'ok')::boolean then raise exception 'FALLO: el vendedor no pudo aprobar: %', r; end if;
  raise notice 'OK: el vendedor dueño aprueba (processing)';

  -- C8: complete_refund dos veces → stock repuesto una vez
  select stock into v_stock from public.products where id = '00000000-0000-4000-d000-000000000006';
  r := public.complete_refund(v_refund, 'void-qa-1', 'wompi');
  r := public.complete_refund(v_refund, 'void-qa-1', 'wompi');
  if not coalesce((r->>'idempotent')::boolean, false) then raise exception 'FALLO: segunda llamada no idempotente: %', r; end if;
  if (select stock from public.products where id = '00000000-0000-4000-d000-000000000006') <> v_stock + 1 then
    raise exception 'FALLO: C8 stock repuesto % veces', (select stock from public.products where id = '00000000-0000-4000-d000-000000000006') - v_stock;
  end if;
  select count(*) into v_logs from public.inventory_logs
   where order_id = '00000000-0000-4000-c000-0000000000e1' and reason = 'returned';
  if v_logs <> 1 then raise exception 'FALLO: % filas de kardex returned', v_logs; end if;
  if (select status from public.orders where id = '00000000-0000-4000-c000-0000000000e1') <> 'refunded' then
    raise exception 'FALLO: la orden no quedo refunded';
  end if;
  raise notice 'OK: C8 complete_refund x2 → stock +1 una sola vez, 1 kardex returned, orden refunded';
end $$;

-- ── Rama payment_id (academia): igual que antes ──────────────────────────────
reset role;
insert into public.refunds (id, payment_id, requested_by, reason, refund_amount, status)
values ('00000000-0000-4000-c000-0000000000e2', '00000000-0000-4000-f000-000000000001',
        (select user_id from qa_twin.actores where alias = 'owner.a'), 'reembolso de prueba', 150000, 'processing');
select set_config('qa.pay_before', (select row_to_json(p)::text from (select status from public.payments where id = '00000000-0000-4000-f000-000000000001') p), true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
-- HALLAZGO PREEXISTENTE (no lo introduce M-F0-6): la rama payment_id de
-- complete_refund escribe payments.status='refunded', valor que NO está en
-- payments_status_check (pending, paid, overdue, failed, cancelled,
-- awaiting_approval, rejected, partial, glosado). Hoy en la viva falla con 23514
-- y deshace todo; M-F0-6 copia la rama tal cual, así que el resultado es el mismo.
-- Este caso fija ese comportamiento: si alguien arregla el CHECK de payments,
-- el caso falla y hay que actualizarlo a "refund completed + payment refunded".
do $$
declare r jsonb;
begin
  begin
    r := public.complete_refund('00000000-0000-4000-c000-0000000000e2', 'void-pay-1');
    raise exception 'FALLO: la rama payment_id cambio de comportamiento (antes: 23514 payments_status_check): %', r;
  exception when check_violation then
    if sqlerrm not like '%payments_status_check%' then raise; end if;
    raise notice 'OK: rama payment_id idéntica a la viva: 23514 payments_status_check (bug preexistente, ver nota)';
  end;
  if (select status from public.refunds where id = '00000000-0000-4000-c000-0000000000e2') <> 'processing'
     or (select status from public.payments where id = '00000000-0000-4000-f000-000000000001') <> 'paid' then
    raise exception 'FALLO: quedo escritura parcial tras el error';
  end if;
  raise notice 'OK: sin escritura parcial (refund sigue processing, pago sigue paid)';
end $$;

rollback;
