# Periodización — microciclos, rótulos de día y carga de entrenamiento

> **Estado: para aprobación.** No se escribe código de migraciones hasta que las
> decisiones de la sección 2 estén resueltas (convención del repo: *plan antes de
> código en migraciones*).
>
> **Origen:** análisis del tablero de planificación en Canva de **Independiente
> Santa Fe U20B** (105 diapositivas), 2026-08-19. No es un pedido abstracto de
> producto: es un artefacto real, de un club real, que hoy se mantiene a mano en
> una herramienta de diseño. Este spec describe qué tendría que hacer SportMaps
> para reemplazarlo — y, sobre todo, para **corregir los errores que ese formato
> no puede detectar**.
>
> **Segunda fuente, 2026-08-31:** `MESOCICLO C.C.C..xlsx`, la plantilla real de
> planificación mensual de **Club Carmel** (fútbol). Confirma el patrón desde un
> club distinto — no es una idea de Santa Fe sola — y agrega un nivel que este
> spec no tenía: el **mesociclo** (mes, ~4 semanas), contenedor de microciclos.
> Ver §3.5.

---

## 0. De dónde sale esto — el artefacto de Canva

Lo que se pudo leer son **2 de las 105 diapositivas**: el tablero semanal del
microciclo 40 y una hoja de sesión (MD-4, sede Siberia). El cruce de 4 fines de
semana que se pidió **no se pudo hacer**: las diapositivas 2–4 (microciclos de
septiembre) no eran legibles en las capturas. Queda pendiente de insumo.

### 0.1 Microciclo 40 — 3 al 9 de noviembre, U20B

| Día | Rótulo del tablero | Contenido real |
|---|---|---|
| Lun 3 | Descanso | — |
| Mar 4 | MD+1 / MD-3 | Hipertrofia muscular FZA MMSS · posesión en espacios cortos · sprints RSA 40 m |
| Mié 5 | MD | **Partido** Copa Metropolitana — Real Cundinamarca (9 AM, Club Real Boyacá) |
| Jue 6 | Activación MD+1 | Circuito neuromuscular · reactivos · espacios reducidos y amplios |
| Vie 7 | MD | **Partido oficial** Interclubes DIFUTBOL — Real Santuario |
| Sáb 8 | Regenerativo | Hipertrofia muscular FZA MMSS · espacios reducidos · sprints RSA 40 m ×10 compensatorio |
| Dom 9 | MD+1 | Descanso |

### 0.2 Los tres errores que el formato no puede detectar

Son la **justificación funcional** de este módulo. No se enumeran para criticar
al cuerpo técnico: se enumeran porque cada uno se corrige con una regla de
software, y esa correspondencia es la que ordena las fases.

| # | Hallazgo | Qué lo corrige |
|---|---|---|
| **H1** | **Los índices MD están mal.** Con partido el miércoles, el martes es **MD-1**, no «MD-3». Con partido el viernes, el sábado es MD+1 y el domingo MD+2 — el tablero rotula el domingo como MD+1. El jueves es a la vez MD+1 (del miércoles) y MD-1 (del viernes); resolverlo como «activación» es correcto en la práctica, pero el rótulo esconde que ese día está atrapado entre dos partidos. | **D3** — el índice MD se **calcula** desde los días marcados como partido, nunca se escribe a mano. Cuando un día cae entre dos partidos, se muestran **ambos** índices. |
| **H2** | **El sábado dice «regenerativo» y no lo es.** Hipertrofia de miembros superiores + espacios reducidos + 10 series de RSA a 40 m, 24 h después de un partido oficial, es un día de carga alta. Quien lee «regenerativo» asume descarga. Es la contradicción más costosa del tablero. | **D6** — validación del rótulo contra el contenido y la carga declarada. Aviso, no bloqueo. |
| **H3** | **Dos partidos en 3 días con un solo día de descanso limpio.** Miércoles y viernes competitivos, más fuerza el martes y el sábado. La ventana crítica (mié→sáb) va sin ningún día libre. | **F3** — alerta de densidad competitiva (partidos en ventana de 72 h) y de días consecutivos sin descanso. |

### 0.3 El hallazgo de fondo: no hay ni un indicador

Ni el tablero semanal ni la hoja de sesión registran **un solo número
comparable**. La sesión tiene bloques cualitativos —Dpto. Médico, Entrenamiento
PT, Fase Inicial, Juego Introductorio, Juego Situacional— y un listado de ~20
jugadores, pero ningún campo donde entre un dato: sin volumen, sin RPE, sin
distancia, sin conteo de acciones. Las únicas magnitudes trazables de todo lo
visible son los 40 m de los RSA y el número de series.

**El deck es un documento de comunicación, no de medición.** Sirve para que el
cuerpo técnico y los jugadores sepan qué se hace. No sirve para responder
«¿cuánta carga acumuló este jugador en el mes?» ni «¿el rendimiento del sábado
se explica por el miércoles?».

Eso es lo que este módulo agrega: **el mismo tablero, pero que sabe sumar.**

