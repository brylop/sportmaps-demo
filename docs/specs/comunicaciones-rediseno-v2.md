# Comunicaciones (WhatsApp de la escuela) — rediseño alineado a la V2

**Estado:** spec para aprobar, 2026-10-14. Sin código. En el ROADMAP v2.37 es la **ola 1** del track V2 (V2-1). Manda sobre el orden de pestañas y carpetas de los tableros
`Com*` del lienzo del rediseño global; no reemplaza el inventario.

**Fuentes:**
- Inventario: [`comunicaciones-inventario.md`](comunicaciones-inventario.md), con capturas.
- Lienzo del rediseño: https://claude.ai/artifact/CGQozXBXP91kJn7YNF5Cs4. Tiene 9 tableros `Com*` (bandeja, chat, ficha,
  prospectos, por aprobar, comprobantes, ajustes) y los de la V2 (`V2Main`, `V2Palabras`, `V2WaCobro`, `V2DuenoHoy`).
- Cruce de pantallas: [`../mapa-app/cruce-rediseno.md`](../mapa-app/cruce-rediseno.md).
- Canal de plataforma: [`canal-whatsapp-plataforma.md`](canal-whatsapp-plataforma.md).

---

## 0. El problema, en una frase

**El panel no se usa porque contestar desde el celular es más fácil, y el panel no da nada que el celular no tenga.**

Medido en Dynasty, del 02 al 12 de octubre:

| Qué | Cifra |
|---|---|
| Respuestas enviadas desde el panel | 0 |
| Conversaciones tomadas | 0 |
| Borradores aprobados | 1 de 381 (380 vencieron) |
| Comprobantes cerrados en la Bandeja | 0 de 206 |
| Parte de lo que sale hacia las familias que se escribe desde el celular de la dueña | 72 % |

La V2 no compite con WhatsApp. Su regla 01 es «WhatsApp primero». Entonces el rediseño tiene dos trabajos:

1. **Llevarle la conversación a donde ya está la dueña:** su WhatsApp personal, por el canal de plataforma.
2. **Que abrir el panel valga la pena:** al entrar ya está quién es la persona, cuánto debe y la respuesta lista. Se
   manda con un toque.

Para que dé ganas de responder, cada conversación que espera llega **resuelta en un 90 %**. Una persona solo confirma o
corrige.

---

## 1. Las 8 reglas de la V2 aplicadas a Comunicaciones

| Regla V2 | Qué significa aquí | Qué cambia frente a los tableros `Com*` |
|---|---|---|
| 01 · WhatsApp primero | La dueña se entera y responde desde su WhatsApp personal. El panel es la mesa de trabajo, no la puerta de entrada | **Nuevo:** aviso por el canal de plataforma con la pregunta, la respuesta propuesta y un botón (D4) |
| 02 · Una frase y un botón | La pantalla abre con «3 familias te esperan» y el botón «Responder». Lo demás va plegado | 9 carpetas → 1 lista «Te esperan» + «Ver todo» (D2) |
| 03 · Lo normal ya viene marcado | Quien responde se vuelve responsable sin elegir nada. La respuesta propuesta viene escrita | Se quita «Tomar» como paso previo. El selector de responsable solo aparece si atiende más de una persona (D2, D3) |
| 04 · Deshacer en vez de «¿Seguro?» | «Enviar» espera 8 s con «Deshacer» antes de salir a Meta. Lo mismo para «Enviar todos» y «Cerrar» | `ComBorradores` ya tiene Deshacer; se extiende al compositor y a los cierres (D3) |
| 05 · Funciona sin señal | No aplica: responder exige red. Lo que sí: un borrador que se escribe sin señal no se pierde | Borrador local por conversación (`localStorage`, solo comodidad) |
| 06 · Palabras de la cancha | Nada de «ventana de 24 h», «plantilla», «escalada» ni «prospecto» como título | Tabla de palabras en §3 |
| 07 · Valores por defecto | Una escuela nueva conecta y ya tiene horario de atención, bienvenida y respuestas razonables. Lo avanzado va detrás de «Ajustes» | `ComAjustes` se pliega y se muda a Configuración (D6) |
| 08 · Primero el celular | Se dibuja `ComMovil*` primero. El escritorio es lo mismo con más aire y la ficha al lado | `ComDesktop` se ajusta a lo móvil, no al revés |

