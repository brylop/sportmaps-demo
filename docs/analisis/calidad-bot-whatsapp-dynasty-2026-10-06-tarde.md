# Calidad del bot de WhatsApp — Dynasty, 2026-10-06 (día completo)

Alcance: DYNASTY VOLLEY CLUB (`2d509571-…`), integración `f50d6940-…`. Conversaciones completas del 06-oct
(00:00–23:59 COT) en `whatsapp_messages`, con los ecos de la escuela (`ai_generated=false`), más
`whatsapp_inbound_queue`, `whatsapp_settings`, `school_signup_leads` y `trial_class_bookings`. Solo SELECT.
Conversaciones citadas por los 8 primeros caracteres del id, teléfonos por los últimos 4, atletas como `[atleta]`.

Complementa el análisis de la mañana (`whatsapp-conversaciones-dynasty-2026-10-06.md`, corte 08:45). La auditoría
técnica (envíos fallidos, proveedores, duplicados, cola) es de otro agente; aquí solo se mira la experiencia.

**Qué bot estuvo vivo.** Por los `step` que aparecen, entre ~09:30 y ~11:30 se desplegó lo commiteado en la mañana
(`cebdb40e` … `b2bee642`): consentimiento al final, acuse registrado (`acuse_adjunto`), silencio por humano (P4),
`mensaje_para_persona`, `estado_comprobantes`, cortesía con botones, prospectos, transcripción de audios. Desde
~12:00 hasta 22:30 los deploys fallaron, así que **lo que se commiteó a las 22:14–22:48** (`ee64ef44` duplicados,
`57b9c80e` ajustes por escuela, `00ff7855` precios) y lo que está **sin commitear** en `whatsapp-queue.job.ts`
(adjunto que no es comprobante) **no corrió**. Ajustes vivos al cierre: `ai_enabled=true`, `mode=auto`,
`transcribir_audios=true`, `responder_desconocidos=false` (cambiado 10:51).

---

## Resumen ejecutivo

- **El bot mejoró mucho respecto a la mañana, sobre todo con comprobantes.** De 0 % de resolución (9 familias,
  08:08–08:45) se pasó a **30 % resueltas por el bot** sobre 50 conversaciones donde habló (15), y en el flujo
  «mando la foto del comprobante» el camino feliz ya funciona: acuse en ~6 s, «lo apliqué a *Mensualidad 10/2026 –
  [atleta]*», y aviso cuando la escuela aprueba. Ya no hubo consentimiento antes del trámite, ni «STOP» por error,
  ni escalaciones por falla del modelo.
- **Lo peor del día: comprobantes de OTRA cosa aplicados a la mensualidad.** Clase de perfeccionamiento (`bd8bd4d3`)
  y uniformes (`0a55af2d`) pagados al Nequi de Milena se aplicaron a «Mensualidad $180.000», la escuela los rechazó
  y la familia recibió **3 rechazos idénticos**; un papá terminó escribiendo «me han llegado varios mensajes… que
  no han podido validar el pago». El pie de foto decía «Clase perfeccionamiento» y el texto «mira aquí lo de los
  uniformes». Sigue abierto en develop.
- **La clase de cortesía no convirtió: 0 reservas** (`trial_class_bookings` = 0) con 16 leads registrados. La lista
  pagina de a 2 franjas («Ver más horarios» tocado hasta 7 veces en `08f08f59`), no filtra por edad ni género
  (a una niña de 12 y a un adulto les ofrece «MENORES MASCULINO»), ofrece franjas que ya pasaron, y atrapa:
  «Necesito hablar con un asesor» y «No sabemos en qué categoría quedaría ella» reciben «Toca la franja que
  prefieras». Sigue abierto en develop.
- **Escalar no es atender.** 3 escalaciones de la tarde quedaron sin respuesta humana en el día, una urgente
  (`62db6756`: «Estamos varios en Colibrí y no han llegado a dar la clase»). Además 16 conversaciones con tema de
  la escuela no recibieron respuesta de nadie (5 prospectos y 6 comprobantes desde números no registrados).
- **Ruido que erosiona la confianza:** «¡Listo! La escuela confirmó tu pago» llegó ×3 a ×6 (65 mensajes para 20
  avisos; corregido en develop `ee64ef44`, no desplegado), dos respuestas del modelo filtraron el texto interno
  **«Llamando escalate_to_human»** (`1bee1bba`, `8a12267e`; abierto en develop), y a familias sin cuenta se les
  mandó un enlace a **dev.sportmaps.co** (abierto en develop).
- **Se habló con contactos personales:** «Amor, un favor urgente» (`9f989171`) y un chiste de un amigo (`58ec1a91`)
  recibieron «escríbeme tu correo»; a `a04e9af6` le llegaron 10 seguidos a las 08:10. Desde las 10:51
  (`responder_desconocidos=false`) dejó de pasar.
- **Tono:** se presenta bien como «asistente automático», los textos deterministas son claros y sin voseo. Lo
  robótico está en las repeticiones («Toca la franja…» ×2, «¿a cuál cobro?» ×3), en «yo no veo las imágenes, los
  archivos los revisa otro sistema» y en los mensajes encadenados a familias sin cuenta (3 en 34 s con 2 enlaces).

