# Plan — Cierre del ruteo de pagos

**Fecha:** 2026-08-01 · **Estado:** 🟡 propuesto, sin aprobar · **Rama:** `develop`
**Origen:** auditoría "¿dónde se está yendo el dinero de Dynasty?"
**Roadmap:** [`DIN-9`](ROADMAP.md#din--dinero-y-cobros) (F-A) · [`DIN-6`](ROADMAP.md#din--dinero-y-cobros) (F-B, F-C, F-F) · [`DIN-10`](ROADMAP.md#din--dinero-y-cobros) (F-E) · gate duro de [`MOD-11`](ROADMAP.md#mod--módulos-de-producto) (F-D)

> **Resultado de la auditoría: no hay fuga.** Los 5 cobros Wompi de Dynasty
> (819.000 COP, 29-jul → 1-ago) fueron todos a su propio comercio `1298966`. Los 14 del
> comercio `11981889` son todos de la Escuela Demo. Cero cruce entre comercios.
>
> Este plan **no arregla un incidente** — cierra el inventario de riesgos que quedó a la
> vista mientras se descartaba.

## 1. Estado real verificado — corrige los dos docs existentes

Ambos docs de connected-accounts están **desactualizados y subestiman el avance**. Verificado
contra el código el 2026-08-01:

| Pieza | Lo que dicen los docs | Realidad |
|---|---|---|
| `wompi.service.ts` parametrizado | ❌ "el entregable más grande de la fase" (fase0-cierre §2 quater) | ✅ **Hecho.** Todas las funciones toman `creds?: WompiCreds`; existe `wompiCredsFrom()` |
| Lado escritor cifrado | ❌ "el hueco que bloquea la fase" (STATUS §Fase 0) | ✅ **Hecho.** RPC `upsert_school_provider` (mig `20260730000004`) + `encryptSecret` cableado en `payment-providers.routes.ts:170-176` |
| Firma del Widget por escuela | ❌ "bloquea `direct`" (fase0-cierre) | ✅ **Hecho.** `create-session` firma en el BFF para `school_direct`; la EF `wompi-sign` queda solo para el camino legacy |
| Resolver fail-closed + `payment_mode` | ✅ | ✅ Confirmado |
| **Gate por addon** | ❌ pendiente | ❌ **Peor: es código muerto.** El helper que llama `has_entitlement` está definido en `payment-providers.routes.ts:365-375` y **no se invoca desde ninguna ruta** |
| **Switch de `payment_mode`** | ❌ pendiente | ❌ **No existe endpoint en todo el BFF.** Solo se puede cambiar por SQL a mano |
| Validación de llaves contra la API del proveedor | ❌ pendiente | ❌ Confirmado. Solo hay un rechazo estático de prefijos `pub_test_` en prod |
| 5 endpoints de marketplace sin resolver | ❌ pendiente | ❌ Confirmado — pero **inertes**: `marketplace_transactions` no existe en la BD |
| Webhooks multi-tenant (M5) | ❌ pendiente | ❌ Confirmado |

➡️ **Fase 0 está ~85%, no ~70%**, y lo que falta es más chico y distinto de lo documentado.
Actualizar `payments-connected-accounts-STATUS.md` es parte de F-B.

### 1.1 Re-verificación independiente (2026-08-01, segunda pasada)

Los tres hallazgos que definen la prioridad se comprobaron por separado. Los tres se confirman, con
referencias exactas:

| Afirmación | Confirmación |
|---|---|
| El gate por addon es código muerto | `hasGatewayAddon()` está en [`payment-providers.routes.ts:368`](../bff/src/routes/payment-providers.routes.ts#L368) y una búsqueda global en `bff/src` **no encuentra ninguna invocación** |
| MP no tiene host de sandbox | [`mercadopago.service.ts:29`](../bff/src/services/mercadopago.service.ts#L29): `const MP_API_BASE = 'https://api.mercadopago.com'` — una sola URL, la credencial decide el ambiente. (La referencia original decía `:30`; es la 29) |
| El bypass de marketplace | `resolveProvider` se importa en [`marketplace-checkout.routes.ts:29`](../bff/src/routes/marketplace-checkout.routes.ts#L29) y **solo se invoca en la línea 446** |
| `wompi.service.ts` sí está parametrizado | `WompiCreds` en [`:45`](../bff/src/services/wompi.service.ts#L45), `resolveCreds()` en [`:61`](../bff/src/services/wompi.service.ts#L61), `wompiCredsFrom()` en [`:84`](../bff/src/services/wompi.service.ts#L84), `baseUrlFor(creds)` en [`:104`](../bff/src/services/wompi.service.ts#L104) |

## 2. Hallazgos nuevos de esta auditoría

1. **🔴 Dev usa credenciales de MercadoPago de producción.** `MP_ACCESS_TOKEN_DEFAULT` y
   `MP_PUBLIC_KEY_DEFAULT` tienen prefijo `APP_USR-` (en MP: `TEST-`=sandbox,
   `APP_USR-`=producción). `MP_ENV=sandbox` **no corrige nada**: solo llena un booleano
   informativo en el resolver, y `mercadopago.service.ts:30` tiene una sola URL
   (`https://api.mercadopago.com`) — MP no tiene host de sandbox, la credencial decide.
   Además `MARKETPLACE_DEFAULT_PROVIDER=mercadopago`. Un pago "de prueba" desde dev **cobra
   de verdad**. La cuenta es de SportMaps (confirmado por el user), así que no hay dinero
   ajeno en juego — pero el footgun está armado.

2. **🟡 SportMaps recibió dinero de terceros.** Los cobros de Academia Porras y MMA Blair
   (mayo) pasaron por `MP_ACCESS_TOKEN_DEFAULT` = cuenta de SportMaps. Es exactamente el
   riesgo regulatorio (captación irregular ante la SFC) que el modelo directo-a-escuela
   existe para evitar.

3. **🟢 El bypass de marketplace está inerte, pero con fecha de vencimiento.** Los 5
   endpoints de `marketplace-checkout.routes.ts` (líneas 135, 191, 248, 314, 568) no llaman
   a `resolveProvider` — solo el de carrito (446) lo hace. Caerían a ENV, que en stg es
   Dynasty. Hoy no pueden cobrar porque `marketplace_transactions` no existe en esta BD.
   **Se activa solo el día que se desplieguen las migraciones de marketplace.**

## 3. Fases

Una rama por fase, revisión entre cada una. Sin escribir SQL hasta aprobar el plan de la
fase que lo requiera.

### F-A — Higiene de ambientes 🔴 primero

Barato, sin migración, sin tocar prod. Desarma el footgun de MP.

- Cambiar `MP_ACCESS_TOKEN_DEFAULT` / `MP_PUBLIC_KEY_DEFAULT` de **dev** (Render `bffdev` +
  Vercel dev) a credenciales `TEST-`.
- Guard de arranque en el BFF: validar coherencia **prefijo de credencial ↔ `*_ENV`** para
  MP y Wompi. Incoherencia (`APP_USR-` con `MP_ENV=sandbox`, o `pub_test_` con
  `WOMPI_ENV=production`) → **fail-fast al arrancar**, no warning.
- Que `MP_ENV` deje de ser cosmético: derivar `sandbox` del prefijo del token, no de la
  variable.

**Cierre:** el BFF de dev no arranca con credenciales de producción. Un pago de prueba en
dev no mueve plata real.

### F-B — Cerrar Fase 0: gate + switch + validación

Lo que realmente falta de F0, ahora que el escritor y la parametrización ya existen.

- **Cablear el gate por addon** — invocar el helper de `has_entitlement` en `POST
  /school/:schoolId` y `POST /vendor/:vendorId`. Hoy es código muerto.
- **Endpoint de switch de `payment_mode`** con **prueba de credenciales previa**: no se
  conmuta a `direct` si las llaves no validan contra la API del proveedor.
- **Validación real de llaves**: Wompi `GET /merchants/{public_key}`, MP `GET /users/me`.
- **Auditoría** de conexión / desconexión / cambio de modo (migración nueva — plan antes de
  SQL).
- Actualizar `payments-connected-accounts-STATUS.md` con el estado real de §1.

**Cierre:** una escuela piloto se conecta por el flujo manual, con secretos cifrados,
fail-closed real y sin depender del trámite Marketplace de MP.

> ⚠️ **Dependencia con entitlements, verificar antes de cablear el gate.** `hasGatewayAddon()` llama
> `has_entitlement`, y hay un defecto abierto en esa capa ([`SEG-7`](ROADMAP.md#seg--seguridad-rls-y-permisos)):
> una lectura sin privilegio devuelve **todos los addons en `false`** y el status inventado como
> `active`, con HTTP 200 y sin error. Si el gate cayera en ese camino, **ninguna escuela podría
> conectar su pasarela** y el mensaje de error sería «no tienes el addon», que es falso. El BFF usa
> service role, así que en principio pasa el guard — **confirmarlo con una prueba, no asumirlo.**

### F-C — Migrar Dynasty de ENV a `direct`

Operativa, **orden estricto** (invertirlo le apaga el checkout a Dynasty). El orden ya está
fijado en `payments-connected-accounts-fase0-cierre.md` §2 quater:

1. Confirmar `PAYMENT_TOKENS_ENC_KEY` seteada en el BFF del ambiente **antes** de que exista
   una escuela en `direct` (sin la clave, `getEncKey()` lanza → checkout muerto).
2. Subir el código de F-B.
3. Migrar las 4 llaves de Dynasty de ENV → tabla (cifradas) y conmutar a `direct`.
4. **Validar un cobro real de Dynasty antes de seguir.**
5. Recién entonces: el resto de escuelas a `unset` y vaciar las `WOMPI_*` de ENV.

**Cierre:** un cobro real de Dynasty liquidado por la tabla, no por ENV.

### F-D — Cerrar el bypass de marketplace ⛔ gate de despliegue

- Los 5 endpoints pasan por `resolveProvider` con `vendorId`/`schoolId`, y devuelven
  `provider` + `publicKey` + `signature` como hace `create-session`.
- Test que **falle** si un endpoint crea una referencia de pasarela sin resolver el dueño.

**Gate duro:** no desplegar las migraciones de `marketplace_transactions` hasta cerrar esta
fase. Hoy el riesgo es teórico solo porque la tabla no existe.

### F-E — MercadoPago: dinero de terceros ya recibido

- Tratamiento de los cobros de Porras y MMA Blair que entraron a la cuenta de SportMaps
  (**decisión D2, abajo**).
- Parametrizar el camino MP igual que Wompi y migrar esas escuelas a `direct` o `unset`.

### F-F — Webhooks multi-tenant (M5) + vaciar ENV

Última. Mientras el webhook valide checksum con el `WOMPI_EVENTS_SECRET` global y
re-consulte con `WOMPI_PRIVATE_KEY` global, **vaciar las `WOMPI_*` de ENV rompe la
reconciliación de Dynasty**. Solo después de F-C validado.

## 4. Decisiones abiertas

- **D1 — `PAYMENT_TOKENS_ENC_KEY`:** ¿está seteada en Render (stg y prod)? Bloquea F-C paso 1.
  No hay versionado de clave: rotarla hoy invalidaría todos los secretos guardados. Vale
  añadir `key_version` a `payment_provider_secrets` mientras la tabla está casi vacía.
- **D2 — Dinero de terceros (Porras / MMA Blair):** ¿se concilia, se devuelve, o se documenta
  como histórico cerrado? Decisión de negocio, no técnica. Bloquea F-E.
- **D3 — Credenciales `TEST-` de MP en dev:** ¿rompe algún flujo que hoy se pruebe contra la
  cuenta real? Si sí, F-A necesita una excepción explícita en vez del fail-fast.
- **D4 — Receptor de webhook de Wompi:** no está claro cuál tiene configurado Dynasty en su
  dashboard — la Edge Function `wompi-webhook` o la ruta del BFF. Hay dos receptores.
  Verificar **antes** de tocar nada de webhooks. Bloquea F-F.

## 5. Orden y criterio

```
F-A ──> F-B ──> F-C ──> F-F
                 │
                 └──> F-E
F-D: independiente, pero OBLIGATORIA antes de desplegar marketplace
```

F-A primero porque es la única con un footgun vivo y cuesta una sesión. F-D no depende de
las demás pero es un gate de despliegue, no una mejora.

**Fuera de alcance:** MP OAuth 1-clic y `application_fee` (Fase 1 del plan original), wizard
Wompi guiado (Fase 2), pantalla "Mis ganancias" (Fase 4).
