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
| Cupones | Fuera de esta fase | `couponCode` → `422 COUPONS_NOT_AVAILABLE` |

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
  "subtotal", "tax_total", "shipping", "shipping_error", "discount_total": 0, "total",
  "coupon_error", "multiple_sellers": false, "store_enabled": true }
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
  "idempotencyKey": "uuid"                               // OBLIGATORIO en la UI nueva: uno por clic de "Pagar"
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
  "subtotal", "taxTotal", "shippingCost", "grossAmount", "amountInCents", "expiresAt",
  "items": [ … ],
  "provider": "wompi" | "mercadopago" | "transfer" | "cash_pickup",
  "publicKey": "llave pública DEL VENDEDOR" | null,     // wompi / mercadopago
  "sandbox": true | false | null,
  "signature": "firma de integridad Wompi con el secreto DEL VENDEDOR" | null,
  "transfer": { "accounts": [{ "type", "label", "value", "bank", "account_type", "holder", "holder_id" }],
                "instructions", "amount", "reference", "expires_at" } | null,
  "pickupCode": "123456" | null,                         // retiro en sede: mostrarlo UNA vez (no se puede recuperar)
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

Subida: `supabase.storage.from('order-receipts').uploadToSignedUrl(path, token, file)`.

### 2.4 Tienda (owner/admin de la escuela o dueño del perfil; **no** coach) — `/api/v1/store/vendor`
| Método y ruta | Qué hace | RPC |
|---|---|---|
| `GET  /orders/:id/receipt-url` | URL firmada (5 min) para ver el comprobante | — |
| `POST /orders/:id/approve-receipt` | `awaiting_approval → paid` (queda `approved_by`) | `approve_order_receipt` |
| `POST /orders/:id/reject-receipt` `{reason}` | Vuelve a `pending_payment` con motivo; el comprador tiene 24 h para reenviar | `reject_order_receipt` |
| `POST /orders/:id/confirm-cash` `{pickupCode}` | Efectivo: cobra y entrega a la vez (`paid` + `delivered`) | `confirm_cash_pickup` |
| `POST /orders/:id/transition` `{to, note?, trackingNumber?, carrier?, pickupCode?}` | `paid→preparing`, `preparing→ready_for_pickup` (retiro) / `shipped` (envío), `ready_for_pickup→delivered` (**exige `pickupCode`**), `shipped→delivered`, cancelar una orden sin pagar | `order_transition` |
| `GET  /:vendorProfileId/payment-settings` | Configuración + medios efectivos | — |
| `PUT  /:vendorProfileId/payment-settings` | `{accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup, transfer_instructions, transfer_hold_hours, cash_hold_hours}` | `set_store_payment_settings` |

`PATCH /api/v1/marketplace/orders/vendor/:id/status` sigue vivo y para órdenes nuevas pasa por `order_transition` (acepta `pickup_code`).

### 2.5 Público
`GET /api/v1/store/payment-methods/:vendorProfileId` → `{ allowed, methods: [{method:'wompi', public_key, sandbox} | {method:'transfer', hold_hours} | {method:'cash_pickup', hold_hours}] }`. Sin números de cuenta ni secretos.

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
| `COUPONS_NOT_AVAILABLE` | 422 | Cupón (fase F3b) |
| `PAYMENT_METHOD_NOT_ACCEPTED` / `GATEWAY_NOT_CONFIGURED` / `NO_TRANSFER_ACCOUNTS` | 409 | Medio no ofrecido por la tienda |
| `SELLER_GATEWAY_NOT_CONFIGURED` | 409 | Pasarela elegida no utilizable (BFF) |
| `CASH_REQUIRES_PICKUP`, `ADDRESS_REQUIRED`, `INVALID_PICKUP_BRANCH`, `INVALID_FULFILLMENT` | 400 | Entrega |
| `SHIPPING_ZONE_NOT_FOUND` | 422 | No hay envío al departamento (sin tarifa por defecto) |
| `INVALID_STATE`, `ORDER_EXPIRED`, `TRANSITION_NOT_ALLOWED` | 409 | La orden no admite esa acción |
| `INVALID_PICKUP_CODE` | 403 | Código de retiro errado |
| `NOT_OWNER` / `FORBIDDEN` | 403 | No administra la tienda / no es su orden |
| `REASON_REQUIRED`, `INVALID_RECEIPT_PATH`, `INVALID_FILE` | 400 | Validación |

## 5. Lo que NO hace esta fase (para no construir UI de más)

Cupones (F3b) · invitado sin cuenta · recuperar el `pickupCode` perdido · reembolso MP (el BFF responde `501`) · tope de 72 h de revisión de comprobante · OCR del comprobante · fee real de pasarela (se estima) · catálogo/ficha/variantes en la vitrina (F1–F3).
