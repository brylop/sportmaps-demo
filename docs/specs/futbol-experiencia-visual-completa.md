# Spec — Completar la experiencia visual de fútbol: bienestar/RPE, entrenamientos, sugerencias y video

**Producto:** SportMaps · **Versión:** v0.1
**Fecha:** Agosto 2026
**Estado:** 🟡 diseño resuelto, sin implementar. Asignado a Julian.

> Se construye **por fases con revisión entre cada una** (una rama por fase): (A) bienestar/RPE, (B) enganche del tablero a entrenamientos (P3), (C) sugerencias automáticas (P4), (D1) video enlazado + tagging. **Plan aprobado antes de código en migraciones** (convención del repo, `CLAUDE.md`). RLS revisado línea por línea antes de aplicar.

---

## 0. Contexto

Punto de partida: comparar SportMaps contra herramientas de referencia de fútbol (TacticalPad, Bcoach, SoccerPulse, Hudl, Metrica Sports, Longomatch) para mejorar la UI de métricas — más visual, más interactiva, más completa.

**Hallazgo clave: gran parte de esto YA está construido.** El spec `docs/specs/football-tactical-experience.md` (5 piezas: tablero táctico, tarjetas de jugador, estrategias guardadas, extensión a entrenamientos, sugerencias automáticas) tiene **P0, P1 y P2 ya en develop** (`f1f720d7 feat(futbol): tablero tactico P0/P2 - formacion libre, plantillas y modo pizarra`, con fix de seguridad posterior en `bd0cf22c`):

- **P0 — Tablero táctico interactivo**: `frontend/src/components/school/TacticalBoard.tsx` — cancha con drag-and-drop (`@dnd-kit`), formación libre, situaciones (ataque/defensa/presión/transición/corner/tiro libre/penalti), flechas y formas tácticas.
- **P1 — Tarjetas de jugador gamificadas**: `frontend/src/components/school/PlayerCard.tsx` — radar por bandas (verde/amarillo/rojo) sobre `performance_entries` + `sport_metric_thresholds`, highlights / a-trabajar. Visualmente ya es lo que TacticalPad/FIFA Ultimate Team ofrecen.
- **P2 — Estrategias guardadas**: `team_tactical_presets` — aplicar plantilla al tablero con un clic.

**Confirmado con el usuario:** el alcance de este spec es **completar fútbol**, no extender el modelo de formación/posiciones a otros deportes — hoy solo fútbol tiene modelo de posiciones, es la razón por la que el spec original lo acotó así. Extender a otros deportes queda fuera, explícitamente.

Lo que falta del spec original y lo que se agrega por las referencias externas:

| Pieza | Origen | Estado |
|---|---|---|
| **P3 — Extensión a entrenamientos** | Spec de fútbol (ref. Bcoach) | A medio construir: `source_type = 'training_session'` ya es válido en `match_lineups` (constraint `match_lineups_source_type_check_v2`), pero apunta a la tabla de **cupos/reserva** (`training_sessions`), no a la de **contenido** (`training_plans`) — son dos tablas sin vínculo entre sí ([[project_periodizacion_track]]). Unificarlas es **PER-0/MOD-8, ya trackeado aparte** — este spec NO lo reabre. |
| **P4 — Sugerencias automáticas** | Spec de fútbol | No construido. Insumo real ya existe: `minutes_played`/`goals`/`assists` por jugador agregados en `FootballSeasonStats.tsx`. **Caveat de datos:** `EVENT_TYPES` de `MatchEventsModal.tsx` es `['goal','assist','own_goal','yellow','red']` — no incluye sustitución, así que `minutes_played` puede ser una aproximación (titular = partido completo) y no el minuto real de cambio. Verificar la fuente real antes de confiar la alerta de rotación a ese número. |
| **Bienestar/RPE (ref. SoccerPulse)** | No estaba en el spec de fútbol | No construido. Ataca el riesgo ya identificado en el track de periodización: "que nadie registre el RPE" (`performance_entries` tiene 486 filas en TODA la base — ver [[project_performance_metrics_model]]). |
| **Video (ref. Hudl / Metrica Sports / Longomatch)** | No estaba en el spec de fútbol | No construido. Confirmado con el usuario que SÍ debe entrar — ver diseño en dos fases en §D. |

---

## A. Captura de bienestar / RPE (independiente de fútbol, reusa el esquema tal cual)

