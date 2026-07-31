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

### ✅ Desbloqueado — M0 escrita

Volcado corrido 2026-07-31. **M0 = `20260731154626_regularize_performance_schema.sql`**,
escrita contra el DDL real. Es un **no-op deliberado contra la base actual**: todo
va guardado (`IF NOT EXISTS`, o `DO` que consulta el catálogo antes de crear), y
las policies se crean solo si faltan — sin `DROP … CREATE`, para no reemplazar una
policy real por una transcripción con una diferencia sutil.

Tres cosas que el volcado destapó y no estaban en el plan:

**Una sexta pieza sin versionar: `is_parent_of_child(uuid)`.** La invocan las
policies de `performance_entries` y `competition_results`, y tampoco la crea
ninguna migración — solo aparece citada dentro de un reporte de linter embebido en
`20260503000007`. M0 la crea **solo si falta**, así que la base compartida no se
toca; pero **el cuerpo que puse es una reconstrucción**, no un volcado (el script
saca DDL de tablas, no de funciones). Es una `SECURITY DEFINER` que gobierna el
acceso del padre a los datos de su hijo, así que la diferencia importa: la query
para reconciliarla está al final de M0.

**`GRANT ALL … TO anon` en las cinco tablas**, los 7 privilegios. RLS está activa
y las policies bloquean a anon en SELECT/INSERT/UPDATE/DELETE (con `auth.uid()`
NULL, `subject_id = auth.uid()` es falso y `user_school_ids()` da vacío). El que
RLS **no** cubre es `TRUNCATE`, que ignora policies — pero PostgREST no expone
TRUNCATE, así que hoy no es alcanzable por la API. Probablemente viene de los
default privileges que Supabase aplica a `public`, o sea que **no sería específico
de estas tablas**; no lo puedo confirmar desde el repo. M0 lo **replica sin
endosarlo**, porque su trabajo es que una base limpia quede igual a la de hoy, no
mejor. Endurecerlo merece migración aparte, medida y aprobada.

**El gap de `sport_metric_thresholds` sigue ahí:** no tiene eje de edad ni de
categoría, así que una banda de «cm» vale igual para un benjamín y para un
juvenil. Regularizar no es el momento de cambiar el modelo, pero es decisión de
producto pendiente antes de F1.

### M0 deadlockeó contra la base viva → aplicar `20260731160301`

Al aplicar M0 saltó `40P01 deadlock detected`. **No fue error de SQL** — el parser
aceptó el archivo completo, que es información útil. Fue concurrencia:

`IF NOT EXISTS` evita el **error**, no el **lock**. `ALTER TABLE … ENABLE ROW LEVEL
SECURITY` y `ALTER TABLE … ADD COLUMN IF NOT EXISTS` piden `AccessExclusiveLock`
aunque no cambien nada. Con esos locks dentro de una transacción larga y una base
que sirve tráfico real (una sola Supabase para dev/stg/prod), basta que otra sesión
esté leyendo una de las cinco tablas para cruzar el orden de adquisición.

O sea: **M0 era no-op lógico pero no no-op en locks.** M0 no se edita (inmutable,
ya commiteada) y sobre una base limpia funciona — no hay tráfico con el que
competir. Para la base viva está **`20260731160301_regularize_performance_schema_lockfree.sql`**,
que pregunta al catálogo antes de cada sentencia que tomaría lock y así **no toma
ni un lock exclusivo** cuando todo ya existe. Es autosuficiente: crea lo que falte,
sin depender de que M0 haya corrido. Lleva `SET LOCAL lock_timeout = '5s'` para
fallar claro en vez de colgarse.

> **Lección para toda migración futura sobre esta base compartida:** una migración
> «no-op» solo es segura si tampoco toma locks. Vale para `ENABLE RLS`,
> `ADD COLUMN IF NOT EXISTS`, `DROP/CREATE TRIGGER` y `GRANT`.

---

## 1. Orden de migraciones

Todas en una rama (fase F1), revisadas juntas, pero en archivos separados: un
fix de RLS no debería obligar a releer la migración de tablas.

| # | slug | Contenido |
|---|---|---|
| ~~**M0**~~ | ~~`regularize_performance_schema`~~ | ✅ **Escrita**: `20260731154626`. Las 5 tablas + `is_parent_of_child` + índices + policies + grants, todo guardado. Sin datos. Falta aplicarla. |
| **M1** | `athlete_reports_tables` | `athlete_reports`, `team_report_notes`, `report_team_schedule` (+ `athlete_report_snapshots`, ver D-F). Índice único por `subject_type+subject_id`. Columnas nuevas en `school_settings`. Triggers de auditoría y `updated_at`. |
| **M2** | `athlete_reports_rls` | `ENABLE ROW LEVEL SECURITY`, las policies de §9 y el helper `coach_can_see_report()`. **Sin `UPDATE` a `authenticated` sobre `athlete_reports`** (§9.1). |
| ~~**M3**~~ | ~~`athlete_reports_rpcs_write`~~ | ✅ **Escrita**: `20260731163725`. Las 7 RPCs de escritura + 2 helpers de fecha. Tests de concurrencia documentados al final del archivo. |
| **M4** | `athlete_reports_rpcs_read` | `mark_report_viewed`, `report_coverage`, `adopt_reports_on_child_link`. |

