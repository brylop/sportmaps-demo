-- Datos VEROSÍMILES para las capturas del manual de la tienda. SOLO GEMELO LOCAL.
--
-- Lo corre capture.mjs (docker exec … psql) DESPUÉS de frontend/e2e/tienda/gemelo-tienda.sql,
-- que prende la tienda en el gemelo y deja stock/reservas en su valor.
--
-- Cambia los nombres visibles del escenario sintético (QA Academia Andes, Padre QA…)
-- por los de un club de voleibol ficticio, para que las capturas le sirvan a cualquier
-- escuela de voleibol. Antes de tocar nada guarda los valores originales en
-- qa_twin.manual_tienda_bak (solo la primera vez): restaurar-gemelo.sql los devuelve,
-- y así los specs de frontend/e2e/tienda/ siguen encontrando "QA Camiseta…" etc.
--
-- NUNCA correr contra la base viva: los UUID son los del seed del gemelo.
begin;
select set_config('sportmaps.trusted_rpc', 'on', true);

-- 0. Respaldo de lo que se va a renombrar (idempotente: solo si no existe).
create table if not exists qa_twin.manual_tienda_bak (tabla text, id uuid, fila jsonb, primary key (tabla, id));
insert into qa_twin.manual_tienda_bak
select 'profiles', id, jsonb_build_object('full_name', full_name, 'email', email, 'phone', phone)
  from public.profiles where id in ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002',
                                    '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005')
on conflict do nothing;
insert into qa_twin.manual_tienda_bak
select 'schools', id, jsonb_build_object('name', name, 'logo_url', logo_url, 'city', city)
  from public.schools where id = '00000000-0000-4000-b000-000000000001'
on conflict do nothing;
insert into qa_twin.manual_tienda_bak
select 'children', id, jsonb_build_object('full_name', full_name)
  from public.children where id in ('00000000-0000-4000-c000-000000000001','00000000-0000-4000-c000-000000000002')
on conflict do nothing;
insert into qa_twin.manual_tienda_bak
select 'vendor_profiles', id, jsonb_build_object('display_name', display_name, 'slug', slug, 'description', description,
                                                 'logo_url', logo_url, 'cover_image_url', cover_image_url, 'city', city)
  from public.vendor_profiles where id = '00000000-0000-4000-c000-0000000000a1'
on conflict do nothing;
insert into qa_twin.manual_tienda_bak
select 'products', id, jsonb_build_object('name', name, 'description', description, 'image_url', image_url,
                                          'attributes', attributes, 'price', price, 'category_id', category_id)
  from public.products where id in ('00000000-0000-4000-d000-000000000001','00000000-0000-4000-d000-0000000000a1',
                                    '00000000-0000-4000-d000-0000000000a2')
on conflict do nothing;
insert into qa_twin.manual_tienda_bak
select 'school_settings', school_id, jsonb_build_object('payment_accounts', payment_accounts, 'bank_name', bank_name,
          'bank_account_type', bank_account_type, 'bank_account_number', bank_account_number,
          'bank_titular_name', bank_titular_name, 'bank_titular_id', bank_titular_id, 'bank_account_holder', bank_account_holder)
  from public.school_settings where school_id = '00000000-0000-4000-b000-000000000001'
on conflict do nothing;

insert into qa_twin.manual_tienda_bak
select 'school_branches', id, jsonb_build_object('name', name, 'address', address)
  from public.school_branches where school_id = '00000000-0000-4000-b000-000000000001'
on conflict do nothing;

-- 1. Personas y escuela.
update public.profiles set full_name = 'Andrea Castaño', email = 'andrea.castano@ejemplo.com', phone = '+573005550101'
 where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set full_name = 'Julián Ortiz', email = 'julian.ortiz@ejemplo.com', phone = '+573005550102'
 where id = '00000000-0000-4000-a000-000000000002';
update public.profiles set full_name = 'Carolina Restrepo', email = 'carolina.restrepo@ejemplo.com', phone = '+573005550142'
 where id = '00000000-0000-4000-a000-000000000004';
update public.profiles set full_name = 'Mauricio Peña', email = 'mauricio.pena@ejemplo.com', phone = '+573005550177'
 where id = '00000000-0000-4000-a000-000000000005';
