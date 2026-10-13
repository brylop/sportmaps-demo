# Inventario — Comunicaciones / WhatsApp de la escuela (estado al 2026-10-12)

> Para el rediseño del módulo. Objetivo: que no se pierda ninguna función al rehacer la pantalla.
> Solo lectura: código en `develop` (working tree), base viva (SELECT) y capturas en `https://dev.sportmaps.co`.
> Capturas en [`comunicaciones-inventario/`](comunicaciones-inventario/). Las marcadas **sim** usan respuestas del BFF
> **simuladas en el navegador** (Playwright `page.route`, datos ficticios, todo POST/PATCH abortado): Club Campestre Demo
> no tiene WhatsApp conectado, así que sin simular solo se ve la pantalla de alta. No se entró a Dynasty ni se envió nada.

## 0. Resumen ejecutivo

- **El buzón del panel prácticamente no se usa para responder.** En Dynasty (único cliente real, conectado el 2026-10-02):
  **0** respuestas enviadas desde el panel, **0** conversaciones tomadas, **1** de 381 borradores aprobado (380 vencieron),
  **0** comprobantes cerrados en la Bandeja (206 abiertos). La dueña contesta **desde su celular**: 1.627 mensajes
  salientes son ecos de Coexistence (72 % de lo que sale hacia clientes), contra 634 del bot.
- Lo que **sí** se usa (sin intervención en la pantalla): el bot (634 salidas), escalamientos (19), retomas (7),
  clases de cortesía (36 leads, 32 en 30 días), el correo de resumen diario (8) y el informe de cartera (1).
- **Quedan rotos o engañosos:** la búsqueda no alcanza las conversaciones fuera de las 200 más recientes (Dynasty ya
  tiene 305) aunque la pantalla dice «usa la búsqueda para el resto»; con la ventana cerrada se pide «enviar una
  plantilla» y no hay cómo hacerlo desde el hilo; los adjuntos se ven como `(image)` / `(audio)`; el compositor de
  1440×900 queda cortado; en el celular el hilo no es pantalla completa y la burbuja de soporte tapa el botón de enviar.
- **Falta frente a un inbox moderno:** carpetas por asignación (sin asignar / mías / todas / archivadas / spam),
  responsable por conversación con eventos en la línea de tiempo, notas internas y @menciones, respuestas rápidas,
  panel de contacto, envío de plantillas y adjuntos, tiempo real, no leídos.

## 1. Mapa de pantallas y rutas

| Menú (grupo «Comunicación») | Ruta | Archivo | Gate |
|---|---|---|---|
| WhatsApp | `/whatsapp` (`?tab=…&conversacion=<id>`) | `frontend/src/pages/WhatsAppPage.tsx` | roles `school, admin, school_admin, super_admin` + `ModuleGate comunicacion_whatsapp`; el BFF exige owner/admin real de **esa** escuela (`administraEstaEscuela`, `whatsapp-admin.routes.ts:62`) |
| Recordatorios | `/payment-reminders` | `pages/PaymentRemindersPage.tsx` | `documentos_recordatorios` |
| Plantillas de Mensajes | `/message-templates` | `pages/MessageTemplatesPage.tsx` | `documentos_plantillas_mensajes` |
| (barra inferior del celular) «Chat» | `/messages` | `pages/MessagesPage.tsx` | **Ojo:** para la escuela el botón «Chat» del celular abre la mensajería interna (`messages`), **no** WhatsApp |
| Anuncios (solo árbol coach/otros) | `/announcements` | `pages/AnnouncementsPage.tsx` | no aparece en el menú de la escuela |

Los dos árboles de menú (`school` línea ~530 y `school_admin` línea ~778 de `config/navigation.ts`) tienen el mismo grupo.

BFF montado en `bff/src/index.ts:326`: `/api/v1/whatsapp` → `whatsapp-metricas`, `whatsapp-importar-chat`,
`whatsapp-cortesias`, `whatsapp-plataforma`, `whatsapp-admin`. Webhook en `/api/v1/webhooks/whatsapp` (`whatsapp.ts`).
Plantillas de texto para wa.me en `/api/v1/templates/render` (`templates.ts`).

