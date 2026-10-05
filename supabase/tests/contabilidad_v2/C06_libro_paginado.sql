-- C06 · Libro paginado (M3; H7): recorrer finance_ledger_page por keyset hasta
-- agotar = finance_ledger_totals (dated + undated), sin ids repetidos ni
-- perdidos, aunque muchas filas compartan fecha. Coach → 42501. p_limit se
-- topa en 200. finance_pnl_monthly cuadra con el resumen de ingresos y con
-- los egresos del libro.

begin;

-- 300 cobros paid de A repartidos en 2026 (muchos en la misma fecha) + 7 sin fecha.
insert into public.payments (school_id, amount, amount_paid, concept, due_date, payment_date, status, payment_method, payment_category)
select '00000000-0000-4000-b000-000000000001', 1000 + g, 1000 + g, 'pag ' || g, '2026-01-01',
       case when g <= 300 then date '2026-01-01' + ((g % 40) * 7) else null end,
       'paid', 'cash', 'mensualidad'
  from generate_series(1, 307) g;

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;

do $$
declare
  a constant uuid := '00000000-0000-4000-b000-000000000001';
  v_cur_date date; v_cur_id uuid;
  v_rows int := 0; v_sum numeric := 0; v_pages int := 0; v_page int;
  v_ids uuid[] := '{}';
  t record;
  v_tot_n int := 0; v_tot numeric := 0;
  v_pnl numeric; v_inc numeric; v_exp numeric;
  r record;
begin
  loop
    v_page := 0;
    for r in select * from public.finance_ledger_page('school', a, '2026-01-01', '2026-12-31', null, null,
                                                      v_cur_date, v_cur_id, 50, true) loop
      v_page := v_page + 1;
      v_rows := v_rows + 1;
      v_sum  := v_sum + r.amount;
      v_ids  := v_ids || r.id;
      v_cur_date := r.movement_date;
      v_cur_id   := r.id;
    end loop;
    exit when v_page = 0;
    v_pages := v_pages + 1;
    if v_pages > 50 then raise exception 'FALLO: la paginación no termina'; end if;
  end loop;

  for t in select * from public.finance_ledger_totals('school', a, '2026-01-01', '2026-12-31') loop
    v_tot_n := v_tot_n + t.n + t.undated_n;
    v_tot   := v_tot + t.total + t.undated_total;
  end loop;

  if v_rows <> v_tot_n or v_sum <> v_tot then
    raise exception 'FALLO: páginas suman % filas / $% ; totales del servidor % / $%', v_rows, v_sum, v_tot_n, v_tot;
  end if;
  if (select count(distinct x) from unnest(v_ids) x) <> v_rows then
    raise exception 'FALLO: ids repetidos en la paginación';
  end if;
  -- 2 cobros del seed + 307 nuevos + 1 gasto pagado = 310
  if v_rows <> 310 then raise exception 'FALLO: se recorrieron % movimientos (esperado 310)', v_rows; end if;
  raise notice 'OK: % páginas, % movimientos, suma $% = totales del servidor, sin repetidos', v_pages, v_rows, v_sum;

  -- Los sin fecha van al final y solo con p_include_undated
  if exists (select 1 from public.finance_ledger_page('school', a, '2026-01-01', '2026-12-31', null, null, null, null, 200, false)
              where movement_date is null) then
    raise exception 'FALLO: sin p_include_undated aparecen movimientos sin fecha';
  end if;
  raise notice 'OK: los sin fecha solo aparecen con p_include_undated';

  -- tope de 200
  select count(*) into v_page from public.finance_ledger_page('school', a, '2026-01-01', '2026-12-31', null, null, null, null, 100000, true);
  if v_page <> 200 then raise exception 'FALLO: p_limit=100000 devolvió % filas (tope 200)', v_page; end if;
  raise notice 'OK: p_limit topado en 200';

  -- EdR: pnl = ingresos del resumen + egresos del libro (año 2026, incluye sin fecha)
  select coalesce(sum(total) filter (where direction = 'income'), 0), coalesce(sum(total) filter (where direction = 'expense'), 0)
    into v_inc, v_exp from public.finance_pnl_monthly('school', a, 2026);
  select coalesce(sum(income_amount), 0) into v_pnl from public.finance_income_summary('school', a, '2026-01-01', '2026-12-31');
  if v_inc <> v_pnl then raise exception 'FALLO: EdR ingresos % ≠ resumen %', v_inc, v_pnl; end if;
  if v_exp <> 1200000 then raise exception 'FALLO: EdR egresos % (esperado 1200000)', v_exp; end if;
  raise notice 'OK: EdR del año = resumen de ingresos (%) y egresos del libro (%)', v_inc, v_exp;
end $$;
reset role;

-- coach → 42501 en las tres
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000003','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform * from public.finance_ledger_page('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31');
    raise exception 'FALLO: el coach pagina el libro';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.finance_ledger_totals('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31');
    raise exception 'FALLO: el coach lee los totales';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.finance_pnl_monthly('school', '00000000-0000-4000-b000-000000000001', 2026);
    raise exception 'FALLO: el coach lee el EdR';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: coach → 42501 en finance_ledger_page / _totals / finance_pnl_monthly';
end $$;
reset role;

rollback;
