# Backlog 13 — Tiendas, proveedores y marketplace (TPM)

> Frente: **Tiendas, proveedores y marketplace** · Versión final con las correcciones del revisor aplicadas · 14-oct-2026
> Fuentes: `docs/plan-maestro-ecosistema-2026-10.md`, `docs/plan-agresivo-canchas-2026-10.md`, `docs/specs/reservas-canchas-plan-unificado-2026-10.md`,
> `docs/specs/ecosistema/roles-*.md`, `docs/ROADMAP.md`, `docs/specs/tienda-cambio-gestion-a-tienda.md`, `docs/specs/tienda-v2-estilo-mercadolibre.md`.
>
> Convenciones: rutas del repo SportMaps relativas a la raíz; `landing:` = `C:/Users/Usuario/Documents/Landing_page/sportmap-maps-landing-page/frontend/`.
> Tamaños: XS < 2 h · S ≤ 1 día · M 2-3 días · L ≤ 1 semana · XL > 1 semana.
> Reglas que valen para todas las tareas con SQL: migraciones inmutables y creadas con `npm run migrations:new -- <slug>`; **plan aprobado antes de escribir SQL**;
> una sola sesión aplica; `types.ts` se regenera una sola vez al final del lote; nada de `list_tables`/`get_advisors` como sondeo (se consulta `pg_proc`/`pg_policies` por nombre);
> jobs sin N+1; `search_path = pg_catalog, public, pg_temp`; `GRANT EXECUTE` explícito; `text + CHECK`; RLS sin self-recursion; escritura con `user_staff_school_ids()`,
> permisos que otorgan permisos con `user_admin_school_ids()`, nunca `user_school_ids()` para escribir; creación multi-fila en RPC transaccional.

---

## 1. Resumen y estado actual verificado

La tienda escolar está casi completa en código, pero **apagada a nivel de plataforma**: el flag global `store_enabled` está en `false`; `StoreGate`/`useStoreEnabled`
cierran todo si falla y el BFF exige `requireStoreEnabled`. Ya existen compra sin cuenta, cupones por empresa y las ventas de tienda en Ingresos (tres migraciones del 13-oct,
mergeadas a staging; **su estado en la base viva no está verificado**). GYM RM tiene 73 productos cargados y una PROPUESTA de SQL para encenderla con el primer mes gratis.

Qué cambió respecto del plan original, tras verificar el código:

- **La landing ya está casi limpia.** `Equipamiento.tsx` ya es «Tienda de tu Escuela» y `Marcas.tsx`/`Proveedores.tsx` ya usan «piloto gratis por un mes». Quedan restos puntuales (ver P0-01). El árbol de la landing estaba sin cambios sin commitear y HEAD era `3db7db8`.
- **El diagnóstico «ROADMAP dice que abre RPCs a anon» sí está en el ROADMAP**: `docs/ROADMAP.md` línea 98, fila 8 de la tabla de pendientes. La migración, en cambio, otorga solo a `service_role` (más `link_my_guest_orders` a `authenticated`). Hay que revisarla y corregir esa fila.
- **El marketplace global está contenido por flag, no «abierto»:** `/shop`, `/marketplace/product/:id` y `/tienda/:slug` ya van con `StoreGate`; con la tienda apagada `GET /api/v1/marketplace` fuerza servicios. El agujero real aparece **al encender** (`store_enabled=true`): el listado no tiene `requireStoreEnabled` ni filtro de allowlist en la consulta; depende de la policy RESTRICTIVE `store_seller_visible` (migración `20261003202431`, punto 6) y nadie la ha probado contra ese endpoint.
- **`marketplace-checkout.routes.ts` tiene 12 rutas, no 6.** Sin `requireStoreEnabled`: `POST /checkout/session-booking` (línea 257), `GET /transactions` (717), `GET /subscriptions` (748) y `PATCH /subscriptions/:id/cancel` (773). `grep resolveProvider` en el archivo da 0. La cifra «6» del ROADMAP MOD-11 está desactualizada.

### Tabla capacidad / estado / evidencia