---

## 1. Qué existe HOY en SportMaps (verificado en el repo, no supuesto)

| Pieza | Dónde | Qué hace / qué le falta |
|---|---|---|
| **Plan de entrenamiento** | `training_plans` · `TrainingPlansPage.tsx` (581 líneas) | `(team_id, plan_date, objectives, warmup, drills jsonb, materials, notes)`. Es **texto libre por día**. Sin microciclo, sin tipo de día, sin índice MD, sin ninguna magnitud. ⚠️ **No tiene `school_id`**: su RLS depende de un JOIN a `teams`. |
| **Sesión con cupo** | `training_sessions` | `(team_id, session_date, session_time, max_capacity, current_bookings)`. Es la tabla de **reserva y cupo** — asistencia y créditos, no contenido. ⚠️ **No está vinculada a `training_plans`.** Dos tablas de nombre casi idéntico que modelan cosas distintas y no se conocen entre sí. Es el eje que `MOD-8` ya tiene marcado para sanear. |
| **Partidos** | `competition_results` | `(competition_date, opponent, competition_name, team_id, school_id, result_data)`. Registra el partido **después de jugado**. ⚠️ **No hay tabla de calendario de partidos futuros**, así que hoy no existe contra qué contar un MD hacia adelante. Decisión **D2**. |
| **Tablero táctico** | `match_lineups` + `match_lineup_players` con `slot_label`/`x`/`y` (mig. `20260819142728`) · `TacticalBoard.tsx` (1426 líneas) | Formación libre por drag-and-drop, plantillas por situación, modo pizarra. Ya acepta `source_type='training_session'`: el tablero **ya cubre qué pasa dentro de una sesión** sobre la cancha. ⚠️ Se cuelga de `training_sessions` (la tabla de cupos), no de `training_plans` (la de contenido) — el mismo eje roto de arriba. |
| **Métricas** | `performance_entries` · `sport_metric_definitions` · `sport_metric_thresholds` | Alimentan el Informe Mensual del Atleta. Miden **al atleta** (test, marca), no **a la semana**. Les falta `higher_is_better`, pesos y normalización → `MOD-10`. Y hay **486 filas en toda la base**: el precedente de que una tabla de captura manual se queda vacía. |

### 1.1 El hueco, en una línea

SportMaps sabe decir **quién entrena** y **quién asistió**. No sabe decir **qué
iba a ser la semana, cuánta carga cargó, ni si se ejecutó como estaba planeado.**

---

## 2. Decisiones de producto

Las marcadas «por defecto (sin objeción)» se pueden ejecutar como están; las
marcadas 🔴 **bloquean** el plan de su fase y necesitan respuesta explícita.

