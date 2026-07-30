# Connected Accounts — Estado real vs. plan

Inventario **verificado contra el código** (no contra el plan). Sirve para revisar
`payments-connected-accounts-plan.md` y decidir por dónde arrancar.

> ⚠️ **Revisado 2026-07-29.** La versión anterior de este doc decía "Fase 0 sin empezar";
> quedó obsoleta cuando el WIP `c5bae84` construyó el schema, el cifrado y el resolver
> fail-closed. Las secciones de Fase 0 más abajo están corregidas contra el código.
> Plan de cierre: [`payments-connected-accounts-fase0-cierre.md`](./payments-connected-accounts-fase0-cierre.md).

**TL;DR:** el *motor* que elige la cuenta correcta por escuela **ya funciona**, y la
Fase 0 tiene su *lado lector* completo (schema connect + secretos cifrados + fail-closed).
Lo que falta es el **lado escritor**: nada puebla `payment_provider_secrets`, así que
ninguna escuela puede conectarse todavía. El OAuth 1-clic (F1), el wizard Wompi (F2) y el
split de comisión (F4) siguen en 0%.

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

### Fase 0 — Fundaciones 🟡 ~70% (lector hecho, escritor ausente)

Hecho (WIP `c5bae84`):
- ✅ Migración de columnas connect + `payment_mode` + tabla `payment_provider_secrets`
  (sin policies, solo `service_role`) + índice único `(provider, external_user_id)` [M4]:
  `20260714000004_school_payment_providers_connect.sql`.
- ✅ **Cifrado de tokens**: AES-256-GCM en el BFF con clave dedicada
  `PAYMENT_TOKENS_ENC_KEY` (`utils/payment-crypto.ts`) — se resolvió así, **no** Vault/pgsodium.
- ✅ **Fail-closed [M1]** en `resolveProvider` (`payment-provider.resolver.ts:197`): una
  escuela en `payment_mode='direct'` sin provider habilitado, en estado `expired`/`error`,
  o con secretos que no descifran → checkout **bloqueado**, nunca cae a las llaves ENV.
- ✅ Backfill honesto: todas las escuelas quedaron en `payment_mode='aggregator'`, o sea el
  comportamiento actual (llaves globales) se preservó intacto.

Falta:
- ❌ **Lado escritor — el hueco que bloquea la fase.** `encryptSecret()` no se invoca en
  ninguna ruta: `payment_provider_secrets` nunca se puebla. El CRUD de
  `payment-providers.routes.ts` sigue escribiendo en las columnas legacy **en claro**, ya
  marcadas `DEPRECATED` por la propia migración. Consecuencia: marcar una escuela como
  `direct` hoy le apaga el checkout (fail-closed correcto, sin credenciales que leer).
- ❌ Gate: conectar requiere addon de pasarela activo. `has_entitlement()` y las keys
  `wompi`/`mp` de `school_addons` **ya existen** (`20260513000007`) — falta solo cablearlas.
- ❌ Endpoint para conmutar `payment_mode` con prueba previa de credenciales.
- ❌ Auditoría de conexión/desconexión y de cambios de `payment_mode`.
- ❌ Externos: `redirect_uri` de la app MP OAuth registrado + trámite modo Marketplace [M6].

➡️ Plan de cierre detallado: [`payments-connected-accounts-fase0-cierre.md`](./payments-connected-accounts-fase0-cierre.md).

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
| Fase 0 | Schema connect + cifrado + fail-closed | 🟡 ~70% (falta escritor + gate + switch de modo) |
| Fase 1 | MP OAuth Connect + split `application_fee` | 🔴 0% |
| Fase 2 | Wompi conexión guiada + validación de llaves | 🔴 0% |
| Fase 3 | Fallback agregador (Pagos a Terceros) | 🟡 solo fallback ENV; resto 0% |
| Fase 4 | Monetización + ganancias + alertas + auditoría | 🔴 0% |

---

## 5. Puntos a decidir para revisar el plan

1. ~~**Cifrado de tokens**~~ → **RESUELTO**: AES-256-GCM en el BFF (mismo patrón que
   WhatsApp), clave `PAYMENT_TOKENS_ENC_KEY`. Pendiente operativo: confirmar que la clave
   está seteada en Render y decidir versionado de clave (hoy rotarla invalidaría todo).
2. **Modo Marketplace en MP** (requisito para `application_fee`) — ¿ya se solicitó?
   Sin esto, el "1 clic" conecta pero **no cobra comisión** per-tx.
3. **`redirect_uri` OAuth** de la app MP (`1443783091543933`) — ¿registrado?
4. **Gate por addon** — confirmar que el botón "Conectar" vive detrás del addon de pasarela
   (Wompi +$50k / MP +$90k / ambos +$120k según el plan).
5. **Wompi:** aceptar que la comisión SportMaps va **solo por addon mensual** (no hay split
   per-tx con widget a merchant ajeno).

**Recomendación de arranque (2026-07-29):** cerrar Fase 0 con lo más chico y de mayor
valor — la **ruta de escritura cifrada** + el **gate por addon** + el **switch de
`payment_mode` con prueba de credenciales**. Con eso ya se puede conectar una escuela
piloto por el flujo manual, con secretos cifrados y fail-closed real, **sin depender del
trámite Marketplace de MP**. Después: Fase 2 (Wompi guiado, no tiene bloqueantes externos)
y Fase 1 (MP OAuth, arrancar por el trámite y no por el código).
