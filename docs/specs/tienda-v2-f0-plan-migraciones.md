# Tienda v2 — Fase F0: plan detallado de migraciones

**Versión:** v0.1 (para aprobar, **no hay SQL escrito**) · **Fecha:** 2026-10-03 · **Rama:** `develop` → `feat/tienda-v2-f0-*`
**Spec padre:** [`tienda-v2-estilo-mercadolibre.md`](tienda-v2-estilo-mercadolibre.md) §6, §7, §10 · **Prerrequisito:** [`blindaje-dinero-pagos-tienda-nomina.md`](blindaje-dinero-pagos-tienda-nomina.md) M1–M3
**Método:** todo el §1 se le preguntó **a la base viva** hoy (solo `SELECT` sobre `pg_policies`, `pg_proc`, `information_schema`, `pg_constraint`, `pg_trigger`, `cron.job`). Ninguna escritura.

### Decisiones del usuario de hoy que cambian el spec padre

| # | Antes (spec v0.1) | Ahora (2026-10-03) | Efecto en F0 |
|---|---|---|---|
| U-1 | Piloto "una escuela" sin nombre | **Piloto: Monster´s Volley Club** (`eb3ebc77-…`) — addon `store` ON, **sin `vendor_profile`, sin pasarela, sin cuentas para transferencia** (`payment_accounts` vacío, `bank_*` nulos, `payment_mode='unset'`) | F0 necesita un camino para crearle la tienda (`enable_school_store`) y un gate de piloto **por vendedor**, no solo el flag global |
| U-2 | Solo Wompi (+ efectivo opcional) | **Transferencia + comprobante (aprueba el vendedor), efectivo al retirar (reserva con vencimiento), Wompi y Mercado Pago con las llaves del propio vendedor** | Estados `awaiting_approval`, RPCs de comprobante/efectivo, resolución de pasarela por vendedor **sin caer nunca a las llaves ENV** |
| U-3 | Cupones fuera de v2 (R5) | **Cupones por empresa en alcance** | F0 deja el contrato de `create_cart_order` y las columnas de descuento **listas**; el motor de cupones va en su propia fase (F3b, §5.4) |
| U-4 | Externos fuera del piloto | **El usuario quiere que los externos funcionen** | F0 modela `collected_by` en settlements y pasarela por vendedor externo; D-5 queda abierta con opciones y riesgo (§5.3) |

---

## 1. Estado vivo verificado hoy (2026-10-03)

### 1.1 Prerrequisitos del blindaje

| Pieza | Estado vivo | Nota |
|---|---|---|
| **M1** `vendor_profiles_columnas_publicas_anon` | **Aplicada** — `has_column_privilege('anon','vendor_profiles','bank_data','SELECT') = false` | Quedó registrada en `schema_migrations` como **`20261003193616`**, no como `20261002125955` (el nombre del archivo). Es la deriva de INF-7: el ledger y la base no comparten versión. Anotarlo en el ledger, no renombrar el archivo |
| **M2** `guard_payments_escritura_cliente` | **No aplicada** (`trg_zz_guard_payments_client` no existe) | No es de tienda; sigue su propio orden (frontend primero). No bloquea F0 |
| **M3** `tienda_apagada_y_guard_vendor_profiles` | **No aplicada**: no existe la fila `platform_config.store_enabled`, ni `store_enabled()`, ni ninguna policy `store_off_*`, ni `trg_guard_vendor_profiles` | **La tienda hoy NO está apagada en la base.** Es el paso 0 de F0 |
| Head del ledger | `20261003193624` (`whatsapp_atencion_solo_familias`, otra sesión) | Toda migración de F0 se crea con `npm run migrations:new` después de ese head |

### 1.2 Policies vivas (`pg_policies`) de las tablas que F0 toca

| Tabla | Policy | Cmd | Roles | Problema |
|---|---|---|---|---|
| `orders` | `orders_insert_buyer` | INSERT | authenticated | `WITH CHECK (user_id = auth.uid())` — cualquier total/estado (**T4**) |
| `orders` | `orders_update_buyer` | UPDATE | authenticated | `USING (user_id = auth.uid())`, **sin `WITH CHECK`**, todas las columnas (**T3**) |
| `orders` | `orders_select_buyer` / `orders_select_vendor` | SELECT | authenticated | vendor vía `_order_has_vendor_item()` = `products.vendor_id = auth.uid()` (legacy, solo el dueño-usuario; el admin de la escuela no ve) |
| `order_items` | `order_items_insert_buyer` | INSERT | authenticated | `_order_belongs_to_user(order_id)` — precio libre (**T4**) |
| `order_items` | `…_select_buyer` / `…_select_vendor` | SELECT | authenticated | idem `vendor_id` legacy |
| `products` | `products_insert_own` / `products_update_own` / `products_delete_own` | I/U/D | authenticated | solo `vendor_id = auth.uid()`; **no** valida `vendor_profile_id` ni `school_id` (**T5**); UPDATE sin `WITH CHECK` |
| `products` | `trial_block_insert/update/delete` | RESTRICTIVE | authenticated | `school_is_operational(school_id)`; con `school_id NULL` la función **no devuelve fila → NULL → bloquea** a todo externo (verificado leyendo `prosrc`) |
| `products` | `products_select_public` | SELECT | public | `active AND visibility='public' AND status='active'` — **sin gate de addon** (**T17**) |
| `products` | `products_select_school_members` | SELECT | authenticated | `school_only` vía `school_members` |
| `product_variants` | `…_insert/update/delete/select_own` | | authenticated | por `products.vendor_id = auth.uid()`; UPDATE sin `WITH CHECK`; `stock` editable (**T6**) |
| `product_variants` | `…_select_public` | SELECT | public | sin gate de addon |
| `refunds` | `refunds_owner_insert` | INSERT | **public** | `WITH CHECK (auth.uid() = requested_by)` — monto y estado libres (**T9**) |
| `product_reviews` | `Vendor responde a sus reviews` | UPDATE | public | **sin `WITH CHECK`, todas las columnas** (rating, status) (**T10**) |
| `product_reviews` | `Admin modera reviews` | ALL | public | con `WITH CHECK` — ok |
| `product_questions` | `Vendor responde su producto` | UPDATE | public | sin `WITH CHECK`, reescribe la pregunta (**T10**) |
| `shipments` | `shipments_vendor` | ALL | authenticated | **sin `WITH CHECK`** (I3, **T11**) |
| `product_images` | `product_images_vendor_all` | ALL | public | sin `WITH CHECK` (I3); `product_images_public_read USING(true)` |
| `inventory_logs` | `inventory_logs_admin_all` | ALL | public | super admin puede **borrar** el kardex |
| `settlements`, `vendor_balances`, `vendor_payouts` | solo SELECT | | public | ok a nivel RLS |
| `carts` | 4 policies `*_own` | | authenticated | `carts_update_own` sin `WITH CHECK` (I3) — F3 |
| `vendor_profiles` | `vendor_profiles_update_own` | UPDATE | authenticated | sin `WITH CHECK` (M3 lo arregla) |
| `school_payment_providers` | `…_admin_read` (SELECT) / `…_owner_write` (ALL con check) | | public | el admin lee **las columnas en claro `access_token`, `webhook_secret`, `integrity_secret`** si estuvieran llenas (hoy la única fila las tiene nulas y usa `payment_provider_secrets`) |
| `vendor_payment_providers` | `…_owner_all` | ALL | public | **secretos en claro** en la misma tabla (`access_token`, `webhook_secret`, `integrity_secret`); 0 filas |
| `payment_provider_secrets` | RLS ON, 0 policies, **sin grants** a anon/authenticated | | | bien cerrada |

`mp_shipping_rates` **no existe** en la base viva (el spec padre la nombra en T11): se saca del alcance.

### 1.3 Grants de tabla (`information_schema.role_table_grants`)

**`anon` y `authenticated` tienen `SELECT, INSERT, UPDATE, DELETE`** en: `orders`, `order_items`, `products`, `product_variants`, `product_images`, `refunds`, `settlements`, `vendor_balances`, `vendor_payouts`, `inventory_logs`, `shipments`, `shipping_zones`, `product_reviews`, `product_questions`, `carts`, `school_payment_providers`, `vendor_payment_providers`. `authenticated` además en `platform_config` (escritura frenada solo por RLS). Hoy lo único que separa a un anónimo de escribir dinero es la RLS (trampa 3 del CLAUDE.md). F0 hace `REVOKE` explícito.

`products.stock`: grant de columna `INSERT/SELECT/UPDATE` a `anon` y `authenticated`.

### 1.4 Funciones (`pg_proc`: prosecdef / proconfig / proacl)

