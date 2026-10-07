-- Débito automático F3 — cambiar tope/medio (reactiva y re-planifica) y cerrar incidentes (§11, D12).
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A06_f3_cambios_e_incidentes.sql
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

-- ── 1. Tope superado → suspendida; subir el tope la reactiva y re-planifica ──
-- La mensualidad sube a $250.000 (total $257.500 > tope $200.000).
update public.payments set amount = 250000 where id = current_setting('qa.pay_oct')::uuid;
select count(*) from public.autopay_plan_cycles('2026-10-05');
do $$
declare v_state text; v_skip text;
begin
  select state, skip_reason into v_state, v_skip from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  if v_state <> 'skipped' or v_skip <> 'over_max_amount' then raise exception 'FALLO 1a: ciclo % / %', v_state, v_skip; end if;
end $$;
-- Segundo ciclo sin débito → suspendida.
select public.autopay_count_cycle_without_debit(current_setting('qa.sub_a')::uuid, 'over_max_amount');
do $$ begin
  if (select status from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'suspended' then
    raise exception 'FALLO 1b: no quedó suspendida'; end if;
end $$;

-- Otro padre no puede cambiarla.
do $$ begin
  if (public.autopay_update_subscription(current_setting('qa.padre_b')::uuid, current_setting('qa.sub_a')::uuid, 300000) ->> 'error') <> 'forbidden' then
    raise exception 'FALLO 1c: padre_b cambió la suscripción de padre_a'; end if;
end $$;

-- El pagador sube el tope: reactiva, contador en 0 y octubre vuelve a scheduled.
do $$
declare r jsonb; v_state text;
begin
  r := public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, 300000, null, '2026-10-05');
  if not (r ->> 'ok')::boolean or not (r ->> 'reactivated')::boolean then raise exception 'FALLO 1d: %', r; end if;
  if (select status || ':' || cycles_without_debit || ':' || max_amount from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'active:0:300000.00' then
    raise exception 'FALLO 1e: no quedó activa con el tope nuevo'; end if;
  select state into v_state from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid;
  if v_state <> 'scheduled' then raise exception 'FALLO 1f: el ciclo no se re-planificó (%)', v_state; end if;
end $$;
-- El próximo plan lo avisa con el total nuevo.
do $$
declare r record;
begin
  select * into r from public.autopay_plan_cycles('2026-10-05') p where p.payment_id = current_setting('qa.pay_oct')::uuid;
  if r.action <> 'notice' or r.total <> 257500 then raise exception 'FALLO 1g: plan % %', r.action, r.total; end if;
end $$;

-- Un cobro ya vencido NO se re-planifica.
update public.autopay_cycles set state = 'skipped', skip_reason = 'over_max_amount' where payment_id = current_setting('qa.pay_oct')::uuid;
select public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, 310000, null, '2026-10-11');
do $$ begin
  if (select state from public.autopay_cycles where payment_id = current_setting('qa.pay_oct')::uuid) <> 'skipped' then
    raise exception 'FALLO 1h: re-planificó un cobro vencido'; end if;
end $$;

-- ── 2. Cambiar el medio: solo a uno propio, disponible y de la misma escuela ──
do $$
declare v_tok_b uuid; v_tok_a2 uuid;
begin
  v_tok_b := (public.autopay_register_token(current_setting('qa.padre_b')::uuid, current_setting('qa.school_a')::uuid,
              'CARD', 'available', 9002, null, 'merchant-A', 'Visa •••• 1111') ->> 'token_id')::uuid;
  if (public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, null, v_tok_b) ->> 'error') <> 'token_not_owned' then
    raise exception 'FALLO 2a: aceptó el medio de otro padre'; end if;
  v_tok_a2 := (public.autopay_register_token(current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
              'NEQUI', 'pending_authorization', null, 'nequi-qa-1', null, 'Nequi •••• 5678') ->> 'token_id')::uuid;
  if (public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, null, v_tok_a2) ->> 'error') <> 'token_not_available' then
    raise exception 'FALLO 2b: aceptó un Nequi sin autorizar'; end if;
  perform public.autopay_mark_token(v_tok_a2, 'available', 7001, 'merchant-A');
  if not (public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, null, v_tok_a2) ->> 'ok')::boolean then
    raise exception 'FALLO 2c: no cambió al Nequi autorizado'; end if;
  if (select payment_token_id from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> v_tok_a2 then
    raise exception 'FALLO 2d: el medio no quedó guardado'; end if;
end $$;

-- ── 3. Cobro doble: la familia no reactiva; la escuela cierra y reactiva ──
do $$
declare v_inc uuid;
begin
  v_inc := (public.autopay_record_incident('duplicate_charge', current_setting('qa.school_a')::uuid,
             current_setting('qa.pay_oct')::uuid, current_setting('qa.sub_a')::uuid, 'tx-dup-qa', 154500) ->> 'incident_id')::uuid;
  if (select suspend_reason from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'duplicate_charge' then
    raise exception 'FALLO 3a: no quedó suspendida por cobro doble'; end if;
  if (public.autopay_update_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, 400000) ->> 'error') <> 'suspended_duplicate_charge' then
    raise exception 'FALLO 3b: la familia levantó una suspensión por cobro doble'; end if;
  if (public.autopay_resolve_incident(current_setting('qa.coach_a')::uuid, v_inc, 'refunded') ->> 'error') <> 'forbidden' then
    raise exception 'FALLO 3c: el coach cerró el incidente'; end if;
  if (public.autopay_resolve_incident(current_setting('qa.padre_a')::uuid, v_inc, 'refunded') ->> 'error') <> 'forbidden' then
    raise exception 'FALLO 3d: el padre cerró el incidente'; end if;
  perform public.autopay_resolve_incident(current_setting('qa.admin_a')::uuid, v_inc, 'refund_requested', 'Se pidió a Wompi');
  if (select status from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'suspended' then
    raise exception 'FALLO 3e: reactivó con la devolución solo pedida'; end if;
  if not (public.autopay_resolve_incident(current_setting('qa.admin_a')::uuid, v_inc, 'refunded', 'Devuelto') ->> 'ok')::boolean then
    raise exception 'FALLO 3f: el admin no pudo cerrar'; end if;
  if (select status from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 'active' then
    raise exception 'FALLO 3g: no se reactivó al cerrar el último cobro doble'; end if;
  if (select resolved_by from public.autopay_incidents where id = v_inc) <> current_setting('qa.admin_a')::uuid then
    raise exception 'FALLO 3h: no quedó quién lo cerró'; end if;
  if (public.autopay_resolve_incident(current_setting('qa.admin_a')::uuid, v_inc, 'dismissed') ->> 'error') <> 'already_closed' then
    raise exception 'FALLO 3i: reabrió un incidente cerrado'; end if;
end $$;

-- ── 4. Nadie fuera de service_role ejecuta las RPC nuevas ──
do $$ begin
  if has_function_privilege('authenticated', 'public.autopay_update_subscription(uuid,uuid,numeric,uuid,date)', 'execute')
     or has_function_privilege('anon', 'public.autopay_resolve_incident(uuid,uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.autopay_resolve_incident(uuid,uuid,text,text)', 'execute') then
    raise exception 'FALLO 4: RPC de F3 ejecutable por anon/authenticated'; end if;
end $$;

rollback;
