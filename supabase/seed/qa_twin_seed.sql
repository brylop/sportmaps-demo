-- supabase/seed/qa_twin_seed.sql
--
-- Semilla SINTETICA del gemelo local (docs/qa-gemelo-local.md). Cubre las
-- pruebas de tienda v2 (docs/specs/tienda-v2-estilo-mercadolibre.md §8) y de
-- contabilidad v2 (docs/specs/contabilidad-v2.md §8).
--
-- SOLO para el gemelo local. `npm run qa:twin:up|reset|seed` la carga con psql
-- dentro del contenedor supabase_db_sportmaps-qa-twin. Nunca correrla contra la
-- viva: la primera sentencia aborta si la base tiene datos reales.
--
-- Idempotente: IDs fijos + ON CONFLICT. Se puede re-correr con `npm run qa:twin:seed`.
--
-- Usuarios (todos con la misma contrasena):  QaGemelo2026!
--   owner.a@qa.sportmaps.test      owner de "QA Academia Andes" (escuela A, addons store + accounting)
--   admin.a@qa.sportmaps.test      school_admin de A
--   coach.a@qa.sportmaps.test      coach de A
--   padre.a@qa.sportmaps.test      padre MIEMBRO de A (hijo "Hijo QA Andes")
--   padre.b@qa.sportmaps.test      padre AJENO a A (hijo en la escuela B)
--   atleta.a@qa.sportmaps.test     atleta adulto miembro de A
--   owner.b@qa.sportmaps.test      owner de "QA Club Llanos" (escuela B, SIN addons)
--   vendedor.ok@qa.sportmaps.test  vendedor externo VERIFICADO (con bank_data ficticio)
--   vendedor.pend@qa.sportmaps.test vendedor externo SIN verificar
--   superadmin@qa.sportmaps.test   admin de plataforma
--
-- Mapa alias -> UUIDs para las pruebas: vista qa_twin.actores.

\set ON_ERROR_STOP on

-- ── Guarda: esto no es la viva ────────────────────────────────────────────────
do $$
begin
  if (select count(*) from auth.users where email not like '%@qa.sportmaps.test') > 0 then
    raise exception 'ABORTADO: auth.users tiene usuarios que no son de la semilla QA. ¿Es esta la base viva?';
  end if;
end $$;

begin;

-- ── 1. Usuarios de auth (el trigger on_auth_user_created crea profiles) ─────
create temp table _qa_users (n int, id uuid, email text, full_name text, meta_role text) on commit drop;
insert into _qa_users values
  ( 1, '00000000-0000-4000-a000-000000000001', 'owner.a@qa.sportmaps.test',      'Owner QA Andes',      'school'),
  ( 2, '00000000-0000-4000-a000-000000000002', 'admin.a@qa.sportmaps.test',      'Admin QA Andes',      'school_admin'),
  ( 3, '00000000-0000-4000-a000-000000000003', 'coach.a@qa.sportmaps.test',      'Coach QA Andes',      'coach'),
  ( 4, '00000000-0000-4000-a000-000000000004', 'padre.a@qa.sportmaps.test',      'Padre QA Miembro',    'parent'),
  ( 5, '00000000-0000-4000-a000-000000000005', 'padre.b@qa.sportmaps.test',      'Padre QA Ajeno',      'parent'),
  ( 6, '00000000-0000-4000-a000-000000000006', 'atleta.a@qa.sportmaps.test',     'Atleta QA Andes',     'athlete'),
  ( 7, '00000000-0000-4000-a000-000000000007', 'owner.b@qa.sportmaps.test',      'Owner QA Llanos',     'school'),
  ( 8, '00000000-0000-4000-a000-000000000008', 'vendedor.ok@qa.sportmaps.test',  'Vendedor QA Verificado', 'external_vendor'),
  ( 9, '00000000-0000-4000-a000-000000000009', 'vendedor.pend@qa.sportmaps.test','Vendedor QA Pendiente',  'external_vendor'),
  (10, '00000000-0000-4000-a000-000000000010', 'superadmin@qa.sportmaps.test',   'Superadmin QA',       'super_admin');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  is_sso_user, is_anonymous
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('QaGemelo2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name, 'role', u.meta_role),
       now(), now(), '', '', '', '', '', '', '', '', false, false
  from _qa_users u
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from _qa_users u
on conflict do nothing;

-- Perfiles: onboarding hecho para que el frontend no los mande al wizard.
update public.profiles p
   set onboarding_completed = true, onboarding_started = true, needs_role_selection = false,
       phone = '+57300000' || lpad(u.n::text, 4, '0')
  from _qa_users u where p.id = u.id;

insert into public.platform_admins (profile_id, is_active)
select '00000000-0000-4000-a000-000000000010', true
 where not exists (select 1 from public.platform_admins where profile_id = '00000000-0000-4000-a000-000000000010');

-- ── 2. Escuelas (triggers: sede principal, settings, owner en school_members,
--       suscripcion trial por defecto) ─────────────────────────────────────────
insert into public.schools (id, owner_id, name, city, email, phone, onboarding_status, onboarding_step, account_type, business_model, sports)
values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'QA Academia Andes', 'Bogotá',
   'escuela.a@qa.sportmaps.test', '+573000000101', 'completed', 5, 'real', 'both', array['futbol','voleibol']),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000007', 'QA Club Llanos', 'Villavicencio',
   'escuela.b@qa.sportmaps.test', '+573000000102', 'completed', 5, 'real', 'teams', array['futbol'])
