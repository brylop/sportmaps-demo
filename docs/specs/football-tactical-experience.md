# Experiencia Táctica de Fútbol — tablero interactivo, tarjetas de jugador, estrategias y entrenamientos

> **Estado: para aprobación.** No se escribe código de migraciones hasta que
> las decisiones de la sección 2 estén resueltas (convención del repo: *plan
> antes de código en migraciones*).
>
> Pedido original: llevar "métricas y estadísticas" a algo moderno, visual e
> interactivo — estilo Football Manager / FIFA Ultimate Team / fantasy — que
> funcione igual de bien en celular que en escritorio, para partidos **y**
> entrenamientos. Alcance confirmado con el usuario: las 5 piezas de abajo,
> touch-first desde el día uno, diseño propio (no clon de una app puntual).

---

## 0. Contexto — qué existe HOY (no reinventarlo)

El "Módulo de Rendimiento de Fútbol" (Fase 1-4, commit `c230ce42`, 2026-08-12)
ya construyó una capa autocontenida:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Alineación de partido | `LineupModal.tsx` (582 líneas), `match_lineups`/`match_lineup_players` | Asigna jugador a **categoría** de posición por formulario. **Sin formación, sin coordenadas de cancha, sin drag-and-drop.** |
| Eventos de partido | `MatchEventsModal.tsx`, `football_match_events` | Goles, tarjetas, cambios — feed cronológico, no visual. |
| Dashboard de temporada | `FootballDashboardModal.tsx` (467 líneas), `FootballSeasonStats.tsx` | Tablas/resúmenes de stats por jugador y equipo. |
| Catálogo de posiciones | `team_members.position_code` (`20260812131456`) | **Solo 4 valores**: `arquero`, `defensa`, `medio`, `delantero`. No hay slots de formación (LB, CB, RW…) ni x/y en cancha. |
| Métricas base | `performance_entries`, `sport_metric_definitions`, `sport_metric_thresholds` | Ya alimentan el Informe Mensual del Atleta (`athlete_reports`). Es la data que las tarjetas de jugador (pieza 2) van a visualizar, no a recalcular. |
| BFF | `bff/src/routes/school/football.ts` (621 líneas, 9 endpoints) | CRUD de alineación/eventos, sin concepto de formación ni de "jugada guardada". |

### 0.1 Lo que NO existe y este spec cubre

- Formaciones con slots nombrados y coordenadas de cancha (4-3-3, 4-4-2, 3-5-2…).
- Interacción drag-and-drop (no hay `dnd-kit`/`react-dnd`/similar instalado).
- Cualquier noción de "estrategia" o "jugada" guardada y reutilizable.
- Tarjetas de jugador — hoy las métricas se ven en tabla, no en un formato
  visual comparable a una tarjeta de videojuego.
- Cualquier vínculo entre `TrainingPlansPage` (entrenamientos) y el módulo de
  fútbol — hoy son dos mundos separados.

---

## 1. La visión (resumen ejecutivo)

Cinco piezas, en este orden de dependencia (no de prioridad — el usuario pidió
las 5, pero la 2 depende de la 1, la 3 depende de la 1, la 4 depende de la 1):

1. **Tablero táctico interactivo** — cancha real, formaciones con slots
   nombrados, arrastrar jugadores entre posiciones, validado contra la
   plantilla disponible. Es la pieza base: sin esto no hay dónde "guardar
   una jugada" ni qué mostrar en el entrenamiento.
2. **Tarjetas de jugador gamificadas** — la data de `performance_entries` /
   `sport_metric_thresholds` en formato visual (radar, rating, forma
   reciente), no una tabla.
3. **Estrategias/jugadas guardadas** — presets tácticos por situación
   (ataque, defensa, balón parado, presión alta) que el coach arma una vez
   en el tablero y reaplica.
4. **Extensión a entrenamientos** — la misma cancha/formación se usa para
   planear una sesión de entrenamiento, no solo un partido oficial.
