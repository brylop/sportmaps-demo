-- F1 · Bloqueo: fn_sync_access_group_on_payment encuentra el PIN por child_id,
-- emite el comando del mecanismo de la escuela y no hace nada con el flag
-- apagado. Dreamers: mecanismo 'disable', 2 lectores activos (entrada y salida).
-- PIN 4 = Athenea, PIN 12 = Bella, PIN 605 = Mariapaz.
-- Migración: 20261013192936_sync_access_group_respeta_mecanismo.sql
begin;
do $$
declare
  c_school constant uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  c_owner  constant uuid := '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21';
  c_athenea_oct  constant uuid := '3fd17f5b-5377-4365-b016-e822da73d4c4';
  c_bella_sep    constant uuid := '3d495995-2f29-4f8d-90b0-c6c95c29eeb9';
  c_mariapaz_oct constant uuid := '9a6e961a-2a1e-4e62-9ca8-47f141a94303';
  v_seq bigint;
  v_n int;
  v_tipos text;
begin
  -- Otras pruebas del gemelo pueden haber dejado habilitaciones manuales de
  -- hoy (excepción de un día). Se quitan solo dentro de esta transacción.
  delete from public.device_commands
   where school_id = c_school and issued_by is not null
     and issued_at >= date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota';

  select coalesce(max(cmd_seq), 0) into v_seq from public.device_commands;

  -- 1. Flag apagado (estado real de Dreamers): pagar no encola nada.
  update public.school_settings set access_auto_block_overdue_enabled = false where school_id = c_school;
  update public.payments set status = 'paid', payment_date = current_date where id = c_athenea_oct;
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: con el flag apagado encoló % comandos', v_n; end if;
  raise notice 'OK: flag apagado → 0 comandos';
  update public.payments set status = 'overdue' where id = c_athenea_oct;   -- vuelve (flag off: nada)
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: con el flag apagado encoló % comandos al vencer', v_n; end if;

  -- 2. Flag prendido, mecanismo disable: Athenea (menor, child_id) paga → enable_user PIN 4 en los 2 lectores.
  update public.school_settings set access_auto_block_overdue_enabled = true where school_id = c_school;
  update public.payments set status = 'paid', payment_date = current_date where id = c_athenea_oct;
  select count(*), string_agg(distinct command_type, ',') into v_n, v_tipos
    from public.device_commands where cmd_seq > v_seq and metadata->>'pin' = '4';
  if v_n <> 2 or v_tipos <> 'enable_user' then
    raise exception 'FALLO: pago de Athenea → % comandos (%), esperado 2 enable_user', v_n, v_tipos;
  end if;
  if exists (select 1 from public.device_commands where cmd_seq > v_seq and command_type = 'set_group') then
    raise exception 'FALLO: mandó set_group con mecanismo disable';
  end if;
  raise notice 'OK: Athenea paga → 2 enable_user PIN 4 (por child_id, mecanismo disable)';

  -- 3. Vuelve a mora → disable_user PIN 4.
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set status = 'overdue' where id = c_athenea_oct;
  select count(*), string_agg(distinct command_type, ',') into v_n, v_tipos
    from public.device_commands where cmd_seq > v_seq and metadata->>'pin' = '4';
  if v_n <> 2 or v_tipos <> 'disable_user' then
    raise exception 'FALLO: mora de Athenea → % comandos (%), esperado 2 disable_user', v_n, v_tipos;
  end if;
  raise notice 'OK: Athenea vence → 2 disable_user PIN 4';

  -- 3b. En vuelo: otra transición igual en < 30 min no duplica.
  update public.payments set status = 'pending' where id = c_athenea_oct;   -- unblock (enable_user)
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set status = 'overdue' where id = c_athenea_oct;
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: duplicó % disable_user en vuelo', v_n; end if;
  raise notice 'OK: comando igual en vuelo no se duplica';

  -- 4. Bella paga septiembre pero debe octubre → NO se desbloquea.
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set status = 'paid', payment_date = current_date where id = c_bella_sep;
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: desbloqueó a Bella con octubre todavía vencido (% comandos)', v_n; end if;
  raise notice 'OK: Bella paga sep con oct vencido → sin desbloqueo';

  -- 5. Excepción manual de hoy: el dueño habilitó a Bella (PIN 12) → al vencer no se re-bloquea.
  insert into public.device_commands (school_id, device_id, command_type, direction, status, issued_by, metadata)
  select c_school, id, 'enable_user', case when direction = 'both' then 'entry' else direction end,
         'executed', c_owner, jsonb_build_object('pin', 12)
    from public.turnstile_devices where school_id = c_school and is_active;
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set status = 'overdue' where id = c_bella_sep;
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: re-bloqueó a Bella pese a la habilitación manual de hoy'; end if;
  raise notice 'OK: excepción manual del día respetada';

  -- 6. Mecanismo group: Mariapaz (PIN 605) paga → set_group group 1.
  update public.school_settings set access_block_mechanism = 'group' where school_id = c_school;
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set status = 'paid', payment_date = current_date where id = c_mariapaz_oct;
  select count(*) into v_n from public.device_commands
   where cmd_seq > v_seq and command_type = 'set_group' and metadata->>'pin' = '605' and metadata->>'group' = '1';
  if v_n <> 2 then raise exception 'FALLO: mecanismo group → % set_group(1) para PIN 605', v_n; end if;
  raise notice 'OK: mecanismo group → set_group grupo 1';

  -- 7. Un cobro que no es mensualidad no mueve el acceso.
  select max(cmd_seq) into v_seq from public.device_commands;
  update public.payments set payment_category = 'articulos' where id = c_mariapaz_oct;
  update public.payments set status = 'overdue' where id = c_mariapaz_oct;
  select count(*) into v_n from public.device_commands where cmd_seq > v_seq;
  if v_n <> 0 then raise exception 'FALLO: un cobro de artículos bloqueó (% comandos)', v_n; end if;
  raise notice 'OK: cobro único no bloquea';
end $$;
rollback;