## 2. `/whatsapp` — estructura general

Estados de la página:

| Estado | Qué se ve | Captura |
|---|---|---|
| Cargando | «Cargando el canal…» | — |
| Error | Tarjeta «No se pudo cargar el canal» + Reintentar | — |
| **Sin conectar** | `AltaDelCanal` → `ConectarNumero` (Embedded Signup de Meta, Coexistence). Checklist (Facebook, celular, tarjeta), botón conectar. `POST /:id/conectar` | 01, 02 |
| Conectado | Encabezado (número · «canal de atención y cobranza», botón Actualizar) + avisos + 8 pestañas | 03, 08 |

Avisos arriba de las pestañas (en este orden):
1. **Asistente apagado** (`ai_enabled=false`) con botón «Prender el asistente».
2. **Modo asistido**: «prepara respuestas pero no las envía».
3. **Borradores huérfanos** (modo auto con `pending` viejos): «Enviar todos» (`POST /ponerse-al-dia {solo_borradores}`) y «Revisar».
4. **Consumo ≥ 80 %** de los mensajes incluidos.

Pestañas: Resumen · Métricas · Conversaciones · Clases de cortesía · Plantillas · Bandeja (badge = «requiere acción») ·
Horarios · Configuración. Carga inicial: `GET /api/v1/whatsapp/:schoolId` (estado + ajustes + consumo + bandeja + eventos) y,
aparte, `GET /plantillas` (consulta a Meta, ~650 ms).

## 3. Inventario por pestaña

### 3.1 Resumen
- **Muestra:** 4 KPI del mes (facturables de N incluidos y %, sin costo, excedente, comprobantes «sin resolver») y
  «Avisos de Meta» (últimos 8 `whatsapp_account_events`: cambios de plantillas, calidad, límites).
- **Acciones:** ninguna.
- **Datos:** `whatsapp_messages.billable/pricing_category`, `whatsapp_account_events` (13 en Dynasty).
- **Estado:** funciona.

### 3.2 Métricas (`components/whatsapp/Metricas.tsx`)
- **Muestra:** selector 7/30/90 días; KPI de conversaciones por tipo, familias (solo bot / escaladas / atendidas por
  persona / sin respuesta, % solo bot, mediana y p90 de primera respuesta humana, pendientes ahora, >24 h sin responder),
  comprobantes (recibidos, aplicados solos, aprobados, esperando, ignorados con motivos…), consentimientos
  (activos, bajas, % sobre familias), embudo de prospectos, totales de mensajes por autor y serie diaria (recharts), avisos.
- **Acciones:** cambiar rango, actualizar.
- **Datos:** `GET /:id/metricas?desde=` (`whatsapp-metricas.routes.ts` + `services/whatsapp-metricas.ts`).
- **Estado:** funciona. Es el único lugar donde se ven consentimiento y la división bot/humano.

### 3.3 Conversaciones (`components/whatsapp/Conversaciones.tsx`) — el buzón
Layout: `grid md:grid-cols-[minmax(300px,380px)_1fr]`, `md:h-[calc(100dvh-12rem)] md:min-h-[540px]`. En celular,
lista **o** hilo (el hilo oculta la lista; botón ‹ vuelve).

**Lista**
- Búsqueda (nombre, teléfono ≥3 dígitos, texto del último mensaje; sin tildes). Cuando hay búsqueda ignora la bandeja e
  incluye las ocultas.
- Actualizar (manual; **no hay tiempo real**).
- **Bandejas (chips con conteo, la elegida se recuerda en `localStorage sm.wa.buzon.bandeja`):**
  `Por responder` (familias/prospectos sin respuesta y con ventana abierta; badge rojo) · `Prospectos` (+ «N sin resp.») ·
  `Por aprobar` (borradores del modo asistido; badge rojo) · `Familias` · `Personal y otros` · `Todas`.
  Sin la clasificación (migración Fase A) solo quedan Por responder / Por aprobar / Todas.
