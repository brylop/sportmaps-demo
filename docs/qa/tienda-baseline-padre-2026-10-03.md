# QA base — cómo compra HOY un padre en la tienda escolar (2026-10-03)

**Ambiente:** frontend `https://dev.sportmaps.co` (despliegue de `origin/develop` = `5f71d292`, **sin** la Fase 1 de blindaje `735c8869`). El frontend de dev llama al BFF `https://sportmaps-bff-dev.onrender.com` (no a `bffdev.sportmaps.co`, que responde lo mismo). Base: la única Supabase (`luebjarufsiadojhvxgi`).
**Escuela:** Club Campestre Demo (`25a123f0-…`, `is_demo=true`). Cuentas: `gerencia@` (owner), `mherrera@` (padre), `familia.rojas@` (segunda familia).
**Spec:** [`frontend/e2e/qa-discovery/tienda-padre-compra.spec.ts`](../../frontend/e2e/qa-discovery/tienda-padre-compra.spec.ts) — `npx playwright test -c playwright.qa-discovery.config.ts tienda-padre-compra` (⚠️ los tests `1b`, `1d` y `4` **escriben** datos; no repetirlos sin borrar antes lo de §4).
**Capturas y log de red:** [`docs/capturas/tienda-baseline/`](../capturas/tienda-baseline/) (`_log.jsonl` tiene cada llamada a BFF/Supabase con su respuesta).
**Pagos:** no se completó ningún pago. No se abrió Wompi ni Mercado Pago (el checkout nunca llegó a habilitar el botón). Ninguna orden quedó `paid`; el `paid` se probó solo dentro de `BEGIN … ROLLBACK`.

> **En una línea.** Hoy un padre **no puede comprar nada** en la tienda escolar: el checkout queda bloqueado para siempre por un error de envío (origen vacío hardcodeado). Además la escuela no puede publicar sin que un super admin la verifique, la camiseta con tallas sale "Agotado", el producto "solo socios" no lo ve nadie, la escuela ve pedidos pero no puede gestionarlos, y el comprador reescribe total y estado de su orden por REST (T3/T4 confirmados).

---

## 1. Paso → resultado

