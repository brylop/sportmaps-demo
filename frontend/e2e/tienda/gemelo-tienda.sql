-- Preparación de la tienda escolar en el GEMELO LOCAL (nunca en la viva).
-- La corre frontend/e2e/tienda/gemelo.ts con `docker exec … psql` contra el
-- contenedor supabase_db_sportmaps-qa-twin. Idempotente: se puede repetir.
--
--   · Prende la tienda (platform_config.store_enabled) con allowlist del piloto.
--   · Tienda escolar de QA Academia Andes (vendor_profile tipo 'school').
--   · Medios: transferencia (cuenta FICTICIA) y efectivo al retirar.
--   · Catálogo: camiseta school_only con tallas S5/M3/L0, gorra "último ítem"
--     (stock 1) y termo público (stock 10). Stock y reservas vuelven a su valor.
begin;
select set_config('sportmaps.trusted_rpc', 'on', true);

-- 1. Tienda prendida solo para el piloto (escuela A + vendedor externo verificado).
update public.platform_config
   set value = jsonb_build_object('enabled', true, 'allowlist',
               jsonb_build_array('00000000-0000-4000-c000-0000000000a1', '62979287-ab93-45fe-868d-d7c5bdde5088'))
 where key = 'store_enabled';

-- 2. Tienda escolar de A (dueño = owner.a).
insert into public.vendor_profiles (id, user_id, vendor_type, school_id, display_name, slug, description, city,
                                    verification_status, is_active, capabilities)
values ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'school',
        '00000000-0000-4000-b000-000000000001', 'Tienda QA Academia Andes', 'tienda-qa-andes',
        'Uniformes y accesorios de la academia (datos sinteticos del gemelo).', 'Bogota',
        'verified', true, '{"can_sell_products": true, "can_sell_services": false}'::jsonb)
on conflict (id) do update
   set is_active = true, verification_status = 'verified', slug = excluded.slug,
       capabilities = excluded.capabilities, school_id = excluded.school_id;

-- 3. Medios de pago y cuenta (ficticia) de la escuela.
insert into public.store_payment_settings (vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer,
                                           accept_cash_pickup, transfer_instructions, transfer_hold_hours, cash_hold_hours)
values ('00000000-0000-4000-c000-0000000000a1', false, false, true, true,
        'Escribe la referencia del pedido en la descripcion de la transferencia.', 48, 48)
on conflict (vendor_profile_id) do update
   set accept_wompi = false, accept_mercadopago = false, accept_transfer = true, accept_cash_pickup = true,
       transfer_instructions = excluded.transfer_instructions;

update public.school_settings
   set payment_accounts = '[{"type":"bank","label":"Bancolombia ahorros","value":"000-QA-ANDES-01","bank":"Bancolombia","account_type":"ahorros","holder":"QA Academia Andes","holder_id":"900000001-1","active":true}]'::jsonb
 where school_id = '00000000-0000-4000-b000-000000000001';

-- 4. Catálogo de la tienda escolar.
update public.products
   set vendor_profile_id = '00000000-0000-4000-c000-0000000000a1', reserved = 0
 where id = '00000000-0000-4000-d000-000000000001';

insert into public.products (id, vendor_id, vendor_profile_id, school_id, name, description, price, stock, image_url,
                             visibility, status, active, category_id, tax_rate, sku)
select x.id, '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000a1',
       '00000000-0000-4000-b000-000000000001', x.nombre,
       'Producto sintetico de la tienda escolar del gemelo local. No existe en la realidad.',
       x.precio, x.stock, 'https://placehold.co/800x800.png?text=QA', 'public', 'draft', true,
       (select id from public.product_categories order by sort_order nulls last, id limit 1), 0.19, x.sku
  from (values ('00000000-0000-4000-d000-0000000000a1'::uuid, 'QA Gorra Academia Andes', 45000, 1, 'QA-AND-GORRA'),
               ('00000000-0000-4000-d000-0000000000a2'::uuid, 'QA Termo Academia Andes', 38000, 10, 'QA-AND-TERMO')) as x(id, nombre, precio, stock, sku)
on conflict (id) do nothing;
update public.products set status = 'active'
 where id in ('00000000-0000-4000-d000-0000000000a1', '00000000-0000-4000-d000-0000000000a2') and status = 'draft';

-- 5. Reset de stock y reservas (cada corrida arranca igual).
update public.stock_holds set status = 'released', closed_at = now()
 where status = 'active'
   and product_id in ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-d000-0000000000a1',
                      '00000000-0000-4000-d000-0000000000a2');
update public.products set stock = 1,  reserved = 0 where id = '00000000-0000-4000-d000-0000000000a1';
update public.products set stock = 10, reserved = 0 where id = '00000000-0000-4000-d000-0000000000a2';
update public.product_variants set reserved = 0,
       stock = case id when '00000000-0000-4000-e000-000000000001' then 5
                       when '00000000-0000-4000-e000-000000000002' then 3
                       else 0 end
 where product_id = '00000000-0000-4000-d000-000000000001';

commit;

select 'tienda-gemelo-ok' as estado, public.store_enabled() as store_enabled,
       public.store_seller_allowed('00000000-0000-4000-c000-0000000000a1') as escuela_vende;
