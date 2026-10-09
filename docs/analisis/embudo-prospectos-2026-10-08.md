# Embudo de prospectos por WhatsApp — Dynasty (2026-10-08)

> Informe local, NO commiteado. Solo lectura sobre la base de producción (SELECT).
> Sin nombres ni teléfonos: conversaciones con id recortado (8 caracteres).
> Escuela `2d509571…`, integración `f50d6940…`.

## 0. Alcance y advertencias

- **Ventana real: 6 días, no 14.** La integración se conectó el **2026-10-02 19:28**; no hay mensajes antes. Todo lo que sigue es 10-02 → 10-08 15:xx.
- **El bot atiende prospectos desde el 10-06 11:16** (commit `213b0534`) y responde en tiempo real recién desde el **10-07 ~09:47** (`0b20a964`). Antes de eso hubo dos tandas de «ponerse al día» (10-06 11:27 y 10-07 09:20) que respondieron con 14–108 h de atraso. El embudo mezcla tres regímenes; separo cuando importa.
- Muestra chica (24 prospectos). Las tasas son orientativas; las estimaciones de mejora, más todavía.
- Universo: 136 conversaciones **sin cuenta identificada** (`parent_id` nulo, sin `personal`/`staff`) con mensaje entrante en la ventana. Leí los primeros mensajes de las 136 y clasifiqué a mano:
  - **22 prospectos nuevos** (preguntan por inscribirse, precio, horarios, edad, cortesía).
  - **2 reactivaciones** (exatleta que quiere volver).
  - **3 cierres tardíos** que ya venían hablando con Milena (pagan matrícula/mensualidad).
  - 1 ambiguo (excluido). El resto: familias actuales sin cuenta, pagos, proveedores, otro club, mensajes personales.
- **Embudo principal = 24** (22 nuevos + 2 reactivaciones). Los 3 cierres tardíos van aparte (§4).

## 1. El embudo

| # | Paso | n | % del paso anterior | % del total |
|---|---|---|---|---|
| 1 | Desconocido con intención escolar | **24** | — | 100 % |
| 2 | Recibió alguna respuesta (bot o Milena) | **20** | 83 % | 83 % |
| 2a | …respuesta del bot de prospecto (`desconocido_tema_escolar` / `prospecto_seguimiento*`) | 16 | — | 67 % |
| 2b | …solo `ask_email` (el bot le pidió el correo y nada más) | 1 | — | 4 % |
| 2c | …solo Milena | 3 | — | 13 % |
| 3 | Quedó como lead (`school_signup_leads`, `how_heard=whatsapp`) | **23** | — | 96 % |
| 4 | Empezó el flujo de cortesía (`cortesia_*`) | **10** | 50 % de los 20 respondidos | 42 % |
| 4a | …llegó a dar datos (`cortesia_nombre`) | 4 | 40 % | 17 % |
| 5 | Reservó (`trial_slot_id`) | **3** | 30 % | **12,5 %** |
| 6 | Recibió recordatorio (`school_trial_reminders`) | **2** | 67 % | 8 % |
| 7 | Asistió | **sin registro** (1 llegada por mensaje) | — | — |
| 8 | Se inscribió (enrollment / intake / join con el mismo teléfono, correo o nombre) | **0** | — | **0 %** |

Notas por paso:

- **Paso 3 (lead) es casi automático**: 26 leads de WhatsApp en la ventana = 24 conversaciones (una tiene 2 leads: el del bot y el de la reserva). **2 de 24 no son prospectos** (una atleta actual preguntando por horarios y la entrenadora de otro club proponiendo un amistoso). 15 de los 26 se crearon en 50 segundos el 10-06 11:27 (tanda de puesta al día). **0 de 26 tienen correo**, 1 tiene fecha de nacimiento, **0 tienen `converted_enrollment_id`**. Sin correo, el cruce posterior con la inscripción depende solo del teléfono.
- **Paso 6**: la reserva que no recibió recordatorio se confirmó **53 minutos después de que la clase había empezado** (franja 16:00, «Confirmar» a las 16:53). El flujo eligió la franja a las 09:23 y no la revalidó al confirmar.
- **Paso 7 (asistencia)**: no existe registro. `trial_class_bookings` está vacío para Dynasty; `school_trial_slots` solo tiene `reserved_count`. La única prueba es un mensaje: una familia escribió «Hola llegamos, ¿a quién le avisamos?» a las 18:15 y el bot contestó «Ya le pasé tu mensaje a la escuela». Nadie respondió por WhatsApp. La tercera reserva es hoy 10-08 a las 17:00 (pendiente).
- **Paso 8**: crucé teléfono (10 y 7 dígitos) contra `profiles`, `children.parent_phone_temp`, `unregistered_athletes` (`phone` y `guardian_phone`), el correo de `whatsapp_identifications` y el nombre de los 3 deportistas reservados contra `children` y `unregistered_athletes`. **Ningún prospecto tiene inscripción**. Dynasty creó 5 inscripciones desde el 10-02 y ninguna sale de estas conversaciones.

