-- C13c · La fecha del ingreso de tienda es paid_at en hora de BOGOTÁ (no UTC
-- ni created_at), y la sede sigue la regla A3 (la sede incluye las órdenes SIN
-- sede; la de otra sede no).
--   · pagada 2026-10-01 03:00 UTC = 30-sep 22:00 Bogotá → septiembre.
--   · pagada 2026-10-01 05:30 UTC = 01-oct 00:30 Bogotá → octubre.
--   · creada en agosto y pagada en octubre → octubre (cuenta paid_at).
-- Correr:  npm run qa:sql -- supabase/tests/contabilidad_v2/C13c_tienda_fecha_paid_at_bogota_y_sede.sql

begin;

insert into public.vendor_profiles (id, user_id, vendor_type, school_id, display_name, slug,
                                    verification_status, is_active, capabilities)
values ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'school',
        '00000000-0000-4000-b000-000000000001', 'Tienda QA Academia Andes', 'tienda-qa-andes',
        'verified', true, '{"can_sell_products": true, "can_sell_services": false}'::jsonb)
on conflict (id) do update
   set vendor_type = 'school', school_id = excluded.school_id, verification_status = 'verified', is_active = true;

-- Dos sedes de A creadas aquí (ids fijos, no dependen del volcado): «principal» y «otra sede».
insert into public.school_branches (id, school_id, name)
values ('00000000-0000-4000-b100-0000000013c8', '00000000-0000-4000-b000-000000000001', 'QA Sede Principal C13'),
       ('00000000-0000-4000-b100-0000000013c9', '00000000-0000-4000-b000-000000000001', 'QA Sede Norte C13');

insert into public.orders (id, user_id, total_amount, status, vendor_profile_id, vendor_id, school_id,
                           payment_method, provider_transaction_id, paid_at, created_at, reference, pickup_branch_id)
values
  ('00000000-0000-4000-c000-0000000013c1', '00000000-0000-4000-a000-000000000004', 11000, 'paid',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001',
   'wompi', 'tx-c13c-1', '2026-10-01 03:00:00+00', '2026-09-30 20:00:00-05', 'C13C-1', null),
  ('00000000-0000-4000-c000-0000000013c2', '00000000-0000-4000-a000-000000000004', 22000, 'paid',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001',
   'wompi', 'tx-c13c-2', '2026-10-01 05:30:00+00', '2026-09-30 23:00:00-05', 'C13C-2', null),
  ('00000000-0000-4000-c000-0000000013c3', '00000000-0000-4000-a000-000000000004', 33000, 'ready_for_pickup',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001',
   'wompi', 'tx-c13c-3', '2026-10-05 12:00:00-05', '2026-08-15 12:00:00-05', 'C13C-3',
   '00000000-0000-4000-b100-0000000013c8'),
  ('00000000-0000-4000-c000-0000000013c4', '00000000-0000-4000-a000-000000000004', 44000, 'paid',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000001',
   'wompi', 'tx-c13c-4', '2026-10-06 12:00:00-05', '2026-10-06 11:00:00-05', 'C13C-4',
   '00000000-0000-4000-b100-0000000013c9');

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_sep numeric; v_oct numeric; v numeric; d date;
begin
  select coalesce(sum(income_amount) filter (where bucket = '2026-09'), 0),
         coalesce(sum(income_amount) filter (where bucket = '2026-10'), 0)
    into v_sep, v_oct
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-10-31', null, 'month');
  if v_sep <> 11000 then raise exception 'FALLO: septiembre % (esperado 11000: 03:00 UTC del 1-oct es 30-sep en Bogotá)', v_sep; end if;
  if v_oct <> 99000 then raise exception 'FALLO: octubre % (esperado 22000+33000+44000 = 99000)', v_oct; end if;

  select paid_date into d from public.store_income_lines('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-10-31')
   where order_id = '00000000-0000-4000-c000-0000000013c1';
  if d <> date '2026-09-30' then raise exception 'FALLO: paid_date % (esperado 2026-09-30)', d; end if;

  -- Rango de un solo día por el borde: 1-oct Bogotá trae solo la de las 00:30.
  select coalesce(sum(income_amount), 0) into v
    from public.store_income_lines('00000000-0000-4000-b000-000000000001', '2026-10-01', '2026-10-01');
  if v <> 22000 then raise exception 'FALLO: 1-oct Bogotá = % (esperado 22000)', v; end if;
  raise notice 'OK: mes por paid_at en Bogotá (sep 11000 / oct 99000), no por created_at ni UTC';

  -- Sede principal: su orden (33000) + las sin sede (11000+22000); la de Norte (44000) no.
  select coalesce(sum(income_amount), 0) into v
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-10-31',
                                     '00000000-0000-4000-b100-0000000013c8', 'month');
  if v <> 66000 then raise exception 'FALLO: sede principal % (esperado 66000)', v; end if;
  select coalesce(sum(income_amount), 0) into v
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-10-31',
                                     '00000000-0000-4000-b100-0000000013c9', 'month');
  if v <> 77000 then raise exception 'FALLO: sede Norte % (esperado 44000+11000+22000 = 77000)', v; end if;
  raise notice 'OK: sede con la regla A3 (las órdenes sin sede cuentan en todas)';

  begin
    perform * from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-10-31', null, 'producto');
    raise exception 'FALLO: agrupamiento inválido aceptado';
  exception when invalid_parameter_value then raise notice 'OK: agrupamiento inválido → 22023';
  end;
end $$;
reset role;

rollback;
