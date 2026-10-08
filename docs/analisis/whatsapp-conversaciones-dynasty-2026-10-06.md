# WhatsApp Dynasty — cómo escriben las familias y cómo respondió el bot (2026-10-06)

Alcance: escuela Dynasty (`2d509571-…`), integración `f50d6940-…`. Ajustes vivos: `ai_enabled=true`, `mode=auto`,
`responder_desconocidos=true` (cambiado 08:20 COT). Bot prendido ~08:08 COT. Corte de datos: 08:45 COT.
Fuente: `whatsapp_messages`, `whatsapp_conversations`, `whatsapp_inbound_queue`, `whatsapp_message_drafts`,
`whatsapp_optins` (solo SELECT). Las conversaciones se citan por los 8 primeros caracteres del id; los nombres van
como iniciales o `[atleta]`. Horas en COT.

Universo: 146 conversaciones. 50 de familia (43 `familia` + 7 `familia_sin_cuenta`, 0 `ambiguo`; 264 entrantes),
47 `desconocido`, 3 `personal`, 46 sin clasificar (anteriores a la clasificación).

---

## 0. Caso 08:34–08:42 (…3555)

Conversación `abe50cda`, clasificada `familia` (el número tiene un atleta de prueba). En realidad es el desarrollador
escribiéndole a Milena.

| Hora | Entrante | Respuesta | Qué la generó |
|---|---|---|---|
| 08:24:23 | «Milena estás por acá?» | «Soy el asistente automático… ¿Quieres que lo escale a un humano?» | `llm_text`, `ai_generated=true`, groq. Se pidió una persona y el modelo **preguntó** en vez de escalar, cuando el prompt dice «usa escalate_to_human de una». Milena contestó «Siii» 3 s después desde su celular. |
| 08:34:33 | «Mile, puedes ir a comunicación WhatsApp Conversaciones… marcar como personal» | «Lo siento, solo puedo ayudar con temas de pagos o información de la escuela…» | `llm_text`, `ai_generated=true`, groq. `handleIntent` → modelo sin tool → regla FUERA DE TEMA del `SYSTEM_PROMPT`. |
| 08:35:10 | imagen (captura de la app) con pie «Ahí, con eso el bot ya no les responde…» | «Recibí tu comprobante 📄 Lo estoy revisando y te confirmo en un momento.» | **No queda registrada en `whatsapp_messages`**: no hay saliente a las 08:35. Sale de `encolarAdjunto` (`bff/src/services/whatsapp-queue.service.ts`, constante `ACUSE`), que la manda con `sendTextMessage` directo, sin pasar por `deliver`: no tiene `step`, no queda en el historial ni en el buzón, y el modelo no sabe que se mandó. |

**(1) Pasos que generaron cada respuesta:** los de la tabla. Las dos de texto son `llm_text` (modelo). El acuse es
la constante `ACUSE` de la cola, que sale apenas se inserta la fila y no deja rastro.

**(2) Fila de la cola:** `whatsapp_inbound_queue` `bc93269d`: `status=pending`, `retries=0`, `locked_until=null`,
`storage_path=null`, `processed_at=null`. Ningún worker la tomó. Las **15** filas creadas desde las 08:00 están igual
(todas `pending`, `retries=0`, sin lease). La última fila procesada (`done`/`ignored`) es del 05-oct 22:18. Eso
coincide con el kill-switch `DISABLE_WHATSAPP_QUEUE_CRON=true` (`bff/src/jobs/maintenance.job.ts:459`) o con que el
proceso de cron no esté corriendo en Render. Desde la base no se lee la env de Render, pero con lease vacío y 0
reintentos se descarta que el OCR haya fallado: el job no corrió. Si hubiera corrido, el OCR habría leído una
captura y la fila se habría cerrado con «No reconocí este archivo ni como comprobante…» (`whatsapp-queue.job.ts:762`).
Así que el acuse inicial tampoco habría acertado.

**(3) Por qué contestó un mensaje dirigido a «Mile»:** nada en el pipeline mira a quién va dirigido el mensaje ni si
la dueña está hablando en ese chat. `debeAtender` solo clasifica el número (familia → atiende). `runBotTurn` no revisa
si hubo un saliente humano reciente (echo de Coexistence, `ai_generated=false`). En este chat Milena había escrito a
las 08:24:32, 08:25:02, 08:25:30 y 08:32:10, o sea dos minutos antes del mensaje de las 08:34, y el bot igual se
metió. Además, `abe50cda` es de alguien del equipo y está clasificado `familia` porque tiene un atleta de prueba.