---

## 2. Decisiones

### D1 · Dónde vive cada cosa (resuelve la contradicción del lienzo)

«Navegación por rol» define la entrada **WhatsApp** con tres pestañas. Los tableros `Com*` dibujan 9 carpetas, más
Comprobantes y Ajustes. **Manda la navegación:**

| Entrada | Pestaña | Qué absorbe |
|---|---|---|
| **WhatsApp** | **Conversaciones** | Bandeja (`ComMovilLista`, `ComMovilChat`, `ComDesktop`), Por aprobar (`ComBorradores`, como filtro), Interesados (`ComProspectos`, como filtro con su bloque de clases de cortesía) |
| | **Recordatorios** | `/payment-reminders` y el «Recordarles» de Hoy |
| | **Avisos y plantillas** | `/message-templates`, plantillas de Meta y `/announcements` (hoy rota, 0 uso) |
| **Cobros** | Por validar | `ComComprobantes`. Un comprobante es dinero y vive con el dinero. WhatsApp solo enlaza: «2 comprobantes que el asistente no pudo leer → ver en Cobros» |
| **Configuración** | WhatsApp | `ComAjustes`: modo, horario de atención, bienvenida, notas de voz, números personales y bloqueados, avisos a la dueña. La conexión del número también vive aquí |
| **Hoy** | Bloque | «3 familias te esperan · Responder» y «Llegaron 12 comprobantes · Aprobar los 9» (`V2DuenoHoy`) |
| **Más** | Mensajes | `/messages` sale de la barra (0 mensajes, rota). No se invierte en ella |

Las métricas (`Metricas.tsx`) quedan dentro de Conversaciones, detrás de «Ver todo». Un tablero con más de un número
arriba va contra la V2.

### D2 · Una lista, no nueve carpetas

- **Arriba, siempre:** «**Te esperan (N)**». Son las conversaciones donde una familia o un interesado espera a una
  persona. Se ordenan por la que se vence primero, como hoy. Ese orden es lo más valioso del buzón actual (inventario §9.1).
- **Filtros rápidos** en una sola fila, solo los que tengan algo: «Por aprobar (n)» · «Interesados (n)» · «Mías (n)».
  «Mías» solo aparece si atiende más de una persona.
- **«Ver todo» plegado:** Todas abiertas · Las atiende el asistente · Archivadas · Personales y bloqueados.
- **Responsable implícito:** quien envía la primera respuesta queda como responsable, y el asistente queda en pausa en
  ese chat, como hace hoy «Tomar». «Devolver al asistente» sigue a un toque. **Asignar a otra persona** aparece solo
  cuando la escuela tiene 2 o más personas con acceso al buzón. Dynasty tiene una sola; Besser va a tener más.

### D3 · La respuesta llega lista

- **Toda conversación de «Te esperan» trae una respuesta propuesta** en el compositor, con una línea de «Usé: horarios
  de Sub 9», como en `ComBorradores`. Hoy eso solo existe en modo asistido. En modo automático, cuando el asistente
  escala, también debe dejar la propuesta.
- **«Enviar» tiene Deshacer de 8 s.** El mensaje se encola y sale a Meta pasado ese tiempo.
- **Pasaron 24 h:** el compositor cambia solo a «Mensaje aprobado» y preselecciona el que encaja. Ya existe desde la
  fase 1 (`whatsapp-plantilla-manual.service.ts`); solo cambian el texto y la selección por defecto.
- **La ficha del contacto da UNA acción principal** según el caso. Si debe: «Enviar enlace de pago». Si hay un
  comprobante dudoso: «Ver comprobante». Si es un interesado: «Agendar clase de cortesía». Las demás acciones van
  debajo.

### D4 · El aviso le llega a la dueña por su WhatsApp

Esto es lo que más mueve los números de §0, y la pieza ya existe: el canal de plataforma, con sus tablas aplicadas y
detrás de `PLATFORM_WA_ENABLED`.

- **Escalación:** el aviso trae el nombre, la pregunta textual y la respuesta propuesta, más el botón **«Revisar y
  enviar»**. Ese botón abre `/whatsapp?conversacion=<id>` con la propuesta cargada, así que se resuelve en dos toques.