## 2. Tiempos entre pasos

| Tramo | Mediana | Rango | Comentario |
|---|---|---|---|
| Primer mensaje → primera respuesta del bot (17 casos) | **14,7 h** | 0,1 min – 108 h | Bimodal: antes del 10-07 09:47, 14–108 h; después, **< 1 min** (6 de 6) |
| Primer mensaje → primera respuesta de Milena (8 casos) | **≈ 14 h** | 32 min – 44 h | En horario hábil, 30–40 min; de noche o fin de semana, 1–2 días |
| Respuesta del bot → empieza cortesía (10) | **2 min** | 0 – 5,4 h | Quien engancha, engancha rápido |
| Empieza cortesía → reserva (3) | **19 h** | 7,5 – 22,6 h | Se pierde tiempo paginando horarios y entre los pasos de datos |
| Reserva → clase (3) | mismo día | −0,9 h a 8,6 h | Todas reservaron para ese mismo día; nunca aplica el recordatorio «víspera» |
| Reserva → recordatorio (2) | 4,4 h | 3,4 – 5,4 h | Solo «mismo día» |
| Primer contacto → reserva (3) | **≈ 43 h** | 22 h – 5 días | La de 5 días había escrito el 10-05: «Me quedaron de enviar la información… y no me han enviado nada» |

## 3. Dónde se pierden y por qué (leyendo las conversaciones)

Cada abandono con su causa principal; hay conversaciones con más de una.

| Causa | Casos | Conversaciones |
|---|---|---|
| **Nadie respondió** (10-02 → 10-05, antes de que el bot atendiera prospectos; pasada la ventana de 24 h ya no se podía contestar sin plantilla) | 4 | `493f2338` («quiero inscribir a mi hija, no sé en qué grupo»), `fe911005` (pide clase de cortesía), `7a5c7321`, `bea714b5` (niña de 8 años) |
| **Respuesta tardía (14–108 h) → silencio** | 5 | `f0091777`, `b23a010e`, `a379d64e`, `356ff67d`, `fad89313` |
| **Preguntó el precio y el bot no se lo dio** (le mandó el enlace `/join`) | 9 de 24 preguntaron precio; el bot dio **0 cifras** en 59 mensajes de prospecto/cortesía, aunque `wa_responder_precios = true` | `356ff67d`, `cc877c2d`, `08f08f59`, `91c9b4db`, `07e2d02a`, `a8bb7eb2`, `b74c098f` (pidió precios dos veces y escribió «?» 28 h después) |
| **Bucle de «Ver más horarios»**: lista cronológica de todos los grupos, sin filtrar por edad | 4 | `08f08f59` (8 páginas, nunca eligió), `cc877c2d`, `356ff67d`, `f310c110`. Causa raíz: **0 de 9 equipos con franjas tienen `age_min`/`age_max`/`age_group`**; el bot lo dice: «Los grupos no tienen edades cargadas» |
| **El bot ignoró el pedido de una persona** | 2 | `cc877c2d` «Necesito hablar con un asesor» → «Toca la franja que prefieras»; `679992a4` «Persona» → repite el mismo mensaje |
| **El bot no entendió y repitió** | 3 | «11años» → «No te entendí la edad»; «Fines de semana» → repite la lista; «Hola» tomado como nombre → «¿Qué edad tiene Hola?» (`679992a4` abandona ahí, a un paso de reservar) |
| **`ask_email` a un prospecto** | 6 | `755294de` (su única respuesta fue pedirle el correo; abandona), `13f865d0`, `679992a4`, `cc877c2d`, `022bd18c`; y a `f310c110` **después de reservar** al decir «Gracias». Commit `7839220f` (10-07 12:56) lo corrige en parte, pero `755294de` lo recibió a las 20:17 del mismo día |
| **Milena tardó o no cerró** | 3 | `022bd18c` (reactivación: 3 «Hola» y 6 h de espera), `af4ed7b5` (44 h; recibió la bienvenida y los días de cortesía y no volvió), `cf1d78d1` (bienvenida + imagen; silencio) |
| **Edad / categoría** | 3 | No saben en qué grupo va su hija (`493f2338`, `f310c110`, `13f865d0`); adultos preguntan el límite de edad (`b74c098f`, respondido 30 h después: «Hasta los 60») |
| **Horario no conveniente** | 1 explícito | `679992a4` («Fines de semana») |

