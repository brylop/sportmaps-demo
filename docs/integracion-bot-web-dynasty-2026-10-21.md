# Traspaso: bot de WhatsApp (Mapi) ↔ página web de Dynasty Volley Club

**Fecha:** 2026-10-21 · **Para:** el agente que construye y mantiene `dynastyvolleyclub.com` · **De:** la sesión que revisa y ajusta el bot.
**Objetivo:** que la web y el bot digan lo mismo, usen los mismos enlaces y no se contradigan. Todo lo de abajo sale de la base viva y del código (rutas al final). Lo que no pude verificar está marcado **[verificar]**.

---

## 1. Quién es el bot y por dónde entra la gente

- **Nombre público:** «asistente automático de DYNASTY VOLLEY CLUB» (en el panel se llama **Mapi**). Primer mensaje a un desconocido: «Hola 👋 Soy el *asistente automático* de *DYNASTY VOLLEY CLUB*. 🤖».
- **Número del club:** **+57 320 429 8969** (`wa.me/573204298969`). Es WhatsApp Business conectado con Coexistence: la escuela (Milena) sigue escribiendo desde el celular y el bot ve todo.
- **Modo:** `auto`, IA encendida, responde a prospectos y a desconocidos.
- **Atención humana configurada:** todos los días **4:00 p. m. a 9:00 p. m.** (hora de Bogotá). Fuera de ese horario el bot dice «te responden hoy a las 16:00».
- **La web no tiene chat propio.** Todo botón de WhatsApp abre este mismo número con un mensaje precargado. Por eso **la web y el bot son el mismo canal**: lo que la web precarga es la primera frase que el bot lee.
- **Aviso de voz:** el bot transcribe notas de voz y no guarda el audio (lo dice al final de su primer mensaje).

## 2. Los mensajes precargados de la web y cómo los trata el bot

Los botones de WhatsApp de la web terminan el texto con una etiqueta `(ref: …)`. Desde el commit `6c04217d` (2026-10-21) el bot la reconoce para abrir la conversación de prospecto.

| Botón de la web | Texto precargado (termina en…) | Qué hace el bot con un número desconocido |
|---|---|---|
| WhatsApp general, flotante, FAQ | `(ref: web)` | Prospecto de información: saluda, manda el enlace de inscripción y las franjas de clase de cortesía. |
| «Pregunta por WhatsApp» (agendar) | `(ref: web-agendar)` | Flujo de clase de cortesía (pide edad/para quién, ofrece franjas). |
| «Escríbenos» / inscribir | `(ref: web-inscripcion)` | Enlace de inscripción y grupos por edad. |
| «Pregunta las fechas» | `(ref: web-torneos)` | **Hoy** responde la información genérica y deja el caso en el buzón de Milena. **No hay calendario de torneos estructurado** (ver §7, punto 1). |
| «Consultar mi pago» | `(ref: web-pagos)` | Flujo de pagos: si el número está en una ficha, responde con sus cobros; si no, pide el correo. |

**Contrato (no romperlo):**
- La etiqueta va **al final** del mensaje, con la forma exacta `(ref: web)` o `(ref: web-<tema>)`. El bot la busca al final del texto: si la web agrega algo después, deja de reconocerla.
- Los temas válidos hoy son `agendar`, `inscripcion`, `torneos`. `pagos` se resuelve por las palabras «pagar la mensualidad». Un tema nuevo (por ejemplo `web-uniformes`) **no existe** para el bot hasta que se agregue en `PROSPECTO_FUERTE` (`bff/src/services/whatsapp-atencion.service.ts`).
- El bot **todavía no guarda** la etiqueta (ni los `utm_*`) en el prospecto. Es el siguiente paso recomendado (§7, punto 3).

## 3. Enlaces canónicos (los que el bot manda y los que debe usar la web)

