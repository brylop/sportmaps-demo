# Asistencia — estado actual y oportunidades de mejora

Documento de referencia interno. Consolida cómo funciona HOY todo el ciclo de
tomar asistencia (código real, verificado línea por línea el 2026-09-08, no el
spec) y una lista de oportunidades concretas para mejorar la toma y su
visualización. No reemplaza `docs/specs/asistencia-rapida-checkin.md` (el
spec de diseño) — lo complementa señalando qué de ese spec ya está construido.

## 1. Modelo de datos, en una tabla

| Tabla | Para qué |
|---|---|
| `teams` | El equipo. `coach_id` es el coach "principal" legacy (columna vieja, se sigue llenando pero ya no es la única fuente). |
| `team_coaches` | Asignación real coach↔equipo, **muchos a muchos** (`team_id, coach_id, school_id`, `coach_id` → `school_staff.id`). Un coach puede estar en 0, 1 o N equipos. |
| `attendance_sessions` | Una fila por (equipo u oferta) + fecha. Se crea bajo demanda al guardar, no hay que "programarla" antes salvo que sea una clase de plan. `coach_id` = quién **creó** la sesión ese día (no necesariamente el asignado permanente). `finalized`/`finalized_at`/`finalized_by` cierran el día. |
| `attendance_records` | Un registro por atleta por sesión. `status` (`present`/`absent`/`late`/`excused`/...), `marked_by` = quién **realmente marcó ese registro** (puede ser distinto de `attendance_sessions.coach_id`, ver §4). |
| `enrollments` / créditos de plan | Cada "presente" descuenta 1 clase del plan del atleta (o consume una reserva del día si la tenía). El crédito vive en la inscripción con `offering_plan_id`, no en el equipo — un coach asignado solo al equipo igual descuenta del plan del atleta. |
| `school_settings.coach_attendance_teams_only` | Oculta la sección "Planes" para el coach (hoy solo Dynasty). |
| `school_settings.absence_alert_threshold` | Ausencias seguidas antes de escalar al dueño de la escuela (default 2). |

## 2. Cómo se asigna hoy un coach a un equipo/categoría

- **No existe "categoría" como entidad con asignación propia.** Lo que se ve como categoría es el campo `level` del propio equipo (ej. "Sub-15"), un dato descriptivo. La asignación de coach siempre es a nivel `team_id`.
- **UI:** `TeamsPage.tsx` → crear/editar equipo → `CreateTeamModal.tsx`, selector multi "Entrenadores Asignados".
- **Al guardar, `syncTeamCoaches` hace delete-all + insert** — reemplaza toda la lista de coaches del equipo, no es un alta incremental. Riesgo real: si se edita a mano para un caso puntual (ver §5) y no se recuerda la lista original completa, se puede perder la asignación permanente de otro coach del mismo equipo.
- **El coach solo ve, en su pantalla de asistencia, los equipos donde está en `team_coaches`** (filtro del lado del cliente). El admin ve todos, sin filtrar.
- **Caso límite ya documentado (Dynasty):** ahí casi todos los coaches están ligados a casi todos los equipos ("todos a todos", 9 de 11 equipos en promedio) en vez de una asignación acotada (2.7 equipos por coach en el resto de escuelas). Esto **rompe la auto-selección** (ver §3) porque su condición central es "el coach tiene exactamente 1 equipo".

## 3. El flujo completo de tomar asistencia, paso a paso

**Archivos:** `frontend/src/pages/CoachAttendancePage.tsx` (1591 líneas) + `bff/src/routes/attendance.ts` (~2600 líneas).

1. **Carga inicial** — 5 queries en paralelo: equipos del coach, si el modo "solo equipos" está activo, catálogo de ofertas de la escuela, sesiones de plan programadas hoy, sesiones de entrenador personal.
2. **Auto-selección** (construida, no solo diseño — `CoachAttendancePage.tsx:444-488`):
   - 1 sesión de plan programada hoy → se auto-selecciona.
   - Sin sesión programada y el coach tiene **exactamente 1 equipo** → se auto-selecciona ese equipo.
   - Sin sesión programada y **más de 1 equipo** → solo sugiere (no fuerza) el último equipo usado ese mismo día de semana, guardado en `localStorage` del navegador del coach.
   - Si nada matchea, el coach elige a mano entre tarjetas de "Equipos" y "Planes".