---

## 1. Clasificación

Universo A: **50 conversaciones donde el bot habló** con una persona real (se excluyen la del desarrollador
`abe50cda`, el contacto personal `a04e9af6` de las 08:10, y `f99d8d96`/`ac466bae`, que solo tienen avisos fallidos).

| Resultado | Conversaciones | % de 50 | % de 66 (con las sin respuesta) |
|---|---|---|---|
| RESUELTA bot | 15 | 30 % | 23 % |
| RESUELTA Milena (el bot no aportó o estorbó) | 9 | 18 % | 14 % |
| A MEDIAS | 14 | 28 % | 21 % |
| MAL | 12 | 24 % | 18 % |
| SIN RESPUESTA (nadie contestó; tema de la escuela) | — | — | 16 → 24 % |

Universo B: **16 conversaciones con tema de la escuela donde no respondió nadie** (ni bot ni Milena): 5 prospectos
(`13f865d0`, `b74c098f`, `fad89313`, `a8bb7eb2`, `1b59fea3`), 5 comprobantes desde números no registrados que la cola
marcó `ignored` sin decir nada (`1a6a8b29`, `357634bd`, `acebeca8`, `43e7d2f7`, y `a60fdf00` con el texto precargado),
3 familias (`f3b4a8fe` «dónde te puedo consignar lo del refuerzo», `ffdd9c29` «tengo una consulta» + audio,
`b4a11671` «Hola»), `82010b8d` («[atleta] ya salió») y 2 audios de desconocidos (`61c37670`, `4b4050b5`).

Otras métricas:

| Métrica | Mañana (08:08–08:45) | Resto del día |
|---|---|---|
| Primera respuesta = consentimiento | 10 de 10 | 0 (siempre «Una cosa más 🙂…» al final) |
| Opt-in que terminaron en STOP | 2 de 5 | 0 de 2 (texto nuevo: «me escribes *BAJA*») |
| Escalaciones por `llm_error` | 2 de 2 | 0 (ahora `llm_error_menu`, 3 veces) |
| Respuesta con modelo, mediana / máx. | 38 s / 269 s (estado de pagos) | **22 s / 27 s** |
| Respuesta determinista, mediana | 4 s | 6 s |
| Avisos de resultado de comprobante | — | 65 enviados para 20 avisos distintos (45 duplicados; 6 fallidos) |
| Leads / reservas de cortesía | — | 16 / **0** |

---

## 2. Tabla por conversación

Abreviaturas: B = RESUELTA bot · M = RESUELTA Milena · AM = A MEDIAS · MAL · Msj = entrantes/bot/humano del día.

