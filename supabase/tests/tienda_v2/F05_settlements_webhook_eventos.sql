-- M-F0-5 / M-F0-8 (tienda v2 F0) — un solo motor de liquidación, webhook
-- duplicado idempotente, comisión ADEUDADA (D-5 = A), T22 y eventos contables
-- a accounting_outbox una sola vez.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F05_settlements_webhook_eventos.sql
--
-- Casos: R23 confirm_order_payment repetido → idempotente (1 descuento, 1
-- kardex, 1 settlement por ítem, 1 commerce_sale); segundo pago con OTRA tx →
-- ALREADY_PAID + requires_review; settlement externo 10 % redondeado a peso,
-- collected_by='seller', commission_due = Σ platform_fee y available_balance
-- intacto (C10); split_order_payment ya no crea payouts (T7); R20
-- admin_generate_pending_payouts / split sin EXECUTE para authenticated;
-- T22 release_settlements_for_vendor no duplica; reembolso total → settlements
-- reversed + commerce_refund una vez; settlements.status es text con 'reversed'.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_vend',  (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);

insert into public.vendor_payment_providers (id, vendor_id, provider, public_key, sandbox, is_default, enabled)
values ('00000000-0000-4000-9000-0000000000a2', current_setting('qa.u_vend')::uuid, 'wompi', 'pub_test_QA_VEND_2', true, true, true);
insert into public.vendor_payment_provider_secrets (provider_id, private_key_enc, integrity_secret_enc, events_secret_enc)
values ('00000000-0000-4000-9000-0000000000a2', 'gcm:qa:priv', 'gcm:qa:int', 'gcm:qa:evt');
insert into public.store_payment_settings (vendor_profile_id, accept_wompi) values (current_setting('qa.vp_ok')::uuid, true);
insert into public.vendor_balances (vendor_profile_id) values (current_setting('qa.vp_ok')::uuid)
on conflict (vendor_profile_id) do nothing;
update public.vendor_balances set available_balance = 777, commission_due = 0, pending_balance = 0
 where vendor_profile_id = current_setting('qa.vp_ok')::uuid;

-- Balón ×1 (89.000) + guayos 40/Negro ×1 (210.000) = 299.000, vendedor externo 10 %.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.o', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1),
                           jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000005','quantity',1)),
         'pickup', null, null, null, 'wompi', null, null, null) ->> 'order_id'), true);
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb;
begin
  r1 := public.confirm_order_payment(current_setting('qa.o')::uuid, 'ref', 'tx-F05-1', 'CARD', 'wompi');
  r2 := public.confirm_order_payment(current_setting('qa.o')::uuid, 'ref', 'tx-F05-1', 'CARD', 'wompi');
  r3 := public.confirm_order_payment(current_setting('qa.o')::uuid, 'ref', 'tx-F05-1', 'CARD');  -- forma de wompi.ts (4 args con nombre)
  if not (r1->>'ok')::boolean or not (r2->>'idempotent')::boolean or not (r3->>'idempotent')::boolean then
    raise exception 'FALLO: R23 %, %, %', r1, r2, r3;
  end if;
  r4 := public.confirm_order_payment(current_setting('qa.o')::uuid, 'ref', 'tx-F05-OTRO', 'CARD', 'wompi');
  if (r4->>'ok')::boolean or r4->>'reason' <> 'ALREADY_PAID' then raise exception 'FALLO: segundo pago %', r4; end if;
  raise notice 'OK: R23 webhook repetido (5 y 4 args) idempotente; segundo pago con otra tx → ALREADY_PAID';

  r1 := public.split_order_payment(current_setting('qa.o')::uuid);
  if not (r1->>'skipped')::boolean then raise exception 'FALLO: split %', r1; end if;
  if exists (select 1 from public.vendor_payouts where order_id = current_setting('qa.o')::uuid) then
    raise exception 'FALLO: T7 el segundo motor creó payouts';
  end if;
  r1 := public.compute_settlements_for_order(current_setting('qa.o')::uuid);
  if (r1->>'settlements_created')::int <> 0 then raise exception 'FALLO: compute no idempotente %', r1; end if;
  raise notice 'OK: T7 split_order_payment no-op (0 payouts); compute_settlements repetido no duplica';
