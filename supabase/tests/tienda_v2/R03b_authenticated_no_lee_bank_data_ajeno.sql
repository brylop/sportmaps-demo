-- R3b (tienda v2 §8.2, complemento de R3; blindaje 2.10 / T1) — un usuario
-- autenticado cualquiera (padre.a) NO debe leer los datos bancarios de un vendedor
-- ajeno. Correr:  npm run qa:sql -- supabase/tests/tienda_v2/R03b_authenticated_no_lee_bank_data_ajeno.sql
--
-- ESTADO: FALLABA el 2026-10-03 (M1 20261002125955 solo le quito la columna a
-- `anon`). PASA desde M-F0-1 (20261003202431 §8): authenticated tiene SELECT por
-- columnas en vendor_profiles, sin bank_data. Ningun lector con JWT la pedia
-- (el BFF usa service role; OrganizerSettings lee event_organizers).
-- Control positivo: el vendedor sigue leyendo las columnas de su perfil que usan
-- useVendorProfile / VendorGuard.

begin;

-- Actor: leer el UUID antes de bajar de rol (authenticated no ve qa_twin).
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  v_bank jsonb;
begin
  begin
    select bank_data into v_bank
      from public.vendor_profiles where slug = 'qa-deportes-verificado';
    if v_bank is not null and v_bank <> '{}'::jsonb then
      raise exception 'FALLO: un padre autenticado lee bank_data de un vendedor ajeno: %', v_bank;
    end if;
    raise notice 'OK: bank_data ajeno no visible (fila filtrada o vacia)';
  exception when insufficient_privilege then
    raise notice 'OK: 42501 al pedir bank_data ajeno';
  end;
end $$;

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record;
begin
  select id, user_id, vendor_type, display_name, slug, is_active, verification_status,
         capabilities, verification_doc_url
    into r from public.vendor_profiles where user_id = auth.uid();
  if r.id is null then raise exception 'FALLO (control): el vendedor no lee su propio perfil'; end if;
  raise notice 'OK: el vendedor lee las columnas de su perfil que usa el frontend';
  begin
    perform bank_data from public.vendor_profiles where user_id = auth.uid();
    raise exception 'FALLO: bank_data legible con JWT';
  exception when insufficient_privilege then
    raise notice 'OK: bank_data propio tampoco por PostgREST (se gestiona por el BFF)';
  end;
end $$;

rollback;
