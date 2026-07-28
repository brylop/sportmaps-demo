# Plan — Conexión self-service de pasarelas por escuela (Connected Accounts)

**Fecha:** 2026-07-14 · **Estado:** v2.1 — decisiones cerradas, listo para ejecución (Fase 0) · **Autor:** aprobado

> **Changelog v2.1:** se cierran las dos decisiones abiertas — **[M2] pricing = Opción A**
> (MP addon $0 monetizado por application_fee ~1%; Wompi addon mensual ~$90k; opciones B y C
> descartadas) y **Fase 3 agregador = NO se activa** (queda como opt-in futuro; Fase 0 igual
> deja `payment_mode='aggregator'` preparado en schema, sin habilitar). Ya no quedan decisiones
> abiertas. Dos acciones derivadas de la Opción A en §9.
>
> **Changelog v2:** se integran 7 mejoras sobre la propuesta original, marcadas con `🔧 [Mn]`:
> **M1** fallback fail-closed (elimina caída silenciosa al agregador) · **M2** coherencia de
> pricing entre addons y application_fee · **M3** secretos en tabla separada solo-service_role ·
> **M4** refresh de tokens MP atómico + unicidad de cuenta · **M5** validación completa de llaves
> Wompi + ruteo de webhooks multi-tenant · **M6** trámite Marketplace MP como critical path ·
> **M7** facturación del application_fee (IVA) enlazada al plan de Factus.

## 1. Problema

Hoy SportMaps cobra con **dos modos** ya presentes en el código:

1. **Agregador (ENV global)** — el checkout usa las llaves globales de SportMaps
   (`MP_ACCESS_TOKEN_DEFAULT`, `WOMPI_PRIVATE_KEY`, etc.). La plata cae en la cuenta
   de comercio de SportMaps y habría que dispersarla. Ante la SFC esto es
   **captación irregular** si transferimos manualmente → riesgo regulatorio alto.
2. **Cuenta propia por escuela** — la tabla `school_payment_providers`
   ([migración 20260504000001](../supabase/migrations/20260504000001_payment_provider_generic.sql))
   guarda la configuración de pasarela por escuela.
   La plata cae **directo** en la cuenta de la escuela → riesgo regulatorio 0.
   **Pero hoy la escuela debe pegar sus llaves a mano** = fricción, errores, tokens caducados.

**Objetivo:** que cada escuela cree su cuenta en MercadoPago / Wompi y con el mínimo
esfuerzo la conecte a SportMaps, de forma que **SportMaps nunca sea recibidor del dinero**.

## 2. Lo que YA existe (no rehacer)

- `school_payment_providers` + `vendor_payment_providers` con RLS y trigger de único default.
- `payment-provider.resolver.ts`: `resolveProvider(ctx)` lee la config de la escuela,
  elige `is_default` o el primer `enabled`, y cae a ENV global si no hay nada.
  **Ya devuelve el `access_token` correcto por escuela.**
- `POST /api/v1/payments/create-session` ya llama a `resolveProvider({ schoolId })`.
- Checkout front (Wompi widget + MercadoPago Brick) ya operativo.

➡️ **La lógica de "usar la cuenta correcta" ya funciona.** Falta (a) **poblar** la tabla
fácil, (b) **cobrar la comisión SportMaps** en el modelo directo y
🔧 **[M1]** (c) **endurecer el fallback** para que nunca caiga al agregador por accidente.

## 3. Decisión de flujo de dinero (recomendada)

**Modelo objetivo: DIRECTO A LA ESCUELA (híbrido con fallback opcional, explícito y gateado).**

| Pasarela | Cómo conecta | A dónde va la plata | Comisión SportMaps |
|---|---|---|---|
| **MercadoPago** | OAuth Connect (1 clic) | Directo a cuenta MP de la escuela | `application_fee` automático por transacción (MP nos gira la comisión) |
| **Wompi** | Formulario guiado de llaves | Directo a cuenta Wompi de la escuela | **No hay split a nivel pasarela** → comisión vía addon SaaS mensual |
| **Agregador** (fallback opcional) | Nada (ENV global) | SportMaps recibe y dispersa | Requiere contrato "operador tecnológico" + cron payouts. **Solo si se decide activar y solo para escuelas explícitamente marcadas.** |

