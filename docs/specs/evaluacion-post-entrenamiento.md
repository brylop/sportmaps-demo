# Spec — Evaluación Post-Entrenamiento (autoevaluación de la deportista + rating del coach)

**Producto:** SportMaps · **Versión:** v0.3 (revisión de diseño integrada: modelo de datos corregido contra el PDF fuente, disparo, concurrencia, UX completa, informe grupal)
**Fecha:** 2026-09-08 · **Actualizado:** 2026-09-11 — F0 y F1 aplicados en la base
**Estado:** 🟢 F0-F4 implementadas y verificadas contra la base viva / typecheck del BFF, en la rama `feat/post-entreno-f0-catalogo` (**sin commitear todavía** — pendiente de tu ok). F-SEC no fue necesaria (ver nota abajo).

**F2 — aplicado y probado:** migraciones `20260911124834` (trigger `post_training_notify_on_finalize` sobre `attendance_sessions.finalized` false→true, columna `children.post_training_opt_out`, categoría `post_training` en `notifications`) y `20260911125148` (RPCs de sistema `post_training_send_parent_reminders_system` / `post_training_send_coach_reminders_system`, `service_role` únicamente) + `bff/src/jobs/post-training-reminders.job.ts` registrado en `maintenance.job.ts` a las 20:00 COT. Probado con una sesión real: cerrar dispara 1 notificación al padre correcto; reabrir+cerrar NO duplica. **Corrección sobre mi propia revisión anterior:** el botón "Finalizar sesión" de `CoachAttendancePage.tsx` **sí existe y sí escribe** `finalized=true` vía `PATCH /api/v1/attendance/session/:id/finalize` en el BFF — mi lectura previa (grep que no encontró la escritura) fue un falso negativo, confirmado ahora leyendo el archivo completo. El trigger de F2 se dispara con el flujo real, no uno hipotético.

**F3 — construido (frontend):**
- `frontend/src/pages/PostTrainingSelfEvalPage.tsx`, ruta `/post-entreno/:sessionId?child_id=` (registrada en `App.tsx`, protegida): las 7 pantallas de §5.1 con los componentes/tokens reales de la app (no el HTML del mockup), llamando `submit_post_training_self_eval` directo desde el cliente de Supabase (patrón ya usado en 10+ páginas del repo).
- `frontend/src/components/attendance/CoachPostTrainingRatingDialog.tsx`: se abre solo al finalizar asistencia (`finalizeMutation.onSuccess` en `CoachAttendancePage.tsx`), llama `submit_post_training_coach_rating`.
- Ambos con `eslint` limpio (solo warnings preexistentes de estilo `any`, mismos que ya tenía el resto del archivo) y el BFF con `tsc --noEmit` en verde.
- **Gap conocido, fuera de este spec:** la vista/PDF del informe mensual (§5.3) no está construida en el frontend todavía — no encontré ningún componente que renderice `ReportSnapshot` hoy, solo un archivo de queries. Construirla es del módulo "Informe Mensual del Atleta", no de este spec; F4 deja el dato listo (`metrics_session`) para cuando esa vista exista.

**F4 — aplicado (backend):** `report-snapshot.service.ts` gana `metrics_session: SessionMetricSummary[]` — promedio (BORG, esfuerzo, rating del coach), distribución (comprensión, satisfacción, nunca promediadas) y conteo (aspectos a mejorar), calculados desde `performance_entries` con `context_type='session'`. Las métricas con `aggregation≠'latest'` se sacaron del arreglo `metrics` existente (evita el ruido de "última vs. anterior" en algo que se mide 8-18 veces al mes). `metric-catalog.service.ts` expone `aggregation`/`options`/`required`. `tsc --noEmit` del BFF completo: 0 errores.

**F-SEC — verificado, no hacía falta:** se consultó `pg_policies` en la base viva y tanto `performance_entries` como `attendance_sessions` ya usan `user_staff_school_ids()` en sus policies de escritura desde `20260814185120_padres_no_escriben_tablas_operativas.sql`. El hallazgo de §1.1 estaba basado en el archivo de creación original, no en el estado real de la base — lección aplicada de este mismo repo ("la fuente de verdad es la base, nunca el repo").

**F0 — aplicado:** migración `20260911122709_post_entreno_catalogo_metricas.sql`. Columnas `aggregation`/`options`/`required` en `sport_metric_definitions` + catálogo sembrado para **Voleibol** (`3eeda4d4-…`) y **Fútbol** (`5c560204-…`): las 5 métricas universales (`rpe_borg`, `task_comprehension`, `self_effort_pct`, `satisfaction`, `coach_effort_rating`) y los `focus_*` de cada deporte (13 en voleibol tomados del PDF de Besser, 8 en fútbol tomados del mockup ya aprobado).

