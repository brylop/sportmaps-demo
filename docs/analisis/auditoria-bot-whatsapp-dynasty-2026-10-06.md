# Auditoría técnica — bot de WhatsApp de Dynasty Volley Club (03 al 06-oct-2026)

- **Escuela:** DYNASTY VOLLEY CLUB · `school_id 2d509571-3238-4c04-ac3f-6dfe20539226` · `integration f50d6940-a994-4ea8-9a2c-bb99efd646c2`
- **Fuente:** base viva (solo `SELECT`), corte 2026-10-06 ~22:59 (hora Bogotá). Todas las horas son America/Bogota.
- **Teléfonos:** enmascarados, solo los últimos 4 dígitos (…0690). No se transcribe contenido de conversaciones personales.
- **Configuración vigente al corte:** `mode=auto`, `assisted_until=null`, `ai_enabled=true`, `responder_desconocidos=false`, `transcribir_audios=true` (última edición 06-oct 10:51).
- **Clasificación usada:** en `whatsapp_messages`, saliente con `ai_generated=true` = **bot** (incluye los avisos del job de desenlace); saliente con `ai_generated=false` = **eco Coexistence** (lo que la escuela escribe desde su celular; el 100 % trae `payload.to`). No hubo salientes desde el panel en el periodo.

## Resumen ejecutivo

- **El duplicado del aviso de pago fue el único origen sistemático de repetidos.** El 6-oct salieron 65 avisos de desenlace (21 pagos) cuando debían salir 21: **44 sobrantes** (41 «confirmó tu pago» + 4 «no lo pudo validar», menos el caso legítimo). Dos pagos salieron **×4** (09:34 y 10:24, en plena ventana de despliegues: instancia vieja + nueva del mismo BFF), uno **×6** (dos comprobantes del mismo pago). El último duplicado fue a las 22:32; ee64ef44 (22:40) lo corta con la reserva atómica. No queda otro origen multi-BFF en los mensajes del bot.
- **CRÍTICO nuevo: los BFF de dev/stg le escriben a familias reales.** 3 mensajes `familia_sin_cuenta` (09:39, 12:58, 14:16) llevaron enlaces **`https://dev.sportmaps.co/register?...`**. Los produce `whatsapp-queue.job` con el `FRONTEND_URL` del BFF que ganó el claim. Como la base es una sola, cualquier BFF procesa la cola de producción con su propio código, sus llaves y sus URL. El mismo caso (…4407) recibió «no tienes cuenta, se lo paso a la escuela» desde un BFF y, una hora después, «lo apliqué» desde otro.
- **El bot estuvo apagado 56 horas** (del 03-oct ~23:00 al 06-oct ~08:00): 0 salientes y 0 borradores. Entraron 520 mensajes. El 04 y el 05-oct, **42 de 56 turnos de familias (75 %)** no tuvieron ninguna respuesta (ni de la escuela) en 15 min. La cola de comprobantes tampoco corrió: **85 filas** se procesaron en lote («recuperado:») el 05-oct a las 14 h y el 06-oct a las 09 h, con 13 a 75 h de demora. Solo 28 de esas 85 filas tienen algún mensaje en el chat.
- **Avisos de pago que no llegaron:** 6 avisos fallaron en Meta con *Re-engagement message* (fuera de la ventana de 24 h). Eran 2 pagos aprobados el 05-oct, de comprobantes del 03-oct, avisados el 06-oct a las 08:48. El job no tiene plantilla de respaldo: el aviso queda marcado como enviado y **se pierde en silencio**.
- **Modelo:** de 08:09 a 08:40, 19 de 26 respuestas las dio Groq. Gemini, el primario, falló en ~73 % de los turnos. Entre 09:59 y 10:07 hubo **5 caídas al respaldo** (3 `llm_error_menu`, `info_escuela_fallback` y `medios_fallback`), más 2 `payment_fallback` en borradores. Desde las 10:18, con Claude primero, hubo 10 de 10 respuestas sin una sola caída.
- **Contactos personales:** el 6-oct el bot le escribió 10 veces en 3 min a …0690 (personal; ya conocido) y 24 veces a …3555, contacto marcado `personal` que es en realidad el número de prueba del equipo. Este último caso deja ver que la marca manual no tiene rastro de cuándo se puso. Además, **el texto de las conversaciones personales de la dueña queda guardado completo** en `whatsapp_messages` (entrantes + ecos): el bot no responde, pero la vida privada sí queda en la base.
- **Modo asistido (08:51–09:43):** dejó 38 borradores pendientes y 1 enviado en 19 conversaciones; 14 no tuvieron respuesta de nadie en 30 min. Efectos colaterales: 9 familias quedan con el consentimiento «ya preguntado» por un borrador que nunca vieron, y 1 comprobante (…9366) sigue en `waiting_user` desde las 09:31 por una pregunta que no salió.
- **Lo que sí está bien:** 0 envíos fallidos síncronos (ningún `local-*`). 0 montos errados: los 65 avisos de desenlace coinciden con `payments.amount`. 0 enlaces a localhost o stg desde el bot del webhook. Desde las 09:00 la cola procesa en ~1 min (p50). La regla «la escuela está escribiendo → el bot calla» funciona después de cebdb40e (09:18).

