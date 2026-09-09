# Spec — Asistencia sin excusas: auto-selección, torniquete, carnet y catálogo de canales

**Proyecto:** SportMaps · **Autor:** Brayan + Claude · **Fecha:** 2026-09-08 · **Versión:** 2.0
**Fusiona en un solo documento:** el spec "Asistencia rápida: auto-selección, torniquete y check-in por carnet" (v1.0→1.3, construido en gran parte) + el plan "Asistencia sin excusas" (v1.1, catálogo ampliado de canales). De acá en más este es el único plan de asistencia; no crear un segundo documento paralelo.

**Alcance:** que en una escuela de 60 o de 500 atletas la asistencia quede registrada **en cada sesión** sin depender de que el coach construya la lista a mano. El coach pasa de "armar la lista" a "corregir excepciones". Y cuando de verdad falta marcar, se nota — para el padre, para el dueño de la escuela, y para cobranza/retención.

**Principio de diseño (del plan v1.1, confirmado contra el código):** la lista se construye sola por varios caminos en cascada — biometría/torniquete → tap NFC/QR → confirmación del padre → lista por excepción. Quedarse sin marcar requiere que fallen todos. La presión no viene del admin: viene del padre que no recibe "ya llegó" y del tablero del dueño que muestra la sesión en rojo.

**Arquitectura que lo hace posible — ya construida, no es una aspiración:** `checkInPresenceFromEvent()` (`bff/src/routes/attendance.ts`) es el resolver único que ya usa el check-in por carnet QR (`POST /checkin-by-card`, ver §4). Cada canal nuevo (torniquete, NFC, kiosco, WhatsApp...) es un adaptador que llama a este mismo resolver, no un flujo paralelo. Lo que falta no es "construir el resolver" — es conectarle más canales de entrada.

---

## 0. Métricas de éxito

Fusiona la tabla original (§12 de la v1.3) con la tabla de baseline del plan v1.1. Ninguna de las columnas "hoy" está instrumentada todavía — levantarlas es la Fase 0.

| Métrica | Hoy | Meta |
|---|---|---|
| % sesiones con lista tomada antes del cierre automático | ? (Dynasty: 11/33 las tomó la dueña, no el coach — ver `docs/asistencia-estado-actual-y-mejoras.md` §4) | > 95% |
| % sesiones "vacías" (creadas sin ningún registro) | ? | < 2% |
| Tiempo desde abrir la pantalla hasta guardar (mediana) | ? | < 45 s |
| % de registros que NO marcó el coach a mano (cualquier canal automático) | 0% — ZKTeco no está conectado, ver §3.B | > 60% en escuelas con torniquete/kiosco; > 30% sin hardware |
| Eventos ZKTeco que terminan en `attendance_records` | 0 de ~1.000-1.100/semana (verificado: 1.082 eventos, 645 con atleta identificado, últimos 7 días) | > 90% |
| Tiempo entrada del atleta → "ya llegó" al padre | n/a (no existe el aviso) | < 60 s |
| Carnets con token emitido | 504 de 1.362 (solo Dynasty corrido: 498 nuevos + 10 previos, 2026-09-02) | cobertura real en el resto de escuelas — ver §3.C |
| Adopción del escáner in-app vs. manual (piloto, 30 días) | ? | seguimiento activo |
| Clases no descontadas por sesiones sin lista (COP/semana) | ? | 0 |

---

## 1. Qué ya está construido (resumen — detalle completo en `docs/asistencia-estado-actual-y-mejoras.md`)

