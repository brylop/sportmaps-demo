-- M-F0-4 (tienda v2 F0) — create_cart_order / quote_cart: el precio y el total
-- salen de la base, la reserva se toma con FOR UPDATE y el contrato de errores.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F04a_create_cart_order.sql
--
-- Casos (§8.2): R6 precio del JSON ignorado + IVA incluido (§6.3), reserva y
-- holds, R7 school_only ajeno / borrador / vendedor no habilitado, R17
-- STORE_DISABLED, COUPONS_NOT_AVAILABLE, MULTIPLE_SELLERS (D-2), INSUFFICIENT_STOCK,
-- INVALID_QTY, VARIANT_REQUIRED, idempotency_key, medio no aceptado,
-- CASH_REQUIRES_PICKUP, envío por zona, quote_cart, anon sin EXECUTE.

begin;

-- ── Fixture (postgres) ───────────────────────────────────────────────────────
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb', (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_pend',  (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);

insert into public.vendor_bank_accounts (vendor_profile_id, bank_name, account_type, account_number, account_holder, document_type, document_number, is_default, is_active)
values (current_setting('qa.vp_ok')::uuid, 'Banco QA', 'ahorros', '000-QA-111', 'QA Deportes', 'NIT', '900000001', true, true);
-- Idempotente: otra corrida (o la preparación del E2E) puede haber dejado la fila.
insert into public.store_payment_settings (vendor_profile_id, accept_transfer, accept_cash_pickup)
values (current_setting('qa.vp_ok')::uuid, true, true)
on conflict (vendor_profile_id) do update set accept_transfer = true, accept_cash_pickup = true,
       accept_wompi = false, accept_mercadopago = false;

-- Tienda de la escuela A (enable_school_store como owner) y la camiseta school_only en ella.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
update public.products set vendor_profile_id = current_setting('qa.vp_a')::uuid
 where id = '00000000-0000-4000-d000-000000000001';
insert into public.school_settings (school_id, payment_accounts)
values (current_setting('qa.school_a')::uuid,
        '[{"id":"qa1","type":"nequi","label":"Nequi","value":"3000000000","active":true}]'::jsonb)
on conflict (school_id) do update set payment_accounts = excluded.payment_accounts;
insert into public.store_payment_settings (vendor_profile_id, accept_transfer, accept_cash_pickup)
values (current_setting('qa.vp_a')::uuid, true, true)
on conflict (vendor_profile_id) do update set accept_transfer = true, accept_cash_pickup = true,
       accept_wompi = false, accept_mercadopago = false;

-- Línea base de reservas del balón: otras corridas pueden haber dejado holds
-- activos (commiteados por el E2E); el caso mide lo que ESTA corrida reserva.
select set_config('qa.res0', (select reserved::text from public.products where id = '00000000-0000-4000-d000-000000000002'), true);
select set_config('qa.holds0', (select coalesce(sum(quantity),0)::text from public.stock_holds
   where product_id = '00000000-0000-4000-d000-000000000002' and status = 'active'), true);