| Qué | URL | Notas |
|---|---|---|
| Inscripción (QR abierto, sin pago inicial) | `https://app.sportmaps.co/join/dynasty-inscripcion` | **127 inscripciones.** Es el que el bot manda: elige el QR `open` activo con más altas. |
| Portal de familias / pagar | `https://app.sportmaps.co/join/dynasty-inscripcion?do=pagar` | La página lee `?do=pagar` o `?do=inscribir` para retomar el flujo. |
| Otro QR (cobra la primera mensualidad) | `https://app.sportmaps.co/join/dynasty-volley-club-bf807101` | 68 altas. **Riesgo:** si pasa al primero en altas, el bot cambia de enlace solo. Conviene fijar cuál manda. |
| Clase de prueba (web) | `https://app.sportmaps.co/agendar-clase/dynasty-volley-club` | Página `PublicTrialClassBookingPage`; backend `/trial-start-verification` y `/trial-confirm` con código al correo. |
| Formulario de prospectos | `https://app.sportmaps.co/inscripcion/dynasty-volley-club` | El bot **no** lo manda; el bot y este formulario escriben en la misma tabla de prospectos. |

- **Slug de la escuela:** `dynasty-volley-club`. No existe el slug `dynasty` (ni como escuela ni como QR). Un enlace `/join/dynasty` o `/agendar/dynasty` abre «no encontrado» o la página equivocada (`/agendar/:slug` es de canchas, no de clases). La web actual ya usa los correctos.
- Todo enlace que manda el bot lleva la marca de la escuela (`conMarca`).

## 4. Datos que usa el bot (la fuente de verdad; la web debe coincidir)

### 4.1 Planes y precios (`offering_plans`, mensualidad)
| Plan | COP / mes |
|---|---|
| PLAN BASIC SENIORS – 4 clases al mes | 90.000 |
| PLAN START | 90.000 |
| SENIORS 8 clases | 130.000 |
| PLAN PRO | 150.000 |
| PLAN ELITE | 180.000 |
| PLAN DYNASTY | 210.000 |
| PLAN SELECCIÓN DYNASTY | 250.000 |

- **El bot sí da estos precios por WhatsApp** («Estos son los valores de la mensualidad…»), sin enlace de pago. La web hoy **no publica precios** y dice «lo ves completo al inscribirte». Es una decisión de la escuela: si la web publica precios, que salgan de esta tabla, no copiados a mano.
- Los nombres de los planes **no son** los de la web vieja («Banca, Titular, Capitán»). Esos nombres no existen en la base.

### 4.2 Grupos, horarios y sede (`teams.schedule`, 10 grupos activos)
| Grupo | Activos | Horario (día 1 = lunes … 6 = sábado, 0 = domingo) |
|---|---|---|
| INFANTIL FEMENINO | 78 | lun y mié 6:30–8:30 p. m.; sáb 11 a. m.–1 p. m.; **[verificar]** domingo |
| INFANTIL MASCULINO | 35 | mar y jue 6:30–8:30 p. m.; sáb 7–9 a. m. |
| INTERMEDIO | 107 | lun, mié, vie 4–6 p. m. (grupo «Origen») y más franjas |
| MENORES FEMENINO | 41 | mar 5–7 p. m. (Nido del Colibrí), jue 5–7 p. m. (grupo «White»), sáb 9:30–11:30 a. m. |
| MENORES MASCULINO | 32 | mar 4–6 p. m., jue 4–6 p. m. (Nido del Colibrí), sáb 9:30–11:30 a. m. |
| JUVENIL MAYORES FEMENINO | 8 | sin horario cargado |
| JUVENIL MAYORES MASCULINO | 21 | mar y vie 8–10 p. m. |
| MINIVOLLEY BENJAMINES | 91 | lun y mié 5–7 p. m.; sáb 8–10 a. m. |
| NUEVA ERA | 40 | mar 5–7 p. m., mié 5–7 p. m. (Nido del Colibrí), vie 4–6 p. m. y domingo |
| SENIORS | 39 | lun y jue 8–10 p. m. |

- **Sedes en la base:** «Coliseo Dynasty DC» y «Cancha externa Nido del Colibrí».
- **Edades:** el bot calcula el grupo de una edad con el rango de las categorías o con la edad real de los atletas activos. Ejemplos de lo que responde: «Para 17 años: Menores Femenino», «Para 13 años: Nueva Era», «Seniors: el grupo para adultos (lunes y jueves 8–10 p. m.)».