| Pieza | Estado | Cuándo |
|---|---|---|
| Auto-selección de sesión (1 sesión programada o 1 equipo → auto) | ✅ Construido | — |
| Asistencia por excepción, versión base (roster arranca en "presente", se destilda) | ✅ Construido | — |
| Escáner in-app de carnet (`CoachCheckInScanPage.tsx`) + panel de acciones en el carnet público | ✅ Construido | 2026-09-02 |
| Resolver compartido `checkInPresenceFromEvent()` (QR ya lo usa; torniquete no) | ✅ Construido | 2026-09-02 |
| Emisión masiva de carnets (bulk, sin exigir foto) + reverso con datos médicos | ✅ Construido | jul 2026 (rediseño), corrido para Dynasty 2026-09-02 |
| Ausencia como evento (`mark_session_absences`) + escalación al dueño por umbral | ✅ Construido | 2026-09-02 |
| Gatillo de renovación en última clase del plan (`avisarHitoDePlan`) | ✅ Ya existía antes de este spec | — |
| Gate de seguridad `assertCoachHasTeamAccess` en las 8 rutas de asistencia por equipo | ✅ Construido | 2026-09-08 |
| Chequeo de escuela en `checkInByCardToken()` (evitaba marcar asistencia de atleta de otra escuela) | ✅ Construido | 2026-09-02 |
| Carga retroactiva de asistencia (coach 7 días, admin sin tope) + reapertura de sesión finalizada | ✅ Construido | 2026-08-17 |
| Endpoint compuesto `GET /attendance/today` | ❌ No construido — sigue en ~5 queries separadas | — |
| Puente ZKTeco → `attendance_records` | ❌ No construido — **el gap más grande, hardware ya pagado** | — |
| Toggle frente/reverso en `AthleteCardPublicPage.tsx` | ❌ No construido | — |
| Modo offline del roster | ❌ No construido | — |
| Importar asistencia de papel por OCR | ❌ Propuesta, no construida | — |
| Mecanismo formal de cobertura del día (sustituto sin editar `team_coaches`) | ❌ No construido | — |
| Tablero "Hoy" / badge "la tomó otra persona" / filtro sesiones vacías | ❌ No construido | — |
| `team_schedule` (horario declarado por equipo, resuelve el caso Dynasty "todos a todos") | ❌ No construido | — |
| Confirmación previa del padre ("¿va hoy?") + aviso "ya llegó" | ❌ No construido | — |

---

## 2. Catálogo completo de mecanismos de captura

Todos alimentan el resolver único de §4. Ningún canal cubre a todos: un niño de 8 años no tiene celular, un adulto no quiere carnet físico, una cancha alquilada no puede atornillar un torniquete. La columna "para quién" es la que decide dónde priorizar cada uno.

### 2.1 El atleta se registra solo

| # | Mecanismo | Para quién | Estado real | Prioridad |
|---|---|---|---|---|
| A1 | **Torniquete ZKTeco (tarjeta/huella/rostro)** | Todos, en sedes propias con puerta (GYM RM, Dreamers, Club Campestre Demo — hardware ya instalado) | Diseñado en detalle (§3.B), **no conectado**: `access-adms.ts` recibe el evento real pero nunca llama al resolver | 🔴 máxima — cero costo adicional, mayor impacto |
| A2 | **Carnet QR** (no NFC — corrección: el carnet actual es `qr_token uuid`, no lleva chip físico) | Niños sin celular, el grueso de la base | ✅ Emisión construida; escáner in-app construido; **falta correr el lote en el resto de escuelas** (solo Dynasty corrido) | 🔴 F-adopción, no desarrollo |
| A2b | **Chip NFC físico en el carnet** (propuesta nueva, no confundir con A2) | Igual que A2, evita apuntar cámara con niños en fila y poca luz | Propuesta — costo ~COP 3-5k/carnet extra en la próxima tanda de impresión | 🟡 evaluar tras medir adopción de A2 |
| A3 | **Sticker NFC/QR fijo en la puerta** | Sub-15+, adultos, coaches | Propuesta | 🟠 |
| A4 | **Kiosco (tablet en la cancha)** | Sedes sin torniquete, todos los niños | Propuesta | 🟠 |
| A5 | **QR dinámico rotativo en la app del atleta** | Atletas/padres con celular | El carnet ya tiene QR pero es **estático** (no rota) — rotarlo es trabajo nuevo | 🟠 |
| A6 | **Pase Apple/Google Wallet** | Adolescentes y adultos con celular | Propuesta | 🟡 |
| A7 | **Geocerca automática** (propone, nunca marca sola) | Adultos, padres que acompañan | Propuesta | 🟡 |
| A8 | **Beacon BLE** | Adultos en canchas cubiertas (GPS falla) | Propuesta — solo Android (iOS no expone BLE al navegador) | 🟡 |
| A9 | **Check-in por WhatsApp** ("llegué") | Escuelas donde WhatsApp es el canal real | Propuesta — **solo como confirmación previa o excepción validada por el coach, nunca como presente automático** (fraude trivial: mandar "llegué" desde la casa) | 🟡 |
| A10 | Wearable/smartwatch | Nicho | Cubierto por A2b/A3 (el reloj es una tarjeta más) | ⚪ |
| A11 | **Huellero USB independiente** | Sedes sin torniquete que quieren biometría | Propuesta — condicionado a §2.4 | 🟡 |
| A12 | **Reconocimiento facial con confirmación explícita** ("¿Eres Valentina? Sí/No") | Todos, el más rápido de todos | Propuesta — **distinto de lo ya descartado en §8** (eso era conteo grupal silencioso por foto; esto es 1 sujeto + confirmación en pantalla, nunca silencioso) | 🟡, condicionado a §2.4 |
| A13 | **Confirmación previa del padre** ("¿va hoy?", 3h antes) | Todos los menores | Propuesta — prellenado, no presencia real; alimenta la lista por excepción | 🔴 |