- Texto de ayuda por bandeja.
- Orden por urgencia: sin responder con ventana → la ventana que vence primero → con borradores → más reciente.
- Grupo colapsable **«Ventana cerrada · solo plantilla (N)»** (abierto por defecto en Prospectos).
- «Cargar más» de a 25; «Mostrar N conversaciones sin mensajes de la persona» (ruido oculto: hilos vacíos o solo salientes >7 días).
- Aviso «Se muestran las 200 más recientes de N. Usa la búsqueda para el resto».
- **Fila:** nombre o número, hora/fecha, último mensaje con prefijo «Asistente:»/«Escuela:», chips: `Sin responder`,
  `N por aprobar`, tipo de contacto (`Familia`, `Sin cuenta`, `Revisar` (ambiguo), `Equipo`, `Desconocido`, `Personal`,
  `Prospecto`), `Atendida por X` (toma), `Sin identificar`, chip de ventana (`quedan N h`, rojo `vence en N` si <3 h,
  `ventana cerrada`), interés del prospecto.
- **Menú ⋮ de la fila** (siempre visible en celular, al pasar el mouse en escritorio): Abrir · Tomar / Soltar la
  conversación · Marcar como personal (con confirmación) / Quitar marca de personal.

**Hilo**
- Encabezado: nombre, número, chip de ventana, etiqueta de tipo; botones **Tomar / Soltar**, **Es personal / Quitar
  personal**, **Dar por atendida** (cierra; se reabre si la persona escribe). Avisos «Conversación personal…» y
  «Atendida por X · hasta HH:MM. El asistente no le escribe nada automático».
- Mensajes: burbujas con autor (`Familia`/`Contacto`, `Asistente`, `Escuela`) y hora; `error_detail` en rojo.
  **No hay distinción entre lo que escribió una persona desde el panel y desde el celular** (ambos «Escuela»).
  Los adjuntos se muestran como texto `(image)`, `(audio)`, `(video)`, `(document)`, `(sticker)`: **no se ven ni se
  descargan**. Las notas de voz transcritas sí muestran el texto (va en `text_body`). Los botones interactivos se ven
  solo como texto.
- **Borradores del modo asistido:** «El asistente propone responder · proveedor», textarea editable, **Aprobar y enviar**
  / **Descartar**.
- **Compositor:** solo `Textarea` + Enviar. Sin plantillas, adjuntos, audio, emojis, respuestas rápidas ni variables.
  Con la ventana cerrada no se pinta el compositor: aparece el aviso «hay que enviarle una plantilla aprobada» **sin
  ninguna forma de enviarla** (callejón sin salida).
- Al responder: se envía por Meta, se registra con `wa_record_outbound_message` (`payload.manual=true`), la conversación
  pasa a `closed` con `assigned_to = usuario` y queda tomada 2 h (`HORAS_TOMADA_AL_RESPONDER`).
- Deep link desde el correo de escalamiento / «Ver chat» de Bandeja y Cortesías: `?tab=conversaciones&conversacion=<id>`.

**Endpoints:** `GET /conversaciones?vista=todas` (500 más recientes → recorta a 200; último mensaje, pendientes,
borradores, tomas, prospectos), `GET /conversaciones/:id` (mensajes + borradores pendientes), `POST …/responder`,
`POST …/tomar`, `POST …/soltar`, `PATCH …/tipo {personal}`, `POST …/cerrar`, `POST /borradores/:id/aprobar|descartar`.
**Tablas:** `whatsapp_conversations` (`contact_kind`, `status open|snoozed|closed`, `assigned_to`, `tomada_por`,
`tomada_hasta`, `unread_count`, `bot_turno_hasta`), `whatsapp_messages`, `whatsapp_message_drafts`.

**Estado:** funciona para leer y responder texto; **parcial** en adjuntos y ventana cerrada; **roto** en búsqueda >200.

### 3.4 Clases de cortesía (`ClasesCortesia.tsx`)
- **Muestra:** filtro por día; «Próximas» (nombre, origen WhatsApp/Formulario web, «Hoy», para quién, grupo, fecha/hora,
  sede, teléfono `wa.me`, «Ver chat»); «Pendientes de agendar» (leads de 14 días sin franja, «Canceló»); «Pasadas».
