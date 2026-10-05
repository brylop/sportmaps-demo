# Factura electrónica: preferencia y datos del pagador

Estado: construido en `develop` el 2026-10-05, **migración sin aplicar**
(`20261005133534_factura_electronica_preferencia_pagador.sql`).
Pedido: «Ten en cuenta la factura electrónica: si la quiere o no; debemos pedirles esos
datos o completarlos para enviárselos; eso debe tenerlo el bot también.»

## 1. Cómo se factura hoy (medido el 2026-10-05)

- **Quién emite.** `electronic_invoice_providers` tiene 2 filas: Escuela Demo
  (`factus` V1, sandbox) y **Dynasty** (`factus_v2`, producción, `enabled=true`, rango
  2697 = DYTY, nota crédito 2701, municipio por defecto 11001). El cron de 15 min
  (`autoEmitPendingInvoices`) factura sola cada escuela con `enabled=true`.
- **Dynasty sí emite**: 241 facturas `accepted` + 1 `rejected` (la DYTY1 histórica); la
  última del 2026-10-05 13:30. De 299 pagos `paid` desde el 1-sep, **78 siguen sin
  factura** (sin pagador con cuenta o sin documento).
- **De dónde salen los datos del comprador** (`invoicing.service.ts` → `loadCustomer`):
  `payments.parent_id`, si no `payments.user_id` → `profiles.document_type`,
  `document_number`, `full_name`, `email`, `phone`, `billing_address`,
  `billing_state_dane`, `billing_city_dane`. Los captura `BillingDetailsForm` (gate del
  checkout del papá y pago manual del admin vía `admin_set_payer_billing_details`).
- **Qué pasa cuando faltan**: NO hay consumidor final. Sin `parent_id`/`user_id` →
  `payment_without_payer`; sin documento → `customer_missing_fiscal_data`. El pago queda
  sin facturar (lo lista el panel «Datos fiscales faltantes»). Sin municipio decide la
  política del facturador (Dynasty: el del emisor).
- **No existía** ningún campo de «quiere factura» ni de razón social / correo de factura
  distintos del perfil.
- **Pagadores de Dynasty (cobros no anulados desde 2026-08-01), por camino:**

  | Camino | Pagadores | Con documento | Con doc + municipio DANE | NIT |
  |---|---|---|---|---|
  | `parent_id` (con cuenta) | 333 | 259 | 232 | 0 |
  | `user_id` (adulto) | 14 | 10 | 10 | 0 |
  | `child_id` sin cuenta | 141 | 0 (no hay dónde) | 0 | — |
  | `unregistered_athlete_id` | 4 | 0 | 0 | — |

  Los 141 sin cuenta tienen celular y correo en la ficha (`children.parent_*_temp`).
  **242 de ~492 pagadores (49 %) están completos hoy**; ninguno factura como empresa.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Preferencia de tres estados: `quiere` / `no_quiere` / `sin_respuesta` (default). | «No ha respondido» no es «no quiere»: no se le deja de pedir. |
| D2 | **Sin respuesta → todo como hoy.** No se cambia a consumidor final por defecto. | Hoy NO se emite a consumidor final; cambiarlo sería emitir ~250 facturas nuevas sin que nadie lo decida. |
| D3 | `quiere` → la factura sale con los datos que dejó (documento, nombre/razón social, correo); dirección y municipio caen a los del perfil si no los dio. | Permite factura a nombre de la empresa del papá sin tocar su perfil. |
| D4 | `no_quiere` → como hoy, salvo que el facturador tenga `config.consumidor_final = true`: entonces consumidor final (`CC 222222222222`, «Consumidor final»). Ese mismo flag también cubre «sin datos» en vez de saltar el pago. | Es decisión de cada escuela y su contador. **Apagado por defecto. No verificado contra el sandbox de Factus V2.** |
| D5 | Tabla nueva `payer_billing_profiles`, no columnas en `profiles`. | 141 pagadores no tienen perfil: el dueño puede ser `(school_id, phone10)`. Y no se pisa el documento del checkout desde un enlace público reenviable. |
| D6 | La tabla NO escribe `profiles`. La emisión la usa solo con `quiere`. | Una sola regla de precedencia, sin dos fuentes peleándose. |
| D7 | Datos mínimos: tipo + número de documento, nombre o razón social; correo opcional (validado si viene); municipio DANE y dirección opcionales. | Lo verificado en `factus-v2.adapter.ts → customerPayload`: obligatorios `identification`, `identification_document_code`, `names` (natural) o `company` (NIT), `legal_organization_code`, `tribute_code` (los dos últimos los deriva el adaptador del tipo). `email`, `address`, `phone` viajan vacíos si no hay; `municipality_code` es opcional y sin él decide la política del dueño. La responsabilidad fiscal (`R-99-PN`) solo la exige la nota crédito y se manda fija. El DV del NIT no se manda (lo calcula la DIAN) — igual que `BillingDetailsForm`. |
| D8 | Envío de la factura por correo del PAC: solo si el pagador pidió factura, dejó correo y la escuela activó `config.enviar_factura_por_correo = true`. | Hoy `send_email=false` a propósito (plantilla de Factus que no controlamos). Queda a decisión. |
| D9 | El bot captura **paso a paso y sin LLM**, y además ofrece el formulario. | Un documento mal leído quema un número de la resolución; el paso a paso valida cada dato. El formulario sirve a quien prefiere escribir todo junto. |

