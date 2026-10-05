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