5. **Sugerencias automáticas** — "mejor XI del mes", alertas de rotación por
   minutos jugados, aprovechando data que ya se registra.

---

## 2. Decisiones de producto — RESUELTAS

| # | Pregunta | Decisión | Nota |
|---|---|---|---|
| **D1** | ¿Catálogo cerrado de formaciones o libre? | **Libre, slot por slot.** El coach arma su propia formación desde cero. | Más trabajo de UI (sección 3.1 detalla el modelo). Sin coordenadas predefinidas: el slot nace donde el coach lo suelta en la cancha. |
| **D2** | ¿Los slots reemplazan `position_code` o coexisten? | **Reemplaza.** | Auditado: `position_code` solo se usa en 3 archivos, **todos dentro del propio módulo de fútbol** (`footballQueries.ts`, `LineupModal.tsx`, `bff/.../football.ts`, sobre `match_lineup_players` — no sobre `team_members` en ningún otro lugar del código). Es exactamente el mismo set de archivos que P0 ya reescribe, así que el riesgo real es bajo pese a ser un reemplazo. Se corrige R2 más abajo. |
| **D3** | ¿Tarjetas de jugador visibles al padre? | **No por ahora — solo coach/admin.** | RLS igual a lo que ya existe para `performance_entries` del lado escuela. Abrir al padre queda como fase aditiva futura, no bloquea nada de lo de acá. |
| **D4** | ¿Estrategia guardada por equipo o por partido? | **Por defecto (sin objeción): por equipo**, reutilizable mes a mes. | Si prefieres por partido, se ajusta antes de escribir el plan de P2 — no afecta P0. |
| **D5** | ¿Entrenamiento comparte modelo con partido? | **Sí — modelo compartido con `context` (`training`/`match`).** | Un solo tablero, un solo backend. |
| **D6** | ¿Sugerencias automáticas ahora o después? | **Por defecto (sin objeción): reglas simples, con piso mínimo de datos** antes de mostrarlas (no ocultar el feature, mostrar "necesitamos más registros" si no hay suficientes). | Se detalla en P4, no bloquea nada de lo de acá. |
| **D7** | ¿Librería de drag-and-drop? | **Por defecto (sin objeción): `@dnd-kit`** (pointer+touch unificado, sin HTML5 DnD nativo — falla mal en WebViews de Capacitor). | Se confirma en la implementación de P0. |

---

## 3. Modelo conceptual (a validar en el plan de cada fase)

### 3.1 Formación + slots (pieza 1) — libre, por D1

Sin catálogo de formaciones: cada sesión táctica (partido o entrenamiento,
por D5) trae SUS PROPIOS slots. `tactical_sessions` (reemplaza el rol de
`match_lineups`, con `context` `match`/`training` por D5) tiene una tabla
hija `tactical_slots` (`session_id`, `slot_label` texto libre que el coach
escribe al crearlo, `x`/`y` normalizados 0–100 donde lo soltó en la cancha,
`position_category` — el reemplazo directo de `position_code`, mismas 4
categorías, ahora vive en el slot y no en `team_members`).

El coach puede partir de una formación en blanco y armar sus propios slots
(clic en la cancha → nace el slot ahí, arrastrable después), o — para no
partir de cero cada vez — duplicar los slots de la última sesión del mismo
equipo como punto de partida editable. Esto último no es un catálogo cerrado:
es copiar filas existentes, el coach las sigue pudiendo mover/renombrar/
borrar libremente.

### 3.2 Asignación (pieza 1)

`tactical_slot_assignments`: liga un `tactical_slot` con
`(subject_type, subject_id)` — mismo patrón polimórfico que
`performance_entries`/`match_lineup_players`. Reemplaza al actual
`match_lineup_players` (que fusiona slot + jugador en una fila; acá se
separan porque el slot ahora tiene su propia identidad con coordenadas).

### 3.3 Estrategia guardada (pieza 3)