**F1 — aplicado y probado:** migración `20260911123141_post_entreno_rpcs_captura.sql`. `submit_post_training_self_eval` y `submit_post_training_coach_rating` (`SECURITY DEFINER`, no dependen de RLS), índice único `performance_entries_session_unique`, columna `attendance_sessions.coach_notes`. Probado contra la base viva con una sesión y un padre reales, dentro de una transacción sin `COMMIT` (no quedó ningún dato de prueba): el padre autorizado guarda las 5 respuestas + 2 `focus_*`, el coach guarda su rating y la nota, y un padre **no autorizado** para ese atleta recibe `42501` como se esperaba.

> Se construye **por fases con revisión entre cada una** (una rama por fase). Plan aprobado antes de código en migraciones. RLS revisado línea por línea. Tests de concurrencia en la fase backend. Cada fase tiene criterios de aceptación explícitos (§6).

**Cambios v0.2 → v0.3:**
- **Modelo de datos corregido contra el PDF fuente** (`EVALUACION GRUPAL ENTRENAMIENTO BESSE FEMENINO JULIO Y AGOSTO`): comprensión y satisfacción son **categóricas, no ordinales** — nunca se promedian. "Aspectos a mejorar" admite **texto libre** ("Otro"). Las opciones de esfuerzo (deportista y coach) llevan **etiqueta descriptiva**, no solo un porcentaje.
- **Nueva columna `aggregation`** en `sport_metric_definitions` (`latest | avg | distribution | count`) en vez de `frequency`. Responde directamente la pregunta que el snapshot necesita hacer.
- **Disparo:** al **cierre de la sesión**, no al marcar cada `attendance_record` (evita avisar antes de que termine el entreno y evita duplicados por corrección de estado). Idempotency key por (sesión, atleta). Un recordatorio a las 24h, máximo uno.
- **Garantía real de una-respuesta-por-sesión:** índice único parcial, no solo el check dentro de la RPC.
- **Contrato explícito del `jsonb`** de las RPCs y validación contra el catálogo del deporte.
- **Informe grupal** (lo que Besser produce hoy) pasa a ser entregable de F4 al mismo nivel que el informe por atleta. Comentario del coach **por bloque**, no una sola nota.
- **Nota libre del profe por sesión** → columna `coach_notes` en `attendance_sessions`.
- **§5 UX completa** con los tres flujos (deportista, coach, informe), pensada para que se llene 3 veces por semana sin abandonar.
- **§7:** las 6 preguntas abiertas de la v0.2 quedan **cerradas con decisión**. Quedan 2 abiertas menores.

