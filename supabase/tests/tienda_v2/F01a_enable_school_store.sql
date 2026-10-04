-- M-F0-1 (tienda v2 F0) — enable_school_store: quien activa la tienda de la escuela.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F01a_enable_school_store.sql
--
-- Casos del plan §M-F0-1: owner → uuid con perfil school/verificado; coach → 42501;
-- escuela sin addon → ADDON_REQUIRED. Más: admin (no dueño) puede (D-15), padre no,
-- idempotente, dueño con otro perfil → OWNER_HAS_OTHER_VENDOR_PROFILE (D-16), y el
-- usuario no puede cambiarse school_id a mano (guard de M3 extendido).

begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.school_b', (select school_id::text from qa_twin.actores where alias = 'owner.b'), true);
select set_config('qa.owner_a',  (select user_id::text   from qa_twin.actores where alias = 'owner.a'), true);

-- ── owner.a crea la tienda de A ──────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_id uuid; v_id2 uuid;
begin
  v_id := public.enable_school_store(current_setting('qa.school_a')::uuid);
  if v_id is null then raise exception 'FALLO: enable_school_store no devolvio id'; end if;
  perform set_config('qa.vp_a', v_id::text, true);
  v_id2 := public.enable_school_store(current_setting('qa.school_a')::uuid);
  if v_id2 <> v_id then raise exception 'FALLO: no es idempotente (% vs %)', v_id, v_id2; end if;
  raise notice 'OK: owner crea la tienda de su escuela (idempotente)';
end $$;

reset role;
do $$
declare r record;
begin
  select * into r from public.vendor_profiles where id = current_setting('qa.vp_a')::uuid;
  if r.vendor_type::text <> 'school' or r.school_id <> current_setting('qa.school_a')::uuid
     or r.verification_status <> 'verified' or r.user_id <> current_setting('qa.owner_a')::uuid
     or not coalesce((r.capabilities->>'can_sell_products')::boolean, false) or not r.is_active then
    raise exception 'FALLO: perfil creado mal: type=% school=% verif=% user=% caps=%',
      r.vendor_type, r.school_id, r.verification_status, r.user_id, r.capabilities;
  end if;
  if coalesce(current_setting('sportmaps.trusted_rpc', true), '') = 'on' then
    raise exception 'FALLO: sportmaps.trusted_rpc quedo prendido despues de la RPC';
  end if;
  raise notice 'OK: perfil school, school_id=A, verified, can_sell_products, dueño = owner de A (comision default %)', r.commission_rate;
end $$;

-- ── admin.a (no dueño) también puede; reusa el mismo perfil ─────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if public.enable_school_store(current_setting('qa.school_a')::uuid) <> current_setting('qa.vp_a')::uuid then
    raise exception 'FALLO: admin.a obtuvo otro perfil';
  end if;
  if not public.can_manage_store(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: admin.a no administra la tienda de su escuela';
  end if;
  raise notice 'OK: admin (no dueño) activa y administra la tienda (D-15)';
end $$;

-- ── coach.a: 42501 y no administra ───────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'coach.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.enable_school_store(current_setting('qa.school_a')::uuid);
    raise exception 'FALLO: el coach activo la tienda';
  exception when insufficient_privilege then raise notice 'OK: coach → 42501';
  end;
  if public.can_manage_store(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: el coach administra la tienda';
  end if;
  raise notice 'OK: coach no administra la tienda';
end $$;

-- ── padre.a: 42501 ───────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.enable_school_store(current_setting('qa.school_a')::uuid);
    raise exception 'FALLO: el padre activo la tienda';
  exception when insufficient_privilege then raise notice 'OK: padre → 42501';
  end;
end $$;

-- ── owner.b: escuela sin addon store → ADDON_REQUIRED ────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.enable_school_store(current_setting('qa.school_b')::uuid);
    raise exception 'FALLO: escuela sin addon activo tienda';
  exception when others then
    if sqlerrm <> 'ADDON_REQUIRED' then raise; end if;
    raise notice 'OK: escuela sin addon → ADDON_REQUIRED';
  end;
end $$;

-- ── Dueño que ya es vendedor externo → OWNER_HAS_OTHER_VENDOR_PROFILE ────────
reset role;
insert into public.school_addons (school_id, addon_key, enabled)
  values (current_setting('qa.school_b')::uuid, 'store', true)
  on conflict do nothing;
update public.school_addons set enabled = true
 where school_id = current_setting('qa.school_b')::uuid and addon_key = 'store';
update public.schools set owner_id = (select user_id from qa_twin.actores where alias = 'vendedor.ok')
 where id = current_setting('qa.school_b')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.enable_school_store(current_setting('qa.school_b')::uuid);
    raise exception 'FALLO: se creo/reuso tienda escolar sobre un perfil externo';
  exception when others then
    if sqlerrm <> 'OWNER_HAS_OTHER_VENDOR_PROFILE' then raise; end if;
    raise notice 'OK: dueño con perfil externo → OWNER_HAS_OTHER_VENDOR_PROFILE (D-16)';
  end;
end $$;

-- ── El vendedor no se asigna una escuela por PostgREST ───────────────────────
do $$
begin
  begin
    update public.vendor_profiles set school_id = current_setting('qa.school_a')::uuid
     where user_id = auth.uid();
    raise exception 'FALLO: el vendedor se asigno school_id';
  exception when insufficient_privilege then raise notice 'OK: school_id congelado (VENDOR_FIELD_LOCKED)';
  end;
end $$;

rollback;
