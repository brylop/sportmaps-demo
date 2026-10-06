# Spec — Notas de voz en el bot de WhatsApp (transcripción)

Pregunta del usuario (2026-10-06): *«¿cómo podemos después implementar escuchar audios?»*.

Hoy el bot contesta a toda nota de voz con «No puedo escuchar notas de voz 🙊 Escríbeme el mensaje…»
(`bff/src/routes/whatsapp.ts`, rama `msg.type === 'audio'` de `handleBotTurn`). Este spec mide cuánto
pasa, compara proveedores de transcripción con precio verificado hoy, y propone el diseño y las fases.
Comparte las piezas con `MOD-30` (evaluación por voz del coach): se construyen una sola vez.

> Medido contra la base viva el **2026-10-06** (solo `SELECT`). Precios y políticas verificados en la
> web ese mismo día; las fuentes están al final. Estado: **propuesta, sin código**.

---

## 1. Medición

### 1.1 Volumen

Ventana: **2026-10-02 → 2026-10-06** (5 días, desde que Dynasty entró por Coexistence).

| Escuela | Entrantes | Audios entrantes | Conversaciones con audio | Videos | Imágenes |
|---|---:|---:|---:|---:|---:|
| DYNASTY VOLLEY CLUB | 1.033 | **38** (3,7 %) | 19 | 3 | 100 |
| Escuela Pruebas | 37 | 0 | 0 | 0 | 4 |

Ninguna otra escuela tiene WhatsApp conectado. **El análisis de conversaciones contó 9 notas de voz**
porque miró solo las conversaciones de familia de un día; las 38 son de todos los contactos y los 5 días.

### 1.2 Quién las manda (lo que más importa para el diseño)

| `contact_kind` | Audios | Conv. | Respondió el bot (≤10 min) | Respondió una persona | Sin respuesta |
|---|---:|---:|---:|---:|---:|
| desconocido | 22 | 9 | 0 | 8 | 14 |
| **familia** | **10** | **6** | 2 | 1 | 7 |
| personal | 3 | 2 | 1 | 0 | 2 |
| sin clasificar (`null`) | 2 | 2 | 1 | 0 | 1 |
| **familia_sin_cuenta** | **1** | **1** | 0 | 0 | 1 |

- **Solo 11 de 38 (29 %) son de familias.** El resto es la vida privada de la dueña: el número de la
  escuela es su WhatsApp personal (Coexistence). Leyendo el contexto de los «desconocidos»: «Amor ven y
  tomas tinto…», «Hola muñeca si», «Es que voy a pedir una moto», un contacto que manda un audio cada
  madrugada. **Transcribir esos audios sería procesar conversaciones íntimas de la dueña con terceros
  sin ninguna base.** Regla dura del diseño: *se clasifica el contacto antes de bajar el archivo*.
- **La escuela también manda audios:** 23 notas de voz salientes (12 a familias) grabadas por Milena
  desde su celular. Hoy el bot no sabe qué dijo Milena en ellas (ver decisión D5).

### 1.3 Formato (del `payload` del webhook)

| Tipo | Cuántos |
|---|---:|
| `voice: true`, `audio/ogg; codecs=opus` (nota de voz grabada) | 32 |
| `voice: false`, `audio/mpeg` (audio reenviado / archivo) | 5 |
| `voice: false`, `audio/ogg; codecs=opus` | 1 |

- **El webhook no trae duración ni tamaño.** Trae `id`, `mime_type`, `sha256`, `voice` y —nuevo— una
  `url` de `lookaside.fbsbx.com` firmada. La duración solo se conoce bajando el archivo (o la devuelve
  el proveedor de transcripción: Groq/OpenAI la incluyen en `verbose_json`).
- Para estimar costo se asume **≤ 1 min por audio** (lo normal en notas de voz de padres; las de la
  muestra son ráfagas de 2 audios seguidos a 11–51 s de distancia, compatibles con audios cortos).

### 1.4 En qué contexto llegan

Lectura de las 38 filas con el mensaje anterior y el siguiente:

- **Pegadas a otro mensaje (ráfaga):** foto + audio a 26 s (`0cb83075`, la del cobro de una atleta
  retirada); «Tengo una consulta» + audio a 33 s (`ffdd9c29`, familia sin cuenta: **nadie le respondió**);
  dos audios seguidos a 16 s (`df89382f`); texto «Hola mi mile…» + audio (`f99d8d96`).
