# Plan — Cierre de Fase 0 (Connected Accounts)

Complemento de [`payments-connected-accounts-plan.md`](./payments-connected-accounts-plan.md) §5 Fase 0.
Alcance: **cerrar** lo que quedó a medias en el WIP `c5bae84`, sin entrar en Fase 1 (MP OAuth)
ni Fase 2 (wizard Wompi). Fecha: 2026-07-29.

**Estado de partida (verificado en código):** el lado *lector* de Fase 0 está hecho
(schema, cifrado, resolver fail-closed). El lado *escritor* no existe.

---

## 0. Estado de implementación (2026-07-30)

| Pieza | Estado |
|---|---|
| Contención: `unset` bloquea, ENV solo para la escuela `aggregator` | ✅ migs `…0002`+`…0003` aplicadas · resolver |
| Bypass `school_settings.wompi_enabled` en `create-session` | ✅ eliminado |
| Fail-closed para vendor / checkout sin dueño | ✅ resolver · `listProvidersForMarketplace()` → `[]` |
| `wompi.service.ts` parametrizado por comercio (`WompiCreds`) | ✅ 9 funciones · cache de acceptance tokens por `public_key` |
| RPC `upsert_school_provider` (2 escrituras, 1 transacción) | ✅ mig `…0004` — **falta aplicar** |
| Ruta de escritura cifrada + gate por addon + rechazo llaves test | ✅ `payment-providers.routes.ts` |
| Firma del Widget movida de la Edge Function al BFF | ✅ `create-session` devuelve `signature` · frontend la prefiere |
| Webhook multi-tenant (checksum con el events_secret de la escuela) | ✅ `credsForReference()` en `routes/wompi.ts` |
| Callers restantes de `wompi.service` sin `creds` | ⏳ 6 (ver §2 quinquies) |
| Migrar Escuela Demo → `direct` (llaves sandbox propias) | ⏳ primer caso de prueba |
| Migrar Dynasty ENV → tabla cifrada → `direct` | ⏳ último paso |
| `PAYMENT_TOKENS_ENC_KEY` en Render dev+stg | ✅ |

### §2 quinquies — Callers que siguen leyendo ENV

No bloquean el checkout ni el webhook, pero sí romperían flujos secundarios de una escuela
en `direct` (usarían el comercio de ENV en vez del suyo):

| Dónde | Función | Nota |
|---|---|---|
| `payment-tokens.routes.ts:225` | `fetchAcceptanceTokens` | guardar tarjeta |
| `payment-tokens.routes.ts:105` | `voidPaymentSource` | borrar tarjeta |
| `webhook-reprocess.service.ts:47` | `fetchTransaction` | reproceso de webhooks |
| `recurring-charges.service.ts:339` | `createTransactionWithPaymentSource` | autopay Wompi (hoy bloqueado por falta de `/v1/payment_sources`) |
| `maintenance.job.ts:152` | `createTransactionWithToken` | ruta deprecada |
| `marketplace-checkout.routes.ts:710` | `voidTransaction` | marketplace (tablas no desplegadas) |

## 1. El hueco, en una línea

`encryptSecret()` no se invoca en ninguna ruta → `payment_provider_secrets` **nunca se
puebla** → el resolver en modo `direct` siempre cae en "sin secretos descifrables" y
bloquea el checkout. Mientras tanto, [`payment-providers.routes.ts`](../bff/src/routes/payment-providers.routes.ts)
sigue guardando llaves **en claro** en las columnas legacy de `school_payment_providers`,
ya marcadas `DEPRECATED` por la migración `20260714000004`.

No hay daño en producción hoy: el backfill dejó **todas** las escuelas en
`payment_mode='aggregator'`, así que nadie toca el camino nuevo. Pero Fase 0 no es
usable, y no hay forma de conectar ni una escuela piloto.

Corolario de diseño: **la DB no puede cifrar** (la clave `PAYMENT_TOKENS_ENC_KEY` vive
en el BFF, por decisión de Fase 0 — AES-GCM en BFF en lugar de Vault/pgsodium). Todo
cifrado ocurre en Node; Postgres solo recibe y guarda texto ya cifrado.

