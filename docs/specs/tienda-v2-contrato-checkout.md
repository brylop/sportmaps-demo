# Tienda v2 · F0 — Contrato del checkout (RPC + BFF) para el frontend

**Fecha:** 2026-10-04 · **Estado:** implementado en `develop` (sin commitear) y probado en el gemelo local. **No aplicado en la viva.**
**Migraciones:** `20261003230007` (motor de orden), `20261003230011` (settlements), `20261003230013` (pasarela y medios del vendedor), `20261003230016` (factura y eventos contables).
**Spec padre:** [`tienda-v2-estilo-mercadolibre.md`](tienda-v2-estilo-mercadolibre.md) §2.5, §4.2, §6 · **Plan:** [`tienda-v2-f0-plan-migraciones.md`](tienda-v2-f0-plan-migraciones.md) M-F0-4/5/7/8.

> **Regla de oro.** El frontend nunca manda precios, totales, IVA ni estados. Manda `variant_id`/`product_id` + cantidad, la entrega y el medio de pago. Todo lo demás sale de la base. Cualquier precio que venga en el body se descarta.

## 0. Decisiones provisionales que este contrato asume (2026-10-03)

| # | Decisión | Efecto en la UI |
|---|---|---|
| D-5 = A | Cada vendedor cobra con **sus** llaves (Wompi/MP de la escuela o del externo). Nunca las globales del BFF | Si el vendedor no tiene pasarela, solo verá **transferencia** y **efectivo** |
| D-1 | IVA **incluido** según `products.tax_rate` | Mostrar "incluye IVA $X" (`tax_total`), nunca sumarlo encima |
| D-2 | Un checkout por vendedor | Si el carrito mezcla tiendas: un botón "Pagar" por tienda |
| D-3 | Comisión 0 % tienda escolar; externo `commission_rate` (queda adeudada, no se descuenta) | Nada para el comprador |
| D-6/D-18 | Reserva: pasarela 45 min; transferencia y efectivo según la tienda (48 h por defecto). Con comprobante en revisión **no vence** | Mostrar `expiresAt` |
| D-11 | El envío no lleva IVA (línea aparte) | — |
| Cupones | **Por tienda (F3b, mig. `20261013170543`)**: la base los aplica | Campo «¿Tienes un código de descuento?» en el checkout; §2.6 |

## 1. Estados de la orden

`pending_payment` → (`awaiting_approval` si es transferencia con comprobante) → `paid` → `preparing` → `ready_for_pickup` | `shipped` → `delivered`.
Laterales: `payment_review` (pago llegó sin stock / monto raro), `expired` (reserva vencida), `cancelled`, `refunded`, `partially_refunded`.
La línea de tiempo sale de `order_status_history` (lectura directa con el JWT: comprador y tienda la ven, nadie la escribe).

## 2. Endpoints del BFF

Todos con `Authorization: Bearer <jwt>` salvo donde dice público. Errores: `{ ok:false, error:<CÓDIGO>, message, details? }` (tabla §4).

### 2.1 Cotizar — `POST /api/v1/marketplace/checkout/cart/quote`
Mismo body que crear (§2.2). Solo lectura (`quote_cart`). Respuesta `data`:
```json
{ "lines": [{ "product_id", "variant_id", "name", "vendor_profile_id", "quantity", "available",
              "adjusted_quantity", "unit_price", "tax_rate", "line_total", "line_base", "line_tax",
              "error": null | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "PRODUCT_NOT_AVAILABLE" | "VARIANT_REQUIRED" | "PRODUCT_NOT_FOUND" | "INVALID_QTY" }],
  "subtotal", "tax_total", "shipping", "shipping_error", "discount_total", "total",
  "coupon": { "code", "kind", "value", "description", "discount_total" } | null,
  "coupon_error": null | "COUPON_INVALID" | "COUPON_EXPIRED" | …, "coupon_error_detail": { "min_subtotal" } | null,
  "coupon_message": "texto en español (solo por el BFF)",
  "multiple_sellers": false, "store_enabled": true }
```
Usarlo al abrir el carrito y al cambiar entrega/dirección ("el precio cambió", "quedan 2").