**Lectura:** el embudo se rompe en dos puntos. (1) **Primera respuesta** (paso 1→4): la mitad de los que reciben respuesta no empiezan la cortesía, por atraso, falta de precio o una lista sin filtrar. (2) **Después de la clase** (paso 5→8): no hay asistencia registrada, ni seguimiento, ni conversión del lead. Aunque la clase salga bien, la inscripción no queda medida.

## 4. Bot vs Milena

| | Atendidos solo por el bot | Mixtos (bot + Milena) | Solo Milena |
|---|---|---|---|
| Prospectos | 13 | 4 | 3 nuevos + 3 cierres tardíos |
| Primera respuesta (mediana) | < 1 min desde el 10-07; 15–88 h antes | — | ≈ 40 min en horario hábil; 1–2 días fuera de él |
| Siguieron conversando después de la primera respuesta | 8/13 (62 %) | 4/4 | 2/3 nuevos |
| Empezaron cortesía | 8 | 2 | 0 (Milena ofrece cortesía, pero no queda en el sistema) |
| Reservaron | 2 (15 %) | 1 (25 %) | 0 registradas |
| Respondió el precio | 0 | 2 (Milena, por imagen o texto) | 3 |
| Cerraron (pago) | 0 | 0 | **2 de 3 cierres tardíos pagaron, pero por fuera de la plataforma** |

- **Milena cierra; el bot no.** Las dos únicas conversiones reales del periodo son de Milena. Una mamá pagó matrícula y uniforme por Nequi y dijo «No estamos registrados». Una adulta pagó la mensualidad de seniors (130 mil) por comprobante; tiene perfil creado el 10-05 pero ninguna inscripción, y preguntó si debía usar el enlace «inscribir a un menor». **Ninguna de las dos aparece como inscripción**, así que el embudo marca 0 % aunque hubo ventas.
- **El bot gana en velocidad y en agendamiento** (3 de 3 reservas son del bot) **y pierde en precio, en categoría y en salida a humano.** Milena contesta lo que la gente pregunta (precio, lugar, edad máxima) con una imagen o una frase, pero llega tarde fuera de horario y lo que cierra no queda registrado.
- Los prospectos no son comparables: a Milena le escriben referidos que ya decidieron, y al bot le llega el tráfico frío. La comparación sirve para ver qué hace cada uno, no para decir quién convierte mejor.

## 5. Las 5 mejoras con más impacto en conversión

Base para estimar: ~24 prospectos cada 6 días ≈ **120 al mes**. Hoy: 12,5 % reserva, 0 % inscripción registrada. Supuesto de la industria: entre 40 % y 60 % de quienes asisten a una clase de prueba se inscriben (no medido aquí; por eso existe la mejora 4).

### 1. Precio y grupo correcto en la primera respuesta
- **Qué:** cargar `age_min`/`age_max` (y género) en los 9 equipos con franjas. Es configuración de la escuela; Milena ya lo sabe («Para 13 años le corresponde Nueva Era» ya funciona desde `abfd1335`). Hacer que `desconocido_tema_escolar` responda la mensualidad **en el texto** cuando preguntan «cuánto cuesta». Hoy manda el enlace aunque `wa_responder_precios=true`. Revisar por qué esa rama no se activa en este paso.
- **Ataca:** precio sin responder (9/24), bucle de horarios (4), dudas de categoría (3).
- **Estimación:** que la mitad de los 10 que responden y no empiezan la cortesía sí la empiece, y que se cierre el bucle de horarios. La reserva pasaría de **12,5 % a ~25 %**: **+15 reservas al mes**. Es la de mayor impacto y la más barata.

### 2. Salida a humano real (y plantilla para reabrir a las 24 h)
- **Qué:** en cualquier paso de `cortesia_*`, que «asesor / persona / hablar con alguien / llamar» y dos mensajes seguidos sin entender escalen a Milena con push y un plazo. Hoy el bot repite «Toca la franja». Si Milena no contesta en X min dentro del horario, el bot avisa al prospecto de cuándo le van a responder. Para los mensajes de más de 24 h sin respuesta, una plantilla aprobada («Hola, vimos tu mensaje sobre Dynasty, ¿te mostramos horarios y valores?»).
- **Ataca:** los 4 que nadie respondió, los 2 pedidos de asesor ignorados y las esperas de 6–44 h.
- **Estimación:** recuperar entre 1 de cada 3 y 1 de cada 2 de esos 8 casos: **+3 a +4 reservas cada 6 días (~+15 al mes)**. Depende de la disponibilidad de Milena.