## 1. Volumen por día

| Día | Entrantes | Conv. con entrantes | Salientes del bot | Conv. con bot | Ecos de la escuela (Coexistence) | Borradores |
|---|---:|---:|---:|---:|---:|---:|
| 03-oct (sáb) | 265 | 47 | 26 | 20 | 92 (7 automáticos) | 231 (todos `expired`, 0 enviados) |
| 04-oct (dom) | 248 | 43 | **0** | 0 | 117 (7 automáticos) | 0 |
| 05-oct (lun) | 272 | 65 | **0** | 0 | 149 | 0 |
| 06-oct (mar) | **476** | 86 | **266** | 54 | 153 | 39 (38 pendientes + 1 enviado) |

- El pico del 6-oct (108 entrantes a las 08 h) coincide con el envío de **422 estados de cuenta por correo entre 08:06 y 08:22** (`email_sends`, sin duplicados por destinatario). El 05-oct salieron 304 a las 12:42–12:48.
- Distribución horaria del bot el 6-oct: 77 (08 h), 46 (09 h), 34 (10 h), 22 (11 h) y entre 2 y 21 por hora el resto del día. El lunes 06-oct a las 05:00–07:59 no hubo bot.
- Mensajes del bot por paso (6-oct): `resultado_paid` 59, `resultado_comprobante` 18, `ask_consent` 17, `llm_text` 16, `acuse_adjunto` 15, `get_payment_status` 14, `cortesia_ofrecer` 14, `ask_email` 14, `desconocido_tema_escolar` 12, `opt_in_registrado` 7, `sin_pendientes` 7, `resultado_rejected` 6, `no_es_comprobante` 6, `escalated` 6, y otros menores.

## 2. Envíos fallidos a Meta

| Causa (`error_detail`) | Mensajes | Pagos/contactos | Detalle |
|---|---:|---:|---|
| `Re-engagement message` (131047, fuera de la ventana de 24 h) | 6 | 2 pagos (…4773 familia, …5349 sin clasificar) | Los 6 son `resultado_paid` de las 08:48 del 6-oct, ×3 cada uno. Los comprobantes entraron el 03-oct, el pago se aprobó el 05-oct y el aviso salió el 06-oct: más de 24 h después del último entrante. |
| Fallo síncrono de Graph (`local-*`) | 0 | — | Ninguno en el periodo. |

Estado final de los 292 salientes del bot: 198 leídos, 82 entregados, 6 enviados sin confirmación de entrega y 6 fallidos.

**Problema de diseño:** el fallo 131047 llega **asíncrono** por el webhook de estados. `whatsapp-payment-outcome.job` ya marcó `outcome_notified_at` porque el envío síncrono dio `ok`, así que nadie reintenta ni manda una plantilla. La familia nunca se entera de que su pago quedó confirmado.

## 3. Fallos del modelo y caídas al respaldo (6-oct)

El 03-oct el modelo solo generó borradores (Groq 11 + 1, Gemini 6 + 3). El 04 y el 05-oct no hubo actividad.

| Franja | Proveedor que respondió | Respuestas | Lectura |
|---|---|---:|---|
| 08:09–08:40 | groq | 19 | Gemini (primario) falló y respondió Groq |
| 08:09–08:40 | gemini | 7 | |
| 09:02–09:27 (asistido) | groq 7 / gemini 1 | 8 borradores | igual patrón |
| 09:15–09:24 (asistido) | — (`payment_fallback`) | 2 borradores | todos los proveedores fallaron |
| **09:59–10:07** | — (`info_escuela_fallback` 1, `llm_error_menu` 3, `medios_fallback` 1) | **5** | Cadena entera caída. Coincide con el despliegue de 39732475 (Claude primero, 10:05); …4097 recibió el menú de error 2 veces en 68 s |
| 10:18–22:35 | claude | 10 | 0 caídas |