### 4.3 Clase de cortesía (Dynasty = modo `clase`)
- El bot ofrece **franjas** reales (`school_trial_slots`, generadas desde los horarios de los grupos), filtradas por edad y día. Si no hay del día pedido dice «No tengo horarios el *sábado*; estos son los que hay».
- **Freno de 30 días** por conversación en las respuestas a desconocidos.
- La reserva se guarda en `school_signup_leads` (con `trial_slot_id`) y avisa a Milena por in-app, push y correo. El bot marca `how_heard = 'whatsapp'`.
- **[verificar]** que Dynasty tenga `school_settings.courtesy_from_training = true` (genera la ventana de 3 semanas) y que `/agendar-clase/...` escriba en la **misma** tabla y avise igual.

### 4.4 Pagos que el bot reconoce como de la escuela (`school_settings.payment_accounts`)
- Bre-B Bancolombia: `0092231411`, `0089455111`, `0090399230`.
- Nequi `3204298969` (**solo** para inscripción, clase extra, artículos, torneo y viaje). Es el mismo número del WhatsApp del club.
- Enlace Wompi (tarjeta, PSE, Nequi): `https://checkout.wompi.co/l/Hj5s7R`.
- Una cuenta que no esté aquí hace que el bot diga «cuenta que no es de la escuela». **Pendientes de decisión de Milena:** `3222095309` (número de Giovanni Ávila, familias le pagan torneos), `205-821668-08` y `@xji669`.
- **La escuela no recibe abonos** (`allow_installments = false`): un pago menor al cobro va a la bandeja para decisión humana. La web no debe prometer pago en partes.
- Reglas de negocio: la mora **no** cancela la inscripción; atención presencial en el coliseo 4–9 p. m. (decisiones de Milena, 07-oct).

## 5. Lo que el bot hace y NO hace (para no prometer en la web lo que el bot no sostiene)

**Hace solo:** precios; qué grupo le corresponde a una edad; horarios del día («¿hay entreno hoy?»); agendar clase de cortesía; mandar el enlace de inscripción; cómo pagar y estado de cobros de una familia identificada; recibir comprobantes (lee el monto, cuenta y referencia); avisos de ausencia («no va hoy»).
**Pasa a una persona:** reclamos de valor, comprobantes con monto distinto o cuenta desconocida, calendario de torneos, uniformes, certificaciones, temas fuera de la escuela, invitaciones de otros clubes (queda en el buzón, no responde).
**No hace:** abrir enlaces ni videos, ver imágenes (solo lee comprobantes), aprobar pagos, prometer descuentos, dar el calendario de torneos.

## 6. Discrepancias web ↔ base (corregir una de las dos; la base manda)

1. **Horario general.** La web dice «lun–vie 4–9 p. m., sáb 8 a. m.–5 p. m., dom 8 a. m.–1 p. m.». La base tiene entrenos **hasta las 10 p. m.** (Seniors y Juvenil Mayores) y **desde las 7 a. m.** los sábados (Infantil Masculino). Los domingos hay franjas desde las 7 a. m.
2. **«Escenarios cubiertos propios».** La base trae también la **«Cancha externa Nido del Colibrí»**. Si es descubierta, la frase de la web es incorrecta para esos grupos.
3. **Categorías.** La web tiene 5 (Fundamentación y Benjamines 5–9, Infantil e Intermedio 10–13, Menores y Juvenil 14–17, Mayores 18–34, Seniors 35+). La base tiene 10 grupos y el bot responde **«Seniors = adultos desde 18»** (los atletas reales de Seniors tienen 24–65 años, mediana 34). Con «Mayores 18–34» en la web y «Seniors 18+» en el bot, una persona de 22 años recibe respuestas distintas. Hay que definir el corte (¿18 o 35?) y cargarlo en la base.
4. **Franja de la tarjeta «Juvenil».** La base tiene **Juvenil Mayores Femenino sin horario**; el bot no puede decir cuándo entrena.
5. **Clase de prueba.** Dos sistemas distintos (§3 y §4.3). Confirmar que no se puedan sacar dos clases gratis (web y WhatsApp).
6. **Cobertura de «te respondemos hoy».** La atención humana es 4–9 p. m. todos los días; la web lo dice como «hoy», que es coherente, pero conviene mostrar el horario.