- **Resumen de las 7:00 a. m.:** pasa de cifras a acciones. «Te esperan 3 familias · 2 respuestas por aprobar ·
  Responder».
- **Fuera de alcance de este spec:** que la dueña conteste **desde su WhatsApp personal** y eso salga por el número de
  la escuela (relevo). Es lo más cómodo, pero abre suplantación y doble canal. Si se quiere, va en un spec aparte con
  su revisión de seguridad.

### D5 · Interesados sin ruido

Hoy «Prospectos» incluye a todo desconocido que haya escrito. En Dynasty son 131, en su mayoría ruido (TODO en
`Conversaciones.tsx:138`).

**Interesado** = quien preguntó por precio, horario, inscripción o clase de cortesía, o quien tiene un lead. Los
desconocidos sin esa intención van a «Ver todo › Todas abiertas». Los botones «Asistió / No vino» y la sugerencia
«Enviar inscripción» se quedan.

### D6 · Ajustes con valores por defecto

Al conectar un número, la escuela ya trae:
- **Horario de atención:** lunes a sábado de 8:00 a. m. a 6:00 p. m. Se escribe en los dos lugares que el bot lee hoy
  (`whatsapp_settings.business_hours` y `school_settings.business_hours`), hasta unificarlos.
- **Mensaje de bienvenida** listo.
- **Asistente apagado,** con un checklist de 4 puntos para prenderlo: horarios cargados, medios de pago completos,
  horario de atención y una prueba con un acudiente real.

Las opciones avanzadas (responder a desconocidos, notas de voz, números personales y avisos a la dueña) quedan
plegadas.

`welcome_message` hoy no lo lee el bot (es configuración muerta). O se conecta, o se quita del formulario. No se
muestra un campo que no hace nada.

---

## 3. Una palabra por cosa (Comunicaciones)

Se extiende la tabla de `V2Palabras`. Lo técnico va pequeño al lado, nunca como título.

| Cosa | Se dice | No se dice | Así se ve |
|---|---|---|---|
| Quien espera a una persona | **Te esperan** | escalada, por responder | «Te esperan 3 familias» |
| Pidió información para entrar | **Interesado** | prospecto, lead | «Interesados (4)» |
| Respuesta que el asistente propone | **Respuesta propuesta** | borrador, draft | «Revisa la respuesta propuesta» |
| Modo asistido / automático | **Te pregunta antes / Responde solo** | modo asistido, auto | «El asistente te pregunta antes de responder» |
| Ventana de 24 h abierta | **Puedes responder hasta las 3:40 p. m.** | ventana de 24 h | chip con la hora |
| Ventana cerrada | **Pasó un día sin que escriba: solo mensajes aprobados** | ventana cerrada, solo plantilla | aviso en el compositor |
| Plantilla de Meta | **Mensaje aprobado** (plantilla, pequeño) | template, HSM | «Mensaje aprobado · recordatorio de pago» |
| El bot | **el asistente** en la escuela. La familia ve el nombre del club | SportBot ante la familia, IA, bot | «El asistente respondió» |
| Tomar una conversación | **Responder**: quien responde queda a cargo | tomar, candado | «A cargo: Laura · el asistente en pausa» |
| Consentimiento | **Acepta avisos por WhatsApp** | opt-in | ya así en `ComMovilContacto` |
| Contacto personal de la dueña | **Personal** (el asistente no responde) | spam, desconocido | «Personales (2)» |

---

## 4. Tablero por tablero (qué se hace en el lienzo)