| Función | Args | DEFINER | `search_path` | EXECUTE | Hallazgo |
|---|---|---|---|---|---|
| `confirm_order_payment` | **(uuid,text,text,text)** | sí | `public` (no estándar) | postgres, service_role | **2 sobrecargas vivas** (T8). Acepta `status IN ('pending','payment_review')` |
| `confirm_order_payment` | (uuid,text,text,text,**text p_provider**) | sí | `public` | postgres, service_role | Descuenta stock con `FOR UPDATE`, escribe `inventory_logs`, **no** calcula settlements. Lo llaman `wompi.ts:637` y `mercadopago.ts:594` |
| `split_order_payment` | (uuid,numeric,numeric,text) | sí | `public` | service_role | Motor 1 (T7): payout por orden 5 %+2,65 % sobre subtotal+IVA. Lo llaman `wompi.ts:661` y `mercadopago.ts:616` |
| `compute_settlements_for_order` | (uuid) | sí | `public` | service_role | Motor 2: agrupa por `order_items.vendor_id` (usuario), sin redondeo, fee estimado de `platform_config.gateway_fee_rate`. Lo llaman `wompi.ts:669` y `mercadopago.ts:625` **además** de `split_order_payment` |
| `admin_generate_pending_payouts` | () | sí | estándar | **authenticated**, service_role | **T21 verificado: tiene gate interno** `is_platform_admin()` → no es explotable por un usuario común. Es un tercer motor (vacía `available_balance`, marca settlements `paid`). El BFF la llama con service role (`vendor-payouts.routes.ts:224`, botón `AdminPayoutsPage.tsx:117`) → `auth.uid()` NULL → **ya falla con 42501**. Se revoca y se elimina |
| `release_settlements_for_vendor` | (uuid) | sí | `public` | service_role | **Bug nuevo (T22):** suma a `available_balance` **todos** los settlements en `processing` del vendedor, no solo los recién liberados → una segunda llamada duplica el saldo |
| `trg_release_on_delivered` | trigger | **no (INVOKER)** | estándar | — | Llama a `release_settlements_for_vendor` (solo service_role desde SEG-26) → si un `authenticated` pasara una orden a `delivered` por PostgREST, fallaría con 42501. Además la liberación exige `updated_at <= now()-7d`, que en el momento del trigger nunca se cumple, y **no hay cron** que lo reintente (`cron.job` tiene 12 jobs, ninguno de tienda) |
| `request_refund` | (uuid,uuid,uuid,text) | sí | `public` | **authenticated**, service_role | Usa `auth.uid()` → el BFF la llama con service role (`marketplace-checkout.routes.ts:614`) y recibe `unauthenticated` (T9). **Sirve también a `payments` y `marketplace_transactions`** |
| `approve_refund` | (uuid) | sí | estándar | service_role | idem `auth.uid()` (`:655`). También sirve a `payments` |
| `complete_refund` | (uuid,text,text) | sí | `public` | service_role | **No idempotente**: no mira el estado previo; repone stock cada vez. Rama `payments` → `status='refunded'` (compartida con academia) |
| `enable_vendor_profile` | 7 args | sí | `public` | authenticated | permite `vendor_type='school'` sin addon (M3 lo cubre con el trigger) |
| `enforce_product_publish_gate` | trigger | sí | `public` | — | Reutilizable. Llama a `validate_product_quality` (busca `product_media`) |
| `validate_product_vendor_capability` | trigger | — | — | — | Solo valida si `vendor_profile_id IS NOT NULL` → hueco T5 |
| `is_store_vendor` | (uuid) | sí | estándar | PUBLIC/anon/auth | `vp.user_id = auth.uid()` — solo el usuario dueño, nunca un admin de la escuela |
| `has_entitlement` | (uuid,text) | sí | estándar | PUBLIC | lee `school_addons` — sirve para el gate |
| `school_is_operational` | (uuid) | sí | estándar | PUBLIC | `NULL` con `school_id NULL` (sin fila) |
| `disable_vendor_profile` | () | sí | estándar | authenticated | **lector de estados**: `o.status IN ('pending','processing','shipped')` — se rompe con el CHECK nuevo si no se actualiza |
| `can_review_product`, `set_review_verified_purchase` | | sí | | | leen `status='delivered'` (compatible) |
| `flag_payment_for_review`, `record_payment_failure`, `unblock_payment`, `is_user_payment_blocked` | | sí | | service_role (+`unblock_payment` a authenticated) | escriben `orders.requires_review/last_failure_*` → el trigger de columnas congeladas debe dejar pasar DEFINER |
| `search_marketplace` | 9 args, **sin `p_modality`** | sí | `public` | PUBLIC | T18 (F3) |
| `store_enabled`, `store_seller_allowed`, `create_cart_order`, `order_transition`, `quote_cart` | — | — | — | — | **no existen** |

Valores de `orders.status` que escriben las funciones vivas: `paid`, `refunded` (y se comparan `pending`, `payment_review`, `processing`, `shipped`, `delivered`).

### 1.5 Esquema y datos

| Objeto | Vivo |
|---|---|
| `orders` | 34 cols. `status text DEFAULT 'pending'` **sin CHECK**. **No tiene** `vendor_profile_id`, `school_id`, `reference`, `idempotency_key`, `expires_at`, `subtotal`, `discount_total`. Tiene `vendor_id`, `cash_session_id` (FK `cash_sessions`), `requires_review`, `provider_*`, `wompi_*`, `fulfillment_type` enum (`physical,digital,service`). FKs a `auth.users`. Triggers: `trg_orders_release_on_delivered`, `trg_updated_at` |
| `order_items` | `unit_price, quantity, subtotal, tax_amount, platform_fee, vendor_id (auth.users), variant_id` — sin `tax_rate`, sin `line_base`, sin `discount_amount` |
| `products` | **sin `CHECK (stock >= 0)`**; `status` con CHECK; triggers `trg_enforce_product_publish_gate`, `trg_validate_product_vendor`, `trg_updated_at` |
| `product_variants` | `stock CHECK >= 0`, `sku UNIQUE` global; sin `reserved` |
| `settlements` | `status settlement_status` (**enum** `pending,processing,paid,failed`), `order_item_id` existe pero no se usa; sin `payout_id`, sin `collected_by` |
| `vendor_payouts` | `status text CHECK (pending,scheduled,paid,failed,on_hold)`, `CHECK one_origin` (orden **o** transacción: es "por orden", no lote) |
| `refunds` | `status CHECK (pending,approved,processing,completed,rejected,failed)`, `CHECK one_source` |
| `inventory_logs` | `reason CHECK (order_paid,order_cancelled,manual_restock,manual_adjust,returned)` |
| `vendor_profiles` | **`UNIQUE (user_id)`** (un perfil por usuario) y **sin `school_id`**: la escuela de una tienda escolar se deduce por `schools.owner_id = vp.user_id`. El dueño de MMA BLAIR TEAM tiene **2 escuelas** con addon y **1** perfil → ambiguo |
| Datos | 1 orden seed `paid` ($205.000, `vendor_id NULL`), 2 ítems, 3 productos demo (Escuela Demo, `tax_rate 0`), 0 variantes, 0 settlements, 0 payouts, 0 refunds, 0 kardex, 33 `vendor_balances` en cero |
| Vendor profiles | 33: 15 `school` (4 con `can_sell_products`, 1 verificada), 14 `personal_trainer`, 3 `wellness`, 1 `store` verificada; **todas con `commission_rate 0.10`** |
| Addon `store` | 7 escuelas (MMA BLAIR, Spirit Fontibon, The blair team gym, Academia Superior, Escuela Demo, Club Campestre Demo, Monster´s) |
| `platform_config` | `default_commission_rate 0.10`, `gateway_fee_rate {wompi .025, mercadopago .029, epayco .029, manual 0}`, `min_payout_amount 50000`, `escrow_release_days {physical 7}`, `platform_payment_accounts` |
| Pasarelas | `school_payment_providers`: **1 fila** (Escuela Demo, Wompi sandbox, `connect_status='connected_pending_webhook'`, secretos en `payment_provider_secrets`). `vendor_payment_providers`: 0. `schools.payment_mode`: 1 `direct`, 2 `aggregator`, 368 `unset` (Monster´s incluida) |
| Factura | `electronic_invoices.order_id` existe (0 filas con orden); `electronic_invoice_providers` por `owner_type/owner_id` |
| `cash_ledger` | vista `security_invoker`, solo `payments` + `expenses`. **Sin rama de órdenes** |

> **Hallazgo crítico para el cobro.** Las llaves Wompi de ENV del BFF son **de una escuela real en `aggregator` (Dynasty)** (`bff/src/services/payment-provider.resolver.ts:46-53, 355-409`). El camino CART de la tienda **ya usa esas llaves** en tres puntos, aunque el resolver diga otra cosa:
> - la firma de integridad: Edge Function `supabase/functions/wompi-sign/index.ts:86-100, 165` usa `WOMPI_INTEGRITY_SECRET` global, porque `/checkout/cart` no devuelve firma;
> - la llave pública del widget: `frontend/src/lib/api/wompi.ts:40-50, 97` cae a `VITE_WOMPI_PUBLIC_KEY`;
> - la verificación del webhook: `bff/src/routes/wompi.ts:105-126` (`credsForReference`) solo busca en `payment_links`, así que un `CART-…` se valida y reconsulta con el secreto global.
>
> Hoy una venta de tienda por Wompi **le cae a la cuenta de Dynasty**. F0 obliga a firmar en el BFF con las llaves del vendedor (patrón `create-session`, `payments.routes.ts:207-212`), devolver su llave pública y resolver el webhook por orden → vendedor. **La tienda nunca usa `env`.**

### 1.6 Deriva repo ↔ base que afecta a F0 (preguntada al objeto)

| En el repo | En la base viva | Consecuencia para el plan |
|---|---|---|
| `coupons`, `coupon_redemptions`, `validate_coupon()` (`20260418000001_advanced_commerce.sql:12-49, 379-445`) | **no existen** | Los cupones (F3b) se diseñan desde cero; esa migración no se reusa ni se "aplica de nuevo" (inmutable y con un modelo distinto: código global único, `current_uses` sin `FOR UPDATE`) |
| `marketplace_transactions` y la rama de `cash_ledger` que la lee (`20260903150628_articulos_escolares_catalogo_f1.sql:274-345`) | **ni la tabla ni la rama existen**; `cash_ledger` vivo = `payments` + `expenses` | M-F0-8 parte de la definición **viva** (§1.5), no de la del repo |
| `vendor_shipping_settings.accepts_pickup_in_store` (`20260511000020…:94, 113`) | **no existe** | El retiro en sede se modela en `store_payment_settings`/`create_cart_order`, no ahí |
| Trigger de logística que pone `orders.status='completed'` (`20260418000002_logistics_integrations.sql:201`) | **no existe** (`shipments` solo tiene `set_updated_at`) | `completed` no entra al CHECK |
| `payment_provider_secrets.provider_id` | FK a `school_payment_providers(id)` (**solo escuelas**) | Los secretos de vendedores externos necesitan su propia tabla (M-F0-7) |
| `vendor_payment_providers.vendor_id` | FK a **`auth.users`**, `UNIQUE (vendor_id, provider)`, secretos en claro | Se mantiene la clave por usuario (coincide con `vendor_profiles UNIQUE(user_id)`), pero los secretos se mueven a una tabla cifrada |

### 1.7 Cómo escribe hoy el código (radio real, lo que cambia el plan)

- **El BFF entero usa service role** (`bff/src/config/supabase.ts:17-24`). Los REVOKE y las policies **no frenan** al BFF: hay que cerrar las rutas en código. Dentro de cualquier RPC que el BFF llame, `auth.uid()` es NULL.
- **Productos:** el alta y la edición reales van por `bff/src/routes/vendor-products.routes.ts`, con service role. Lo llaman `ProductWizard.tsx:189/202/215/229` y `VendorProductsPage.tsx:52`.
  - `PATCH /:id` (`:135`) y `PATCH` de variantes (`:256`) dejan escribir `stock`, y el duplicado (`:398/:423`) copia `vendor_id`/`school_id`. El REVOKE de la columna `stock` **no** los frena: se cambia el código.
  - Las funciones de crear y editar de `useStoreData.ts:36/56` y `useProducts.ts:52/76` (JWT del usuario) **no tienen llamadores**; solo se usa el borrado de `useStoreData` (`StoreProductsPage.tsx:39`).
