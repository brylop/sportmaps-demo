-- C02 · R9 + C4 + C12 — el coach no ve ingresos en el libro; el owner de la
-- escuela B no lee el dashboard de la escuela A (fuga C12 de
-- get_school_dashboard_stats, que aceptaba el p_user_id de otro).
-- Seed: escuela A tiene 2 cobros cobrados (150.000 paid + 50.000 partial) y un
-- gasto pagado de 1.200.000; escuela B un cobro paid de 120.000.

begin;

-- ── coach de A: 0 filas de ingreso y 0 de egreso en cash_ledger ──
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000003','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_inc int; v_exp int; v_pay int;
begin
  select count(*) filter (where direction = 'income'), count(*) filter (where direction = 'expense')
    into v_inc, v_exp
    from public.cash_ledger where owner_id = '00000000-0000-4000-b000-000000000001';
  if v_inc <> 0 then raise exception 'FALLO: el coach ve % filas de ingreso en cash_ledger (C4)', v_inc; end if;
  if v_exp <> 0 then raise exception 'FALLO: el coach ve % egresos', v_exp; end if;
  raise notice 'OK: coach → 0 ingresos y 0 egresos en cash_ledger';

  -- U12 (residual aceptado en F0): el coach sigue leyendo payments crudo
  -- (asistencia y "al día" lo necesitan). Se deja documentado, no se afirma 0.
  select count(*) into v_pay from public.payments where school_id = '00000000-0000-4000-b000-000000000001';
  raise notice 'INFO (U12, residual aceptado): coach lee % filas de payments crudo por PostgREST', v_pay;

  -- El coach llamando el dashboard con SU id: no es owner/admin → sin ingresos.
  if (public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000003', null)->>'total_revenue')::numeric <> 0 then
    raise exception 'FALLO: el coach ve total_revenue en get_school_dashboard_stats';
  end if;
  raise notice 'OK: coach → total_revenue 0 en get_school_dashboard_stats';
end $$;
reset role;

-- ── owner de A: ve su libro completo ──
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_inc numeric; v_n int; v_dash json;
begin
  select coalesce(sum(amount), 0), count(*) into v_inc, v_n
    from public.cash_ledger where owner_id = '00000000-0000-4000-b000-000000000001' and direction = 'income';
  if v_inc <> 200000 or v_n <> 2 then
    raise exception 'FALLO: owner A ve % filas / $% de ingreso (esperado 2 / 200000)', v_n, v_inc;
  end if;
  v_dash := public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', null);
  if (v_dash->>'total_revenue')::numeric <> 200000 then
    raise exception 'FALLO: dashboard de owner A = % (esperado 200000, IC6)', v_dash->>'total_revenue';
  end if;
  raise notice 'OK: owner A → 2 ingresos, $200000 en libro y en dashboard';
end $$;
reset role;

-- ── owner de B pidiendo el dashboard de owner A (C12) ──
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000007','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v json;
begin
  begin
    v := public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', null);
    raise exception 'FALLO: owner B lee el dashboard de A (C12): %', v;
  exception when insufficient_privilege then
    raise notice 'OK: owner B → 42501 al pedir el dashboard de A';
  end;
  -- su propio dashboard sí
  v := public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000007', null);
  if (v->>'total_revenue')::numeric <> 120000 then
    raise exception 'FALLO: owner B ve % en su propio dashboard (esperado 120000)', v->>'total_revenue';
  end if;
  raise notice 'OK: owner B ve su propio total (120000)';
  -- ni el libro ni los KPIs de A
  if exists (select 1 from public.cash_ledger where owner_id = '00000000-0000-4000-b000-000000000001') then
    raise exception 'FALLO: owner B ve filas del libro de A';
  end if;
  begin
    perform public.school_payment_kpis('00000000-0000-4000-b000-000000000001', null);
    raise exception 'FALLO: owner B lee los KPIs de A';
  exception when insufficient_privilege then raise notice 'OK: owner B → 42501 en KPIs de A';
  end;
end $$;
reset role;

-- ── un profiles.role autoasignado ya no abre el dashboard ajeno ──
update public.profiles set role = 'school_admin' where id = '00000000-0000-4000-a000-000000000004';
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000004','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', null);
    raise exception 'FALLO: profiles.role=school_admin abre el dashboard de otro';
  exception when insufficient_privilege then raise notice 'OK: profiles.role autoasignado → 42501';
  end;
end $$;
reset role;

-- ── super admin sí puede pedir el de otro (soporte) ──
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000010','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (public.get_school_dashboard_stats('00000000-0000-4000-a000-000000000001', null)->>'total_revenue')::numeric <> 200000 then
    raise exception 'FALLO: super admin no ve el total de A';
  end if;
  raise notice 'OK: super admin ve el dashboard de A (200000)';
end $$;
reset role;

rollback;