**Por qué directo:** riesgo regulatorio SFC = 0, no necesitamos ser SEDPE, no tocamos
plata de terceros.

### 🔧 [M1] Regla de fallback: fail-closed, nunca silencioso

El comportamiento actual del resolver ("si no hay config de escuela → ENV global") crea
un escenario inaceptable: si el token MP de una escuela expira o su conexión queda en
`error`, el checkout caería en silencio a las llaves de SportMaps y **la plata del padre
entraría a la cuenta de SportMaps sin decisión de nadie** — exactamente el riesgo
regulatorio que este plan elimina, reintroducido por un bug de refresh.

Nueva regla del resolver (cambio en Fase 0):

```
payment_mode de la escuela (nuevo campo, ver §4):
  'direct'      → SOLO llaves propias. Si connect_status ∈ {expired, error, disconnected}
                  → FAIL-CLOSED: checkout bloqueado con mensaje
                  "Pagos temporalmente no disponibles — contacta a tu academia",
                  alerta al admin de la escuela + al soporte SportMaps. NUNCA cae a ENV.
  'aggregator'  → ENV global (solo escuelas explícitamente marcadas; requiere Fase 3 activa).
  'unset'       → checkout deshabilitado (escuela aún no configura pagos).
```

El ENV global deja de ser fallback implícito y pasa a ser un modo **opt-in explícito**.
En staging/test se permite `aggregator` libremente; en prod requiere flag + contrato Fase 3.

### 🔧 [M2] Coherencia de pricing: addons vs application_fee

Tal como estaba (Wompi +$50k/mes sin fee por transacción · MP +$90k/mes **y además**
application_fee por transacción), la escuela racional elegía siempre Wompi — el escenario
donde SportMaps gana menos. El pricing empujaba a todos hacia el peor caso de ingresos.

**✅ DECISIÓN CERRADA (v2.1): Opción A.**

| Opción | MercadoPago | Wompi | Estado |
|---|---|---|---|
| **A** ✅ **ELEGIDA** | **Addon $0** — la monetización es el `application_fee` (~1% por tx exitosa) | **Addon mensual ~$90k/mes** (sube desde $50k) | **Decidida.** MP sin costo fijo → atractivo y adopción; monetizamos donde tenemos split automático. Precios equivalentes en volumen medio. |
| B | Addon $90k **con** application_fee reducido (0,5%) | Addon $50k | ❌ Descartada — mantenía el arbitraje hacia Wompi en volumen alto y dos fuentes de ingreso por MP (addon + fee) complican la comunicación. |
| C | application_fee sustituye al addon (escuela paga addon **o** fee) | — | ❌ Descartada — más simple de comunicar pero más complejo de facturar y de gatear por entitlement. |

Regla general (cumplida por A): **el costo total esperado para una escuela promedio es
similar en ambas pasarelas**, para que la elección sea por preferencia (Nequi vs cuotas MP),
no por arbitraje contra SportMaps.

> El **valor exacto de `application_fee_pct`** (punto de partida ~1%) queda pendiente de
> confirmar contra volúmenes reales — ver §9, acción derivada 2.

**Regla de negocio (sin cambio):** conectar una pasarela queda **gateada detrás del addon
de pasarela** (`school_addons`). Escuela sin addon → no ve el botón conectar. Con la
opción A, el "addon MP" existe a precio $0 solo como entitlement/gate.

## 4. Cambios de datos (migración NUEVA — regla de migraciones inmutables)

### 🔧 [M3] Secretos fuera de la tabla con RLS de escuela

`access_token`, `refresh_token`, `private_key` e `integrity/events_secret` **no** viven en
`school_payment_providers` (legible por admins de escuela vía RLS — un error de policy
expondría todo). Se separan en una tabla **sin ninguna policy de cliente**, accesible solo
con `service_role`:

Nueva migración `2026XXXX_school_payment_providers_connect.sql`:

```sql
-- Tabla visible (frontend puede leer estado, nunca secretos)
ALTER TABLE public.school_payment_providers
  ADD COLUMN IF NOT EXISTS connect_method    text
    CHECK (connect_method IN ('oauth','manual')),
  ADD COLUMN IF NOT EXISTS external_user_id  text,          -- MP user_id del merchant
  ADD COLUMN IF NOT EXISTS application_fee_pct numeric,     -- override por escuela (null = global)
  ADD COLUMN IF NOT EXISTS connect_status    text NOT NULL DEFAULT 'disconnected'
    CHECK (connect_status IN
      ('disconnected','connected','connected_pending_webhook','expired','error')), -- 🔧 [M5] nuevo estado
  ADD COLUMN IF NOT EXISTS connected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS connected_by      uuid REFERENCES public.profiles(id);

-- 🔧 [M1] modo de pago explícito a nivel escuela
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'unset'
    CHECK (payment_mode IN ('unset','direct','aggregator'));

-- 🔧 [M3] Secretos: SOLO service_role. Sin policies de cliente. Cifrado Vault/pgsodium.
CREATE TABLE IF NOT EXISTS public.payment_provider_secrets (
  provider_id      uuid PRIMARY KEY
                   REFERENCES public.school_payment_providers(id) ON DELETE CASCADE,
  access_token_enc     bytea,        -- cifrado con Vault
  refresh_token_enc    bytea,
  private_key_enc      bytea,
  integrity_secret_enc bytea,
  events_secret_enc    bytea,
  token_expires_at     timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_provider_secrets ENABLE ROW LEVEL SECURITY;
-- (deliberadamente sin CREATE POLICY: ningún rol de cliente puede leerla)

-- 🔧 [M4] Una cuenta MP no puede estar conectada a dos escuelas
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_external_user
  ON public.school_payment_providers (provider, external_user_id)
  WHERE external_user_id IS NOT NULL;
```

Migrar las llaves ya existentes en claro → cifradas en `payment_provider_secrets`, y
**vaciar** las columnas antiguas en la misma migración. El resolver descifra solo en el
BFF (service_role).

## 5. Fases de entrega

Cada fase se entrega **full-stack** (DB+RLS+RPC+BFF+API+Frontend+Auditoría+QA),
no migraciones sueltas.

### Fase 0 — Fundaciones (schema + seguridad + gating + fallback)
- Migración de columnas connect + `payment_provider_secrets` + `payment_mode` (§4).
- Cifrado de tokens (Vault). Refactor de `resolver` para descifrar vía service_role.
- 🔧 **[M1]** Refactor del resolver a la regla fail-closed (§3): eliminar el fallback
  implícito a ENV; estados `expired/error` bloquean checkout + alertan.
- Gate: conectar requiere addon de pasarela activo (`has_entitlement` / `school_addons`).
- **Registrar el `redirect_uri` de callback en la app MP OAuth** (`1443783091543933`).
- 🔧 **[M6]** **Arrancar YA (en paralelo) el trámite de modo Marketplace con MP**
  (calidad de integración ≥73): es el critical path de la Fase 1 y suele demorar
  semanas. No esperar a terminar Fase 0 para iniciarlo.

### Fase 1 — MercadoPago OAuth Connect (el "1 clic" real)
- **BFF** `GET /api/v1/payments/connect/mercadopago/authorize`
  → construye URL de autorización MP con `state` firmado (school_id + CSRF + expiración).
- **BFF** `GET /api/v1/payments/connect/mercadopago/callback`
  → valida `state`, intercambia `code` → token vía `POST /oauth/token`,
  upsert (`connect_method='oauth'`, `connect_status='connected'`), redirige con resultado.
  - 🔧 **[M4]** En el callback, verificar que el `external_user_id` devuelto por MP
    **no esté ya conectado a otra escuela** (índice único §4 + chequeo con mensaje claro).
    Evita que dos escuelas compartan cuenta por error o fraude.
- **BFF** job de refresh de tokens (MP expira ~180 días; usar `refresh_token`).
  - 🔧 **[M4]** El `refresh_token` de MP es **de un solo uso y rota en cada refresh**.
    El job debe: (1) persistir el nuevo par access+refresh **atómicamente** en la misma
    transacción del intercambio; (2) ser idempotente ante reintentos; (3) si el refresh
    falla definitivamente (token ya consumido/revocado) → marcar `expired`, disparar la
    alerta de M1 y pedir reconexión. Nunca dejar el registro con un refresh_token viejo
    tras un intercambio exitoso (crash entre exchange y upsert = conexión perdida).
- **Split:** inyectar `application_fee` (marketplace_fee) en la preferencia/pago MP
  en `mercadopago.service.ts` cuando la escuela está conectada por OAuth.
  ⚠️ Depende del trámite Marketplace iniciado en Fase 0 [M6].