### 2.2 Crear la orden — `POST /api/v1/marketplace/checkout/cart`
Body (contrato nuevo):
```json
{
  "items": [{ "variantId": "uuid" , "quantity": 2 }, { "productId": "uuid", "quantity": 1 }],
  "fulfillment": "pickup" | "shipping",
  "pickupBranchId": "uuid | null",                      // solo tienda escolar; null = sede principal
  "address": { "departamento": "Antioquia", "ciudad": "Medellín", "direccion": "Cra 1 # 2-3" },   // solo shipping
  "buyer": { "name", "document", "email", "phone", "notes" },   // opcional; default = perfil
  "paymentMethod": "wompi" | "mercadopago" | "transfer" | "cash_pickup",
  "idempotencyKey": "uuid",                              // OBLIGATORIO en la UI nueva: uno por clic de "Pagar"
  "couponCode": "SOCIOS10"                               // opcional (§2.6); la base lo valida y calcula
}
```
- `variantId` es obligatorio si el producto tiene variantes (`VARIANT_REQUIRED`). Cantidad 1–20 por producto.
- `cash_pickup` exige `fulfillment: "pickup"`.
- Reintentar con el mismo `idempotencyKey` devuelve **la misma orden** (`200`, `idempotent: true`).
- Body legacy de `CartCheckoutModal` (`shippingAddress`, `contact*`, `customerName`, `preferredProvider`) sigue aceptado.

Respuesta `201` (`200` si idempotente) — `data`:
```json
{
  "orderId", "reference": "CART-…", "status": "pending_payment", "paymentMethod",
  "subtotal", "discountTotal", "couponCode", "taxTotal", "shippingCost", "grossAmount", "amountInCents", "expiresAt",
  "items": [ … ],
  "provider": "wompi" | "mercadopago" | "transfer" | "cash_pickup",
  "publicKey": "llave pública DEL VENDEDOR" | null,     // wompi / mercadopago
  "sandbox": true | false | null,
  "signature": "firma de integridad Wompi con el secreto DEL VENDEDOR" | null,
  "transfer": { "accounts": [{ "type", "label", "value", "bank", "account_type", "holder", "holder_id" }],
                "instructions", "amount", "reference", "expires_at" } | null,
  "pickupCode": "123456" | null,                         // retiro en sede: se muestra y se guarda en ESTE dispositivo; en otro, se regenera (§2.3)
  "idempotent": false
}
```
Qué hace la UI con cada medio:
| Medio | Siguiente paso |
|---|---|
| `wompi` | Abrir el widget con `publicKey`, `reference`, `amountInCents` y `signature` **de esta respuesta**. No llamar a la Edge Function `wompi-sign` (para `CART-` responde `410`) |
| `mercadopago` | Brick con `publicKey`; `POST /api/v1/payments/mp/create` con `externalReference = reference`. El BFF ignora `schoolId/vendorId/transactionAmount` del body y cobra `orders.total_amount` con el token del vendedor |
| `transfer` | Mostrar `transfer.accounts` (las REALES del vendedor; nunca inventadas) + subir comprobante (§2.3) |
| `cash_pickup` | Mostrar `pickupCode` y la sede. La tienda cobra y entrega con ese código |

`409 SELLER_GATEWAY_NOT_CONFIGURED`: la tienda eligió una pasarela que no puede usarse → ofrecer otro medio (la orden queda reservada; cancelar con §2.3 o dejar vencer).

