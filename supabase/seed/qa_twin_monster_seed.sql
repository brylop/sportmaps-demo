-- =============================================================================
-- supabase/seed/qa_twin_monster_seed.sql — escuela tipo Monster´s Volley Club
-- SOLO para el GEMELO LOCAL (docs/qa-gemelo-local.md). Idempotente.
--
--   docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres -d postgres \
--     < supabase/seed/qa_twin_monster_seed.sql
--
-- Reproduce la forma de Monster (docs/qa/monster-prelanzamiento-2026-10-05.md):
-- fichas en `unregistered_athletes` con el acudiente completo y CERO cuentas,
-- inscripciones solo de equipo, corte el día 1, gracia 5, mora 5 %.
--
--   · Isabella Florian QA (16 años) y Salomé Florian QA (9) — HERMANAS, mismo
--     acudiente (zr.plata.qa@…), correo y teléfono de cada niña ≠ los del acudiente.
--   · Andrés Adulto QA (25) — adulto, se paga solo; también tiene "acudiente"
--     cargado (contacto de emergencia), como las 38 fichas de adultos de Monster.
--
-- Cuotas: monthly_fee 145.000 por inscripción (lo que recomienda el informe §3.B.8).
-- Equipo con price_monthly = 0 (como 13 de los 14 equipos de Monster).
-- Plan "Tarifa plena QA" 145.000 (para el escenario del editor de planes).
--
-- UUIDs fijos: usuario …-a000-0000000000f1, escuela …-b000-000000000003,
-- fichas …-c000-0000000000f1..f3, equipo/oferta/plan …-e000-0000000000f1..f3, inscripciones …-e000-0000000000a1..a3.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
begin
  if (select count(*) from auth.users where email not like '%@qa.sportmaps.test') > 0 then
    raise exception 'ABORTADO: auth.users tiene usuarios que no son de la semilla QA. ¿Es esta la base viva?';
  end if;
end $$;

begin;

-- ── Owner de la escuela ───────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous
)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-0000000000f1', 'authenticated',
        'authenticated', 'owner.monster@qa.sportmaps.test',
        extensions.crypt('QaGemelo2026!', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Owner QA Monster', 'role', 'school'),
        now(), now(), '', '', '', '', '', '', '', '', false, false)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('00000000-0000-4000-a000-0000000000f1', '00000000-0000-4000-a000-0000000000f1',
        jsonb_build_object('sub', '00000000-0000-4000-a000-0000000000f1', 'email', 'owner.monster@qa.sportmaps.test', 'email_verified', true),
        'email', now(), now(), now())
on conflict do nothing;

update public.profiles
   set onboarding_completed = true, onboarding_started = true, needs_role_selection = false
 where id = '00000000-0000-4000-a000-0000000000f1';

-- ── Escuela ──────────────────────────────────────────────────────────────────
insert into public.schools (id, owner_id, name, city, email, phone, onboarding_status, onboarding_step, account_type, business_model, sports)
values ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-0000000000f1', 'QA Monster Volley', 'Bogotá',
        'escuela.monster@qa.sportmaps.test', '+573000000103', 'completed', 5, 'real', 'teams', array['voleibol'])
on conflict (id) do nothing;

update public.school_subscriptions
   set plan_code = 'starter', tier = 'free', status = 'active', trial_ends_at = null
 where school_id = '00000000-0000-4000-b000-000000000003';

-- Config de cobro igual a la de Monster en la viva (informe §1).
update public.school_settings
   set auto_generate_payments = true, payment_cutoff_day = 1, payment_grace_days = 5,
       late_fee_enabled = true, late_fee_percentage = 5, reminder_enabled = true,
       charge_notifications_enabled = false
 where school_id = '00000000-0000-4000-b000-000000000003';

-- ── Equipo (precio 0, como Monster), oferta y plan ──────────────────────────
insert into public.teams (id, name, sport, school_id, price_monthly)
values ('00000000-0000-4000-e000-0000000000f1', 'Sub 17 Femenino QA', 'voleibol', '00000000-0000-4000-b000-000000000003', 0)
on conflict (id) do nothing;

insert into public.offerings (id, school_id, name, offering_type, sport)
values ('00000000-0000-4000-e000-0000000000f2', '00000000-0000-4000-b000-000000000003', 'Mensualidad QA', 'membership', 'voleibol')
on conflict (id) do nothing;

insert into public.offering_plans (id, offering_id, school_id, name, price, duration_days, max_sessions)
values ('00000000-0000-4000-e000-0000000000f3', '00000000-0000-4000-e000-0000000000f2', '00000000-0000-4000-b000-000000000003',
        'Tarifa plena QA', 145000, 30, 12)
on conflict (id) do nothing;

-- ── Fichas sin cuenta (acudiente completo, 0 cuentas) ────────────────────────
insert into public.unregistered_athletes (
  id, school_id, full_name, doc_type, doc_number, email, phone, date_of_birth,
  guardian_full_name, guardian_email, guardian_phone, is_active
)
values
  ('00000000-0000-4000-c000-0000000000f1', '00000000-0000-4000-b000-000000000003', 'Isabella Florian QA', 'TI', '9910000001',
   'isa.florian.atleta@qa.sportmaps.test', '3001110001', (current_date - interval '16 years')::date,
   'Zulma Plata QA', 'zr.plata.qa@qa.sportmaps.test', '3002220001', true),
  ('00000000-0000-4000-c000-0000000000f2', '00000000-0000-4000-b000-000000000003', 'Salomé Florian QA', 'TI', '9910000002',
   'salo.florian.atleta@qa.sportmaps.test', '3001110002', (current_date - interval '9 years')::date,
   'Zulma Plata QA', 'zr.plata.qa@qa.sportmaps.test', '3002220001', true),
  ('00000000-0000-4000-c000-0000000000f3', '00000000-0000-4000-b000-000000000003', 'Andrés Adulto QA', 'CC', '9910000003',
   'andres.adulto@qa.sportmaps.test', '3001110003', (current_date - interval '25 years')::date,
   'Contacto Emergencia QA', 'emergencia.andres@qa.sportmaps.test', '3002220003', true)
on conflict (id) do nothing;

-- ── Inscripciones solo de equipo, con cuota por atleta ──────────────────────
insert into public.enrollments (id, school_id, team_id, unregistered_athlete_id, status, start_date, monthly_fee)
values
  ('00000000-0000-4000-e000-0000000000a1', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-e000-0000000000f1',
   '00000000-0000-4000-c000-0000000000f1', 'active', '2026-08-26', 145000),
  ('00000000-0000-4000-e000-0000000000a2', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-e000-0000000000f1',
   '00000000-0000-4000-c000-0000000000f2', 'active', '2026-08-26', 145000),
  ('00000000-0000-4000-e000-0000000000a3', '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-e000-0000000000f1',
   '00000000-0000-4000-c000-0000000000f3', 'active', '2026-08-26', 145000)
on conflict (id) do nothing;

commit;

select 'monster_fichas' as que, count(*) from public.unregistered_athletes where school_id = '00000000-0000-4000-b000-000000000003'
union all
select 'monster_inscripciones', count(*) from public.enrollments where school_id = '00000000-0000-4000-b000-000000000003' and status = 'active'
union all
select 'monster_cobros', count(*) from public.payments where school_id = '00000000-0000-4000-b000-000000000003';