| Capacidad | Estado | Evidencia |
|---|---|---|
| Tienda escolar (addon `store`, vitrina, carrito, checkout por tienda, pedidos, cupones) | parcial | `App.tsx` 364-370, 419-423, 492, 519-529 y 1024-1033 con `StoreGate`; BFF `store-orders`, `store-coupons`, `store-guest`, `vendor-products` con `requireStoreEnabled`. Código completo, flag global en false (estado leído el 08-oct en la PROPUESTA) |
| Compra sin cuenta (invitado) con token | parcial | `20261013170553_tienda_compra_sin_cuenta.sql`: `REVOKE ALL` de `PUBLIC, anon, authenticated` (665-675), `GRANT` solo a `service_role` (677-681), `link_my_guest_orders` a `authenticated` (682). Aplicación en la viva sin verificar |
| Ventas de tienda en «Ingresos del mes» / Finanzas | parcial | `20261013170548_tienda_ingresos_en_finanzas.sql` (`store_income_summary`, `finance_income_by_origin`, solo lectura); consumida en `DashboardPage.tsx`, `AccountingPage.tsx`, `AccountingReportsPage.tsx`, `lib/accounting/income.ts`; test `storeIncome.test.ts`. Depende de que esté viva |
| Cupones por empresa | parcial | `20261013170543_tienda_cupones_por_empresa.sql`, sin verificar en la viva |
| Dashboard del vendedor con ingresos reales | funciona | `pages/vendor/VendorDashboardPage.tsx:73-96` usa `useStoreSalesInsights(30)`. Falta ocultarlo a roles de escuela |
| Panel `/vendor/*` (11 páginas) | parcial | `App.tsx` 1036+ bajo `VendorGuard`; `useSchoolStore.ts` existe (N0 hecho); las de tienda dependen del flag |
| Tienda dentro de la gestión (`SchoolStorePage`, conteo «por aprobar») | solo spec | `tienda-cambio-gestion-a-tienda.md` §5-6 (N1-N4). No existen `pages/SchoolStorePage.tsx` ni `hooks/usePendingApprovals.ts`; `/tienda-escuela` redirige a `/tienda-escuela/ajustes` |
| Vitrina del acudiente dentro del shell | no existe | `MiTiendaPage`/`TiendaPublicaPage` sin prop `embedded`; `/tienda/:slug` vive fuera del layout autenticado |
| Rol legado `store_owner` | roto | `App.tsx` 995-1015: `/suppliers`→`StoreInventoryPage`, `/categories` y `/promotions`→`StoreProductsPage`, `/customers`→`StoreOrdersPage`; `navigation.ts` 588-616 los enlaza. 1 usuario real (a confirmar con consulta puntual) |
| Listado `/marketplace` con flag encendido | sin probar | `marketplace.routes.ts:18-33`: sin `requireStoreEnabled` en `GET /`; filtro por allowlist solo vía policy RESTRICTIVE. Hay pruebas I01d/F01b en `supabase/tests/tienda_v2/`, ninguna sobre este endpoint |
| Checkout del marketplace global | roto (contenido por flag) | `marketplace-checkout.routes.ts`: 12 rutas, 4 sin `requireStoreEnabled`, 0 `resolveProvider`; `marketplace_transactions` no existe |
| Moderación de marketplace (admin) | parcial | `/admin/marketplace/moderation`, `marketplace-admin.routes.ts`; sin uso real |
| Guarda de la allowlist del piloto | roto (trampa latente) | `20261003202431:133-158,171-172`: `'{}'` ya cierra todo; **solo NULL o clave ausente abre todas las tiendas**. La PROPUESTA escribe flag y allowlist juntos, pero es una trampa si alguien enciende solo el flag |
| Facturación electrónica de pedidos de tienda | riesgo | `bff/src/jobs/maintenance.job.ts:296` llama `autoEmitPendingOrders()` (`invoicing.service.ts:1764`): factura DIAN real por orden pagada |
| Proveedor recomendado para escuelas | no existe | Sin tabla ni página; `AccountingSuppliersPage` es de gastos |
| Marcas aliadas / patrocinio | no existe | 0 páginas, 0 rutas; solo `product_brands` (catálogo) |
| Landing Equipamiento / Marcas / Proveedores | casi limpia | Páginas ya reescritas. Restos: `RolePricingCard.tsx:76-88` (roles marcas y proveedores: «Publicidad Geolocalizada», «Dashboard real de interacciones»), `SportMapsFooter.tsx:90` «Marketplace Deportivo», `/equipamiento` en sitemap/prerender, assets `tienda-*.jpg` |
| Tienda v2: kardex, medios, búsqueda, devoluciones | parcial | Hecho: F0 (motor de orden, settlements, refunds RPC) y stock por variante `20261008163938`. Solo spec: F1-F4 restantes (`product_media`, `search_tsv`, `return_requests`) |

---

## 2. Fases

Dependencias entre frentes: `frente:landing` = backlog 03; `frente:plataforma` = backlog 02 (facturación SaaS multi-rol, mecanismo común de pilotos gratis);
`frente:escuela` = backlog 04 (cobros, cuentas de recaudo); `frente:familias` = backlog 11; `frente:canchas` = backlog 01; `frente:pagos-ruteo` = `docs/plan-cierre-ruteo-de-pagos.md`; `frente:sportpoints` = spec SportPoints.

### P0 — Contención, verificación y barrido residual (semana 1)

**Objetivo:** probar que al encender el flag nada se filtra, retirar lo que muestra páginas equivocadas, dejar la landing sin restos, revisar y aplicar (una sola sesión) las 3 migraciones de tienda, y blindar la facturación electrónica antes del piloto.

