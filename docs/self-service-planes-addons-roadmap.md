# Activación self-service de planes y addons (modelo "Netflix")

> **Objetivo:** que una escuela/vendor **pague en línea y active al instante** un
> plan o addon, con **renovación automática** — sin intervención humana.
> Hoy es un flujo manual asistido por ventas. Este doc es el roadmap para el salto.

## Estado actual (manual / asistido por ventas)
Flujo real (`bff/src/routes/upgrade-requests.routes.ts` + `plan_upgrade_requests`):

1. La escuela toca "Mejorar plan" / activar addon en **`/mi-plan`**.
2. `POST /api/v1/upgrade-requests` → crea `plan_upgrade_requests` (status `pending`).
   Respuesta: *"Solicitud recibida. Nuestro equipo te contactará pronto."*
3. Trigger notifica al **super_admin**.
4. Un humano procesa con `POST /:id/process` → RPC `rpc_process_upgrade_request`
   activa el cambio (`school_subscriptions` / `school_addons`) y pone el monto a mano.

**No hay pago en línea ni activación instantánea.** Es un flujo de *lead*.

## Modelo de derechos (entitlement)
- **`school_subscriptions`** — el plan SaaS que la escuela paga a SportMaps (plan_code, status). *(No confundir con `subscription_plans`, que es el catálogo que la escuela vende a sus familias.)*
- **`school_addons`** — addons activos por escuela (keys: `store`, `tournaments`, `access_control`, `biomech`, `nutrition`, `whitelabel`, `whatsapp`, `wompi`, `mp`, …).
- Los gates ya leen esto (ej. el grupo "Mi Tienda" aparece si el addon `store` está activo).

## Infraestructura que YA existe (reutilizable)
- Integración **Wompi / MercadoPago** (checkout + webhooks).
- **`payment_tokens`** — tokenización para cobro recurrente.
- **Motor de cobros recurrentes** (`recurring_subscriptions` + cron pg_cron / `/api/v1/recurring/run`).
- **Webhooks con ruteo por prefijo de referencia** (`bff/src/routes/wompi.ts` / mercadopago) → activan entidades al confirmar pago (patrón `handleXxx`).
- **Facturación electrónica** (SportMaps factura a la escuela) — ver `project_electronic_invoicing`.

→ El "modo Netflix" se construye **encima de estos rieles**, no desde cero.

## Roadmap por fases

### Fase 1 — Autoservicio con activación instantánea (MVP)
- En `/mi-plan`, "Activar/Mejorar" abre **checkout en línea** (Wompi/MP) en vez de crear un request. Referencia con prefijo dedicado (ej. `SAAS-` / `ADDON-`).
- **Webhook**: al confirmarse el pago, rutear ese prefijo → RPC nuevo `rpc_activate_entitlement(school_id, plan_code|addon_key, period)` que marca `school_subscriptions`/`school_addons` **activo** e idempotente por `provider_reference`.
- Resultado: **pagó → activado al instante**. Renovación aún manual (recordatorio mensual).
- El flujo de `upgrade_requests` se conserva **solo** para `contact_sales` / enterprise (ticket alto, precio negociado).

### Fase 2 — Renovación automática (auto-renew)
- Guardar `payment_token` en la primera compra.
- Cron mensual (reusar `recurring_subscriptions`) cobra el token y extiende `current_period_end`.
- Emitir **factura electrónica** de cada cobro (ya tenemos el motor).

### Fase 3 — Ciclo de vida completo
- **Dunning**: fallo de cobro → período de gracia + reintentos → si no paga, **downgrade automático** al plan free / desactivar addon.
- **Proration** al subir de plan a mitad de ciclo (cobrar solo la diferencia).
- **Downgrade / cancelación** self-service (al final del período).
- **Trial** (X días gratis, luego cobra el token).

### Fase 4 — Onboarding self-serve desde la landing
- Landing `/planes` → registro → pago → escuela activa **sin tocar a ventas**. Escala real.

## Consideraciones
- **Regulatorio:** cada cobro de SaaS debe emitir factura electrónica a la escuela (usar el mismo motor multi-PAC).
- **Gating consistente:** un solo punto de verdad de entitlement (`school_subscriptions` + `school_addons`) que ya leen los gates; no duplicar checks.
- **B2B vs self-serve:** mantener la ruta `contact_sales` para enterprise; el autoservicio es para Start/Pro/Elite y addons de bajo ticket.
- **Idempotencia:** activar por `provider_reference` único (mismo patrón anti-duplicado que pagos).

## Dónde tocar (cuando se ejecute)
- `frontend/src/pages/MiPlanPage.tsx` — checkout en vez de request.
- `bff/src/routes/wompi.ts` / `mercadopago.ts` — handler `handleSaasPayment` por prefijo.
- Migración — `rpc_activate_entitlement` + columnas de período/renovación en `school_subscriptions`/`school_addons`.
- `bff/src/services/recurring-charges.service.ts` — extender para SaaS.