**(4) El acuse antes de saber qué es:** sí. `encolarAdjunto` responde «Recibí tu comprobante… te confirmo en un
momento» **antes del OCR, antes de `debeAtender` y antes de mirar `ai_enabled`**. Las consecuencias:
- se le dice «comprobante» a una captura de pantalla, a una hoja de matrícula (`791df5d5`, 08:33, pie «[atleta]
  Infantil masculino 2 veces x semana») o al correo de cobro que reenvía un papá (`a7438e6b`);
- según el código, también les llega a los contactos `personal` (las 3 imágenes del contacto personal `a04e9af6`
  entraron a la cola) y saldría con el bot apagado;
- si el worker no corre, **la promesa «te confirmo en un momento» no se cumple nunca**. Hoy son 15 filas, de 10
  conversaciones de familia, sin ningún seguimiento. Tampoco hay un vencimiento que pase la fila al buzón.

**Arreglos propuestos:**
1. *Acuse que diga la verdad y quede registrado.* En `encolarAdjunto`: (a) llamar `debeAtender` antes del acuse; si
   el contacto no se atiende o el bot está apagado, encolar sin responder; (b) mandar el acuse por `deliver(...)`
   con `step: 'acuse_adjunto'` para que quede en `whatsapp_messages`, respete el modo y le llegue al historial del
   modelo; (c) cambiar el texto a «Recibí tu archivo 📄 Lo reviso y te aviso por aquí.» y no decir «comprobante»
   hasta que el OCR lo confirme. Si el pie o el texto anterior hablan de pago («pago», «comprobante», «soporte»,
   «mensualidad»), sí se puede decir «comprobante».
2. *Plazo para la promesa.* Un job (o el mismo `runWhatsAppMantenimiento`) que, para filas `pending` con más de
   10 min y sin `outcome_notified_at`, abra la conversación en el buzón (`status=open`, push/correo con motivo
   `comprobante_sin_procesar`) y le escriba una sola vez a la familia: «La escuela va a revisar tu comprobante a
   mano y te confirma.» Además, una alerta (Sentry o log `warn`) cuando haya filas `pending` de más de 5 min. Así,
   aunque el cron esté apagado, la escuela se entera.
3. *Callarse cuando la conversación es con la persona.* En `runBotTurn` (antes del paso 1b) y en `handleBotTurn`,
   para audio y adjuntos: si hay un saliente con `ai_generated=false` en los últimos 15 min, **no responder**.
   Solo se marca `status=open` y el buzón lo muestra. Es la regla «la dueña tomó el chat».
4. *Vocativo a una persona.* Si el mensaje empieza o termina con el nombre de alguien del staff («Mile», «Milena»,
   «profe», «Sandrita»; ver §1) y no contiene un trámite reconocible, el bot no da el «solo puedo ayudar con…».
   O se calla (si hay humano reciente) o contesta una vez: «Soy el asistente automático; le dejo tu mensaje a
   Milena 🙌», y escala (`abrirEnBuzon`). La lista de nombres sale de `school_members` y `profiles.full_name`
   (nombre de pila y diminutivo), o de un campo de ajustes `nombres_del_equipo`.
5. *Pedir una persona = escalar.* «¿Milena estás por acá?», «hablar con alguien», «una persona» → regla
   determinista que llama `escalate` sin pasar por el modelo (hoy el modelo pregunta).
6. *Staff clasificado como familia.* Marcar `abe50cda` como `personal` desde el buzón, o hacer que `debeAtender`
   dé prioridad a `staff` sobre `familia` cuando el perfil es de SportMaps o admin.

---

## 1. Cómo escriben los padres

Base: los 264 entrantes de las 50 conversaciones de familia (02 al 06-oct), más los entrantes «de tema escolar» de los
`desconocido`.

### Intenciones (por conversación, una conversación puede tener varias; n = 49 familias, sin contar al desarrollador)