- **Acciones:** **Asistió / No vino** (hoy o pasadas, alterna), Actualizar, abrir wa.me, ver chat.
- **Datos:** `GET/PATCH /:id/cortesias…` → `school_signup_leads`, `school_trial_slots`.
- **Estado:** funciona. Dynasty: 36 leads (11 new, 24 contacted, 1 converted).

### 3.5 Plantillas (Meta) — `PanelPlantillas` en `WhatsAppPage.tsx`
- **Muestra:** plantillas de la cuenta de Meta con categoría y estado (verde APPROVED, ámbar PENDING, rojo resto);
  bloque ámbar «Plantillas de SportMaps que faltan en tu cuenta» (catálogo `bff/whatsapp-templates`) con texto y botón.
- **Acciones:** **Nueva plantilla** (nombre, texto con `{{n}}`, ejemplos separados por `|`, detecta variables en vivo;
  siempre `UTILITY` / `es_CO`) → «Enviar a Meta para aprobación»; **Enviar a Meta** cada faltante del catálogo.
- **No hay:** editar, borrar, vista previa, botones/encabezados/medios, otros idiomas o categorías, ni **enviar** una plantilla a un contacto.
- **Datos:** `GET/POST /plantillas`, `GET /plantillas/catalogo`, `POST /plantillas/catalogo/:nombre`; espejo en `whatsapp_template_status`.
- **Estado:** funciona. Dynasty: 13 plantillas, todas APPROVED/UTILITY.

### 3.6 Bandeja de comprobantes (`BandejaComprobantes.tsx` + `ImportarChatExportado.tsx`)
- **Muestra:** «Comprobantes sin resolver» en tres secciones: **Requiere tu acción**, **Para revisar**, **Informativo**
  (colapsada). Fila: miniatura (imagen/PDF o «Sin archivo»), contacto + ···últimos 4, fecha, etiqueta del motivo,
  detalle, pie de foto.
- **Acciones:** Ver chat · **Marcar resuelto** / **Descartar** (diálogo con motivos rápidos + texto ≥3; no toca pagos) ·
  Actualizar · autocierre de lo ya registrado (toast «N se cerraron solas») · **Importar chat exportado** (.zip de
  WhatsApp ≤40 MB → analizar remitentes → elegir familia/acudiente → importar fotos a «Por validar»).
- **Datos:** `GET /bandeja`, `POST /bandeja/:id/cerrar` (marca `error_message` con `cerrado_escuela:`),
  `POST /importar-chat/analizar`, `POST /importar-chat` → `whatsapp_inbound_queue` (estados `failed|ignored|waiting_user`).
- **Estado:** funciona. Dynasty: 206 abiertos, **0 cerrados jamás**.

### 3.7 Horarios (`HorariosDeEntrenamiento.tsx`)
- **Muestra:** cada equipo con sus franjas (día, hora, sede) y cuáles no tienen horario («el bot dirá que no lo tiene»).
- **Acciones:** agregar/quitar franja, elegir sede, guardar por equipo (directo a `teams.schedule` vía Supabase + RLS).
- **Estado:** funciona. No es comunicación en sentido estricto: es la base de conocimiento del bot.

### 3.8 Configuración
- **Cómo responde el bot:** `Responder automáticamente` (auto/asistido) · `Asistente encendido` (`ai_enabled`) ·
  `Responder también a números que no son familias` · `Responder a quienes piden información para inscribirse`
  (deshabilitado si el anterior está prendido) → `PATCH /:id/settings` (`whatsapp_settings`).
- **Horario de atención:** switch por día + desde/hasta → `business_hours` (cambia lo que el bot promete al escalar).
- **Notas de voz** (`school_settings.wa_transcribir_sin_consentimiento`, directo por Supabase).
- **Recibir avisos de SportMaps en mi WhatsApp** (`AvisosSportMaps.tsx`): celular → pendiente con enlace
  «Confirmar desde mi WhatsApp» (código 7 días) → activa; preferencias: comprobantes, escalaciones, retiros, cortesías,
  **resumen 7:00 a. m.**, **informe de cartera de los lunes**, urgentes de noche; «Dejar de recibir».
  `GET/POST/PATCH/DELETE /avisos-sportmaps` → `platform_wa_suscripciones`, `platform_wa_escuelas`. Se oculta si no está disponible.
