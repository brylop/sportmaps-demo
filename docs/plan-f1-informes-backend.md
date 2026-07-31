# Plan F1 — Backend del Informe Mensual del Atleta

> **Estado: para aprobación.** No se escribe SQL hasta que esto esté aprobado
> (convención del repo: *plan antes de código en migraciones*).
>
> Spec de referencia: `docs/specs/athlete-reports-module.md` v0.3 — §8 modelo,
> §9 RLS, §10 RPCs, §15 fases. F0 ya está en `develop` y `staging`.

---

## 0. Bloqueador — cinco tablas que la base tiene y el repo no

Antes de planear F1 hay que decir esto, porque cambia el orden del trabajo.

`supabase/migrations/` **no contiene un `CREATE TABLE` para ninguna de estas**:

| Tabla | La menciona alguna migración | La crea alguna migración |
|---|---|---|
| `sport_metric_definitions` | sí (solo F0, `20260731123145`) | **no** |
| `sport_metric_thresholds` | no | **no** |
| `performance_entries` | no | **no** |
| `competition_results` | no | **no** |
| `unregistered_athletes` | sí, **14 migraciones** | **no** |

Se crearon fuera del repo, directo en la base compartida. Dos consecuencias
concretas:

**La cadena de migraciones no reproduce la base desde cero.** Sobre una base
limpia, mi propia migración de F0 (`20260731123145`) **falla**: hace
`ALTER TABLE public.sport_metric_definitions ADD COLUMN IF NOT EXISTS …`, y el
`IF NOT EXISTS` es de la *columna*, no de la tabla. En la base compartida
funcionó porque la tabla ya estaba. Nada está roto en producción hoy — pero la
migración no es reproducible, y eso lo escribí yo sin verificarlo. Corrige lo
que dije al entregar F0.

**F1 se apoyaría en arena.** El `snapshot` del informe (§8.4) se arma leyendo
`performance_entries`. Construir la máquina de estados del informe sobre una
tabla sin línea base deja el módulo sin forma de recrearse en un entorno nuevo.

`unregistered_athletes` es el caso más viejo y el más usado: 14 migraciones
escriben contra ella. La deriva no la introdujo F0.

### Lo que sí está versionado

Todo lo demás que F1 necesita existe en migraciones, verificado uno por uno:
`user_devices`, `push_subscriptions`, `school_branches`, `attendance_sessions`,
`attendance_records`, `notifications`, `school_settings`, `school_staff`,
`is_school_admin`, `is_super_admin`, `audit_trigger_func` y
`adopt_orphan_payments_on_child_link` (`20260730194230`, el gancho de F6).

### Opciones

| | Qué implica | Veredicto |
|---|---|---|
| **A. Regularizar primero** | Una migración `CREATE TABLE IF NOT EXISTS` con el DDL real de las 5. Inocua contra la base actual (ya existen), da línea base a una limpia. | **Recomendada.** Es barata y es la única que deja la cadena sana. |
| B. Guardas en F1 | Envolver cada referencia en `IF EXISTS`. | No. Esparce el problema y lo vuelve permanente. |
| C. Seguir y regularizar después | F1 funciona en la base compartida. | Aceptable solo si hay prisa real. La deuda crece con cada migración que asume esas tablas. |

**Para desbloquear:** corre `scripts/dump_unversioned_schema.sql` (un solo
`SELECT`, respeta los gotchas del editor de Supabase) y pásame la salida. Con
ese volcado escribo M0 fiel a lo que hay, sin inventar columnas.

---

## 1. Orden de migraciones

Todas en una rama (fase F1), revisadas juntas, pero en archivos separados: un
fix de RLS no debería obligar a releer la migración de tablas.

| # | slug | Contenido |
|---|---|---|
| **M0** | `regularize_performance_schema` | Las 5 tablas del §0 con su DDL real, `CREATE TABLE IF NOT EXISTS` + índices + policies + grants. Sin datos. |
| **M1** | `athlete_reports_tables` | `athlete_reports`, `team_report_notes`, `report_team_schedule` (+ `athlete_report_snapshots`, ver D-F). Índice único por `subject_type+subject_id`. Columnas nuevas en `school_settings`. Triggers de auditoría y `updated_at`. |
| **M2** | `athlete_reports_rls` | `ENABLE ROW LEVEL SECURITY`, las policies de §9 y el helper `coach_can_see_report()`. **Sin `UPDATE` a `authenticated` sobre `athlete_reports`** (§9.1). |
| **M3** | `athlete_reports_rpcs_write` | `generate_report_drafts`, `set_athlete_report_note`, `publish_athlete_report`, `publish_team_reports`, `hold_athlete_report`, `regenerate_report_snapshot`, `reschedule_pending_reports`. |
| **M4** | `athlete_reports_rpcs_read` | `mark_report_viewed`, `report_coverage`, `adopt_reports_on_child_link`. |

Cada `CREATE FUNCTION` con `SET search_path = pg_catalog, public, pg_temp` y su
`GRANT EXECUTE` explícito. Cada RPC valida al caller **en su cuerpo** (§10.1) —
`SECURITY DEFINER` salta la RLS, así que sin el check interno cualquier
autenticado invoca con cualquier UUID.

---

## 2. Decisiones a cerrar antes de escribir SQL

### D-A · El eje polimórfico no admite FK