`team_tactical_presets`: por equipo, nombre, formación base, situación
(`ataque`/`defensa`/`balon_parado`/`presion`), y un `jsonb` con las
asignaciones slot→jugador de referencia (no obliga a los mismos jugadores
cada vez, es una plantilla).

### 3.4 Tarjeta de jugador (pieza 2)

No es tabla nueva — es una vista/RPC de lectura sobre `performance_entries` +
`sport_metric_thresholds`, con el mismo patrón de highlights/radar que ya
existe en `frontend/src/lib/school/performanceDisplay.ts` (D-G del spec de
Informes: **no reimplementar el cálculo, reusarlo**).

> Todo lo de esta sección es un borrador para orientar la conversación de
> cada fase — el DDL real se escribe cuando el plan de esa fase se apruebe,
> con la misma disciplina que se usó para F1 de Informes (regularización
> primero, tests de concurrencia, RLS línea por línea).

---

## 4. Fases de entrega

| Fase | Alcance | Depende de |
|---|---|---|
| **P0 — Tablero táctico base** | Catálogo de formaciones, cancha visual con `@dnd-kit`, asignación drag-and-drop touch+desktop, reemplaza la asignación por formulario de `LineupModal`. | D1, D2, D7 |
| **P1 — Tarjetas de jugador** | Vista/RPC de lectura sobre data ya existente, componente de tarjeta (radar + rating), integrado al roster y al tablero (click en un slot → ver tarjeta). | D3, P0 (para el punto de entrada desde el tablero) |
| **P2 — Estrategias guardadas** | CRUD de `team_tactical_presets`, aplicar preset al tablero de un partido con un clic. | D4, P0 |
| **P3 — Extensión a entrenamientos** | Mismo tablero, contexto `training`, vínculo con `TrainingPlansPage`. | D5, P0 |
| **P4 — Sugerencias automáticas** | Reglas simples sobre minutos jugados / rotación / mejor XI. | D6, P1 (necesita las tarjetas para tener de dónde sacar el rating) |

Cada fase es rama aparte con revisión, como ya se hizo con Informes.

---

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | El drag-and-drop touch en un WebView de Capacitor se siente distinto a un navegador de escritorio (eventos pointer vs touch, scroll que compite con el drag). | Probar P0 en el APK real (no solo en el navegador del BFF/preview) antes de dar la fase por cerrada — es justo el tipo de cosa que "se ve bien en Chrome" y falla en el WebView. |
| R2 | ~~`position_code` se usa en otras pantallas~~ — descartado: auditado en sección 2 (D2), son solo 3 archivos y todos dentro del propio módulo que P0 reescribe. | N/A — riesgo real bajo. |
| R3 | Con 486 filas de `performance_entries` en toda la base, las tarjetas de jugador (P1) y las sugerencias (P4) pueden verse "vacías" para la mayoría de atletas. | P1 necesita un estado explícito de "pocos datos aún" (mismo patrón que el Informe Mensual con "última medición hace N días"), no ocultar la tarjeta ni mostrar un radar engañoso con 1 dato. |
| R4 | Alcance grande (5 piezas) invita a que el scope crezca sobre la marcha. | Fases con revisión entre cada una, spec como fuente de verdad — igual que Informes. |

---

## 6. Fuera de alcance (v1)

- Simulación de partido / IA táctica (más allá de sugerencias basadas en reglas simples de D6).
- Comparación entre equipos de distintas escuelas (esto es interno a UNA escuela).
- Multi-deporte — este spec es específicamente fútbol, dado que es el único deporte con el modelo de posiciones/formación ya empezado.

---

## 7. Estado

D1–D7 resueltas (sección 2). Siguiente paso: escribir el plan detallado de
**P0** (como se hizo con `plan-f1-informes-backend.md`) — DDL de
`tactical_sessions`/`tactical_slots`/`tactical_slot_assignments`, RLS línea
por línea, y el reemplazo de `LineupModal.tsx` por el tablero con
`@dnd-kit` — para aprobación antes de tocar código.
