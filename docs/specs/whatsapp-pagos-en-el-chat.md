# Spec — Pagar desde el chat de WhatsApp (las dos opciones)

Qué responde el bot cuando el padre dice *"quiero pagar"*, y cómo se valida el
comprobante **dentro de la conversación**, con la misma IA que ya valida en
SportMaps.

Prerrequisito de la **fase 2** del plan del canal (conectar Dynasty): sin esto, el
bot sabe decir *cuánto debes* y no sabe decir *cómo pagas*.

> Todos los datos de este documento se verificaron contra la base viva el
> 2026-09-11, con Dynasty (`2d509571-…`) como escuela de referencia.

---

## 1. Las dos opciones, y cuál se puede hoy

| | Opción A — llave + comprobante | Opción B — Wompi directo |
|---|---|---|
| Cómo paga | transfiere a una llave Bre-B y manda la foto al chat | abre un link de pago y paga con tarjeta/PSE |
| Quién valida | la IA en el chat (OCR + veredicto) | la pasarela, por webhook |
| Estado para Dynasty | **se puede hoy** | **bloqueada** (ver §1.2) |
| Qué falta construir | el camino de imagen en el bot (§3) | solo conectar la cuenta (§1.2) |

### 1.1 Lo que Dynasty ya tiene para la opción A

`school_settings.payment_accounts` tiene **3 llaves activas, las tres de tipo
`breb`**, con `label` y `value`. `billing_enabled = true`. Hay **513 pagos en
`pending`/`overdue`** sobre 642 inscripciones, **todos con monto** (cero pendientes
en $0), así que hay con qué probar de sobra.

Aparte, y no es problema del bot sino de cobranza: la inscripción
`b3129268-…` (JOSUE CORTES SAENZ, MENORES MASCULINO, creada el 2026-09-07) está
**activa sin plan asignado**, y por eso lleva cuatro días **sin un solo cobro
generado**. Es fuga de facturación, no un caso a manejar en el chat.

### 1.2 Por qué la opción B está bloqueada, y qué la destraba

El mecanismo está **construido y validado E2E en sandbox**: la tabla
`payment_links` (con `token`, `wompi_reference`, `payment_provider`, `status`,
`expires_at`) y las rutas `routes/wompi.ts` / `routes/payments.routes.ts` que la
emiten.

Lo que falta no es código: **`school_payment_providers` tiene una sola fila en
toda la plataforma, y no es de Dynasty.** Sin credenciales de Wompi conectadas a
esa escuela no hay link que emitir — el bot ofrecería un botón que no existe.

La tabla ya está preparada para el camino self-service (`connect_method`,
`connect_status`, `connected_at`, `application_fee_pct`), así que destrabarlo es
conectar la cuenta de Dynasty, no construir.

> **Decisión de negocio, no técnica.** Con Wompi, Dynasty paga comisión por
> transacción; con Bre-B, no paga nada y alguien revisa comprobantes. Ver
> [[project_online_surcharge_belongs_to_school]]: el recargo en línea es de la
> escuela, SportMaps no retiene por transacción. Hay que preguntarle a Dynasty
> antes de ofrecerle la opción B a sus padres.

**Recomendación: arrancar con A sola.** Es la que funciona hoy, es la que Dynasty
ya usa, y el chat le agrega justo lo que le falta (que el padre no tenga que
entrar a la app a subir la foto). La B se prende después cambiando una fila, sin
tocar el bot: el mensaje se arma según lo que la escuela tenga configurado.

---

## 2. Lo que ya existe y NO hay que reconstruir

El pipeline de comprobantes de SportMaps es reutilizable casi entero. Vive en el
BFF y es **server-authoritative** (el veredicto no se lo cree al cliente):

| Pieza | Qué hace |
|---|---|
| `services/ocr.service.ts` | `extractReceipt(base64, mimeType)` → datos del comprobante. Cadena de proveedores (`gemini` por defecto, luego `groq`/`openai`) con fallback |
| `services/receipt-verdict.ts` | `evaluateVerdict()` → **verde / amarillo / rojo** con códigos de motivo; normaliza referencia y destino |
| `services/receipt-context.service.ts` | arma el contexto contra el que se contrasta |
| `services/receipt-approval.service.ts` | `evaluatePaymentReceipt(paymentId)` → `{action: 'approved' \| 'glosa' \| 'rejected' \| 'none'}`. **Re-hace el OCR del lado del servidor** |
| **`redRejectionMessage(reasons)`** | traduce los motivos rojos a un texto que el acudiente entiende, **nombrando el dato que no cuadró** |