- **Reseñas y preguntas:** `bff/src/routes/reviews.routes.ts` (service role) inserta la reseña del comprador (`:214`) y la respuesta del vendedor (`:378-386`, `:453-460`).
  - Los comentarios de `:225/:276` dicen que la RLS exige "compra verificada" y la ventana de 24 h, y es **falso** porque el service role se la salta.
  - Quitar las policies de UPDATE (M-F0-6) cierra el camino por PostgREST. **El BFF tiene que pasar a las RPC.**
- **Órdenes:** `PATCH /api/v1/marketplace/orders/vendor/:id/status` (`marketplace-orders.routes.ts:194-222`) escribe un **estado libre del body**, sin lista permitida. Los webhooks escriben `declined`, `failed`, `refunded` o el `internalStatus` crudo (`wompi.ts:684-691`, `mercadopago.ts:638-646`). Todos esos valores tienen que estar en el mapeo del CHECK o el webhook revienta.
- **`confirm_order_payment`:** Wompi la llama con **4 argumentos con nombre** (`wompi.ts:636-644`). Con las dos sobrecargas vivas, eso es probablemente `PGRST203`, y el pago de tienda por Wompi quedaría en `payment_review` (T8). MP la llama con 5 (`mercadopago.ts:594-600`). **Hacer DROP de la de 4 arregla la llamada de Wompi**, que resuelve a la de 5 con `p_provider` por defecto `'wompi'`.
- **`compute_settlements_for_order` sí se llama** (`wompi.ts:669`, `mercadopago.ts:625`), sin bloquear, igual que `split_order_payment` (`:661`/`:616`). Los dos motores corren en cada pago (T7).
- **`admin_generate_pending_payouts`:** como el BFF la llama con service role, `is_platform_admin()` es false. El endpoint (`vendor-payouts.routes.ts:224`, botón en `AdminPayoutsPage.tsx:117`) **ya falla con 42501**.
- **MP en modo `direct`:** el resolver pone `webhookSecret = null` para MP (`payment-provider.resolver.ts:117`), aunque `POST /school` lo guarda en `events_secret_enc`. Toda escuela MP en `direct` recibe **503** en el webhook (`mercadopago.ts:168-174`), y las órdenes de vendedor por MP llegan a la URL legacy y se leen con el token de ENV.
- **No existe OAuth de Mercado Pago** (Connected Accounts, fase 1 en 0 %). Hoy solo se conecta pegando llaves (`payment-providers.routes.ts:128`).

---

## 2. Migraciones de F0 (en orden de aplicación)

Reglas comunes a todas: `npm run migrations:new -- <slug>` (versión > `20261003193624`), `SET search_path = pg_catalog, public, pg_temp` en toda función, `REVOKE ALL … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE` explícito, estados `text + CHECK`, FKs nuevas a `profiles(id)`, multi-fila en RPC transaccional, prueba en `BEGIN … ROLLBACK` contra la base viva (o el dump local §8.1 del spec padre), aplicar con `apply_migration`, verificar preguntándole al objeto y `npm run seguridad:invariantes` al final de cada una.

Plantilla de prueba (se repite en cada migración):

```sql
begin;
  -- pegar el cuerpo de la migración
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','<uuid>','role','authenticated')::text, true);
  -- casos (esperado al lado)
rollback;
```

### M0 · Aplicar M3 del blindaje (`20261002125959_tienda_apagada_y_guard_vendor_profiles`) — **ya escrita**

- Qué: `store_enabled=false`, `store_enabled()`, `store_off_*`, `trg_guard_vendor_profiles`.
- Prueba: la de la tabla §5 del blindaje (comprador no inserta orden, `anon` ve 0 productos, vendedor no cambia `commission_rate`, upsert idéntico de wellness ok).
- Radio: el BFF/frontend del commit `735c8869` ya degradan a "Tienda no disponible". **Verificar que ese frontend esté desplegado** antes (chunk en Vercel).
- Rollback: `UPDATE platform_config SET value='{"enabled":true}'` (sin deploy) para el flag; el trigger se suelta con `DROP TRIGGER` en una migración nueva.

### M-F0-1 · `tienda_v2_vendedor_escuela_y_gate`

**Por qué existe (no estaba en el spec):** U-1 y §1.5 — el piloto no tiene perfil, y `vendor_profiles` no sabe a qué escuela pertenece.

Objetos:
1. `ALTER TABLE vendor_profiles ADD COLUMN school_id uuid NULL REFERENCES schools(id)`; `CREATE UNIQUE INDEX … (school_id) WHERE school_id IS NOT NULL`. Backfill: `vendor_type='school'` cuyo dueño tiene **una** escuela → esa escuela. El caso MMA BLAIR / Spirit Fontibon (1 perfil, 2 escuelas) **no se adivina**: queda NULL y se lista en la PR para decidir a mano. `UNIQUE(user_id)` **se mantiene en F0** (relajarlo rompe todo lector que hace `.eq('user_id', uid).single()`; ver D-16).
2. `can_manage_store(p_vendor_profile_id uuid) RETURNS bool` — DEFINER STABLE: `vp.user_id = auth.uid() OR (vp.school_id IS NOT NULL AND vp.school_id = ANY(user_admin_school_ids())) OR is_super_admin()`. **Admin, no staff**: vender es dinero (D-15).
3. `store_seller_allowed(p_vendor_profile_id uuid) RETURNS bool` — DEFINER STABLE, §6.5 del spec más **allowlist de piloto**:
   ```sql
   store_enabled()
   AND (store_pilot_allowlist() IS NULL OR p_vendor_profile_id = ANY(store_pilot_allowlist()))
   AND vp.is_active AND (vp.capabilities->>'can_sell_products')::bool
   AND CASE vp.vendor_type
         WHEN 'school' THEN vp.school_id IS NOT NULL AND has_entitlement(vp.school_id,'store')
                            AND school_is_operational(vp.school_id) IS TRUE
         ELSE vp.verification_status = 'verified' END
   ```
   `store_pilot_allowlist()` lee `platform_config.store_enabled.value->'allowlist'` (array de `vendor_profile_id`; ausente = todos). **Sin esto, prender el flag global prende las 7 tiendas** (D-14).
4. `enable_school_store(p_school_id uuid) RETURNS uuid` — DEFINER: exige `p_school_id = ANY(user_admin_school_ids())` y `has_entitlement(p_school_id,'store')`; crea (o reusa) el `vendor_profile` `vendor_type='school'`, `school_id`, `user_id = schools.owner_id`, `can_sell_products=true`, `commission_rate` = valor de D-3 (0), `verification_status='verified'` (D-4: el addon pagado identifica). Falla con `OWNER_HAS_OTHER_VENDOR_PROFILE` si el dueño ya tiene un perfil de otro tipo (consecuencia de `UNIQUE(user_id)`). Escribe como DEFINER → pasa el guard de M3 porque `current_user=postgres`… **ojo:** el guard de M3 mira `auth.role()`, que sigue siendo `authenticated` dentro de un DEFINER → el guard forzaría `pending`. Solución: el guard permite cuando `current_setting('sportmaps.trusted_rpc', true) = 'on'` y la RPC lo setea con `set_config(..., true)` local a la transacción (patrón documentable, no exportable al cliente porque PostgREST no permite `set_config` sin RPC). Alternativa: hacerlo desde el BFF con service role.
5. Trial block: `ALTER POLICY trial_block_insert|update|delete ON products … (school_id IS NULL OR school_is_operational(school_id))`.
6. RESTRICTIVE `store_seller_visible` en SELECT de `products` y `product_variants` (roles `anon, authenticated`): `can_manage_store(vendor_profile_id) OR store_seller_allowed(vendor_profile_id)` — el dueño sigue viendo lo suyo; terceros solo de vendedores habilitados. (Para `products` legacy con `vendor_profile_id NULL`: los 3 demo tienen perfil; se agrega `vendor_profile_id IS NOT NULL` a la condición pública.)

GRANT/REVOKE: las 4 funciones `REVOKE … FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE` de `can_manage_store`, `store_seller_allowed`, `store_pilot_allowlist` a `anon, authenticated, service_role` (devuelven bool); `enable_school_store` solo a `authenticated, service_role`.

Prueba (`BEGIN…ROLLBACK`):
| Caso | Esperado |
|---|---|
| owner de Monster´s → `enable_school_store('eb3ebc77…')` | devuelve uuid; perfil `school`, `school_id` puesto, `verified`, comisión D-3 |
| coach de Monster´s → `enable_school_store` | `42501` |
| admin de escuela **sin** addon | `ADDON_REQUIRED` |
| `anon` `select count(*) from products` con flag ON y allowlist = [Monster´s] | solo productos de Monster´s |
| `store_seller_allowed` de un externo `pending` | false |
| externo con `school_id NULL` hace INSERT de producto | ya no lo frena `trial_block` (sí lo frenan las policies de M-F0-2 si no es dueño) |

Radio: lectores de `vendor_profiles` por `user_id` no cambian (columna nueva nullable). `ActivateStoreCTA.tsx` y `enable_vendor_profile` siguen funcionando; el CTA de escuela debe pasar a llamar `enable_school_store` (cambio de frontend §4). `useExplorarGlobal.ts:118` (embed `vendor_profiles!inner`) no se toca.
Rollback: migración nueva que haga `DROP POLICY store_seller_visible`, restaure `trial_block_*` y `DROP FUNCTION`; la columna `school_id` se deja (nullable, inofensiva).

### M-F0-2 · `tienda_v2_products_guard`