| id | título | capa | archivos | migración | depende de | aceptación | tamaño |
|---|---|---|---|---|---|---|---|
| TPM-P0-01 | Barrido residual de la landing: confirmar `git status` limpio antes de tocar; `RolePricingCard.tsx` (roles marcas y proveedores) sin «Publicidad Geolocalizada» ni «Dashboard real de interacciones»; `SportMapsFooter.tsx:90` «Marketplace Deportivo» → «Tienda de tu escuela»; ruta `/equipamiento` coherente en sitemap/prerender/`llms*.txt`; assets `tienda-*.jpg` sin uso fuera | landing | `landing:src/components/common/cards/RolePricingCard.tsx`, `landing:src/components/SportMapsFooter.tsx`, `landing:public/llms.txt`, `landing:public/llms-full.txt`, sitemap y prerender de la landing | no | frente:landing | `grep -ri 'marketplace deportivo\|Publicidad Geolocalizada\|SportMaps Store\|24-48\|10,000' landing:src landing:public` = 0; prerender regenera sin esas cadenas; sin enlaces rotos a `/equipamiento`; el preview de Vercel corresponde al texto vigente | S |
| TPM-P0-02 | QA real de la landing en el preview de Vercel (360 px y escritorio): Equipamiento, Proveedores, Marcas, Planes; envío de prueba de los formularios de Marcas y Proveedores al destino real | qa | — | no | TPM-P0-01 | Capturas de las 4 páginas; los 2 formularios entregan su mensaje; ninguna promesa de la tabla B de `roles-tiendas-marcas-familias-atletas.md` | XS |
| TPM-P0-03 | Prueba de RLS + BFF del listado `/marketplace` con `store_enabled=true` **en el gemelo local**: anon y un padre no ven productos de vendedores fuera de la allowlist ni `school_only`; servicios de bienestar sí se ven | qa | `bff/src/routes/marketplace.routes.ts`, `bff/src/routes/marketplace.routes.test.ts` (nuevo), `supabase/tests/tienda_v2/` | no | — | Test que falla si `GET /api/v1/marketplace` devuelve un producto de una tienda no permitida; usa `set local role anon` y sesión simulada de padre; el setup aborta si `SUPABASE_URL` contiene `luebjarufsiadojhvxgi` | M |
| TPM-P0-04 | Según el resultado de P0-03: añadir filtro explícito por `store_seller_allowed` en la consulta del listado (defensa en profundidad) y decidir redirect de `/marketplace` y `/shop` a `/mi-tienda` (con sesión) o landing (sin sesión). Se mantiene `/marketplace/service/:id`. No se borra ninguna página | frontend | `frontend/src/App.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/pages/ShopPage.tsx`, `bff/src/routes/marketplace.routes.ts` | no | TPM-P0-03 | Test de rutas cubre las redirecciones; el detalle de servicio de bienestar abre; P0-03 en verde | S |
| TPM-P0-05 | Rutas duplicadas de `store_owner`: `/categories`, `/promotions`, `/customers`, `/suppliers` redirigen al destino correcto (`/vendor/products`, `/vendor/promotions`, `/orders`) u ocultan el ítem; limpiar el árbol `store_owner` (`navigation.ts` 588-616) | frontend | `frontend/src/App.tsx` (995-1015), `frontend/src/config/navigation.ts` | no | — | Test de navegación: cada `href` del árbol `store_owner` monta la página cuyo título coincide; ningún «Proveedores» apunta a `StoreInventoryPage`; `tsc` y `vitest` en verde | S |
| TPM-P0-06 | Test RLS/BFF de aislamiento del vendedor externo y de `store_owner`: no accede a pedidos, productos ni `bank_data` de otra tienda | qa | `bff/src/routes/vendor.routes.test.ts`, `supabase/tests/tienda_v2/` | no | — | Caso con dos vendedores: cada uno ve 0 filas del otro en `products`, `orders`, `vendor_profiles` privados y `store_payment_settings` | S |
| TPM-P0-07 | Revisión línea por línea (sin aplicar) de las 3 migraciones del 13-oct: cupones por empresa, ingresos en finanzas, compra sin cuenta (`GRANT`, `search_path`, RLS, límites por correo/IP, guarda `service_role`, trigger sobre `auth.users`). **Corregir `docs/ROADMAP.md` línea 98 (fila 8)**: dice que abre RPCs a anon y el SQL solo otorga a `service_role` | db | `supabase/migrations/20261013170543_*.sql`, `20261013170548_*.sql`, `20261013170553_*.sql`, `docs/ROADMAP.md` | no | — | Checklist firmado por migración: todo `CREATE FUNCTION` con `search_path` fijo; ninguna RPC por token con `EXECUTE` para anon/authenticated (salvo `link_my_guest_orders`); `REVOKE` explícito de `authenticated` y `anon`; el trigger de `auth.users` no vincula pedidos con correo sin confirmar; ROADMAP corregido; todo hallazgo va como migración NUEVA | M |
| TPM-P0-08 | Verificar cuáles de las 3 están vivas (consulta a `pg_proc` por nombre: `store_income_summary`, `create_guest_cart_order`, la función de cupones) y aplicar las faltantes desde UNA sola sesión por una vía con rastro; regenerar `types.ts` una vez; correr `npm run seguridad:invariantes` | ops | `supabase/migrations_ledger.json`, `frontend/src/integrations/supabase/types.ts` | sí (aplicar existentes) | TPM-P0-07, frente:plataforma (sesión única de migraciones) | Faltantes registradas en `schema_migrations`; `seguridad:invariantes` con 0 críticos; `types.ts` regenerado una sola vez | S |
| TPM-P0-09 | Inventario de las 12 rutas de `marketplace-checkout.routes.ts`: cuáles mueven dinero, cuáles resuelven credenciales. Poner `requireStoreEnabled` (o `ensureUserNotBlocked` + propiedad del recurso) a `/checkout/session-booking`, `GET /transactions`, `GET /subscriptions` y `PATCH /subscriptions/:id/cancel`, sin romper reservas de bienestar | bff | `bff/src/routes/marketplace-checkout.routes.ts`, `docs/plan-cierre-ruteo-de-pagos.md` | no | — | Tabla ruta × (dinero, credenciales, gate) en el PR; `session-booking` no es vía de cobro fuera del gate; tests de ruta con flag apagado devuelven 503 en las que cobran; el hallazgo actualiza la cifra de MOD-11 en ROADMAP | M |
| TPM-P0-10 | Blindar la facturación electrónica antes del piloto: `autoEmitPendingOrders` solo emite para vendedores de la allowlist y solo en el BFF de producción; ninguna orden de prueba emite factura | bff | `bff/src/jobs/maintenance.job.ts` (296), `bff/src/services/invoicing.service.ts` (1764) | no | — | Test: orden pagada de tienda fuera de allowlist o con `NODE_ENV != production` no se emite; el job lee el lote con `.in('id', ids)` (sin N+1); 0 facturas DIAN reales en gemelo/staging | M |
| TPM-P0-11 | Presupuesto de Disk IO de la tienda: medir y, si hace falta, indexar `store_income_summary` (usada en Hoy, Ingresos y Tienda → Ventas), una lectura por tarjeta, sin polling por minuto | db | `supabase/migrations/20261013170548_*.sql`, `frontend/src/hooks/useStoreSalesInsights.ts` | no (si hay índice, migración nueva en el lote de P0-08 o de P1) | TPM-P0-08 | `EXPLAIN` en el gemelo con 5.000 órdenes < 200 ms; el dashboard no dispara más de una llamada por montaje; se anota el consumo antes y después | S |

### P1 — Piloto de la tienda escolar: GYM RM gratis 1 mes, luego Monster (semanas 1-4)

**Objetivo:** encender la tienda solo para la escuela piloto con allowlist que se cierra sola si queda vacía, con avisos de pedido, tienda dentro de la gestión, ventas en Ingresos, runbook de apagado y QA real; cobrar $49.000/mes desde el día 31 si la escuela sigue. Sin comisión al comprador; recargos solo si los decide quien cobra.

