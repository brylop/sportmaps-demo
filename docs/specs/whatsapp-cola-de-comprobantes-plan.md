# Plan — Cola de comprobantes entrantes de WhatsApp

Plan antes de código, según la convención del repo: esta fase toca RLS y una
tabla, y no se escribe SQL hasta que el plan esté aprobado.

Es el eslabón que falta para que un padre mande la foto de su transferencia al
chat y el sistema la valide. Ver `whatsapp-pagos-en-el-chat.md` §3 para el diseño
de producto; este documento es el cómo.

**Revisión 2 (2026-09-11).** Absorbe nueve correcciones de la revisión anterior,
todas confirmadas contra la base viva, más lo que se aprendió arreglando los
proveedores de IA. Los cambios de fondo están marcados con ⟳.

---

## 0. Estado — CONSTRUIDO Y VALIDADO EN VIVO (2026-09-11)

Este plan ya se ejecutó. Lo que sigue queda como el porqué de cada decisión;
para el estado real, esta sección manda.

| Pieza | Commit |
|---|---|
| Migración de la cola (permisos, FK compuesta, estados) | `29d7066a` |
| `wa_queue_claim` — claim atómico con lease y SKIP LOCKED | `6834c3fc` |
| Webhook que encola + columna `media_id` | `1b4297c7` |
| Worker: baja, guarda, lee, aplica y responde | `84b019f3` |
| Respetar la baja + avisar destino ajeno | `de035e8d` |
| El worker registra lo que responde | `fabcd1e4` |
| El worker computa y persiste el veredicto | `0482f3dd` |
| El comprobante repetido se responde, no se reintenta | `2dead3b7` |
| Responder a las notas de voz | `c9bfcaec` |

El webhook dejó de apuntar a ngrok: ahora va a
`https://bffdev.sportmaps.co/api/v1/webhooks/whatsapp` (paso 4 del App Review).

### Verificado con mensajes reales

| Caso | Resultado |
|---|---|
| Comprobante válido | aplicado en 16 s, `awaiting_approval`, nombrando el cobro |
| Comprobante repetido | NO se aplica dos veces; dice a qué pago quedó la plata |
| QR de pago en vez del comprobante | mensaje que explica qué mandar en su lugar |
| Nota de voz | respuesta en 1 s |
| Sin cobros pendientes / sin identificar | mensaje correcto |
| Fila atascada con lease vencido | se rescató sola, sin intervención |
| Reintento de Meta | un solo acuse (verificado 1, 0, 0) |
| `anon` y `authenticated` sobre la cola | `42501 permission denied` |
| **Destino que no es de la escuela** | ⏳ sin ejercitar: falta un comprobante a otra cuenta |

### Cuatro bugs que solo aparecieron mandando mensajes reales

Ninguno se veía leyendo el código, y los cuatro estaban en código que yo mismo
había escrito y dado por bueno.

1. **La baja se miraba como evento, nunca como estado.** La ingesta marca
   `opted_out` solo si el mensaje trae la palabra STOP; una imagen no trae texto.
   Seis mensajes automáticos salieron después de una baja.
2. **El worker no registraba sus respuestas.** Usaba `sendTextMessage` pelado,
   sin `wa_record_outbound_message`: la escuela veía la foto del papá y ninguna
   respuesta del bot sobre su plata.
3. **El veredicto quedaba en `null`.** `evaluatePaymentReceipt` no lo computa
   con el auto-approve apagado — lo asume ya persistido por `/extract-receipt`,
   por donde el worker no pasa. Revisión a ciegas y, peor, sin la defensa
   antiduplicado.
4. **El duplicado no respondía y reintentaba.** El 23505 del UNIQUE
   `(school_id, ocr_reference)` se clasificó como transitorio: el papá no recibía
   nada y la fila giraba cinco veces pagando OCR.

### Lo que sigue pendiente

