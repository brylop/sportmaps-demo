-- =============================================================================
-- supabase/seed/qa_twin_campestre_seed.sql — «Club Campestre Demo» en el gemelo
-- SOLO para el GEMELO LOCAL (docs/qa-gemelo-local.md). Idempotente.
--
--   docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres -d postgres \
--     < supabase/seed/qa_twin_campestre_seed.sql
--
-- Los _smoke de «Cobros y pagos» (supabase/migrations/_smoke/charge_batches_smoke.sql,
-- payment_adjustments_smoke.sql, cobros_personas_smoke.sql) y
-- scripts/pruebas-cobros-y-pagos-concurrencia.mjs exigen la escuela con su id
-- REAL (25a123f0-6d57-48a4-9800-7b1531d61cd2) y nombre exacto. Esto reproduce su
-- FORMA (base viva leída en solo lectura el 2026-10-10), no sus datos: 15 planes
-- con los precios vivos, 8 equipos (uno por deporte), 30 fichas sintéticas con
-- 46 inscripciones activas, settings de cobro iguales (corte 10, gracia 5,
-- mora 5 %, torneos ON, hermanos/militar/pronto pago OFF).
--
-- UUIDs RFC 4122 válidos (versión 4, variante 8/9/a/b): el zod del BFF
-- (z.string().uuid()) rechaza los «…-4000-c000-…» / «…-e000-…» de las otras
-- semillas. Fichas …-8c00-0000000001NN, planes …-9e00-0000000001NN, equipos
-- …-9e00-0000000002NN, inscripciones …-9e00-0000000003NN.
-- Usuarios (contraseña QaGemelo2026!), UUIDs …-a000-0000000000cN:
--   owner.campestre@qa.sportmaps.test     owner (schools.owner_id)              c1
--   admin.campestre@qa.sportmaps.test     school_members 'admin'               c2
--   coach.campestre@qa.sportmaps.test     school_members 'coach'               c3
--   padre.campestre@qa.sportmaps.test     acudiente PURO, hijo «Hijo QA Campestre»
--                                         (ficha …-8c00-000000000101, inscripción
--                                         activa Fútbol 180.000, SIN cobros)    c4
--   contador.campestre@qa.sportmaps.test  school_members 'accountant'          c5
-- =============================================================================

\set ON_ERROR_STOP on

do $$
begin
  if (select count(*) from auth.users where email not like '%@qa.sportmaps.test') > 0 then
    raise exception 'ABORTADO: auth.users tiene usuarios que no son de la semilla QA. ¿Es esta la base viva?';
  end if;
end $$;

begin;