- La causa exacta de cada falla (429, 503, modelo inexistente) **no queda en la base**: `chatWithTools` solo la escribe en `console.warn`. Hay que buscarla en los logs de Render. Ver P1-5.
- La cola de comprobantes también dependía del modelo: los 21 comprobantes que entraron entre 08:00 y 08:54 acumularon **33 reintentos** y tardaron 35,8 min en p50 (máximo 100,7). Desde las 09:00, p50 ~0,7 min y 0 reintentos.

## 4. Silencios (familias que escribieron y nadie respondió en 15 min)

«Turno» = primer entrante de una conversación tras ≥ 15 min sin entrantes. Respuesta = cualquier saliente (bot o escuela).

| Periodo | Tipo de contacto | Turnos | Sin respuesta en 15 min | Causa |
|---|---|---:|---:|---|
| 04–05-oct (bot apagado) | familia | 56 | **42** | Bot apagado y cola sin correr |
| 04–05-oct | desconocido | 66 | 49 | ídem |
| 06-oct 08:00–22:59 | familia | 50 | **8** | ver detalle |
| 06-oct | familia_sin_cuenta | 4 | 1 | modo asistido |
| 06-oct | desconocido | 49 | 31 | `responder_desconocidos=false` desde las 10:51 (por diseño) |
| 06-oct | sin clasificar | 3 | 3 | entrantes `unsupported` (Meta no entrega el contenido) |

Detalle de los 9 de familia/familia_sin_cuenta del 6-oct:

| Hora | Tel. | Qué mandó | Primera respuesta | Causa probable |
|---|---|---|---|---|
| 08:00 | …0047 | comprobante | 08:18 | El bot arrancó ~08:08 y la cola estaba en reintentos (OCR) |
| 08:33 | …7470 | comprobante | 09:01 | Cola en reintentos (67 min hasta cerrarse la fila) |
| 08:57 | …9177 | texto + audio | nunca | Modo asistido: quedó en borrador |
| 09:04 | …7470 | texto | nunca | Modo asistido |
| 09:07 | …8673 | «Hola» | nunca | Modo asistido |
| 09:09 | …7664 | texto | 10:12 | Modo asistido |
| 09:22 | …3494 | pregunta por medios de pago | nunca | Modo asistido |
| 09:33 | …7251 | audio | 10:11 (escuela) | Modo asistido |
| 10:12 | …7251 | audio | 11:54 | **Correcto:** la escuela le había escrito a las 10:11 (P4, el bot calla) |

Fuera del modo asistido y del arranque, el bot no dejó silencios de familia.

## 5. Duplicados: salientes del bot repetidos en la misma conversación en menos de 10 min

Mismo texto y mismo tipo, misma conversación. Del 03 al 05-oct: **0**. El 6-oct:

| Paso | Repetidos | En < 5 s | Primera / última | Origen |
|---|---:|---:|---|---|
| `resultado_paid` | **41** | 40 | 08:48 / 22:32 | Job de desenlace corriendo en los 3 BFF (×3), ×4 durante despliegues (09:34 …3419, 10:24 …0030), ×6 con 2 comprobantes de un pago (…5967). **Arreglado** en ee64ef44 (22:40) |
| `resultado_rejected` | **4** | 4 | 10:22 / 16:21 | Mismo origen (…7664, …4407 ×3) |
| `ask_email` | 9 | 4 | 08:10 / 08:12 | …0690 (personal): un saludo por cada mensaje de la ráfaga, 10 en 3 min. Origen distinto: **no hay tope de repetición** para el saludo de identificación |
| `ask_cual_pago_reintento` | 2 | 0 | 19:17 / 19:18 | …5967: dos fotos distintas, la misma pregunta dos veces (legítimo, aunque ruidoso) |
| `acuse_adjunto` | 2 | 0 | 10:22 / 21:08 | Adjuntos separados por más de 2 min (legítimo) |
| `llm_error_menu` | 1 | 0 | 10:07 | …4097: menú de error dos veces en 68 s (caída del modelo) |
| `cortesia_elegir_franja` | 1 | 0 | 16:52 | …0001: re-pregunta tras respuesta no reconocida (legítimo) |
| `resultado_comprobante` | 1 | 0 | 19:19 | …5967: dos comprobantes aplicados al mismo cobro (legítimo) |