- **No expuesto en la UI aunque existe:** `whatsapp_settings.welcome_message` (viaja en el GET, sin editor),
  `whatsapp_settings.transcribir_audios`, `whatsapp_blocked_numbers` (0 filas, sin pantalla), estado `snoozed`.
- **Estado:** funciona. Dynasty: auto, IA prendida, responde desconocidos y prospectos, transcribe audios, horario cargado;
  avisos SportMaps **no habilitados** para la escuela (0 suscripciones).

## 4. Funciones que viven fuera de la pantalla (no perderlas en el rediseño)

| Función | Dónde | Cómo se ve hoy | Uso Dynasty |
|---|---|---|---|
| Escalamiento a persona con urgencia y plazo (10/30 min), re-aviso y mensaje honesto a la familia | `services/whatsapp-escalaciones.service.ts`, `whatsapp-bot.service.ts` | Notificación in-app + push al owner/admins, correo con deep link. **En el buzón no hay carpeta ni marca de «escalada»**: solo cae en «Por responder» | 19 escalaciones (0 urgentes, 13 re-avisadas, 8 «sin respuesta» dichas a la familia) |
| Retoma (la escuela cedió y nadie contestó: el bot vuelve a lo que sabe) | `whatsapp-bot.service.ts:4502`, `whatsapp-reglas-turno.ts` | Solo como mensajes del bot | 7 |
| «Tomar la conversación» (silencia al bot 12 h; 2 h al responder) | `whatsapp-tomada.service.ts` | Botón Tomar/Soltar + chip | **0** |
| Consentimiento / opt-in y bajas (STOP) | `whatsapp-optin.service.ts`, `whatsapp_optins` | Solo agregado en Métricas; **no por contacto** | 15 activos, 1 baja |
| Clasificación de contacto (familia, sin cuenta, ambiguo, staff, personal, desconocido, prospecto) | `whatsapp-atencion.service.ts`, `contact_kind` | Chips y bandejas | desconocido 131 · familia 98 · sin clasificar 48 · sin cuenta 19 · personal 8 · ambiguo 1 |
| Ponerse al día (borradores huérfanos) | `whatsapp-ponerse-al-dia.service.ts` | Aviso arriba + «Enviar todos» | 380 borradores vencidos |
| Resumen diario 7:00 a. m. (pendientes, comprobantes, prospectos, cortesías, huérfanos, línea de cartera) | `jobs/whatsapp-resumen-diario.job.ts` | Solo correo (y aviso SportMaps si se suscribe); **sin vista en la app** | 8 correos |
| Informe de cartera semanal | `services/informe-cartera.service.ts`, `routes/reports.ts` | Correo de los lunes + `components/finances/CarteraInformeBar.tsx` en Finanzas | 1 correo |
| Notas de voz → texto | `whatsapp-notas-de-voz.service.ts` | Texto en la burbuja | 120 audios entrantes |
| Avisos de Meta (plantillas, calidad, límites) | webhook → `whatsapp_account_events` | Resumen | 13 |

## 5. Páginas relacionadas

### 5.1 Recordatorios de cobro (`/payment-reminders`) — captura 14
- **Muestra:** KPI (contactos, pendientes, vencidos, total), filtros Todos/Pendientes/Vencidos y por plan, selector de
  plantilla (automática o una de `payment_message_templates` canal whatsapp), tabla por acudiente expandible.
- **Acciones:** seleccionar y **Enviar (N)** por **correo**; **Enviar todos por email** (edge function
  `payment-reminders-cron`); botón WhatsApp por fila → renderiza `/api/v1/templates/render` y **abre `wa.me`** en el
  celular/WhatsApp Web del usuario (no usa el canal API ni las plantillas de Meta); Historial (`payment_reminder_logs`).
- **Estado:** funciona, pero es un **segundo canal de WhatsApp paralelo** (wa.me) sin relación con el buzón. La columna
  «Vencimiento» se vio vacía en la demo. Uso: 4 envíos wa.me en 90 días (1 Dynasty), 0 en 30 días.