| # | Pregunta | Decisión propuesta | Nota |
|---|---|---|---|
| **D1** | ¿El microciclo es una entidad, o se deriva de las fechas? | Por defecto (sin objeción): **entidad**. `training_microcycles` con número, rango y objetivo. | El deck lo numera («MICROCICLO 40») y ese número es el lenguaje del cuerpo técnico. Derivarlo de las fechas obliga a inventar de dónde arranca la cuenta. |
| **D2** | 🔴 ¿De dónde salen los partidos que definen el MD? | Tres caminos: **(a)** tabla nueva de fixtures · **(b)** reusar `events` (torneos) · **(c)** marcar el día del microciclo como `partido` a mano. **Propuesta: (c) en F1** — el día del microciclo ya se está creando, marcarlo cuesta cero — y fixtures reales como fase posterior si el club los pide. | `competition_results` es post-hoc: no sirve para planear hacia adelante. Esta decisión define el DDL de F1, así que hay que contestarla antes de escribir SQL. |
| **D3** | ¿El índice MD se calcula o se escribe? | Por defecto (sin objeción): **se calcula, nunca se escribe.** Y cuando un día cae entre dos partidos, se muestran **los dos** índices. | Corrige **H1** de raíz. Un campo escrito a mano reproduce el error del Canva dentro del producto. |
| **D4** | 🔴 ¿Qué mide la carga? | **sRPE (Foster): RPE de sesión 0–10 × minutos = unidades arbitrarias (UA).** De ahí salen monotonía, strain y ACWR. GPS y wearables quedan fuera de v1. | Es el único método que no necesita hardware ni presupuesto — funciona con un dato que el coach ya tiene en la cabeza al terminar. Si se elige otro modelo, cambia toda la F2. |
| **D5** | ¿Quién registra el RPE? | Por defecto (sin objeción): **el coach, por sesión, en F2.** El RPE del atleta (que es el uso canónico del método) entra en **F3** como aditivo. | Empezar por el coach es un dato por sesión; empezar por el atleta son 20. Ver R1. |
| **D6** | ¿El rótulo del día se valida contra su contenido? | Por defecto (sin objeción): **sí, con aviso — nunca bloqueo.** Modo audit antes de enforce (regla 5 del §0 del roadmap). | Corrige **H2**. Un bloqueo acá sería el producto discutiéndole la metodología al cuerpo técnico. |
| **D7** | ¿Visible al padre o al atleta? | Por defecto (sin objeción): **no en v1** — coach y admin de escuela. | Igual que D3 del spec táctico. Abrirlo al atleta es aditivo y no bloquea nada. |
| **D8** | ¿Solo fútbol o multideporte? | Por defecto (sin objeción): **modelo agnóstico desde el día uno** (día, rótulo, carga, UA). El **vocabulario MD** y la cancha son de fútbol y quedan detrás de un flag por deporte. | El spec táctico se declaró fútbol-only a propósito; este no puede: la carga se mide igual en patinaje y en crossfit, y el catálogo de deportes ya arrastra el hueco de gimnasio/CrossFit (`MOD-16`). |
| **D9** | ¿El mesociclo (mes) es una entidad, o alcanza con leer varios microciclos por rango de fechas? | Por defecto (sin objeción): **entidad**, `training_mesocycles`, igual razón que D1. El Excel de Carmel le pone objetivo general y modelo/principios de juego **propios del mes**, que no son la suma de los objetivos semanales — necesitan un lugar donde vivir. | §3.5 |
| **D10** | ¿Cómo se liga el microciclo al mesociclo? | Por defecto (sin objeción): FK **opcional** (`training_microcycles.mesocycle_id`, nullable). Un equipo puede seguir usando microciclos sueltos sin planear a nivel mensual — no se fuerza el escalón de arriba para usar el de abajo. | §3.5 |
| **D11** | Las filas «Cumplimiento objetivos» / «Rendimiento colectivo» / «Aspectos a mejorar» del control semanal del Excel — ¿derivadas o texto libre del coach? | Por defecto (sin objeción): **texto libre**, no hay forma de derivar un juicio del coach. «Asistencia» y «Carga/intensidad», que sí son las mismas dos filas, se leen de `v_microcycle_load` (§3.3) — no se duplican en una tabla nueva. | §3.5 |
| **D12** | ✅ **Resuelta 2026-08-31, revisada 2026-09-18.** La rúbrica de la hoja `EVALUACIÓN` (6 indicadores × 5 cortes, 1–10) — ¿es **por equipo** (como está en el Excel) o **por atleta**? | **Por equipo, aplicado y en uso.** El toggle `evaluation_mode` existe en `MesocycleFormDialog` y `MesocycleRubricTable.tsx` soporta ambos modos — pero el modo `individual` tiene un defecto real (ver §8.5: el `INSERT` a `performance_entries` no tiene dónde guardar el corte `inicial/semana_2/.../final`) y **cero uso en producción**. Recomendación de la revisión del 18-sep: lanzar únicamente `team`, dejar `individual` detrás de un flag hasta corregir el corte — mismo criterio que R6. | §3.5, §8.5 |

---

## 3. Modelo conceptual (borrador — el DDL real va en el plan de cada fase)

### 3.1 Microciclo y días

`training_microcycles` — `(school_id, team_id, number, starts_on, ends_on,
objective, created_by)`. **Con `school_id` explícito**, a diferencia de
`training_plans`: hacer depender la RLS de un JOIN a `teams` es lo que encarece
todas las policies de ese eje.

`training_microcycle_days` — `(microcycle_id, day_date, day_type, planned_rpe,
planned_minutes, focus)`. `day_type` es **`text` + `CHECK`**, no `CREATE TYPE`
(convención del repo): `descanso` · `entrenamiento` · `partido` ·
`regenerativo` · `activacion`. Índice único por `(microcycle_id, day_date)`.

### 3.2 La sesión NO es una tabla nueva

El contenido de la sesión ya vive en `training_plans`. Se **extiende**
(`microcycle_day_id`, `session_rpe`, `actual_minutes`), no se duplica. Crear una
tercera tabla de sesiones al lado de `training_plans` y `training_sessions` es
exactamente el error que este módulo tiene que evitar — y el mismo que ya obligó
a abrir `MOD-8`.

> ⚠️ **No es lo que se construyó — revisión 2026-09-18 (§8.2).** El plan de
> ejecución (`plan-mesociclo-carmel-2026-08-31.md` §1.2) invirtió el sentido del
> FK: en vez de `microcycle_day_id` en `training_sessions` (como dice este
> párrafo), quedó `session_id` en `training_microcycle_days`, con
> `UNIQUE(microcycle_id, day_date)`. El efecto no es cosmético: un día solo
> puede tener **una** sesión, y crear+enganchar es un INSERT y un UPDATE
> **sin transacción** — la causa raíz del bug de sesiones huérfanas que se
> arregló el 18-sep (ver `project_mesociclo_sesiones_no_guardaban_fix` en
> memoria del proyecto). Además hace imposible el caso normal de un club que
> entrena dos veces el mismo día (gimnasio AM + cancha PM). Pendiente de
> corregir: mover el FK a `training_sessions.microcycle_day_id` (nullable) tal
> como decía este párrafo desde el principio.

