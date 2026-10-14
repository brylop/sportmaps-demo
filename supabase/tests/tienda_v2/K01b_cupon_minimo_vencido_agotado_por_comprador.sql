-- K01b (tienda v2 F3b, mig. 20261013170543) — validez del cupón con mensajes
-- claros: mínimo de compra, vencido, todavía no empieza, pausado, agotado
-- (max_redemptions), por comprador (max_per_buyer), alcance por producto y por
-- categoría, cupón para las familias de UNA escuela, cancelar/vencer libera la
-- redención, código congelado con usos, quote_cart anónimo y límite de intentos.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/K01b_cupon_minimo_vencido_agotado_por_comprador.sql
begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb',(select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_atleta',(select user_id::text from qa_twin.actores where alias = 'atleta.a'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.school_a',(select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.cat',     (select category_id::text from public.products where id = '00000000-0000-4000-d000-000000000002'), true);
select set_config('qa.cat_otra',(select id::text from public.product_categories where id <> current_setting('qa.cat')::uuid order by id limit 1), true);

insert into public.store_payment_settings (vendor_profile_id, accept_cash_pickup, accept_transfer)
values (current_setting('qa.vp_ok')::uuid, true, false)
on conflict (vendor_profile_id) do update set accept_cash_pickup = true;

-- Cupones (como postgres: la RLS de gestión está en K01a).
insert into public.store_coupons (vendor_profile_id, code, kind, value, min_subtotal, starts_at, ends_at,
                                  max_redemptions, max_per_buyer, applies_to, product_ids, category_ids, school_id, status)
