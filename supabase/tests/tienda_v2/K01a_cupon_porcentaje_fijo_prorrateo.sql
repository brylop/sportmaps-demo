-- K01a (tienda v2 F3b, mig. 20261013170543) — cupones por tienda: quién los
-- gestiona (RLS), % y monto fijo, tope en pesos, prorrateo por línea con el
-- residuo a la línea más cara, IVA y comisión sobre el NETO (§6.3, D-3), con
-- tax_rate 19 % y 0 %, y el evento contable / settlement / factura con el descuento.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/K01a_cupon_porcentaje_fijo_prorrateo.sql
begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb',(select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_vend',  (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_vpend', (select user_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.cat',     (select category_id::text from public.products where id = '00000000-0000-4000-d000-000000000002'), true);

insert into public.vendor_payment_providers (id, vendor_id, provider, public_key, sandbox, is_default, enabled)
values ('00000000-0000-4000-9000-0000000000b1', current_setting('qa.u_vend')::uuid, 'wompi', 'pub_test_QA_K01', true, true, true);
insert into public.vendor_payment_provider_secrets (provider_id, private_key_enc, integrity_secret_enc, events_secret_enc)
values ('00000000-0000-4000-9000-0000000000b1', 'gcm:qa:priv', 'gcm:qa:int', 'gcm:qa:evt');
insert into public.store_payment_settings (vendor_profile_id, accept_wompi, accept_cash_pickup)
values (current_setting('qa.vp_ok')::uuid, true, true)
on conflict (vendor_profile_id) do update set accept_wompi = true, accept_cash_pickup = true;

-- Producto exento (tax_rate 0) del mismo vendedor: borrador → activo (gotcha del publish gate).
insert into public.products (id, vendor_profile_id, name, description, price, stock, tax_rate, category_id, image_url, status, visibility, active)
values ('00000000-0000-4000-d000-0000000000f1', current_setting('qa.vp_ok')::uuid, 'QA K01 clase exenta',
        'Producto exento de IVA para la prueba de cupones del gemelo local (QA).', 50000, 10, 0,
        current_setting('qa.cat')::uuid, 'https://qa.invalid/k.jpg', 'draft', 'public', true);
update public.products set status = 'active' where id = '00000000-0000-4000-d000-0000000000f1';

-- ── 1. La tienda gestiona sus cupones (RLS con can_manage_store) ─────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_id uuid;
begin
  insert into public.store_coupons (vendor_profile_id, code, description, kind, value)
  values (current_setting('qa.vp_ok')::uuid, ' socios10 ', 'Socios del club', 'percent', 10)
  returning id into v_id;
  if (select code from public.store_coupons where id = v_id) <> 'SOCIOS10' then
    raise exception 'FALLO: el código no se normaliza a mayúsculas';
  end if;
  if (select created_by from public.store_coupons where id = v_id) is distinct from auth.uid() then
    raise exception 'FALLO: created_by no se sella con auth.uid()';
  end if;
  perform set_config('qa.c10', v_id::text, true);
  raise notice 'OK: la tienda crea SOCIOS10 (normalizado, auditado)';

  begin
    insert into public.store_coupons (vendor_profile_id, code, kind, value)
    values (current_setting('qa.vp_ok')::uuid, 'Socios10', 'fixed', 5000);
    raise exception 'FALLO: código repetido con otras mayúsculas';
  exception when unique_violation then raise notice 'OK: código único por tienda sin importar mayúsculas (23505)';
  end;

  insert into public.store_coupons (vendor_profile_id, code, kind, value)
  values (current_setting('qa.vp_ok')::uuid, 'FIJO20K', 'fixed', 20000) returning id into v_id;
  perform set_config('qa.cfix', v_id::text, true);
  insert into public.store_coupons (vendor_profile_id, code, kind, value, max_discount)
  values (current_setting('qa.vp_ok')::uuid, 'MITAD', 'percent', 50, 15000) returning id into v_id;
  perform set_config('qa.ctope', v_id::text, true);
  insert into public.store_coupons (vendor_profile_id, code, kind, value)
  values (current_setting('qa.vp_ok')::uuid, 'DIEZMIL', 'fixed', 10000);

  begin
    insert into public.store_coupons (vendor_profile_id, code, kind, value) values (current_setting('qa.vp_ok')::uuid, 'MUCHO', 'percent', 95);
    raise exception 'FALLO: porcentaje > 90 aceptado';
  exception when check_violation then raise notice 'OK: porcentaje > 90 → 23514';
  end;
  begin
    insert into public.store_coupons (vendor_profile_id, code, kind, value, funded_by)
    values (current_setting('qa.vp_ok')::uuid, 'SPORTMAPS', 'percent', 10, 'platform');
    raise exception 'FALLO: cupón financiado por SportMaps aceptado en v1';
  exception when check_violation then raise notice 'OK: v1 solo financia el vendedor (store_coupons_v1_solo_vendedor)';
  end;
  begin
    insert into public.store_coupons (vendor_profile_id, code, kind, value, applies_to, product_ids)
    values (current_setting('qa.vp_ok')::uuid, 'AJENO', 'percent', 10, 'products',
            array['00000000-0000-4000-d000-000000000007'::uuid]);   -- cuerda de vendedor.pend
    raise exception 'FALLO: cupón con producto de OTRA tienda';
  exception when others then
    if sqlerrm <> 'COUPON_INVALID_SCOPE' then raise; end if;
    raise notice 'OK: alcance con producto ajeno → COUPON_INVALID_SCOPE';
  end;
  begin
    delete from public.store_coupons where id = v_id;
    raise exception 'FALLO: DELETE permitido';
  exception when insufficient_privilege then raise notice 'OK: sin DELETE (se pausa o archiva)';
  end;
  update public.store_coupons set status = 'paused' where code = 'DIEZMIL' and vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  update public.store_coupons set status = 'active' where code = 'DIEZMIL' and vendor_profile_id = current_setting('qa.vp_ok')::uuid;
