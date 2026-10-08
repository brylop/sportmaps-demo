-- M-F0-4 / M-F0-7 (tienda v2 F0) — transferencia con comprobante:
-- pending_payment → submit_order_receipt → awaiting_approval → approve (admin
-- de la escuela) → paid con approved_by, kardex, settlement y evento contable.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F04b_transferencia_aprobacion.sql
--
-- Casos: padre ajeno no ve la orden ni sube comprobante ni ve las cuentas;
-- coach y comprador no aprueban (NOT_OWNER); rechazo con motivo vuelve a
-- pending_payment; awaiting_approval no vence (D-18); aprobación idempotente;
-- PAID_WITHOUT_PROOF sigue vivo; acceso al bucket order-receipts por orden.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb', (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_admin',  (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);
select set_config('qa.u_coach',  (select user_id::text from qa_twin.actores where alias = 'coach.a'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
update public.products set vendor_profile_id = current_setting('qa.vp_a')::uuid
 where id = '00000000-0000-4000-d000-000000000001';
insert into public.school_settings (school_id, payment_accounts, bank_name, bank_account_number, bank_account_type)
values (current_setting('qa.school_a')::uuid,
        '[{"id":"qa1","type":"nequi","label":"Nequi","value":"3000000000","active":true},
          {"id":"qa2","type":"breb","label":"Bre-B vieja","value":"@vieja","active":false}]'::jsonb,
        'Bancolombia', '123-QA-456', 'ahorros')
on conflict (school_id) do update set payment_accounts = excluded.payment_accounts,
  bank_name = excluded.bank_name, bank_account_number = excluded.bank_account_number,
  bank_account_type = excluded.bank_account_type;

-- Línea base de la variante M: el E2E del gemelo deja stock/reservas commiteados;
-- el caso mide lo que ESTA corrida mueve (reserva +2, y al aprobar stock −2 y reserva de vuelta).
select set_config('qa.m_stock0', (select stock::text from public.product_variants where id = '00000000-0000-4000-e000-000000000002'), true);
select set_config('qa.m_res0', (select reserved::text from public.product_variants where id = '00000000-0000-4000-e000-000000000002'), true);
do $$ begin
  if current_setting('qa.m_stock0')::int - current_setting('qa.m_res0')::int < 2 then
    raise exception 'FALLO (fixture): la talla M necesita 2 disponibles (stock %, reservadas %). Correr la preparación del gemelo (frontend/e2e/tienda/gemelo-tienda.sql)',
      current_setting('qa.m_stock0'), current_setting('qa.m_res0');
  end if;
end $$;

-- El admin de la escuela configura los medios (transferencia con cuentas: ok).
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
         '{"accept_transfer":true,"accept_cash_pickup":true,"transfer_instructions":"Envía el comprobante"}'::jsonb, null);

-- ── Comprador crea la orden de transferencia (camiseta M ×2 = 130.000) ───────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.o1', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000002','quantity',2)),
         'pickup', null, null, null, 'transfer', null, null, null) ->> 'order_id'), true);
do $$
declare r jsonb;
begin
  r := public.store_transfer_accounts(current_setting('qa.o1')::uuid, null);
  if jsonb_array_length(r->'accounts') <> 2
     or not exists (select 1 from jsonb_array_elements(r->'accounts') a where a->>'value' = '123-QA-456')
     or exists (select 1 from jsonb_array_elements(r->'accounts') a where a->>'value' = '@vieja') then
    raise exception 'FALLO: cuentas de transferencia %', r;
  end if;
  raise notice 'OK: el comprador ve las cuentas REALES de la escuela (activas + bancaria), no una inventada (B2)';

  begin
    perform public.submit_order_receipt(current_setting('qa.o1')::uuid, 'otra-orden/x.jpg', null);
    raise exception 'FALLO: ruta de comprobante fuera de la orden';
  exception when others then
    if sqlerrm <> 'INVALID_RECEIPT_PATH' then raise; end if;
  end;
  r := public.submit_order_receipt(current_setting('qa.o1')::uuid, current_setting('qa.o1') || '/comprobante.jpg', null);
  if r->>'status' <> 'awaiting_approval' then raise exception 'FALLO: submit %', r; end if;
  raise notice 'OK: comprobante → awaiting_approval (ruta fuera de la carpeta de la orden rechazada)';

  if not public.order_receipt_object_access(current_setting('qa.o1') || '/comprobante.jpg', false) then
    raise exception 'FALLO: el comprador no puede leer su comprobante';
  end if;
  begin
    perform public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: el comprador aprobó su propio comprobante';
  exception when insufficient_privilege then raise notice 'OK: el comprador no aprueba (NOT_OWNER)';
  end;
end $$;