Ese último es el que hace que esto sea barato: ya existe la función que convierte
un rechazo en un mensaje para el padre. Es exactamente lo que el chat necesita.

Columnas donde vive todo, en `payments`: `receipt_url`, `receipt_storage_bucket`,
`requires_review`, `receipt_verdict`, `receipt_verdict_reasons`,
`receipt_reference_norm`, `receipt_image_sha256`, `receipt_verdict_at`,
`approved_by`, `approved_at`. Bucket: **`payment-receipts`**.

Y el precedente del contrato: `POST /api/v1/glosas/auto-evaluate` hace hoy
exactamente esto para la app —recibe un `paymentId`, valida que quien llama sea el
acudiente dueño del pago, y devuelve la acción. **El camino de WhatsApp es el
mismo, con otra puerta de entrada.**

---

## 3. Lo que hay que construir

### 3.0 Abrir el camino de la imagen (bloqueante)

Hoy `handleBotTurn` descarta todo lo que no sea texto:

```ts
if (msg.type !== 'text' && msg.type !== 'interactive' && msg.type !== 'button') return;
```

El comprobante llega como `image` (o `document`, si el padre manda el PDF del
banco). Mientras esa línea siga así, **la foto se guarda y nadie la mira**.

### 3.1 Bajar el archivo de Meta

Dos saltos, ambos con el token de la integración: `GET /{media_id}` devuelve una
URL temporal, y esa URL se descarga **con el header de autorización** (sin él da
401). De ahí a base64, que es justo lo que `extractReceipt` espera.

Límites a respetar: rechazar lo que no sea imagen o PDF, y poner un techo de
tamaño antes de pasarlo al OCR.

### 3.2 `whatsapp_inbound_queue` — resuelta la duda de §Fase 2 del plan

La tabla que apareció sin migración **es el diseño de esto**:
`media_url`, `media_mime_type`, `media_caption`, `detected_intent`,
`matched_parent_id`, `matched_child_id`, `status`, `processed_at`,
`result_ref_id`, `result_type`, `error_message`, `retries`.

**Decisión: no se borra, se versiona y se usa.** Es la cola de comprobantes
entrantes, con reintentos y trazabilidad de a qué terminó aplicando cada imagen.
Eso cierra la pregunta abierta del plan ("usar o borrar").

Procesar en cola y no en línea importa: el OCR tarda segundos, y el webhook de
Meta tiene que responder rápido o reintenta y duplica.

### 3.3 A qué pago se aplica — **el punto difícil**

No es un detalle de implementación: es la decisión de producto de este spec.

Un padre de Dynasty puede tener varios hijos, y hay 513 pagos pendientes en la
escuela. Aplicar un comprobante al pago equivocado es tocar dinero de un tercero.

La regla, en orden:

1. **Un solo pendiente** → se aplica a ese.
2. **Varios, y el monto del OCR coincide con exactamente uno** → se aplica a ese,
   diciendo en la respuesta a cuál (*"lo apliqué a la mensualidad de septiembre de
   Juan"*), para que el padre pueda corregir.
3. **Varios y el monto no desempata** → el bot **pregunta** con una lista corta
   numerada (concepto + atleta + monto + vencimiento) y espera la elección. No
   adivina.
4. **Ningún pendiente** → no se inventa un pago: se responde que no hay nada
   pendiente y se guarda la imagen en la cola para que un humano la mire.

El paso 3 necesita estado en la conversación (qué opciones se ofrecieron), igual
que el paso de consentimiento necesitó saber si ya había preguntado.

### 3.4 Idempotencia — ya está resuelta a medias

`payments.receipt_image_sha256` existe justamente para esto. Con el hash de la
imagen se detecta el mismo comprobante mandado dos veces (o el reintento de Meta
sobre el mismo `wa_message_id`) y **no se cuenta dos veces el mismo dinero**.
Hay que calcularlo antes de aplicar, no después.

### 3.5 Qué responde el bot según el veredicto

| Veredicto | Acción | Qué dice el bot |
|---|---|---|
| 🟢 verde | auto-aprobado | confirma el pago, el concepto y el atleta |
| 🟡 amarillo | glosa (revisión humana) | avisa que quedó en revisión y **no** promete aprobación |
| 🔴 rojo | rechazo | el texto de `redRejectionMessage()`, que nombra el dato que no cuadró |

Nunca se responde "listo, quedaste al día" sin veredicto verde. Es la decisión #6
del bloque (cero respuestas sin herramienta exitosa) aplicada al dinero.

---

## 4. El mensaje de "cómo pago"

Se arma **leyendo la configuración de la escuela**, nunca con datos en el código:

- las llaves de `payment_accounts` con `active = true` (hoy Dynasty: 3, todas Bre-B)
- el **monto exacto** del pago pendiente, no un genérico
- el link de Wompi **solo si** la escuela tiene fila en `school_payment_providers`
- la instrucción de mandar la foto al mismo chat

Una escuela sin ninguna de las dos cosas configuradas no recibe un mensaje a
medias: se escala a un humano.

> **Cuidado con el número de contacto.** `school_settings.whatsapp_number` de
> Dynasty es `+573204298969`, distinto del número comercial de SportMaps
> ([[project_sales_whatsapp_number]]). El bot habla por el número de la escuela;
> no mezclar.

---

## 5. Riesgos

| | Riesgo | Mitigación |
|---|---|---|
| P-1 | Comprobante aplicado al pago de otro atleta | §3.3: preguntar cuando el monto no desempata; nunca adivinar |
| P-2 | Mismo comprobante contado dos veces | `receipt_image_sha256` antes de aplicar |
| P-3 | El bot promete aprobación en amarillo | texto explícito de "en revisión"; solo verde confirma |
| P-4 | El webhook tarda y Meta reintenta → duplicados | procesar el OCR en la cola, no en línea |
| P-5 | Se ofrece Wompi sin cuenta conectada | el mensaje se arma según `school_payment_providers`; sin fila, no se menciona |
| P-6 | Imagen enorme o archivo que no es comprobante | validar mime y tamaño antes del OCR |
| P-7 | El monto se lee de la columna y no de la cascada | `enrollments.monthly_fee` está vacío en 36 inscripciones ACTIVAS de Dynasty, pero 35 tienen plan con precio real ($90k–$180k): hay que resolver por `monthly_fee → offering_plans.price → teams.price_monthly` ([[project_athlete_fee_source]]). Medido el 2026-09-11: **0 pagos pendientes en cero** en Dynasty, así que el riesgo de mostrar "$0" al padre no existe hoy — el bot lee `payments`, que sí traen monto |

---

## 6. Orden de construcción

1. Migración que **versiona `whatsapp_inbound_queue`** tal como está (§3.2).
2. Abrir el camino de imagen en el bot + bajada de media de Graph (§3.0, §3.1).
3. Resolución de a qué pago aplica, con la pregunta numerada (§3.3).
4. Enganche a `evaluatePaymentReceipt` + respuesta por veredicto (§3.5).
5. Mensaje de "cómo pago" armado desde configuración (§4).
6. *(Opcional, cuando Dynasty decida)* link de Wompi en el mismo mensaje.

Los pasos 1 a 5 no dependen de ninguna decisión de Dynasty. El 6 sí.

---

## 7. Fuentes

- Base viva `luebjarufsiadojhvxgi`, consultada el 2026-09-11: `school_settings.payment_accounts`, `school_payment_providers`, `payment_links`, columnas `receipt_*` de `payments`, `whatsapp_inbound_queue`.
- `bff/src/services/{ocr,receipt-verdict,receipt-context,receipt-approval}.service.ts` — el pipeline que se reutiliza.
- `bff/src/routes/glosas.routes.ts` — `POST /auto-evaluate`, el precedente del contrato.
- `docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md` — fase 1, ya cerrada y validada en vivo.