Objetos:
1. `products`: `ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0)` (las 3 filas ≥ 0, se valida directo).
2. Policies (DROP + CREATE):
   - `products_insert_own` → `WITH CHECK (vendor_profile_id IS NOT NULL AND can_manage_store(vendor_profile_id) AND (school_id IS NULL OR school_id = (SELECT school_id FROM vendor_profiles WHERE id = vendor_profile_id)))`.
   - `products_update_own` → `USING (can_manage_store(vendor_profile_id)) WITH CHECK (mismo que insert)`.
   - `products_delete_own` → `USING (can_manage_store(vendor_profile_id) AND status IN ('draft','rejected'))` (no se borra lo vendido; se archiva).
   - `products_select_own` → `can_manage_store(vendor_profile_id)`.
   - Variantes: las 4 `product_variants_*_own` pasan a `EXISTS (… p.vendor_profile_id … can_manage_store(p.vendor_profile_id))`, con `WITH CHECK` en UPDATE.
   - Trigger BEFORE INSERT `trg_products_fill_vendor_id`: fija `vendor_id = vendor_profiles.user_id` (compat con lectores legacy) y `school_id` del perfil escolar.
3. `REVOKE UPDATE (stock) ON products, product_variants FROM anon, authenticated` (hay que hacer `REVOKE UPDATE` de tabla y `GRANT UPDATE (col1, col2, …)` de las columnas editables, porque un grant de tabla cubre todas las columnas). Lista editable: `name, description, price, category, category_id, brand_id, image_url, active, visibility, status, sku, attributes, weight_grams, is_digital, min_stock_alert, tax_rate, updated_at`; en variantes: `sku, name, attributes, price_override, image_url, is_active, sort_order, updated_at`. `INSERT` sí lleva `stock` (stock inicial) — se deja.
4. `REVOKE INSERT, UPDATE, DELETE ON products, product_variants, product_images FROM anon`.
5. **Adelantado desde F1** (porque F0 revoca el UPDATE de stock y el panel actual lo usa): `inventory_adjust(p_variant_id uuid, p_product_id uuid, p_new_stock int, p_reason_code text, p_note text)` — DEFINER, `FOR UPDATE`, valida `can_manage_store`, rechaza `p_new_stock < reserved`, escribe `inventory_logs` con `reason='manual_adjust'` (el CHECK actual; F1 lo amplía a kardex completo). Opera por variante **o** por producto sin variantes (0 variantes hoy).
6. `product_images_vendor_all`: `WITH CHECK` = `USING` (I3) — se elimina en F2 con `product_media`.

GRANT: `inventory_adjust` → `authenticated, service_role`.

Prueba:
| Caso | Esperado |
|---|---|
| vendedor A INSERT producto con `vendor_profile_id` de B | `42501` (R11) |
| admin de Monster´s (no dueño) INSERT con el perfil de Monster´s | ok |
| coach de Monster´s INSERT | `42501` |
| vendedor UPDATE `stock` directo | `42501 permission denied for column stock` (R9) |
| vendedor UPDATE `price` | ok |
| `inventory_adjust` sobre variante ajena | `NOT_OWNER` (R10) |
| `inventory_adjust` a −1 | `CHECK` / `INVALID_QTY` |
| `anon` INSERT producto | `42501` |

Radio (se rompe / hay que cambiar):
- **Lo que la base NO frena** (service role): `bff/src/routes/vendor-products.routes.ts` — `PATCH /:id` (`:135`) y `PATCH` de variantes (`:256`) aceptan `stock` → quitar `stock` del body permitido y mandar a `inventory_adjust`; POST (`:72`, `:207`, bulk `:504`) sigue con stock inicial; duplicado (`:398/:423`) no debe copiar `vendor_id/school_id` sin validar `can_manage_store`. Las rutas deben validar dueño con `can_manage_store` (hoy `vendor.user_id = req.user.id` → un admin de la escuela no-dueño no puede).
- `frontend/src/hooks/useStoreData.ts:36/56` y `useProducts.ts:52/76` (JWT del usuario) **no tienen llamadores** → se borran; el delete de `useStoreData.ts:77` (`StoreProductsPage.tsx:39`) sigue funcionando con la policy nueva (solo borradores).
- `scripts/pruebas-blindaje-dinero.mjs:528` (vendedor actualiza `price` y espera rechazo con la tienda apagada) sigue pasando por `store_off_update`.
- `inventory_logs_vendor_read` y `order_items_select_vendor` siguen por `vendor_id` legacy (rellenado por el trigger) → funcionan.
Rollback: restaurar las policies viejas (texto en §1.2) y `GRANT UPDATE ON products, product_variants TO authenticated` en una migración nueva; el CHECK se deja.

### M-F0-3 · `tienda_v2_orders_cerrar_escritura`

Objetos:
1. Columnas nuevas en `orders` (todas nullable o con default, para no romper la fila seed):
   `vendor_profile_id uuid REFERENCES vendor_profiles`, `school_id uuid REFERENCES schools`, `reference text UNIQUE` (`ORD-xxxxxxxx`), `idempotency_key uuid`, `UNIQUE (user_id, idempotency_key)`, `subtotal numeric(12,0)`, `discount_total numeric(12,0) DEFAULT 0`, `coupon_id uuid` (FK se agrega en F3b), `fulfillment_mode text CHECK (pickup, shipping)`, `pickup_branch_id uuid REFERENCES school_branches`, `expires_at timestamptz`, `buyer_snapshot jsonb`, `payment_method` → `CHECK (payment_method IS NULL OR payment_method IN ('wompi','mercadopago','transfer','cash_pickup','card','pse','nequi'))` (los tres últimos los escribe hoy Wompi como `payment_method_type`; ver D-17), `seller_gateway_id uuid` (fila de `school_payment_providers`/`vendor_payment_providers` con que se cobró), `receipt_path text`, `receipt_submitted_at`, `approved_by uuid REFERENCES profiles`, `approved_at`, `rejection_reason text`, `pickup_code_hash text` (F3 lo usa; se crea aquí para no tocar la tabla dos veces), `guest_email`, `guest_token_hash` (idem).
2. `order_items`: `tax_rate numeric(5,4)`, `line_total numeric(12,0)`, `line_base numeric(12,0)`, `discount_amount numeric(12,0) DEFAULT 0`, `vendor_profile_id uuid`.
3. Estados: `UPDATE orders SET status='pending_payment' WHERE status='pending'`, `'declined'|'failed' → 'cancelled'` con nota en el historial (0 filas hoy, por si entra alguna antes de aplicar); `ALTER TABLE orders ALTER status SET DEFAULT 'pending_payment'`; `ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment','awaiting_approval','payment_review','paid','preparing','ready_for_pickup','shipped','delivered','expired','cancelled','refunded','partially_refunded'))`. `awaiting_approval` es nuevo (transferencia con comprobante, U-2).
4. Seguridad: `DROP POLICY orders_insert_buyer, orders_update_buyer, order_items_insert_buyer`; `REVOKE INSERT, UPDATE, DELETE ON orders, order_items FROM anon, authenticated`; `REVOKE ALL ON orders, order_items FROM anon`. `orders_select_vendor` y `order_items_select_vendor` pasan a `can_manage_store(vendor_profile_id)` **OR** el `_order_has_vendor_item` legacy (para la fila seed).
5. Trigger `trg_zz_guard_orders` BEFORE INSERT OR UPDATE, función **INVOKER** (igual que M2): si `current_user IN ('authenticated','anon')` → `RAISE 42501 ORDER_WRITE_LOCKED`. Es cinturón: con el REVOKE no debería llegar nunca; los DEFINER (`current_user=postgres`) y el BFF (`service_role`) pasan.
6. Trigger `trg_orders_paid_requires_proof` BEFORE UPDATE OF status: pasar a `paid` exige `provider_transaction_id IS NOT NULL` **o** (`payment_method IN ('transfer','cash_pickup')` y `approved_by IS NOT NULL`). Esto es lo que después mira la factura.
7. `order_status_history (id, order_id → orders ON DELETE CASCADE, from_status, to_status, actor_id → profiles, actor_role text CHECK (buyer, seller, admin, system, webhook), note, created_at)`. RLS: SELECT para comprador de la orden y `can_manage_store(order.vendor_profile_id)` vía función DEFINER `order_visible_to_me(order_id)` (sin recursión); sin INSERT/UPDATE/DELETE para nadie; escribe solo DEFINER. `REVOKE ALL FROM anon`.
8. `disable_vendor_profile`: `CREATE OR REPLACE` cambiando la lista a `('pending_payment','awaiting_approval','payment_review','paid','preparing','ready_for_pickup','shipped')`.

Prueba:
| Caso | Esperado |
|---|---|
| comprador `insert into orders(user_id,total_amount,status) values (me,1000,'paid')` | `42501` (R5) |
| comprador `update orders set total_amount=1` sobre la seed | `42501` |
| `service_role` update a `status='foo'` | `23514` CHECK |
| `service_role` update a `paid` sin `provider_transaction_id` ni `approved_by` | `23514 PAID_WITHOUT_PROOF` |
| `flag_payment_for_review` (DEFINER) sobre una orden | ok |
| `select * from order_status_history` como `anon` | `42501` |
| comprador ve su orden; ajeno 0 filas (R8) | ok |

Radio (se rompe; todos **detrás de `requireStoreEnabled`**, apagados mientras la tienda esté apagada):
- `frontend/src/lib/api/transactions.ts:195` (INSERT `orders`) y `:212` (INSERT `order_items`) — usado por `frontend/src/pages/CheckoutPage.tsx:30` y `frontend/src/components/payment/PaymentModal.tsx:34`. **Se rompen** (T15). F0: `CheckoutPage` muestra "usa el carrito nuevo" / se oculta la ruta; se borra en F3.
- `bff/src/routes/marketplace-orders.routes.ts:36` (INSERT con precios del body, T4), `:68`, `:74` (delete) → la ruta POST pasa a **410 Gone**; usa service role, así que la base no la frena: **hay que apagarla en código**.
- `bff/src/routes/marketplace-checkout.routes.ts:457/496/501` (`/checkout/cart`, insert no transaccional) → reemplazado por `rpc('create_cart_order')` (M-F0-4).
- **Escritores de estado con service role que el CHECK hace fallar:** `wompi.ts:684-691` y `mercadopago.ts:638-646` (`declined`, `failed`, `refunded`, `internalStatus` crudo); `marketplace-orders.routes.ts:217-222` (estado libre del body). El BFF los pasa a `order_transition` / mapeo explícito **antes** de aplicar el CHECK (por eso el CHECK puede ir `NOT VALID` + `VALIDATE` después del deploy, ver §3).
- Lectores de estado: `frontend/src/pages/StoreOrdersPage.tsx:12-17, 38-41, 65-68, 100` (`pending`, `processing`, `shipped`, `delivered`), `useStoreData.ts:140`, `types/shop.ts:24`, `wompi.ts:621` y `mercadopago.ts:585` (`pending` en la idempotencia) → mapa nuevo. `useDashboardStats.ts:132`, `AdminAnalyticsPage.tsx:95`, `invoicing.service.ts:569/1693` solo leen `paid`.
- `scripts/pruebas-blindaje-dinero.mjs:477-491` espera 42501 en INSERT/UPDATE de comprador → sigue pasando.
- Vista `my_orders_view` (security_invoker) y `blocked_payments_view` siguen.
Rollback: migración nueva con `DROP CONSTRAINT orders_status_check`, `DROP TRIGGER` x2 y `GRANT INSERT, UPDATE ON orders, order_items TO authenticated` + recrear las 3 policies. Las columnas se dejan.