| # | Paso | Resultado | Evidencia |
|---|---|---|---|
| 1.1 | Addon `store` en Club Campestre | **OK** (ya estaba `enabled=true`) | SQL `school_addons` |
| 1.2 | Owner encuentra cómo activar la tienda en su menú | **Ausente** — sin `vendor_profile` el sidebar no muestra nada de tienda; se entró por URL `/vendor/onboarding` | `1a-01-owner-dashboard.png` |
| 1.3 | Onboarding `/vendor/onboarding` (3 pasos) | **OK** — crea `vendor_profile` `vendor_type='school'`, slug `tienda-club-campestre-demo`, `verification_status='pending'` | `1b-01…04` |
| 1.4 | "Omitir por ahora" en el paso 3 | **Roto (menor)** — vuelve al paso 1 "Configura tu Tienda" en vez de ir al panel; la ciudad guardada aparece vacía | `1b-05-vendor-dashboard.png` |
| 1.5 | Menú del owner tras activar | **OK** — aparece grupo de vendedor (Productos, Inventario, Pedidos, Inbox, Liquidaciones, Envíos, Promociones, "Verificación pendiente") | `1c-01-vendor-dashboard.png` |
| 1.6 | Wizard: P1 camiseta con tallas S/M/L × Verde, stock 5 c/u | **OK con reparos** — crea producto + 3 variantes; la publicación tarda > 3 s (botón queda girando) | `1d-P1-01…04` |
| 1.7 | Wizard: P2 gorra stock 1 / P3 termo `school_only` stock 10 | **OK** — creados | `1d-P2-*`, `1d-P3-*` |
| 1.8 | "Publicar ahora" | **Bloqueado** — los 3 quedan `pending_review` (vendedor no verificado). La escuela **no puede vender** sin que un super admin la verifique. Se sembró por SQL (ver §4) | `1e-01-vendor-products.png` (muestra el estado crudo `pending_review`) |
| 1.9 | `school_id` de los productos | **Roto** — el BFF ignora `school_id` a propósito y no lo deduce: los 3 quedan `school_id = NULL` | SQL |
| 2.1 | Padre encuentra "Tienda" en el menú | **OK** — grupo "Seguimiento" → Tienda (escritorio y móvil). En el primer intento con el grupo colapsado no se ve sin abrirlo | `2c-01b-menu-tienda.png`, `5-01b-menu-tienda.png` |
| 2.2 | `/mi-tienda` → `/tienda/:slug` | **OK** | `2a-02-vitrina.png`, `2c-02-vitrina.png` |
| 2.3 | Vitrina muestra los productos | **Parcial** — gorra OK; camiseta con tallas sale **"Agotado"** (mira `products.stock=0`, el stock vive en variantes); termo `school_only` **no aparece** | `2a-02-vitrina.png` |
| 2.4 | Ficha de producto | **Ausente** — tocar la tarjeta no hace nada; no hay ficha ni selector de talla | log `2a-ficha` |
| 2.5 | Agregar al carrito | **OK** (solo gorra; la camiseta no tiene botón) | `2a-03-vitrina-con-carrito.png` |
| 2.6 | Cantidad en el carrito | **Roto** — deja subir a 4 unidades con stock 1, sin aviso | `2a-05-carrito-cantidad-4-stock-1.png` |
| 2.7 | Checkout `/checkout` | **Roto (bloqueante)** — exige dirección de envío (no hay "retiro en sede") y al llenarla la cotización falla `400 origin.address_line` → "Selecciona una opción de envío" y el botón **Pagar** queda deshabilitado para Wompi **y** para transferencia | `2a-07-checkout-envio.png`, `2a-09-transferencia.png`, `2c-05-checkout-bloqueado.png` |
| 2.8 | Pago por transferencia / comprobante | **Roto / ausente** — muestra una cuenta **inventada** hardcodeada ("Bancolombia 123-456789-00"), no la de la escuela; no hay campo para subir comprobante | `2a-09-transferencia.png` |
| 2.9 | Pago Wompi | **No probado (bloqueado antes)**. El bundle de dev trae `pub_test_ggS32t…` como fallback, pero la llave real la entrega `/wompi-sign` del BFF (llaves globales, según el coordinador las de Dynasty). `/checkout/cart` devolvió `publicKey:null, sandbox:true` | `4-BFF-cart-qty1` en `_log.jsonl` |
| 2.10 | Segunda familia (Rojas) | **Igual que 2.1–2.8** — mismo bloqueo | `2c-*` |
| 2.11 | Camino alterno `/shop` (CartCheckoutModal → BFF `/checkout/cart`) | **No accesible desde el menú**; mezcla productos de otras escuelas ("Balón Fútbol Pro (Demo)", "Uniforme Thunder (Demo)"…) | `2b-01-shop.png` |
| 3.1 | Escuela ve el pedido (`/orders`) | **OK con reparos** — ve las 3 órdenes, pero "Cliente" sin nombre e "Items 0" fijo; ve como venta real la orden de $1 manipulada | `3-01-pedidos.png` |
| 3.2 | Escuela gestiona el pedido (preparar / entregar) | **Ausente** — "Ver" no tiene acción; no hay ningún botón de estado | `3-02-pedido-detalle.png` |
| 3.3 | Notificación a la escuela | **Ausente** — ninguna "Nueva venta" (el flujo del carrito notifica por `vendorId`, que la vitrina no manda) | `3-03-notificaciones.png` |
| 3.4 | `/accounting` | **N/A** — el addon `accounting` está apagado en la demo (pantalla de upsell). La tienda no entra al libro de todos modos (D-H) | `3-04-accounting.png` |
| 3.5 | Panel vendedor | **Inconsistente** — "1 orden, $0 ingresos" vs. 3 pedidos en `/orders` | `3-05-vendor-dashboard.png` |
| 4.x | Ataques REST del padre | ver §3 | `_log.jsonl` (`4-*`) |
| 5 | Móvil Pixel 7 | **Mismo bloqueo**; sin scroll horizontal (0 px). En la captura de página completa la barra inferior (Inicio/Hijos/Pagos/Chat) tapa el botón "Pagar" — verificarlo a mano (la captura de página completa puede desplazar los elementos fijos) | `5-01…05` |

