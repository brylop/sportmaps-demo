# Backlog 09 — Torneos de escuela ↔ Canchas

> Frente del plan maestro del ecosistema ([plan-maestro-ecosistema-2026-10.md](../../../plan-maestro-ecosistema-2026-10.md), §orden «3–5 Torneos ↔ Canchas»).
> Estudio de rol: [roles-organizadores-federaciones.md](../roles-organizadores-federaciones.md) (§D.6, `schedule_tournament_match`).
> Canchas: [reservas-canchas-plan-unificado-2026-10.md](../../reservas-canchas-plan-unificado-2026-10.md) y [plan-agresivo-canchas-2026-10.md](../../../plan-agresivo-canchas-2026-10.md).
> Versión final del 14-oct-2026, con las correcciones del revisor aplicadas (ver §6).
> Es un plan: no se ha escrito SQL ni código. Cada migración se escribe solo cuando su plan esté aprobado.

**Decisiones del dueño que este backlog da por tomadas (14-oct-2026)**

- **Todo piloto es gratis por un mes.** Aquí: addon Torneos para Besser, Monster, Dynasty y Club Carmel.
- Canchas: Gratis (≤ 2 canchas) / $99.000 / $199.000. El coach de escuela es gratis dentro del plan de la escuela.
- No se cobra comisión al cliente final. Los recargos solo existen si los configura quien cobra.
- **La mora no cancela inscripciones.** Nada en este frente cancela una inscripción a un torneo por falta de pago.
- La landing solo publica lo que ya corre en la app.

**Reglas técnicas que aplican a todas las tareas** (CLAUDE.md del repo)

- Migraciones inmutables, creadas con `npm run migrations:new -- <slug>` y commiteadas con `supabase/migrations_ledger.json`; `npm run migrations:check` en verde.
- **Una sola sesión aplica migraciones**, por una vía con rastro (CLI o `apply_migration`). `gen types` **una vez al final de cada lote** (M-T1, M-T2, M-T3, M-T4). Nada de `list_tables` / `get_advisors` como sondeo: consultas puntuales a `pg_policies` / `pg_proc`.
- Creación multi-fila = RPC transaccional `SECURITY DEFINER` con `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE … TO authenticated` y `REVOKE` explícito de `anon` y `authenticated` cuando no aplique.
- Estados con `text + CHECK`, nunca `CREATE TYPE`. RLS sin self-recursion. Escritura con `user_staff_school_ids()`; lo que otorga permisos con `user_admin_school_ids()`; **nunca** `user_school_ids()` para escribir.
- El BFF llama las RPCs con `userClient(req)`, no con service role (con service role `auth.uid()` es nulo y el gate interno devuelve ceros).
- Jobs sin N+1 (lotes con `.in('id', ids)`). QA y concurrencia en el gemelo Docker o en la escuela demo, **nunca** con datos de clientes.
- Full-stack por feature, una rama por fase, revisión entre fases. Cerrar cada fase con `npm run seguridad:invariantes` sin CRÍTICAS.

---

## 1. Resumen y estado actual verificado

Los torneos de escuela **ya funcionan de punta a punta**. Lo verificamos en `bff/src/routes/events.route.ts` (2.208 líneas, ~25 rutas `school-tournaments`), en `SchoolTournamentDetailPage.tsx` y en la migración `20260716000002`. Hoy cubren: crear el torneo con el gate del addon, categorías y fases de precio, invitaciones, delegaciones, inscripción individual con cobro, fixture de liga o copa, marcador con goleadores y tabla pública.

El frente tiene tres huecos:

**(a) Bugs que hay que cerrar antes de vender (y antes de que el piloto llegue a familias):**

- El formato se guarda por **evento** y no por categoría: una copa y una liga en el mismo torneo se pisan.
- La copa **no tiene semillas**: los equipos salen de `event_teams` sin `ORDER BY`, así que el «1» y el «2» son el orden físico de inserción, y los slots 1 y 2 se cruzan en la ronda 2.
- Corregir un resultado de copa después de jugada la ronda siguiente deja la llave inconsistente; regenerar la copa deja vivos los partidos `played` (solo borra los `scheduled`) y los walkover de los byes.
- Los goles se guardan con delete+insert fuera de transacción, y el delete solo corre si llegan goles: **no se puede dejar un partido en 0 goleadores** ni corregir 1-0 a 0-0.
- Las tarjetas no se pueden registrar, aunque la tabla las soporta.
- Los resultados públicos mezclan categorías, no muestran fixture ni goleadores, y se ven aunque el torneo esté en borrador o sea `school_only`.
- El gate del addon solo está en la creación: por URL todo lo demás funciona sin el addon, y no existe un modo «solo lectura».
- Las policies `tmatches_read` / `tmevents_read` son `USING (true)` para `authenticated`: cualquier usuario logueado lee todos los partidos y eventos de partido (con `member_id`) de todos los torneos.
- Textos en voseo que llegan a las familias (inscripción, notificaciones de resultado).

**(b) Torneos y Canchas no se tocan:** `tournament_matches` solo tiene `scheduled_at` y `venue` (texto). Ningún código escribe todavía en `facility_occupancy`, y la policy `tmatches_manage FOR ALL` dejaría al cliente mover un partido de cancha saltándose la ocupación.

**(c) Faltan** grupos con eliminatoria, penales, desempates configurables, sanciones, planilla y carné del torneo.

### Estado por capacidad