update public.children set full_name = 'Sofía Restrepo' where id = '00000000-0000-4000-c000-000000000001';
update public.children set full_name = 'Tomás Peña'     where id = '00000000-0000-4000-c000-000000000002';
update public.schools set name = 'Club Voleibol Cóndores', city = 'Bogotá',
       logo_url = 'http://127.0.0.1:54321/storage/v1/object/public/product-images/manual-tienda/escudo.png'
 where id = '00000000-0000-4000-b000-000000000001';

update public.school_branches set name = 'Sede Coliseo El Salitre', address = 'Cl. 63 # 68-45, Bogotá'
 where school_id = '00000000-0000-4000-b000-000000000001' and is_main;

-- 2. Tienda.
update public.vendor_profiles
   set display_name = 'Tienda Club Voleibol Cóndores', slug = 'club-voleibol-condores', city = 'Bogotá',
       description = 'Uniformes y accesorios oficiales del club. Retira en la sede o paga por transferencia.',
       logo_url = 'http://127.0.0.1:54321/storage/v1/object/public/product-images/manual-tienda/escudo.png'
 where id = '00000000-0000-4000-c000-0000000000a1';

-- 3. Cuentas de transferencia (ficticias) de la escuela.
update public.school_settings
   set bank_name = 'Bancolombia', bank_account_type = 'ahorros', bank_account_number = '236-458712-09',
       bank_titular_name = 'Club Voleibol Cóndores', bank_titular_id = '901555123-4', bank_account_holder = null,
       payment_accounts = '[{"type":"nequi","label":"Nequi del club","value":"3005550199","active":true}]'::jsonb
 where school_id = '00000000-0000-4000-b000-000000000001';

-- 4. Catálogo con nombres de voleibol.
update public.products p
   set name = x.nombre, description = x.descr, price = x.precio,
       image_url = 'http://127.0.0.1:54321/storage/v1/object/public/product-images/manual-tienda/' || x.img,
       attributes = coalesce(p.attributes, '{}'::jsonb) || jsonb_build_object('images',
                    jsonb_build_array('http://127.0.0.1:54321/storage/v1/object/public/product-images/manual-tienda/' || x.img))
  from (values
    ('00000000-0000-4000-d000-000000000001'::uuid, 'Camiseta de entrenamiento', 65000, 'camiseta.png',
     'Camiseta oficial de entrenamiento del club. Tela fría de secado rápido, escudo al frente y número opcional en la espalda.'),
    ('00000000-0000-4000-d000-0000000000a1'::uuid, 'Rodilleras de voleibol (par)', 58000, 'rodilleras.png',
     'Par de rodilleras acolchadas para entrenamiento y partido. Talla única ajustable.'),
    ('00000000-0000-4000-d000-0000000000a2'::uuid, 'Termo del club 750 ml', 38000, 'termo.png',
     'Termo de acero con el escudo del club. Mantiene el agua fría durante todo el entrenamiento.')
  ) as x(id, nombre, precio, img, descr)
 where p.id = x.id;

-- 5. Pedidos viejos de corridas anteriores: nombres de familias verosímiles
--    (solo el texto que ve la escuela; no cambia montos ni estados).
with o as (
  select id, row_number() over (order by created_at) as n
    from public.orders where vendor_profile_id = '00000000-0000-4000-c000-0000000000a1'
     and coalesce(customer_name, buyer_snapshot->>'name') in ('Padre QA Miembro', 'Carolina Restrepo')
), nombres as (
  select * from (values (0,'Laura Gómez'),(1,'Diego Martínez'),(2,'Paola Rincón'),(3,'Felipe Cárdenas'),
                        (4,'Natalia Suárez'),(5,'Andrés Vargas'),(6,'Mónica Herrera'),(7,'Camilo Rojas')) v(k, nombre)
)
update public.orders t
   set customer_name = nm.nombre,
       buyer_snapshot = coalesce(t.buyer_snapshot, '{}'::jsonb) || jsonb_build_object('name', nm.nombre)
  from o join nombres nm on nm.k = (o.n % 8)
 where t.id = o.id;

commit;

select 'manual-tienda-ok', (select display_name from public.vendor_profiles where id = '00000000-0000-4000-c000-0000000000a1');