- **Dirigidas a una persona, no al bot:** «Mi querida Mile» + 2 audios, «Hola Mile, buenos días…» +
  audio. Es el mismo patrón del vocativo (P9 del análisis): muchas notas de voz son *para Milena*.
  Transcribirlas sirve tanto al buzón como al bot.
- **Respuesta a un audio de Milena:** `abe50cda` contesta con audio 88 s y 236 s después de un audio
  saliente de la escuela. Es conversación humana; el bot no debe meterse (regla P4, «humano reciente»).

### 1.5 Qué respondió el bot

De los 11 audios de familia: **el bot respondió 2** (uno con «No puedo escuchar notas de voz», otro con
el texto de «archivo que no es comprobante» por la imagen anterior), **una persona respondió 1** y
**8 quedaron sin respuesta en 10 min**. El texto de «no puedo escuchar» salió **una sola vez** en todo el
periodo: la rama de audio es reciente y el bot estuvo apagado buena parte del tiempo.

---

## 2. Proveedores de transcripción (verificado 2026-10-06)

Supuesto de volumen para el costo: **Dynasty, solo familias** ≈ 11 audios / 5 días → **~70 audios y
≤ 70 min al mes**. Escenario alto: **10 escuelas como Dynasty transcribiendo todo** (38 / 5 días cada
una) → **~2.300 min/mes (38 h)**.

| Proveedor / modelo | USD por min | Dynasty (70 min) | 10 escuelas (2.300 min) | OGG/Opus de WhatsApp tal cual | Límite | ¿Entrena con nuestros datos? / retención |
|---|---:|---:|---:|---|---|---|
| **Groq `whisper-large-v3`** | 0,00185 ($0,111/h) | **$0,13** | **$4,3** | **Sí** (OGG, MP3, M4A, WebM…) | 25 MB free / 100 MB dev; mínimo facturado 10 s | **No entrena.** No retiene por defecto; logs de abuso hasta 30 días; **ZDR activable por el cliente** en *Data Controls*. Datos en GCP EE. UU. |
| Groq `whisper-large-v3-turbo` | 0,00067 ($0,04/h) | $0,05 | $1,5 | Sí | igual | igual |
| OpenAI `gpt-4o-mini-transcribe` | 0,003 | $0,21 | $6,9 | Doc oficial lista mp3, mp4, mpeg, mpga, m4a, wav, webm — **OGG no figura** (la API históricamente acepta `ogg`/`oga`; probar en F0) | 25 MB | No entrena por defecto. Logs de abuso 30 días; ZDR **con aprobación** de OpenAI (transcripción es endpoint elegible) |
| OpenAI `gpt-4o-transcribe` / `whisper-1` | 0,006 | $0,42 | $13,8 | igual | 25 MB | igual |
| Google Gemini Flash (audio nativo, `generateContent`) | ≈0,002–0,003 (32 tokens/s de audio a $0,50–1,00/M + salida) | ≈$0,2 | ≈$6 | **Sí** (OGG, Opus, MP3, AAC…) | 20 MB inline; 9,5 h por prompt | **Plan gratis: Google SÍ usa el contenido para mejorar productos y hay revisión humana.** Plan pago: no entrena; logs limitados por abuso |
| Google Cloud Speech-to-Text V2 (Chirp 3) | 0,016 (60 min gratis/mes); batch dinámico ≈0,003 pero hasta 24 h | ≈$0,2 | $36,8 | Sí (OGG_OPUS) | — | Cloud no entrena con datos del cliente (términos de Cloud) |
| Deepgram Nova-3 multilingüe (pregrabado) | 0,0052 PAYG / 0,0043 Growth | $0,36 | $12 | Sí | — | **Por defecto entra al *Model Improvement Program*** (usa audio para mejorar modelos); salirse con `mip_opt_out=true` **cuesta más** |
| AssemblyAI Universal (es incl.) | ≈0,0035–0,0045 ($0,21–0,27/h según modelo) | $0,3 | $8–10 | Sí | — | Tiene programa de mejora de modelos con opt-out (consultar contrato) |
| **Claude (API de Anthropic)** | — | — | — | **No acepta audio.** | — | — |

