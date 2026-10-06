-- M05 · Cancelar la inscripción de una ficha SIN cuenta anula sus cobros pendientes
-- (H-08 del informe Monster, política de set_school_athlete_status).
--
-- fn_cancel_payments_on_enrollment_cancel solo miraba user_id/child_id: cuando el
-- cron fn_expire_overdue_enrollments (o el editor) cancelaba la inscripción de una
-- ficha, sus cobros seguían vivos en cartera, con mora.
--
--   A. UPDATE directo a cancelled (lo que hace el editor / cancelExtraEnrollments).
--   B. El cron de vencimiento cancela una inscripción con expires_at viejo.
--   C. Lo pagado no se toca, y no se anulan cobros de OTRA inscripción activa
--      del mismo atleta (otro equipo).
--
-- Correr:  npm run qa:sql -- supabase/tests/monster_cobros
begin;

select set_config('qa.owner',  '00000000-0000-4000-a000-0000000000f1', true);
select set_config('qa.school', '00000000-0000-4000-b000-000000000003', true);
select set_config('qa.isa',    '00000000-0000-4000-c000-0000000000f1', true);
select set_config('qa.salo',   '00000000-0000-4000-c000-0000000000f2', true);
select set_config('qa.andres', '00000000-0000-4000-c000-0000000000f3', true);
select set_config('qa.y', extract(year  from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.m', extract(month from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.prev', (date_trunc('month', (now() at time zone 'America/Bogota')::date) - interval '1 month')::date::text, true);

-- Mes en curso abierto (3 cobros pending) + un cobro PAGADO del mes anterior de Isabella.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
reset role;

insert into public.payments (school_id, unregistered_athlete_id, concept, amount, due_date, status, payment_type,
                             payment_category, period_year, period_month, amount_paid, payment_date)
values (current_setting('qa.school')::uuid, current_setting('qa.isa')::uuid, 'Mensualidad anterior QA', 145000,
        current_setting('qa.prev')::date + 4, 'paid', 'subscription', 'mensualidad',
        extract(year from current_setting('qa.prev')::date), extract(month from current_setting('qa.prev')::date),
        145000, now());

-- A. El editor cancela la inscripción de Isabella.
update public.enrollments set status = 'cancelled', end_date = current_date
 where unregistered_athlete_id = current_setting('qa.isa')::uuid and status = 'active';

do $$
declare v_pend int; v_paid int;
begin
  select count(*) filter (where status in ('pending','overdue','awaiting_approval')),
         count(*) filter (where status = 'paid')
    into v_pend, v_paid
    from public.payments where unregistered_athlete_id = current_setting('qa.isa')::uuid;
  if v_pend <> 0 then raise exception 'FALLO A: al cancelar la inscripción de la ficha quedaron % cobros vivos', v_pend; end if;
  if v_paid <> 1 then raise exception 'FALLO A: se tocó un cobro pagado (pagados=%)', v_paid; end if;
  raise notice 'OK A: cancelar la inscripción de la ficha anula su pendiente y respeta el pagado';
end $$;

-- B. El cron de vencimiento: inscripción de Salomé con expires_at de hace 60 días.
update public.enrollments set expires_at = current_date - 60
 where unregistered_athlete_id = current_setting('qa.salo')::uuid and status = 'active';
select public.fn_expire_overdue_enrollments();

do $$
declare v_enr text; v_pend int;
begin
  select status into v_enr from public.enrollments where unregistered_athlete_id = current_setting('qa.salo')::uuid order by created_at limit 1;
  if v_enr <> 'cancelled' then raise exception 'FALLO (escenario) B: el cron no canceló la inscripción (%)', v_enr; end if;
  select count(*) into v_pend from public.payments
   where unregistered_athlete_id = current_setting('qa.salo')::uuid and status in ('pending','overdue','awaiting_approval');
  if v_pend <> 0 then raise exception 'FALLO B: el cron canceló la inscripción y dejó % cobros vivos en cartera', v_pend; end if;
  raise notice 'OK B: el vencimiento por cron también anula los cobros de la ficha';
end $$;

-- C. Andrés en DOS equipos: cancelar uno no anula el cobro que sigue vivo por el otro.
insert into public.teams (id, name, sport, school_id, price_monthly)
values ('00000000-0000-4000-e000-0000000000f4', 'Mayores Mixto QA', 'voleibol', current_setting('qa.school')::uuid, 0);
insert into public.enrollments (school_id, team_id, unregistered_athlete_id, status, start_date)
values (current_setting('qa.school')::uuid, '00000000-0000-4000-e000-0000000000f4', current_setting('qa.andres')::uuid, 'active', current_date);
update public.enrollments set status = 'cancelled'
 where unregistered_athlete_id = current_setting('qa.andres')::uuid and team_id = '00000000-0000-4000-e000-0000000000f4';

do $$
declare v_pend int;
begin
  select count(*) into v_pend from public.payments
   where unregistered_athlete_id = current_setting('qa.andres')::uuid and status = 'pending';
  if v_pend <> 1 then raise exception 'FALLO C: cancelar el segundo equipo anuló el cobro del primero (pendientes=%)', v_pend; end if;
  raise notice 'OK C: con otra inscripción activa el cobro del atleta sigue vivo';
end $$;

rollback;
