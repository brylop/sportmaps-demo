-- Débito automático F1 — interruptores, "Ya pagué", checkout manual y suspensión (pruebas 5, 6, 8, 11; D8, D10, D12).
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A04_interruptores_skip_suspension.sql
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
declare v_cycle uuid; n int; r jsonb; v_att uuid; c public.autopay_cycles;
begin
  perform public.autopay_plan_cycles('2026-10-05');
  select id into v_cycle from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  perform public.autopay_mark_noticed(v_cycle, 154500, '2026-10-05');

  -- Prueba 8a: interruptor global apagado → el claim no devuelve nada.
  update public.platform_config set value = '{"debits_enabled": false}' where key = 'autopay_kill_switch';
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  if n <> 0 then raise exception 'FALLO: 8 debitó con el interruptor global apagado'; end if;
  update public.platform_config set value = '{"debits_enabled": true}' where key = 'autopay_kill_switch';
  raise notice 'OK: 8 interruptor global apagado → cero débitos';

  -- Prueba 8b: débitos pausados por la escuela → retención, sin intento.
  update public.school_settings set autopay_debits_paused = true where school_id = current_setting('qa.school_a')::uuid;
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  select * into c from public.autopay_cycles where id = v_cycle;
  if n <> 0 or c.hold_reason <> 'debits_paused' or c.attempts_used <> 0 then
    raise exception 'FALLO: 8 debits_paused (% % %)', n, c.hold_reason, c.attempts_used;
  end if;
  update public.school_settings set autopay_debits_paused = false where school_id = current_setting('qa.school_a')::uuid;
  raise notice 'OK: 8 autopay_debits_paused → retención sin consumir intento';

  -- Prueba 6 (base): checkout manual de menos de 2 h → retención manual_checkout_open.
  insert into public.payment_links (id, payment_id, school_id, token, gross_amount, base_amount, expires_at, created_at, provider_reference)
  values ('00000000-0000-4000-e000-00000000011a', current_setting('qa.pay_oct')::uuid, current_setting('qa.school_a')::uuid,
          'tok-qa-manual', 154500, 150000, now() + interval '1 day', now() - interval '30 minutes', 'SCH-QA-MANUAL');
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  if n <> 0 or (select hold_reason from public.autopay_cycles where id = v_cycle) <> 'manual_checkout_open' then
    raise exception 'FALLO: 6 checkout reciente no retuvo el débito';
  end if;
  raise notice 'OK: 6 checkout manual de < 2 h → manual_checkout_open, sin intento';

  -- Más de 2 h: el claim lo devuelve para que el BFF consulte Wompi.
  update public.payment_links set created_at = now() - interval '3 hours' where id = '00000000-0000-4000-e000-00000000011a';
  select attempt_id into v_att from public.autopay_claim_due(50, 300, '2026-10-07')
   where manual_link_id = '00000000-0000-4000-e000-00000000011a' and manual_link_reference = 'SCH-QA-MANUAL';
  if v_att is null then raise exception 'FALLO: 6 el claim no devolvió el checkout viejo'; end if;

  -- Wompi dice que ese checkout tiene transacción → se libera sin consumir intento (prueba 5).
  r := public.autopay_release_attempt(v_att, 'manual_checkout_open');
  select * into c from public.autopay_cycles where id = v_cycle;
  if c.attempts_used <> 0 or c.state <> 'noticed' or exists (select 1 from public.recurring_charge_attempts where id = v_att) then
    raise exception 'FALLO: 5 liberar consumió intento (% %)', c.attempts_used, c.state;
  end if;
  raise notice 'OK: 5/6 checkout con transacción → se libera; no consume attempt_no';
  delete from public.payment_links where id = '00000000-0000-4000-e000-00000000011a';

  -- Prueba 8c: oferta apagada con suscripción activa → sigue debitando.
  update public.school_settings set autopay_enabled = false where school_id = current_setting('qa.school_a')::uuid;
  select count(*) into n from public.autopay_claim_due(50, 300, '2026-10-07');
  if n <> 1 then raise exception 'FALLO: 8 apagar la oferta frenó los débitos'; end if;
  raise notice 'OK: 8 apagar la oferta no toca las suscripciones activas';
end $$;

-- ── D8 "Ya pagué este mes": solo el pagador, y no cuenta para D12 ─────────────
do $$
declare v_cycle uuid; r jsonb;
begin
  delete from public.recurring_charge_attempts;
  update public.autopay_cycles set state = 'noticed', attempts_used = 0
   where payment_id = current_setting('qa.pay_oct')::uuid returning id into v_cycle;

  r := public.autopay_parent_skip(current_setting('qa.padre_b')::uuid, v_cycle);
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: otro padre omitió el ciclo → %', r; end if;
  r := public.autopay_parent_skip(current_setting('qa.padre_a')::uuid, v_cycle);
  if not (r->>'ok')::boolean then raise exception 'FALLO: el pagador no pudo omitir → %', r; end if;
  if (select skip_reason from public.autopay_cycles where id = v_cycle) <> 'parent_skip'
     or (select cycles_without_debit from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 0 then
    raise exception 'FALLO: parent_skip mal registrado o contó para D12';
  end if;
  raise notice 'OK: D8 "Ya pagué" solo del pagador; no cuenta para D12';
end $$;

-- ── Prueba 11: dos ciclos seguidos sobre el tope → suspended; un pago manual reinicia ──
do $$
declare s public.recurring_subscriptions;
begin
  perform public.autopay_count_cycle_without_debit(current_setting('qa.sub_a')::uuid, 'over_max_amount');
  perform public.autopay_reset_cycles_without_debit(current_setting('qa.sub_a')::uuid);  -- pagó manual
  perform public.autopay_count_cycle_without_debit(current_setting('qa.sub_a')::uuid, 'over_max_amount');
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.status <> 'active' or s.cycles_without_debit <> 1 then
    raise exception 'FALLO: 11 el pago manual no reinició el contador (% %)', s.status, s.cycles_without_debit;
  end if;
  perform public.autopay_count_cycle_without_debit(current_setting('qa.sub_a')::uuid, 'over_max_amount');
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.status <> 'suspended' or s.suspend_reason <> 'over_max_amount' then
    raise exception 'FALLO: 11 dos ciclos seguidos no suspendieron (% %)', s.status, s.suspend_reason;
  end if;
  raise notice 'OK: 11 dos ciclos seguidos sin débito → suspended; un pago en medio reinicia';
end $$;

-- Un ciclo pagado por fuera (pago manual aprobado) → paid_elsewhere y reinicia D12.
do $$
declare v_cycle uuid;
begin
  update public.recurring_subscriptions set status = 'active', suspend_reason = null, cycles_without_debit = 1
   where id = current_setting('qa.sub_a')::uuid;
  update public.autopay_cycles set state = 'noticed', skip_reason = null
   where payment_id = current_setting('qa.pay_oct')::uuid returning id into v_cycle;
  update public.payments set status = 'paid' where id = current_setting('qa.pay_oct')::uuid;
  perform public.autopay_claim_due(50, 300, '2026-10-07');
  if (select skip_reason from public.autopay_cycles where id = v_cycle) <> 'paid_elsewhere'
     or (select cycles_without_debit from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 0 then
    raise exception 'FALLO: pago por fuera no quedó paid_elsewhere o no reinició D12';
  end if;
  raise notice 'OK: pagado por otra vía → paid_elsewhere, sin débito, D12 en 0';
end $$;

rollback;