end $$;
reset role;

-- Otro vendedor no ve ni crea cupones de esta tienda; el comprador no los lista.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vpend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.store_coupons) then raise exception 'FALLO: otro vendedor lista cupones ajenos'; end if;
  begin
    insert into public.store_coupons (vendor_profile_id, code, kind, value) values (current_setting('qa.vp_ok')::uuid, 'HACK', 'percent', 50);
    raise exception 'FALLO: otro vendedor crea cupón en tienda ajena';
  exception when insufficient_privilege then raise notice 'OK: otro vendedor no crea cupones en tienda ajena (42501)';
  end;
  update public.store_coupons set value = 90 where id = current_setting('qa.c10')::uuid;
end $$;
reset role;
do $$ begin
  if (select value from public.store_coupons where id = current_setting('qa.c10')::uuid) <> 10 then
    raise exception 'FALLO: otro vendedor modificó el cupón';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.store_coupons) then raise exception 'FALLO: el comprador lista cupones'; end if;
  raise notice 'OK: el comprador no lista cupones (RLS)';
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.store_coupons; raise exception 'FALLO: anon lee store_coupons';
  exception when insufficient_privilege then raise notice 'OK: anon sin SELECT en store_coupons'; end;
  begin perform public._store_coupon_apply(null, 'X', null, '[]', '{}', false, false); raise exception 'FALLO: anon ejecuta el motor';
  exception when insufficient_privilege then raise notice 'OK: el motor del cupón no es ejecutable por anon'; end;
end $$;
reset role;

-- ── 2. % con prorrateo, IVA y comisión sobre el neto, pago y evento ─────────
-- Balón ×1 (89.000) + guayos 40/Negro ×1 (210.000) = 299.000; SOCIOS10 → 29.900.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare q jsonb; r jsonb; o record; b record; g record;
begin
  -- La cotización (lo que ve el checkout) y la orden dan lo mismo.
  q := public.quote_cart(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1),
                                           jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000005','quantity',1)),
                         'pickup', null, 'socios10');
  if q ->> 'coupon_error' is not null or (q ->> 'discount_total')::numeric <> 29900 or (q ->> 'total')::numeric <> 269100
     or (q -> 'coupon' ->> 'code') <> 'SOCIOS10' or (q ->> 'subtotal')::numeric <> 299000 or (q ->> 'tax_total')::numeric <> 42965 then
    raise exception 'FALLO: quote con SOCIOS10: %', q;
  end if;
  raise notice 'OK: quote_cart con socios10 (minúsculas) → descuento 29.900, total 269.100, IVA sobre el neto 42.965';

  r := public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1, 'unit_price', 1),
                           jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000005','quantity',1)),
         'pickup', null, null, null, 'wompi', 'Socios10', null, null);
  perform set_config('qa.o', r ->> 'order_id', true);
  if (r ->> 'discount_total')::numeric <> 29900 or (r ->> 'total')::numeric <> 269100 or (r ->> 'subtotal')::numeric <> 299000
     or (r ->> 'coupon_code') <> 'SOCIOS10' or (r ->> 'amount_in_cents')::bigint <> 26910000 then
    raise exception 'FALLO: resumen de la orden con cupón: %', r;
  end if;
  raise notice 'OK: create_cart_order aplica el cupón en la base: 299.000 − 29.900 = 269.100';
end $$;
reset role;

