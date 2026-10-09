-- =============================================================================
-- PROPUESTA (NO EJECUTADA) — Habilitar la tienda de GYM RM en producción
-- Fecha: 2026-10-08 · Revisar y correr a mano, bloque por bloque, por una vía
-- que deje rastro. NADA de esto se ha corrido en la viva.
--
-- GYM RM: school 2137182d-a695-4695-8e5a-61151fc59196
--         owner 3a699ea7-099a-4c5f-b3ee-640421b01b9b (Robinson Mendoza)
--         vendor_profile 259bc441-b849-4523-8235-59c07497faa0 (vendor_type school,
--         school_id ya puesto, slug 'robinson-mendoza', verification 'pending',
--         can_sell_products=true, sin store_payment_settings, sin productos)
-- Estado leído de la viva (solo lectura) el 2026-10-08:
--   platform_config.store_enabled = {"enabled": false}   ← SIN clave allowlist
--   store_pilot_allowlist() = NULL ; store_enabled() = false
--   has_entitlement(GYM RM,'store') = false ; school_is_operational = true
--   llaves: nequi, daviplata, breb (todas generales, sin only_for) ; 1 sede ; 0 pasarelas
--
-- ███████████████████████████████████████████████████████████████████████████
-- ██  OJO: allowlist NULL = TODAS LAS TIENDAS.                               ██
-- ██  store_pilot_allowlist() devuelve NULL cuando la clave no existe o es   ██
-- ██  null, y store_seller_allowed lo trata como "sin restricción". Si se    ██
-- ██  pone enabled=true SIN allowlist, vende CUALQUIER tienda que cumpla el  ██
-- ██  resto: hoy, por ejemplo, «Tienda Club Campestre Demo» (addon store,    ██
-- ██  verificada, 3 productos). Prender el flag y fijar la allowlist van en  ██
-- ██  la MISMA sentencia (bloque 3).                                        ██
-- ███████████████████████████████████████████████████████████████████████████
--
-- Además: store_enabled es un corte GLOBAL de la UI (useStoreEnabled/StoreGate).
-- Al prenderlo, las pantallas de tienda (vitrina, carrito, «Tu tienda» en el
-- menú de las escuelas con el adicional) se ven para todos; la allowlist solo
-- decide quién VENDE (las demás tiendas muestran "no disponible").
-- =============================================================================

-- ── 0. Prerrequisito: migración 20261008163336 aplicada (CLI / apply_migration) ──
select to_regclass('public.store_slug_aliases') is not null              as aliases_ok,
       to_regprocedure('public.my_school_store(uuid)') is not null        as my_school_store_ok,
       to_regprocedure('public.store_admin_settings(uuid,uuid)') is not null as admin_settings_ok;
-- Tras aplicarla, el backfill ya debió dejar (verificar):
select vp.slug, vp.display_name,
       (select array_agg(slug) from public.store_slug_aliases a where a.vendor_profile_id = vp.id) as aliases,
       (select row_to_json(s) from public.store_payment_settings s where s.vendor_profile_id = vp.id) as cobros
  from public.vendor_profiles vp where vp.id = '259bc441-b849-4523-8235-59c07497faa0';
-- esperado: slug 'gym-rm', display_name 'GYM RM', aliases {robinson-mendoza},
--           cobros: accept_transfer=t, accept_cash_pickup=t, allow_shipping=f, transfer_account_ids=null

-- ── 1. Adicional Tienda para GYM RM ──────────────────────────────────────────
-- DECISIÓN COMERCIAL pendiente: monthly_price_cents (catálogo: $49.000/mes =
-- 4900000 centavos; 0 si va de cortesía en el piloto). Ajustar antes de correr.
begin;
insert into public.school_addons (school_id, addon_key, enabled, monthly_price_cents, metadata)
values ('2137182d-a695-4695-8e5a-61151fc59196', 'store', true, 0,
        jsonb_build_object('via', 'piloto_tienda', 'set_at', now(), 'nota', 'GYM RM primer cliente tienda v2'))