### 3. Flujo de cortesía robusto (sin repetir ni perder datos)
- **Qué:** entender «11años», «fines de semana» o «el sábado» como filtro. No tomar saludos («Hola») como nombre. **Revalidar la franja al confirmar** (no aceptar clases ya empezadas ni con menos de 2 h, como ya hace al listar). No pedir el correo después de reservar. Pedir el correo del acudiente **dentro** de la cortesía (hoy 0/26 leads tienen correo).
- **Ataca:** 1 de 4 que llegó a dar datos y abandonó por un «¿Qué edad tiene Hola?», 1 reserva inútil y el cruce con la inscripción.
- **Estimación:** pasar de 3/4 a 4/4 en datos → reserva. **+25 % de reservas sobre las que ya llegan a dar datos (~+4 al mes)**. También sube la calidad del cruce, que es lo que necesita la mejora 5.

### 4. Cerrar el ciclo de la clase: llegada, asistencia y seguimiento
- **Qué:** que «llegué / llegamos» en el día de la clase avise al entrenador y a Milena; hoy el bot dice «ya le pasé tu mensaje» y nadie contesta. Marcar asistencia de la clase de prueba desde la lista del entrenador (presente / no vino) sobre el `trial_slot_id`. La misma noche, mensaje con el enlace de inscripción **precargado con los datos del lead** (nombre, edad, acudiente, grupo) y un recordatorio a las 48 h. A los que no vinieron, ofrecer otra franja. Activar el recordatorio de víspera cuando la reserva es para otro día.
- **Ataca:** el hueco 5→8, donde hoy se pierde todo lo ganado.
- **Estimación:** con ~20 reservas al mes (después de las mejoras 1–3), 70 % de asistencia y 40 % de inscripción entre los asistentes: **~5–6 inscripciones al mes atribuibles al bot**, contra 0 medidas hoy.

### 5. Que las ventas de Milena entren a la plataforma
- **Qué:** desde el buzón, «Inscribir a este prospecto» convierte el lead en inscripción con un clic. Sería una RPC transaccional que cree el deportista y el enrollment y escriba `converted_enrollment_id`. Un enlace de inscripción para **adultos**, no «inscribir a un menor». Cuando un desconocido manda un comprobante de matrícula, que el bot lo trate como inscripción nueva, no como «¿quién eres?» (`pide_identificacion`).
- **Ataca:** las 2 ventas del periodo que quedaron fuera del sistema. Sin esto, el embudo siempre va a marcar 0 %.
- **Estimación:** no sube la conversión de forma directa; **la hace visible** (+2 inscripciones registradas en 6 días, ~+10 al mes) y evita cobros perdidos o duplicados. De forma indirecta, permite atribuir y ajustar las mejoras 1–4.

**Orden sugerido:** 1 (configuración y una rama del bot) → 3 (ajustes del flujo) → 2 (escalamiento y plantilla) → 4 → 5. Con 1 a 3 juntas, la reserva pasaría de ~12 % a ~30–35 %. Es una estimación sobre una muestra de 24.

## 6. Hallazgos laterales

- **Leads falsos positivos:** 2/24 (atleta actual, entrenadora de otro club) y 1 duplicado (la reserva crea un lead nuevo, sin `origen`, en vez de actualizar el del bot).
- **`school_trial_class_settings` no tiene fila para Dynasty**, pero la cortesía funciona por `school_settings.wa_modo_cortesia='clase'`. Hay dos fuentes de configuración.
- **9 `enrollment_form_intake` en `waiting_review` desde el 10-05**, sin revisar (fuente `app`; no son de WhatsApp).
- **El estado del lead no avanza:** 19 `contacted` y 7 `new`, incluso con reserva o con la familia ya en la cancha.
- Mientras medía ejecuté por error un `CREATE TEMP VIEW x AS SELECT 1`, que solo vive en la sesión y desaparece al cerrarla. Aparte de eso, solo SELECT.

## 7. Cómo se midió (para repetirlo)

- Pasos del bot: `whatsapp_messages.payload->>'step'` (outbound `ai_generated`).
- Milena = outbound `ai_generated=false`, sin `step` y sin `payload.automatico` (ecos de la app de WhatsApp Business). `automatico=true` = saludo automático de la app.
- Prospecto: clasificación manual de los primeros mensajes de las 136 conversaciones sin identificar.
- Inscripción: cruce por teléfono (10 y 7 dígitos) con `profiles`, `children.parent_phone_temp`, `unregistered_athletes`; correo de `whatsapp_identifications`; nombre del deportista reservado.