### 2.2 El coach marca, más rápido

| # | Mecanismo | Estado | Prioridad |
|---|---|---|---|
| B1 | Lista por excepción prellenada (confirmados + ya entraron) | Versión base construida; el prellenado con A13/canales automáticos falta | 🔴 |
| B2 | Toque NFC en Android para marcar (Web NFC) | Propuesta | 🟠 |
| B3 | Escáner QR en ráfaga con sonido de confirmación | Existe uno-por-uno; modo ráfaga continuo falta | 🟠 |
| B4 | Buscador + carnet numérico, fotos grandes | Construido (roster ya tiene buscador) | ✅ |
| B5 | Marcar por voz ("faltó Valentina y Sofía") | Propuesta | 🟡 |
| B6 | Foto de la fila con conteo por visión | Fuera de alcance — biometría grupal, ver §8 | ⚪ |
| B7 | Sesión compartida (2+ coaches marcando a la vez) | Propuesta — hoy ya puede pasar sin coordinación (`marked_by` diverge de `attendance_sessions.coach_id`, ver `docs/asistencia-estado-actual-y-mejoras.md` §4), falta hacerlo explícito | 🔴 |
| B8 | Asistencia desde el reloj del coach | Descartado por costo/beneficio | ⚪ |

### 2.3 Qué canal para qué escuela

| Tipo de escuela | Primario | Respaldo |
|---|---|---|
| Sede propia con torniquete (Dynasty, GYM RM, Dreamers) | A1 torniquete | A13 confirmación + B1 excepción; A2 carnet con el celular del coach |
| Sede propia sin torniquete | A4 kiosco + A2 carnet | A3 sticker; B1 excepción |
| Cancha alquilada, sin infraestructura (Besser) | A13 confirmación + B1 excepción | A3 sticker portátil (el coach lo lleva); B2/B3 con el celular del coach |
| Academia de adultos | A3 sticker + A7 geocerca | A6 pase Wallet; B1 |

### 2.4 Biometría en menores — lo que hay que resolver antes de tocar una huella

- Datos sensibles bajo Ley 1581 de 2012 (Colombia). Para menores: autorización expresa del acudiente, finalidad específica, interés superior del menor — formulario firmado, almacenado, revocable, no un checkbox.
- **Regla técnica no negociable:** las plantillas biométricas viven en el dispositivo (ZKTeco, huellero, tablet) y **nunca** se suben a la base de SportMaps. Lo que llega al BFF es `(device_id, user_id_en_el_dispositivo, timestamp)` — un evento, no un dato biométrico. Así es hoy con ZKTeco; se mantiene para A11/A12.
- **Alternativa siempre disponible:** ningún atleta puede quedar sin poder registrarse por no dar consentimiento biométrico → el carnet QR/NFC (A2/A2b) es obligatorio ofrecerlo.
- A12 facial **solo con confirmación explícita en pantalla**, nunca silencioso — es la distinción con lo descartado en §8.
- Revisión legal antes de construir A11/A12. Si una escuela ya usa huella en su ZKTeco, es deuda de esa escuela; SportMaps debe ofrecerle la plantilla de consentimiento igual.