| Intención | Conversaciones | % | Ejemplos (textuales, anonimizados) |
|---|---|---|---|
| **Enviar comprobante de pago** | 29 | 59 % | «Buen día envío pago de [atleta] y también envío los 100000 del torneo» · «Pago [atleta]» · «Mensualidad octubre voleibol viki» · «Soportes [atleta] mensualidad y vacacionales» · «Buenas noches.. envío soporte de pago mes octubre [atleta]» · «Hola, envío el comprobante de pago de Mensualidad 10/2026 - [ATLETA] (octubre 2026) de [ATL..]» (texto precargado de `/p/:token`, 2 casos hoy) |
| **«Ya pagué y me sigue llegando el cobro / no aparece»** | 10 | 20 % | «Es q me aparece el pago pendiente y yo ya pagué, me llegaron mensajes recordando el pago» · «me está llegando cuenta de cobro pero yo ya te envié el desprendible» · «Me está llegando el estado de cuenta y se están facturando SEP y Oct» · «Aún no aparece el pago en la plataforma me ayudas» · «Yo cancele / Debo solo es octubre» · «me llegó este correito, me ayudas a reflejar el pago» · «Es que me está llegando esto al correo y mi hija no ha vuelto» |
| Cómo / dónde pagar, valor, falla de la plataforma | 8 | 16 % | «Quisiera saber q estoy de debiendo… y qr o # para realizar la pago» · «Me regala el valor xfavor» · «no puedo realizar el pago. Hay una lleve» · «No me deja aún subir el pago de octubre» · «Me regalas nuevamente el link de la plataforma» |
| Horarios / ¿hay clase hoy? / sede | 8 | 16 % | «Esta semana no hay entrenamiento ?» · «Me confirmas por favor si hoy hay clase de volley ball intermedio?» · «Ya que esta semana es de receso estudiantil hay clase normal…» · «Quería confirmar si las clases extracurricular son en coliseo??» |
| Clases extra (perfeccionamiento, refuerzo, vacacionales) y cómo se pagan | 6 | 12 % | «para pagar la clase de perfeccionamiento… es a su nequi? o tmbien por plataforma?» · «Para inscribirlas en el grupo de refuerzo lunes y martes / Como hacemos» |
| Ausencias, salud, vacaciones | 6 | 12 % | «[atleta] no ha podido volver… por una gripa terrible» · «Ha estado todo el día con malestar estomacal» · «este mes salgo a vacas del trabajo. Asistiré a la mitad de las clases» · «En septiembre mi hija no asistió» |
| Social / favores / personal con Milena | 5 | 10 % | «le puedes prestar un cargador tipo c a santi» · «Dejé los audífonos…» · «Se cayó el mundo / Se inundó…» · «te paso el nequi de alejo… para un perfume» |
| Torneos y viajes | 3 | 6 % | «me confirmas porfa si recibiste lo de Mexico 🇲🇽, la segunda cuota» · «Voy a hacer el pago de los torneos…» |
| Uniformes | 2 (+2 desconocidos) | 4 % | «Tienes de pronto la foto de la sudadera» · «te puedo molestar con pantalón de sudadera para juli» |
| Resultados y pruebas deportivas | 2 | 4 % | «cómo le fue a cata en las pruebas y cuál fue el resultado» |

**Desde números desconocidos:** al menos **12 conversaciones `desconocido` son familias mandando comprobante desde un
número que no está en ninguna ficha** («Hola Mile… te Envío pago [atleta]», «Pago de [atleta] del mes de octubre.
Categoría intermedio», «Mile buen día, envío pago mes de octubre»). Hay además **9 prospectos** («Quiero inscribir a
mi hija a volleyball / Pero no sé en qué grupo», «realizan entrenamiento para niñas de 8 años», «no dan una clase de
cortesía», «Me quedaron de enviar la información… para agendar la clase de cortesía y no me han enviado nada»).

### Cómo lo dicen

- **Le hablan a una persona, no a un sistema.** 50 de 200 textos (25 %) nombran a alguien: «Mile», «Milena», «mi
  Mile», «Mi querida Mile», «sra Milena», «profe», «Sandrita». 15 son solo un saludo («Hola Milena buenos días»,
  «Buen día Milena»). Lo típico es saludar con el nombre y mandar el trámite en el mensaje siguiente.
- **Ráfagas.** El 64 % de los entrantes (137 de 214) llega a menos de 60 s del entrante anterior en la misma
  conversación. Patrón típico: saludo → pregunta → aclaración → «Gracias», o imagen → texto con el nombre del atleta
  (20–60 s después) → «👆». El orden imagen/texto varía: unas veces primero la foto, otras primero el texto.
- **Mezclan temas en un mismo mensaje:** «envío pago de [atleta] y también envío los 100000 del torneo», «Dos
  preguntas / 1. horarios… / 2. cómo le fue en las pruebas», «Sandrita hoy me gustó mucho el entrenamiento… La
  quiero traer mañana pago con la mensualidad?».