### 5.2 Plantillas de Mensajes (`/message-templates`) — captura 15
- **Muestra/acciones:** plantillas de texto por tipo (recordatorio previo, vencimiento, mora…) y canal (WhatsApp/Email),
  switch activo, Editar cuerpo con variables (`template_variables`). Tabla `payment_message_templates`.
- **Estado:** funciona. **No son las plantillas de Meta** (pestaña Plantillas del canal): hay dos sistemas con el mismo
  nombre. Personalizadas: 1 en toda la base, 0 en Dynasty.

### 5.3 `/messages` y `/announcements`
- `/messages`: mensajería interna 1:1 (tabla `messages`). Es el destino del botón «Chat» de la barra inferior de la
  escuela en el celular. **0 mensajes en 90 días.**
- `/announcements`: anuncios a equipos (tabla `announcements`), no está en el menú de la escuela. **0 filas en total.**
- Candidatos a retirar o fusionar en el rediseño (y el «Chat» del celular debería llevar al buzón de WhatsApp).

## 6. Uso real — Dynasty (`2d509571-…`), conectada el 2026-10-02 (30 d = 90 d = toda la historia, ~10 días)

| Métrica | Valor |
|---|---|
| Conversaciones totales / con actividad 30 d | 305 / 294 |
| Estado | open 19 · closed 286 |
| Mensajes entrantes | **2.861** (texto 2.293, imagen 269, audio 120, sticker 56, interactivo 54, video 24, documento 21, no soportado 24) |
| Salientes del **bot** (`ai_generated=true`) | **634** |
| Salientes humanas **desde el celular** (eco Coexistence) | **1.627** (de ellas 42 saludos automáticos de la app) |
| Salientes humanas **desde el panel** (`payload.manual`) | **0** |
| Plantillas enviadas | 2 |
| Escalaciones | 19 (0 urgentes; 13 re-avisadas) |
| Retomas | 7 |
| Conversaciones tomadas (alguna vez) / con `assigned_to` | **0 / 0** |
| Borradores | 381 (380 vencidos, 1 enviado) |
| Notas internas | no existen en el producto |
| Cola de comprobantes | 278 (ignored 200, done 72 → 60 comprobantes + 12 enlaces de pago, failed 6) |
| Bandeja abierta / cerrada por la escuela | **206 / 0** |
| Comprobantes `awaiting_approval` en pagos | 0 |
| Opt-in activos / bajas | 15 / 1 |
| Leads de cortesía (30 d) | 32 (de 36) |
| Correos resumen diario / informe cartera (30 d) | 8 / 1 |
| Suscripciones «Avisos SportMaps» | 0 (escuela no habilitada) |

Otras escuelas: solo «Escuela Pruebas» tiene integración (1 conversación). Club Campestre Demo: sin integración.

**Lectura:** el bot y el celular hacen todo el trabajo. La pantalla se usa (si acaso) para mirar; ninguna acción de
escritura del buzón ni de la bandeja tiene uso registrado. El rediseño tiene que competir con WhatsApp en el celular:
o el panel aporta algo que el celular no da (asignación, notas, contexto de pagos, plantillas), o seguirá sin uso.

## 7. Problemas de layout medidos (Playwright, dev.sportmaps.co)

| Vista | Medición | Problema |
|---|---|---|
| Escritorio 1440×900, buzón (04, 05) | grid `380px 692px`, alto 708 px empezando en y≈240 → termina en y≈948 | El `calc(100dvh-12rem)` no descuenta encabezado + título + pestañas (~240 px): **el compositor queda ~50 px bajo el pliegue**. Con un borrador abierto, el área de mensajes es de **323 px**. |
| Escritorio, hilo | — | Encabezado de 3 botones grandes ocupa ~100 px; la burbuja flotante de soporte tapa el botón Enviar. |
| Escritorio, pestañas | `tablist` 1088 px | Caben, pero son 8 pestañas de naturaleza distinta (operación, configuración, analítica). |
| Celular 390, pestañas (08) | `tablist` scroll 1028 px en 318 visibles | Solo se ven 2,5 pestañas; **el badge de Bandeja queda fuera de vista**; no hay indicio de que se desliza. |
| Celular, márgenes | contenido 318 px de 390 | `p-6` de la página + padding del layout = ~36 px por lado (el estándar es 16 px). |
| Celular, lista (06) | — | Título + pestañas + buscador + 6 chips en 3 filas + texto de ayuda: la primera conversación aparece en y≈500. |
| Celular, hilo (07) | caja de mensajes `max-h-[55vh]` = 464 px; grid 750 px | El hilo **no es pantalla completa**: sigue debajo del encabezado y las pestañas; el compositor está fuera de vista (hay que hacer scroll de página); la burbuja de soporte tapa la última burbuja/enviar. Sin overflow horizontal. |
| Celular, bandeja (12) | — | Botones «Ver chat / Marcar resuelto / Descartar» quedan bajo el pliegue de cada fila. |
| Celular, barra inferior | — | «Chat» lleva a `/messages` (vacío), no al buzón. |