### 2.3 Comprador — `/api/v1/store`
| Método y ruta | Qué hace | RPC |
|---|---|---|
| `GET  /orders/:id/payment` | Reabrir el pago de una orden `pending_payment` (widget con llaves del vendedor, o cuentas) | — / `store_transfer_accounts` |
| `GET  /orders/:id/transfer-accounts` | Cuentas de la tienda (solo el comprador de una orden de transferencia abierta) | `store_transfer_accounts` |
| `POST /orders/:id/receipt-url` `{fileName}` | URL firmada para subir al bucket **privado** `order-receipts` (jpg/png/webp/heic/pdf, ≤ 5 MB). Devuelve `{bucket, path, signedUrl, token}` | — |
| `POST /orders/:id/receipt` `{path}` | Tras subir: `pending_payment → awaiting_approval` | `submit_order_receipt` |
| `POST /orders/:id/cancel` `{reason?}` | Solo `pending_payment`/`awaiting_approval`; libera la reserva | `cancel_my_order` |
| `POST /orders/:id/received` | "Ya lo recibí" (`shipped → delivered`) | `order_transition` |
| `POST /orders/:id/pickup-code` | Código de retiro **nuevo** desde cualquier dispositivo (invalida el anterior). Solo retiro en sede `paid`/`preparing`/`ready_for_pickup`, máx. 3 por pedido, auditado en `order_status_history`. Devuelve `{order_id, status, pickup_code, regenerations_used, regenerations_left, regenerations_max}` | `regenerate_my_pickup_code` (mig. `20261008163338`) |

Subida: `supabase.storage.from('order-receipts').uploadToSignedUrl(path, token, file)`.

**Límite de operaciones (2026-10-08).** `/api/v1/marketplace/checkout/*`, `/api/v1/marketplace/orders` y `/api/v1/store` usan `middlewares/storeRateLimit.ts`, no el `paymentLimiter`: **lecturas** (GET y `POST /checkout/cart/quote`) 120/min y **escrituras** 20/min, por **IP real del cliente** (`CF-Connecting-IP`; `req.ip` detrás de Cloudflare es la IP del borde) y contadas una sola vez por request. El 429 responde `{ ok:false, error:'RATE_LIMITED', message:'Demasiadas solicitudes, intenta en un minuto.' }`: la UI lo muestra así y **nunca** como "Pedido no encontrado" (404).

### 2.4 Tienda (owner/admin de la escuela o dueño del perfil; **no** coach) — `/api/v1/store/vendor`
| Método y ruta | Qué hace | RPC |
|---|---|---|
| `GET  /orders/:id/receipt-url` | URL firmada (5 min) para ver el comprobante | — |
| `POST /orders/:id/approve-receipt` | `awaiting_approval → paid` (queda `approved_by`) | `approve_order_receipt` |
| `POST /orders/:id/reject-receipt` `{reason}` | Vuelve a `pending_payment` con motivo; el comprador tiene 24 h para reenviar | `reject_order_receipt` |
| `POST /orders/:id/confirm-cash` `{pickupCode}` | Efectivo: cobra y entrega a la vez (`paid` + `delivered`) | `confirm_cash_pickup` |
| `POST /orders/:id/transition` `{to, note?, trackingNumber?, carrier?, pickupCode?}` | `paid→preparing`, `preparing→ready_for_pickup` (retiro) / `shipped` (envío), `ready_for_pickup→delivered` (**exige `pickupCode`**), `shipped→delivered`, cancelar una orden sin pagar | `order_transition` |
| `GET  /:vendorProfileId/payment-settings` | Configuración + medios efectivos | — |
| `PUT  /:vendorProfileId/payment-settings` | `{accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup, transfer_instructions, transfer_hold_hours, cash_hold_hours, transfer_account_ids, allow_shipping, pickup_branch_ids}` (las tres últimas desde `20261008163336`: cuentas que se muestran —`null` = todas las aptas—, «solo retiro» vs «también envío», sedes de retiro —`null` = todas—). El `GET` trae además `admin` (`store_admin_settings`: estado de habilitación, cuentas enmascaradas con su aptitud, sedes, pasarelas conectadas) | `set_store_payment_settings` |
| `GET  /school-store/:schoolId` | La tienda de la escuela que el usuario administra (por `school_id`, no por `user_id`: bug N0). Desde el frontend, RPC `my_school_store(p_school_id)` | `can_manage_store_as` |

