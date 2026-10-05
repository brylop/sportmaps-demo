-- Tienda v2 F0 — checklist del PR (plan §7) para la parte de seguridad ya aplicada
-- (M-F0-1, M-F0-2, M-F0-3, M-F0-6). Pregunta al catálogo, no a los datos.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F00_checklist_permisos.sql
--
-- Queda fuera hasta que existan: stock_holds (M-F0-4), settlements (M-F0-5) y el
-- conteo de confirm_order_payment/split_order_payment/admin_generate_pending_payouts
-- (M-F0-9).

begin;

do $$
declare v text;
begin
  -- 1. Sin policies de escritura para el cliente en tablas de dinero/stock
  select string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ') into v
    from pg_policies
   where schemaname = 'public'
     and tablename in ('orders', 'order_items', 'refunds', 'inventory_logs', 'order_status_history')
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and permissive = 'PERMISSIVE'
     and roles && '{authenticated,anon,public}'::name[];
  if v is not null then raise exception 'FALLO: policies de escritura del cliente: %', v; end if;
  raise notice 'OK: §7.1 orders/order_items/refunds/inventory_logs/historial sin policies de escritura del cliente';

  -- 2. Sin grants de escritura a anon/authenticated
  select string_agg(table_name || ':' || grantee || ':' || privilege_type, ', ') into v
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('orders', 'order_items', 'refunds', 'inventory_logs', 'order_status_history')
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if v is not null then raise exception 'FALLO: grants de escritura: %', v; end if;
  raise notice 'OK: §7.2 sin INSERT/UPDATE/DELETE de anon/authenticated en tablas de dinero';

  -- 3. Nadie del cliente actualiza stock
  select string_agg(table_name || ':' || grantee, ', ') into v
    from information_schema.column_privileges
   where table_schema = 'public' and table_name in ('products', 'product_variants')
     and column_name = 'stock' and privilege_type = 'UPDATE'
     and grantee in ('anon', 'authenticated');
  if v is not null then raise exception 'FALLO: UPDATE de stock para %', v; end if;
  raise notice 'OK: §7.2 sin UPDATE de stock para anon/authenticated';

  -- 4. anon no escribe catálogo
  select string_agg(table_name || ':' || privilege_type, ', ') into v
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and table_name in ('products', 'product_variants', 'product_images', 'product_reviews',
                        'product_questions', 'shipments')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if v is not null then raise exception 'FALLO: anon escribe %', v; end if;
  raise notice 'OK: anon sin escritura en catálogo, reseñas, preguntas y envíos';

  -- 5. bank_data fuera de anon y authenticated
  if has_column_privilege('anon', 'public.vendor_profiles', 'bank_data', 'SELECT')
     or has_column_privilege('authenticated', 'public.vendor_profiles', 'bank_data', 'SELECT') then
    raise exception 'FALLO: bank_data legible por anon o authenticated';
  end if;
  raise notice 'OK: vendor_profiles.bank_data sin SELECT para anon/authenticated';

  -- 6. Funciones nuevas/reescritas: DEFINER con search_path fijo, sin EXECUTE de PUBLIC/anon indebido
  select string_agg(p.oid::regprocedure::text, ', ') into v
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('can_manage_store', 'can_manage_store_as', 'store_pilot_allowlist',
                       'store_seller_allowed', 'enable_school_store', '_store_actor',
                       'store_can_manage_product', 'fn_products_fill_vendor', 'inventory_adjust',
                       'validate_product_quality_row', 'validate_product_quality',
                       'enforce_product_publish_gate', 'validate_product_vendor_capability',
                       'fn_guard_orders_client_write', 'fn_orders_paid_requires_proof',
                       'fn_orders_status_history', 'order_visible_to_me', 'disable_vendor_profile',
                       'confirm_order_payment', 'request_order_refund', 'approve_order_refund',
                       'request_refund', 'approve_refund', 'complete_refund', 'can_review_product',
                       'create_review', 'respond_review', 'answer_question', 'order_belongs_to_store',
                       'fn_guard_vendor_profiles')
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                      where c = 'search_path=pg_catalog, public, pg_temp');
  if v is not null then raise exception 'FALLO: funciones sin search_path estándar: %', v; end if;
  raise notice 'OK: todas las funciones de F0 con SET search_path = pg_catalog, public, pg_temp';

  select string_agg(p.oid::regprocedure::text, ', ') into v
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('can_manage_store_as', 'enable_school_store', 'inventory_adjust',
                       'request_order_refund', 'approve_order_refund', 'complete_refund',
                       'confirm_order_payment', 'create_review', 'respond_review', 'answer_question',
                       '_store_actor', 'fn_products_fill_vendor', 'validate_product_quality_row')
     and (has_function_privilege('anon', p.oid, 'EXECUTE')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  if v is not null then raise exception 'FALLO: EXECUTE para anon/PUBLIC en %', v; end if;
  raise notice 'OK: RPC de escritura sin EXECUTE para anon ni PUBLIC';

  select string_agg(p.oid::regprocedure::text, ', ') into v
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('can_manage_store_as', 'request_order_refund', 'approve_order_refund',
                       'complete_refund', 'confirm_order_payment', '_store_actor')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v is not null then raise exception 'FALLO: authenticated ejecuta RPC de solo service_role: %', v; end if;
  raise notice 'OK: RPC de solo service_role sin EXECUTE para authenticated';

  -- 7. Invariantes: sin CRITICAS ni I3 en tablas de tienda
  select string_agg(invariante || ' ' || objeto, ', ') into v
    from public.invariantes_seguridad()
   where gravedad = 'CRITICA'
      or (invariante like 'I3%' and split_part(objeto, '.', 1) in
          ('products', 'product_variants', 'product_images', 'orders', 'order_items', 'refunds',
           'shipments', 'inventory_logs', 'product_reviews', 'product_questions', 'vendor_profiles',
           'order_status_history'));
  if v is not null then raise exception 'FALLO: invariantes: %', v; end if;
  raise notice 'OK: invariantes_seguridad() sin CRITICAS ni I3 en tablas de tienda';
end $$;

rollback;