- **Largo:** mediana de 24 caracteres; 91 de 200 textos tienen ≤ 20 caracteres («Vale», «Ok», «?», «Si ??», «👆»);
  25 superan los 100 (avisos de salud, reclamos de cobro).
- **El comprobante va con el nombre del atleta y el mes**, casi siempre en el pie de la foto o justo después:
  «Mensualidad octubre [atleta]», «Pago [atleta]», «[atleta] Mini Volley», «… de 4 dias a la semana». A veces mandan
  el mismo comprobante dos veces seguidas.
- **Medios:** 43 imágenes (16 % de los entrantes), 2 PDF, 9 notas de voz en 6 conversaciones, 1 sticker. Las notas de
  voz vienen de familias de confianza que hablan con Milena («Mi querida Mile» + 2 audios).
- **Ortografía informal:** «estss», «ha cer», «tmbien», «x fa», «xfavor», «q», «Haber si» (= a ver si), «lleve»
  (= llave), «Voleyvol», «Dinasty», «porfa». Hay que normalizar sin depender de tildes ni de mayúsculas.
- **Horario:** picos a las 8 h (sesgado por hoy), entre 12 y 13 h y a las 15 h, con una cola de noche entre 19 y 22 h
  (20 mensajes). Escriben fuera de oficina.
- **Una familia tiene auto-respuesta de su propio negocio** (`c59de2`: «¡Hola! 👋 Gracias por escribir a Play Kids…
  fuera de horario»). Si el bot le contesta a eso, hay riesgo de que dos bots se respondan en bucle.

---

## 2. Evaluación del bot desde el 06-oct 08:08

| Conv | Qué pidió la familia | Qué hizo el bot | ¿Resolvió? | Por qué |
|---|---|---|---|---|
| `355bebed` (A.) | Texto precargado «envío el comprobante de pago de Mensualidad 10/2026 – [atleta]» y la foto 11 s después | `ask_consent` (4 s). Foto → acuse sin registrar → nada más (cola `9d5f05e7` pending) | **No** | El consentimiento interrumpió el trámite. El texto precargado no se reconoce. La cola no corre. |
| `e9e185ce` (J.) | Mismo texto precargado y la foto | `ask_consent`. «Sí, acepto» → `opt_in_registrado`. Comprobante sin respuesta (`261e1028` pending) | **No** | Igual que el anterior. |
| `ac209e73` (Y.) | Foto + «Mensualidad octubre [atleta]» | `ask_consent` → sí → **«Stop» 20 s después** → `opt_out_confirmado`. Comprobante pending | **No** | Consentimiento en mitad de un trámite. Además la confirmación dice «Para darte de baja, escribe *STOP*» y la mamá lo escribió (ver E5). |
| `2ddd46fd` (H.) | Foto + «Pago [atleta]» + «Grupo blue» | `ask_consent`; luego `escalated` con `reason=llm_error` («Voy a pasar tu caso…»). «Cuál caso» → el modelo dice que lo está «escalando a un agente». Milena: «Ok recibido tu pago» | **Mal** | El modelo falló y eso se le presentó a la familia como una escalación. La familia no entendió de qué caso le hablaban. |
| `5af7d51f` (C.) | «Buen día Milena» → «Aún no aparece el pago en la plataforma» → «Pague el Jueves ☹️» | `ask_consent`; estado de pagos en 71 s (pendiente $180.000); sí → **«Stop» 12 s después**; a «Pagué el jueves» responde 4,5 min después repitiendo que está pendiente y pidiendo la foto | **Parcial** | El dato es correcto y pidió el comprobante, pero no reconoce que la mamá ya pagó, no busca si hay un comprobante en la cola o en revisión, y tarda 270 s. |
| `8f9e500b` (Y.) | Foto + pago mensualidad y torneo; aclaraciones con Milena en vivo | Mientras **Milena contestaba**, el bot mandó `ask_consent` y **5 estados de pago** (08:21:32, 08:22:12, 08:22:30, 08:27:00, 08:27:53) más 2 `llm_text`. Dijo «No hay pagos pendientes por 100 000» y «no tengo información del torneo». Milena: «El torneo ya queda al día» | **Mal** | Habló encima de la persona, en ráfaga, una respuesta por cada mensajito, y contradijo lo que acordaron. Lo resolvió Milena. |
| `a7438e6b` (M.) | Foto del correo de cobro + «Hola Mile, me ayudas a reflejar el pago» | Milena respondió en 30 s. Luego el bot: `ask_consent`, «¡De nada! 😊…» genérico, y «No, gracias» → `consent_rechazado` | **No** (lo resolvió la persona) | Interrumpió una conversación con la dueña. Acuse de «comprobante» para el correo de cobro reenviado. |
| `e9ed4b64` (G.) | «Hola Milena» «Buen día» «Cómo vas?» → foto de cobro + «La transferencia se realizó el 4 de septiembre 👇» + foto + «👆» | En 2 s: `ask_consent`, `llm_text` («¡Buen día!…»), `opt_in_registrado` y `escalated` (`llm_error`). Foto → el **modelo** dice «Recibí la imagen… Voy a revisar el comprobante y te confirmo» (no puede hacerlo). Luego **2 estados de pago repetidos** a 9 s de distancia, que listan sep-2026 como vencida. Milena: «Ya te actualizo / Los pagos» | **Mal** | Respondió cada mensaje de la ráfaga en paralelo y fuera de orden, con una escalación falsa. Prometió algo que no hace. Le cobró a la familia lo que ella dice haber pagado, sin mencionar el comprobante. |
| `0cb83075` (E.) | Foto + nota de voz; «Lo mismo que te dije ayer» (ayer: «me está llegando esto al correo y mi hija no ha vuelto») | `tipo_no_soportado_audio`; `ask_consent`; «No, gracias» → `consent_rechazado`. Milena: «Ok ya mismo» | **No** | Sin memoria de más de 24 h. El tema (cobro de una atleta que se retiró) no tiene salida en el bot y no se escaló. |
| `abe50cda` (…3555, desarrollador) | Pruebas: pagos, formas de pago, horarios, cortesía, «Milena estás por acá?», link Wompi, mensaje para Mile, captura | Pagos, medios y horarios OK. Cortesía → «Eso no lo tengo a la mano» (ya corregido en 98801dcf). No escaló a la persona. Mensaje para Mile → «Lo siento, solo puedo…». Captura → acuse falso | **Parcial** | Ver §0. |
| `ab531aba` (desconocido, M.) | «Mile buen día, envío pago mes de octubre» | `ask_email` genérico («Si eres familia… escríbeme el correo») | **No** | No acusa el pago. Es una familia desde otro número (12 casos así en el histórico). |
| `791df5d5` (sin clasificar) | Foto de la hoja de matrícula con pie | Acuse «comprobante» (según el código) + pending | **No** | Tipo equivocado y cola frenada. |

