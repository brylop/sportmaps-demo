# WhatsApp — conversación v2 (Dynasty): mapa, fallas y propuesta

Estado: **propuesta para aprobar, sin código escrito.** Medido en la base viva el 2026-10-24 (Dynasty, últimos 7 días).

## 1. Qué pasa hoy (medido)

| Dato | Valor |
|---|---|
| Entrantes / respuestas del bot / mensajes de Milena | 1.671 / 361 / 1.363 |
| Respuestas del bot a contactos `desconocido` | 129 de 363 |
| Comprobantes (imagen/PDF) en 7 días | ~104 |
| …de esos, `ignored` por «el nombre no señala a un único deportista» | **83 (80 %)** |
| Escalamientos («paso tu caso a una persona») sin ningún mensaje humano después | 28 de 75 (23 con más de 24 h) |
| Leads de prospectos (14 días) con fecha de nacimiento / con acudiente | 2 de 34 / 6 de 34 |

## 2. Por qué se enreda (causas en el código)

El bot decide «¿es de la escuela?» con cientos de expresiones regulares y, **si no sabe, asume que es familia**:

1. **El comodín es «familia».** `handleIdentification` (whatsapp-bot.service.ts ~1889) cierra con «Si eres familia de un atleta… escríbeme el correo». Una persona nueva que escribe «papá de Sofía para información» no cuadra con ninguna regla de prospecto (`intencionDeProspecto` exige que TODAS las palabras sean relleno) y cae ahí.
2. **«Mi hija» + «voleibol» = pagos.** `temaEscolar` regla 4 (whatsapp-atencion.service.ts ~384) devuelve `'pagos'` para «mi hija se quiere meter en la academia de voleibol» → «No reconozco este número entre las familias… tus cobros son datos privados». La persona contesta «mi hija no es de la escuela» y el bot no lo entiende.
3. **Preguntas simples sin regla → silencio → retoma tardía.** «¿El plan pro cuántas clases son?» no tiene regla; una hora después sale «Todavía nadie de la escuela ha podido contestarte» (no responde nada). Lo mismo con el precio, que salió 72 min tarde.
4. **Contactos personales de Milena.** La psicóloga nueva y otros conocidos que escriben por primera vez reciben «escríbeme tu correo»; solo se protege a quien ya tiene mensajes de la escuela en 30 días (`escuelaLeEscribioEnDias`).
5. **Comprobantes sin dato.** Si el nombre no identifica a UN deportista, el comprobante se ignora y queda para que la escuela lo cruce a mano. **Nunca se pregunta el mes.**
6. **Repeticiones:** «no puedo leer ese formato» dos veces en 5 min; «Todavía nadie…» dos veces en el mismo segundo.

## 3. Propuesta

**Principio:** dejar de adivinar. Una sola pregunta con botones resuelve el 80 % de lo que hoy hacen las regex, y todo lo que el bot pregunte debe terminar en un dato guardado.

### 3.1 Puerta única para quien no reconoce el teléfono

Primer contacto (sin cruce por teléfono, sin mensajes previos de la escuela, no es otro club/negocio/personal):

> Hola 👋 Soy el asistente de *Dynasty*. ¿Qué necesitas?
> [Ya soy del club] [Quiero información] [Otro tema]

- **Ya soy del club** (y el teléfono no cruza) → pedir *nombre completo del deportista* (no correo). Si hay UNA coincidencia, se vincula el número al acudiente solo tras OTP al correo registrado (lo que ya existe); si no, queda en el buzón con la ficha lista. Nunca se muestran datos antes de verificar.
- **Quiero información** → mini-registro (3.2).
- **Otro tema** → buzón, sin más preguntas, con aviso a la escuela.
- Si escribe texto libre en vez de tocar el botón, se aplican las reglas actuales pero **el comodín deja de ser «familia»: pasa a ser esta pregunta.**
- Se eliminan: la regla 4 de `temaEscolar` para desconocidos y el texto «No reconozco este número entre las familias».

### 3.2 Mini-registro del prospecto (máx. 4 respuestas, una por mensaje)

