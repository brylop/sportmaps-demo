-- Débito automático F1 — cambio de monto y de plan (prueba 4; D5, D6, D9, §5.2). Pedido del usuario 2026-10-05: un cambio de plan no cobra de más, no cobra dos veces ni pierde la suscripción.
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A03_reaviso_y_cambio_de_plan.sql
begin;

-- ── Escenario común (como lo dejaría el BFF) ────────────────────────────────
-- Escuela A ofrece débito; Sofía (hija de padre.a) inscrita; mensualidad de octubre
-- 2026 pending por $150.000 que vence el 10-oct; padre.a registra Visa y activa.
select set_config('qa.padre_a',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.padre_b',  (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.admin_a',  (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);
select set_config('qa.coach_a',  (select user_id::text from qa_twin.actores where alias = 'coach.a'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.school_b', (select school_id::text from qa_twin.actores where alias = 'owner.b'), true);
select set_config('qa.sofia', '00000000-0000-4000-c000-000000000001', true);
select set_config('qa.tomas', '00000000-0000-4000-c000-000000000002', true);
select set_config('qa.pay_oct', '00000000-0000-4000-f000-000000000003', true);

update public.school_settings
   set autopay_enabled = true, online_fee_pct = 3, autopay_days_before_due = 3,
       autopay_surcharge_mode = 'same_as_online', autopay_debits_paused = false
 where school_id = current_setting('qa.school_a')::uuid;
insert into public.teams (id, name, sport, school_id)
values ('00000000-0000-4000-e000-0000000000a1', 'Sub 11 QA', 'futbol', current_setting('qa.school_a')::uuid);
insert into public.enrollments (id, child_id, school_id, team_id, status, start_date)
values ('00000000-0000-4000-e000-0000000000e1', current_setting('qa.sofia')::uuid,
        current_setting('qa.school_a')::uuid, '00000000-0000-4000-e000-0000000000a1', 'active', '2026-08-01');
update public.payments set due_date = '2026-10-10', created_at = '2026-10-01 12:00+00', amount = 150000
 where id = current_setting('qa.pay_oct')::uuid;
insert into public.payment_consents (id, user_id, payment_provider, acceptance_token, personal_data_auth_token)
values ('00000000-0000-4000-e000-0000000000c1', current_setting('qa.padre_a')::uuid, 'wompi', 'acc-qa', 'pers-qa');

select set_config('qa.token_a', public.autopay_register_token(
         current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid, 'CARD', 'available',
         9001, null, 'merchant-A', 'Visa •••• 4242', '4242', 'VISA') ->> 'token_id', true);
select set_config('qa.sub_a', public.autopay_create_subscription(
         current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid,
         200000, '00000000-0000-4000-e000-0000000000c1', true, '2026-10-01') ->> 'subscription_id', true);

do $$
begin
  if nullif(current_setting('qa.sub_a'), '') is null then raise exception 'FALLO (escenario): no se creó la suscripción'; end if;
end $$;

do $$
declare v_cycle uuid; n int; v_amt numeric; c public.autopay_cycles;
begin
  perform public.autopay_plan_cycles('2026-10-05');
  select id into v_cycle from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  perform public.autopay_mark_noticed(v_cycle, 154500, '2026-10-05');

  -- El plan sube a $180.000 después del aviso.
  update public.payments set amount = 180000 where id = current_setting('qa.pay_oct')::uuid;

  -- Prueba 4: ningún intento por encima de lo anunciado; el ciclo vuelve a avisarse.
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  if n <> 0 then raise exception 'FALLO: 4 debitó por encima de lo anunciado'; end if;
  select * into c from public.autopay_cycles where id = v_cycle;
  if c.state <> 'scheduled' or c.renotice_count <> 1 then
    raise exception 'FALLO: 4 no quedó para re-aviso (% %)', c.state, c.renotice_count;
  end if;
  raise notice 'OK: 4 monto mayor que el anunciado → re-aviso, sin intento';

  -- Re-aviso con el nuevo total (180.000 + 3 % = 185.400) y 2 días de espera.
  select total into v_amt from public.autopay_plan_cycles('2026-10-07') where cycle_id = v_cycle and action = 'notice';
  if v_amt <> 185400 then raise exception 'FALLO: total del re-aviso %', v_amt; end if;
  perform public.autopay_mark_noticed(v_cycle, v_amt, '2026-10-07');
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-08');
  if n <> 0 then raise exception 'FALLO: debitó antes de 2 días del re-aviso'; end if;
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-09');
  if n <> 1 then raise exception 'FALLO: no debitó tras el re-aviso'; end if;
  raise notice 'OK: re-aviso por 185.400 y débito 2 días después (D6)';

  -- Si el monto BAJA, se debita el monto nuevo sin re-aviso (nunca por encima de lo anunciado).
  delete from public.recurring_charge_attempts where cycle_id = v_cycle;
  update public.autopay_cycles set state = 'noticed', attempts_used = 0 where id = v_cycle;
  update public.payments set amount = 120000 where id = current_setting('qa.pay_oct')::uuid;
  select amount into v_amt from public.autopay_claim_due(50, 300, '2026-10-09');
  if v_amt <> 123600 then raise exception 'FALLO: monto menor debitó %', v_amt; end if;
  raise notice 'OK: monto menor → debita 123.600, sin re-aviso';

  -- Tope (D5): si el nuevo total supera el tope, no se anuncia ni se debita.
  delete from public.recurring_charge_attempts where cycle_id = v_cycle;
  update public.autopay_cycles set state = 'scheduled', attempts_used = 0 where id = v_cycle;
  update public.payments set amount = 250000 where id = current_setting('qa.pay_oct')::uuid;
  if not exists (select 1 from public.autopay_plan_cycles('2026-10-09') where cycle_id = v_cycle and action = 'over_max_amount') then
    raise exception 'FALLO: total sobre el tope no se reportó';
  end if;
  if (select skip_reason from public.autopay_cycles where id = v_cycle) <> 'over_max_amount' then
    raise exception 'FALLO: total sobre el tope no quedó skipped';
  end if;
  raise notice 'OK: total sobre el tope → aviso "supera tu tope", sin débito (D5)';
end $$;

-- ── Cambio de plan: se cancela una inscripción y se crea otra EN LA MISMA transacción.
-- El trigger es diferido: SET CONSTRAINTS … IMMEDIATE dispara lo acumulado, como el COMMIT.
update public.enrollments set status = 'cancelled', end_date = '2026-10-15'
 where id = '00000000-0000-4000-e000-0000000000e1';
insert into public.enrollments (child_id, school_id, team_id, status, start_date)
values (current_setting('qa.sofia')::uuid, current_setting('qa.school_a')::uuid,
        '00000000-0000-4000-e000-0000000000a1', 'active', '2026-10-15');
set constraints trg_autopay_on_enrollment_end immediate;
do $$ begin
  if (select status from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'active' then
    raise exception 'FALLO: el cambio de plan canceló el débito';
  end if;
  raise notice 'OK: cambio de plan (cancela + crea inscripción) NO cancela el débito';
end $$;

-- ── Fin real: queda sin ninguna inscripción activa → no_active_enrollment.
update public.enrollments set status = 'completed'
 where child_id = current_setting('qa.sofia')::uuid and school_id = current_setting('qa.school_a')::uuid and status = 'active';
do $$
declare s public.recurring_subscriptions;
begin
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.status <> 'cancelled' or s.cancel_reason <> 'no_active_enrollment' then
    raise exception 'FALLO: sin inscripciones activas la suscripción sigue (% %)', s.status, s.cancel_reason;
  end if;
  raise notice 'OK: sin inscripción activa → cancelada (no_active_enrollment)';
end $$;

rollback;