### Errores concretos

- **E1. El consentimiento le gana al trámite.** `handleConsent` va antes que todo lo demás en `runBotTurn` (paso 2).
  Las 10 conversaciones de familia recibieron `ask_consent` como **primera** respuesta. En 5, lo que la familia había
  escrito era un comprobante o un pago (2 con el texto precargado). En 2, la familia estaba hablando con Milena.
  Ninguna de las 5 de comprobante recibió después una respuesta sobre el comprobante.
- **E2. No hay debounce: un turno por mensaje, en paralelo.** `e9ed4b64` recibió 4 salientes en 2 s, fuera de
  orden. `8f9e500b` recibió 5 estados de pago en 6 minutos. Hay estados de pago duplicados a 9 s
  (`e9ed4b64` 08:24:45 y 08:24:54).
- **E3. Habla encima de la persona.** 6 de las 10 conversaciones tuvieron a Milena escribiendo al mismo tiempo
  (20 salientes humanos contra 49 del bot). El bot no mira los echos (`ai_generated=false`) para callarse.
- **E4. Escalaciones falsas por falla del modelo.** Las 2 escalaciones del día son `reason=llm_error`, ninguna pedida
  por la familia. El texto «Voy a pasar tu caso…» confunde («Cuál caso»). Casi todo salió por **groq** (23 de 25
  respuestas del modelo), lo que indica que Gemini está fallando y el fallback carga con todo.
- **E5. «Escribe STOP» se lee como una instrucción.** 2 de 5 opt-in terminaron en «Stop» a los 12–20 s
  (`whatsapp_optins` …0359 y …2448). La confirmación termina en «Para darte de baja, escribe *STOP*» y las mamás lo
  hicieron. Perdimos 40 % de los consentimientos en segundos.