## 7. Qué falta para dejarlo unificado (en este orden)

1. **Calendario de torneos estructurado** (hoy lo carga Milena/Giovanni por el grupo de WhatsApp): una tabla (`events`) que lea el bot y la web. Sin eso, `web-torneos` siempre termina en una persona.
2. **Número en dos cuentas.** Un visitante cuyo teléfono está en dos fichas recibe «no quiero mostrarte información que no sea tuya». Debe recibir la información pública y dejar lo personal para después.
3. **Guardar el origen:** `how_heard = 'web'` y el tipo (`web-torneos`…) en el prospecto, para medir web vs QR vs WhatsApp directo.
4. **Una sola fuente de datos para la web:** un endpoint público de SportMaps con planes, grupos, horarios y sedes (hoy la web los tiene copiados a mano y ya divergen, §6).
5. **Cortesía única por persona en todos los canales** (hoy solo existe, para Besser, en el QR).
6. **Constancia de aceptación de mensajes** al llegar con `(ref: …)`: la web ya lo dice en el pie; falta guardarlo. Revisar con cumplimiento antes de usarlo como base legal.

## 8. Reglas para el agente de la web

- Los textos de WhatsApp precargados: tono corto, **etiqueta al final**, sin saltos de línea después.
- No inventes precios, horarios ni categorías: sale de §4 o se pregunta.
- No publiques cuentas bancarias en la web. Las cuentas válidas viven en `payment_accounts` y el bot las da solo a familias.
- No uses el slug `dynasty`. Usa `dynasty-inscripcion` (inscripción) y `dynasty-volley-club` (escuela / clase de prueba).
- Si agregas un botón nuevo con `ref` nuevo, avisa: hay que enseñárselo al bot (§2).
- No toques el número de WhatsApp: es el mismo del Nequi de inscripciones y torneos.

## 9. Dónde está en el código y la base

- Bot: `bff/src/services/whatsapp-bot.service.ts` (turno), `whatsapp-atencion.service.ts` (quién es prospecto, `PROSPECTO_FUERTE`), `whatsapp-clase-cortesia.service.ts` (franjas), `whatsapp-precios.service.ts` (precios), `grupos-por-edad.service.ts` (grupo por edad), `whatsapp-desconocido-reglas.ts` (otros clubes, cierres), `whatsapp-ausencias.service.ts`, `bff/src/jobs/whatsapp-queue.job.ts` (comprobantes).
- Enlaces: `enlaceDeInscripcion()` en `whatsapp-bot.service.ts`.
- Web pública de SportMaps: `frontend/src/pages/JoinSchoolPublicPage.tsx` (`/join/:slug`), `PublicTrialClassBookingPage.tsx` (`/agendar-clase/:slug`), `SchoolLeadFormPage.tsx` (`/inscripcion/:slug`). Rutas del BFF: `bff/src/routes/public-booking.routes.ts`.
- Base: `schools`, `school_join_qr_codes`, `offering_plans`, `teams.schedule`, `school_trial_slots`, `school_signup_leads`, `school_settings` (`payment_accounts`, `allow_installments`), `whatsapp_settings` (modo, horario), `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_inbound_queue`.
- Docs relacionadas: `docs/specs/whatsapp-ajustes-por-escuela.md`, `docs/analisis/auditoria-bot-whatsapp-dynasty-2026-10-06.md`.

## 10. Estado de lo que ya se cambió hoy (todo en `develop`; `main` lo sube el usuario)

Externos/amistosos en silencio · ausencias sin día no se registran como «hoy» · una cédula no es un código · saludo suelto tras un mensaje de la escuela no recibe presentación · «¿hay entreno hoy?» también para familias · comprobantes leen `O`=`0` y `@número` · comprobante a cuenta ajena no se contesta si la escuela está escribiendo · **mensajes `(ref: web…)` abren la puerta de prospecto**.