| id | título | capa | archivos | migración | depende de | aceptación | tamaño |
|---|---|---|---|---|---|---|---|
| TPM-P1-01 | **Plan de migraciones para aprobar (sin SQL):** (a) allowlist fail-closed: `NULL`/ausente = nadie vende, «abierta para todos» solo con `{"all":true}` explícito (alternativa: dejar la función y exigir el guard en el SQL de encendido; decisión del dueño); (b) mecanismo «piloto gratis 1 mes» del adicional `store`. Documento con las decisiones resueltas | contenido | `docs/specs/tienda-piloto-allowlist-y-gratis-1-mes.md` (nuevo) | no | TPM-P0-08 | Plan aprobado por el dueño por escrito; incluye pruebas SQL de aceptación; ninguna migración escrita antes | XS |
| TPM-P1-02 | Migración: `store_pilot_allowlist()` cierra todo si es NULL o clave ausente; `{"all":true}` explícito abre | db | `supabase/migrations/<nueva vía npm run migrations:new -- tienda_allowlist_fail_closed>.sql`, `supabase/migrations_ledger.json` | sí | TPM-P1-01 | Con `enabled=true` y allowlist NULL, `store_seller_allowed()` = false para «Tienda Club Campestre Demo»; con `[GYM RM]` = true solo para GYM RM; `search_path` fijo y `GRANT` explícito; `npm run migrations:check` en verde | S |
| TPM-P1-03 | Migración/mecanismo «gratis hasta <fecha>» del adicional `store` y paso a $49.000/mes (reusar el mecanismo común de pilotos del frente plataforma; si no existe, columna de fecha con `text + CHECK` en la tabla de adicionales). Aplica a todos los pilotos de este frente | db | `supabase/migrations/<nueva>.sql`, `frontend/src/config/saas-plans.ts` | sí | TPM-P1-01, frente:plataforma | Para GYM RM `has_entitlement('store')` = true hoy; ningún cobro durante el mes gratis; la factura SaaS del ciclo posterior al día 30 incluye la línea Tienda $49.000; la escuela ve en Mi plan «Tienda — gratis hasta <fecha>» | M |
| TPM-P1-04 | Notificaciones de la tienda: aviso a la escuela por pedido nuevo, comprobante por aprobar y cancelación; aviso al comprador por pedido listo para retiro; correo al invitado con el enlace y token de su pedido (Resend, ≤100 por llamada; WhatsApp solo si hay canal) | bff | `bff/src/routes/store-orders.routes.ts`, `bff/src/routes/store-guest.routes.ts`, `bff/src/services/notifications` (despachador unificado) | no | TPM-P0-08 | Cada evento crea una sola notificación (idempotente); el correo del invitado no expone datos de otros pedidos; test de ruta por evento; sin N+1 en envíos por lote | M |
| TPM-P1-05 | **N1** `SchoolStorePage` en `/tienda-escuela` con pestañas Pedidos / Productos / Inventario / Ventas / Ajustes montando las páginas existentes; un solo ítem «Tienda» en los árboles `school` y `school_admin`; `getVendorNavGroup` deja de usarse para roles de escuela | frontend | `frontend/src/pages/SchoolStorePage.tsx` (nuevo), `frontend/src/config/navigation.ts`, `frontend/src/components/AppSidebar.tsx`, `frontend/src/App.tsx` | no | TPM-P0-05 | El owner y un `school_admin` no dueño ven el mismo ítem y entran sin pasar por `/vendor/onboarding`; test que compara los dos árboles; Ventas usa `store_income_summary`; nada de tienda sin el adicional | M |
| TPM-P1-06 | **N2** Conteo unificado «por aprobar» (pagos y comprobantes de tienda) en Pagos, en la tarjeta «Pedidos por entregar» de Hoy y en el badge del menú | frontend | `frontend/src/hooks/usePendingApprovals.ts` (nuevo), `frontend/src/pages/PaymentsAutomationPage.tsx`, `frontend/src/pages/DashboardPage.tsx` | no | TPM-P1-05 | El indicador coincide con la lista; aprobar un comprobante desde Pagos deja la orden igual que desde Tienda → Pedidos (E2E local); una lectura por fuente | M |
| TPM-P1-07 | **N3** Vitrina del acudiente dentro del shell: `MiTiendaPage` monta la vitrina con prop `embedded` (`mi-tienda/p/:id`, `mi-tienda/carrito`); «Mis compras» en Pagos y compras; `/tienda/:slug` público sigue funcionando | frontend | `frontend/src/pages/MiTiendaPage.tsx`, `frontend/src/pages/TiendaPublicaPage.tsx`, `frontend/src/pages/MyPaymentsPage.tsx`, `frontend/src/components/navigation/MobileBottomNav.tsx` | no | TPM-P1-05, frente:familias | Un padre compra desde la app a 360 px sin perder la barra inferior; ve mensualidad y compra en la misma pantalla de Pagos (pagadas por separado, nunca fusionadas) | M |
| TPM-P1-08 | `VendorDashboardPage` solo para vendedores externos (roles de escuela redirigen a `/tienda-escuela`); «Ingresos (30 días)» cuadra con `store_income_summary` | frontend | `frontend/src/pages/vendor/VendorDashboardPage.tsx`, `frontend/src/components/vendor/VendorGuard.tsx` | no | TPM-P1-05 | Un `school_admin` en `/vendor/dashboard` termina en `/tienda-escuela`; para un vendedor externo de prueba, ventas de 30 días = suma de órdenes pagadas netas de reembolsos | S |
| TPM-P1-09 | QA real en el gemelo local (Docker + Supabase local con dump; nunca la base viva para escribir): comprador con cuenta e invitado, cupón, comprobante, aprobación, código de retiro, cancelación, reembolso, concurrencia del último ítem, RLS R1-R3, notificaciones de P1-04 | qa | `bff/src/routes/store-v2.routes.test.ts`, `bff/src/routes/store-guest.routes.test.ts`, `supabase/tests/tienda_v2/`, `docs/manuales/_src/docker-gemelo/` | no | TPM-P0-08, TPM-P0-10, TPM-P1-04, TPM-P1-06, TPM-P1-07 | Setup aborta si `SUPABASE_URL` contiene `luebjarufsiadojhvxgi` o la llave empieza por `pub_prod_`; dos compradores del último ítem: uno ok y otro `SIN_STOCK`; anon no lee `school_only` ni `bank_data`; invitado: límite por correo/IP respetado; la venta aparece en Ingresos del gemelo; capturas como evidencia | L |
| TPM-P1-10 | Runbook del piloto: apagar la tienda de una escuela (quitarla de la allowlist sin borrar datos), reembolso y cancelación manuales, quién aprueba comprobantes (el dueño de GYM RM o a quien delegue) y SLA de respuesta propuesto | contenido | `docs/runbooks/tienda-piloto.md` (nuevo) | no | TPM-P1-02 | Runbook probado en el gemelo: quitar de allowlist deja la vitrina en «no disponible» y conserva pedidos; SLA aprobado por el dueño de GYM RM | S |
| TPM-P1-11 | Encender la tienda de GYM RM ejecutando `docs/migraciones-para-aplicar-2026-10-08/PROPUESTA_habilitar_tienda_gym_rm.sql` bloque por bloque y por una vía con rastro: flag y allowlist en la **misma** sentencia; `store_payment_settings` con nequi/daviplata/breb; verificar `vendor_profile` | ops | `docs/migraciones-para-aplicar-2026-10-08/PROPUESTA_habilitar_tienda_gym_rm.sql` | sí (cambio de datos con rastro) | TPM-P1-02, TPM-P1-03, TPM-P1-09, TPM-P1-10 | `store_enabled()` = true; `store_pilot_allowlist()` = `[vendor 259bc441…]`; `/tienda/<slug GYM RM>` muestra los 73 productos; `/tienda/<slug Campestre>` dice «no disponible»; la escuela recibe aviso «piloto gratis hasta <fecha>» | S |
| TPM-P1-12 | Smoke en producción, solo lectura: vitrina, ficha, carrito sin pagar, menú; ninguna otra tienda vende; `autoEmitPendingOrders` no factura pedidos de prueba | qa | — | no | TPM-P1-11 | Capturas de la vitrina GYM RM en celular; ninguna orden escrita por QA en prod; Campestre Demo responde «no disponible»; `seguridad:invariantes` = 0 críticos | S |
| TPM-P1-13 | Kit de lanzamiento GYM RM: manual de Tienda escolar con capturas reales (2 versiones, patrón único de PDFs), mensaje de WhatsApp para socios con `/tienda/<slug>` y artículo de Mapi «cómo comprar en la tienda de tu gimnasio» | contenido | `docs/manuales/` | no | TPM-P1-11 | PDF con 2 versiones y artículo Mapi; mensaje aprobado por el dueño de GYM RM antes de enviarse | S |
| TPM-P1-14 | Piloto gratis 1 mes con GYM RM: cortes semanales con las métricas de la sección 3 y decisión de cobro el día 30 | ventas | — | no | TPM-P1-11, TPM-P1-03 | 4 cortes registrados con cifras de `store_income_summary`; el día 30 hay respuesta escrita (sigue a $49.000/mes o se apaga quitándola de la allowlist sin borrar datos) | S |
| TPM-P1-15 | Segundo piloto con Monster (gratis 1 mes) cuando tenga ≥1 cuenta de recaudo y montos de mensualidad cargados | ventas | — | no | TPM-P1-14, frente:escuela | `vendor_profile` escolar verificado; se agrega a la allowlist en una sentencia con rastro; primera venta real registrada | S |