### 3.3 Los indicadores son derivados, no tablas

Vista/RPC `v_microcycle_load`, **calculada en la base**. El censo de cálculos
monetarios ya dejó la lección: lo que calcula el navegador divergen del RPC.

| Indicador | Cómo sale | Qué responde |
|---|---|---|
| UA por día / por semana | `session_rpe × actual_minutes` | Cuánto cargó de verdad |
| Monotonía | media semanal ÷ desvío estándar | Si la semana es toda igual (monótona = más riesgo con la misma carga) |
| Strain | UA semanal × monotonía | La combinación de las dos |
| ACWR | UA 7 días ÷ media de 28 días | El salto de carga. Necesita **28 días de historia** → R2 |
| Densidad competitiva | partidos en ventana de 7 días y de 72 h | **H3** |
| Días consecutivos sin descanso | recorrido de `day_type` | **H3** |
| Adherencia | sesiones con `session_rpe` ÷ días `entrenamiento` | Si el módulo se está usando o quedó vacío → R1 |
| Carga por atleta *(nuevo, D13)* | `asistió × session_rpe × minutos`, de la asistencia que ya se registra; en día `partido`, titular/suplente desde `match_lineups` | Responde §0.3 tal cual está planteada ("¿cuánta carga acumuló ESTE jugador?") sin pedirle nada nuevo a nadie — hoy la UA es una cifra por equipo, no por jugador |

> ⚠️ **Umbral de frecuencia — encontrado en la revisión 2026-09-18, no estaba
> en el spec original.** Monotonía/strain/ACWR son métricas pensadas para
> entrenamiento casi diario. Club Carmel entrena 2 veces por semana: con 5 días
> en cero, la desviación estándar se dispara y la "monotonía" sale como ruido,
> no como señal. Regla a agregar antes de construir F2: mostrar estas tres
> métricas solo con **≥3-4 sesiones/semana** de historia; por debajo, un "no
> aplica" explícito — mismo patrón que R2 con el ACWR y sus 28 días. Falta
> además decidir si los días `descanso` cuentan como `0` en el cálculo de la
> media/desvío o se excluyen del denominador — cambia el resultado y el spec
> no lo fija.

> **D13 (nuevo, propuesto 2026-09-18):** el spec en §0.3 plantea el objetivo
> como "¿cuánta carga acumuló este jugador en el mes?", pero lo diseñado (D4,
> §3.3) mide carga **por equipo**, no por atleta. Cruzar el sRPE de sesión con
> la asistencia que ya se registra (que ya distingue quién estuvo y quién no)
> da carga individual sin pedirle un dato más a nadie — y en día de partido, la
> alineación (`match_lineups`) ya dice quién jugó de titular y quién no. Sin
> esto, H3 (dos partidos en 72 h) genera la misma alerta para el jugador que
> disputó 180 minutos y para el que no entró en ninguno de los dos. Bloquea
> F2/F3 igual que D4 — se resuelve junto con esa decisión.
### 3.4 Índice MD calculado

Función de lectura que, dado un microciclo, devuelve por día su distancia en días
al partido anterior y al siguiente. Nunca persiste. Un día entre dos partidos
devuelve las dos etiquetas (`MD+1` y `MD-1`) y la UI muestra ambas.

> ⚠️ **Bug real en lo construido — revisión 2026-09-18 (§8.1).** La
> implementación (`mdLabelsForDay` en `MesocycleSection.tsx`) calcula el MD
> **solo contra los partidos del microciclo ya cargado en memoria** — no mira
> fuera de esa semana. Un club que juega el fin de semana tiene su lunes
> siguiente en OTRO microciclo: hoy ese lunes no muestra `MD+1` de nada, porque
> el partido del domingo vive en la semana anterior. Es **H1 reproducido
> dentro del producto** — exactamente lo que D3 se propuso evitar. Hay que
> resolverlo en base (función que mire ±7 días de partidos del mismo equipo,
> sin importar el límite del microciclo) **antes de PER-5**: si no, el
> exportable imprime el mismo error que tenía el Canva de Santa Fe.

### 3.5 Mesociclo (nivel mensual) — de `MESOCICLO C.C.C..xlsx`, Club Carmel

El Excel tiene dos hojas. La primera (`MESOCICLO`) planea el mes: encabezado
(equipo, entrenador, período, nº de sesiones, duración), objetivo general +
modelo/principios de juego del mes, una grilla de 4 semanas × 2 sesiones con
contenido por sesión, una tabla de control semanal, y un cierre (fortalezas /
por mejorar / notas para el próximo mesociclo). La segunda (`EVALUACIÓN`) es una
rúbrica de 6 indicadores puntuados 1–10 en 5 cortes (inicial, semana 2, 3, 4,
final) más conclusiones.

**Lo que la grilla de sesión-por-sesión pide, ya existe — no es una tabla
nueva:**

