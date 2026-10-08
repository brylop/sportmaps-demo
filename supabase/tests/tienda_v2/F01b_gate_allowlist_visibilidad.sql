-- M-F0-1 (tienda v2 F0) — store_seller_allowed + allowlist de piloto (D-14) +
-- RESTRICTIVE store_seller_visible.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F01b_gate_allowlist_visibilidad.sql
--
-- Plan: "anon select count(*) from products con flag ON y allowlist = [escuela] →
-- solo productos de esa escuela"; "store_seller_allowed de un externo pending → false".

begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_pend',  (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);

-- Tienda de la escuela A (owner.a) y un producto publicado suyo.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
insert into public.products (id, name, description, price, stock, vendor_profile_id, status, visibility, category_id, image_url)
values (gen_random_uuid(), 'QA Gorra Academia Andes F01b',  -- id propio: la preparación del E2E deja ...a1 commiteado
        'Gorra oficial de la academia para entrenamientos al aire libre', 45000, 5,
        current_setting('qa.vp_a')::uuid, 'active', 'public',
        (select id from public.product_categories limit 1), 'https://example.test/gorra.png');

-- ── Flag ON + allowlist = [tienda A] ─────────────────────────────────────────
update public.platform_config
   set value = jsonb_build_object('enabled', true, 'allowlist', jsonb_build_array(current_setting('qa.vp_a')))
 where key = 'store_enabled';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_total int; v_ajenos int;
begin
  select count(*), count(*) filter (where vendor_profile_id <> current_setting('qa.vp_a')::uuid)
    into v_total, v_ajenos from public.products;
  if v_total = 0 then raise exception 'FALLO (control): anon no ve el producto de la tienda piloto'; end if;
  if v_ajenos > 0 then raise exception 'FALLO: anon ve % productos de vendedores fuera de la allowlist', v_ajenos; end if;
  raise notice 'OK: con allowlist=[A] anon ve % producto(s), todos de A', v_total;
  if public.store_seller_allowed(current_setting('qa.vp_ok')::uuid) then
    raise exception 'FALLO: vendedor verificado fuera de la allowlist quedo habilitado';
  end if;
  raise notice 'OK: verificado fuera de la allowlist → no habilitado';
end $$;

-- El dueño fuera de la allowlist sigue viendo lo suyo (can_manage_store).
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.products where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  if n = 0 then raise exception 'FALLO: el vendedor fuera de la allowlist dejo de ver sus productos'; end if;
  raise notice 'OK: vendedor fuera de la allowlist ve sus % productos', n;
end $$;

-- ── Sin allowlist: los verificados sí, el pendiente no ───────────────────────
reset role;
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare n_ok int; n_pend int;
begin
  if not public.store_seller_allowed(current_setting('qa.vp_ok')::uuid) then
    raise exception 'FALLO: verificado sin allowlist no habilitado';
  end if;
  if public.store_seller_allowed(current_setting('qa.vp_pend')::uuid) then
    raise exception 'FALLO: externo pending habilitado';
  end if;
  select count(*) into n_ok   from public.products where vendor_profile_id = current_setting('qa.vp_ok')::uuid;
  select count(*) into n_pend from public.products where vendor_profile_id = current_setting('qa.vp_pend')::uuid;
  if n_ok = 0 then raise exception 'FALLO (control): anon no ve productos del verificado'; end if;
  if n_pend > 0 then raise exception 'FALLO: anon ve productos del vendedor pendiente'; end if;
  raise notice 'OK: sin allowlist anon ve el verificado (%), no el pendiente; store_seller_allowed(pending)=false', n_ok;
end $$;

-- ── Allowlist mal formada = falla cerrado ────────────────────────────────────
reset role;
update public.platform_config set value = '{"enabled": true, "allowlist": "todos"}'::jsonb where key = 'store_enabled';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if public.store_seller_allowed(current_setting('qa.vp_ok')::uuid)
     or public.store_seller_allowed(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: allowlist mal formada habilita vendedores';
  end if;
  raise notice 'OK: allowlist mal formada → nadie habilitado';
end $$;

-- ── Escuela sin operar (prueba vencida) → su tienda no vende ─────────────────
reset role;
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
insert into public.school_subscriptions (school_id, status, trial_ends_at)
  values (current_setting('qa.school_a')::uuid, 'trial_expired', now() - interval '1 day')
  on conflict (school_id) do update set status = 'trial_expired';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if public.store_seller_allowed(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: tienda de escuela no operativa habilitada';
  end if;
  raise notice 'OK: escuela con prueba vencida → tienda no habilitada';
end $$;

-- ── Flag OFF: anon no ve nada ────────────────────────────────────────────────
reset role;
update public.platform_config set value = '{"enabled": false}'::jsonb where key = 'store_enabled';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.products;
  if n > 0 then raise exception 'FALLO: tienda apagada y anon ve % productos', n; end if;
  raise notice 'OK: tienda apagada → anon 0 productos';
end $$;

rollback;
