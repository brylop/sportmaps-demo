-- C13d · Ingresos por origen = fórmula única (payments) + tienda, sin duplicar.
-- Seed de A: mensualidad pagada 150.000 (ago) y parcial con abono 50.000 (sep).
-- Más una venta de tienda de 80.000 (sep). Esperado:
--   · ago: mensualidades 150.000 · sep: mensualidades 50.000 + tienda 80.000.
--   · Σ by_origin = Σ finance_income_summary + Σ store_income_summary = 280.000.
--   · La tienda NO entra a cash_ledger ni a payments (contrato §6): leer las
--     RPC no escribe nada y el libro sigue con las mismas filas de ingreso.
-- Correr:  npm run qa:sql -- supabase/tests/contabilidad_v2/C13d_ingresos_por_origen_sin_duplicar.sql

begin;

insert into public.vendor_profiles (id, user_id, vendor_type, school_id, display_name, slug,
                                    verification_status, is_active, capabilities)
values ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'school',
        '00000000-0000-4000-b000-000000000001', 'Tienda QA Academia Andes', 'tienda-qa-andes',
        'verified', true, '{"can_sell_products": true, "can_sell_services": false}'::jsonb)
on conflict (id) do update
   set vendor_type = 'school', school_id = excluded.school_id, verification_status = 'verified', is_active = true;

insert into public.orders (id, user_id, total_amount, status, vendor_profile_id, vendor_id, school_id,
                           payment_method, provider_transaction_id, paid_at, reference)
values ('00000000-0000-4000-c000-0000000013d1', '00000000-0000-4000-a000-000000000004', 80000, 'delivered',
        '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-b000-000000000001', 'wompi', 'tx-c13d-1', '2026-09-20 10:00:00-05', 'C13D-1');

select set_config('qa.pay_n',  (select count(*)::text from public.payments), true);
select set_config('qa.pay_ms', (select coalesce(max(updated_at), 'epoch')::text from public.payments), true);

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare
  v_pay numeric; v_store numeric; v_all numeric; v numeric; n_ledger_antes int; n_ledger int; n_tienda_ledger int;
begin
  select count(*) into n_ledger_antes from public.cash_ledger
   where direction = 'income' and owner_id = '00000000-0000-4000-b000-000000000001';

  select coalesce(sum(income_amount), 0) into v_pay
    from public.finance_income_summary('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31', null, 'month');
  select coalesce(sum(income_amount), 0) into v_store
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31', null, 'month');
  select coalesce(sum(income_amount), 0) into v_all
    from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31', null, 'month');
  if (v_pay, v_store, v_all) <> (200000, 80000, 280000) then
    raise exception 'FALLO: cobros/tienda/combinado = %/%/% (esperado 200000/80000/280000)', v_pay, v_store, v_all;
  end if;
  if v_all <> v_pay + v_store then raise exception 'FALLO: el combinado duplica o pierde: % <> % + %', v_all, v_pay, v_store; end if;
  raise notice 'OK: combinado 280000 = cobros 200000 + tienda 80000';

  select income_amount into v from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31')
   where bucket = '2026-08' and origin = 'mensualidades';
  if v is distinct from 150000 then raise exception 'FALLO: ago mensualidades % (esperado 150000)', v; end if;
  select income_amount into v from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31')
   where bucket = '2026-09' and origin = 'mensualidades';
  if v is distinct from 50000 then raise exception 'FALLO: sep mensualidades % (esperado 50000, el abono)', v; end if;
  select income_amount into v from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31')
   where bucket = '2026-09' and origin = 'tienda';
  if v is distinct from 80000 then raise exception 'FALLO: sep tienda % (esperado 80000)', v; end if;
  if exists (select 1 from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31')
              where bucket = '2026-08' and origin = 'tienda') then
    raise exception 'FALLO: aparece tienda en agosto';
  end if;
  select coalesce(sum(income_amount), 0) into v
    from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31', null, 'total');
  if v <> 280000 then raise exception 'FALLO: p_group total % (esperado 280000)', v; end if;
  raise notice 'OK: por mes y origen (ago 150000 mensualidades; sep 50000 mensualidades + 80000 tienda)';

  -- La tienda no está en el libro de caja (no se abrió otra rama en cash_ledger).
  select count(*) into n_ledger from public.cash_ledger
   where direction = 'income' and owner_id = '00000000-0000-4000-b000-000000000001';
  select count(*) into n_tienda_ledger from public.cash_ledger where id = '00000000-0000-4000-c000-0000000013d1';
  if n_ledger <> n_ledger_antes or n_tienda_ledger <> 0 then
    raise exception 'FALLO: la venta de tienda entró a cash_ledger (% → %, %)', n_ledger_antes, n_ledger, n_tienda_ledger;
  end if;

  -- owner_type distinto de school: vacío (igual que finance_income_lines en F0).
  begin
    if exists (select 1 from public.finance_income_by_origin('vendor', '00000000-0000-4000-c000-0000000000a1', '2026-01-01', '2026-12-31')) then
      raise exception 'FALLO: owner_type vendor devolvió filas';
    end if;
    raise notice 'OK: owner_type vendor → vacío';
  exception when insufficient_privilege then
    -- finance_permission('vendor', …) puede negar: también vale (nunca ceros falsos).
    raise notice 'OK: owner_type vendor → 42501';
  end;
end $$;
reset role;

do $$ begin
  if (select count(*)::text from public.payments) <> current_setting('qa.pay_n')
     or (select coalesce(max(updated_at), 'epoch')::text from public.payments) <> current_setting('qa.pay_ms') then
    raise exception 'FALLO: leer los ingresos de tienda modificó payments';
  end if;
  if exists (select 1 from public.payments where concept ilike '%C13D%' or reference = 'C13D-1') then
    raise exception 'FALLO: la venta de tienda se copió a payments';
  end if;
  raise notice 'OK: payments intacto; la tienda no se copia a payments';
end $$;

rollback;