- **E6. Acuse de comprobante falso y sin registrar** (§0). 15 adjuntos sin desenlace; el modelo no ve el acuse e
  improvisa otro («Recibí la imagen, voy a revisar…»).
- **E7. Le cobra a quien dice que ya pagó.** Ante «ya pagué / no aparece / la transferencia fue el 4 de sep», el bot
  lista la deuda como vencida. No cruza con `whatsapp_inbound_queue` ni con `payments.status` en revisión.
- **E8. Respuestas genéricas o de relleno:** «¡De nada! 😊 Si necesitas consultar algún pago…», «Gracias por tu
  comentario. Tomaremos en cuenta tu opinión», «Lo siento, solo puedo ayudar con…». Las disparan agradecimientos y
  mensajes para Milena.
- **E9. No escala cuando piden a la persona** («Milena estás por acá?» → pregunta si escalar).
- **E10. Latencia:** mediana de 38 s (máx. 269 s) para estado de pagos, 56–73 s para info de escuela y 17 s para
  medios de pago. Los pasos deterministas (consentimiento) tardan 4 s.

---

## 3. Mejoras priorizadas (impacto × frecuencia)

| # | Mejora | Evidencia | Cambio concreto | Riesgo |
|---|---|---|---|---|
| **P1** | **La cola de comprobantes tiene que correr y su promesa tiene que tener plazo** | 15 `pending` desde 08:00, `retries=0`, sin lease; 59 % de las familias escribe para mandar comprobantes | Reactivar el cron en Render (revisar `DISABLE_WHATSAPP_QUEUE_CRON`). Agregar un vencimiento a `runWhatsAppMantenimiento`: `pending` de más de 10 min → buzón + push/correo + un mensaje a la familia. Alerta si hay filas de más de 5 min | Bajo. El vencimiento no puede duplicar el desenlace: usar `outcome_notified_at` |
| **P2** | **(a) El consentimiento nunca antes del trámite** | E1: 10/10 conversaciones; 5 comprobantes interrumpidos | En `runBotTurn`, sacar `handleConsent` del paso 2. Solo **lee** la respuesta si el último saliente fue `ask_consent` (sí/no/botón). La **pregunta** se hace al final de un turno resuelto (después de un `get_payment_status`/`get_payment_methods`/acuse, como posdata o en un mensaje aparte 1 min después) o en otro día, nunca como primer mensaje y nunca si el entrante es adjunto, comprobante, pregunta (`?`, verbo de trámite) o saludo a una persona. `identificarPorTelefono`/`verificarCodigo` dejan de pegar la pregunta | Medio. Hay que mantener la prueba de opt-in (`source_ref` = mensaje del sí) y no preguntar dos veces. Los tests de `whatsapp-bot` asumen el orden actual |
| **P3** | **(b) Reconocer «envío el comprobante de pago de …» y anunciar el comprobante** | 2 casos hoy con el texto precargado de `/p/:token`; 29 conversaciones mandan comprobante con texto («envío pago», «soporte», «comprobante», «Pago [atleta]») | Nueva regla determinista `anunciaComprobante(text)` en `whatsapp-bot.service.ts`, antes de cualquier LLM o consentimiento. Regex del precargado `/env[ií]o el comprobante de pago de (.+?) \((\w+ \d{4})\)/` y genérica `(env[ií]o|adjunto|te comparto).*(pago|comprobante|soporte|transferencia)` o `^pago \w+`. Respuesta: «¡Recibido! Mándame la *foto* o el *PDF* del comprobante y lo aplico a *Mensualidad 10/2026 – [atleta]*.» Guardar `payload.cobro_anunciado = {concepto, periodo}` para que el worker (`resolverPago` en `whatsapp-receipt-matching.service`) lo use como pista cuando hay varios pendientes. Mejor aún: que `/p/:token` meta el id del cobro en el texto (p. ej. `ref:XXXX`) para un vínculo exacto. Si la imagen ya llegó antes (≤ 2 min), no pedirla: «Recibido, lo estoy revisando» | Bajo. Falsos positivos («voy a enviar el pago mañana») → contestar «Cuando lo tengas, mándame la foto» |
| **P4** | **Callarse si la persona está en el chat** | E3: 6/10 conversaciones; 5 estados de pago encima de Milena en `8f9e500b` | En `runBotTurn` (después de `botEncendido`) y en la rama de audio/adjunto de `handleBotTurn`: si hay un saliente con `ai_generated=false` en los últimos 15 min, no responder (solo `abrirEnBuzon` sin push). Ajustable en `whatsapp_settings` (`silencio_si_humano_min`) | Bajo. Si Milena escribió y se fue, la familia espera hasta 15 min; aceptable |
| **P5** | **(c) Debounce de ráfagas** | E2: el 64 % de los entrantes llega a menos de 60 s del anterior; 4 salientes en 2 s en `e9ed4b64` | No correr `runBotTurn` en el webhook. Encolar por conversación (tabla `whatsapp_bot_turns` o pg-boss con `singletonKey=conversation_id`, debounce de 8–12 s, extendido a 25 s si llega una imagen o si el último texto es solo saludo). Un único turno procesa **todos** los entrantes nuevos juntos (texto concatenado + «[envió una imagen]»). Lock por conversación (advisory lock o `FOR UPDATE SKIP LOCKED`) para que nunca haya dos turnos en paralelo | Medio. Agrega latencia percibida de unos 10 s; hay que reprocesar si el BFF se reinicia (por eso, tabla y no `setTimeout`) |
| **P6** | **(d) Acuse inmediato de imagen, veraz y registrado** | E6, §0 | En `encolarAdjunto`: `debeAtender` y `ai_enabled` primero; acuse por `deliver` con `step:'acuse_adjunto'`; texto neutro («Recibí tu archivo 📄 lo reviso y te aviso por aquí») salvo pista de pago; un solo acuse cada 2 min por conversación (dos fotos seguidas = un acuse). Si hubo un anuncio (P3), el acuse lo nombra: «Recibí el comprobante de *Mensualidad 10/2026 – [atleta]*» | Bajo |
| **P7** | **«Ya pagué» no se responde con la deuda** | E7: `5af7d51f`, `e9ed4b64`; 20 % de las familias reclama un cobro ya pagado | Nueva tool/regla `estado_de_mis_comprobantes`: antes de listar deudas, consultar `whatsapp_inbound_queue` (filas recientes de ese número) y los `payments` con comprobante en revisión. Prompt: si el acudiente dice que ya pagó, primero decir qué comprobante tenemos y su estado; si no hay, pedir la foto; si dice que lo mandó por otro canal, escalar con motivo `reclamo_cobro`. Agregar a `wa_get_payment_status` un campo `comprobante_en_revision` | Medio. Depende de que P1 corra |
| **P8** | **Confirmación de opt-in que no invite a escribir STOP** | E5: 2/5 opt-out a los 12–20 s | Texto: «✅ Listo, te avisaremos por aquí. (Si algún día no quieres recibirlos, escribe *BAJA*.)» o poner la instrucción solo en la pregunta. Tratar un STOP a menos de 60 s de un opt-in como posible error: confirmar con botones «¿Seguro que no quieres los avisos?» | Bajo. Hay que seguir respetando cualquier baja explícita (política de Meta) |
| **P9** | **(e) Mensajes para «Mile», saludos y la persona** | 25 % de los textos nombra a alguien; «Milena estás por acá?» no se escaló; «Lo siento, solo puedo…» a un mensaje para Mile | Regla determinista `pideALaPersona(text)`: (1) «¿estás por acá?», «hablar con Milena/alguien/una persona» → `escalate` directo; (2) vocativo («Mile», «Milena», «profe», nombres del staff) **sin** trámite reconocible → un solo «Soy el asistente automático de la escuela; le dejo tu mensaje a Milena 🙌» y `abrirEnBuzon` (una vez cada 2 h por conversación); (3) saludo solo («Hola Milena buenos días») → esperar el siguiente mensaje (debounce P5); si no llega nada en 25 s, contestar «¡Hola! ¿En qué te ayudo?». Prompt: prohibido el «solo puedo ayudar con…» y prohibido decir que se va a revisar un archivo | Bajo |
| **P10** | **Falla del modelo ≠ escalación** | E4: 2/2 escalaciones fueron `llm_error` | En `handleIntent`, ante `llm_error`: reintentar una vez con el otro proveedor; si vuelve a fallar, responder con el camino determinista según palabras clave (pagos → `fallbackPaymentText`; medios → `fallbackMediosDePago`) o un «Dame un momento, no logré procesarlo; ya le avisé a la escuela» que no diga «tu caso». Revisar por qué Gemini no responde (casi todo sale por groq) | Bajo |
| **P11** | **Audios** | 9 notas de voz en 6 conversaciones; hoy `0cb83075` mandó una con la foto | Corto plazo: el texto actual está bien, pero que no salga si hubo un humano reciente (P4) y que escale al buzón (`abrirEnBuzon`) para que alguien escuche. Mediano plazo: transcripción (Whisper/Gemini audio) y pasar el texto a `runBotTurn` | Medio (costo de transcripción) |
| **P12** | **Familias desde otro número** | 12 conversaciones `desconocido` mandan comprobante con nombre de atleta; hoy `ab531aba` recibió `ask_email` | Para un desconocido con tema `pagos` + adjunto o nombre de atleta: acusar («Recibí tu mensaje de pago; como no reconozco este número, se lo paso a la escuela para que lo aplique»), encolar el adjunto con `matched_parent_id` nulo y llevarlo al buzón, en vez de pedir el correo como primer paso. Ofrecer el correo como opción secundaria. Opcional: buscar el nombre del atleta del texto contra `children` de la escuela y sugerirle a la escuela la vinculación del número | Medio. No exponer datos a un número no verificado |
| **P13** | **Respuestas de cierre** | E8 | «Gracias», «Ok», «Vale», «👍», «Listo» sin pregunta abierta → no responder, o solo una reacción 👍 (Graph `reaction`). Hoy generan «¡De nada! 😊 Si necesitas…» | Bajo |
| **P14** | **No contestarle a otro bot** | `c59de2` manda la auto-respuesta «Play Kids… fuera de horario» | Detectar auto-respuestas («fuera de horario», «Gracias por escribir a», «respuesta automática») → silencio | Bajo |
| **P15** | **Latencia** | E10: estado de pagos con mediana de 38 s y máximo de 269 s | Con P5 ya se gana coherencia. Además: `wa_get_payment_status` y una redacción determinista para los casos simples (1–2 cobros) sin la segunda llamada al modelo. Timeout de 20 s por proveedor | Bajo |