| Columna del Excel | Dónde ya vive |
|---|---|
| Objetivo de la sesión | `training_sessions.objectives` |
| Principio de juego | `training_sessions.game_principles` (`CAR-8`) |
| Observaciones | `training_sessions.notes` |
| Intensidad (planeada) | `training_microcycle_days.planned_rpe` (F1, §3.1) |
| Duración (planeada) | `training_microcycle_days.planned_minutes` (F1, §3.1) |
| Contenido técnico / táctico / físico | Nuevo: `component` en cada bloque de `session_blocks` (`CAR-8`) — `tecnico`\|`tactico`\|`fisico`\|`mixto`. No es columna nueva, es un campo más en el jsonb que `CAR-8` ya definió. |

Es la confirmación cruzada de que `CAR-8` (nivel sesión) y el F1 pendiente de
este spec (nivel semana) ya cubren todo el contenido operativo del Excel. Lo
único que falta es el **contenedor del mes** y su cierre — eso sí es modelo
nuevo:

```
training_mesocycles        (school_id, team_id, starts_on, ends_on,
                             n_sessions_planned, session_duration_minutes,
                             general_objective, game_model,
                             closing_review jsonb, created_by)
  └── training_microcycles.mesocycle_id   (FK opcional — D10)
        └── training_microcycles.objective_compliance      (texto, D11)
        └── training_microcycles.collective_performance    (texto, D11)
        └── training_microcycles.improvement_notes         (texto, D11)

training_mesocycle_evaluations   (mesocycle_id, indicator text+CHECK,
                                   checkpoint text+CHECK, score smallint
                                   CHECK 1-10, observations)
```

- `closing_review jsonb` = `{strengths, areas_to_improve, next_cycle_notes}` —
  mismo patrón que `evaluation` de `CAR-8` en `training_sessions`, no una tabla
  aparte para tres campos de texto.
- Los tres campos de cierre semanal viven en `training_microcycles` (que ya
  existe desde F1), no en una tabla nueva de "revisión semanal": la semana **es**
  el microciclo.
- `training_mesocycle_evaluations` en formato largo (una fila por indicador ×
  corte) en vez de 30 columnas: los 6 indicadores (`tecnica_individual`,
  `toma_decisiones`, `principios_juego`, `condicion_fisica`,
  `comportamiento_colectivo`, `rendimiento_competitivo`) y los 5 cortes
  (`inicial`, `semana_2`, `semana_3`, `semana_4`, `final`) son ambos `text +
  CHECK`, convención del repo.

**Por qué esto importa más allá de Carmel:** `CAR-8` está construido y
aplicado, pero **verificado el 2026-08-31 sin una sola fila real usándolo**
(ver `docs/ROADMAP.md`). El Excel del mesociclo sugiere una explicación: el
flujo real del cuerpo técnico no empieza en una sesión suelta, empieza
planeando el mes. Sin `training_mesocycles`, un coach de Carmel no tiene dónde
volcar ese primer paso — y sin ese primer paso, puede que nunca llegue a abrir
`SessionFormDialog`.

### 3.6 Verificación contra la base viva (2026-08-31) — antes de reusar, no solo antes de construir

La ruta de reuso de §3.5 (D2, D4, D12-individual) se verificó por REST contra
`luebjarufsiadojhvxgi`, no solo contra el `.sql`. Confirma que las piezas
existen y también expone que **casi nada del módulo de fútbol tiene uso real
todavía**:

| Pieza | Filas reales | Nota |
|---|---|---|
| `sport_metric_definitions` (fútbol, 6 esperadas) | 6/6 existen | ⚠️ **`duelos_ganados` no es lo que la migración del 12-ago quiso sembrar** — pero **no se corrige**, se descarta la premisa. `created_at` 2026-07-15, `data_type='count'`, sin `min_value`/`max_value`. El `ON CONFLICT DO NOTHING` chocó contra esa fila vieja y no la reemplazó. **Verificado 2026-08-31: tiene 43 filas reales en `performance_entries`, con valores de 1 a 8** — un 1-8 conteo real, no una escala 1-5. Forzarla a `rating` 1-5 (lo que el 12-ago intentó) habría sido el bug, no el fix: rompía un `CHECK` contra datos vivos y falseaba 43 mediciones reales a una escala que no les corresponde. **Se deja intacta.** Si `D12`-individual todavía quiere un 6º indicador técnico 1-5 (el que el 12-ago no pudo sembrar por la colisión de nombre), va con un `metric_key` **distinto** — nunca reusar `duelos_ganados` |
| `performance_entries` | 498 filas | `context_type`: **100 % `manual`**, 0 con `evaluation` — confirma que el hueco que propone D12-individual está libre, no que ya funciona con datos reales |
| `tournament_matches` | **0 filas** | La mitad de D2 que reusa `scheduled_at` no tiene ni un caso real que la ejercite hoy |
| `competition_results` | 2 filas | |
| `match_lineups` / `football_match_events` / `match_lineup_players` | 1 / 5 / 14 | Todo del **mismo equipo**, `Sub-12 Fútbol A` de **Academia Fútbol Demo** — una escuela demo, no un cliente real, y no es Carmel |
| `team_members.position_code` | **0 de 33** | El catálogo de posiciones (`arquero`/`defensa`/`medio`/`delantero`) no se usó ni una vez desde que se agregó el 12-ago |