| Capacidad | Estado | Evidencia |
|---|---|---|
| Crear torneo de escuela (interno/externo) con categorías y fases de precio, gate del addon `tournaments` | Funciona | `events.route.ts:284-302` (POST `/school-tournament` consulta `v_school_entitlements.has_tournaments`); `CreateTournamentPage.tsx:71`. **El gate solo está aquí**: el resto de rutas solo valida propiedad (`assertOwnedSchoolTournament`, `:521-530`) |
| Invitaciones a escuelas externas, delegaciones, pago por comprobante, inscripción individual con cobro | Funciona (con voseo) | `events.route.ts:710-1066`; migraciones `20260901114532..20260903131025`; voseo en `TournamentRegisterPage.tsx:84, 93, 134, 148` |
| Fixture automático liga/copa | Parcial | `events.route.ts:1373`. Formato escrito en `events.competition_format` (`:1418`) y leído en el PATCH (`:1472`). Equipos sin `ORDER BY` (`:1382-1386`), slots `seeded[i]` vs `seeded[size-1-i]` (`:1397-1407`), `advanceWinner` une slots 1-2 (`:1351-1359`). Regeneración solo borra `scheduled` (`:1391`). Borrar partidos pone en NULL `match_results.tournament_match_id` y `training_microcycle_days.tournament_match_id` (`20260926131340:34`, `20260831160936:151`) |
| Marcador y goleadores | Parcial | PATCH `:1449`; delete+insert sin transacción y solo si `goals.length > 0` (`:1479-1487`). Empate de copa no avanza (sin penales). `advanceWinner` sobrescribe el partido padre sin validar (`:1462-1476`). Voseo «ya podés» (`:1492`) |
| Tarjetas amarillas/rojas | No existe | `tournament_match_events.type` admite `yellow/red` (`20260716000002`), pero el BFF solo procesa `body.goals` y la UI solo tiene el botón ⚽ (`SchoolTournamentDetailPage.tsx:645`) |
| Tabla de posiciones y goleadores (privado) | Parcial | `events.route.ts:1535`; goleadores sin filtro por categoría («se omite en MVP», `:1568`); cálculo duplicado en `:1589`; sin desempate H2H ni fair play |
| Resultados públicos `/tournaments/:eventId/results` | Parcial | `TournamentResultsPage.tsx:20` llama `getPublicResults(eventId)` sin categoría, aunque la API ya acepta `categoryId` (`lib/api/tournaments.ts:98`). El BFF (`:1589-1630`) no filtra estado, `creator_role` ni `visibility` (`:590`); solo devuelve standings |
| Lectura de partidos por PostgREST | Hueco de RLS | `tmatches_read` / `tmevents_read` `FOR SELECT TO authenticated USING (true)` (`20260716000002`) |
| Partido asignado a cancha y franja | No existe | `tournament_matches` solo tiene `scheduled_at timestamptz` y `venue text`; ninguna UI los edita |
| `facility_occupancy` con EXCLUDE y `source_kind 'event'` | Funciona (sin uso) | `20261014153538`: EXCLUDE gist `(facility_id, slot) WHERE status IN (hold, active)`; REVOKE a PUBLIC/anon/authenticated (`:52-54`), **sin SELECT para authenticated**. Nadie escribe aún; alquileres y clases empiezan a escribir en Canchas F1 |
| RPC `schedule_tournament_match` | Solo spec | `roles-organizadores-federaciones.md:175` (§D.6), con `user_staff_school_ids()`; no está en `supabase/migrations` |
| Grupos + eliminatoria, desempates, penales | No existe | El CHECK de `events.competition_format` admite `grupos` y `americano`, pero `generate-fixtures` solo acepta liga/copa |
| Sanciones automáticas y planilla | No existe | Sin tabla ni regla |
| Carné del torneo / verificación de edad | Parcial | `event_team_members` tiene `document_number`, `birth_year`, `age_validation`; `event_categories_config` tiene `birth_year_min/max`. Los carnés de escuela (`athlete_id_cards`, `verify_athlete_id_card_public`, `20261010201231`) no están ligados al torneo |
| Menú «Mis Torneos» filtrado por addon | Funciona | `navigation.ts:206/220`; `AppSidebar.tsx:124`. Si se apaga el addon, el menú **desaparece** (no hay modo lectura) |
| Texto comercial del addon Torneos | Parcial | App: `frontend/src/config/saas-plans.ts:268` sigue diciendo «Americanos, brackets eliminatorios y ranking PWR» (americanos y PWR viven en Canchas F6); la edita otra sesión. Landing: ya corregida (`src/config/saas-plans.ts:266`, «Ligas y copas con fixture automático…»), no hay que tocarla |
| Precio del addon | Vigente $49k, D5 abierta | `saas-plans.ts:265-272` (`4_900_000`); el spec de Canchas recuerda una decisión de mayo de $79k (`reservas-canchas-plan-unificado-2026-10.md:93`) |
| Piloto gratis 1 mes de un addon | Patrón manual | `docs/migraciones-para-aplicar-2026-10-08/PROPUESTA_habilitar_tienda_gym_rm.sql`: `monthly_price_cents=0` + `metadata.gratis_hasta` + paso 1b manual. `school_addons` no tiene columna de vencimiento (`20260513000007:67-78`). La factura SaaS solo suma addons con precio > 0 (`20260929183752:133-143`) |
| Activación del addon por solicitud | Funciona | `bff/src/routes/upgrade-requests.routes.ts` (`addon_activate` con aprobación de admin) |
| ROADMAP | Desactualizado | MOD-7 (`docs/ROADMAP.md:1422`) dice «bracket net-new»; `:1013` y `:2042` piden «verificar qué quedó»; `:1139` dice que el sidebar solo filtra `store` |

**Fuera de alcance de este frente:** el motor de deportes juzgados (gimnasia, porrismo: `docs/tournaments-scoring-engine.md`, Fase 2) y los americanos / ranking PWR (Canchas F6). Este frente cubre deportes de marcador; **no se vende como «torneos multideporte»**.

---

## 2. Fases

| Fase | Nombre | Semanas | Tareas | Migraciones |
|---|---|---|---|---|
| P0 | Torneo vivo sin bugs, gate de escritura y piloto gratis activado | 1–2 (15–28 oct) | 17 | 3 |
| P1 | Partidos que ocupan cancha sin choques | 3–4 (29 oct–11 nov), tras Canchas F1 o con guarda de transición | 13 | 3 |
| P2 | Grupos + eliminatoria, sanciones y planilla | 5–6 (12–25 nov) | 8 | 3 |
| P3 | Carné del torneo, página pública y familias | 7–8 (26 nov–9 dic) | 9 | 3 |
| P4 | Conversión del piloto, contenido y adquisición | Semana 5 (conversión, ~15–20 nov) y de ahí en adelante | 6 | 0 |

### P0 — Torneo vivo sin bugs, gate de escritura y piloto gratis activado

**Objetivo.** Que lo que ya se vende no falle frente a un cliente y que el piloto arranque ya. Primero lo que toca a familias reales (tuteo, resultados públicos con estado y visibilidad, RLS de lectura) y el gate de escritura; con eso desplegado se activa el piloto con un SQL de propuesta. Los bugs de fixture y tarjetas siguen en paralelo durante el piloto.

