-- F1 · P3: «Nuevo pago» de mensualidad (sin offering_plan_id) que hace el
-- acudiente queda con el plan de la inscripción, y al aprobarlo extiende la
-- vigencia al fin del mes pagado (Dreamers: calendar_month_end).
-- Migración: 20261013192856_nuevo_pago_mensualidad_estampa_plan.sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', '0fca0e19-2b6c-43ca-a727-25cdb65bd1cc', 'role', 'authenticated',
                    'email', 'qa-dl-acudiente1@demo.sportmaps.co')::text, true);
set local role authenticated;

insert into public.payments (school_id, child_id, parent_id, amount, status, payment_category,
                             period_year, period_month, due_date, concept, payment_type, payment_method)
values ('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', '22515123-5f8b-4c19-bf7f-894ad9eac880',
        '0fca0e19-2b6c-43ca-a727-25cdb65bd1cc', 1, 'awaiting_approval', 'mensualidad',
        2026, 11, '2026-11-05', 'QA F1 P3 mensualidad noviembre', 'one_time', 'transfer');

reset role;

do $$
declare r record; v_exp date;
begin
  select id, offering_plan_id, amount into r from public.payments
   where concept = 'QA F1 P3 mensualidad noviembre';
  if r.offering_plan_id is distinct from '05ef14a1-fd2d-4560-b530-c37c0bffa06a' then
    raise exception 'FALLO: el cobro quedó con offering_plan_id=% (esperado el plan de Athenea)', r.offering_plan_id;
  end if;
  raise notice 'OK: plan estampado %, monto normalizado %', r.offering_plan_id, r.amount;

  -- El dueño aprueba.
  update public.payments set status = 'paid', payment_date = current_date where id = r.id;
  select expires_at::date into v_exp from public.enrollments where id = '8dfdab05-51aa-40e8-9183-611c6d6fed8c';
  if v_exp is distinct from date '2026-11-30' then
    raise exception 'FALLO: vigencia de Athenea = % (esperado 2026-11-30)', v_exp;
  end if;
  raise notice 'OK: vigencia 2026-11-30';
end $$;
rollback;