---

## 2. Hallazgos (lo más grave primero)

| ID | Sev. | Hallazgo | Evidencia |
|---|---|---|---|
| **B1** | **CRÍTICA (funcional)** | **Ningún padre puede pagar un producto.** `CheckoutPage.tsx:459` manda `origin={{ address_line: '' , city:'Bogotá' }}` hardcodeado; el BFF (`shipping.routes.ts:50`, `z.string().min(2)`) responde 400; `ShippingSelector` deja `shippingOption=null` y `canPay` exige envío para cualquier método. Afecta a **todas** las tiendas, no solo la demo | `2a-07`, `2c-05`, `5-05`; log `2a:write … shipping/quote 400` |
| **B2** | **ALTA** | **Cuenta bancaria falsa en la transferencia**: el checkout muestra "Bancolombia 123-456789-00" hardcodeado. Un padre que transfiera le manda plata a una cuenta que no es de la escuela | `2a-09-transferencia.png`, `CheckoutPage.tsx` |
| **T3** | **CRÍTICA (confirmado)** | El comprador cambia **total** (`180000 → 1000`), **estado** (`processing`) y hasta un estado inventado (`qa_estado_inventado`) de su orden por REST: todos 200. `paid` probado como el padre dentro de `BEGIN…ROLLBACK`: **pasa** (con `total_amount=1`) → el cron emitiría factura DIAN | log `4-T3a/b/c`; SQL con rollback |
| **T4** | **CRÍTICA (confirmado)** | El comprador crea una orden de $1 y un `order_item` de la camiseta talla M con `unit_price=1` y **`vendor_id` = él mismo**: 201. La escuela la ve como pedido real de $1 | log `4-T4`; `3-01-pedidos.png` (ORD-45A5FF41 $1) |
| **T1** | **CRÍTICA (sigue viva por el BFF)** | En la base `anon` ya **no** lee `bank_data` (grants por columna aplicados), pero `GET /api/v1/marketplace/vendor/:slug` (público, service role, `select('*')`) devuelve `bank_data`, `commission_rate`, `verification_doc_url` sin login. Comprobado con `curl` sobre la tienda demo | `curl …/marketplace/vendor/tienda-club-campestre-demo` |
| **B3** | **ALTA** | **Productos con variantes = invendibles**: la vitrina usa `products.stock` (0 cuando el stock está en variantes) → "Agotado"; no hay selector de talla ni ficha | `2a-02-vitrina.png` |
| **B4** | **ALTA** | **`school_only` no funciona**: el BFF crea productos con `school_id=NULL` y la policy `products_select_school_members` exige `school_id IS NOT NULL`; además la vitrina filtra `visibility='public'`. El termo solo socios no lo ve nadie, ni por UI ni por REST | log `4-school_only-visible-padre` = `[]` |
| **B5** | **ALTA** | **La escuela no puede publicar sola**: todo producto de un vendedor no verificado queda `pending_review` (trigger `enforce_product_publish_gate`), aun siendo `vendor_type='school'` con addon pagado. Ni siquiera un super admin puede activarlo sin verificar antes al vendedor | `1e-01`; SQL |
| **B6** | **ALTA** | **Sobreventa en el carrito**: 4 unidades de un producto con stock 1, sin aviso (el carrito es `localStorage` sin tope). El BFF `/checkout/cart` sí lo rechaza ("solo quedan 1 unidades"), pero ese camino no lo usa la tienda escolar | `2a-05`; log `4-BFF-cart-qty4-stock1` |
| **B7** | **ALTA** | **La escuela no gestiona pedidos**: `/orders` sin acciones ("Ver" sin onClick), sin nombre del cliente, "Items 0" fijo. No hay preparar / listo / entregado | `3-01`, `3-02` |
| **B8** | MEDIA | **Sin notificación de venta a la escuela**: `createProductOrder` notifica por `metadata.vendorId`, que `TiendaPublicaPage` no pone (solo `vendorProfileId`) → `orders.vendor_id` y `order_items.vendor_id` NULL y no se avisa a nadie. Además al padre le llega "Compra Exitosa — Pedido confirmado" aunque sea transferencia sin verificar | `transactions.ts`; `3-03` |
| **T16** | MEDIA (confirmado) | `/checkout/cart` arma $65.550 por una gorra de $45.000: IVA 19 % **sumado encima** (8.550) + envío $12.000 por defecto, sin opción de retiro | log `4-BFF-cart-qty1` |
| B9 | MEDIA | Sin ficha de producto, sin retiro en sede, sin subir comprobante, sin "Mis compras" para el padre | `2a-*` |
| B10 | MEDIA | `/shop` (huérfano del menú) lista productos públicos de **todas** las escuelas como "Tienda SportMaps" | `2b-01-shop.png` |
| B11 | BAJA | Owner sin camino a "Activar tienda" en el menú aunque tenga el addon; "Omitir por ahora" del onboarding regresa al paso 1; ciudad guardada se ve vacía; estados crudos (`pending_review`, `draft`) en la lista de productos; contador "1 orden / $0" del panel ≠ 3 pedidos | `1a-01`, `1b-05`, `1e-01`, `3-05` |
| B12 | BAJA (fuera de tienda) | Cada login registra una fila nueva en `user_devices` (13 en esta sesión para 3 usuarios): no deduplica por dispositivo | SQL `user_devices` |
| T6 | **Descartado para el padre** | `PATCH products` (stock 999, precio 1) y `PATCH product_variants` (stock 999) con token del padre → 200 con **0 filas** (RLS `vendor_id = auth.uid()`). T6 sigue aplicando al **vendedor** (stock editable desde su cliente), no al comprador | log `4-T6-*` |
| T5 | No concluyente | Insertar un producto propio `status='active'` lo frena el trigger de calidad (400 `23514`), no la RLS. No se probó como `draft` | log `4-T5` |
| PGRST203 | No observado | El flujo nunca llegó a `confirm_order_payment` (requiere pago real) | — |