values
  (current_setting('qa.vp_ok')::uuid, 'MIN100K',  'percent', 10, 100000, now() - interval '1 day', null, null, 1, 'store', '{}', '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'VENCIDO',  'percent', 10, 0, now() - interval '10 days', now() - interval '1 day', null, 1, 'store', '{}', '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'MANANA',   'percent', 10, 0, now() + interval '1 day', null, null, 1, 'store', '{}', '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'PAUSADO',  'percent', 10, 0, now() - interval '1 day', null, null, 1, 'store', '{}', '{}', null, 'paused'),
  (current_setting('qa.vp_ok')::uuid, 'UNOSOLO',  'fixed', 5000, 0, now() - interval '1 day', null, 1, null, 'store', '{}', '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'DOSXPAPA', 'fixed', 5000, 0, now() - interval '1 day', null, null, 2, 'store', '{}', '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'SOLOBALON','percent', 20, 0, now() - interval '1 day', null, null, 5, 'products',
     array['00000000-0000-4000-d000-000000000002'::uuid], '{}', null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'OTRACAT',  'percent', 20, 0, now() - interval '1 day', null, null, 5, 'categories',
     '{}', array[current_setting('qa.cat_otra')::uuid], null, 'active'),
  (current_setting('qa.vp_ok')::uuid, 'ANDES15',  'percent', 15, 0, now() - interval '1 day', null, null, 1, 'store',
     '{}', '{}', current_setting('qa.school_a')::uuid, 'active');

-- Ítem de 89.000 (balón) para todo.
select set_config('qa.items', jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1))::text, true);
select set_config('qa.items_rod', jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000003','quantity',1))::text, true);

create or replace function pg_temp.qa_err(p_code text) returns text language plpgsql as $$
begin
  perform public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', p_code, null, null);
  return 'OK';
exception when others then return sqlerrm;
end $$;
grant execute on function pg_temp.qa_err(text) to authenticated;

-- ── padre.a ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare e text; q jsonb; r jsonb;
begin
  e := pg_temp.qa_err('MIN100K');   if e <> 'COUPON_MIN_PURCHASE' then raise exception 'FALLO: mínimo → %', e; end if;
  q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'MIN100K');
  if q ->> 'coupon_error' <> 'COUPON_MIN_PURCHASE' or (q -> 'coupon_error_detail' ->> 'min_subtotal')::numeric <> 100000
     or (q ->> 'discount_total')::numeric <> 0 or (q ->> 'total')::numeric <> 89000 then
    raise exception 'FALLO: quote con mínimo: %', q;
  end if;
  raise notice 'OK: compra de 89.000 con mínimo 100.000 → COUPON_MIN_PURCHASE (quote trae min_subtotal y no descuenta)';

  e := pg_temp.qa_err('vencido');   if e <> 'COUPON_EXPIRED' then raise exception 'FALLO: vencido → %', e; end if;
  e := pg_temp.qa_err('MANANA');    if e <> 'COUPON_NOT_STARTED' then raise exception 'FALLO: no empezado → %', e; end if;
  e := pg_temp.qa_err('PAUSADO');   if e <> 'COUPON_INVALID' then raise exception 'FALLO: pausado → %', e; end if;
  e := pg_temp.qa_err('NOEXISTE');  if e <> 'COUPON_INVALID' then raise exception 'FALLO: inexistente → %', e; end if;
  e := pg_temp.qa_err('mal código!'); if e <> 'COUPON_INVALID' then raise exception 'FALLO: formato → %', e; end if;
  raise notice 'OK: vencido → COUPON_EXPIRED; mañana → COUPON_NOT_STARTED; pausado/inexistente/mal formado → COUPON_INVALID';

  -- Alcance: SOLOBALON no aplica a los guayos; OTRACAT no aplica a la categoría del balón.
  begin
    perform public.create_cart_order(current_setting('qa.items_rod')::jsonb || '[]'::jsonb, 'pickup', null, null, null, 'cash_pickup', 'SOLOBALON', null, null);
    raise exception 'FALLO: cupón de producto aplicado a otro';
  exception when others then
    if sqlerrm not in ('COUPON_NOT_APPLICABLE', 'VARIANT_REQUIRED') then raise; end if;
  end;
  q := public.quote_cart(jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000005','quantity',1)), 'pickup', null, 'SOLOBALON');
  if q ->> 'coupon_error' <> 'COUPON_NOT_APPLICABLE' then raise exception 'FALLO: alcance por producto: %', q; end if;
  e := pg_temp.qa_err('OTRACAT');   if e <> 'COUPON_NOT_APPLICABLE' then raise exception 'FALLO: alcance por categoría → %', e; end if;
  q := public.quote_cart(jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-d000-000000000002','quantity',1),
                                           jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000005','quantity',1)),
                         'pickup', null, 'SOLOBALON');
  if (q ->> 'discount_total')::numeric <> 17800 or (q ->> 'total')::numeric <> 281200 then
    raise exception 'FALLO: SOLOBALON solo descuenta el balón (20 %% de 89.000): %', q;
  end if;
  raise notice 'OK: alcance por producto/categoría → COUPON_NOT_APPLICABLE fuera; adentro descuenta solo lo elegible (17.800)';

  -- Escuela: ANDES15 es para las familias de A (padre.a es miembro).
  r := public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', 'ANDES15', null, null);
  if (r ->> 'discount_total')::numeric <> 13350 then raise exception 'FALLO: ANDES15 para miembro: %', r; end if;
  raise notice 'OK: cupón de la escuela A redimido por un padre miembro (13.350)';

  -- UNOSOLO: max_redemptions 1. padre.a lo usa…
  r := public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', 'UNOSOLO', null, null);
  perform set_config('qa.o_uno', r ->> 'order_id', true);
  -- DOSXPAPA: max_per_buyer 2 → dos sí, la tercera COUPON_BUYER_LIMIT.
  r := public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', 'DOSXPAPA', null, null);
  perform set_config('qa.o_dos1', r ->> 'order_id', true);
  perform public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', 'DOSXPAPA', null, null);
  e := pg_temp.qa_err('DOSXPAPA');  if e <> 'COUPON_BUYER_LIMIT' then raise exception 'FALLO: por comprador → %', e; end if;
  q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'DOSXPAPA');
  if q ->> 'coupon_error' <> 'COUPON_BUYER_LIMIT' or (q -> 'coupon_error_detail' ->> 'max_per_buyer')::int <> 2 then
    raise exception 'FALLO: quote por comprador: %', q;
  end if;
  raise notice 'OK: max_per_buyer 2 → la tercera compra del mismo papá: COUPON_BUYER_LIMIT';

  -- Cancelar libera la redención: vuelve a poder usarlo.
  perform public.cancel_my_order(current_setting('qa.o_dos1')::uuid, 'prueba');
  e := pg_temp.qa_err('DOSXPAPA');  if e <> 'OK' then raise exception 'FALLO: tras cancelar no libera → %', e; end if;
  raise notice 'OK: cancelar la orden libera la redención (released) y el papá lo vuelve a usar';
end $$;
reset role;