do $$
declare o record; b record; g record; s numeric;
begin
  select * into o from public.orders where id = current_setting('qa.o')::uuid;
  if o.coupon_id <> current_setting('qa.c10')::uuid or o.discount_total <> 29900 or o.tax_total <> 42965 then
    raise exception 'FALLO: orden coupon_id/discount/tax: % % %', o.coupon_id, o.discount_total, o.tax_total;
  end if;
  select * into b from public.order_items where order_id = o.id and product_id = '00000000-0000-4000-d000-000000000002';
  select * into g from public.order_items where order_id = o.id and variant_id = '00000000-0000-4000-e000-000000000005';
  -- Balón: 8.900 de descuento → 80.100 neto, base 67.311, IVA 12.789, comisión 8.010.
  if b.unit_price <> 89000 or b.discount_amount <> 8900 or b.line_total <> 80100 or b.line_base <> 67311
     or b.tax_amount <> 12789 or b.platform_fee <> 8010 then
    raise exception 'FALLO: línea balón %', row_to_json(b);
  end if;
  -- Guayos: 21.000 → 189.000 neto, base 158.824, IVA 30.176, comisión 18.900.
  if g.discount_amount <> 21000 or g.line_total <> 189000 or g.line_base <> 158824 or g.tax_amount <> 30176 or g.platform_fee <> 18900 then
    raise exception 'FALLO: línea guayos %', row_to_json(g);
  end if;
  select sum(discount_amount) into s from public.order_items where order_id = o.id;
  if s <> o.discount_total or o.subtotal - o.discount_total + o.shipping_cost <> o.total_amount then
    raise exception 'FALLO: Σ descuento por línea % ≠ discount_total %', s, o.discount_total;
  end if;
  if (select status from public.store_coupon_redemptions where order_id = o.id) <> 'reserved'
     or (select discount_amount from public.store_coupon_redemptions where order_id = o.id) <> 29900 then
    raise exception 'FALLO: redención no reservada';
  end if;
  raise notice 'OK: prorrateo por línea (8.900 + 21.000), IVA y comisión sobre el neto; redención reserved';
end $$;

-- Pago por la pasarela del vendedor → settlements y evento sobre lo cobrado.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.confirm_order_payment(current_setting('qa.o')::uuid, 'ref', 'tx-K01-1', 'CARD', 'wompi');
reset role;
do $$
declare ev jsonb; inv jsonb; n numeric;
begin
  if (select status from public.store_coupon_redemptions where order_id = current_setting('qa.o')::uuid) <> 'consumed' then
    raise exception 'FALLO: al pagar la redención no pasa a consumed';
  end if;
  select sum(gross_amount) into n from public.settlements where order_id = current_setting('qa.o')::uuid;
  if n <> 269100 or (select sum(platform_fee) from public.settlements where order_id = current_setting('qa.o')::uuid) <> 26910
     or (select sum(discount_amount) from public.settlements where order_id = current_setting('qa.o')::uuid) <> 29900 then
    raise exception 'FALLO: settlements sobre el neto: gross=%', n;
  end if;
  select payload into ev from public.accounting_outbox where idempotency_key = 'commerce_sale:' || current_setting('qa.o');
  if (ev ->> 'gross')::numeric <> 269100 or (ev ->> 'discount')::numeric <> 29900
     or (ev ->> 'gross_before_discount')::numeric <> 299000 or ev ->> 'coupon_code' <> 'SOCIOS10'
     or ev ->> 'coupon_funded_by' <> 'vendor' or (ev ->> 'commission')::numeric <> 26910
     or (ev ->> 'base')::numeric + (ev ->> 'vat')::numeric <> 269100 then
    raise exception 'FALLO: evento commerce_sale: %', ev;
  end if;
  inv := public.order_invoice_payload(current_setting('qa.o')::uuid);
  select sum((l ->> 'unit_price')::numeric * (l ->> 'quantity')::numeric) into n from jsonb_array_elements(inv -> 'lines') l;
  if n <> 269100 or (inv ->> 'discount_total')::numeric <> 29900 then
    raise exception 'FALLO: la factura no cuadra con lo cobrado: % (%)', n, inv;
  end if;
  raise notice 'OK: pagada → redención consumed; settlements, comisión (26.910), evento contable y factura sobre 269.100 con discount 29.900';
end $$;