on conflict (school_id, addon_key) do update
   set enabled = true, disabled_at = null, updated_at = now(),
       metadata = public.school_addons.metadata || excluded.metadata;
select public.has_entitlement('2137182d-a695-4695-8e5a-61151fc59196', 'store');   -- debe dar true
commit;

-- ── 2. Verificación del perfil escolar (lo mismo que hace enable_school_store) ──
-- Opción A (preferida): que el dueño o un admin de GYM RM pulse «Activar tienda»
-- en «Tu tienda → Cobros y entrega» (enable_school_store: verified + slug +
-- medios por defecto, idempotente). Opción B, a mano (sin JWT el guard deja pasar):
begin;
update public.vendor_profiles
   set verification_status = 'verified', is_active = true,
       capabilities = jsonb_set(coalesce(capabilities, '{}'::jsonb), '{can_sell_products}', 'true'::jsonb, true),
       updated_at = now()
 where id = '259bc441-b849-4523-8235-59c07497faa0'
   and school_id = '2137182d-a695-4695-8e5a-61151fc59196';
select public._store_sync_school_slug('259bc441-b849-4523-8235-59c07497faa0');   -- 'gym-rm' (idempotente)
insert into public.store_payment_settings (vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer,
       accept_cash_pickup, transfer_instructions, transfer_hold_hours, cash_hold_hours, transfer_account_ids,
       allow_shipping, pickup_branch_ids)
values ('259bc441-b849-4523-8235-59c07497faa0', false, false, true, true,
        'Escribe la referencia del pedido en la descripción de la transferencia.', 48, 48, null, false, null)
on conflict (vendor_profile_id) do nothing;
commit;

-- ── 3. Prender la tienda SOLO para GYM RM (flag + allowlist en UNA sentencia) ──
begin;
update public.platform_config
   set value = jsonb_build_object('enabled', true,
                                  'allowlist', jsonb_build_array('259bc441-b849-4523-8235-59c07497faa0'))
 where key = 'store_enabled';
select public.store_enabled() as flag, public.store_pilot_allowlist() as allowlist;
-- Nadie más vende (debe devolver SOLO la de GYM RM):
select id, slug from public.vendor_profiles where public.store_seller_allowed(id);
commit;

-- ── 4. Comprobaciones finales ────────────────────────────────────────────────
select public.store_seller_allowed('259bc441-b849-4523-8235-59c07497faa0');      -- true
select public.store_payment_methods('259bc441-b849-4523-8235-59c07497faa0');     -- transfer + cash_pickup, fulfillment.shipping=false, 1 sede
select jsonb_array_length(public._store_transfer_accounts('259bc441-b849-4523-8235-59c07497faa0')); -- 3 (nequi, daviplata, breb)
-- Enlace para compartir: https://<app>/tienda/gym-rm  (/tienda/robinson-mendoza sigue abriendo por alias)
-- Pendiente de la escuela (no de SportMaps): cargar productos y revisar en
-- «Tu tienda → Cobros y entrega» qué cuentas mostrar (las tres llaves hoy son
-- generales; si alguna es personal o solo de inscripciones, marcarla «Solo para
-- inscripciones» en Pagos → Configuración y deja de aparecer en la tienda).
-- Wompi/MP: no tiene pasarela conectada → solo transferencia y efectivo.

-- ── Reversa ──────────────────────────────────────────────────────────────────
-- update public.platform_config set value = jsonb_set(value, '{enabled}', 'false'::jsonb) where key = 'store_enabled';
--   (deja la allowlist puesta: al volver a prender no se abre para todos)
-- update public.school_addons set enabled = false, disabled_at = now()
--  where school_id = '2137182d-a695-4695-8e5a-61151fc59196' and addon_key = 'store';