-- ── Comprador padre.a ────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  r jsonb; r2 jsonb; n int; k uuid := gen_random_uuid();
begin
  -- R6: el cliente manda precio/total/IVA falsos → se ignoran.
  r := public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002',
                                              'quantity',2,'unit_price',1,'price',1,'total',1)),
         'pickup', null, null, '{"name":"Padre QA"}'::jsonb, 'transfer', null, null, k);
  -- 89.000 × 2 = 178.000; base = round(178000/1.19) = 149.580; IVA = 28.420
  if (r->>'total')::numeric <> 178000 or (r->>'subtotal')::numeric <> 178000
     or (r->>'tax_total')::numeric <> 28420 or (r->>'shipping')::numeric <> 0 then
    raise exception 'FALLO: R6 totales %', r;
  end if;
  if (r->'items'->0->>'unit_price')::numeric <> 89000 or (r->'items'->0->>'line_base')::numeric <> 149580 then
    raise exception 'FALLO: línea %', r->'items'->0;
  end if;
  if r->>'status' <> 'pending_payment' or r->>'reference' !~ '^CART-[A-Z0-9]+-[A-Z0-9]+$'
     or (r->>'expires_at')::timestamptz < now() + interval '47 hours' then
    raise exception 'FALLO: estado/referencia/vencimiento %', r;
  end if;
  if r->>'pickup_code' !~ '^[0-9]{6}$' then raise exception 'FALLO: código de retiro %', r->>'pickup_code'; end if;
  raise notice 'OK: R6 precio del JSON ignorado; total 178000, IVA incluido 28420, ref %', r->>'reference';

  -- idempotency_key: mismo clic = misma orden
  r2 := public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',5)),
         'pickup', null, null, null, 'transfer', null, null, k);
  if r2->>'order_id' <> r->>'order_id' or not (r2->>'idempotent')::boolean then
    raise exception 'FALLO: idempotency_key creó otra orden %', r2;
  end if;
  raise notice 'OK: misma idempotency_key → misma orden (idempotent=true)';

  -- p_buyer_id lo ignora la RPC con JWT (no se compra a nombre de otro)
  r2 := public.create_cart_order(
         jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
         'pickup', null, null, null, 'cash_pickup', null, current_setting('qa.u_padreb')::uuid, null);
  if (select user_id from public.orders where id = (r2->>'order_id')::uuid) <> auth.uid() then
    raise exception 'FALLO: p_buyer_id con JWT cambió el comprador';
  end if;
  raise notice 'OK: con JWT el comprador es auth.uid() aunque mande p_buyer_id';

  -- school_only de su escuela: sí (con variante)
  r2 := public.create_cart_order(
         jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000002','quantity',1)),
         'pickup', null, null, null, 'transfer', null, null, null);
  if (r2->>'total')::numeric <> 65000 then raise exception 'FALLO: school_only propio %', r2; end if;
  raise notice 'OK: padre miembro compra school_only de su escuela (65000)';

  -- VARIANT_REQUIRED
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000001','quantity',1)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: producto con variantes sin variante';
  exception when others then
    if sqlerrm <> 'VARIANT_REQUIRED' then raise; end if;
    raise notice 'OK: producto con variantes sin variant_id → VARIANT_REQUIRED';
  end;

  -- MULTIPLE_SELLERS (D-2)
  begin
    perform public.create_cart_order(jsonb_build_array(
              jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1),
              jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000001','quantity',1)),
            'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: dos vendedores en un checkout';
  exception when others then
    if sqlerrm <> 'MULTIPLE_SELLERS' then raise; end if;
    raise notice 'OK: dos tiendas en un checkout → MULTIPLE_SELLERS';
  end;

  -- COUPONS_NOT_AVAILABLE
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                     'pickup', null, null, null, 'transfer', 'DESC10', null, null);
    raise exception 'FALLO: cupón aceptado';
  exception when others then
    if sqlerrm <> 'COUPONS_NOT_AVAILABLE' then raise; end if;
    raise notice 'OK: p_coupon_code → COUPONS_NOT_AVAILABLE';
  end;

  -- INSUFFICIENT_STOCK: rodillera stock 1, piden 2
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000006','quantity',2)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: sobreventa';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
    raise notice 'OK: 2 sobre stock 1 → INSUFFICIENT_STOCK';
  end;

  -- Agotado (medias, stock 0)
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000005','quantity',1)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: vendió un agotado';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
    raise notice 'OK: agotado → INSUFFICIENT_STOCK';
  end;

  -- R7 borrador (termo draft)
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000004','quantity',1)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: vendió un borrador';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_AVAILABLE' then raise; end if;
    raise notice 'OK: R7 borrador → PRODUCT_NOT_AVAILABLE';
  end;

  -- R7 vendedor sin verificar (cuerda, vendedor.pend)
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000007','quantity',1)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: vendió vendedor sin verificar';
  exception when others then
    if sqlerrm <> 'SELLER_NOT_ALLOWED' then raise; end if;
    raise notice 'OK: R7 vendedor no habilitado → SELLER_NOT_ALLOWED';
  end;

  -- INVALID_QTY (21 y 0) y cantidad no numérica
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',21)),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: 21 unidades';
  exception when others then
    if sqlerrm <> 'INVALID_QTY' then raise; end if;
  end;
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity','1.5')),
                                     'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: cantidad 1.5';
  exception when others then
    if sqlerrm <> 'INVALID_QTY' then raise; end if;
  end;
  raise notice 'OK: cantidades fuera de 1–20 / no enteras → INVALID_QTY';

  -- Medio no aceptado: el vendedor no tiene Wompi propio
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                     'pickup', null, null, null, 'wompi', null, null, null);
    raise exception 'FALLO: Wompi sin pasarela del vendedor';
  exception when others then
    if sqlerrm <> 'PAYMENT_METHOD_NOT_ACCEPTED' then raise; end if;
    raise notice 'OK: Wompi sin aceptar ni pasarela propia → PAYMENT_METHOD_NOT_ACCEPTED (nunca llaves globales)';
  end;

  -- Efectivo exige retiro
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                     'shipping', null, '{"departamento":"Antioquia","direccion":"Cra 1"}'::jsonb, null,
                                     'cash_pickup', null, null, null);
    raise exception 'FALLO: efectivo con envío';
  exception when others then
    if sqlerrm <> 'CASH_REQUIRES_PICKUP' then raise; end if;
    raise notice 'OK: efectivo con envío → CASH_REQUIRES_PICKUP';
  end;

  -- Envío por zona (Antioquia 18.000, sin IVA)
  r2 := public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                 'shipping', null, '{"departamento":"antioquia","direccion":"Cra 1 # 2-3","ciudad":"Medellín"}'::jsonb,
                                 null, 'transfer', null, null, null);
  if (r2->>'shipping')::numeric <> 18000 or (r2->>'total')::numeric <> 107000 or r2->>'pickup_code' is not null then
    raise exception 'FALLO: envío %', r2;
  end if;
  begin
    perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                     'shipping', null, '{"departamento":"Narnia","direccion":"x"}'::jsonb, null,
                                     'transfer', null, null, null);
    raise exception 'FALLO: zona inexistente sin error';
  exception when others then
    if sqlerrm <> 'SHIPPING_ZONE_NOT_FOUND' then raise; end if;
  end;
  raise notice 'OK: envío por zona (18000, total 107000); zona inexistente → SHIPPING_ZONE_NOT_FOUND (sin fallback)';

  -- quote_cart: misma calculadora, sin escribir
  r2 := public.quote_cart(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000006','quantity',4,'unit_price',1)),
                          'pickup', null, null);
  if (r2->'lines'->0->>'available')::int <> 1 or r2->'lines'->0->>'error' <> 'INSUFFICIENT_STOCK'
     or (r2->'lines'->0->>'unit_price')::numeric <> 58000 then
    raise exception 'FALLO: quote_cart %', r2;
  end if;
  raise notice 'OK: quote_cart avisa disponible=1 y precio de la base (58000)';

  -- Escritura directa sigue cerrada
  begin
    insert into public.order_items (order_id, product_id, quantity, unit_price) values ((r->>'order_id')::uuid, '00000000-0000-4000-d000-000000000002', 1, 1);
    raise exception 'FALLO: insert directo de ítem';
  exception when insufficient_privilege then raise notice 'OK: INSERT directo de order_items → 42501';
  end;
  begin
    update public.products set reserved = 0 where id = '00000000-0000-4000-d000-000000000002';
    raise exception 'FALLO: el cliente movió reserved';
  exception when insufficient_privilege then raise notice 'OK: UPDATE reserved → 42501';
  end;
  begin
    perform 1 from public.stock_holds;
    raise exception 'FALLO: el cliente lee stock_holds';
  exception when insufficient_privilege then raise notice 'OK: stock_holds → 42501';
  end;
