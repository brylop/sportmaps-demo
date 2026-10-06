-- M01 · Invitación MASIVA de acudientes (H-03 de docs/qa/monster-prelanzamiento-2026-10-05.md)
--
-- Escuela tipo Monster (supabase/seed/qa_twin_monster_seed.sql): dos hermanas con
-- ficha sin cuenta, mismo acudiente, correo de cada niña ≠ correo del acudiente.
--
--   1. El mes ya está abierto: las fichas tienen su mensualidad SIN pagador.
--   2. La llamada histórica del bulk (7 argumentos con nombre) NO es ambigua (42725).
--   3. Isabella se invita como lo hacía el bulk viejo, SIN id de ficha; Salomé como
--      el bulk nuevo, CON p_unregistered_athlete_id.
--   4. La acudiente se registra y acepta las dos.
--   ⇒ Cada ficha se adopta como hijo de la acudiente (2 hijos, no 3 ni 4), las
--     inscripciones y los cobros pasan al hijo con parent_id, abrir el mes otra
--     vez no genera nada, la acudiente ve los 2 cobros y puede subir comprobante.
--
-- Correr:  npm run qa:sql -- supabase/tests/monster_cobros
begin;

select set_config('qa.owner',  '00000000-0000-4000-a000-0000000000f1', true);
select set_config('qa.school', '00000000-0000-4000-b000-000000000003', true);
select set_config('qa.team',   '00000000-0000-4000-e000-0000000000f1', true);
select set_config('qa.isa',    '00000000-0000-4000-c000-0000000000f1', true);
select set_config('qa.salo',   '00000000-0000-4000-c000-0000000000f2', true);
select set_config('qa.mama',   '00000000-0000-4000-a000-0000000000f9', true);
select set_config('qa.y', extract(year  from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.m', extract(month from (now() at time zone 'America/Bogota'))::int::text, true);

-- La acudiente todavía NO existe (0 cuentas, como en Monster).
do $$ begin
  if exists (select 1 from auth.users where email = 'zr.plata.qa@qa.sportmaps.test') then
    raise exception 'FALLO (escenario): la acudiente ya tiene cuenta en el gemelo';
  end if;
end $$;

-- ── 1. Owner abre el mes: 3 cobros sin pagador ───────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
  if (r->>'generados')::int <> 3 then raise exception 'FALLO (escenario): open_month generó % (esperado 3)', r; end if;
  raise notice 'OK: mes abierto, 3 cobros sin pagador (las dos hermanas + el adulto)';
end $$;

-- ── 2 y 3. Invitaciones ──────────────────────────────────────────────────────
do $$
declare v_isa uuid; v_salo uuid;
begin
  -- La forma EXACTA del bulk anterior (7 argumentos con nombre). Con dos
  -- sobrecargas de create_invitation esto era 42725 y la invitación masiva
  -- moría entera.
  begin
    v_isa := public.create_invitation(
      p_email => 'zr.plata.qa@qa.sportmaps.test', p_role => 'parent',
      p_child_name => 'Isabella Florian QA', p_team_id => current_setting('qa.team')::uuid,
      p_monthly_fee => 145000, p_parent_phone => '3002220001', p_branch_id => null);
  exception when ambiguous_function then
    raise exception 'FALLO: create_invitation con 7 argumentos es ambigua (42725): la invitación masiva falla entera';
  end;
  raise notice 'OK: create_invitation con 7 argumentos con nombre ya no es ambigua';

  -- El bulk nuevo manda el id de la ficha.
  v_salo := public.create_invitation(
      p_email => 'zr.plata.qa@qa.sportmaps.test', p_role => 'parent',
      p_child_name => 'Salomé Florian QA', p_team_id => current_setting('qa.team')::uuid,
      p_monthly_fee => 145000, p_parent_phone => '3002220001', p_branch_id => null,
      p_unregistered_athlete_id => current_setting('qa.salo')::uuid);

  if v_isa is null or v_salo is null or v_isa = v_salo then
    raise exception 'FALLO: se esperaban dos invitaciones distintas (isa=%, salo=%)', v_isa, v_salo;
  end if;
  perform set_config('qa.inv_isa',  v_isa::text,  true);
  perform set_config('qa.inv_salo', v_salo::text, true);
end $$;

reset role;

-- ── 4. Registro de la acudiente (el trigger crea su profile) ─────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous)
values ('00000000-0000-0000-0000-000000000000', current_setting('qa.mama')::uuid, 'authenticated', 'authenticated',
        'zr.plata.qa@qa.sportmaps.test', 'x', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Zulma Plata QA', 'role', 'parent'),
        now(), now(), '', '', '', '', '', '', '', '', false, false);

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.mama'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- Igual que acceptPendingInvitations(): acepta todas las pendientes del correo.
select public.accept_invitation_pro(current_setting('qa.inv_isa')::uuid);
select public.accept_invitation_pro(current_setting('qa.inv_salo')::uuid);
reset role;

-- ── Verificación ─────────────────────────────────────────────────────────────
do $$
declare
  v_hijos int; v_rol text; v_isa_child uuid; v_salo_child uuid; v_n int; v_sin_pagador int;
begin
  select count(*) into v_hijos from public.children where parent_id = current_setting('qa.mama')::uuid;
  if v_hijos <> 2 then raise exception 'FALLO: la acudiente quedó con % hijos (esperado 2: las dos fichas adoptadas)', v_hijos; end if;

  select role::text into v_rol from public.profiles where id = current_setting('qa.mama')::uuid;
  if v_rol <> 'parent' then raise exception 'FALLO: el perfil de la acudiente quedó con rol %', v_rol; end if;

  if (select linked_profile_id is distinct from current_setting('qa.mama')::uuid from public.unregistered_athletes where id = current_setting('qa.isa')::uuid) then
    raise exception 'FALLO: la ficha de Isabella (invitada SIN id de ficha) no quedó vinculada: se creó un hijo nuevo aparte';
  end if;
  if (select linked_profile_id is distinct from current_setting('qa.mama')::uuid from public.unregistered_athletes where id = current_setting('qa.salo')::uuid) then
    raise exception 'FALLO: la ficha de Salomé (invitada CON id de ficha) no quedó vinculada';
  end if;
  raise notice 'OK: las dos fichas adoptadas, 2 hijos, la acudiente es parent';

  -- "Mismo hijo": el hijo hereda documento y fecha de nacimiento de la ficha.
  select count(*) into v_n from public.children
   where parent_id = current_setting('qa.mama')::uuid
     and doc_number in ('9910000001', '9910000002') and date_of_birth is not null;
  if v_n <> 2 then raise exception 'FALLO: % de 2 hijos heredaron documento y fecha de nacimiento de su ficha', v_n; end if;
  raise notice 'OK: cada hijo conserva documento y fecha de nacimiento de su ficha';

  -- Inscripciones: ninguna activa queda en la ficha; una por hija.
  select count(*) into v_n from public.enrollments
   where unregistered_athlete_id in (current_setting('qa.isa')::uuid, current_setting('qa.salo')::uuid) and status = 'active';
  if v_n <> 0 then raise exception 'FALLO: % inscripciones activas siguen en la ficha', v_n; end if;
  select count(*) into v_n from public.enrollments e join public.children c on c.id = e.child_id
   where c.parent_id = current_setting('qa.mama')::uuid and e.status = 'active';
  if v_n <> 2 then raise exception 'FALLO: % inscripciones activas de las hijas (esperado 2)', v_n; end if;

  -- Cobros del mes: uno por hija, con pagador; ninguno sigue en la ficha.
  select count(*) into v_n from public.payments p join public.children c on c.id = p.child_id
   where c.parent_id = current_setting('qa.mama')::uuid
     and p.period_year = current_setting('qa.y')::int and p.period_month = current_setting('qa.m')::int
     and p.status not in ('cancelled','rejected','failed')
     and p.parent_id = current_setting('qa.mama')::uuid;
  if v_n <> 2 then raise exception 'FALLO: % cobros del mes con pagador para las hijas (esperado 2)', v_n; end if;
  select count(*) into v_sin_pagador from public.payments
   where unregistered_athlete_id in (current_setting('qa.isa')::uuid, current_setting('qa.salo')::uuid)
     and status not in ('cancelled','rejected','failed');
  if v_sin_pagador <> 0 then raise exception 'FALLO: % cobros siguen colgados de la ficha, sin pagador', v_sin_pagador; end if;
  raise notice 'OK: inscripciones y cobros movidos al hijo, con parent_id';
end $$;

-- Abrir el mes otra vez (el cron corre TODOS los días) no duplica.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
  if (r->>'generados')::int <> 0 then raise exception 'FALLO: re-abrir el mes generó % cobros (doble cobro)', r->>'generados'; end if;
  raise notice 'OK: re-abrir el mes no genera duplicados';
end $$;
reset role;

-- La acudiente ve sus 2 cobros y sube el comprobante de uno.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.mama'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_n int; v_pay uuid;
begin
  select count(*), min(id::text)::uuid into v_n, v_pay from public.payments
   where status = 'pending' and period_year = current_setting('qa.y')::int and period_month = current_setting('qa.m')::int;
  if v_n <> 2 then raise exception 'FALLO: la acudiente ve % cobros pendientes del mes (esperado 2)', v_n; end if;

  update public.payments
     set receipt_url = 'https://qa.invalid/comprobante.jpg', status = 'awaiting_approval', payment_method = 'transfer'
   where id = v_pay;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: la acudiente no pudo subir el comprobante (filas=%)', v_n; end if;
  raise notice 'OK: la acudiente ve 2 cobros y sube comprobante (awaiting_approval)';
end $$;
reset role;

rollback;