---

## 2. Entregables

### F0.1 — Ruta de escritura cifrada (DB + BFF + API)

**Migración nueva** (`YYYYMMDDHHMMSS_connected_accounts_write_path.sql`):

- RPC `upsert_school_provider(...)` `SECURITY DEFINER`, **una sola transacción** para las
  dos escrituras (fila visible + fila de secretos). Recibe los secretos **ya cifrados**
  desde el BFF, en un `jsonb` (`{access_token_enc, refresh_token_enc, private_key_enc,
  integrity_secret_enc, events_secret_enc}`) — la función nunca ve plaintext ni la clave.
  - `INSERT … ON CONFLICT (school_id, provider) DO UPDATE` sobre la fila visible
    (`public_key`, `sandbox`, `enabled`, `is_default`, `connect_method`, `connect_status`,
    `connected_at`, `connected_by`), y `ON CONFLICT (provider_id) DO UPDATE` sobre
    `payment_provider_secrets`, con **merge por clave**: una clave ausente en el `jsonb`
    **no** borra la existente (editar solo la `private_key` no debe dejar sin
    `events_secret`). Un `null` explícito sí borra.
  - `SET search_path = pg_catalog, public, pg_temp` (convención obligatoria del repo).
  - `GRANT EXECUTE … TO service_role` **únicamente**. No a `authenticated`: si el cliente
    pudiera llamarla, se saltaría el gate de addon y la validación de llaves del BFF.
  - Deja las columnas legacy de secretos en `NULL` para escrituras nuevas de escuela.
- Trigger de auditoría (`audit_trigger_func`, ya existe en el repo) sobre
  `school_payment_providers` y sobre `schools.payment_mode`. Confirmar el shape de la
  tabla de destino al escribir la migración.

**BFF** — refactor de [`payment-providers.routes.ts`](../bff/src/routes/payment-providers.routes.ts):

- `ProviderUpsertSchema` pasa a **`z.discriminatedUnion('provider', …)`**. Hoy un solo
  schema plano sirve a los dos providers y no alcanza para Wompi:
  - `wompi`: `publicKey`, `privateKey`, `integritySecret`, `eventsSecret` (las 4 llaves reales).
  - `mercadopago`: `publicKey`, `accessToken`.
  El mapeo actual (`accessToken` haciendo de private key, `webhookSecret` de events secret)
  es ambiguo y hay que dejarlo explícito ahora, no en Fase 2.