| Conv (tel) | Qué quería | Qué pasó | Msj | Milena | Frustración / choque | Clase |
|---|---|---|---|---|---|---|
| `8f9e500b` (…0047) | Mensualidad + torneo | Mañana: 5 estados de pago encima de Milena. 08:57 «no tienes cobros pendientes» | 12/9/8 | Sí, resolvió | Bot contradijo a Milena | M |
| `0cb83075` (…1621) | Cobro de atleta que no va | «No puedo escuchar notas de voz», consentimiento, y 08:57 «no es un comprobante… si es el código QR…» a un correo de cobro | 4/4/1 | «Ok ya mismo» | Sí | M |
| `a7438e6b` (…0640) | Reflejar pago (correo de cobro) | Consentimiento encima de Milena; «¡De nada!…»; «no es un comprobante» 30 min después | 4/4/2 | Sí | Bot estorbó | M |
| `e9ed4b64` (…0680) | «La transferencia fue el 4 de sep» | Escalación falsa, deuda listada; luego aplicado y ×3 «confirmó tu pago» | 9/12/3 | Sí | Sí | M |
| `5af7d51f` (…0359) | «No aparece el pago» | Mañana: deuda + STOP. 09:12 comprobante aplicado, ×3 pagado. Tarde: «Hola Milena / ¿llegó la camiseta?» → «Le dejo tu mensaje a Milena» | 9/10/0 | No | Al inicio | B |
| `2ddd46fd` (…5016) | Comprobante; tarde: «¿está confirmado el entreno de hoy en cancha externa?» | Pago aplicado y aprobado (×3). Tarde: saludo genérico + «eso no lo tengo a la mano, ¿de qué grupo?», sin escalar | 6/9/1 | Solo en la mañana | — | AM |
| `355bebed` (…4207) | Comprobante (texto precargado) | Consentimiento primero (mañana); aplicado 09:01; ×3 pagado | 2/5/0 | No | — | B |
| `e9e185ce` (…9406) | Comprobante (precargado) | Igual | 3/6/0 | No | — | B |
| `ac209e73` (…2448) | Comprobante | Sí → STOP a los 20 s (mañana); luego «Activar»; aplicado y ×3 pagado | 5/7/0 | No | — | B |
| `ab531aba` (…0120, desconocido) | «Mile, envío pago mes de octubre» + foto | `ask_email`; la foto quedó `ignored` sin respuesta | 2/1/0 | No | — | MAL |
| `791df5d5` (…7470) | Hoja de matrícula con pie | «Recibí tu comprobante, pero no tienes cobros pendientes» → «Pues me aparecía ayer… no entendí jaja» | 3/1/0 | No | Confusión | AM |
| `3cf99ed8` (…2361) | Comprobante | «No tienes cobros pendientes» (ya aprobado a mano) | 1/1/0 | No | — | B |
| `d36b045d` (…5425) | Soportes sept + oct | «No tienes cobros pendientes» → «Muchas gracias Milena, quedamos al día» | 4/1/0 | No | — | B |
| `b6f91bd7` (…5153) | Soporte octubre | «No tienes cobros pendientes» | 2/1/0 | No | — | B |
| `545a5ca5` (…9206) | Captura «me aparece así» | «No es un comprobante… si es el código QR…» → «me parece raro»; el modelo: «yo no veo las imágenes, los revisa otro sistema… estás al día» → estado de comprobantes | 6/3/0 | No | Sí, luego «Okey» | B |
| `be16324e` (…3923) | Comprobante PDF | Aplicado en 41 s; ×3 pagado | 3/4/0 | No | — | B |
| `c745627b` (…3419) | Comprobante (precargado en el pie) | Aplicado; ×4 pagado | 1/5/0 | No | — | B |
| `8d07cf75` (…0546) | «Comprobante… para pasar a 3 días a la semana» | «¿A cuál cobro?» (Agosto / Oct) → «2» → sin confirmación; ×3 pagado. «Respecto al otro yo ya había realizado el pago» sin respuesta | 6/4/0 | No | — | AM |
| `ede406da` (…9366) | «Pago de septiembre y octubre de una vez» | «¿A cuál cobro?» → «De sep y oct» → solo la pregunta de consentimiento (texto viejo con STOP). Fila `waiting_user` colgada | 3/2/0 | No | — | MAL |
| `bd8bd4d3` (…7664) | Pagar «clase de perfeccionamiento» | Milena: «a mi nequi». Foto con pie «Clase perfeccionamiento [atleta]» → aplicada a Mensualidad $180.000 → **3 rechazos** | 7/4/3 | Sí | Sí | MAL |
| `c88b1f42` (…5348, desconocido) | Nequi para clases | Milena «Sii a mi nequi» 10:12:57; bot 10:12:59 «no reconozco este número, escríbeme el correo» | 6/1/5 | Sí | Bot habló 2 s después de Milena | M |
| `79d95e07` (…7251) | Charla por audios con Milena | «No puedo leer ese formato», «No puedo escuchar notas de voz» ×2 en medio de los audios | 5/3/2 | Sí | Ruido | M |
| `4571d67f` (…4827, desconocido) | «Llevo meses sin asistir, ¿por qué me cobran?» + captura del correo | «Recibí tu comprobante… crea tu cuenta» (enlace dev) | 11/1/1 | «Ya te desactivo» | Sí | M |
| `8a12267e` (…0587) | Comprobante; luego «consigné 180000» | Aplicado a 150.000 y aprobado; «hay una diferencia de $30.000… le paso tu caso» **+ «Llamando escalate_to_human»**; nadie respondió | 3/5/0 | No | — | AM |
| `46201572` (…3827) | Atleta: «¿puedo volver a entrenar solo los martes?» | Plantilla de prospecto: enlace de inscripción + franjas de cortesía | 1/1/0 | No | — | MAL |
| `d330498f` (…1958) | Dirección de la cancha Nido del Colibrí | «Le dejo tu mensaje a la escuela» + bloque de 30 líneas de horarios **sin la dirección** | 4/2/0 | No | — | MAL |
| `a9ab72ed` (…4097) | «¿Eres Milena?», pegó el texto de cobro de Milena (Nequi), comprobante | «Le dejo tu mensaje»; «Hola» → «No logré entender 😅» con menú ×2; medios Bre-B (no el Nequi que dijo Milena); aplicado y ×3 pagado | 7/11/0 | No | Algo | B |
| `589fc6a3` (…0030) | Dos comprobantes | Aplicado el primero; el segundo «no tienes cobros pendientes»; ×4 pagado | 3/10/0 | No | — | B |
| `b23a010e` (…0119, prospecto) | Info, hija de 14 años | Respuesta 2 h después (repesca 11:27): enlace + 2 franjas (incl. MENORES MASCULINO) | 3/1/0 | No | — | AM |
| `a379d64e` (…3689, prospecto) | Horarios para visitar | Respuesta 55 min después: enlace + franjas | 1/1/0 | No | — | AM |
| `cc877c2d` (…7711, prospecto adulto) | Curso para adultos, costos y días | 10:52 «escríbeme tu correo»; 11:28 enlace + franjas de menores; «Ver más» ×3; «Necesito hablar con un asesor» → «Toca la franja que prefieras» | 12/6/0 | No | Sí | MAL |
| `58ec1a91` (…9083, amigo) | Chiste personal | «Escríbeme el correo…» | 1/1/1 | Audio | — | MAL |
| `9f989171` (…4018, pareja) | «Amor, un favor urgente» | «Escríbeme el correo…» | 18/1/5 | Sí | — | MAL |
| `0af1031a` (…1822, sin cuenta) | «Hola Milena» + reclamo de septiembre ya pagado + video + audio | «Crea tu cuenta» al saludo; «No puedo ver videos»; «No puedo escuchar notas» | 12/3/3 | «Ya lo registré» | Sí | M |
| `08f08f59` (…3806, prospecto) | Precio y horarios para niña de 12 | Enlace + franjas; «Ver más horarios» ×7 (11:25–18:10) de a 2; nunca reservó; no le dio el precio | 9/8/0 | No | Sí | MAL |
| `356ff67d` (…7926, prospecto) | Precio, horarios, edad (del 05-oct) | Repesca 11:27 un día tarde; «Ver más» | 1/2/0 | No | — | AM |
| `f310c110` (…0001, prospecto) | Agendar cortesía (pedida desde el 02-oct) | Repesca; «Somos nuevos» → «Toca la franja…»; «No sabemos en qué categoría» → «Toca la franja…»; toca «Mar 4:00 pm» a las 16:53 → «ya no está disponible» | 4/5/0 | No | Sí | MAL |
| `f0091777` (…5874, prospecto) | Inscribirse (05-oct) | Repesca 11:27, sin seguimiento | 0/1/0 | No | — | AM |
| `be939a54` (…2604, sin cuenta) | «Me llegó un correo de deuda pero mi hija ya no entrena» | «Tu número está registrado… crea tu cuenta» | 4/1/0 | No | — | MAL |
| `32439037` (…9707, sin cuenta) | «Septiembre está pago» + PDF; noche: «La de septiembre aparece que debo pero ya pagué» | Mediodía: 3 mensajes en 34 s (crear cuenta, acuse, «se lo paso a la escuela» con enlace dev). Noche: «ese comprobante ya lo había recibido», estado de comprobantes, aplicado a 09/2026, aprobado (×3), «Excelente gracias» → «¡Con gusto!…» | 10/14/0 | No | — | B |
| `291fcff0` (…8488, sin cuenta) | 2 pagos de torneo + mensualidad | Acuse «comprobante» → «se lo paso a la escuela»; 2.ª foto sin acuse; 3.ª «Recibí tu archivo» | 3/3/0 | No | — | AM |
| `0a55af2d` (…4407) | Comprobante octubre, precio de uniformes, pago de uniformes | Acuse + «se lo paso» (dev) + «crea tu cuenta» (app): 3 msj; uniformes los respondió Milena 50 min después; la foto de uniformes se aplicó a Mensualidad $180.000 → **3 rechazos** → reclamo → «¡Gracias! Mándame la foto…» → «no tienes cobros pendientes» | 8/11/5 | Sí | **Alta** | MAL |
| `b4b78216` (…8038) | Comprobante PDF | Acuse, aplicado, ×3 pagado | 1/6/0 | No | — | B |
| `62db6756` (…0280) | «Estamos varios en Colibrí y no han llegado a dar la clase» | «Te escribe el asistente, no Milena… ¿qué necesitas?» y 16 s después «Voy a pasar tu caso…». Nadie respondió en el día | 2/2/0 | No | Urgente | AM |
| `07e2d02a` (…9286, prospecto) | «Mi hijo va a volver a entrenar, ¿costos?» | Enlace + franjas | 1/1/0 | No | — | AM |
| `1bee1bba` (…5967) | «Nos aparecen dos meses; septiembre lo pagamos el 5-sep» | Número no registrado → OTP: 3 correos, el 1.º no llegó; verificó en 10 min. Deuda listada + **«Llamando escalate_to_human»**; «¿a cuál cobro?» ×3 (una tras «Perfecto, muchas gracias»); aplicado a 09/2026 dos veces; ×6 «confirmó tu pago» | 20/20/0 | No | Sí | AM |
| `083e533b` (…3797) | ¿Puedo pagar en efectivo el entrenamiento de posicionamiento de mañana? | «Tranquilo/a…» + todos los medios de pago + consentimiento; «Sí, envía la pregunta» → «Voy a pasar tu caso…». Sin respuesta humana | 3/4/0 | No | — | AM |
| `65e47e53` (…6673) | Comprobante (precargado con `ref.`) | 2 acuses en el mismo segundo; aplicado; ×3 pagado | 2/6/0 | No | — | B |
| `9ae56587` (…6590) | «¿Puedo entrenar hoy, Mile?» | «Le dejo tu mensaje a Milena» y nada más; «Mile» 5 min después | 4/1/0 | No | Insistió | AM |