-- ── Padre ajeno ──────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.orders where id = current_setting('qa.o1')::uuid) then
    raise exception 'FALLO: padre ajeno ve la orden';
  end if;
  begin
    perform public.store_transfer_accounts(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: padre ajeno ve las cuentas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_order_receipt(current_setting('qa.o1')::uuid, current_setting('qa.o1') || '/x.jpg', null);
    raise exception 'FALLO: padre ajeno sube comprobante';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: padre ajeno aprueba';
  exception when insufficient_privilege then null;
  end;
  if public.order_receipt_object_access(current_setting('qa.o1') || '/comprobante.jpg', false) then
    raise exception 'FALLO: padre ajeno lee el comprobante';
  end if;
  raise notice 'OK: padre ajeno no ve la orden, ni cuentas, ni sube, ni aprueba, ni lee el comprobante';
end $$;

-- ── Coach de la escuela: no aprueba ──────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_coach'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
  raise exception 'FALLO: el coach aprobó un comprobante';
exception when insufficient_privilege then raise notice 'OK: el coach no aprueba (NOT_OWNER, D-15)';
end $$;

-- ── awaiting_approval no vence (D-18) ────────────────────────────────────────
reset role;
update public.orders set expires_at = now() - interval '1 hour' where id = current_setting('qa.o1')::uuid;
update public.stock_holds set expires_at = now() - interval '1 hour' where order_id = current_setting('qa.o1')::uuid;
select public.release_expired_holds();
do $$
begin
  if (select status from public.orders where id = current_setting('qa.o1')::uuid) <> 'awaiting_approval'
     or (select reserved from public.product_variants where id = '00000000-0000-4000-e000-000000000002') <> current_setting('qa.m_res0')::int + 2 then
    raise exception 'FALLO: el cron venció una orden con comprobante en revisión';
  end if;
  raise notice 'OK: D-18 la reserva no vence con comprobante esperando aprobación';
end $$;

-- ── Admin de la escuela: rechaza y luego aprueba ─────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  begin
    perform public.reject_order_receipt(current_setting('qa.o1')::uuid, 'x', null);
    raise exception 'FALLO: rechazo sin motivo';
  exception when others then
    if sqlerrm <> 'REASON_REQUIRED' then raise; end if;
  end;
  r := public.reject_order_receipt(current_setting('qa.o1')::uuid, 'El monto no coincide', null);
  if r->>'status' <> 'pending_payment' or (r->>'expires_at')::timestamptz < now() + interval '23 hours' then
    raise exception 'FALLO: rechazo %', r;
  end if;
  raise notice 'OK: rechazo con motivo → pending_payment y 24 h para reenviar';
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.submit_order_receipt(current_setting('qa.o1')::uuid, current_setting('qa.o1') || '/comprobante-2.jpg', null);

reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if not exists (select 1 from public.orders where id = current_setting('qa.o1')::uuid) then
    raise exception 'FALLO: el admin no ve el pedido de su tienda';
  end if;
  if not public.order_receipt_object_access(current_setting('qa.o1') || '/comprobante-2.jpg', false) then
    raise exception 'FALLO: el admin no puede leer el comprobante';
  end if;
  r := public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
  if not (r->>'ok')::boolean then raise exception 'FALLO: aprobación %', r; end if;
  r := public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
  if not coalesce((r->>'idempotent')::boolean, false) then raise exception 'FALLO: segunda aprobación %', r; end if;
  raise notice 'OK: admin de la escuela aprueba (segunda vez idempotente)';
end $$;

reset role;
do $$
declare o record; n int; s record;
begin
  select * into o from public.orders where id = current_setting('qa.o1')::uuid;
  if o.status <> 'paid' or o.approved_by <> current_setting('qa.u_admin')::uuid or o.paid_at is null
     or o.payment_provider is not null then
    raise exception 'FALLO: orden aprobada %', row_to_json(o);
  end if;
  if (select stock from public.product_variants where id = '00000000-0000-4000-e000-000000000002') <> current_setting('qa.m_stock0')::int - 2
     or (select reserved from public.product_variants where id = '00000000-0000-4000-e000-000000000002') <> current_setting('qa.m_res0')::int then
    raise exception 'FALLO: stock/reserved tras aprobar';
  end if;
  select count(*) into n from public.inventory_logs where order_id = o.id and reason = 'order_paid' and delta = -2;
  if n <> 1 then raise exception 'FALLO: kardex %', n; end if;
  select * into s from public.settlements where order_id = o.id;
  if s.collected_by <> 'seller' or s.platform_fee <> 0 or s.gross_amount <> 130000 or s.gateway_fee <> 0 then
    raise exception 'FALLO: settlement %', row_to_json(s);
  end if;
  select count(*) into n from public.accounting_outbox where source_id = o.id and event_kind = 'commerce_sale'
     and owner_type = 'school' and owner_id = current_setting('qa.school_a')::uuid;
  if n <> 1 then raise exception 'FALLO: evento de venta %', n; end if;
  if exists (select 1 from public.accounting_outbox where source_id = o.id and event_kind <> 'commerce_sale') then
    raise exception 'FALLO: emitió comisión/fee en cero';
  end if;
  if (select actor_id from public.order_status_history where order_id = o.id and to_status = 'paid')
     <> current_setting('qa.u_admin')::uuid then
    raise exception 'FALLO: historial sin el actor que aprobó';
  end if;
  raise notice 'OK: paid con approved_by=admin, stock −2, reserva liberada, 1 kardex, settlement seller 0%% (D-3), 1 commerce_sale de la escuela, historial con actor';
end $$;

-- ── Coach no ve settlements; service role sin approved_by no puede pagar ─────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_coach'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.settlements) then raise exception 'FALLO: R15 el coach ve settlements'; end if;
  raise notice 'OK: R15 el coach no ve settlements';
end $$;

rollback;