**Conclusión:** de 61 repetidos, 45 vienen del job de desenlace (ya arreglado) y 9 del saludo `ask_email`, que se repite sin tope en una ráfaga. El resto son re-preguntas legítimas. No aparece otro proceso duplicado.

**Lo que el arreglo de ee64ef44 no cubre:** si `sendTextMessage` falla de forma síncrona, el job libera la reserva y reintenta **cada minuto, sin límite de intentos**.

## 6. Respuestas malas

### 6.1 Mensajes del bot a contactos `personal` (CRÍTICO)

| Día | Tel. | Mensajes del bot | Pasos | Nota |
|---|---|---:|---|---|
| 03-oct | …0690 | 4 | `pide_identificacion` (18:33–22:42) | Contacto privado de la dueña |
| 03-oct | …8802 | 1 | `pide_identificacion` (08:19) | Contacto privado (familiar) |
| 06-oct | …0690 | **10** | `ask_email` (08:09–08:12) | Incidente conocido (responder_desconocidos prendido) |
| 06-oct | …3555 | **24** | consentimiento, pagos, cortesía, escalado, `llm_error_menu` (08:08–19:31) | Número de pruebas del equipo marcado `personal`. Que reciba bot hasta las 19:31 indica que la marca se puso después, y no hay forma de saber cuándo: `whatsapp_conversations` no guarda historial de `contact_kind` |

Además, entre las 08:00 y las 08:59 del 6-oct el bot habló **encima de la escuela** 29 veces: mensajes del bot con un eco humano en los 10 min anteriores (`llm_text` 8, `get_payment_status` 6, `ask_consent` 4, `ask_email` 3…). Después de cebdb40e (09:18) quedan 2 casos (10 h y 15 h).

**Privacidad:** las conversaciones personales (…0690, …8802 y otras 5 marcadas `personal`) se guardan completas, texto y adjuntos, en `whatsapp_messages`: entrantes y ecos. Del 04 al 05-oct fueron 36 turnos personales. El bot ya no responde, pero el dato queda guardado.

### 6.2 Pedir correo o identidad a quien ya está identificado

- `ask_email` (6-oct): 14 envíos, ninguno a una conversación identificada (10 a …0690 y 4 a desconocidos).
- `pide_identificacion` (03-oct): 3 envíos a conversaciones hoy identificadas (…0280, …7508, …3533). Quedaron identificadas después, así que no es un error seguro.
- **…5967 (familia):** el bot respondió «No reconozco este número entre las familias». La madre dice que siempre escribe desde ese número, así que el teléfono no está en la ficha. Después hizo falta pedir el **OTP 3 veces** (a dos correos distintos) porque «no nos ha llegado el código». Los OTP no dejan rastro en `email_sends` y no hay forma de auditar si salieron.
- **…4407 y …9707 (familia):** recibieron `debe_registrarse` y `familia_sin_cuenta`, y más tarde el comprobante se aplicó normal. Las dos cosas son coherentes con «ficha sin cuenta», pero el mensaje de la cola salió del BFF de dev (ver 6.4).

### 6.3 «No puedo escuchar notas de voz»

| Día | Audios entrantes | De familia | Transcritos | «No puedo escuchar» | A familias **sin** opt-in |
|---|---:|---:|---:|---:|---:|
| 03-oct | 7 | 2 | 0 | 0 (7 borradores `tipo_no_soportado_audio`) | — |
| 04/05-oct | 22 | 2 | 0 | 0 (bot apagado) | — |
| 06-oct | 25 | 8 | **3** | **4** (…1621 08:13, …1822 11:23, …7251 11:55 y 13:06) | **4 de 4** |

Las 4 negativas fueron a familias sin consentimiento, que la transcripción exige. Hay dos problemas. El bot le dice a la familia que no escucha audios **antes** de ofrecerle el consentimiento que lo habilitaría (…1621 lo rechazó dos minutos después). Y …7251 recibió la negativa dos veces el mismo día. Desde 306868ba (09:31), 3 audios se transcribieron.

### 6.4 Enlaces equivocados

| Host | Mensajes | Paso | Origen |
|---|---:|---|---|
| **`dev.sportmaps.co`** | **3** (…4827 09:39, …9707 12:58, …4407 14:16) | `familia_sin_cuenta` | `whatsapp-queue.job.ts:962` (`FRONTEND_URL` del BFF que tomó la fila) |
| localhost / stg | 0 | — | — |
| `app.sportmaps.co/register?...&email=...` | 4 | `debe_registrarse` | Correcto, pero lleva el **correo en la URL** |

### 6.5 Montos