---

## 3. Piezas técnicas — lo que falta construir, ya diseñado

### 3.A Auto-selección — lo que queda pendiente

Lo construido (auto-selección simple, excepción versión base, buscador) no se toca. Pendiente:

1. **`team_schedule`** `(team_id, weekday, start_time, end_time, court)` — resuelve de raíz el caso Dynasty ("todos a todos", 9 de 11 equipos por coach en promedio, 0 sesiones programadas hoy vs. 2.7 equipos/coach en el resto). Reemplaza la heurística de `localStorage` (que se pierde si el coach cambia de celular) por dato real de backend. UI en `CreateTeamModal`.
2. **`GET /attendance/today`** — colapsar las ~5 queries de arranque en una sola respuesta (sesiones + roster + preferencia + eventos automáticos ya recibidos). Deja de ser opcional si se aprueba el modo offline (§3.H).
3. **Umbral de asistencia histórica** (≥85% → default presente) en vez de solo "mismo día de la semana". Evaluar después de medir si la versión base genera fricción en equipos de baja asistencia.
4. **Sesión compartida (B7):** upsert idempotente por `(session_id, subject_id)`, "Andrés y tú están tomando esta lista", refresco cada 10s.

### 3.B Puente ZKTeco → asistencia automática (el gap más grande)

Lo que ya existe, verificado en vivo: el BFF recibe el ATTLOG real del F22 (`bff/src/routes/access-adms.ts`), valida el acceso, trackea el banco de horas de Dreamers. **`attendance.ts` tiene cero referencias a `access_events`** — el dato de "entró por la puerta, identificado" no llega a ninguna pantalla de asistencia.

Diseño: al llegar un `access_event` con atleta identificado y `access_granted = true`:
1. Buscar la sesión de hoy con `findTeamSessionOfDay` (reusar tal cual, mismo criterio que ya usa `trackHourBankVisit`).
2. Si hay match único → llamar a `checkInPresenceFromEvent()` (§4) con `check_in_method = 'turnstile'`. **No es un INSERT directo**: ese resolver ya descuenta crédito (`findCreditEnrollment`/`moveCredit`), consume reservas, y dispara los avisos de hito de plan (`avisarHitoDePlan`) — un INSERT paralelo dejaría al atleta presente sin descontarle la clase y sin el aviso de "última clase".
3. Si hay ambigüedad (varias disciplinas simultáneas, caso Dreamers) → no marca, el coach lo confirma a mano. Nunca inventar sesión.

Costo: cero hardware nuevo. Es meterse con cuidado en un archivo que hoy recibe tráfico real de 3 escuelas.

### 3.C Carnet — lo que falta

- **Adopción:** correr el lote de emisión masiva (ya construido) en el resto de las escuelas — es trabajo operativo, no desarrollo. Empezar por las del piloto (§9).
- **Toggle frente/reverso en `AthleteCardPublicPage.tsx`:** el prop `face='front'|'back'` ya existe y se usa en el preview de emisión del admin; falta pasarlo también a la página pública a la que llega el padre.
- **A2b chip NFC físico:** evaluado en §2.1, condicionado a medir si el escaneo QR con niños en fila genera fricción real.

### 3.D Ausencia y cobranza — construido, extender a más canales

`mark_session_absences(session_id)` (mig. `20260902112920`) ya marca ausente, avisa al padre y escala al dueño por `school_settings.absence_alert_threshold` (default 2). Lo llaman `PATCH /session/:id/finalize` y el cron `auto_finalize_stale_sessions`. Pendiente:
- El cron corre **una vez al día** (`55 4 * * *`), no cada 30 minutos. Correrlo más seguido (propuesta: cada 30 min) cierra sesiones vencidas el mismo día en vez de al día siguiente — prerequisito para que el tablero "Hoy" (§3.G) muestre estado en tiempo real y no solo al día siguiente.
- Extender el aviso "ya llegó" (positivo, distinto de la alerta de ausencia) a todos los canales automáticos, no solo al manual — ver §3.E.

### 3.E Confirmación previa del padre + "ya llegó" (nuevo)

