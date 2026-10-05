-- Débito automático F1 — cobro doble, baja del atleta, medio anulado y comercio cambiado (pruebas 2, 10; D11, D13).
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A05_cobro_doble_baja_y_medio.sql
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
declare r jsonb; s public.recurring_subscriptions; v_cycle uuid; v_att uuid;
begin
  -- Prueba 2 (base): el detector del BFF registra un cobro doble → suscripción suspendida.
  r := public.autopay_record_incident('duplicate_charge', current_setting('qa.school_a')::uuid,
         current_setting('qa.pay_oct')::uuid, current_setting('qa.sub_a')::uuid, 'tx-dup-1', 154500);
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.status <> 'suspended' or s.suspend_reason <> 'duplicate_charge' then
    raise exception 'FALLO: 2 el cobro doble no suspendió (% %)', s.status, s.suspend_reason;
  end if;
  r := public.autopay_record_incident('duplicate_charge', current_setting('qa.school_a')::uuid,
         current_setting('qa.pay_oct')::uuid, current_setting('qa.sub_a')::uuid, 'tx-dup-1', 154500);
  if not coalesce((r->>'unchanged')::boolean, false) or (select count(*) from public.autopay_incidents where provider_transaction_id = 'tx-dup-1') <> 1 then
    raise exception 'FALLO: 2 el mismo cobro doble se registró dos veces';
  end if;
  raise notice 'OK: 2 cobro doble → incidente único y suscripción suspendida';

  -- Una suspendida no debita.
  perform public.autopay_plan_cycles('2026-10-05');
  if exists (select 1 from public.autopay_cycles where subscription_id = s.id) then
    raise exception 'FALLO: una suscripción suspendida generó ciclo';
  end if;
  update public.recurring_subscriptions set status = 'active', suspend_reason = null where id = s.id;

  -- D11: la fuente es de otro comercio → el intento se libera y la suscripción se cancela.
  perform public.autopay_plan_cycles('2026-10-05');
  select id into v_cycle from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  perform public.autopay_mark_noticed(v_cycle, 154500, '2026-10-05');
  select attempt_id into v_att from public.autopay_claim_due(50, 300, '2026-10-07');
  r := public.autopay_release_attempt(v_att, 'merchant_mismatch');
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.cancel_reason is distinct from 'merchant_changed'
     or (select skip_reason from public.autopay_cycles where id = v_cycle) <> 'merchant_mismatch'
     or (select attempts_used from public.autopay_cycles where id = v_cycle) <> 0 then
    raise exception 'FALLO: D11 comercio distinto (% %)', s.status, s.cancel_reason;
  end if;
  raise notice 'OK: D11 fuente de otro comercio → sin cobro, suscripción cancelada (merchant_changed)';
  update public.recurring_subscriptions set status = 'active', cancel_reason = null, cancelled_at = null where id = s.id;

  -- Medio anulado → cancela las suscripciones que lo usan.
  r := public.autopay_mark_token(current_setting('qa.token_a')::uuid, 'voided');
  if (select cancel_reason from public.recurring_subscriptions where id = s.id) is distinct from 'token_voided' then
    raise exception 'FALLO: anular el medio no canceló la suscripción';
  end if;
  r := public.autopay_mark_token(current_setting('qa.token_a')::uuid, 'available');
  if r->>'error' <> 'invalid_transition' then raise exception 'FALLO: un medio anulado revivió → %', r; end if;
  raise notice 'OK: medio anulado → suscripción cancelada (token_voided); no revive';

  -- D13: cancelar → devuelve si la fuente quedó sin uso; solo pagador o admin.
  update public.payment_tokens set status = 'available', voided_at = null where id = current_setting('qa.token_a')::uuid;
  update public.recurring_subscriptions set status = 'active', cancel_reason = null, cancelled_at = null where id = s.id;
  r := public.autopay_cancel_subscription(current_setting('qa.padre_b')::uuid, s.id, 'parent');
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: otro padre canceló → %', r; end if;
  r := public.autopay_cancel_subscription(current_setting('qa.coach_a')::uuid, s.id, 'school');
  if r->>'error' <> 'forbidden' then raise exception 'FALLO: el coach canceló como escuela → %', r; end if;
  r := public.autopay_cancel_subscription(current_setting('qa.admin_a')::uuid, s.id, 'school');
  if not (r->>'ok')::boolean or not (r->>'token_unused')::boolean then raise exception 'FALLO: el admin no canceló → %', r; end if;
  raise notice 'OK: D13 cancela el pagador o el admin (no el coach ni otro padre); avisa si la fuente quedó sin uso';
  update public.recurring_subscriptions set status = 'active', cancel_reason = null, cancelled_at = null, cancelled_by = null where id = s.id;
end $$;

-- ── Prueba 10: baja del atleta con la RPC real de la escuela ────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.admin_a'), 'role', 'authenticated')::text, true);
select public.set_school_athlete_status(current_setting('qa.school_a')::uuid, 'child', current_setting('qa.sofia')::uuid, false);
set constraints trg_autopay_on_enrollment_end immediate;
do $$
declare s public.recurring_subscriptions;
begin
  select * into s from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if s.status <> 'cancelled' or s.cancel_reason <> 'athlete_inactive' then
    raise exception 'FALLO: 10 la baja del atleta no canceló el débito (% %)', s.status, s.cancel_reason;
  end if;
  if exists (select 1 from public.autopay_cycles where subscription_id = s.id and state in ('scheduled', 'noticed')) then
    raise exception 'FALLO: 10 quedaron ciclos abiertos tras la baja';
  end if;
  raise notice 'OK: 10 baja del atleta → suscripción cancelada (athlete_inactive), sin ciclos abiertos';
end $$;

rollback;