### P2 — Vendedor externo y «Proveedor recomendado para escuelas» (semanas 4-7)

**Objetivo:** retirar el rol legado `store_owner` sin perder al usuario real y abrir un directorio B2B curado: las escuelas piden contacto a confeccionistas y proveedores verificados; el proveedor paga una cuota fija tras el primer mes gratis; a la familia no se le cobra nada.

| id | título | capa | archivos | migración | depende de | aceptación | tamaño |
|---|---|---|---|---|---|---|---|
| TPM-P2-01 | Verificar con consulta puntual cuántos usuarios `store_owner` hay y qué datos tienen; plan aprobado y migración con rastro: pasan a vendedor externo (`vendor_profiles.vendor_type` externo y rol coherente) sin borrar historial | db | `supabase/migrations/<nueva vía migrations:new -- store_owner_a_vendedor_externo>.sql` | sí | TPM-P0-05, TPM-P0-06 | El dueño confirma por escrito antes de aplicar; después `count(profiles.role='store_owner')` = 0; el usuario entra y llega a `/vendor/dashboard` con sus productos; no se borran datos de prueba | S |
| TPM-P2-02 | Retirar `store_owner` del frontend y del BFF: árbol de navegación, `allowedRoles` y rutas legadas como redirecciones (sin borrar páginas sin confirmación) | frontend | `frontend/src/config/navigation.ts`, `frontend/src/App.tsx`, `bff/src/routes/vendor.routes.ts` | no | TPM-P2-01 | `grep -rn "store_owner" frontend/src bff/src` deja solo compatibilidad documentada; `/products`, `/customers`, `/categories`, `/promotions`, `/suppliers` redirigen; `tsc` en verde | S |
| TPM-P2-03 | Spec y plan de migraciones del directorio: `recommended_suppliers` (`status` text+CHECK `pilot|active|paused`, categorías, ciudades, FK a `profiles`), `supplier_contact_requests` y RPC `request_supplier_contact` `SECURITY DEFINER` con límite por escuela. Lectura con `user_staff_school_ids()`; escritura del directorio solo `super_admin` | db | `docs/specs/proveedor-recomendado-escuelas.md` (nuevo), `supabase/migrations/<nueva>.sql` | sí | TPM-P2-01 | Spec con decisiones resueltas y plan aprobado ANTES del SQL; pruebas RLS: padre/atleta no leen directorio ni solicitudes, coach lee y no edita, anon 0 filas; ninguna policy `FOR ALL` sin `WITH CHECK`; `seguridad:invariantes` en verde | M |
| TPM-P2-04 | BFF: `GET /api/v1/suppliers/recommended`, `POST /api/v1/suppliers/:id/contact` (llama a la RPC y avisa al proveedor por Resend) y CRUD de `super_admin` | bff | `bff/src/routes/suppliers-recommended.routes.ts`, `docs/api/openapi.yaml` | no | TPM-P2-03 | Rol sin staff recibe 403; el límite devuelve 429; el correo al proveedor no expone datos de menores (solo escuela, contacto del staff, categoría y cantidad estimada); OpenAPI actualizado | M |
| TPM-P2-05 | Frontend: pestaña «Proveedores recomendados» dentro de Tienda con filtro (uniformes, balones, trofeos, dotación) y «Pedir contacto»; página de curaduría en admin | frontend | `frontend/src/pages/SchoolStorePage.tsx`, `frontend/src/pages/admin/AdminRecommendedSuppliersPage.tsx`, `frontend/src/config/navigation.ts` | no | TPM-P2-04, TPM-P1-05 | Un `school_admin` pide contacto y el proveedor recibe el correo; no se mezcla con `AccountingSuppliersPage` (gastos); funciona a 360 px | M |
| TPM-P2-06 | El formulario «Quiero ser proveedor recomendado» de la landing alimenta la cola de curaduría (o envía un correo con enlace a ella) | landing | `landing:src/components/forms/ProveedoresRegistroForm.tsx` | no | TPM-P0-01, TPM-P2-04 | Un envío de prueba aparece en la cola con `status` `pilot`; no se crea cuenta automática | S |
| TPM-P2-07 | Cuota fija del proveedor recomendado con piloto gratis 1 mes, sobre la facturación SaaS multi-rol | bff | `frontend/src/config/saas-plans.ts`, `bff/src/services` de facturación SaaS | sí | frente:plataforma, TPM-P2-03, TPM-P1-03 | Un proveedor `pilot` no genera factura durante 30 días; el día 31 se emite la cuota con el precio que fije el dueño; uno `paused` desaparece del directorio | M |
| TPM-P2-08 | QA real del directorio en el gemelo: roles padre, coach, staff, admin y anon; solicitudes con límite; correo recibido en buzón de prueba | qa | — | no | TPM-P2-05, TPM-P2-06 | Matriz rol × acción en verde con capturas; ninguna escritura en prod | S |
| TPM-P2-09 | Piloto gratis 1 mes con 3 confeccionistas o proveedores reales (uniformes para Dynasty/Besser/Monster/GYM RM) | ventas | — | no | TPM-P2-08 | 3 proveedores `pilot` con fecha de fin; ≥3 solicitudes de contacto de escuelas reales en el mes; decisión de cobro registrada el día 30 | S |