- **Frontend** en `/mi-plan` (o Settings de pagos): tarjeta "MercadoPago" con botón
  **Conectar** → authorize → al volver muestra estado (Conectado · cuenta · Desconectar).
- **Resolver:** ya lee la fila; validar expiración contra `token_expires_at`.

### Fase 2 — Wompi conexión guiada (formulario)
- Wompi **no tiene OAuth marketplace**. UI wizard que pide `public_key`,
  `private_key`, `integrity_secret`, `events_secret` (con links/instrucciones al
  dashboard Wompi de la escuela).
- **BFF** `POST /api/v1/payments/connect/wompi`:
  - 🔧 **[M5]** Validación completa (no solo la pública):
    1. `GET /merchants/{public_key}` → valida la pública y trae datos del comercio.
    2. Llamada **autenticada con la privada** (ej. listar transacciones) → valida la privada.
    3. Rechazar llaves con prefijo `pub_test_`/`prv_test_` en prod, con mensaje claro
       ("estas son llaves de pruebas — copia las de producción"): será el error más
       común de las escuelas.
    4. El `events_secret` solo es verificable al recibir el primer webhook → estado
       inicial `connected_pending_webhook`; pasa a `connected` al validar la firma del
       primer evento real (o de un evento de prueba disparado desde el wizard).
  - Upsert (`connect_method='manual'`) con secretos cifrados en
    `payment_provider_secrets` [M3].
- 🔧 **[M5]** **Ruteo de webhooks multi-tenant:** con llaves por escuela, el endpoint
  de eventos debe identificar el tenant y validar la firma con el secret correcto.
  Decisión: URL por escuela `POST /webhooks/wompi/{school_id}` (se configura en el
  dashboard Wompi de la escuela durante el wizard, con copy-paste guiado) + verificación
  de firma con el `events_secret` de ESA escuela; lookup por `public_key` del payload
  como validación cruzada. Evento con firma inválida → 401 + log de auditoría.
- Plata 100% a la escuela; comisión SportMaps vía addon mensual [M2].

### Fase 3 — Fallback agregador (❌ NO SE ACTIVA — opt-in futuro documentado)
- **Decisión v2.1: NO se implementa.** El modelo directo (F1+F2) cubre el caso; el
  agregador reintroduce riesgo regulatorio y carga contable que no se justifican hoy.
- Fase 0 **sí deja preparado** `payment_mode='aggregator'` en el schema (§4), pero
  **sin habilitar** — es un placeholder para no tener que migrar si algún día se reabre.
- Si en el futuro aparece demanda real (escuelas que se niegan a abrir cuenta propia),
  reabrir esta fase requiere, en este orden:
  - `payment_mode='aggregator'` explícito por escuela [M1] — nunca por fallback silencioso.
  - ENV global + **Wompi "Pagos a Terceros"** (dispersión con planes fijos Bancolombia).
  - **Bloqueante:** contrato "operador tecnológico" con Wompi (2-4 semanas) + cron payouts
    + revisión contable de recaudos a favor de terceros.

### Fase 4 — Monetización + housekeeping
- Config `application_fee_pct` por escuela o global (coherente con la opción elegida en [M2]).
- 🔧 **[M7]** **Facturación del application_fee:** la comisión que MP gira a SportMaps es
  un ingreso por servicio **gravado con IVA** — requiere factura electrónica de SportMaps
  a cada escuela por el total mensual de fees. Enlazar con el plan `electronic_invoicing`
  (Factus): job mensual que consolida fees por escuela → emite factura DIAN → adjunta al
  estado de cuenta. Sin esto, el ingreso queda huérfano contablemente.
- Pantalla "Mis ganancias" (escuela ve neto recibido, con desglose bruto → comisión → neto).
- Alertas de token por expirar / conexión con error (conectadas al fail-closed de M1:
  avisar ANTES de que expire, no después de bloquear).
- Reconciliación con webhooks (ya existe base de reconciliation en migraciones).
- Auditoría: log de conexión/desconexión de pasarela, cambios de `payment_mode`,
  refreshes de token (éxito/fallo) y eventos de webhook rechazados por firma.

## 6. Requisitos externos / bloqueantes

- **MP:** aprobar modo Marketplace (para `application_fee`) — 🔧 [M6] **iniciar en
  Fase 0, es critical path**; registrar redirect_uri OAuth.
