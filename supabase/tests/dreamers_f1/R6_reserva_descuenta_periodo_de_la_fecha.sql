-- F1 · R6: reserve_hour_bank descuenta del periodo de la FECHA reservada.
-- Bella (inscripción bc70f094, plan PGC16x4, bloque 240) reserva el 1-nov:
-- sube reserved_minutes del periodo de noviembre; el de octubre no se toca.
-- Cancelar devuelve en el mismo periodo. La firma de 1 arg sigue dando HOY.
-- Migración: 20261013192915_reserve_hour_bank_periodo_de_la_fecha.sql
begin;
do $$
declare
  c_enr  constant uuid := 'bc70f094-ca4d-4b6b-a951-7ed6141aa4ab';
  v_oct_antes int; v_oct_despues int; v_nov int; v_res jsonb; v_per uuid; v_hoy_per uuid;
  v_can jsonb;
begin
  select reserved_minutes into v_oct_antes from public.hour_bank_periods
   where enrollment_id = c_enr and period_start = '2026-10-01';

  v_res := public.reserve_hour_bank(c_enr, date '2026-11-01', null, null);
  if not coalesce((v_res->>'reserved')::boolean, false) then
    raise exception 'FALLO: no reservó: %', v_res;
  end if;

  select period_id into v_per from public.hour_bank_reservations where id = (v_res->>'reservation_id')::uuid;
  select reserved_minutes into v_nov from public.hour_bank_periods
   where id = v_per and period_start = '2026-11-01' and period_end = '2026-11-30';
  if v_nov is distinct from 240 then
    raise exception 'FALLO: la reserva quedó en el periodo % (reserved_minutes nov=%)', v_per, v_nov;
  end if;
  select reserved_minutes into v_oct_despues from public.hour_bank_periods
   where enrollment_id = c_enr and period_start = '2026-10-01';
  if v_oct_despues is distinct from v_oct_antes then
    raise exception 'FALLO: octubre cambió % → %', v_oct_antes, v_oct_despues;
  end if;
  raise notice 'OK: nov reserved=240, oct sin cambio (%)', v_oct_despues;

  v_can := public.cancel_hour_bank_reservation((v_res->>'reservation_id')::uuid);
  select reserved_minutes into v_nov from public.hour_bank_periods where id = v_per;
  if v_nov <> 0 then raise exception 'FALLO: cancelar no devolvió (nov=%)', v_nov; end if;
  raise notice 'OK: cancelar devuelve en noviembre';

  -- La firma de 1 argumento sigue abriendo/devolviendo el periodo de hoy.
  v_hoy_per := public.get_or_open_hour_bank_period(c_enr);
  if (select period_start from public.hour_bank_periods where id = v_hoy_per)
       <> date_trunc('month', (now() at time zone 'America/Bogota')::date)::date then
    raise exception 'FALLO: get_or_open_hour_bank_period(1 arg) no devolvió el periodo de hoy';
  end if;
  raise notice 'OK: firma de 1 argumento = periodo de hoy';

  -- Gate hours_plan_enabled: apagado → not_hours_plan, sin abrir periodos.
  update public.school_settings set hours_plan_enabled = false
   where school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  v_res := public.reserve_hour_bank(c_enr, date '2026-12-01', null, null);
  if v_res->>'reason' <> 'not_hours_plan'
     or exists (select 1 from public.hour_bank_periods where enrollment_id = c_enr and period_start = '2026-12-01') then
    raise exception 'FALLO: con hours_plan_enabled=false reservó/abrió periodo: %', v_res;
  end if;
  raise notice 'OK: gate hours_plan_enabled respetado';
end $$;
rollback;
