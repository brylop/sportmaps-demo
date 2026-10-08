-- P01a (productos e inventario) — ajuste por variante: kardex + products.stock = Σ variantes.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/P01a_ajuste_variante_kardex_y_suma.sql
-- Requiere 20261008163938 (trigger diferido trg_product_stock_from_variants) en el gemelo.
--
-- El caché se recalcula al COMMIT (trigger DIFERIDO). Como el caso termina en
-- ROLLBACK, se fuerza con `SET CONSTRAINTS ALL IMMEDIATE` después de cada cambio.
--
-- Camiseta (d…001) de la tienda escolar de A (vendor_profile c…a1, dueño owner.a):
-- variantes S (e…001), M (e…002), L (e…003).

begin;

-- Tienda prendida para el piloto SOLO dentro de este caso (rollback al final).
update public.platform_config
   set value = jsonb_build_object('enabled', true, 'allowlist',
               jsonb_build_array('00000000-0000-4000-c000-0000000000a1', '62979287-ab93-45fe-868d-d7c5bdde5088'))
 where key = 'store_enabled';

select set_config('qa.u_owner', (select user_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.u_admin', (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);

-- ── Dueño de la tienda escolar con su JWT ────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  r jsonb; v_log record; v_prod int; v_sum int; v_before int;
begin
  select stock into v_before from public.product_variants where id = '00000000-0000-4000-e000-000000000001';

  -- Tres tallas con stock distinto: S=12, M=7, L=3
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000001', null, 12, 'manual_restock', 'Llegó mercancía: S');
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000002', null, 7,  'manual_adjust',  'Conteo físico: M');
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000003', null, 3,  'manual_restock', 'Llegó mercancía: L');
  set constraints all immediate;

  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  select sum(stock) filter (where is_active is not false) into v_sum
    from public.product_variants where product_id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 22 or v_sum <> 22 then
    raise exception 'FALLO: products.stock=% Σvariantes=% (esperado 22 = 12+7+3)', v_prod, v_sum;
  end if;
  raise notice 'OK: tallas S=12, M=7, L=3 → products.stock = Σ variantes = 22';

  select * into v_log from public.inventory_logs
   where variant_id = '00000000-0000-4000-e000-000000000001' order by created_at desc, id desc limit 1;
  if v_log.id is null or v_log.stock_before <> v_before or v_log.stock_after <> 12
     or v_log.delta <> 12 - v_before or v_log.reason <> 'manual_restock'
     or v_log.product_id <> '00000000-0000-4000-d000-000000000001'
     or v_log.created_by <> auth.uid() or v_log.note <> 'Llegó mercancía: S' then
    raise exception 'FALLO: kardex de la talla S: %', row_to_json(v_log);
  end if;
  if (select count(*) from public.inventory_logs
       where product_id = '00000000-0000-4000-d000-000000000001'
         and variant_id in ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-e000-000000000002',
                            '00000000-0000-4000-e000-000000000003')
         and created_by = auth.uid()) < 2 then
    raise exception 'FALLO: faltan movimientos de kardex por talla';
  end if;
  raise notice 'OK: cada ajuste deja kardex (antes/después/delta, motivo, nota, actor) y el dueño lo lee';

  -- Una variante desactivada no cuenta para el stock del producto
  update public.product_variants set is_active = false where id = '00000000-0000-4000-e000-000000000003';
  set constraints all immediate;
  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 19 then raise exception 'FALLO: con L desactivada products.stock=% (esperado 19)', v_prod; end if;
  raise notice 'OK: variante desactivada sale de la suma (22 → 19)';
  update public.product_variants set is_active = true where id = '00000000-0000-4000-e000-000000000003';
end $$;

-- ── Admin de la escuela (no dueño del perfil) también ajusta, con kardex ─────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; v_prod int;
begin
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000002', null, 9, 'manual_adjust', 'Conteo físico');
  set constraints all immediate;
  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 24 then raise exception 'FALLO: admin.a ajusta M 7→9, products.stock=% (esperado 24)', v_prod; end if;
  raise notice 'OK: admin de la escuela ajusta M 7→9 → products.stock 24';
end $$;

-- ── Camino del BFF: service role + p_actor (dueño) ───────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb; v_prod int; v_log record;
begin
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000003', null, 0, 'manual_adjust', 'Daño: estampado defectuoso',
                               current_setting('qa.u_owner')::uuid);
  set constraints all immediate;
  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 21 then raise exception 'FALLO: BFF ajusta L 3→0, products.stock=% (esperado 21)', v_prod; end if;
  select * into v_log from public.inventory_logs
   where variant_id = '00000000-0000-4000-e000-000000000003' order by created_at desc, id desc limit 1;
  if v_log.created_by <> current_setting('qa.u_owner')::uuid or v_log.delta <> -3 then
    raise exception 'FALLO: kardex del BFF: %', row_to_json(v_log);
  end if;
  raise notice 'OK: BFF (service role + p_actor) ajusta L 3→0 con kardex del dueño; products.stock 21';
end $$;

-- ── Crear una variante nueva y borrarla mueve el caché ───────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_prod int; v_id uuid;
begin
  insert into public.product_variants (product_id, name, attributes, stock, is_active)
  values ('00000000-0000-4000-d000-000000000001', 'XL / Azul', '{"talla":"XL"}', 0, true)
  returning id into v_id;
  perform public.inventory_adjust(v_id, null, 4, 'manual_restock', 'Stock inicial');
  set constraints all immediate;
  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 25 then raise exception 'FALLO: con XL=4 products.stock=% (esperado 25)', v_prod; end if;
  delete from public.product_variants where id = v_id;
  set constraints all immediate;
  select stock into v_prod from public.products where id = '00000000-0000-4000-d000-000000000001';
  if v_prod <> 21 then raise exception 'FALLO: al borrar XL products.stock=% (esperado 21)', v_prod; end if;
  raise notice 'OK: variante nueva con stock inicial por inventory_adjust (25) y al borrarla vuelve a 21';
end $$;

rollback;