on conflict (id) do nothing;

-- Suscripciones: A pro activa, B starter activa (ninguna bloqueada por trial).
update public.school_subscriptions
   set plan_code = 'profesional', tier = 'pro', status = 'active', trial_ends_at = null,
       current_period_start = date_trunc('month', now()), current_period_end = date_trunc('month', now()) + interval '1 month'
 where school_id = '00000000-0000-4000-b000-000000000001';
update public.school_subscriptions
   set plan_code = 'starter', tier = 'free', status = 'active', trial_ends_at = null
 where school_id = '00000000-0000-4000-b000-000000000002';

-- Addons: solo la escuela A tiene tienda y contabilidad.
insert into public.school_addons (school_id, addon_key, enabled, monthly_price_cents)
values ('00000000-0000-4000-b000-000000000001', 'store', true, 0),
       ('00000000-0000-4000-b000-000000000001', 'accounting', true, 0)
on conflict (school_id, addon_key) do update set enabled = true, disabled_at = null;

-- Miembros (el owner ya lo inserto el trigger).
insert into public.school_members (school_id, profile_id, role, status)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'school_admin', 'active'),
       ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000003', 'coach', 'active'),
       ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000006', 'athlete', 'active'),
       ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'parent', 'active'),
       ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000005', 'parent', 'active')
on conflict (profile_id, school_id) do nothing;

-- Hijos (menores sinteticos).
insert into public.children (id, parent_id, full_name, date_of_birth, school_id, monthly_fee, doc_type, doc_number)
values ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000004', 'Hijo QA Andes',  '2015-03-10',
        '00000000-0000-4000-b000-000000000001', 150000, 'TI', '9900000001'),
       ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-000000000005', 'Hijo QA Llanos', '2014-07-22',
        '00000000-0000-4000-b000-000000000002', 120000, 'TI', '9900000002')
on conflict (id) do nothing;

-- ── 3. Vendedores externos (el trigger trg_auto_vendor_profile ya creo el perfil) ─
update public.vendor_profiles
   set display_name = 'QA Deportes Verificado', slug = 'qa-deportes-verificado', city = 'Medellín',
       verification_status = 'verified', nit = '900000001-1',
       capabilities = '{"can_sell_products": true, "can_sell_services": false}'::jsonb,
       -- Ficticio: sirve para probar que anon NO lo lee (R3 de tienda v2).
       bank_data = '{"bank":"Banco QA","account_type":"ahorros","account_number":"000-QA-0001","holder":"QA Deportes SAS"}'::jsonb
 where user_id = '00000000-0000-4000-a000-000000000008';
update public.vendor_profiles
   set display_name = 'QA Tienda Pendiente', slug = 'qa-tienda-pendiente', city = 'Cali',
       verification_status = 'pending',
       capabilities = '{"can_sell_products": true, "can_sell_services": false}'::jsonb,
       bank_data = '{"bank":"Banco QA","account_number":"000-QA-0002"}'::jsonb
 where user_id = '00000000-0000-4000-a000-000000000009';