`PATCH /api/v1/marketplace/orders/vendor/:id/status` sigue vivo y para órdenes nuevas pasa por `order_transition` (acepta `pickup_code`).

### 2.5 Público
`GET /api/v1/store/payment-methods/:vendorProfileId` → `{ allowed, methods: [{method:'wompi', public_key, sandbox} | {method:'transfer', hold_hours} | {method:'cash_pickup', hold_hours}], fulfillment: { pickup, shipping, pickup_branches: [{id, name, address, is_main}] } }`. Sin números de cuenta ni secretos.

`fulfillment` (mig. `20261008163336`, `store_payment_settings.allow_shipping` / `pickup_branch_ids`): con `shipping: false` ("solo retiro en sede", así nace la tienda escolar) el checkout **no muestra** envío a domicilio y la base rechaza la orden con `SHIPPING_NOT_OFFERED`. Si `fulfillment` no viene (base sin esa migración o tienda sin fila de medios) no hay restricción. Las sedes del selector salen de `pickup_branches`.

### 2.6 Cupones por tienda (F3b, mig. `20261013170543`)

Cada tienda (escolar o empresa externa) emite **sus** códigos; el comprador los escribe al pagar. **La base aplica el cupón**: `quote_cart` lo cotiza, `create_cart_order` lo cobra y reserva el uso con la fila del cupón `FOR UPDATE` (dos compras por el último uso → una gana, la otra `COUPON_LIMIT`). El frontend nunca manda un monto de descuento.