**Conclusión honesta:** el diseño de reuso es correcto — las piezas existen con
las columnas que se asumieron — pero **nada de esto está probado con uso real
de un cliente**, y mucho menos de Carmel específicamente. "Está cubierto" es
cierto a nivel de esquema, no a nivel de evidencia de que el flujo funciona en
la práctica.

---

## 4. Fases de entrega

| Fase | Alcance | Depende de |
|---|---|---|
| **F0 — Sanear el eje** | `training_plans` sin `school_id` · `training_plans` ↔ `training_sessions` sin vínculo · el tablero táctico colgado de la tabla de cupos. **Puerta dura: no se construye periodización encima de un eje roto.** Comparte trabajo con `MOD-8`, se hace una vez. | — |
| **F1 — Microciclo** | Entidad + días + rótulos + **índice MD calculado** + vista semanal (el equivalente del tablero de Canva, con los índices bien). CRUD de coach. | D1, D2, F0 |
| **F2 — Carga** | sRPE del coach, UA, monotonía, strain, ACWR, semáforos. **Modo audit**: se muestra, no bloquea nada. | D4, D5, F1 |
| **F3 — Alertas y validación de rótulo** | Aviso cuando el contenido contradice el rótulo (**H2**), cuando hay dos partidos en <72 h (**H3**), cuando el ACWR se sale de rango. RPE del atleta. | D6, F2 |
| **F1b — Mesociclo** | `training_mesocycles` + `component` en `session_blocks` + cierre semanal en `training_microcycles` (§3.5). CRUD de coach: crear el mes, encadenar sus microciclos, cerrar con fortalezas/por mejorar. | D9, D10, D11, F1 |
| **F4 — Plantillas de microciclo** | Duplicar la semana anterior como punto de partida editable. Mismo patrón que el tablero táctico duplicando slots: copiar filas, no catálogo cerrado. | F1 |
| **F5 — Exportable** | La vista semanal a PDF/imagen. **Es el gancho comercial real**: hoy el cuerpo técnico mantiene 105 diapositivas a mano en Canva (y el mesociclo, a mano en Excel). | F1 |
| **F6 — Vínculos** | Tablero táctico (es la `P3` del spec de fútbol: mismo tablero con contexto `training`) e Informe Mensual del Atleta (la carga del mes junto a las métricas). | F1, tablero P0 (ya en `develop`) |
| **F7 — Rúbrica de mesociclo** | `training_mesocycle_evaluations` + hoja `EVALUACIÓN` del Excel. Depende de **D12** — si termina siendo por atleta en vez de por equipo, este DDL cambia entero. | D12, F1b |

Cada fase es rama aparte con revisión, como Informes y como el tablero táctico.

---

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| **R1** | **El coach no registra el RPE y el módulo queda vacío.** No es hipotético: `performance_entries` tiene 486 filas en toda la base. | El RPE es **un tap** al cerrar la sesión, con valor sugerido según el `day_type`. Y la vista de F1 tiene que ser útil **sin un solo RPE** — si el módulo solo sirve lleno, no se llena nunca. La adherencia (§3.3) se mide y se muestra. |
| **R2** | **Creerse un ACWR con 5 días de datos.** Necesita 28 días de historia para significar algo. | Estado explícito «faltan N días de historia», no un número engañoso. Mismo patrón que R3 del spec táctico y que el «última medición hace N días» del Informe. |
| **R3** | Construir F1 encima del eje roto y multiplicar la deuda. | F0 es puerta dura, no recomendación. |
| **R4** | **La carga es dato de salud sin ser dato clínico.** Si al RPE se le pega el registro de lesiones, el módulo entra en el terreno de `BLQ-5` (Wellness Pro): datos clínicos inmutables, retención de 5 años, Ley 23/1981. | **Lesiones fuera de v1, explícitamente.** El sRPE por sí solo no es historia clínica; cruzarlo con diagnóstico sí. |
| **R5** | El vocabulario MD no aplica a patinaje ni a crossfit. | D8: el modelo es agnóstico, el MD va detrás de un flag por deporte. |
| **R6** | Alcance de 7 fases invita a que el scope crezca sobre la marcha. | Spec como fuente de verdad, revisión entre fases. Igual que Informes. |

---

## 6. Fuera de alcance (v1)

- **GPS, wearables y frecuencia cardíaca.** D4 elige sRPE justamente para no depender de hardware.
- **Prescripción automática** («qué debería entrenar el martes»). Los indicadores describen; no recetan.
- **Registro de lesiones y disponibilidad médica** → R4, es Wellness Pro.
- **Comparación entre escuelas.** Interno a una escuela, igual que el módulo táctico.

---

## 7. Estado