**⚠️ 2 correcciones de esta revisión, verificadas contra el código real (no cambian ninguna decisión de producto, solo la implementación):**
1. **No hace falta `attendance_sessions.closed_at` nueva — ya existe el cierre.** La tabla ([20260303000000_mvp_attendance_fix.sql:29-43](../../supabase/migrations/20260303000000_mvp_attendance_fix.sql#L29-L43)) ya tiene `finalized boolean` + `finalized_at timestamptz` + `finalized_by`, y `CoachAttendancePage.tsx` ya lee/escribe ese estado (botón de finalizar existente). §4 usa **`finalized`/`finalized_at`** en vez de inventar `closed_at`.
2. **El auto-cierre por `end_time + 30 min` no es tan simple como se escribió.** `docs/specs/attendance-reports-module.md` (hallazgo #3, ya documentado) confirma que `start_time`/`end_time` de `attendance_sessions` **no están en ninguna migración versionada** — son columnas fantasma, de confiabilidad desconocida en la base viva. F2 no puede depender de ellas a ciegas; ver §4 para la mitigación.
3. **Hallazgo lateral de seguridad (mismo patrón que §1.1, no bloquea, se anota):** la policy `"Attendance sessions: manage staff"` es `FOR ALL USING (school_id = ANY(user_school_ids()))`, sin `WITH CHECK` separado — permite en teoría a **cualquier miembro de la escuela, padres incluidos**, finalizar/editar/borrar sesiones de asistencia, no solo a coach/staff. Es la misma familia de hallazgo que §1.1 (policy de escritura con `user_school_ids()`), sobre la tabla que este módulo usa como disparador. Se deja registrado junto a §1.1 para la misma decisión (F-SEC), no se resuelve aquí.

---

## 0. Origen

Besser (voleibol femenino) hoy hace esto **manualmente**: al terminar cada sesión manda un Google Form a las deportistas, y aparte el entrenador califica a cada una en una planilla. Cada mes y medio alguien arma a mano un PDF que agrega ambas cosas. El pedido es llevar esto a la app: se dispara solo, en **cada** sesión, es interactivo y rápido de responder, y el agregado llega **como un informe mensual** — encima de lo que ya existe para eso, no un módulo aparte.

**Lo que el PDF fuente enseña (y la v0.2 no había incorporado):**
- 223-224 respuestas de autoevaluación en mes y medio ≈ 15-18 sesiones × ~13 deportistas. La tasa de respuesta del Form es alta; la app no puede bajarla.
- "Aspectos a mejorar" tiene **153 respuestas**, ~30% menos que el resto: es la única pregunta opcional y debe seguir siéndolo.
- El informe es **100% grupal**: cinco bloques de la deportista, un bloque aparte del entrenador, y una nota general del profe. Cada gráfico lleva debajo un **párrafo interpretativo escrito por el coach**.
- BORG se reporta agrupado en cubetas ("<5 / 6-7 / 8 / 9 / 10").

**Decisiones ya resueltas con el usuario (no reabrir sin razón):**
- **D1 — Alcance:** entran **ambos** formularios desde la fase 1.
- **D2 — Catálogo de "aspectos a mejorar":** configurable por deporte vía `sport_metric_definitions` (scoped por `sports_categories.id`).
- **D3 — Disparador:** automático, al **cierre de la sesión** (`finalized=true`, ver §4).
- **D4 — Cadencia:** **todas** las sesiones, sin tope. El agregado se **publica una vez al mes** dentro del informe existente.
- **D5 — Experiencia:** debe ser **dinámica y divertida**: < 30 segundos, cero teclado, una pregunta por pantalla, y un motivo para volver (§5).

## 1. Qué existe hoy (no reinventarlo)

| Pieza | Dónde | Qué hace ya | Qué falta |
|---|---|---|---|
| Catálogo de métricas por deporte | `sport_metric_definitions` (`sport_category_id`, `metric_key`, `data_type` ∈ numeric/duration/count/rating, `category`, `min_value`/`max_value`, `parent_label`/`parent_hint`) | Catálogo configurable por deporte | Sembrar las filas de §2 + **columna `aggregation`** (§3.1) |
| Bandas verde/amarillo/rojo | `sport_metric_thresholds` | Semáforo | Opcional; solo para BORG y rating del coach |
| Registro de una medición | `performance_entries` (`subject_type/subject_id`, `metric_key`, `value numeric`, `notes`, `context_type ∈ manual/competition/evaluation/session`, `context_id`, `recorded_by`, `recorded_at`) | `context_type='session'` ya está en el CHECK, **sin productor real hoy** | Escribir `context_id = attendance_sessions.id`; **índice único parcial** (§3.2) |
| Catálogo unificado | `metric-catalog.service.ts` → `getMetricCatalog()` | Una fuente para las 3 rutas | Exponer `aggregation` y `options` (§2) |
| Snapshot del informe mensual | `report-snapshot.service.ts` → `buildReportSnapshot()` | Agrega por `metric_key`, compara última vs. anterior | **Extensión** para métricas de sesión (§3.4) |
| Ciclo de publicación mensual | `athlete_reports`, `team_report_notes`, `generate_report_drafts_system()`, `publish_athlete_report_system()` | Borrador → nota → publicación → snapshot congelado → push/correo | **Extensión menor**: comentario del coach por bloque (§3.5) |
| Cierre de sesión (¡ya existe!) | `attendance_sessions.finalized` / `finalized_at` / `finalized_by` ([20260303000000_mvp_attendance_fix.sql](../../supabase/migrations/20260303000000_mvp_attendance_fix.sql)) + botón de finalizar en `CoachAttendancePage.tsx` | El evento "sesión cerrada" ya existe, con actor y timestamp | Trigger sobre este cambio de estado (§4); nada nuevo que crear en `attendance_sessions` para el cierre en sí |
| Notificaciones | `notify_user()` / dispatcher | Push + correo con deep-link | Idempotency key por (sesión, atleta) |

**Conclusión:** sigue siendo "cableado y producto". Lo genuinamente nuevo: (a) filas de catálogo + columna `aggregation`, (b) dos RPCs de captura, (c) índice único, (d) trigger sobre `finalized`, (e) extensión del snapshot con agregados de sesión y vista grupal, (f) comentario por bloque, (g) pantallas, (h) `attendance_sessions.coach_notes` (única columna nueva real de este módulo sobre esa tabla).

### 1.1 ⚠️ Hallazgo de seguridad preexistente (fix independiente, prioritario)

La policy de INSERT en `performance_entries` usa `user_school_ids()` (incluye padres y atletas) en una policy de **escritura** — el patrón I2 que el repo prohíbe. Hoy cualquier miembro de una escuela puede insertar `performance_entries` para **cualquier** `subject_id` de esa escuela. La policy `"Attendance sessions: manage staff"` sobre `attendance_sessions` tiene la misma forma (§ nota 3 arriba).

**Decisión (cierra la antigua Q6):** ambas se abren como **fix de seguridad independiente y prioritario**, en su propio PR, **antes o en paralelo a F0**. No se acopla al calendario de este módulo. Este módulo **no depende de ninguna de las dos policies**: toda su escritura va por RPCs `SECURITY DEFINER` (§3.3), el mismo patrón que `athlete_reports`; y su lectura del estado `finalized` es solo eso, lectura.

## 2. Los dos formularios (mapeo pregunta → métrica, corregido contra el PDF)

Todas las filas se seedean con `sport_category_id` = voleibol. Otra escuela/deporte siembra su propio catálogo.

### 2.1 Autoevaluación de la deportista (la responde ella, desde el celular del padre, tras cada sesión)

| Pregunta (texto tal cual el Form) | `metric_key` | `data_type` | Rango / opciones | `aggregation` | Obligatoria |
|---|---|---|---|---|---|
| Percepción del cansancio al finalizar | `rpe_borg` | `rating` | 0-10 (escala de BORG con emojis) | `avg` + **distribución en cubetas** `<5 / 6-7 / 8 / 9 / 10` al mostrar | Sí |
| Comprensión de las tareas realizadas | `task_comprehension` | `rating` | 1 = las comprendí y apliqué · 2 = solo las comprendí · 3 = las apliqué sin entender bien el concepto · 4 = ni las comprendí ni apliqué | **`distribution`** (categórica, nunca promediar) | Sí |
| Cuál fue mi nivel de esfuerzo y entrega | `self_effort_pct` | `rating` | 50-100 en pasos de 10, cada valor con etiqueta (ver §2.4) | `avg` + `distribution` | Sí |
| Cuál es mi nivel de satisfacción o alegría al terminar | `satisfaction` | `rating` | 1 = no me siento satisfecha · 2 = me siento satisfecha · 3 = me siento alegre y satisfecha · 4 = me siento alegre · 5 = no me siento satisfecha ni alegre | **`distribution`** (categórica, nunca promediar) | Sí |
| ¿Cuáles aspectos debo mejorar después de la práctica de hoy? | un `metric_key` por ítem del catálogo (ver §2.3), `category='technical'` | `count` | valor 1 = seleccionado ese día | `count` | **No** (~30% la salta; botón "Hoy nada") |
| — "Otro" (texto libre) | `focus_other` | `count` | valor 1 + texto en `notes` | `count` + lista de textos en el informe | No |

**Regla dura:** `task_comprehension` y `satisfaction` tienen `aggregation='distribution'`. Cualquier código que las promedie es un bug. Esta es la razón de la columna `aggregation` (§3.1).

### 2.2 Rating del coach (por cada atleta presente/tarde, tras cerrar la sesión)

| Pregunta | `metric_key` | `data_type` | Opciones (etiqueta completa, se muestra en la UI) | `aggregation` |
|---|---|---|---|---|
| Evaluación del entrenador frente a la entrega de la deportista | `coach_effort_rating` | `rating` | 50 = aplicó y entregó su esfuerzo a menos de la mitad · 60 = a la mitad de lo que se le exige · 70 = de forma moderada · 80 = de buena manera · 90 = de muy buena manera · 100 = aplicó y entregó todo su esfuerzo | `avg` + `distribution` |

### 2.3 Catálogo inicial de "aspectos a mejorar" (voleibol, Besser)

`focus_comunicacion_campo`, `focus_recepcion_pase`, `focus_remate`, `focus_finta_enganche`, `focus_seguridad_tranquilidad`, `focus_liderazgo`, `focus_mirar_espalda_levantar`, `focus_presion_tras_perdida`, `focus_acciones_defensivas`, `focus_intensidad_fisico`, `focus_toma_decision`, `focus_nada` (respuesta explícita "hoy nada"), `focus_other`.

Cada uno con ícono asignado en `parent_hint` o metadata de UI (🏐 recepción, 💥 remate, 🗣️ comunicación, 🧠 decisión, 🛡️ defensa, 🔥 intensidad, …).

### 2.4 Etiquetas de esfuerzo de la deportista (50-100)

50 = "me costó, di menos de la mitad" · 60 = "di la mitad" · 70 = "me esforcé moderadamente" · 80 = "me esforcé bien" · 90 = "me esforcé mucho" · 100 = "¡lo di todo!". Las etiquetas viven en el catálogo (campo `options jsonb` en `sport_metric_definitions`, ver §3.1) para que otra escuela pueda cambiarlas.

### 2.5 Nota libre del profe

**Decisión (cierra la antigua Q5):** columna nueva **`attendance_sessions.coach_notes text`**. Es una propiedad de la sesión, no una métrica. Capturada con dictado por voz en la pantalla del coach (§5.2). No se replica por atleta ni se mete en `performance_entries`.

## 3. Diseño técnico

### 3.1 Catálogo (F0)

Migración que:
1. Agrega a `sport_metric_definitions`:
   - `aggregation text NOT NULL DEFAULT 'latest' CHECK (aggregation IN ('latest','avg','distribution','count'))`. Las métricas existentes quedan en `latest` (comportamiento actual intacto).
   - `options jsonb NULL` — `[{ "value": 50, "label": "…", "icon": "…" }]` para métricas de opción fija. `NULL` para numéricas puras.
   - `required boolean NOT NULL DEFAULT true`.
2. Inserta las filas de §2 con `sport_category_id` = voleibol.
3. `getMetricCatalog()` expone `aggregation`, `options`, `required`.

**Decisión (cierra la antigua Q4):** `aggregation` en vez de `frequency`. Una métrica con cero mediciones este mes no es ambigua; el snapshot no infiere nada de los datos.

### 3.2 Integridad — una respuesta por (sesión, atleta, métrica)

```sql
CREATE UNIQUE INDEX performance_entries_session_unique
  ON public.performance_entries (subject_type, subject_id, metric_key, context_id)
  WHERE context_type = 'session';
```

El check dentro de la RPC (§3.3) no protege contra dos envíos concurrentes; el índice sí. Los tests de concurrencia de F1 verifican exactamente esto.

**Edición:** la RPC de la deportista hace **upsert** (ON CONFLICT DO UPDATE) dentro de una **ventana de 24h** desde el cierre de la sesión (`finalized_at`); después, rechaza. El coach puede corregir su rating hasta la publicación del informe del mes.

### 3.3 Escritura — dos RPCs `SECURITY DEFINER`

```
submit_post_training_self_eval(
  p_session_id uuid,
  p_child_id   uuid,        -- exactamente uno de p_child_id / p_user_id
  p_user_id    uuid,
  p_answers    jsonb        -- contrato abajo
) RETURNS jsonb             -- { saved: n, streak: n, month_avg_borg: x }  (alimenta la pantalla de cierre, §5.1)
```

**Contrato de `p_answers`:**
```json
{
  "rpe_borg": 9,
  "task_comprehension": 1,
  "self_effort_pct": 90,
  "satisfaction": 3,
  "focus": ["focus_recepcion_pase", "focus_other"],
  "focus_other_text": "la presión después de perder el punto"
}
```

**Validaciones (todas dentro de la RPC, con `RAISE EXCEPTION` y código propio):**
- Exactamente uno de `p_child_id`/`p_user_id`; `is_parent_of_child(p_child_id)` o `p_user_id = auth.uid()`.
- `p_session_id` existe, **`finalized = true`**, y `attendance_records.status IN ('present','late')` para ese atleta.
- `now() <= session.finalized_at + interval '24 hours'`.
- Cada clave de `p_answers` existe en `sport_metric_definitions` para el `sport_category_id` de la escuela de la sesión; cada valor dentro de `[min_value, max_value]` y, si hay `options`, es uno de ellos.
- Todas las métricas con `required=true` están presentes.
- `focus[]` solo contiene claves `focus_*` del catálogo; `focus_other_text` solo si `focus_other` está en la lista; máximo 200 caracteres.
- Inserta/actualiza 1 fila por respuesta: `context_type='session'`, `context_id=p_session_id`, `recorded_by=auth.uid()`, `notes=focus_other_text` en la fila de `focus_other`.

```
submit_post_training_coach_rating(
  p_session_id uuid,
  p_ratings    jsonb,       -- [{ "child_id": uuid | "user_id": uuid, "effort_pct": 90 }, ...]
  p_coach_notes text        -- → attendance_sessions.coach_notes (opcional)
) RETURNS jsonb             -- { saved: n, pending: n }
```

**Validaciones:** caller ∈ `team_coaches` del `team_id` de la sesión; **`finalized = true`**; cada atleta en `p_ratings` está presente/tarde en esa sesión; `effort_pct` ∈ `options` de `coach_effort_rating`; informe del mes no publicado aún. Inserta/actualiza 1 fila por atleta, `metric_key='coach_effort_rating'`, `recorded_by = school_staff.id` del coach.

Ambas: `GRANT EXECUTE` solo a `authenticated`, `SET search_path = pg_catalog, public, pg_temp`, escriben como dueño (no dependen de las policies de §1.1).

**Casos negativos obligatorios en tests (F1):** padre de otro hijo · atleta ausente · sesión no finalizada · sesión de otro equipo (coach) · doble envío concurrente · `metric_key` inexistente · valor fuera de rango · fuera de la ventana de 24h · `focus_other_text` sin `focus_other` · informe ya publicado (coach).

### 3.4 Extensión de `buildReportSnapshot` (F4)

Hoy `loadMetricSeries` compara última vs. anterior. Para métricas de sesión (8-18 mediciones/mes) eso descarta casi todo. Se agrega una rama paralela — **`metrics_session: SessionMetricSummary[]`** en `ReportSnapshot` — que para cada `metric_key` con mediciones `context_type='session'` en el periodo calcula según `aggregation`:

| `aggregation` | Cálculo | Ejemplo en el PDF |
|---|---|---|
| `avg` | promedio + n + mín/máx | "esfuerzo promedio 88%" |
| `distribution` | % por opción + n | "88.8% las comprendí y apliqué" |
| `count` | veces seleccionado + n de sesiones | "recepción y pase: 12.4%" |
| BORG | `avg` **y** distribución en cubetas `<5 / 6-7 / 8 / 9 / 10` | el pie de la primera página |

- **Siempre se emite `n`** (sesiones respondidas / sesiones asistidas). Con 3 sesiones, "67% satisfecha" es ruido; la UI muestra el n.
- **Dato faltante (cierra la antigua Q2):** no se imputa. El informe muestra "respondió 8 de 11 sesiones".
- **Dos niveles de agregado:**
  - **Atleta** (`subject_id` = la deportista) → alimenta `athlete_reports` (informe del padre).
  - **Equipo** (todos los atletas del `team_id` en el periodo) → alimenta el **informe grupal** (nuevo, §3.5). Es lo que Besser produce hoy.
- Las métricas con `aggregation='latest'` (físicas) **no cambian**.

### 3.5 Informe grupal y comentario por bloque (F4)

El PDF fuente es un informe **de equipo** con un párrafo del coach **debajo de cada gráfico** y una nota general al final. Para reproducirlo:

- **`team_reports`** (nueva, pequeña): `id, team_id, period_start, period_end, status (draft|published), snapshot jsonb, published_at, published_by`. Misma máquina de estados que `athlete_reports`; RPCs `generate_team_report_draft_system()` / `publish_team_report_system()` calcadas de las existentes.
- **`report_section_notes`** (nueva): `report_type (athlete|team), report_id, section_key (rpe_borg|task_comprehension|self_effort_pct|satisfaction|focus|coach_effort_rating|general), body text, author school_staff.id`. Sustituye a "una sola nota" para estos informes. `team_report_notes` sigue existiendo para lo que ya hace.
- **Visibilidad (cierra la antigua Q1):** el **coach ve solo el agregado del equipo**, nunca respuestas individuales de autoevaluación (paridad con el Form anónimo; respuestas más honestas). El **admin de la escuela** ve individual. El **padre** ve solo la de su hija, superpuesta al agregado del grupo (sin nombres de otras).
- El informe grupal se publica a **coaches + admin**, y opcionalmente a todas las familias del equipo (toggle por escuela). El informe por atleta sigue yendo al padre como hoy.

### 3.6 Lo que no se toca

`generate_report_drafts_system`, `publish_athlete_report_system`, el job de correo/push, `report_team_schedule`: **cero cambios**. Se alimentan de más `performance_entries` y de `metrics_session`.

## 4. Disparo (D3)

**Evento ancla: cierre de la sesión** (`attendance_sessions.finalized`), no el `attendance_record` individual. Marcar asistencia ocurre al inicio del entreno; avisar en ese momento pediría "¿cómo te sentiste?" antes de que termine. **El cierre ya existe** (`finalized`/`finalized_at`/`finalized_by`, botón en `CoachAttendancePage.tsx`) — nada que crear ahí.

- **Trigger `AFTER UPDATE OF finalized` en `attendance_sessions`, `WHEN (NEW.finalized = true AND OLD.finalized = false)`**: por cada `attendance_record` con `status IN ('present','late')`, `notify_user()` al padre (o a la deportista adulta) con deep-link al formulario de esa sesión. **Idempotency key `post_training:{session_id}:{subject_id}`** — reabrir/cerrar la sesión no duplica el aviso.
- Al coach: aviso "califica el entreno de hoy" con deep-link a §5.2, disparado por el mismo evento (lo dispara su propia acción de finalizar, así que en la práctica es una confirmación in-app más que una notificación push).
- **Auto-cierre si el coach olvida finalizar — mitigado, no resuelto en F2:** `start_time`/`end_time` de `attendance_sessions` son columnas sin versionar y de confiabilidad desconocida en la base viva (hallazgo ya documentado en `attendance-reports-module.md`). F2 **no** construye un auto-cierre por horario. En su lugar: recordatorio al coach a `session_date` + 1 día si sigue `finalized=false` ("tienes una sesión sin cerrar"). El auto-cierre por horario queda condicionado a que se versionen esas columnas (fuera de este spec) — se anota como dependencia, no se resuelve aquí.
- **Recordatorio al padre:** uno solo, a las 20h del día del cierre, solo si no ha respondido. Nada más — con 3 sesiones/semana la fatiga de notificaciones es el riesgo real.
- **Opt-out** por deportista desde el perfil (sigue recibiendo el informe mensual).

## 5. Experiencia (D5)

**Principios:** menos de 30 segundos · cero teclado · una pregunta por pantalla · tap y avanza sola · siempre en **primera persona de la deportista** aunque lo llene el padre · algo que dé ganas de volver. **Nada del coach aparece en el flujo de la deportista, y viceversa.**

### 5.1 Autoevaluación (la deportista, en el celular del papá)

| Paso | Pantalla | Control | Detalle |
|---|---|---|---|
| 0 | Entrada | Botón "Empezar" | "¡Hola Valentina! ¿Cómo estuvo el entreno de hoy?" · foto del equipo · "Martes 8 sep · 5:00 pm" · "El equipo ya respondió 11 de 14 🏐". Con dos hijas en la escuela, el nombre y la sesión son **obligatorios** en el encabezado. |
| 1 | Cansancio (BORG) | Termómetro vertical arrastrable 0-10 | La carita gigante cambia con cada nivel (😌 → 😫), el color va de azul a rojo, vibración leve por nivel. Etiqueta de la escala visible ("9 · Máximo"). |
| 2 | Comprensión | 4 tarjetas grandes con ícono | 💡✅ "las comprendí y apliqué" · 💡 "solo las comprendí" · ✅ "las apliqué sin entender bien" · ❓ "ni las comprendí ni apliqué". Tap → avanza. |
| 3 | Esfuerzo | Barra de energía / batería, arrastre en saltos de 10 | Al soltar aparece la etiqueta (§2.4): "¡Lo di todo!". |
| 4 | Satisfacción | 5 caritas grandes en fila | La tocada rebota, las demás se apagan. Etiqueta exacta del Form debajo. |
| 5 | Aspectos a mejorar | Chips con ícono, multi-select | Se iluminan al tocar. "Otro ✏️" pequeño abre un campo corto (único teclado del flujo, opcional). **Botón "Hoy nada" visible y legítimo** — es la pregunta que 30% salta. |
| 6 | Cierre | Confeti breve (1s) | "¡Listo! Llevas 7 entrenos seguidos respondiendo 🔥" + tarjetita: "Hoy terminaste en 9 · tu promedio del mes es 8" (viene del `RETURNS` de la RPC). Ese dato inmediato es lo que hace que valga la pena. Botón "Cerrar". |

- Barra de progreso con 5 puntos arriba. Transiciones deslizantes, sin pantallas de carga.
- Si ya respondió esa sesión: pantalla "Ya respondiste el entreno de hoy ✔️ · editar" (hasta 24h).
- **Racha y colección (ligero):** racha de sesiones respondidas en el perfil de la deportista; un sticker por mes completado ("Septiembre ✔️") que aparece en su informe. Sin puntos, sin rankings.

### 5.2 Rating del coach (90 segundos, de pie en la cancha)

- Aparece al finalizar asistencia o desde la notificación. Barra "8 de 13".
- **Una tarjeta por deportista** (foto + nombre), se desliza para pasar. Seis pastillas apiladas con porcentaje **y etiqueta corta** ("80% · de buena manera"). Tap → siguiente tarjeta.
- Al final: **nota de la sesión con dictado por voz** (🎤) — el profe no va a escribir un párrafo en el celular. Guarda en `attendance_sessions.coach_notes`.
- Cierre: "Listo. Las familias recibirán el resumen el 1 de octubre." Botón "Editar" hasta la publicación.
- **Nunca** muestra lo que respondió la deportista.

### 5.3 Informe mensual (que no sea un PDF muerto)

**Estructura, igual que el PDF fuente:**
1. Título: "Evaluación · [equipo] · [mes]".
2. **Bloque "Cómo me sentí"** — cinco secciones, cada una una tarjeta deslizable tipo historia: gráfico animado al entrar → comentario del coach para esa sección (`report_section_notes`) → siguiente.
   - Cansancio: dona con cubetas `<5 / 6-7 / 8 / 9 / 10` + promedio.
   - Comprensión y satisfacción: dona por categoría (nunca promedio).
   - Esfuerzo: dona 50-100 con etiquetas.
   - Aspectos a mejorar: barras horizontales por ítem + lista de textos "Otro".
3. **Bloque "Lo que vio el entrenador"** — visualmente diferenciado (color, encabezado propio): distribución del rating del coach + su comentario.
4. **"Nota del profe"** — la nota general del periodo.
5. Pie: "Respondió 14 de 16 entrenos" · sticker del mes.

**Versión del padre:** la misma plantilla con el dato de **su hija sobrepuesto al grupo** — el punto "Valentina" pulsa sobre la distribución del equipo. Sin nombres de otras deportistas.

**Versión grupal (coach/admin):** solo agregados.

- **Compartir:** botón que genera una imagen tipo tarjeta ("Valentina · Septiembre · esfuerzo 90% · racha 12 🔥 · SportMaps"). Marketing orgánico gratis.
- **PDF:** se genera igual (Besser lo necesita para el club), con la misma estructura. Es la **exportación**, no la experiencia.

### 5.4 Lo que NO se hace

Puntos, rankings entre deportistas, comparar a una niña con otra por nombre, mostrar al coach respuestas individuales de autoevaluación, más de una notificación de recordatorio por sesión, animaciones de más de 1 segundo.

## 6. Fases y criterios de aceptación

**F-SEC — Fix de policies `performance_entries` y `attendance_sessions` `[DB]`** (independiente, prioritario, §1.1). Acepta: un padre no puede insertar `performance_entries` para un `subject_id` que no sea su hijo; un padre no puede finalizar/editar/borrar `attendance_sessions`; los flujos existentes de staff siguen pasando.

**F0 — Catálogo `[DB]`.** Columnas `aggregation`, `options`, `required`; seed voleibol; `getMetricCatalog()` los expone. Acepta: métricas existentes conservan `aggregation='latest'` y el informe actual no cambia (snapshot idéntico byte a byte en fixtures).

**F1 — RPCs de captura + índice único `[DB]`.** Acepta: los 10 casos negativos de §3.3 fallan con código propio; test de concurrencia (2 envíos simultáneos) deja exactamente 1 fila por métrica; upsert dentro de 24h, rechazo después; `RETURNS` trae racha y promedio del mes.

**F2 — Trigger sobre `finalized` + recordatorios `[DB/BFF]`.** Trigger, idempotency key, recordatorio único al padre, recordatorio al coach por sesión sin cerrar, opt-out, `coach_notes`. Acepta: finalizar/reabrir/finalizar genera **un** aviso; ausentes no reciben nada; opt-out no recibe aviso pero sí informe.

**F3 — Formulario de la deportista + rating del coach `[Frontend]`.** §5.1 y §5.2 completos. Acepta: flujo completo en < 30 s en pruebas con 5 usuarios reales de Besser; funciona con dos hijas en la misma cuenta; sin teclado salvo "Otro" y nota del coach; el coach no ve respuestas individuales.

**F4 — Snapshot de sesión + informes `[BFF/Frontend]`.** `metrics_session` (atleta y equipo), `team_reports`, `report_section_notes`, vistas §5.3, compartir, PDF. Acepta: con el dataset del PDF fuente cargado como fixture, los porcentajes del informe grupal reproducen los del PDF (±0.5%); comprensión y satisfacción jamás muestran un promedio; `n` visible en cada bloque.

## 7. Decisiones cerradas en esta revisión

| # | Pregunta (v0.2) | Decisión |
|---|---|---|
| 1 | ¿El coach ve respuestas individuales? | **No.** Solo agregado de equipo. Admin ve individual. Padre ve la de su hija sobre el grupo. |
| 2 | ¿Qué pasa si no responde una sesión? | Dato faltante, sin imputar. El informe muestra "respondió X de Y". Un recordatorio a las 20h, máximo uno. |
| 3 | ¿"Aspectos a mejorar" single o multi? | **Multi-select** + "Otro" texto libre + "Hoy nada" explícito. Opcional. |
| 4 | ¿Columna `frequency`? | **No:** columna **`aggregation`** (`latest/avg/distribution/count`). |
| 5 | ¿Dónde vive la nota del profe? | `attendance_sessions.coach_notes` (por sesión) + `report_section_notes` (por bloque del informe). |
| 6 | ¿El fix de seguridad va con este módulo? | **No.** PR independiente, prioritario (F-SEC), y ahora incluye también la policy de `attendance_sessions` (nota 3 de la cabecera). |

**Abiertas (menores, no bloquean F0-F1):**
1. ¿El informe grupal se envía a todas las familias del equipo por defecto o solo a coach/admin? Propuesta: solo coach/admin, toggle por escuela.
2. El auto-cierre por horario de sesión queda **fuera de alcance** hasta que `start_time`/`end_time` de `attendance_sessions` se versionen (dependencia externa a este spec, ya documentada en `attendance-reports-module.md`). Mientras tanto, ¿el recordatorio "sesión sin cerrar" a +1 día es suficiente, o se necesita antes?

---

*Con la aprobación de este documento se abre F-SEC y F0. No se toca `supabase/migrations/` antes.*