1. Nombre completo del deportista (si ya lo dijo, no se repite).
2. Edad o fecha de nacimiento → grupo sugerido (ya existe `grupoPorEdad`).
3. Nombre del acudiente (por defecto el nombre del perfil de WhatsApp: botón «Soy {nombre}»).
4. ¿Qué quiere? [Clase de cortesía] [Inscribirme] [Solo precios].

Al terminar: precios del grupo correspondiente, enlace de inscripción y lead COMPLETO en `school_signup_leads` (`full_name`, `birth_date`, `guardian_name`, `phone`, `suggested_category`, `source_detail`). Reutiliza `iniciarCortesia`/`registrarLeadDeProspecto`; la novedad es que el orden y el cierre son siempre los mismos.

### 3.3 Comprobante: deportista + mes, sin interrogatorio

Hoy: 80 % ignorado. Nuevo orden, preguntando solo lo que falta:

1. **Deportista.** Si la OCR/caption/teléfono da UNA coincidencia, no se pregunta. Si da varias → botones con los nombres (máx. 3). Si no da ninguna → «¿De qué deportista es? Escribe nombre y apellido».
2. **Mes.** Con el deportista resuelto se leen sus cobros pendientes: 1 pendiente → se aplica sin preguntar; 2 o más → botones «Octubre $150.000 · Septiembre $150.000 · Otro mes». Sin cobros → [Mensualidad de…] con los últimos 3 meses.
3. **Concepto** solo si el monto no calza con una mensualidad: [Mensualidad] [Inscripción] [Otro].
4. Cierre de una línea: «Listo: comprobante de *$150.000* de *Sofía* para *octubre*. La escuela lo confirma.»

Se guarda la elección en la fila de la cola (`pregunta_opciones` ya existe) y el cobro queda como `pending_review` con deportista y periodo, así la escuela solo aprueba.

### 3.4 Que no se pierda nadie

- **SLA del buzón:** si un escalamiento sigue sin respuesta humana a las 2 h hábiles → correo/push a Milena; a las 24 h, resumen. El mensaje a la familia pasa de «Todavía nadie…» a una hora concreta o se calla.
- **Preguntas de plan** («¿cuántas clases tiene el plan pro?»): respuesta determinista desde el catálogo de planes, no escalamiento.
- **Contactos personales:** marcar `contact_kind='personal'` (8 hoy) con un botón en el buzón y regla: quien escribe por primera vez llamando a Milena por nombre y sin pedir nada → silencio.
- **Anti-repetición:** un mismo texto de bot no sale dos veces en 30 min por conversación.

### 3.5 «Pago esperado»: saber qué plan va a pagar cada quien (medido 2026-10-24)

Desde el 2-oct hay 447 archivos de comprobantes en la cola de Dynasty. Los que **no terminaron aplicados a un cobro** y siguen abiertos para la escuela:

| Causa | Archivos | Qué falta saber |
|---|---|---|
| Familia sin cuenta / número sin ficha / nombre ambiguo | 12 + 11 | A qué deportista pertenece |
| «La familia no tiene cobros pendientes» | 12 | El cobro del mes aún no existe: pagan por adelantado o el cobro no se generó |
| Monto no cuadra ($45k, $90k, $110k, $130k, $150k, $170k, $180k) | 10 | Abono, cambio de plan o cuota especial |
| Otro concepto (inscripción, torneo, vacacionales, perfeccionamiento) | 10 | Concepto y a quién |
| Varios cobros / no contestaron cuál | 6 | Cuál mes |
| **Total abiertas** | **58** (+4 archivos que no se pudieron bajar = 62) | |
| `contacto_no_atendido` | 117 | **Sin revisar: pueden traer pagos reales** de contactos que el bot no atiende |

Hoy el cruce solo compara el monto con los cobros YA creados. Propuesta: calcular por deportista un **pago esperado** y cruzar contra él:

1. **Candidatos por monto.** Para cada deportista de la familia: cuota individual (`enrollments.monthly_fee`), precio de su plan (`offering_plans.price`), suma de hermanos, inscripción, saldo parcial. Un monto que calce con UN candidato único se propone solo.
2. **Cambio de plan.** Si el monto es el precio exacto de OTRO plan activo (ej. $130.000 = SENIORS 8 cuando está en PRO $150.000), se propone «¿cambia a SENIORS 8?» en vez de «monto no cuadra».
3. **Sin cobro del mes.** Si no hay cobro pero hay inscripción activa, se propone crear el cobro del periodo con la cuota vigente y aplicarlo (con aprobación de la escuela).
4. **Confianza.** Alta (deportista único + monto exacto + cuenta destino de la escuela) → se aplica y se avisa; media → una pregunta con botones a la familia (3.3); baja → inbox con la propuesta ya armada, un toque para aprobar.
5. **`contacto_no_atendido`:** revisar los 117 una vez con OCR (¿monto + destino de la escuela?) y pasar los que sean pagos a la bandeja; en adelante, un comprobante NUNCA se ignora por el tipo de contacto: se guarda y se avisa.

**Resultado de revisar los 117 `contacto_no_atendido` (simulación con OCR, 2026-10-24, nada escrito):**

| Resultado | Archivos | Lectura |
|---|---|---|
| `archivo_no_disponible` (Meta: «Object does not exist… missing permissions») | 82 | No se pueden bajar. 37 son de un mismo teléfono y 38 del 9-oct: parecen archivos de chats personales/ecos de Coexistence, no comprobantes. No hay forma de leerlos desde el token de la integración |
| `no_es_comprobante` | 31 | Fotos/documentos que no son pagos |
| `sin_familia` — **pagos reales** | 3 | $360.000 (7-oct, …3070), $160.000 (7-oct, …9689), $90.000 (19-oct, …4915): número que no está en ninguna ficha |
| `destino_ajeno` | 1 | $1.249.334 (13-oct, …1068) a la cuenta de otra persona, no de la escuela |

Conclusión: el hueco de «contacto no atendido» es de **3 pagos por $610.000 y 1 transferencia ajena**, no de 117. Ninguno traía comisión de Wompi. Esos 3 se resuelven con el mismo flujo de 3.3 (preguntar deportista) y se dejan en la bandeja.
El script `bff/scripts/wa-recuperar-comprobantes.ts` ganó la opción `--incluir-no-atendidos` (solo selección; sin `--aplicar` no escribe).

Datos que ya existen: cola `whatsapp_inbound_queue` (`pregunta_opciones`, `matched_child_id`), cuota individual, planes con `max_sessions`. Falta: una función que arme los candidatos y un campo de propuesta en la cola.

### 3.6 Torneos: que cada pago quede con torneo, deportista y quién pagó (control de Milena)

Hoy Dynasty tiene 0 ítems en `school_tournament_items` y 0 cobros únicos: un comprobante de torneo cae en «otro concepto» y se escala sin poder cruzarse.

1. Cargar el catálogo de torneos de Dynasty (nombre, precio, por atleta, cuotas, fechas) en `school_tournament_items`.
2. Cruce: concepto/pie del comprobante + monto contra el catálogo → torneo propuesto. Deportista por la misma regla de 3.3.
3. El pago queda con `payment_category='torneo'`, el torneo, el deportista y **`ocr_origin_name`** (quién pagó, ya existe en `payments`), visible en la bandeja y en un reporte «Torneos: quién pagó qué».
4. Monto menor al ítem con cuotas permitidas → abono; si no, bandeja.

### 3.7 Cambio automático de plan + registro

Decisión del usuario: el plan **se cambia solo** y se deja registro de las veces que, debiendo más, se cambió.

**Tabla propuesta `enrollment_plan_changes`** (migración nueva, `text + CHECK`, RLS con `user_staff_school_ids()`, sin policies de escritura para clientes; se escribe desde una RPC `SECURITY DEFINER`):