**Lo que funciona bien:** onboarding y wizard crean datos coherentes (variantes con SKU, imágenes al bucket bajo el `vendor_profile`); el padre llega a la tienda en 2 toques desde el menú (escritorio y móvil); el BFF `/checkout/cart` toma el precio de la base y valida stock; un padre no puede tocar stock ni precio de productos; sin scroll horizontal en móvil.

**Para el rediseño (spec tienda v2 §0 y §2):** B1/B2/B6/B8 confirman que el flujo viejo (`CartDrawer → CheckoutPage → transactions.createProductOrder`, T15) debe eliminarse, no arreglarse. B3/B4 dicen que variantes y `school_only` necesitan modelo y lectura nuevos (§4.1, §2.1). B5 obliga a decidir si una escuela con addon `store` se auto-verifica. B7 justifica `order_transition` + línea de tiempo (§2.6) antes que cualquier pulido visual.

---

## 3. Ataques REST con el token del padre (detalle)

| Prueba | Petición | Resultado |
|---|---|---|
| S0 réplica del checkout | `POST orders` + `POST order_items` (4 gorras, $180.000, `vendor_id` NULL) | 201 / 201 — orden `b6b9907e…` |
| T3a | `PATCH orders?id=eq.O1 {total_amount:1000}` | **200, total=1000** |
| T3b | `PATCH … {status:'processing'}` | **200** |
| T3c | `PATCH … {status:'qa_estado_inventado'}` | **200** (sin CHECK) |
| T3 `paid` | SQL como `authenticated` (sub = padre): `UPDATE orders SET status='paid', total_amount=1` → **devuelve la fila** → `ROLLBACK` | **vulnerable**; verificado después: sigue `pending` |
| T4 | `POST orders {total:1}` + `POST order_items {camiseta M, unit_price:1, vendor_id: padre}` | **201 / 201** |
| T6 | `PATCH products {stock:999, price:1}` / `PATCH product_variants {stock:999}` | 200 con `[]` (bloqueado) |
| BFF stock | `POST /marketplace/checkout/cart` gorra ×4 | 400 "solo quedan 1 unidades" (bien) |
| BFF total | `POST /marketplace/checkout/cart` gorra ×1 | 201 — $65.550 (IVA encima + envío) |