---

## 3. Por flujo

| Flujo | Nota | Bien | Mal |
|---|---|---|---|
| **Comprobante (foto/PDF)** | **Bien** (camino feliz) / **Mal** (casos borde) | Acuse en ~6 s que dice «archivo» y no promete; «lo apliqué a *Mensualidad 10/2026 – [atleta]* por $150.000»; «Ese comprobante ya lo había recibido, así que no lo apliqué de nuevo» (`32439037`); el precargado con `ref.` se reconoce y se nombra el cobro (`65e47e53`). | Pagos de otra cosa aplicados a la mensualidad (`bd8bd4d3`, `0a55af2d`); aviso ×3–×6; «Recibí tu comprobante, pero no tienes cobros pendientes» a una hoja de matrícula y a quien ya había pagado («no entendí jaja»); «no es un comprobante… si es el código QR o la llave» a capturas de correos de cobro (`0cb83075`, `a7438e6b`, `545a5ca5`); dos acuses en el mismo segundo (`65e47e53`). |
| **Un comprobante, varios cobros** | **Regular** | Pregunta con opciones numeradas y aplica al elegido. | «Pago de septiembre y octubre de una vez» → pregunta igual y se cuelga con «De sep y oct» (`ede406da`); repregunta tras «Perfecto, muchas gracias» (`1bee1bba`); tras el «2» no confirma nada (`8d07cf75`). |
| **Cuánto debo / ya pagué** | **Bien** | `estado_comprobantes`: «Tengo el comprobante que enviaste… está pendiente de revisión… Esto todavía figura pendiente: Mensualidad 09/2026» (`32439037`). Detecta diferencias: «Si consignaste $180.000, hay una diferencia de $30.000» (`8a12267e`). | «Llamando escalate_to_human» en el texto; «Yo no veo las imágenes. Los archivos los revisa otro sistema» (`545a5ca5`). |
| **Medios de pago** | **Regular** | Lista completa con Bre-B, Bancolombia y Wompi. | Le contesta medios a quien preguntó por pagar *en efectivo* una clase suelta (`083e533b`); a quien pegó el texto de Milena con su Nequi le manda los Bre-B de la escuela (`a9ab72ed`). Los pagos sueltos (perfeccionamiento, refuerzo, uniformes) van al Nequi de Milena y el bot no lo sabe. |
| **Horarios / sede** | **Mal** | — | «¿Dirección de la cancha Nido del Colibrí?» → 30 líneas de horarios sin dirección (`d330498f`); «¿Está confirmado el entreno de hoy?» → «no lo tengo a la mano, ¿de qué grupo?» sin escalar (`2ddd46fd`); «No han llegado a dar la clase» → saludo + escalación genérica (`62db6756`). |
| **Ausencia** | Sin casos | El flujo `atenderAusenciaEnBot` no se disparó en todo el día. | — |
| **Clase de cortesía** | **Mal** | Botones reales con fecha, hora y sede; 16 leads registrados. | 0 reservas. 2 franjas por página; sin filtro de edad/género («MENORES MASCULINO» a una niña de 12 y a un adulto); franjas de las 4:00 pm ofrecidas a las 4:53 pm; atrapa: «Necesito hablar con un asesor» y «No sabemos en qué categoría quedaría ella» → «Toca la franja que prefieras…» (`cc877c2d`, `f310c110`). |
| **Prospecto / inscripción** | **Regular** | Plantilla con enlace de inscripción + cortesía; repesca de los del 05-oct a las 11:27; detecta «adultos» («la escuela te confirma cuál grupo»). | 5 prospectos sin respuesta: «me gustaría conocer el club / qué horarios tienen», «¿la edad permitida?», «estoy averiguando un club de voley», «quiero averiguar», «¿puedo llevar a una niña con mi hija a una cortesía?». Una atleta actual recibió la plantilla de prospecto (`46201572`). El precio nunca se dice (el enlace sí). |
| **Uniforme / torneo** | **Mal** | — | «¿Precio de los otros dos uniformes?» lo contestó Milena 50 min después; el pago de uniformes se aplicó a la mensualidad. Pagos de torneo de una familia sin cuenta: «se lo paso a la escuela» sin decir a qué lo aplicarán. |
| **Factura electrónica** | Sin casos | — | — |
| **Familia sin cuenta** | **Mal** | Pasa el comprobante a la escuela. | 3 mensajes en 34 s con 2 enlaces distintos (uno a **dev.sportmaps.co**); «crea tu cuenta» como respuesta a «Hola Milena» (`0af1031a`) y a «mi hija ya no entrena con ustedes» (`be939a54`). |
| **Número no registrado (familia)** | **Regular** | El OTP por correo funcionó al tercer intento (`1bee1bba`). | El primer correo no coincidía y el código «no llegó»; 6 comprobantes de números no registrados quedaron `ignored` sin decirle nada a nadie. |
| **Mensaje para Milena / pedir persona** | **Regular** | «Hola 👋 Soy el *asistente automático*… Le dejo tu mensaje a Milena 🙌» (5 veces), sin «solo puedo ayudar con…». | Escalar deja el chat en silencio: 3 escalaciones de la tarde sin respuesta en el día. A «Que más mile» + «¿podía entrenar hoy?» solo le llegó el recado (`9ae56587`). |
| **Audios y videos** | **Regular** | Transcripción viva («🎤 Entendí: …», `abe50cda`). | Solo transcribe con consentimiento: a familias sin opt-in les llegó «No puedo escuchar notas de voz 🙊» ×3 en medio de una charla por audio con Milena (`79d95e07`) y a una mamá reclamando (`0af1031a`). |