| Columna | Para qué |
|---|---|
| `enrollment_id`, `school_id`, `child_id` | A quién |
| `from_plan_id`, `to_plan_id`, `from_amount`, `to_amount` | Qué cambió |
| `amount_paid`, `period_year`, `period_month` | Lo que pagó y de qué mes |
| `debt_at_change` | Lo que debía al cambiar (mensualidades vencidas + saldo) |
| `direction` | `up` / `down` / `same_price` |
| `source`, `queue_id`, `payment_id` | `whatsapp_queue` / `manual` / `api` y el comprobante |
| `changed_by` | `auto` o el usuario |
| `created_at` | Cuándo |

Consulta de control: `where direction='down' and debt_at_change > 0` = «cambió a un plan menor debiendo más».

> **Corrección (misma tarde):** el cambio de plan NO se dispara por el monto del comprobante. En Dynasty el plan sube o baja por **clases tomadas en el mes** (4 / 8 / 12 / 16, `offering_plans.max_sessions`). Los comprobantes de menos plata son familias que pagan el plan viejo porque nadie les avisó que subieron (casos Isabella, Valerie, Mariana). Por eso la regla de abajo (monto = precio de otro plan) queda **descartada** y el disparador es la asistencia (3.8). El registro `enrollment_plan_changes` se conserva, con `source='attendance'`.
>
> Los «62 por revisar» que mencionó el usuario son, con alta probabilidad, los del cruce de las planillas de papel de septiembre (`docs/dynasty-planillas-septiembre-2026/`: «62 necesitan revisión humana: dudosas, monto distinto, no encontradas»), no los 58+4 de la cola de WhatsApp: la coincidencia numérica de 3.5 es casual.

**Reglas del cambio automático (versión descartada, solo para referencia):**
1. Deportista único y comprobante con destino de la escuela y sin duplicado.
2. El monto es **exactamente** el precio de UN plan activo distinto del actual. Si dos planes valen lo mismo (START y BASIC SENIORS = $90.000) → no cambia, bandeja.
3. Si el pie dice «2 clases», «mitad», «abono» → es abono, no cambio.
4. **Pendiente de decidir:** elegibilidad. SENIORS 8 ($130.000) y BASIC SENIORS suenan a restringidos por edad; el caso real es un deportista en PRO ($150.000) que paga $130.000. Sin una regla de edad/categoría por plan, el cambio automático puede dejarlo en un plan que no le corresponde.
5. Al cambiar: se actualiza `enrollments.offering_plan_id` y `monthly_fee` (el nuevo valor aplica al periodo pagado y siguientes; el cobro abierto del mes se ajusta), se registra la fila y se avisa a Milena en el resumen diario.

Antes de escribir la migración: plan aprobado por el usuario (regla del repo: plan antes de código en migraciones).

### 3.8 Asistencia por WhatsApp → clases tomadas → plan del mes

**Hueco medido (2026-10-24):** `attendance_sessions` de Dynasty tiene datos hasta la semana del 28-sep/5-oct, y **todo eso fue la carga de las planillas de papel** (102 sesiones del 3-oct + 14 del 5-oct). Desde el 6-oct no hay **ninguna** asistencia: los entrenadores la llevan en papel y no la suben. Sin asistencia no se puede calcular el plan por clases ni avisar a la familia antes del cobro.

**Dos caminos por WhatsApp, ambos con revisión antes de guardar** (nunca auto-commit de OCR crudo):

1. **Foto de la planilla (respeta el hábito actual).** El entrenador (o Milena) manda la foto de la hoja al WhatsApp de la escuela. Se identifica por teléfono como staff (ya existe `wa_identify_staff_admin_by_phone` para la matrícula; falta el rol coach). OCR de la hoja (✓ X R VR ✓R «/» = asistió, según las respuestas de Milena del 5-oct) → cruce con el roster del equipo → resumen «Intermedio, 22-oct: 14 presentes, 3 sin marca, 1 no encontrada» con botones [Guardar] [Corregir]. Reutiliza el OCR de planillas ya probado con las 32 fotos de septiembre y el cruce de `cruce_asistencia.json`.
2. **Lista numerada a la hora de la clase (para el que no quiere ni la foto).** El bot le manda al coach el roster del día («1 Ana, 2 Luis…»); responde «faltaron 3 y 7» o «todos». Cinco segundos y queda guardada la sesión.

