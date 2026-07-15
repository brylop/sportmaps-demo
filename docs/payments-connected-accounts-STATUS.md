# Connected Accounts — Estado real vs. plan

Inventario **verificado contra el código** (no contra el plan). Sirve para revisar
`payments-connected-accounts-plan.md` y decidir por dónde arrancar.

**TL;DR:** el *motor* que elige la cuenta correcta por escuela **ya funciona**.
La *capa self-service* de conexión (OAuth 1-clic + formulario guiado + cifrado +
split de comisión) está en **0%**. En términos del plan: **Fase 0 sin empezar.**

---

## 1. Lo que YA está implementado (base / §2 del plan)

### Base de datos
| Pieza | Dónde | Estado |
|---|---|---|
| Enum `payment_provider` (`wompi`,`mercadopago`) | `20260504000001_payment_provider_generic.sql` | ✅ |
| Columnas genéricas (`payment_provider`, `provider_reference`, `provider_transaction_id`) en tablas de pago | idem | ✅ |
| Tabla `school_payment_providers` (public_key/access_token/webhook_secret/integrity_secret, `enabled`, `is_default`) + RLS + trigger de único default | idem | ✅ |
| Tabla `vendor_payment_providers` (análoga) | idem | ✅ |
| `payment_tokens` con soporte MP (customer_id + card_id) | idem | ✅ |
| RPCs helper para resolver providers | `20260504000002_payment_provider_rpcs.sql` | ✅ |

### BFF
| Pieza | Dónde | Estado |
|---|---|---|
| `resolveProvider(ctx)` — elige `is_default` / primer `enabled`, cae a ENV | `services/payment-provider.resolver.ts` | ✅ **devuelve el access_token correcto por escuela** |
| `listProvidersForSchool / ForVendor / ForMarketplace` | idem | ✅ |
| `loadProviderConfig` (búsqueda inversa por provider) | idem | ✅ |
| CRUD de providers: `GET/POST /school/:id`, `GET/POST /vendor/:id`, `PATCH /:id`, `DELETE /:id` | `routes/payment-providers.routes.ts` | ✅ pero **entrada de llaves MANUAL** |
| `POST /api/v1/payments/create-session` (referencia Wompi para pago de escuela) | `routes/payments.routes.ts` | ✅ |
| Rutas + servicio MercadoPago (pagos) | `routes/mercadopago.ts`, `services/mercadopago.service.ts` | ✅ |
| Webhooks reconciliación Wompi/MP | `routes/wompi.ts`, `routes/mercadopago.ts` | ✅ |

### Frontend
| Pieza | Dónde | Estado |
|---|---|---|
| Admin de providers (pegar llaves a mano) | `components/admin/PaymentProvidersAdmin.tsx` | ✅ (flujo manual que el plan quiere reemplazar) |
| Ajustes "SportMaps Pay" | `components/settings/SportMapsPaySettings.tsx` | ✅ |
| Checkout: Wompi widget + MP Brick + gate | `PaymentCheckoutModal.tsx`, `checkout/MercadoPagoBrick.tsx`, `checkout/PaymentProviderGate.tsx` | ✅ |

➡️ **Conclusión base:** la afirmación del plan "la lógica de usar la cuenta correcta ya
funciona" es **correcta y verificada**. Lo que falta es **poblar la tabla sin fricción**
y **cobrar la comisión SportMaps**.

---

## 2. Lo que NO está implementado (el plan Connected Accounts en sí)

### Fase 0 — Fundaciones ❌ SIN EMPEZAR
- ❌ Migración de columnas connect (`connect_method`, `connect_status`, `external_user_id`,
  `refresh_token`, `token_expires_at`, `application_fee_pct`, `connected_at`, `connected_by`).
  **Verificado:** no existen en ninguna migración.
- ❌ **Cifrado de tokens** (Vault/pgsodium). Hoy `access_token` / `webhook_secret` /
  `integrity_secret` se guardan **en claro** en `school_payment_providers`.
  🔴 **Bloqueante para prod** con merchants reales.
- ❌ Gate: conectar requiere addon de pasarela activo.