**Comprador (UI):** campo «¿Tienes un código de descuento?» en el resumen del checkout → `quote_cart(…, p_coupon_code)` (o `POST /api/v1/store/coupons/validate`). Con `coupon_error` se muestra el mensaje y **no se deja pagar** hasta corregir o quitar el código. Al crear la orden se manda `couponCode` solo si la cotización lo aceptó. Sin sesión: `COUPON_LOGIN_REQUIRED`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/v1/store/coupons/validate` `{code, items, fulfillment?, address?}` | comprador | `quote_cart` con su JWT → `{valid, code, error, message, detail, coupon, subtotal, discountTotal, taxTotal, total}`. Nunca lista cupones. Cuenta como escritura (20/min) |
| `GET  /api/v1/store/vendor/:vp/coupons` | tienda | Cupones + `usage {reserved, consumed, released, discountGiven}` + `state` (`active`, `paused`, `archived`, `scheduled`, `expired`, `exhausted`) |
| `POST /api/v1/store/vendor/:vp/coupons` | tienda | Crear: `{code, kind: percent\|fixed, value, description?, minSubtotal?, maxDiscount?, startsAt?, endsAt?, maxRedemptions?, maxPerBuyer? (default 1, null = sin límite), appliesTo?: store\|products\|categories, productIds?, categoryIds?, schoolId?}` |
| `PATCH /api/v1/store/vendor/:vp/coupons/:id` | tienda | Editar / `status: paused\|active\|archived`. Con usos, código/tipo/valor quedan congelados (`COUPON_LOCKED`) |
| `GET  /api/v1/store/vendor/:vp/coupons/:id/redemptions` | tienda | Quién lo usó: pedido, comprador, descuento, `reserved\|consumed\|released` |

«Tienda» = `can_manage_store_as` (dueño del perfil, owner/admin de la escuela, admin de plataforma; **no** coach). En la base: RLS `store_coupons_*_manager` (`can_manage_store`, sin DELETE, sin `FOR ALL`) + guardia `fn_store_coupons_guard` (código en mayúsculas, único por tienda sin importar mayúsculas; productos solo de esa tienda; auditoría `created_by/updated_by`).

**Reglas de cálculo (decididas):**
- `percent` 1–90 % o `fixed` en pesos; `max_discount` topa en pesos; **nunca más del 90 % de lo elegible** (la orden siempre tiene algo que cobrar).
- `min_subtotal` se mide sobre lo **elegible** (productos del alcance, IVA incluido, sin envío). El envío nunca se descuenta.
- Prorrateo por línea proporcional a `line_total` (piso) y el residuo a la línea más cara. `order_items.unit_price` queda el de lista; `line_total` es el **neto**, `discount_amount` su parte del descuento; `line_base`/`tax_amount` y la comisión (`platform_fee`) salen del neto (§6.3, D-3). Funciona igual con `tax_rate` 0.
- `orders.subtotal` = productos **antes** del descuento; `discount_total`; `coupon_id`/`coupon_code`; `total_amount = subtotal − discount_total + shipping`.
- `school_id` en el cupón: solo lo redimen miembros activos de esa escuela (a los demás: `COUPON_INVALID`, sin revelar que existe).
- Redención: `reserved` al crear la orden → `consumed` al pagar → `released` al vencer/cancelar (trigger en `orders.status`). Los topes cuentan `reserved + consumed`. Pago tardío de una orden vencida: se re-consume aunque pase el tope.
- Anti fuerza bruta: 10 códigos **distintos** fallidos en 15 min por comprador → `COUPON_TOO_MANY_ATTEMPTS` (también con un código bueno). Los registra `quote_cart` (ahora `VOLATILE`); `create_cart_order` respeta el bloqueo.
- v1: solo financia el vendedor (`funded_by='vendor'`); la columna y `platform_share_pct` quedan para co-financiado por SportMaps (D-20, soltar `store_coupons_v1_solo_vendedor`).
- Contabilidad: el evento `commerce_sale` lleva `gross` (lo cobrado), `discount`, `gross_before_discount`, `coupon_code`, `coupon_funded_by`. Factura: `order_invoice_payload` manda `unit_price` **neto** cuando hubo cupón (`list_unit_price` y `discount_amount` aparte) para cuadrar con lo cobrado mientras el adaptador de Factus no descuente `discount_rate`.

**Para la compra sin cuenta (`20261013170553`):** parchea la guarda del comprador sobre ESTA versión de `create_cart_order` (conserva el cupón). Con comprador `NULL`, `_store_coupon_apply` responde `COUPON_LOGIN_REQUIRED`: el invitado hoy no usa cupones (identificarlo para `max_per_buyer` es su decisión).

### 2.7 Compra sin cuenta (D-13, mig. `20261013170553`) — `/api/v1/public/tienda` (sin sesión)
| Método y ruta | Qué hace | RPC (solo `service_role`) |
|---|---|---|
| `GET  /medios/:vendorProfileId` | Igual que §2.5 pero sin sesión (la de `/api/v1/store` exige sesión por el router de reviews) | `store_payment_methods` |
| `POST /checkout` | Body de §2.2 con `buyer.name` y `buyer.email` **obligatorios** (`phone` opcional), `idempotencyKey` obligatoria, `paymentMethod` ∈ `wompi`/`transfer`/`cash_pickup` (Mercado Pago necesita sesión → `422 GUEST_METHOD_NOT_AVAILABLE`), `website` = trampa de bots (vacío). `201` con `accessToken` + `orderPath: "/pedido/<token>"` **una sola vez**, `transfer`, `pickupCode`, `emailSent: sent\|simulated\|failed`. Reintento con la misma key → `200 idempotent:true` sin token | `create_guest_cart_order` |
| `GET  /pedido` | Header `X-Pedido-Token`. Estado, ítems, historial, cuentas para transferir, sede, correo enmascarado, `pickup.can_regenerate` | `guest_order_view` |
| `POST /pedido/receipt-url` / `POST /pedido/receipt` | Como §2.3 (bucket privado, ruta `{order_id}/…`) | `guest_order_submit_receipt` |
| `POST /pedido/pickup-code` | Código nuevo (pagado, máx. 3 por pedido, mismo conteo que con cuenta) | `guest_order_regenerate_pickup_code` |
| `POST /pedido/cancel` | Libera la reserva | `guest_order_cancel` |
| `POST /pedido/pay` | Reabrir el widget Wompi con las llaves del vendedor | — |

- El token (64 hex) se guarda como `sha256` en `orders.guest_token_hash`; vence a los `token_ttl_days` (180). Inexistente / mal formado / vencido → `404 NOT_FOUND`.
- Límites en `platform_config.store_guest_checkout` (`enabled`, `max_order_amount` 1.000.000, `max_orders_per_email_hour` 3, `max_orders_per_ip_hour` 10, `max_open_orders_per_email` 3, `token_ttl_days`), contados en `store_guest_checkout_log` (hashes, RLS sin policies). Además rate limit del BFF por IP real (`CF-Connecting-IP`): crear 10/10 min, leer 60/min, acciones 20/10 min.
- `school_only`/`private` → `403 LOGIN_REQUIRED`. Cupones: los decide 20261013170543 (sin sesión → `COUPON_LOGIN_REQUIRED`).
- Correo con el enlace `https://app.sportmaps.co/pedido/<token>` vía `send-email` (Resend). Simulado (no sale) si `SUPABASE_URL` no es `*.supabase.co`, en tests, o con `SIMULATE_EMAILS=true` / `STORE_GUEST_EMAIL_MODE=simulate`.
- Vinculación: al confirmar el correo (trigger en `auth.users`) y con `link_my_guest_orders()` (JWT, correo confirmado; la llama «Mis compras») los pedidos con ese `guest_email` pasan a la cuenta.
- Errores nuevos: `LOGIN_REQUIRED` 403, `GUEST_CHECKOUT_DISABLED` 403, `GUEST_EMAIL_REQUIRED`/`GUEST_NAME_REQUIRED`/`INVALID_PHONE` 400, `GUEST_METHOD_NOT_AVAILABLE` 422, `GUEST_RATE_LIMITED` 429, `GUEST_OPEN_ORDERS_LIMIT` 409, `GUEST_AMOUNT_LIMIT` 422.