---

## 4. Lo que la gente pide y el bot no sabe hacer

| Pedido | Conversaciones | Ejemplos | Candidata a función |
|---|---|---|---|
| Pagar algo que **no es la mensualidad** (perfeccionamiento, refuerzo, clases sueltas, uniformes, torneo) | 7 (`bd8bd4d3`, `0a55af2d`, `f3b4a8fe`, `c88b1f42`, `291fcff0`, `083e533b`, `8f9e500b`) | «Cómo te cancelo» la perfeccionamiento; «dónde te puedo consignar lo del refuerzo de hoy»; «lo de las clases de hoy y mañana» | Catálogo de **cobros sueltos** con su medio (Nequi de la escuela) y regla «el pie nombra otro concepto → no aplicar a mensualidad» |
| **Reclamo de cobro** a atleta retirado / que no asiste | 4 (`0cb83075`, `4571d67f`, `be939a54`, `43e7d2f7`) | «Llevo varios meses sin asistir, ¿por qué me cobran?»; «mi hija ya no entrena con ustedes» | Motivo de buzón `reclamo_cobro` con el atleta y su estado; botón a la escuela «dar de baja» |
| **Confirmar si hay clase hoy / incidencias en la sede** | 4 (`2ddd46fd`, `62db6756`, `9ae56587`, `46201572`) | «¿Está confirmado el entreno de hoy en cancha externa?»; «no han llegado a dar la clase» | Estado de la sesión del día (cancelada/confirmada) desde asistencia/calendario; escalación **urgente** (push inmediato) para incidencias en sede |
| **Un comprobante que cubre varios meses** | 3 (`ede406da`, `d36b045d`, `43e7d2f7`) | «Pago de septiembre y octubre de una vez» | Repartir un pago entre cobros (abono) o mandarlo a la escuela con la nota «cubre sep+oct» |
| **Precio** concreto (prospectos y familias) | 5 (`08f08f59`, `cc877c2d`, `07e2d02a`, `356ff67d`, `0a55af2d`) | «¿Cuánto cuesta el curso?»; «costos y disponibilidad de días» | Ya existe `wa_responder_precios` en develop (`00ff7855`); prenderlo para Dynasty |
| **Grupo según edad/nivel** | 4 (`f310c110`, `b23a010e`, `08f08f59`, `cc877c2d`) | «No sabemos en qué categoría quedaría ella»; «mi hija tiene 14 años» | Rango de edad por equipo y filtro de franjas por edad/género |
| **Dirección / ubicación de sedes** | 1 (`d330498f`) | «La dirección y ubicación de la cancha Nido del Colibrí» | Campo dirección + enlace de mapas por sede en la info de escuela |
| **Paz y salvo / certificados** | 1 (`838374bf`) | «Paz y salvo… y el servicio social del año pasado» | Generar paz y salvo desde el estado de cuenta |
| **Pago en efectivo** | 1 (`083e533b`) | «¿Habría chances de pagar en físico?» | Campo «acepta efectivo» en medios de pago |