end $$;

-- ── Ajeno padre.b: no compra el school_only de A ─────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.create_cart_order(jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000001','quantity',1)),
                                   'pickup', null, null, null, 'transfer', null, null, null);
  raise exception 'FALLO: R7 padre ajeno compró school_only';
exception when others then
  if sqlerrm <> 'PRODUCT_NOT_AVAILABLE' then raise; end if;
  raise notice 'OK: R7 school_only de otra escuela → PRODUCT_NOT_AVAILABLE';
end $$;

-- ── Reservas: stock intacto, reserved = Σ holds activos ──────────────────────
reset role;
do $$
declare v_res int; v_holds int; v_stock int;
begin
  select reserved, stock into v_res, v_stock from public.products where id = '00000000-0000-4000-d000-000000000002';
  select coalesce(sum(quantity),0) into v_holds from public.stock_holds
   where product_id = '00000000-0000-4000-d000-000000000002' and status = 'active';
  v_res := v_res - current_setting('qa.res0')::int;
  v_holds := v_holds - current_setting('qa.holds0')::int;
  if v_stock <> 20 or v_res <> v_holds or v_res <> 4 then
    raise exception 'FALLO: stock=% Δreserved=% Δholds=% (esperado 20/4/4)', v_stock, v_res, v_holds;
  end if;
  raise notice 'OK: stock intacto (20), reserved = Σ holds activos = 4 (C10)';
end $$;

-- ── R17: tienda apagada ──────────────────────────────────────────────────────
update public.platform_config set value = '{"enabled": false}'::jsonb where key = 'store_enabled';
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.create_cart_order(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)),
                                   'pickup', null, null, null, 'transfer', null, null, null);
  raise exception 'FALLO: R17 compró con la tienda apagada';
exception when others then
  if sqlerrm <> 'STORE_DISABLED' then raise; end if;
  raise notice 'OK: R17 store_enabled=false → STORE_DISABLED';
end $$;

-- ── anon: sin EXECUTE de create_cart_order; quote_cart sí ────────────────────
reset role;
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare r jsonb;
begin
  begin
    perform public.create_cart_order('[]'::jsonb, 'pickup', null, null, null, 'transfer', null, null, null);
    raise exception 'FALLO: anon ejecuta create_cart_order';
  exception when insufficient_privilege then raise notice 'OK: anon create_cart_order → 42501';
  end;
  r := public.quote_cart(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1)));
  if (r->>'total')::numeric <> 89000 then raise exception 'FALLO: quote anon %', r; end if;
  raise notice 'OK: anon cotiza la vitrina (89000)';
end $$;

rollback;