### M-F0-4 · `tienda_v2_motor_orden`

Objetos:
1. `products.reserved int NOT NULL DEFAULT 0 CHECK (reserved >= 0)` y `product_variants.reserved` igual (productos sin variantes existen hasta F1).
2. `stock_holds (id, order_id → orders ON DELETE CASCADE, product_id, variant_id NULL, quantity int CHECK > 0, status text CHECK (active, consumed, released, expired), expires_at, created_at, closed_at)`; índice parcial `(expires_at) WHERE status='active'`. RLS ON, **0 policies**, `REVOKE ALL FROM anon, authenticated`.
3. Contrato **definitivo** (no se vuelve a cambiar la firma: una firma nueva = sobrecarga = `PGRST203`, la misma trampa de T8):
   ```
   create_cart_order(p_items jsonb, p_fulfillment text, p_pickup_branch uuid, p_address jsonb,
                     p_buyer jsonb, p_payment_method text, p_coupon_code text,
                     p_buyer_id uuid, p_idempotency_key uuid) RETURNS jsonb
   ```
   Orden de validación: `store_enabled()` → un solo `vendor_profile_id` (D-2) → `store_seller_allowed` → método aceptado por el vendedor (`store_payment_methods(vendor)`, M-F0-7) → cada ítem activo y `school_only` solo para `user_school_ids()` → cantidades 1–20 → `FOR UPDATE` de variantes/productos **ordenados por id** → `stock - reserved >= qty` (si no: `INSUFFICIENT_STOCK` con el disponible) → `p_coupon_code` no nulo → **`COUPONS_NOT_AVAILABLE`** hasta F3b → envío (retiro = 0; envío = `shipping_zones`) → IVA incluido por línea (§6.3 del spec, redondeo a peso) → total > 0. Escribe orden (`pending_payment`, `expires_at` por método: tarjeta/Nequi 20 min, PSE 45 min, transferencia 48 h, efectivo 48 h — D-6/D-18) + ítems + holds + historial. `p_buyer_id` se fuerza a `auth.uid()` salvo `service_role` (invitado = NULL solo por service role). Idempotencia por `(buyer, idempotency_key)`: devuelve la orden existente.
4. `quote_cart(p_items jsonb, p_fulfillment text, p_coupon_code text)` — STABLE, solo lectura, misma calculadora (función interna `_price_cart` compartida).
5. `_settle_order_paid(p_order_id, p_provider text, p_tx_id text, p_method text, p_actor uuid)` — **interna** (sin EXECUTE para nadie): consume holds, descuenta `stock` y `reserved`, kardex `order_paid`, `paid_at`, historial, llama a `compute_settlements_for_order`. Si el hold ya expiró y no hay stock: `payment_review` + `requires_review` + `last_failure_reason='PAID_WITHOUT_STOCK'`, nunca negativo.
6. `confirm_order_payment(uuid,text,text,text,text)` — `CREATE OR REPLACE` de la de 5 args: valida `status IN ('pending_payment','payment_review','expired')`, idempotente por `provider_transaction_id`, delega en `_settle_order_paid`. `search_path` estándar. Solo `service_role`.
7. `submit_order_receipt(p_order_id, p_receipt_path text)` — comprador dueño; `pending_payment → awaiting_approval`; el archivo vive en bucket **privado** `order-receipts/{order_id}/…` (policy de storage: escribe el comprador de la orden, lee comprador + `can_manage_store`). Extiende `expires_at` del hold a +72 h para que no se libere mientras el vendedor revisa.
8. `review_order_receipt(p_order_id, p_approve bool, p_reason text)` — `can_manage_store`; aprobar → `_settle_order_paid(provider=>'transfer', actor)`; rechazar → `pending_payment` con motivo (el comprador puede volver a subir hasta que expire).
9. `confirm_cash_pickup(p_order_id, p_pickup_code text)` — `can_manage_store`; valida `pickup_code_hash`; `_settle_order_paid('cash_pickup')` y en la misma transacción `→ delivered`.
10. `order_transition(p_order_id, p_to text, p_note text, p_tracking jsonb)` — matriz por actor (§2.6 del spec). `delivered` llama a la liberación de settlements (DEFINER, así que el trigger INVOKER deja de ser problema).
11. `cancel_my_order(p_order_id, p_reason)` — comprador, solo `pending_payment`/`awaiting_approval`; libera holds.
12. `release_expired_holds()` + `cron.schedule('store-release-expired-holds', '* * * * *', …)`. Respeta `awaiting_approval` (no expira mientras haya comprobante pendiente, D-18).
13. `DROP FUNCTION confirm_order_payment(uuid,text,text,text)` **va en M-F0-9** (después del deploy del BFF), no aquí.

GRANT: `create_cart_order`, `quote_cart`, `submit_order_receipt`, `review_order_receipt`, `confirm_cash_pickup`, `order_transition`, `cancel_my_order` → `authenticated, service_role`; `quote_cart` también `anon` (vitrina invitado); `confirm_order_payment`, `release_expired_holds` → solo `service_role`; `_settle_order_paid`, `_price_cart` → nadie.

Prueba (`BEGIN…ROLLBACK` + concurrencia en la base local con dos conexiones):
| Caso | Esperado |
|---|---|
| `create_cart_order` con `unit_price` en el JSON | ignorado; total = precio de la base (R6) |
| producto `school_only` ajeno / borrador / vendedor fuera de allowlist | error tipado, 0 filas (R7) |
| `store_enabled=false` | `STORE_DISABLED` (R17) |
| `p_coupon_code='X'` | `COUPONS_NOT_AVAILABLE` |
| mismo `idempotency_key` dos veces | misma orden |
| `transfer` → `submit_order_receipt` → `review_order_receipt(true)` | `paid`, `approved_by`, kardex, settlements `collected_by='seller'` |
| `review_order_receipt` por coach o comprador | `42501` |
| C1–C4 del spec (último ítem, 50 sobre 10, orden inverso, webhook duplicado) | §8.3 del spec |
| `confirm_order_payment` repetido | idempotente (R23) |

Radio:
- `bff/src/routes/wompi.ts:636-644` llama con 4 argumentos con nombre (hoy probable `PGRST203`); al quedar una sola firma resuelve a la de 5 con `p_provider='wompi'`. `mercadopago.ts:594-600` pasa 5. El webhook busca la orden por `wompi_reference`/`provider_reference` (`wompi.ts:612`, `mercadopago.ts:578`) → `create_cart_order` debe llenar esas columnas con la referencia `CART-…` que genera el BFF, o el BFF pasa a buscar por `orders.reference`. Reproceso de huérfanos: `services/webhook-reprocess.service.ts:19-49` usa los mismos handlers.
- `bff/src/routes/marketplace-checkout.routes.ts:347-545` (`/checkout/cart`, `/checkout/pay`) → reescritos sobre `create_cart_order`.
Rollback: `DROP FUNCTION` de las RPC nuevas + `cron.unschedule`; `stock_holds` y `reserved` se dejan (0 filas).

### M-F0-5 · `tienda_v2_settlements_unico`

Objetos:
1. `settlements`: `ADD collected_by text NOT NULL DEFAULT 'seller' CHECK (collected_by IN ('seller','platform'))` — **el vendedor cobra con sus llaves** (U-2): el settlement deja de ser "plata que SportMaps le debe al vendedor" y pasa a ser **"comisión que el vendedor le debe a SportMaps"** cuando `collected_by='seller'`. `ADD payout_id uuid REFERENCES vendor_payouts`, `ADD order_item_id` ya existe → se usa (1 por ítem), `ADD discount_amount numeric DEFAULT 0`.
2. Estado `reversed`: `settlement_status` es **enum** → `ALTER TYPE settlement_status ADD VALUE 'reversed'` en **su propia migración** (`ADD VALUE` no se puede usar en la misma transacción en que se agrega). Alternativa conforme al CLAUDE.md: convertir a `text + CHECK` (0 filas; costo bajo). **Recomiendo convertir a text** (lección de `payments.status`).
3. `compute_settlements_for_order` reescrita: por **ítem**, agrupando por `order_items.vendor_profile_id`; `gross = line_total` (IVA incluido, después de descuento, sin envío); `platform_fee = round(gross * commission_rate)` (D-3); `gateway_fee` = fee real si el webhook lo trae, si no el estimado de `platform_config`, marcado `gateway_fee_estimated=true`; redondeo a pesos; idempotente por `(order_item_id)` UNIQUE. Con `collected_by='seller'` **no toca** `vendor_balances.available_balance` (no hay payout que hacer); acumula en una columna nueva `vendor_balances.commission_due`.
4. `release_settlements_for_vendor`: fix T22 (sumar solo lo que se liberó en esta llamada) y solo para `collected_by='platform'`.
5. `vendor_payouts`: `DROP CONSTRAINT one_origin`, `ADD kind text CHECK (kind IN ('order','batch'))` para lotes (§6.4). Se deja preparado; con D-5 = "cada uno cobra" no se usa en el piloto.
6. `REVOKE EXECUTE ON FUNCTION split_order_payment(…), admin_generate_pending_payouts() FROM authenticated, PUBLIC` (el DROP en M-F0-9).