Se cruzaron los 65 avisos de desenlace (`payload.payment_id`) contra `payments.amount`: **0 diferencias**. Hay dos casos para revisar del lado del dato, no del bot. …5967 aparece con septiembre pendiente aunque la familia dice que lo pagó por este canal el 05-sep. …9707 recibió «ese comprobante ya lo había recibido (10/2026)» mientras reclamaba septiembre.

## 7. Cola de comprobantes (`whatsapp_inbound_queue`)

| Creada | Estado / resultado | Filas | Demora p50 | Demora máx. | Nota |
|---|---|---:|---:|---:|---|
| 03-oct | done / payment_receipt | 6 | 36 h | 75 h | 3 recuperadas en lote |
| 03-oct | ignored (escalated + none) | 22 | 40–70 h | 72 h | |
| 03-oct | **failed** | 1 | 12 min | — | «no se entendió la elección; va al inbox» |
| 04-oct | done / ignored | 5 / 21 | 27 h / 28–46 h | 49 h | **todas** recuperadas en lote |
| 05-oct | done / ignored | 6 / 20 | 15 h / 6–17 h | 25 h | **todas** recuperadas en lote |
| 06-oct 08 h | 21 filas | — | **35,8 min** | 100,7 min | 33 reintentos (OCR o modelo fallando) |
| 06-oct 09–22 h | 41 filas | — | 0,4–1,3 min | 3,5 min | sano |
| 06-oct | **waiting_user** | 1 (…9366) | — | 13 h y contando | La pregunta (`ask_cual_pago_reintento`) quedó en **borrador** en modo asistido; la fila no vence (`vencida_at` null) |

- **85 filas** procesadas en lote con el prefijo `recuperado:` (el 05-oct a las 14 h y el 06-oct a las 09 h). Solo 28 tienen algún mensaje en el chat. Las otras 57 se cerraron (sin pendientes, ya registrado, no es comprobante, varios cobros…) **sin decirle nada a la familia**.
- Motivos de `ignored`: no es comprobante 30, contacto no atendido (personal) 17, sin familia 9, sin pendientes 10, `familia_sin_cuenta` 6, varios cobros 7, ya registrado 15, monto distinto 5, destino ajeno 3.

## 8. Borradores

| Día | Franja | Creados | Enviados | Estado | Conversaciones |
|---|---|---:|---:|---|---:|
| 03-oct | 00:11–22:14 | 231 | 0 | todos `expired` (161 `ask_email`, 16 `ask_consent`, 15 `debe_registrarse`, 21 del modelo…) | — |
| 06-oct | 08:51–09:43 | 39 | 1 | **38 `pending` huérfanos** (9 `ask_consent`, 8 `debe_registrarse`, 7 del modelo, 3 audio, 2 `payment_fallback`…) | 19 |

- De los 38 huérfanos, 24 tuvieron alguna respuesta posterior (bot o escuela) en menos de 30 min y 14 no.
- Siguen `pending` aunque la conversación siguió: `descartarBorradoresViejos` solo corre cuando el bot envía en esa misma conversación.
- 161 borradores `ask_email` en un solo día (03-oct) muestran que el saludo de identificación salía por cada mensaje, incluso a la vida privada de la dueña.

## 9. Consentimiento (opt-in)

| Métrica | Valor |
|---|---:|
| Preguntas enviadas (`ask_consent`) | 17 (17 conversaciones, 1 vez cada una) |
| Preguntas en borrador que nunca salieron | 9 conversaciones (cuentan como «ya preguntado» → no se vuelve a preguntar) |
| Aceptaron («Sí, acepto») | 7 (`whatsapp_optins.user_confirmed`; 1 es el número de pruebas …3555) |
| Rechazaron («No, gracias») | 4 (no se guardan en `whatsapp_optins`; solo quedan en los mensajes) |
| Sin respuesta | 6 |
| Bajas (BAJA/STOP) | 2 mensajes `opt_out_confirmado`, 1 fila `baja_directa` |
| Opt-in previos al 6-oct | 0 |

Aceptó el 41 % de los que recibieron la pregunta y el 27 % de las familias a las que «se les preguntó» (contando los borradores).

## Arreglos priorizados

### P0 (antes de volver a operar con normalidad)

