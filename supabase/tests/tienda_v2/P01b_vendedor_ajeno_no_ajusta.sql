-- P01b (productos e inventario) — nadie ajeno a la tienda mueve su stock.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/P01b_vendedor_ajeno_no_ajusta.sql
--
-- Camiseta (d…001, variante S e…001) de la tienda escolar de A. Intentan:
-- vendedor externo verificado, owner de OTRA escuela, padre miembro de A,
-- coach de A (trabaja ahí pero no administra la tienda) y el BFF con p_actor ajeno.
-- Además: nadie (ni el dueño) escribe stock directo con UPDATE.

begin;

-- Tienda prendida para el piloto SOLO dentro de este caso (rollback al final).
update public.platform_config
   set value = jsonb_build_object('enabled', true, 'allowlist',
               jsonb_build_array('00000000-0000-4000-c000-0000000000a1', '62979287-ab93-45fe-868d-d7c5bdde5088'))
 where key = 'store_enabled';

create temp table qa_p01b_antes on commit drop as
  select id, stock from public.product_variants where product_id = '00000000-0000-4000-d000-000000000001';
grant select on qa_p01b_antes to authenticated, service_role;
create temp table qa_p01b_logs on commit drop as select count(*)::int as n from public.inventory_logs;
grant select on qa_p01b_logs to authenticated, service_role;

select set_config('qa.u_vok',   (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_ownb',  (select user_id::text from qa_twin.actores where alias = 'owner.b'), true);
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_coach', (select user_id::text from qa_twin.actores where alias = 'coach.a'), true);
select set_config('qa.u_owner', (select user_id::text from qa_twin.actores where alias = 'owner.a'), true);

-- ── Usuarios con JWT que no administran la tienda de A ───────────────────────
create or replace function pg_temp.qa_intenta(p_alias text, p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000001', null, 99, 'manual_restock', 'intento ajeno');
    raise exception 'FALLO: % ajustó el stock de una tienda ajena', p_alias;
  exception when insufficient_privilege then
    if sqlerrm <> 'NOT_OWNER' then raise; end if;
    raise notice 'OK: % → NOT_OWNER (42501)', p_alias;
  end;
end $$;
grant execute on function pg_temp.qa_intenta(text, text) to authenticated;

set local role authenticated;
select pg_temp.qa_intenta('vendedor.ok (externo verificado)', current_setting('qa.u_vok'));
select pg_temp.qa_intenta('owner.b (dueño de otra escuela)',   current_setting('qa.u_ownb'));
select pg_temp.qa_intenta('padre.a (miembro de A)',            current_setting('qa.u_padre'));
select pg_temp.qa_intenta('coach.a (staff de A, no admin)',    current_setting('qa.u_coach'));

-- ── BFF: service role con p_actor de un vendedor ajeno ───────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000001', null, 99, 'manual_restock', 'bff ajeno',
                                    current_setting('qa.u_vok')::uuid);
    raise exception 'FALLO: el BFF con p_actor ajeno ajustó';
  exception when insufficient_privilege then
    if sqlerrm <> 'NOT_OWNER' then raise; end if;
    raise notice 'OK: service role + p_actor ajeno → NOT_OWNER';
  end;
end $$;

-- ── UPDATE directo de stock: ni el dueño (la columna no es suya) ─────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    update public.product_variants set stock = 500 where id = '00000000-0000-4000-e000-000000000001';
    raise exception 'FALLO: el dueño escribió product_variants.stock directo';
  exception when insufficient_privilege then raise notice 'OK: UPDATE product_variants.stock → 42501';
  end;
  begin
    update public.products set stock = 500 where id = '00000000-0000-4000-d000-000000000001';
    raise exception 'FALLO: el dueño escribió products.stock directo';
  exception when insufficient_privilege then raise notice 'OK: UPDATE products.stock → 42501';
  end;
end $$;

-- Ni una unidad ni una línea de kardex cambiaron.
reset role;
do $$
begin
  if exists (select 1 from public.product_variants v join qa_p01b_antes a using (id) where v.stock <> a.stock) then
    raise exception 'FALLO: cambió el stock de alguna talla';
  end if;
  if (select count(*) from public.inventory_logs) <> (select n from qa_p01b_logs) then
    raise exception 'FALLO: los intentos rechazados dejaron kardex';
  end if;
  raise notice 'OK: stock y kardex intactos tras los intentos';
end $$;

rollback;