### D-G · El snapshot lo arma el llamador, no la RPC

Decisión tomada al escribir M3, **desviación de §10** y la marco como tal.

`publish_athlete_report` recibe el snapshot como parámetro en vez de calcularlo.
Dos razones:

El cálculo (destacados con delta, métricas a trabajar, bandas, radar) **ya existe
y está en uso** en `frontend/src/lib/school/performanceDisplay.ts` —
`pickHighlights`, `pickToWorkOn`, `computeDelta`, `sortedThresholds`.
Reimplementarlo en SQL crea **dos rankings que pueden divergir**, y el día que
divergen el padre y el coach ven números distintos del mismo mes.

Y varias columnas que el cálculo necesita **no están versionadas** —
`attendance_records.user_id`, `.unregistered_athlete_id`, `.session_id` — así que
SQL escrito contra ellas funcionaría en la base real y fallaría en una limpia.
Misma deriva de M0.

Lo que la RPC sigue garantizando es lo que importa: autorización interna,
`SELECT … FOR UPDATE`, validación de estado, resolución del destinatario y la
transición atómica. El snapshot es un dato de entrada; la máquina de estados sigue
siendo del servidor. Riesgo aceptado: un caller autorizado podría pasar un
snapshot fabricado — pero es admin o coach de esa escuela y ya puede escribir las
mediciones subyacentes, así que no gana capacidad nueva.

### Inventario de deriva encontrada hasta ahora

Cada vez que se toca algo aparece otra pieza sin versionar. Lo que va:

| Objeto | Estado |
|---|---|
| 5 tablas de rendimiento | cubiertas por M0 / `20260731160301` |
| `is_parent_of_child(uuid)` | cuerpo **reconstruido** en M0, a reconciliar |
| `school_staff.coach_auth_id` | **sin versionar** — M2 elige el cuerpo de `current_staff_ids()` según si existe |
| `attendance_records.user_id`, `.unregistered_athlete_id`, `.session_id` | **sin versionar** — motivo de D-G |
| `upsert_attendance_record(...)` RPC | **sin versionar** |

Merece **una** migración de regularización consolidada, con un volcado como el de
M0 pero de funciones y de estas columnas. Antes de F5, que es la que más depende
de asistencia.

Cada `CREATE FUNCTION` con `SET search_path = pg_catalog, public, pg_temp` y su
`GRANT EXECUTE` explícito. Cada RPC valida al caller **en su cuerpo** (§10.1) —
`SECURITY DEFINER` salta la RLS, así que sin el check interno cualquier
autenticado invoca con cualquier UUID.

---

## 2. Decisiones a cerrar antes de escribir SQL

### D-A · El eje polimórfico no admite FK — ✅ CERRADA por el volcado

`performance_entries` resuelve `subject_type` + `subject_id` con **solo un CHECK
sobre el tipo** (`IN ('profile','child','unregistered')`) y **ninguna FK sobre el
id**, sin trigger de validación. `metric_key` tampoco tiene FK al catálogo: es
texto libre.

No es descuido: **Postgres no admite FK polimórficas**, así que sin trigger no
hay otra salida. **`athlete_reports` copia esa convención** — CHECK en
`subject_type`, sin FK en `subject_id` — y valida la existencia del sujeto dentro
de `generate_report_drafts`, que es su único escritor. Consistencia con la tabla
hermana antes que pureza.

Dato adicional: `competition_results` usa el mismo eje pero admite un cuarto
valor (`'team'`) y `subject_type` nulo, con `CHECK (subject_id IS NOT NULL OR
team_id IS NOT NULL)`. El informe no necesita el caso de equipo — su sujeto es
siempre un atleta.

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

## 5. Qué necesito de ti para seguir

1. **Aplicar M0 (`20260731154626`) en Supabase** y decirme si el parser se queja.
   Es no-op contra los datos, pero nunca se ejecutó.
2. **El cuerpo real de `is_parent_of_child`** (la query está al final de M0), para
   reconciliar mi reconstrucción en una migración nueva si difiere.
3. **D-C** (qué gobierna al atleta sin equipo ni calendario) y **D-F** (la cuarta
   tabla para archivar snapshots).

D-A quedó cerrada por el volcado. D-B, D-D y D-E traen recomendación y las doy por
cerradas salvo que digas lo contrario. Con D-C y D-F resueltas, M1 y M2 se pueden
escribir sin esperar nada más.