-- ── 4. Productos ────────────────────────────────────────────────────────────
-- Se insertan en 'draft' y luego se publican con UPDATE: el trigger
-- enforce_product_publish_gate (BEFORE INSERT) llama validate_product_quality(NEW.id)
-- cuando la fila aun no existe → 'not_found' → bloquea TODO insert directo en
-- 'active'. Hallazgo documentado en docs/qa-gemelo-local.md.
create temp table _qa_products (
  id uuid, nombre text, vendor uuid, vp_user uuid, school uuid, vis public.product_visibility,
  precio numeric, stock int, estado_final text, categoria_slug text
) on commit drop;
insert into _qa_products values
  ('00000000-0000-4000-d000-000000000001', 'QA Camiseta oficial Academia Andes', '00000000-0000-4000-a000-000000000001', null,
   '00000000-0000-4000-b000-000000000001', 'school_only', 65000, 8, 'active', null),       -- school_only, con variantes
  ('00000000-0000-4000-d000-000000000002', 'QA Balon de futbol numero 5', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   null, 'public', 89000, 20, 'active', null),                                            -- sin variantes
  ('00000000-0000-4000-d000-000000000003', 'QA Guayos de velocidad X', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   null, 'public', 210000, 6, 'active', null),                                            -- con variantes talla x color
  ('00000000-0000-4000-d000-000000000004', 'QA Termo deportivo 1 litro', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   null, 'public', 45000, 10, 'draft', null),                                             -- borrador
  ('00000000-0000-4000-d000-000000000005', 'QA Medias antideslizantes', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   null, 'public', 25000, 0, 'active', null),                                             -- agotado
  ('00000000-0000-4000-d000-000000000006', 'QA Rodillera de voleibol', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   null, 'public', 58000, 1, 'active', null),                                             -- ultimo item
  ('00000000-0000-4000-d000-000000000007', 'QA Cuerda de salto pro', '00000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000009',
   null, 'public', 30000, 15, 'active', null);                                            -- vendedor sin verificar → pending_review

insert into public.products (id, vendor_id, vendor_profile_id, school_id, name, description, price, stock, image_url,
                             visibility, status, active, category_id, tax_rate, sku)
select p.id, p.vendor, vp.id, p.school, p.nombre,
       'Producto sintetico de la semilla QA del gemelo local. No existe en la realidad.',
       p.precio, p.stock, 'https://placehold.co/800x800.png?text=QA',
       p.vis, 'draft', true,
       (select id from public.product_categories order by sort_order nulls last, id limit 1),
       0.19, 'QA-' || right(p.id::text, 3)
  from _qa_products p
  left join public.vendor_profiles vp on vp.user_id = p.vp_user
on conflict (id) do nothing;

update public.products pr set status = p.estado_final
  from _qa_products p
 where pr.id = p.id and p.estado_final <> 'draft' and pr.status = 'draft';

-- Variantes
insert into public.product_variants (id, product_id, sku, name, attributes, stock, sort_order) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', 'QA-CAM-S-AZ', 'S / Azul', '{"talla":"S","color":"azul"}', 5, 1),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000001', 'QA-CAM-M-AZ', 'M / Azul', '{"talla":"M","color":"azul"}', 3, 2),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000001', 'QA-CAM-L-AZ', 'L / Azul', '{"talla":"L","color":"azul"}', 0, 3),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-d000-000000000003', 'QA-GUA-38-NE', '38 / Negro', '{"talla":"38","color":"negro"}', 2, 1),
  ('00000000-0000-4000-e000-000000000005', '00000000-0000-4000-d000-000000000003', 'QA-GUA-40-NE', '40 / Negro', '{"talla":"40","color":"negro"}', 4, 2),
  ('00000000-0000-4000-e000-000000000006', '00000000-0000-4000-d000-000000000003', 'QA-GUA-40-BL', '40 / Blanco', '{"talla":"40","color":"blanco"}', 0, 3)
on conflict (id) do nothing;

-- ── 5. Cobros (escuela A, hijo del padre miembro) ───────────────────────────
insert into public.payments (id, school_id, parent_id, child_id, amount, amount_paid, concept, due_date, payment_date,
                             status, payment_method, payment_type, payment_category, period_year, period_month, reference)
values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004',
   '00000000-0000-4000-c000-000000000001', 150000, 150000, 'Mensualidad QA agosto 2026', '2026-08-05', '2026-08-04',
   'paid', 'transfer', 'one_time', 'mensualidad', 2026, 8, 'QA-PAY-001'),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004',
   '00000000-0000-4000-c000-000000000001', 150000, 50000, 'Mensualidad QA septiembre 2026 (abono)', '2026-09-05', '2026-09-06',
   'partial', 'cash', 'one_time', 'mensualidad', 2026, 9, 'QA-PAY-002'),
  ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004',
   '00000000-0000-4000-c000-000000000001', 150000, null, 'Mensualidad QA octubre 2026', '2026-10-05', null,
   'pending', null, 'one_time', 'mensualidad', 2026, 10, 'QA-PAY-003'),
  ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000005',
   '00000000-0000-4000-c000-000000000002', 120000, 120000, 'Mensualidad QA Llanos septiembre 2026', '2026-09-05', '2026-09-03',
   'paid', 'transfer', 'one_time', 'mensualidad', 2026, 9, 'QA-PAY-004')