---

## 5. Tono

- **Presentación:** bien. «Hola 👋 soy el asistente automático de DYNASTY VOLLEY CLUB» va una vez en el primer
  contacto, y «Te escribe el *asistente automático* de la escuela, no Milena» (`62db6756`) es claro. Sobra cuando
  se encadena con otra plantilla que también se presenta (`0a55af2d`, `32439037`).
- **Largo:** los deterministas son cortos. Los largos son el bloque de horarios (30 líneas) y la lista de medios
  de pago como respuesta a otra pregunta (`083e533b`).
- **Emojis y botones:** dosis correcta (📄 ✅ 🙌). Los botones de cortesía fallan por paginación (2 por página) y
  porque el título «1. Mar 6/10 4:00pm» se repite en dos franjas distintas.
- **Consentimiento:** ya no interrumpe. Sale como «Una cosa más 🙂…» después de un trámite resuelto. Choca solo
  cuando se pega a otra pregunta en el mismo segundo (`1bee1bba`: «¿a cuál cobro?» y consentimiento a la vez) y
  en `ede406da`, donde salió en lugar de la respuesta al cobro.
- **Robótico:** «Toca la franja que prefieras o escríbeme su número» repetido a preguntas reales; «¿a cuál cobro?»
  ×3; «Recibí tu comprobante, pero ahora mismo no tienes cobros pendientes» a algo que no era comprobante;
  «Revisé el archivo… si es el código QR o la llave para pagar…» a capturas de correos; «yo no veo las imágenes.
  Los archivos los revisa otro sistema».
- **Voseo:** ninguno. Una forma rara: «Tranquilo/a, no hay problema por la hora» (`083e533b`).
- **Fugas internas:** «Llamando escalate_to_human» al final de 2 respuestas del modelo.

---

## 6. Mañana contra el resto del día, y qué ya está en develop