**Orden interno.** Días 1–3: P0-01, P0-06, P0-07, P0-08, P0-09 (plan), P0-11 → despliegue verificado → P0-14 (activación). Días 3–10: P0-02..P0-05, P0-12, P0-13. Cierre: P0-16, P0-17.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| P0-01 | **Plan de migraciones del lote M-T1** (aprobar antes de escribir SQL) | db | `docs/specs/torneos-canchas-plan-migraciones.md` | No | — | Lista M-T1a (formato por categoría + semilla), M-T1b (RPC `save_match_events`), M-T1c (RLS de lectura de partidos) con columnas, CHECKs `text`, backfill, RPCs, GRANT/REVOKE y **radio** medido con consultas puntuales (cuántos eventos/categorías/partidos toca; quién lee `tournament_matches` desde el cliente hoy). Aprobado por el dueño | S |
| P0-02 | **M-T1a:** `event_categories_config.competition_format text CHECK (liga\|copa\|grupos)` + backfill desde `events.competition_format` para categorías con partidos; `event_teams.seed int NULL` (semilla por categoría) | db | `supabase/migrations/<migrations:new torneos_formato_por_categoria_y_semilla>.sql`, `supabase/migrations_ledger.json` | Sí | P0-01 | `migrations:check` en verde; aplicada por la única sesión que aplica; una categoría copa y otra liga del mismo evento devuelven formatos distintos; `seed` NULL no rompe torneos existentes | S |
| P0-03 | **BFF fixture correcto:** formato leído/escrito por categoría; semilla explícita (`seed` del body o de `event_teams`; si no hay, **sorteo explícito** con `ORDER BY` determinista y guardado en `seed`) y bracket estándar (1 y 2 solo se cruzan en la final; byes a las semillas altas); 409 al regenerar si la categoría tiene partidos `played` **o `walkover`** (incluidos los que crea `advanceByes`); 409 al editar un resultado de copa cuyo partido padre ya está `played`/`walkover` | bff | `bff/src/routes/events.route.ts`, `bff/src/services/tournamentBracket.service.ts` (nuevo, puro y testeable) | No | P0-02 | Categoría A en copa y B en liga del mismo torneo: un resultado de A avanza al ganador y uno de B no toca la copa. Test unitario del sembrado con N=8 y N=6 (no potencia de 2): byes en semillas 1-2, 1 y 2 en lados opuestos. Regenerar con un walkover de bye → 409 legible. Corregir un 2-1 de cuartos con la semi jugada → 409 legible | M |
| P0-04 | **M-T1b:** RPC `save_match_events(match_id, home_score, away_score, goals jsonb, cards jsonb)` transaccional: toma el partido con `SELECT … FOR UPDATE`, **reemplaza siempre** goles y tarjetas cuando llega el campo (aunque venga vacío), guarda el marcador. Caller = staff del anfitrión (D1). `SECURITY DEFINER`, `search_path` fijo, GRANT a `authenticated`, REVOKE de `anon`. Es un puente: P2-03 (`record_match_result`) la reemplaza | db | `supabase/migrations/<migrations:new torneos_guardar_eventos_partido_rpc>.sql`, `supabase/migrations/_smoke/torneos_eventos_partido_smoke.sql` | Sí | P0-01 | Smoke: guardar 1-0 con un gol y luego 0-0 con `goals=[]` deja 0 goles. Si el insert falla, los goles anteriores siguen (rollback). Coach de otra escuela (claims simulados) → rechazado | S |
| P0-05 | **Tarjetas amarillas y rojas** en el partido: BFF acepta `body.cards` y llama `save_match_events` con `userClient(req)` (el delete+insert de goles sale del BFF); UI con botones 🟨/🟥 por jugador | frontend | `bff/src/routes/events.route.ts`, `frontend/src/pages/school/SchoolTournamentDetailPage.tsx`, `frontend/src/lib/api/tournaments.ts` | No | P0-04 | Guardar 1 amarilla y 1 roja → 2 filas `yellow/red` con `member_id`. Reabrir las muestra. Guardar de nuevo no duplica. Quitar todas y guardar → 0 filas | S |
| P0-06 | **Tuteo** en todo lo que llega a escuelas y familias del torneo | frontend | `frontend/src/pages/events/TournamentRegisterPage.tsx` (:84, :93, :134, :148), `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` (:144), `bff/src/routes/events.route.ts` (:507, :1492 y las notificaciones de `notifyTeamMembers` :570-578) | No | — | `grep -nE 'podés\|Elegí\|Seleccioná\|tenés\|querés\|Revisá\|Cargá\|Agregá'` sobre `bff/src/routes/events.route.ts`, `frontend/src/pages/events/` y `frontend/src/pages/school/*Tournament*` devuelve 0. **Desplegado antes de P0-14** | XS |
| P0-07 | **Gate de addon en las escrituras + modo solo lectura (D3):** middleware `requireEntitlement('tournaments')` (el que define Canchas F0, o uno local si aún no existe) en toda ruta de escritura `school-tournaments`; lectura siempre permitida. Menú «Mis Torneos» visible en modo lectura cuando la escuela tiene torneos previos aunque el addon esté apagado; botones de crear/programar/editar ocultos con aviso «Activa Torneos para editar» | bff | `bff/src/routes/events.route.ts`, `bff/src/middleware/requireEntitlement.ts`, `frontend/src/config/navigation.ts`, `frontend/src/components/AppSidebar.tsx`, `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` | No | — | Sin addon: POST/PATCH/DELETE → 402/403 con mensaje; GET y página funcionan; menú visible solo si hay torneos. Con addon: sin cambios. Test de ruta con supertest | M |
| P0-08 | **Resultados públicos correctos:** solo `status IN (published, closed, completed)` y `creator_role='school'`; respeta `visibility` según D4 (adelantada a P0); selector de categoría (la API ya acepta `categoryId`); fixture por jornada; goleadores filtrados por categoría (join a `tournament_matches`); cálculo de la tabla extraído a un servicio compartido con la tabla privada | bff | `bff/src/routes/events.route.ts`, `bff/src/services/tournamentStandings.service.ts`, `frontend/src/pages/events/TournamentResultsPage.tsx`, `frontend/src/lib/api/tournaments.ts` | No | D4 | Borrador → 404. `school_only`/`invited_only` → según D4. Con 2 categorías: selector y una tabla por categoría. Goleadores de B no salen en A. Test unitario: tabla privada = tabla pública | M |
| P0-09 | **M-T1c — RLS de lectura de partidos:** reemplazar `tmatches_read` / `tmevents_read` `USING (true)` por lectura para el anfitrión y las escuelas participantes vía función `SECURITY DEFINER` (sin self-recursion), más los acudientes/atletas de los equipos inscritos si el radio de P0-01 muestra que el cliente los lee; lo público se sirve solo por el BFF (P0-08) | db | `supabase/migrations/<migrations:new torneos_lectura_partidos_participantes>.sql` | Sí | P0-01, P0-08 | Listado completo de policies de ambas tablas (`pg_policies`) revisado línea por línea. Sesión simulada de coach y de acudiente de **otra** escuela: 0 partidos ajenos por PostgREST. Anfitrión y participante siguen viendo los suyos. `seguridad:invariantes` sin CRÍTICAS | S |
| P0-10 | **Pruebas negativas de RLS** del flujo de torneos (rosters, partidos, eventos de partido, inscripciones) | qa | `scripts/rls-pruebas-negativas.mjs` | No | P0-09 | Casos agregados al script: acudiente y coach de otra escuela no leen `event_team_members` (documento, año de nacimiento), `tournament_matches` ni `tournament_match_events` ajenos. Corre contra el gemelo local | S |
| P0-11 | **Verificar que la inscripción con cobro no le suma recargo a la familia** (flujo `events.route.ts:1042` en adelante); si lo suma, que solo ocurra cuando la escuela lo configuró | bff | `bff/src/routes/events.route.ts` | No | — | Nota escrita en `docs/specs/torneos-canchas-piloto.md`: «sí/no hay recargo, y de dónde sale». Si hay uno no configurado por la escuela, tarea de fix antes de P0-15 | XS |
| P0-12 | **Idempotencia y concurrencia de los guardados de P0:** doble clic en «Generar fixture» y en «Guardar resultado»; botones deshabilitados mientras guardan; `requireIdempotencyKey` (Canchas F0) en ambas rutas | qa | `scripts/pruebas-concurrencia-torneos.mjs`, `bff/src/routes/events.route.ts`, `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` | No | P0-03, P0-05 | 2 llamadas paralelas a generate → un solo juego de partidos (la otra recibe 409 o la misma respuesta). 2 guardados paralelos de resultado → resultado consistente, sin goles duplicados. Corre en el gemelo Docker | S |
| P0-13 | **QA real del flujo vivo** (escuela demo, no clientes): crear torneo, categorías, invitar, inscribir, generar liga y copa, cargar resultados con goles y tarjetas, corregir a 0-0, tabla privada y pública en celular. **Pasada en local y en staging**, con verificación del deploy (el chunk servido trae el cambio) | qa | `frontend/e2e/torneos-escuela.spec.ts`, `docs/capturas/torneos/` | No | P0-03, P0-05, P0-06, P0-07, P0-08 | Spec Playwright en verde en local (BFF levantado y cerrado al terminar) y repetido en staging con la escuela demo. Capturas reales de cada paso. Lista de bugs, cada uno con tarea o descartado | M |
| P0-14 | **Activar el piloto GRATIS 1 mes** del addon Torneos para Besser, Monster, Dynasty y Club Carmel con la **plantilla única de piloto** (compartida con los otros frentes): SQL de **propuesta**, no ejecutado por el agente | ventas | `docs/migraciones-para-aplicar-2026-10-14/PROPUESTA_piloto_torneos_4_escuelas.sql`, `docs/specs/torneos-canchas-piloto.md` | No | P0-06, P0-07, P0-08, P0-09 (desplegados) | El SQL primero verifica el **tier real** y `has_entitlement(school,'tournaments')` de cada escuela (las grandfathered en Enterprise/Elite ya lo traen: no se tocan). Para las demás: `monthly_price_cents=0`, `metadata.gratis_hasta = hoy + 1 mes`, `metadata.piloto='torneos'`, sin precio posterior hasta cerrar D5. El dueño lo corre por una vía con rastro. Luego `has_entitlement` = true y la factura SaaS del mes no suma Torneos | S |
| P0-15 | **Mensaje de oferta del piloto** por WhatsApp/correo a las 4 escuelas, solo con lo que corre | ventas | `docs/marketing/torneos/oferta-piloto.md` | No | P0-11, P0-13 (local), D5 | Aprobado por el dueño. Cada afirmación ligada a una captura de P0-13. Dice «gratis 1 mes» y **«sin comisión a las familias»** solo si P0-11 lo confirma. El precio posterior aparece **solo si D5 está cerrada**; si no, «te avisamos el precio antes de que termine el mes» | XS |
| P0-16 | **Descripción honesta del addon Torneos** en la app: «Ligas y copas con fixture automático, goleadores, tabla pública e inscripción con cobro.» Sin «Americanos» ni «PWR» (viven en Canchas F6) | frontend | `frontend/src/config/saas-plans.ts` | No | frente:landing (sesión que edita el archivo) | `saas-plans.ts:268` sin «Americanos» ni «PWR». El cambio entra con o después del de la otra sesión, commiteando solo lo propio (índice temporal) | XS |
| P0-17 | **Actualizar el ROADMAP y los docs de torneos** con el estado verificado; marcar MOD-7 y las filas `:1013`/`:2042` como absorbidas por este backlog; corregir `:1139` (el sidebar ya filtra `tournaments`); actualizar §D.6 de `roles-organizadores-federaciones.md` con la regla D1; declarar fuera de alcance el motor de deportes juzgados | docs | `docs/ROADMAP.md`, `docs/tournaments-*.md`, `docs/specs/ecosistema/roles-organizadores-federaciones.md` | No | P0-13 | Una sola verdad por tema: ninguna fila del ROADMAP pide «verificar qué quedó» de torneos; §D.6 enlaza a este backlog | XS |