- **Prerrequisito chico:** `sport_metric_definitions.category` hoy tiene `CHECK (category = ANY (ARRAY['physical','technical','tactical','attendance']))` (`supabase/migrations/20260731154626_regularize_performance_schema.sql` y su versión lock-free `20260731160301`). Migración nueva que agrega `'wellness'` al CHECK — no se toca ni se borra la migración vieja, es un `ALTER` sobre la constraint en archivo nuevo con timestamp posterior.
- Seed de 4 `metric_key` en la categoría deportiva de fútbol: `fatiga`, `dolor_muscular`, `estres`, `calidad_sueno` — `data_type = 'rating'`, `category = 'wellness'`, `higher_is_better = false` para fatiga/dolor/estrés (menos es mejor) y `true` para sueño.
- UI de captura: pantalla mínima para el propio atleta (rating 1-5 con emoji/slider, no un formulario), reusando el mismo flujo de inserción a `performance_entries` que ya usa `PerformanceEntryModal.tsx` (`subject_type/subject_id`, `context_type`) — sin RPC nueva si el insert directo con RLS ya alcanza para que el atleta escriba SU PROPIA fila. **Verificar primero** la policy de insert vigente sobre `performance_entries`: hoy está pensada para que el coach cargue, no necesariamente para que el atleta se auto-registre.
- Lectura: chip semáforo por jugador en el roster, reusando `computeMetricBand`/`BAND_STYLE` de `frontend/src/lib/school/performanceDisplay.ts` — el mismo criterio que ya pinta `PlayerCard.tsx`. No es un componente nuevo desde cero.
- Este dato alimenta el piso mínimo de la sugerencia de rotación en C (no sugerir rotar a alguien con fatiga alta si no hay data — no ocultar la alerta, decir que falta información).

## B. P3 — Enganchar el tablero desde el entrenamiento del día (sin reabrir PER-0)

- Alcance deliberadamente chico: un botón/acceso directo en `frontend/src/pages/TrainingPlansPage.tsx` (donde el coach ya escribe el contenido del día) que abre `TacticalBoard` contra el `training_session` de esa fecha si existe uno reservable, usando el `source_type='training_session'` que YA es válido.
- **NO** se toca la relación `training_plans` ↔ `training_sessions` en este spec — esa unificación es el trabajo ya identificado como PER-0/MOD-8 y tiene sus propias decisiones bloqueantes (D-MD, D-CARGA, ver `docs/specs/periodizacion-microciclos-y-carga.md`). Duplicarlo acá sería la clase de conflicto de alcance que el propio spec de fútbol advierte en su riesgo R4.
- Si `TrainingPlansPage` no tiene un `training_session` del día para colgar el tablero (planes sin sesión de cupos asociada, caso frecuente hoy), el botón muestra "no hay sesión de asistencia para este día" en vez de fallar — mismo criterio de "no ocultar, explicar" que ya usa el spec de fútbol para su riesgo R3.

## C. P4 — Sugerencias automáticas (reglas simples, con piso mínimo de datos — D6 del spec de fútbol)

- **"Mejor XI del mes"**: por equipo y periodo, rankear jugadores por su score agregado de `PlayerCard` (mismo `BAND_SCORE` que ya usa la tarjeta) + `minutes_played`/`goals`/`assists` de `FootballSeasonStats`. Piso mínimo: no se arma el XI si menos de N jugadores tienen mediciones recientes — mostrar "necesitamos más registros", no un XI con huecos silenciosos (mismo patrón R3 del spec de fútbol y del Informe Mensual del Atleta).
- **Alerta de rotación**: jugador con minutos jugados muy por encima de sus compañeros de la misma posición en las últimas M fechas. **Antes de construir esto**, confirmar en el código real cómo se calcula `minutes_played` hoy (¿desde alineación titular/suplente + duración fija, o hay algún registro de cambio no visto en esta exploración?). Si es una aproximación por titularidad, la alerta debe decirlo ("estimado, no exacto") en vez de presentarse como dato preciso.
- Vive como un panel dentro de `frontend/src/components/school/FootballDashboardModal.tsx` (donde ya están `FootballSeasonStats` y el resto del panel de temporada), no una pantalla nueva separada.

## D. Video (Hudl / Metrica Sports / Longomatch) — en dos pasos, no de una vez

**D1 — Video enlazado + tagging manual (barato, sin infraestructura nueva):**