Prueba: orden de $100.000 IVA 19 % → settlement `gross 100000`, `platform_fee` según D-3, sin decimales; segunda llamada no duplica; `vendor_balances.available_balance` intacto con `collected_by='seller'`; invariante `commission_due = Σ platform_fee` (C10).
Radio: `bff/src/routes/wompi.ts:661` y `mercadopago.ts:616` (`split_order_payment`) → se quitan en el deploy del BFF; `vendor-payouts.routes.ts:224` (`admin_generate_pending_payouts`) → 410; `vendor_payout_summary` (lee `vendor_balances`) sigue; pantallas de payouts del vendedor muestran "comisión por pagar" en vez de "saldo disponible" (frontend §4).
Rollback: `GRANT EXECUTE` de vuelta; columnas se dejan.

### M-F0-6 · `tienda_v2_refunds_reviews_rpc`

Objetos:
1. `DROP POLICY refunds_owner_insert`; `REVOKE INSERT, UPDATE, DELETE ON refunds FROM anon, authenticated`.
2. Reembolsos con actor explícito, **sin romper la rama `payments`** (compartida con academia):
   - Nuevas `request_order_refund(p_order_id, p_reason, p_actor uuid)` y `approve_order_refund(p_refund_id, p_actor uuid)` — solo `service_role`; el BFF pasa `req.user.id` validado. Las viejas `request_refund`/`approve_refund` **no se tocan** (siguen sirviendo a `payments` y `marketplace_transactions`); solo se les agrega al principio `IF p_order_id IS NOT NULL THEN RAISE 'USE_request_order_refund'`.
   - `complete_refund`: `CREATE OR REPLACE` con `SELECT … FOR UPDATE` y `IF status = 'completed' THEN RETURN idempotent`; para órdenes repone stock **una vez**, marca settlements `reversed` (o crea uno negativo) y `orders.status = refunded|partially_refunded`. La rama `payment_id` queda **idéntica** (se copia tal cual y se prueba).
   - Transferencia/efectivo: el reembolso es manual (el vendedor devuelve la plata) → `complete_refund(p_provider=>'manual')` con soporte.
3. Reseñas y preguntas: `DROP POLICY "Vendor responde a sus reviews"`, `DROP POLICY "Vendor responde su producto"`; `respond_review(p_review_id, p_text)` y `answer_question(p_question_id, p_text)` DEFINER con `can_manage_store` y solo escriben `vendor_response/vendor_answer`, `*_at`, `*_by`. `REVOKE INSERT, UPDATE, DELETE ON product_reviews, product_questions FROM anon`.
4. `shipments_vendor`: `WITH CHECK` = `USING` (I3) — y el `USING` pasa a `can_manage_store(vendor_profile_id)`.
5. `inventory_logs`: `DROP POLICY inventory_logs_admin_all`; `CREATE POLICY inventory_logs_admin_read FOR SELECT USING (is_super_admin())`; `REVOKE INSERT, UPDATE, DELETE ON inventory_logs FROM anon, authenticated` (append-only, R13/R14).

Prueba: comprador INSERT `refunds` → `42501` (R16); `request_order_refund` con actor ajeno → `forbidden`; `complete_refund` dos veces → stock repuesto 1 vez (C8); **`complete_refund` sobre un refund de `payment_id` (dentro de ROLLBACK, con un pago de Escuela Demo) → mismo resultado que hoy**; vendedor UPDATE `rating` → `42501`, `respond_review` ok (R12); super admin DELETE kardex → `42501`.
Radio: `bff/src/routes/marketplace-checkout.routes.ts:605-720` (`/refund`, `/refund/:id/process`; también los UPDATE directos de `refunds` en `:706`, `:713` con service role → siguen funcionando) → llaman a las RPC nuevas con `p_actor`. **Reseñas/preguntas van por el BFF con service role** (`reviews.routes.ts:214, 266, 290, 341, 378-386, 412, 453-460`): quitar las policies no las afecta; el BFF pasa a `respond_review`/`answer_question` con `p_actor` (variante service-role de las RPC: `respond_review(p_review_id, p_text, p_actor)`), y el INSERT de reseña a una RPC `create_review` que valide compra `delivered` (hoy el service role se salta el "compra verificada"). `can_review_product` (`reviews.routes.ts:193`) usa `auth.uid()` → con service role siempre falla: recibe `p_user_id`. **Pagos de academia**: cualquier caller de `request_refund` con `p_payment_id` no cambia.
Rollback: restaurar policies; las funciones nuevas se dejan sin grant.

### M-F0-7 · `tienda_v2_pasarela_y_metodos_del_vendedor` (nueva, por U-2)

Objetos:
1. `store_payment_settings (vendor_profile_id PK → vendor_profiles, accept_wompi bool, accept_mercadopago bool, accept_transfer bool, accept_cash_pickup bool, transfer_instructions text, transfer_hold_hours int DEFAULT 48 CHECK 1..168, cash_hold_hours int DEFAULT 48, updated_at, updated_by → profiles)`. RLS: SELECT para `can_manage_store`; escritura **solo por RPC** `set_store_payment_settings(…)` que valida que lo que se prende esté configurado (Wompi/MP con fila `enabled` en la tabla de pasarela; transferencia con al menos una cuenta).
2. Cuentas para transferencia: tienda escolar **reusa `school_settings.payment_accounts`** (la escuela ya las administra); externo usa `vendor_bank_accounts`. Lectura para el comprador por RPC `store_transfer_accounts(p_order_id)` (solo el comprador de una orden `pending_payment` de ese vendedor ve el número de cuenta — nunca la vitrina pública, para no repetir T1).
3. Pasarela del vendedor:
   - Escolar → `school_payment_providers` de `vp.school_id` (con `payment_provider_secrets`, ya cifrado).
   - Externo → `vendor_payment_providers` tiene secretos **en claro**: `ADD COLUMN` nada; se crea `vendor_payment_provider_secrets (provider_id PK → vendor_payment_providers, *_enc …)` espejo de `payment_provider_secrets`, RLS ON sin policies, sin grants; y `REVOKE SELECT (access_token, webhook_secret, integrity_secret) ON vendor_payment_providers, school_payment_providers FROM anon, authenticated` (grant por columnas, trampa 4). 0 filas en vendor → migración sin datos.
   - `REVOKE ALL ON school_payment_providers, vendor_payment_providers FROM anon`.
   - `store_payment_methods(p_vendor_profile_id) RETURNS jsonb` — solo info pública (`provider, public_key, sandbox`, flags), `GRANT` a `anon, authenticated`.
4. `orders.seller_gateway_id` se llena en `create_cart_order` con la fila de pasarela elegida; el webhook verifica con **esos** secretos.

Prueba: `anon`/`authenticated` `select access_token from vendor_payment_providers` → `42501`; admin de Monster´s `set_store_payment_settings(accept_wompi=>true)` sin pasarela → `GATEWAY_NOT_CONFIGURED`; con `accept_transfer` y sin cuentas → `NO_TRANSFER_ACCOUNTS`; comprador ajeno `store_transfer_accounts` → `forbidden`.
Radio: `frontend/src/components/settings/SportMapsPaySettings.tsx` y `frontend/src/components/admin/PaymentProvidersAdmin.tsx` leen `school_payment_providers` — si piden las columnas de secreto con el JWT se rompen con el REVOKE (deben pedir solo `has*` vía `GET /payment-providers/school/:id`, `payment-providers.routes.ts:77`). `payment-providers.routes.ts:239, 325-330` (vendedor) escriben en claro → pasan a cifrar con `utils/payment-crypto.ts` (AES-256-GCM, `PAYMENT_TOKENS_ENC_KEY`) en `vendor_payment_provider_secrets`. Resolver (`payment-provider.resolver.ts:306-343`) lee el vendedor en claro → lee la tabla cifrada; **fix de `:117`** (MP `webhookSecret` = `events_secret_enc`). `payment-provider.resolver.ts` usa service role → el REVOKE no lo rompe.
Comprobantes: se reusa el OCR (`POST /payments/extract-receipt`, `payments.routes.ts:480-554`; `receipt-verdict.ts:189` `destinationMatchesRegistered`) pero **no** el flujo de aprobación de `payments` (atado a `school_id`, `parent_id`, glosas y `auto_approve_payment`). Bucket propio `order-receipts` (no `payment-receipts`, cuyo path es `{uid}/…`).
Rollback: `GRANT SELECT` de vuelta y `DROP` de lo nuevo.

### M-F0-8 · `tienda_v2_factura_y_ledger`

Objetos:
1. Guard de emisión: trigger BEFORE INSERT en `electronic_invoices` cuando `order_id IS NOT NULL`: la orden debe estar `paid`/`preparing`/`ready_for_pickup`/`shipped`/`delivered` y cumplir la prueba de pago de M-F0-3; `owner_type/owner_id` = dueño de la venta (escuela si `vp.vendor_type='school'`, si no `vendor`/`vp.id`) — **nunca** la escuela por un externo.
2. `cash_ledger`: `CREATE OR REPLACE VIEW` agregando una rama `UNION ALL` desde `orders` pagadas: `direction='income'`, `owner_type` según vendedor, `owner_id`, `school_id`, `concept='Tienda · '||reference`, `amount = total_amount` (lo cobrado: neto de descuento, con IVA, con envío), `movement_date = paid_at::date`, `source='store_order'`, `payment_category='tienda'` (literal; **no** se toca el CHECK de `payments`, la tienda no escribe en `payments`). Y una rama `expense` por la comisión de SportMaps (`settlements.platform_fee`) y el fee de pasarela. Reverso de reembolso fechado el día del reembolso. La vista sigue `security_invoker`; como `orders` solo es legible por comprador y vendedor, **el ingreso de tienda lo ve quien ve la orden**: se agrega a la rama un filtro `can_manage_finances(owner_type, owner_id)` (D-B del blindaje: coaches no).
3. `autoEmitPendingOrders` (`bff/src/services/invoicing.service.ts:1683`, filtro en `:1691`) → filtra por `store_enabled()` y la prueba de pago.

Prueba: emitir factura de una orden `pending_payment` (ROLLBACK) → `23514`; `cash_ledger` como coach de Monster´s → 0 filas de tienda; como owner → la orden aprobada.
Radio: los 3 agregadores de ingreso (memoria "tres agregaciones") — `useDashboardStatsReal` y `school_payment_kpis` **no** incluyen tienda; se documenta que el libro sí y el dashboard no (decidir en F4 si se suma).
Rollback: `CREATE OR REPLACE VIEW` con la definición de §1.5; `DROP TRIGGER`.