**Claude no sirve para esto hoy.** La documentación oficial de la API (Files API y bloques de contenido,
`platform.claude.com/docs`) solo admite texto, imágenes (`jpeg/png/gif/webp`) y documentos (PDF, texto).
No hay bloque de audio. Hay páginas de terceros que dicen lo contrario: son incorrectas. Claude sí puede
usarse *después* de la transcripción (ya lo usamos en `ocr.service.ts`), pero no para escuchar.

### 2.1 Calidad en español de Colombia

- **No existe un benchmark público para español colombiano** en ninguno de los proveedores. Las cifras
  publicadas son multilingües: Groq informa **10,3 % de WER** para `whisper-large-v3` y **12 %** para
  `turbo`; OpenAI afirma que `gpt-4o-transcribe` mejora a `whisper-1`. El español está entre los idiomas
  con mejor desempeño de Whisper.
- Lo que de verdad falla en este dominio no es el acento: son **nombres propios** (atletas, «Mile»,
  «Sandrita», «Dynasty»), **montos** («ciento noventa y seis» → `196000`) y **fechas** («el 24 y 25»).
  Whisper acepta un `prompt` de hasta 224 tokens con vocabulario: ahí van el nombre de la escuela, del
  equipo y de los atletas de *esa* familia (ya identificada por teléfono), y palabras del dominio
  (mensualidad, inscripción, comprobante, Nequi, Daviplata).
- Por eso **F0 es una prueba de banco** con audios reales grabados por el equipo (no de familias), antes
  de elegir de forma definitiva.

### 2.2 Recomendación

**Groq `whisper-large-v3` (no `turbo`), con OpenAI `gpt-4o-mini-transcribe` como respaldo.**

1. **Ya está todo puesto:** la llave de Groq ya vive en el BFF (`llm.service.ts`) y el 2026-09-11 se
   listaron los modelos de la cuenta: **whisper está disponible** (comentario en `ocr.service.ts`).
   La llave de OpenAI también existe (`ocr.service.ts` usa `gpt-4o-mini`). Cero proveedores nuevos,
   cero contratos nuevos.
2. **Privacidad:** no entrena, no retiene por defecto y el ZDR lo activamos nosotros sin trámite. Es el
   perfil más limpio para audio de familias que hablan de menores.
3. **OGG/Opus de WhatsApp entra tal cual**, sin `ffmpeg` en Render.
4. **`verbose_json`** devuelve duración, `no_speech_prob` y `avg_logprob` por segmento: con eso se
   detecta audio vacío/ruido sin heurísticas propias.
5. **Velocidad:** factor ~200× tiempo real — un audio de 1 min vuelve en menos de 1 s. Permite hacerlo
   en línea (§3.4).
6. **Costo irrelevante en cualquier escenario:** ~US$0,13/mes Dynasty, ~US$4/mes con 10 escuelas
   transcribiendo todo. `large-v3` en vez de `turbo` cuesta 3× pero son centavos y gana 1,7 puntos de WER.

**Descartados como principal:** Gemini (mientras no confirmemos que la llave del BFF está en **plan
pago** — en el gratuito Google usa el contenido y lo revisan humanos; inaceptable con menores);
Deepgram/AssemblyAI (programa de mejora de modelos activo por defecto, proveedor y contrato nuevos);
Google STT (el más caro, cuenta de GCP nueva); Claude (no acepta audio).

---

## 3. Diseño

### 3.1 Flujo (en `handleBotTurn`, rama de audio)

```
webhook (ya respondió 200)
  → ingesta guarda la fila en whatsapp_messages (type='audio', text_body=null)   [ya existe]
  → debeAtender(contacto)                                                          [ya existe]
       no atiende (personal, staff, desconocido, bot apagado) → silencio. NO se baja el audio.
  → ¿transcribir_audios = true en whatsapp_settings y sin kill-switch?   no → texto actual «No puedo escuchar…»
  → ¿humano reciente (saliente ai_generated=false < 15 min, P4)?          sí → transcribir solo para el buzón, el bot calla
  → downloadMedia(media_id)  → Buffer en memoria (nunca a Storage)
  → transcribir(buffer, mime, { idioma:'es', prompt: vocabulario })
  → UPDATE whatsapp_messages SET text_body = <transcripción>,
                                 payload = payload || {transcripcion:{…metadatos…}}
  → evaluar resultado:
       vacío / ruido                    → «No te entendí bien el audio 🙉 ¿Me lo escribes?»
       > 120 s                          → abrirEnBuzon + «Recibí tu audio; se lo paso a <equipo>…»
       normal                           → runBotTurn(texto transcrito, …, { origen:'audio' })
```