**Mejoró (ya vivo el 06-oct):** el consentimiento salió del frente, sin «STOP» por error; el acuse es veraz y
queda registrado; la cola corrió (los comprobantes se aplicaron y aprobaron); hay recado a Milena y escalación
directa al pedir una persona; no se contesta a «Gracias / Ok / Okey» sueltos (`545a5ca5`, `1bee1bba`); «ya pagué»
muestra primero el comprobante; se detecta el comprobante repetido; el modelo tarda 22 s de mediana (antes 38 s);
y una falla del modelo ya no se presenta como escalación.

**Sigue igual:** el bot no sabe a qué concepto va un pago; repite preguntas de cobro; escalar no garantiza que
alguien conteste; los audios de familias sin opt-in reciben la plantilla; las respuestas del modelo a
incidencias de sede son tibias.

**Ya corregido en develop (sin desplegar el 06-oct):**
- Aviso «confirmó tu pago» ×3/×6 → `ee64ef44`.
- Captura de correo de cobro + «¿por qué me cobran?» de una familia sin cuenta → consulta a una persona, sin
  «Recibí tu comprobante» ni enlace de registro → **sin commitear** en `bff/src/jobs/whatsapp-queue.job.ts`
  (`esConsultaSobreCobro`).
- «Crea tu cuenta» a la familia de un atleta dado de baja → `invitacionPendienteVigente` con `atletaInactivo` en
  `whatsapp-bot.service.ts` (~l. 1284), que ya estaba commiteado; conviene confirmar que cubre `be939a54`.
- Precio al prospecto → `wa_responder_precios` (`00ff7855`), apagado por defecto.
- Contactos personales: `responder_desconocidos=false` desde las 10:51 + freno de 24 h del `ask_email`.

**Sigue abierto en develop** (verificado en el código actual): fuga «Llamando …» (no hay filtro de salida;
`whatsapp-bot.service.ts` arma `Llamando get_*` en el historial y el modelo lo imita); enlace `dev.sportmaps.co`
(`whatsapp-queue.job.ts` ~l. 975 usa `FRONTEND_URL` del BFF que procesa la fila); cortesía de a 2
(`MAX_BOTONES = 3` en `whatsapp-clase-cortesia.service.ts`), sin escape a persona en `elegirFranja`, y frases de
≤ 7 palabras sin «?» tratadas como respuesta (`pareceOtraConversacion`); puerta de prospecto angosta
(`intencionDeProspecto` en `whatsapp-atencion.service.ts` no abre con «conocer el club», «edad permitida»,
«averiguando un club», «a una cortesía»); `CIERRES` sin «excelente gracias»; concepto del pie ignorado al aplicar.

---

## 7. Mejoras priorizadas

Primero las rápidas de alto impacto.