### P3 — Marcas aliadas v0 (semanas 6-10)

**Objetivo:** darle a una marca algo operable y medible: un beneficio (código de descuento) en el Inicio del acudiente y el patrocinio de la primera reserva de cancha, con reporte agregado; sin segmentar menores, sin vender datos, gratis el primer mes.

| id | título | capa | archivos | migración | depende de | aceptación | tamaño |
|---|---|---|---|---|---|---|---|
| TPM-P3-01 | Spec Marcas aliadas v0 con decisiones resueltas: qué ve la familia, qué recibe la marca (vistas y canjes agregados, umbral k=10 por celda), qué está prohibido (datos personales, segmentar por edad de menores), apagado por escuela, sección legal (Ley 1581) | contenido | `docs/specs/marcas-aliadas-v0.md` (nuevo) | no | TPM-P0-01 | Spec aprobado por el dueño con plan de migraciones incluido | S |
| TPM-P3-02 | Migraciones: `brand_partners` (`status` text+CHECK), `brand_benefits` (código, vigencia, escuelas opt-in), `brand_benefit_daily_counts` (agregado, sin `user_id`) y RPCs `record_benefit_event` / `brand_benefit_report` `SECURITY DEFINER` con `search_path` y `GRANT` explícitos | db | `supabase/migrations/<nueva vía migrations:new -- marcas_aliadas_v0>.sql` | sí | TPM-P3-01 | Ninguna tabla guarda `user_id` ni `athlete_id`; anon lee 0 filas; el reporte suprime celdas < 10; evento duplicado del mismo usuario en el día no infla el conteo (dedup por hash diario no reversible); opt-in por escuela con `user_admin_school_ids()` | M |
| TPM-P3-03 | BFF: CRUD de `super_admin` de marcas y beneficios, registro de vista/canje y reporte por enlace con token (RPC que recibe el token, no una policy `_by_token`) | bff | `bff/src/routes/brand-partners.routes.ts`, `docs/api/openapi.yaml` | no | TPM-P3-02 | Token inválido o vencido da 404; el reporte solo devuelve agregados; registrar eventos en lote, sin N+1 | M |
| TPM-P3-04 | Frontend: tarjeta «Beneficios de aliados» en el Inicio del acudiente y del atleta adulto, interruptor de la escuela en Configuración, admin de marcas y página de reporte | frontend | `frontend/src/components/dashboard/BrandBenefitsCard.tsx`, `frontend/src/pages/admin/AdminBrandPartnersPage.tsx`, `frontend/src/pages/BrandReportPage.tsx` | no | TPM-P3-03, frente:familias | Sin opt-in de la escuela la tarjeta no aparece; el canje copia el código y cuenta 1; nunca hay un anuncio que la escuela no pueda apagar | M |
| TPM-P3-05 | Patrocinio de la «primera reserva de cancha con descuento» pagado por la marca: el descuento lo absorbe la marca, no la cancha ni SportMaps | bff | `bff/src/routes/public-booking.routes.ts` | sí | TPM-P3-02, frente:canchas | La reserva con código cobra al jugador el precio con descuento; la cancha recibe el precio completo (la diferencia queda como cuenta por cobrar a la marca); el reporte muestra canjes agregados | L |
| TPM-P3-06 | Enganche de premios de SportPoints puestos por marcas aliadas (el motor es de otro frente) | bff | — | no | TPM-P3-02, frente:sportpoints | Un beneficio puede marcarse como premio canjeable por puntos sin duplicar la tabla de beneficios | S |
| TPM-P3-07 | QA real de marcas en el gemelo: opt-in/opt-out por escuela, k-anonimato, token de reporte y prueba de que no se filtran datos de menores (búsqueda de columnas en la respuesta) | qa | — | no | TPM-P3-04 | Ninguna respuesta del reporte contiene nombre, correo, teléfono, edad ni id de usuario; celdas < 10 se muestran como «<10» | S |
| TPM-P3-08 | Piloto gratis 1 mes con 2-3 marcas locales (sin precio publicado) y las escuelas que acepten | ventas | — | no | TPM-P3-07 | 2 marcas activas con beneficio vigente; reporte del mes entregado; decisión de precio por campaña registrada tras el piloto | S |