`runBotTurn` recibe el texto como si fuera un mensaje escrito: pasa por consentimiento, identificación,
ráfaga (`textoDeRafaga` ya lee `text_body` de las filas recientes sin mirar `type`, así que el audio
transcrito entra solo a la ráfaga), cierres sueltos, vocativo/«pide una persona» (P9) y el modelo.

### 3.2 Dónde se guarda la transcripción

- **`whatsapp_messages.text_body`** = texto transcrito, limpio (sin prefijos), para que todo lo que ya
  lee `text_body` (ráfaga, historial del modelo, último mensaje del buzón) funcione sin cambios.
  `type` sigue siendo `'audio'`: lo que distingue el origen es el tipo, no el texto.
- **`payload.transcripcion`** (jsonb, ya existe la columna) con:
  `{ proveedor, modelo, duracion_s, idioma, no_speech_prob, avg_logprob, ms, at, version: 1 }` o
  `{ error, at }` si falló. **F1 no necesita migración** para guardar la transcripción.
- Al armar el historial para el modelo, las filas `type='audio'` con transcripción se presentan como
  `[nota de voz transcrita] …` para que el modelo sepa que puede haber errores de transcripción.
- **No se guarda el audio, nunca.** Se baja a memoria, se transcribe y se descarta. Para reintentar no
  hace falta guardarlo: el `media_id` se puede volver a pedir a Meta mientras Meta lo conserve (verificar
  en F0 cuánto; la URL firmada vence en minutos, el id dura más). Esto cumple de entrada la política de
  retención que propone `MOD-30` («se borra al confirmar, solo queda el texto») y no suma bytes a un
  Supabase que ya estuvo al 105 % de cuota de archivos.
- **Logs:** nunca el texto transcrito en `info` (pino/Sentry). Solo largo, duración y proveedor.

### 3.3 Acuse, eco y casos borde

| Caso | Qué hace |
|---|---|
| Audio normal (≤ 120 s), el bot responde | La respuesta empieza con un eco corto: `🎤 Entendí: «quiero cancelar la clase del jueves»` (recortado a ~120 caracteres). Le muestra a la familia qué entendió el bot y la deja corregir. **Sin mensaje de acuse aparte** (la respuesta tarda ~2–4 s; un acuse extra es ruido). Ver D2. |
| Audio dirigido a una persona («Mile, …») | Lo resuelve P9 sobre el texto transcrito: escala o calla. La transcripción igual queda en el buzón. |
| Ráfaga audio + texto | Funciona por `textoDeRafaga`. Carrera posible: si el texto llega 2 s después y su turno corre antes de que el audio termine de transcribirse, ese turno no ve el audio. Aceptable; el turno del audio sí ve el texto. |
| > 120 s | Se transcribe (para el buzón) pero **no se le pasa al bot**: `abrirEnBuzon` (motivo `audio_largo`) y «Recibí tu audio 🎧 Como es largo, se lo paso a {equipo} para que te responda.» Ver D3. |
| > 10 min o > 16 MB | No se transcribe; se escala igual. (WhatsApp limita el audio a 16 MB.) |
| Ruido / vacío (`no_speech_prob > 0,6` o texto < 2 palabras) | «No te entendí bien el audio 🙉 ¿Me lo escribes?» Si pasa dos veces seguidas en la conversación, escala. |
| Proveedor caído / timeout (15 s) | Un reintento con el respaldo (OpenAI). Si también falla: el texto actual («No puedo escuchar…») + `abrirEnBuzon`. `payload.transcripcion.error` queda para diagnóstico. |
| Mime no soportado (p. ej. `audio/amr`) | Igual que proveedor caído. |
| Montos, nombres, fechas en el audio | El bot **nunca ejecuta una acción de dinero ni de agenda solo por un audio**: pagar sigue exigiendo comprobante (imagen/PDF); reservar/cancelar pide confirmación con botón, mostrando el dato entendido («¿Cancelo la clase del **jueves 9**?»). |
| Familia que no ha aceptado el consentimiento | **No se transcribe todavía.** El bot pide el consentimiento con texto (flujo actual). Si acepta, se transcribe el audio pendiente de los últimos 10 min por su `media_id`. Ver D4. |
| Desconocido | No se transcribe (§1.2: son audios privados de la dueña). Silencio, como hoy. |
| Personal / staff | Nunca se transcribe en F1. (En F3 el **coach** sí, pero por el flujo de MOD-30, no por el del bot de familias.) |
| Video | Sin cambios: texto actual. |