end $$;
reset role;

do $$
declare n int; s_fee numeric; b record; o record; ev jsonb;
begin
  select * into o from public.orders where id = current_setting('qa.o')::uuid;
  if o.status <> 'paid' or not o.requires_review or o.total_amount <> 299000 then
    raise exception 'FALLO: orden %', row_to_json(o);
  end if;
  if (select stock from public.products where id = '00000000-0000-4000-d000-000000000002') <> 19
     or (select stock from public.product_variants where id = '00000000-0000-4000-e000-000000000005') <> 3 then
    raise exception 'FALLO: descuento de stock duplicado o ausente';
  end if;
  select count(*) into n from public.inventory_logs where order_id = o.id and reason = 'order_paid';
  if n <> 2 then raise exception 'FALLO: kardex % filas (esperado 2)', n; end if;

  select count(*), sum(platform_fee) into n, s_fee from public.settlements where order_id = o.id;
  if n <> 2 or s_fee <> 29900 then raise exception 'FALLO: settlements n=% fee=%', n, s_fee; end if;
  if exists (select 1 from public.settlements where order_id = o.id
              and (collected_by <> 'seller' or platform_fee <> round(platform_fee) or gateway_fee <> round(gateway_fee)
                   or status <> 'pending')) then
    raise exception 'FALLO: settlement no es seller / no redondeado';
  end if;
  -- gateway fee estimado 2,5 % (platform_config.gateway_fee_rate.wompi)
  if (select sum(gateway_fee) from public.settlements where order_id = o.id) <> round(89000*0.025) + round(210000*0.025) then
    raise exception 'FALLO: fee de pasarela estimado';
  end if;

  select * into b from public.vendor_balances where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  if b.commission_due <> 29900 or b.available_balance <> 777 or b.pending_balance <> 0 then
    raise exception 'FALLO: C10 balance %', row_to_json(b);
  end if;
  raise notice 'OK: 2 settlements por ítem, comisión 10%% = 29900 ADEUDADA (commission_due), available intacto (777), pending 0';

  select count(*) into n from public.accounting_outbox where source_id = o.id;
  if n <> 3 then raise exception 'FALLO: eventos % (esperado sale+commission+gateway_fee)', n; end if;
  select payload into ev from public.accounting_outbox where idempotency_key = 'commerce_sale:' || o.id;
  if (ev->>'gross')::numeric <> 299000
     or (ev->>'gross')::numeric <> (ev->>'base')::numeric + (ev->>'vat')::numeric + (ev->>'shipping')::numeric
     or (ev->>'net')::numeric <> (ev->>'gross')::numeric - (ev->>'commission')::numeric - (ev->>'gateway_fee')::numeric
     or ev->>'settlement_mode' <> 'direct' or (ev->>'commission')::numeric <> 29900
     or ev->>'effective_date' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'FALLO: payload no cuadra %', ev;
  end if;
  if (select owner_type from public.accounting_outbox where idempotency_key = 'commerce_sale:' || o.id) <> 'vendor'
     or (select owner_id from public.accounting_outbox where idempotency_key = 'commerce_sale:' || o.id) <> current_setting('qa.vp_ok')::uuid then
    raise exception 'FALLO: dueño del evento';
  end if;
  raise notice 'OK: 3 eventos una sola vez (sale/commission/gateway_fee) del vendedor; gross = base+vat+shipping y net = gross−comisión−fee';
end $$;