**Gen types:** una vez al cerrar el lote M-T1 (después de P0-09).

### P1 — Partidos que ocupan cancha sin choques

**Objetivo.** Que cada partido tenga cancha y franja, y que bloquee esa cancha en `facility_occupancy` (`source_kind='event'`), con un error legible si choca con un alquiler, una clase u otro partido.

**Dueño único de la ocupación `event` (D10):** se propone que sea **este frente**. El plan maestro ya le asigna «Torneos ↔ Canchas» (semanas 3–5), y la línea «Torneos y eventos ocupan cancha» de Canchas F5 (§6.5) se retira de ese spec (tarea P1-13).

**Dependencia real con Canchas.** El «H1» del spec de Canchas es un **bug** (índice que solo compara `start_time`), no un hito con fecha. La dependencia correcta es **Canchas F1**: alquileres y clases recurrentes escribiendo ocupación. Mientras F1 no exista, `schedule_tournament_match` tiene una **guarda de transición** que valida también contra `facility_reservations` vivas y contra los horarios de clases/equipos en esa cancha. Se retira cuando F1 esté en producción.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| P1-01 | **Plan del lote M-T2** aprobado: columnas, RPCs, guarda de columnas, trigger de liberación, guarda de transición y tests de concurrencia | db | `docs/specs/torneos-canchas-plan-migraciones.md` | No | P0-01, D1, D2, D9, D10 | Cubre `facility_id` (FK `facilities` ON DELETE SET NULL), `starts_at`, `ends_at`, `CHECK (ends_at > starts_at)`, índice `(facility_id, starts_at)`, `scheduled_at` como espejo de `starts_at`, `match_minutes` en categorías, todas las policies de `tournament_matches` (`pg_policies`), y **de qué tabla salen las clases** para la guarda de transición. Aprobado | S |
| P1-02 | **M-T2a:** columnas `facility_id`/`starts_at`/`ends_at` en `tournament_matches` + `match_minutes` en `event_categories_config` + trigger guarda que impide cambiar `facility_id`/`starts_at`/`ends_at` fuera de la RPC (la policy `tmatches_manage` es `FOR ALL`) | db | `supabase/migrations/<migrations:new torneos_partidos_en_cancha_columnas>.sql`, `supabase/migrations_ledger.json` | Sí | P1-01 | UPDATE directo con sesión de admin simulada sobre `facility_id` falla; el mismo cambio por la RPC pasa. `migrations:check` en verde | M |
| P1-03 | **M-T2b:** RPCs `schedule_tournament_match(match_id, facility_id, starts_at, ends_at)` y `unschedule_tournament_match(match_id)`. `SECURITY DEFINER`, `search_path` fijo, GRANT a `authenticated`, REVOKE explícito de `anon` | db | `supabase/migrations/<migrations:new torneos_schedule_match_rpc>.sql`, `supabase/migrations/_smoke/torneos_schedule_match_smoke.sql` | Sí | P1-02 | Valida al caller según D1 (programar = admin del anfitrión vía `user_admin_school_ids()`; **nunca** `user_school_ids()`); exige que la cancha sea del anfitrión; `SELECT … FOR UPDATE` del partido; libera la ocupación anterior (`released`) e inserta la nueva (`school_id` de la cancha, `source_kind='event'`, `source_id=match_id`, `status='active'`) en la misma transacción; replica en `scheduled_at`. Guarda de transición contra alquileres y clases hasta Canchas F1. Choque (23P01 o guarda) → «Cancha X ocupada HH–HH por alquiler/clase/partido». El smoke cubre éxito, choque con partido, choque con alquiler, choque con clase, reprogramación y anon rechazado | L |
| P1-04 | **M-T2c:** RPC `generate_tournament_fixture(event, category, format)` transaccional (reemplaza el delete+insert del BFF, conserva las reglas de P0-03 y libera la ocupación de los partidos borrados) + trigger AFTER DELETE / UPDATE (`status → cancelled`) en `tournament_matches` que libera la ocupación `event` | db | `supabase/migrations/<migrations:new torneos_fixture_transaccional>.sql` | Sí | P1-03 | Regenerar con partidos programados no deja ocupación huérfana (`source_id` sin partido = 0). Si la inserción falla, los partidos viejos siguen (rollback). Borrar el evento libera toda su ocupación | M |
| P1-05 | **Tests de concurrencia:** 2 sesiones programan la misma cancha y franja a la vez; partido contra alquiler; partido contra clase; contigüidad 8–9 y 9–10 no choca | qa | `scripts/pruebas-concurrencia-torneos.mjs`, `package.json` | No | P1-03 | Exactamente una de dos llamadas paralelas gana y la otra recibe el mensaje legible; franjas contiguas pasan. Solo contra el gemelo Docker | M |
| P1-06 | **BFF de programación:** POST/DELETE `/school-tournaments/:id/matches/:matchId/schedule` con `userClient(req)`; `generate-fixtures` pasa a la RPC; el GET de partidos devuelve cancha, inicio y fin; las rutas nuevas heredan el gate de P0-07 | bff | `bff/src/routes/events.route.ts`, `bff/src/utils/userClient.ts`, `docs/api/openapi.yaml` | No | P0-07, P1-03, P1-04 | Choque → 409 con el mensaje de la RPC. Sin addon → 402/403 en escritura, lectura intacta. `openapi.yaml` actualizado. Test de ruta con supertest | M |
| P1-07 | **Huecos libres:** GET `/school-tournaments/:id/facility-slots?date=&facility_id=`. Como `facility_occupancy` no tiene SELECT para `authenticated`, se lee con una RPC `SECURITY DEFINER` de solo lectura (`facility_busy_slots`, en M-T2b) o con service role en el BFF tras validar propiedad. Queda escrito en el plan M-T2 | bff | `bff/src/routes/events.route.ts` | No | P1-03 | Por cancha, franjas ocupadas del día con su tipo (`rental/class/event/blackout`), sin datos de quién reservó. 1–2 consultas (lo verifica el log), sin N+1 | S |
| P1-08 | **UI de programación:** en cada partido, selector de cancha, fecha y hora (duración por defecto = `match_minutes`) con los huecos del día; vista «Jornada por día» con canchas en columnas | frontend | `frontend/src/pages/school/SchoolTournamentDetailPage.tsx`, `frontend/src/components/tournaments/MatchScheduler.tsx`, `frontend/src/components/tournaments/TournamentDayGrid.tsx`, `frontend/src/lib/api/tournaments.ts` | No | P1-06, P1-07 | A 375 px, programar un partido muestra cancha y hora en la fila. Un choque muestra el mensaje en un toast y no cambia nada. Reprogramar libera la franja vieja | L |
| P1-09 | **Aviso a los equipos** al programar o reprogramar (despachador unificado, un INSERT en lote por partido, tuteo) | bff | `bff/src/routes/events.route.ts`, `bff/src/services/notification.service.ts` | No | P1-06 | Reprogramar notifica a los miembros de los 2 equipos con fecha, hora y cancha. Una sola inserción en lote | S |
| P1-10 | **La agenda de Canchas pinta los partidos** (`source_kind='event'`) con su color y el nombre del torneo, leyendo por la misma vía que P1-07 | frontend | `frontend/src/pages/school/` (agenda de Canchas F3) | No | P1-06, P1-07, frente:canchas (agenda) | Un partido programado aparece como «Torneo: X vs Y» y no se puede reservar encima | S |
| P1-11 | **Seguridad y cierre de fase:** `seguridad:invariantes` + `rls-pruebas-negativas`; revisión línea por línea de **todas** las policies de `tournament_matches` y `tournament_match_events` (incluida la guarda de P1-02); coach de otra escuela no puede programar | qa | `scripts/invariantes-seguridad.mjs`, `scripts/rls-pruebas-negativas.mjs` | No | P1-02, P1-03, P1-04 | 0 violaciones CRÍTICAS. Sesión simulada de coach ajeno → rechazada. Ninguna policy `USING (true)` vuelve a aparecer sobre partidos | S |
| P1-12 | **QA real en la app:** torneo de 4 equipos en 2 canchas del Club Campestre Demo; choque intencional con un alquiler y con una clase; reprogramación; vista celular; pasada en staging | qa | `frontend/e2e/torneos-canchas.spec.ts` | No | P1-08, P1-10, P1-11 | Spec en verde en local y en staging. Al final, 0 ocupaciones huérfanas. `gen types` regenerado **una vez** al cierre del lote M-T2 | M |
| P1-13 | **Un solo dueño de la ocupación `event`:** quitar «Torneos y eventos ocupan cancha» de Canchas F5 (§6.5 y tabla de fases) y enlazar este backlog; registrar cuándo se retira la guarda de transición (al salir Canchas F1) | docs | `docs/specs/reservas-canchas-plan-unificado-2026-10.md` | No | D10 | El spec de Canchas y este backlog no se contradicen | XS |