### 3.4 En línea, no por la cola

La cola de comprobantes (`whatsapp_inbound_queue` + cron cada minuto) **no** es el lugar:

- Agrega hasta 60 s de espera a una respuesta que en línea toma 2–4 s, y la familia que manda un audio
  espera respuesta como si hubiera escrito.
- La cola es una máquina de estados de comprobantes (`result_type` ∈ `payment_receipt|glosa|…`, acuse
  «Recibí tu comprobante», OCR, `waiting_user`). Meter audio ahí es ensuciarla.
- El webhook ya responde `200` **antes** de procesar (`routes/whatsapp.ts`), igual que con el texto: no
  hay riesgo de reintento de Meta por la demora. El riesgo de perder el turno si Render reinicia en esos
  segundos es el mismo que ya tiene cualquier mensaje de texto.

Si algún día el volumen lo exige, la pieza `transcribir()` es la misma y se mueve a un job sin cambiar
nada más.

### 3.5 Código (qué se toca)

| Archivo | Cambio |
|---|---|
| `bff/src/services/transcripcion.service.ts` (**nuevo**) | `transcribir(buf, mime, { idioma, prompt }) → { texto, duracionS, noSpeechProb, avgLogprob, proveedor, modelo, ms }`. Cadena Groq → OpenAI, igual que `extractReceiptWithFallback`. Kill-switch `DISABLE_TRANSCRIPCION`, modelo por env (`GROQ_STT_MODEL`, por el antecedente de modelos retirados sin aviso). Sin nada de WhatsApp adentro: lo reusa MOD-30. |
| `bff/src/services/whatsapp.service.ts` | `downloadMedia` acepta opciones `{ mimes, maxBytes }` (hoy el conjunto de mimes y el tope de 8 MB están fijos para comprobantes) y puede devolver `Buffer` además de base64. Audio: `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/webm`; tope 16 MB. |
| `bff/src/routes/whatsapp.ts` | Rama de audio de `handleBotTurn` según §3.1. |
| `bff/src/services/whatsapp-bot.service.ts` | `runBotTurn(..., { origen: 'audio' })` para el eco y la marca en el historial. |
| Migración (ledger) | `whatsapp_settings.transcribir_audios boolean not null default false`. Solo esa columna. |
| Pruebas | Unitarias de la rama (mock del proveedor): ruido, largo, caído, consentimiento pendiente, humano reciente, desconocido no baja el archivo. |

### 3.6 Buzón (F2)

`frontend/src/components/whatsapp/Conversaciones.tsx` hoy pinta `(audio)` en cursiva cuando no hay
`text_body` (línea ~444). Con la transcripción:

- Burbuja con 🎤, la transcripción, la duración y una etiqueta «transcrito automáticamente — puede tener
  errores».
- Botón **«Escuchar»**: endpoint del BFF que pide el `media_id` a Meta y hace *streaming* del audio al
  navegador, **sin guardarlo**, solo para staff de la escuela (`user_staff_school_ids`). Funciona mientras
  Meta conserve el medio; después, solo queda el texto.
- En la lista de conversaciones, el último mensaje muestra `🎤 «…»` en vez de `(audio)`.
- Opcional (D5): transcribir también los audios **salientes** de Milena para que el bot y el buzón sepan
  qué se le dijo a la familia.

### 3.7 Flag y costo

- `whatsapp_settings.transcribir_audios` por escuela, **apagado por defecto**; se prende primero en
  Dynasty. Se puede apagar desde Ajustes del asistente.
