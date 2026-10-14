-- F1 · Cartera: get_payment_aging_report cuenta MESES vencidos (periodos
-- distintos con fecha efectiva < hoy) y separa lo no vencido en `por_vencer`.
-- Datos de la copia de Dreamers al 2026-10-13. Como el dueño (JWT).
-- Migración: 20261013192838_fix_aging_cartera_vencidos_meses.sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  r jsonb := public.get_payment_aging_report('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe');
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  it jsonb;
  function_item text;
  v_cnt int;
  v_monto numeric;
begin
  if v_hoy >= date '2026-11-05' then
    raise notice 'AVISO: hoy % ya pasó el 05/11; los valores esperados son los del 13/10', v_hoy;
  end if;

  -- Avril y Zoe: inscripción + seguro de octubre (vencen 10/10) = «1 mes» $270.000.
  foreach function_item in array array['Avril QA','Zoe QA'] loop
    select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = function_item;
    if it is null then raise exception 'FALLO: % no aparece en la cartera', function_item; end if;
    if it->>'bucket' <> '1 mes' or (it->>'meses_debidos')::int <> 1 then
      raise exception 'FALLO: % bucket=% meses=%', function_item, it->>'bucket', it->>'meses_debidos';
    end if;
    if (it->>'monto_pendiente')::numeric <> 270000 then
      raise exception 'FALLO: % monto=% (esperado 270000: la mensualidad del 05/11 no es deuda)', function_item, it->>'monto_pendiente';
    end if;
    if (it->>'cuotas_debidas')::int <> 2 or jsonb_array_length(it->'periodos_debidos') <> 1 then
      raise exception 'FALLO: % cuotas=% periodos=%', function_item, it->>'cuotas_debidas', it->'periodos_debidos';
    end if;
    raise notice 'OK: % «1 mes» $270.000, 2 cuotas, periodos %', function_item, it->'periodos_debidos';
  end loop;

  -- Las dos mensualidades del 05/11 de Avril y Zoe (245.000 + 232.750) van a
  -- por_vencer. Se compara contra la tabla porque otros agentes pueden dejar
  -- cobros futuros en el gemelo: por_vencer = todo lo vivo con fecha >= hoy.
  select count(*), sum(p.amount - coalesce(p.amount_paid,0)) into v_cnt, v_monto
    from public.payments p
   where p.school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe'
     and p.status in ('pending','overdue','partial')
     and coalesce(p.due_date, make_date(p.period_year::int, p.period_month::int, 1)) >= v_hoy;
  if (r->'por_vencer'->>'count')::int <> v_cnt or (r->'por_vencer'->>'monto')::numeric <> v_monto then
    raise exception 'FALLO: por_vencer=% (esperado % / %)', r->'por_vencer', v_cnt, v_monto;
  end if;
  if (select count(*) from public.payments p
       where p.school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe' and p.status = 'pending'
         and p.due_date = '2026-11-05' and p.amount in (245000, 232750)) <> 2 then
    raise exception 'FALLO: no están las mensualidades del 05/11 de Avril y Zoe';
  end if;
  raise notice 'OK: por_vencer % (incluye las mensualidades del 05/11 de Avril y Zoe)', r->'por_vencer';

  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Bella QA';
  if it->>'bucket' <> '2 meses' then raise exception 'FALLO: Bella bucket=%', it->>'bucket'; end if;
  if it->'periodos_debidos' <> '["09/2026","10/2026"]'::jsonb then
    raise exception 'FALLO: Bella periodos=%', it->'periodos_debidos';
  end if;
  raise notice 'OK: Bella «2 meses» %', it->'periodos_debidos';

  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Athenea QA';
  if it->>'bucket' <> '1 mes' then raise exception 'FALLO: Athenea bucket=%', it->>'bucket'; end if;
  raise notice 'OK: Athenea «1 mes»';

  -- Ningún ítem incluye un cobro no vencido: la suma de items + por_vencer = todo lo vivo.
  raise notice 'OK: % atletas en cartera', r->>'count';
end $$;

-- Mismo mes, tres cobros (inscripción + seguro + mensualidad) vencidos = 1 mes, no «3+».
reset role;
insert into public.payments (school_id, child_id, amount, status, payment_category, period_year, period_month, due_date, concept, period_uniqueness_exempt)
values ('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', '22515123-5f8b-4c19-bf7f-894ad9eac880', 100, 'pending', 'inscripcion', 2026, 10, '2026-10-05', 'QA A1 extra 1', true),
       ('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', '22515123-5f8b-4c19-bf7f-894ad9eac880', 100, 'pending', 'seguro',      2026, 10, '2026-10-05', 'QA A1 extra 2', true);
set local role authenticated;
do $$
declare it jsonb;
begin
  select i into it from jsonb_array_elements(public.get_payment_aging_report('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe')->'items') i
   where i->>'athlete' = 'Athenea QA';
  if it->>'bucket' <> '1 mes' or (it->>'cuotas_debidas')::int <> 3 then
    raise exception 'FALLO: 3 cobros del mismo mes → bucket=% cuotas=%', it->>'bucket', it->>'cuotas_debidas';
  end if;
  raise notice 'OK: 3 cobros de octubre = «1 mes» (cuotas_debidas=3 informativo)';
end $$;
rollback;