**Cómo se guarda:** por el MISMO camino que `POST /session` (descuenta crédito del plan, consume reservas, dispara `avisarHitoDePlan`), no con INSERT directo (hallazgo v1.3 de `asistencia-rapida-checkin.md`). `check_in_method='manual'`; marcar el origen en `notes` (`whatsapp_foto` / `whatsapp_lista`). Sesiones de días pasados entran ya `finalized=true` para no mandar avisos viejos.

**De clases a plan:**
- Cierre de mes (o corte semanal): clases asistidas por deportista vs `max_sessions` de su plan.
- Si asistió más/menos que su plan de forma sostenida → propuesta o cambio automático según la regla que defina Milena (abierta abajo) y fila en `enrollment_plan_changes`.
- **Aviso a la familia ANTES del cobro** («Sofía tomó 12 clases en octubre: su plan pasa a ELITE, $180.000») — es lo que hoy no existe y causa los pagos «de menos».

**Decisiones del usuario (2026-10-24, «en teoría», a confirmar con Milena):** (a) sube por las clases del mes anterior; (b) también baja; (c) la tolerancia es «como Milena lo maneja o cobra» — no se conoce, por eso arranca en **modo sombra** (ver abajo); (d) SENIORS y SELECCIÓN **entran** en el cambio automático (SELECCIÓN no tiene `max_sessions`: queda por definir su tope); (e) cada entrenador manda desde su teléfono personal y Milena como admin.

**Lo que dicen los datos (septiembre, planillas cargadas, parcial):** la asistencia NO calza con el plan. Mediana de clases por plan: PRO (8) → 6; ELITE (12) → 9; DYNASTY (16) → 11; START (4) → 3; SENIORS 8 → 2. Con una regla estricta «clases ≤ plan anterior» bajarían ~35 de PRO, ~30 de ELITE y ~7 de DYNASTY, y solo subirían ~22 de PRO, 5 de START y 4 de ELITE. Septiembre es una muestra mala (papel, solo ✓ cargados, un grupo marca todo con «X»), así que no sirve para fijar la tolerancia: hay que medirla con asistencia real de octubre.

**Modo sombra (propuesta):** el cálculo corre y **registra lo que cambiaría** sin tocar el plan; Milena lo compara con lo que ella haría y de ahí sale la regla. Tres modos por escuela: `apagado` → `sombra` → `auto`. Regla inicial sugerida: sube cuando las clases del mes anterior **superan** `max_sessions` de su plan; baja solo tras **dos meses seguidos** por debajo del tope del plan inferior. Ajustable por escuela.

#### Plan de migraciones (para aprobar; NO escrito)

Reglas del repo: una sola sesión aplica migraciones; crear con `npm run migrations:new -- <slug>`; `search_path` fijo y `GRANT EXECUTE` explícito; estados con `text + CHECK`; types.ts una sola vez al final. Todo con medición de radio antes de aplicar.

1. `enrollment_plan_changes` — tabla de 3.7 + `source` ∈ (`attendance`,`manual`,`api`), `mode` ∈ (`sombra`,`auto`) para distinguir lo simulado de lo aplicado; RLS de lectura con `user_staff_school_ids()`; sin escritura de clientes.
2. `school_settings` (o `whatsapp_settings`): `plan_por_asistencia_modo text CHECK (apagado|sombra|auto) DEFAULT 'apagado'` + parámetros (`plan_sube_umbral`, `plan_baja_meses`). Dynasty arranca en `sombra`.
3. RPC `plan_propuesto_por_asistencia(school_id, año, mes)` — solo lectura, `SECURITY DEFINER`: clases presentes del mes por deportista contra `max_sessions`; salta inscripciones con cuota manual (`fee_is_manual`/becas) y planes sin tope.
4. RPC `aplicar_cambio_plan(enrollment_id, to_plan_id, source, …)` — `FOR UPDATE` sobre la inscripción, actualiza plan y cuota, **solo afecta el próximo cobro** (nunca uno pagado; el abierto sin pago, solo si así se decide), escribe la fila de log. Una sola transacción.
3. `attendance_sheet_intake` — como `enrollment_form_intake`: foto en el bucket, `extracted` jsonb, `status` (`por_revisar`/`guardada`/`descartada`), quién la mandó, equipo y fecha detectados, revisión obligatoria.
4. Identificación de entrenador por teléfono: extender el RPC de staff (`wa_identify_staff_admin_by_phone` solo cubre admin) con rol `coach` (`school_members`, 8 en Dynasty). **Verificado:** el entrenador NO determina el equipo: `team_coaches` tiene 81 filas, los 8–9 entrenadores están asignados a los 10 equipos. El equipo se deduce de la planilla (ver «De qué equipo es la planilla»).