- Medición: `payload.transcripcion.duracion_s` por fila → una consulta mensual por escuela da los
  minutos. Con los precios del §2 no justifica un tope por escuela ni cobrarlo aparte; si un día lo
  justifica, el tope va en `whatsapp_settings` (`max_minutos_audio_mes`).
- Producto: va **incluido** donde esté el asistente de WhatsApp. Cobrar centavos por minuto no tiene
  sentido comercial.

### 3.8 Riesgos

1. **Privacidad de la dueña (Coexistence).** El 71 % de los audios del número son personales. Mitigación:
   `debeAtender` antes de bajar el archivo; desconocidos/personal/staff nunca se transcriben; prueba
   unitaria que verifica que `downloadMedia` **no** se llama para esos tipos.
2. **Menores y Ley 1581.** Los audios hablan de menores y a veces de salud («la niña está enferma»): dato
   de menores (art. 7) y dato sensible. La voz como tal se trata como dato personal; no la usamos para
   identificar a nadie y no la guardamos. Hace falta: (a) proveedor sin entrenamiento y con ZDR activado;
   (b) **transferencia internacional** (Groq procesa en EE. UU.): declararlo en la política de privacidad
   con Groq/OpenAI como encargados; (c) aviso de que las notas de voz se transcriben automáticamente;
   (d) transcribir solo con consentimiento aceptado (D4). Lo mismo aplica a MOD-30.
3. **Errores de transcripción con montos, nombres y fechas.** Mitigación: vocabulario en el `prompt`,
   eco «Entendí: …», confirmación con botón antes de cualquier acción, y nada de dinero por audio.
4. **El bot contestándole a algo que era para Milena.** P9 (vocativo) y P4 (humano reciente) sobre el
   texto transcrito; si se equivoca, se equivoca igual que con texto.
5. **Doble respuesta en Coexistence.** La dueña escucha el audio en su celular y contesta a la vez que el
   bot. Mismo riesgo que con texto; lo cubre P4 en el siguiente mensaje, no en el primero.
6. **Modelos que desaparecen.** Groq ya retiró modelos sin aviso (OCR, 2026-09). Modelo por variable de
   entorno y respaldo con otro proveedor.
7. **Tier de la cuenta de Groq.** En plan gratis el tope por archivo es 25 MB y hay límites por hora;
   para notas de voz alcanza de sobra, pero conviene confirmar el tier (y activar ZDR) en F0.

---

## 4. Relación con MOD-30 (evaluación por voz del coach)

| Pieza | Notas de voz de familias | MOD-30 |
|---|---|---|
| `transcripcion.service.ts` (proveedor, respaldo, kill-switch, modelo por env) | ✔ | ✔ V1 (app) y V5 (WhatsApp) |
| Vocabulario en el `prompt` | Escuela, equipo, atletas de la familia | Roster del equipo + nombres de las métricas del deporte (`sport_metric_definitions`) |
| `downloadMedia` con audio | ✔ | ✔ V5 |
| Política de retención: el audio nunca se guarda, queda solo el texto | ✔ | ✔ (resuelve la decisión abierta de MOD-30: ni siquiera hasta confirmar) |
| Política de privacidad / consentimiento | ✔ | ✔ (aviso antes de V1, como dice el roadmap) |
| Reconocer quién habla por teléfono (`debeAtender` → `staff`) | Familias | **Coach**: hoy `staff` se calla; en V5 su audio se desvía al flujo de evaluación, no al bot de familias |
| Subida desde la app | — | V1: endpoint `POST /api/v1/transcripciones` (multipart). `MediaRecorder` graba WebM/Opus en Android y MP4/AAC en iPhone: **ambos los acepta Groq sin convertir**. No usar Web Speech API (falla en iPhone). |
| Revisión humana antes de escribir | Eco + botón de confirmación | Revisión campo por campo (patrón del alta por foto) |

Construyendo F1 primero, MOD-30 V1 queda en «grabar en la app + llamar al servicio que ya existe».

---

## 5. Fases