3. **Roster por excepción:** arranca con todos marcados "presente"; el coach solo destilda a los ausentes.
4. **Guardado — un solo POST batcheado** (`POST /api/v1/attendance/session`, reemplazó el patrón viejo de 1 POST por atleta). Por cada registro:
   - Si pasa a "presente" y tenía reserva libre del día → la consume, no gasta clase.
   - Si el plan está vencido → se marca presente igual, se avisa al padre ("vencida"), **nunca bloquea por mora**.
   - Si ya no tiene cupos → se marca presente igual, se avisa ("excedida").
   - Si consume la última clase del plan → aviso de renovación ("última").
   - Si pasa de presente a ausente → intenta devolver el crédito o liberar la reserva.
5. **Finalizar sesión** (`PATCH /session/:id/finalize`): bloquea edición y corre `mark_session_absences` — a quien tenía cupo activo sin registro se lo marca ausente, se avisa al padre, se escala al dueño si se cruza el umbral de ausencias seguidas.
6. **Reabrir sesión** (`PATCH /session/:id/reopen`): deshace el cierre dentro de la ventana permitida (el cron nocturno `auto_finalize_stale_sessions` la vuelve a cerrar esa misma noche si sigue con fecha pasada).
7. **Camino alterno construido:** botón "Escanear carnet" → `CoachCheckInScanPage.tsx` → `POST /checkin-by-card` → mismo resolver de créditos que el flujo manual.
8. **Camino NO conectado (el gap más grande):** los torniquetes ZKTeco ya están instalados y generando eventos reales (`bff/src/routes/access-adms.ts`), pero ese archivo todavía no escribe a `attendance_records` — asistencia por torniquete no es automática hoy pese al hardware ya pagado y funcionando.

## 4. Qué pasa si el coach titular no puede ir (sin sustituto)

**No existe ningún mecanismo de "entrenador sustituto" como feature de producto.** Verificado exhaustivamente (sin tabla, columna, endpoint, rol ni UI para eso). Las únicas dos vías reales hoy:

- **A. El admin toma la asistencia él mismo** — ya ve todos los equipos sin filtrar, es la vía de menor fricción y ya sucede en la práctica (en Dynasty, 11 de 33 sesiones las marcó la dueña desde el panel, no un coach).
- **B. El admin edita `team_coaches` a mano** para meter temporalmente al sustituto y revertirlo después — riesgoso porque `syncTeamCoaches` reemplaza toda la lista, no la suma incrementalmente.

Dato curioso a favor de un futuro diseño: `attendance_sessions.coach_id` (quien creó la sesión) y `attendance_records.marked_by` (quien realmente marcó cada registro) **ya pueden divergir hoy** — es un efecto colateral de cómo se guarda el dato, no algo pensado, pero es la semilla de un futuro "quién cubrió esta sesión".

## 5. Hallazgo de seguridad cerrado el 2026-09-08

Ninguna ruta de `attendance.ts` cruzaba `team_coaches` contra el coach que llama — solo rol + `school_id`. Un coach podía, armando la URL/payload a mano, leer o escribir asistencia de un equipo ajeno dentro de su misma escuela. No explotable desde la UI normal (nunca ofrece equipos ajenos), pero el BFF corre con service role y no había gate server-side.

**Cerrado con un helper único** `assertCoachHasTeamAccess(req, teamId)` (bypassa para owner/super_admin/admin/school_admin) aplicado en los 8 puntos de entrada: `GET /session/:teamId`, `GET /roster/team/:contextId`, `GET /rate/:teamId`, `POST /session` (directo y vía `sessionId`), `POST /walk-in` (directo y vía `sessionId`), `PATCH /session/:id/finalize`, `PATCH /session/:id/reopen`.

## 6. Qué del spec de asistencia rápida ya está construido

| Pieza (`docs/specs/asistencia-rapida-checkin.md`) | Estado |
|---|---|
| §1.2 Auto-selección de sesión | ✅ Construido |
| §1.4 Asistencia por excepción (versión base) | ✅ Construido |
| §1.4 versión refinada (umbral 85% histórico) | ❌ No construido |
| §1.3 Endpoint compuesto `GET /attendance/today` | ❌ No construido — sigue siendo ~5 queries separadas |
| §2 Puente ZKTeco → asistencia automática | ❌ No construido (el gap más grande) |
| §3.2 Escáner in-app + panel en carnet público | ✅ Construido |
| §3.3 Toggle frente/reverso en carnet público | ❌ No construido (fase aparte) |
| §4 Ausencia como evento + escalación | ✅ Construido |
| §4.4 Gatillo de renovación en última clase | ✅ Ya existía antes del spec |
| §6 Modo offline del roster | ❌ No construido |
| §11 Importar asistencia de papel por foto (OCR) | ❌ Propuesta, no construida |