**2026-08-31 — F0 quedó parcialmente resuelto de rebote.** `CAR-8` (fuera de
este spec, ver `docs/ROADMAP.md`) ya sacó a `training_sessions` del choque de
nombres con `training_plans` — la mitad de F0 que hacía falta antes de escribir
cualquier DDL de este spec. Sigue pendiente la mitad de F0 que **no** tocó:
vincular `training_sessions` (contenido) con la reserva/cupo real y el tablero
táctico sigue colgado de la tabla vieja de cupos (ver nota en §1, fila
«Tablero táctico»).

**2026-09-18 — F1/F1b/F7/F8 aplicados y en uso real por primera vez** (ver §8).
`D2`, `D4`, `D9`-`D12` ya no bloquean: quedaron resueltas el 31-ago y siguen en
pie. Lo que sigue abierto no son decisiones sin contestar, son **defectos de lo
ya construido** (§8.1, §8.2) y features de fase posterior sin empezar (`PER-0(c)`,
`PER-2` real, `PER-3`, `PER-4`, `PER-5`, `PER-6`).

**Insumo pendiente del usuario:** las diapositivas 2–4 del deck de Santa Fe
(microciclos de septiembre) para poder hacer el cruce de los 4 fines de semana
— si el patrón «fuerza el sábado post-partido» se repite, deja de ser un caso y
pasa a ser la regla que F3 tiene que avisar. La revisión del 18-sep coincide en
esto: **F3 no se construye con la muestra de una sola semana** — hay que
esperar ese insumo y escribir las reglas de forma estructural
(`day_type='regenerativo' AND planned_rpe > 4`), no por texto.

---

## 8. Revisión externa — 2026-09-18

Primer uso real del módulo por un coach (Categoria 2018-19), que expuso dos
bugs de construcción — ninguno de los dos era una decisión de producto sin
resolver, eran defectos de lo ya aprobado. Ambos arreglados y verificados
contra la base viva el mismo día (`20260918124721`, `20260918131232` — ver
`project_mesociclo_sesiones_no_guardaban_fix` en memoria del proyecto). Esta
sección deja constancia de lo que la revisión encontró más allá de esos dos
fixes, para que no se pierda entre el código y el chat.

### 8.1 Índice MD no cruza microciclos — ver nota en §3.4

✅ **Corregido 2026-09-21** (`20260921115743`). RPC `training_days_md_labels()`
mira todos los partidos del equipo, sin importar el microciclo. Probado contra
un mesociclo con partidos en semanas distintas: el día siguiente a un partido
de la semana anterior ahora sí muestra `MD+1`. `mdLabelsForDay()` en cliente,
retirado de `MesocycleSection.tsx`.

### 8.2 Dirección del FK día↔sesión, invertida respecto a este spec — ver nota en §3.2

El plan de ejecución puso `session_id` en el día en vez de `microcycle_day_id`
en la sesión (que es lo que dice §3.2 arriba). Consecuencia medida en
producción: `UNIQUE(microcycle_id, day_date)` fuerza una sesión por día, y la
creación en dos escrituras no transaccionales fue la causa raíz de sesiones
huérfanas reales (ya arregladas a mano). El fix aplicado el 18-sep es
paliativo (ocultar el botón que creaba huérfanas); la causa de fondo —el
sentido del FK— sigue sin corregirse.

### 8.3 Carga por atleta — ver D13 nuevo en §3.3

El objetivo declarado en §0.3 ("¿cuánta carga acumuló este jugador?") no lo
responde lo construido (carga por equipo). D13 propone cerrarlo cruzando
sRPE × asistencia × alineación, sin pedir un dato nuevo.

### 8.4 Monotonía/strain/ACWR necesitan un umbral de frecuencia — ver nota en §3.3

No aplican tal cual a un club que entrena 2 veces por semana (el caso real de
Carmel). Nota agregada en §3.3 arriba.

### 8.5 Modo `individual` de D12, defecto real

El `INSERT` a `performance_entries` de §1.5 (ver
`plan-mesociclo-carmel-2026-08-31.md`) no tiene dónde guardar el corte
(`inicial`/`semana_2`/`semana_3`/`semana_4`/`final`) — se pierde exactamente el
eje que distingue una rúbrica de una sola nota. Camino nunca ejercido en
producción (§3.6 ya lo advertía). ⚠️ **Mitigado, no corregido, 2026-09-21:**
la opción "Por atleta" queda deshabilitada (grisada, con nota) en
`MesocycleFormDialog.tsx` — sigue eligible el que ya la tuviera guardada de
antes (no había ninguno en producción), pero nadie nuevo puede elegirla hasta
que el corte se guarde de verdad. La causa de fondo sigue sin tocarse.

### 8.6 Endurecer el DDL — hallazgos de QA sobre el esquema aplicado

