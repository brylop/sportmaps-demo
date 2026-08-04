# Spec — Reportes de Asistencia por Hora y Día + Unificación de tablas

- **Versión:** 1.0
- **Estado:** Listo para implementar (decisiones de producto cerradas)
- **Módulo:** Asistencia / Reportes
- **Alcance:** Backend (DB + RLS + RPCs) + BFF + Frontend + Auditoría + QA
- **Tier/Gate:** disponible para rol `school` (owner/admin) y `coach` con permiso de reportes. Sin addon adicional.

> Convenciones obligatorias del repo aplican (ver `CLAUDE.md`): migraciones **inmutables** (todo fix = migración nueva con timestamp posterior), `SET search_path = pg_catalog, public, pg_temp` en toda `CREATE FUNCTION`, `GRANT EXECUTE` explícito por RPC, estados con `text + CHECK` (no `CREATE TYPE`), RLS sin self-recursion, mutación de contadores solo en RPCs `SECURITY DEFINER`. Trabajo **solo en `develop`**, una rama por fase.

---

## 1. Contexto y estado actual (evidencia)

Hoy conviven **dos sistemas de asistencia**:

### Sistema activo (staff/coach)
- `attendance_sessions` — una sesión **por equipo/día** (`session_date date`, UNIQUE `(team_id, session_date)`). Def: [20260303000000_mvp_attendance_fix.sql:29-43](../../supabase/migrations/20260303000000_mvp_attendance_fix.sql#L29-L43). Capacidad añadida en [20260310000001_universal_architecture_v2_1.sql:153-161](../../supabase/migrations/20260310000001_universal_architecture_v2_1.sql#L153-L161).
- `attendance_records` — registro por atleta/día (`attendance_date date`, `status attend_status = present|absent|late|excused|justified`). Def: [20260217000001_schema_refactored.sql:471](../../supabase/migrations/20260217000001_schema_refactored.sql#L471).
- Escritura vía BFF [bff/src/routes/attendance.ts](../../bff/src/routes/attendance.ts) → RPC `upsert_attendance_record`.
- UI: [CoachAttendancePage.tsx](../../frontend/src/pages/CoachAttendancePage.tsx), [AttendanceSupervisionPage.tsx](../../frontend/src/pages/AttendanceSupervisionPage.tsx).

### Sistema legacy (vista de padres)
- Tabla `attendance` (distinta): `class_date date`, `status text CHECK ('attended','absent','justified','late')`. Leída por [ChildAttendancePage.tsx:41](../../frontend/src/pages/ChildAttendancePage.tsx#L41) y [AttendancePage.tsx:52](../../frontend/src/pages/AttendancePage.tsx#L52).

### Problemas confirmados
1. **Inconsistencia de datos:** lo que marca el coach (`attendance_records`, estado `'present'`) **no aparece** en la vista del padre (lee `attendance`, estado `'attended'`). El conteo del padre compara contra `'present'` sobre una tabla que usa `'attended'` → tasa siempre mal.
2. **No hay reportes por hora.** No existe `date_trunc`/`EXTRACT(hour…)`/`GROUP BY` horario en ninguna capa. La granularidad real es **día**; las agregaciones de negocio son **por mes**, hechas en JS ([reports.ts:63-115](../../bff/src/routes/reports.ts#L63-L115)).
3. **Columnas fantasma:** el código lee/escribe `start_time`, `end_time`, `offering_id`, `coach_id`, `title` sobre `attendance_sessions`, pero **no están en ninguna migración versionada** (grep confirmado). Si existen en la DB fueron aplicadas fuera de banda; si no, esos paths devuelven `null` en silencio. **El reporte por hora depende de `start_time/end_time`.**
4. **RPC sin versionar:** `upsert_attendance_record` no está en migraciones (solo su firma aparece en el snapshot del linter) y figura ejecutable por `anon` → hallazgo de seguridad a corregir.

---

## 2. Decisiones de producto (CERRADAS)

| # | Decisión | Resolución |
|---|----------|------------|
| D1 | ¿Qué es "reporte por horas"? | **Ambos:** (a) **ocupación por franja horaria del día** (bucket por hora de `start_time`) y (b) **horas acumuladas** por atleta y por coach en un rango. |
| D2 | Tabla legacy `attendance` | **Unificar y deprecar.** La vista de padres pasa a leer `attendance_records`. Backfill de datos legacy. La tabla `attendance` queda deprecada (no se borra; ver D8). |
| D3 | Dónde se agregan los datos | **RPCs SQL** con `date_trunc`/`EXTRACT`, `SECURITY DEFINER`. El BFF solo expone; el frontend renderiza. Se elimina la agregación ad-hoc en JS para estos reportes nuevos. |
| D4 | "Presente" para % asistencia | `present + late` cuenta como asistió (consistente con [attendance.ts:579-581](../../bff/src/routes/attendance.ts#L579-L581)). `excused`/`justified` **no** cuentan como asistió pero **sí** salen del denominador (ausencia justificada). `absent` cuenta en denominador, no en numerador. Fórmula: `% = (present+late) / (present+late+absent) * 100`. |
| D5 | Sesiones sin `start_time/end_time` | Se **excluyen** de los reportes por hora y de horas acumuladas, y se reportan aparte como "sin horario" (contador visible). No se inventa duración por defecto. |
| D6 | Duración para "horas acumuladas" | `end_time - start_time` de la sesión finalizada. Se cuenta por atleta con `status IN (present, late)`. Para coach: horas de sesiones **finalizadas** que dictó (`coach_id`). |
| D7 | Zona horaria | Todo cálculo de "día" y "hora" usa `America/Bogota` (consistente con [attendance.ts:7-9](../../bff/src/routes/attendance.ts#L7-L9)). Los `date`/`time` se interpretan en TZ local de la escuela; no convertir a UTC en la agregación. |
| D8 | Borrado de `attendance` legacy | **No** en este alcance. Se deja read-only tras el backfill; su drop va en un spec/fase posterior una vez validado en prod ≥30 días. |
| D9 | Rango por defecto de reportes | Último **30 días** si no se pasa rango. Máximo permitido por request: **1 año**. |

---

## 3. Modelo de datos

### 3.1 Fase 0 — versionar columnas fantasma de `attendance_sessions`

Migración nueva (`IF NOT EXISTS` por si ya están aplicadas fuera de banda; **no** rompe si existen):

```sql
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.offerings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coach_id    uuid REFERENCES public.school_staff(id),
  ADD COLUMN IF NOT EXISTS title       text,
  ADD COLUMN IF NOT EXISTS start_time  time,   -- hora local de inicio de la clase
  ADD COLUMN IF NOT EXISTS end_time    time;   -- hora local de fin

-- Índice para agregación por franja horaria y por rango
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date_start
  ON public.attendance_sessions(school_id, session_date, start_time);
```

> Nota: `team_id` es NOT NULL en la def original pero el flujo de offerings inserta sin team. Verificar en la DB real si `team_id` ya se relajó a NULL (el código de offerings lo asume). Si sigue NOT NULL, incluir `ALTER COLUMN team_id DROP NOT NULL` en esta migración con XOR check `(team_id IS NOT NULL) OR (offering_id IS NOT NULL)`.

### 3.2 Fase 1 — unificación legacy

No se crean tablas nuevas. Se **backfillea** `attendance` → `attendance_records` y se corrige el lector de padres.

Mapeo de estados legacy → nuevo:

| `attendance.status` (legacy) | `attendance_records.status` (nuevo) |
|---|---|
| `attended` | `present` |
| `absent` | `absent` |
| `justified` | `justified` |
| `late` | `late` |

Backfill idempotente (migración con `search_path`), respetando el UNIQUE `(child_id, program_id, attendance_date)`:

```sql
-- Pseudo: insertar sólo lo que no exista ya en attendance_records
INSERT INTO public.attendance_records (school_id, program_id, child_id, attendance_date, status, marked_by, notes)
SELECT ...
FROM public.attendance a
JOIN public.profiles ...   -- resolver school_id/program_id del legacy
ON CONFLICT (child_id, program_id, attendance_date) DO NOTHING;
```

> Detalle a resolver en implementación: `attendance.child_id` apunta a `profiles` (legacy), `attendance_records.child_id` apunta a `children`. El backfill debe mapear `profiles → children` correctamente; si un registro legacy no resuelve a `children`, se registra en una tabla de auditoría de backfill y **no** se pierde silenciosamente.

---

## 4. RPCs de agregación (Fase 2)

Todas: `SECURITY DEFINER`, `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE ... TO authenticated`, y **filtro de tenant dentro** (validar que `p_school_id = ANY(public.user_school_ids())` o vía helper existente). RLS sin self-recursion.

### 4.1 `report_attendance_by_hour` — ocupación por franja horaria (D1a)

```sql
report_attendance_by_hour(
  p_school_id uuid,
  p_from date,
  p_to   date,
  p_team_id    uuid DEFAULT NULL,   -- filtro opcional
  p_offering_id uuid DEFAULT NULL
) RETURNS TABLE (
  hour_bucket   int,        -- EXTRACT(hour FROM start_time) 0..23
  sessions      int,
  present       int,
  late          int,
  absent        int,
  attend_rate   numeric      -- (present+late)/(present+late+absent)*100
)
```

Lógica: join `attendance_sessions` (rango `session_date`, `start_time NOT NULL`) con `attendance_records`, `GROUP BY EXTRACT(hour FROM start_time)`. Excluir sesiones sin `start_time` (D5).

### 4.2 `report_attendance_hours` — horas acumuladas (D1b, D6)

Dos modos en una RPC o dos RPCs (`_by_athlete` / `_by_coach`):

```sql
report_attendance_hours_by_athlete(p_school_id uuid, p_from date, p_to date, p_team_id uuid DEFAULT NULL)
RETURNS TABLE (subject_id uuid, subject_name text, sessions_attended int, total_hours numeric)
-- total_hours = SUM(EXTRACT(epoch FROM (end_time - start_time))/3600) para sesiones finalizadas
--               donde el atleta tiene status IN ('present','late')

report_attendance_hours_by_coach(p_school_id uuid, p_from date, p_to date)
RETURNS TABLE (coach_id uuid, coach_name text, sessions_led int, total_hours numeric)
-- horas de sesiones finalizadas dictadas por el coach (attendance_sessions.coach_id)
```

Reglas: solo sesiones `finalized = true` con `start_time` y `end_time` no nulos (D5/D6). Manejar `end_time < start_time` (cruce de medianoche) → sumar 24h o descartar con flag (decisión de impl: descartar y contar en "inconsistentes").

### 4.3 `report_attendance_by_day` — serie diaria (reemplaza el % sin ventana)

```sql
report_attendance_by_day(p_school_id uuid, p_from date, p_to date, p_team_id uuid DEFAULT NULL)
RETURNS TABLE (day date, sessions int, present int, late int, absent int, attend_rate numeric)
```

Reemplaza el cálculo histórico-total de [reports.ts:398-429](../../bff/src/routes/reports.ts#L398-L429) y [attendance.ts:573-585](../../bff/src/routes/attendance.ts#L573-L585) con una versión con ventana de fechas.

---

## 5. BFF (Fase 3)

Nuevos endpoints en [bff/src/routes/reports.ts](../../bff/src/routes/reports.ts), mismo `requireRole` que los reportes existentes + `getBranchFilter` para `branch_id`. Validar rango (D9: default 30 días, máx 1 año) y devolver 400 si `from > to` o rango > 1 año.

| Método | Ruta | Params | RPC |
|---|---|---|---|
| GET | `/api/v1/reports/attendance/by-hour` | `from`, `to`, `team_id?`, `offering_id?`, `branch_id?` | `report_attendance_by_hour` |
| GET | `/api/v1/reports/attendance/hours` | `from`, `to`, `mode=athlete\|coach`, `team_id?` | `report_attendance_hours_by_*` |
| GET | `/api/v1/reports/attendance/by-day` | `from`, `to`, `team_id?` | `report_attendance_by_day` |

- **No** agregar en JS: el BFF solo llama la RPC y pasa el resultado (D3).
- Actualizar `GET /reports/coach/:teamId` y `GET /attendance/rate/:teamId` para aceptar `from`/`to` opcionales delegando a `report_attendance_by_day` (retrocompatible: sin rango = últimos 30 días, no histórico total).

---

## 6. Frontend (Fase 4)

### 6.1 Corregir vista de padres (Fase 1, va con la unificación)
- [ChildAttendancePage.tsx:41](../../frontend/src/pages/ChildAttendancePage.tsx#L41) y [AttendancePage.tsx:52](../../frontend/src/pages/AttendancePage.tsx#L52): cambiar `from('attendance')` → `attendance_records` (o RPC dedicada de historial por hijo con RLS de padre). Ajustar `status === 'present'` (ya no `'attended'`). Verificar RLS "Parents view own child attendance" ([schema_refactored.sql:1260-1264](../../supabase/migrations/20260217000001_schema_refactored.sql#L1260)).

### 6.2 Reportes nuevos
Extender [ReportsPage.tsx](../../frontend/src/pages/ReportsPage.tsx) con un tab **"Asistencia"** (o página dedicada) con:
- Selector de rango (date range picker) + filtros team/offering + sede.
- **Ocupación por franja horaria:** bar chart por hora del día (`report_attendance_by_hour`). Muestra contador "N sesiones sin horario excluidas" (D5).
- **Horas acumuladas:** tabla por atleta y toggle por coach (`report_attendance_hours`), con export CSV (reusar patrón CSV existente).
- **Serie diaria:** line/bar de % asistencia por día (`report_attendance_by_day`).
- Estados de error/empty explícitos (evitar el patrón "error → tabla vacía silenciosa" registrado en la auditoría de tablas del proyecto).

---

## 7. Auditoría

- Registrar accesos a reportes sensibles si aplica el patrón de `AdminActivityLogsPage` (consistencia con módulos existentes). Mínimo: log de export CSV con rango y filtros.
- Backfill legacy: tabla temporal `attendance_backfill_audit(legacy_id, resolved, reason)` para trazar qué se migró y qué no (D2).

---

## 8. QA / Concurrencia

- **Unit/SQL:** verificar fórmula de tasa (D4), buckets por hora (incluye 0 y 23), exclusión de sesiones sin horario (D5), cruce de medianoche, rango > 1 año → 400.
- **Concurrencia (obligatorio, fase backend):** finalizar sesión mientras se marca asistencia; el descuento de créditos (trigger `trg_deduct_sessions_on_finalize`) no debe doble-contar horas. Marcar el mismo atleta en 2 requests concurrentes (upsert idempotente por UNIQUE).
- **RLS línea por línea antes de aplicar:** un padre no puede leer reportes agregados de la escuela; un coach solo su(s) equipo(s); admin/owner toda la sede. Verificar que las RPCs `SECURITY DEFINER` filtran por `user_school_ids()` y **no** dependen solo de RLS de las tablas base.
- **Regresión:** la vista de padres muestra los datos que marca el coach (bug D2 cerrado).
- Playwright E2E: coach marca asistencia con horario → aparece en reporte por hora y en historial del padre.

---

## 9. Fases (una rama por fase, revisión entre cada una)

| Fase | Rama | Entregable | Gate de salida |
|---|---|---|---|
| **0** | `feature/attendance-schema-hardening` | Versionar columnas `start_time/end_time/offering_id/coach_id/title` + índice + (si aplica) relajar `team_id` con XOR. Versionar `upsert_attendance_record` + restringir GRANT (quitar `anon`). | Migración aplicada; código existente sigue funcionando; linter sin warnings nuevos. |
| **1** | `feature/attendance-unify-legacy` | Backfill `attendance`→`attendance_records` + auditoría de backfill + repuntar vista de padres. | Padre ve lo que marca el coach; tasa correcta; 0 registros legacy perdidos sin trazar. |
| **2** | `feature/attendance-report-rpcs` | RPCs `report_attendance_by_hour` / `_hours_by_athlete` / `_hours_by_coach` / `_by_day` con GRANT + search_path. | Tests SQL + RLS verificadas línea por línea + tests de concurrencia. |
| **3** | `feature/attendance-report-api` | Endpoints BFF + validación de rango + retrocompat de `/coach/:teamId` y `/rate/:teamId`. | Contratos probados (Postman/curl); 400 en rangos inválidos. |
| **4** | `feature/attendance-report-ui` | Tab Reportes de Asistencia (franja horaria + horas + serie diaria) + export CSV + empty/error states. | E2E Playwright verde; revisión de UI. |

> Plan antes de código en migraciones: no escribir SQL de Fase 0/1/2 hasta aprobar el diseño de columnas y el mapeo de backfill.

---

## 10. Riesgos / gotchas

- **`start_time/end_time` pueden no existir en la DB real** → sin la Fase 0 los reportes por hora salen vacíos. Es el bloqueante #1.
- **Mapeo `profiles`→`children`** en el backfill legacy: fuente de pérdida silenciosa de datos si no se traza (mitigado con tabla de auditoría).
- **`upsert_attendance_record` ejecutable por `anon`**: corregir GRANT en Fase 0 sin romper el BFF (que usa service role / authenticated).
- **`team_id` NOT NULL** en `attendance_sessions` vs flujo offerings: confirmar estado real antes de la Fase 0.
- **TZ:** mezclar UTC y `America/Bogota` desplaza sesiones de madrugada al día/hora equivocada. Fijar TZ en las RPCs.
- No mezclar `school_subscriptions` (SaaS) con nada de esto; sin relación.