### P2 — Grupos + eliminatoria, sanciones y planilla

**Objetivo.** Paridad con Copa Fácil y Tournify en deportes de marcador: grupos con eliminatoria, desempates configurables, penales, suspensiones automáticas y una planilla que bloquea a los suspendidos.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| P2-01 | **Plan del lote M-T3** aprobado | db | `docs/specs/torneos-canchas-plan-migraciones.md` | No | P1-12, D6, D7 | Define `tournament_matches.stage text CHECK (group\|knockout)`, `group_label`, `home_source`/`away_source` (`'1A'`, `'W-R2S1'`), `home_penalties`/`away_penalties`; en categorías `group_count`, `advance_per_group`, `tiebreakers text[]` con CHECK de valores (`points, gd, gf, h2h, fair_play`), `yellow_threshold`, `red_matches`; tabla `tournament_sanctions`. Aprobado | S |
| P2-02 | **M-T3a:** columnas de grupos, llaves y penales + función `tournament_standings(event, category, group)` `SECURITY DEFINER` con desempates configurables | db | `supabase/migrations/<migrations:new torneos_grupos_eliminatoria>.sql` | Sí | P2-01 | Smoke con 3 equipos empatados a puntos ordena por el criterio configurado. `search_path` fijo y GRANT explícito. El servicio de P0-08 pasa a usarla | L |
| P2-03 | **M-T3b:** `tournament_sanctions` (`kind`/`status` `text + CHECK`; FK a `event_team_members`) + RPC `record_match_result(match_id, scores, penalties, events[])` transaccional: marcador, goles, tarjetas, avance de llave (con la guarda de P0-03), cálculo y cumplimiento de sanciones. **Reemplaza** `save_match_events` (P0-04) | db | `supabase/migrations/<migrations:new torneos_sanciones_y_resultado_rpc>.sql`, `supabase/migrations/_smoke/torneos_sanciones_smoke.sql` | Sí | P2-02 | Una roja → suspensión de `red_matches` fechas; `yellow_threshold` amarillas → también; al jugarse la fecha siguiente del equipo se descuenta. Empate de llave sin penales → rechazado. Una transacción. RLS: lectura para anfitrión y participantes (misma función de P0-09), escritura solo por la RPC | L |
| P2-04 | **M-T3c:** generador de grupos + llave (sorteo o semillas de `event_teams.seed`) y RPC `close_group_stage` que llena la eliminatoria con los clasificados | db | `supabase/migrations/<migrations:new torneos_cierre_fase_grupos>.sql` | Sí | P2-02 | 16 equipos en 4 grupos, 2 clasificados: 24 partidos de grupo y cuartos con fuentes 1A-2B. Al cerrar, cuartos con equipos reales. No cierra con partidos de grupo sin jugar (salvo walkover) | L |
| P2-05 | **BFF:** PATCH de resultado usa `record_match_result` (`userClient`); rutas de reglas (desempates, sanciones), cierre de grupos y listado de sanciones | bff | `bff/src/routes/events.route.ts`, `docs/api/openapi.yaml` | No | P2-03, P2-04 | Desaparece cualquier escritura directa de goles/tarjetas en el BFF. Rutas en `openapi.yaml` con tests de ruta | M |
| P2-06 | **UI:** formato Grupos + eliminatoria; vista por grupos; llave visual; penales en empates de llave; pestaña Sanciones; reglas en la configuración | frontend | `frontend/src/pages/school/SchoolTournamentDetailPage.tsx`, `frontend/src/components/tournaments/GroupStageView.tsx`, `frontend/src/components/tournaments/BracketView.tsx`, `frontend/src/components/tournaments/SanctionsTab.tsx` | No | P2-05 | Bien a 375 px. Cargar una roja hace aparecer la sanción sin recargar. La llave muestra penales | L |
| P2-07 | **Planilla de juego** por partido (pantalla e impresión/PDF): nóminas con los suspendidos marcados y bloqueados | frontend | `frontend/src/components/tournaments/MatchSheet.tsx`, `bff/src/routes/events.route.ts` | No | P2-05 | Un suspendido sale tachado y la RPC rechaza un gol suyo con mensaje claro. El PDF trae cancha, hora, árbitro (texto) y firmas | M |
| P2-08 | **QA real:** 8 equipos, 2 grupos y semifinales, una roja que suspende, penales en la final; concurrencia de `record_match_result` (2 planilleros a la vez); staging | qa | `frontend/e2e/torneos-grupos-sanciones.spec.ts`, `scripts/pruebas-concurrencia-torneos.mjs` | No | P2-06, P2-07 | Spec en verde en local y staging. 2 guardados simultáneos → resultado consistente (FOR UPDATE). `seguridad:invariantes` sin CRÍTICAS. `gen types` una vez al cierre de M-T3 | M |

