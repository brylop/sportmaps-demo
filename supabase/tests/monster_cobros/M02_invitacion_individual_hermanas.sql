-- M02 · Invitación INDIVIDUAL de dos hermanas menores (H-04 del informe Monster)
--
-- Reproduce lo que armaba el diálogo individual hasta hoy (buildInviteParams):
-- role = 'athlete' + id de la ficha, al correo del ACUDIENTE, para cada niña.
-- Antes: la mamá quedaba con rol athlete, las dos fichas a su perfil y open_month
-- (DISTINCT ON user_id) emitía UN solo cobro por dos niñas, a nombre de la mamá.
--
-- Esperado: el servidor trata la invitación de una ficha MENOR como invitación al
-- acudiente: la mamá es parent, cada niña es un hijo distinto y hay un cobro por
-- hija con el nombre de la hija.
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

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare v_isa uuid; v_salo uuid;
begin
  -- Forma exacta de InvitationsManagementPage con los params de la ficha (9 args).
  v_isa := public.create_invitation(
    p_email => 'zr.plata.qa@qa.sportmaps.test', p_role => 'athlete',
    p_child_name => 'Isabella Florian QA', p_team_id => current_setting('qa.team')::uuid,
    p_monthly_fee => 145000, p_parent_phone => '3002220001', p_branch_id => null,
    p_offering_plan_id => null, p_unregistered_athlete_id => current_setting('qa.isa')::uuid);
  v_salo := public.create_invitation(
    p_email => 'zr.plata.qa@qa.sportmaps.test', p_role => 'athlete',
    p_child_name => 'Salomé Florian QA', p_team_id => current_setting('qa.team')::uuid,
    p_monthly_fee => 145000, p_parent_phone => '3002220001', p_branch_id => null,
    p_offering_plan_id => null, p_unregistered_athlete_id => current_setting('qa.salo')::uuid);
  perform set_config('qa.inv_isa',  v_isa::text,  true);
  perform set_config('qa.inv_salo', v_salo::text, true);
end $$;
reset role;

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
select public.accept_invitation_pro(current_setting('qa.inv_isa')::uuid);
select public.accept_invitation_pro(current_setting('qa.inv_salo')::uuid);
reset role;

-- El mes se abre DESPUÉS de aceptar (lo que haría el cron de la noche).
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
reset role;

do $$
declare v_rol text; v_hijos int; v_n int; v_conceptos text;
begin
  select role::text into v_rol from public.profiles where id = current_setting('qa.mama')::uuid;
  if v_rol is distinct from 'parent' then
    raise exception 'FALLO: la acudiente quedó con rol % (se convirtió en "atleta")', v_rol;
  end if;

  select count(*) into v_n from public.enrollments
   where user_id = current_setting('qa.mama')::uuid and status = 'active';
  if v_n > 0 then raise exception 'FALLO: % inscripciones activas quedaron a nombre de la acudiente', v_n; end if;

  select count(*) into v_hijos from public.children where parent_id = current_setting('qa.mama')::uuid;
  if v_hijos <> 2 then raise exception 'FALLO: la acudiente tiene % hijos (esperado 2)', v_hijos; end if;
  raise notice 'OK: la acudiente es parent y cada niña es un hijo distinto';

  select count(*), string_agg(p.concept, ' | ' order by p.concept) into v_n, v_conceptos
    from public.payments p join public.children c on c.id = p.child_id
   where c.parent_id = current_setting('qa.mama')::uuid
     and p.period_year = current_setting('qa.y')::int and p.period_month = current_setting('qa.m')::int
     and p.status not in ('cancelled','rejected','failed');
  if v_n <> 2 then raise exception 'FALLO: % cobros para las dos hermanas (esperado 2): %', v_n, v_conceptos; end if;
  if v_conceptos not like '%Isabella%' or v_conceptos not like '%Salomé%' then
    raise exception 'FALLO: los cobros no llevan el nombre de cada hija: %', v_conceptos;
  end if;
  select count(*) into v_n from public.payments
   where school_id = current_setting('qa.school')::uuid and user_id = current_setting('qa.mama')::uuid
     and status not in ('cancelled','rejected','failed');
  if v_n > 0 then raise exception 'FALLO: % cobros a nombre de la acudiente como atleta', v_n; end if;
  raise notice 'OK: un cobro por hija (%)', v_conceptos;
end $$;

rollback;