- **El inbox de la escuela.** Las filas `failed` e `ignored` se acumulan y hoy
  NADIE las ve. Por eso sigue en pie: no habilitar esto con tráfico real de una
  escuela antes de la fase 4.
- **El chequeo del comprobante adulterado** (§9).
- Los cuatro intents que faltan: el bot solo tiene `get_payment_status` y
  `escalate_to_human`, así que todo lo demás escala a un humano.
- Datos de prueba a limpiar: en *Escuela Pruebas* quedaron dos cobros con
  "PRUEBA WhatsApp" en el concepto y un `nequi_number` cargado.

---

## 9. ⟳ El comprobante adulterado — medido, sin construir

Pregunta abierta del 2026-09-11: ¿y si editan el número de aprobación de la
imagen y lo reenvían? **Hoy pasa.** El hash cambia, la referencia cambia, y el
monto, la fecha y el destino siguen siendo válidos; ninguno de los diez códigos
de veredicto lo mira.

Medición sobre los 389 pagos con OCR:

| Regla candidata | Pagos marcados | |
|---|---|---|
| mismo monto + fecha + destino | **166** (43%) | inservible: son familias pagando lo mismo el mismo día |
| **+ mismo acudiente** | **10** (2,6%) | viable como AMARILLO |

Propuesta: mismo acudiente, escuela, monto, fecha y destino con referencia
distinta → **amarillo**, nunca rojo. No prueba fraude — un papá con dos hijos
hace exactamente eso de forma legítima.

**El límite hay que decirlo:** mirando la imagen no se puede saber. La única
verdad de campo es el extracto bancario — el banco muestra UN movimiento y
nosotros tendríamos DOS pagos reclamándolo. Eso lo cierra la conciliación, que
hoy no opera (883 pagos por $156,9 M sin conciliar).

NO se recomienda preguntarle al modelo «¿esta imagen parece editada?»: da falsos
positivos con capturas comprimidas, falsos negativos con ediciones prolijas, y
genera confianza falsa en quien revisa.

## 1. Lo que ya está construido

| | |
|---|---|
| `downloadMedia()` en `whatsapp.service.ts` | ✅ commiteado (`fc6048e1`). Dos saltos de Graph, rechaza por mime y tamaño antes de bajar, devuelve el `sha256` de Meta |
| `mediaId` / `mediaMimeType` / `mediaCaption` en `parseInboundMessages()` | ✅ |
| Pipeline de validación (`extractReceipt`, `evaluateVerdict`, `evaluatePaymentReceipt`, `redRejectionMessage`) | ✅ existe y es server-authoritative |
| Bucket `payment-receipts` | ✅ en uso por la app |
| **PDF de punta a punta** | ✅ ⟳ verificado hoy: Gemini extrae monto, fecha, referencia y destino de un PDF en 1.7 s. Varios bancos exportan así |
| **La tabla `whatsapp_inbound_queue`** | ⚠️ existe en la base, **sin migración** |

### 1.1 ⟳ El doble lector estaba roto, y eso explica el trabajo manual

`evaluatePaymentReceipt` exige que **dos proveedores distintos coincidan** en
monto y referencia para auto-aprobar. Si no hay segundo lector, la línea es
explícita: `// Sin 2º provider no se puede confirmar → no auto-aprueba (manual).`

Y no había segundo lector. Groq se cayó (404, sin modelos de visión) y OpenAI
estaba sin saldo, así que quedaba solo Gemini. El efecto, medido:

| | |
|---|---|
| Comprobantes con veredicto **verde** | **180** |
| De esos, **auto-aprobados** | **3** |

177 comprobantes perfectos aprobados a mano, uno por uno. No era un problema de
criterio: era que no había con quién contrastar.

**Con OpenAI ya con saldo (verificado el 2026-09-11) el doble lector revive.**

### 1.2 ⟳ Lo que cuesta cada lectura, medido

