# Spec — Asistencia rápida: auto-selección, torniquete y check-in por carnet

**Proyecto:** SportMaps · **Autor:** Brayan + Claude · **Fecha:** 2026-09-02 · **Versión:** 1.3
**Alcance:** que el coach pase lista en segundos y, donde se pueda, que ni siquiera tenga que hacerlo — el deportista queda marcado presente al llegar, y la AUSENCIA se convierte en la señal valiosa: retención y cobranza, no solo velocidad operativa.

---

## 0. Resumen ejecutivo

Hoy pasar lista es lento por dos razones separadas, y la solución no es la misma para las dos:

1. **La pantalla del coach no ayuda.** Arranca en blanco, mezclando 3 modalidades (equipo/oferta/sesión personal), y dispara hasta 5 llamadas de red antes de mostrar un roster. Esto se arregla 100% en frontend — sección 1.
2. **El dato de "quién llegó" ya existe en dos lugares y no llega a ningún lado.** Hay lectores de huella ZKTeco en vivo en 3 escuelas generando ~150 eventos identificados por día, y hay un carnet digital con QR único por atleta — y ninguno de los dos toca `attendance_records`. Esto no es "construir algo nuevo", es conectar lo que ya está pagado y funcionando — secciones 2 y 3.

**El hallazgo que cambia la prioridad:** de los ~1.362 deportistas de la plataforma, solo 39 tienen cuenta y celular propio. Los otros 1.323 (886 niños + 437 sin cuenta) no pueden "escanear un QR con su celular" — hay que invertir el gesto: alguien del staff escanea el carnet DEL deportista, no al revés.

**Lo que se agrega en esta versión (v1.1):** el spec original optimizaba solo el lado de marcar PRESENTE. El dato que de verdad mueve la aguja de negocio es la AUSENCIA — quién no llegó, y qué se hace con eso. Sección 4 (pieza nueva) conecta la asistencia directo con retención (alerta de deserción) y con cobranza (gatillo de renovación cuando se acaban las sesiones del plan) — reusa el spec de cobranza (`docs/specs/cobranza-vencidos-estados-y-alertas.md`), no inventa un tercer canal de aviso.

---

## 1. Pieza A — Auto-selección de sesión (frontend, sin backend)

### 1.1 Diagnóstico verificado

`frontend/src/pages/CoachAttendancePage.tsx`:
- `selectedItem` arranca en `''` — cero preselección. El coach ve un `<Select>` vacío que mezcla `team:`, `offering:`, `session:` (PT personalizado).
- Hasta 5 queries antes de poder pedir el roster: `coach-teams`, `school-offerings`, `coach-plan-sessions` (BFF), `coach-pt-sessions` (BFF) — recién con `contextType`+`contextId` arrancan `attendance-roster` y `attendance-session`.
- Lo que YA funciona y no se toca: guardado batcheado en un solo POST, botón bulk "Todos presentes", badge de mora que no bloquea asistencia, retroactivo de 7 días para el coach.

**La heurística obvia ("auto-seleccionar si el coach tiene un solo equipo") no sirve para todos por igual** — verificado en vivo:

| | Equipos por coach (promedio) | `attendance_sessions` programadas hoy |
|---|---|---|
| Dynasty | 9 de 11 (asignación intencionalmente "todos a todos") | 0 |
| Resto de escuelas | 2.7 | Sí las usan |

### 1.2 Diseño — dos señales, sin tocar la asignación coach-equipo

1. **Si hay sesión programada hoy** (`attendance_sessions`/horario PT, dato que ya se consulta) → auto-seleccionar, aterrizar directo en el roster. Cubre a la mayoría de las escuelas ya mismo.
2. **Si no hay sesión programada** (caso Dynasty) → sugerir el último equipo que ESE coach usó ese mismo día de la semana (localStorage, sin backend), con el resto de sus equipos abajo, buscable.