## 7. Oportunidades de mejora

### Para la TOMA (flujo, velocidad, confiabilidad)

1. **Mecanismo formal de "cobertura del día"** — dejar que un coach cubra un equipo ajeno por un día puntual sin tocar `team_coaches` (que hoy es reemplazo completo, no incremental). Resuelve el caso de faltas/rotación real y deja un rastro auditable de quién cubrió, en vez de depender de que el admin lo tome o edite la asignación a mano.
2. **Corregir la asignación en escuelas "todos a todos" (ej. Dynasty)** antes de prometerles auto-selección — hoy la condición central (exactamente 1 equipo) nunca se cumple ahí. Asignación acotada por coach (como en el resto de escuelas) es lo que realmente activa el ahorro de clics.
3. **Puente ZKTeco → `attendance_records`** — es la mejora de mayor impacto: el hardware y los eventos ya existen y llegan al BFF, solo falta conectar `access-adms.ts` al resolver de créditos compartido (`checkInPresenceFromEvent`) que el checkout por QR ya usa. Convierte la asistencia de "siempre manual" a "automática por defecto, manual como respaldo".
4. **Endpoint compuesto `GET /attendance/today`** — colapsar las ~5 queries iniciales en una sola respuesta reduce el tiempo hasta que el coach ve algo, sobre todo en conexiones móviles malas (el caso real de una cancha).
5. **Auto-selección más inteligente (umbral de asistencia histórica)** — cuando hay 2+ equipos sin sesión programada, usar más que "el mismo día de la semana" en localStorage (que se pierde si el coach cambia de celular) — por ejemplo el equipo con clase más próxima según horario declarado, o simplemente persistir la preferencia en el backend en vez de solo el navegador.
6. **Modo offline básico del roster** — cachear el roster del día y encolar los registros si se cae la red a mitad de lista (cancha con mala señal), en vez de perder la lista a mitad de camino.

### Para la VISUALIZACIÓN (lo que ve el admin/coach después)

1. **Hacer visible cuándo alguien más tomó la lista.** Hoy `attendance_sessions.coach_id` (quien abrió la sesión) y `attendance_records.marked_by` (quien marcó cada registro) pueden divergir en silencio — ni el admin ni el coach titular ven ninguna señal de "esto lo tomó otra persona". Un badge simple en `AttendanceSupervisionPage.tsx`/`AttendanceHistoryPage.tsx` cerraría el loop del punto 1 de arriba (cobertura).
2. **`GET /rate/:teamId` hoy es solo un número (% presente/total).** Vale la pena mostrarlo con tendencia (¿subió o bajó vs. el mes pasado?) en vez de un dato suelto — mismo patrón que ya usan otros dashboards del producto (flechas ↑↓ en `CoachDashboard`).
3. **Panel de "ausencias que escalaron"** — hoy el aviso al dueño por cruzar el umbral de ausencias seguidas es una notificación puntual (push/WhatsApp) que se pierde en el flujo normal; no hay una vista consolidada de "estos atletas llevan N faltas seguidas" para que el admin actúe proactivamente sin esperar la notificación.
4. **Distinguir visualmente sesión creada vs. sesión con registros reales.** Como la sesión se crea bajo demanda, puede haber sesiones "vacías" (creadas pero sin nadie marcado) que ensucian el histórico — un filtro o indicador de "sesión sin actividad" ayudaría a limpiar la vista de `AttendanceHistoryPage.tsx`.
5. **Reportar hardware sin usar.** Ya que los torniquetes ZKTeco generan 1000+ eventos por semana que hoy no llegan a ninguna asistencia, mientras se conecta el puente (mejora #3 de arriba) valdría mostrarle al admin cuántos check-ins de torniquete "se están perdiendo" — un contador simple ya sería un argumento fuerte para priorizar la conexión.

## 8. Fuentes

- `frontend/src/pages/CoachAttendancePage.tsx`
- `frontend/src/pages/AttendanceSupervisionPage.tsx`, `AttendanceHistoryPage.tsx`
- `frontend/src/components/teams/CreateTeamModal.tsx`
- `bff/src/routes/attendance.ts`
- `bff/src/routes/access-adms.ts`
- `docs/specs/asistencia-rapida-checkin.md`
- Migraciones: `20260224000032_multi_coach_support.sql`, `20260902110253`, `20260902112738_absence_events_no_show_and_threshold.sql`, `20260902112920_mark_session_absences_and_escalation.sql`