| Entrada | Vía | Tokens de entrada |
|---|---|---|
| Imagen (PNG/JPEG) | `chat/completions` + `image_url` | **25.535** |
| PDF con capa de texto | `/v1/responses` + `input_file` | **115** |

Dos consecuencias de diseño:

- En dinero da igual (gasto real medido: **$0,01** por 79 mil tokens). Lo que
  aprieta es el **límite de 60.000 tokens por minuto** de la organización: son
  **~2 comprobantes en imagen por minuto** por OpenAI. El worker tiene que
  tolerar el 429, que §4.4 ya clasifica como transitorio.
- Un PDF **escaneado** (sin capa de texto) se cobra como imagen, no como los 115
  tokens de arriba. La medición se hizo con un PDF generado digitalmente.

### 1.3 ⟳ La regla que sobrevive: el OCR caído nunca rechaza

Aunque vuelva a haber dos lectores, **una caída del OCR no puede rechazar un
comprobante**. Si no se pudo leer, la fila espera y reintenta; jamás produce un
veredicto. Confundir "no pude leer" con "no es válido" rechazaría pagos buenos en
masa. Se detalla en §4.4.

---

## 2. La tabla que ya existe: lo bueno y lo que hay que corregir

21 columnas, 5 índices, 4 FKs, RLS activa, **0 filas**. Que esté vacía es lo que
permite endurecerla sin medir radio: no hay dato que romper.

### 2.1 Algo que hace BIEN, y mejor que el resto del módulo

Su única policy es:

```sql
wa_queue_admin_select: FOR SELECT USING (is_school_admin(school_id))
```

Usa **`is_school_admin()`**, no el `schools.owner_id = auth.uid()` de las cinco
tablas de WA1. Es el patrón correcto: un administrador que no sea el dueño sí ve.
Cuando se corrija la deuda de WA1 (§3 de `whatsapp-optin-y-rastreo-de-plantillas`),
esta tabla es el modelo a seguir, no la excepción.

### 2.2 ⟳ Los GRANT están abiertos a `anon` **y a `authenticated`**

Medido hoy contra la base:

| grantee | privilegios |
|---|---|
| `anon` | DELETE, INSERT, SELECT, UPDATE |
| **`authenticated`** | **DELETE, INSERT, SELECT, UPDATE** |
| `service_role` | todos |

La revisión anterior de este plan solo revocaba `anon` y `PUBLIC`, y eso **deja
el agujero grande abierto**: `authenticated` es cualquier persona con una cuenta,
incluido un acudiente de otra escuela. Es exactamente la trampa 3 del `CLAUDE.md`
— los default privileges del esquema otorgan permisos a cada tabla nueva y
`REVOKE ... FROM PUBLIC` no los quita.

Hoy no se explota porque con RLS activa y una sola policy de `SELECT` las
escrituras quedan denegadas por ausencia de policy. Pero basta que mañana alguien
agregue una policy permisiva para que se abra de par en par.

### 2.3 Cuatro huecos que conviene cerrar ahora que está vacía

| Hueco | Por qué importa |
|---|---|
| **No tiene `integration_id`** | El resto del módulo se llavea por integración; esta se llavea por `school_id` + `wa_phone_number`. Una escuela con dos números no se puede desambiguar, y no se puede resolver el token para bajar el archivo sin volver a buscar la integración |
| `school_id` y `wa_message_id` son **nullable** | `wa_message_id` es el UNIQUE que da la idempotencia. Nullable significa que varias filas con NULL conviven, y ahí se cae la protección contra el reintento de Meta |
| `status` y `result_type` son `text` **sin CHECK** | La convención del repo es `text + CHECK`. Sin él, un typo en el worker crea un estado fantasma que nadie procesa nunca |
| ⟳ **No hay dónde guardar la ruta del archivo ni el lease** | Falta `storage_path` (§4.4), `locked_until` y `next_retry_at` (§4.2) |

---

## 3. La migración propuesta

Una sola, con cinco bloques. Formaliza lo que existe y cierra los huecos.