do $$ begin
  if (select status from public.store_coupon_redemptions where order_id = current_setting('qa.o_dos1')::uuid) <> 'released'
     or (select released_at from public.store_coupon_redemptions where order_id = current_setting('qa.o_dos1')::uuid) is null then
    raise exception 'FALLO: la redención de la orden cancelada no quedó released';
  end if;
end $$;

-- Código congelado: UNOSOLO ya tiene usos.
do $$ begin
  begin
    update public.store_coupons set value = 9000 where code = 'UNOSOLO';
    raise exception 'FALLO: se cambió el valor de un cupón con usos';
  exception when others then
    if sqlerrm <> 'COUPON_LOCKED' then raise; end if;
    raise notice 'OK: cupón con usos → código/tipo/valor congelados (COUPON_LOCKED); se puede pausar';
  end;
  update public.store_coupons set status = 'paused', ends_at = now() + interval '30 days' where code = 'UNOSOLO';
  update public.store_coupons set status = 'active' where code = 'UNOSOLO';
end $$;

-- ── padre.b: ajeno a la escuela A y segundo comprador de UNOSOLO ─────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare e text;
begin
  e := pg_temp.qa_err('ANDES15');  if e <> 'COUPON_INVALID' then raise exception 'FALLO: cupón de escuela para ajeno → %', e; end if;
  raise notice 'OK: padre de otra escuela con el cupón de A → COUPON_INVALID (no revela que existe)';
  e := pg_temp.qa_err('UNOSOLO');  if e <> 'COUPON_LIMIT' then raise exception 'FALLO: agotado → %', e; end if;
  raise notice 'OK: UNOSOLO (max 1) ya reservado por padre.a → COUPON_LIMIT para padre.b';
  if exists (select 1 from public.store_coupon_redemptions) then
    raise exception 'FALLO: padre.b ve redenciones ajenas';
  end if;
end $$;
reset role;

-- Vencer la reserva (cron release_expired_holds) libera UNOSOLO → padre.b lo usa.
update public.orders set expires_at = now() - interval '1 minute' where id = current_setting('qa.o_uno')::uuid;
select public.release_expired_holds();
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare e text;
begin
  e := pg_temp.qa_err('UNOSOLO');  if e <> 'OK' then raise exception 'FALLO: tras vencer no se libera → %', e; end if;
  if (select count(*) from public.store_coupon_redemptions) <> 1 then
    raise exception 'FALLO: el comprador no ve SU redención';
  end if;
  raise notice 'OK: orden vencida → redención released; padre.b usa UNOSOLO y ve solo su redención';
end $$;
reset role;

-- ── Anónimo y fuerza bruta ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare q jsonb;
begin
  q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'UNOSOLO');
  if q ->> 'coupon_error' <> 'COUPON_LOGIN_REQUIRED' or (q ->> 'discount_total')::numeric <> 0 then
    raise exception 'FALLO: anon cotiza cupones: %', q;
  end if;
  raise notice 'OK: anon en quote_cart → COUPON_LOGIN_REQUIRED (sin descuento)';
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_atleta'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare q jsonb; i int;
begin
  for i in 1..10 loop
    q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'ADIVINA' || i);
    if q ->> 'coupon_error' <> 'COUPON_INVALID' then raise exception 'FALLO: intento % → %', i, q; end if;
    -- Repetir el MISMO código errado no suma intentos (el quote se refresca solo).
    q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'ADIVINA' || i);
  end loop;
  q := public.quote_cart(current_setting('qa.items')::jsonb, 'pickup', null, 'DOSXPAPA');
  if q ->> 'coupon_error' <> 'COUPON_TOO_MANY_ATTEMPTS' then raise exception 'FALLO: sin límite de intentos: %', q; end if;
  begin
    perform public.create_cart_order(current_setting('qa.items')::jsonb, 'pickup', null, null, null, 'cash_pickup', 'DOSXPAPA', null, null);
    raise exception 'FALLO: create_cart_order ignora el límite de intentos';
  exception when others then
    if sqlerrm <> 'COUPON_TOO_MANY_ATTEMPTS' then raise; end if;
  end;
  raise notice 'OK: 10 códigos distintos errados en 15 min → COUPON_TOO_MANY_ATTEMPTS (quote y create), incluso con uno válido';
  begin
    perform 1 from public.store_coupon_attempts;
    raise exception 'FALLO: el comprador lee los intentos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