O1 se dejó con su total y estado originales (`180000`, `pending`) para que la escuela la viera como la habría creado la UI.

---

## 4. Filas que creé (para que las borres tú — no borré nada)

**Datos de prueba visibles (Club Campestre Demo):**

| Tabla | id | Qué es |
|---|---|---|
| `vendor_profiles` | `0ed67297-c086-4f1d-9a69-dc25c281b02d` | Tienda del owner (UI). **Modificada por SQL:** `verification_status` `pending → verified` (hallazgo B5). Contiene `bank_data` falso ("DEMO QA NO REAL", cuenta 000…) |
| `products` | `880a85ba-f002-45c9-a69f-038560872c99` | Camiseta (UI). **SQL:** `status → active` |
| `products` | `7067038d-38b5-45e7-bd47-11e62ddc633d` | Gorra stock 1 (UI). **SQL:** `status → active` |
| `products` | `dacef39a-9eaa-4389-94c9-6e7d1557bdd5` | Termo `school_only` (UI). **SQL:** `status → active` |
| `product_variants` | `607a5047-e806-40e7-ac03-3813d790df64`, `15175978-f57e-4d2c-bd30-f5fa0278e8c7`, `f28340a6-2e79-40cc-ab60-ec6d8f1443f1` | Tallas S/M/L de la camiseta (UI) |
| `storage.objects` (`product-images`) | `b616efdf-e06e-4fcd-bcc1-c57a16ea2e3a`, `d505117a-6afb-46f1-8d38-b251421ea3f8`, `a51521d9-2690-4109-bcf2-14c265b17075` | Imágenes en `0ed67297-…/` (UI) |
| `orders` | `b6b9907e-fb10-4eb0-9900-337125075e14` | O1 — réplica del checkout, $180.000, `pending` (REST padre) |
| `orders` | `45a5ff41-80ec-4010-86bc-4c9432440358` | O2 — ataque T4, $1, `pending` (REST padre) |
| `orders` | `3af94ada-fe0c-4344-acf9-3e1efd989edc` | O3 — BFF `/checkout/cart`, $65.550, `pending` |
| `order_items` | `b5805b41-5b78-4dfc-b5a6-261b8992be61` (O1), `b582377c-1d96-4c5e-9adb-ebac26bdc5ae` (O2), `0beee782-a14e-4957-823d-4c1d59fadd0b` (O3) | |

**Efecto secundario de los logins (no es de tienda):** `user_devices` — owner: `e73417f2-66db-4772-a3b6-643005869298`, `1111d518-45a4-4854-9a90-6f575dcf9859`, `2ff5967f-b3fb-45cb-8ab2-39af5f3751c9`, `1dc25569-e994-45e5-9e1f-d713127e15d7`, `27fdb396-bd27-4ce5-8aaa-01029305db0b`, `6b5c71e2-9141-4722-9298-c57f124f01c8`, `cdd02c7e-4505-4d78-bed2-f17af1d57628`, `51306620-3c58-4ecd-aa46-0e233663c337`; mherrera: `d724a638-e73e-41b5-92e3-7adfe683e4ac`, `3b6dec60-cd54-4a76-915d-a9aacbadd758`, `5b491672-ee19-48e7-b422-41c98f118901`, `4a96d16b-a19a-418e-91c9-c30e8d6b396a`; rojas: `46364f6a-d00c-4c35-87c8-b5e452d51ad9`.

No se crearon `shipments`, `store_conversations`, `notifications` ni `payments`. Orden sugerido para borrar: `order_items` → `orders` → `product_variants` → `products` → objetos del bucket → `vendor_profiles`.
