-- R3b (tienda v2 §8.2, complemento de R3; blindaje 2.10 / T1) — un usuario
-- autenticado cualquiera (padre.a) NO debe leer los datos bancarios de un vendedor
-- ajeno. Correr:  npm run qa:sql -- supabase/tests/tienda_v2/R03b_authenticated_no_lee_bank_data_ajeno.sql
--
-- ESTADO AL 2026-10-03: FALLA en el gemelo (= la viva). M1 (20261002125955)
-- solo le quito la columna a `anon`; `authenticated` conserva SELECT sobre
-- bank_data y la policy vendor_profiles_select_public (TO public) le deja ver
-- las filas de los vendedores verificados. Pasa a verde cuando las lecturas
-- sensibles se muevan al BFF / se revoque la columna a authenticated.

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

rollback;