### P4 — Tienda v2 completa y marketplace global, con gate (semana 10 en adelante)

**Objetivo:** terminar lo que falta de tienda v2 y, solo con tracción probada, desplegar el marketplace global multi-vendor con ruteo de pagos correcto.

| id | título | capa | archivos | migración | depende de | aceptación | tamaño |
|---|---|---|---|---|---|---|---|
| TPM-P4-01 | Tienda v2 F1: kardex append-only, variante «Única», alertas de stock bajo e importación CSV (verificar primero lo que ya hizo `20261008163938`) | db | `docs/specs/tienda-v2-estilo-mercadolibre.md`, `supabase/migrations/<nueva>.sql` | sí | TPM-P1-14 | Stock solo mutado por RPC con `FOR UPDATE`; test de concurrencia en verde; el kardex cuadra con `products.stock` en el gemelo | L |
| TPM-P4-02 | Tienda v2 F2-F3: `product_media` con buckets y policies, puntaje de calidad, búsqueda (`search_tsv`, GIN/trgm) y arreglo de `search_marketplace`; medir Storage antes y después | db | `supabase/migrations/<nueva>.sql`, `frontend/src/components/vendor/product-wizard/ProductWizard.tsx` | sí | TPM-P4-01 | Anon no lee medios de borradores (R2); búsqueda < 300 ms con 1.000 productos en el gemelo; uso de Storage medido | L |
| TPM-P4-03 | Gate MOD-11 / F-D: `resolveProvider` en toda ruta de `marketplace-checkout.routes.ts` que cree dinero, antes de crear `marketplace_transactions`, usando el inventario de TPM-P0-09 (incluye `session-booking`) | bff | `bff/src/routes/marketplace-checkout.routes.ts`, `docs/plan-cierre-ruteo-de-pagos.md` | no | TPM-P0-09, frente:pagos-ruteo | Con la variable de entorno de Dynasty presente, un checkout de la tienda X nunca usa credenciales de Dynasty; toda ruta que cobra llama a `resolveProvider` (test por ruta) | M |
| TPM-P4-04 | Marketplace global v1: catálogo de vendedores verificados con productos públicos, split por vendedor (una pasarela por tienda) y moderación admin. Arranque: ≥5 tiendas vendiendo | frontend | `frontend/src/pages/MarketplacePage.tsx`, `bff/src/routes/marketplace-catalog.routes.ts`, `frontend/src/pages/admin/AdminMarketplaceModerationPage.tsx` | sí | TPM-P4-03, TPM-P4-02, TPM-P2-09 | Productos `school_only` nunca aparecen; cada pago va a la pasarela del vendedor; sin comisión al comprador; la landing solo lo anuncia después de este criterio | XL |
| TPM-P4-05 | QA real E2E del marketplace en QA (Wompi sandbox): carrito de 2 vendedores, devolución, factura electrónica que no se emite en pruebas | qa | — | no | TPM-P4-04 | Dos órdenes, una por vendedor, cada una cobrada en su pasarela sandbox; 0 facturas DIAN reales; capturas en celular | M |

---

## 3. Piloto gratis de 1 mes

**A quién y cuándo**

| Piloto | Quién | Arranque | Precio después |
|---|---|---|---|
| Tienda escolar #1 | GYM RM (73 productos ya cargados) | tras TPM-P1-11 | $49.000/mes del adicional `store` desde el día 31 |
| Tienda escolar #2 | Monster Volley (cuando tenga cuentas de recaudo y montos) | tras TPM-P1-15 | igual |
| Proveedor recomendado | 3 confeccionistas o proveedores reales | tras TPM-P2-08 | cuota fija a definir por el dueño |
| Marcas aliadas | 2-3 marcas locales + escuelas con opt-in | tras TPM-P3-07 | sin precio publicado; por campaña tras el piloto |

Sin comisión al comprador en ninguno. Los recargos, si existen, los decide quien cobra.

**Qué se mide (corte semanal, tienda escolar)** — todo desde `store_income_summary` y `orders`, sin consultas pesadas:
1. Pedidos pagados y monto vendido (neto de reembolsos).
2. Compradores únicos y % que compra sin cuenta (invitado).
3. Comprobantes por aprobar y tiempo medio de aprobación (SLA).
4. Pedidos entregados vs. pendientes de retiro.
5. Cancelaciones y reembolsos.
6. Incidentes (errores de pago, SIN_STOCK, pedidos duplicados).

**Criterio de éxito (propuesto; el dueño lo confirma antes del arranque):** al día 30, ≥ 1 venta pagada por semana en al menos 3 de las 4 semanas, 0 incidentes de dinero sin resolver, tiempo medio de aprobación dentro del SLA acordado y respuesta escrita de la escuela. Si cumple y quiere seguir, pasa a $49.000/mes; si no, se apaga quitándola de la allowlist sin borrar datos.

**Proveedores:** ≥ 3 solicitudes de contacto reales de escuelas en el mes. **Marcas:** ≥ 2 marcas con beneficio vigente, reporte entregado y ≥ 1 canje real agregado (sin datos individuales).

---

## 4. Decisiones abiertas