| Fase | Qué | Estimación |
|---|---|---|
| **F0 — Prueba de banco y legales** | 15–20 notas de voz grabadas por el equipo (no de familias), con nombres de atletas, montos y fechas, en el celular, con ruido de coliseo. Comparar `whisper-large-v3`, `turbo`, `gpt-4o-mini-transcribe` y `gpt-4o-transcribe`: WER y aciertos en nombre/monto/fecha. Confirmar que OpenAI acepta OGG. Confirmar tier de Groq y activar ZDR. Confirmar cuánto conserva Meta un `media_id` entrante. Párrafo para la política de privacidad. | 0,5–1 d |
| **F1 — Transcribir y responder** | `transcripcion.service.ts`, `downloadMedia` para audio, rama de audio en `handleBotTurn`, eco, casos borde de §3.3, consentimiento, flag + migración, pruebas. Prender en Dynasty con el bot en modo asistido primero (borradores) una semana. | 2–3 d |
| **F2 — Buzón** | Burbuja con transcripción, «Escuchar» por streaming sin guardar, último mensaje con 🎤. Opcional: transcribir salientes de Milena (D5). | 1–1,5 d |
| **F3 — Audios del coach (MOD-30)** | V1 grabar desde la app (reusa el servicio) y V5 audio del coach por WhatsApp. V2–V4 (mapeo a métricas, revisión, guardado) siguen la estimación de MOD-30. | V1 +1 d sobre F1 · resto según MOD-30 (~2 sem V1–V4, +1 sem V5 → V5 baja a ~2–3 d por lo ya hecho) |

---

## 6. Decisiones abiertas

- **D1 — Proveedor.** Recomendado: Groq `whisper-large-v3` + respaldo OpenAI `gpt-4o-mini-transcribe`,
  sujeto a F0. Activar ZDR en Groq.
- **D2 — Eco «🎤 Entendí: …».** Recomendado: sí, en la primera línea de la respuesta, sin acuse aparte.
- **D3 — Audios largos.** Recomendado: > 120 s se escala al buzón con la transcripción, sin resumen
  automático. (Alternativa: resumir con el LLM y responder; más riesgo de malentender.)
- **D4 — Consentimiento antes de transcribir.** Recomendado: sí; transcribir solo con consentimiento
  aceptado y recuperar el audio pendiente por `media_id` al aceptar.
- **D5 — Audios salientes de Milena.** ¿Se transcriben para que el bot y el buzón tengan el contexto?
  Recomendado: no en F1; decidir en F2.
- **D6 — Desconocidos.** Recomendado: nunca transcribir (son la vida privada de la dueña).
- **D7 — Producto.** Recomendado: incluido en el asistente, flag por escuela, apagado por defecto.

---

## Fuentes (consultadas 2026-10-06)

- Groq — [Speech-to-Text](https://console.groq.com/docs/speech-to-text) (precios $0,111/h y $0,04/h, WER 10,3 % / 12 %, formatos, 25/100 MB, mínimo 10 s, `prompt` 224 tokens) · [whisper-large-v3-turbo](https://console.groq.com/docs/model/whisper-large-v3-turbo) · [Your data](https://console.groq.com/docs/your-data) (sin retención por defecto, ZDR en Data Controls, sin entrenamiento)
- OpenAI — [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text) (formatos, 25 MB) · [Your data](https://developers.openai.com/api/docs/guides/your-data) (no entrena por defecto, 30 días, ZDR elegible para transcripción) · precios por minuto: [diyai.io](https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/)
- Google — [Gemini: audio](https://ai.google.dev/gemini-api/docs/audio) (formatos, 32 tokens/s, 20 MB inline) · [Gemini: precios](https://ai.google.dev/gemini-api/docs/pricing) · [Términos de la Gemini API](https://ai.google.dev/gemini-api/terms) (plan gratis usa el contenido y tiene revisión humana) · [Speech-to-Text pricing](https://cloud.google.com/speech-to-text/pricing/)
- Deepgram — [Model Improvement Partnership Program](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program) · precio Nova-3: [diyai.io](https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/)
- AssemblyAI — [modelos](https://www.assemblyai.com/models) · [opt-out del programa de mejora](https://support.assemblyai.com/articles/5930031898-how-to-opt-out-of-data-sharing-for-model-training)
- Anthropic — [Files API: tipos de archivo](https://platform.claude.com/docs/en/build-with-claude/files) (texto, PDF, imágenes; sin audio)