### P3 — Carné del torneo, página pública y familias

**Objetivo.** Acabar con los «pasados de edad», que el torneo se comparta solo con un enlace por WhatsApp y que las familias vean partido, hora y cancha en su calendario; programación automática de jornadas.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| P3-01 | **M-T4a:** `event_team_members.card_token uuid` + `eligibility_status text CHECK (pending\|verified\|rejected)` + `verified_by`/`verified_at`; RPC `verify_tournament_player(token)` con columnas mínimas (nombre e inicial del apellido, equipo, categoría, elegible, suspendido) | db | `supabase/migrations/<migrations:new torneos_carne_jugador>.sql` | Sí | P2-08, D8 | Token inválido → vacío. La respuesta nunca trae `document_number` ni año de nacimiento, ni la foto del menor en la vista anónima (D8, Ley 1581). GRANT explícito (`anon` solo si D8 lo aprueba) | M |
| P3-02 | **Validación de edad** en inscripción y roster: `birth_year` contra `birth_year_min/max`; el staff anfitrión verifica el documento y marca elegibilidad | bff | `bff/src/routes/events.route.ts`, `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` | No | P3-01 | Fuera de rango → `age_validation='out_of_range'`, no se marca `verified` sin nota. Contador «x/y verificados» por equipo | M |
| P3-03 | **Carné del torneo con QR** (reusa el diseño de `athlete_id_cards` si hay `child_id`/`profile_id`; carné simple para externos) + escaneo desde la planilla | frontend | `frontend/src/components/tournaments/TournamentPlayerCard.tsx`, `frontend/src/pages/events/VerifyTournamentPlayerPage.tsx`, `frontend/src/App.tsx` | No | P3-01 | Escanear desde la planilla muestra elegible/suspendido en < 2 s. El carné se descarga como imagen para WhatsApp | M |
| P3-04 | **Página pública completa:** fixture con fecha, hora y cancha, tabla por grupo, llave, goleadores, sanciones vigentes; imagen OG para WhatsApp; respeta `visibility` (D4) | frontend | `frontend/src/pages/events/TournamentResultsPage.tsx`, `bff/src/routes/events.route.ts`, `vercel.json` (el de la raíz) | No | P2-06, P0-08 | Al compartir el enlace se ve la vista previa con nombre y logo del anfitrión. Lighthouse móvil ≥ 85. `school_only` según D4 | M |
| P3-05 | **Familias y delegaciones** ven «Próximos partidos» de sus equipos (hora y cancha) en el calendario y el Inicio del acudiente | frontend | `bff/src/routes/events.route.ts`, `frontend/src/pages/events/MyEventRegistrationsPage.tsx` | No | P1-06, P0-09, frente:familia | Acudiente con hijo inscrito ve el partido en su calendario; escuela invitada lo ve en su delegación. Una consulta por pantalla, sin N+1 | M |
| P3-06 | **M-T4b — Programador automático:** RPC `schedule_round` que reparte una jornada en canchas y franjas libres con descanso mínimo por equipo, todo o nada; vista previa y confirmación | db | `supabase/migrations/<migrations:new torneos_programar_jornada>.sql`, `frontend/src/components/tournaments/AutoScheduleDialog.tsx` | Sí | P1-03 | 8 partidos en 2 canchas de 9:00 a 13:00 sin choques y con al menos 1 partido de descanso por equipo. Si una franja choca a mitad del lote, no se programa ninguno | L |
| P3-07 | **M-T4c — Bloque del fin de semana:** reservar las canchas para el torneo; al programar un partido dentro, el bloque se parte (liberar e insertar tramos sobrantes en la misma transacción) | db | `supabase/migrations/<migrations:new torneos_bloque_canchas>.sql` | Sí | P3-06 | Con el bloque activo nadie alquila esas canchas. Programar adentro no choca con su propio bloque. Al cerrar el torneo se libera lo que sobra | M |
| P3-08 | **Torneo en cancha de un tercero:** desde el partido, crear una reserva normal (`rental`) en la sede de SportMaps Canchas, cobrada aparte | bff | `bff/src/routes/events.route.ts` | No | frente:canchas (F1–F2) | La reserva queda con `payment_category 'reserva'` y la inscripción sigue en `'torneo'`. Sin recargo al cliente salvo que la sede lo configure | M |
| P3-09 | **QA real + seguridad de P3:** escaneo de carné en celular, página pública compartida, calendario del acudiente; RLS negativas sobre sanciones y carnés; staging | qa | `frontend/e2e/torneos-carne-publico.spec.ts`, `scripts/rls-pruebas-negativas.mjs` | No | P3-02, P3-03, P3-04, P3-05 | Spec en verde en local y staging. Un acudiente de otra escuela no ve rosters ajenos. `seguridad:invariantes` sin CRÍTICAS. `gen types` una vez al cierre de M-T4 | M |