1. **"¿Va Valentina hoy?"** — notificación 3h antes, un toque Sí/No/Tarde → `status='confirmed'`. También por WhatsApp (A9) respondiendo 1/2/3. La lista del coach arranca prellenada con esto.
2. **"Ya llegó"** — push/WhatsApp al padre en cuanto queda `present`, por cualquier canal. Toggle por escuela y por padre. Es el mecanismo de presión principal del plan.
3. **Digest anti-saturación:** si el padre recibe "¿va hoy?", "ya llegó" y el informe post-entrenamiento el mismo día, agrupar donde se pueda; medir opt-out.

### 3.F Cobertura del día (nuevo, formaliza un gap ya detectado)

`team_coverage(team_id, coach_id, session_date, granted_by)` — deja que un coach cubra un equipo ajeno por un día puntual sin tocar `team_coaches` (que hoy es reemplazo completo vía `syncTeamCoaches`, no incremental — riesgo real de perder la asignación permanente de otro coach). `assertCoachHasTeamAccess` la consulta además de `team_coaches`. Deja rastro auditable de "quién cubrió", y desbloquea que un sustituto califique en el informe post-entrenamiento (ver `docs/specs/evaluacion-post-entrenamiento.md`).

### 3.G Tablero "Hoy" y visibilidad (nuevo)

1. Tablero por franja y cancha: sin lista (rojo) / en curso (quién) / finalizada (por quién) / vacía; qué canales aportaron (ícono torniquete/kiosco/manual); botón "asignar cobertura".
2. Badge "la tomó otra persona" en supervisión e histórico (`attendance_sessions.coach_id` vs. `attendance_records.marked_by` ya pueden divergir hoy, en silencio).
3. Aviso al coach a cargo y al admin cuando el cron cierra una sesión sin registros.
4. Panel de "ausencias escaladas" (hoy es solo push/WhatsApp puntual, se pierde en el flujo).
5. `GET /rate/:teamId` con tendencia (↑↓ vs. mes pasado) en vez de un número suelto.
6. Filtro "sesiones vacías" en `AttendanceHistoryPage.tsx`.
7. Reporte semanal al dueño: "N sesiones sin lista = M clases no descontadas (≈ COP X)".
8. Reporte de canales: % de asistencia por canal (manual vs. automático) por sede — el dato para decidir dónde poner el próximo kiosco/torniquete, y para mostrarle al admin cuántos check-ins de torniquete "se están perdiendo" hoy.

### 3.H Kiosco, stickers, ráfaga, offline (nuevo)

1. **Kiosco:** modo kiosco de la web app en tablet (`/kiosk/:court`), fotos por franja, PIN opcional, confirmación "¿Eres Valentina?", salida bloqueada con PIN de admin.
2. **Sticker NFC/QR:** `POST /checkin/tap`, validación SUN (NTAG 424 DNA) o URL firmada, ventana ±30 min, geocerca opcional. Versión portátil para cancha alquilada.
3. **B3 ráfaga:** cámara abierta, sonido de confirmación por cada scan.
4. **Offline:** cachear roster del día al abrir la pantalla; cola de registros en IndexedDB con `client_generated_id` si falla el POST; reintento automático al recuperar señal; conflicto lo resuelve `updated_at` más reciente (mismo criterio ya usado en el spec de cobranza para este caso).

### 3.I Biometría, proximidad y voz (condicionado a §2.4)

Huellero USB (A11), facial on-device con confirmación (A12), geocerca como propuesta nunca automática (A7), beacons BLE (A8), pase Wallet (A6), voz para el coach (B5). Ninguno entra en el plan de fases hasta cerrar la revisión legal.

### 3.J Importar asistencia de papel por foto (propuesto, sin construir)

Reusa el patrón de `bff/src/services/ocr.service.ts` (extracción de comprobantes de pago): foto de la planilla → LLM de visión con schema de asistencia → fuzzy-match contra el roster real → pantalla de revisión obligatoria (nunca auto-aprueba) → guarda vía el resolver de §4. Depende de que §4 esté resuelto para no duplicar lógica de crédito. Se prioriza si Dynasty (o alguien en papel) lo pide.

---

## 4. Resolver compartido — contrato (ya construido)

