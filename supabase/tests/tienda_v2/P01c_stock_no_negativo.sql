-- P01c (productos e inventario) — el stock nunca queda negativo ni por debajo de lo reservado.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/P01c_stock_no_negativo.sql
--
-- Camiseta (d…001) de la tienda escolar de A, dueño owner.a.

begin;

-- Tienda prendida para el piloto SOLO dentro de este caso (rollback al final).
update public.platform_config
   set value = jsonb_build_object('enabled', true, 'allowlist',
               jsonb_build_array('00000000-0000-4000-c000-0000000000a1', '62979287-ab93-45fe-868d-d7c5bdde5088'))
 where key = 'store_enabled';

select set_config('qa.u_owner', (select user_id::text from qa_twin.actores where alias = 'owner.a'), true);

-- Reserva de 2 unidades en la talla M (como la dejaría create_cart_order).
update public.product_variants set stock = 5, reserved = 2 where id = '00000000-0000-4000-e000-000000000002';

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000002', null, -1, 'manual_adjust', 'negativo');
    raise exception 'FALLO: inventory_adjust aceptó −1';
  exception when invalid_parameter_value then
    if sqlerrm <> 'INVALID_QTY' then raise; end if;
    raise notice 'OK: −1 → INVALID_QTY (22023)';
  end;

  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000002', null, 1, 'manual_adjust', 'debajo de lo reservado');
    raise exception 'FALLO: dejó 1 unidad con 2 reservadas';
  exception when invalid_parameter_value then
    if sqlerrm <> 'BELOW_RESERVED' then raise; end if;
    raise notice 'OK: 1 con 2 reservadas → BELOW_RESERVED';
  end;

  r := public.inventory_adjust('00000000-0000-4000-e000-000000000002', null, 2, 'manual_adjust', 'justo lo reservado');
  if (r->>'stock_after')::int <> 2 then raise exception 'FALLO: ajuste a lo reservado: %', r; end if;
  raise notice 'OK: bajar exactamente a lo reservado (2) se permite';

  begin
    insert into public.product_variants (product_id, name, attributes, stock)
    values ('00000000-0000-4000-d000-000000000001', 'XS / Azul', '{"talla":"XS"}', -3);
    raise exception 'FALLO: variante creada con stock negativo';
  exception when check_violation then raise notice 'OK: alta de variante con stock −3 → 23514';
  end;
end $$;

-- El caché del producto tampoco puede quedar negativo (CHECK products_stock_nonneg).
reset role;
do $$
begin
  set constraints all immediate;
  if (select stock from public.products where id = '00000000-0000-4000-d000-000000000001') < 0 then
    raise exception 'FALLO: products.stock negativo';
  end if;
  begin
    update public.products set stock = -1 where id = '00000000-0000-4000-d000-000000000001';
    raise exception 'FALLO: products.stock = −1 aceptado';
  exception when check_violation then raise notice 'OK: products.stock −1 → 23514 (products_stock_nonneg)';
  end;
end $$;

rollback;
