-- Devuelve el gemelo local a los nombres del seed (QA Academia Andes, Padre QA…)
-- después de las capturas del manual. Lee qa_twin.manual_tienda_bak, que dejó
-- gemelo-manual.sql. SOLO GEMELO LOCAL. Los pedidos y el "Uniforme de juego"
-- que crearon las capturas quedan (son datos sintéticos del gemelo); un
-- `npm run qa:twin:reset` los borra si hace falta.
begin;
select set_config('sportmaps.trusted_rpc', 'on', true);

update public.profiles t set full_name = b.fila->>'full_name', email = b.fila->>'email', phone = b.fila->>'phone'
  from qa_twin.manual_tienda_bak b where b.tabla = 'profiles' and b.id = t.id;
update public.schools t set name = b.fila->>'name', logo_url = b.fila->>'logo_url', city = b.fila->>'city'
  from qa_twin.manual_tienda_bak b where b.tabla = 'schools' and b.id = t.id;
update public.school_branches t set name = b.fila->>'name', address = b.fila->>'address'
  from qa_twin.manual_tienda_bak b where b.tabla = 'school_branches' and b.id = t.id;
update public.children t set full_name = b.fila->>'full_name'
  from qa_twin.manual_tienda_bak b where b.tabla = 'children' and b.id = t.id;
update public.vendor_profiles t
   set display_name = b.fila->>'display_name', slug = b.fila->>'slug', description = b.fila->>'description',
       logo_url = b.fila->>'logo_url', cover_image_url = b.fila->>'cover_image_url', city = b.fila->>'city'
  from qa_twin.manual_tienda_bak b where b.tabla = 'vendor_profiles' and b.id = t.id;
update public.products t
   set name = b.fila->>'name', description = b.fila->>'description', image_url = b.fila->>'image_url',
       attributes = b.fila->'attributes', price = (b.fila->>'price')::numeric
  from qa_twin.manual_tienda_bak b where b.tabla = 'products' and b.id = t.id;
update public.school_settings t set payment_accounts = b.fila->'payment_accounts', bank_name = b.fila->>'bank_name',
       bank_account_type = b.fila->>'bank_account_type', bank_account_number = b.fila->>'bank_account_number',
       bank_titular_name = b.fila->>'bank_titular_name', bank_titular_id = b.fila->>'bank_titular_id',
       bank_account_holder = b.fila->>'bank_account_holder'
  from qa_twin.manual_tienda_bak b where b.tabla = 'school_settings' and b.id = t.school_id;
-- El uniforme creado por el asistente en la captura: se archiva para que no
-- aparezca en la vitrina de los specs.
update public.products set active = false, status = 'archived'
 where vendor_profile_id = '00000000-0000-4000-c000-0000000000a1' and name = 'Uniforme de juego';

drop table qa_twin.manual_tienda_bak;
commit;
select 'gemelo-restaurado';