| Tablero | Destino | Cambio |
|---|---|---|
| `ComMovilLista` | Se queda | 9 chips → «Te esperan» + 3 filtros + «Ver todo». Cada fila muestra la respuesta propuesta en una línea («Propuesta: Hola, Elena. Sub 9 tiene grupo…») |
| `ComMovilChat` | Se queda | El compositor arranca con la propuesta. Los textos de la ventana se pasan a palabras. El chip de responsable solo si hay equipo. «Enviar» con Deshacer |
| `ComMovilContacto` | Se queda | Acción principal según el caso (D3) |
| `ComDesktop` | **Se reemplaza** por `V2ComEscritorio` | El tablero viejo tenía 5 columnas (menú, 9 carpetas, lista, chat, ficha) y 7 acciones a la vista: inmanejable. Ahora: menú + lista + chat, y **al entrar a WhatsApp el menú de la app se recoge solo a una franja de íconos de 64 px** (con el contador de WhatsApp visible); «☰» lo despliega y se recuerda por usuario (`localStorage`, comodidad). No se oculta del todo: saltar a Cobros sigue a un toque. La ficha no es columna: lo que importa va en el encabezado del chat («Debe $ 180.000») y «Ver ficha» la abre a pedido |
| `ComDesktopNota` | Se queda (fase F3) | Notas internas y @menciones solo cuando hay equipo |
| `ComProspectos` | Pasa a filtro «Interesados» | Se conservan el bloque de clases de cortesía y «Asistió / No vino» |
| `ComBorradores` | Pasa a filtro «Por aprobar» | Se conservan «Enviar todos» y Deshacer. Cambian las palabras |
| `ComComprobantes` | Se muda a **Cobros › Por validar** | En WhatsApp queda solo un enlace con el conteo |
| `ComAjustes` | Se muda a **Configuración › WhatsApp** | Lo avanzado se pliega. Los KPI pasan a Métricas |
| **Nuevo** `V2WaAvisoDueña` | — | Ilustrativo: el aviso en el WhatsApp de la dueña con la pregunta, la propuesta y «Revisar y enviar» (D4) |
| **Nuevo** `ComRecordatorios` | WhatsApp › Recordatorios | «23 familias deben · Recordarles». El canal se elige solo: WhatsApp si aceptó avisos, si no correo |
| **Nuevo** `ComAvisosPlantillas` | WhatsApp › Avisos y plantillas | Mensajes aprobados de Meta + plantillas de texto + avisos a un equipo. Respeta la Ley 2300: 1 contacto al día |
| `V2DuenoHoy` | Se queda | Suma «3 familias te esperan · Responder» |

---

## 4b. Dimensionamiento (obligatorio, según [`dimensionamiento-responsive.md`](dimensionamiento-responsive.md) y [`../design-tokens.md`](../design-tokens.md))

Ninguna pantalla de este rediseño introduce píxeles fijos. Todo va con los tokens de `tailwind.config.ts`.

| Pieza | Token | Valor |
|---|---|---|
| Menú de la app al entrar a WhatsApp | `w-sidebar-collapsed` (se abre con «☰» a `w-sidebar`) | 64 px · 248 px |
| Lista de conversaciones (computador) | `w-[22.5rem]` en lg+, `w-80` entre md y lg; en celular la lista ocupa todo el ancho | 360 · 320 px |
| Barra superior / barra inferior | `h-header` · `h-nav` + `pb-nav-safe` | 56 · 64 px + área segura |
| Todo lo que se toca: filtros, filas, Enviar, Deshacer, «☰» | `min-h-touch` · `w-touch h-touch` | 44 px |
| Compositor y buscador | `text-input md:text-sm` | 16 px en celular (sin zoom en iPhone) |
| Texto más pequeño: contadores y horas | `text-xs` | 12 px, nunca menos |
| «Ver ficha» | `Sheet` desde abajo con `max-h-sheet` en celular; panel lateral `max-w-modal-sm` en md+ | 85dvh · 420 px |
| Márgenes y espacios | `px-gutter`, `gap-2/4/6/10` | 16 · 8/16/24/40 |

**Quiebres:**

| Ancho | Qué se ve |
|---|---|
| Menos de 768 (`md`) | Una pantalla a la vez: lista, después chat, flujo `ComMovil*` / `V2ComResponder` |
| 768 a 1023 | Lista angosta + chat |
| 1024 en adelante | Lista + chat con más aire |

Con zoom de Windows al 150 % en un portátil de 1440, el ancho útil es ~960 y cae en el tramo del medio. Con zoom del navegador al 200 % queda en una sola pantalla.

**Criterios de aceptación** (los del plan, aplicados aquí):
- Sin scroll lateral a 360 px.
- Sin doble barra de scroll: la página no scrollea; scrollean la lista y el hilo, cada uno por su lado.
- El compositor y el «Deshacer» nunca quedan debajo de la barra inferior ni de la barra de gestos (`pb-nav-safe`).
- La burbuja de soporte no tapa «Enviar» (bug medido en el inventario §7).
- Los filtros deslizan sin barra visible (`scrollbar-none scroll-fade-x`).
- Todo se ve bien con zoom del 80 al 200 % y con la escala de Windows al 125 y al 150 %.
- Entra en la auditoría automática D3 del plan: rol escuela × 360/768/1024/1440 × zoom.