## 8. Brechas frente a un inbox moderno (referencia tipo Chatwoot/Front/Intercom)

| Capacidad | Hoy | Brecha |
|---|---|---|
| Carpetas con conteo: **sin asignar / asignadas a mí / todas abiertas / archivadas / spam** | Bandejas por *tipo* y *urgencia* (Por responder, Prospectos, Por aprobar, Familias, Personal y otros, Todas) | No hay carpetas por asignación; «archivadas» ≈ `closed` sin vista propia; spam/bloqueados (`whatsapp_blocked_numbers`) sin UI. Mantener «Por responder» y «Prospectos» como vistas: son lo más valioso. |
| **Responsable** por conversación + eventos de asignación en la línea de tiempo | `assigned_to` se escribe al responder pero no se muestra; «Tomar» es un candado temporal de 12 h, no un dueño | Falta asignar/reasignar, ver responsable en la fila, filtrar por él y registrar eventos (tomó, soltó, asignó, cerró, escaló, bot retomó) en el hilo. |
| **Notas internas / @menciones** separadas del canal del cliente | No existen | Tabla nueva + render distinto en el hilo + notificación a la persona mencionada. |
| **Pestañas por canal** (WhatsApp, correo, in-app, wa.me) | Solo WhatsApp API; wa.me y correo viven en Recordatorios; `/messages` aparte | Unificar o al menos mostrar en el hilo los recordatorios enviados por otros canales. |
| **Búsqueda** | Local sobre las 200 más recientes | Búsqueda en servidor (nombre, teléfono, texto, atleta). |
| **Respuestas rápidas** | No | Snippets con variables (reusar `payment_message_templates`/`template_variables`). |
| **Enviar plantilla** desde el hilo (ventana cerrada) | No (callejón sin salida) | Selector de plantillas APPROVED con variables autocompletadas. |
| **Adjuntos / audio / emojis** | Ver: placeholder; enviar: no | Visor de imagen/PDF/audio en el hilo (la Bandeja ya resuelve URLs firmadas); enviar imagen/PDF. |
| **Panel de contacto** | No | Acudiente, atletas, cobros pendientes, comprobantes, consentimiento, tipo, lead/cortesía, historial de recordatorios. |
| **Móvil lista ↔ detalle** | Existe, pero el hilo no es pantalla completa | Hilo a pantalla completa con encabezado propio y compositor fijo abajo (safe-area). |
| Tiempo real / no leídos | Recarga manual; `unread_count` no se muestra | Suscripción Realtime o polling + contador de no leídos. |
| Escalaciones visibles | Solo correo/push | Carpeta o chip «Escalada · urgente · vence en N min». |
| Estado del mensaje (enviado/entregado/leído/fallido) | Solo `error_detail` | Ticks de estado (`whatsapp_messages.status`). |
| Autor real | «Escuela» = panel o celular | Distinguir «desde el celular» vs «<persona> desde el panel». |
| Posponer (snooze) | Estado `snoozed` en el CHECK, sin UI | Opcional. |
| Acceso del equipo | Solo owner/admin | Coaches/staff no pueden atender aunque sería útil con asignación. |

## 9. Qué conservar sí o sí (top)