---

## 4. Métricas (06-oct 08:08–08:45)

| Métrica | Valor |
|---|---|
| Conversaciones de familia con entrantes | 10 (9 familias reales + el desarrollador); más 1 desconocido de pago y 1 sin clasificar |
| Entrantes / salientes del bot / salientes humanos | 59 / 49 / 20 |
| Resueltas por el bot (9 familias reales) | **0 sí**, 1 parcial (`5af7d51f`), 4 no, 4 mal. **0 %** de resolución completa |
| Conversaciones donde Milena tuvo que intervenir | 6 de 10 (60 %) |
| Primera respuesta = consentimiento | 10 de 10; 5 sobre un comprobante |
| Opt-in: sí / no / ignorado | 5 / 2 / 3; **2 de los 5 sí terminaron en STOP** a los 12–20 s |
| Escalaciones | 2, ambas `llm_error` (ninguna pedida); 1 pedido de persona sin escalar |
| Terminaron con una persona | 6 (Milena las respondió desde su celular) |
| Tiempo de respuesta (mediana / máx.) | consentimiento 4 s / 5 s · texto LLM 6 s / 24 s · estado de pagos 38 s / 269 s · info de escuela 56 s / 73 s · medios de pago 17 s / 20 s |
| Comprobantes y adjuntos sin desenlace | **15** `pending` en `whatsapp_inbound_queue` (10 de familias, 3 de un contacto personal, 1 del desarrollador, 1 hoja de matrícula). 0 procesados desde el 05-oct 22:18 |
| Borradores | 0 pendientes (321 `expired` del 03-oct, de cuando estaba en modo asistido o apagado) |

---

## 5. Lista para implementar (en orden)

1. P1: cron de la cola + vencimiento de `pending` + alerta.
2. P6 + §0.1: acuse por `deliver`, después de `debeAtender`, con texto veraz.
3. P2: el consentimiento sale del frente (solo se lee la respuesta; la pregunta va al final de un turno resuelto).
4. P3: reconocer el comprobante anunciado (precargado de `/p/:token` + genérico) y pasarle la pista del cobro al worker.
5. P4: silencio si hubo un saliente humano en los últimos 15 min.
6. P5: debounce de 8–25 s y lock por conversación.
7. P9 + §0.4/§0.5: vocativo a Milena y pedido de persona → buzón determinista.
8. P8: texto de confirmación del opt-in sin «escribe STOP»; doble chequeo de un STOP a menos de 60 s.
9. P7: «ya pagué» → estado del comprobante antes que la deuda.
10. P10: falla del modelo ≠ escalación; revisar Gemini.
11. P12, P13, P14, P11, P15.
