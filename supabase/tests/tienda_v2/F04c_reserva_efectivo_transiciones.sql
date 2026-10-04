-- M-F0-4 (tienda v2 F0) — reservas que vencen, pago tardío, efectivo al
-- retirar, cancelación y matriz de transiciones.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F04c_reserva_efectivo_transiciones.sql
--
-- Casos: reserva vencida libera stock (release_expired_holds) · pago tardío
-- con stock → paid · C5 pago tardío sin stock → payment_review
-- PAID_WITHOUT_STOCK, stock nunca negativo · efectivo: código inválido/válido →
-- paid + delivered · cancel_my_order libera · order_transition por actor y
-- código de retiro · seller_gateway_id = pasarela PROPIA del vendedor.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb', (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_vend',   (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);

-- Pasarela Wompi PROPIA del vendedor (secretos cifrados de mentira: solo se mira que existan).
insert into public.vendor_payment_providers (id, vendor_id, provider, public_key, sandbox, is_default, enabled)
values ('00000000-0000-4000-9000-0000000000a1', current_setting('qa.u_vend')::uuid, 'wompi', 'pub_test_QA_VENDEDOR', true, true, true);
insert into public.vendor_payment_provider_secrets (provider_id, private_key_enc, integrity_secret_enc, events_secret_enc)
values ('00000000-0000-4000-9000-0000000000a1', 'gcm:qa:priv', 'gcm:qa:int', 'gcm:qa:evt');
insert into public.store_payment_settings (vendor_profile_id, accept_wompi, accept_cash_pickup)
values (current_setting('qa.vp_ok')::uuid, true, true);

-- ── 1. Reserva Wompi que vence ───────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.oa', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000006','quantity',1)),
         'pickup', null, null, null, 'wompi', null, null, null) ->> 'order_id'), true);
reset role;
do $$
declare o record;
begin
  select * into o from public.orders where id = current_setting('qa.oa')::uuid;
  if o.seller_gateway_id <> '00000000-0000-4000-9000-0000000000a1' or o.seller_gateway_kind <> 'vendor'
     or o.payment_provider <> 'wompi' or o.wompi_reference <> o.reference or o.provider_reference <> o.reference
     or o.expires_at > now() + interval '46 minutes' then
    raise exception 'FALLO: orden Wompi %', row_to_json(o);
  end if;
  raise notice 'OK: orden Wompi atada a la pasarela PROPIA del vendedor (seller_gateway_id), reserva 45 min';
end $$;

update public.orders set expires_at = now() - interval '1 minute' where id = current_setting('qa.oa')::uuid;
do $$
declare r jsonb;
begin
  r := public.release_expired_holds();
  if (select status from public.orders where id = current_setting('qa.oa')::uuid) <> 'expired'
     or (select reserved from public.products where id = '00000000-0000-4000-d000-000000000006') <> 0
     or (select status from public.stock_holds where order_id = current_setting('qa.oa')::uuid) <> 'expired' then
    raise exception 'FALLO: la reserva vencida no liberó stock %', r;
  end if;
  raise notice 'OK: reserva vencida → orden expired, hold expired, reserved 1→0 (%)', r;
end $$;

-- Otro comprador reserva la última rodillera en efectivo.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.ob_json', public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000006','quantity',1)),
         'pickup', null, null, null, 'cash_pickup', null, null, null)::text, true);
reset role;

-- ── 2. C5: el pago de la orden vencida llega tarde y ya no hay stock ─────────
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.confirm_order_payment(current_setting('qa.oa')::uuid, 'x', 'tx-tarde-1', 'CARD', 'wompi');
  if (r->>'ok')::boolean or r->>'reason' <> 'PAID_WITHOUT_STOCK' then raise exception 'FALLO: C5 %', r; end if;
end $$;
reset role;
do $$
declare o record;
begin
  select * into o from public.orders where id = current_setting('qa.oa')::uuid;
  if o.status <> 'payment_review' or not o.requires_review or o.last_failure_reason <> 'PAID_WITHOUT_STOCK'
     or o.provider_transaction_id <> 'tx-tarde-1'
     or (select stock from public.products where id = '00000000-0000-4000-d000-000000000006') <> 1 then
    raise exception 'FALLO: C5 %', row_to_json(o);
  end if;
  raise notice 'OK: C5 pago tardío sin stock → payment_review PAID_WITHOUT_STOCK, stock sigue 1 (nunca negativo)';
end $$;

-- ── 3. Efectivo al retirar ───────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare ob jsonb := current_setting('qa.ob_json')::jsonb; r jsonb;
begin
  begin
    perform public.confirm_cash_pickup((ob->>'order_id')::uuid, '000000', null);
    raise exception 'FALLO: código inválido aceptado';
  exception when insufficient_privilege then
    if sqlerrm <> 'INVALID_PICKUP_CODE' then raise; end if;
  end;
  r := public.confirm_cash_pickup((ob->>'order_id')::uuid, ob->>'pickup_code', null);
  if r->>'status' <> 'delivered' then raise exception 'FALLO: efectivo %', r; end if;
  raise notice 'OK: efectivo: código inválido → INVALID_PICKUP_CODE; válido → paid + delivered';