**A. `CREATE TABLE IF NOT EXISTS`** con la forma exacta de hoy, para que un
ambiente nuevo la reproduzca. En la base actual no hace nada; es el punto de la
migración.

**B. ⟳ Endurecer** (seguro: 0 filas). `integration_id` nace **NOT NULL** y con FK
**compuesta**, para que no se pueda colar una integración de otra escuela:

```sql
ALTER TABLE public.whatsapp_inbound_queue
  ADD COLUMN IF NOT EXISTS integration_id uuid,
  ADD COLUMN IF NOT EXISTS storage_path   text,
  ADD COLUMN IF NOT EXISTS locked_until   timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at  timestamptz;

ALTER TABLE public.whatsapp_inbound_queue
  ALTER COLUMN school_id      SET NOT NULL,
  ALTER COLUMN wa_message_id  SET NOT NULL,
  ALTER COLUMN integration_id SET NOT NULL;

-- Compuesta contra el UNIQUE (id, school_id) que agregó la migración de opt-in.
-- ON DELETE RESTRICT, NO CASCADE: borrar una integración no puede borrar el
-- rastro de un comprobante que movió plata.
ALTER TABLE public.whatsapp_inbound_queue
  ADD CONSTRAINT fk_wa_queue_integracion
  FOREIGN KEY (integration_id, school_id)
  REFERENCES public.school_whatsapp_integrations (id, school_id)
  ON DELETE RESTRICT;
```

⟳ Los CHECK van envueltos, porque **`ADD CONSTRAINT` no admite `IF NOT EXISTS`**
y la migración tiene que poder re-correrse:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wa_queue_status') THEN
    ALTER TABLE public.whatsapp_inbound_queue
      ADD CONSTRAINT chk_wa_queue_status CHECK (status IN
        ('pending','processing','waiting_user','done','failed','ignored'));
  END IF;
  -- ídem chk_wa_queue_result
END $$;
```

Dos estados de primera clase, a propósito:

- **`ignored`** — una foto que no es un comprobante no es un fallo, y no debe
  quedar reintentándose.
- ⟳ **`waiting_user`** — el bot preguntó a cuál pago aplicar y espera respuesta.
  Sin este estado, el worker vuelve a tomar la fila en la siguiente vuelta y
  vuelve a preguntar. Era el caso 3 de §4.5, que no tenía dónde vivir.

**C. ⟳ Cerrar los permisos, ahora sí completo:**

```sql
REVOKE ALL ON public.whatsapp_inbound_queue FROM PUBLIC;
REVOKE ALL ON public.whatsapp_inbound_queue FROM anon;
REVOKE ALL ON public.whatsapp_inbound_queue FROM authenticated;   -- ⟳ faltaba

-- El SELECT del inbox (fase 4) entra por la policy, que sí necesita el GRANT.
GRANT SELECT ON public.whatsapp_inbound_queue TO authenticated;
-- DELETE incluido: la retención de §4.7 lo necesita.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_inbound_queue TO service_role;

-- Escritura solo por service_role; explícita, no ausente (invariante I3).
CREATE POLICY "wa_queue_no_direct_write" ON public.whatsapp_inbound_queue
  FOR INSERT TO authenticated WITH CHECK (false);
```

Se **conserva** `wa_queue_admin_select` tal como está: `is_school_admin()` es lo
correcto y el inbox de la fase 4 lo necesita.

**D. Índice de trabajo:**

```sql
CREATE INDEX IF NOT EXISTS idx_wa_queue_pendientes
  ON public.whatsapp_inbound_queue (created_at)
  WHERE status IN ('pending','processing');
