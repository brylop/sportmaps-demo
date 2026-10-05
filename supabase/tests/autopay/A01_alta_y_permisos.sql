-- Débito automático F1 — alta (D5, D7, D14) y permisos/RLS (pruebas 9 y 12 del spec §14).
-- Correr:  npm run qa:sql -- supabase/tests/autopay/A01_alta_y_permisos.sql
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
declare r jsonb; v_tok_b uuid;
begin
  -- D14: con la casilla, octubre (pending, vence 10-10) entra; first_period = 2026-10.
  if (select (first_period_year, first_period_month) from public.recurring_subscriptions
       where id = current_setting('qa.sub_a')::uuid) <> (2026::smallint, 10::smallint) then
    raise exception 'FALLO: first_period no es 2026-10';
  end if;
  raise notice 'OK: con la casilla el periodo pendiente no vencido entra (D14)';

  -- Segunda suscripción para el mismo atleta → already_subscribed.
  r := public.autopay_create_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid, 200000,
         '00000000-0000-4000-e000-0000000000c1', false, '2026-10-01');
  if r->>'error' <> 'already_subscribed' then raise exception 'FALLO: duplicada → %', r; end if;
  raise notice 'OK: una sola suscripción viva por atleta y escuela (D7)';

  -- Prueba 12a: padre.b no suscribe a Sofía (hija de padre.a).
  r := public.autopay_create_subscription(current_setting('qa.padre_b')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid, 200000,
         '00000000-0000-4000-e000-0000000000c1', false, '2026-10-01');
  if r->>'error' <> 'not_guardian' then raise exception 'FALLO: padre.b suscribió a la hija de A → %', r; end if;
  raise notice 'OK: 12 el padre B no suscribe al hijo de A';

  -- Prueba 12b: padre.b usa el token de padre.a para su propio hijo (escuela B).
  update public.school_settings set autopay_enabled = true where school_id = current_setting('qa.school_b')::uuid;
  insert into public.teams (id, name, sport, school_id)
  values ('00000000-0000-4000-e000-0000000000a2', 'Equipo B', 'futbol', current_setting('qa.school_b')::uuid);
  insert into public.enrollments (child_id, school_id, team_id, status, start_date)
  values (current_setting('qa.tomas')::uuid, current_setting('qa.school_b')::uuid, '00000000-0000-4000-e000-0000000000a2', 'active', '2026-08-01');
  r := public.autopay_create_subscription(current_setting('qa.padre_b')::uuid, current_setting('qa.school_b')::uuid,
         current_setting('qa.tomas')::uuid, null, current_setting('qa.token_a')::uuid, 200000,
         '00000000-0000-4000-e000-0000000000c1', false, '2026-10-01');
  if r->>'error' <> 'token_not_owned' then raise exception 'FALLO: padre.b usó el token de A → %', r; end if;
  raise notice 'OK: 12 nadie usa el token de otro';

  -- B12: la misma fuente de pago no se reasigna a otro usuario.
  r := public.autopay_register_token(current_setting('qa.padre_b')::uuid, current_setting('qa.school_b')::uuid,
         'CARD', 'available', 9001, null, 'merchant-B');
  if r->>'error' <> 'token_owned_by_other' then raise exception 'FALLO: B12 la fuente cambió de dueño → %', r; end if;
  raise notice 'OK: B12 la fuente no cambia de dueño';

  -- Escuela que no ofrece el débito.
  update public.school_settings set autopay_enabled = false where school_id = current_setting('qa.school_b')::uuid;
  v_tok_b := (public.autopay_register_token(current_setting('qa.padre_b')::uuid, current_setting('qa.school_b')::uuid,
         'CARD', 'available', 9002, null, 'merchant-B') ->> 'token_id')::uuid;
  r := public.autopay_create_subscription(current_setting('qa.padre_b')::uuid, current_setting('qa.school_b')::uuid,
         current_setting('qa.tomas')::uuid, null, v_tok_b, 200000, '00000000-0000-4000-e000-0000000000c1', false, '2026-10-01');
  if r->>'error' <> 'autopay_not_offered' then raise exception 'FALLO: alta sin oferta → %', r; end if;
  raise notice 'OK: sin autopay_enabled no hay altas nuevas';

  -- D5: tope por debajo del total vigente (150.000 + 3 %).
  update public.recurring_subscriptions set status = 'cancelled', cancel_reason = 'parent'
   where id = current_setting('qa.sub_a')::uuid;
  r := public.autopay_create_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid, 100000,
         '00000000-0000-4000-e000-0000000000c1', true, '2026-10-01');
  if r->>'error' <> 'max_amount_below_current' or (r->>'current_total')::numeric <> 154500 then
    raise exception 'FALLO: D5 tope bajo → %', r;
  end if;
  raise notice 'OK: D5 el tope debe cubrir el total vigente (154.500)';

  -- Prueba 9: sin la casilla, el periodo actual no entra → first_period = noviembre.
  r := public.autopay_create_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid, 200000,
         '00000000-0000-4000-e000-0000000000c1', false, '2026-10-01');
  if (r->>'first_period_month')::int <> 11 then raise exception 'FALLO: 9 sin casilla → %', r; end if;
  update public.recurring_subscriptions set status = 'cancelled', cancel_reason = 'parent'
   where id = (r->>'subscription_id')::uuid;

  -- Prueba 9: con la casilla pero el cobro ya vencido (hoy 10-15) → tampoco entra.
  r := public.autopay_create_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.school_a')::uuid,
         current_setting('qa.sofia')::uuid, null, current_setting('qa.token_a')::uuid, 200000,
         '00000000-0000-4000-e000-0000000000c1', true, '2026-10-15');
  if (r->>'first_period_month')::int <> 11 then raise exception 'FALLO: 9 lo vencido entró → %', r; end if;
  raise notice 'OK: 9 lo vencido nunca entra al débito, ni con la casilla';
  update public.recurring_subscriptions set status = 'cancelled', cancel_reason = 'parent'
   where id = (r->>'subscription_id')::uuid;
  update public.recurring_subscriptions set status = 'active', cancel_reason = null
   where id = current_setting('qa.sub_a')::uuid;
