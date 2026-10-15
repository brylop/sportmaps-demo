-- Débito automático + mora (mig 20261014133326, regla de producto 2026-10-14):
--   · apply_late_fees() expira los payment_links 'pending' del cobro que recibe recargo
--     (el link firmó el monto sin mora), salvo el link 'autopay' de un intento en vuelo;
--   · el débito SÍ cobra lo vencido (D14 revertida en lo vencido) por el saldo con la
--     mora + el recargo online, y lo parcial por lo que falta;
--   · un ciclo cancelado porque el cobro venció vuelve a planificarse.
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A07_mora_vencidos_y_enlaces.sql
-- apply_late_fees usa la fecha real (Bogotá): el cobro vence el 2026-10-10, así que
-- desde el 2026-10-11 queda en mora.
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

update public.school_settings
   set late_fee_enabled = true, late_fee_percentage = 5, payment_grace_days = 0,
       late_fee_skip_signup_month = false, overdue_hold_until = null
 where school_id = current_setting('qa.school_a')::uuid;

-- ── 1. La mora expira el checkout pendiente firmado sin recargo ───────────────
do $$
declare r jsonb; p public.payments;
begin
  insert into public.payment_links (id, payment_id, school_id, token, gross_amount, base_amount, expires_at, provider_reference)
  values ('00000000-0000-4000-e000-00000000071a', current_setting('qa.pay_oct')::uuid, current_setting('qa.school_a')::uuid,
          'tok-qa-mora-1', 154500, 150000, now() + interval '2 days', 'SCH-QA-MORA-1');

  r := public.apply_late_fees();
  select * into p from public.payments where id = current_setting('qa.pay_oct')::uuid;
  if p.status <> 'overdue' or p.amount <> 157500 or p.late_fee_amount <> 7500 then
    raise exception 'FALLO 1a: mora no aplicada (% % %)', p.status, p.amount, p.late_fee_amount;
  end if;
  if (select status from public.payment_links where id = '00000000-0000-4000-e000-00000000071a') <> 'expired' then
    raise exception 'FALLO 1b: el link firmado sin mora quedó vivo';
  end if;
  if not (r ? 'links_expired') or (r->>'links_expired')::int < 1 then
    raise exception 'FALLO 1c: falta el contador links_expired → %', r;
  end if;
  raise notice 'OK: 1 la mora suma 7.500, expira el checkout viejo y lo cuenta (links_expired=%)', r->>'links_expired';
end $$;

-- ── 2. El débito cobra lo vencido: saldo con mora + recargo online ────────────
do $$
declare v_cycle uuid; v_amt numeric; v_att uuid; r jsonb;
begin
  -- 157.500 + round(157.500 × 3 %) = 162.225.
  select p.cycle_id, p.total into v_cycle, v_amt from public.autopay_plan_cycles('2026-10-15') p
   where p.payment_id = current_setting('qa.pay_oct')::uuid and p.action = 'notice';
  if v_cycle is null or v_amt <> 162225 then raise exception 'FALLO 2a: vencido no se planificó (% %)', v_cycle, v_amt; end if;
  r := public.autopay_mark_noticed(v_cycle, v_amt, '2026-10-15');
  if r->>'first_attempt_on' <> '2026-10-17' then raise exception 'FALLO 2b: primer intento %', r; end if;

  select c.attempt_id, c.amount into v_att, v_amt from public.autopay_claim_due(50, 300, '2026-10-17') c
   where c.payment_id = current_setting('qa.pay_oct')::uuid;
  if v_att is null or v_amt <> 162225 then raise exception 'FALLO 2c: claim de lo vencido (% %)', v_att, v_amt; end if;
  perform set_config('qa.att_1', v_att::text, true);
  raise notice 'OK: 2 lo vencido se debita: 162.225 (157.500 con mora + 3 %%)';
end $$;