### P4 — Conversión del piloto, contenido y adquisición

**Objetivo.** Convertir el piloto gratis en addon pagado y usar los torneos con escuelas invitadas como canal de adquisición de academias.

| ID | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| P4-01 | **Seguimiento y vencimiento operativo del piloto:** script/job en lote que lee `school_addons.metadata.gratis_hasta` de todos los pilotos (plantilla única) y avisa al dueño 5 días antes; reporte de uso por escuela (torneos, partidos, resultados) con consultas puntuales | ops | `scripts/piloto-addons-vencimiento.mjs`, `docs/specs/torneos-canchas-piloto.md` | No | P0-14 | Un solo SELECT en lote (sin N+1) lista pilotos que vencen; el aviso llega al dueño por el despachador. Nadie pasa a cobro ni a solo lectura sin aviso | S |
| P4-02 | **Conversión al vencer (paso 1b):** `monthly_price_cents` = precio de D5 para quien acepta; para quien no, `enabled=false` → **modo solo lectura** de P0-07. Nunca borrar sus torneos | ventas | `docs/migraciones-para-aplicar-2026-10-14/PROPUESTA_piloto_torneos_4_escuelas.sql` (paso 1b) | No | P4-01, P0-07 (en producción), D3, D5 | La factura SaaS del mes siguiente suma el addon solo a quien aceptó. Las demás ven sus resultados y no pueden crear ni editar | XS |
| P4-03 | **Manual con capturas reales** (2 versiones + Mapi): «Tu liga interna en 10 minutos» y «Programar partidos en tus canchas» | contenido | `docs/manuales/_src/torneos/`, `docs/manuales/torneos-escuela.pdf` | No | P1-12, P2-08 | Solo capturas de la app corriendo, cero datos inventados, en tuteo | M |
| P4-04 | **Landing:** Organizadores/Eventos y addon Torneos reescritos sobre lo real (fixture, grupos, tabla pública, partidos en cancha sin choques); boletería en «Próximamente»; sin americanos ni PWR | landing | `Landing_page/sportmap-maps-landing-page/frontend/src/pages/Organizadores.tsx`, `…/Eventos.tsx`, `…/src/config/saas-plans.ts` | No | frente:landing, P2-08 | Cada promesa tiene la pantalla que la respalda. Sin testimonios ni cifras inventadas. Coordinado con la sesión que tiene ~20 archivos modificados en ese repo, commiteando solo lo propio | M |
| P4-05 | **Contenido:** carrusel «Del grupo de WhatsApp a la tabla pública» y video corto con un caso real del piloto | contenido | `docs/marketing/torneos/` | No | P4-03, P4-04 | Aprobado por la escuela protagonista. No sale antes de que la landing esté limpia | S |
| P4-06 | **Captura de leads:** cada academia invitada a un torneo que no es cliente recibe una vez la invitación al plan Gratis o a un piloto | ventas | `bff/src/routes/events.route.ts`, `docs/specs/torneos-canchas-piloto.md` | No | P0-14, frente:organizador | Lista de academias invitadas no clientes con su torneo de origen. Un solo mensaje por academia, registrado | S |

---

## 3. Piloto gratis 1 mes — addon Torneos

| | |
|---|---|
| **A quién** | Besser, Monster, Dynasty y Club Carmel. Antes de activarlo se verifica su tier real: si ya traen Torneos por Elite/Enterprise (incluidas las grandfathered), no se les toca el addon y entran al piloto solo como acompañamiento |
| **Cuándo** | Activación en la semana 1, en cuanto estén desplegados P0-06 (tuteo), P0-07 (gate + solo lectura), P0-08 (resultados públicos) y P0-09 (RLS de lectura). No espera a los bugs de fixture: esos se cierran durante el piloto |
| **Cómo** | Plantilla única de piloto (la misma para todos los addons): SQL de propuesta con `monthly_price_cents=0`, `metadata.gratis_hasta`, `metadata.piloto`; lo corre el dueño por una vía con rastro. Vencimiento operativo con P4-01 |
| **Qué se mide** | Por escuela: torneos creados, categorías, equipos externos invitados, partidos generados, resultados cargados, visitas a la página pública, inscripciones con cobro, tickets de soporte y bugs reportados. Desde P1: partidos programados en cancha y choques evitados |
| **Criterio de éxito** | Al menos 2 de las 4 escuelas corren un torneo real con ≥ 1 jornada cargada y la tabla pública compartida; ≥ 1 trae al menos una academia externa invitada; 0 incidentes de datos (goles perdidos, llaves corruptas, datos de menores expuestos); ≥ 2 aceptan pagar al vencer el mes |
| **Al vencer** | Quien acepta pasa al precio de D5. Quien no, queda en solo lectura (D3): sus torneos y resultados siguen visibles. La mora no cancela inscripciones de familias a ningún torneo |

---

## 4. Decisiones abiertas

| ID | Pregunta | Recomendación | Bloquea |
|---|---|---|---|
| D1 | ¿Quién programa partidos y carga resultados? El spec §D.6 pide `user_staff_school_ids()`; hoy `can_manage_event` solo deja a owner/admin/school_admin | Programar = admin del anfitrión (`user_admin_school_ids()`); cargar resultado = staff (`user_staff_school_ids()`, el coach como planillero) | P0-04, P1-03 |
| D2 | ¿Programar en canchas propias exige el addon Canchas (`reservations`) o basta Torneos? | Basta Torneos: la ocupación es interna; Canchas solo hace falta para vender reservas | P1-01 |
| D3 | Al vencer el piloto sin pagar, ¿el addon se apaga del todo o queda en solo lectura? | Solo lectura (implementada en P0-07): tabla y resultados visibles; no se crea, edita ni programa | P0-07, P4-02 |
| D4 | ¿Los torneos internos (`school_only`) e `invited_only` tienen resultados públicos por enlace? **Adelantada a P0** | `school_only`: solo usuarios logueados de la escuela; `invited_only`: anfitrión e invitados; `public`: con enlace y sin indexar | P0-08 |
| D5 | Precio del addon Torneos después del piloto: $49.000 (código y plan maestro) o $79.000 (decisión de mayo citada en el spec de Canchas) | $49.000, como dice el plan maestro. Hasta cerrarla, la oferta del piloto no promete precio posterior | P0-15, P4-02 |
| D6 | Sanciones por defecto | Roja = 1 fecha; 5 amarillas = 1 fecha; configurable por torneo | P2-01 |
| D7 | Orden de desempate por defecto | Puntos, diferencia de goles, goles a favor, enfrentamiento directo, fair play | P2-01 |
| D8 | ¿La verificación pública del carné muestra la foto del menor? | Sin foto en la vista anónima; con foto solo para el staff logueado de las escuelas participantes (Ley 1581) | P3-01 |
| D9 | `scheduled_at`: espejo de `starts_at` o migrar a sus lectores (mesociclo, partidos F1) | Espejo | P1-01 |
| D10 | ¿Quién es dueño de la ocupación `event`: este frente o Canchas F5? | Este frente (el plan maestro ya se lo asigna); Canchas F5 la retira (P1-13) | P1-01 |