on conflict (id) do nothing;

-- ── 6. Contabilidad de la escuela A: proveedor, factura, gastos, nomina ────
insert into public.suppliers (id, owner_type, owner_id, name, nit, contact_name, email, phone)
values ('00000000-0000-4000-9000-000000000001', 'school', '00000000-0000-4000-b000-000000000001',
        'QA Distribuidora Deportiva SAS', '900000099-9', 'Contacto QA', 'proveedor@qa.sportmaps.test', '+573000000199')
on conflict (id) do nothing;

insert into public.supplier_bills (id, owner_type, owner_id, supplier_id, category_id, invoice_no, amount, amount_paid,
                                   issue_date, due_date, status, created_by)
values ('00000000-0000-4000-9000-000000000011', 'school', '00000000-0000-4000-b000-000000000001',
        '00000000-0000-4000-9000-000000000001',
        (select id from public.expense_categories where name = 'Insumos deportivos' and school_id is null and owner_id is null limit 1),
        'QA-FV-0001', 400000, 0, '2026-09-10', '2026-10-10', 'open', '00000000-0000-4000-a000-000000000001')
on conflict (id) do nothing;

insert into public.expenses (id, owner_type, owner_id, school_id, category_id, kind, status, concept, amount,
                             expense_date, paid_date, payment_method, created_by)
values
  ('00000000-0000-4000-9000-000000000021', 'school', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000001',
   (select id from public.expense_categories where name = 'Arriendo de sede' and school_id is null and owner_id is null limit 1),
   'manual', 'paid', 'Arriendo QA septiembre 2026', 1200000, '2026-09-01', '2026-09-02', 'transfer', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-9000-000000000022', 'school', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000001',
   (select id from public.expense_categories where name = 'Mantenimiento' and school_id is null and owner_id is null limit 1),
   'manual', 'approved', 'Mantenimiento QA de cancha (sin pagar)', 300000, '2026-09-15', null, null, '00000000-0000-4000-a000-000000000001')
on conflict (id) do nothing;

insert into public.payroll_employees (id, owner_type, owner_id, full_name, document_id, contract_type, base_salary,
                                      transport_aid_eligible, eps, afp, arl_class, hire_date)
values ('00000000-0000-4000-9000-000000000031', 'school', '00000000-0000-4000-b000-000000000001',
        'Empleado QA Uno', '1000000001', 'indefinido', 1750905, true, 'EPS QA', 'AFP QA', 1, '2026-01-15')
on conflict (id) do nothing;

-- payroll_config 2026 con los valores de los decretos 1469/1470 de 2025 (los que
-- usan los casos dorados de contabilidad-v2 §8.4). OJO: la viva todavia tiene la
-- fila 2026 con valores 2025 (SMMLV 1.423.500); esto solo cambia el gemelo.
insert into public.payroll_config (year, smmlv, transport_aid, uvt, notes)
values (2026, 1750905, 249095, 52374, 'QA gemelo: decretos 1469/1470 de 2025')
on conflict (year) do update set smmlv = excluded.smmlv, transport_aid = excluded.transport_aid,
                                 uvt = excluded.uvt, notes = excluded.notes, updated_at = now();

-- ── 7. Mapa de actores para las pruebas ─────────────────────────────────────
create schema if not exists qa_twin;
create or replace view qa_twin.actores as
select split_part(u.email, '@', 1) as alias, u.email, u.id as user_id,
       (select sm.school_id from public.school_members sm where sm.profile_id = u.id order by sm.created_at limit 1) as school_id,
       (select vp.id from public.vendor_profiles vp where vp.user_id = u.id) as vendor_profile_id
  from auth.users u
 where u.email like '%@qa.sportmaps.test';

commit;

-- Resumen
select 'usuarios' as que, count(*) from auth.users where email like '%@qa.sportmaps.test'
union all select 'escuelas QA', count(*) from public.schools where id::text like '00000000-0000-4000-b000-%'
union all select 'productos QA', count(*) from public.products where id::text like '00000000-0000-4000-d000-%'
union all select 'variantes QA', count(*) from public.product_variants where id::text like '00000000-0000-4000-e000-%'
union all select 'cobros QA', count(*) from public.payments where id::text like '00000000-0000-4000-f000-%';