create temp table _cu (n int, id uuid, email text, full_name text, meta_role text) on commit drop;
insert into _cu values
  (1, '00000000-0000-4000-a000-0000000000c1', 'owner.campestre@qa.sportmaps.test',    'Owner QA Campestre',    'school'),
  (2, '00000000-0000-4000-a000-0000000000c2', 'admin.campestre@qa.sportmaps.test',    'Admin QA Campestre',    'school_admin'),
  (3, '00000000-0000-4000-a000-0000000000c3', 'coach.campestre@qa.sportmaps.test',    'Coach QA Campestre',    'coach'),
  (4, '00000000-0000-4000-a000-0000000000c4', 'padre.campestre@qa.sportmaps.test',    'Padre QA Campestre',    'parent'),
  (5, '00000000-0000-4000-a000-0000000000c5', 'contador.campestre@qa.sportmaps.test', 'Contador QA Campestre', 'parent');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('QaGemelo2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name, 'role', u.meta_role),
       now(), now(), '', '', '', '', '', '', '', '', false, false
  from _cu u
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from _cu u
on conflict do nothing;

update public.profiles p
   set onboarding_completed = true, onboarding_started = true, needs_role_selection = false,
       phone = '+57301000' || lpad(u.n::text, 4, '0')
  from _cu u where p.id = u.id;

-- ── Escuela (id y nombre REALES; los smokes los exigen) ─────────────────────
insert into public.schools (id, owner_id, name, city, email, phone, onboarding_status, onboarding_step,
                            account_type, is_demo, business_model, sports, slug)
values ('25a123f0-6d57-48a4-9800-7b1531d61cd2', '00000000-0000-4000-a000-0000000000c1', 'Club Campestre Demo',
        'Bogotá', 'escuela.campestre@qa.sportmaps.test', '+573000000104', 'completed', 99, 'demo', true, 'both',
        array['Golf','Tenis','Pádel','Fútbol','Voleibol','Baloncesto','Natación','Gimnasio'], 'club-campestre-demo-qa')
on conflict (id) do nothing;

update public.school_subscriptions
   set plan_code = 'profesional', tier = 'pro', status = 'active', trial_ends_at = null,
       current_period_start = date_trunc('month', now()), current_period_end = date_trunc('month', now()) + interval '1 month'
 where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';

insert into public.school_settings (school_id) values ('25a123f0-6d57-48a4-9800-7b1531d61cd2')
on conflict (school_id) do nothing;
update public.school_settings
   set responsible_payment_policy = 'primary_acudiente', payment_grace_days = 5, payment_cutoff_day = 10,
       allow_multiple_enrollments = true, auto_generate_payments = true, reminder_enabled = true,
       reminder_days_before = 3, late_fee_enabled = true, late_fee_percentage = 5, require_payment_proof = true,
       billing_cycle_type = 'fixed_calendar', payment_setup_completed = true, wompi_enabled = true,
       online_fee_pct = 3, fee_payer = 'parent', billing_enabled = true, tournament_charges_enabled = true,
       early_payment_discount_enabled = false, early_payment_discount_days = 5, early_payment_discount_percentage = 0,
       military_discount_enabled = false, sibling_discount_enabled = false, sibling_discount_percentage = 0,
       charge_notifications_enabled = false, monthly_statement_enabled = true, auto_cancel_overdue_enabled = true,
       enrollment_validity_mode = 'rolling', hour_bank_overage_charges_enabled = false, merchandise_enabled = true
 where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';

insert into public.school_members (school_id, profile_id, role, status)
values ('25a123f0-6d57-48a4-9800-7b1531d61cd2', '00000000-0000-4000-a000-0000000000c2', 'admin', 'active'),
       ('25a123f0-6d57-48a4-9800-7b1531d61cd2', '00000000-0000-4000-a000-0000000000c3', 'coach', 'active'),
       ('25a123f0-6d57-48a4-9800-7b1531d61cd2', '00000000-0000-4000-a000-0000000000c4', 'parent', 'active'),
       ('25a123f0-6d57-48a4-9800-7b1531d61cd2', '00000000-0000-4000-a000-0000000000c5', 'accountant', 'active')
on conflict (profile_id, school_id) do nothing;

-- ── Ofertas y planes (precios de la viva; created_at escalonado: el primero con
--    precio > 0 por created_at es «Mensualidad Fútbol» 180.000) ──────────────
insert into public.offerings (id, school_id, name, offering_type, sport)
values ('00000000-0000-4000-9e00-0000000000c0', '25a123f0-6d57-48a4-9800-7b1531d61cd2', 'Programas QA Campestre', 'membership', 'Fútbol')
on conflict (id) do nothing;

insert into public.offering_plans (id, offering_id, school_id, name, price, duration_days, created_at)
select ('00000000-0000-4000-9e00-0000000001' || lpad(to_hex(x.n), 2, '0'))::uuid,
       '00000000-0000-4000-9e00-0000000000c0', '25a123f0-6d57-48a4-9800-7b1531d61cd2',
       x.name, x.price, 30, now() - interval '60 days' + x.n * interval '1 minute'
  from (values (1, 'Mensualidad Fútbol', 180000), (2, 'Mensualidad Golf', 320000), (3, 'Mensualidad Pádel', 220000),
               (4, 'Mensualidad Baloncesto', 160000), (5, 'Mensualidad Tenis', 280000), (6, 'Mensualidad Voleibol', 160000),
               (7, 'Mensualidad Natación', 200000), (8, 'Mensualidad Gimnasio', 150000),
               (9, 'Matrícula Golf', 250000), (10, 'Matrícula Tenis', 200000), (11, 'Matrícula Pádel', 150000),
               (12, 'Matrícula Fútbol', 120000), (13, 'Matrícula Voleibol', 100000), (14, 'Matrícula Baloncesto', 100000),
               (15, 'Matrícula Natación', 130000)) as x(n, name, price)
on conflict (id) do nothing;

-- ── Equipos (uno por deporte; el primero por created_at es Fútbol) ──────────
insert into public.teams (id, name, sport, school_id, price_monthly, created_at)
select ('00000000-0000-4000-9e00-0000000002' || lpad(to_hex(x.n), 2, '0'))::uuid, x.name, x.sport,
       '25a123f0-6d57-48a4-9800-7b1531d61cd2', x.price, now() - interval '60 days' + x.n * interval '1 minute'
  from (values (1, 'Fútbol Sub-12 QA', 'futbol', 180000), (2, 'Golf Juvenil QA', 'golf', 320000),
               (3, 'Pádel Iniciación QA', 'padel', 220000), (4, 'Baloncesto Sub-14 QA', 'baloncesto', 160000),
               (5, 'Tenis Intermedio QA', 'tenis', 280000), (6, 'Voleibol Mixto QA', 'voleibol', 160000),
               (7, 'Natación Infantil QA', 'natacion', 200000), (8, 'Gimnasio Adultos QA', 'gimnasio', 150000)) as x(n, name, sport, price)
on conflict (id) do nothing;

-- ── Fichas: 1 = hijo del padre QA; 2..30 sin cuenta de acudiente ────────────
insert into public.children (id, parent_id, full_name, date_of_birth, school_id, is_active, doc_type, doc_number,
                             parent_phone_temp, parent_name_temp)
select ('00000000-0000-4000-8c00-0000000001' || lpad(to_hex(g), 2, '0'))::uuid,
       case when g = 1 then '00000000-0000-4000-a000-0000000000c4'::uuid end,
       case when g = 1 then 'Hijo QA Campestre' else 'Atleta QA Campestre ' || lpad(g::text, 2, '0') end,
       (current_date - ((8 + g % 9) * 365))::date, '25a123f0-6d57-48a4-9800-7b1531d61cd2', true,
       'TI', '98800000' || lpad(g::text, 2, '0'),
       case when g > 1 then '3105550' || lpad(g::text, 3, '0') end,
       case when g > 1 then 'Acudiente QA ' || lpad(g::text, 2, '0') end
  from generate_series(1, 30) g
on conflict (id) do nothing;

-- 46 inscripciones activas: ficha g en el equipo (g % 8)+1; las 16 primeras
-- también en un segundo equipo (allow_multiple_enrollments = true).
insert into public.enrollments (id, school_id, child_id, team_id, offering_plan_id, status, monthly_fee, start_date, expires_at)
select ('00000000-0000-4000-9e00-0000000003' || lpad(to_hex(r.k), 2, '0'))::uuid,
       '25a123f0-6d57-48a4-9800-7b1531d61cd2',
       ('00000000-0000-4000-8c00-0000000001' || lpad(to_hex(r.g), 2, '0'))::uuid,
       ('00000000-0000-4000-9e00-0000000002' || lpad(to_hex(r.t), 2, '0'))::uuid,
       ('00000000-0000-4000-9e00-0000000001' || lpad(to_hex(r.t), 2, '0'))::uuid,
       'active', p.price, current_date - 20, current_date + 10
  from (select g, g as k, case when g = 1 then 1 else (g % 8) + 1 end as t from generate_series(1, 30) g
        union all
        select g, 30 + g - 1, ((g + 3) % 8) + 1 from generate_series(2, 17) g) r
  join public.offering_plans p on p.id = ('00000000-0000-4000-9e00-0000000001' || lpad(to_hex(r.t), 2, '0'))::uuid
on conflict (id) do nothing;

commit;

select 'campestre_fichas' as que, count(*) from public.children where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
union all
select 'campestre_inscripciones_activas', count(*) from public.enrollments where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2' and status = 'active'
union all
select 'campestre_planes', count(*) from public.offering_plans where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
union all
select 'campestre_equipos', count(*) from public.teams where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