`checkInPresenceFromEvent({school_id, subject_id, at, source, device_id, raw_ref})`:
- Entrada: atleta identificado (por `zk_user_id`→mapeo, `qr_token`→carnet, o el canal que sea) + escuela + timestamp.
- Busca la sesión de hoy de ese atleta con margen horario razonable.
- Match único → marca presente, descuenta crédito, dispara avisos de hito de plan. `check_in_method` distingue el origen — hoy el CHECK de `attendance_records` solo admite `'manual' | 'turnstile' | 'qr'`; sumar `'no_show'`, `'nfc'`, `'kiosk'`, `'parent_confirm'`, etc. es una migración chica cuando cada canal se construya.
- Ambigüedad o sin sesión → no marca nada, el coach lo resuelve a mano.
- **Doble check-in el mismo día:** gana el primer scan; los siguientes quedan solo como log, sin reabrir ni duplicar.
- **Regla dura:** el check-in registra asistencia siempre; la mora viaja como dato, nunca como bloqueo — bloquear al vencido mataría la señal que dispara el gatillo de renovación.
- **Tabla `checkin_events` (append-only, auditoría) — pendiente de construir.** Hoy el resolver escribe directo a `attendance_records`; un log crudo de cada evento de cada canal (incluidos los que no matchearon sesión) es lo que falta para poder auditar/depurar el catálogo de §2 a medida que crecen los canales.

---

## 5. Plan de fases unificado

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| 0 | Telemetría (§0) + `checkin_events` + gate `assertCoachHasTeamAccess` (ya en asistencia por equipo) + verificar unique `(team_id, session_date)` + cron de cierre cada 30 min | Nada | Parcial (gate y algunas correcciones de seguridad ya construidas 2026-09-08) |
| 1 | `team_schedule` + `GET /attendance/today` + umbral histórico + sesión compartida (§3.A) | Fase 0 | Auto-selección base y excepción base ya construidas |
| 2 | Puente ZKTeco → resolver (§3.B) | Fase 0 (resolver ya existe) | No construido — máxima prioridad |
| 3 | Adopción del carnet en el resto de escuelas + toggle dos caras (§3.C) | Nada nuevo | Emisión y escáner ya construidos; falta correr el lote |
| 4 | Confirmación previa del padre + "ya llegó" + digest (§3.E) | Fase 1 (team_schedule para el horario de aviso) | No construido |
| 5 | Cobertura del día (§3.F) | Nada nuevo | No construido |
| 6 | Tablero "Hoy" + visibilidad (§3.G) | Fases 2, 4, 5 (usa canales, cobertura y estados) | No construido |
| 7 | Kiosco + sticker NFC/QR + ráfaga + offline (§3.H) | Fase 1 (franja+cancha) | No construido |
| 8 | Biometría, proximidad, voz (§3.I) | §2.4 cerrado con legal | Condicionado |
| 9 | OCR de asistencia en papel (§3.J) | Fase 2 (resolver en uso real) | Propuesto, no priorizado |

**Cruce con el informe post-entrenamiento:** la Fase 0 (cron cada 30 min) y la Fase 5 (cobertura) son prerequisitos de ese spec — usa `finalized_at`, no `closed_at`.

**Piloto sugerido:** Dynasty y GYM RM para torniquete/carnet (ya tienen volumen); Besser para confirmación del padre + sticker portátil (valida el escenario sin infraestructura).

---

## 6. Decisiones

Cerradas en la v1.x del spec (2026-09-01/02), se mantienen tal cual:

- **D1 — Carnet admite atleta sin cuenta (XOR con `unregistered_athlete_id`).** Construido. Emitir primero, convertir la cuenta después.
- **D2 — Login inline en el carnet público para staff.** Construido.
- **D3 — Umbral de ausencias consecutivas: default 2, configurable por escuela.** Construido (`school_settings.absence_alert_threshold`).
- **D4 — El check-in nunca bloquea por mora.** Regla dura del resolver (§4).
- **D5 — Un solo mecanismo de check-in para los 39 adultos con cuenta propia** (el staff les escanea el carnet como a cualquiera). El QR de sesión proyectado (A5 rotativo) queda en espera hasta que una escuela de adultos lo pida explícitamente.