---

## 5. Lo que ya está construido y se reutiliza

Fase 1 del buzón (`12f38b78`, en prod desde el 2026-10-14):
- búsqueda en el servidor;
- adjuntos en el hilo;
- mensaje aprobado desde el hilo;
- cierre en lote y autocierre de comprobantes (trigger aplicado);
- hilo a pantalla completa en el celular;
- «Chat» de la escuela abre el buzón.

Además:
- **Borradores del modo asistido:** tabla y aprobación.
- **Clasificación del contacto:** `contact_kind`.
- **Interruptores del asistente:** `whatsapp-atencion.service.ts`.
- **Canal de plataforma:** tablas aplicadas; F1 y F2 detrás de un flag.

**Nada de esto se rehace.** El rediseño es orden, palabras y tres piezas nuevas: la propuesta en modo automático, el
aviso con botón y el Deshacer al enviar.

---

## 6. Fases (una rama por fase, revisión entre cada una)

| Fase | Qué | Backend | Cómo se sabe que sirvió |
|---|---|---|---|
| **F0 · Orden y palabras** | D2, §3 y D5 sin tocar datos. «Te esperan», filtros y «Ver todo». Interesados sin ruido. Quitar «Milena» del prompt global | Solo el filtro de interesados en `/buzon` | La lista de Dynasty baja de ~131 «prospectos» a los reales |
| **F1 · Respuesta lista** | D3: propuesta también al escalar en modo automático, compositor precargado, Deshacer de 8 s, acción principal en la ficha | Generar la propuesta al escalar (reusa `whatsapp_message_drafts`). Envío diferido con cancelación | Respuestas desde el panel > 0. Mediana de primera respuesta humana |
| **F2 · Aviso a la dueña** | D4: escalación y resumen con botón a la conversación | Plataforma F3 + plantilla UTILITY del aviso. Prender `PLATFORM_WA_ENABLED` con Dynasty de piloto | Porcentaje de escalaciones respondidas en menos de 2 h |
| **F3 · Equipo** | Responsable visible y reasignable, «Mías», notas internas y @menciones, no leídos y tiempo real | Tabla de notas. Realtime sobre `whatsapp_messages` (ojo con el Disk IO: suscripción filtrada por escuela, nada de polling por minuto) | Se activa con la primera escuela con 2+ personas (Besser) |
| **F4 · Mudanzas** | Comprobantes a Cobros, Ajustes a Configuración, pestañas Recordatorios y Avisos y plantillas, `/messages` a Más | Ninguno: son rutas y menú | Nada se perdió: checklist del inventario §9 |

F0 y F1 se pueden construir ya. F2 depende de registrar la plantilla del aviso en la WABA de SportMaps. F3 se espera
a Besser.

---

## 7. Cómo se decide (igual que la V2: 5 personas, pasa si 4 de 5 lo logran solas)

| Rol | Tarea | Meta |
|---|---|---|
| Dueña | Contestar a la familia que pregunta por el horario de Sub 9, empezando desde el aviso en su WhatsApp | 20 s |
| Dueña | Aprobar las respuestas propuestas de la mañana | 30 s |
| Dueña | Recordarles a quienes deben octubre | 30 s |

**Línea base para comparar** (Dynasty, 10 días): 0 respuestas desde el panel, 1 de 381 propuestas aprobadas y 72 % de
lo que sale escrito desde el celular.

---

## 8. Abierto (decide el dueño del producto)

1. **Relevo desde el WhatsApp personal** (D4, fuera de alcance): ¿se quiere a mediano plazo? Exige un spec aparte de
   seguridad.
2. **El nombre «SportBot» ante la escuela:** ¿«el asistente» o «SportBot»? Ante la familia ya se muestra el nombre del
   club.
3. **Horario de atención por defecto** (D6): lunes a sábado de 8:00 a. m. a 6:00 p. m. ¿O se copia del horario de
   entrenamientos?
4. **La contradicción de la navegación global** («Dinero» o «Cobros», «Deportivo» o «Entrenadores»): no es de este
   spec, pero D1 asume «Cobros».
