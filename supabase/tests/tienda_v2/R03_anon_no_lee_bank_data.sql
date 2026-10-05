-- R3 (tienda v2 §8.2) — anon NO puede leer vendor_profiles.bank_data.
-- Correr contra el gemelo:  npm run qa:sql -- supabase/tests/tienda_v2/R03_anon_no_lee_bank_data.sql
--
-- Convencion de los casos: todo dentro de BEGIN … ROLLBACK; un caso FALLA si
-- termina con error (RAISE EXCEPTION 'FALLO: …'). NOTICE 'OK: …' documenta cada
-- afirmacion que paso.
--
-- Datos: seed qa_twin_seed.sql trae un vendedor VERIFICADO (visible para anon por
-- la policy vendor_profiles_select_public) con bank_data ficticio.

begin;

set local role anon;

do $$
declare
  v_nombre text;
  v_bank   jsonb;
begin
  -- Control positivo: anon SI ve el perfil publico del vendedor verificado.
  -- Si esto falla, la prueba negativa de abajo no demostraria nada (tabla vacia o
  -- sin grant alguno).
  select display_name into v_nombre
    from public.vendor_profiles where slug = 'qa-deportes-verificado';
  if v_nombre is null then
    raise exception 'FALLO (control): anon no ve el vendedor verificado; la prueba no es concluyente';
  end if;
  raise notice 'OK: anon ve el perfil publico del vendedor verificado (%)', v_nombre;

  -- Negativo: la columna bank_data debe estar denegada (42501), no solo vacia.
  begin
    select bank_data into v_bank
      from public.vendor_profiles where slug = 'qa-deportes-verificado';
    raise exception 'FALLO: anon LEE vendor_profiles.bank_data (%)', v_bank;
  exception when insufficient_privilege then
    raise notice 'OK: anon recibe 42501 al pedir bank_data';
  end;

  -- Negativo: tampoco por SELECT * (que arrastra la columna).
  begin
    perform * from public.vendor_profiles limit 1;
    raise exception 'FALLO: anon puede hacer SELECT * sobre vendor_profiles (incluye bank_data)';
  exception when insufficient_privilege then
    raise notice 'OK: SELECT * de anon denegado (42501)';
  end;
end $$;

rollback;
