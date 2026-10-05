-- Débito automático F1 — aviso, claim, reintentos e idempotencia (pruebas 1, 3; D4, D12).
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A02_aviso_claim_reintentos.sql
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
declare
  r jsonb; n int; v_cycle uuid; v_att uuid; v_amt numeric; c public.autopay_cycles;
begin
  -- Antes de la ventana de aviso (due 10-10 − 3 − 2 = 10-05) no se avisa.
  select count(*) into n from public.autopay_plan_cycles('2026-10-04') where action = 'notice';
  if n <> 0 then raise exception 'FALLO: avisó antes de la ventana'; end if;
  select id into v_cycle from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  if v_cycle is null then raise exception 'FALLO: no se creó el ciclo'; end if;

  -- Prueba 3: sin notice_sent_at → ningún intento, aunque sea el día.
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-20');
  if n <> 0 then raise exception 'FALLO: 3 intentó debitar sin aviso'; end if;
  raise notice 'OK: 3 sin aviso no hay intento';

  -- Ventana: el 10-05 sale el aviso con total 154.500 (150.000 + 3 %).
  select total into v_amt from public.autopay_plan_cycles('2026-10-05') where cycle_id = v_cycle and action = 'notice';
  if v_amt <> 154500 then raise exception 'FALLO: total del aviso % ≠ 154500', v_amt; end if;
  r := public.autopay_mark_noticed(v_cycle, v_amt, '2026-10-05');
  if r->>'first_attempt_on' <> '2026-10-07' then raise exception 'FALLO: primer intento %', r; end if;
  raise notice 'OK: aviso el 10-05 por 154.500; primer intento 10-07 (D4)';

  -- Un ciclo avisado no se vuelve a avisar.
  select count(*) into n from public.autopay_plan_cycles('2026-10-06') where cycle_id = v_cycle;
  if n <> 0 then raise exception 'FALLO: re-avisó un ciclo ya avisado'; end if;

  -- Antes del primer intento, nada.
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-06');
  if n <> 0 then raise exception 'FALLO: debitó antes del primer intento'; end if;

  -- Intento 1.
  select attempt_id, amount into v_att, v_amt from public.autopay_claim_due(50, 300, '2026-10-07');
  if v_att is null or v_amt <> 154500 then raise exception 'FALLO: intento 1 (%, %)', v_att, v_amt; end if;

  -- Prueba 1 (secuencial): un segundo claim no crea otro intento vivo para el mismo cobro.
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  if n <> 0 then raise exception 'FALLO: 1 segundo claim creó otro intento'; end if;
  begin
    insert into public.recurring_charge_attempts (cycle_id, payment_id, attempt_no, amount)
    values (v_cycle, current_setting('qa.pay_oct')::uuid, 2, 1);
    raise exception 'FALLO: 1 el índice permitió dos intentos vivos';
  exception when unique_violation then null;
  end;
  raise notice 'OK: 1 un solo intento vivo por cobro';

  -- finish idempotente: PENDING y luego DECLINED; un segundo DECLINED no cambia nada.
  r := public.autopay_finish_attempt(v_att, 'pending_provider', 'tx-1', null, 'SCH-QA-1');
  r := public.autopay_finish_attempt(v_att, 'declined', 'tx-1', 'INSUFFICIENT_FUNDS');
  r := public.autopay_finish_attempt(v_att, 'declined', 'tx-1', 'INSUFFICIENT_FUNDS');
  if not coalesce((r->>'unchanged')::boolean, false) then raise exception 'FALLO: finish no es idempotente'; end if;
  select * into c from public.autopay_cycles where id = v_cycle;
  if c.state <> 'noticed' or c.next_attempt_on <> '2026-10-08' then
    raise exception 'FALLO: reintento 1 (% %)', c.state, c.next_attempt_on;
  end if;
  raise notice 'OK: rechazo → reintento a +1 día (10-08); finish idempotente';

  -- Intento 2 → rechazo → +3 días del primero (10-10).
  select attempt_id into v_att from public.autopay_claim_due(50, 300, '2026-10-08');
  perform public.autopay_finish_attempt(v_att, 'declined', 'tx-2', 'DECLINED');
  select * into c from public.autopay_cycles where id = v_cycle;
  if c.next_attempt_on <> '2026-10-10' or c.attempts_used <> 2 then
    raise exception 'FALLO: reintento 2 (% %)', c.next_attempt_on, c.attempts_used;
  end if;

  -- Intento 3 → rechazo → exhausted y el ciclo cuenta para D12.
  select attempt_id into v_att from public.autopay_claim_due(50, 300, '2026-10-10');
  perform public.autopay_finish_attempt(v_att, 'error', null, 'TIMEOUT');
  select * into c from public.autopay_cycles where id = v_cycle;
  if c.state <> 'exhausted' then raise exception 'FALLO: 3 rechazos no agotaron el ciclo (%)', c.state; end if;
  if (select cycles_without_debit from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 1 then
    raise exception 'FALLO: D12 no contó el ciclo sin débito';
  end if;
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-30');
  if n <> 0 then raise exception 'FALLO: hubo un cuarto intento'; end if;
  raise notice 'OK: 3 intentos (10-07, 10-08, 10-10) → exhausted, cuenta para D12, sin cuarto intento';

  if (select count(*) from public.recurring_charge_attempts where cycle_id = v_cycle) <> 3 then
    raise exception 'FALLO: no quedaron 3 intentos registrados';
  end if;
end $$;

-- Aprobado: el ciclo queda pagado y el contador vuelve a 0.
do $$
declare v_cycle uuid; v_att uuid;
begin
  update public.autopay_cycles set state = 'noticed', attempts_used = 0, next_attempt_on = '2026-10-07'
   where payment_id = current_setting('qa.pay_oct')::uuid returning id into v_cycle;
  delete from public.recurring_charge_attempts where cycle_id = v_cycle;
  select attempt_id into v_att from public.autopay_claim_due(50, 300, '2026-10-07');
  perform public.autopay_finish_attempt(v_att, 'approved', 'tx-ok', null, 'SCH-QA-OK');
  if (select state from public.autopay_cycles where id = v_cycle) <> 'paid' then raise exception 'FALLO: aprobado no deja el ciclo paid'; end if;
  if (select cycles_without_debit from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 0 then
    raise exception 'FALLO: un débito aprobado no reinició D12';
  end if;
  raise notice 'OK: aprobado → ciclo paid y D12 en 0';
end $$;

rollback;