-- ── R20: authenticated sin EXECUTE de los motores viejos / internos ─────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin perform public.admin_generate_pending_payouts(); raise exception 'FALLO: R20 admin_generate';
  exception when insufficient_privilege then null; end;
  begin perform public.split_order_payment(current_setting('qa.o')::uuid); raise exception 'FALLO: R20 split';
  exception when insufficient_privilege then null; end;
  begin perform public.confirm_order_payment(current_setting('qa.o')::uuid, 'r', 't', 'CARD', 'wompi'); raise exception 'FALLO: confirm por authenticated';
  exception when insufficient_privilege then null; end;
  begin perform public._settle_order_paid(current_setting('qa.o')::uuid, 'transfer', null, null, auth.uid(), 'seller'); raise exception 'FALLO: _settle';
  exception when insufficient_privilege then null; end;
  begin perform public.compute_settlements_for_order(current_setting('qa.o')::uuid); raise exception 'FALLO: compute';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.settlements where order_id = current_setting('qa.o')::uuid) <> 2 then
    raise exception 'FALLO: el vendedor no ve sus settlements';
  end if;
  raise notice 'OK: R20 authenticated sin EXECUTE (admin_generate, split, confirm, _settle, compute); el vendedor lee sus settlements';
end $$;
reset role;

-- ── T22: liberar dos veces no duplica (settlement collected_by='platform') ───
do $$
declare r1 jsonb; r2 jsonb; b numeric;
begin
  update public.settlements set collected_by = 'platform' where order_id = current_setting('qa.o')::uuid;
  update public.vendor_balances set pending_balance = (select sum(net_amount) from public.settlements where order_id = current_setting('qa.o')::uuid),
                                    available_balance = 0
   where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  -- ventana de devolución 0 días (trg_updated_at no deja retrasar updated_at)
  update public.platform_config set value = '{"physical":0,"digital":0,"service":0}'::jsonb where key = 'escrow_release_days';
  update public.orders set status = 'delivered' where id = current_setting('qa.o')::uuid;   -- dispara trg_release_on_delivered
  r1 := public.release_settlements_for_vendor(current_setting('qa.vp_ok')::uuid);
  r2 := public.release_settlements_for_vendor(current_setting('qa.vp_ok')::uuid);
  select available_balance into b from public.vendor_balances where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  if (r2->>'released_count')::int <> 0 or b <> (select sum(net_amount) from public.settlements where order_id = current_setting('qa.o')::uuid) then
    raise exception 'FALLO: T22 r1=% r2=% available=%', r1, r2, b;
  end if;
  raise notice 'OK: T22 segunda liberación suelta 0 y available = Σ net una sola vez (%)', b;
  -- vuelve al modelo D-5 = A para el reembolso
  update public.settlements set collected_by = 'seller', status = 'pending' where order_id = current_setting('qa.o')::uuid;
end $$;

-- ── Reembolso total → reverso + commerce_refund una vez ─────────────────────
do $$
declare v_ref uuid; r jsonb; n int;
begin
  update public.vendor_balances set commission_due = 29900 where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  insert into public.refunds (order_id, requested_by, reason, refund_amount, refund_pct, status)
  values (current_setting('qa.o')::uuid, current_setting('qa.u_padre')::uuid, 'QA reembolso total', 299000, 100, 'processing')
  returning id into v_ref;
  r := public.complete_refund(v_ref, 'void-qa', 'wompi');
  r := public.complete_refund(v_ref, 'void-qa', 'wompi');
  if not coalesce((r->>'idempotent')::boolean, false) then raise exception 'FALLO: complete_refund no idempotente %', r; end if;
  if exists (select 1 from public.settlements where order_id = current_setting('qa.o')::uuid and status <> 'reversed') then
    raise exception 'FALLO: settlements sin reversar';
  end if;
  if (select commission_due from public.vendor_balances where vendor_profile_id = current_setting('qa.vp_ok')::uuid) <> 0 then
    raise exception 'FALLO: commission_due no bajó';
  end if;
  select count(*) into n from public.accounting_outbox where idempotency_key = 'commerce_refund:' || v_ref
     and source_kind = 'refund' and (payload->>'gross')::numeric = 299000;
  if n <> 1 then raise exception 'FALLO: evento de reembolso %', n; end if;
  begin
    update public.settlements set status = 'bogus' where order_id = current_setting('qa.o')::uuid;
    raise exception 'FALLO: CHECK de settlements.status';
  exception when check_violation then null;
  end;
  raise notice 'OK: reembolso total → settlements reversed, commission_due 29900→0, 1 commerce_refund; status text+CHECK';
end $$;

rollback;