`subject_type + subject_id` apunta a tres tablas distintas (`profiles`,
`children`, `unregistered_athletes`). **Postgres no tiene FK polimórficas**, así
que la convención del repo («FKs de negocio a `profiles(id)`») no se puede
cumplir aquí tal cual. Opciones: sin FK y validar en el único escritor
(`generate_report_drafts`), o un trigger de validación.

Prefiero **hacer exactamente lo que ya hace `performance_entries`**, que usa el
mismo eje: la consistencia con la tabla hermana vale más que la teoría. Eso lo
decide el volcado del §0 — otra razón para correrlo primero.

### D-B · Qué tabla de asistencia alimenta los buckets

Las vivas son **`attendance_sessions`** (48 usos en el BFF) y
**`attendance_records`** (9). `session_attendance` existe en migraciones pero el
BFF no la toca — está muerta y no hay que leerla.

Importa para dos buckets de §10.2: `sin_mediciones_con_asistencia` (vino y nadie
lo midió) y `sin_actividad`. Son los que distinguen «el coach no midió» de «el
atleta no vino», que es justo lo que D12 pide no confundir.

### D-C · Qué gobierna cuando no hay calendario

Dos fechas distintas que es fácil confundir, y conviene fijarlas por escrito
porque de esto sale el SQL:

- **Qué equipo gobierna** a un atleta multi-equipo: el del `send_day` **más
  tardío** (D17). Con el más temprano el snapshot se congelaba antes de vencer
  el plazo del segundo coach y su nota se perdía siempre.
- **Cuándo se crean los borradores**: `draft_lead_days` antes del `send_day`
  **más temprano de la escuela** (§11), para que todos existan antes de que se
  publique cualquiera.

Falta el caso base: **atleta sin fila en `report_team_schedule`**, y peor,
**atleta sin equipo** — en Dynasty hay 6 activos así. Con la regla literal su
informe nunca se publicaría, en silencio.

Propuesta: `team_id` nulo, gobierna un día por defecto de la escuela, y esos
atletas **aparecen en el tablero de cobertura** en vez de desaparecer. Un
informe que no sale tiene que ser visible, no ausente.

### D-D · `coach_note_by` apunta a `school_staff(id)`

No a `auth.uid()` — la identidad del coach en este repo es `school_staff.id`
resuelto vía `coach_auth_id`. Hay que definir el `ON DELETE`: si un entrenador
se va, la nota no puede desaparecer ni romper la fila. Propongo
`ON DELETE SET NULL` y conservar el nombre dentro del `snapshot`, que ya congela
el nombre del coach (§8.4).

### D-E · El índice único y el atleta en dos escuelas

`UNIQUE (school_id, subject_type, subject_id, period_year, period_month)`
incluye `school_id`, así que un atleta en dos escuelas recibe un informe por
escuela. Correcto, y sin índice parcial — la lección de `payments`, donde el
único parcial solo cubría menores y dejó a los adultos sin red.

### D-F · Dónde va el snapshot viejo — la spec dice 3 tablas y salen 4

§8.4 dice que regenerar «archiva el anterior», pero el modelo de §8 no tiene
dónde. Guardar versiones en un `jsonb` que crece dentro de la misma fila es
pedir problemas.

Propongo una cuarta tabla, `athlete_report_snapshots`
(`report_id`, `version`, `snapshot`, `archived_at`, `reason`, `archived_by`).
**Es una desviación de la spec y la marco como tal** para que se apruebe
explícitamente, no de contrabando.

---

## 3. Tests de concurrencia

Obligatorios en la fase de backend. Dos sesiones con `BEGIN` explícito e
interleave deliberado, no llamadas en paralelo y a ver qué pasa.

| Escenario | Qué debe pasar |
|---|---|
| `publish_athlete_report` dos veces a la vez | Una gana; la otra recibe rechazo limpio por estado, no un 500. **Una sola notificación encolada.** |
| `generate_report_drafts` dos veces a la vez | Idempotente, cero duplicados. Es exactamente la clase de bug de `open_month` con sus tres vías de generación — no repetirlo. |
| `publish` mientras corre `regenerate_report_snapshot` | El `SELECT … FOR UPDATE` serializa; `snapshot_version` no se salta ni se repite. |
| `mark_report_viewed` en carrera | `view_count` consistente; `viewed_at` se fija **una** vez (gobierna la cascada de §7.1: pisarlo suprime correos). |
| `publish_team_reports` sobre un equipo con un informe ya publicado suelto | El lote lo salta sin abortar el resto. |

---

## 4. Lo que F1 no incluye

Ni UI, ni emisor, ni PDF, ni correo. F1 termina cuando las RPCs son invocables,
autorizadas y probadas. La UI del coach es F2; el tablero F3; la vista del padre
F4 — y **F4 va antes de F5 a propósito**, porque no se manda un enlace a una
pantalla que no existe.

---

## 5. Qué necesito de ti para arrancar

1. **La salida de `scripts/dump_unversioned_schema.sql`** — desbloquea M0 y cierra D-A.
2. **Opción A, B o C** del §0.
3. **D-C** (qué gobierna sin equipo/calendario) y **D-F** (la cuarta tabla).

D-B, D-D y D-E ya traen recomendación y las doy por cerradas salvo que digas lo
contrario.