- **Wompi:** ninguno para el formulario guiado (llaves propias de cada escuela).
- **Wompi Pagos a Terceros:** contrato operador tecnológico (solo si se hace Fase 3).
- **Legal:** T&C "SportMaps Pay" y política de comisiones (campos
  `sportmaps_pay_terms_accepted_at/by` ya previstos).
- **Contable:** 🔧 [M7] tratamiento del application_fee (IVA, facturación a escuelas)
  validado con contador antes de activar el split en prod.
- **Seguridad:** cifrado de tokens + tabla de secretos solo-service_role [M3] antes de prod.
- **Pricing:** ✅ [M2] decidido (Opción A). Pendiente ejecutar las acciones derivadas
  de §9 antes de publicar precios de Fase 1.

## 7. Fuera de alcance de este plan

- Autopay / cobros recurrentes tokenizados (bloqueado en Wompi hasta `/v1/payment_sources`;
  MP-only por ahora — ver memoria `recurring-charges-status`).
- Facturación electrónica DIAN de las mensualidades de las escuelas (plan aparte,
  `electronic_invoicing`) — aquí solo se enlaza la facturación del fee de SportMaps [M7].

## 8. Matriz de riesgos residuales

| Riesgo | Mitigación | Fase |
|---|---|---|
| Caída silenciosa al agregador (captación) | Fail-closed + `payment_mode` explícito [M1] | 0 |
| Fuga de secretos por error de RLS | Tabla solo-service_role + cifrado Vault [M3] | 0 |
| Pérdida de conexión MP por refresh fallido | Persistencia atómica + alerta + reconexión guiada [M4] | 1 |
| Cuenta MP compartida entre escuelas | Índice único `external_user_id` + chequeo en callback [M4] | 1 |
| Escuela pega llaves de sandbox | Validación de prefijo + llamada autenticada [M5] | 2 |
| Webhook falsificado / cross-tenant | Firma por escuela + URL por tenant + auditoría [M5] | 2 |
| Ingreso por fees sin soporte fiscal | Facturación mensual automática vía Factus [M7] | 4 |
| Arbitraje de pricing hacia Wompi | ✅ **Cerrado** — Opción A adoptada [M2] (MP addon $0 + fee ~1%, Wompi ~$90k) | Cerrado v2.1 |

## 9. Acciones derivadas de la Opción A (pendientes, no bloquean Fase 0)

Cerrada la Opción A, dos pendientes que no deben quedar sueltos. Ninguno bloquea el
arranque de Fase 0; sí deben cerrarse **antes de publicar precios / activar el split en prod**.

### 9.1 — Actualizar la página de planes
- **Addon pasarela Wompi:** sube de **$50.000 → ~$90.000/mes**.
- **Addon pasarela MercadoPago:** **desaparece como costo fijo** → se comunica como
  **"1% por transacción exitosa"** (sin mensualidad).
- Tocar tanto la **landing** (`sportmap-maps-landing-page`, sección Pricing) como el
  catálogo de planes/addons de la **app** (config de `school_addons` / `saas-plans`),
  y mantenerlos coherentes con la memoria de pricing vigente ([[project_landing_pricing_v3]]).
- Copy claro: MP = "sin mensualidad, 1% por transacción"; Wompi = "$90k/mes, sin comisión
  por transacción". Que la escuela entienda el trade-off (volumen alto → Wompi conviene;
  volumen bajo/incierto → MP sin costo fijo).

### 9.2 — Valor de `application_fee_pct` y modelado
- **Valor decidido: 1% global** como punto de partida (loss-leader de adopción, no fuente
  principal de ingreso — el ingreso es el SaaS). Revisable a escalonado según GMV.
- **Modelado contra datos reales (2026-07-14, DB demo/develop — caveat: no representa prod):**
  - 229 pagos online exitosos; volumen mensual **mediano por escuela ≈ $340k**, p90 $5.4M, máx $8.23M.
  - Umbral de indiferencia MP↔Wompi (1% = $90k) ≈ **$9.000.000/mes**. **0 de 30** escuela×mes
    lo cruzan → a estos volúmenes **el 1% de MP le cuesta a la escuela menos que el addon
    Wompi de $90k**, y a SportMaps le rinde poco por escuela ($3k–$82k/mes). Confirma que el
    fee es de adopción, no de exprimir. El arbitraje se invierte hacia MP — aceptable porque
    MP es donde tenemos split automático y cero fricción.

