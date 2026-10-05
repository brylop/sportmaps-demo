-- M-F0-1/M-F0-2 (tienda v2 F0) — escritura de productos solo por quien administra
-- la tienda; stock fuera del UPDATE del cliente; trial_block no frena externos;
-- gate de publicación sin el bug de BEFORE INSERT; school_only visible (B4).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F02a_products_guard.sql
--
-- Casos del plan: R11 (INSERT con perfil ajeno → 42501), admin de la escuela sí,
-- coach no, R9 (UPDATE stock → 42501 por columna), UPDATE price ok, anon INSERT
-- 42501, externo con school_id NULL ya no lo frena trial_block. Más: vendor_id y
-- school_id salen del perfil (no del body), DELETE solo de borradores.
-- La tienda se prende dentro de la transacción (apagada, M3 cierra todo).

begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.owner_a',  (select user_id::text   from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_pend',  (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
select set_config('qa.cat',      (select id::text from public.product_categories limit 1), true);
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);

-- ── vendedor.ok (externo verificado, school_id NULL) ─────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_id uuid; v_n int;
begin
  -- R11: con el perfil de otro vendedor
  begin
    insert into public.products (name, price, stock, vendor_profile_id, status)
    values ('QA producto robado', 1000, 1, current_setting('qa.vp_pend')::uuid, 'draft');
    raise exception 'FALLO: inserto un producto con el vendor_profile de otro (R11)';
  exception when insufficient_privilege then raise notice 'OK: R11 perfil ajeno → 42501';
  end;

  -- Sin perfil (legacy vendor_id = yo) tampoco
  begin
    insert into public.products (name, price, stock, vendor_id, status)
    values ('QA producto sin perfil', 1000, 1, auth.uid(), 'draft');
    raise exception 'FALLO: inserto un producto sin vendor_profile_id';
  exception when insufficient_privilege then raise notice 'OK: sin vendor_profile_id → 42501';
  end;

  -- Externo con su perfil: trial_block ya no lo frena; vendor_id/school_id del body se ignoran
  insert into public.products (name, price, stock, vendor_profile_id, status, school_id, vendor_id)
  values ('QA Cuerda nueva', 30000, 4, current_setting('qa.vp_ok')::uuid, 'draft',
          current_setting('qa.school_a')::uuid, current_setting('qa.owner_a')::uuid)
  returning id into v_id;
  raise notice 'OK: externo (school_id NULL) inserta su producto: trial_block ya no lo frena';

  -- R9: stock no se actualiza directo
  begin
    update public.products set stock = 999 where id = v_id;
    raise exception 'FALLO: el vendedor actualizo stock directo (R9)';
  exception when insufficient_privilege then raise notice 'OK: R9 UPDATE stock → 42501 (columna)';
  end;
  begin
    update public.product_variants set stock = 999 where id = '00000000-0000-4000-e000-000000000004';
    raise exception 'FALLO: el vendedor actualizo stock de variante directo';
  exception when insufficient_privilege then raise notice 'OK: UPDATE stock de variante → 42501';
  end;

  update public.products set price = 31000 where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: UPDATE price del dueño afecto % filas', v_n; end if;
  raise notice 'OK: UPDATE price del dueño';

  -- No se muda el producto a otro perfil
  begin
    update public.products set vendor_profile_id = current_setting('qa.vp_pend')::uuid where id = v_id;
    raise exception 'FALLO: el vendedor cambio el vendor_profile_id de su producto';
  exception when insufficient_privilege then raise notice 'OK: vendor_profile_id no editable';
  end;

  -- Producto ajeno: UPDATE no toca nada
  update public.products set price = 1 where vendor_profile_id = current_setting('qa.vp_pend')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO: el vendedor edito % productos ajenos', v_n; end if;
  raise notice 'OK: UPDATE de producto ajeno → 0 filas';

  -- DELETE: el activo no se borra (se archiva); el borrador sí
  delete from public.products where id = '00000000-0000-4000-d000-000000000002';
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO: se borro un producto activo'; end if;
  delete from public.products where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: no se pudo borrar el borrador propio'; end if;
  raise notice 'OK: DELETE solo de borradores (activo 0 filas, borrador 1)';
end $$;

reset role;
do $$
declare r record;
begin
  insert into public.products (name, price, stock, vendor_profile_id, status, school_id, vendor_id)
  values ('QA control relleno', 1000, 1, current_setting('qa.vp_ok')::uuid, 'draft',
          current_setting('qa.school_a')::uuid, current_setting('qa.owner_a')::uuid)
  returning vendor_id, school_id into r;
  if r.vendor_id <> (select user_id from public.vendor_profiles where id = current_setting('qa.vp_ok')::uuid)
     or r.school_id is not null then
    raise exception 'FALLO: vendor_id/school_id no salen del perfil (vendor_id=% school_id=%)', r.vendor_id, r.school_id;
  end if;
  raise notice 'OK: vendor_id/school_id del body se ignoran; salen del perfil';
end $$;

-- ── admin.a (no dueño) crea producto de la tienda de A; coach.a no ───────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record;
begin
  insert into public.products (name, description, price, stock, vendor_profile_id, status, visibility, category_id, image_url)
  values ('QA Termo Academia Andes', 'Termo oficial de la academia para hidratacion en entrenamientos',
          35000, 10, current_setting('qa.vp_a')::uuid, 'active', 'school_only',
          current_setting('qa.cat')::uuid, 'https://example.test/termo.png')
  returning id, vendor_id, school_id, status into r;
  if r.school_id <> current_setting('qa.school_a')::uuid or r.vendor_id <> current_setting('qa.owner_a')::uuid then
    raise exception 'FALLO: producto escolar con school_id=% vendor_id=%', r.school_id, r.vendor_id;
  end if;
  if r.status <> 'active' then
    raise exception 'FALLO: INSERT directo en active quedo %, esperado active (gate arreglado, tienda verificada)', r.status;
  end if;
  perform set_config('qa.p_a', r.id::text, true);
  raise notice 'OK: admin (no dueño) crea producto de la tienda escolar; school_id=A; INSERT directo en active pasa el gate';
end $$;

-- B4: school_only lo ve un miembro (padre.a) y no un ajeno (padre.b)
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.products where id = current_setting('qa.p_a')::uuid) then
    raise exception 'FALLO: el padre miembro no ve el producto school_only de su escuela';
  end if;
  raise notice 'OK: school_only visible para el padre miembro (B4)';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.products where id = current_setting('qa.p_a')::uuid) then
    raise exception 'FALLO: un padre ajeno ve el producto school_only';
  end if;
  raise notice 'OK: school_only invisible para un padre ajeno';
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'coach.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    insert into public.products (name, price, stock, vendor_profile_id, status)
    values ('QA producto del coach', 1000, 1, current_setting('qa.vp_a')::uuid, 'draft');
    raise exception 'FALLO: el coach creo un producto de la tienda';
  exception when insufficient_privilege then raise notice 'OK: coach INSERT → 42501';
  end;
end $$;

-- ── anon no escribe ──────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    insert into public.products (name, price, stock, vendor_profile_id, status)
    values ('QA anon', 1, 1, current_setting('qa.vp_ok')::uuid, 'draft');
    raise exception 'FALLO: anon inserto un producto';
  exception when insufficient_privilege then raise notice 'OK: anon INSERT products → 42501';
  end;
  begin
    update public.product_images set sort_order = 0;
    raise exception 'FALLO: anon actualiza product_images';
  exception when insufficient_privilege then raise notice 'OK: anon UPDATE product_images → 42501';
  end;
end $$;

rollback;
