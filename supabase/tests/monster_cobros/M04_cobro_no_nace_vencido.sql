-- M04 · El primer cobro no nace vencido y la mora no le cobra recargo el mismo día
-- (H-01 del informe Monster).
--
-- Monster: corte día 1, gracia 5, mora 5 %. Si la escuela pone precio el día 8,
-- esa noche open_month emitía el mes con vencimiento el 1 (ya pasado) y a las
-- 02:00 apply_late_fees lo marcaba overdue y le sumaba el 5 %.
--
-- Casos (independientes de la fecha en que se corra; el día 1 del mes el caso A
-- es trivial y se avisa):
--   A. Corte 1 y gracia 0, mes en curso: el vencimiento es >= hoy, y correr la
--      mora enseguida no marca nada.
--   B. Abrir un mes YA PASADO (alta tardía de precio): vence hoy + gracia, no en
--      el corte de ese mes; el periodo sigue siendo el mes pedido.
--   C. preview_open_month muestra el mismo vencimiento que open_month.
--   D. Un cobro creado HOY con vencimiento en el pasado (registro tardío por otra
--      vía) no recibe recargo el mismo día.
--
-- Correr:  npm run qa:sql -- supabase/tests/monster_cobros
begin;

select set_config('qa.owner',  '00000000-0000-4000-a000-0000000000f1', true);
select set_config('qa.school', '00000000-0000-4000-b000-000000000003', true);
select set_config('qa.andres', '00000000-0000-4000-c000-0000000000f3', true);
select set_config('qa.hoy', (now() at time zone 'America/Bogota')::date::text, true);
select set_config('qa.y', extract(year  from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.m', extract(month from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.prev', (date_trunc('month', (now() at time zone 'America/Bogota')::date) - interval '1 month')::date::text, true);

update public.school_settings
   set payment_cutoff_day = 1, payment_grace_days = 0, late_fee_enabled = true, late_fee_percentage = 5
 where school_id = current_setting('qa.school')::uuid;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare r jsonb; pv jsonb; v_hoy date := current_setting('qa.hoy')::date;
begin
  -- C (antes de abrir: el preview necesita elegibles)
  pv := public.preview_open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);

  -- A
  r := public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
  if (r->>'generados')::int <> 3 then raise exception 'FALLO (escenario): open_month generó %', r; end if;
  if extract(day from v_hoy) = 1 then raise notice 'AVISO: hoy es día 1, el caso A es trivial'; end if;
  if (r->>'due_date')::date < v_hoy then
    raise exception 'FALLO A: el mes en curso nace vencido (vence %, hoy %)', r->>'due_date', v_hoy;
  end if;
  raise notice 'OK A: mes en curso vence % (hoy %)', r->>'due_date', v_hoy;

  if (pv->>'due_date')::date is distinct from (r->>'due_date')::date then
    raise exception 'FALLO C: preview dice % y open_month emitió %', pv->>'due_date', r->>'due_date';
  end if;
  raise notice 'OK C: preview_open_month y open_month coinciden (%)', pv->>'due_date';
end $$;

-- B: mes anterior, que nunca se cobró (Monster: agosto y septiembre).
do $$
declare r jsonb; v_hoy date := current_setting('qa.hoy')::date; v_prev date := current_setting('qa.prev')::date; v_n int;
begin
  r := public.open_month(current_setting('qa.school')::uuid, extract(year from v_prev)::int, extract(month from v_prev)::int);
  if (r->>'due_date')::date < v_hoy then
    raise exception 'FALLO B: abrir % emite cobros vencidos desde % (hoy %)', to_char(v_prev, 'YYYY-MM'), r->>'due_date', v_hoy;
  end if;
  select count(*) into v_n from public.payments
   where school_id = current_setting('qa.school')::uuid
     and period_year = extract(year from v_prev) and period_month = extract(month from v_prev)
     and status = 'pending';
  if v_n <> 3 then raise exception 'FALLO B: % cobros del mes anterior con su periodo (esperado 3)', v_n; end if;
  raise notice 'OK B: el mes anterior vence % y conserva su periodo', r->>'due_date';
end $$;
reset role;

-- D: cobro creado hoy con vencimiento hace 70 días (otra vía de alta; 70 para
--    no caer en el periodo del caso B y chocar con el índice único por periodo).
insert into public.payments (school_id, unregistered_athlete_id, concept, amount, due_date, status, payment_type, payment_category)
values (current_setting('qa.school')::uuid, current_setting('qa.andres')::uuid, 'Uniforme QA', 80000,
        current_setting('qa.hoy')::date - 70, 'pending', 'one_time', 'otro');

-- El motor de mora corre (como el cron de las 02:00).
select public.apply_late_fees();

do $$
declare v_n int; v_fee numeric;
begin
  select count(*), coalesce(sum(late_fee_amount), 0) into v_n, v_fee from public.payments
   where school_id = current_setting('qa.school')::uuid and (status = 'overdue' or late_fee_applied_at is not null);
  if v_n > 0 then
    raise exception 'FALLO: la mora marcó % cobros nacidos hoy como vencidos y les sumó $% de recargo', v_n, v_fee;
  end if;
  raise notice 'OK D: ningún cobro nacido hoy queda overdue ni con recargo';
end $$;

rollback;