### 9.3 — Política de recargo al padre (`online_fee_pct`) y cuotas
**Fórmula** (ambos costos se descuentan del **bruto** que paga el padre):
```
bruto = base / (1 − costoMP − appFee) = base / 0.9485 ≈ base × 1.0543
recargo ≈ 5.43% de la base
```
`costoMP` = 3.49% × 1.19 IVA ≈ **4.15%** · `appFee` = **1%**. (Ajustar `costoMP` a la tarifa
real negociada de cada escuela + su tiempo de liberación.)

| Mensualidad base | Recargo (~5.43%) | Paga el padre | MP (4.15%) | Fee 1% | Escuela recibe |
|---|---|---|---|---|---|
| $150.000 | $8.145 | $158.145 | $6.563 | $1.581 | $150.001 ✅ |
| $180.000 | $9.774 | $189.774 | $7.876 | $1.898 | $180.000 ✅ |

Con el **3% actual** del código la escuela queda corta (~$3.457 en $150k). **Subir
`online_fee_pct` a ~5.5% global** antes de activar el split.

**Cuotas de tarjeta (TC) — dos modos, hay que dejarlo explícito en la UI:**
- **Con interés (DEFAULT recomendado):** el banco emisor le cobra el interés al padre; el
  costo para la escuela **no cambia** (~4.15%). La tabla de arriba vale sin importar en
  cuántas cuotas pague el padre.
- **Sin interés (MSI, opt-in):** la escuela **absorbe** un costo de financiación adicional
  que crece con el nº de cuotas (varios puntos %, variable y negociable). ⚠️ **No fijar
  tarifa sin el tarifario vigente de MP** para la cuenta conectada. Ofrecer solo como opt-in
  por escuela, con aviso claro de que ella asume el costo.
- ⚠️ **No confundir** las cuotas de tarjeta MP con los **abonos** de SportMaps
  (`allow_installments` / `min_installment_amount` en `school_settings` = pagar la
  mensualidad en partes a la escuela). Son cosas distintas; separarlas en UI y copy.

## 10. UX de configuración (school-facing) y branding SportMaps Pay

**Principio: simple para la escuela, complejo por dentro.** Referencia = Stripe Connect /
Shopify Payments — la plataforma es dueña de la integración; el comercio **nunca ve API
keys ni webhooks**, hace 1 clic y queda.

### Dos caras, dos audiencias
- **Padre (checkout):** marca única **"SportMaps Pay"**. No ve Wompi/MP, solo métodos
  (Tarjeta / PSE / Nequi / cuotas). [decisión firme del roadmap]
- **Escuela (config):** **sí** ve MP vs Wompi (conecta SU cuenta, la plata va ahí), pero
  **no pega llaves** → hace "Conectar".

### Pantalla "Recibir pagos" (school-facing)
Una sola pantalla, dos tarjetas + estado:
- **MercadoPago** — botón **Conectar** (OAuth 1 clic). Copy: "Sin mensualidad · 1% por
  transacción exitosa · tarjeta, PSE, Nequi, cuotas".
- **Wompi** — botón **Conectar** (wizard guiado). Copy: "$90.000/mes · sin comisión por
  transacción · Nequi, PSE, tarjeta".
- Estado: Conectado (cuenta X) / Desconectar / Reconectar (si `expired`).
- Mostrar aquí, en lenguaje claro, el **recargo al padre** y la **política de cuotas** (§9.3).

### Self-service vs interno (concierge) — ambos
- **Self-service (primario):** la escuela conecta sola (OAuth MP / wizard Wompi). Escala,
  cero trabajo de SportMaps. Es lo que construye el plan.
- **Interno / super-admin (fallback):** el `PaymentProvidersAdmin` actual (pegar llaves) se
  **repurposea como herramienta interna de soporte** — para escuelas que necesitan que
  SportMaps se los configure. NO es la vía visible al cliente normal.

### Qué esconder / qué mostrar
- **Esconder del cliente:** API keys, webhook/integrity secrets, `application_fee_pct`,
  elección de sandbox.
- **Mostrar al cliente:** proveedor, estado de conexión, cuánto paga (addon/fee), qué recibe
  (neto), política de cuotas.