end $$;
reset role;
do $$
declare o record;
begin
  select * into o from public.orders where id = (current_setting('qa.ob_json')::jsonb->>'order_id')::uuid;
  if o.approved_by <> current_setting('qa.u_vend')::uuid or o.paid_at is null
     or (select stock from public.products where id = '00000000-0000-4000-d000-000000000006') <> 0
     or (select reserved from public.products where id = '00000000-0000-4000-d000-000000000006') <> 0
     or (select count(*) from public.order_status_history where order_id = o.id and to_status in ('paid','delivered')) <> 2 then
    raise exception 'FALLO: efectivo estado final %', row_to_json(o);
  end if;
  raise notice 'OK: efectivo deja stock 0, reserved 0, approved_by = vendedor, historial paid→delivered';
end $$;

-- ── 4. Pago tardío CON stock → paid ──────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.oc', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
         'pickup', null, null, null, 'wompi', null, null, null) ->> 'order_id'), true);
reset role;
update public.orders set expires_at = now() - interval '1 minute' where id = current_setting('qa.oc')::uuid;
select public.release_expired_holds();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.confirm_order_payment(current_setting('qa.oc')::uuid, 'x', 'tx-tarde-ok', 'PSE', 'wompi');
  if not (r->>'ok')::boolean then raise exception 'FALLO: pago tardío con stock %', r; end if;
  if (select status from public.orders where id = current_setting('qa.oc')::uuid) <> 'paid'
     or (select payment_method_detail from public.orders where id = current_setting('qa.oc')::uuid) <> 'PSE'
     or (select payment_method from public.orders where id = current_setting('qa.oc')::uuid) <> 'wompi' then
    raise exception 'FALLO: estado tras pago tardío';
  end if;
  raise notice 'OK: pago tardío con stock disponible → paid (canal wompi, detalle PSE)';
end $$;
reset role;

-- ── 5. Transiciones ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.order_transition(current_setting('qa.oc')::uuid, 'preparing', null, null, null);
  raise exception 'FALLO: el comprador pasó a preparing';
exception when others then
  if sqlerrm <> 'TRANSITION_NOT_ALLOWED' then raise; end if;
  raise notice 'OK: comprador paid→preparing → TRANSITION_NOT_ALLOWED';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare code text;
begin
  perform public.order_transition(current_setting('qa.oc')::uuid, 'preparing', 'alistando', null, null);
  begin
    perform public.order_transition(current_setting('qa.oc')::uuid, 'shipped', null, null, null);
    raise exception 'FALLO: retiro en sede pasó a shipped';
  exception when others then
    if sqlerrm <> 'TRANSITION_NOT_ALLOWED' then raise; end if;
  end;
  perform public.order_transition(current_setting('qa.oc')::uuid, 'ready_for_pickup', null, null, null);
  begin
    perform public.order_transition(current_setting('qa.oc')::uuid, 'delivered', null, null, null);
    raise exception 'FALLO: entregado sin código';
  exception when insufficient_privilege then
    if sqlerrm <> 'INVALID_PICKUP_CODE' then raise; end if;
  end;
  raise notice 'OK: vendedor paid→preparing→ready_for_pickup; shipped en retiro y delivered sin código → rechazados';
end $$;
reset role;

-- ── 6. cancel_my_order libera ───────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; v_before int;
begin
  select reserved into v_before from public.products where id = '00000000-0000-4000-d000-000000000002';
  r := public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',3)),
                                'pickup', null, null, null, 'cash_pickup', null, null, null);
  r := public.cancel_my_order((r->>'order_id')::uuid, 'me arrepentí', null);
  if r->>'status' <> 'cancelled' then raise exception 'FALLO: cancelar %', r; end if;
  begin
    perform public.cancel_my_order(current_setting('qa.oc')::uuid, null, null);
    raise exception 'FALLO: canceló una orden pagada';
  exception when others then
    if sqlerrm <> 'INVALID_STATE' then raise; end if;
  end;
  raise notice 'OK: cancel_my_order de pending_payment → cancelled; una pagada no se cancela (es reembolso)';
end $$;
reset role;
do $$
begin
  if (select reserved from public.products where id = '00000000-0000-4000-d000-000000000002') <> 0 then
    raise exception 'FALLO: cancelar no liberó la reserva';
  end if;
  raise notice 'OK: la cancelación devolvió la reserva (reserved = 0)';
end $$;

-- ── 7. Webhook rechazado libera la reserva; anulación de un pagado solo marca ─
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.od', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',2)),
         'pickup', null, null, null, 'wompi', null, null, null) ->> 'order_id'), true);
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.store_order_payment_failed(current_setting('qa.od')::uuid, 'wompi', 'tx-declined', 'rejected', 'wompi_rejected · CARD');
  if r->>'action' <> 'cancelled' or r->>'status' <> 'cancelled'
     or (select reserved from public.products where id = '00000000-0000-4000-d000-000000000002') <> 0 then
    raise exception 'FALLO: rechazo de pasarela %', r;
  end if;
  r := public.store_order_payment_failed(current_setting('qa.oc')::uuid, 'wompi', 'tx-void', 'refunded', null);
  if r->>'action' <> 'flagged' or r->>'status' <> 'ready_for_pickup'
     or not (select requires_review from public.orders where id = current_setting('qa.oc')::uuid)
     or (select provider_transaction_id from public.orders where id = current_setting('qa.oc')::uuid) <> 'tx-tarde-ok' then
    raise exception 'FALLO: anulación de un cobrado %', r;
  end if;
  raise notice 'OK: webhook rechazado → cancelled y reserva liberada; anulación de un cobrado → solo revisión (no pisa la tx)';
end $$;
reset role;

rollback;