```

El `idx_wa_queue_status` que existe indexa toda la tabla por estado; el worker
solo pregunta por lo pendiente, y con el tiempo el 99% de las filas será `done`.

**E. Nada.** El lease de §4.2 se apoya en `updated_at`, y el trigger
`set_wa_queue_updated_at` **ya existe** en la tabla (verificado el 2026-09-11).
Se deja anotado para que nadie lo agregue dos veces.

Y la FK compuesta del bloque B es aplicable: `uq_wa_integration_id_school
UNIQUE (id, school_id)` ya está en `school_whatsapp_integrations`, puesta por la
migración de opt-in. Sin ese UNIQUE la FK no se podría crear.

---

## 4. El lado del BFF

### 4.1 ⟳ Encolar en el webhook, y acusar recibo UNA sola vez

`handleBotTurn` hoy descarta todo lo que no sea texto. El cambio:

```
imagen o documento entrante
  → INSERT ... ON CONFLICT (wa_message_id) DO NOTHING RETURNING id
  → si volvió una fila: responder "recibí tu comprobante, lo estoy revisando"
  → si NO volvió: callarse. Es el reintento de Meta, no un comprobante nuevo.
  → RETORNAR. El webhook termina.
```

**Procesar dentro del webhook no es una opción.** El OCR tarda segundos y Meta
reintenta si no respondemos rápido.

⟳ Y el `RETURNING` del `ON CONFLICT` es lo que evita el acuse duplicado. El
`UNIQUE (wa_message_id)` ya protegía la *fila*, pero la revisión anterior mandaba
el mensaje antes de mirar si la inserción había ocurrido: ante un reintento de
Meta el padre recibía "recibí tu comprobante" dos y tres veces.

### 4.2 ⟳ El worker toma trabajo con lease, no con `SELECT` + `UPDATE`

Un job en `bff/src/jobs/` al estilo de los que ya existen, cada minuto:

```sql
UPDATE public.whatsapp_inbound_queue q
   SET status = 'processing',
       locked_until = now() + interval '5 minutes',
       updated_at = now()
 WHERE q.id IN (
   SELECT id FROM public.whatsapp_inbound_queue
    WHERE (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= now()))
       OR (status = 'processing' AND locked_until < now())   -- ⟳ rescate
    ORDER BY created_at
    LIMIT 10
    FOR UPDATE SKIP LOCKED
 )