1. **«Por responder» ordenado por la ventana de 24 h que vence primero** + chip de ventana y grupo «solo plantilla».
2. **Prospectos** con conteo «sin resp.» y el puente a **Clases de cortesía** (asistió/no vino).
3. **Clasificación del contacto** y **«Es personal»** (Coexistence: el número es también el WhatsApp de la dueña).
4. **Tomar / Soltar** (silencia al bot) — rehacer como asignación, sin perder el efecto sobre el bot.
5. **Borradores del modo asistido** (aprobar editado / descartar) y **«Enviar todos»** para huérfanos.
6. **Bandeja de comprobantes** en 3 grupos con miniatura, «Ver chat», cierre con motivo, autocierre e **importar chat exportado**.
7. Avisos de estado del bot arriba (apagado, asistido, consumo 80 %), **Configuración** del bot, **Horario de atención**,
   **Notas de voz**, **Horarios de entrenamiento**.
8. **Plantillas de Meta** + catálogo de faltantes; **Avisos de Meta**.
9. **Métricas** (bot vs humano, primera respuesta, embudo de prospectos, consentimiento).
10. Deep link `?tab=conversaciones&conversacion=<id>` (lo usan correos y otras pantallas) y **Avisos de SportMaps** (resumen diario, cartera, escalaciones).

## 10. Roto o engañoso (para el backlog)

1. **Búsqueda limitada a 200** (`Conversaciones.tsx:383`, BFF `limit(500)`→`slice(0,200)`): Dynasty ya tiene 305; el texto «Usa la búsqueda para el resto» es falso.
2. **Ventana cerrada sin acción**: se pide «enviar una plantilla aprobada» y no hay botón.
3. **Adjuntos invisibles en el hilo** (`(image)`, `(audio)`…).
4. **Compositor fuera de pantalla** en 1440×900 y en celular; hilo móvil no es pantalla completa; FAB de soporte encima.
5. **Badge de Bandeja oculto** en el celular por el desplazamiento de pestañas.
6. «Chat» de la barra inferior de la escuela apunta a `/messages` (0 uso).
7. Dos sistemas llamados «Plantillas» (Meta vs `payment_message_templates`) y dos WhatsApp (API vs wa.me en Recordatorios).
8. `welcome_message` y `transcribir_audios` existen sin editor; `unread_count` y `assigned_to` se calculan y no se muestran.
9. «Prospectos» incluye a todo `desconocido` con entrante (TODO en `Conversaciones.tsx:138`): en Dynasty son 131 → ruido.

## 11. Capturas

| # | Archivo | Qué muestra |
|---|---|---|
| 01 | `01-desktop-real-alta-del-canal.png` | Estado real Club Campestre: sin conectar (alta del canal), 1440 |
| 02 | `02-mobile-real-alta-del-canal.png` | Ídem, 390 |
| 03 | `03-desktop-sim-resumen-y-pestanas.png` | Resumen + 8 pestañas (sim) |
| 04 | `04-desktop-sim-buzon-lista-e-hilo-con-borrador.png` | Buzón: chips, filas, hilo, borrador asistido; compositor cortado |
| 05 | `05-desktop-sim-hilo-ventana-cerrada.png` | Grupo «ventana cerrada» y aviso sin acción |
| 06 | `06-mobile-sim-buzon-lista.png` | Lista en 390: chips en 3 filas |
| 07 | `07-mobile-sim-hilo.png` | Hilo en 390: no es pantalla completa, FAB encima |
| 08 | `08-mobile-sim-resumen-pestanas-desbordadas.png` | Pestañas desbordadas en 390 |
| 09 | `09-desktop-sim-bandeja-comprobantes.png` | Bandeja con 3 grupos |
| 10 | `10-desktop-sim-configuracion.png` | Configuración del bot, horario, notas de voz, avisos SportMaps |
| 11 | `11-desktop-sim-plantillas-meta.png` | Plantillas de Meta + catálogo faltante |
| 12 | `12-mobile-sim-bandeja.png` | Bandeja en 390 |
| 13 | `13-desktop-sim-metricas.png` | Métricas (sim) |
| 14 | `14-desktop-recordatorios.png` | Recordatorios de cobro (real, demo) |
| 15 | `15-desktop-plantillas-de-mensajes.png` | Plantillas de mensajes (real, demo) |

Script de captura (no versionado): scratchpad de la sesión, `shots.cjs`.
