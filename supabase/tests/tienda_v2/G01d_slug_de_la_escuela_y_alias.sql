-- G01d — el enlace de una tienda escolar sale del slug de la ESCUELA (gym-rm),
-- no del nombre del dueño (robinson-mendoza). El slug viejo queda como alias
-- (store_slug_aliases) para no romper enlaces ya compartidos, y ningún
-- vendedor nuevo puede quedarse con ese alias.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/G01d_slug_de_la_escuela_y_alias.sql
begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_a',     (select vendor_profile_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.owner_name', (select full_name from public.profiles where id = (select user_id from qa_twin.actores where alias = 'owner.a')), true);

-- Como GYM RM: perfil escolar creado por el onboarding de vendedor, con el nombre del dueño.
delete from public.store_slug_aliases where vendor_profile_id = current_setting('qa.vp_a')::uuid;
update public.vendor_profiles set slug = 'nombre-del-dueno-qa', display_name = current_setting('qa.owner_name')
 where id = current_setting('qa.vp_a')::uuid;

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.enable_school_store(current_setting('qa.school_a')::uuid);
reset role;

do $$
declare r record; s text;
begin
  select vp.slug, vp.display_name, sc.slug as school_slug, sc.name into r
    from public.vendor_profiles vp join public.schools sc on sc.id = vp.school_id
   where vp.id = current_setting('qa.vp_a')::uuid;
  if r.slug <> r.school_slug then raise exception 'FALLO: slug % (esperado %)', r.slug, r.school_slug; end if;
  if r.display_name <> r.name then raise exception 'FALLO: display_name % (esperado el de la escuela %)', r.display_name, r.name; end if;
  if not exists (select 1 from public.store_slug_aliases where slug = 'nombre-del-dueno-qa'
                  and vendor_profile_id = current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: el slug viejo no quedó como alias';
  end if;
  raise notice 'OK: slug = slug de la escuela (%), nombre = el de la escuela, el viejo queda como alias', r.slug;

  s := public._store_sync_school_slug(current_setting('qa.vp_a')::uuid);
  if s <> r.slug or (select count(*) from public.store_slug_aliases where vendor_profile_id = current_setting('qa.vp_a')::uuid) <> 1 then
    raise exception 'FALLO: no es idempotente (% / aliases)', s;
  end if;
  raise notice 'OK: idempotente';
end $$;

-- Slug de la escuela ocupado por otro vendedor → sufijo, sin robarlo.
update public.vendor_profiles set slug = 'otro-viejo-qa' where id = current_setting('qa.vp_a')::uuid;
update public.vendor_profiles set slug = (select slug from public.schools where id = current_setting('qa.school_a')::uuid)
 where id = current_setting('qa.vp_ok')::uuid;
do $$
declare s text; base text := (select slug from public.schools where id = current_setting('qa.school_a')::uuid);
begin
  s := public._store_sync_school_slug(current_setting('qa.vp_a')::uuid);
  if s !~ ('^' || base || '-[0-9]+$') then raise exception 'FALLO: con el slug ocupado quedó %', s; end if;
  if (select slug from public.vendor_profiles where id = current_setting('qa.vp_ok')::uuid) <> base then
    raise exception 'FALLO: le quitó el slug al otro vendedor';
  end if;
  raise notice 'OK: slug de la escuela ocupado → % (no se le quita al otro)', s;
end $$;

-- Un vendedor nuevo con el nombre del dueño no se queda con el alias.
insert into public.vendor_profiles (user_id, vendor_type, display_name, is_active)
values ((select user_id from qa_twin.actores where alias = 'padre.b'), 'store', 'Nombre del dueno QA', true);
do $$
declare s text;
begin
  select slug into s from public.vendor_profiles where user_id = (select user_id from qa_twin.actores where alias = 'padre.b');
  if s = 'nombre-del-dueno-qa' then raise exception 'FALLO: el vendedor nuevo tomó el alias de la tienda escolar'; end if;
  raise notice 'OK: el vendedor nuevo recibe % (el alias sigue siendo de la tienda escolar)', s;
end $$;

-- authenticated no lee los alias y su alta de vendedor no choca con la tabla (trigger DEFINER).
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'atleta.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    insert into public.vendor_profiles (user_id, vendor_type, display_name, is_active)
    values (auth.uid(), 'store', 'Nombre del dueno QA', true);
    raise notice 'OK: alta de vendedor por authenticated sigue funcionando con la tabla de alias';
  exception when insufficient_privilege then
    if sqlerrm like '%store_slug_aliases%' then raise exception 'FALLO: generate_vendor_slug sin permiso sobre los alias'; end if;
    raise notice 'OK: la RLS de vendor_profiles decide el alta (no la tabla de alias): %', sqlerrm;
  end;
  begin
    perform 1 from public.store_slug_aliases;
    raise exception 'FALLO: authenticated lee store_slug_aliases';
  exception when insufficient_privilege then raise notice 'OK: store_slug_aliases solo para el BFF';
  end;
end $$;
reset role;
rollback;