1. **Los jobs de WhatsApp solo en producción.** `bff/src/jobs/maintenance.job.ts` (crons de `runWhatsAppQueue`, `runWhatsAppPaymentOutcome` y el plazo de acuse): exigir una variable positiva (`WHATSAPP_JOBS_ENABLED=true`, solo en el BFF de prod) en lugar del kill-switch negativo `DISABLE_WHATSAPP_QUEUE_CRON`. Hoy dev y stg procesan la cola real con su propio código, sus URL (`dev.sportmaps.co`) y sus llaves de modelo. Mientras tanto, poner `DISABLE_WHATSAPP_QUEUE_CRON=true` en dev y stg.
2. **Enlaces con host fijo de producción** para todo lo que sale por el número de una escuela real: `whatsapp-queue.job.ts:962` y `whatsapp-bot.service.ts:969` (`FRONTEND_URL`). Usar un `WHATSAPP_PUBLIC_APP_URL` que falle cerrado si apunta a dev o stg con una integración real.
3. **No guardar ni procesar el contenido de contactos `personal`.** `whatsapp-coexistence.service.ts` (`procesarEchos`) y la ingesta de entrantes en `routes/whatsapp.ts` (`processInboundMessage`): para `contact_kind='personal'`, guardar solo metadatos (tipo y hora) y no `text_body`, `payload.text` ni media. Y purgar lo ya guardado (decisión del usuario).

### P1

4. **Desenlace fuera de la ventana de 24 h.** `jobs/whatsapp-payment-outcome.job.ts`: antes de enviar, mirar `whatsapp_conversations.last_inbound_at`; si pasaron más de 24 h, mandar plantilla aprobada (`whatsapp-plantillas.service.ts`). Y cuando el webhook de estados (`routes/whatsapp.ts`, `procesarEstados`) reciba 131047 sobre un `resultado_*`, liberar `outcome_notified_at` para reintentar con plantilla. Hoy se perdieron 2 avisos de pago.
5. **Tope de reintentos en el desenlace.** Mismo job: contador o `outcome_intentos` para que un fallo síncrono permanente no reenvíe cada minuto para siempre.
6. **Guardar la causa de las fallas del modelo.** `services/llm.service.ts` (`chatWithTools`): persistir `fallas[]` (proveedor, código, latencia) en `payload.llm_fallas` del saliente o en una tabla de métricas. Hoy los 5 respaldos de 09:59–10:07 solo se pueden explicar con los logs de Render.
7. **Tope al saludo de identificación.** `whatsapp-bot.service.ts` (camino de `ask_email` / `pide_identificacion`): una vez por ráfaga o cada 10 min por conversación, como ya hace `VENTANA_REPETICION_MS` en notas de voz. Fueron 10 en 3 min a un contacto y 161 borradores en un día.
8. **Lo que el modo asistido deja colgado:** (a) `yaSePreguntoConsentimiento` en `whatsapp-bot.service.ts` no debe contar borradores no enviados (9 familias quedaron sin pregunta); (b) `whatsapp-queue.job.ts`: una fila `waiting_user` cuya pregunta quedó en borrador debe vencer (`vencida_at`) o volver al buzón (…9366, 13 h); (c) expirar los borradores `pending` cuando la escuela responde por eco o pasan más de 2 h.
9. **Las recuperaciones en lote deben avisar.** `services/whatsapp-recuperacion.service.ts`: 57 de 85 filas se cerraron sin mensaje a la familia. Como mínimo, dejar el caso en el buzón con el motivo, y hablarle a la familia solo si sigue dentro de la ventana de 24 h.
10. **Audio antes del consentimiento.** `whatsapp-notas-de-voz.service.ts` (rama `!transcribible` con tipo de familia y sin opt-in): ofrecer el consentimiento en lugar de «No puedo escuchar», o decirlo una sola vez por día. Hubo 4 de 4 casos a familias sin opt-in, uno de ellos repetido.

### P2

11. **Historial de `contact_kind`:** quién lo cambió y cuándo (`whatsapp-atencion.service.ts`, marca manual desde el buzón). Sin él no se puede saber si el bot violó la marca (…3555).
12. **Sacar el correo de la URL de registro** (`whatsapp-bot.service.ts:1293`, `whatsapp-queue.job.ts:975`): pasar por el `invite_id` solamente.
13. **Registrar los OTP** en `email_sends` (o equivalente) para poder auditar «no me llegó el código» (…5967 lo pidió 3 veces).
14. **Clasificar las 44 conversaciones con `contact_kind` null** (15 identificadas). Recibieron avisos de pago (…5349) sin tipo.
15. **Alerta de «bot mudo»:** si hay más de N entrantes de familia en horario y 0 salientes ni borradores en 2 h, avisar (Sentry, correo). Habría detectado las 56 h del 04 y 05-oct.