-- ── 3. Fijo con tax_rate 0, mixto 0/19 %, tope en pesos y residuo ───────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; it record; s numeric;
begin
  -- Exento solo: 50.000 − 20.000 = 30.000; base 30.000, IVA 0.
  r := public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-0000000000f1','quantity',1)),
                                'pickup', null, null, null, 'cash_pickup', 'fijo20k', null, null);
  select * into it from public.order_items where order_id = (r ->> 'order_id')::uuid;
  if (r ->> 'total')::numeric <> 30000 or (r ->> 'tax_total')::numeric <> 0 or it.line_base <> 30000 or it.tax_amount <> 0
     or it.discount_amount <> 20000 then
    raise exception 'FALLO: fijo con tax_rate 0: % %', r, row_to_json(it);
  end if;
  raise notice 'OK: fijo 20.000 sobre exento → total 30.000, base 30.000, IVA 0';

  -- Mixto: exento 50.000 + balón 89.000 = 139.000; FIJO20K ya usado por padre.b (max_per_buyer 1) → MITAD
  -- 50 % = 69.500, tope 15.000 → 15.000. Exento floor(15000·50/139)=5.395, balón floor(9.604,3)=9.604, residuo 1 → balón.
  r := public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-0000000000f1','quantity',1),
                                                  jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                'pickup', null, null, null, 'cash_pickup', 'MITAD', null, null);
  if (r ->> 'discount_total')::numeric <> 15000 or (r ->> 'total')::numeric <> 124000 then
    raise exception 'FALLO: tope de 15.000: %', r;
  end if;
  select * into it from public.order_items where order_id = (r ->> 'order_id')::uuid and product_id = '00000000-0000-4000-d000-0000000000f1';
  if it.discount_amount <> 5395 or it.line_total <> 44605 or it.tax_amount <> 0 then
    raise exception 'FALLO: línea exenta en mixto %', row_to_json(it);
  end if;
  select * into it from public.order_items where order_id = (r ->> 'order_id')::uuid and product_id = '00000000-0000-4000-d000-000000000002';
  -- 89.000 − 9.605 = 79.395 → base round(66.718,49) = 66.718, IVA 12.677
  if it.discount_amount <> 9605 or it.line_total <> 79395 or it.line_base <> 66718 or it.tax_amount <> 12677 then
    raise exception 'FALLO: línea gravada en mixto (residuo a la más cara) %', row_to_json(it);
  end if;
  select sum(discount_amount) into s from public.order_items where order_id = (r ->> 'order_id')::uuid;
  if s <> 15000 or (r ->> 'tax_total')::numeric <> 12677 then raise exception 'FALLO: Σ mixto %', s; end if;
  raise notice 'OK: 50 %% con tope 15.000 en carrito mixto 0/19 %%: 5.395 + 9.605 (residuo a la más cara), IVA solo de la gravada';
end $$;
reset role;

-- Descuento fijo mayor que lo elegible: nunca más del 90 %.
update public.store_coupons set value = 80000 where code = 'DIEZMIL' and vendor_profile_id = current_setting('qa.vp_ok')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare q jsonb;
begin
  q := public.quote_cart(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-0000000000f1','quantity',1)), 'pickup', null, 'DIEZMIL');
  if (q ->> 'discount_total')::numeric <> 45000 or (q ->> 'total')::numeric <> 5000 then
    raise exception 'FALLO: fijo 80.000 sobre 50.000 no se topa al 90 %%: %', q;
  end if;
  raise notice 'OK: fijo mayor que la compra → se topa al 90 %% (45.000), total 5.000';
end $$;
reset role;

-- Pago tardío de una orden vencida: la redención liberada se re-consume
-- (la plata ya entró con ese precio, aunque el cupón esté agotado).
insert into public.store_coupons (vendor_profile_id, code, kind, value, max_redemptions)
values (current_setting('qa.vp_ok')::uuid, 'TARDE', 'fixed', 1000, 1);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.o_tarde', (public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
         'pickup', null, null, null, 'wompi', 'TARDE', null, null) ->> 'order_id'), true);
reset role;
update public.orders set expires_at = now() - interval '1 minute' where id = current_setting('qa.o_tarde')::uuid;
select public.release_expired_holds();
do $$ begin
  if (select status from public.store_coupon_redemptions where order_id = current_setting('qa.o_tarde')::uuid) <> 'released' then
    raise exception 'FALLO: la orden vencida no liberó la redención';
  end if;
end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.confirm_order_payment(current_setting('qa.o_tarde')::uuid, 'ref', 'tx-K01-TARDE', 'CARD', 'wompi');
reset role;
do $$ begin
  if (select status from public.orders where id = current_setting('qa.o_tarde')::uuid) not in ('paid', 'payment_review') then
    raise exception 'FALLO: pago tardío no se registró';
  end if;
  if (select status from public.orders where id = current_setting('qa.o_tarde')::uuid) = 'paid'
     and (select status from public.store_coupon_redemptions where order_id = current_setting('qa.o_tarde')::uuid) <> 'consumed' then
    raise exception 'FALLO: pago tardío no re-consume la redención';
  end if;
  raise notice 'OK: orden vencida → released; el pago tardío la deja % con redención %',
    (select status from public.orders where id = current_setting('qa.o_tarde')::uuid),
    (select status from public.store_coupon_redemptions where order_id = current_setting('qa.o_tarde')::uuid);
end $$;

rollback;
