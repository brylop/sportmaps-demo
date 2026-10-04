-- C00 · Contabilidad v2 F0 — esquema, grants (R10) y policies (R11/R12).
-- Correr contra el gemelo:  npm run qa:sql -- supabase/tests/contabilidad_v2
-- Convención: todo en BEGIN … ROLLBACK; FALLA con RAISE EXCEPTION 'FALLO: …'.
--
-- R10: EXECUTE de cada RPC nueva para anon y PUBLIC = sin privilegio (trampa 3).
-- R11/R12: ninguna policy FOR ALL en tablas contables; nada legible por anon.

begin;

do $$
declare
  f   text;
  t   text;
  v_n int;
begin
  -- M0: el valor del enum existe; M1: el CHECK lo acepta.
  if not ('accountant' = any (enum_range(null::public.user_role)::text[])) then
    raise exception 'FALLO: user_role no tiene accountant';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'school_members_role_check'))
     not like '%accountant%' then
    raise exception 'FALLO: school_members_role_check no acepta accountant';
  end if;
  raise notice 'OK: accountant en el enum y en el CHECK';

  -- R10: funciones nuevas o re-creadas — ni anon ni PUBLIC ejecutan.
  foreach f in array array[
    'public._finance_actor_role(text,uuid)',
    'public.finance_permission(text,uuid,text)',
    'public.finance_read_school_ids()',
    'public.school_has_addon(uuid,text)',
    'public.can_manage_finances(text,uuid)',
    'public.finance_income_amount(text,numeric,numeric)',
    'public.finance_income_excess(text,numeric,numeric)',
    'public.finance_income_lines(text,uuid,date,date,uuid,boolean)',
    'public.finance_income_summary(text,uuid,date,date,uuid,text)',
    'public.school_payment_kpis(uuid,uuid)',
    'public.get_school_dashboard_stats(uuid,uuid)',
    'public.finance_ledger_page(text,uuid,date,date,uuid,text,date,uuid,integer,boolean)',
    'public.finance_ledger_totals(text,uuid,date,date,uuid)',
    'public.finance_pnl_monthly(text,uuid,integer,uuid)',
    'public.pay_supplier_bill(uuid,numeric,date,pay_method,text)',
    'public.run_payroll(text,uuid,integer,integer)',
    'public.post_payroll_run(uuid,date)',
    'public.audit_finance_row()',
    'public.guard_payment_invoiced()',
    'public.guard_invoice_requires_paid()',
    'public.admin_unpay_invoiced_payment(uuid,text,text)',
    'public.accounting_emit_event(text,uuid,text,text,uuid,jsonb,text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'FALLO: anon tiene EXECUTE sobre %', f;
    end if;
    if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception 'FALLO: PUBLIC tiene EXECUTE sobre %', f;
    end if;
    -- toda función con search_path fijo (I4)
    if not exists (select 1 from pg_proc p where p.oid = f::regprocedure
                    and array_to_string(p.proconfig, ',') like 'search_path=%') then
      raise exception 'FALLO: % sin search_path fijo', f;
    end if;
  end loop;
  raise notice 'OK: % funciones sin EXECUTE para anon/PUBLIC y con search_path', 22;

  -- Las que solo llaman funciones DEFINER / triggers: tampoco authenticated.
  foreach f in array array[
    'public._finance_actor_role(text,uuid)', 'public.audit_finance_row()',
    'public.guard_payment_invoiced()', 'public.guard_invoice_requires_paid()',
    'public.accounting_emit_event(text,uuid,text,text,uuid,jsonb,text)'
  ] loop
    if has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALLO: authenticated tiene EXECUTE sobre %', f;
    end if;
  end loop;
  -- …y las que el front SÍ llama, authenticated las tiene (si no, 403 en todo).
  foreach f in array array[
    'public.finance_permission(text,uuid,text)', 'public.finance_read_school_ids()',
    'public.can_manage_finances(text,uuid)', 'public.finance_income_summary(text,uuid,date,date,uuid,text)',
    'public.finance_ledger_page(text,uuid,date,date,uuid,text,date,uuid,integer,boolean)',
    'public.finance_ledger_totals(text,uuid,date,date,uuid)', 'public.finance_pnl_monthly(text,uuid,integer,uuid)',
    'public.staff_school_ids()', 'public.user_staff_school_ids()',
    'public.run_payroll(text,uuid,integer,integer)', 'public.post_payroll_run(uuid,date)',
    'public.pay_supplier_bill(uuid,numeric,date,pay_method,text)'
  ] loop
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALLO: authenticated NO tiene EXECUTE sobre % (rompería policies/pantallas)', f;
    end if;
  end loop;
  raise notice 'OK: grants a authenticated correctos (helpers de RLS intactos)';

  -- Las 3 RPC de escritura pasaron a DEFINER; el DEFAULT de post_payroll_run se conserva.
  select count(*) into v_n from pg_proc
   where oid in ('public.pay_supplier_bill(uuid,numeric,date,pay_method,text)'::regprocedure,
                 'public.run_payroll(text,uuid,integer,integer)'::regprocedure,
                 'public.post_payroll_run(uuid,date)'::regprocedure)
     and prosecdef;
  if v_n <> 3 then raise exception 'FALLO: solo % de 3 RPC de escritura son DEFINER', v_n; end if;
  if (select pronargdefaults from pg_proc where oid = 'public.post_payroll_run(uuid,date)'::regprocedure) <> 1 then
    raise exception 'FALLO: post_payroll_run perdió el DEFAULT de p_paid_date';
  end if;
  if (select prosrc from pg_proc where oid = 'public.post_payroll_run(uuid,date)'::regprocedure)
     not like '%r.total_gross + r.total_employer%' then
    raise exception 'FALLO: post_payroll_run no es la versión 20261003201142 (egreso = bruto + patronal)';
  end if;
  raise notice 'OK: RPC de escritura DEFINER, cuerpos de 20261003201142 y DEFAULT conservado';

  -- Tablas contables: anon sin NINGÚN privilegio; authenticated sin escritura donde no toca.
  foreach t in array array['expenses','supplier_bills','suppliers','payroll_runs','payroll_items',
                           'payroll_employees','budgets','expense_attachments','expense_categories',
                           'payroll_config','audit_logs','cash_ledger','accounting_outbox'] loop
    if has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'FALLO: anon tiene privilegios sobre %', t;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.expenses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.expenses', 'DELETE')
     or has_table_privilege('authenticated', 'public.supplier_bills', 'UPDATE')
     or has_table_privilege('authenticated', 'public.supplier_bills', 'DELETE')
     or has_table_privilege('authenticated', 'public.payroll_runs', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.payroll_items', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.cash_ledger', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.accounting_outbox', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'FALLO: authenticated conserva escritura directa sobre dinero/auditoría/bandeja';
  end if;
  raise notice 'OK: anon sin privilegios; authenticated sin UPDATE/DELETE de dinero ni escritura de auditoría';

  -- R11/R12: ninguna FOR ALL en tablas contables; ninguna policy a public/anon.
  select count(*) into v_n from pg_policies
   where schemaname = 'public'
     and tablename in ('expenses','supplier_bills','suppliers','payroll_runs','payroll_items',
                       'payroll_employees','budgets','expense_attachments','expense_categories',
                       'payroll_config','accounting_outbox')
     and cmd = 'ALL';
  if v_n > 0 then raise exception 'FALLO: quedan % policies FOR ALL en tablas contables', v_n; end if;
  select count(*) into v_n from pg_policies
   where schemaname = 'public'
     and tablename in ('expenses','supplier_bills','suppliers','payroll_runs','payroll_items',
                       'payroll_employees','budgets','expense_attachments','expense_categories')
     and permissive = 'PERMISSIVE'
     and ('anon' = any (roles) or 'public' = any (roles));
  if v_n > 0 then raise exception 'FALLO: % policies permisivas contables alcanzan a anon/public', v_n; end if;
  if exists (select 1 from pg_policies where tablename = 'accounting_outbox') then
    raise exception 'FALLO: accounting_outbox tiene policies (debe quedar cerrada a PostgREST)';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'accounting_receipts_delete') then
    raise exception 'FALLO: sigue la policy accounting_receipts_delete (U8)';
  end if;
  raise notice 'OK: sin FOR ALL contables, sin policies a anon/public, bandeja cerrada, comprobantes no borrables';

  -- Auditoría y guards enganchados.
  select count(*) into v_n from pg_trigger where tgname like 'trg_audit_finance_%' and not tgisinternal;
  if v_n <> 8 then raise exception 'FALLO: % triggers de auditoría contable (esperado 8)', v_n; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_zy_guard_pago_facturado')
     or not exists (select 1 from pg_trigger where tgname = 'trg_guard_factura_pago_pagado') then
    raise exception 'FALLO: faltan los triggers del guard DIAN';
  end if;
  raise notice 'OK: 8 triggers de auditoría y 2 guards DIAN';

  -- cash_ledger sigue siendo invoker y con las 13 columnas.
  if not exists (select 1 from pg_class where oid = 'public.cash_ledger'::regclass
                  and reloptions @> array['security_invoker=true']) then
    raise exception 'FALLO: cash_ledger dejó de ser security_invoker';
  end if;
  select count(*) into v_n from information_schema.columns where table_schema = 'public' and table_name = 'cash_ledger';
  if v_n <> 13 then raise exception 'FALLO: cash_ledger tiene % columnas (esperado 13)', v_n; end if;
  raise notice 'OK: cash_ledger invoker con 13 columnas';
end $$;

rollback;