Nuevas, de la fusión con el plan v1.1:

- **D6 — Ningún canal biométrico es obligatorio.** El carnet QR/NFC es la alternativa siempre disponible (§2.4).
- **D7 — A12 facial nunca marca en silencio.** Siempre confirmación en pantalla — distingue esto de lo descartado en §8.
- **D8 — A9 WhatsApp "llegué" nunca marca presente por sí solo.** Solo como confirmación previa (A13) o excepción validada por el coach — el fraude (mandar el mensaje desde la casa) es trivial.
- **D9 — El cron de cierre pasa de una vez al día a cada 30 minutos.** Necesario para que el tablero "Hoy" (§3.G) y las alertas de ausencia lleguen el mismo día, no al siguiente.
- **D10 — `checkin_events` es append-only y no reemplaza `attendance_records`.** Es el log de auditoría de todos los canales, incluidos los que no matchearon sesión; el resolver sigue siendo el único que escribe `attendance_records`.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Escuelas no cargan `team_schedule` | Importar en migración desde `level`/descripción; asistente en onboarding; fallback a preferencia por franja |
| Torniquete/kiosco asigna al equipo equivocado | Cola de pendientes, nunca asignación silenciosa en ambigüedad |
| Sticker NFC/QR copiado y usado desde la casa | SUN rotativo + ventana horaria + geocerca opcional; el "ya llegó" al padre expone el fraude |
| Un niño toca la foto de otro en el kiosco | Confirmación con foto grande; el coach corrige; se reporta la tasa de correcciones |
| Biometría de menores sin consentimiento | §2.4: plantillas solo en dispositivo, consentimiento firmado y revocable, carnet como alternativa obligatoria, revisión legal antes de la Fase 8 |
| Saturación de notificaciones al padre | Digest por sesión, toggles, medir opt-out semanal |
| Coach siente vigilancia | El tablero muestra sesiones y canales, no personas; aviso "sin lista" privado primero |
| `syncTeamCoaches` (delete-all + insert) pierde asignaciones permanentes al armar cobertura a mano | Resuelto por diseño con `team_coverage` (§3.F) en vez de editar `team_coaches` |
| Demasiados canales = mantenimiento | Todos pasan por el resolver único (§4) y quedan en `checkin_events`; un canal se apaga por flag sin tocar el resto |

---

## 8. Descartado explícitamente (para que nadie lo vuelva a proponer sin este contexto)

- **Reconocimiento facial por foto/cámara grupal, silencioso.** Con 886 niños en la base, biometría facial masiva de menores es un problema legal y de confianza que no compensa el ahorro frente a lo que ya cubre carnet QR + torniquete. **No confundir con A12** (§2.1): un sujeto, con confirmación explícita en pantalla, condicionado a §2.4 — sigue evaluándose, no está descartado.
- **Foto de la fila con conteo por visión (B6).** Misma razón, agravada por identificar a varios a la vez sin confirmación individual.
- **Asistencia desde el reloj del coach (B8).** Esfuerzo alto para lo que aporta frente a la app.

---

## 9. Fuentes

- `frontend/src/pages/CoachAttendancePage.tsx`, `CoachCheckInScanPage.tsx`, `AttendanceSupervisionPage.tsx`, `AttendanceHistoryPage.tsx`
- `frontend/src/pages/AthleteCardPublicPage.tsx`, `SchoolCardsAdminPage.tsx`, `components/teams/CreateTeamModal.tsx`
- `bff/src/routes/attendance.ts`, `access-adms.ts`
- `bff/src/services/ocr.service.ts`
- Migraciones: `20260224000032_multi_coach_support.sql`, `20260424000002` (carnets), `20260902110253`, `20260902112738_absence_events_no_show_and_threshold.sql`, `20260902112920_mark_session_absences_and_escalation.sql`, `20260902113317` (carnet 3er tipo)
- `docs/asistencia-estado-actual-y-mejoras.md` (estado verificado línea por línea, 2026-09-08) — complementa este spec, no lo reemplaza
- `docs/specs/cobranza-vencidos-estados-y-alertas.md`, `docs/specs/evaluacion-post-entrenamiento.md`, `docs/specs/receipt-extraction-v2-glosas.md`