### M-F0-9 · `tienda_v2_limpieza` (después del deploy del BFF)

`DROP FUNCTION confirm_order_payment(uuid,text,text,text)` (T8), `DROP FUNCTION split_order_payment(…)`, `DROP FUNCTION admin_generate_pending_payouts()` (T7/T21). Prueba: `select count(*) from pg_proc where proname='confirm_order_payment'` = 1; `npm run seguridad:invariantes`. Rollback: recrear desde `prosrc` guardado en la PR (se pega el texto vivo de hoy como anexo).

---

## 3. Orden de despliegue

| # | Capa | Qué | Por qué en este orden |
|---|---|---|---|
| 0 | Verificación | Frontend/BFF del commit `735c8869` desplegados (Vercel chunk + Render) | M3 asume que la UI ya degrada |
| 1 | DB | **M0** (M3 del blindaje) | apaga la tienda en la base; todo lo demás se hace con la tienda apagada, radio real ≈ 0 |
| 2 | DB | M-F0-1, M-F0-2 | gate y productos; el panel de stock queda roto pero está detrás de `requireStoreEnabled` |
| 3 | DB | M-F0-3 (con `orders_status_check` **`NOT VALID`** solo si hay riesgo de filas nuevas; el CHECK igual frena escrituras nuevas, por eso el BFF que escribe `declined/failed` va **antes**: ver fila 3b), M-F0-4, M-F0-5 (tipo `text` o `ADD VALUE` aparte), M-F0-6, M-F0-7, M-F0-8 | solo **agregan** o endurecen; ninguna borra algo que el BFF de hoy llame |
| 3b | BFF | Si se quiere aplicar M-F0-3 antes del deploy grande: un deploy chico previo que mapee los estados de falla de `wompi.ts:684-691`/`mercadopago.ts:638-646` y `marketplace-orders.routes.ts:217` a valores del CHECK | con la tienda apagada no entran pagos, pero el reproceso de huérfanos (`webhook-reprocess.service.ts`) sí puede correr |
| 4 | BFF | deploy único (§4.1) | pasa a las RPC nuevas, quita `split_order_payment`, `/marketplace/orders` POST → 410, sin fallback `env` |
| 5 | Frontend | deploy único (§4.2) | stock por RPC, estados nuevos, `CheckoutPage` fuera, comprobante/efectivo/vendedor |
| 6 | DB | M-F0-9 limpieza | recién cuando nada llama a lo que se borra |
| 7 | QA | R1–R23, C1–C4/C8/C10 en el ambiente de pruebas (§8.1 del spec) + checkout de punta a punta con Wompi **sandbox** y MP **sandbox** con llaves de prueba de una escuela de QA | gate de salida de F0 |
| 8 | Piloto | `enable_school_store(Monster´s)` + configurar pasarela/cuentas + allowlist = [perfil de Monster´s] + `store_enabled=true` | **solo después de F1–F4** según el spec padre (el usuario puede decidir adelantar un piloto "solo transferencia + efectivo" tras F0+F3, ver D-19) |

Agrupar los pushes (memoria: 4 despliegues por push en Vercel).

---

## 4. Cambios de BFF y frontend que F0 obliga

### 4.1 BFF
| Archivo | Cambio |
|---|---|
| `routes/marketplace-checkout.routes.ts:347` (`/checkout/cart`) y `:545` (`/checkout/pay`) | Llaman `create_cart_order` con el JWT del usuario (o service role para invitado, F3). Firman Wompi / crean preferencia MP **con la pasarela de `orders.seller_gateway_id`**. Prohibido `source:'env'` para órdenes: si el resolver devuelve `env` → `409 SELLER_GATEWAY_NOT_CONFIGURED` |
| `routes/marketplace-checkout.routes.ts:106/165/221` (`/checkout/service|event|subscription`) | `501 NOT_IMPLEMENTED` explícito (T16) |
| `routes/marketplace-checkout.routes.ts:605-720` (refunds) | `request_order_refund`/`approve_order_refund` con `p_actor=req.user.id`; void de Wompi/MP con **las llaves del vendedor** |
| `routes/marketplace-orders.routes.ts:23-80` (POST) y `:194-222` (`PATCH /vendor/:id/status`, estado libre) | POST `410 Gone` (T4); PATCH → `order_transition` con `p_actor` |
| `supabase/functions/wompi-sign` (CART, `:86-100, 165`) + `frontend/src/lib/api/wompi.ts:40-50, 97` | La firma de órdenes sale del BFF con el `integrity_secret` del vendedor y el BFF devuelve su `publicKey`; la Edge Function deja de resolver `CART-` (o responde 410 para CART) |
| `routes/wompi.ts:105-126` (`credsForReference`) | Resolver `CART-…` → `orders` → `seller_gateway_id` → secretos del vendedor **antes** de validar el checksum y reconsultar |
| `routes/wompi.ts:600-700` y `routes/mercadopago.ts:570-660` | Verificar firma/evento con **los secretos de `seller_gateway_id`**; MP con `notification_url` por vendedor (`/webhook/:schoolId` existe; falta la de vendedor externo) y lectura del pago con el token del vendedor (hoy `MP_ACCESS_TOKEN_DEFAULT`, `mercadopago.ts:126`); monto == `orders.total_amount`; **quitar** `split_order_payment` (`wompi.ts:661`, `mercadopago.ts:616`) y la llamada suelta a `compute_settlements_for_order` (`:669`/`:625`, ahora la hace `_settle_order_paid`); estados de falla por mapeo explícito; guardar el fee real |
| `services/payment-provider.resolver.ts:117` | MP: `webhookSecret` desde `events_secret_enc` (hoy null → 503 en `direct`) |
| `routes/vendor-products.routes.ts:135, 256, 398, 423` | sin `stock` en PATCH; dueño por `can_manage_store`; `inventory_adjust` |
| `routes/reviews.routes.ts:193, 214, 378, 453` | `create_review`, `respond_review`, `answer_question` con `p_actor` |
| `routes/vendor-payouts.routes.ts:224` | `admin_generate_pending_payouts` → 410 |
| Nuevas rutas | `POST /store/orders/:id/receipt-url` (URL firmada al bucket privado `order-receipts`), `POST /store/orders/:id/receipt` → `submit_order_receipt`; `POST /vendor/orders/:id/review-receipt`, `/confirm-cash`, `/transition`; `GET /store/orders/:id/transfer-accounts` |
| `services/invoicing.service.ts:1683` | `autoEmitPendingOrders` con el filtro nuevo y emisor = dueño de la venta |
| Middleware | `requireStoreSeller` (llama `store_seller_allowed`) en `/vendor/products`, pedidos del vendedor, media |
| Tests vitest | IVA por línea, firma con total de la base, webhook con secretos por vendedor, sin fallback `env`, matriz de transiciones |

### 4.2 Frontend
| Archivo | Cambio |
|---|---|
| `hooks/useStoreData.ts:36/56`, `hooks/useProducts.ts:52/76` | borrar (sin llamadores); el wizard (`ProductWizard.tsx:189-229`) ya va por el BFF |
| Panel de inventario | campo de stock → endpoint del BFF que llama `inventory_adjust` |
| `lib/api/transactions.ts:136-233` (`createProductOrder`: INSERT de `orders`, `order_items`, `shipments`), `pages/CheckoutPage.tsx:128, 153-214` (referencia `SCH-`, flujo "manual" falso de 2 s), `CartDrawer.tsx:42-44` | `CartDrawer` navega al checkout del BFF (`CartCheckoutModal`/`useWompiCheckout.startCartCheckout`, `useWompiCheckout.ts:388-424`); `/checkout` de productos deshabilitado (se borra en F3). `PaymentModal.tsx:155` solo se usa con `'enrollment'` → quitar la rama `'product'` |
| `pages/StoreOrdersPage.tsx:38-41` | mapa de estados nuevo + acciones por RPC (`order_transition`, revisar comprobante, confirmar efectivo) |
| `components/vendor/ActivateStoreCTA.tsx` | para escuelas: `rpc('enable_school_store', {p_school_id})` |
| Inbox del vendedor (reseñas/preguntas) | `respond_review` / `answer_question` |
| Configuración de la tienda | pantalla "Medios de pago de la tienda" (`set_store_payment_settings`) |
| Comprador | subir comprobante; ver cuentas de transferencia; estado "esperando aprobación" |
| `integrations/supabase/types.ts` | regenerar |

---

## 5. Decisiones abiertas (con recomendación)

### 5.1 D-1 · IVA
**Recomendación: incluido** (diseño aprobado en julio). Por línea `line_base = round(line_total/(1+tax_rate))`. Con descuento (F3b) el IVA se calcula **sobre el precio ya descontado** (descuento incondicionado en factura no integra la base, art. 454 E.T.). Lo confirma el contador, junto con D-11 (IVA del envío).

### 5.2 D-3 · Comisión
**Recomendación:** tienda escolar **0 %** (ya paga el addon); externos **10 % sobre lo cobrado del ítem** (con IVA, **después** del descuento, sin envío). El fee de pasarela lo paga quien cobra (el vendedor, porque usa sus llaves). Como el vendedor cobra, la comisión se **factura** (cuenta de cobro mensual / descuento del siguiente ciclo SaaS para escuelas) o se retiene en la fuente si D-5 = opción C.

### 5.3 D-5 · ¿Quién cobra? (el usuario decide; acá van opciones y riesgo, no la decisión)