---

## 5. Riesgos

- **Choques con clases y alquileres antes de Canchas F1.** Hasta F1, alquileres y clases no escriben en `facility_occupancy`: el EXCLUDE solo protege contra otras ocupaciones. Mitigación: guarda de transición en `schedule_tournament_match` (P1-03) contra `facility_reservations` y los horarios de clases; se retira al salir F1.
- **Guardado de goles sin transacción** durante el piloto (hasta P0-04/P0-05): un fallo entre el delete y el insert pierde goles de clientes reales. Mitigación: P0-04 es de los primeros días; mientras tanto, el piloto se acompaña de cerca.
- **Rosters y partidos legibles por cualquier usuario logueado** (`tmatches_read`/`tmevents_read` `USING (true)`), con datos de menores. Mitigación: P0-09 antes de activar el piloto; medir el radio para no romper el calendario del acudiente.
- **`tmatches_manage` es `FOR ALL`:** sin la guarda de P1-02, un admin cambiaría cancha y hora por PostgREST sin pasar por la ocupación.
- **Service role en el BFF:** si las RPCs se llaman así, `auth.uid()` es nulo y el gate interno devuelve ceros o rechaza. Siempre `userClient(req)`; `facility_occupancy` solo se lee por RPC `SECURITY DEFINER` o service role tras validar propiedad.
- **Regenerar el fixture borra partidos:** pone en NULL `match_results.tournament_match_id` y `training_microcycle_days.tournament_match_id`, y con P1 dejaría ocupación huérfana (`source_id` sin FK). Mitigación: 409 con partidos jugados (P0-03), RPC y trigger de P1-04.
- **Piloto sin fecha de corte operativa:** `school_addons` no tiene vencimiento; sin P4-01 queda gratis para siempre. Y si el paso 1b corre antes de que P0-07 esté en producción, apagar el addon esconde el menú en vez de dejar lectura.
- **Prometer precio o «sin comisión» sin respaldo:** P0-15 depende de D5 y de P0-11.
- **Disk IO del plan Free con una sola base:** migraciones desde una sola sesión, `gen types` una vez por lote, nada de `list_tables`/`get_advisors`; QA y concurrencia en el gemelo Docker o la escuela demo.
- **Archivos compartidos con otra sesión** (`saas-plans.ts` en app y landing, páginas de la landing): P0-16 y P4-04 se coordinan y se commitea solo lo propio. La misma limpieza de la landing debe corregir «Suprema / BioStar2» → ZKTeco (hallazgo de otro frente).
- **Menores de edad:** carné y página pública nunca exponen documento ni año de nacimiento.
- **Organizador independiente roto** (POST `/events`): este frente se vende solo a escuelas con el addon hasta que frente:organizador lo reuse.
- **Expectativa «multideporte»:** P2 cubre deportes de marcador; deportes juzgados (gimnasia, porrismo) y americanos/PWR quedan fuera y no se prometen.

---

## 6. Correcciones del revisor que se aplicaron

| # | Corrección | Dónde quedó |
|---|---|---|
| 1 | El voseo no estaba en `TournamentRegisterPage.tsx:81` sino en `:84, :93, :134, :148`, y faltaba `SchoolTournamentDetailPage.tsx:144`. Grep ampliado a más verbos y a las carpetas completas | P0-06 |
| 2 | La copa no tiene origen de semilla (`event_teams` sin `ORDER BY`): columna `seed` o sorteo determinista, bracket estándar y test con N no potencia de 2 | P0-02, P0-03 |
| 3 | Bugs no cubiertos: corregir un resultado de copa con la ronda siguiente jugada; regenerar con `played`/walkover (incluidos los de `advanceByes`) | P0-03 |
| 4 | El delete de goles solo corre si llegan goles: no se puede volver a 0. Las tarjetas no copian el patrón; RPC transaccional puente `save_match_events` | P0-04, P0-05 |
| 5 | Resultados públicos: filtrar `status`, `creator_role='school'` y `visibility`; D4 adelantada a P0; el selector ya lo soporta la API | P0-08, D4 |
| 6 | No existe modo «solo lectura» ni gate de escritura: tarea explícita en P0 (antes del piloto), menú visible en lectura, P4-02 depende de P0-07 | P0-07, P4-02, D3 |
| 7 | «H1 (21-oct)» era un bug del spec de Canchas, no un hito. P1 duplicaba Canchas F5. Dependencia real = Canchas F1, con guarda de transición también contra clases; dueño único de la ocupación `event` | P1 (intro), P1-01, P1-03, P1-13, D10 |
| 8 | P0-09/P0-10 prometían $49k con D5 abierta: la oferta no promete precio posterior hasta cerrar D5 | P0-14, P0-15, D5 |
| 9 | El hueco real de RLS es `tmatches_read`/`tmevents_read USING (true)`, no anon sobre `facility_occupancy` (ya cerrado en F0). `facility_occupancy` no tiene SELECT para `authenticated`: P1-07 y P1-10 leen por RPC o service role, y queda escrito | P0-09, P0-10, P1-07, P1-10, P1-11 |
| 10 | Ruta correcta del patrón de piloto: `docs/migraciones-para-aplicar-2026-10-08/PROPUESTA_habilitar_tienda_gym_rm.sql` | §1 |
| 11 | Activación del piloto separada de la QA (arranca ya), verificando el tier real de las 4 escuelas; plantilla única de piloto para todos los addons | P0-14, §3 |
| 12 | Vencimiento operativo del piloto: script/job concreto que lee `metadata.gratis_hasta` | P4-01 |
| 13 | Las notificaciones de resultado (`notifyTeamMembers`) llegan a familias reales con voseo: el tuteo va antes de activar el piloto | P0-06, P0-14 |
| 14 | ROADMAP desactualizado (MOD-7, `:1013`, `:2042`, `:1139`) y spec §D.6 con otra regla de permisos: tarea para dejar una sola verdad | P0-17 |
| 15 | Deportes juzgados y americanos/PWR declarados fuera de alcance | §1, P0-16, Riesgos |
| 16 | Faltaban concurrencia e idempotencia en P0 (doble clic en generar y guardar) | P0-12 |
| 17 | Faltaban pruebas negativas de RLS en P0 con datos reales en juego | P0-10 |
| 18 | Landing: coordinar con la sesión que tiene ~20 archivos modificados; anotar «Suprema / BioStar2» → ZKTeco | P4-04, Riesgos |
| 19 | «Sin comisión a las familias» se verifica en el flujo de pago de la inscripción antes de prometerlo | P0-11, P0-15 |
| 20 | QA solo en local no basta: pasada en staging con la escuela demo y verificación del chunk desplegado antes del piloto | P0-13, P1-12, P2-08, P3-09 |
| 21 | La landing ya tenía la descripción honesta del addon (`saas-plans.ts:266`); solo falta la app. Las tarjetas se reclasificaron de «roto» a «no existe» (solo el CHECK las admite) | §1 (estado), P0-16, P4-04 |