## 3. RPC directas con el JWT (sin BFF)

`create_cart_order`, `quote_cart` (también `anon`), `submit_order_receipt`, `approve_order_receipt`, `reject_order_receipt`, `confirm_cash_pickup`, `cancel_my_order`, `order_transition`, `set_store_payment_settings`, `store_payment_methods` (también `anon`), `store_transfer_accounts`. Con JWT el actor es siempre `auth.uid()` (el `p_actor`/`p_buyer_id` que mande el cliente se ignora). Preferir el BFF: firma de pasarela y URLs firmadas solo existen ahí.

Firma definitiva (no se vuelve a cambiar: una firma nueva sería otra sobrecarga):
```
create_cart_order(p_items jsonb, p_fulfillment text, p_pickup_branch uuid, p_address jsonb, p_buyer jsonb,
                  p_payment_method text, p_coupon_code text, p_buyer_id uuid, p_idempotency_key uuid) → jsonb
```

## 4. Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `STORE_DISABLED` | 503 | Tienda apagada (`platform_config.store_enabled`) |
| `SELLER_NOT_ALLOWED` | 403 | Vendedor fuera de allowlist / sin addon / no verificado |
| `MULTIPLE_SELLERS` | 400 | Dos tiendas en un checkout |
| `PRODUCT_NOT_FOUND` / `PRODUCT_NOT_AVAILABLE` | 404 / 409 | Producto inexistente, borrador, inactivo, `school_only` ajeno |
| `VARIANT_REQUIRED` | 400 | Producto con variantes sin `variantId` |
| `INSUFFICIENT_STOCK` | 409 | `details: [{product_id, variant_id, requested, available}]` |
| `INVALID_QTY` | 400 | Fuera de 1–20 |
| `COUPON_INVALID` / `COUPON_EXPIRED` / `COUPON_NOT_STARTED` / `COUPON_MIN_PURCHASE` / `COUPON_NOT_APPLICABLE` | 422 | Cupón (§2.6). En `quote_cart` llegan como `coupon_error` (200), en `create_cart_order` como error y **no se crea la orden**. `COUPON_MIN_PURCHASE` trae `details.min_subtotal` |
| `COUPON_LIMIT` / `COUPON_BUYER_LIMIT` | 409 | Cupón agotado / el comprador llegó a su máximo |
| `COUPON_TOO_MANY_ATTEMPTS` | 429 | 10 códigos distintos errados en 15 min |
| `COUPON_LOGIN_REQUIRED` | 401 | Cupón sin sesión |
| `COUPON_CODE_TAKEN` / `COUPON_LOCKED` | 409 | Tienda: código repetido / cupón con usos (no se cambia código, tipo ni valor) |
| `COUPON_INVALID_DATA` / `COUPON_INVALID_SCOPE` | 400 | Tienda: datos del cupón / producto de otra tienda o categoría inexistente |
| `COUPONS_NOT_AVAILABLE` | 422 | Solo en una base sin `20261013170543` |
| `PAYMENT_METHOD_NOT_ACCEPTED` / `GATEWAY_NOT_CONFIGURED` / `NO_TRANSFER_ACCOUNTS` | 409 | Medio no ofrecido por la tienda |
| `SELLER_GATEWAY_NOT_CONFIGURED` | 409 | Pasarela elegida no utilizable (BFF) |
| `CASH_REQUIRES_PICKUP`, `ADDRESS_REQUIRED`, `INVALID_PICKUP_BRANCH`, `INVALID_FULFILLMENT` | 400 | Entrega |
| `SHIPPING_ZONE_NOT_FOUND` | 422 | No hay envío al departamento (sin tarifa por defecto). La UI dice "Esta tienda todavía no hace envíos a X" y ofrece retiro |
| `SHIPPING_NOT_OFFERED` | 409 | Envío en una tienda "solo retiro en sede" |
| `INVALID_TRANSFER_ACCOUNT`, `PICKUP_BRANCH_REQUIRED`, `NO_PAYMENT_METHODS` | 400 | Ajustes de cobros de la tienda (`set_store_payment_settings`): cuenta no apta (p.ej. «Solo para inscripciones»), cero sedes, ningún medio |
| `NOT_A_PICKUP_ORDER` / `PICKUP_CODE_LIMIT` | 409 | Regenerar código: pedido con envío / ya van 3 |
| `RATE_LIMITED` | 429 | Límite de operaciones de la tienda (ver §2.3) |
| `INVALID_STATE`, `ORDER_EXPIRED`, `TRANSITION_NOT_ALLOWED` | 409 | La orden no admite esa acción |
| `INVALID_PICKUP_CODE` | 403 | Código de retiro errado |
| `NOT_OWNER` / `FORBIDDEN` | 403 | No administra la tienda / no es su orden |
| `REASON_REQUIRED`, `INVALID_RECEIPT_PATH`, `INVALID_FILE` | 400 | Validación |

## 5. Lo que NO hace esta fase (para no construir UI de más)

Cupones financiados por SportMaps (D-20) · cupón para el regenerar el código de un pedido en efectivo **sin pagar** (el código es la prueba del cobro; sí se regenera desde `paid`) · reembolso MP (el BFF responde `501`) · tope de 72 h de revisión de comprobante · OCR del comprobante · fee real de pasarela (se estima) · catálogo/ficha/variantes en la vitrina (F1–F3).