| Opción | Cómo funciona | Riesgo legal / operativo | Lo que F0 ya soporta |
|---|---|---|---|
| **A. Cada vendedor cobra con sus llaves** (Wompi/MP propios, transferencia a su cuenta, efectivo en su sede) | SportMaps nunca toca la plata. Comisión facturada aparte | **Bajo** en recaudo: SportMaps es plataforma tecnológica, no recauda para terceros. Riesgo **comercial**: cobrar la comisión (cartera). SportMaps factura su comisión (IVA 19 % sobre el servicio). El vendedor factura al comprador (cada externo necesita su PAC o queda sin factura electrónica — **obligación del vendedor**, no de SportMaps) | Sí: `collected_by='seller'`, `seller_gateway_id`, `commission_due` |
| **B. SportMaps recauda y liquida** (llaves de SportMaps, payout por lotes) | Lo que el spec llamaba "libro de payout" | **Alto**: recaudo a nombre de terceros = mandato; ingresos para terceros (art. 29 E.T.) con soporte contractual; posibles retenciones como agente; SARLAFT; si la actividad se asemeja a agregador/pasarela, revisar el marco de sistemas de pago (Decreto 1692/2020) y la exposición ante la SFC. Además operar payouts, contracargos y reembolsos con plata propia de por medio. **Requiere abogado + contador antes de una sola venta real** | Parcial: `collected_by='platform'`, `vendor_payouts.kind='batch'`, `release_settlements_*` arreglado. No se usa en el piloto |
| **C. Híbrido con split del procesador** | Externos conectan **Mercado Pago por OAuth** (Connected Accounts) y la preferencia lleva `marketplace_fee`: MP le transfiere la comisión a SportMaps y el resto al vendedor | **Medio-bajo**: el recaudo y el split los hace MP (entidad vigilada), SportMaps recibe su comisión directamente. Hay que verificar condiciones del programa marketplace de MP en Colombia y que el OAuth de la app esté aprobado. Wompi: **no verificado** que ofrezca split para terceros — si no, en Wompi queda opción A | Sí, con `school_payment_providers.application_fee_pct` y `connect_method` ya en la tabla de escuelas; para externos falta lo mismo en `vendor_payment_providers` (F0-7 lo deja listo) |

**Riesgos comunes a cualquier opción con externos:** Estatuto del Consumidor (Ley 1480/2011) — la plataforma de comercio electrónico tiene deberes de información y puede responder solidariamente si no identifica bien al vendedor (art. 53): exigir y mostrar razón social/NIT/contacto del externo y términos de la plataforma; retracto de 5 días hábiles (D-10); datos personales (Ley 1581) del comprador compartidos con el externo → autorización en el checkout.
**Lo que habilita el piloto sin decidir D-5:** Monster´s es tienda escolar → cobra con lo suyo (opción A de hecho). Los externos pueden entrar por A sin tocar plata de terceros.

### 5.4 Cupones por empresa (nuevo alcance, U-3)

**Fase:** **F3b, inmediatamente después de F3** (necesita el checkout nuevo y la vitrina). F0 solo deja reservado: parámetro `p_coupon_code` en `create_cart_order` (responde `COUPONS_NOT_AVAILABLE`), `orders.discount_total`, `orders.coupon_id`, `order_items.discount_amount`, `settlements.discount_amount`. Así F3b **no cambia la firma** de la RPC.

Modelo propuesto (F3b):
- `store_coupons (id, vendor_profile_id NOT NULL → quién emite y absorbe, school_id NULL → si está, solo lo redimen miembros de esa escuela (`user_school_ids()`), es el caso "la empresa X le da 10 % a las familias de Monster´s", code text, UNIQUE (vendor_profile_id, upper(code)), kind CHECK (percent, fixed), value numeric CHECK (> 0; percent ≤ 90), min_subtotal, max_discount (tope en pesos para %), applies_to jsonb {product_ids, category_ids} o NULL = toda la tienda, starts_at, ends_at, max_redemptions, max_per_buyer DEFAULT 1, funded_by CHECK (vendor) en v1, status CHECK (draft, active, paused, expired), created_by → profiles)`.
- `store_coupon_redemptions (id, coupon_id, order_id UNIQUE, buyer_id, discount_amount, status CHECK (reserved, consumed, released))` — se **reserva** con el hold (bloqueando la fila del cupón `FOR UPDATE` para que el tope de usos no se pase en concurrencia), se **consume** al pagar, se **libera** al expirar/cancelar.
- Cálculo: el descuento se prorratea por línea (el residuo de redondeo a la línea más cara), `line_total` = precio − descuento de la línea, y desde ahí IVA, comisión y factura.
- **Quién absorbe:** v1 **solo el vendedor** (`funded_by='vendor'`). Que SportMaps financie promociones (`funded_by='platform'`) obliga a reembolsarle al vendedor la diferencia → solo tiene sentido con D-5 = B o C. Se deja como D-20.
- **Comisión:** sobre lo efectivamente cobrado (después del descuento) — si fuera sobre el precio lleno, el vendedor pagaría comisión por plata que no recibió.
- **IVA:** sobre el precio descontado (5.1). **Factura:** ítem con su descuento (Factus admite descuento por ítem) — el total facturado cuadra al peso con lo cobrado.
- **Asiento contable:** ingreso = lo cobrado (neto). El descuento no se asienta como gasto (es menor ingreso); se guarda en `orders.discount_total` para el reporte "ventas brutas vs descuentos por cupón".
- **Atribución al canal (opcional, D-21):** si la visión es "las empresas venden por el canal SportMaps y la escuela trae a las familias", un cupón con `school_id` puede llevar `channel_fee_pct` que le reconoce algo a la escuela. Eso es un tercero cobrando → depende de D-5. No en v1.
- Pruebas: tope de usos con 20 redenciones concurrentes sobre `max_redemptions=10`; cupón de otra escuela; vencido; `max_per_buyer`; prorrateo con IVA mixto 0/19 %.
- Tamaño: **M** (1–2 semanas con UI de vendedor y campo en checkout).

### 5.5 Métodos de pago (U-2)
| Decisión | Recomendación |
|---|---|
| D-6 / D-18 Reserva por método | Tarjeta/Nequi 20 min; PSE 45 min; **transferencia 48 h** (y no expira mientras haya comprobante esperando aprobación, con tope de 72 h de revisión); **efectivo al retirar 48 h** configurable por vendedor (`cash_hold_hours`) |
| Transferencia | Aprobación manual del vendedor (como los comprobantes de mensualidad). El OCR/extracción de comprobantes v2 se puede reusar después; F0 no lo exige |
| Efectivo | El pedido no se cobra hasta el retiro; el vendedor confirma con el código de retiro (`confirm_cash_pickup`) → `paid` + `delivered` a la vez |
| Wompi / MP | Solo llaves del vendedor; **nunca** las de ENV. Monster´s hoy no tiene ninguna: el piloto puede arrancar con **transferencia + efectivo** y sumar pasarela cuando conecte la suya (D-19) |
| D-17 `payment_method` | `orders.payment_method` = canal (`wompi`, `mercadopago`, `transfer`, `cash_pickup`); el submétodo de Wompi (`CARD`, `PSE`, `NEQUI`) va en una columna aparte `payment_method_detail` para que el CHECK no tenga que seguir a Wompi |

### 5.6 Otras que salieron de la verificación
| # | Decisión | Recomendación |
|---|---|---|
| D-14 | Piloto con flag global o con allowlist | **Allowlist** en `platform_config.store_enabled` (sin ella, prender el flag prende las 7 tiendas) |
| D-15 | ¿Quién administra la tienda de la escuela? | Owner + admins (`user_admin_school_ids()`), **no** coaches ni staff operativo |
| D-16 | `vendor_profiles UNIQUE(user_id)` | Mantener en F0. Caso MMA BLAIR (1 dueño, 2 escuelas con addon) y dueños que ya son entrenadores: resolver en F4 con `UNIQUE (school_id)` + `UNIQUE (user_id) WHERE school_id IS NULL` y auditar los `.single()` por `user_id` |
| D-4 | Verificación de tienda escolar | No (el addon identifica); externos sí |
| D-8 | Plan Supabase / ambiente de pruebas | Sigue abierta (spec padre). F0 necesita como mínimo Supabase local con dump de esquema para la concurrencia |
| D-19 | ¿Piloto de Monster´s tras F0+F3 solo con transferencia/efectivo, sin esperar F1/F2/F4? | Posible si el usuario acepta panel de vendedor básico; el spec padre pide F0–F4 |

---

## 6. Estimación

| Bloque | Tamaño |
|---|---|
| M0 aplicar + verificar | 0,5 día |
| M-F0-1 vendedor escuela + gate + allowlist | 2 días |
| M-F0-2 productos + `inventory_adjust` | 1,5 días |
| M-F0-3 órdenes cerradas + estados + historial | 2 días |
| M-F0-4 motor de orden (holds, 3 vías de pago, transiciones, cron) | 5 días |
| M-F0-5 settlements único (`collected_by`, T22) | 2 días |
| M-F0-6 refunds/reseñas/preguntas (sin romper `payments`) | 2 días |
| M-F0-7 pasarela y métodos del vendedor | 2,5 días |
| M-F0-8 factura + `cash_ledger` | 2 días |
| M-F0-9 limpieza | 0,5 día |
| BFF (checkout, firma y webhooks Wompi/MP por vendedor, fix resolver MP, productos/reseñas sin stock ni RLS-bypass, rutas nuevas, tests) | 7 días |
| Frontend mínimo de F0 | 3 días |
| Ambiente de pruebas (dump + seed + guardas) y suites R1–R23 / C1–C4, C8, C10 | 4 días |
| **Total F0** | **≈ 34 días-persona → 7 semanas para una persona** (el spec padre decía L = 2–4 semanas; sube por U-2 medios de pago por vendedor y por el vendedor escolar que no existía) |
| F3b cupones (fuera de F0) | M · 1–2 semanas |

---

## 7. Checklist del PR de F0 (gate de salida)

- [ ] `select tablename, cmd from pg_policies where tablename in (orders, order_items, refunds, settlements, inventory_logs, stock_holds) and cmd in ('INSERT','UPDATE','ALL') and roles && '{authenticated,anon,public}'` → solo SELECT o super admin de lectura.
- [ ] `information_schema.role_table_grants` sin INSERT/UPDATE para `anon`/`authenticated` en tablas de dinero y stock; `column_privileges` sin UPDATE de `stock`.
- [ ] `select count(*) from pg_proc where proname in ('confirm_order_payment','split_order_payment','admin_generate_pending_payouts')` = 1.
- [ ] Ninguna función nueva sin `search_path` fijo (I4) ni `FOR ALL` sin `WITH CHECK` (I3).
- [ ] `npm run seguridad:invariantes` sin CRÍTICAS ni I3 nuevas en tienda.
- [ ] grep en el PR: 0 `.from('orders').insert|update` y 0 escrituras de `stock` desde `frontend/src`.
- [ ] Ninguna ruta de tienda en el BFF alcanza `source:'env'`.
- [ ] Rama `payment_id` de `complete_refund` probada igual que antes.