### Fase 1 — MercadoPago OAuth Connect ("1 clic") ❌ SIN EMPEZAR
- ❌ `GET /payments/connect/mercadopago/authorize` (URL de autorización + `state` firmado).
- ❌ `GET /payments/connect/mercadopago/callback` (intercambio `code`→token, upsert).
- ❌ Job de refresh de tokens MP (~180 días).
- ❌ Inyección de `application_fee` / split en la preferencia MP. **Verificado:** no hay
  `application_fee` ni `marketplace_fee` en `mercadopago.service.ts`.
- ❌ Tarjeta "Conectar MercadoPago" en `/mi-plan`.

### Fase 2 — Wompi conexión guiada ❌ SIN EMPEZAR
- ❌ Wizard UI que pide las 4 llaves con instrucciones.
- ❌ `POST /payments/connect/wompi` que valida llaves contra la API Wompi (`GET /merchants/{public_key}`).
  *(Hoy solo existe el POST CRUD genérico que guarda sin validar.)*

### Fase 3 — Fallback agregador ⚠️ PARCIAL
- ⚠️ El **fallback a ENV global ya existe** en el resolver (usa llaves de SportMaps si la
  escuela no tiene config). Pero **no hay** contrato "operador tecnológico" ni cron de
  payouts ni Wompi "Pagos a Terceros". Plan recomienda **no** activar salvo demanda.

### Fase 4 — Monetización + housekeeping ❌ SIN EMPEZAR
- ❌ Config `application_fee_pct` por escuela/global.
- ❌ Pantalla "Mis ganancias".
- ❌ Alertas de token por expirar / conexión con error.
- ❌ Auditoría de conexión/desconexión.

---

## 3. Contexto adyacente ya construido (no es Connected Accounts, pero toca)

Estas piezas existen y conviven con el plan (lado agregador/marketplace):
- Pipeline `vendor_payouts` (`20260511000005…`) — dispersión a vendors.
- `recurring_subscriptions` + cron (autopay **solo MP**; Wompi bloqueado hasta
  `/v1/payment_sources`).
- `payment_reconciliation` (`20260701000004`).
- Split de órdenes del shop (`split_order_payment`) + settlements (lado marketplace, no escuela).

---

## 4. Semáforo por fase

| Fase | Descripción | Estado |
|---|---|---|
| Base §2 | Motor resolver + tablas + CRUD manual + checkout | 🟢 Hecho |
| Fase 0 | Schema connect + cifrado tokens + gate addon | 🔴 0% |
| Fase 1 | MP OAuth Connect + split `application_fee` | 🔴 0% |
| Fase 2 | Wompi conexión guiada + validación de llaves | 🔴 0% |
| Fase 3 | Fallback agregador (Pagos a Terceros) | 🟡 solo fallback ENV; resto 0% |
| Fase 4 | Monetización + ganancias + alertas + auditoría | 🔴 0% |

---

## 5. Puntos a decidir para revisar el plan

1. **Cifrado de tokens ANTES de conectar merchants reales** — hoy en claro. ¿Vault,
   pgsodium, o AES-GCM en BFF (como se hizo para WhatsApp)? Es el bloqueante #1 de Fase 0.
2. **Modo Marketplace en MP** (requisito para `application_fee`) — ¿ya se solicitó?
   Sin esto, el "1 clic" conecta pero **no cobra comisión** per-tx.
3. **`redirect_uri` OAuth** de la app MP (`1443783091543933`) — ¿registrado?
4. **Gate por addon** — confirmar que el botón "Conectar" vive detrás del addon de pasarela
   (Wompi +$50k / MP +$90k / ambos +$120k según el plan).
5. **Wompi:** aceptar que la comisión SportMaps va **solo por addon mensual** (no hay split
   per-tx con widget a merchant ajeno).

**Recomendación de arranque:** Fase 0 primero (schema + cifrado + gate), luego Fase 1
(MP OAuth es el mayor salto de valor: el "1 clic" real). Fase 2 (Wompi) es más simple y
puede ir en paralelo.