Mockup de las 3 pantallas (A: sesión detectada, B: sin sesión/Dynasty, C: roster canónico): **[Asistencia del Coach](https://claude.ai/code/artifact/8f4dfb1d-35f2-4848-8f3e-0fbcd9961f11)**.

**Costo/riesgo:** bajo. Sin migraciones, sin RLS, sin BFF nuevo (salvo que se decida el endpoint compuesto de la sección 1.3 opcional). Se puede probar directo en Dynasty y en una escuela chica.

### 1.3 Opcional, no bloqueante
Endpoint compuesto en el BFF (`GET /attendance/today`) que devuelva sesión+roster en una sola llamada en vez de 4 de setup + 2 de datos. Ahorra segundos reales de red; se evalúa después de medir el impacto de 1.1-1.2. Deja de ser puramente opcional si se aprueba el modo offline de la sección 6 — ahí sí conviene tenerlo.

### 1.4 Asistencia por excepción — el ahorro más barato de todos

Hoy "Todos presentes" es un botón que el coach tiene que tocar. Moverlo a ser el estado CON EL QUE CARGA el roster reduce el trabajo de marcar ~20 nombres a solo destildar a los ausentes — sin escáner, sin torniquete, sin carnet, nada de eso.

Dos versiones, distinto costo:
- **Versión base (de verdad cero backend, entra en la Fase 1):** el roster carga siempre con todos en "presente"; el coach destilda quien falta. Punto de atención: en un equipo con asistencia real baja, esto obliga a destildar a la mitad — no es gratis en todos los casos.
- **Versión refinada (un query liviano nuevo, no está en el roster hoy):** condicionar el default a si ese equipo tuvo ≥85% de asistencia en sus últimas sesiones — agregar por `team_id`/`context` sobre `attendance_records`, cacheable. Se evalúa después de medir si la versión base genera fricción real en equipos de baja asistencia.

Combinado con 1.2: sesión auto-seleccionada + roster pre-marcado = pasar lista en el tiempo que toma abrir la pantalla y tocar Guardar.

---

## 2. Pieza B — Puente ZKTeco → asistencia automática

### 2.1 Lo que ya existe (verificado en vivo y en `bff/src/routes/access-adms.ts`)

| | |
|---|---|
| Escuelas con torniquete ZKTeco (F22) instalado | GYM RM, Dreamers Gymnastics, Club Campestre Demo — 2 dispositivos c/u |
| Eventos de acceso, últimos 7 días | 1.082, de los cuales 645 con atleta identificado |
| Atletas con huella/tarjeta vinculada (`zk_user_mappings`) | 140, en esas 3 escuelas |

El BFF ya recibe el ATTLOG real del F22, valida el acceso y hasta trackea el banco de horas de Dreamers (`trackHourBankVisit`). **`bff/src/routes/attendance.ts` tiene CERO referencias a `access_events`** — el dato de "entró por la puerta, identificado" no le llega a la pantalla de asistencia de ningún coach.

### 2.2 Diseño — corregido tras leer `POST /session` completo

Cuando llega un `access_event` con atleta identificado (`user_id` o `unregistered_athlete_id` no nulos) y `access_granted = true`:
1. Buscar/crear la sesión de hoy de ese atleta — **reusar `findTeamSessionOfDay` tal cual**, no reinventar el matcheo (mismo criterio que ya usa `trackHourBankVisit` con `enrollmentId` para el banco de horas).
2. Si hay match, marcar `attendance_records` = presente, `check_in_method = 'turnstile'`.
3. Si no hay sesión clara (varias disciplinas simultáneas, como en Dreamers), no adivinar — dejar sin marcar y que el coach lo confirme manualmente. Nunca inventar una sesión.

**Corrección importante (encontrada leyendo `POST /session` completo):** el paso 2 NO es un INSERT simple. `POST /session` no solo marca presente — descuenta el crédito del plan (`findCreditEnrollment`/`moveCredit`), consume reservas (`consumeBooking`), y dispara los avisos de hito de plan (`avisarHitoDePlan`, ver 4.4 — YA EXISTE). Un insert directo a `attendance_records` dejaría al atleta marcado presente **sin descontarle la clase**, y sin el aviso de "última clase" cuando corresponda — rompe el sistema de créditos que ya funciona. La Fase 2 real es extraer esa lógica de crédito+aviso del handler HTTP a una función de servicio reusable, y llamarla desde acá — no escribir un camino paralelo. Ver también el `check_in_method` correcto: la tabla ya trae un CHECK que solo permite `'manual' | 'turnstile' | 'qr'` (no `'biometric'`/`'qr_card'` como se escribió en la v1.1 de este spec) — el esquema ya anticipaba esta pieza.

**Costo:** cero hardware nuevo (ya está comprado e instalado). Sí es un refactor real de un archivo que hoy recibe tráfico en vivo de 3 escuelas — no es "conectar dos cables", es meterse en el circuito de facturación por sesión con cuidado.

---

## 3. Pieza C — Check-in por QR del carnet digital

### 3.1 Lo que ya existe

`athlete_id_cards` (mig. `20260424000002`): `qr_token uuid` único, no enumerable, uno activo por atleta. `AthleteIdCard.tsx` ya soporta `face: 'front' | 'back'` (atrás = datos de emergencia/médicos). `AthleteCardPublicPage.tsx` es la página pública que abre el QR — hoy solo renderiza y descarga el **frente** (`html2canvas` sobre un solo `cardRef`, sin toggle de cara).

**El cuello de botella real, verificado en vivo:**

| | |
|---|---|
| Carnets emitidos hoy | **10**, en 3 escuelas |
| Deportistas que necesitarían uno | 1.323 (886 niños + 437 sin cuenta) |
| Con foto cargada (`avatar_url`) | 96/886 niños, 123/437 sin cuenta |

**Corrección tras revisar [[project_carnets_digitales]]: esto ya es un gap CONOCIDO y manejado, no uno nuevo.** La tabla solo admite `child_id` XOR `profile_id` — sin `unregistered_athlete_id` — y `list_school_athletes_for_card_issue_v2` ya lista a los 437 sin cuenta marcados `issuable=false`, a propósito, para que el conteo de cobertura cuadre. No es un bug: es una limitación de diseño ya documentada. Sigue bloqueando el check-in por QR para ese tercio — ver D1 — pero no hay que "descubrirla", hay que decidirla.

### 3.2 Diseño

**Corrección importante: la emisión en bulk YA EXISTE — el gap es 100% adopción, no desarrollo.**

`SchoolCardsAdminPage.tsx` ya tiene, desde el rediseño de julio (5 fases, ver [[project_carnets_digitales]]): filtros por equipo/sede/estado, checkboxes + "seleccionar todos sin carnet", emisión en lote (loop de `issue_athlete_id_card`, sin exigir foto — `photo_url` es nullable), barra de cobertura X/Y, reverso con toggle en el preview de emisión, y `shareCard()` que ya manda el link público al padre por WhatsApp. El frontend ya llama a la v2 corregida de la RPC de listado (confirmado en código, no en v1). **Nadie lo ha corrido a escala: 10 carnets emitidos contra 1.323 posibles.**

Fase 3 deja de ser "construir la emisión masiva" y pasa a ser un empujón operativo: decidir si se corre un lote por escuela (empezando por las del piloto), si se agrega al flujo de onboarding de escuela nueva, o si se le pide a cada admin que lo haga — no es código, es adopción, el mismo patrón que ya vimos con `late_fee_enabled` (4/368) y `reminder_enabled`.

Lo que sí falta construir:

1. **El camino principal para tomar asistencia es un escáner DENTRO de la app** (no la cámara del teléfono) — el coach abre "tomar asistencia", apunta la cámara integrada a cada carnet en fila, sin salir de esa pantalla. Como ya está autenticado por estar dentro de la app, no depende de que la sesión se comparta con un navegador externo.
2. **Fallback — alguien escanea con la cámara normal del celular y cae en `AthleteCardPublicPage`:**
   - Sin sesión de staff → el carnet de siempre (dos caras, ver punto 3), sin acciones. Con un botón chico "¿Sos del staff? Iniciá sesión" que lo devuelve al mismo carnet ya con el panel habilitado — nunca falla en silencio.
   - Con sesión de staff de esa escuela → panel de acciones en vez del carnet plano: **Marcar asistencia** (mismo resolver de la sección 5), **sesiones tomadas** (`plan.sessions_used`/`max_sessions`, ya calculado, mismo dato de `CoachAttendancePage`), **estado de pago** (`payment_status`, mismo badge ya existente), link a la ficha completa.
3. **Descarga de dos caras — más chico de lo que parece.** El toggle `face='front'|'back'` YA existe y ya se usa en el preview de emisión del admin (`SchoolCardsAdminPage.tsx`). Lo único que falta es pasarlo también a `AthleteCardPublicPage.tsx` — la página a la que en realidad llega el padre al escanear el QR — que hoy solo renderiza el frente. Es cablear un prop que ya existe, no construir la cara trasera de nuevo.

### 3.3 Seguridad

- `AthleteCardPublicPage` sigue siendo pública y de solo lectura para cualquiera sin sesión — **eso no cambia**.
- La escritura (marcar asistencia) exige sesión de staff de esa escuela, verificada en el endpoint, nunca en el cliente — mismo patrón que el resto del proyecto (BFF/RPC con `is_school_admin`/rol coach, nunca confiar en lo que mande el frontend).
- `qr_token` ya es un UUID no enumerable — nadie adivina el carnet de otro atleta escaneando al azar.
- Compartir el link del carnet nunca alcanza para marcar asistencia por sí solo — hace falta la sesión de staff, no el link.

---

## 4. Pieza D — Ausencia como evento, y gatillo de cobranza (nueva en v1.1)

**CONSTRUIDA 2026-09-02.** `mark_session_absences(session_id)` (mig. `20260902112920`) hace 4.2+4.3 completo: marca `absent`/`no_show` a quien tenía inscripción activa sin registro, avisa al padre/atleta, y escala al dueño de la escuela al cruzar `school_settings.absence_alert_threshold` (default 2, mig. `20260902112738`) ausencias seguidas — solo una vez, al cruzar, no en cada ausencia posterior. La llaman tanto `PATCH /session/:id/finalize` (BFF) como `auto_finalize_stale_sessions()` (cron, versionada de paso — antes vivía como drift sin marcar nada). Idempotente por `NOT EXISTS`. 4.4 (gatillo de renovación) ya estaba construido, ver nota más abajo.

El resto del spec optimiza marcar PRESENTE. El dato que de verdad importa para retención y para plata es la AUSENCIA — hoy no genera nada: ni aviso al padre, ni alerta al admin, ni conexión con cobranza.

### 4.1 El gancho ya existe, pero no hace lo que hace falta

Cron `auto-finalize-stale-sessions` (55 4 * * *, activo) → `public.auto_finalize_stale_sessions()`: marca `attendance_sessions.finalized = true` para sesiones de días anteriores que nadie cerró. **Verificado en su definición: solo toca `attendance_sessions`, nunca mira `attendance_records`.** No genera ausencias, no compara contra el roster esperado — el gancho para "cerrar el día" ya existe, la lógica de detectar quién faltó no.

### 4.2 Diseño — detectar la ausencia

Al finalizar una sesión (manualmente por el coach, o por el cron de arriba si nadie la cerró):
1. Tomar el roster esperado de esa sesión (mismo universo que ya arma `attendance-roster`).
2. Restar quienes tienen `attendance_records` de esa sesión (presente/tarde/excusado).
3. El resto → insertar `attendance_records` en `ausente`, `check_in_method = 'no_show'`.
4. Emitir evento al outbox (`notification_deliveries`, ya en vivo) → aviso al padre: *"Juan no llegó hoy al entrenamiento de las 4pm"*. Tono informativo, no acusatorio — mismo criterio que ya se usa en los recordatorios de pago.

### 4.3 Escalación — ausencias consecutivas

N ausencias seguidas del mismo atleta → aviso al admin de la escuela ("deportista en riesgo"). **El umbral (N) va en `school_settings`, no hardcodeado** — mismo patrón que `payment_grace_days`/`reminder_days_before`: cada escuela decide qué tan sensible quiere la alerta. Default sugerido 2, a validar con el piloto.

### 4.4 Gatillo de renovación — YA EXISTE, corregido tras leer `attendance.ts`

**Esto no hay que construirlo — ya está en producción.** `avisarHitoDePlan('ultima', ...)` en `bff/src/routes/attendance.ts` (dentro de `POST /session`) ya dispara exactamente cuando se consume la última sesión de un plan: notifica al padre (o al atleta adulto) in-app — *"⏳ Se acabaron las clases del plan... Renueva para seguir entrenando sin interrupciones."* También cubre `excedida` (clase por encima del plan) y `vencida` (plan ya vencido). Es literalmente la pieza D.4 tal como se pensó, solo que ya vive en el camino manual.

**Lo único pendiente:** que el check-in por torniquete/QR pase por ESTA MISMA lógica (sección 5) para heredar el aviso gratis, en vez de reimplementarlo. Confirma además por qué el resolver compartido no puede ser un INSERT simplificado — perdería este aviso, entre otras cosas (ver bloqueo de la Fase 2 más abajo).

Argumento de venta a las escuelas, ya construido y solo hay que extenderlo a más canales de check-in: no es "pasar lista más rápido", es "el sistema avisa solo cuando alguien está por vencerse, antes de que se te vaya sin renovar".

---

## 5. Resolver compartido

Piezas B, C y D llaman al mismo resolver ("marcar presente/ausente a este atleta en su sesión de ahora"), no sistemas paralelos:
- Entrada: atleta identificado (por `zk_user_id`→mapeo, o por `qr_token`→carnet) + escuela + timestamp.
- Busca sesión de hoy de ese atleta con margen horario razonable.
- Si hay match único → marca presente, `check_in_method` distingue el origen (`turnstile` / `qr` — únicos valores que el CHECK de `attendance_records` admite hoy además de `manual`; `no_show` de la pieza D necesita sumarse al CHECK con una migración chica).
- Si hay ambigüedad o no hay sesión → no marca nada, queda para que el coach lo resuelva a mano (igual que hoy).
- **Doble check-in el mismo día — resuelto:** gana el primer scan; los siguientes quedan solo como evento de log, no reabren ni duplican el registro de asistencia. No vale la pena una lógica más fina para esto.
- `check_in_method` queda abierto a un valor futuro `'nfc'` (ver sección 7) sin cambiar el resolver — es el mismo contrato, otra fuente de identificación.
- **Regla dura (D4):** el check-in registra asistencia siempre; el estado de mora viaja como dato (igual que hoy el badge en `CoachAttendancePage`), nunca como bloqueo. Un atleta con plan vencido igual queda marcado presente — bloquearlo mataría la señal que dispara el gatillo de renovación de 4.4 justo cuando más hace falta.

---

## 6. Modo offline del roster

Muchas canchas y coliseos tienen señal mala. Vale la pena escribirlo como fase propia y no dejarlo "opcional" indefinidamente — pero hay que ser honesto con el costo: no es trivial solo por tener el endpoint compuesto de 1.3. Ese endpoint ayuda del lado de LECTURA (menos round-trips para ver el roster); el problema real está del lado de ESCRITURA — encolar el POST de asistencia mientras no hay red y sincronizar al reconectar, con su caso de conflicto (el mismo coach guardó desde dos dispositivos, o el roster cambió mientras estaba offline).

Alcance mínimo razonable:
1. Cachear el roster del día al abrir la pantalla (o al abrir la app, para el primer uso del día).
2. Guardar el intento de guardado en IndexedDB/local si falla el POST por red, con `client_generated_id` para poder reintentar sin duplicar.
3. Reintentar automático al recuperar señal; avisar al coach si sigue sin poder sincronizar después de X minutos, en vez de fallar en silencio.
4. Conflicto: gana el guardado con `updated_at` más reciente — mismo criterio que ya se usaba para este caso en la v1.0 del spec de cobranza (asistencia offline-first, ahí quedó fuera de alcance; acá si se aprueba, es donde vive).

---

## 7. Plan de fases

| Fase | Qué | Depende de |
|---|---|---|
| 1 | Auto-selección de sesión + asistencia por excepción versión base (piezas A) — frontend puro | Nada. Se prueba ya en Dynasty + 1 escuela chica |
| 2 | Resolver compartido + puente ZKTeco (pieza B) | Nada nuevo — hardware y eventos ya existen |
| 3 | Correr la emisión masiva YA EXISTENTE, escuela por escuela (piloto primero) — operativo, no desarrollo | Resolver D1 antes de prometerle carnet al tercio sin cuenta |
| 4 | Escáner in-app + panel de acciones en el carnet público (pieza C.2) — **CONSTRUIDO 2026-09-02, completa** | Fase 2 (resolver) + Fase 3 (tokens emitidos) |
| 5 | Cablear el toggle de dos caras en `AthleteCardPublicPage` (pieza C.3) | Independiente, se puede adelantar en cualquier momento |
| 6 | Ausencia como evento + escalación a admin (pieza D.1-D.3) | Fase 2 (resolver) — necesita saber quién SÍ llegó para inferir quién no |
| 7 | Gatillo de renovación por sesiones agotándose (pieza D.4) | Fase 6 + que exista la escalera de cobranza (`docs/specs/cobranza-vencidos-estados-y-alertas.md`) |
| 8 | Modo offline del roster (sección 6) | Fase 1 (endpoint compuesto ya no es opcional si se aprueba esta fase) |

**Piloto sugerido:** Dynasty y GYM RM para el escáner in-app (ya tienen volumen de atletas); GYM RM y Dreamers para el puente ZKTeco (ya tienen el hardware).

---

## 8. Decisiones — resueltas (2026-09-01)

- **D1 — CONSTRUIDO 2026-09-02.** Migración `20260902113317`: esquema + `issue_athlete_id_card` (3er tipo) + `list_school_athletes_for_card_issue_v2` (issuable=true) + `verify_athlete_id_card_public` (3ra rama en el QR) + `list_athlete_id_cards` (panel admin). Frontend (`SchoolCardsAdminPage.tsx`) actualizado para mandar `p_unregistered_athlete_id`. **Emisión masiva corrida para Dynasty el mismo día: 498 carnets nuevos (483 niños + 11 adultos + 4 sin cuenta) — de 10 a 504 carnets activos en toda la plataforma.** Decisión original, para contexto: Mismo patrón XOR que ya usan `payments`/`memberships`, migración chica. La alternativa ("que se registren primero") repite la fricción de onboarding que ya cuesta cara — las escuelas que llevan Excel no van a registrar 437 cuentas para poder emitir carnets. Además, el carnet puede ser el incentivo de registro, no el premio: el padre escanea el carnet del hijo sin cuenta, ve los datos, y ahí se le ofrece "reclamá este perfil" — mismo flujo de pre-registro que ya existe en el QR de pago. Emitir primero, convertir después. Desbloquea la Fase 3 completa.
- **D2 — RESUELTO: sí, login inline.** Costo: un botón. Riesgo: cero, porque la escritura ya se valida en el servidor pase lo que pase en el cliente. La alternativa (carnet siempre de solo lectura) obliga al coach que llegó ahí por accidente a salir, abrir la app y volver a escanear — falla en silencio en la práctica aunque no técnicamente.
- **D3 — RESUELTO: default 2, configurable por escuela.** No se deja sin default: `late_fee_enabled` está en 4/368 — nadie configura nada proactivamente si el default es "apagado". Un setting sin default es un setting muerto. Default 2 en `school_settings`, cada escuela lo sube si lo siente agresivo.
- **D4 — RESUELTO: no bloquea, nunca.** Ya decidido en la asistencia manual; se traslada tal cual. Regla para el resolver (sección 5): *el check-in registra asistencia siempre; el estado de mora viaja como dato, nunca como bloqueo.* Razón adicional además de la ya conocida: el gatillo de renovación de 4.4 depende de que el check-in ocurra — bloquear al vencido mataría la señal de cobranza justo cuando más se la necesita.
- **D5 — RESUELTO: un solo mecanismo por ahora.** 39 personas no justifican un segundo camino. El staff les escanea el carnet como a cualquiera; el QR de sesión proyectado (sección 10) queda en espera hasta que una escuela de adultos lo pida explícitamente. Construir dos caminos redundantes para el 3% de la base es el mismo patrón de sobre-construir sin validar adopción que ya se vio con `late_fee_enabled` y con los carnets mismos.
- **Fase 4 (escáner in-app + panel C.2) — CONSTRUIDO 2026-09-02, completa.** `checkInByCardToken()`/`POST /checkin-by-card` en `bff/src/routes/attendance.ts` resuelve por `qr_token`, valida estado/vigencia del carnet y delega en `checkInPresenceFromEvent()` — mismo resolver que el torniquete, ningún INSERT paralelo. Dos entradas al mismo endpoint:
  1. **Escáner in-app**: `CoachCheckInScanPage.tsx` (`/coach-attendance/scan`, botón "Escanear carnet" desde `CoachAttendancePage.tsx`) usa `@capacitor/barcode-scanner` (fallback web con `html5-qrcode`, corre en navegador y no solo en build nativo).
  2. **Panel de staff en el carnet público (D2)**: `AthleteCardPublicPage.tsx` detecta sesión activa de rol staff (`owner`/`super_admin`/`admin`/`school_admin`/`coach`) y muestra un botón "Marcar asistencia"; si no hay sesión, ofrece login inline (email+password, colapsado detrás de un link para no ensuciarle la vista a un padre que solo quiere ver el carnet de su hijo) — así el staff que escanea con la cámara normal del teléfono (no la app) también puede marcar asistencia sin salir del navegador.

  **Gotchas reales encontrados en prueba:**
  - El import de `@capacitor/barcode-scanner` tiene que ser dinámico (`await import(...)` dentro del handler de click), no top-level — importado top-level pisaba el singleton de React en una recarga dura de `/coach-attendance/scan` (`Cannot read properties of null (reading 'useEffect')`). Verificado con Playwright: recarga dura + clic con cámara falsa, sin errores.
  - **Hueco de seguridad real encontrado y cerrado antes de exponer el panel:** `checkInByCardToken()` no comparaba el `school_id` del carnet contra la escuela del que llama — cualquier coach autenticado (de cualquier escuela) podía marcar asistencia de un atleta de OTRA escuela con solo conocer/escanear su `qr_token`. Se agregó `requestingSchoolId` obligatorio + outcome `wrong_school`, mismo patrón que ya usa `session.school_id !== req.schoolId` en el resto de este archivo. El panel llama con `x-school-id` explícito (`data.school.id`, la escuela DEL CARNET) en vez de confiar en el `_schoolId` global de `bffClient` — evita el caso borde de un coach multi-escuela que llega a esta página sin haber "entrado" antes a esa escuela en el contexto normal de la app.
  - Verificado con Playwright + credenciales reales (`pettrust9@gmail.com`, coach de Dynasty): vista anónima ok, login inline revela el panel, clic en "Marcar asistencia" dispara el request (falla con toast prolijo porque el BFF local está caído — sin crash de página).

## 9. Descartado explícitamente (para que nadie lo vuelva a proponer sin este contexto)

- **Reconocimiento facial por foto/cámara grupal.** Con 886 niños en la base, biometría facial de menores es un problema legal y de confianza (datos sensibles de menores, consentimiento, habeas data) que no compensa el ahorro operativo frente a lo que ya cubre el carnet QR + torniquete. No se evalúa para este spec.

## 10. Opciones futuras, no priorizadas

- **NFC en el carnet.** Un sticker NFC en el carnet físico (o en el bolso del niño) haría el check-in con un tap del teléfono del coach — más rápido que enfocar un QR con niños en fila y poca luz. El resolver compartido (sección 5) ya deja espacio para `check_in_method = 'nfc'` sin rediseñar nada; no entra en el plan de fases todavía.
- **QR de sesión proyectado, para los 39 adultos con cuenta propia** (gimnasios tipo GYM RM): un QR de la sesión del día en pantalla o poster en la entrada, el adulto lo escanea logueado y queda marcado — mismo patrón que el QR de inscripción (`/join/<slug>`), apuntando al resolver de la sección 5. Ver D5.
- **Kiosko fijo en la recepción** (una tablet montada) para escuelas con mostrador, en vez de depender del celular del coach — mismo backend y mismo resolver, solo cambia qué dispositivo sostiene la cámara.
- **Confirmación al padre cuando el hijo hace check-in** ("Juan llegó a las 4:02 pm") — distinto de la alerta de ausencia (sección 4): esto es la señal positiva, reutiliza el mismo outbox. No es crítico, es un plus de tranquilidad para el padre.
- **Prioridad entre señales** en una escuela que tenga torniquete Y carnets a la vez — el resolver ya lo resuelve por "gana el primer scan" (sección 5); esto queda solo como nota operativa, no como decisión técnica pendiente.

---

## 11. Pieza E — Importar asistencia de papel por foto (propuesta, sin construir)

Caso concreto: Dynasty toma asistencia a mano en papel mientras el resto de piezas de este spec madura. En vez de perder ese dato o exigirles digitar todo retroactivamente, se puede reusar un patrón que YA existe y funciona en producción.

### 11.1 Lo que ya existe (mismo patrón, otro dominio)

`bff/src/services/ocr.service.ts` → `POST /api/v1/payments/extract-receipt`: recibe una imagen en base64, la manda a un LLM de visión (Groq/OpenAI/Gemini con fallback entre proveedores) y devuelve JSON estructurado — hoy extrae monto/fecha/banco/referencia de un comprobante de pago. Es el mismo mecanismo (`docs/specs/receipt-extraction-v2-glosas.md`: "LLM extrae/reglas deciden + auto-aprobación") que ya resolvió comprobantes; una lista de asistencia en papel es el mismo problema de forma — imagen con texto semi-estructurado que hay que convertir a filas — con otro esquema de salida.

### 11.2 Diseño

1. El coach o admin fotografía la planilla de papel (o sube una foto ya tomada) desde una pantalla nueva, no desde el roster normal.
2. Nueva función de extracción (mismo servicio, prompt distinto): en vez del schema de comprobante, un schema de asistencia — lista de `{nombre_detectado, marca: 'presente'|'ausente'|'ilegible'}`.
3. **Fuzzy-match contra el roster real del equipo/fecha elegido** — la letra manuscrita no va a calzar exacto con `full_name`. Igual que en los comprobantes, todo lo dudoso se manda a revisión, nunca se auto-aprueba solo.
4. **Pantalla de revisión obligatoria antes de guardar** — mismo criterio que comprobantes: "detectamos a estos, confirmá o corregí" — nunca escribe `attendance_records` directo desde la extracción cruda. Los mismos riesgos de un comprobante mal leído (plata) aplican acá a nivel retención/facturación por sesión (créditos de plan, igual que la Pieza D).
5. Pasa por el mismo resolver compartido de la sección 5 en su tramo de guardado — no un tercer camino de escritura a `attendance_records`.

### 11.3 Por qué no entra en el plan de fases todavía

Es una pieza real, no un detalle — nuevo endpoint de extracción, nueva UI de carga+revisión, y depende de que el resolver compartido de la Fase 2 ya esté resuelto (sección 5) para no duplicar la lógica de crédito otra vez. Queda propuesta y documentada; se prioriza si Dynasty (u otra escuela en papel) lo pide, no antes.

---

## 12. Métricas de éxito

- % de asistencias registradas sin que el coach abra el roster manualmente (vía torniquete o QR) en las escuelas piloto.
- Tiempo promedio entre "el coach abre la pantalla" y "la asistencia queda guardada" — antes/después de la Fase 1.
- Carnets con token emitido: de 10 a la cobertura real de la Fase 3.
- Adopción del escáner in-app vs. asistencia manual en las escuelas piloto, a 30 días.
- **Nuevas de la pieza D:** % de ausencias que generan aviso al padre el mismo día; deportistas escalados por ausencias consecutivas que renuevan/vuelven vs. los que se dan de baja; renovaciones que llegan disparadas por el gatillo de sesión agotándose (D.4) vs. las que llegan tarde/después de vencer.
