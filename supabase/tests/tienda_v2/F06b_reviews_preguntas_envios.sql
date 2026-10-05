-- M-F0-6 (tienda v2 F0) — reseñas, preguntas y envíos (T10, T11/I3).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F06b_reviews_preguntas_envios.sql
--
-- Casos del plan: R12 (vendedor UPDATE rating → no cambia; respond_review ok).
-- Más: create_review exige compra entregada (el service role se lo saltaba),
-- el autor edita el texto pero no el estado de moderación ni la respuesta,
-- answer_question no reescribe la pregunta, otro vendedor → NOT_OWNER,
-- shipments con WITH CHECK (no se cuelga un envío de una orden de otra tienda).

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_ok',    (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_pend',  (select user_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_pend', (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);

-- Orden ENTREGADA de padre.a con el balón (d…002) de vendedor.ok, y una pregunta.
insert into public.orders (id, user_id, total_amount, vendor_profile_id, status, provider_transaction_id)
values ('00000000-0000-4000-c000-0000000000d1', current_setting('qa.u_padre')::uuid, 50000,
        current_setting('qa.vp_ok')::uuid, 'delivered', 'tx-qa-d1');
insert into public.order_items (order_id, product_id, quantity, unit_price, vendor_profile_id)
values ('00000000-0000-4000-c000-0000000000d1', '00000000-0000-4000-d000-000000000002', 1, 50000,
        current_setting('qa.vp_ok')::uuid);
insert into public.product_questions (id, product_id, user_id, question)
values ('00000000-0000-4000-c000-0000000000d2', '00000000-0000-4000-d000-000000000002',
        current_setting('qa.u_padre')::uuid, '¿Sirve para cancha sintética?');

-- ── Comprador: create_review (padre.a sí; padre.b no compró) ─────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.create_review('00000000-0000-4000-d000-000000000002',
      jsonb_build_object('rating', 5, 'body', 'Excelente balon, muy buena calidad de costura'));
    raise exception 'FALLO: reseña sin compra entregada';
  exception when insufficient_privilege then
    if sqlerrm <> 'NOT_DELIVERED' then raise; end if;
    raise notice 'OK: create_review sin compra entregada → NOT_DELIVERED';
  end;
  begin
    insert into public.product_reviews (product_id, user_id, rating, body)
    values ('00000000-0000-4000-d000-000000000002', auth.uid(), 5, 'Excelente balon, muy buena calidad de costura');
    raise exception 'FALLO: INSERT directo de reseña sin compra';
  exception when insufficient_privilege then raise notice 'OK: INSERT directo sin compra → 42501 (policy viva)';
  end;
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  if not (public.can_review_product('00000000-0000-4000-d000-000000000002') ->> 'can')::boolean then
    raise exception 'FALLO: can_review_product niega a un comprador con entrega';
  end if;
  r := public.create_review('00000000-0000-4000-d000-000000000002',
    jsonb_build_object('rating', 4, 'title', 'Buen balón', 'body', 'Excelente balon, muy buena calidad de costura'));
  if (r->>'order_id')::uuid <> '00000000-0000-4000-c000-0000000000d1' or (r->>'rating')::int <> 4 then
    raise exception 'FALLO: reseña creada mal: %', r;
  end if;
  perform set_config('qa.review', r->>'id', true);
  raise notice 'OK: create_review con compra entregada (order_id ligado)';

  begin
    perform public.create_review('00000000-0000-4000-d000-000000000002',
      jsonb_build_object('rating', 1, 'body', 'Segunda reseña del mismo producto no permitida'));
    raise exception 'FALLO: segunda reseña';
  exception when unique_violation then raise notice 'OK: segunda reseña → ALREADY_REVIEWED';
  end;

  -- El autor edita el texto (24 h) pero no la moderación ni la respuesta
  update public.product_reviews set body = 'Muy buen balon, la costura aguanta bastante bien' where id = current_setting('qa.review')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLO: el autor no pudo editar su reseña'; end if;
  begin
    update public.product_reviews set status = 'published', vendor_response = 'yo mismo' where id = current_setting('qa.review')::uuid;
    raise exception 'FALLO: el autor reescribio estado/respuesta';
  exception when insufficient_privilege then raise notice 'OK: autor edita body; status/vendor_response → 42501';
  end;
end $$;

-- ── Vendedor: R12 ────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  -- rating es columna editable (para el autor), pero al vendedor ya no lo alcanza
  -- ninguna policy de UPDATE → 0 filas.
  update public.product_reviews set rating = 5 where id = current_setting('qa.review')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: R12 el vendedor reescribio el rating'; end if;
  begin
    update public.product_reviews set status = 'hidden' where id = current_setting('qa.review')::uuid;
    raise exception 'FALLO: el vendedor cambio el estado de moderación';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: R12 vendedor UPDATE rating → 0 filas; status → 42501';
  begin
    update public.product_questions set question = 'pregunta reescrita por el vendedor' where id = '00000000-0000-4000-c000-0000000000d2';
    raise exception 'FALLO: el vendedor reescribio la pregunta';
  exception when insufficient_privilege then raise notice 'OK: vendedor UPDATE de la pregunta → 42501';
  end;

  r := public.respond_review(current_setting('qa.review')::uuid, 'Gracias por tu compra');
  if r->>'vendor_response' <> 'Gracias por tu compra' or (r->>'rating')::int <> 4
     or (r->>'vendor_responded_by')::uuid <> auth.uid() then
    raise exception 'FALLO: respond_review: %', r;
  end if;
  raise notice 'OK: respond_review escribe solo la respuesta (rating intacto)';

  r := public.answer_question('00000000-0000-4000-c000-0000000000d2', 'Sí, funciona en sintética');
  if r->>'vendor_answer' <> 'Sí, funciona en sintética' or r->>'question' <> '¿Sirve para cancha sintética?' then
    raise exception 'FALLO: answer_question: %', r;
  end if;
  raise notice 'OK: answer_question escribe solo la respuesta (pregunta intacta)';

  begin
    perform public.respond_review(current_setting('qa.review')::uuid, '   ');
    raise exception 'FALLO: respuesta vacía aceptada';
  exception when invalid_parameter_value then raise notice 'OK: respuesta vacía → INVALID_TEXT';
  end;
end $$;

-- Otro vendedor no responde
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_pend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.respond_review(current_setting('qa.review')::uuid, 'respuesta ajena');
    raise exception 'FALLO: otro vendedor respondio';
  exception when insufficient_privilege then raise notice 'OK: respond_review de otro vendedor → NOT_OWNER';
  end;
  begin
    perform public.answer_question('00000000-0000-4000-c000-0000000000d2', 'respuesta ajena');
    raise exception 'FALLO: otro vendedor contesto';
  exception when insufficient_privilege then raise notice 'OK: answer_question de otro vendedor → NOT_OWNER';
  end;

  -- Envíos: no puede colgar un envío suyo de una orden de otra tienda
  begin
    insert into public.shipments (order_id, vendor_profile_id, carrier)
    values ('00000000-0000-4000-c000-0000000000d1', current_setting('qa.vp_pend')::uuid, 'QA');
    raise exception 'FALLO: envío sobre orden ajena';
  exception when insufficient_privilege then raise notice 'OK: shipments WITH CHECK: orden de otra tienda → 42501';
  end;
  begin
    insert into public.shipments (order_id, vendor_profile_id, carrier)
    values ('00000000-0000-4000-c000-0000000000d1', current_setting('qa.vp_ok')::uuid, 'QA');
    raise exception 'FALLO: envío a nombre de otra tienda';
  exception when insufficient_privilege then raise notice 'OK: shipments con perfil ajeno → 42501';
  end;
end $$;

-- El dueño sí registra el envío de su orden; service role con p_actor responde
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  insert into public.shipments (order_id, vendor_profile_id, carrier, tracking_number)
  values ('00000000-0000-4000-c000-0000000000d1', current_setting('qa.vp_ok')::uuid, 'QA', 'TRK-1');
  raise notice 'OK: el dueño registra el envío de su orden';
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.respond_review(current_setting('qa.review')::uuid, 'Respuesta desde el BFF', current_setting('qa.u_ok')::uuid);
  if r->>'vendor_response' <> 'Respuesta desde el BFF' then raise exception 'FALLO: BFF respond_review: %', r; end if;
  if not (public.can_review_product('00000000-0000-4000-d000-000000000002', current_setting('qa.u_padre')::uuid) ->> 'reason') = 'already_reviewed' then
    raise exception 'FALLO: can_review_product con p_user_id';
  end if;
  raise notice 'OK: BFF (service role) con p_actor/p_user_id';
end $$;

-- anon
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    insert into public.product_questions (product_id, user_id, question)
    values ('00000000-0000-4000-d000-000000000002', current_setting('qa.u_padre')::uuid, 'pregunta anonima');
    raise exception 'FALLO: anon pregunta';
  exception when insufficient_privilege then raise notice 'OK: anon INSERT product_questions → 42501';
  end;
end $$;

rollback;