RETURNING *;
```

Dos cosas que la revisión anterior no tenía:

- ⟳ **`FOR UPDATE SKIP LOCKED`**: con dos instancias del BFF (dev y stg comparten
  base) dos workers tomaban la misma fila.
- ⟳ **El rescate de `processing`**: si el proceso muere entre el claim y el
  final, la fila quedaba en `processing` **para siempre**, sin que nadie la mire
  y sin aparecer en ningún listado de pendientes. El `locked_until` vencido la
  devuelve a la rueda.

### 4.3 Pasos del worker

1. `downloadMedia()` → base64.
2. ⟳ **Subir al bucket y estampar `storage_path` inmediatamente**, antes del OCR.
3. Resolver a qué pago aplica (§4.5).
4. Estampar `receipt_url` + `receipt_storage_bucket` en ese pago y llamar
   `evaluatePaymentReceipt(paymentId)` — el mismo camino que `/glosas/auto-evaluate`
   usa hoy para la app. **No se reimplementa el veredicto.**
5. Responder al padre según el resultado (§5).
6. `status='done'`, `result_ref_id` = el pago, `result_type='payment_receipt'`.

⟳ El orden del paso 2 importa y es una corrección de fondo: **la URL de media de
Meta expira**. Si se baja, se pasa al OCR y el OCR falla, un reintento veinte
minutos después ya no puede bajar el archivo y el comprobante del padre se pierde
sin dejar rastro. Guardándolo primero, el reintento parte del bucket.

### 4.4 ⟳ Reintentos: distinguir lo permanente de lo transitorio

La revisión anterior decía "3 intentos y a `failed`", lo que trata igual dos cosas
opuestas. Un mime rechazado no mejora reintentando; un 429 de Gemini sí.

| Clase | Ejemplos | Qué hace |
|---|---|---|
| **Permanente** | mime no permitido, > 8 MB, media 404 (expiró y no hay `storage_path`), `isReceipt=false` | sin reintento. `ignored` o `failed` con su motivo |
| **Transitorio** | red, timeout, 429, 5xx, **OCR caído** | `next_retry_at = now() + backoff`, hasta 5 intentos |

⟳ Y la regla que sale de §1.1: **si el OCR no está disponible, no hay veredicto.**
Nunca se rechaza por no haber podido leer. Con Gemini como único proveedor vivo,
confundir "no pude leer" con "no es válido" rechazaría pagos buenos en masa.

### 4.5 A qué pago se aplica — la decisión de producto

Es el punto delicado: aplicar un comprobante al pago equivocado es tocar dinero de
un tercero. En Dynasty hay 513 pendientes y padres con varios hijos.

| Caso | Qué hace |
|---|---|
| El contacto tiene **un solo** pendiente | se aplica a ese |
| Varios, y el monto del OCR coincide con **exactamente uno** | se aplica a ese, **y la respuesta dice a cuál** ("lo apliqué a la mensualidad de septiembre de Juan") para que el padre pueda corregir |
| ⟳ El monto coincide con la **suma de varios** | ver §4.6 |
| Varios y el monto no desempata | el bot **pregunta** con lista numerada (concepto · atleta · monto · vencimiento), la fila pasa a **`waiting_user`** y espera. **No adivina** |
| Ninguno pendiente | no se inventa un pago: se responde que no hay nada pendiente y la fila queda `ignored` para que un humano la mire |
| El contacto no está identificado | no se procesa: primero OTP. Un comprobante no identifica a nadie |

El estado de la pregunta se resuelve leyendo el último saliente con
`step='ask_cual_pago'` y su payload, sin columnas nuevas.

### 4.6 ⟳ Una transferencia que cubre varios pendientes

Caso real y frecuente: dos hijos, un solo pago por la suma. La revisión anterior
lo dejaba caer en "el monto no desempata" y preguntaba, lo que obliga al padre a
elegir **uno** cuando pagó **dos**.

Regla: se busca un subconjunto de los pendientes cuya suma sea exactamente el
monto del comprobante.

- Si hay **exactamente un** subconjunto que suma, se propone nombrando los pagos
  y **se pide confirmación** antes de aplicar. Nunca se reparte plata en varios
  cobros sin un "sí" explícito.
- Si hay **más de uno**, o hay más de 8 pendientes (la búsqueda se vuelve cara y
  ambigua), se pregunta con lista, como en §4.5.

### 4.7 ⟳ Idempotencia del dinero: el hash NO es la identidad del comprobante

Corrección de fondo. La revisión anterior trataba el `sha256` como "el mismo
comprobante", y **no lo es**: WhatsApp recomprime las imágenes, así que el mismo
papel reenviado desde la galería llega con bytes distintos y hash distinto. El
hash solo detecta el reenvío byte a byte idéntico.

Quedan dos mecanismos con roles distintos:

| | Rol |
|---|---|
| `sha256` (el de Meta, gratis en `downloadMedia`) | **atajo**: si coincide, es el mismo archivo y se evita bajar y pagar OCR de nuevo. Un negativo no prueba nada |
| **Referencia del banco + monto + fecha** (`ocr_reference`, ya normalizada) | **la autoridad** sobre "este pago ya se usó". Es lo que el código rojo `REFERENCIA_DUPLICADA` mira hoy |

La idempotencia del dinero se apoya en la referencia, no en el hash.

### 4.8 ⟳ Retención

Las filas guardan metadatos de media y texto del chat. Se purgan las `done` e
`ignored` con más de 90 días, conservando el pago y su comprobante en el bucket,
que es el registro contable. Por eso el `GRANT ... DELETE` del bloque C.

---

## 5. ⟳ Cómo se le avisa al padre — y el hueco que esto también tapa

Esta sección es nueva. Sale de un caso real: el pago `acb637ea` de Dynasty, del
2026-09-04. La acudiente subió **el QR de pago de la escuela** en vez del
comprobante de la transferencia. El rechazo fue correcto. El aviso, no:

> ❌ Pago Rechazado
> "Tu comprobante de $ 150.000 no pudo ser validado. Contáctanos para más información."

Ocho días después seguía **sin leer**, la mensualidad sin pagar y la acudiente sin
saber qué hacer. Tres defectos, los tres medidos:

1. **El motivo no se captura.** El rechazo manual manda `status:'rejected'` y
   nada más — ni siquiera pregunta por qué. `rejection_reason` quedó `NULL`.
2. **No se muestra.** El rechazo *automático* sí escribe `rejection_reason`, pero
   **ninguna pantalla del acudiente lee esa columna**. Es de solo escritura.
3. **No hay correo de rechazo.** Aprobar manda correo; rechazar solo deja la
   campanita.

En toda la plataforma hay **2 rechazos con comprobante** en la historia, ninguno
con motivo. Por eso no ha dolido todavía. Con comprobantes entrando por WhatsApp
esto pasa a ser la interacción negativa más frecuente que tengamos.

### 5.1 El vocabulario, compartido entre el bot y el humano

`redRejectionMessage()` ya sabe decir *"el archivo no es un comprobante de pago"*
(`NOT_A_RECEIPT`) — justo el caso del QR. El humano que rechaza no tiene ese
vocabulario disponible. Se le da: el botón de rechazar abre motivos de un clic,
con **los mismos códigos** que usa el automático.

| Código | Botón |
|---|---|
| `NOT_A_RECEIPT` | Subió el QR de pago, no el comprobante |
| `IS_TRANSACTION_LIST` | Es una lista de movimientos, no un pago |
| `DESTINO_NO_COINCIDE` | La cuenta destino no es de la escuela |
| `MONTO_NO_COINCIDE` | El monto no coincide |
| `ILEGIBLE` | No se alcanza a leer |
| `REFERENCIA_DUPLICADA` | Ese comprobante ya se usó |
| — | Otro (texto libre, obligatorio) |

### 5.2 La forma del mensaje

Siempre: **qué revisamos → qué encontró → qué necesitamos → cómo seguir.** Nunca
"contáctanos".

> Hola Sandra 👋
>
> Revisamos el archivo que subiste para la **mensualidad de septiembre de Sara
> Valentina** ($150.000) y es el **código QR para pagar**, no el comprobante de la
> transferencia.
>
> Lo que necesitamos es la pantalla que te muestra el banco **después** de enviar
> el dinero: la que dice "Transferencia exitosa" con el valor, la fecha y el
> número de aprobación.
>
> Cuando la tengas, mándala por acá mismo y la validamos en un minuto.

### 5.3 Por dónde sale

| Veredicto | Respuesta |
|---|---|
| 🟢 verde | confirmación, nombrando a qué pago se aplicó |
| 🟡 amarillo | se creó glosa: qué dato falta y que un humano lo revisa |
| 🔴 rojo | el texto de §5.2, construido con `redRejectionMessage()` |

Y el motivo se **muestra** además en `MyPaymentsPage`, bajo el chip "Rechazado",
con el botón de volver a subir al lado. Que el aviso viaje por WhatsApp no quita
que la pantalla tenga que explicarse sola.

### 5.4 Nota de producto

El modal de pago tiene un botón **"Descargar QR"**. Se le dice al padre "descarga
esto para pagar" y después "sube el comprobante": es natural que suba lo único que
descargó. No es distracción del acudiente, es el camino que lo lleva ahí. Vale
advertirlo en la pantalla de subida, antes de enviar.

---

## 6. Cómo se verifica

- [ ] `npm run migrations:new -- whatsapp_cola_comprobantes` y `migrations:check` en verde
- [ ] `npm run seguridad:invariantes` sin críticos
- [ ] ⟳ `select grantee, privilege_type from information_schema.role_table_grants where table_name='whatsapp_inbound_queue'` → **sin `anon`, y `authenticated` solo con `SELECT`**
- [ ] ⟳ **`set local role anon; select * from public.whatsapp_inbound_queue;` debe dar `permission denied`.** No basta "0 filas": con RLS activa una tabla abierta y una tabla cerrada devuelven lo mismo, y la revisión anterior daba por buena esa señal
- [ ] ⟳ Ídem con `set local role authenticated` sin JWT de admin
- [ ] ⟳ `insert` como `authenticated` → `permission denied`, no "0 filas insertadas"
- [ ] Prueba viva: mandar una foto al número de prueba → aparece fila `pending` con su `media_*`
- [ ] El worker la procesa → `done`, con `result_ref_id` apuntando al pago
- [ ] ⟳ Mandar **un PDF** (Gemini ya lo lee; falta el camino completo)
- [ ] Mandar la misma foto otra vez → no se cuenta dos veces
- [ ] ⟳ Reenviar la misma foto **desde la galería** (hash distinto, misma referencia) → tampoco se cuenta dos veces
- [ ] Mandar una foto que no es comprobante → `ignored`, sin reintentos, **y el padre recibe el mensaje de §5.2**
- [ ] ⟳ Simular el reintento de Meta (mismo `wa_message_id`) → **un solo** acuse de recibo
- [ ] ⟳ Matar el proceso con una fila en `processing` → a los 5 min otra vuelta la rescata
- [ ] ⟳ Con el OCR caído (llave inválida a propósito) → la fila reintenta, **ningún pago se rechaza**
- [ ] Con dos pendientes de monto distinto y un comprobante que coincide con uno → se aplica a ese y lo dice
- [ ] Con dos pendientes del mismo monto → el bot pregunta, la fila queda `waiting_user` y **no vuelve a preguntar** en la siguiente vuelta
- [ ] ⟳ Con dos pendientes y un comprobante por la suma → propone los dos y **pide confirmación**

---

## 7. Lo que este plan NO hace

- No registra plantillas ni envía cobranza: eso es otra fase.
- No corrige la deuda de `owner_id` de WA1, aunque esta tabla demuestre el patrón bueno.
- No construye el inbox. Las filas `failed` e `ignored` se acumulan hasta que exista;
  conviene no habilitar esto con tráfico real de una escuela antes de la fase 4.
- No toca Wompi: la opción B sigue bloqueada por `school_payment_providers`.
- ⟳ No sube el límite de 60.000 tokens/minuto de OpenAI (§1.2). El worker lo
  *tolera* reintentando; si el volumen crece, hay que pedir aumento de cuota o
  mandar las imágenes a un modelo con menor conteo de tokens de imagen.
- ⟳ No resuelve los PDF escaneados, que se cobran como imagen y además pueden
  leerse peor. Las fichas escaneadas son otro caso de uso, no este.

## 8. Fuentes

- DDL y GRANTs de `public.whatsapp_inbound_queue` medidos en la base viva el 2026-09-11.
- `bff/src/services/whatsapp.service.ts` — `downloadMedia()`, commit `fc6048e1`.
- `bff/src/services/ocr.service.ts` — cadena de proveedores, commit `09095b42`.
- `bff/src/services/receipt-approval.service.ts` — `evaluatePaymentReceipt()`, `redRejectionMessage()`, `autoRejectRed()`.
- `frontend/src/pages/PaymentsAutomationPage.tsx` — el rechazo manual, que hoy no captura motivo.
- Pago `acb637ea-d2ad-443b-883e-2addbc5c8f81` (Dynasty, 2026-09-04) — el caso del QR de §5.
- Prueba de PDF+PNG contra Gemini y OpenAI, 2026-09-11.
- `docs/specs/whatsapp-pagos-en-el-chat.md` — el diseño de producto de las dos opciones de pago.