- `POST /school/:schoolId` y los secretos del `PATCH /:id` → cifran con `encryptSecret()`
  y llaman la RPC. `connect_method='manual'`.
  - ⚠️ **Incoherencia detectada:** el resolver exige `connect_status === 'connected'`
    exacto ([`payment-provider.resolver.ts:231`](../bff/src/services/payment-provider.resolver.ts#L231)),
    así que dejar Wompi en `'connected_pending_webhook'` **bloquearía el checkout** — justo
    lo contrario de lo que busca ese estado. Decisión: el estado intermedio se usa solo
    entre que se guardan las llaves y que se valida el primer webhook, y el resolver pasa a
    aceptar `('connected','connected_pending_webhook')`, dejando el bloqueo para
    `expired`/`error`. Si no, la alternativa es marcar `'connected'` de una y el estado
    intermedio no sirve para nada.
- `GET /school/:schoolId` devuelve además `connect_method`, `connect_status`,
  `connected_at`, `external_user_id` y **booleanos** de presencia de cada secreto
  (`hasPrivateKey`, `hasEventsSecret`, …). Nunca el secreto, ni cifrado.
- `DELETE /:id`: el `ON DELETE CASCADE` de la FK ya limpia los secretos; solo añadir la
  entrada de auditoría.
- **Camino vendor sin tocar** (sigue plaintext legacy): lo leen aún vendor + recurring +
  marketplace. Migrarlo es una fase aparte, tal como anticipó el comentario de la migración.

### F0.2 — Gate por addon (BFF + Frontend)

- `has_entitlement(school_id, 'wompi' | 'mp')` y las keys `wompi`/`mp` de `school_addons`
  **ya existen** (`20260513000007`) — no hay que crear nada en DB.
- BFF: `POST`/`PATCH` de escuela y el switch de `payment_mode` responden `403
  addon_required` si el addon del provider no está activo. **Admin global bypassa**
  (onboarding concierge), y ese bypass queda auditado.
- Frontend: la tarjeta de conexión en [`SportMapsPaySettings.tsx`](../frontend/src/components/settings/SportMapsPaySettings.tsx)
  se muestra bloqueada con CTA a `/mi-plan` cuando falta el addon. El gate de UI es
  cosmético; el que manda es el del BFF.

### F0.3 — Switch a `payment_mode='direct'` (lo que hace usable la fase)

Hoy no existe forma de conmutar una escuela a `direct`, y hacerlo a ciegas por SQL le
apaga el checkout. Entregable:

- `POST /payment-providers/school/:schoolId/payment-mode` con **validación previa
  obligatoria**: solo permite `direct` si existe un provider `enabled`, con
  `connect_status IN ('connected','connected_pending_webhook')`, y cuyos secretos
  **descifran y pasan una llamada real al provider** (`GET /merchants/{public_key}` en
  Wompi; `GET /users/me` en MP). Si la prueba falla → `409` con el motivo, y no conmuta.
- Volver a `aggregator` siempre se permite (es la salida de emergencia).
- Autorización: school owner / `school_admin` / admin global. Auditado.

Regla que no se negocia: **nunca** se conmuta a `direct` sin una prueba de credenciales
verde. El fail-closed del resolver es correcto pero silencioso para el padre que va a
pagar; la única defensa es no dejar entrar a `direct` una config rota.

### F0.4 — Backfill de las llaves ya guardadas en claro (puede no aplicar)

⚠️ **Verificar antes de escribir el script.** Las llaves Wompi que hoy funcionan en
producción son las de la cuenta **de SportMaps** y viven en **ENV de Render**
(`WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_SECRET` /
`WOMPI_EVENTS_SECRET`), no en `school_payment_providers`. Si la tabla está vacía —
probable — **este entregable desaparece**. Query para confirmar:

```sql
SELECT school_id, provider, access_token IS NOT NULL AS tiene_secreto_legacy
FROM public.school_payment_providers;
```

Si hay filas, el plan es el siguiente. Como Postgres no puede cifrar, el backfill
es un **script one-shot del BFF** (`scripts/`), no una migración: lee las filas de escuela,
cifra, escribe vía la RPC, y **deja las columnas legacy intactas** (las lee todavía el
camino vendor/recurring). Idempotente: salta las filas que ya tienen secretos cifrados.

Su limpieza (drop de columnas legacy) es de la fase que migre el camino vendor.

### F0.5 — QA

Matriz mínima, con foco en no romper lo que hoy funciona:

| Caso | Esperado |
|---|---|
| Escuela en `aggregator` (todas hoy) | Comportamiento **idéntico** al actual — llaves ENV. Es el test de regresión que importa. |
| `direct` + secretos válidos | Checkout OK con la cuenta de la escuela. |
| `direct` + secretos corruptos / `PAYMENT_TOKENS_ENC_KEY` ausente | Checkout bloqueado, log claro, sin caer a ENV. |
| `direct` + provider `expired`/`error` | Bloqueado. |
| Conectar sin addon | `403 addon_required`. |
| Llaves `pub_test_`/`prv_test_` con `sandbox=false` | Rechazo con mensaje explícito (será el error más común de las escuelas). |
| Editar solo una llave | Las otras sobreviven (merge por clave de la RPC). |
| **Concurrencia:** dos upserts simultáneos del mismo `(school_id, provider)` | Una gana, sin fila huérfana sin secretos. `UNIQUE (school_id, provider)` + `FOR UPDATE` en la RPC. |
| Fallo entre las dos escrituras | Rollback completo (la transacción de la RPC es justamente esto). |

---

## 2 bis. Seguridad para las escuelas que ya están en producción

Hay escuelas cobrando en producción. Nada de esta fase las toca, y conviene dejar por
escrito por qué:

- **Las llaves Wompi que funcionan hoy no cambian de valor**, y `PAYMENT_TOKENS_ENC_KEY` no
  las cifra ni las lee (viven en ENV de Render, fuera de la DB).
- 🔴 **PERO: esas llaves de ENV son de DYNASTY, no de SportMaps.** Esto invalida la premisa
  con la que se escribió el backfill de `20260714000004` ("hoy TODA escuela cobra con las
  llaves globales de SportMaps (= agregador)"). El fallback global **no** es una cuenta
  agregadora: es la cuenta comercial de **una escuela concreta**. Ver §2 ter.
- **El código nuevo no está en producción.** El BFF de prod corre la rama `main`
  (`e205695`, release 2026-07-08); la migración `20260714000004` y el resolver fail-closed
  solo están en `develop` y `staging`. Verificado con `git branch --contains`.
- **Cuando develop llegue a main**, el camino nuevo sigue inalcanzable: el backfill deja
  toda escuela en `payment_mode='aggregator'`, y solo `'direct'` entra al código nuevo.
- **Si la migración no se aplica a la Supabase de prod** (`detdmtzfnoqvopxrvask`) pero el
  código sí sube: el `select('payment_mode')` falla, `schoolRow` queda null → `'unset'` →
  camino legacy ENV = comportamiento actual. Degrada seguro, pero **en silencio** (el
  `error` de esa query se ignora en [`payment-provider.resolver.ts:204`](../bff/src/services/payment-provider.resolver.ts#L204)).
  Vale añadir un log ahí.

## 2 ter. 🔴 Hallazgo: el fallback a ENV apunta a la cuenta de Dynasty

Las llaves `WOMPI_*` del ENV de Render son de **Dynasty**. El resolver, cuando una escuela
no tiene config propia, **cae a ENV**. Consecuencia:

> Cualquier escuela **distinta de Dynasty** que cobre online hoy le manda el dinero a la
> **cuenta comercial de Dynasty**. No es un riesgo regulatorio abstracto: es plata que
> aterriza en el merchant equivocado, y el padre recibe un comprobante de Wompi con el
> comercio de otra escuela.

Mientras Dynasty sea la única escuela cobrando online, no hay daño. El día que entre la
segunda, hay incidente. Esto **reordena la Fase 0**: el fallback a ENV deja de ser "legacy
inofensivo" y pasa a ser el problema a cerrar.

### ✅ Verificado 2026-07-30: no hubo fuga, el riesgo es a futuro

Diagnóstico sobre la BD de dev/staging. Escuelas con transacción de pasarela: 4.

| Escuela | Fecha | Provider | Evidencia |
|---|---|---|---|
| Academia deportiva porras | 2026-05-06 (×2) | mercadopago | ids `1571…` — no Wompi |
| MMA BLAIR TEAM | 2026-05-06 | mercadopago | id `1579…` — no Wompi |
| Escuela Demo SportMaps | 22–27 jul (×13) | wompi | comercio **`11981889`** |
| DYNASTY VOLLEY CLUB | 2026-07-29 | wompi | comercio **`1298966`** ← cobro real |

El primer segmento del `transaction_id` de Wompi identifica el comercio. Los dos prefijos
son distintos y consistentes ⇒ las pruebas de julio y el cobro de Dynasty fueron a
**cuentas distintas**: las llaves de ENV cambiaron entre el 27 y el 29 de julio.
**Ningún cobro de una escuela terminó en la cuenta comercial de otra.**

Lo que sí queda abierto es el futuro: hoy ENV tiene las llaves de Dynasty, así que
cualquier otra escuela que cobre ahora le manda el dinero a Dynasty. Lo cierra
`20260730000003_payment_mode_solo_dynasty_aggregator.sql` dejando a Dynasty como única
`aggregator` y el resto en `unset`.

### 🔴 Superficie pendiente: el camino marketplace/vendor no pasa por el resolver

La contención de `payment_mode` cubre **solo el camino escuela** (`payments.routes.ts`).
[`marketplace-checkout.routes.ts`](../bff/src/routes/marketplace-checkout.routes.ts) crea
referencias Wompi en 5 endpoints — `service` (135), `event` (191), `subscription` (248),
`session_booking` (314), `marketplace_pay` (568) — **sin llamar a `resolveProvider`**. Solo
el de carrito (446) lo llama, y con `vendorId`.

Esos endpoints devuelven `{reference, amountInCents}` sin provider ni public key, así que el
frontend la saca de `GET /payments/providers` sin contexto → `listProvidersForMarketplace()`
→ **ENV**, y la firma de la Edge Function `wompi-sign` → **ENV**. Resultado: todo cobro de
cita, evento, suscripción o reserva de cancha va a la cuenta comercial de ENV, que es la de
Dynasty. `schools.payment_mode` no lo cubre porque esos actores no son escuelas.

**Regla que lo cierra:** *ENV es exclusivamente para la escuela en `aggregator`.* Cualquier
otro contexto (vendor, organizer, marketplace sin dueño) hace fail-closed si no tiene
credenciales propias. Requiere quitar el fallback global de `resolveProvider` para
`vendorId` y de `listProvidersForMarketplace()`.

⚠️ Aplicar esa regla **puede romper un checkout de coach / gym / organizer que esté vivo**.
Auditar antes (la auditoría previa miró solo `payments`, no `marketplace_transactions`):

```sql
SELECT mt.payment_provider, mt.payment_status, count(*) AS n,
       min(mt.created_at) AS primera, max(mt.created_at) AS ultima
  FROM public.marketplace_transactions mt
 WHERE mt.provider_transaction_id IS NOT NULL
    OR mt.wompi_transaction_id IS NOT NULL
 GROUP BY 1, 2
 ORDER BY n DESC;
```

**Hilo aparte, sin resolver:** los cobros de porras y MMA BLAIR TEAM (mayo) fueron por
MercadoPago con las llaves de `MP_ACCESS_TOKEN_DEFAULT`. Hay que confirmar **de quién es
esa cuenta MP**: si es de SportMaps, entonces SportMaps recibió dinero de terceros — que
es justo el riesgo regulatorio que el modelo directo-a-escuela busca evitar. Mismo
tratamiento que Wompi: parametrizar y migrar a `direct`.

**Query de diagnóstico usada** (dejar para reauditar):
```sql
-- ¿Qué escuelas tienen pagos online activos además de Dynasty?
SELECT s.id, s.name, s.payment_mode,
       (SELECT count(*) FROM public.school_payment_providers p WHERE p.school_id = s.id) AS providers
FROM public.schools s
WHERE EXISTS (SELECT 1 FROM public.payments pay WHERE pay.school_id = s.id
              AND pay.payment_provider IS NOT NULL);
```

**Consecuencias en el plan:**
- **Dynasty es la primera escuela `direct`, no una piloto artificial.** Ya usa su propia
  cuenta; solo está cableada por el lugar equivocado. F0 tiene que **migrar sus 4 llaves de
  ENV → `school_payment_providers` + `payment_provider_secrets` cifradas** y ponerla en
  `payment_mode='direct'`. Ese es el backfill real de F0.4, no el de la tabla vacía.
- **`'unset'` tiene que BLOQUEAR**, no caer a ENV. Hoy `unset` y `aggregator` comparten el
  camino legacy ([`payment-provider.resolver.ts:244`](../bff/src/services/payment-provider.resolver.ts#L244))
  con un comentario que lo posterga a Fase 4. Con llaves de un tercero en ENV eso no se
  puede posponer: adelantarlo a F0.
- **El backfill de `20260714000004` marcó a TODAS las escuelas como `aggregator`**, o sea
  "usa ENV" = "usa la cuenta de Dynasty". Hay que corregir esos valores en la migración de
  F0.1: Dynasty → `direct`, el resto → `unset` (bloqueado). Migración nueva, nunca editando
  la vieja.
- **Vaciar las `WOMPI_*` de ENV** una vez Dynasty esté en `direct`, para que no quede una
  bomba armada. Ojo: el webhook valida firma con `WOMPI_EVENTS_SECRET` global — mientras eso
  siga así, el ruteo multi-tenant de webhooks (M5, Fase 2) sube de prioridad.

## 2 quater. 🔴 `wompi.service.ts` está cableado a ENV — el camino per-escuela de Wompi nunca funcionó

Hallazgo que reordena todo lo anterior. **Ninguna** función de
[`wompi.service.ts`](../bff/src/services/wompi.service.ts) recibe credenciales por
parámetro: `signIntegrity()`, `validateWebhookChecksum()`, `fetchTransaction()`,
`voidTransaction()`, `createPaymentSource()`, `createTransactionWithPaymentSource()`,
`createTransactionWithToken()`, `voidPaymentSource()` y `fetchAcceptanceTokens()` leen
`process.env.WOMPI_*` **directamente**, en ~8 puntos.

Contraste con MercadoPago, que **sí** está parametrizado (`createMpPayment({accessToken})`,
`fetchMpPayment(id, accessToken)`, `loadMpConfig()` que consulta la tabla y solo cae a ENV
si no hay fila). **El camino per-escuela de MP funciona; el de Wompi no.**

Consecuencias:

- Meter las llaves de Dynasty en la tabla y ponerla en `direct` **no cambiaría nada**: el
  cobro se seguiría firmando con las llaves de ENV. Hoy "funciona" por coincidencia — las
  de ENV *son* las de Dynasty.
- Para una **segunda** escuela en `direct` el checkout se rompe de forma silenciosa: el
  resolver entrega la `public_key` de la tabla, pero `signIntegrity()` firma con el
  `WOMPI_INTEGRITY_SECRET` de ENV → **firma inválida**. Falla en el widget, no en el BFF, y
  el log del BFF no dice nada útil.
- Por lo tanto **F0 para Wompi incluye parametrizar `wompi.service.ts`** (recibir las
  credenciales resueltas en vez de leer ENV) más sus callers. No estaba en el plan y es el
  entregable más grande de la fase.
- El **webhook** valida checksum con el `WOMPI_EVENTS_SECRET` global y re-consulta con
  `WOMPI_PRIVATE_KEY` global. Mientras siga así, **vaciar las `WOMPI_*` de ENV rompe la
  reconciliación de Dynasty**. El ruteo multi-tenant de webhooks (M5) deja de ser Fase 2 y
  pasa a ser prerequisito de tener dos escuelas cobrando por Wompi.

### 🔴 La firma del widget sale de una Edge Function: bloquea `direct`

Las llaves de Dynasty viven en **tres** sitios, no en uno:

| Dónde | Variables |
|---|---|
| Render (BFF) | `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_ENV` |
| Supabase secrets → EF [`wompi-sign`](../supabase/functions/wompi-sign/index.ts) | `WOMPI_INTEGRITY_SECRET` |
| Supabase secrets → EF [`wompi-webhook`](../supabase/functions/wompi-webhook/index.ts) | `WOMPI_INTEGRITY_SECRET` |

El frontend pide la firma de integridad **directo a la Edge Function**
([`lib/api/wompi.ts:85`](../frontend/src/lib/api/wompi.ts#L85)), no al BFF. Esa función
tiene un único integrity secret global y **no puede** tener el de cada escuela: los
secretos por escuela están cifrados con `PAYMENT_TOKENS_ENC_KEY`, que solo conoce el BFF.

⇒ **`payment_mode='direct'` no puede funcionar para Wompi mientras la firma salga de ahí**,
por más que `wompi.service.ts` ya esté parametrizado. Entregable adicional de F0:

- `create-session` devuelve `signature` junto con `reference`/`publicKey`, calculada con
  `signIntegrity(payload, creds)` usando las credenciales resueltas de esa escuela.
- El frontend deja de llamar a `wompi-sign`; la EF queda solo para el camino legacy
  (`aggregator`) y se retira cuando no quede nadie en ese modo.
- Revisar de paso `wompi-webhook`: usa `WOMPI_INTEGRITY_SECRET` como secreto de validación
  de webhook, donde correspondería el **events** secret. Hay dos receptores de webhook
  (esta EF y la ruta del BFF) y no está claro cuál tiene configurado Wompi en el dashboard
  de Dynasty — verificar antes de tocar nada de webhooks.

### Lo que esto implica para "migrar las llaves de Render"

Separar contención de estructura:

- **Contención (urgente, barata):** que ninguna escuela ≠ Dynasty pueda caer a ENV. Se logra
  bloqueando el fallback (`unset` → bloquea) y/o gateando el checkout por addon. **No
  requiere tocar las llaves de Dynasty ni parametrizar nada.**
- **Estructura (grande):** parametrizar `wompi.service.ts` + ruta de escritura cifrada +
  webhooks multi-tenant, y **recién entonces** migrar Dynasty ENV→tabla.

Migrar las llaves de Dynasty **primero** no compra nada: seguiría cobrando por ENV igual.

**Orden obligatorio para no romper prod**, en este orden y no otro:
1. Aplicar la migración a la Supabase de prod (backfill deja todo en `aggregator`).
2. Setear `PAYMENT_TOKENS_ENC_KEY` en `sportmaps-bff-prod` **antes** de que exista una sola
   escuela en `direct` (sin la clave, `getEncKey()` lanza → fail-closed → checkout muerto).
3. Subir el código.
4. Migrar las llaves de Dynasty de ENV a la tabla (cifradas) y conmutarla a `direct`, solo
   tras pasar la prueba de credenciales de F0.3. **Validar un cobro real de Dynasty antes
   de seguir.**
5. Recién entonces: el resto de escuelas a `unset` (bloqueado) y vaciar las `WOMPI_*` de ENV.
   Invertir 4 y 5 le apaga el checkout a Dynasty.

## 3. Decisiones abiertas

- **D1 — `PAYMENT_TOKENS_ENC_KEY` en Render:** ¿ya está seteada? Sin ella el camino nuevo
  no cifra ni descifra. Y no hay versionado de clave: rotarla hoy invalidaría todos los
  secretos guardados. Recomendación: setearla ahora y añadir `key_version` a
  `payment_provider_secrets` en esta misma migración, mientras la tabla está vacía y sale
  gratis.
- **D2 — Backfill vs. re-ingreso:** ¿corremos el script (F0.4) o se les pide a las escuelas
  con config manual que vuelvan a pegar sus llaves? Recomendación: backfill — son pocas
  filas y evita fricción con el cliente.
- **D3 — Alcance vendor:** confirmar que queda fuera (sigue plaintext hasta la fase que lo
  migre). Recomendación: sí, fuera; mezclarlo duplica el radio de regresión.

## 4. Orden de trabajo

1. F0.1 migración (RPC + auditoría) — **plan aprobado antes de escribir SQL**.
2. F0.1 BFF (schema discriminado + cifrado + RPC) y F0.2 gate.
3. F0.3 switch de `payment_mode` con prueba de credenciales.
4. F0.4 backfill, F0.5 QA.
5. Frontend: estado de conexión + gate + wizard mínimo de las 4 llaves Wompi.

Rama: `develop` (práctica real del repo). Al cerrar, actualizar
[`payments-connected-accounts-STATUS.md`](./payments-connected-accounts-STATUS.md).

**Fuera de alcance:** MP OAuth y `application_fee` (Fase 1), wizard guiado completo con
validación multi-paso y webhooks multi-tenant `/webhooks/wompi/{school_id}` (Fase 2),
pantalla "Mis ganancias" y alertas de expiración (Fase 4).

## 5. Dependencias externas (no bloquean este cierre)

Siguen pendientes y son critical path de Fase 1, conviene arrancarlas en paralelo:
registrar el `redirect_uri` de la app MP OAuth (`1443783091543933`) y el trámite de
**modo Marketplace** con MercadoPago (calidad de integración ≥73, demora semanas).