end $$;

-- Ciclo de octubre, para probar la lectura.
select count(*) from public.autopay_plan_cycles('2026-10-05');

-- ── RLS: el pagador ve lo suyo ───────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.padre_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid;
  if n <> 1 then raise exception 'FALLO: el pagador no ve su suscripción'; end if;
  select count(*) into n from public.autopay_cycles where subscription_id = current_setting('qa.sub_a')::uuid;
  if n <> 1 then raise exception 'FALLO: el pagador no ve su ciclo (%).', n; end if;
  begin
    perform 1 from public.recurring_charge_attempts limit 1;
    raise exception 'FALLO: los intentos se leen directo';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.recurring_subscriptions set max_amount = 1 where id = current_setting('qa.sub_a')::uuid;
    raise exception 'FALLO: el pagador modificó su suscripción directo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.autopay_cancel_subscription(current_setting('qa.padre_a')::uuid, current_setting('qa.sub_a')::uuid, 'parent');
    raise exception 'FALLO: authenticated ejecutó una RPC del BFF';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: el pagador ve su suscripción y su ciclo; no escribe ni ejecuta RPCs; intentos solo por RPC';
end $$;
reset role;

-- ── padre.b y coach.a no ven nada; admin.a ve lo de su escuela ──────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.padre_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.recurring_subscriptions) <> 0 or (select count(*) from public.autopay_cycles) <> 0 then
    raise exception 'FALLO: padre.b ve el débito de otra familia';
  end if;
  raise notice 'OK: 12 padre.b no ve el débito de padre.a';
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.coach_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.recurring_subscriptions) <> 0 or (select count(*) from public.autopay_cycles) <> 0
     or (select count(*) from public.autopay_incidents) <> 0 then
    raise exception 'FALLO: el coach ve el débito';
  end if;
  raise notice 'OK: 12 el coach no lee nada del débito';
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.admin_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.recurring_subscriptions where id = current_setting('qa.sub_a')::uuid) <> 1 then
    raise exception 'FALLO: el admin de la escuela no ve la suscripción';
  end if;
  raise notice 'OK: el admin de la escuela ve las suscripciones de su escuela';
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public.recurring_subscriptions limit 1;
    raise exception 'FALLO: anon lee suscripciones';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501';
  end;
end $$;
reset role;

rollback;