## 3. Modelo de datos (migración `20261005133534`, SIN aplicar)

`payer_billing_profiles`: `profile_id` **o** `(school_id, phone10)` (CHECK de un solo
dueño; únicos parciales), `preference` text+CHECK, `document_type` text+CHECK,
`document_number` (normalizado, sin DV), `legal_name`, `invoice_email`, `address`,
`city_dane` (5 dígitos), `department`, `source` (`app` / `enlace_publico` /
`whatsapp` / `escuela`), `answered_at`. CHECK: `quiere` exige tipo, número y nombre.
Con `no_quiere`/`sin_respuesta` los datos previos **no se borran**.

`whatsapp_conversation_flows`: `conversation_id` PK, `flow`, `step` (text+CHECK),
`data` jsonb, `expires_at`. Solo `service_role`.

### RLS y permisos

- `payer_billing_profiles`: RLS activa; `SELECT` propio (`profile_id = (select auth.uid())`)
  y de la administración de la escuela (`user_admin_school_ids()`, sin coaches) vía
  `factura_pagador_visible_para_admin()` (SECURITY DEFINER: lee `payments`, sin
  self-recursion). **Sin policies de escritura**: todo por RPC. Nada a `anon`.
- RPCs (todas con `SET search_path`, GRANT explícito, REVOKE a anon/authenticated):

  | RPC | Quién | Qué |
  |---|---|---|
  | `factura_pagador_guardar_mio(...)` | authenticated | identidad de `auth.uid()` |
  | `factura_pagador_upsert(...)` | service_role | núcleo (bot) |
  | `factura_pagador_por_token(token)` | service_role | resumen **enmascarado** |
  | `factura_pagador_guardar_por_token(token, ...)` | service_role | resuelve el pagador por el token |
  | `factura_pagador_de_cobro(payment)` | service_role | cascada de los cuatro caminos |
  | `factura_pagador_error_de_datos(...)` | service_role | validación única |

  Pasan I7 (gate visible en el cuerpo o sin EXECUTE para authenticated).

## 4. Canales

- **`/p/:token`** — bloque «Factura electrónica» (`id="factura"`) con Sí/No y formulario.
  `GET/PUT /api/v1/public/cobro/:token/factura`, rate limit 10 / 15 min por token+IP. El
  GET solo devuelve tipo, últimos 4 dígitos y correo `ju•••@dominio`; el PUT ignora
  cualquier id del cuerpo.
- **Correo del estado de cuenta** — si la escuela tiene facturador activo, línea
  «¿Necesitas factura electrónica? Completa tus datos aquí» → `/p/<token>#factura`
  (abre el formulario y hace scroll).
- **App** — `Mis pagos` → tarjeta `MiFacturaElectronicaCard` con el mismo componente
  (`FacturaElectronicaPreferencia`), precargado con su fila o su perfil.
- **Bot** (`whatsapp-factura.service.ts`), solo para contactos atendidos como familia:
  - con cuenta (conversación identificada) → dueño = su perfil; se le muestra lo
    guardado enmascarado;
  - sin cuenta (`debe_registrarse`) → dueño = escuela + celular; **nunca** se le
    muestra nada guardado;
  - disparadores: «factura», «necesito factura», «no quiero factura» (registra el no),
    botones `sm_fe_*`;
  - pasos: ¿quiere? → por aquí / formulario → tipo (CC / NIT / Otro) → número →
    nombre/razón social → correo («no tengo» vale) → resumen «Correcto / Corregir»;
  - 3 respuestas inválidas seguidas en un paso → manda el formulario; «cancelar» cierra;
    un botón de otra cosa o una pregunta suelta liberan el turno; vence a las 24 h;
  - si la escuela no factura, no pide nada.

### 5.4 Pendiente: oferta después de confirmar un pago

`ofertaTrasPago()` (mismo servicio) devuelve texto + botón «Quiero factura» para
pagadores que nunca respondieron. **No está conectada**: la confirmación del pago la
manda `jobs/whatsapp-queue.job.ts → aplicarComprobante` (~línea 367), que estaba en
edición por otra sesión. Conectar = anexar la oferta cuando `resultado.action ===
'approved'` y resolver el dueño con `duenoDelCobro(pago)`.

## 6. Orden de despliegue

1. Aplicar la migración (por CLI/`apply_migration`, que deja rastro).
2. Desplegar BFF + frontend (antes de la migración degradan solos: sin bloque, sin
   tarjeta, emisión idéntica, el bot ofrece el formulario o remite a la escuela).
3. Decidir D4 y D8 por escuela (flags en `electronic_invoice_providers.config`).
4. Verificar consumidor final en el sandbox de Factus V2 antes de prender D4.