- Ningún bucket de Storage hoy soporta video: revisado con la lista real de buckets del proyecto — los 12 existentes (`certificates`, `medical-documents`, `product-images`, `equipment-photos`, etc.) tienen límite de 5-10 MB, pensados para PDFs/fotos. Un partido de 90 minutos pesa cientos de MB a varios GB: no es "un archivo más" en el patrón actual.
- El punto de partida más barato es **no alojar el video**: el coach pega el link de donde ya lo tenga (YouTube no listado, Drive, el servicio de streaming que ya use el club) — cero costo de storage/streaming nuevo, cero decisión de proveedor todavía.
- Nueva tabla `video_clips`: `source_type/source_id` (mismo patrón polimórfico que `tactical_sessions`/`match_lineups` — un partido o un entrenamiento), `video_url`, `start_seconds`, `end_seconds`, `label` (texto libre — mismo criterio "botonera" de Longomatch: el coach arma su propio vocabulario de etiquetas, no uno cerrado tipo "salida de balón"/"presión tras pérdida"), `created_by`. RLS acotada al mismo scope de escuela/equipo que el resto del módulo de fútbol.
- Reusa lo que ya existe donde tenga sentido: un `football_match_events` (gol, tarjeta) ya tiene `minute` — un clip puede linkearse opcionalmente a un evento existente en vez de duplicar metadata.
- UI: reproductor embebido (iframe de YouTube/Drive, o `<video>` si el link es un archivo directo) + lista de clips como timestamps clicables que saltan al segundo exacto. Compartir un clip individual reusa el parámetro de tiempo que los proveedores ya soportan (`&t=90s`), sin necesidad de un link propio todavía.
- Vive dentro de `FootballDashboardModal.tsx` (misma pestaña donde ya están `MatchEventsModal`/`FootballSeasonStats`), no una pantalla nueva separada.

**D2 — Video propio (SportMaps aloja y transmite el archivo) — decisión de infraestructura aparte, NO parte de este spec todavía:**

- Requiere un proveedor de video (Mux, Cloudflare Stream, Bunny Stream — Supabase Storage tal como está configurado hoy no sirve para esto) por transcodificación y streaming adaptativo. Es una decisión de producto Y de infraestructura nueva, con su propio análisis de costo (GB almacenados × GB transmitidos × cuántas escuelas lo usan) — se evalúa en un plan aparte cuando llegue el momento.
- Solo se justifica si D1 valida que los coaches realmente usan el tagging de video (adopción real medible) antes de invertir en alojarlo — mismo criterio de "no construir la pieza cara sin evidencia" que ya se aplicó en otras partes del roadmap.

---

## Fuera de este spec (explícito)

- Extender tablero/tarjetas a otros deportes: confirmado con el usuario que NO es parte de este alcance.
- Unificación `training_plans`/`training_sessions` (PER-0/MOD-8): se referencia pero no se toca acá.
- D2 (hosting propio de video): decisión de infraestructura que se evalúa aparte, después de validar D1.

## Verificación

- Migración de `category`: confirmar que el `ALTER CONSTRAINT` no bloquea con las filas existentes (ninguna fila usa `'wellness'` todavía, así que un CHECK más permisivo no puede violar nada existente).
- Insertar una fila de bienestar como el propio atleta (no como coach) y confirmar que la policy de `performance_entries` lo permite — si no, es el primer hueco a cerrar antes de construir la UI.
- P3: abrir el tablero desde `TrainingPlansPage` en un día con sesión reservable y en un día sin ella; confirmar el mensaje explicativo en el segundo caso.
- P4: correr "Mejor XI" con un equipo de pocos datos (mismo caso de escuelas nuevas o de Carmel) y confirmar que se ve el mensaje de piso mínimo, no un XI incompleto o con ceros.
- D1: pegar un link de YouTube no listado, agregar 2-3 clips con timestamps, confirmar que saltan al segundo correcto y que la escritura de `video_clips` respeta el scope de escuela/equipo (nadie de otra escuela debe poder leer o escribir clips ajenos).
- Repasar la policy de insert de `performance_entries` línea por línea antes de abrir la escritura al propio atleta — es la misma clase de chequeo que ya se hizo para las RPCs de informes (autorización dentro de la función, no solo en el frontend).

## Referencia cruzada

Ver `docs/specs/football-tactical-experience.md` (P0-P4 originales), `docs/specs/periodizacion-microciclos-y-carga.md` (PER-0/MOD-8, la unificación training_plans/training_sessions que este spec NO toca), [[project_performance_metrics_model]] y [[project_periodizacion_track]] (memoria) para el contexto de por qué el RPE es un riesgo ya identificado.