#### De qué equipo es la planilla (el coach lo es de todos)

Como el remitente no dice el equipo, se deduce en cascada y solo se pregunta si queda ambiguo:

1. **Nombres de la hoja contra los rosters (señal principal).** El OCR saca los nombres; cada deportista está en un equipo. Si ≥70 % de los nombres reconocidos son de UN equipo, ese es. No depende de quién la manda ni de lo que diga el encabezado.
2. **Encabezado de la hoja** (nombre del equipo/grupo y fecha) como confirmación o desempate.
3. **Horario:** `teams.schedule` (día, hora, lugar; 9 de 10 equipos lo tienen, JUVENIL MAYORES FEMENINO no) contra la hora del mensaje. Sirve de desempate y para la **fecha de la sesión** cuando la hoja no la trae (si manda la foto el martes a las 21:00, la sesión es la de hoy).
4. Si dos equipos empatan o ninguno pasa el umbral → pregunta con botones: «¿De qué grupo es? [INTERMEDIO] [NUEVA ERA] [Otro]».

Casos de cuidado: hay franjas simultáneas en lugares distintos (martes 17:00 NUEVA ERA en el Coliseo y MENORES FEMENINO «White» en la cancha del Nido del Colibrí) y equipos con subgrupos (`group`: Origen, White) — el cruce por nombres los separa, el horario no. Una hoja con dos equipos mezclados se parte por rosters en dos sesiones.

**Lista numerada (camino 2):** como el bot no sabe a qué coach le toca qué grupo, **la inicia el coach** («lista»); el bot responde con los grupos cuya franja está activa ±2 h (normalmente 1–3) como botones, y manda la lista numerada del elegido. Nada de mensajes proactivos a los 8 coaches.

Quién tomó la lista: `marked_by` = el coach que mandó el mensaje (sirve para saber quién dio la clase, aunque no esté «asignado»).

Sin migración (BFF/frontend): OCR de planilla (nuevo prompt sobre `ocr.service.ts`), rama de coach en `whatsapp-queue.job.ts`, lista numerada del bot, resumen con botones, aviso a la familia, bandeja «Planillas por revisar», reporte de cambios de plan.

**Orden:** (1) identificar coach + foto de planilla → asistencia real desde la próxima semana; (2) cálculo en sombra; (3) aviso a la familia; (4) pasar a `auto` cuando Milena valide la regla con un mes de datos.

## 4. Orden de entrega (una pasada, sin ramas por fases)

1. Puerta única + quitar el comodín «familia» (3.1) — cambia lo que más se ve.
2. Comprobante con deportista y mes (3.3) — es plata.
3. Mini-registro completo (3.2).
4. SLA, planes, personales, anti-repetición (3.4).

Pruebas: simulador existente (`simularEnvios`) con las conversaciones reales de este informe como casos, más `npm run migrations:check` si hay migración (no se prevé: `contact_kind='personal'` ya existe).

## 5. Decisiones abiertas

1. ¿Botones primero (propuesta) o seguir con texto libre y solo corregir las dos reglas?
2. ¿Alguna pregunta de más para el prospecto? (ej. «¿cómo nos conociste?» ya existe como `how_heard`).
3. Horario para el SLA de 2 h: ¿el de atención de Dynasty (4–9 p. m.)?