| # | Mejora | Evidencia | Dónde (probable) | Esfuerzo |
|---|---|---|---|---|
| 1 | **Desplegar develop** (duplicados ×3/×6, adjunto-consulta) y prender `wa_responder_precios` para Dynasty | 45 avisos duplicados; `4571d67f`; 5 prospectos preguntaron precio | Deploy + `whatsapp_settings`/ajustes por escuela | Muy bajo |
| 2 | **Filtro de salida del modelo**: quitar líneas `^Llamando \w+$` y cualquier nombre de tool antes de `deliver`; si el modelo escribió «paso tu caso» sin llamar la tool, llamarla | `1bee1bba`, `8a12267e` | `whatsapp-bot.service.ts` `handleIntent` (~l. 2400–2560), antes de `deliver` | Bajo |
| 3 | **No aplicar a la mensualidad lo que el pie o la ráfaga nombran como otra cosa** («perfeccionamiento», «refuerzo», «uniforme», «torneo», «clase de hoy», «viaje»): mandar a la escuela como «pago de otro concepto» y decirlo así a la familia | `bd8bd4d3`, `0a55af2d` (6 rechazos y reclamo) | `jobs/whatsapp-queue.job.ts` (`pistaDeCobro` / resolución del cobro) y `whatsapp-reglas-turno.ts` (`anunciaComprobante`) | Bajo |
| 4 | **Enlace público siempre a app.sportmaps.co** en mensajes a familias (no `FRONTEND_URL` del BFF que procesa) | `4571d67f`, `0a55af2d`, `32439037` | `jobs/whatsapp-queue.job.ts` ~l. 962–975 (usar `appPublica` como en `whatsapp-enlaces-de-pago.service.ts`) | Muy bajo |
| 5 | **Cortesía: escape y paginación.** En `elegirFranja`, si `pideALaPersona` o la frase no es número/botón y tiene verbo («necesito», «no sabemos», «somos»), salir del flujo o escalar; mostrar 3 franjas + «Ver más» en lista interactiva (hasta 10 filas) en vez de 2 botones; no ofrecer franjas que empiezan en < 60 min; títulos de botón únicos (con el grupo) | `cc877c2d`, `f310c110`, `08f08f59` (7 «Ver más»), 0 reservas | `whatsapp-clase-cortesia.service.ts` (`MAX_BOTONES`, `elegirFranja`, `pareceOtraConversacion`, `filtrarVigentes`, `tituloBoton`) | Bajo–medio |
| 6 | **Escalar con plazo**: toda escalación abre buzón con push y, si nadie responde en 20 min dentro del horario, recordatorio a la escuela; incidencias de sede («no han llegado», «no llegó el profe», «está cerrado») → escalación **urgente** inmediata | `62db6756`, `083e533b`, `8a12267e` sin respuesta | `whatsapp-bot.service.ts` `escalate`; `runWhatsAppMantenimiento` | Bajo |
| 7 | **Ampliar la puerta de prospecto**: «conocer el club/la academia», «edad permitida», «averiguando/averiguar (un) club», «(llevar|traer) … a (una) cortesía», «me compartieron este contacto» | 5 prospectos sin respuesta | `whatsapp-atencion.service.ts` `PROSPECTO_FUERTE` / `intencionDeProspecto` + tests | Muy bajo |
| 8 | **Comprobante de número no registrado**: en vez de `ignored` en silencio, una respuesta: «Recibí tu comprobante; como no reconozco este número se lo paso a la escuela para que lo aplique» + buzón | 6 comprobantes perdidos (`1a6a8b29`, `ab531aba`, `43e7d2f7`…) | `jobs/whatsapp-queue.job.ts` (rama `result_type='none'` de desconocidos) | Bajo |
| 9 | **Familia sin cuenta: un solo mensaje** por ráfaga (acuse + «se lo paso» + registro juntos), nunca «crea tu cuenta» como respuesta a un saludo o un reclamo | `0a55af2d`, `32439037`, `0af1031a` | `whatsapp-bot.service.ts` (`debe_registrarse`, ~l. 1308) y `whatsapp-queue.job.ts` (`familia_sin_cuenta`) | Bajo |
| 10 | **Pregunta de cobro**: entender «sep y oct», «los dos», «ambos» → aplicar al más antiguo y decirlo (ya existe `eleccion_multiple`); no repreguntar ante un cierre («Perfecto, gracias»); confirmar siempre tras la elección | `ede406da` colgado, `1bee1bba`, `8d07cf75` | `whatsapp-respuesta-de-cobro.service.ts` `interpretarEleccion` + `esCierreSuelto` antes de `resolverRespuestaDeCobro` | Bajo |
| 11 | **Info de sede**: dirección y mapa por sede; si preguntan «dirección/ubicación», responder solo eso | `d330498f` | `fallbackInfoEscuela` y tool `get_school_info` en `whatsapp-bot.service.ts`; dato en sedes | Medio |
| 12 | **Distinguir atleta actual de prospecto**: si el texto habla de «volver a entrenar», «mis horarios», «me quedé entrenando», no mandar la plantilla de inscripción; buzón | `46201572`, `07e2d02a` | `whatsapp-atencion.service.ts` (`YA_LE_PAGA` / nueva regla «ya es atleta») | Bajo |
| 13 | **«Sin cobros pendientes» y «no es comprobante» con mejor texto**: si el pago ya estaba aprobado, «Ese pago ya está aplicado y confirmado ✅»; si la imagen es un correo/estado de cuenta, «Es el correo de cobro; si ya pagaste, mándame la foto de la transferencia» (sin hablar de QR) | `791df5d5`, `545a5ca5`, `0cb83075`, `a7438e6b` | `jobs/whatsapp-queue.job.ts` (`sin_pendientes`, `no_es_comprobante`) | Bajo |
| 14 | **Audios sin consentimiento**: no mandar «No puedo escuchar» si hubo humano en las últimas 24 h o si el contacto conversa por audio con la escuela; ofrecer transcribir con un botón de consentimiento | `79d95e07`, `0af1031a` | `whatsapp-notas-de-voz.service.ts` `atenderNotaDeVoz` | Bajo |
| 15 | **Cierres**: agregar «excelente», «excelente gracias», «perfecto muchas gracias», «gracias 🙏» a `CIERRES` | `32439037` | `whatsapp-reglas-turno.ts` `CIERRES` | Muy bajo |
| 16 | **Catálogo de cobros sueltos** (perfeccionamiento, refuerzo, uniformes, torneo) con valor y medio; responder «¿cómo te pago X?» | 7 conversaciones | Nuevo: ajustes por escuela + tool del bot | Medio |
| 17 | **Estado de la sesión del día** («¿hay clase hoy?», «¿está confirmado?») desde el calendario/asistencia | 4 conversaciones | Nuevo: tool `get_today_session` | Medio |
| 18 | **Filtro de franjas por edad/género** cuando se conoce (dato de rango de edad por equipo) | 4 prospectos | `whatsapp-clase-cortesia.service.ts` + `teams.age_min/max` | Medio |
| 19 | **Acuse único**: no mandar dos acuses en el mismo segundo (anuncio + adjunto) | `65e47e53` | `responderAnuncioDeComprobante` y `encolarAdjunto`: lock por conversación | Bajo |
| 20 | Texto neutro en lugar de «Tranquilo/a» (prompt: evitar marcas de género) | `083e533b` | `SYSTEM_PROMPT` en `whatsapp-bot.service.ts` | Muy bajo |