✅ **Los 4 puntos de abajo corregidos y probados 2026-09-21** (`20260921115743`)
— FK compuesto, exclusión de solapamiento, `UNIQUE(mesocycle_id, number)` y el
trigger de rango, los cuatro con un caso negativo real que confirma que
rechazan. Al verificar el día-en-rango antes de crear el trigger se encontró
1 fila real fuera de rango (team 1375b77e, corregida) y 2 filas del mesociclo
de prueba "PRUEBA" que quedaron sin tocar (sin semana válida a la que
reasignarse / duplicado de una fila ya correcta). Sigue pendiente la quinta
viñeta (pruebas negativas de RLS en `seguridad:invariantes`) — no se tocó esa
RPC genérica en esta pasada.

Verificado contra `pg_constraint` en la base viva el 18-sep (no son
hipótesis):

- ✅ **`CHECK(ends_on >= starts_on)` ya existe** en `training_mesocycles` y en
  `training_microcycles` — un reviewer lo señaló como ausente, se verificó y
  **no lo está**. Se deja constancia acá para que no se repita el hallazgo.
- ⚠️ **`school_id` denormalizado sin garantía de consistencia con el padre**
  (`training_microcycle_days.school_id` vs. el `school_id` real de su
  `microcycle_id`, mismo patrón en `training_mesocycle_evaluations`). El FK a
  `schools(id)` no impide que un staff de la escuela A inserte un día con
  `school_id=A` apuntando a un microciclo de la escuela B — RLS no lo
  atraparía porque valida contra el `school_id` de la fila, no contra el del
  padre. Fix: FK compuesto `(microcycle_id, school_id)` contra una `UNIQUE`
  equivalente en `training_microcycles`, mismo patrón para `team_id`.
- ⚠️ **Sin exclusión de solapamiento de microciclos por equipo**
  (`EXCLUDE USING gist` con `daterange(starts_on, ends_on)`) y **nada impide
  que un día quede fuera del rango de fechas de su microciclo** — ninguna de
  las dos está en el DDL aplicado.
- ⚠️ **`training_microcycles.number` es nullable y sin `UNIQUE`**, pese a que
  D1 dice que ese número es el lenguaje del cuerpo técnico («microciclo 40»).
  Nada impide dos semanas con el mismo número dentro del mismo mesociclo.
- ⚠️ **Sin pruebas negativas de RLS por rol** en `seguridad:invariantes` para
  estas 4 tablas — la grieta de `training_sessions` que dejaba leer a
  padres/atletas (arreglada el 18-sep) se habría detectado sola con un test
  que afirme «padre/atleta → 0 filas» corriendo en cada CI, en vez de
  encontrarse porque alguien preguntó en el chat.

### 8.7 Regla de repo, no solo un fix puntual

El plan de ejecución (`plan-mesociclo-carmel-2026-08-31.md` §2) eligió
escritura directa desde el cliente "por consistencia con `CAR-8`", explícito
en el texto: "sin RPCs nuevas". El bug de §8.2/§3.2 (mesociclo creado sin sus
semanas por un segundo insert sin transacción) es el costo concreto de esa
elección para cualquier creación multi-fila. La regla que sale de esto —
**toda creación que escribe más de una fila relacionada va por RPC
transaccional, no por dos o más inserts sueltos desde el cliente** — se agregó
a `CLAUDE.md` el 18-sep. `plan-mesociclo-carmel-2026-08-31.md` §2 queda
desactualizado en ese punto (ver nota ahí).

### 8.8 D10 a medias — microciclos sin mesociclo pierden la vista agrupada

`training_microcycles.mesocycle_id` es opcional por diseño (D10: "un equipo
puede seguir usando microciclos sueltos"), pero `MesocycleSection.tsx` solo
renderiza el accordion por semana cuando hay un `mesocycle` cargado — un
equipo con microciclos sueltos (sin mesociclo) hoy no tiene ninguna vista que
los agrupe; cae a la lista plana de sesiones de siempre, sin días, sin tipo,
sin índice MD. La opción que D10 dijo que quedaba disponible no tiene UI.
Sigue sin construirse.

### 8.9 Cerrado en la misma pasada del 21-sep, no encontrado en la revisión original

Dos cosas más, ✅ cerradas junto con §8.1/§8.5/§8.6:

- **Botón "Eliminar mesociclo".** No existía forma de recuperarse de un
  mesociclo mal creado desde la UI — exactamente lo que disparó el bug de
  mesociclos fantasma del 18-sep. Al construirlo se encontró un segundo
  defecto: `training_microcycles.mesocycle_id` es `ON DELETE SET NULL` (D10),
  así que un `DELETE` directo sobre `training_mesocycles` no borraba las
  semanas — quedaban huérfanas y seguían ocupando `UNIQUE(team_id,
  starts_on)`, sin resolver nada. RPC `delete_mesocycle_cascade()`
  (`20260921120611`) borra semanas y mesociclo en una transacción; probado el
  ciclo completo crear→borrar→recrear con las mismas fechas.
- **`component`** (técnico/táctico/físico/mixto) agregado a cada bloque de
  `session_blocks` en `SessionFormDialog.tsx` — lo único que la grilla del
  Excel de Carmel (§3.5) pedía y `CAR-8` no había sumado.