1. ¿El primer piloto de tienda es GYM RM (listo) y Monster el segundo, o se mantiene Monster primero como dice el plan maestro (E6)? Este backlog asume GYM RM primero porque Monster no tiene cuentas de recaudo.
2. Allowlist fail-closed: ¿migración (NULL→cierra, `{"all":true}` abre) o solo guard en el SQL de encendido? Hoy `'{}'` ya cierra todo; solo NULL o clave ausente abre. Decisión de producto.
3. ¿`/marketplace` y `/shop` redirigen a la tienda de la escuela o muestran «Próximamente»? Se mantiene `/marketplace/service/:id` para bienestar. Se decide tras TPM-P0-03.
4. Retirar `store_owner`: el dueño confirma la migración del usuario real y si las páginas legadas se borran o solo se redirigen.
5. Precio de la cuota del «Proveedor recomendado» después del mes gratis (no hay referencia validada; no usar los $149k/$399k de la landing vieja).
6. Marcas: ¿reporte por enlace con token o cuenta/rol de marca? Se propone token para no abrir un rol nuevo.
7. ¿Qué marcas locales y qué escuelas aceptan el opt-in del piloto?
8. ¿La «primera reserva con descuento» la paga la marca a SportMaps o directamente a la cancha?
9. ¿Cuándo se habilita el marketplace global? Propuesta: ≥5 tiendas escolares vendiendo y gate F-D cerrado.
10. Quién aprueba comprobantes en GYM RM y SLA aceptable (TPM-P1-10).
11. Umbral de éxito del piloto (sección 3): confirmar o ajustar.

---

## 5. Riesgos

- **Encender sin allowlist:** NULL abre todas las tiendas, incluida la demo Campestre. Mitigación: TPM-P1-02 antes de TPM-P1-11 y flag + allowlist en la misma sentencia.
- **`store_enabled` es corte global de interfaz:** al encenderlo, las pantallas de tienda aparecen para escuelas con el adicional aunque no estén en la allowlist (verán «no disponible»). Mitigación: TPM-P0-03/04.
- **Facturación DIAN real:** `autoEmitPendingOrders` emite por orden pagada. Mitigación: TPM-P0-10; ninguna orden de prueba en prod.
- **Estado de las 3 migraciones del 13-oct sin verificar en la viva** y fila 8 del ROADMAP engañosa. Mitigación: TPM-P0-07/08.
- **Checkout del marketplace con rutas sin gate** (`session-booking`, `transactions`, `subscriptions`): hoy contenidas por la ausencia de uso, no por diseño. Mitigación: TPM-P0-09.
- **Una sola base compartida y plan Pro con optimización vigente:** el piloto y el directorio no deben sumar jobs por minuto con N+1; los medios de producto (P4) presionan Storage. Mitigación: TPM-P0-11 y presupuesto de consultas por tarea.
- **Monster no está listo para ser primero** (sin cuentas de recaudo ni montos).
- **Cifras sin fuente en landing:** toda cifra publicada de audiencia debe salir de consulta puntual o spec medido (repite el problema de «+10.000»).
- **Patrocinio y menores:** un reporte que reidentifique familias o menores es riesgo legal (Ley 1581). Mitigación: k=10, sin `user_id`, TPM-P3-07.
- **Sesiones paralelas:** varias sesiones trabajan en `develop` con índice compartido; commitear solo lo propio y una sola sesión aplica migraciones.
- **Operación del piloto sin runbook:** reembolsos y aprobaciones manuales dependen de una persona en la escuela. Mitigación: TPM-P1-10.

---

## 6. Correcciones del revisor que se aplicaron

| Corrección | Qué se hizo |
|---|---|
| Landing Equipamiento ya limpia (sin Nike/24-48 h/GPS/devoluciones) | Se eliminó la reescritura de Equipamiento. TPM-P0-01 solo verifica el preview y los assets `tienda-*.jpg` sin uso |
| Marcas y Proveedores ya sin $199k/$549k/$149k/$399k/+10.000 | Se acotó el barrido a `RolePricingCard.tsx` (marcas y proveedores), `SportMapsFooter.tsx:90` y `/equipamiento` en sitemap/prerender |
| Landing sin cambios sin commitear | Se quitó el riesgo y la tarea de coordinación; solo queda «confirmar `git status` limpio antes de tocar» dentro de P0-01 |
| `/shop` y `/marketplace/product/:id` ya van con `StoreGate`; el hueco real es el listado con flag encendido | TPM-P0-07 original pasó a TPM-P0-03/04: primero probar RLS/BFF con flag=true y después decidir redirect; se mantiene `/marketplace/service/:id` |
| Checkout tiene 12 rutas y 4 sin `requireStoreEnabled` (incl. `session-booking`) | Nueva TPM-P0-09 con inventario y gate; TPM-P4-03 depende de ese inventario y cubre todas las rutas que mueven dinero |
| «abre RPCs a anon» no se encontró en el ROADMAP | **Verificado en el repo:** está en `docs/ROADMAP.md` línea 98 (fila 8). Se conserva la tarea de corregirla en TPM-P0-07, tras revisar la migración (solo `service_role`) |
| Allowlist: `'{}'` ya cierra, solo NULL/ausente abre | Se mantuvo la tarea pero justificada y convertida en decisión de producto (migración o guard en el SQL de encendido) |
| Plan aprobado antes del SQL de P1-01/P1-02 | TPM-P1-01 es ahora solo el plan (sin SQL); el SQL va en TPM-P1-02 y TPM-P1-03 |
| Números de línea desactualizados | Referencias corregidas: `App.tsx` 419-423, 492, 995-1015, 1024-1033; `navigation.ts` 588-616 |
| Faltante: QA/RLS del listado `/marketplace` con flag | TPM-P0-03 |
| Faltante: notificaciones de la tienda y correo al invitado | TPM-P1-04 |
| Faltante: guard de `autoEmitPendingOrders` antes de encender | TPM-P0-10 |
| Faltante: gate de pagos en `session-booking`, `transactions`, `subscriptions` | TPM-P0-09 y TPM-P4-03 |
| Faltante: runbook de apagado, reembolsos, aprobador y SLA | TPM-P1-10 |
| Faltante: aislamiento de `store_owner`/vendedor externo y verificación del usuario real | TPM-P0-06 y paso de verificación en TPM-P2-01 |
| Faltante: presupuesto de Disk IO | TPM-P0-11 |
| Faltante: métricas y umbral de decisión del piloto | Sección 3 y TPM-P1-14 |