-- ── 3. El link del débito EN VUELO no se expira ───────────────────────────────
do $$
declare r jsonb;
begin
  insert into public.payment_links (id, payment_id, school_id, token, gross_amount, base_amount, expires_at,
                                    provider_reference, origin, recurring_attempt_id)
  values ('00000000-0000-4000-e000-00000000071b', current_setting('qa.pay_oct')::uuid, current_setting('qa.school_a')::uuid,
          'tok-qa-mora-2', 162225, 157500, now() + interval '3 days', 'SCH-QA-MORA-2', 'autopay',
          current_setting('qa.att_1')::uuid);
  -- El cobro vuelve a pending sin mora para que la corrida le sume el recargo otra vez.
  update public.payments set status = 'pending', amount = 150000, late_fee_amount = 0, late_fee_applied_at = null
   where id = current_setting('qa.pay_oct')::uuid;
  r := public.apply_late_fees();
  if (select amount from public.payments where id = current_setting('qa.pay_oct')::uuid) <> 157500 then
    raise exception 'FALLO 3a: no volvió a sumar la mora';
  end if;
  if (select status from public.payment_links where id = '00000000-0000-4000-e000-00000000071b') <> 'pending' then
    raise exception 'FALLO 3b: expiró el link de un débito en vuelo';
  end if;
  raise notice 'OK: 3 el link autopay de un intento en vuelo sigue pending';

  -- Con el intento cerrado, el mismo link sí se expira en la próxima mora.
  perform public.autopay_finish_attempt(current_setting('qa.att_1')::uuid, 'declined', 'tx-mora-1', 'DECLINED');
  update public.payments set status = 'pending', amount = 150000, late_fee_amount = 0, late_fee_applied_at = null
   where id = current_setting('qa.pay_oct')::uuid;
  r := public.apply_late_fees();
  if (select status from public.payment_links where id = '00000000-0000-4000-e000-00000000071b') <> 'expired' then
    raise exception 'FALLO 3c: link autopay de un intento cerrado quedó vivo';
  end if;
  raise notice 'OK: 3 cerrado el intento, su link sí se expira';
end $$;

-- ── 4. Parcial: se debita lo que falta ────────────────────────────────────────
do $$
declare v_att uuid; v_amt numeric; c public.autopay_cycles;
begin
  -- Tras el rechazo: noticed, reintento 10-18. Abonó 100.000 de 157.500 → saldo 57.500;
  -- 57.500 + 1.725 = 59.225 (≤ lo anunciado, sin re-aviso).
  update public.payments set status = 'partial', amount_paid = 100000 where id = current_setting('qa.pay_oct')::uuid;
  select * into c from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  if c.state <> 'noticed' or c.next_attempt_on <> '2026-10-18' then
    raise exception 'FALLO 4a: ciclo tras rechazo (% %)', c.state, c.next_attempt_on;
  end if;
  if public.autopay_payment_total(current_setting('qa.pay_oct')::uuid) <> 59225 then
    raise exception 'FALLO 4b: total del parcial %', public.autopay_payment_total(current_setting('qa.pay_oct')::uuid);
  end if;
  select x.attempt_id, x.amount into v_att, v_amt from public.autopay_claim_due(50, 300, '2026-10-18') x
   where x.payment_id = current_setting('qa.pay_oct')::uuid;
  if v_att is null or v_amt <> 59225 then raise exception 'FALLO 4c: claim del parcial (% %)', v_att, v_amt; end if;
  perform public.autopay_finish_attempt(v_att, 'declined', 'tx-mora-2', 'DECLINED');
  raise notice 'OK: 4 parcial → se debita el saldo (59.225), no lo da por pagado';
end $$;

-- ── 5. Ciclo cancelado (el viejo «lo vencido no se debita») revive ────────────
do $$
declare n int;
begin
  update public.payments set status = 'overdue', amount_paid = 0 where id = current_setting('qa.pay_oct')::uuid;
  update public.autopay_cycles set state = 'cancelled' where payment_id = current_setting('qa.pay_oct')::uuid;
  select count(*) into n from public.autopay_plan_cycles('2026-10-20') p
   where p.payment_id = current_setting('qa.pay_oct')::uuid and p.action = 'notice' and p.total = 162225;
  if n <> 1 or (select state from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid) <> 'scheduled' then
    raise exception 'FALLO 5a: el ciclo cancelado no volvió a planificarse';
  end if;
  raise notice 'OK: 5 ciclo cancelado con el cobro vencido → vuelve a scheduled y se avisa';

  -- Cobro anulado → el ciclo se cancela; pagado por fuera → paid_elsewhere.
  update public.payments set status = 'cancelled' where id = current_setting('qa.pay_oct')::uuid;
  perform count(*) from public.autopay_plan_cycles('2026-10-20');
  if (select state from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid) <> 'cancelled' then
    raise exception 'FALLO 5b: cobro anulado no canceló el ciclo';
  end if;
  update public.autopay_cycles set state = 'scheduled' where payment_id = current_setting('qa.pay_oct')::uuid;
  update public.payments set status = 'paid' where id = current_setting('qa.pay_oct')::uuid;
  perform count(*) from public.autopay_plan_cycles('2026-10-20');
  if (select skip_reason from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid) is distinct from 'paid_elsewhere' then
    raise exception 'FALLO 5c: pagado por fuera no quedó paid_elsewhere';
  end if;
  raise notice 'OK: 5 anulado → cancelled; pagado → paid_elsewhere';
end $$;

rollback;
