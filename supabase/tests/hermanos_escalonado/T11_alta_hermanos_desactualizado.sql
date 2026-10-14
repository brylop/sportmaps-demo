-- F2 hermanos · T11: alta con hermano (create_enrollment_with_payments).
--   a) El BFF cotizó un descuento que ya no es el vigente → 'hermanos_desactualizado'
--      y no se guarda nada.
--   b) Con el valor correcto: vínculo 'alta' (sin escribir parent_id), cobro con
--      sibling_discount_applied y ajuste 'hermanos'.
--   c) Sin la llave sibling_discount_applied (BFF anterior) el cobro nace como antes.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  v_child uuid;
  enr jsonb; pay jsonb; r jsonb; p record;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  insert into public.children (full_name, school_id) values ('QA Hermanita Nueva', s) returning id into v_child;

  enr := jsonb_build_object('child_id', v_child, 'offering_plan_id', '66783926-c6dc-4482-9417-f9bf930f5155',
                            'status', 'active', 'monthly_fee', 245000,
                            'sibling_of_child_id', '8dd99bb9-3786-4800-9c04-c541ca83486d',
                            'actor_id', '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21');

  -- a) Cotizó 5 % (12.250) pero con la familia de Bella es la 4.ª → 10 %.
  pay := jsonb_build_array(jsonb_build_object('child_id', v_child, 'amount', 232750, 'list_amount', 245000,
           'sibling_discount_applied', 12250, 'concept', 'Mensualidad QA', 'due_date', '2026-12-05',
           'period_year', 2026, 'period_month', 12, 'payment_category', 'mensualidad'));
  begin
    perform public.create_enrollment_with_payments(s, enr, pay);
    raise exception 'FALLO: aceptó un descuento desactualizado';
  exception when raise_exception then
    if sqlerrm not like 'hermanos_desactualizado%' then raise; end if;
    raise notice 'OK: %', sqlerrm;
  end;
  if exists (select 1 from public.enrollments where child_id = v_child)
     or exists (select 1 from public.school_sibling_links where child_id = v_child) then
    raise exception 'FALLO: quedó la inscripción o el vínculo tras el rechazo';
  end if;

  -- b) Valor correcto: 10 % de 245.000 = 24.500.
  pay := jsonb_build_array(jsonb_build_object('child_id', v_child, 'amount', 220500, 'list_amount', 245000,
           'sibling_discount_applied', 24500, 'concept', 'Mensualidad QA', 'due_date', '2026-12-05',
           'period_year', 2026, 'period_month', 12, 'payment_category', 'mensualidad'));
  r := public.create_enrollment_with_payments(s, enr, pay);
  select * into p from public.payments where id = (r->'payment_ids'->>0)::uuid;
  if p.amount <> 220500 or p.sibling_discount_applied <> 24500 then
    raise exception 'FALLO: cobro del alta % / %', p.amount, p.sibling_discount_applied;
  end if;
  if not exists (select 1 from public.school_sibling_links l1 join public.school_sibling_links l2
                   on l2.group_id = l1.group_id and l2.school_id = l1.school_id
                  where l1.child_id = v_child and l2.child_id = '8dd99bb9-3786-4800-9c04-c541ca83486d'
                    and l1.source = 'alta') then
    raise exception 'FALLO: no quedó el vínculo alta con Bella';
  end if;
  if (select parent_id from public.children where id = v_child) is not null then
    raise exception 'FALLO: se escribió parent_id';
  end if;
  if not exists (select 1 from public.payment_adjustments where payment_id = p.id and origin = 'hermanos' and pct = 10) then
    raise exception 'FALLO: falta ajuste hermanos 10 %%: %',
      (select jsonb_agg(to_jsonb(a)) from public.payment_adjustments a where a.payment_id = p.id);
  end if;
  raise notice 'OK: alta con hermano → 220500 (−24500, 4.ª, 10 %%), vínculo alta';

  -- c) BFF anterior: sin la llave no se valida ni se descuenta.
  pay := jsonb_build_array(jsonb_build_object('child_id', v_child, 'amount', 245000,
           'concept', 'Mensualidad QA ene', 'due_date', '2027-01-05',
           'period_year', 2027, 'period_month', 1, 'payment_category', 'mensualidad'));
  r := public.create_enrollment_with_payments(s, null, pay);
  select * into p from public.payments where id = (r->'payment_ids'->>0)::uuid;
  if p.amount <> 245000 or p.sibling_discount_applied is not null then
    raise exception 'FALLO: compatibilidad sin llave % / %', p.amount, p.sibling_discount_applied;
  end if;
  raise notice 'OK: sin la llave (BFF anterior) el cobro nace como antes';
end $$;
rollback;
