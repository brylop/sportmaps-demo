-- M-F0-8 (tienda v2 F0) — factura electrónica de órdenes (T20).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F08_factura_orden_guard.sql
--
-- Casos: factura de orden pending_payment → 55000 INVOICE_ORDER_NOT_PAID;
-- orden 'paid' puesta sin prueba (camino legacy) → rechazada; orden pagada
-- con emisor equivocado (la escuela por un externo) → INVOICE_ORDER_WRONG_OWNER;
-- emisor correcto → ok; order_invoice_payload trae
-- líneas IVA incluido + línea de envío excluida (D-11); orders_pending_invoice
-- respeta tienda apagada y la factura ya emitida.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_vend',   (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);

insert into public.vendor_bank_accounts (vendor_profile_id, bank_name, account_type, account_number, account_holder, document_type, document_number)
values (current_setting('qa.vp_ok')::uuid, 'Banco QA', 'ahorros', '000-QA-F08', 'QA Deportes', 'NIT', '900000001');
insert into public.store_payment_settings (vendor_profile_id, accept_transfer) values (current_setting('qa.vp_ok')::uuid, true);

-- Orden con envío (Bogota DC 12.000) por transferencia.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.o', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
         'shipping', null, '{"departamento":"Bogota DC","direccion":"Cll 1 # 2-3"}'::jsonb, null,
         'transfer', null, null, null) ->> 'order_id'), true);
reset role;

do $$
declare p jsonb; n int;
begin
  -- pending_payment → no se factura
  begin
    insert into public.electronic_invoices (owner_type, owner_id, provider, order_id, reference_code, status)
    values ('vendor', current_setting('qa.vp_ok')::uuid, 'factus', current_setting('qa.o')::uuid, 'QA-F08-1', 'queued');
    raise exception 'FALLO: factura de orden sin pagar';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like 'INVOICE_ORDER_NOT_PAID%' then raise; end if;
  end;
  p := public.order_invoice_payload(current_setting('qa.o')::uuid);
  if (p->>'invoiceable')::boolean then raise exception 'FALLO: payload de orden sin pagar %', p; end if;
  raise notice 'OK: orden pending_payment → INVOICE_ORDER_NOT_PAID (55000) y payload no facturable';

  -- 'paid' sin prueba no se puede poner (trigger de M-F0-3), así que tampoco se factura.
  begin
    update public.orders set status = 'paid', paid_at = now() where id = current_setting('qa.o')::uuid;
    raise exception 'FALLO: paid sin prueba';
  exception when check_violation then null;
  end;

  -- Paga de verdad (aprobación del vendedor)
  update public.orders set status = 'awaiting_approval', receipt_path = current_setting('qa.o') || '/r.jpg'
   where id = current_setting('qa.o')::uuid;
  perform public._settle_order_paid(current_setting('qa.o')::uuid, 'transfer', null, 'transfer_receipt',
                                    current_setting('qa.u_vend')::uuid, 'seller');

  begin
    insert into public.electronic_invoices (owner_type, owner_id, provider, order_id, reference_code, status)
    values ('school', current_setting('qa.school_a')::uuid, 'factus', current_setting('qa.o')::uuid, 'QA-F08-2', 'queued');
    raise exception 'FALLO: la escuela facturó por un externo';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'INVOICE_ORDER_WRONG_OWNER' then raise; end if;
  end;
  insert into public.electronic_invoices (owner_type, owner_id, provider, order_id, reference_code, status)
  values ('vendor', current_setting('qa.vp_ok')::uuid, 'factus', current_setting('qa.o')::uuid, 'QA-F08-3', 'queued');
  raise notice 'OK: pagada con prueba: emisor ajeno → INVOICE_ORDER_WRONG_OWNER; el vendedor sí factura';

  p := public.order_invoice_payload(current_setting('qa.o')::uuid);
  if not (p->>'invoiceable')::boolean or p->>'owner_type' <> 'vendor' or jsonb_array_length(p->'lines') <> 2
     or (p->'lines'->0->>'unit_price')::numeric <> 89000 or (p->'lines'->0->>'tax_rate_pct')::numeric <> 19
     or (p->'lines'->1->>'unit_price')::numeric <> 12000 or not (p->'lines'->1->>'is_excluded')::boolean
     or (p->>'total')::numeric <> 101000 then
    raise exception 'FALLO: payload %', p;
  end if;
  raise notice 'OK: payload = producto IVA 19%% incluido (89000) + línea de envío excluida (12000), total 101000';

  select count(*) into n from public.orders_pending_invoice(now() - interval '1 day', 100) x where x = current_setting('qa.o')::uuid;
  if n <> 0 then raise exception 'FALLO: orden ya facturada sigue como pendiente'; end if;
  delete from public.electronic_invoices where order_id = current_setting('qa.o')::uuid;
  select count(*) into n from public.orders_pending_invoice(now() - interval '1 day', 100) x where x = current_setting('qa.o')::uuid;
  if n <> 1 then raise exception 'FALLO: orden pagada sin factura no aparece'; end if;
  update public.platform_config set value = '{"enabled": false}'::jsonb where key = 'store_enabled';
  select count(*) into n from public.orders_pending_invoice(now() - interval '1 day', 100);
  if n <> 0 then raise exception 'FALLO: con la tienda apagada hay candidatas'; end if;
  raise notice 'OK: orders_pending_invoice: excluye la ya facturada, incluye la pendiente, vacía con la tienda apagada';
end $$;

-- authenticated sin EXECUTE de las RPC de facturación
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin perform public.order_invoice_payload(current_setting('qa.o')::uuid); raise exception 'FALLO: payload por authenticated';
  exception when insufficient_privilege then null; end;
  begin perform public.orders_pending_invoice(now(), 1); raise exception 'FALLO: pending por authenticated';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: order_invoice_payload / orders_pending_invoice solo service_role';
end $$;

rollback;
