-- C05 · Una sola fórmula de ingreso (M2; D-ING, A3, C7, C8, C9) e invariante
-- IC6: cash_ledger = finance_income_summary = school_payment_kpis =
-- get_school_dashboard_stats, al peso, por mes y en total.
--
-- Datos extra (escuela A, como postgres, dentro de la transacción):
--   p1 paid 70.700 abonado 70.000 (C7 mora no cobrada)  jul  sin sede   → 70.000
--   p2 paid 70.700 abonado 320.000 (C7 excedente)        jul  sede A    → 70.700 (+249.300 excedente)
--   p3 paid 100.000 sin amount_paid                       jul  sede A2   → 100.000 (fuera con sede A)
--   p4 paid 55.000 SIN payment_date (C8)                  —    sin sede  → bucket 'sin_fecha'
--   p5 partial 100.000 sin amount_paid                    jul  sin sede  → 0 (D-ING)
--   p6 cancelled con 70.000 abonados (C9)                 jul            → no es ingreso
-- Más los del seed: ago 150.000 (paid) · sep 50.000 (partial).

begin;

insert into public.school_branches (id, school_id, name)
values ('00000000-0000-4000-b100-0000000000a2', '00000000-0000-4000-b000-000000000001', 'Sede QA 2');
select set_config('qa.sede_a', (select id::text from public.school_branches
                                  where school_id = '00000000-0000-4000-b000-000000000001'
                                    and id <> '00000000-0000-4000-b100-0000000000a2' limit 1), true);

insert into public.payments (id, school_id, branch_id, amount, amount_paid, concept, due_date, payment_date, status,
                             payment_method, payment_category)
values
  ('00000000-0000-4000-f100-000000000001', '00000000-0000-4000-b000-000000000001', null,
   70700, 70000, 'C7 mora', '2026-07-05', '2026-07-10', 'paid', 'cash', 'mensualidad'),
  ('00000000-0000-4000-f100-000000000002', '00000000-0000-4000-b000-000000000001', current_setting('qa.sede_a')::uuid,
   70700, 320000, 'C7 excedente', '2026-07-05', '2026-07-15', 'paid', 'transfer', 'mensualidad'),
  ('00000000-0000-4000-f100-000000000003', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b100-0000000000a2',
   100000, null, 'otra sede', '2026-07-05', '2026-07-20', 'paid', 'cash', 'torneo'),
  ('00000000-0000-4000-f100-000000000004', '00000000-0000-4000-b000-000000000001', null,
   55000, 55000, 'C8 importado sin fecha', '2026-06-26', null, 'paid', 'cash', null),
  ('00000000-0000-4000-f100-000000000005', '00000000-0000-4000-b000-000000000001', null,
   100000, null, 'partial sin abono', '2026-07-05', '2026-07-25', 'partial', 'cash', 'mensualidad'),
  ('00000000-0000-4000-f100-000000000006', '00000000-0000-4000-b000-000000000001', null,
   70000, 70000, 'C9 duplicado cancelado', '2026-07-05', '2026-07-18', 'cancelled', 'cash', 'mensualidad');

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;

do $$
declare
  a      constant uuid := '00000000-0000-4000-b000-000000000001';
  sede_a uuid := current_setting('qa.sede_a')::uuid;
  r      record;
  v_led  numeric; v_sum numeric; v_lines numeric;
  v_kpi  jsonb;  v_dash json;
  v_total_esperado constant numeric := 150000 + 50000 + 70000 + 70700 + 100000 + 55000 + 0;  -- 495.700
