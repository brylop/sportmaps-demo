-- F2 hermanos · T07: un niño con dos inscripciones activas cuenta UNA vez en
-- la familia, con su inscripción más antigua. Bella con una 2.ª inscripción
-- nueva sigue siendo la 3.ª (no empuja a nadie); si la 2.ª fuera más antigua
-- que la de Mariapaz, Bella pasaría a ser la 1.ª.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  q jsonb; r jsonb; n int;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  insert into public.enrollments (school_id, child_id, team_id, offering_plan_id, status, start_date, monthly_fee, created_at)
  select school_id, child_id, null, '66783926-c6dc-4482-9417-f9bf930f5155', 'active', current_date, 50000, now()
    from public.enrollments where id = 'bc70f094-ca4d-4b6b-a951-7ed6141aa4ab';

  q := public.sibling_discount_quote(s, 'e4a3c483-0aba-4322-98b5-d97ba790fc22', '768d7bcd-570e-4728-b6f5-388ade301e92');
  -- Zoe señalada como hermana de Mariapaz: familia activa = 3 hermanas + Zoe → Zoe 4.ª.
  if (q->>'family_active')::int <> 4 or (q->>'rank')::int <> 4 or (q->>'pct')::numeric <> 10 then
    raise exception 'FALLO: quote con multi-inscripción %', q;
  end if;
  if public._sibling_rank(s, '8dd99bb9-3786-4800-9c04-c541ca83486d') <> 3
     or public._sibling_rank(s, '22515123-5f8b-4c19-bf7f-894ad9eac880') <> 2 then
    raise exception 'FALLO: la 2.ª inscripción de Bella cambió los rangos';
  end if;
  r := public.preview_open_month(s, 2026, 12);
  select count(*) into n from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Bella QA';
  if n <> 1 then raise exception 'FALLO: Bella aparece % veces en el preview', n; end if;
  raise notice 'OK: Bella con 2 inscripciones cuenta una vez (rango 3); quote de Zoe %', q;

  -- Si la 2.ª inscripción es la más antigua de la familia, Bella pasa a 1.ª.
  update public.enrollments set created_at = '2026-01-01'
   where child_id = '8dd99bb9-3786-4800-9c04-c541ca83486d' and monthly_fee = 50000 and status = 'active';
  if public._sibling_rank(s, '8dd99bb9-3786-4800-9c04-c541ca83486d') <> 1
     or public._sibling_rank(s, '768d7bcd-570e-4728-b6f5-388ade301e92') <> 2 then
    raise exception 'FALLO: con la inscripción más antigua Bella debía ser 1.ª';
  end if;
  raise notice 'OK: con min(created_at) de enero Bella es la 1.ª y Mariapaz la 2.ª';
end $$;
rollback;