begin
  -- D-ING por línea
  for r in select * from (values
      ('00000000-0000-4000-f100-000000000001'::uuid, 70000::numeric, 0::numeric),
      ('00000000-0000-4000-f100-000000000002'::uuid, 70700, 249300),
      ('00000000-0000-4000-f100-000000000003'::uuid, 100000, 0),
      ('00000000-0000-4000-f100-000000000005'::uuid, 0, 0)) t(id, inc, exc)
  loop
    select l.income_amount, l.excess_amount into v_lines, v_sum
      from public.finance_income_lines('school', a, '2026-01-01', '2026-12-31') l where l.payment_id = r.id;
    if v_lines is distinct from r.inc or v_sum is distinct from r.exc then
      raise exception 'FALLO: línea % ingreso %/excedente % (esperado %/%)', r.id, v_lines, v_sum, r.inc, r.exc;
    end if;
  end loop;
  if exists (select 1 from public.finance_income_lines('school', a, '2026-01-01', '2026-12-31', null, true) l
              where l.payment_id = '00000000-0000-4000-f100-000000000006') then
    raise exception 'FALLO: el cobro cancelled con abono (C9) cuenta como ingreso';
  end if;
  raise notice 'OK: D-ING por línea (mora, excedente fuera, partial sin abono = 0, cancelled fuera)';

  -- IC6 por mes: libro = resumen
  for r in select to_char(m, 'YYYY-MM') as mes from generate_series('2026-01-01'::date, '2026-12-01', '1 month') m loop
    select coalesce(sum(amount), 0) into v_led from public.cash_ledger
     where owner_id = a and direction = 'income' and to_char(movement_date, 'YYYY-MM') = r.mes;
    select coalesce(sum(income_amount), 0) into v_sum
      from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', null, 'month') where bucket = r.mes;
    if v_led <> v_sum then
      raise exception 'FALLO IC6: % libro % ≠ resumen %', r.mes, v_led, v_sum;
    end if;
  end loop;
  select coalesce(sum(amount), 0) into v_led from public.cash_ledger where owner_id = a and direction = 'income' and movement_date is null;
  select coalesce(sum(income_amount), 0) into v_sum
    from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', null, 'month') where bucket = 'sin_fecha';
  if v_led <> 55000 or v_sum <> 55000 then
    raise exception 'FALLO C8: sin fecha libro % / resumen % (esperado 55000 visible)', v_led, v_sum;
  end if;
  raise notice 'OK: IC6 mes a mes (ene–dic 2026) y bucket sin_fecha = 55000';

  -- julio, total del año y los dos consumidores restantes
  select income_amount into v_sum from public.finance_income_summary('school', a, '2026-07-01', '2026-07-31') where bucket = '2026-07';
  if v_sum <> 240700 then raise exception 'FALLO: julio = % (esperado 240700)', v_sum; end if;
  select coalesce(sum(income_amount), 0) into v_sum from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31');
  v_kpi  := public.school_payment_kpis(a, null);
  v_dash := public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', null);
  select coalesce(sum(amount), 0) into v_led from public.cash_ledger where owner_id = a and direction = 'income';
  if v_sum <> v_total_esperado or (v_kpi->>'revenue_total')::numeric <> v_total_esperado
     or (v_dash->>'total_revenue')::numeric <> v_total_esperado or v_led <> v_total_esperado then
    raise exception 'FALLO IC6 total: resumen % · KPIs % · dashboard % · libro % (esperado %)',
      v_sum, v_kpi->>'revenue_total', v_dash->>'total_revenue', v_led, v_total_esperado;
  end if;
  raise notice 'OK: IC6 total — resumen = KPIs = dashboard = libro = %', v_total_esperado;

  -- A3: con sede A entran los SIN sede; la otra sede no.
  v_kpi := public.school_payment_kpis(a, sede_a);
  select coalesce(sum(income_amount), 0) into v_sum from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', sede_a);
  if (v_kpi->>'revenue_total')::numeric <> v_total_esperado - 100000 or v_sum <> v_total_esperado - 100000 then
    raise exception 'FALLO A3: con sede KPIs % / resumen % (esperado %)', v_kpi->>'revenue_total', v_sum, v_total_esperado - 100000;
  end if;
  v_dash := public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', sede_a);
  if (v_dash->>'total_revenue')::numeric <> v_total_esperado - 100000 then
    raise exception 'FALLO A3: dashboard con sede %', v_dash->>'total_revenue';
  end if;
  raise notice 'OK: A3 — con sede incluye los cobros sin sede y excluye la otra sede (%)', v_total_esperado - 100000;

  -- agrupamientos
  select coalesce(sum(income_amount), 0) into v_sum from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', null, 'concept') where bucket = 'torneo';
  if v_sum <> 100000 then raise exception 'FALLO: concepto torneo = %', v_sum; end if;
  if not exists (select 1 from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', null, 'concept') where bucket = 'sin_fecha') then
    raise exception 'FALLO: el bucket sin_fecha no aparece al agrupar por concepto';
  end if;
  begin
    perform * from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31', null, 'semana');
    raise exception 'FALLO: agrupamiento inválido aceptado';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK: agrupamiento por concepto y validación de p_group';
end $$;

reset role;
rollback;
