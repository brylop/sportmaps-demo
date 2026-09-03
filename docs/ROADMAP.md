# SportMaps — Roadmap Maestro

**Versión:** 2.30 · **Fecha:** 2026-08-31 · **Rama:** `develop`

> **Este es el único roadmap.** Todo lo demás en `docs/` es *spec* (qué se construye y por qué),
> *plan de fase* (cómo se migra), *doctrina de arquitectura* (cómo se hace) o *auditoría* (qué está
> mal). Ninguno de esos documentos define prioridades: las define esta cola. Si un pendiente no
> aparece aquí, no existe.

**Cambios v2.29 → v2.30** ("crea un evento desde el owner y que le salga al padre demo",
2026-08-31): **gap de producto real, no de datos** — `calendar_events` es estrictamente personal
(`user_id` único, sin campo de audiencia/destinatarios). La "vista de escuela" del owner/admin no es
un calendario compartido: es la unión de los calendarios individuales de cada miembro, para
supervisión. Un evento que crea el owner **nunca llega** al calendario de un padre — no hay ningún
mecanismo de broadcast. De paso: `organizer/create-event` (la otra pantalla con "evento" en el
nombre, la de torneos) está detrás de `<OrganizerGuard />` — el owner de una escuela no puede
acceder, es exclusivo del rol `organizer`. Lo único que sí hace broadcast owner/coach → familias hoy
es `announcements` (`audience: 'parents'|'players'|'both'`), pero es un aviso, no un evento con
fecha en calendario. **Decisión del usuario:** por ahora, insertar el mismo evento dos veces (una fila
por `user_id`, owner y padre) para que ambos lo vean — es un parche de datos para la demo, no arregla
el gap. Insertadas 2 filas en `calendar_events` (`is_demo=true`), verificado visible por RLS para el
padre. **Pendiente real, sin resolver:** `calendar_events` necesita un eje de audiencia
(`visibility`/`team_id` como filtro real, o una tabla de invitados) para que un evento de escuela
llegue de verdad a las familias — hoy ese track no tiene ID en el roadmap, vale abrir uno si se decide
construirlo en serio.

**Cambios v2.28 → v2.29** ("no le sale el pago al hijo de padre demo", 2026-08-31): causa — la
inscripción de Samuel Ramírez (Padre Demo Fútbol) tenía `monthly_fee=null` (a diferencia de "Hijo
pruebas", en `150000`), así que nunca se generó ningún cobro. Corregido: `monthly_fee=150000` en su
inscripción + 2 filas de `payments` (agosto vencido, septiembre pendiente — mismo patrón que ya tenía
el otro hijo). Verificado visible por RLS para ese padre. No se corrió `open_month`/
`generate_monthly_charges` a propósito — son globales por escuela/base compartida y hubieran podido
generar cobros para otras inscripciones reales fuera de este alcance.

**Cambios v2.27 → v2.28** (usuario mandó captura del PDF: emoji rotos y ceros de fútbol que resultaron
ser de OTRO informe — Samuel en banca, correcto; pidió mejor diseño de header/documento/footer con
"Powered by SportMaps", 2026-08-31): **rediseño completo de `athlete-reports-pdf.ts`**, mismo estilo
que `saasInvoicePdf.service.ts` (fondo blanco, línea de acento fina, cajas redondeadas, nada de banda
sólida) — logo real de SportMaps (`fs.readFileSync` cacheado, mismo patrón) o logo propio de la
escuela si tiene whitelabel (`fetch` con timeout 3s), fila de cajas de estadísticas en vez de texto
plano, notas con barra de acento lateral, footer con `Cache-Control: no-store` (evita que el navegador
sirva un PDF viejo tras regenerar el snapshot) y "Powered by SportMaps" — mismo criterio de
`showWatermark` que ya rige correos/PWA. Se sacaron los emoji (⚽🅰🟨🟥): Helvetica de pdfkit no tiene
esos glifos, salían como basura — mismo problema por el que `certificates.ts`/`saasInvoicePdf.service.ts`
nunca los usan, y no lo noté hasta verlo en la captura real. **Bug encontrado en QA visual propia**
(generando el PDF real a archivo con un script puntual, no solo mirando el código): el footer, escrito
deliberadamente dentro del margen inferior, disparaba la paginación automática de pdfkit y dejaba una
página 2 casi en blanco con el footer duplicado — corregido con el patrón estándar `bufferPages` +
`switchToPage` + `margins.bottom = 0` al dibujar. Verificado visualmente (`Read` sobre el PDF generado)
en los dos informes reales de septiembre — una sola página, sin superposiciones, sin página fantasma.

**Cambios v2.26 → v2.27**: mismo tratamiento que Samuel para el otro hijo de prueba del equipo
(`Hijo pruebas`, padre real de la sesión `brylop71@gmail.com`) — 5 métricas × 4 semanas (con
`posicionamiento_tactico` deliberadamente en rojo, para que "en qué trabajar" tenga contenido, no
solo destacados), asistencia, minutos reales + asistencia en el amistoso (a diferencia de Samuel, que
quedó en banca), nota individual del coach. Informe de septiembre generado con `buildReportSnapshot()`
real y publicado — verificado visible por RLS para ese padre.

**Cambios v2.25 → v2.26** (usuario: "no hay reporte para el padre demo fútbol", 2026-08-31): causa
real — `generate_report_drafts` solo crea borrador para atletas **con mediciones en el periodo**, y
el hijo de "Padre Demo Fútbol" (Samuel Ramírez, banca en el amistoso, 0 minutos) no tenía ni una
fila de `performance_entries` en septiembre. Se agregaron 6 mediciones + 6 registros de asistencia, y
se generó el informe de verdad — no a mano: se corrió `buildReportSnapshot()` (el mismo servicio que
usa el job diario, `bff/src/services/report-snapshot.service.ts`) vía un script `ts-node` puntual
contra la base viva, y el resultado real se insertó en `athlete_reports` (`status='publicado'`,
`recipient_id` = el padre). Verificado con `SET LOCAL role authenticated` + JWT simulado del padre:
la fila **es visible por RLS**. El resumen de fútbol del snapshot da `matches_played: 0` — correcto,
no es un bug: Samuel no sumó minutos en el amistoso, estuvo en la banca.

**Cambios v2.24 → v2.25** (usuario probó la vista del padre con la escuela demo y mandó capturas,
2026-08-31): **hallazgo grave en los datos sembrados en v2.23** — el partido de fútbol se cargó contra
`competition_results`, pero el "Panorama de fútbol" del coach (`FootballDashboardModal.tsx` →
`useTeamMatches`/`useCreateTeamMatch`) y el resumen de fútbol del propio snapshot del informe
(`report-snapshot.service.ts` → `loadFootballSummary`) leen `match_results` — **una tabla distinta**,
ya documentada como tal en el propio comentario de la migración de `CAR-8` pero que no se releyó al
sembrar. Corregido: fila nueva en `match_results`, `match_lineups`/`football_match_events` reapuntados
a su `id`, `competition_results` huérfana borrada. **Segundo pedido: mover "Progreso Deportivo" al
centro de `/academic-progress`** — antes el card central era "Evolución de Habilidades" (tabla
`academic_progress`, sin datos) y el real (`PerformanceEvolutionSection`, con los datos sembrados)
quedaba relegado a la columna secundaria; se intercambiaron posiciones. **Tercero: dónde ver el
informe** — resultó que ya existe un botón "Informes" en cada tarjeta de `MyChildrenPage.tsx`
(`/children/:id/reports`), construido junto con el resto de F4 — no hizo falta agregar nada, solo
señalarlo.

**Cambios v2.23 → v2.24** (usuario pidió proceder con F4, 2026-08-31): **corrección sobre lo dicho en
v2.23** — F4 (vista del padre) **no estaba sin construir**. Un grep con mal patrón (`athlete_reports`
literal, que estas páginas no usan) hizo que se pasara por alto `ChildReportsPage.tsx` +
`ChildReportDetailPage.tsx` + `useAthleteReports.ts`, ya completos: lista, detalle interactivo con
todo el snapshot (fútbol, notas, asistencia, destacados, a-trabajar, métricas por categoría) y
`mark_report_viewed` ya cableado. **Lo único que de verdad faltaba era el PDF.** Construido:
`bff/src/routes/athlete-reports-pdf.ts` (`GET /api/v1/athlete-reports/:id/pdf`, pdfkit, mismo patrón
que `certificates.ts`, streaming "al vuelo" sin Storage) + botón "Descargar PDF" en
`ChildReportDetailPage.tsx`. De paso se encontró y corrigió un enlace obsoleto en dos lugares
(`report-delivery.service.ts` y el trigger `adopt_reports_on_child_link`, migración
`20260831172237`, aplicada y verificada): ambos mandaban a `/children/:id/progress` con un comentario
que decía "F4 no existe todavía" — ya no es cierto, ahora enlazan a
`/children/:id/reports/:reportId`. `tsc --noEmit` limpio en frontend y BFF; el endpoint nuevo
responde `401` sin auth (confirma que carga y no truena). **Gap real, distinto, encontrado de paso:**
F4 solo cubre `subject_type='child'` — no existe página equivalente para que un atleta adulto
(`profile`) vea sus propios informes; sigue cayendo a `/stats`. Sin probar con un JWT real de padre
(sin credenciales en esta sesión).

**Cambios v2.22 → v2.23** (usuario pidió datos de prueba completos + estado real del Informe Mensual
del Atleta, 2026-08-31): sembrados datos en `Academia Fútbol Demo` (escuela demo, no un cliente real)
— 15 días de mesociclo, 8 sesiones con `session_blocks`/`game_principles`/`evaluation` completos,
1 alineación de 15 jugadores + 4 eventos de partido (Tablero Táctico), 21 registros de evolución,
18 filas de rúbrica del mesociclo. Verificado contra la base tras cada bloque, no solo al final — un
primer intento de sembrar el partido falló en silencio (CTE encadenado sobre una fila que nunca se
creó por un `recorded_by NOT NULL` no visto) y se detectó con un `count(*)` antes de seguir.

**Informe Mensual del Atleta — estado real verificado, no de memoria:** `F1` (backend), `F2` (UI
coach básica) y **`F5` (job diario) están construidos** — `F5` corrige una nota vieja de memoria que
decía "sin implementar"; en realidad corre por `node-cron` desde `maintenance.job.ts`. `F0`
(vocabulario del padre) parcial: las columnas `parent_label`/`parent_hint` existen, sin contenido.
`F3` (tablero de cobertura del admin) no construido. **`F4` (vista del padre + PDF) es el único
bloqueante real** — confirmado en el propio código: `report-delivery.service.ts` manda el enlace del
correo a `/children/:id/progress` (una pantalla que ya existe) *a propósito*, con el comentario
"mientras no exista [F4], mandar a una ruta inventada sería mandar al vacío" — no es un link roto, es
un rodeo consciente. Uso real medido: **1 informe creado en toda la base, 0 publicados.**

**Cambios v2.21 → v2.22** (usuario probó de verdad en el navegador — primera vez en toda esta serie —
y reportó dos fallas reales, 2026-08-31): **(1)** el mesociclo recién creado no aparecía. Causa:
`mesocycle-current` exigía que "hoy" cayera dentro de `starts_on`/`ends_on`; el mesociclo de prueba
empezaba el 1-sep con el sistema en 31-ago, así que quedaba invisible aunque se había creado bien
(confirmado en la base: la fila existía). Fix: se muestra el más reciente del equipo, sin exigir
fecha vigente — y de paso se corrigió el `new Date().toISOString()` (anti-patrón ya auditado el
2026-08-03, `dateUtils.ts`) que quedó en dos lugares nuevos. También se encontró que un mes de 30/31
días generaba una 5ª semana suelta de 1-3 días — `buildWeeklyMicrocycles` ahora reparte el resto
entre las 4 semanas fijas, como el Excel. **(2)** "Evaluar" (`PerformanceEntryModal`/
`TeamPerformanceEntryModal`, código previo a esta sesión) decía "esta escuela no tiene deporte
asignado" — **falso**, verificado en la base: `Academia Fútbol Demo` sí tiene `category_id` (Fútbol).
Causa real: el BFF no estaba corriendo (`curl` a `:3000` daba conexión rechazada); los dos modales
mostraban ese mensaje específico ante *cualquier* falla de la consulta, no solo la genuina ausencia
de deporte — bug de UX real, ahora distinguen error de conexión del caso sin deporte.

**Cambios v2.20 → v2.21** (usuario preguntó "¿registrar el mesociclo es lo mismo que en el Excel?" —
la pregunta forzó la comparación campo a campo que no se había hecho): se encontró que `PER-1`
(microciclo + días) nunca tuvo frontend — el `MesocycleSection.tsx` de v2.18 solo leía, nunca
escribía, así que después de crear un mesociclo el acordeón de semanas quedaba vacío para siempre.
Cerrado: `createMesocycle` genera las 4 semanas automáticamente, más alta de días y creación de
sesión ligada por día. También quedó documentado que el modelo de día/índice MD **no viene del Excel
de Carmel** (que no tiene columna de fecha ni rótulo de día) — es una fusión con el spec `PER`
original (Canva de Santa Fe) hecha sin que el usuario la pidiera explícitamente para Carmel.

**Cambios v2.19 → v2.20** (usuario autorizó explícitamente el fix de raíz de `SEG-23`, 2026-08-31):
`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon`
(migración `20260831163530`), verificado **empíricamente** con una tabla de prueba dentro de una
transacción con `ROLLBACK` — nace sin `anon`, `authenticated`/`service_role` intactos. Confirmado que
no es retroactivo: `schools` y `sport_metric_thresholds` (grants intencionales a `anon`) sin cambios.
Queda abierta, a propósito y fuera de este alcance, la deuda puntual de `match_lineups`/
`match_lineup_players`/`football_match_events` (`CAR-8`), que conservan el `GRANT` viejo — el fix de
raíz no revierte lo ya otorgado antes de aplicarse.

**Cambios v2.18 → v2.19** (usuario autorizó la Supabase MCP a mitad de sesión, 2026-08-31 — la misma
sesión que en v2.18 había reportado no tener vía para aplicar): `PER-7`/`PER-8` **aplicados y
verificados en `luebjarufsiadojhvxgi`**, migración `20260831160936`. **Hallazgo nuevo, no menor:**
la migración quedó con `GRANT` a `anon` sin haberlo pedido — causa raíz en un `ALTER DEFAULT
PRIVILEGES` del rol `postgres` que afecta a toda tabla nueva, y que ya había dejado el mismo drift,
sin detectar hasta ahora, en `match_lineups`/`match_lineup_players`/`football_match_events` (`CAR-8`,
12-ago) — dos migraciones que declaraban explícitamente "sin GRANT a anon" y ninguna lo logró. Se
abre `SEG-23`: el radio de esta sesión se cerró (`20260831162124`), la causa raíz sigue abierta y sin
decidir. RLS ya bloqueaba el acceso real en ambos casos — no hubo dato expuesto.

**Cambios v2.17 → v2.18** (usuario autorizó explícitamente escribir y aplicar en base, 2026-08-31):
código completo de `PER-7`/`PER-8` — migración `20260831160936_mesociclo_carmel.sql` (`migrations:new`,
`migrations:sync`, `migrations:check` en verde, 468/468) y frontend (`MesocycleFormDialog.tsx`,
`MesocycleRubricTable.tsx`, `MesocycleSection.tsx`, integrado en `TrainingPlansPage.tsx`). `tsc
--noEmit` sin errores, dev server sirve sin errores de consola. **No se pudo aplicar la migración a
la base viva**: Supabase MCP pide OAuth interactivo (no disponible, sesión no-interactiva), la CLI no
tiene `SUPABASE_ACCESS_TOKEN`, y `bff/.env` solo trae la REST key de solo lectura, no una connection
string de Postgres — ninguna vía deja rastro como exige `CLAUDE.md`, así que no se forzó por el SQL
editor. Queda en manos del usuario: `npx supabase db push`, autorizar la MCP, o pasar credenciales.

**Cambios v2.16 → v2.17** (`D2`/`D4`/`D9`-`D12` resueltos en conversación con el usuario, 2026-08-31
— reusando lo verificado en v2.16 contra la base viva en vez de proponer tablas nuevas de más):
[`plan-mesociclo-carmel-2026-08-31.md`](plan-mesociclo-carmel-2026-08-31.md) tiene el DDL/RLS/frontend
concreto de `PER-1`/`PER-7`/`PER-8` — **plan, no migración todavía**, sigue pendiente de aprobación
antes de correr `migrations:new`. Dos ajustes sobre lo propuesto en v2.16: la carga (`rpe`) no es
columna nueva, entra como clave más en el `evaluation` jsonb que `CAR-8` ya creó; y `D12` no se
resolvió a un solo modo — el coach elige `team` o `individual` por mesociclo
(`training_mesocycles.evaluation_mode`), cada modo con su propio camino de datos.

**Cambios v2.15 → v2.16** (segundo Excel real de Club Carmel, `MESOCICLO C.C.C..xlsx`, aportado por
el usuario 2026-08-31 — sin escribir ninguna migración, según la convención *plan antes de código*):
cruzado contra el spec `PER` (que ya estaba «para aprobación», sin tocar desde el 19-ago) y contra
`CAR-8` (recién documentado en v2.15). Hallazgo principal: **casi toda la grilla semana-a-semana del
Excel ya está cubierta** por lo que `CAR-8` construyó a nivel sesión más lo que `PER-1` ya tenía
diseñado a nivel semana — lo único genuinamente nuevo es el **mesociclo** como contenedor del mes,
que no existía en ningún lado. Se agregan `PER-7`/`PER-8` y las decisiones `D9`-`D12` (spec §2/§3.5);
solo `D12` (rúbrica por equipo vs. por atleta) queda 🔴 sin default. Hipótesis registrada, no
confirmada: la razón por la que `CAR-8` tiene **0 uso real** puede ser que el flujo real del cuerpo
técnico empieza planeando el mes, no abriendo una sesión suelta — sin `training_mesocycles` no hay
dónde dar ese primer paso.

**Cambios v2.14 → v2.15** (se registra `CAR-8`, entregado el 2026-08-29 sin pasar por esta cola —
sexto caso de «trabajo vivo que el tablero no refleja» después de `DIN-4`, Android, el ciclo diario
de Informes, el tablero táctico de fútbol y `MOD-21`): la migración
`20260828230512_renombrar_sesiones_entrenamiento_futbol.sql` y el commit `a550d40f` construyeron
edición de sesión de entrenamiento con contenido de fútbol tomado del Excel real del club («Sesión
Diaria Fútbol C.C.C», Club Carmel) — `session_blocks`/`game_principles`/`evaluation` en
`training_sessions` + `SessionFormDialog.tsx`. **Verificado contra la base viva (`luebjarufsiadojhvxgi`)
el 2026-08-31, read-only vía REST:** `training_sessions` tiene 3 filas, todas anteriores a la
migración (2026-03-20 y 2026-04-11) y de dos escuelas que no son Carmel (`MMA BLAIR TEAM`,
`ACADEMIA SUPERIOR BOGOTA`) — **ninguna tiene `session_blocks`, `game_principles` ni `evaluation`
poblados.** El código está listo pero **ningún coach de Carmel lo usó todavía**: sigue sin haber
carga real del Excel ni una sesión capturada con el formulario nuevo.

**Cambios v2.13 → v2.14** (aplicado el lote de `SEG-22`/`SEG-1`/`SEG-2`, 2026-08-31 — confirmado por
el usuario tras la propuesta de v2.13): migración `20260831095348_cerrar_brechas_seg22_seg1_seg2`
escrita y aplicada contra la base viva vía `apply_migration` (deja rastro, no SQL editor). Cuatro
piezas, las cuatro verificadas post-aplicación:
- `SEG-22` ✅ — `bridge_heartbeats` con RLS habilitada, confirmado `anon` → 0 filas.
- `SEG-1` (search_path) ✅ — las 7 funciones nuevas, confirmado 0 restantes en el catálogo.
- `SEG-1` (extensiones) 🟡 — `pg_trgm`/`unaccent` movidas a `extensions`, confirmado. **`pg_net` NO se
  pudo mover**: `ALTER EXTENSION pg_net SET SCHEMA` no está soportado por esa extensión (error
  `0A000` al intentarlo) — moverla de verdad exige `DROP`+`CREATE`, y eso arrastra la cola async que
  usan el outbox de notificaciones y el autopay; no vale el riesgo por un hallazgo de higiene. Queda
  como aceptado, no como pendiente.
- `SEG-2` ✅ — las 2 vistas públicas intencionales documentadas con `COMMENT ON VIEW`.
- **Lo único que sigue abierto de este lote y no se puede cerrar por SQL:** la protección de
  contraseñas filtradas — toggle del dashboard de Supabase Auth, alguien con acceso tiene que
  prenderlo a mano.
- Migración sin commitear todavía — queda `supabase/migrations/20260831095348_*.sql` +
  `supabase/migrations_ledger.json` en el working tree, junto con este roadmap.

**Cambios v2.12 → v2.13** (auditoría en vivo del track `SEG`, 2026-08-29 — pedido explícito de
"empezar a cerrar las brechas que no dependan de decisiones"): corrida `npm run seguridad:invariantes`
+ `get_advisors(security)` + verificación puntual por catálogo (`has_function_privilege`, `proacl`,
`pg_views`) contra la base viva (`luebjarufsiadojhvxgi`), no contra el repo:
- **`SEG-8` estaba cerrado y la fila decía lo contrario.** Verificadas las 37 de las 40 funciones que
  existen en la base (3 son deriva, no están creadas): las 37 dan `anon`/`authenticated` = `false` en
  `has_function_privilege`, y `proacl` solo lista `postgres`/`service_role`. La migración de cierre
  **sí está aplicada** — nadie actualizó la fila cuando se aplicó. Pasa a ✅.
- **`SEG-1` re-medido: el número sigue en single-digit pero es un conjunto DISTINTO.** `search_path`
  mutable ya no son las 8 funciones de agosto — son **7 funciones nuevas** de módulos que no existían
  el 12-ago (categorías deportivas, rutinas de personal trainer). Extensiones en `public`: siguen
  siendo 3 (`pg_trgm`, `unaccent`, `pg_net`), sin cambio. Protección de contraseñas filtradas: **sigue
  desactivada**. Las tres partes de `SEG-1` siguen sin depender de ninguna decisión.
- **`SEG-2` re-medido: ya no es 1 ERROR del linter, son 3.** `school_athletes` (el original) más
  `v_school_staff_publico` y `v_school_settings_publico` — **estas dos son intencionales**, las creó
  la propia auditoría del 14-ago para resolver la fuga de `school_settings`/`school_staff` a `anon`
  (RLS filtra filas, no columnas). El linter no distingue vista pública curada de bypass accidental;
  antes de tocarlas hay que documentarlas con `COMMENT`, no revocarlas — revocarlas rompe la web
  pública que las usa a propósito.
- **`SEG-18` bajó de 60 a 53** (mismo invariante I3, 0 CRÍTICAS). Parte se cerró de rebote al resolver
  `SEG-19`/`SEG-20`/`SEG-21`. Sigue siendo la misma tarea pendiente: leerlas una por una, no hay
  decisión de producto de por medio.
- **Hallazgo nuevo, no venía de ningún barrido anterior: `SEG-22`.** `bridge_heartbeats` (migración
  `20260826220634`, 26-ago) quedó sin `ENABLE ROW LEVEL SECURITY` — tabla pública, `anon` y
  `authenticated` con `SELECT/INSERT/UPDATE/DELETE` directos por privilegio de esquema. No es PII ni
  dinero, pero es la tabla que alimenta la alerta de «bridge de control de acceso caído» de escuelas
  reales con ZKTeco — cualquiera puede falsificarla o borrarla. Ver fila nueva en `SEG`.
- **Ninguno de los cinco necesita una decisión de producto ni de negocio.** Son el primer lote real
  para "cerrar brechas que no dependen de nada" — quedan como propuesta concreta en el chat, no
  aplicados todavía: tocar RLS/GRANTs en la única base compartida de dev+stg+prod es exactamente el
  tipo de cambio que el propio `CLAUDE.md` pide medir antes de aplicar.

**Cambios v2.11 → v2.12** (verificación de rama e iOS, 2026-08-29 — pedido explícito de revisar
"lo de iOS porque ya está en ramas"):
- **El repo local estaba 9 commits detrás de `origin/develop`.** Cinco PRs ya `MERGED` en GitHub
  nunca se reflejaron acá porque nadie corrió `git pull` en esta sesión ni tocó el roadmap después
  de mergear: `chore/ios-bootstrap` (#11), `feature/ios-fase-c-prep` (#7), `fix/codemagic-workspace-path`
  (#10), `fix/codemagic-cocoapods` (#9), `feature/ios-mov-safe-areas` (#6) — más
  `feature/sentry-integration`, sin relación con iOS pero mergeada en la misma tanda. **Lección de
  proceso:** la regla del §0 «se actualiza en el mismo PR que entrega» se saltó cinco veces seguidas;
  un roadmap así puede describir un estado que el repo ya no tiene, y nadie lo nota hasta que alguien
  pregunta si ya está en rama.
- **`iOS` deja de ser "no existe" — el bootstrap está commiteado y es real, no un stub.**
  `frontend/ios/App/` tiene el proyecto Xcode completo (`project.pbxproj`, `AppDelegate.swift`,
  `SceneDelegate.swift`, `Info.plist` con usage strings, `Podfile` para CocoaPods — no SPM),
  `GoogleService-Info.plist` **real** de `sportmaps-b865b` (mismo proyecto Firebase que Android), y
  `@capacitor/ios ^8.5.0` declarado en `package.json` (antes vivía sin declarar en `node_modules`,
  el hallazgo original de v2.3). `codemagic.yaml` trae dos workflows: `ios-simulator-smoke` (build
  sin firma, debería correr ya que `ios/` está versionado — sin confirmación de una corrida verde
  desde acá) y `ios-testflight` (el real, **documentado en el propio archivo como "NO FUNCIONA
  TODAVÍA"**).
- **Lo que sigue bloqueando un release real de iOS no es código, es trámite:** cuenta Apple
  Developer (comprada 2026-08-27, tipo Individual, hasta 2 días hábiles de activación), registrar
  `co.sportmaps.app` en App Store Connect (falta el Apple ID numérico, hoy `0` en el yaml), conectar
  la integración App Store Connect en Codemagic, y crear el grupo de testers "SportMaps Internos" en
  TestFlight. Ninguno de los cuatro tiene código de por medio — ver `D-IOS` en §5.
- **`MOV-1`, `MOV-2` y `MOV-3` bajan a ✅.** El §7 «Arranque inmediato» los daba por pendientes
  ("medio día + 1 día, todavía sin aplicar"); ya están en `develop` desde el 27-ago (PR #6,
  `feature/ios-mov-safe-areas`): los 9 arreglos de una línea, el borrado de `App.css`/`Layout.tsx`/
  `ui/responsive.tsx`, y las safe areas de cabeceras sticky + banners + Sheet/Drawer. **Sin
  confirmación de QA visual en dispositivo/simulador real** — el cierre es "código mergeado", no
  "verificado con capturas".
- **Endpoint de versión mínima (N2 de `BLQ-3`) existe, a medias a propósito.**
  `GET /api/v1/mobile/app-config` (público, sin auth, fuente = env vars del BFF) ya expone la
  versión mínima soportada, pero la decisión de producto fue **no forzar actualización todavía**:
  la pantalla bloqueante que consuma el dato no se construyó, por diseño (no es deuda).
- **Sentry queda instalado** (frontend `lib/sentry.ts` + BFF `instrument.ts`), cerrando la mitad
  técnica de `SEG-12`. No verificado desde acá si el DSN está seteado en Render/Vercel ni si ya
  captura errores reales en los tres ambientes — falta esa confirmación antes de dar la fila entera
  por cerrada.

**Cambios v2.10 → v2.11** (cierre de `NIV-1`/F1, cableado del banco de horas con F1, y nueva marca
de cuota exenta `MOD-22`, 2026-08-27):
- **Las decisiones de `NIV` quedan en 19, no 16.** `D17-D19` (cobro de inscripción/matrícula, con
  preview en el flujo de alta) se cerraron después de la consolidación de v2.9→v2.10 — el spec y la
  fila de `NIV-1` en la tabla ya lo reflejan, esta entrada corrige el conteo de la prosa. `NIV-1`
  quedó escrito y aplicado: `hours_plan_enabled` en producción (activo hoy solo en Dreamers).
- **Cableado F1 ↔ banco de horas.** `reserve_hour_bank()` (F4 del banco de horas, `b882f5d`) solo
  leía `school_settings.hours_session_block_minutes`, ignorando `offering_plans.session_block_minutes`
  que `D1` crea para que 2h/3h/4h convivan en la misma escuela. Corregido en migración
  `20260827174556` (cascada plan → escuela → 120). No-evento hoy — ningún plan real tiene el campo
  poblado todavía, empieza a importar en cuanto Dreamers configure sus niveles.
- **Dos huecos de seguridad de `b882f5d` cerrados aparte** (memoria `project_hour_bank_security_gaps`,
  migración `20260827174032`): los 5 RPCs del banco de horas quedan restringidos a `service_role`
  (antes cualquier usuario autenticado de cualquier escuela los llamaba directo y movía saldo ajeno),
  y el auto-cierre deja de mandar a revisión manual las visitas que ya marcaron salida normal.
- **`MOD-22` dejó de ser solo idea (⚪).** `enrollments.fee_is_manual` + `fee_reason` (migración
  `20260827175215`): un atleta (menor, adulto o sin cuenta) marcado así no genera cobro aunque su
  plan o equipo tengan precio. Cierra de paso un bug real de `open_month`/`preview_open_month`:
  `NULLIF(monthly_fee, 0)` trataba un 0 puesto a mano como "no seteado" y caía igual al precio del
  catálogo — documentado sin cerrar en `plan-tarifa-congelada-c12.md` y en el spec de categorías
  deportivas (D6). Responde "monto fijo o etiqueta" con **las dos**: el mismo flag protege un 0
  (becado) o cualquier monto negociado. Sigue sin resolver el "acuerdo de pago" (plazos especiales)
  que la fila de `MOD-22` también planteaba.

**Cambios v2.7 → v2.8 (rama `feature/niv-f1-planes-horas-inscripcion`)** (spec nuevo sobre pedido
directo de **Dreamers Gymnastics**, consolidado y verificado contra el código real el 2026-08-27 —
ver [`specs/dreamers-niveles-por-horas-y-progresion.md`](specs/dreamers-niveles-por-horas-y-progresion.md)).
Entrada original de la rama de feature, conservada tal cual junto con la de `develop` (abajo) porque
ambas describen el mismo spec desde dos sesiones en paralelo, con conteos de decisiones distintos
(D1-D16 vs D1-D19) — la nota de v2.10→v2.11 arriba ya corrige el conteo, esta se deja como registro
histórico de esa sesión:
- **Track `NIV` nuevo** (`NIV-0..NIV-7`): niveles por horas/día diferenciadas (2h/3h/4h) ligados a
  progresión competitiva, cobro de inscripción/matrícula separado de la mensualidad (gap real: no
  existía en ningún lado del producto), alta a mitad de mes con "plan de enganche", y reserva de
  clases adicionales por entrenador/horario. **19 decisiones de producto (D1-D19), todas cerradas**
  — no es una cola de decisiones, es una cola de código. `NIV-1` (F1: planes por horas + inscripción)
  tiene plan de implementación completo (spec §9) y **cero bloqueantes verificados** — listo para
  escribir la migración.
- **Dos correcciones de alcance sobre decisiones que el spec daba por cerradas**, encontradas al
  verificar contra el código real (no de negocio, spec §8): el torniquete ZKTeco decide el acceso
  físico localmente — el BFF nunca controla la puerta, así que bloquear por día de la semana
  (`NIV-4`) requiere automatizar los grupos de acceso nativos del dispositivo, un proyecto aparte de
  lo estimado; y `school_availability` ya no cuelga de `program_id` en la base real (tiene
  `branch_id`) — la migración de deuda de `NIV-4`/`MOD-14` necesita rediagnóstico antes de escribirse.
- **Orden de implementación definido:** `F1 → F7 → F2 → F3 → F5 → F6` (spec §5) — es lo que Dreamers
  necesita operar primero, no el orden de la numeración.
- **Carmel Club identificado como candidata de expansión real** (no hipotética) para `NIV`: escuela
  real, en trial, 0 inscripciones activas, mismo deporte federado.

**Cambios v2.9 → v2.10** (consolidación de producto del spec `NIV` + verificación de impacto contra
código real, 2026-08-27 — ver
[`specs/dreamers-niveles-por-horas-y-progresion.md`](specs/dreamers-niveles-por-horas-y-progresion.md#§8-impacto-verificado-contra-el-código-real-2026-08-27)):
- **Las 16 decisiones (`D1-D16`) quedaron cerradas.** La sesión de repaso que v2.9 marcaba como
  pendiente ya ocurrió. `NIV-1` (F1, planes por horas/días) **queda sin bloqueantes verificados y con
  plan de implementación escrito** (spec §9) — lista para escribir la migración. Quedan 6 datos
  puntuales pendientes (spec §7, no son decisiones: mapeo de niveles USAG, días por nivel, quién
  carga resultados, puntajes exactos de FEDECOLGIM, los 2 precios de D16, default de
  `first_payment_mode`) y **2 correcciones de alcance** que salieron de verificar el spec contra el
  código real, no de negocio:
  - `D9/D11` (`NIV-4`, reserva por entrenador): el torniquete ZKTeco (F22) decide el acceso físico
    localmente — el BFF nunca controla la puerta en tiempo real. Agregar `allowed_days_of_week` a la
    validación del BFF es barato pero solo afecta log/aviso, no bloquea el paso. Bloquear de verdad
    exige automatizar los grupos de acceso nativos del dispositivo, un proyecto aparte. Pendiente
    decidir cuál alcance quiere `NIV-4` antes de dimensionarlo (hoy dice "1 sem", asumiendo lo barato).
  - `D10` (`NIV-4`, migración `program_id → offering_id`): la premisa ya no es cierta — `school_availability`
    en la base real no tiene `program_id` ni `offering_id` (tiene `branch_id`); el diagnóstico de marzo
    quedó desactualizado y hay que rehacerlo antes de escribir esa migración.
- **Orden de implementación definido:** F1 → F7 → F2 → F3 → F5 → F6 (spec §5) — ya no "todo entra
  junto a `P3`".
- **Sigue vigente de v2.9:** Dreamers en `billing_cycle_type='fixed_calendar'` (no `prorated`); el
  motor de mora activo solo en 3/368 escuelas y apagado en Dynasty (`project_late_fee_engine_status`);
  Carmel Club como candidata de expansión real para `NIV` el día que prenda la misma config.

**Cambios v2.7 → v2.8** (entrega del mismo día — regla del §0 «lo que se entrega se marca el mismo
día» — ver [§1.5](#15-lo-entregado-el-25-de-agosto-tarde)):
- **`MOD-27` (asistente de soporte in-app) pasa de 🟡 a entregado (S0+S1+bandeja mínima), sin
  commitear.** Migración `20260825114534_support_tickets_s0.sql` aplicada y verificada contra la
  base viva (RLS línea por línea, `seguridad:invariantes` sin críticos, smoke test de idempotencia).
  S1 (3 tools de solo lectura sobre `chatWithTools()`) también quedó cableado, no solo S0. Se agregó
  además una bandeja mínima para el `super_admin` en `/admin/support` — **no estaba en el plan
  original**: sin eso, un ticket escalado a `waiting_human` no tenía dónde ser visto por un humano,
  el riesgo que la propia spec (§8) marca como «peor que no tenerlo». Falta S2 completo (panel de
  diagnóstico embebido, notas internas desde la UI, push de ticket nuevo).
- **`MOD-25` pasa de ⚪ a entregado.** `llms.txt`/`llms-full.txt` ya vivían en la landing; hoy se
  sumó el tercer archivo que faltaba (`llms-faq.txt`, ~35 Q&A directas), se referenciaron las 6
  comparativas (antes solo citaba Clupik) y se corrigió el `robots.txt` con ~20 user-agents de IA
  explícitos (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).
- **La página de ataque de Controla.Club (fila sin ID, abajo del catálogo `MOD`) queda con
  corrección publicada, no solo documentada.** `/comparar/controla-club` (nuevo) tiene pricing
  verificado de ambos lados ($69k/50 vs $99k/50 real, no inferido), y `llms-full.txt` lleva una nota
  fechada explicando que planes como «Crecimiento» ya no existen — para que un LLM que lea ambas
  fuentes prefiera la nuestra por ser más reciente y explícita.
- Sitemap de la landing corregido: le faltaban 4 comparativas (QueFluya, Athleos, CuotaQ,
  AgendaPro) que ya existían en código pero nunca se habían agregado — nunca se estaban indexando.

**Cambios v2.6 → v2.7** (auditoría profunda de **Controla.Club** con fetch directo — no capturas —
contra su sitio, `sitemap.xml`, `/llms.txt` y Play Store, 2026-08-25 — ver
[`competitor-battlecard-controla-club.md`](competitor-battlecard-controla-club.md) y
[`sportmaps-strategic-roadmap.md` §2.1](sportmaps-strategic-roadmap.md#21-controlaclub--lectura-de-producto-2026-08-21-ampliada-y-verificada-2026-08-25)):
- **Tres ítems nuevos en el track `MOD`.** `MOD-24` (comunidad/red social — su «Social Controla» ya
  está en producción, el nuestro es idea sin fecha), `MOD-25` (publicar `/llms.txt` propio — GEO
  ejecutado de su lado, 1-2 días sin código de nuestro lado, entra directo a P1) y `MOD-26` (LMS —
  gap genuinamente nuevo, sin decisión de producto todavía).
- **Hallazgo que no es de producto: tienen una página de ataque directo contra SportMaps**
  (`controlaclub-vs-sportmaps`) con pricing mezclado — el plan Pro que nos atribuyen es exacto, el
  Start y un plan «Crecimiento» que ya no existe están mal, y nombran a nuestro CEO. No genera un ID
  de desarrollo: genera una corrección de percepción documentada en el battlecard §4-5.
- **`MOD-27` (asistente de soporte in-app) se reduce de alcance real:** verificado que Controli es
  un helpdesk conversacional, no un motor de reportes — la lectura de capturas del 21-ago lo
  sobrestimaba. Sigue siendo cierto que nuestra versión, una vez cableada, es más profunda.
- **Corrección de un reporte intermedio que había inflado dos hallazgos sin evidencia**: «bolsa de
  empleo deportivo» (no existe en ningún fetch) y expansión a «Ecuador y Centroamérica» (los países
  reales autodeclarados son Colombia/Panamá/Ecuador/Perú; Ecuador sí pero Centroamérica no, y son
  autodeclarados sin testimonios verificables). Queda como lección de método: verificar con fetch
  directo antes de escribir un hallazgo en el roadmap, no aceptar un resumen de búsqueda como fuente.

**Cambios v2.5 → v2.6** (lectura del competidor **Controla.Club** — capturas de su panel,
2026-08-21 — ver [`sportmaps-strategic-roadmap.md` §2.1](sportmaps-strategic-roadmap.md#21-controlaclub--lectura-de-producto-2026-08-21)):
- **`MOD-27` — el asistente de IA in-app no tenía ID en la cola, y es lo que menos falta construir
  de los tres.** El «Controli» de la competencia es exactamente lo que describe
  [`specs/soporte-in-app-chat-y-bot.md`](specs/soporte-in-app-chat-y-bot.md): LLM, orquestador y
  regla de cero alucinaciones **ya funcionan** (portados de WhatsApp), el plan de migración S0
  está escrito y **nunca entró a la cola de este archivo**. Entra directo a P1 — ver §3.
- **`MOD-22` — «beca» y «acuerdo de pago» como excepción de cobro no existen en el esquema.**
  Gap real, verificado por grep en `supabase/migrations`: cero resultados para `beca`/`scholarship`.
  Sin spec ni decisión de producto todavía (¿descuento %, monto fijo, o solo una etiqueta que
  saca al miembro de mora y reportes?) — nace ⚪.
- **`MOD-23` — sitio público del club con subdominio y plantillas.** Gap real, pero no arranca de
  cero: el patrón `<slug>.sportmaps.co` y los dominios propios de Enterprise
  (`CUSTOM_DOMAINS_SETUP.md`) ya resuelven la mitad de la infraestructura de dominios. Falta el
  generador de sitio en sí. Nace ⚪.
- **El «Directorio Deportivo» de la competencia no genera ítem.** Es literalmente la tesis del
  mapa vivo geolocalizado (`sportmaps-strategic-roadmap.md` §1) — ya es nuestra ventaja, no un
  hueco que cerrar.

**Cambios v2.6 → v2.7** (banco de horas — cierre de brechas encontradas al validar con datos
reales, 2026-08-27):
- **Hallazgo del mismo día:** las reservas "por plan" y "por instalaciones" (`session_bookings`,
  `facility_reservations`) no sabían que el banco de horas existe — movían `sessions_used` sin
  tocar el saldo real. Peor: con "Máx. sesiones" conviviendo como etiqueta, ese número **sí**
  actuaba como tope real en el sistema viejo. Corregido en los 6 puntos de entrada reales
  (`/:id/book`, `/athlete/book-session`, `/athlete/book-secondary` + sus 3 cancelaciones) — el
  primer intento solo cubrió el endpoint de staff, "Mis Inscripciones" usa uno distinto y quedó
  descubierto hasta la segunda pasada. Migración `20260827131341_hour_bank_link_bookings.sql`.
- **Reporte de ingresos/salidas por estudiante** (`GET /student-report/:enrollmentId`) + histórico
  de períodos mes a mes (`GET /hour-bank-periods/:enrollmentId`) — nuevo endpoint.
- **Reubicación a escala:** el listado plano de saldos en Control de Acceso no aguanta 50
  estudiantes y no era el lugar — se movió al perfil del estudiante en Estudiantes
  (`SchoolStudentsManagementPage.tsx`), con un badge compacto en la tabla/lista y un solo request
  para toda la escuela (no uno por fila). Control de Acceso se queda solo con la bandeja de
  `pending_review`, que sí es operativa.
- ⚠️ **Confirmado con el cliente el 27-ago:** además de Dreamers, `Sub-10 (Beginners)` en Academia
  Superior Bogotá quedó con banco de horas — una inscripción real de marzo-2026, no de prueba. Fue
  intencional (validación pedida por el dueño de esa escuela), no un descuido, pero **no está en
  el alcance original de `MOD-21`** (solo Dreamers) — dejarlo anotado para que quien retome esto
  sepa que ya no es una sola escuela.

**Cambios v2.5 → v2.6** (banco de horas por torniquete, entregado el 2026-08-21, fuera de la cola):
- **Nuevo ítem `MOD-21`** — banco de horas por torniquete para Dreamers Gymnastics. F1-F5 en
  `develop` (`b882f5dd`) con 4 migraciones aplicadas y verificadas en la base viva; F6 (frontend) va
  en el mismo commit pero **sin verificación visual**. Detalle completo en §1.4 y en el catálogo.
- **Quinto caso de «trabajo vivo que el tablero no refleja»**, después de `DIN-4`, Android, el ciclo
  diario de Informes y el tablero táctico de fútbol (v2.5). El patrón se repite: el spec nació y se
  construyó en la misma sesión, sin pasar por §4. Se marca ahora, como manda §0.
- **Sale a la luz un incidente aparte, ya cerrado, que tampoco estaba escrito:** el allowlist de IP
  global de ADMS (env var único en Render, compartido por todas las escuelas) bloqueó ~2 h los
  lectores reales de GYM RM y Dreamers el mismo día. Se resolvió con control por-dispositivo
  (`ip_check_mode`, migración `20260821112428` aplicada por otra sesión en paralelo — ver
  `docs/gotchas-tecnicos.md`) y quedó documentado en
  [`adms-ip-allowlist-per-device.md`](specs/adms-ip-allowlist-per-device.md). No se abre ítem nuevo
  para esto: es infraestructura de `MOD-8`/control de acceso, no un módulo de producto.

**Cambios v2.4 → v2.5** (análisis del tablero de planificación en Canva de **Independiente Santa Fe
U20B** — 105 diapositivas, 2026-08-19 — cruzado contra el esquema real del eje de entrenamiento):
- **Nuevo track `PER`** — periodización: microciclos, rótulos de día y carga de entrenamiento. No
  nace de una idea de producto: nace de un artefacto real, de un club real, que hoy se mantiene a
  mano en una herramienta de diseño. Spec en
  [`specs/periodizacion-microciclos-y-carga.md`](specs/periodizacion-microciclos-y-carga.md).
- **El tablero de Canva tiene tres errores que su formato no puede detectar** —índices MD mal
  contados (el martes rotulado «MD-3» con partido el miércoles), un día rotulado **«regenerativo»**
  con hipertrofia y 10 series de RSA a 40 m a 24 h de un partido oficial, y **dos partidos en 72 h**
  sin un día libre de por medio— y, de fondo, **ni un solo indicador numérico** en las 105
  diapositivas. Cada error se corrige con una regla de software, y esa correspondencia es la que
  ordena las fases del track. El módulo no es «Canva pero nuestro»: es el mismo tablero **que sabe
  sumar**.
- **`PER-0` es puerta dura y es el mismo trabajo que `MOD-8`.** El eje de entrenamiento está roto y
  no se había escrito acá: `training_plans` (el contenido) **no tiene `school_id`** —su RLS depende
  de un JOIN a `teams`— y `training_sessions` (cupo y reserva) **no está vinculada a ella**. Son dos
  tablas de nombre casi idéntico que modelan cosas distintas y no se conocen. El tablero táctico que
  se entregó hoy se colgó de la **segunda**. No se construye periodización encima de eso.
- **§1.3 registra el tablero táctico de fútbol, que se entregó hoy y no figuraba en ningún lado de
  este archivo.** `P0` y `P2` están en `develop` desde `f1f720d` con tres migraciones aplicadas. Es
  literalmente lo que denuncia la §4: **trabajo vivo que el tablero no refleja.** Cuarto caso
  después de `DIN-4`, Android y el ciclo diario de Informes.

**Cambios v2.3 → v2.4** (investigación de video del 2026-08-19, contra la documentación de Veo):
- **Nuevo track `VID`** — video de partidos: grabación, en vivo y clips. Nace de `CAR-7` pero es
  capacidad de plataforma, no trabajo de Carmel.
- **`CAR-7` se reescribe: su supuesto era falso por los dos lados.** No hay API pública de Veo
  Technologies (sus integraciones son acuerdos de partner) **y no hace falta**: Veo Live acepta
  destino **RTMP personalizado**, así que la cámara puede emitir directo a un ingest nuestro.
- **Trampa que queda escrita:** `developer.veo.co.uk` es *Video Enhanced Observation Ltd*, **otra
  empresa**. Tiene API documentada y no sirve para la cámara. Quien busque «Veo API» cae ahí.
- Tres decisiones nuevas en §5 — **D-IMAGEN**, **D-VIDEO-RET**, **D-VIDEO-PRECIO** — y un gate duro
  **`G-IMAGEN`** que bloquea `VID-2`: no se almacena video de menores sin consentimiento registrado.

**Cambios v2.2 → v2.3** (auditoría de frontend responsive y móvil del 2026-08-18, ejecutada **leyendo
los archivos del repo, el CSS compilado y el manifest Android fusionado**):
- **Track nuevo `MOV`** — móvil, responsive y app nativa. 12 ítems que salen de los 40 hallazgos de
  [`auditoria-frontend-responsive-movil-2026-08-18.md`](auditoria-frontend-responsive-movil-2026-08-18.md).
  No es un track de UI bonita: `MOV-4` es lo que **bloquea el white-label ya vendido** y `MOV-1`
  son nueve arreglos de una línea que hoy no están.
- **`BLQ-3` (Mobile) deja de decir «no arranca».** Android **ya está construido, firmado y subido a
  la prueba interna de Play** — `versionCode 2`, AAB en `android/app/build/outputs/`, App Links
  verificados, edge-to-edge de Android 16 resuelto en `MainActivity`. Pasó por fuera de la cola,
  igual que `DIN-4` (§1.2). Lo que queda de `BLQ-3` es N4 (offline) y flavors, no N1–N3.
- **`iOS` no existe como plataforma.** `frontend/ios/` no está en disco ni versionado, y
  `@capacitor/ios` está en `node_modules` sin estar declarado en `package.json`. Todo el iOS del
  producto es hoy la PWA en Safari → nueva decisión abierta **D-IOS**.
- **Tres piezas de código muerto que hacían creer que el responsive estaba cubierto**: `src/App.css`
  (241 líneas, **no importado**, incluye el parche de targets táctiles), `ui/responsive.tsx` (sin
  consumidores y con clases que el JIT no genera) y `components/Layout.tsx`. Es el mismo patrón que
  `INF-8`: **un gate que parecía verde apuntaba a la nada.**
- **`UX-1` gana un prerrequisito.** Las primitivas de layout no se pueden diseñar bien mientras
  `App.css` siga existiendo: define reglas de modal, grid y tabla con `!important` que quien lea el
  repo va a dar por vigentes.

**Añadido el 2026-08-19** (barrido de trabajos programados y del panel de super admin, medido **contra la base viva**):
- **`INF-11`** — el mantenimiento nocturno de sesiones tenía **dos dueños** corriendo el mismo minuto,
  y `mv_session_health` **no la lee nadie**. La mitad del BFF ya está corregida; la otra mitad borra
  objetos vivos y espera aprobación.
- **`ADM-6`** — el panel de super admin **sí existe**, y su tarjeta «Actividad Hoy / Sesiones activas»
  muestra un conteo de **pagos de 30 días**. La tarjeta «Sistema» está hardcodeada en verde.
- **`MOD-17`** — el ciclo diario del Informe Mensual (F5) ya corre, pero **recorre todas las escuelas**:
  el «piloto» que promete el comentario no existe.
- **`DIN-19`** — al inventariar `cron.job` no aparece agendado el autopay canónico. **Verificar.**
- **`MOD-10` re-medido**: `C-A` y la fase 1 de la UI de evolución **ya están entregadas**; lo que falta
  es el objetivo de negocio (pesos, normalización, benchmark) y el carril legacy de `/evaluations`.
- **Regla 9 nueva en §0**: un trabajo programado tiene un solo dueño, y la zona horaria se declara.

**Cambios v2.1 → v2.2** (barrido de seguridad del 2026-08-12, ejecutado **contra la base viva**):
- **Tres huecos nuevos en P0** — `SEG-8` (un padre puede auto-aprobar su comprobante), `SEG-9`
  (cuatro `/debug-logs` públicos), `SEG-10` (`anon` enumera tokens de link de pago y PII de staff).
  Los tres verificados ejecutando SQL como rol `anon`, no inferidos del repo.
- **Tres ítems nuevos en P1/P2** — `SEG-11` higiene del BFF, `SEG-12` observabilidad (Sentry **no
  está instalado** y la política de privacidad se lo promete al usuario), `SEG-13` secretos y MFA.
- **`SEG-3` se reclasifica y baja a P2.** Los 502 avisos del linter son ~96 % ruido: las `admin_*`
  sí validan por dentro. Lo explotable se extrajo a `SEG-8`.
- **`SEG-1` y `SEG-5` re-medidos** contra la base: el alcance de `SEG-1` encogió (8 funciones con
  `search_path` mutable, no ~35); el rate limit de `SEG-5` resultó más flojo (IP-only y en memoria).
- Lección que queda escrita en §2: **el linter cubre la capa de datos y no ve el BFF ni la infra**,
  y ahí estaba todo lo explotable.

**Cambios v2.0 → v2.1:**
- Nuevo track **`CONC`** — concurrencia e integridad. Doctrina en
  [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md) y regla 8 de §0.
- Nuevo track **`ERP`** — módulo Pendientes (CxC / CxP / Nómina) con libro mayor. Spec en
  [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md).
- **`MOD-5` (contabilidad fases 1–6) se disuelve**: era el mismo trabajo que `ERP-2..5`.
- **D-PD resuelta: partida doble completa desde el inicio.** Nueva §3 «Track Contable» con la
  secuencia única de todo lo que toca dinero.

**Reemplaza a:**
- `docs/archived/ROADMAP-v1.3-2026-05-12.md` — el maestro anterior. Sus **anexos A–F**
  (DDL canónico, RLS, endpoints BFF, firmas de RPCs, tests por etapa) siguen siendo la referencia
  de los bloques todavía sin construir y **no se duplican aquí**.
- La §7 «Plan de ejecución consolidado» de `docs/sportmaps-strategic-roadmap.md`. Ese documento
  sigue siendo la referencia de **tesis, mapa competitivo y track disruptivo D1–D4** — pero ya no
  ordena trabajo.

---

## 0. Cómo se lee y cómo se mantiene

### Estados

| Marca | Significado |
|---|---|
| ✅ | Entregado y verificado en `develop` |
| 🟢 | Spec cerrada + plan aprobado → se puede escribir código |
| 🟡 | Plan escrito, **pendiente de aprobación** (convención: nada de SQL antes) |
| 🔵 | Diseñado (spec o decisiones cerradas) pero sin plan de migraciones |
| ⚪ | Idea o decisión abierta |
| ⚠️ | Estado dudoso — el código y la documentación no coinciden, hay que verificar |

### Reglas que no cambian

1. **Full-stack por feature** — DB + RLS + RPCs + BFF + API + Frontend + Auditoría + QA. No migraciones sueltas.
2. **Plan antes de código en migraciones.** El plan se aprueba, después se escribe SQL.
3. **Migraciones inmutables.** Todo fix va en una migración nueva con timestamp posterior.
4. **Una rama por fase**, con revisión entre fases.
5. **Modo audit antes de enforce** en todo gating nuevo.
6. **Nunca mergear a `main`** por iniciativa propia.
7. **Athletes y parents nunca pagan.** El trial de 30 días es solo para roles de servicio.
8. **La integridad la garantiza el motor, no el código de aplicación.** Nada que consuma cupo, stock,
   inventario o dinero se protege con un botón deshabilitado ni con una validación previa en el BFF:
   eso baja la probabilidad, no cierra la ventana. Se protege con **índice único parcial**
   (exclusividad), **`SELECT … FOR UPDATE` sobre la fila padre** (capacidad y contadores),
   **advisory lock** por clave de negocio, **idempotencia** en toda mutación reintentable, y **una
   sola fuente de verdad**. Doctrina completa, con el inventario de dónde ya está aplicada y dónde
   falta, en [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md).
9. **Un trabajo programado tiene un solo dueño, y la zona horaria se declara.** Conviven dos planos de
   cron —`node-cron` en el BFF y `pg_cron` en la base— y **no comparten reloj**: `node-cron` acepta
   `{ timezone: 'America/Bogota' }`, mientras `pg_cron` se rige por `cron.timezone`, que acá está en
   **GMT** aunque la base entera esté en `America/Bogota` (verificado 2026-08-19: `now()` devuelve
   `-05` y el cron igual dispara en UTC). Por eso un job de la base se escribe **en UTC** y deja el
   equivalente COT en el comentario, y uno del BFF **siempre** declara `timezone` o corre en la zona
   del contenedor de Render. Colombia no tiene horario de verano, así que la conversión no se
   desfasa; en un país con DST este esquema se rompe dos veces al año. **Antes de agregar un job hay
   que verificar que la otra capa no lo esté corriendo ya** → `INF-11`.

### Mantenimiento

Al cerrar un ítem se actualiza **su fila aquí** en el mismo PR que lo entrega. Los specs no se
tocan para reflejar avance; ellos describen el destino, esta tabla describe dónde estamos.

---

## 1. Estado para producción

| Frente | Estado | Nota |
|---|---|---|
| **Notificaciones** | ✅ funcional | Push web y nativo funcionando. No decir que está roto |
| **Migraciones** | ✅ aplicadas y funcionales | El gate `migrations:check` corre en pre-commit y CI |
| **Ciclo de mes / cobros duplicados** | 🔍 en revisión → `DIN-1` | **Único bloqueante de producción.** Revisión hecha el 2026-08-01: de los tres hallazgos, **H1 y H2 ya estaban cerrados** por las migraciones del 24-jul (índices de adultos y no registrados creados; `open_month` puebla `period_*` y el cron delega en él). Lo que sigue abierto es la ventana intra-sentencia, que **ninguno** de los tres hallazgos describía |
| **Entitlements / activación de módulos** | 🟡 el bloqueo de trial ya opera | `DIN-4` **aplicado en producción el 2026-08-12**: 168 escuelas inhabilitadas, Dynasty y GYM RM exentas. Falta su mitad de RLS (`SEG-15`). `SEG-7` sigue abierto |
| **Fecha externa comprometida** | 🔴 **19-ago-2026** | Inicio de pruebas de **Club Carmel** (~800 deportistas, 8 disciplinas). Bloque `CAR`. Es la única fecha con un tercero del otro lado |
| **App nativa** | 🟡 Android publicado en prueba interna · iOS con bootstrap real, sin release | Android: AAB firmado `versionCode 2`, 7 plugins, App Links verificados, edge-to-edge de Android 16 resuelto. ⚠️ **El AAB de la prueba interna apunta a `bffdev.sportmaps.co`** — los tokens de los testers quedan en el BFF de dev y los pushes de prod/stg no les llegan. iOS: `frontend/ios/` **ya existe y está commiteado** (proyecto Xcode + CocoaPods + `GoogleService-Info.plist` real, verificado 2026-08-29) — lo que falta es 100% trámite externo (cuenta Apple Developer activándose, App Store Connect, integración Codemagic, grupo TestFlight), no código; `codemagic.yaml` documenta el workflow `ios-testflight` como "NO FUNCIONA TODAVÍA". La deuda de UI de lo publicado es el track `MOV` (`MOV-1..3` ya en `develop`) |
| **Responsive / móvil** | 🟡 estrategia correcta, ejecución con deuda | Mobile-first estricto y bien aplicado (cero prefijos `max-*`, adaptación por CSS y no por JS). Falla en tres frentes concretos: **safe areas** (4 archivos de 491 las usan, contra 15 cabeceras `sticky top-0`), **unidades de viewport** (113 `100vh` contra 9 `dvh`) y **targets táctiles** (nada en la escala base de `Button` llega a 44 pt). Y `MOV-4`: el verde de marca escrito a mano 127 veces **anula el white-label ya vendido** |
| **Seguridad** | 🟡 solo deuda de fondo, sin hallazgos explotables abiertos | **Reverificado con la LLAVE ANÓNIMA el 2026-08-17** (la pasada del 08-16 se dio por buena sin probarla así, y `SEG-14` resultó abierto de par en par): ~~`SEG-14`~~ **estaba ABIERTO — cerrado y verificado el 08-17**, `SEG-9` (cuatro `/debug-logs` públicos) y `SEG-10` (91 tokens de link de pago + 68 registros de staff a `anon`) **ya están cerrados**. ✅ **`SEG-8`** (41 funciones ejecutables por `anon`) verificado por catálogo el 29-ago. ✅ **`SEG-22`** (`bridge_heartbeats` sin RLS) y ✅ **`SEG-1`/`SEG-2`** (search_path, 2 de 3 extensiones, las 2 vistas públicas documentadas) aplicados y verificados el 2026-08-31 — migración `20260831095348`, sin commitear todavía. Queda de fondo: `SEG-18` (53 policies sin `WITH CHECK`, revisión manual), `SEG-7` (`v_school_entitlements` fail-open, sigue sin tocar), el toggle de contraseñas filtradas (dashboard, no SQL), y `pg_net` en `public` (aceptado, no relocatable sin riesgo) |

---

## 1.1 Lo entregado desde la v1.3 (12 may → 1 ago 2026)

Nada de esto estaba en el roadmap anterior. Es la razón por la que hacía falta reescribirlo.

| Módulo | Qué quedó en `develop` | Falta |
|---|---|---|
| **Comprobantes v2 + Glosas** | Fases 1–6 completas: extracción LLM + reglas con veredicto, auto-aprobación, ciclo de glosa, conciliación bancaria (`bank_statements`, `reconcile_statement`), pestaña Conciliación con parser CSV | Parser XLSX · aplicar mig F4 `20260718000001` |
| **Informe Mensual del Atleta** | F0 rótulos de padre (`20260731123145`) + F1 backend completo (tablas, RLS, RPCs de escritura) + API y envío en BFF + pantalla de generar/publicar/enviar + entrada de menú por rol | Fases posteriores del spec (PDF al vuelo, calendario de reparto) |
| **Notificaciones unificadas** | F0 + F1 + F-R: trigger → outbox → dispatcher BFF (web-push VAPID + FCM), push web y nativo **funcionando**, Modo Recepción kiosko | Go-live en producción · F2–F6 |
| **Control de acceso físico (ZKTeco ADMS)** | Implementado y corriendo en RMGYM: `zk_user_mappings`, `cmd_seq`, ACK + Stamp dinámico, dirección por `DEVICE_MAP` | Generalizar a otras escuelas · multi-marca (Fase H) |
| **Contabilidad** | Fase 0 + 0.1: `expenses`, `cash_ledger`, RLS, eje `owner_type`/`owner_id`, helper `can_manage_finances` | UI vendor/organizer · fases 1–6 |
| **Pagos** | Wompi checkout E2E validado en sandbox · motor de mora `apply_late_fees` · toggles de config cableados con `pg_cron` · KPIs de pago · `payments.parent_id` backfilled (`20260730000005`, `20260730194230`) | Ver cola P0 — sigue habiendo duplicación activa |
| **Onboarding Dynasty** | 396 invitaciones auditadas · fix de la 2ª inscripción activa (`20260730000000`) · cleanup de planes duplicados · reuso de invitaciones pendientes | Gate de revisión previa al envío (P1) |
| **QR de inscripción** | Flujo completo escuelas (`school_join_qr_codes` + RPCs) · match por documento | — |
| **Carnets digitales** | 5 fases del rediseño (auto-contraste, iniciales, emisión masiva con filtros, PDF por equipo CR80, reverso, enviar al acudiente) | ⚠️ Editor de plantillas · 4 funciones que aún referencian `programs` (legacy) |
| **Torneos por escuela** | Decisiones cerradas + primeras entregas (`feat(torneos)` ×9) | ⚠️ Verificar dónde quedó: inscripción vs bracket |
| **Métricas de rendimiento** | Esquema regularizado y versionado (`20260731154626`, `…160301`) | Complementos C-A…C-K · `higher_is_better`, pesos, normalización, benchmark |
| **Bajas de atleta** | Inactivar cancela inscripción y anula pending/overdue · RPC `set_school_athlete_status` · fix RLS de adultos inactivos (`20260730160000`) | — |
| **PWA** | Banner de instalación arreglado en Android · bucle de recarga del service worker resuelto | — |
| **WhatsApp** | WA1 + WA2 construidos y validados E2E con número de prueba Meta (LLM en Groq) | System User permanente (el token de prueba expira cada 2 h) |
| **Infra** | Ledger de migraciones + gate `migrations:check` en pre-commit y CI · OpenAPI del BFF (358 rutas) · Resend con batch de 100 + tabla `email_sends` | — |

---

## 1.2 Lo entregado del 12 al 15 de agosto

Se registra aparte porque **no estaba en la cola**: se hizo por urgencia comercial, no por
prioridad del tablero. Dejarlo escrito es lo que evita que `DIN-4` siga figurando como
«3–4 semanas sin empezar» cuando ya opera en producción.

| Qué | Estado | Falta |
|---|---|---|
| **Bloqueo de fin de prueba (`DIN-4`)** | ✅ **aplicado en producción**. `schools.account_type` (real/test/demo) · `school_is_operational()` como fuente única · `expire_trials()` + cron diario · trigger de registro a 1 mes calendario · vista con `is_operational`/`blocking_exempt`/`has_subscription_row` · 7 RPCs de super admin · middleware `requireOperationalSchool` (402 solo en mutaciones) · `TrialStatusBanner` en el layout · bloque de periodo de prueba en el panel. **168 escuelas inhabilitadas**, Dynasty y GYM RM exentas | Su mitad de RLS → `SEG-15` |
| **Regla del periodo de prueba** | ✅ Se cuenta desde `schools.created_at`. Parque actual: 2 meses; registro nuevo: 1 mes | — |
| **Entidades informativas fuera del trial** | ✅ Las 151 «escuelas sin suscripción» eran federaciones/institutos/asociaciones. `is_informational_entity()` las exime, y el trigger de signup dejó de intentar suscribirlas — antes, crear una federación tumbaba el `INSERT` entero | — |
| **Mapeo `school_type` → módulos** | ✅ `has_academy` cubría solo `academy`/`hybrid`, dejando en **false a 247 escuelas** que sí operan como escuela (83 clubes, 11 entrenadores personales — 5 con atletas activos) | Cablear el menú a estos flags → `CAR-3` |
| **Separación real / pruebas** | ✅ **38 escuelas marcadas `test`**, 4 conservadas como `demo` curadas. `test` y `demo` ya estaban exentas del bloqueo: el cambio separa lo que se conserva de lo que se puede borrar | Borrado de las 22 vacías → `INF-6` |
| **Motor de demos por deporte** | 🟡 `scripts/demo/` — un motor y un catálogo por tenant (voleibol, fútbol, patinaje, crossfit, box + club campestre). Cada uno siembra sedes, categorías, tarifas, staff, familias, cartera con mora, asistencia, reservas, control de acceso y torneo. **Validado en `--dry-run`, sin sembrar** | Decidir si se siembran (54 cuentas, ~650 cobros) |
| **Informe Mensual del Atleta — F5 (ciclo diario)** | ✅ En `develop` (`6896b1b` + `3851316`, 14-ago). Tres RPCs `_system` (`generate_report_drafts_system`, `publish_athlete_report_system`, `publish_team_reports_system`): copias de las humanas **sin el chequeo de `auth.uid()`**, porque bajo `service_role` el cron no pasaría `can_manage_reports()` y rechazaría con `42501` en cada escuela; la puerta es el `GRANT` a `service_role`, no un check interno. El job `athlete-reports.job.ts` corre a las **06:10 COT**: genera borradores → publica lo vencido → envía correo y notificación. Verificado aplicado en la base el 19-ago.<br>⚠️ **Dos cosas que este ítem deja escritas**: el SQL viajó en el commit rotulado «fútbol/logos» y el job en el otro, así que revertir uno solo deja al otro colgando; y la migración está en el archivo como `20260814173709` pero en `schema_migrations` como `20260814174142` — **evidencia fresca de `INF-7`** | Filtro de escuela piloto y recordatorios → `MOD-17` |

---

## 1.3 Lo entregado el 19 de agosto (fuera de la cola)

| Qué | Estado | Falta |
|---|---|---|
| **Tablero táctico de fútbol — `P0` + `P2`** | ✅ En `develop` (`f1f720d`). Formación **libre** por drag-and-drop (`@dnd-kit`) sobre `match_lineup_players` con `slot_label` + `x`/`y` normalizados 0–100, `match_lineups.source_type` ampliado a `training_session`, plantillas tácticas guardadas por situación (ataque / defensa / balón parado) y **modo pizarra** con flechas, curvas y zonas sobre la cancha. `TacticalBoard.tsx` (1.426 líneas) + 252 líneas nuevas en `bff/src/routes/school/football.ts`. Tres migraciones: `20260819142728/29/30`. **Extendió las tablas existentes en vez de crear `tactical_sessions`** como proponía el spec — decisión tomada y justificada en el plan de `P0` (la RLS de `match_lineups` ya estaba probada). `PlayerCard.tsx` adelanta parte de `P1` | `P1` completo (tarjetas sobre `performance_entries`) · `P3` (extensión a entrenamientos) → **absorbido por `PER-6`** · `P4` (sugerencias) · ⚠️ **probar el drag-and-drop en el APK real**, no solo en el navegador — es el R1 del propio spec y toca justo lo que falla distinto en un WebView de Capacitor |

> **Por qué está acá y no en la cola:** el spec de fútbol se aprobó y se construyó el mismo día, sin
> pasar por la §4. Es el cuarto caso después de `DIN-4`, Android y el ciclo diario de Informes — y es
> exactamente el síntoma que la §4 se corrige a sí misma. **Lo que se entrega se marca el mismo día**
> (§0). Se marca ahora.

---

## 1.4 Lo entregado el 21 de agosto (fuera de la cola)

| Qué | Estado | Falta |
|---|---|---|
| **Banco de horas por torniquete — Dreamers Gymnastics (`MOD-21`)** | ✅ En `develop` (`b882f5dd`). El plan de Dreamers pasa de contar clases a contar minutos: banco mensual, la reserva es techo de validación (no descuenta en firme), el torniquete manda en el consumo real. 4 migraciones aplicadas y **verificadas contra la base viva** (no solo commiteadas — `to_regclass`, `pg_proc`, `seguridad:invariantes` sin violaciones nuevas): esquema (`hour_bank_periods/visits/visit_segments`), RPC atómica `move_hour_bank` (`FOR UPDATE`, bloquea sobregiro de reserva, nunca bloquea consumo real), auto-cierre `auto_close_stale_hour_bank_visits` (`FOR UPDATE SKIP LOCKED`, no factura — solo el owner corrige y recién ahí se descuenta), y `hour_bank_reservations` (tabla propia, **no** `session_bookings` — la reserva es flexible sin franja horaria y `session_bookings` exige horario fijo). `access-adms.ts` trackea la visita real **independiente de `access_granted`** (el F22 decide el acceso físico, no el BFF). Cada RPC se probó con asserts dentro de un `BEGIN...ROLLBACK` antes de aplicar, nunca a ciegas. | **F6 (frontend) sin verificación visual** — no hay `.claude/launch.json`, no se armó sesión autenticada real. `hours_plan_enabled` sigue en `false` en Dreamers (probado con datos de prueba en un plan aparte, sin tocar inscripciones reales) — activarlo de verdad espera a que la escuela confirme hora de cierre y minutos de gracia (D-14, provisional). Prueba física en curso: los dos lectores de Dreamers dejaron de reportar heartbeat a media tarde tras detener el bridge local — IP fija y config del dispositivo ya descartadas, diagnóstico abierto. |

> **Por qué está acá y no en la cola:** empezó como una sesión de soporte (validar una IP bloqueada
> del torniquete) y terminó siendo un módulo completo — spec, decisiones de producto con la escuela,
> 4 migraciones y 6 fases, todo en la misma sesión, sin pasar por la §4. Es el quinto caso después de
> `DIN-4`, Android, el ciclo diario de Informes y el tablero táctico de fútbol. **Lo que se entrega se
> marca el mismo día** (§0). Se marca ahora.

---

## 1.5 Lo entregado el 27 de agosto (fuera de la cola)

| Qué | Estado | Falta |
|---|---|---|
| **Banco de horas — cierre de brechas al validar con datos reales (`MOD-21`)** | ✅ En `develop`. **(a)** Las reservas "por plan" y "por instalaciones" no sabían que el banco de horas existe — corregido en los 6 puntos de entrada reales, migración `20260827131341_hour_bank_link_bookings.sql`. Encontrado en dos pasadas: la primera solo cubrió el endpoint de staff (`/:id/book`), "Mis Inscripciones" usa uno distinto (`/athlete/book-session`) que quedó descubierto hasta que se probó con datos reales. **(b)** Reporte de ingresos/salidas por estudiante + histórico de períodos mes a mes — dos endpoints nuevos. **(c)** Reubicación: el listado plano de saldos no aguanta 50 estudiantes — se sacó de Control de Acceso (queda solo la bandeja `pending_review`, que sí es operativa) y se movió al perfil del estudiante en Estudiantes, con un badge compacto en la tabla. **(d)** ⚠️ Al probar con el cliente se confirmó que **ya no es "solo Dreamers"**: Academia Superior Bogotá también tiene `hours_plan_enabled=true`, con una inscripción real de marzo-2026 (`Sub-10 (Beginners)`) convertida a banco de horas — intencional, confirmado con el dueño de esa escuela el mismo día, no un descuido. | Nada bloqueante — el hallazgo (d) es una nota de alcance, no un pendiente técnico. |

> **Por qué está acá y no en la cola:** siguió a `MOD-21` del 21-ago — validar con datos reales
> (no simulados) sacó a la luz dos brechas de integración que la revisión de código sola no había
> visto. Mismo patrón que el resto de esta sección: se entrega y se marca el mismo día.

---

## 1.6 Lo entregado el 25 de agosto (tarde)

Igual que §1.2 y §1.3: entregado el mismo día en que se detectó la oportunidad (auditoría de
Controla.Club, ver §2.1 de `sportmaps-strategic-roadmap.md`), sin pasar primero por la cola de §4.

| Qué | Estado | Falta |
|---|---|---|
| **`MOD-27` S0 — canal de soporte real** | ✅ código, ⚠️ sin commitear | Migración `20260825114534_support_tickets_s0.sql` aplicada a la base viva: `support_tickets` + `support_messages`, RLS revisada línea por línea (`is_support_agent()` por rol, nunca por UUID — mismo escape hatch que ya obligó a `requireSuperAdminStrict` en F0), RPCs `support_open_ticket`/`support_post_message` con idempotencia (índice único parcial) y `FOR UPDATE` contra la carrera de doble mensaje. `npm run seguridad:invariantes` sin críticos. Smoke test de idempotencia corrido contra la BD real. |
| **`MOD-27` S1 — el bot, no solo la spec** | ✅ código, ⚠️ sin commitear | `bff/src/services/inapp-support-bot.service.ts` reusa `chatWithTools()` (mismo LLM/orquestador de WhatsApp, Groq/Gemini/DeepSeek) con las 3 tools de solo lectura del spec: `get_my_state` (→ `buildUserState(scope:'self')`), `get_payment_status` (→ reusa `wa_get_payment_status`), `search_help_articles` (corpus portado a `bff/src/data/help-articles.ts`) + `escalate_to_human`. Se calla solo si ya hay un mensaje de agente en el hilo — no le pisa la conversación a un humano. Responde sincrónico en la misma request de `POST /api/v1/support/messages`. |
| **Bandeja del `super_admin` con S2 completo** | ✅ código, ⚠️ sin commitear | `/admin/support` (frontend) + `GET /api/v1/admin/support/tickets` y `.../:id/messages` (BFF). **Panel de diagnóstico embebido** (`TicketDiagnosisPanel.tsx`, reusa `GET /admin/support/user-state?userId=` de F0, ya no hace falta el correo a mano) visible en la misma pantalla del hilo. **Notas internas** desde la UI (checkbox, la RPC ya las soportaba, faltaba el botón). **Push al `super_admin`** en el primer mensaje de cada ticket, reusando el Despachador Unificado — migración chica aparte (`20260825124513`) para sumar `'support'` al `CHECK` de `notifications.category`, que antes solo aceptaba 9 valores fijos. Enruta por ROL (`role='super_admin'`), nunca por UUID hardcodeado. |
| **GEO propio de la landing (`MOD-25`)** | ✅ | `llms-faq.txt` nuevo (~35 Q&A directas — el tercer archivo que le faltaba frente a Controla.Club, que publica los tres). `llms.txt`/`llms-full.txt` ahora referencian las 6 comparativas (`clupik`, `quefluya`, `athleos`, `cuotaq`, `agendapro`, `controla-club` — antes solo citaban Clupik). `robots.txt` con ~20 user-agents de IA explícitos (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Meta-ExternalAgent, Bytespider, CCBot…). Sitemap corregido: le faltaban 4 comparativas que ya existían en código y nunca se habían indexado. |
| **`/comparar/controla-club` — nueva, con pricing verificado de ambos lados** | ✅ | No «no publica precios»: se verificó su plan de entrada ($99.000 COP/mes, ≤50 miembros) contra su propio `llms-full.txt`, dato público. Para la misma capacidad, SportMaps ($69.000/50) cuesta ~30% menos al año — pero la comparativa es honesta en los gaps reales (gamificación `ClubPoints`, comunidad `Social Controla`, LMS, prospección de leads con IA: ninguna existe en SportMaps hoy). |
| **Corrección de percepción publicada, no solo documentada** | ✅ | `llms-full.txt` lleva una nota fechada (2026-08-25) explicando que su artículo de ataque cita un plan «Crecimiento» que ya no existe en el pricing vigente — para que un LLM que lea ambas fuentes prefiera la nuestra por ser más reciente y explícita. El battlecard (`competitor-battlecard-controla-club.md`) sigue siendo la referencia interna para conversaciones de venta. |
| **Mapa competitivo ampliado — 3 comparativas nuevas verificadas** | ✅ | Investigación de 14 competidores adicionales (dos pasadas independientes de investigación, mismos hallazgos): **SportMember, 360Player, Jonas Club Software, Upper Hand, PlayMetrics, director11, Sphaira Tech, SoluSoftDeportiva y Colixeum descartados** — otro mercado (EE.UU./Europa/golf enterprise) o sin evidencia de operación en Colombia. **GOLAPP** (colombiano, Medellín, pricing público en COP, sin DIAN ni WhatsApp AI confirmados), **DeporteApp** (LatAm-wide con cliente colombiano nombrado, sin precios públicos, con `llms.txt` propio — el más sofisticado en GEO de los investigados) y **Driblin** (Venezuela+Colombia, ángulo de scouting/monetización de club, no cobranza recurrente) sí son competencia real: `/comparar/golapp`, `/comparar/deporteapp`, `/comparar/driblin` publicadas con el mismo estándar de honestidad. |

---

## 2. Catálogo de pendientes

IDs estables. La cola de la §3 los ordena; esta sección los describe.

### DIN — Dinero y cobros

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **DIN-1** | ⚠️ **Orden corregido por el §11 del plan: los productores se cierran ANTES de limpiar** (B1 guard → B2 `students.ts:829` → M1 con `ON CONFLICT DO NOTHING` → recién entonces M3/huérfanas/M2). Limpiar con los tres productores abiertos es trapear con la llave abierta. Dos hallazgos más del §11: **el cron falla peor que el botón** — desde que delega en `open_month`, el `23505` queda atrapado en su `EXCEPTION WHEN OTHERS`, así que **salta la escuela en silencio y reporta éxito global** (cualquier alerta tiene que mirar el `WARNING`, no el valor de retorno); y **`SOLO MILLOS` es la única escuela expuesta** a ese fallo silencioso, porque es la única con duplicados **y** `auto_generate_payments = true`. Agosto de Dynasty ya está generado y sano (345 `pending` para 345 menores, 1:1), así que **no hay presión de calendario**. ⚠️ **Esa última frase quedó desmentida el 2026-08-12:** el 1:1 se cumple **por cobro** pero no **por persona** — 4 cobros de agosto vivían en la ficha gemela de alguien que ya había pagado, 5 nacieron vencidos y una atleta quedó cobrada dos veces. El conteo era correcto; contaba cobros y el problema estaba en las personas. Ya corregido en datos ([SQL](../scripts/dynasty-corregir-cobros-2026-08-12.sql)), pero el productor sigue abierto en todas las escuelas. **Generación de mes y cobros duplicados (F0) — plan consolidado.** Cubre lo que sigue abierto de las inscripciones duplicadas y de la generación unificada, ahora que se verificó qué cerró el 24-jul: la ventana **intra-sentencia** de `open_month` (el advisory lock no la cubre; hoy el síntoma es que la apertura de mes **aborta** para toda la escuela), el guard que falta en `POST /enrollments`, el `UPDATE` de `students.ts:829` que fabrica huérfanas, el `CHECK` de inscripción con destino, el merge de las 198 filas duplicadas y las 16 huérfanas que hay que **asignar** (~$2.21M/mes). | 🟡 | 1–2 sem | **[plan consolidado](plan-f0-generacion-de-mes-y-cobros-duplicados.md)** · evidencia en [plan-f0 original](plan-f0-inscripciones-y-cobros-duplicados.md) §2 y §7 |
| ~~DIN-2~~ | **Absorbido por DIN-1.** Verificado contra el código el 2026-08-01: **H1 cerrado** (los tres índices únicos existen, incluidos adultos y no registrados) y **H2 cerrado** (`open_month` puebla `period_*` siempre y el cron delega en él desde el 24-jul). La unificación de las 3 vías del §4.4 también está hecha: el botón llama `preview_open_month`/`open_month` y `calcFirstPayment` quedó confinado a los modales de alta. Queda **H3** (declarativo, sin código) dentro de DIN-1. | ✅ | — | [spec month-close §4](specs/month-close-module.md) |
| DIN-3 | **`payments.payment_provider` deja de mentir.** Se creó con `DEFAULT 'wompi'`, así que toda fila insertada sin provider queda sellada como Wompi y la reconciliación cuenta mal. | 🟡 | 4 h | [plan](plan-payment-provider-default-fix.md) |
| **DIN-4** | **Bloqueo de fin de prueba, entitlements y cuentas de prueba.** ✅ **Aplicado en producción el 2026-08-12** — ver §1.2. La estimación vieja («3–4 semanas, 7 fases») ya no aplica: se entregó en dos días porque el alcance real era menor que la spec. Queda vivo un solo pedazo: **RLS no aplica el bloqueo**, y el navegador escribe directo a Supabase en 52 sitios más los RPC → se extrajo a `SEG-15`. El defecto del panel que «miente» (D11) se resolvió releyendo la BD tras cada cambio. | ✅ salvo `SEG-15` | — | [entrega](periodo-de-prueba-aviso-y-bloqueo-2026-08-12.md) · [spec](specs/trial-blocking-and-test-accounts.md) |
| DIN-5 | **Duplicación de pagos — H-03, H-04, H-05, H-07.** Los hallazgos H-01 (autopay legacy), H-02 (doble clic) y H-06 (`record_recurring_attempt`) ya están arreglados; estos cuatro siguen abiertos. | 🔵 | 2–3 d | memoria `project_payment_duplication_audit` |
| DIN-6 | **Connected accounts — cerrar Fase 0 (F-B, F-C, F-F).** Re-auditado el 2026-08-01: **la fase está al ~85 %, no al ~70 %**, y los dos docs de connected-accounts **subestiman el avance**. Ya están hechos el `wompi.service` parametrizado, el escritor cifrado (`upsert_school_provider`) y la firma del Widget por escuela. Lo que falta: **cablear el gate por addon** (`hasGatewayAddon()` está definido y **no se invoca desde ninguna ruta** — es código muerto), **crear el endpoint de switch de `payment_mode`** (hoy solo se cambia por SQL a mano), **validar las llaves contra la API del proveedor**, migrar Dynasty de ENV a `direct` en orden estricto, y los webhooks multi-tenant. | 🟡 | 2–3 sem | **[plan de cierre de ruteo](plan-cierre-ruteo-de-pagos.md)** · [plan original](payments-connected-accounts-plan.md) · [status ⚠️ desactualizado](payments-connected-accounts-STATUS.md) |
| **DIN-9** | 🔴 **Higiene de ambientes — el footgun de MercadoPago.** `MP_ACCESS_TOKEN_DEFAULT` y `MP_PUBLIC_KEY_DEFAULT` de **dev** tienen prefijo `APP_USR-`, que en MP es **producción**. `MP_ENV=sandbox` no corrige nada: `mercadopago.service.ts:29` tiene **una sola URL** y MP no tiene host de sandbox — la credencial decide. Con `MARKETPLACE_DEFAULT_PROVIDER=mercadopago`, **un pago «de prueba» desde dev cobra de verdad.** Fix: credenciales `TEST-` en dev + guard de arranque que haga **fail-fast** si el prefijo de la credencial no coincide con el `*_ENV`, y derivar `sandbox` del prefijo en vez de la variable. Sin migración, sin tocar producción, una sesión. | 🟡 | 1 sesión | [plan §F-A](plan-cierre-ruteo-de-pagos.md) |
| **DIN-10** | 🟡 **Dinero de terceros ya recibido.** Los cobros de Academia Porras y MMA Blair (mayo) entraron a la cuenta de MercadoPago **de SportMaps** vía `MP_ACCESS_TOKEN_DEFAULT`. Es exactamente el riesgo regulatorio —captación irregular ante la SFC— que el modelo directo-a-escuela existe para evitar. Incluye parametrizar el camino MP como ya está el de Wompi. **La decisión sobre el dinero ya recibido es de negocio (D2), no técnica.** | ⚪ | 1 sem + decisión | [plan §F-E](plan-cierre-ruteo-de-pagos.md) |
| DIN-7 | **Autopay en Wompi.** Bloqueado por falta de API `payment_sources`; hay que pedirla aparte en el contrato de Pagos a Terceros. Solo MP funciona hoy. | ⚪ | externo | memoria `project_wompi_commercial_status` |
| DIN-8 | **Facturación electrónica multi-PAC.** Capa de adaptadores DIAN (Factus primero, luego Siigo/Alegra). API sandbox de Factus ya validada. Tablas `invoice_providers` + `invoices`. **No depende del libro mayor**: el PAC emite la factura, no pide el mayor — no se bloquean entre sí en ningún sentido. | 🔵 | 5 fases | memoria `project_electronic_invoicing` |
| ~~DIN-11~~ | ✅ **Un cobro nuevo ya no nace vencido.** `billingDue` acotaba el vencimiento al día del **alta**, no al de **hoy**: si el plan se asignaba un mes después, el cobro entraba al mundo en mora, con recargo y recordatorio de deuda por algo que ayer no existía. Medidos **20 en la plataforma** (5 en Dynasty, uno con 31 días). El piso ahora es `hoy + payment_grace_days`, la MISMA regla que ya usaba el flujo QR (`qr_first_charge_due_date`) — antes había dos criterios según la vía de alta. Solo reemplaza si la fecha calculada ya pasó, para no mover los vencimientos correctos. Sin migración. ⚠️ **Commiteado, SIN DESPLEGAR: no protege a nadie hasta que el BFF suba a Render, y conviene antes de la próxima apertura de mes.** | ✅ código · ⚠️ sin deploy | hecho | `30d5a36` · eje D de [audit-cobros-duplicados](../scripts/audit-cobros-duplicados.mjs) |
| ~~DIN-12~~ | ✅ **El recordatorio ya no le reclama a quien pagó, y el correo funciona.** Dynasty reportó familias al día recibiendo «tienes un pago pendiente»: eran cobros duplicados en la ficha **gemela** de la misma persona. Guard en `generateReminders` (la fuente única de la lista, así que cubre todas las vías de envío): excluye lo cierto, marca y bloquea lo probable. El cruce de nombres es por **subconjunto de tokens** — con comparación exacta se escapaba 1 de 3 casos («Gabriela Núñez» vs «Gabriela nuñez osorio»). Y tres fallos del correo: la ruta **`/payments` no existía** (es `/my-payments`, el botón «Realizar Pago» no llevaba a ningún lado → el padre se registraba otra vez → más duplicados); **éxito falso** (sin `RESEND_API_KEY` devolvía `success:true` con HTTP 200 y la UI decía «enviado»); y el «Concepto» mostraba el nombre del **equipo**. Verificado: en Dynasty los correos indebidos pasaron de **3 a 0**. ⚠️ **Sin desplegar** — necesita frontend y `supabase functions deploy send-email`. | ✅ código · ⚠️ sin deploy | hecho | `498fa40` |
| **DIN-13** | 🔴 **Un solo registro por atleta (F3) — la causa raíz de los duplicados.** El acudiente se registra por su cuenta en vez de aceptar la invitación y crea una **segunda ficha** del mismo atleta: ambas facturables. **41 dobles facturables en la plataforma**, 13 en Dynasty ($1.770.000/mes). ⚠️ **Buena parte ya está construida** —`normalize_doc_number`, `find_athletes_by_document`, `claim_children_by_document`, `claim_orphan_children`, y `validate_doc_for_plan_join` + `claim_member_for_plan` que son el flujo completo— así que F3 **no es construir un matcher**: es cerrar la única puerta sin chequeo (`AddChildDialog` hace `INSERT INTO children` crudo) y dejar de depender de que el acudiente llegue al dashboard. Medido: **9 de 13 pares tienen correos de acudiente distintos** (el correo no sirve), **11 de 13 comparten fecha de nacimiento** (la señal fuerte), y los documentos difieren en 1–2 dígitos. Bloqueado por **D-DUP** y **D-DOC**. | 🔵 | 4 fases | **[plan F3](plan-f3-un-solo-registro-por-atleta.md)** |
| **DIN-14** | 🟡 **El registro manual de pagos rotula el mes equivocado.** De **13 rótulos malos en Dynasty, 13 fueron manuales y 0 por pasarela**: cuando la fecha la pone el proveedor el mes sale bien siempre. El origen no fue la escuela eligiendo: 10 de 13 traen concepto `Plan PLAN X`, que produce `emitPlanCharge` con el periodo de la inscripción **vieja**. Consecuencia medida: agosto sin facturar y cobros que la familia ve como deuda vieja. Ya corregido en datos para Dynasty; falta el fix de captura. | 🔵 | 2–3 d | [audit-periodo-vs-fecha-pago](../scripts/audit-periodo-vs-fecha-pago.mjs) · [SQL aplicado](../scripts/dynasty-rerotular-periodos-2026-08-12.sql) |
| **DIN-15** | 🟡 **Higiene de invitaciones.** Tres cosas: **(a)** `accept_invitation_pro` hace `SET offering_plan_id` **sin tocar `monthly_fee`**, así que puede dejar plan y cuota discrepando — medido, solo 4 de 409 y tres parecen deliberados, **pero se vuelve peligroso cuando `monthly_fee` viene NULL** porque entonces cae al precio del plan y sí mueve la plata; **(b)** **255 de 444** invitaciones de Dynasty no llevan plan ni configuran facturación, y 10 no llevan ni equipo ni plan; **(c)** 4 combinaciones de mismo correo + mismo atleta repetidas, una con `child_name` NULL. Verificado que **ninguna de las 263 `pending` cambiaría el plan al aceptarse**, así que no hay bomba armada: es riesgo latente. El 59% sin aceptar **no es reenvío, es falta de adopción** (195 correos sin perfil). | 🔵 | 2–3 d | barrido 2026-08-12 |
| **DIN-16** | 🔵 **Fusionar las identidades ya duplicadas.** **$1.770.000/mes** solo en Dynasty: 13 personas con 2–3 fichas, cada una facturable. Cancelar el cobro no alcanza — hay que trasladar equipo, cuota y pagos a la que sobrevive, vincular la absorbida y cancelar su inscripción. Incluye el patrón **child + adult** (Darwin Hernandez nació en 1972 y su documento es una cédula: atleta adulto cargado como menor; igual Oscar Baquero y Esteban Herrera). El plan existe y **estaba fuera de la cola**. Distinto de `DIN-13`, que evita las próximas. | 🔵 | 1 sem | [plan de fusión](plan-fusion-identidades-duplicadas.md) · [pendientes Dynasty](dynasty-pendientes-2026-08-12.md) |
| **DIN-17** | 🔵 **Multimes / prepago de mensualidades.** No existe en ninguno de los 62 documentos: hoy se resuelve a mano. La escuela crea el cobro del mes siguiente **después** de recibir la plata (Violeta del Campo: cobro de octubre creado el 4-ago con `payment_date` del 3-ago). El veredicto de comprobantes compara contra **un solo** cobro con **tolerancia 0**, así que pagar dos meses siempre cae en `MONTO_DIFIERE` → revisión manual. Diseño propuesto: `payment_receipts` (la transacción) + `payment_allocations` (cómo se reparte) por encima de `payments`, que sigue siendo un cobro por mes — es lo único que hoy impide duplicados. Bloqueado por 4 decisiones de producto (descuento, cuántos meses adelante, baja con meses prepagados, saldo a favor). | 🔵 | spec + 5 fases | barrido 2026-08-12 |
| **DIN-18** | 🟡 **73 documentos inválidos de 788.** 50 fichas con documento de **5 dígitos** y 23 con **11 a 15**. Además 59 sin documento (29 en `Club Campestre Demo`). Sin validación de formato al capturar, cualquier matcher por documento falla o empareja mal en esas 73 — por eso **D-DOC y la validación de formato son la misma decisión**. Incluye una colisión que hay que limpiar antes del índice único de `DIN-13` F3.3: **SPIRIT ALL STARS, doc `1016092607` en dos fichas** (Sara Sánchez / Silvana Sánchez — le digitaron el de la hermana a una de las dos). | 🔵 | 1–2 d | barrido 2026-08-12 |
| **DIN-19** | ⚠️ **El autopay canónico no aparece agendado — verificar antes de actuar.** Al inventariar `cron.job` el 2026-08-19 hay **9 jobs y ninguno llama a `/api/v1/recurring/run`**; los ids 6-9, 11, 13, 15 y 16 están borrados, así que alguna vez hubo más. Lo que sí corre a las 02:00 COT es el autopay **legacy** sobre la tabla `subscriptions` (`maintenance.job.ts`, apagable con `DISABLE_LEGACY_SUBSCRIPTION_AUTOPAY`) — el que la auditoría `H-01` quería jubilar. Si se confirma, los cobros recurrentes de `recurring_subscriptions` **no están saliendo solos** y alguien los está corriendo a mano o no se están cobrando. **No es un hallazgo cerrado:** puede estar disparándose por otra vía (un scheduler externo, un endpoint llamado por otro servicio). Primero verificar; después reagendar y decidir qué pasa con el legacy, que es la otra mitad de `H-01`. | ⚠️ | verificar | inventario de `cron.job` 2026-08-19 |
| **DIN-21** | ⚪ **Decisión de arquitectura sin tomar: `enrollments` mezcla pertenencia y período comercial — causa raíz de `DIN-13`/`DIN-16` y de la vigencia mal calculada.** Dos specs de agosto lo diagnostican con evidencia dura y proponen separar una tabla `periodo_de_plan` (comercial + consumo) de la pertenencia del atleta: renovar o cambiar de plan hoy obliga a crear otra inscripción. **Ninguno de los dos está aprobado — «propuesta, pendiente de aprobación», sin SQL escrito, la tabla `periodo_de_plan` no existe** (verificado en vivo el 2026-08-29). El síntoma sigue midiéndose ahora mismo: **14 atletas con más de una inscripción `active` simultánea** en la plataforma. Mientras no se decida, cada bug de vigencia/duplicado se sigue parchando por separado vía `DIN-13`/`DIN-16`/`DIN-20` en vez de resolverse de raíz — el propio doc lo dice: «ninguno se va a quedar arreglado mientras el modelo obligue a duplicar». Encontrado en auditoría de Frente B (planes/tarifas a atletas): estos dos docs no estaban enlazados desde acá. | ⚪ | decisión de producto, luego spec+fases | [vigencia por período](plan-vigencia-por-periodo-pagado.md) · [inscripción vs período](specs/inscripcion-vs-periodo-de-plan.md) |
| **DIN-22** | 🟡 **C-12 F1 (tarifa congelada, visibilidad) — parcial.** Indicador «el plan hoy vale $Y» + contador «N de M en tarifa anterior», en `PaymentsAutomationPage.tsx` pestaña «Equipos y Planes», sin migración (reusa `e.plan?.price` que esa pantalla ya traía). **No cubre** la ficha individual del atleta ni ningún otro roster, y falta correr el gate F1 (número de la UI vs `C-12a` de `scripts/math-consistency-checks.sql`, misma escuela). F2 (botón «aplicar precio actual», con migración) sigue sin arrancar — su prerrequisito de datos (`fee_is_manual`) ya está resuelto por `MOD-22`. | 🟡 | resto de F1 + F2 | [plan C-12](plan-tarifa-congelada-c12.md) |
| **DIN-20** | ✅ **Carrera entre el cron de vencimiento y la extensión al pagar — cerrada el 2026-08-27, detectada en GYM RM.** `fn_expire_overdue_enrollments()` (pg_cron diario, 8am UTC, sin migración) cancela cualquier `enrollments.status='active'` con `expires_at` vencido. `fn_extend_enrollment_on_payment_paid()` (trigger del 2026-07-17, el caso que la motivó fue también GYM RM) debía evitar justo eso empujando `expires_at` cada vez que un pago pasa a `'paid'` — pero solo sabía extender inscripciones que **siguieran `active`**. Si el cron nocturno cancelaba antes de que el pago del mes se aprobara (lo normal: la aprobación suele llegar días después del corte), la inscripción quedaba `cancelled` **para siempre**, sin importar cuántos meses más pagara la persona — el trigger nunca revivía algo ya cancelado. Medido: **15 atletas de GYM RM** con 7-24 pagos históricos cada uno, bloqueados del acceso físico por `no_enrollment` pese a estar al día. Reactivados a mano (excluyendo con criterio explícito a quien no tuviera pagos recientes o ya tuviera otra inscripción activa vigente — dos casos se cayeron del lote por eso) y corregido el trigger: ahora también matchea `status IN ('active','cancelled')` y reactiva. Dreamers **no tiene este problema** — usa el banco de horas, no el ciclo de `expires_at` (verificado: 3 enrollments, las 3 `active`). Pendiente menor, no bloqueante: el trigger sigue sin actuar si el pago llega con `offering_plan_id` nulo — no se tocó por ser menos frecuente y más riesgoso de inferir a ciegas qué inscripción correspondía. | ✅ | — | [validación](../scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md) · [migración](../supabase/migrations/20260827195933_fix_extend_enrollment_reactivar_canceladas.sql) |

#### DIN-4 en detalle — «prendo el módulo y no se activa»

Investigado el 2026-08-01. **No es un bug: son cuatro cosas distintas**, y el toggle no es ninguna de
ellas. `school_addons` **sí tiene las filas** con `via='admin_toggle'`, incluidas las de hoy 18:40–18:42
(VOLK FIT CLUB / `tournaments`, 10 addons de Escuela Demo SportMaps). El problema está después de la escritura.

| # | Hallazgo | Dónde |
|---|---|---|
| 1 | **El panel no relee: pinta por optimismo.** Actualiza el estado local tras escribir y nunca vuelve a consultar. Muestra ON porque lo asumió, no porque lo verificó — por eso es imposible distinguir «se guardó» de «no se guardó» | `AdminSubscriptionsPage.tsx:95` |
| 2 | **Prender el módulo no lo hace aparecer.** El sidebar consulta **un solo** addon: `hasAddon('store')`. Torneos, Contabilidad, Facturación, Nutrición, Biomecánica, Control de acceso, White-label y WhatsApp no cambian nada visible al activarlos | `AppSidebar.tsx:126` |
| 3 | **Caché de 5 minutos.** `useEntitlements` tiene `staleTime: 5 * 60 * 1000`: el módulo no aparece hasta que expire o haya recarga dura. `bff/src/utils/authCache.ts` (sin commitear) puede sumar otra capa | `useEntitlements` |
| 4 | 🔴 **`v_school_entitlements` miente en silencio** — ver `SEG-7`. Es el grave | vista |

**Decisiones nuevas** (en el spec): **D11** el panel muestra estado *verificado* — relee tras cada
escritura y por escuela muestra plan, status, `trial_ends_at`, días restantes, `account_type` y cada
módulo con **desde dónde** se activó (`trial_grant` / `admin_toggle` / `seed`) y cuándo; si lo que
respondió la BD difiere de lo que se pidió, sale en rojo con el motivo. **D12** se quitan los `COALESCE`
inventados: sin privilegio ⇒ error o vacío, nunca un `starter/active` falso. **D13** activar un módulo
tiene que verse — sidebar y rutas consultan su addon, y el toggle invalida la caché.

**Gates duros:** `G-VERIFY` (nada se pinta por optimismo) · `G-NOLIE` (ninguna lectura devuelve
defaults inventados; se prueba con un lector **sin** privilegio).

**Orden de fases:** F0 marcado real/pruebas → **F0.5 verdad en el panel** (nueva, entra antes de F1) →
F1 trial todo-abierto → F2 cron → F3 bloqueo server-side → F4 UX → F5 consola → F6 aislar pruebas.

> **Por qué F0.5 va antes de F1:** no tiene sentido conceder 11 addons automáticamente si todavía no se
> puede ver si quedaron concedidos. Y F3 se apoya en un status que hoy se puede leer falso.

### ERP — Módulo Pendientes: CxC / CxP / Nómina + libro mayor

Absorbe lo que antes era «contabilidad fases 1–6» (`MOD-5`).
Spec: [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md).

Hoy el dinero vive en tres modelos que no se hablan — `payments`, `expenses`, `payroll_runs` — y **no
existe la tabla de cruce**, así que no se puede abonar a un gasto, ni pagar cinco facturas con un
giro, ni pagar la nómina del período con un solo egreso. **`D-PD` resuelta: el módulo lleva partida
doble completa desde la primera fase** (§3.1).

| ID | Pendiente | Estado | Esfuerzo | Nota |
|---|---|---|---|---|
| ERP-1 | **Quick wins de UX contable.** Ícono Ojo = ver contabilización, Lupa = solo búsqueda; Editar se **oculta** en vez de deshabilitarse; orden cronológico estable en movimientos; formulario de tercero Natural/Jurídica; documentar en pantalla qué asiento produce «Registrar gasto». | 🔵 | 3–4 d | Sin dependencias. Va en la misma pasada que `UX-1` |
| ERP-2 | **Libro mayor + núcleo CxP.** `chart_of_accounts` + `journal_entries` + `journal_lines` con cuadre débito=crédito, inmutabilidad y reverso; `obligations` + `cash_movements` + `obligation_settlements`; capa de posteo; mapeo de cuentas por escuela; RPCs de cruce con **lock pesimista sobre la obligación**; pago parcial y multi-factura. | 🔵 | 6–7 sem | Bloqueado por D-T, D-MIG, D-PUC, D-CORTE (§5) |
| ERP-3 | **Períodos contables y bloqueo.** `accounting_periods` + rechazo de asientos en período cerrado. **Es el punto de unión con el ciclo de mes.** | 🔵 | 1 sem | ERP-2 |
| ERP-4 | **Nómina.** Obligación por empleado al cerrar la liquidación (el motor `payroll_runs` **ya existe**), pestaña agrupada por período, pago del período completo con un egreso, posteo al mayor. | 🔵 | 1–2 sem | ERP-2 en producción · D-NOM |
| ERP-5 | **CxC: lectura + posteo.** Pestaña «Por cobrar» que lee `payments` **sin migrarlo**, y capa de posteo que lleva sus eventos al mayor (cobro emitido → CxC/Ingreso; pago recibido → Banco/CxC). Sin esto el mayor no incluye el ingreso principal de la escuela. | 🔵 | 2 sem | ERP-2 · `DIN-1` cerrado |
| ERP-6 | **Retiro de los nombres viejos.** «Finanzas» y «Proveedores» dejan de existir como módulos; queda `Pendientes · Movimientos · Contabilidad`. | 🔵 | 3 d | **Se entrega junto con `UX-4`** o se pisan |

### ADM — Consola de Super Admin

El rol `super_admin` tiene que poder configurar **todo** de cualquier escuela desde una sola
pantalla. Hoy no puede: los interruptores existen pero están repartidos y no hay dónde verlos juntos.

**Inventario real de la superficie de configuración** (verificado contra el esquema el 2026-08-01):

| Dónde vive | Cuántos | Qué hay |
|---|---|---|
| `school_settings` (tabla) | **20 columnas** | `payment_cutoff_day`, `payment_grace_days`, `responsible_payment_policy`, `allow_multiple_enrollments`, `coach_can_send_reminders`, `coach_can_request_reminders`, `auto_generate_payments`, `allow_installments`, `max_installments_per_payment`, `reminder_enabled`, `wompi_enabled`, `epayco_enabled`, `online_fee_pct`, `glosa_response_days`, `receipt_date_window_days`, `coach_can_enroll_paid_teams`, `active_modules`, `bank_name`, `bank_account_number`… |
| `schools` (columnas) | 4 | `payment_mode`, `business_model`, `branding_settings`, `slug` |
| `schools.payment_settings` | 1 JSONB | 🔴 **store legacy duplicado** (`allow_manual`, `allow_online`) — el mismo concepto que ya vive en la tabla |
| `school_addons` | **11 claves** | `tournaments · access_control · biomech · nutrition · whitelabel · whatsapp · wompi · mp · store · accounting · invoicing` (el `CHECK` se amplió dos veces: `20260514000002` y `20260713000006`) |
| `school_subscriptions` | plan/tier/status/trial | `metadata` guarda `via: 'admin_toggle'` y `set_by` |
| `profiles` / escuela | `account_type` | nuevo en `DIN-4` F0 |

➡️ **~40 interruptores repartidos en 5 tablas y 2 JSONB, sin un solo lugar donde verlos ni fijarlos.**

| ID | Pendiente | Estado | Esfuerzo |
|---|---|---|---|
| ADM-1 | **Inventario y catálogo de flags.** Una tabla-catálogo (`school_flag_definitions`) con: clave, tipo, valor por defecto, dónde vive físicamente, quién puede cambiarlo, si es peligroso y qué precondición exige. Sin esto la consola es una lista hardcodeada que se desactualiza en la primera migración. | 🔵 | 3–4 d |
| ADM-2 | 🔴 **Resolver el doble store antes de construir la consola.** `school_settings` (tabla) vs `schools.payment_settings` (JSONB legacy) guardan el mismo concepto. **Una consola que lee uno y escribe el otro miente**, y es el mismo tipo de defecto que `SEG-7`. Migrar el JSONB a columnas y dejarlo de solo-lectura con `COMMENT` de deprecación. | 🔵 | 3 d |
| ADM-3 | **Consola por escuela: ver y fijar todo.** Una pantalla con las ~40 opciones agrupadas, y por cada una: valor actual **releído de la BD**, valor por defecto, quién lo cambió, cuándo y desde dónde (`trial_grant` / `admin_toggle` / `seed`). Hereda `G-VERIFY` de `DIN-4`: **nada se pinta por optimismo**. | 🔵 | 1–2 sem |
| ADM-4 | **Precondiciones en los flags peligrosos.** No todo interruptor puede ser un switch pelado:<br>· `auto_generate_payments = true` en una escuela con inscripciones duplicadas **arma el fallo silencioso del cron** de `DIN-1` — `SOLO MILLOS` es la prueba viva: lo tiene en `true`, tiene 7 atletas duplicados, y su mes no se está facturando sin que nadie vea un error.<br>· `payment_mode = 'direct'` sin llaves validadas **mata el checkout** (`DIN-6` F-B).<br>· bajar de plan puede esconder módulos que la escuela está usando.<br>La consola **verifica la precondición y explica por qué se niega**, en vez de dejar apretar y romper. | 🔵 | 1 sem |
| ADM-5 | **Auditoría y reversa.** Toda escritura registra actor, momento, valor anterior y nuevo, y se puede revertir al valor previo desde la misma pantalla. | 🔵 | 4 d |
| **ADM-6** | 🔴 **El panel de super admin ya existe, y sus tarjetas no muestran lo que dicen.** Verificado el 2026-08-19 leyendo `AdminPanelPage.tsx` contra la definición de `admin_global_counts` en la base. La tarjeta titulada **«Actividad Hoy»**, subtitulada **«Sesiones activas (Est.)»**, se alimenta de **`payments_paid_30d`**: dice *hoy* y muestra *30 días*, promete *sesiones* y entrega *pagos*. El «(Est.)» es la confesión de que nadie creyó el número. Al lado, la tarjeta **«Sistema» está hardcodeada en `'Online'` verde** — no consulta nada, nunca se pone en rojo. La RPC devuelve **15 métricas y ninguna toca `attendance_sessions`**, y el dato correcto existe hace tiempo en `mv_session_health`, que **no lee nadie** (`INF-11`). Es el mismo defecto que ya condenamos en `DIN-4` D11 y en `ADM-3` («nada se pinta por optimismo»), pero acá el número ni siquiera es del concepto correcto. Fix: sumar `sessions_today` / `sessions_stale` / `oldest_stale` a `admin_global_counts` —que ya es `SECURITY DEFINER` con `is_super_admin()`, así que el gate no cambia— y cablear las dos tarjetas; «Sistema» en verde solo si `sessions_stale = 0`. | 🔵 | 1 d |

> ⛔ **Lo que esta consola NO es: una caja para correr SQL desde el navegador.** El BFF usa
> `service_role`, que **salta toda la RLS**: un endpoint que acepte SQL arbitrario del cliente es la
> puerta más grande que se puede abrir en el producto, y ningún gate de rol la cierra —basta un XSS o
> un token filtrado. Cada interruptor escribe por una **RPC tipada y auditada**, con su propia
> validación. «Directo en BD» significa *sin pedirle permiso a la escuela*, no *sin capa de control*.
>
> Y `is_super_admin()` **nunca se revoca** al rol que la invoca desde policies — convención del repo:
> hacerlo rompe con 403 todas las queries.

`ADM-3` absorbe la fase **F5 «consola»** de `DIN-4`, y depende de `DIN-4` F0.5 (la verdad en el panel)
y de `SEG-7` (que la lectura no devuelva defaults inventados). Construir la consola antes de esas dos
es construirla sobre datos que mienten.

### CONC — Concurrencia e integridad

Doctrina: [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md).
Buena parte **ya está aplicada**: índice único parcial en `session_bookings`, `payments` y
`enrollments`; lock pesimista en `enforce_session_capacity`; advisory lock en `open_month`.

| ID | Pendiente | Estado | Esfuerzo |
|---|---|---|---|
| CONC-1 | **`Idempotency-Key` general en las mutaciones del BFF.** Hoy solo existe en cobros recurrentes (`recurring-charges.service`, `mercadopago.service`, `record_recurring_attempt`). Es la defensa más barata contra el doble cargo, y **prerrequisito de `ERP-2`**: un doble clic en «cruzar» no puede aplicar dos veces. | 🔵 | 3–4 d |
| CONC-2 | **Auditar todo `count(*)` de cupo o stock que no bloquee la fila padre.** El error clásico: dos inserts leen `N-1` y ambos pasan. `enforce_session_capacity` es el patrón bien hecho — copiarlo, no reinventarlo. | 🔵 | 2–3 d |
| CONC-3 | **Dedup intra-sentencia en `open_month`.** Es `DIN-1`; se lista aquí porque es el caso que la lista canónica de mecanismos **no** cubre: ni advisory lock ni `FOR UPDATE` protegen dentro de una sola sentencia. | 🟡 | — |
| CONC-4 | **Modelo de reservas con soft lock**: `reservations` con `expires_at`, índice único parcial `(resource_id, slot_start)` para exclusividad, `idempotency_key`, job de expiración, y disponibilidad que ignora holds vencidos aunque el cron no haya pasado. | 🔵 | dentro de `BLQ-1` |
| CONC-5 | **Decidir franjas fijas vs solapamiento libre** — índice único simple, o `EXCLUDE USING gist` con `btree_gist`. Cambia el modelo. | ⚪ | decisión |
| CONC-6 | **Cola offline y política de degradación** (overbooking configurable, `pendiente_reconciliacion`, conflicto resuelto por `held_at` más antiguo). Opt-in por escuela; por defecto la recepción sin señal **no vende**. | ⚪ | dentro de `BLQ-3` N4 |

### SEG — Seguridad, RLS y permisos

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| SEG-1 | ⚠️ **Re-medido 2026-08-29: mismo hallazgo, blanco distinto.** `search_path` mutable ya no son las 8 funciones de agosto — son **7 funciones nuevas**, ninguna existía el 12-ago: `trg_offerings_resolve_school_category`, `trg_teams_resolve_school_category`, `fn_resolve_school_category`, `fn_check_facility_reservation_overlap`, `fn_pt_session_auto_complete`, `fn_pt_routine_reminder`, `fn_pt_routine_reminder_2h` (categorías deportivas y rutinas de personal trainer). ✅ **Las 7 funciones y 2 de las 3 extensiones se cerraron el 2026-08-31** (migración `20260831095348`, verificado en vivo: 0 funciones con `search_path` mutable de esa lista, `pg_trgm`/`unaccent` movidas a `extensions`). ⚠️ **`pg_net` NO se pudo mover — no es una decisión pendiente, es una limitación técnica:** `ALTER EXTENSION pg_net SET SCHEMA` falla con `0A000: extension "pg_net" does not support SET SCHEMA` (comprobado al intentar aplicarlo); moverla de verdad exige `DROP`+`CREATE`, lo que arrastra el estado interno de la cola async que hoy usan el outbox de notificaciones y el autopay — no vale el riesgo por un hallazgo de higiene. Sus funciones (`net.http_post`/`http_get`) ya viven en el schema `net`, no en `public`, así que el riesgo real de este hallazgo específico era bajo desde el principio. **Sigue pendiente, y no se puede cerrar por SQL:** la protección de contraseñas filtradas — es un toggle del dashboard de Supabase Auth (Authentication → Policies → Password Security), no hay tabla ni RPC que tocar. **Linter de Supabase — Fase −0.5 (drift bloqueante)** y luego Fase 1 (quick wins). ⚠️ **Re-medido contra la base el 2026-08-12: el alcance encogió.** `search_path` bajó de ~35 funciones a **8**; siguen 3 extensiones en `public` (eran 2). Suma un hallazgo nuevo que no estaba en el plan: **la protección de contraseñas filtradas está desactivada** (`auth_leaked_password_protection`) — es un toggle del dashboard de Auth, gratis, chequea contra HaveIBeenPwned al registrarse. | 🟢 | 1 d | [plan](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) · barrido 2026-08-12 y 2026-08-29 |
| SEG-2 | ⚠️ **Re-medido 2026-08-29: ya no es 1 ERROR del linter, son 3.** `school_athletes` (el original) más `v_school_staff_publico` y `v_school_settings_publico` — **estas dos son intencionales**: las creó la propia auditoría del 14-ago para resolver `school_settings`/`school_staff` filtrando a `anon` (RLS filtra filas, no columnas, así que la solución fue una vista con solo lo publicable). El linter no distingue «vista pública curada a propósito» de «bypass accidental de RLS» — antes de tocar nada, documentarlas con `COMMENT` explicando por qué se aceptan, **no revocarlas**: revocarlas rompe la web pública que depende de ellas a propósito. ✅ **Las dos ya quedaron documentadas con `COMMENT ON VIEW` el 2026-08-31** (migración `20260831095348`) — el linter las va a seguir marcando (no hay forma de que no lo haga sin dejar de ser `SECURITY DEFINER`), pero ahora cualquiera que las encuentre sabe que es a propósito. Lo único que sigue pendiente de resolver de verdad es `school_athletes`. | 🟢 | 4 h | [plan §Fase 2](analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md) · barrido 2026-08-29 · migración `20260831095348` |
| SEG-3 | **`SECURITY DEFINER` expuestas a `anon`.** Ejecutar por grupos: A (helpers/triggers → revoke total), E (internas → solo `service_role`), F (candidatas a `DROP` por falta de uso), luego C y D. Cuidado: **nunca revocar** `is_school_admin()` / `is_super_admin()` al rol que las invoca desde policies. ⚠️ **La premisa cambió con el barrido del 2026-08-12: esto es higiene, no riesgo.** Hoy son 195 funciones para `anon` y 307 para `authenticated`, pero se revisaron las de riesgo una por una y **las `admin_*` sí validan por dentro** (`is_super_admin`, `auth.uid`). El único caso sin ningún chequeo se extrajo a **`SEG-8`** y sube a P0; `get_school_payment_info` está sin chequeo **por diseño** (gateada por `public_profile_enabled`, la usa el checkout público — documentarla con `COMMENT`, no revocarla). Baja a P2: seguir haciéndolo, pero sabiendo que es defensa en profundidad. ⛔ **TRAMPA verificada el 2026-08-12: hay que revocar a los TRES — `PUBLIC`, `anon` y `authenticated`.** Postgres concede `EXECUTE` a `PUBLIC` por defecto en toda función nueva, **y además** Supabase concede `EXECUTE` a `anon` y `authenticated` **directamente**, por privilegios por defecto del esquema `public`. Son grants independientes: revocar uno deja vivos los otros. La prueba es `auto_approve_payment` — su migración **sí** hace `REVOKE ALL … FROM PUBLIC` y aun así `anon` la ejecuta (HTTP 200 con la anon key, comprobado en vivo). Y `find_athletes_by_document` tenía las dos cosas a la vez: `=X/postgres` (PUBLIC) **más** `anon=X` y `authenticated=X`. De **187 migraciones que crean funciones, solo 34 hacen `REVOKE … FROM PUBLIC`**, y ninguna revoca a `anon`. La forma correcta es `REVOKE ALL … FROM PUBLIC, anon, authenticated` y después re-declarar los grants que sí van; con cualquier revoke parcial, el ID se cierra sin haber cerrado nada. *(Corrige la nota anterior de este mismo día, que decía que bastaba con revocar `PUBLIC`.)* | 🟢 | 1 sem, N PRs | [auditoría ⚠️ de may-2026](analysis/SECURITY_DEFINER_AUDIT.md) · barrido 2026-08-12 |
| SEG-4 | **Permisos de coach.** Dos planos que no coinciden (RLS aguanta / el BFF con service role es el único gate real) y dos matrices de permisos que son código muerto. ⚠️ **Verificado y parcialmente cerrado el 2026-09-02**, auditando el flujo de coach-por-plan (`OfferingCoachesPanel`/`offering_coaches`): `bff/src/routes/school-staff.ts` no tenía **ningún** `requireRole` — solo `requireAuth`, que exige ser miembro activo de la escuela pero no filtra por rol — y el BFF corre con `service_role` (bypasea RLS por completo), así que era la única barrera y no estaba. Cualquier padre, atleta, `wellness_professional` o `store_owner` de la escuela podía crear/editar/borrar staff y **crear o borrar la disponibilidad de cualquier coach** (`coach_availability`), incluido el CRUD completo de personal. Cerrado: `requireRole(owner/super_admin/admin/school_admin)` en el CRUD de staff, y en `/availability` un gate dueño-o-admin (permite al propio coach gestionar solo la suya, verificando `coach_auth_id`). De paso se cerró que `POST /athlete/book-session` (`session-bookings.ts`) creaba la `attendance_session` con el coach del slot **sin revalidar** `offering_coaches` — el filtro solo vivía en el GET que arma el calendario, no era autoritativo; ahora responde `403 coach_not_authorized` si el coach no está habilitado para el plan. ✅ Confirmado en el mismo barrido que `requirePermission` (la segunda matriz, `bff/src/middlewares/authMiddleware.ts:353`) sigue siendo código muerto: cero imports en `bff/src/routes/`. **Hallazgo colateral:** `offering_coaches` no tiene ningún `CREATE TABLE` en `supabase/migrations/` — vive en producción por fuera del ledger, es una instancia concreta (sin nombrar hasta ahora) del drift que mide `INF-1`. **Sigue abierto:** auditar el resto de rutas del BFF por el mismo patrón (`requireAuth` sin `requireRole`), decidir el destino de las dos matrices de permisos (integrar `requirePermission` o eliminarla), y versionar `offering_coaches` con una migración `CREATE TABLE IF NOT EXISTS` que documente su estado real (RLS no aplica por service role, pero sí conviene fijar el esquema). La memoria `project_coach_permissions_audit` referenciada abajo no existía en el store — se creó ese mismo día. ✅ **Auditoría completa del resto del BFF hecha y cerrada el 2026-09-02** (las 87 rutas, 4 agentes en paralelo por dominio): 14 hallazgos del mismo patrón en 8 archivos, los 2 más graves en producción **sin autenticación alguna**. Cerrados los 14:
- 🔴 `mercadopago.ts` `/create` y `/save-card` — **sin ningún middleware de auth**, expuestos a internet: `/save-card` tomaba `userId` del body (cualquiera plantaba el método de pago default de OTRO usuario) y `/create` cobraba tarjetas usando el `access_token` real de MP de la escuela/vendor sin autenticar al caller (vector de carding). Fix: `requireAuth` + `req.user.id` en vez de body, más `requireCsrfHeader` a nivel de mount (igual que `payment-tokens`/`recurring`) — la UI de Brick que los consume (`PaymentProviderGate`/`MercadoPagoBrick`) no está enlazada a ninguna página real todavía, así que el riesgo vivía solo del lado del endpoint HTTP directo.
- 🔴 `trainer/clients.ts` (`body-metrics` PUT/DELETE) y `trainer/routines.ts` (`session-plans/:id/progress`, `/feedback`) — cero scoping: cualquier trainer autenticado sobrescribía/borraba métricas corporales o secuestraba el plan de sesión de **cualquier cliente de cualquier escuela**. Fix: helper `assertClientInSchool()` (verifica enrollment activo en `req.schoolId`) y `.eq('school_id', req.schoolId)` en `body_metrics` (ya lo guardaba en la fila).
- 🟠 Mismo patrón sin scoping en `trainer/clients.ts` (`stats`/`goals`/`training`, 9 rutas), `trainer/routines.ts` (`session-exercise-results`), `trainer/biomech.ts` (anotaciones y evidencia de skill) y `athlete/training.ts` (`DELETE /training/cancel-pt-session`, sin validar dueño del `planId` — un atleta podía forzar la sesión PT de otro cliente a `pending_review`). Todos cerrados con el mismo tipo de verificación de pertenencia antes de mutar.
- 🟠 `facilities.ts` (`POST`/`DELETE .../availability`) — literalmente comentado en el código como "calcado de school-staff.ts :coachId/availability", con el mismo bug (sin `requireRole`). Cerrado igual que el original.
- 🟠 `upgrade-requests.routes.ts` `GET /` — el comentario decía "por RLS: admin ve solo los suyos" pero la ruta usa `service_role` (bypasea RLS) y no tenía filtro ni `requireRole`: listaba las solicitudes de upgrade de **todas las escuelas** + email del admin solicitante. Cerrado con `requireRole` + scoping por `school_id` para `school_admin`.
- 🟠 `reviews.routes.ts` (`/reviews/:id/respond`, `/questions/:id/answer`) — el mensaje de error ya decía "o no eres el vendor" pero nunca se verificaba: cualquier usuario autenticado respondía reseñas/preguntas como si fuera el vendor de cualquier producto. Cerrado verificando `products.vendor_id === req.user.id` antes de mutar (mismo dueño que ya usaba `/vendor/inbox`).
- 🟡 `school/routines.ts` `DELETE /session-plans/:planId` — único endpoint del archivo sin `assertSchoolStaff()` explícito; delega en la RPC `fn_unassign_gym_session`, que **no tiene migración en el repo** (mismo drift de `INF-1`) y su chequeo interno de `p_caller_id` no se pudo verificar sin el MCP de Supabase autorizado. **Es el único de los 14 que queda sin cerrar** — no se tocó para no duplicar (o peor, contradecir) una validación que la RPC quizás ya hace bien.

**SEG-4 CERRADO el 2026-09-02** (con el MCP de Supabase ya autorizado, se resolvieron los tres pendientes de la nota anterior en la misma sesión):
- `fn_unassign_gym_session` — verificado el `prosrc` contra la base viva: el chequeo interno (`sm.role IN ('owner','admin','coach','staff')`) coincide exactamente con el comentario del código ("cualquier staff activo puede desasociar, no solo quien la asignó"). No era un bug, no se tocó.
- `requirePermission` — confirmado código muerto sin ambigüedad (cero imports), **eliminado** de `authMiddleware.ts` junto con su matriz `rolePermissions` y el tipo `Permission` (~100 líneas). `frontend/src/lib/permissions.ts` se deja intacto — ese sí está en uso para gating de UI.
- `offering_coaches` — migración `20260902190219` aplicada en vivo: documenta el esquema real (`CREATE TABLE IF NOT EXISTS`, no-op en prod), y **endurece la RLS**: la policy vigente (`school_members_manage_offering_coaches`) delegaba en `user_staff_school_ids()` — cualquier coach/staff podía asignarse a sí mismo a cualquier plan llamando Supabase directo con su propio JWT, sin pasar por el `requireRole` admin-only del BFF. Reemplazada por `offering_coaches_admin_manage` con `user_admin_school_ids()`, alineada con el BFF. También se revocó el `GRANT` residual a `anon` (predata `SEG-23`; RLS ya lo bloqueaba por falta de policy, pero el grant de tabla no debía existir).
- **Hallazgo nuevo, cerrado en el mismo barrido:** al leer `trial_class_public_create()` para descartar la pregunta abierta sobre clases de prueba, resultó que **sí** hay conexión con `offering_coaches` — cada `trial_class_categories` crea su propia `offering` tipo `single_session` (auto-generada al primer booking) y la `attendance_session` de la clase de prueba sí lleva `offering_id`. La RPC elegía el coach directo de `coach_availability_id`, sin consultar `offering_coaches`. Verificado en vivo: 0 categorías tienen esa restricción configurada hoy, así que el fix (migración `20260902190708`, mismo criterio "solo bloquear si hay filas asignadas" que `session-bookings.ts`) no cambia comportamiento actual — cierra el hueco antes de que alguna escuela lo necesite.

Las 87 rutas del BFF, la tabla que sostenía la restricción, la RPC de clases de prueba y las dos matrices de permisos quedaron verificadas contra la base viva — no queda ningún pendiente de este hallazgo. | ✅ | — | memoria [[project-coach-permissions-audit]] · [school-staff.ts](../bff/src/routes/school-staff.ts) · [session-bookings.ts](../bff/src/routes/session-bookings.ts) · [mercadopago.ts](../bff/src/routes/mercadopago.ts) · [trainer/clients.ts](../bff/src/routes/trainer/clients.ts) · [migración offering_coaches](../supabase/migrations/20260902190219_offering_coaches_documentar_y_endurecer_rls.sql) · [migración trial_class](../supabase/migrations/20260902190708_trial_class_public_create_respeta_offering_coaches.sql) |
| SEG-5 | **Anti-spoofing / IDOR / rate limit.** No aceptar nunca `user_id`/`sender_id` desde el payload del cliente; helper `can_message(a,b)` con relaciones reales. **El rate limit se midió el 2026-08-12 y es más flojo de lo que sugiere el código:** existen tres capas (`generalLimiter` 200/15min, `paymentLimiter` 20/min, `cardAlterLimiter` 10/h) pero **solo `cardAlterLimiter` usa key por usuario** — las otras dos son IP-only, así que un atacante autenticado rotando IPs no toca techo y una escuela detrás de NAT comparte cuota. Y el store es **en memoria**: cada instancia de Render y cada redeploy resetea los contadores, así que sin Redis no hay límite global. Falta además WAF/edge — `vercel.json` solo tiene rewrites y el BFF en Render está expuesto directo. | 🔵 | 3–5 d | [athlete remediation §F1](athlete-modules-remediation-plan.md) · [strategic §10](sportmaps-strategic-roadmap.md) · barrido 2026-08-12 |
| SEG-6 | **RLS column-level en `medical_info` y `phone`** (A8 del roadmap v1.3). | 🔵 | 1 d | [anexo B.8](archived/ROADMAP-v1.3-2026-05-12.md) |
| **SEG-7** | 🔴 **`v_school_entitlements` devuelve una respuesta falsa, sin error.** Misma escuela, mismo instante: con `service_role` responde `enterprise / active / 10 módulos true`; sin privilegio responde `starter / free / active / todos false` — **HTTP 200 en ambos casos**. La vista es `security_invoker=true`; `schools` tiene `FOR SELECT USING (true)` así que la fila siempre vuelve, pero `school_subscriptions` y `school_addons` están gateadas a `is_school_admin() OR is_super_admin()`. Cuando el lector no pasa, el `LEFT JOIN` da NULL, los `COALESCE` **inventan** `starter/free/active` y cada `EXISTS` de addons da `false`. Es **fail-open en el status** (afirma `active` cuando no sabe) y fail-closed en los módulos. Hoy muerde poco porque el BFF usa service role y el único lector del browser es el panel admin, cuyos 3 perfiles pasan el guard — **pero el bloqueo de `DIN-4` F3 se apoya justo en ese status**: un lector degradado ve `active` y el bloqueo no se aplica nunca. | 🔵 | 2–3 d | `DIN-4` D12 · gate `G-NOLIE` |
| **SEG-8** | ✅ **CERRADO Y VERIFICADO el 2026-08-29** — contra la base viva, no contra el repo: de las 40 funciones de la lista, 37 existen (3 son deriva, nunca se crearon) y las 37 dan `has_function_privilege('anon'/'authenticated', …, 'EXECUTE') = false`, con `proacl` mostrando solo `postgres`/`service_role`. **La migración de abajo sí está aplicada** — esta fila decía "sin aplicar" y estaba desactualizada; nadie la tocó cuando se aplicó. ⚠️ **AMPLIADO el 2026-08-12: no es una función, son 41.** Al escribir el fix se verificó que `auto_approve_payment` **ya tenía** `REVOKE ALL … FROM PUBLIC` en su migración y aun así `anon` la ejecuta — porque Supabase concede `EXECUTE` a `anon`/`authenticated` **directamente**, no vía `PUBLIC` (ver la trampa en `SEG-3`). Buscando el patrón aparecieron **41 funciones** que su propia migración declara solo para `service_role` y que nunca se conceden a `anon`/`authenticated` en ningún lado: entre ellas `complete_refund`, `apply_late_fees`, `generate_monthly_charges`, `save_payment_token`, `upsert_school_provider` (escribe los secretos de pasarela) y **`wa_verify_otp`**. Comprobadas en vivo solo dos, a propósito: `auto_approve_payment` (HTTP 200) y **`_notify_school_staff` (HTTP 204 — se ejecutó e inserta en `notifications`; con un `school_id` real, y `schools` es legible por `anon`, un anónimo inyecta notificaciones con título, mensaje y link arbitrarios al staff de cualquier escuela: phishing dentro de la app)**. Las otras 39 no se probaron: ejecutar `complete_refund` como anónimo para comprobarlo sería causar el daño. Verificado que el frontend no invoca ninguna. ⚠️ **El primer intento (`20260812180437`) abortó** con `42883: function public.claim_single_due_recurring_subscription(uuid) does not exist` — las firmas venían copiadas del repo y la base tiene otras: es `INF-1` mordiendo. Iba en `BEGIN/COMMIT`, así que el rollback dejó todo intacto. La versión buena resuelve las firmas contra `pg_proc` en tiempo de ejecución, cubre las sobrecargas, no aborta por las ausentes y las reporta en un `NOTICE` para alimentar `INF-1`. **`20260812180437` queda superseded: no correrla.** | ✅ | verificado en vivo 2026-08-29 | [migración buena](../supabase/migrations/20260812181043_cerrar_a_anon_service_role_por_catalogo.sql) · [la que abortó](../supabase/migrations/20260812180437_cerrar_a_anon_las_funciones_de_service_role.sql) · barrido 2026-08-12 y 2026-08-29 |
| ~~SEG-8 (original)~~ | 🔴 **`auto_approve_payment` no valida a quién la llama.** `SECURITY DEFINER`, con `EXECUTE` para `anon` **y** `authenticated`, y **cero chequeo de autorización** — lo único que verifica es que el cobro exista y esté en `awaiting_approval`. Después pasa `status` a `paid`, setea `amount_paid`, activa la inscripción y notifica. Un padre autenticado ve el UUID de su propio cobro en `/my-payments`: **se aprueba su propio comprobante y saltea el ciclo entero de validación de la escuela.** Hoy hay 0 cobros en `awaiting_approval`, así que no hay daño en curso — pero está armado y se dispara con el primer comprobante que suba un padre. Fix: `REVOKE EXECUTE … FROM anon, authenticated` en migración nueva; el BFF usa `service_role`, no se rompe nada. | 🟡 | 30 min | barrido 2026-08-12 · memoria `project_security_posture_audit` |
| ~~**SEG-9**~~ | ✅ **CERRADO, reverificado el 2026-08-17** contra los tres BFF desplegados: `/debug-logs` da **404** en bffdev, stg y el legacy; `/api/v1/access/debug-logs` da **401**. Las rutas están eliminadas del código (`access-adms.ts`, `access-api.ts`) y el despliegue lo confirma. | ✅ | — | verificado contra los hosts vivos |
| ~~**SEG-10**~~ | ✅ **CERRADO, reverificado el 2026-08-17 ejecutando como rol `anon`** con la llave del bundle: `payment_links`, `school_staff`, `facility_reservations`, `profiles`, `payments` y `children` devuelven **0 filas**. Lo único visible es `schools` (366), que es el directorio público y es intencional. `memberships`, creada el 17, responde **401**. | ✅ | — | verificado como anon |
| ~~**SEG-14**~~ | ✅ **CERRADO Y VERIFICADO el 2026-08-17** — esta vez probado con la **llave anónima del bundle**, no con la de servicio. `find_athletes_by_document` entregaba a cualquier anónimo `full_name`, `date_of_birth`, escuela, equipo y sede de un menor con solo su documento; el roadmap lo daba por cerrado desde el 08-16 y era falso. No se podía revocar sin más: la usa `JoinTeamPage`, la página **pública** de auto-registro del acudiente. Se agregó `buscar_menor_por_documento_publico` (sin fecha de nacimiento, nombre enmascarado «Carlos S. D.», `p_school_id` obligatorio) y se le quitó `anon` a la original **sin tocarle el cuerpo** — no está versionada (INF-1). **Verificación:** la vieja responde **401** a `anon`; la nueva devuelve 1 fila sin `date_of_birth` ni apellido completo; sin escuela devuelve **0 filas**. ⚠️ Lección: los cierres marcados en la pasada del 08-16 se dieron por buenos sin probarlos con la llave anónima. **`SEG-9` y `SEG-10` se marcaron en esa misma pasada y conviene reverificarlos igual.** | ✅ | — | [migración](../supabase/migrations/20260817215655_buscar_menor_por_documento_sin_exponer.sql) |
| ~~**SEG-15**~~ | ✅ **APLICADO el 2026-08-17.** Era la mitad viva de `DIN-4`: el middleware del BFF cubría lo que pasa por el BFF, pero el navegador escribe **directo a Supabase**, así que una escuela inhabilitada seguía registrando pagos, equipos, gastos, inscripciones e invitaciones por esa vía. Cerrado con policies **RESTRICTIVE** (se combinan con AND sobre las permissive sin tocar ninguna, y se revierten con DROP POLICY), solo sobre INSERT/UPDATE/DELETE —nunca SELECT, porque «bloqueado» no significa «sin datos»— y solo a `authenticated`, que `service_role` tiene BYPASSRLS. **Verificado contra la base:** las 14 tablas con sus 3 policies, ninguna descubierta; **161 escuelas bloqueadas, todas `real`+`trial_expired`**, ninguna demo ni cuenta de prueba y ninguna con prueba vigente; **Dynasty y GYM RM figuran vencidas pero siguen operativas** — el `blocking_exempt` funciona. ⚠️ Falta la **Fase B**: los RPC `SECURITY DEFINER` que escriben saltan RLS por definición (`submit_qr_signup`, `create_invitation`, `create_school_join_qr`, `generate_qr_monthly_charge`, `request_athlete_certificate`, `issue_athlete_certificate`, `notify_user`); cada uno necesita su guard. Y `memberships`, creada el 17, **no está cubierta**. | ✅ | Fase B pendiente | [migración](../supabase/migrations/20260813170813_bloqueo_de_prueba_en_rls.sql) |
| ~~**SEG-16**~~ | ✅ **CERRADO, reverificado el 2026-08-17.** `open_month`, `preview_open_month` y `school_payment_kpis` responden **401 a `anon`**; con la llave de servicio y una escuela inexistente devuelven `generados: 0` (firma correcta, nada creado). ⚠️ **Trampa que casi hace declarar esto mal:** con la firma equivocada PostgREST devuelve **404 `PGRST202`**, que parece «cerrada» y no lo es — da 404 igual con la llave de servicio. `open_month` es `(p_school_id, p_year, p_month, p_branch_id)`. **Un 404 nunca es prueba de cierre; el 401 sí.** | ✅ | — | verificado como anon |
| **SEG-17** | 🔴 **`TRUNCATE` en manos de cualquier usuario con sesión — y `TRUNCATE` NO pasa por RLS.** Encontrado el 2026-08-17 al verificar la migración de `memberships`: la migración concede `SELECT, INSERT, UPDATE, DELETE` y la base terminó además con **TRUNCATE**, TRIGGER y REFERENCES para `authenticated`. No los agrega la migración sino los **default privileges** del esquema, que dan ALL a `authenticated` en cada tabla nueva; el GRANT explícito es aditivo y no acota nada. RLS filtra SELECT/INSERT/UPDATE/DELETE pero **no TRUNCATE**, así que un padre o un atleta podía vaciar tablas completas de TODAS las escuelas sin que ninguna policy lo detuviera. Es la misma trampa que CLAUDE.md ya documenta para funciones (`EXECUTE` a `authenticated` por default privilege), pero en tablas — donde se venía confiando en que RLS tapaba todo. Migración: revoca los tres privilegios en todas las tablas de `public`, ajusta los default privileges para que no vuelva, y agrega **I5** a `invariantes_seguridad()` para que `npm run seguridad:invariantes` lo vigile. Nada de la app depende de esto: PostgREST no expone TRUNCATE y el BFF va con `service_role`. | 🟡 | ✅ aplicada 2026-08-17 | [migración](../supabase/migrations/20260817210308_truncate_no_pasa_por_rls.sql) |
| **SEG-18** | 🟡 **60 policies `FOR ALL` sin `WITH CHECK`, en 56 tablas** (invariante I3, medido contra la base el 2026-08-17 con I1, I2 e I5 ya en cero). Sin `WITH CHECK`, PostgreSQL valida los INSERT con la expresión de `USING` — que se escribió pensando en «qué filas puedo VER», no en «qué filas puedo CREAR». Así es como una policy `USING (email = auth.email())` dejaba a cualquiera insertarse como staff de **cualquier** escuela. **60 no son 60 agujeros:** cuando el `USING` también restringe correctamente la escritura, el efecto es el mismo y solo falta ser explícito. Hay que leerlas una por una y separar las que de verdad permiten escribir fuera de alcance. Las que más concentran: `reservation_payments`, `event_delegation_payments`, `attendance_sessions` y `coach_profiles` (2 cada una); el resto son de a una. Empezar por las que tocan **dinero** (`reservation_payments`, `event_delegation_payments`, `payment_tokens`) y por `unregistered_athletes` y `enrollments`, que son las que crean identidad y cartera. ⚠️ **Re-medido el 2026-08-29 contra la base viva: bajó a 53** (0 CRÍTICAS, corrida real de `npm run seguridad:invariantes`) — parte se cerró de rebote al resolver `SEG-19`/`SEG-20`/`SEG-21`. Sigue siendo la misma tarea: leerlas una por una, sin decisión de producto de por medio. | 🔵 | auditoría mediana | `npm run seguridad:invariantes` (corrida 2026-08-29) |
| ~~**SEG-22**~~ | ✅ **CERRADO Y APLICADO el 2026-08-31, verificado en vivo.** `bridge_heartbeats` (mig. `20260826220634`, 26-ago) había quedado sin `ENABLE ROW LEVEL SECURITY` — tabla pública, `anon`/`authenticated` con `SELECT/INSERT/UPDATE/DELETE` directos por privilegio de esquema. Alimenta la alerta de «bridge de control de acceso caído» de ZKTeco. Fix: `ENABLE ROW LEVEL SECURITY` sin policies (deny-all, mismo patrón que las otras tablas "RLS sin policy"). **Verificado con `set local role anon; select count(*) from bridge_heartbeats` → 0 filas.** Solo la escriben `bridge.routes.ts`/`bridge-heartbeat-check.job.ts` con `service_role`, que bypassa RLS — nada se rompió. | ✅ | aplicada | migración `20260831095348` |
| **SEG-23** | ✅ **CERRADO DE RAÍZ Y VERIFICADO el 2026-08-31.** Causa raíz: un `ALTER DEFAULT PRIVILEGES` otorgado por el rol `postgres` daba `SELECT/INSERT/UPDATE/DELETE` a `anon` en TODA tabla nueva creada por ese rol en `public`, sin importar el `GRANT` explícito de la migración — ya había mordido dos migraciones que declaraban "sin GRANT a anon" (`20260812182000_futbol_metricas_alineacion.sql` y `20260831160936_mesociclo_carmel.sql`). Fix: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon` (migración `20260831163530`). **No es retroactivo** — confirmado empíricamente creando una tabla de prueba dentro de una transacción con `ROLLBACK`: la tabla nueva nace con `authenticated`/`service_role` pero **cero privilegios para `anon`**; `schools` (grant intencional, directorio público) y `sport_metric_thresholds` (grant intencional, catálogo público) **no se tocaron** — sus `GRANT` explícitos siguen igual. Queda sin tocar el default de `supabase_admin` (otro rol, probable gestión de plataforma, fuera del camino real de las migraciones de este repo) y el default de `authenticated` (cambiarlo no aporta nada — todas las migraciones ya lo otorgan explícito). `match_lineups`/`match_lineup_players`/`football_match_events` (`CAR-8`) **siguen con el `GRANT` viejo a `anon`** — el fix de raíz no revierte lo ya otorgado, esa deuda puntual queda abierta si alguien la quiere cerrar | ✅ | aplicado | migraciones `20260831162124` + `20260831163530` |
| ~~**SEG-19**~~ | ✅ **CERRADO Y VERIFICADO el 2026-08-18.** Fase B de SEG-15: los RPC `SECURITY DEFINER` saltan RLS y se llaman directo desde el frontend, así que ni las policies RESTRICTIVE de la Fase A ni el 402 del BFF los alcanzaban. Resueltos **envolviendo, no reescribiendo**: la original se renombra a `__interno` y un envoltorio con el mismo nombre y firma hace el guard y delega — el cuerpo de `submit_qr_signup` (~250 líneas de deduplicación de identidades) queda byte por byte igual. **Verificado contra la base:** las seis funciones existen, los tres `__interno` responden **401 a `anon`**, `create_invitation__interno` no es ejecutable por `authenticated`, y la sobrecarga de 8 argumentos delega al nombre **público** —o sea que también pasa por el guard—. Quedan **36 invitaciones pendientes de 2 escuelas bloqueadas**, emitidas antes del fix: el guard no las borra, hay que decidir aparte qué hacer con ellas. ⚠️ **Lección de método:** se dieron por no aplicadas porque un POST sin argumentos a `__interno` devolvía 404 — que es «firma no encontrada», no «no existe». Es la misma trampa de `SEG-16`. **Un 404 nunca prueba nada; el 401 sí.** | ✅ | — | [QR](../supabase/migrations/20260818071427_guard_de_prueba_en_rpcs_de_qr.sql) · [invitaciones](../supabase/migrations/20260818131456_guard_de_prueba_en_create_invitation.sql) |
| **SEG-20** | ✅ **CERRADO Y VERIFICADO el 2026-08-29** — auditoría del flujo público `/agendar/:slug` (`bff/src/routes/public-booking.routes.ts`) pedida explícitamente, no la habría encontrado ni el linter ni `seguridad:invariantes` porque es lógica de aplicación con `service_role`, no RLS/policies. **Hallazgo crítico:** `POST /start-verification` identificaba por **teléfono** y buscaba ese teléfono contra `profiles.phone` **sin filtrar por escuela** — cualquiera, desde el link público de *cualquier* escuela, escribía un teléfono ajeno y recibía de vuelta el **correo completo** (sin enmascarar, sin OTP) de la cuenta dueña de ese teléfono en toda la plataforma. El segundo vector (`children.parent_phone`) ya estaba roto de por sí — esa columna no existe (es `parent_phone_temp`), el `SELECT` fallaba en silencio. **Fix estructural:** el paso de identificación pasa a pedir **correo** — el usuario da su propio dato, así que «ya existe una cuenta con este correo» deja de ser una fuga. ⚠️ **Segundo hallazgo, sin relación, encontrado al probar por qué no pedía el código:** el bypass de depuración (`debug_code` en la respuesta) se gateaba con `NODE_ENV !== 'production'`, y `render.yaml` despliega `sportmaps-bff-dev` y `sportmaps-bff-stg` como servicios **públicos** con `NODE_ENV=development/staging` — y los tres ambientes comparten la **misma** Supabase real. El bypass de OTP completo quedaba vivo contra datos reales en dos de los tres BFFs desplegados. Reemplazado por `PUBLIC_BOOKING_DEBUG_OTP`, que no se declara en `render.yaml` para ningún servicio — apagado por ausencia en todo lo desplegado. **Dos hallazgos menores, mismo barrido:** carrera de capacidad en `POST /confirm` (lectura-luego-escritura sin lock — resuelto con RPC atómica `public_booking_confirm_reservation`, advisory lock + upsert), y `GRANT` inerte de INSERT/SELECT/UPDATE/DELETE a `anon`/`authenticated` en `public_booking_verifications` (RLS con cero policies ya lo bloqueaba, verificado en vivo con `set local role anon`, pero se revocó explícito). Migraciones `20260828230514`/`20260828230515`. ⚠️ **El código está commiteado (`a550d40f`) pero el bypass de OTP sigue vivo en `sportmaps-bff-dev`/`stg` hasta el próximo deploy — esto no se cierra solo con el commit.** | ✅ código, ⚠️ deploy pendiente | — | [spec](specs/agenda-publica-reservas.md) |
| **SEG-21** | ✅ **CERRADO Y VERIFICADO el 2026-08-29** — auditoría de Frente B (planes/tarifas que las escuelas cobran a sus atletas), no vino del linter ni de `seguridad:invariantes`. **Hallazgo crítico:** `move_session_credit(p_enrollment_id, p_delta, p_is_secondary)` es `SECURITY DEFINER`, no valida quién llama, y tenía `EXECUTE` para `anon` y `authenticated` por el default privilege del esquema (nunca tuvo `REVOKE` explícito, misma trampa que `SEG-3`). Mueve `sessions_used`/`secondary_sessions_used` de **cualquier** inscripción sin sesión: `p_delta:-1` le quema una sesión pagada a una familia, `p_delta:1` se auto-restaura sesiones gratis hasta el tope del plan — control directo sobre lo que una familia pagó. Mismo patrón, mismo barrido, en `fn_expire_overdue_enrollments`, `merge_split_enrollments` y `auto_close_stale_hour_bank_visits`. **Verificado antes de revocar:** todos los llamadores reales están en `bff/src/routes/attendance.ts` y `session-bookings.ts` (`service_role`) o en `pg_cron` (`expire-overdue-enrollments`, corre como owner) — nada en `frontend/src` los llama directo, solo aparecen en el `types.ts` generado. **Verificación post-fix con `has_function_privilege`:** las 4 dan `false` para `anon` y `authenticated`, `true` para `service_role` — nada se rompió. | ✅ | — | [migración](../supabase/migrations/20260829010122_revocar_execute_funciones_enrollments_expuestas_anon.sql) |
| SEG-11 | **Higiene del BFF.** Cuatro cosas de la misma pasada: **(a)** el error handler solo devuelve mensaje genérico si `NODE_ENV === 'production'`, y staging corre con `NODE_ENV=staging` → **devuelve `err.message` crudo al cliente**, y de paso el rate limit sube a 2000 por el mismo ternario; **(b)** `requireAuth` responde 403 con `detail: profile_id=<uuid> no encontrado en school_members…`, que filtra UUID interno y estructura de tablas (y `requireRole` devuelve `receivedRole`, útil para enumerar privilegios); **(c)** el auth se monta **por router, no globalmente**, así que la garantía «todas las rutas privadas» depende de no olvidarse — y ya hay olvidos (`SEG-9`); **(d)** `requireCsrfHeader` solo se aplica en 2 routers (`payment-tokens`, `recurring`); el resto de mutaciones no lo exige. | 🔵 | 3–4 d | barrido 2026-08-12 |
| SEG-12 | **Observabilidad: no hay.** `pino-http` está bien configurado (serializers que no vuelcan bodies), pero **Sentry no está instalado** — no figura en el `package.json` de ninguno de los dos servicios ni hay `Sentry.init` en ningún lado; solo existe como tipo opcional en `vite-env.d.ts`. 🔴 **Y la política de privacidad lo declara como proveedor de datos ante el usuario** (`PrivacyPage.tsx:324`, y otra vez en la cláusula de transferencia internacional): eso es un problema de exactitud legal, no solo técnico — o se instala, o se saca del texto. Sin centralización no hay alertas ni detección de anomalías: los logs viven en Render con retención corta y `debug.log` en disco efímero. Hay 64 `console.log` fuera de pino. `security_audit_log` sí existe en la BD pero nadie la vigila. | 🔵 | 3 d | barrido 2026-08-12 |
| SEG-13 | **Gestión de secretos y segundo factor.** Los secretos de pasarela por escuela **sí** están bien: AES-256-GCM en `payment_provider_secrets`, clave dedicada, descifrado solo en el BFF (`payment-crypto.ts`). Lo que falta es alrededor: no hay secrets manager (Doppler/AWS SM) ni rotación ni registro de cuándo se rotó — los secretos viven como env vars en Render y Vercel; **«scopes mínimos» no aplica porque no existen**: el BFF entero corre con `service_role`. Y **no hay MFA en ningún rol, ni siquiera `super_admin`** (lo único que hay es el componente `input-otp` de shadcn, sin usar) — lo cual pesa justo sobre `ADM-3`, que le da a una sola pantalla el control de las ~40 opciones de cualquier escuela. | 🔵 | 1 sem | barrido 2026-08-12 · `D1-pagos` (§5) |

#### El barrido del 2026-08-12 — por qué cambia la prioridad del track

Auditoría ejecutada contra la base viva (`luebjarufsiadojhvxgi`, la compartida dev/stg/prod: **son
datos reales**), no contra el repo. Todo con `SELECT`; nada se modificó. Método reproducible para
comprobar RLS de verdad: `set role anon; select count(*) from <tabla>; reset role;`.

**Lo que salió mejor de lo que decía el repo:**

| Medición | Repo | Base viva |
|---|---|---|
| Tablas con RLS | 139 (contadas en migraciones) | **224 de 224**, 619 policies, cero `DISABLE` |
| `search_path` mutable | ~35 funciones | **8** |
| Tablas con RLS y sin policy | — | 13, y es deny-all correcto |

Que el repo subcuente 85 tablas es otra cara de **`INF-1`**: la cadena de migraciones ya no
reproduce la base.

**Lo que salió peor:**

> `anon` tiene GRANT de `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` sobre **~230 tablas**. Es el
> default de Supabase y no es un error en sí — pero significa que **RLS es literalmente lo único
> que separa a un anónimo de la base**, y que cada policy con `USING (true)` es una puerta abierta
> de verdad, no un aviso teórico. Es el mismo argumento que ya está escrito para la consola de
> `ADM`: el `service_role` del BFF salta toda la RLS.

**El desplazamiento de prioridad, que es lo que importa:** el track `SEG` se armó desde la vista del
linter, y esa vista es **~96 % ruido**. De los 502 avisos de `SECURITY DEFINER`, los que valían algo
eran dos, y solo uno es un hueco real (`SEG-8`). Al mismo tiempo, **ninguno** de los hallazgos que
viven fuera de Postgres estaba mapeado: `SEG-9` a `SEG-13` son todos nuevos. Regla que queda: *el
linter cubre la capa de datos y hay que seguirlo, pero no ve el BFF ni la infraestructura, y ahí
estaba lo explotable.*

### CAR — Club Carmel (fecha dura: 19-ago-2026)

Único bloque del roadmap con **un tercero esperando del otro lado**. Club campestre, ~800
deportistas, 8 disciplinas, escuela formativa + membresías. **Las membresías se pagan en el club,
no por SportMaps**, y la escuela formativa tampoco factura por nosotros: el trial va sin dinero.

`CAR-2` y `CAR-3` **no son trabajo de Carmel** — son capacidades de plataforma que Carmel obliga a
construir y que sirven a los siguientes clientes de este tipo. El resto sí es específico.

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **CAR-1** | **Alta como `hybrid`** + poblar sus 8 `sport_configs`. **Instalaciones: NO** — decisión 2026-08-17, las crea el club con sus nombres y tarifas. ✅ Las 8 disciplinas quedaron confirmadas contra la fuente del club ([«Quiénes somos»](https://www.carmelclub.com.co/procedures/noticia.php?id=2364)): golf, tenis, fútbol, voleibol, baloncesto, pádel, natación y gimnasio. Las categorías salen del catálogo de cada federación (golf 5 R&A/USGA · tenis 7 ITF · fútbol 7 FIFA · voleibol 4 FIVB · baloncesto 7 FIBA · pádel 7 FIP · natación 6 World Aquatics) y el eje entra en `division`, no en `age`: el catálogo guarda NOMBRES («Sub-11»), y si en este club Sub-11 va de 9 a 11 o de 10 a 11 lo decide el club — inventar el rango para contentar al validador es lo que se sacó del script. ⚠️ `gimnasio` **no está en el catálogo** (ver `MOD-16`): entra con eje `none`, que para un gimnasio es correcto. ⚠️ Sigue en pie que **la única fila de `sport_configs` es de `MMA BLAIR TEAM`** (cuenta test): el camino multideporte nunca se ejerció con un cliente real. Ensayar en **Club Campestre Demo** antes. | 🟢 | script listo, espera el alta del 19 | [script](../scripts/carmel-configurar.mjs) · [plan](plan-club-carmel-multideporte-2026-08-15.md) |
| **CAR-2** | **`billing_enabled` por escuela** — interruptor maestro de cobros a familias. Hoy **no existe forma de apagarlos**: `school_addons` no tiene llave de mensualidades (es núcleo, no addon) y `active_modules` es aditivo, está poblado en 1 de 365 y lo puede tocar el propio cliente. Migración escrita: columna + trigger que fuerza `auto_generate_payments`/`late_fee_enabled`/`reminder_enabled` a false (así **los tres crons no se tocan** — ya filtran por esos toggles) + `has_billing` en la vista + RPC de super admin. Falta el cableado del menú y el switch en el panel. | 🟡 | ✅ aplicada 2026-08-17 | [migración](../supabase/migrations/20260815141039_billing_enabled_por_escuela.sql) |
| **CAR-3** | **Cablear el menú a los entitlements.** Hoy el sidebar se arma **por rol** y solo consulta un addon (`store`): `has_academy`, `has_reservations` y `has_billing` no los mira nadie. Sin esto, ni `CAR-2` oculta nada ni el multideporte se nota. Misma pasada que resuelve las tres. Incluye el **selector de deporte activo** (como el de sede) para que las páginas lean de `sports[]` y no de `primarySport`. | 🟢 | mediano | [plan](plan-club-carmel-multideporte-2026-08-15.md) §3 |
| **CAR-4** | **Membresías del club** — CONSTRUIDO 2026-08-17, falta aplicar la migración. Tabla `memberships` deliberadamente **fuera de facturación**: sin montos, sin FK a pagos, ningún cron la mira. Sujeto con la convención de `payments`/`enrollments` (XOR user_id / child_id / unregistered_athlete_id) e índices únicos parciales: una membresía vigente por persona y escuela. RLS del staff con las cuatro policies separadas y `WITH CHECK` explícito (I3), `user_staff_school_ids()` y no `user_school_ids()` (I2), `anon` sin privilegios. **`valid_until` no vence solo** y la UI lo respeta: cuando la fecha pasó y el estado sigue activo, avisa «por revisar» en vez de dar la membresía por vencida — un vencimiento automático con dato rezagado deja socios al día sin acceso. Pantalla `/memberships` con listado, filtro, alta manual y **carga por archivo** (cruza por documento, y lo que no resuelve lo reporta línea por línea sin crear a nadie). La insignia también sale en el listado de atletas, solo para quien tiene membresía. El ítem del menú aparece cuando los cobros están **apagados**. | 🟡 | ✅ aplicada 2026-08-17 | [migración](../supabase/migrations/20260817142331_memberships_del_club.sql) · [plan](plan-club-carmel-multideporte-2026-08-15.md) §2.1 |
| **CAR-5** | **Métricas de natación y golf.** El catálogo tiene 99 deportes y ambos están; `sport_metric_definitions` cubre solo 6 deportes (voleibol 51, fútbol 12, y cuatro con 4) — **natación y golf en 0**. La UI de captura ya existe: es trabajo de definición deportiva. Las validan los entrenadores. ⚠️ Los parciales de natación son series, no escalares: fuera del set inicial hasta verificar que `performance_entries` los aguanta. Ojo con `higher_is_better=false` (tiempo y hándicap). | 🔵 | pequeño + definición | [plan](plan-club-carmel-multideporte-2026-08-15.md) §4 |
| **CAR-6** | **Carriles de piscina en reservas.** Hoy una piscina es *una* instalación con capacidad N; «carril 3 de 6» no se puede expresar. Camino barato para el trial: cada carril como `facility` propio (sin código, riesgo: no impide reservar la piscina completa y un carril a la vez). Camino correcto si duele: `facility_units` con «reservar el padre bloquea los hijos» — sirve también para canchas divisibles. | ⚪ | pequeño / mediano | [plan](plan-club-carmel-multideporte-2026-08-15.md) §5 |
| **CAR-7** | **Video de partidos (Veo).** ⚠️ **Reescrito el 2026-08-19: el supuesto era falso por los dos lados.** Decía que el análisis «depende de qué exponga la API de Veo» y que no sabíamos si el club tiene plan con API. **(a) Veo Technologies no tiene API pública** — sus integraciones (SportsRecruits, Sportify, USA Lacrosse) son acuerdos comerciales de partner, y el *embed* del player sigue siendo un pedido abierto en su ideas board. **(b) Y no hace falta:** Veo Live acepta **destino RTMP personalizado**, así que la cámara emite directo a un ingest nuestro y el video entra a SportMaps sin negociar con nadie. Para el trial sigue en pie el **enlace manual** (`VID-1`, dos días, sin costo de infraestructura); el análisis por jugador es el track `VID` completo y **no cabe en un trial**. ⛔ Ojo: cualquier cosa que **almacene** video de los menores de Carmel pasa por `G-IMAGEN`. | 🔵 | pequeño (enlace) → track `VID` | investigación 2026-08-19 · track `VID` |
| **CAR-8** | **Sesión de entrenamiento de fútbol, contenido tomado del Excel real del club** («Sesión Diaria Fútbol C.C.C»). Resolvió de paso la colisión de nombres que documentaba `PER-0`/`docs/specs/periodizacion-microciclos-y-carga.md` §1: existían `training_sessions` (cupos, vacía) y `training_plans` (contenido, 3 filas) sin conocerse entre sí. La de cupos pasó a `training_slots`; la de contenido tomó el nombre `training_sessions` (`plan_date` → `session_date`) y sumó, nullable y específico de fútbol: `session_blocks jsonb` (bloques editables por el coach: `{name, minutes, activity, objective, description, tactical_lineup_id}`, enganchado a una jugada del Tablero Táctico), `game_principles text` y `evaluation jsonb` (`{objectives_met, team_rating, highlights, improvements}`). Frontend: `SessionFormDialog.tsx` reemplazó a `TrainingPlanFormDialog.tsx`, con los tres campos cableados. Migración `20260828230512`, aplicada vía `apply_migration` y verificada post-aplicación. ⚠️ **Verificado contra la base viva el 2026-08-31: 0 uso real.** Las 3 filas que existen son de antes de la migración (marzo/abril-2026) y de otras dos escuelas (`MMA BLAIR TEAM`, `ACADEMIA SUPERIOR BOGOTA`), ninguna con `session_blocks`/`game_principles`/`evaluation` poblados — el Excel de Carmel todavía no se cargó ni se capturó ninguna sesión con el formulario nuevo. | 🟡 código/esquema, ⚠️ sin uso real | — | [migración](../supabase/migrations/20260828230512_renombrar_sesiones_entrenamiento_futbol.sql) · [spec §1](specs/periodizacion-microciclos-y-carga.md) |

### INF — Infraestructura y deuda de esquema

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| INF-1 | **Deriva de esquema sin versionar.** ~336 objetos que la base tiene y el repo no crea: 56 tablas, 137 funciones, 143 columnas. Hay módulos enteros fuera del repo. La cadena de migraciones ya no reproduce la base. Se mide con `npm run migrations:drift`. Ayer se cerró el dominio de rendimiento; **hay que versionar por dominio, empezando por el que bloquee la siguiente fase.** | 🔵 | continuo | memoria `project_unversioned_schema_drift` |
| INF-2 | **Dos mecanismos de cron coexisten** en el BFF (deuda documentada). | 🔵 | 2 d | [auditoría §3.6](AUDITORIA_ARQUITECTURA.md) |
| INF-3 | **Triple vocabulario de roles.** `public.roles` usa `school_admin`, no `admin`; hay tres nomenclaturas conviviendo. | 🔵 | 3 d | [auditoría §4.2](AUDITORIA_ARQUITECTURA.md) |
| INF-4 | **Rendimiento: el cuello no es la BD.** CPU al 5%; el problema es RLS amplificando `school_athletes` ×3000 en buffers + 3 round-trips por request en el BFF. | 🔵 | 1 sem | memoria `project_perf_audit_2026_07` |
| INF-5 | **`programs` es legacy** y 4 funciones todavía lo referencian (una ya rompió la página de carnets). | 🔵 | 1 d | memoria `project_carnets_digitales` |
| **INF-7** | **Las migraciones se aplican por una vía que no deja registro.** Se pega SQL en el editor de Supabase, que **no escribe en `supabase_migrations.schema_migrations`**. Consecuencia medida el 2026-08-16: cuatro ítems del roadmap marcados 🔴 llevaban días resueltos (`SEG-14`, `SEG-9`, `SEG-10`) o aplicados en producción (`DIN-4`), y averiguarlo costó comprobaciones indirectas —¿existe `mask_person_name()`?, ¿`payment_links` devuelve 0 a `anon`?— en vez de una consulta. `migrations:pendientes` lo advierte en su propia salida: *«esto dice sin registro, NO sin aplicar»*. **Mientras siga así, el roadmap va a volver a mentir y no se puede priorizar sobre él.** Fix: aplicar por el CLI de Supabase o `apply_migration`, y hacer un backfill único de las que ya están vivas. | 🔵 | 1 d + backfill | verificación 2026-08-16 |
| INF-6 | **Borrar las 22 escuelas de prueba vacías.** Ya están marcadas `test` (§1.2) y separadas de las 4 demos curadas, así que el borrado dejó de ser urgente — es higiene. ⚠️ Tres trampas conocidas: hay que borrar `profiles` **antes** que el usuario de auth; `school_staff.coach_auth_id` y `storage.objects.owner` no caen por cascada; y `Spirit Fontibon (Test)` tiene **403 miembros** cuyos perfiles pueden pertenecer a otras escuelas — ahí se borra la membresía, nunca la persona. Requiere script con `--dry-run` que reporte filas dependientes. **No arrancar sin resolver las 6 escuelas ambiguas** marcadas `test` que tienen atletas y dinero adentro. | ⚪ | 1 d | [plan](plan-limpieza-y-demos-curadas-2026-08-12.md) |
| ~~**INF-8**~~ | ✅ **CERRADO el 2026-08-17. La causa era el gate apuntando a la nada.** El pre-commit y el CI **ya corrían** `npx tsc --noEmit` en `frontend/`… pero `frontend/tsconfig.json` es un config de **solución** (`"files": []` + `references`), así que `tsc --noEmit` a secas revisa **cero archivos y sale 0**. El gate estuvo verde mientras se acumulaban **275 errores**, y por ahí se desplegaron seis `ReferenceError` que mataban pantallas enteras (Equipos, registro de escuela, carrito, /mi-plan, reserva de servicios, anuncios). `vite build` tampoco typechequea: transpila con esbuild. **Arreglado:** los dos gates ahora usan `-p tsconfig.app.json` y `-p tsconfig.node.json`; los tipos generados de Supabase se regeneraron (estaban del 9 de agosto, sin `sports_categories.slug`, `vendor_profiles` ni `service_listings` — 200 de los 275 errores eran eso); y los 66 restantes se corrigieron uno por uno, destapando **16 flujos que fallaban en la base**. **tsc queda en 0**, así que cualquier error nuevo es una regresión y el gate por fin muerde. Queda `npm run verificar:runtime` para diagnosticar rápido cuál error de tipos rompe una pantalla (filtra a TS2304/2552/2448/2449). | ✅ | — | [gate](../scripts/verificar-nombres-sin-declarar.mjs) · [ci](../.github/workflows/ci.yml) |
| **INF-9** | ⚠️ **`20260817133556_restaurar_booking_holds` NO SE CORRE — superseded por `20260817140943_restaurar_booking_holds_v2`.** Abortó con `42883: operator does not exist: uuid = uuid[]`: la policy del staff usaba `= ANY ((SELECT public.user_staff_school_ids()))`, y cuando lo que sigue a `ANY (` es un `SELECT`, PostgreSQL lo parsea como **subconsulta** — compara el uuid contra cada FILA, y cada fila es el `uuid[]` completo. El paréntesis extra no cambia el parseo. La v2 usa `IN (SELECT unnest(...))`, que no admite dos lecturas y sigue resolviéndose una sola vez por consulta (SubPlan hasheado). Iba en `BEGIN/COMMIT`, así que el rollback no dejó nada a medias — verificado: `booking_holds` sigue sin existir. **Lección para el resto de las policies que usan los helpers de alcance:** los tres devuelven `uuid[]`, así que `= ANY (fn())` va sin `SELECT` adentro, o se envuelve con `unnest`. | 🟡 | ✅ v2 aplicada 2026-08-17 | [v2](../supabase/migrations/20260817140943_restaurar_booking_holds_v2.sql) · [la que abortó](../supabase/migrations/20260817133556_restaurar_booking_holds.sql) |
| **INF-10** | ⚠️ **El aviso de `20260816193602` sobre `school_type='academia'` es FALSO** — verificado el 2026-08-18. Esa migración advierte que «el selector del onboarding ofrece Academia y guarda `academia`», valor que la vista no reconoce, dejando a la escuela sin módulos. **No es así:** el onboarding vivo es `SchoolSetupPage.tsx` y emite **`academy`**, el valor canónico. El componente que emite `academia` es `SchoolRegister.tsx`, que es **código muerto**: no está ruteado en ninguna parte y su submit final solo hace `console.log` («Here you would typically send all data to Supabase»). Medido en la base: **cero** filas con `academia`, `universidad` o `federacion`. Las 151 escuelas sin módulos son `federation` (79), `institute` (62) y `association` (10) — entidades informativas del mapa, donde no tener módulos es **correcto**. La migración no se puede editar (inmutables), así que la corrección vive acá. **Pendiente real y menor:** borrar `SchoolRegister.tsx`, que además ofrece `universidad` y `federacion`, valores que tampoco existen. Y anotar que **ninguna escuela tiene `hybrid` hoy**: Carmel sería la primera. | 🔵 | trivial | [muerto](../frontend/src/components/pages/SchoolRegister.tsx) · [vivo](../frontend/src/pages/SchoolSetupPage.tsx) |
| **INF-11** | ⚠️ **Un trabajo nocturno con dos dueños, y una matview que no lee nadie.** Medido el 2026-08-19. **(1) La duplicación:** `auto_finalize_stale_sessions()` + `refresh_session_health()` se disparaban **a la vez** desde el BFF (23:55 COT) y desde `pg_cron` (04:55 UTC = el mismo minuto). Lo que **no** pasaba: doble descuento de sesiones —`fn_deduct_sessions_on_finalize` ya no descuenta nada desde `20260730050217`, solo pasa `session_bookings` a `attended` con un `WHERE status='confirmed'` idempotente, y el `UPDATE … WHERE finalized = false` deja 0 filas en el segundo disparo. Tampoco había desfase de fecha: el `TimeZone=America/Bogota` está a nivel de **base**, así que también aplica a los workers de `pg_cron`. Lo que sí pasaba: **cuatro `REFRESH … CONCURRENTLY` por noche donde alcanzaba uno**, porque el trigger de sentencia `trg_attendance_session_finalized` refresca **aunque la sentencia afecte 0 filas**, y encima el cron refresca explícito. **Ya corregido el lado del BFF** (bloque de las 23:55 eliminado; `pg_cron` queda como dueño único). **(2) Lo que falta, y borra objetos vivos:** `mv_session_health` **no la lee nadie** —cero `.from(...)` en el código, cero filas en `pg_depend`— y sus columnas `stale`/`today`/`upcoming` usan **`CURRENT_DATE` dentro de una matview**, que congela la fecha en el instante del refresh: a las 00:01 `today` ya miente. El trigger no es una optimización, es el **parche de un problema que la matview crea**, y lo paga el coach dentro de su request al finalizar asistencia. La query cuesta **90 ms sobre 2.648 sesiones y 365 escuelas, todo desde caché**. Fix: matview → **vista normal** (ahí `CURRENT_DATE` se evalúa al leer y siempre acierta), borrar el trigger, y sacar el `refresh` redundante del comando de `pg_cron` y de `/cleanup`. Su consumidor natural es `ADM-6`. Emparenta con `INF-2` (dos mecanismos de cron), que hasta ahora estaba anotado sin caso concreto. | 🟡 mitad hecha | 1 d | sesión 2026-08-19 |
| **INF-12** | ✅ **Puente físico de apertura remota — GYM RM (ZKTeco F22ID). Entregado y confirmado en campo el 2026-08-26.** El F22ID acepta el comando ADMS de apertura (`CONTROL DEVICE`) pero no mueve el relé físico — resuelto con `scripts/gymrm-door-bridge/` (SDK `pyzk` local) + `bff/src/routes/bridge.routes.ts` (`GET/POST /bridge/door-commands`, API key fail-closed) + `access-adms.ts` (`getrequest`) excluyendo `open_door` para dispositivos `has_local_bridge`. **Hallazgo grande en el camino:** `conn.unlock(N)` de la librería `pyzk` trunca a entero antes de multiplicar por 10 (`pack("I", int(time)*10)`), así que nunca manda menos de 1 segundo completo — a 1s+ el torniquete de GYM RM (brazo giratorio sin bloqueo mecánico de "una vuelta y se traba") se re-arma varias veces por ventana, confirmado que el acceso normal y el software oficial de ZKTeco NO tienen ese problema (usan un pulso más corto). Se resolvió mandando el mismo `CMD_UNLOCK` de más bajo nivel con el valor en décimas de segundo directo, saltando el truncado — **0.2s (2 décimas) confirmado en los dos lectores, primero con un script de prueba aislado y después por el flujo real del dashboard.** `turnstile_devices.door_drive_time_seconds` (el campo "Tiempo de apertura" del dashboard) quedó **desacoplado** de esto: sigue controlando `Door1Drivertime` por ADMS para el acceso normal (funciona bien), pero ya no tiene ningún efecto sobre el botón manual del bridge — el pulso es un valor fijo en el script (`PULSE_DECISECONDS`, override por env var sin redeploy). El bloqueo de usuarios (`set_group`) se probó en campo y funciona por ADMS sin cambios. De yapa: se agregó `bridge_heartbeats` + cron cada 5 min que avisa al owner si el bridge lleva 10+ min sin sondear (PC apagada/sin red) — antes no había ninguna señal de esto. **Abierto, no bloqueante:** (a) posible discrepancia entre `GET /overdue` (marca vencido con *cualquier* cobro `overdue` histórico) y `validateAccess` (solo mira el cobro *más reciente*) — sin confirmar con un caso real todavía; (b) el campo "Tiempo de apertura" quedó mudo para el botón manual sin ninguna nota en la UI que lo aclare; (c) ~~el mismo heartbeat no se portó al bridge de Dreamers~~ — **corregido 2026-08-27: no hacía falta.** Ya existe `alert_offline_access_devices()` (pg_cron cada 5 min, sin migración) que cubre exactamente ese caso para Dreamers, porque la única vía que toca `turnstile_devices.last_seen_at` ahí es el propio `send_heartbeat()` del bridge — a diferencia de GYM RM, donde el lector habla ADMS directo y ese mismo campo se actualiza aunque la PC del bridge esté apagada (por eso ahí sí hacía falta `bridge_heartbeats`, una señal aparte). | ✅ | — | [validación](../scripts/gymrm-door-bridge/VALIDACION-2026-08-25.md) · [spec](../scripts/gymrm-door-bridge/BACKEND_ENDPOINT_SPEC.md) · [bridge](../scripts/gymrm-door-bridge/) |

### UX — Interfaz, navegación y densidad

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| UX-1 | **Primitivas de layout.** `<PageShell>` con 4 anchos (hoy hay 24 distintos porque el `<main>` no fija ninguno), `<PageHeader>` compacto (hoy 78 páginas con un bloque de ~110 px), 3 tamaños de modal en vez de 17, y una escala de espaciado de 4 pasos en vez de 7. **Barato y desbloquea todo lo que se construya después.** | 🔵 | 3–4 d | sesión 2026-08-01 |
| UX-2 | **`DataTable` único.** Hoy hay 20 listados ad hoc. Incluye **F-01: un error de fetch se muestra como tabla vacía en silencio** (crítico, y toca dinero) y **F-02: la pantalla de pagos hace fetch-all sin límite**. `AdminActivityLogsPage` es la referencia buena (`usePagedRpc` + `Pager` + guard de stale). | 🔵 | 1 sem | memoria `project_frontend_tables_audit` |
| UX-3 | **Menú lateral — capa barata.** Desduplicar iconos (`Users` marca 4 ítems distintos), renombrar los choques («Finanzas → Finanzas y Contabilidad → Finanzas», cuatro cosas llamadas «reporte»), aplicar el gating por plan a los ítems (hoy solo el grupo «Mi Tienda» mira `hasAddon`) y hacer que el acordeón funcione en modo icono. | 🔵 | 1–2 d | sesión 2026-08-01 |
| UX-4 | **Menú lateral — reestructura.** De 36 destinos en 6 grupos a 24, con ningún grupo de más de 5 ítems y 12 pantallas movidas a pestañas dentro de la pantalla a la que pertenecen. Implica tocar páginas, no solo el config. | ⚪ | 1 sem | sesión 2026-08-01 |
| UX-5 | **Master-detail en los listados.** Sustituir el modal de «ver registro» por un panel de detalle a la derecha en Atletas, Cobros y Comprobantes. Depende de UX-2. | ⚪ | 1 sem | sesión 2026-08-01 |
| UX-6 | **Matar las features falsas del atleta.** Privacidad 100 % cosmética, `/messages` sin compose ni triggers y con «Contactar» de mentira, botón «Crear Evento» sin gateo en el calendario del atleta, `sports_interests` que nadie consume. ⚠️ El hallazgo de notificaciones cosméticas probablemente quedó resuelto al construir el módulo unificado — **verificar antes de trabajar.** | 🔵 | 1–2 d | [athlete remediation §F0](athlete-modules-remediation-plan.md) |

### MOV — Móvil, responsive y app nativa

Fuente única del track: [`auditoria-frontend-responsive-movil-2026-08-18.md`](auditoria-frontend-responsive-movil-2026-08-18.md),
con los 40 hallazgos y su evidencia archivo:línea. Tres cosas que conviene tener claras antes de
priorizar acá:

1. **La estrategia responsive es correcta y no hay que rehacerla.** Mobile-first estricto (**cero**
   prefijos `max-*` en 1.259 breakpoints), la adaptación es CSS y no JavaScript (`useIsMobile` tiene
   **un solo consumidor** en toda la app), y el scroll horizontal está resuelto en el primitivo
   `Table` para los 54 archivos que lo usan. Lo que falla es la **ejecución en tres frentes
   concretos**: safe areas, unidades de viewport y targets táctiles.
2. **Android está mitigado a propósito y iOS no tenía red de seguridad — esto último cambió.**
   `MainActivity` paddea el contenedor del WebView con los insets del sistema en vez de auditar 78
   páginas, y su comentario lo dice explícitamente. Esa decisión es buena — pero **solo existía en
   Android**. En la PWA de iOS, que era hasta el 27-ago la única vía iOS, no había nada equivalente.
   ⚠️ **Actualización 2026-08-29:** `MOV-3` (safe areas, ver abajo) ya está en `develop`, y
   `frontend/ios/` existe como proyecto Capacitor nativo — el WKWebView de Capacitor en iOS respeta
   `env(safe-area-inset-*)` de forma nativa, sin necesitar un equivalente Java a `MainActivity`. El
   hueco que este punto describía se cierra por los dos lados a la vez, aunque **sin confirmación de
   un build real en simulador/dispositivo** desde acá.
3. **`MOV-4` no es cosmético.** Es lo que impide que el addon `pwa_branding`/`whitelabel` funcione, y
   ya está vendido. Va emparejado con `BLQ-6`.

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **MOV-1** | ✅ **Mergeado 27-ago (PR #6, `feature/ios-mov-safe-areas`), sin verificación visual en dispositivo/simulador.** Las nueve correcciones de una línea. Ninguna toca lógica de negocio y juntas cierran 12 hallazgos: (a) crear `android/app/src/main/res/values/colors.xml` — **hoy no existe**, así que `styles.xml` resuelve `colorPrimary`/`colorAccent` contra los defaults de la librería de Capacitor y **cada campo de texto de la app muestra caret y manejadores de selección rosa Material `#FF4081` sobre una app verde**; (b) `android:windowBackground` en `AppTheme.NoActionBar`, que hoy es `@null` y deja **sin fondo las franjas que `MainActivity` paddea** → bandas negras sobre una app clara en API 35+; (c) el botón de cerrar de `DialogContent` mide **16×16 px** (no tiene padding ni `h-*`, el área táctil es el propio icono) — está a un `p-2` de 32 px y a `h-11 w-11` de cumplir; (d) `pb-20` (80 px) en el `<main>` reserva **menos** que el bottom nav (`h-16` + `env(safe-area-inset-bottom)` = 98 px en iPhone) → 18 px del último elemento tapados; (e) `Textarea` a `text-sm` mientras `Input` ya usa `text-base md:text-sm` → **auto-zoom de Safari** en cada área de texto larga; (f) `container.padding: "2rem"` es un escalar → 32 px de gutter en móvil, 296 px útiles de 360; (g) `overscroll-behavior: contain`, que hoy **no existe en ninguna declaración real**; (h) el manifest por defecto del BFF no declara icono `maskable` (la rama con marca de escuela **sí**); (i) guard de `isNativePlatform()` en `registerSW` → el SW se registra dentro del APK, donde no aporta y arrastra la lógica de recarga por `controllerchange`. | ✅ | mergeado 27-ago | auditoría A-03..A-05, D-05, R-01, R-03, R-07, R-11, V-07 (PR #6) |
| **MOV-2** | ✅ **Mergeado 27-ago (PR #6).** Borrar el código muerto que simula cobertura responsive. `src/App.css` — **241 líneas que ningún archivo importa** (`main.tsx` solo trae `index.css`), y adentro está el parche `min-height: 44px` de targets táctiles, el `[role="dialog"]` con `100vh` y `margin !important`, y un `[class*="grid-cols"] { grid-template-columns: 1fr !important }` que **habría aplastado todos los grids intencionales** si el archivo corriera. Dos de sus reglas ni siquiera son CSS válido (`.md\\:grid-cols-2` — el escape correcto es `\:`). Además: `ui/responsive.tsx` (sin consumidores; su `ResponsiveGrid` arma `md:grid-cols-${n}` en template string, que el JIT de Tailwind **nunca genera**), `components/Layout.tsx`, la regla `.main-content-with-nav`, los dos manifests estáticos (`public/manifest.json` trae `theme_color: #0ea5e9` — **celeste, no la marca**) y el bloque `workbox.runtimeCaching` de `vite.config.ts`, que es config muerta bajo `injectManifest`. **Prerrequisito de `UX-1`**: no se pueden diseñar primitivas de layout con un archivo fantasma que define reglas de modal y grid con `!important`. ⚠️ Antes de borrar `App.css`, decidir qué de su contenido debería vivir de verdad en `index.css` — el `min-height: 44px` es justo lo que pide `MOV-6`. | ✅ | mergeado 27-ago | auditoría A-02, A-08..A-11, V-04 (PR #6) |
| **MOV-3** | ✅ **Mergeado 27-ago (PR #6) — prerrequisito duro de cualquier release iOS, ya cumplido.** Safe areas: 4 archivos de 491 las usan. `index.css` ya define `.screen-safe`, `.dialog-safe` y `.safe-area-bottom`, bien comentadas — el problema es la adopción. Contra eso hay **15 cabeceras `sticky top-0` sin padding superior** (empezando por `AuthLayout.tsx:48`, que es la de **toda** la app autenticada) y `viewport-fit=cover` en el viewport, que mete el contenido bajo el notch. Falta una utilidad `.sticky-safe` y aplicarla; en Android es idempotente (`MainActivity` ya consumió los insets, así que `env()` da 0 y no hay doble margen), en la PWA de iOS es la diferencia entre usable e inusable. Incluye los tres banners flotantes, que además de ignorar los insets **se dibujan encima del bottom nav** (`z-50` contra `z-30`, `bottom-4`/`bottom-6` contra una barra de 64 px+) y usan paleta celeste fuera de marca sin modo oscuro; y las variantes `top`/`bottom` de `Sheet` y el `Drawer` de vaul, que dejan sus botones de acción bajo el home indicator. | ✅ | mergeado 27-ago | auditoría R-02, R-04, R-05 (PR #6) |
| **MOV-4** | 🔴 **El verde de marca escrito a mano anula el white-label.** `BrandingScope` aplica la marca de la escuela **reasignando variables CSS** (`--primary`, `--secondary`), así que todo lo que esté escrito como literal es inmune: **127 `#248223`** + 24 `#FB9F1E` + 162 `bg-green-500` + 172 `text-green-600` + 99 `text-green-500` + 84 `border-green-500`. Una escuela con marca roja o azul ve **verde SportMaps filtrándose** en botones, badges, iconos y bordes de decenas de pantallas — incluido el `bg-[#FB9F1E]` del indicador activo del bottom nav. En total **3.769 clases de paleta Tailwind fija y 641 literales hex en 48 archivos**. Por fases medibles: (1) los 151 hex de marca → tokens; (2) los verdes de Tailwind → tokens; (3) tokens semánticos de estado (`--success`/`--warning`/`--danger`/`--info`) para amber/red/blue/emerald, que **resuelve `MOV-5` en la misma pasada** porque los tokens ya tienen su valor en `.dark`. Cerrar con una regla de lint que falle ante un hex nuevo en `src/`, o la deuda vuelve a crecer. **Va emparejado con `BLQ-6`** — no tiene sentido construir tiers de branding sobre esto. | 🔵 | 1–2 sem por fases | auditoría D-01 |
| **MOV-5** | **Modo oscuro a medio construir.** `ThemeContext` está bien hecho (tres estados, listener de `prefers-color-scheme`, `.dark` completo en `index.css`); la cobertura no: **452 prefijos `dark:` en 77 de 491 archivos** y **786 líneas con fondos claros `-50`/`-100` sin variante oscura** (`bg-green-50` ×49, `bg-amber-50` ×47, `bg-blue-50` ×43, `bg-red-50` ×40) → paneles casi blancos con texto de color encima. **Agravado en Android**: el tema nativo es `Theme.AppCompat.DayNight`, así que un teléfono en oscuro entra a la app en oscuro por defecto y esas 786 líneas son lo primero que se ve. Aparte, **las 7 pantallas del embudo de entrada** (`LoginPage`, `RegisterPage`, `OnboardingRolePage` + los 4 `*Register` de `components/pages/`) tienen **paleta oscura privada hardcodeada** que ignora el tema y el branding — justo donde el branding más importa. La fase 3 de `MOV-4` cubre la mayor parte. | 🔵 | dentro de MOV-4 + 3 d | auditoría D-02, D-03, A-06 |
| **MOV-6** | **Targets táctiles y tipografía bajo el mínimo.** La escala base de `Button` no llega en ninguna variante salvo `lg`: `default: h-10` (40 px), `sm: h-9` (36 px, **527 usos**), `icon: h-10 w-10` (40 px, 125 usos), contra 44 pt de Apple y 48 dp de Android. Y encima se reduce por sitio: **16 botones a `h-8 w-8`**, **10 a `h-7 w-7`** y uno a `h-5 w-5` — varios de ellos junto a acciones de **borrar** (`BlockBuilder`, `TeamsPage`, `SchoolFacilitiesPage`). En tipografía, **1.021 ocurrencias por debajo de 12 px** (`text-[10px]` ×673, `text-[11px]` ×187, `text-[9px]` ×142, `text-[8px]` ×18, un `text-[7px]`), incluidos los mensajes de validación del formulario de acceso — que es un problema de conversión, no solo de accesibilidad. **Y no hay escape**: `maximum-scale=1.0, user-scalable=no` incumple WCAG 1.4.4 y Android WebView lo respeta al pie de la letra. Quitar el bloqueo de zoom es seguro: el auto-zoom de iOS ya lo cubren los 16 px de `Input` y el fix de `Textarea` de `MOV-1`. | 🔵 | 1 sem | auditoría D-06, R-08, R-09 |
| **MOV-7** | **Tipografía remota, bloqueante y sin cachear — y tres familias fantasma.** Cero `@font-face` propios y cero `.woff2` en el repo: Poppins viene de Google Fonts con **5 pesos** en un `<link rel="stylesheet">` que bloquea el render. El `runtimeCaching` que la cachearía es **config muerta** (`injectManifest`), y el `sw.js` real retorna temprano para cross-origin → **el SW nunca la cachea**. En la app nativa eso significa que los assets salen del filesystem local pero **la tipografía sale a Internet en cada arranque frío**, y sin red no carga nunca. Aparte, el código pide tres familias que **no se cargan**: `Inter` (×4), `DM Sans` (×3) y `Lexend` (×1) → las 7 pantallas del embudo caen a San Francisco en iOS y a Roboto en Android, ninguna es la de la marca. Fix: bundlear los 3 pesos que se usan de verdad en `public/fonts/` con `preload`, y borrar las 8 referencias fantasma. | 🟢 | 1 d | auditoría V-04, V-05 |
| **MOV-8** | **Imágenes sin ninguna optimización.** De **112 `<img>`**, solo 6 tienen `loading="lazy"`; **cero** `srcSet`, **cero** `decoding="async"`, **cero** `width`/`height` → cada avatar y logo que llega **recoloca el layout**, y son los que van dentro de listas. Sin `srcSet` el móvil recibe el archivo de escritorio: `icon-512.png` pesa **335 KB** y `hero-sportsmaps.jpg` **224 KB**. Cero WebP/AVIF en todo el proyecto. Incluye el dedupe de **5 archivos `.png` que son en realidad el mismo JPEG** (magic `ff d8 ff`, md5 idéntico, 63 KB × 5): `favicon.png`, `sportmaps-logo.png`, `logo-bienvenida.png` y sus dos copias en `src/assets/`. El BFF ya esquiva el problema y lo documenta en su código, pero `public/manifest.webmanifest` los sigue declarando `"type": "image/png"` y el `includeAssets` de Vite los precachea. Al ser JPEG **no tienen canal alfa**, así que el logo arrastra un recuadro sólido en cualquier fondo que no sea el suyo. | 🔵 | 3–4 d | auditoría V-03, P-02 |
| **MOV-9** | **Teclado y scroll: sin `@capacitor/keyboard` y con scroll anidado.** El plugin no está instalado; la única gestión de teclado del proyecto es `MainActivity`, que resuelve bien los insets del IME — **pero solo en Android, y la app no reacciona**: hay 3 `scrollIntoView` en todo el código y ninguno se dispara al enfocar un input, así que en formularios largos (`AddChildDialog`, `SchoolOnboardingWizard`, `CreateTeamModal`) el campo enfocado queda detrás del teclado. En iOS es peor: sin plugin ni compensación nativa, WKWebView no encoge el viewport y los 34 `position: fixed` flotan sobre el teclado. Aparte, el contenedor de scroll es el `<main>` y no el documento, con otro `overflow-auto` por cada `<Table>` adentro → en iOS el momentum se transfiere mal entre contenedores anidados y se pierde el «tocar la barra de estado para subir». Y **113 usos de `100vh`/`min-h-screen` contra 9 de `dvh`**. | 🔵 | 1 sem | auditoría R-10, R-12 |
| **MOV-10** | **Diálogos: los 41 `max-h-[90vh]` están siendo anulados a `100dvh`.** Verificado en el CSS compilado: `.max-h-[90vh]` está en el byte 32.087 y `.dialog-safe` (que trae `max-height: 100dvh`) en el 153.460 — misma especificidad, gana el segundo. La otra aparición de `90vh` es `.sm:` dentro de `@media (min-width:640px)`, o sea solo desktop. Resultado: en móvil, los 41 diálogos que su autor limitó al 90 % ocupan el 100 % del viewport dinámico y, centrados con `translate-y-[-50%]`, **arrancan en y=0 con el título bajo el notch**. La intención del autor y el resultado no coinciden en ninguno de los 41 sitios. Fix limpio: quitar `max-height` de `.dialog-safe` (dejando `overflow-y` y el `padding-bottom` con `env()`) y normalizar a `max-h-[90dvh]`. Incluye los **397 `grid-cols-N` sin escalón móvil**, priorizando los de 4–7 columnas dentro de diálogos (el selector de 7 días da **40 px por celda** a 360 px de ancho). | 🔵 | 3–4 d | auditoría R-06, R-13 |
| **MOV-11** | **Chrome nativo y gestos.** (a) Sin `@capacitor/status-bar`: el estilo de los iconos de la barra lo decide el tema `DayNight`, no el tema de la app → con la app en Claro y el SO en Oscuro salen **iconos claros sobre una franja clara**. (b) Sin `<meta name="theme-color">` en `index.html`, y `background_color: #ffffff` fijo en el manifest → **destello blanco en cada arranque** de la PWA instalada, también en modo oscuro. (c) `@capacitor/app` está instalado pero **no registra ningún listener de `backButton`**: la navegación atrás funciona por el `goBack()` por defecto de `BridgeActivity`, pero los diálogos y sheets de Radix no están en el historial, así que el gesto atrás **navega la ruta de fondo dejando el modal montado** — en un modal de pago a medio llenar eso es pérdida de datos. (d) `orientation: portrait` en el manifest pero **`android:screenOrientation` sin fijar** en la Activity: la app nativa rota libre y no hay una sola clase `landscape:` en `src/`. | 🔵 | 2–3 d | auditoría P-04, P-05, D-04, A-07 |
| **MOV-12** | **Rendimiento visual.** **292 `transition-all`** (observa todas las propiedades animables; cuando el cambio incluye `box-shadow` o dimensiones, cada frame dispara layout + paint) y **70 `backdrop-blur`** sobre elementos `sticky`/`fixed`, incluida la cabecera global de `AuthLayout` — es la fuente clásica de caída de FPS al hacer scroll en Android de gama media, y `will-change` solo aparece en el `App.css` que no se importa, o sea **cero pistas de compositor en el CSS activo**. El `supports-[backdrop-filter]:` está bien puesto para degradar donde no hay soporte, pero falta el escape por rendimiento. Aparte, el chunk `index` pesa **590 KB** y `vendor-react` 469 KB: en el WebView nativo se leen de disco, pero el **parse/compile** se paga en cada arranque frío. El code splitting en sí está bien (todo `lazy()`, vendors apartados a mano, y `globIgnores` ya recortó el precache de 7,4 MB con la medición fechada). | ⚪ | 3–4 d | auditoría V-01, V-02, V-06 |

### MOD — Módulos de producto

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| MOD-1 | **Revisión previa al envío masivo (onboarding safety F1).** Gate para no volver a mandar cientos de correos con datos mal cargados. El plan ya corrigió el error que lo habría roto en el primer intento (el BFF hablaba con la RPC como `service_role`, donde `auth.uid()` es NULL). | 🟡 | 3 d | [plan](plan-f1-revision-previa-envio.md) · [spec](specs/school-onboarding-safety.md) |
| MOD-2 | **Catálogo de categorías deportivas (F1).** Las tablas nacen vacías y ningún flujo existente las lee: riesgo nulo sobre datos productivos. **Es lo único del roadmap que se puede entregar sin esperar respuesta de ninguna escuela.** | 🟡 | 3–4 d | [plan-f1](plan-f1-catalogo-de-categorias.md) |
| MOD-16 | **El catálogo no tiene gimnasio, fitness ni CrossFit.** Los 99 deportes de `sports_categories` cubren federaciones olímpicas, pero «Gimnasia» ahí es la artística y la rítmica — nada que ver con un gimnasio. Y `teams.sport` **ya tiene «Gimnasio» y «CrossFit» en producción**, además de que el motor de demos incluye un tenant de crossfit. Hoy esos deportes entran con eje `none` y sin categorías. CrossFit **sí** tiene divisiones reales que se pueden mapear sin inventar (Rx / Scaled / Foundations y las Masters por edad de los CrossFit Games); un gimnasio de clases dirigidas se agrupa por nivel, que es decisión de producto y no de federación — hay que resolverla explícitamente, no colarla. | 🔵 | pequeño + definición | detectado al configurar `CAR-1` |
| MOD-3 | **Multi-categoría (F2+).** 1 inscripción + `enrollment_categories`, precio por cantidad (145k/165k) vía `monthly_fee`. Depende de DIN-1. | 🔵 | 2 sem | [spec](specs/sport-categories-and-multi-category.md) |
| MOD-4 | **Notificaciones F2–F6 + go-live en producción.** El motor ya funciona en dev. | 🔵 | 3 sem | [spec](specs/notifications-unified.md) |
| ~~MOD-5~~ | **Disuelto.** «Contabilidad fases 1–6» era el mismo trabajo que `ERP-2..6`. La UI para vendor y organizer sigue pendiente y va dentro de `ERP-2` (el eje `owner_type`/`owner_id` ya existe desde la fase 0). | — | — | §3 |
| MOD-6 | **Dotación e inventario por fases.** Custodia de equipo a entrenadores con acta y evidencia fotográfica. Aislado del marketplace, tier Pro. | 🔵 | 3 sem | [spec v1.1](specs/equipment-module.md) |
| MOD-7 | **Torneos: cerrar inscripción → bracket.** `events` + delegaciones ya existen en la base **sin versionar**; el bracket es net-new. | ⚠️🔵 | 4 sem | [decisiones](tournaments-decisions.md) · [inscripción](tournaments-enrollment-flow.md) · [scoring](tournaments-scoring-engine.md) |
| MOD-8 | **Asistencia y créditos de sesión.** Máx 1 crédito/atleta/día, la reserva descuenta y la asistencia no re-descuenta ese día, bloqueo del día al 2º coach. Incluye el saneamiento del eje plan↔equipo↔sesiones. | 🔵 | 2 sem | [plan créditos](plan-asistencia-y-creditos-de-sesion.md) · [saneamiento](plan-saneamiento-sesiones-plan-equipo.md) |
| MOD-9 | **Informes de asistencia.** Decisiones de producto cerradas. | 🔵 | 1 sem | [spec](specs/attendance-reports-module.md) |
| MOD-10 | **Complementos de métricas de rendimiento (C-A…C-K)** + pesos, normalización, benchmark, y la UI de crecimiento. **Re-medido el 2026-08-19:** `C-A` **ya está** —`sport_metric_definitions` tiene `higher_is_better`, `min_value` y `max_value`, y existe `sport_metric_thresholds` con bandas— y la **fase 1 de la UI de evolución está entregada** en las tres vistas (escuela/coach por `/training-plans`, padre por `/academic-progress`, atleta por `/stats`), con `performanceDisplay.ts` y los componentes de `components/performance/`. ⚠️ **Gotcha al tocarla:** hay **dos rutas del BFF** que alimentan lo mismo (`/school/performance/…` y `/athlete/performance/evolution`); un campo de presentación nuevo hay que agregarlo en **las dos**. Sigue faltando el objetivo de negocio —**pesos por escuela (C-B), normalización e índice de mejora (C-F), benchmark (C-G)** e ingesta de dispositivos (C-H)— más las fases 2 y 3 de la UI (historial por sesión de evaluación + radar por categoría; percentil contra el equipo + heatmap de cobertura). ⚠️ **Y un carril paralelo vivo:** `/evaluations` sigue escribiendo a `academic_progress` con `skill_name` de **texto libre** y un slider 0-100, sin pasar por el catálogo ni por `performance_entries`. Lo que produce **no agrega ni compara**, que es exactamente el gap que C-I (puente anti-fragmentación) tenía que cerrar. | 🔵 | 3 sem | [complementos](performance-metrics-complements.md) · [spec](performance-metrics-spec.md) · [legacy](../frontend/src/pages/CoachEvaluationsPage.tsx) |
| MOD-11 | **Marketplace: desplegar lo que ya está en código.** `marketplace_transactions` no existe en la base — el módulo escolar y externo está construido pero **no desplegado**. Después: M8 planes vendor, M9 split multi-vendor en carrito, M10 3D/AR, M11 Mox real, M12 email transaccional.<br>⛔ **GATE DE DESPLIEGUE: no se despliegan las migraciones de `marketplace_transactions` hasta cerrar F-D del [plan de ruteo de pagos](plan-cierre-ruteo-de-pagos.md).** Cinco de los seis endpoints de `marketplace-checkout.routes.ts` (135, 191, 248, 314, 568) **no llaman a `resolveProvider`** — solo el de carrito (446) lo hace — así que caerían a ENV, que en staging es Dynasty. Hoy el riesgo es teórico **solo porque la tabla no existe**: desplegarla lo arma. | 🔵⛔ | 1 sem + M8–M12 | memoria `project_stores_marketplace_state` · [gate F-D](plan-cierre-ruteo-de-pagos.md) |
| MOD-12 | **Self-service de planes y addons (fases 1–4).** De activación manual asistida por ventas a autoservicio instantáneo, luego auto-renew, ciclo de vida y onboarding desde la landing. | 🔵 | 3 sem | [roadmap](self-service-planes-addons-roadmap.md) · [vendor subs](saas-vendor-subscriptions-plan.md) |
| MOD-13 | **Facturación de sesiones y cobro por plan.** | 🔵 | 1 sem | [spec](specs/invoice-plan-sessions-and-collection.md) |
| MOD-14 | **Carnets: cerrar el editor de plantillas** y quitar las referencias a `programs`. | ⚠️ | 3 d | memoria `project_carnets_digitales` |
| MOD-15 | **WhatsApp: System User permanente de Meta.** Sin esto el bot muere cada 2 horas. Bloquea WA3–WA5. | 🟢 | 4 h | memoria `project_whatsapp_wa1_wa2_built` |
| **MOD-17** | 🔴 **Informe Mensual: el «piloto» de F5 no existe, y el cron manda correo real.** El ciclo diario ya corre (§1.2), pero `generate_report_drafts_system()` hace `FOR v_school IN SELECT id FROM public.schools` —**todas**— y el job termina llamando a `deliverPublishedReports`, que manda correo a las familias. El comentario del cron dice «mientras se prueba en **una escuela piloto**» y **no hay ningún filtro por escuela**: el único control es `DISABLE_ATHLETE_REPORTS_CRON`, que es todo-o-nada. Hoy el radio es inocuo **por falta de datos, no por diseño** —medido el 19-ago: los únicos atletas con `performance_entries` de agosto son **7, todos de «Academia Fútbol Demo»**—, pero la primera escuela real que capture métricas del mes entra sola al ciclo. Falta además: **recordatorios** (coach sin nota / padre que no abrió), declarados como segunda pasada, y las fases **F2–F6** del spec (PDF al vuelo, calendario de reparto). ⚠️ Recordar el gotcha del spec: la identidad del coach es `school_staff.id` vía `coach_auth_id`, no `auth.uid()`. ⛔ **Es el R0 de `MOD-19`:** nada de multi-cadencia se construye antes, y `report_schedules.enabled=false` por defecto es este mismo filtro, bien hecho.| 🔵 | 1 sem | [spec](specs/athlete-reports-module.md) · [plan F1](plan-f1-informes-backend.md) |

| MOD-18 | **Cumpleaños y celebraciones.** Tablero de «hoy cumple» para el staff, saludo automático a la familia y anuncio celebratorio en Modo Recepción. Hoy no existe **nada**: ni tabla, ni RPC, ni cron, ni categoría de notificación — solo la fecha de nacimiento guardada, que se usa para edad/categoría, el gate mayor/menor del registro y los carnets. Cobertura medida contra la base el 19-ago: **878 atletas activos tienen fecha** (el tablero les sirve a los 878) pero **solo 410 (47 %) tienen a quién notificar** — los 253 `unregistered` no tienen cuenta, así que el saludo automático **nunca** los alcanza; esa mitad se cubre con plantilla de WhatsApp manual (F4). La plomería de envío ya está puesta: `notification_deliveries` existe y `notifications` ya tiene `category`/`data`, así que el módulo no construye infraestructura de push, se cuelga del trigger de `MOD-4`. **F1 (el tablero) es entregable solo, en 3 d, sin tocar envíos.** El toggle nace apagado: con una sola Supabase para dev/stg/prod el cron es global, y encenderlo sin `WHERE` es un acto de producción sobre 878 familias. | 🟡 | 1–2 sem (F1 solo: 3 d) | [spec](specs/cumpleanos-module.md) |
| **MOD-19** | **Informes multi-cadencia (R1–R3).** Generaliza el Informe Mensual que ya corre: `period_type` (`daily`/`weekly`/`biweekly`/`monthly`/`semester`/`custom`) y `period_start/end` en `athlete_reports`, más `report_schedules` para la programación. **No es un módulo nuevo** — extiende tablas, RPCs y el job de las 06:10, que pasa de «asumir mensual» a «leer schedules vencidos»: cero jobs nuevos en `pg_cron`. Incluye el **envío manual «como está»** (el coach elige alcance y rango y manda) y la **plantilla brandeada**: el informe lee `schools.branding_settings`, así que el logo de Carmel es **configuración, no desarrollo** — sin editor de plantillas, que es el pozo de `MOD-14`. Entrega por la plomería existente: `notifications` → outbox → push, y Resend con resumen + enlace (el contenido del menor **no** viaja entero por correo). ⚠️ Depende de `MOD-17`: nada se construye mientras el cron recorra todas las escuelas mandando correo real, y `enabled=false` por defecto **es** ese filtro bien hecho. ⚠️ Plantillas contra tokens, cero hex literales (`MOV-4`). | 🔵 | 10–13 d | [spec](specs/informes-multi-cadencia-2026-08-19.md) |
| **MOD-20** | **Informe grupal y cadencias cortas (R4–R5).** El informe de equipo con **contenido propio** —asistencia promedio, resumen del período, próximos hitos— y no N individuales publicados juntos; la publicación por equipo ya existe (`publish_team_reports_system`). Regla de privacidad: **nunca métricas de otros menores con nombre**; los rankings van anonimizados, misma línea que `D-IMAGEN`. Después, `daily`/`weekly` conectadas a asistencia y el semestral con comparación inicio/fin. Pariente declarado: `PER-5` — cuando `PER-1` exista, el informe semanal **es** la vista semanal exportable. | 🔵 | 2 sem | [spec](specs/informes-multi-cadencia-2026-08-19.md) |
| **MOD-21** | ✅ **Banco de horas por torniquete.** Ver detalle completo en §1.4 y §1.5. Cuenta minutos en vez de clases; el torniquete (no la reserva) manda en el consumo real, independiente de `access_granted`. Las reservas "por plan" y "por instalaciones" ya redirigen a `reserve_hour_bank` en los 6 puntos de entrada reales (2026-08-27). Reporte de ingresos/salidas y histórico de meses por estudiante, movidos al perfil en Estudiantes (no en Control de Acceso, no escala a 50). Aislado de `session_bookings` a propósito: tabla propia `hour_bank_reservations` porque la reserva no lleva franja horaria (D-11). No es una decisión de plataforma — `hours_plan_enabled` nace en `false` para cualquier escuela nueva y el diseño no depende de `enrollment_periods` (`DIN`/rediseño de períodos, sin aprobar). ⚠️ **Ya no es "solo Dreamers":** confirmado con el cliente el 27-ago, Academia Superior Bogotá también lo tiene prendido (validación intencional, incluye una inscripción real de marzo-2026 en `Sub-10 (Beginners)`) — ver §1.4. | ✅ código/esquema, probado con datos reales en 2 escuelas | — | [spec](specs/dreamers-banco-de-horas-torniquete.md) |
| **MOD-28** | ✅ **Agenda de Clases de Prueba (owner), desde el módulo de Instalaciones.** DB + RLS + RPCs + BFF + frontend entregados 2026-08-28 (`d1dbbc87`), verificado contra la base viva (`seguridad:invariantes` sin violaciones críticas, ledger íntegro 444/444). El owner/admin agenda una prueba 1:1 cruzando `facility_availability` × `coach_availability` (`trial_class_get_joint_slots`); `trial_class_create_booking` revalida con lock `FOR UPDATE` + advisory lock por cancha+coach+fecha para evitar doble-booking concurrente. Mecánica hermana pero separada de la «clase de cortesía» (`school_courtesy_settings`, no se tocó). Confirmación por correo automática + WhatsApp pre-armado de envío manual (`wa.me`, sin Cloud API); soporta prospecto menor de edad (acudiente + nombre del hijo, migración `..._menor_de_edad`). Las RPCs `trial_class_*` quedaron restringidas a `service_role` — la autorización vive en el BFF (`trial-classes.ts`: admin ve todo, coach solo lo suyo, `cancelada`/`convertida` solo admin), no en la RPC, porque el BFF las llama sin JWT de usuario (mismo patrón que `move_session_credit`). ⚠️ **Drift documentado en la propia migración `..._menor_de_edad`:** existe un índice único `idx_attendance_sessions_unique_facility_slot` sobre `(facility_availability_id, session_date)` sin historial de migración propio — si dos coaches comparten un mismo bloque ancho de `facility_availability`, solo el primero que agenda esa cancha ese día se queda con todo el bloque, aunque sus sub-horarios no se solapen (documentado en spec §9). **Ampliación v1.1 (2026-08-29, migración `20260828230513_clases_de_prueba_categorias.sql`, aplicada vía `apply_migration` y verificada contra la base viva):** el precio único por escuela pasa a ser `trial_class_categories` (nombre + descripción + precio propio por categoría, borrado lógico); nueva RPC `trial_class_reschedule_booking` (solo fecha/hora, misma cancha/coach); cancelar y reprogramar ahora notifican al prospecto (correo + WhatsApp armado en el BFF, `notifyBookingChange()`); precio con separador de miles estilo `es-CO` en el input (no decimales — se malinterpretó primero como centavos); WhatsApp del prospecto precargado con `+57`. RLS/grants de las 3 RPCs nuevas escritas `service_role`-only desde el arranque (sin la migración de hardening aparte que hizo falta la primera vez) — confirmado con `get_advisors` (sin hallazgos sobre `trial_class_*`) y `seguridad:invariantes` (sin violaciones críticas). Verificado post-aplicación: 1 categoría migrada, 0 bookings con `category_id` nulo, columna `price` de `school_trial_class_settings` efectivamente eliminada. Ver [spec §15](specs/clases-de-prueba-agenda-owner.md). Pendiente real: la **Fase 4 (QA piloto con una escuela real)** no tiene evidencia de haberse corrido. | ✅ código/esquema/base, ⚠️ piloto sin correr | piloto: 1 escuela | [spec](specs/clases-de-prueba-agenda-owner.md) |
| **MOD-29** | ✅ **Gestión de reservas — cancelar/reprogramar/eliminar con aviso por correo,** para los dos tipos que la pestaña «Reservas» mezcla en una sola tabla (`useFacilityReservations.ts`). Antes: cancelar/reprogramar escribían Supabase **directo desde el navegador** (sin BFF, sin correo), y **«Eliminar» fallaba en silencio para los dos tipos** — `session_bookings_delete_none` (RLS `USING(false)`) bloquea el `DELETE` completo para `authenticated`, y `facility_reservations` solo deja borrar al propio autor con `status='pending'`. Un `DELETE` que no afecta filas por RLS no es un error, así que el toast decía «eliminado» sin haber borrado nada — encontrado porque dos registros de prueba de un owner real no desaparecían. Ahora `bff/src/routes/reservations-admin.routes.ts` (`service_role`, solo owner/admin) hace las cuatro acciones para **alquiler manual** (`facility_reservations`, protegido por el trigger `trg_check_facility_overlap` ya existente — no hizo falta RPC nueva) y para **clases de cortesía** (`session_bookings`, que no tenían reprogramar de verdad — solo cambiaban el `status`; nueva RPC `session_booking_reschedule`, mismo patrón de advisory lock que `public_booking_confirm_reservation`), y cada cancelación/reprogramación manda correo (`reservationCancelled`/`reservationRescheduled`). De yapa, `POST /confirm` del flujo público (antes sin ningún correo) ahora manda `publicBookingConfirmation` al confirmar — ver `SEG-20`. Migración `20260828232516`. ⚠️ **Deuda encontrada sin tocar:** `completeReservation` manda `status:'completed'` para clases de cortesía, pero el enum real de `session_bookings.status` es `confirmed\|cancelled\|attended\|no_show` — ese botón falla contra la base hoy para ese tipo. | ✅ | — | [spec](specs/agenda-publica-reservas.md) |
| **MOD-27** | **Asistente de soporte in-app con IA («Controli»-equivalente).** ✅ **S0 + S1 (3 tools) + S2 (bandeja, panel de diagnóstico embebido, notas internas, push al super_admin) construidos el 2026-08-25** — ver [§1.6](#16-lo-entregado-el-25-de-agosto-tarde). Migración aplicada y verificada contra la base viva, bot cableado sobre `chatWithTools()` (no solo diseñado), FAB + chat portados al frontend. Nada de esto tocó dinero ni RLS de pagos: fue tabla nueva + RLS nueva, sin dato productivo de por medio. | ✅ código · ⚠️ sin commitear | S3-S5 (acciones en burbuja, un hilo todos los canales, métricas) | [spec](specs/soporte-in-app-chat-y-bot.md) · [consola](specs/consola-de-soporte-super-admin.md) · [plan S0](plan-soporte-s0-migracion.md) · §1.6 |
| **MOD-22** | **Becas y «acuerdo de pago» como excepción de cobro por miembro.** Detectado al leer a Controla.Club: filtra miembros por «Beca: becados/sin beca» y «Acuerdo de pago: con/sin acuerdo». ✅ **La mitad «beca» quedó cerrada el 2026-08-27**: `enrollments.fee_is_manual` + `fee_reason` (migración `20260827175215`) marca a un atleta como exento (o con monto negociado) sin que `open_month` le vuelva a cobrar el precio del catálogo — cierra de paso un bug real donde `NULLIF(monthly_fee, 0)` trataba un 0 puesto a mano como "no seteado". Checkbox "Becado" en el editor de atleta + badge en tabla/tarjeta. **Sigue sin resolver «acuerdo de pago»**: ¿es la misma beca con otro nombre, o el gancho para plazos especiales (relacionado con el prepago/multimes de `DIN-17`)? Sin esa respuesta no hay diseño de esquema para esa mitad — dos estados mal definidos aquí ya causaron dolor (`payments.status` como TEXT, ver `CLAUDE.md`). | ✅ beca · ⚪ acuerdo de pago | acuerdo de pago: spec + decisión de producto | beca entregada 2026-08-27; detectado 2026-08-21, `sportmaps-strategic-roadmap.md` §2.1 |
| **MOD-23** | **Sitio público del club con subdominio propio.** Detectado al leer a Controla.Club: «Página Web del Club» (marcada NUEVA en su panel) — plantilla + subdominio, conectado a la data del club, para que la escuela tenga presencia pública sin depender de Instagram. No arranca de cero: el patrón de subdominio (`<slug>.sportmaps.co`) y los dominios propios para Enterprise (`CUSTOM_DOMAINS_SETUP.md`, Fase 5 white-label) ya resuelven el enrutamiento y la verificación DNS. Falta el generador de sitio (plantillas, editor, qué datos de la escuela se publican — cruza con la regla de `docs/` de que RLS filtra filas, no columnas: una página pública necesita una vista `_publico`, no exponer la tabla completa). Sin spec todavía; sin decidir si es addon de un tier de branding existente (`project_white_label_tiers`) o producto nuevo. | ⚪ | spec + decisión de producto | detectado 2026-08-21, `sportmaps-strategic-roadmap.md` §2.1 |
| **MOD-24** | **Comunidad/red social entre clubes y atletas («Social Controla»-equivalente).** Verificado el 2026-08-25 con fetch directo (no capturas): tienen una red social en producción con foros temáticos, sistema de reputación tipo Reddit, «Noticias del Club» y una capa **pública trans-fronteriza** que conecta clubes/coaches/atletas de toda LatAm. Es el gap más grande de los tres nuevos — no tenemos nada construido, y se acerca conceptualmente a `F6.2 Comunidad` del roadmap estratégico (posts, rutas, retos, grupos), que hoy es idea sin fecha ni spec. No se abre spec todavía: primero decidir si el foco es la capa privada por escuela (moat de retención, más barato) o la capa pública trans-escuela (moat de red, mucho más caro y con moderación de contenido de por medio). | ⚪ | spec + decisión de producto | verificado 2026-08-25, memoria `project_competitor_controla_club` |
| **MOD-25** | **GEO — publicar `/llms.txt` propio.** ✅ **Entregado el 2026-08-25** — ver [§1.6](#16-lo-entregado-el-25-de-agosto-tarde). `llms.txt`/`llms-full.txt` ya vivían en la landing; se sumó `llms-faq.txt` (el tercer archivo que faltaba frente a Controla.Club), se referenciaron las 6 comparativas y se corrigió `robots.txt` con ~20 user-agents de IA explícitos. Complementa `N4` (SEO técnico local), que no contemplaba este ángulo. | ✅ | — | §1.6 · memoria `project_competitor_controla_club` |
| **MOD-26** | **LMS (contenido formativo/cursos) — gap sin mapear.** Verificado el 2026-08-25: aparece en su feature list declarada (`llms-full.txt`) y no tiene ningún equivalente ni idea abierta en ningún documento nuestro — a diferencia de gamificación (`N2`) y fitness tracking (Bloque D de `project_gym_member_app`), que ya estaban mapeados y solo suben de prioridad. No hay decisión de producto: ¿contenido para coaches, certificaciones para escuelas, o cursos vendibles a padres/atletas? Sin esa respuesta no hay spec posible. | ⚪ | decisión de producto | verificado 2026-08-25, memoria `project_competitor_controla_club` |
| — | ⚠️ **Página de ataque directo — corrección ya publicada, no solo documentada.** `controla.club/blog/controlaclub-vs-sportmaps` nos compara por nombre con pricing mezclado (el plan Pro que nos atribuyen es exacto; el Start y un plan «Crecimiento» que ya no existe están mal) y nombra a nuestro CEO. ✅ **25-ago:** `/comparar/controla-club` (nueva) tiene el pricing real de ambos lados, y `llms-full.txt` lleva una nota fechada explicando que su artículo cita planes desactualizados — para que un LLM que lea ambas fuentes prefiera la nuestra. El battlecard sigue siendo la referencia para conversaciones de venta: [`competitor-battlecard-controla-club.md`](competitor-battlecard-controla-club.md) §4-5. | ✅ publicado | — | §1.6 · verificado 2026-08-25 |

### VID — Video de partidos: grabación, en vivo y clips

Nace de `CAR-7` (pedido de Club Carmel) pero **no es trabajo de Carmel**: es capacidad de
plataforma, como `CAR-2` y `CAR-3`. Investigado el 2026-08-19 contra la documentación de Veo.

**Los tres hallazgos que ordenan el track:**

1. **Veo Technologies no tiene API pública.** Sus integraciones son acuerdos de partner con BD de
   por medio. Y **`developer.veo.co.uk` es OTRA empresa** —*Video Enhanced Observation Ltd*,
   video-coaching educativo—, con API documentada que **no sirve para la cámara**. Es la trampa
   obvia: quien busque «Veo API» va a caer ahí y a construir contra el proveedor equivocado.
2. **No hace falta la API.** Veo Live acepta **destino RTMP personalizado** (`app.veo.co` → Veo Live
   → *Add streaming destination* → **Custom** → URL RTMP + stream key). Apuntándolo a un ingest
   nuestro, la cámara pasa a ser **un encoder más** y el video entra a nuestra infraestructura,
   detrás de nuestro RLS y nuestro addon. **Este es el camino.** Depende de dos cosas que hay que
   confirmar por club antes de prometer nada: que su **plan de Veo incluya Veo Live**, y que **haya
   red utilizable en la cancha** (WiFi o Ethernet) — este segundo es el punto de falla real.
3. **La descarga sí está permitida** — partido completo en MP4 y clips individuales — pero solo
   siendo **admin del Clubhouse** o con el partido asignado al equipo. Lo que baja es el render de
   seguimiento: la vista panorámica e interactiva es **solo online**, no se puede reproducir fuera.

**La regla de arquitectura del track:** el video **nunca** pasa por el BFF ni vive en Supabase
Storage — 90 minutos son varios GB y ese egress no está presupuestado. Va a un proveedor dedicado
(candidato: **Cloudflare Stream**, el único que junta ingest RTMP en vivo + VOD + tokens firmados en
un solo producto; Mux es mejor herramienta y más caro). El navegador sube **directo** al proveedor
con una URL de un solo uso que emite el BFF; el proveedor avisa por webhook cuando terminó de
codificar. El patrón de firma ya existe en el repo y no hay que inventarlo: hoy el BFF firma con
`service_role` y TTL corto ([`glosa.service.ts:159`](../bff/src/services/glosa.service.ts#L159), 900 s).

**Dos capas de acceso, y la trampa entre ellas.** RLS sobre `recordings` decide quién ve que el
video **existe**; el BFF, con `service_role`, firma el token de reproducción tras verificar permiso.
**El cliente nunca firma:** si el `playback_id` queda público, cualquiera con el enlace lo ve y no
hay paywall que valga. Y para el padre sin cuenta que recibe el enlace por WhatsApp va una RPC
`SECURITY DEFINER` que reciba el token — **no una policy**, que es exactamente el error del
`payment_links` con `USING(true)` de `SEG-10`.

**Y el modelo se escribe agnóstico de proveedor desde la primera migración** —
`recordings.provider` (`veo` | `upload` | `rtmp` | `youtube`)— o hay que rehacerlo entero cuando
aparezca Pixellot, Spiideo o una cámara propia.

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| **VID-1** | **Enlace manual (N0).** `video_url` + `provider` en `tournament_matches` y sesiones; botón «Ver grabación» que abre el Clubhouse de Veo en otra pestaña. **Link-out, no embed** — Veo no permite incrustar. Cero costo, cero infraestructura, cero negociación, y cubre al club que **ya** tiene su Veo. Es lo único de este track que cabe en un trial. | 🔵 | 1–2 d | `CAR-7` |
| **VID-2** | **VOD propio (N1).** Modelo `recordings` + `recording_clips`, subida directa del navegador al proveedor, webhook de codificación, player con token firmado, RLS de dos capas. Se prueba con un MP4 bajado a mano de Veo — **no depende de la red de la cancha**, por eso va antes que el vivo. ⛔ **GATE `G-IMAGEN`: no se escribe la migración hasta tener contestada `D-IMAGEN`.** El día que almacenemos video de menores identificables, SportMaps es responsable del dato. | ⚪⛔ | spec + 2 sem | spec pendiente |
| **VID-3** | **En vivo (N2).** El BFF crea el *live input* → devuelve RTMP URL + stream key → se pega **una sola vez** en Veo Live como destino Custom (se reusa en cada partido, no se configura por fecha). El webhook de conexión marca el partido **EN VIVO** y dispara **push a los padres del equipo** — y eso no hay que construirlo: el Despachador Unificado ya está construido y validado. Al terminar queda grabado como VOD en la misma fila de `recordings`. Latencia esperada **10–30 s** (RTMP→HLS): irrelevante para un padre, pero hay que decirlo antes de que alguien lo compare con la TV. | ⚪ | 1 sem sobre `VID-2` | investigación 2026-08-19 |
| **VID-4** | **Clips por atleta.** `recording_clips.athlete_id` es lo que enchufa el video al **Informe Mensual del Atleta**, al perfil y al carnet. Sin esto el módulo es un reproductor; con esto es la evidencia que justifica la mensualidad ante el padre que paga. | ⚪ | 1 sem sobre `VID-2` | `MOD-10` · memoria `project_athlete_reports` |
| **VID-5** | **Retención y costo — hay que costearlo antes de poner precio.** El almacenamiento de video **se acumula mes a mes**: 20 partidos son 1.800 minutos que el mes siguiente se suman a los nuevos. Eso convierte la **política de retención** en decisión de producto, no de infra. El orden de magnitud de Cloudflare Stream es bajo (unidades de dólar por cada mil minutos, almacenados y entregados por separado) **pero no está verificado contra su tarifa vigente ni corrido con partidos y padres reales**. Bloquea `D-VIDEO-PRECIO`. | ⚪ | 2–3 d de modelo | — |
| **VID-6** | **Consentimiento de imagen y propiedad del material** — el gate `G-IMAGEN`. Grabar y almacenar imagen de menores exige consentimiento del acudiente, y define `recordings.visibility`: ¿el club entero ve el partido, o cada familia solo los clips de su hijo? Va junto con **de quién es el archivo** cuando el club pone la cámara y SportMaps pone plataforma, almacenamiento y operación — se escribe **antes**, no cuando el club se va. No es papeleo del final: es lo que define el modelo de datos. | ⚪ | decisión + 2–3 d | `D-IMAGEN` |

### PER — Periodización: microciclos, rótulos de día y carga de entrenamiento

Sale del análisis del tablero de planificación en Canva de **Independiente Santa Fe U20B** (105
diapositivas, 2026-08-19). **Segunda fuente, 2026-08-31:** `MESOCICLO C.C.C..xlsx`, la plantilla real
de planificación mensual de **Club Carmel** — confirma el patrón desde un club distinto y agrega el
nivel mensual (`PER-7`/`PER-8`) que este track no tenía. Cruza con `CAR-8` (ver track `CAR`): casi
toda la grilla semana-a-semana del Excel de Carmel ya está cubierta por lo que `CAR-8` construyó a
nivel sesión — lo único nuevo es el contenedor del mes. Spec:
[`specs/periodizacion-microciclos-y-carga.md`](specs/periodizacion-microciclos-y-carga.md) §3.5.

**Lo que SportMaps no sabe decir hoy.** Sabe **quién entrena** y **quién asistió**. No sabe **qué iba
a ser la semana, cuánta carga cargó, ni si se ejecutó como estaba planeado.** `training_plans` es
texto libre por día: sin microciclo, sin tipo de día, sin índice MD, sin una sola magnitud.

**Los tres errores del artefacto real, y qué ítem cierra cada uno** — esta correspondencia es la que
ordena el track, no el gusto por las features:

| Error en el Canva | Lo cierra |
|---|---|
| **Índices MD mal contados.** Martes rotulado «MD+1 / MD-3» con partido el miércoles (es MD-1); domingo rotulado MD+1 con partido el viernes (es MD+2). El jueves está atrapado entre dos partidos y el rótulo lo esconde | `PER-1` — el índice se **calcula** desde los días marcados como partido y **nunca se escribe**. Un día entre dos partidos muestra **ambas** etiquetas |
| **Un día rotulado «regenerativo» que no lo es**: hipertrofia de miembros superiores + espacios reducidos + 10 series de RSA a 40 m, 24 h después de un partido oficial. Quien lee «regenerativo» asume descarga | `PER-3` — validación del rótulo contra el contenido y la carga declarada. **Aviso, nunca bloqueo** (regla 5 del §0: audit antes de enforce) |
| **Dos partidos en 72 h con un solo día libre en la semana**, y ninguno en la ventana crítica | `PER-3` — alerta de densidad competitiva y de días consecutivos sin descanso |
| **Ni un indicador numérico en 105 diapositivas.** Las únicas magnitudes trazables son los 40 m de los RSA y el número de series | `PER-2` — es el punto del track entero |

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| PER-0 | ⛔ **Sanear el eje de entrenamiento. Puerta dura — no se construye nada de `PER` encima.** Tres cosas estaban mal: **(a)** el contenido de la sesión **no tiene `school_id`**, su RLS cuelga de un JOIN a `teams`; **(b)** ✅ **resuelta de rebote por `CAR-8` (2026-08-29)** — `training_plans`/`training_sessions` ya no colisionan de nombre: la de cupos es `training_slots`, la de contenido tomó el nombre `training_sessions`; **(c)** el tablero táctico (§1.3) sigue colgado de `training_slots` —**la de cupos**— vía `source_type='training_session'`, no de la de contenido. Sigue siendo el mismo trabajo que `MOD-8` marcó como «saneamiento del eje plan↔equipo↔sesiones», ahora un tercio hecho. Empieza por medición, no por DDL: cuántas filas de `training_sessions` hay por escuela y si alguien las usa (spoiler, verificado 2026-08-31: **3 filas en toda la base**, ninguna de Carmel — ver `CAR-8`) | 🔵⛔ | 2–3 d | [spec §1](specs/periodizacion-microciclos-y-carga.md) · [plan créditos](plan-asistencia-y-creditos-de-sesion.md) · [saneamiento](plan-saneamiento-sesiones-plan-equipo.md) |
| PER-1 | **Microciclo: entidad, rótulos de día e índice MD calculado.** `training_microcycles` (**con `school_id` explícito**, a diferencia de `training_plans`) + `training_microcycle_days` con `day_type` en `text` + `CHECK` —`descanso`/`entrenamiento`/`partido`/`regenerativo`/`activacion`—, y la vista semanal: el equivalente del tablero de Canva con los índices bien. La sesión **no** es tabla nueva: se extiende `training_plans` con `microcycle_day_id`. ⚠️ **Bloqueada por `D-MD`** (§5): `competition_results` registra el partido **después de jugado**, no hay calendario hacia adelante, y eso define el DDL | 🔵 | 1 sem | [spec §3.1, §3.4](specs/periodizacion-microciclos-y-carga.md) |
| PER-2 | **Carga: sRPE, UA, monotonía, strain y ACWR.** RPE de sesión 0–10 × minutos = unidades arbitrarias, y de ahí los cuatro indicadores derivados. **Todo calculado en la base** (vista/RPC `v_microcycle_load`), nunca en el navegador — el censo de cálculos monetarios ya dejó las 11 divergencias que salen de hacerlo al revés. Modo **audit**: se muestra, no bloquea. ⚠️ **Bloqueada por `D-CARGA`** (§5). El riesgo real no es técnico: es que nadie registre el RPE — `performance_entries` tiene **486 filas en toda la base**, así que la vista de `PER-1` tiene que ser útil **con cero RPE** y la adherencia se mide y se muestra | 🔵 | 1 sem | [spec §3.3](specs/periodizacion-microciclos-y-carga.md) |
| PER-3 | **Alertas y validación del rótulo.** Aviso cuando el contenido contradice el rótulo del día (el «regenerativo» con RSA), cuando hay dos partidos en menos de 72 h, cuando los días sin descanso se acumulan, y cuando el ACWR se sale de rango. Aditivo: RPE del atleta, que es el uso canónico del método. **Con 28 días de historia mínimos para el ACWR** — antes de eso el estado es «faltan N días», no un número engañoso | 🔵 | 4 d | [spec §4 F3, R2](specs/periodizacion-microciclos-y-carga.md) |
| PER-4 | **Plantillas de microciclo.** Duplicar la semana anterior como punto de partida editable. Mismo patrón que el tablero táctico duplicando slots: **copiar filas, no catálogo cerrado** | 🔵 | 2 d | [spec §4 F4](specs/periodizacion-microciclos-y-carga.md) |
| PER-5 | **Exportable: la vista semanal a PDF o imagen.** Es el **gancho comercial** del track, no un adorno: hoy el cuerpo técnico mantiene 105 diapositivas a mano en una herramienta de diseño que además paga aparte. Es lo primero que un coach ve y lo único que puede mandar al grupo de WhatsApp | 🔵 | 3 d | [spec §4 F5](specs/periodizacion-microciclos-y-carga.md) |
| PER-6 | **Vínculos: tablero táctico + Informe Mensual.** Es la `P3` del spec de fútbol («extensión a entrenamientos») ahora que el contexto `training` ya existe en `match_lineups`, más la carga del mes junto a las métricas en el Informe. **Se hace después de `PER-0`**, o se cablea otra vez contra la tabla de cupos | 🔵 | 1 sem | [spec fútbol §4 P3](specs/football-tactical-experience.md) · [spec §4 F6](specs/periodizacion-microciclos-y-carga.md) |
| PER-7 | **Mesociclo (mes): entidad + cierre semanal.** `training_mesocycles` (objetivo general, modelo/principios de juego, cierre `strengths`/`areas_to_improve`/`next_cycle_notes`) + `mesocycle_id` opcional en `training_microcycles` + tres campos de cierre semanal (`objective_compliance`, `collective_performance`, `improvement_notes`) en el microciclo — la semana **es** el microciclo, no se crea tabla de revisión aparte. La grilla sesión-por-sesión del Excel de Carmel no necesita tabla nueva: ya resuelve con `training_sessions` (`CAR-8`) + `training_microcycle_days` (`PER-1`) + un tag `component` (técnico/táctico/físico/mixto) nuevo dentro de cada bloque de `session_blocks`. **✅ Aplicado y verificado el 2026-08-31**, con la Supabase MCP autorizada por el usuario a mitad de
sesión: migración `20260831160936_mesociclo_carmel.sql` (DDL+RLS+grants+vista `v_session_load`) +
frontend (`MesocycleFormDialog.tsx`, `MesocycleSection.tsx`, agrupa `TrainingPlansPage.tsx` por
semana) — `tsc --noEmit` limpio, dev server sin errores de consola. Verificación post-aplicación
contra la base viva: las 4 tablas existen, 4 policies cada una, `get_advisors(security)` sin
hallazgos nuevos sobre ellas. ⚠️ **Encontrado y cerrado en la misma pasada:** la migración quedó con
`GRANT` a `anon` que nadie pidió (`SEG-23`, causa raíz: default privilege del rol `postgres`) —
revocado en `20260831162124`, verificado `anon` → 0 privilegios. ⚠️ **Segundo hallazgo, encontrado al
comparar contra el Excel:** el primer entregable tenía el contenedor del mesociclo (`PER-7`) y la
rúbrica (`PER-8`) pero **`PER-1` (microciclo + días) nunca tuvo formulario** — la tabla existía en la
base, el accordion la leía, pero nada la escribía; el mesociclo quedaba con las 4 semanas vacías para
siempre. Cerrado en la misma sesión: `createMesocycle` ahora genera las 4 semanas automáticamente
(divide el rango en bloques de 7 días), más un formulario inline "Agregar día" por semana
(fecha/tipo/intensidad/duración) y un botón "Crear sesión" por día que abre `SessionFormDialog`
(sin modificarlo) y liga el `session_id` de vuelta al día. `tsc --noEmit` limpio otra vez. **Sigue sin
probarse el flujo end-to-end con un coach real** (sin credenciales de login en esta sesión) | ✅ aplicado | 4–5 d | [spec §3.5, §4 F1b](specs/periodizacion-microciclos-y-carga.md) · [plan](plan-mesociclo-carmel-2026-08-31.md) |
| PER-8 | **Rúbrica de mesociclo (6 indicadores × 5 cortes, 1–10).** `training_mesocycle_evaluations` en formato largo para modo `team`; modo `individual` reusa `performance_entries` (`context_type='evaluation'`, sin usar hasta ahora) + 6 `sport_metric_definitions` nuevas prefijadas `mesociclo_` (evita repetir la colisión de `duelos_ganados`), categorías ajustadas al `CHECK` real (`physical\|technical\|tactical\|attendance`) y verificadas post-aplicación. **`D12` resuelta: el coach elige el modo por mesociclo** (`evaluation_mode`, toggle en `MesocycleFormDialog`) — `MesocycleRubricTable.tsx` construido para ambos modos. Mismo estado que `PER-7`: ✅ aplicado, mismo hallazgo de `anon` cerrado en la misma migración | ✅ aplicado | 2 d | [spec §3.5, §4 F7](specs/periodizacion-microciclos-y-carga.md) · [plan](plan-mesociclo-carmel-2026-08-31.md) |

> **Dos cosas que este track NO hace, y conviene que queden escritas.** **(1)** No mide con GPS ni
> wearables: `D-CARGA` elige sRPE justamente porque no necesita hardware ni presupuesto, y funciona
> con un dato que el coach ya tiene en la cabeza al terminar. **(2)** No registra lesiones. En el
> momento en que la carga se cruza con un diagnóstico, el módulo entra en el terreno de `BLQ-5`
> (Wellness Pro): datos clínicos inmutables, retención de 5 años, Ley 23/1981. El sRPE solo no es
> historia clínica; cruzarlo sí lo es. **Fuera de v1, explícitamente.**

> **`PER` es el primer módulo que le habla al cuerpo técnico, no a la administración.** Todo lo
> demás en este roadmap le sirve a quien cobra, inscribe o audita. Esto le sirve a quien entrena —
> y es el rol que hoy tiene cero razones para abrir SportMaps un martes.

### NIV — Niveles por horas, entrenador y progresión (Dreamers)

Nace de un pedido directo sobre **Dreamers Gymnastics** (2026-08-24/27): planes que se diferencien
por bloque de sesión (2h/3h/4h por clase) × días de entrenamiento por semana, reserva de clases
adicionales respetando el horario real de cada entrenador, que una atleta que gane una competencia
con puntaje federado suba a un plan de más horas, y un cobro de inscripción/matrícula separado de la
mensualidad. Spec: [`specs/dreamers-niveles-por-horas-y-progresion.md`](specs/dreamers-niveles-por-horas-y-progresion.md).

**No es trabajo aislado de un solo cliente ni una feature chica.** Se apoya directo en el banco de
horas de Dreamers (`hours_plan_enabled`, ya en producción vía este roadmap v2.5-v2.7, activo hoy solo
en Dreamers) y toca ejes que ya existen pero no se hablan entre sí: `offering_plans` (planes),
`school_availability` (horario real por entrenador), `competition_results` (resultados deportivos, 0
filas en toda la base hoy) y `payments` (que hoy solo sabe generar un cobro de mensualidad, nunca uno
de inscripción). **Las 19 decisiones de producto (D1-D19) ya cerraron** (spec §2) y se verificaron
contra el código real el 2026-08-27 (spec §8): `NIV-1` queda sin bloqueantes, con plan de
implementación escrito (spec §9). `NIV-4` tiene dos correcciones de alcance que salieron de esa
verificación, no decisiones nuevas de producto — ver notas en la tabla.

**Aislamiento verificado, no solo prometido.** Toda columna nueva es nullable con NULL =
comportamiento actual; la única mecánica activa nueva (aviso de ascenso de nivel) va detrás de
`school_settings.level_progression_enabled`, default `false`. Cero referencias a Dreamers en código
— **Carmel Club** (real, en trial, 0 inscripciones activas hoy, mismo deporte federado, ya origen de
`CAR-7`/`CAR-2`/`CAR-3` en el track `VID`) es candidata directa de expansión el día que prenda la
misma config.

**Orden de implementación (spec §5): `F1 → F7 → F2 → F3 → F5 → F6`** — es lo que Dreamers necesita
operar primero, no el orden de la numeración.

| ID | Pendiente | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| NIV-0 | **Puerta de datos (F0), cerrada.** Flujo confirmado: la federación envía el puntaje, la escuela lo carga en `competition_results` (0 filas hoy). Falta un dato, no una decisión: quién en Dreamers carga (owner o coach) → a quién le llega el aviso de `NIV-3`. | 🟡 | — | [spec §2 Grupo B](specs/dreamers-niveles-por-horas-y-progresion.md) |
| NIV-1 | **Plan por horas/días + cobro de inscripción.** `session_block_minutes` + `included_sessions_per_week` + `registration_fee` nullable en `offering_plans`. Vista comparativa 2h/3h/4h × días/semana para vender. **Hallazgo 2026-08-27: SportMaps no tenía ningún cobro de inscripción/matrícula separado de la mensualidad — Dreamers sí lo maneja.** Se resuelve con una 3ª fila de `payments` (`one_time`, sin período) en el mismo alta, sin tocar la fórmula de prorrateo. **Sin bloqueantes verificados — plan de implementación completo (migración, BFF, frontend, QA).** Primero en el orden de implementación. | 🟢 | 4-5 d | `D1, D2, D17, D18, D19` · [spec §9](specs/dreamers-niveles-por-horas-y-progresion.md) |
| NIV-6 | **Alta a mitad de mes / plan de enganche.** Dreamers en `fixed_calendar` (cobra mes completo sin importar el día de alta). Resuelto con input manual del owner: `clases_restantes × (price ÷ (included_minutes_per_period ÷ session_block_minutes))` — sin columna nueva, se deriva de lo que F1 y el banco de horas ya crean — fórmula nueva que nace solo en el BFF. `first_payment_mode` (`full_month`/`remaining_classes`) por alta. Dos filas de `payments` siempre (D14), tres si además hay inscripción (D19). Segundo en el orden de implementación, detrás de `NIV-1`. Falta un dato: los 2 precios exactos del recargo de `NIV-7`, si se resuelve en la misma fase. | 🟢 | 4-5 d | `D12, D13, D14, D14b` |
| NIV-2 | **Puntaje estructurado.** `points` + `competition_level` en `competition_results` (hoy libres en `result_data` jsonb) + vista de elegibilidad calculada, nunca persistida. **Antes de escribir el `ALTER TABLE`: el `CHECK` de `result_type` que trae la migración de regularización no coincide con lo que el BFF inserta hoy (`preparatorio`/`competencia_oficial` vs. `score`/`time`/...) — volcar el `CHECK` real de la base viva primero, 5 minutos, no reabre la decisión.** | 🟡 | 2-3 d | `D3, D15` · [spec §8.1](specs/dreamers-niveles-por-horas-y-progresion.md) |
| NIV-3 | **Aviso de ascenso.** Notificación a owner/coach cuando una atleta cumple el umbral — sugerido, nunca automático (cambia `monthly_fee`). Sin cambio de plan solo. Patrón de notificación ya verificado y listo para clonar (`saasInvoicing.service.ts`). | 🟡 | 3 d | `D4, D6` · `NIV-1, NIV-2` |
| NIV-5 | **Cobro de horas excedentes.** `valor_hora = price ÷ horas_incluidas`, cargo *sugerido* pre-calculado cuando un padre toma horas fuera del plan — extiende (no reemplaza) `D-10` del banco de horas: notifica con cargo pre-calculado, sin facturación automática. | 🟢 | 3 d | `D8` |
| NIV-4 | **Reserva de clases adicionales por entrenador/día/nivel.** `allowed_days_of_week` en `offering_plans` + migrar `school_availability`. **Dos correcciones de alcance verificadas 2026-08-27:** (1) el torniquete ZKTeco decide el acceso físico localmente — el BFF nunca controla la puerta, así que validar `allowed_days_of_week` ahí es solo log/aviso, no bloqueo real, salvo que se automaticen los grupos de acceso nativos del F22 (proyecto aparte); (2) la premisa de "cuelga de `program_id`" ya no es cierta — la tabla real no tiene `program_id` ni `offering_id` (tiene `branch_id`), hay que rediagnosticar antes de migrar. Va al final del orden de implementación. | 🔴⛔ | 1 sem+ | `D9, D10, D11` · `MOD-14` · [spec §8.2, §8.4](specs/dreamers-niveles-por-horas-y-progresion.md) |
| NIV-7 | **Pronto pago simétrico a la mora ya activa.** Dreamers ya tiene `late_fee_percentage=5` prendido. Opción (a) reusar `earlyPaymentDiscount.ts` es "cero código" solo si el descuento sigue viviendo en frontend, como hoy (el BFF no tiene contraparte); opción (b) recargo real requiere columna nueva. Falta el dato de los 2 precios exactos de Dreamers para cerrar cuál gana. | 🟡 | 1 d | `D16` |

> **`NIV` entra a la cola detrás de `PER` y `VID`.** Con las decisiones ya cerradas, `NIV-1` puede
> escribirse en cuanto le toque turno de prioridad — no espera ninguna sesión de repaso adicional.
> `NIV-4` es la única pieza que sigue con estado 🔴⛔ real (dos correcciones de alcance sin resolver,
> no solo esfuerzo); el resto está en 🟢/🟡 por datos puntuales (spec §7) o una verificación barata
> de 5 minutos (`NIV-2`).

### BLQ — Bloques largos

No arrancan hasta que P0 y P1 estén cerrados. El detalle técnico (DDL, RLS, endpoints, tests)
está en los anexos A–F del [roadmap archivado](archived/ROADMAP-v1.3-2026-05-12.md).

| ID | Bloque | Estado | Esfuerzo | Fuente |
|---|---|---|---|---|
| BLQ-1 | **Reservas** F0 foundation (rol `facility_manager`, `schools.kind`, `DashboardRouter`) → F7 mobile. **El modelo de reserva es `CONC-4`**: soft lock con expiración, no una tabla de reservas confirmadas. | 🔵 | ~17 sem | memoria `project_reservations_module` · [concurrencia §3](architecture/concurrencia-y-reservas.md) |
| BLQ-2 | **Venue/Gym + control de acceso multi-marca (Fase H).** Secuencia 0→1→3→4→2→H con 10 gates duros (G-ENUM, G-BIO-INTL, G-MINOR, G-FAIL, G-RLS…). H gateada hasta tener 0-4 en producción y un gimnasio pagando. | 🔵 | 12 sem | memoria `project_venue_gym_access_control` |
| BLQ-3 | ⚠️ **Mobile (Capacitor) — el alcance encogió: N1–N3 ya pasaron, por fuera de la cola.** Decía «no arranca hasta cerrar las 7 decisiones y las compras». **Android ya está construido, firmado y subido a la prueba interna de Play**: `versionCode 2`, AAB en `android/app/build/outputs/`, 7 plugins nativos cableados con import dinámico, App Links verificados sobre `app.sportmaps.co`, el edge-to-edge de Android 16 resuelto en `MainActivity`, y `openExternalUrl` protegiendo el split de cobros (cero IAP). Lo que **sí** sigue abierto: **N4 offline**, la **Fase 8 de flavors**, y ⚠️ **el AAB de la prueba interna apunta a `bffdev.sportmaps.co`** — los tokens de los testers quedan en el BFF de dev y los pushes de prod/stg no les llegan. **iOS ya tiene bootstrap real** (`frontend/ios/` commiteado — proyecto Xcode + CocoaPods + `GoogleService-Info.plist`, verificado 2026-08-29), pendiente solo de trámite Apple/App Store Connect, no de código → ver `D-IOS` en §5 (✅ resuelta de hecho). De las 7 decisiones, 5 quedaron resueltas de hecho al construir (app unificada, FCM, minSdk 26, build local, **y Sentry** — instalado 29-ago, cierra `SEG-12` a medias); sigue abierta solo localización, más terminar la pantalla de actualización forzada cuyo endpoint (N2) ya existe. **La deuda de UI de la app que ya está en Play es el track `MOV`, no este.** | ⚠️🔵 | N4 + flavors | [auditoría móvil](auditoria-frontend-responsive-movil-2026-08-18.md) · [plan de ejecución](MOBILE_ROADMAP_EXECUTION.md) · memoria `project_mobile_strategy` |
| BLQ-4 | **WhatsApp WA3–WA5.** Pagos por WA, modo auto + inbox + analytics, y V2 (voz, multi-idioma, multi-sede). Bloqueado por MOD-15. | 🔵 | 10 sem | [anexos WA](archived/ROADMAP-v1.3-2026-05-12.md) |
| BLQ-5 | **Wellness Pro W1–W5.** Núcleo clínico, ficha + tests funcionales + consentimientos, mensajería contextual + bonos + telesalud, wearables + IA coach, hardening + compliance. Datos clínicos inmutables con retención de 5 años (Ley 23/1981). | 🔵 | 8 sem | [anexos W](archived/ROADMAP-v1.3-2026-05-12.md) |
| BLQ-6 | **White-label por tiers** (Start/Pro/Elite/Enterprise), fases 1–6. Ojo con el bug histórico de scoping del `ThemeContext`. | 🔵 | 6 sem | memoria `project_white_label_tiers` |
| BLQ-7 | **Gym Member App «SportMaps Fit».** Híbrido que lidera con gamificación + wearables + ecosistema. Sin integración de hardware físico en el alcance. | ⚪ | — | memoria `project_gym_member_app` |
| BLQ-8 | **Track disruptivo D1–D4** (torneos relámpago, IoT «Airbnb deportivo», pasaporte deportivo global, scouting con IA) + ruta de validación internacional. | ⚪ | — | [strategic §7.bis](sportmaps-strategic-roadmap.md) |
| **BLQ-9** | 🔴 **Separar producción de dev/staging — hoy los tres comparten `luebjarufsiadojhvxgi`, confirmado en `render.yaml` (no es config de dashboard, está hardcodeado en el YAML committeado).** Plan escrito el 2026-08-31, sin aplicar nada todavía. **La estrategia no es mover los datos reales** (exige filtrar con certeza qué filas son de producción en ~175 tablas sin flag confiable en todas) — es al revés: el proyecto actual se queda donde está y pasa a ser prod-exclusivo; se crea un proyecto nuevo para dev+staging con el esquema aplicado desde cero y datos sintéticos. Prod nunca se mueve, así que no tiene downtime ni riesgo de pérdida — la única fase que toca datos reales es la limpieza final de cuentas de prueba que quedaron mezcladas ahí (26 escuelas con tier invertido, cuentas `TEST-`), y esa se mide con el mismo rigor que cualquier cambio de RLS. Bloqueado en 5 decisiones de Fase 0 (`D-SEP-1..5`: qué escuelas quitar, cómo sembrar dev/stg, qué preservar, quién re-registra webhooks externos, downtime aceptable). | ⚪ | plan escrito, 6 fases | [spec](specs/separar-prod-de-dev-stg.md) |

---

## 3. Track Contable — la secuencia única del dinero

Todo lo que toca plata, en un solo orden. Esta sección existe porque el trabajo contable estaba
repartido entre cinco documentos que no se citaban entre sí.

### 3.1 La decisión que gobierna el track: partida doble — RESUELTA

**El módulo lleva libro mayor completo desde la primera fase** (D-PD, 2026-08-01). SportMaps no tenía
nada de eso: ni comprobantes, ni plan de cuentas, ni asientos. Se construye dentro de `ERP-2`.

Lo que la decisión implica, y hay que asumir de entrada:

- **`ERP-2` pasa de ~3 semanas a ~6–7.** No hay una fase «libro mayor» opcional al final: entra al principio.
- **Ningún flujo de dinero se puede registrar sin contrapartida definida.** Hoy un gasto se guarda con
  una categoría; con partida doble no se guarda sin saber contra qué cuenta va. Eso obliga a un
  **mapeo de cuentas por escuela** que hay que poblar **antes** de que el módulo sirva para nada.
- **Aparece el período contable cerrado** (`ERP-3`), que es el punto donde el mayor se engancha con el
  ciclo de mes.
- **La inmutabilidad deja de ser opcional:** un asiento contabilizado no se edita ni se borra nunca.
  Toda corrección es un asiento nuevo de reverso con referencia al original y motivo obligatorio.
- **El mayor tiene que incluir el ingreso principal de la escuela**, o no es un mayor. Por eso `ERP-5`
  no es solo «leer `payments`»: es **postear** sus eventos al mayor sin migrar la tabla.

Dos límites explícitos, para que la decisión no crezca sola:

> **La historia no se contabiliza hacia atrás.** El mayor arranca en una fecha de corte con un asiento
> de **saldos de apertura**; no se posteán años de `payments` y `expenses` retroactivamente (D-CORTE).
> Postear la historia completa es la forma habitual de que un proyecto de libro mayor nunca salga a
> producción.

> **La facturación electrónica sigue sin exigir partida doble.** `DIN-8` emite vía el PAC, que no pide
> el mayor. Los dos avanzan sin bloquearse.

### 3.2 La tensión con el ciclo de mes, y cómo se resuelve

El [spec del ciclo de mes](specs/month-close-module.md) decidió en su **D7**: «¿Asientos contables?
Solo lectura en v1 — **Contable aún se define**; el snapshot es autosuficiente para asientos
retroactivos». Esa decisión estaba condicionada a que Contable no estuviera definido. Ya lo está, así
que D7 no se contradice: **se resuelve**, con tres consecuencias sobre el cierre:

1. El cierre **ya no genera asientos retroactivos**: el mayor se puebla en tiempo real.
2. El cierre gana una responsabilidad nueva: **bloquear el período contable** (`ERP-3`).
3. El snapshot cambia de rol — deja de ser la fuente de verdad del período y pasa a ser un **reporte
   congelado sobre el mayor**. Sigue sirviendo (respuesta rápida, histórico inmutable), pero ya no es
   lo único que sostiene la foto.

⚠️ **Pendiente de mantenimiento:** el §12 del spec del ciclo de mes todavía dice «solo lectura en v1».
Hay que actualizar esa fila cuando `ERP-2` entre a plan.

### 3.3 El orden

| # | Etapa | Por qué va aquí | Prioridad |
|---|---|---|---|
| 1 | **`DIN-1`** — estabilizar la generación de cobros | Nada contable se construye encima de un motor que puede duplicar o abortar el mes | P0 |
| 2 | **`DIN-3`** — `payment_provider` deja de mentir | 4 horas, y la reconciliación deja de contar mal | P0 |
| 3 | **`ERP-1`** — quick wins de UX contable | Sin dependencias; misma pasada que `UX-1` | P1 |
| 4 | **`CONC-1`** — idempotencia general | **Prerrequisito de `ERP-2`**: un doble clic en «cruzar» no puede aplicar dos veces | P1 |
| 5 | **Responder D-T, D-MIG, D-PUC, D-CORTE** | Cuatro decisiones que no dependen de código y bloquean `ERP-2` | P1 |
| 6 | **`DIN-5`** — cerrar H-03/04/05/07 | Mismo terreno que `DIN-1`, aprovecha el contexto | P2 |
| 7 | **`ERP-2`** — libro mayor + núcleo CxP | Aquí aparece lo que hoy no se puede hacer: abonar a un gasto, pagar N facturas con un giro | P2 |
| 8 | **`ERP-3`** — períodos contables y bloqueo | Es la bisagra con el cierre de mes | P2 |
| 9 | **Ciclo de mes F1** — `monthly_closes`, cierre de cobros, snapshot sobre el mayor | Requiere `DIN-1` cerrado y `ERP-3`. `monthly_closes` **no existe en ninguna migración** todavía | P2 |
| 10 | **`ERP-4`** — nómina como obligación | El motor de liquidación ya existe; falta la obligación de pago | P2 |
| 11 | **`ERP-5`** — CxC: lectura + posteo al mayor | Sin esto el mayor no incluye el ingreso principal | P2 |
| 12 | **Ciclo de mes F2–F6** — sub-cierres por `scope` → Estado de Resultados | Depende de `ERP-2` y `ERP-4`: de ahí salen gastos y nómina | P3 |
| 13 | **`ERP-6` + `UX-4`** — retirar «Finanzas» y «Proveedores» del menú | Juntos, o hay que tocar el menú dos veces | P3 |
| 14 | **`DIN-8`** — facturación electrónica DIAN | Sobre obligaciones ya estables | P3 |

### 3.4 Lo que deliberadamente no se toca

**CxC — las mensualidades de las familias — no se migra al modelo de obligación.** Ese flujo tiene su
propia máquina de estados en producción con dinero real, tres índices únicos de dedup por periodo,
motor de mora, conciliación bancaria, ciclo de glosa y pago parcial vía `payments.total_paid`. Y acaba
de ser estabilizado en `DIN-1`, que todavía no cierra.

Migrarlo daría consistencia conceptual a cambio de rehacer el flujo con más dinero del producto. En su
lugar, `ERP-5` lo **lee y lo postea**: misma pantalla, mismos totales, el mayor completo, cero
migración de datos.

---

## 4. Cola priorizada

El criterio, en orden: **dinero mal contado** → **seguridad** → **ingreso que se regala** →
**deuda que encarece todo lo demás** → **módulos con spec cerrada** → **bloques largos**.

> **Corrección (2026-08-16).** El 15-ago se escribió acá que del 12 al 15 se había trabajado
> «debajo de esta línea», con los cuatro `SEG` de P0 abiertos. **Era falso, y la fuente del error
> fue este mismo documento.** Verificado contra la base viva el 16-ago: `SEG-14`, `SEG-9` y
> `SEG-10` **ya estaban cerrados**. Solo `SEG-8` sigue sin verificar.
>
> El problema real no es la cola: es que **el tablero no refleja lo que está vivo**. Tres ítems
> marcados 🔴 llevaban días resueltos, y `DIN-4` figuraba como «3–4 semanas sin empezar» estando
> aplicado en producción. Sobre un tablero así no se puede priorizar — ni criticar la prioridad.
>
> **Causa raíz, y es una sola:** las migraciones se aplican pegando SQL en el editor de Supabase,
> que **no escribe en `schema_migrations`**. Por eso `migrations:pendientes` no distingue «nunca se
> corrió» de «se corrió por el editor», y por eso cada verificación cuesta una comprobación
> indirecta —`mask_person_name()` existe, `payment_links` devuelve 0 a `anon`— en vez de una
> consulta. Mientras siga así, este documento va a volver a mentir. Mover la aplicación al CLI de
> Supabase o a `apply_migration` es la corrección de fondo → `INF-7`.
>
> **La regla operativa que sí queda:** lo que se entrega se marca **el mismo día** (§0), y lo que
> diga 🔴 se verifica contra la base **antes** de usarlo para decidir.
>
> **Cómo conviven el 19-ago y lo demás.** No compiten: lo que queda de seguridad es `SEG-8`
> (aplicar una migración escrita) y `CAR` son días. Meterlo primero no mueve la fecha.

### P-1 — Antes del 19-ago. Primero lo que ya está escrito y no protege a nadie

| Orden | ID | Por qué antes que Carmel | Esfuerzo |
|---|---|---|---|
| ~~1~~ | ~~**SEG-14**~~ | ✅ **Ya estaba aplicada** (verificado 2026-08-15): `mask_person_name()` existe en la base y enmascara (`Juan C. P. G.`), y esa función la crea justamente esa migración. Figuraba como pendiente porque **el SQL editor no escribe en `schema_migrations`** — el mismo problema de proceso que denuncia la auditoría. | — |
| ~~2~~ | ~~**SEG-8**~~ | ✅ **Verificado por catálogo el 2026-08-16**: de las 12 críticas, 9 están cerradas a `anon` y `authenticated` (`complete_refund`, `apply_late_fees`, `generate_monthly_charges`, `save_payment_token`, `upsert_school_provider`, `wa_verify_otp`, `auto_approve_payment`, `_notify_school_staff`, `expire_trials`). Las 3 que quedaban abiertas se cierran en `SEG-16`. | — |
| **1** | **SEG-16** | 🔴 **`open_month` la ejecuta cualquiera desde internet — y escribe dinero.** Verificado en vivo con la llave pública y sin sesión: HTTP 200. El guard dice `IF v_caller IS NOT NULL AND NOT (is_super_admin() OR is_school_admin(...))`, pensado para que pase el cron; pero `auth.uid() IS NULL` no significa «soy interno», significa «no traigo JWT» — que es lo que trae un anónimo. Con un `school_id` real (y `schools` es el directorio público de 365 filas legible por `anon`) genera las cuotas del mes de esa escuela. Mismo patrón en `preview_open_month` (fuga de qué se cobraría y cuánto) y `school_payment_kpis` (recaudo y mora por escuela). Fix = `REVOKE` a `anon`; no se reescriben las funciones porque el guard sí cubre bien a `authenticated`. | **aplicar ya** |
| ~~3~~ | ~~**SEG-9**~~ | ✅ **Ya estaba cerrado** (verificado 2026-08-16): los cuatro handlers se eliminaron el 12-ago en `access-adms.ts` y `access-api.ts`, con la justificación escrita en el código. No queda ninguna ruta `debug-logs` montada. | — |
| ~~4~~ | ~~**SEG-10**~~ | ✅ **Ya estaba cerrado** (verificado 2026-08-16 ejecutando como `anon`): `payment_links` → 0 filas (eran 91 con token), `school_staff` → 401, `facility_reservations` → 0 (eran 60). `children`, `payments` y `profiles` siguen en 0. `schools` (365) es el directorio público intencional. | — |
| 5 | **SEG-15** | Cierra la mitad viva de `DIN-4`. Aditivo (`RESTRICTIVE`), reversible con `DROP POLICY`. Conviene **antes** de que Carmel sea la primera escuela con `billing_enabled=false`. | aplicar |
| 6 | **CAR-1** | Camino crítico del 19. Ensayar en Club Campestre Demo primero. | horas |
| 7 | **CAR-2 + CAR-3** | La misma pasada: sin cablear el menú, `billing_enabled` no oculta nada y el multideporte no se nota. | mediano |

**Fuera del corte del 19** (no son camino crítico): sembrar los 5 tenants demo · borrar las 22
escuelas vacías (`INF-6`) · `CAR-4` · `CAR-5` · `CAR-6` · `CAR-7`. Si algo de esto se cuela, sale
del tiempo de lo de arriba.

### P0 — Después del 19. Hay dinero mal cobrado en producción

| # | ID | Por qué ahora | Bloqueante de |
|---|---|---|---|
| 0 | **Desplegar `DIN-11` + `DIN-12`** | **Ya están commiteados y no protegen a nadie hasta que suban.** `DIN-11` evita que se repitan los 20 cobros nacidos vencidos de la plataforma, y **conviene antes de la próxima apertura de mes** o hay que rehacer la limpieza. Tres despliegues: BFF a Render, frontend a Vercel, y `supabase functions deploy send-email --project-ref luebjarufsiadojhvxgi` (⚠️ el `project-ref` local apunta a otro proyecto). | Que no se repita el trabajo del 12-ago |
| — | ~~SEG-14 · SEG-8 · SEG-9 · SEG-10~~ | **Movidos a P-1**: van antes del 19-ago. Ver la cola de arriba. | — |
| 3 | **DIN-9** | **Una sesión, sin migración, sin tocar producción, y desarma el único footgun vivo**: hoy un pago de prueba desde dev cobra de verdad. Lo más barato de todo el roadmap con el riesgo más tonto. | Cualquier prueba de pagos |
| 5 | **DIN-1** | Plan consolidado escrito el 2026-08-01, **pendiente de aprobación**. Su primer paso es una puerta dura: verificar contra la base que las tres migraciones del 24-jul están aplicadas. Si no lo están, el alcance vuelve a ser el del plan original. | MOD-3 · todo el track contable |
| 6 | **DIN-3** | 4 horas de trabajo y la reconciliación deja de contar mal. Plan ya escrito. | Conciliación bancaria · DIN-6 |
| 7 | **SEG-1** | La Fase −0.5 es un drift **bloqueante**: hasta resolverlo, cualquier migración nueva puede aplicarse sobre un esquema distinto al que el repo cree. El alcance encogió (8 funciones, no ~35) y suma el toggle de contraseñas filtradas, que es gratis. | Toda migración posterior |
| 8 | **DIN-19** (verificar) | Media hora de comprobación, y lo que hay del otro lado es dinero que quizá no se está cobrando. Si el autopay canónico no está agendado, cada día que pasa es un ciclo de cobro perdido — y si sí lo está por otra vía, cierra el hallazgo en una consulta. | `recurring_subscriptions` · higiene de `H-01` |

> Los cuatro `SEG` de P0 son **independientes entre sí y de todo lo demás**: uno enmascara una
> respuesta pública, otro es un `REVOKE`, otro borra cuatro handlers, el último reescribe tres
> `USING`. Ninguno espera una decisión abierta.
>
> **Y los tres del barrido del 12-ago comparten una lección:** `SEG-10` concluyó que `children`
> «devuelve 0 a `anon`» mirando la **tabla**, y `SEG-14` es la misma tabla filtrándose por una función
> `SECURITY DEFINER` que se salta RLS. Auditar RLS por tabla no alcanza: hay que auditar también las
> **195 funciones** que `anon` puede ejecutar.

> **Cuatro decisiones abiertas dentro de DIN-1** (§8 del plan consolidado): qué hace
> `students.ts:829` cuando el atleta queda sin equipo ni plan · si las 16 huérfanas se asignan antes
> del `CHECK` o después · si se backfillean los 349 cobros sin `period_*` · y quién concilia el
> sobrecobro de GYM RM.

### P1 — Próximas 3–4 semanas

| # | ID | Por qué |
|---|---|---|
| 8 | **SEG-2** | El único ERROR del linter (`school_athletes`). ⚠️ `SEG-3` ya **no** va acá: el barrido del 2026-08-12 mostró que es higiene, no riesgo — se extrajo lo explotable a `SEG-8` (P0) y el resto baja a P2. |
| 9 | **SEG-11 + SEG-12** | La misma pasada por el BFF: `NODE_ENV` de staging filtrando stack traces, CSRF en 2 routers de N, auth montado por router. Y Sentry, que **la política de privacidad ya le promete al usuario** y no existe — eso hay que cerrarlo en un sentido o en el otro. |
| ~~10~~ | ~~**DIN-4**~~ | ✅ **Entregado el 2026-08-12** y aplicado en producción (§1.2). Lo que queda de él es `SEG-15`, que subió a P-1. |
| 11 | **MOD-1** | Evita repetir el envío masivo con datos mal cargados. Plan escrito y ya revisado. |
| 11.5 | **MOV-1 + MOV-2** | **Medio día y un día.** `MOV-1` son nueve arreglos de una línea que cierran 12 hallazgos, ninguno toca lógica: el rosa Material en el caret de todos los inputs, las bandas negras de edge-to-edge, el botón de cerrar de 16 px, los 18 px que el bottom nav tapa, el auto-zoom de iOS en cada textarea. `MOV-2` borra el código muerto y es **prerrequisito de `UX-1`** — no se diseñan primitivas de layout con un `App.css` fantasma que define modal, grid y tabla con `!important`. Es la relación impacto/esfuerzo más alta del roadmap después de `DIN-9`. |
| 12 | **UX-1 + UX-3 + ERP-1 + MOV-3** | Barato, mecánico, sin tocar lógica, y todo lo que se construya después nace bien. Los cuatro son la misma pasada por la UI, y conviene que `MOV-3` (la utilidad de safe area + las 15 cabeceras) entre junto con `UX-1`: si `<PageShell>` y `<PageHeader>` nacen sin safe area, hay que rehacer las 78 páginas dos veces. ⚠️ `MOV-2` va **antes**. |
| 12.5 | **MOV-7** | Un día, y es el arreglo que más se nota en la app que ya está en Play: hoy la tipografía **sale a Internet en cada arranque frío** y sin red no carga nunca, porque el `runtimeCaching` que la cachearía es config muerta. De paso mata las 3 familias fantasma que dejan el embudo de registro con Roboto en Android y San Francisco en iOS. |
| 13 | **CONC-1 + CONC-2** | La idempotencia general es la defensa más barata contra el doble cargo y **prerrequisito de `ERP-2`**; el barrido de `count(*)` sin lock busca el error clásico donde ya sabemos cómo se ve bien hecho. |
| 14 | **UX-2** | F-01 (un error de fetch se ve como tabla vacía) toca pantallas de dinero. |
| 15 | **MOD-15** | 4 horas. Sin el System User el bot de WhatsApp muere cada 2 h. |
| ~~15.5~~ | ~~**MOD-21 (S0+S1+bandeja)**~~ | ✅ **Construido el 2026-08-25** — ver §1.4. Falta commitear y S2 completo (panel de diagnóstico embebido, notas internas desde la UI, push de ticket nuevo). |
| ~~15.7~~ | ~~**MOD-25**~~ | ✅ **Entregado el 2026-08-25** — ver §1.4. `llms-faq.txt` publicado, 6 comparativas referenciadas, `robots.txt` con ~20 user-agents de IA. |
| 16 | **INF-1 (por dominio)** | Versionar el dominio que bloquee la siguiente fase, no los 336 objetos de golpe. |
| 17 | **UX-6** | Las features cosméticas son lo que hace que un padre vuelva al grupo de WhatsApp. Verificar primero qué quedó resuelto con el módulo de notificaciones. |
| 18 | **ADM-1 + ADM-2** | El catálogo de flags y el doble store. `ADM-2` es prerrequisito de la consola: sin resolverlo, la consola hereda el mismo defecto de `SEG-7` — leer de un sitio y escribir en otro. |
| 19 | **Responder D-T, D-MIG, D-PUC, D-CORTE** | Cuatro decisiones sin código de por medio que bloquean las 6–7 semanas de `ERP-2`. Se pueden contestar esta semana. |
| 20 | **MOD-17** (filtro de piloto) | Es lo único de la lista que **le llega a una familia**. Mientras el cron recorra todas las escuelas, la salvaguarda es que nadie haya cargado métricas — y eso deja de ser cierto el día que una escuela real empieza a usar el módulo, sin aviso. El filtro por escuela es chico; lo que no se puede es dejarlo a la suerte de que no haya datos. |
| 21 | **INF-11 + ADM-6** | La misma pasada. `INF-11` borra el trigger que refresca una matview que nadie lee —y que el coach paga dentro de su request— y `ADM-6` conecta ese dato al panel que hoy muestra pagos donde dice sesiones. Uno limpia el productor, el otro le da por fin un consumidor. Ambos baratos y sin decisiones abiertas. |

### P2 — Cuando P0 y P1 estén cerrados

Arranca con los tres que salieron del barrido del 12-ago y son la cola natural de `DIN-1`:
**DIN-13** (F3, la causa raíz de los 41 dobles facturables — necesita `D-DUP` y `D-DOC` contestadas)
→ **DIN-16** (fusionar las 13 que ya existen, $1.770.000/mes) → **DIN-14** (el mes en el registro
manual) → **DIN-18** (documentos inválidos; su colisión de Spirit bloquea la F3.3 de `DIN-13`) →
**DIN-15** (higiene de invitaciones).

Después, en este orden: **MOD-2** (riesgo nulo, entregable ya) → **MOD-4** (go-live de notificaciones) →
**MOD-11** (desplegar el marketplace que ya está escrito) → **SEG-13** → **ADM-3 + ADM-4 + ADM-5**
(la consola) → **DIN-5** → **ERP-2** → **ERP-3** →
**Ciclo de mes F1** → **ERP-4** → **ERP-5** → **MOD-8 + PER-0** → **MOD-6** → **MOD-9** → **DIN-6** →
**MOD-12** → **MOD-10 + PER-1 + PER-2** → **MOD-13** → **MOD-14** → **MOD-18** → **MOD-7** → **SEG-3** → **SEG-4** → **SEG-5** →
**SEG-6** → **INF-2..5** → **UX-5** → **DIN-17** (multimes, detrás de sus 4 decisiones de producto).

> **`VID-1` está fuera de esa cadena a propósito.** Son dos días y no toca dinero ni RLS: si Carmel
> pide ver los partidos durante el trial, se adelanta sin discutir prioridades. Lo que **no** se
> adelanta es `VID-2`, que es donde empieza a haber video de menores en nuestro almacenamiento.

> **La F1 de `MOD-18` se puede adelantar como relleno; su F2 no.** El tablero de cumpleaños son tres
> días, no envía nada y no toca RLS de dinero: cabe en cualquier hueco. El saludo automático (F2) sí
> espera turno, porque comparte el problema de `MOD-17`: un cron que recorre todas las escuelas
> escribiendo a familias reales, sobre una única Supabase para dev/stg/prod. Mismo riesgo, misma
> salvaguarda — el toggle por escuela, apagado por defecto.

> **`PER-0` no es un ítem nuevo: es el saneamiento que `MOD-8` ya tenía marcado.** Van juntos o se
> hace dos veces el mismo trabajo sobre el mismo eje. Y **`PER-1` + `PER-2` van pegados a `MOD-10`**
> por la misma razón que `MOD-18` va detrás de `MOD-4`: comparten la capa de métricas y **el mismo
> problema de captura manual** — `performance_entries` tiene 486 filas en toda la base, y un módulo
> de carga que nadie llena mide exactamente lo mismo que un Canva. `PER-3..6` van a P3.
>
> **`PER-5` (el exportable) se puede adelantar como relleno igual que la F1 de `MOD-18`:** son tres
> días, no envía nada, no toca RLS ni dinero, y es lo único del track que un coach ve el primer día.
> Lo que **no** se adelanta es `PER-2`, que sin `PER-0` se cablea contra el eje roto.

> **`SEG-13` va antes de `ADM-3`, no después.** La consola le da a una sola pantalla el control de las
> ~40 opciones de cualquier escuela; entregarla mientras `super_admin` entra con solo usuario y
> contraseña es concentrar el radio de daño justo donde no hay segundo factor.

> **`MOV-4` va emparejado con `BLQ-6`, y eso lo saca de la cola por fecha.** El resto del track `MOV`
> se intercala acá en este orden: **MOV-10** (los 41 diálogos que creen limitarse al 90 % y ocupan el
> 100 %) → **MOV-6** (targets táctiles y los 1.021 textos bajo 12 px) → **MOV-9** (teclado y scroll
> anidado) → **MOV-8** (imágenes) → **MOV-11** (chrome nativo y botón atrás) → **MOV-5** (lo que la
> fase 3 de `MOV-4` no cubra) → **MOV-12** (rendimiento visual).
>
> **`MOV-4` no espera su turno acá: espera a que se decida `BLQ-6`.** Es el único ítem del track que
> bloquea ingreso ya facturado —el addon `pwa_branding` está vendido y el verde de SportMaps se
> filtra en decenas de pantallas— así que si `BLQ-6` se adelanta, `MOV-4` sube con él. Construir
> tiers de branding sobre 3.769 clases de paleta fija es rehacer el trabajo dos veces.

### P3 — Bloques largos

**BLQ-1** (Reservas, con `CONC-4/5` dentro) y **BLQ-2** (Venue/Gym) son los dos que cambian el tamaño
del producto; el resto va después. Cierre del track contable: **Ciclo de mes F2–F6** →
**ERP-6 + UX-4** → **DIN-8**.

**`PER-3..PER-6` cierran el track de periodización acá**, detrás de `PER-1`/`PER-2` de P2: alertas de
carga y de rótulo, plantillas de microciclo, y el vínculo con el tablero táctico —que es la `P3` del
spec de fútbol— y con el Informe Mensual. Ninguno toca dinero ni RLS de pagos.

**`BLQ-3` (Mobile) ya no es un bloque de 6 semanas sin arrancar.** N1–N3 pasaron por fuera de la cola
y Android está en la prueba interna de Play; lo que queda acá es **N4 offline** y la **Fase 8 de
flavors**, más el arreglo del AAB que apunta a `bffdev`. La deuda de la app que ya está publicada
vive en el track `MOV`, que se atiende en P1/P2 y no espera a P3.

**iOS dejó de ser "sin nada que planear" — el bootstrap ya está en `develop`** (verificado
2026-08-29). `frontend/ios/` existe como proyecto Xcode real (CocoaPods, `GoogleService-Info.plist`
real), `@capacitor/ios` está declarado, y `MOV-3` (el prerrequisito duro de CSS) ya se aplicó —
Capacitor en iOS resuelve `env(safe-area-inset-*)` de forma nativa vía WKWebView, sin necesitar un
equivalente al `MainActivity` de Android. Lo que queda **no es código, es trámite externo**: activar
la cuenta Apple Developer (comprada 27-ago, Individual, hasta 2 días hábiles), registrar
`co.sportmaps.app` en App Store Connect, conectar la integración en Codemagic y crear el grupo de
testers de TestFlight — los cuatro documentados como pendientes en el propio `codemagic.yaml`
(`ios-testflight`: "NO FUNCIONA TODAVÍA"). El workflow `ios-simulator-smoke` (sin firma) debería
correr ya, sin confirmación de una corrida verde desde acá.

**`VID-2` → `VID-3` → `VID-4`** (VOD → en vivo → clips) entran acá, y **no antes de tener
contestadas `D-IMAGEN` y `D-VIDEO-RET`**: la primera define el modelo de datos y la segunda define
si el costo tiene techo. Escribir la migración antes es fabricar deuda con datos de menores adentro.

**`NIV-1, NIV-6, NIV-2, NIV-3, NIV-5` entran acá completas**, en ese orden (spec §5) — las 19
decisiones (`D1-D19`) ya cerraron, no esperan sesión de repaso. **`NIV-4` es la excepción:** queda
fuera de la cadena de `P3` hasta resolver sus dos correcciones de alcance (spec §8.2, §8.4) — su
esfuerzo real todavía no está acotado.

---

## 5. Decisiones abiertas que bloquean trabajo

### Resueltas recientemente

| Decisión | Resolución | Fecha |
|---|---|---|
| ¿`DIN-1` y `DIN-2` en un plan consolidado? | **Consolidado.** Plan en [plan-f0-generacion-de-mes-y-cobros-duplicados.md](plan-f0-generacion-de-mes-y-cobros-duplicados.md) | 2026-08-01 |
| **D-PD** — ¿partida doble? | **Libro mayor completo desde el inicio.** Se descartaron la opción sin asientos y la híbrida (§3.1) | 2026-08-01 |

### Abiertas

| Decisión | Bloquea | Nota |
|---|---|---|
| Las 4 de `DIN-1` §8 | P0 completo | `students.ts:829` · las 16 huérfanas · backfill de `period_*` · GYM RM |
| `D9/D11` de `NIV-4` — ¿bloqueo real por día vía grupos de acceso del F22, o solo log/aviso en el BFF? | `NIV-4` | El BFF no controla la puerta; automatizar bloqueo real es proyecto aparte — [spec §8.2](specs/dreamers-niveles-por-horas-y-progresion.md) |
| **D-DUP** — ante un casi-duplicado, ¿el guard **bloquea** la creación o **crea y avisa** a la escuela? | `DIN-13` (F3) | Bloquear frustra al acudiente cuando el matcher se equivoca —Gabriela y **Juliana** Simbaqueva comparten fecha de nacimiento y tienen documentos consecutivos: son **gemelas**— y crear-y-avisar deja pasar el duplicado. Define toda la UX de F3 |
| **D-DOC** — ¿el documento es **obligatorio** al crear la ficha, y con qué validación de formato? | `DIN-13` · `DIN-18` | Son la misma decisión: exigirlo sin validar longitud no sirve, hay 73 documentos imposibles de 788 |
| **D-ORACULO** — ¿se acepta que un anónimo pueda saber si un documento existe? | `SEG-14` cierre total | Cerrarlo exige invertir `/join-team`: registrarse primero, buscar después. Es un cambio de UX del onboarding público |
| **D-MULTIMES** — descuento por varios meses · cuántos meses adelante · baja con meses prepagados · ¿el saldo a favor se devuelve o solo se aplica? | `DIN-17` | Cuatro decisiones de producto, ninguna técnica |
| **D-PUC** — ¿qué plan de cuentas? PUC Colombia (Decreto 2650) completo, o un catálogo reducido con las cuentas que una escuela realmente usa | `ERP-2` | El completo son ~2.000 cuentas que nadie de la escuela sabe elegir; el reducido exige decidir cuáles |
| **D-T** — tercero: ¿tabla `parties` unificada, o eje polimórfico `party_type + party_id`? | `ERP-2` | El polimórfico no obliga a migrar `suppliers` ni `payroll_employees`, pero pierde la FK |
| **D-CORTE** — fecha de corte del mayor y cómo se calculan los saldos de apertura | `ERP-2` | Sin esto no se puede postear la primera fila |
| **D-MIG** — los `expenses` ya pagados: ¿se migran como obligación saldada, o el módulo arranca solo con lo nuevo? | `ERP-2` | Arrancar limpio es mucho más barato |
| **D-NOM** — ¿la obligación de nómina nace de un trigger al cerrar la liquidación, o de una RPC explícita? | `ERP-4` | Un trigger es cómodo y difícil de deshacer |
| **D-ROL** — la matriz Auxiliar/Contador/Administrador del spec externo → roles reales | `ERP-2` | Ya hay dos matrices de permisos de coach que son código muerto (`SEG-4`); no crear una tercera |
| **CONC-5** — franjas fijas vs solapamiento libre | `BLQ-1` | Índice único simple vs `EXCLUDE USING gist` |
| **D-IMAGEN** — ¿el consentimiento de imagen del menor se pide una vez por escuela o por evento, quién puede ver a un menor que no es su hijo, y de quién es el archivo cuando el club pone la cámara y nosotros el almacenamiento? | `VID-2` (gate `G-IMAGEN`) | Define `recordings.visibility` y por tanto el modelo de datos. No es papeleo del final: contestarla después obliga a rehacer las policies |
| **D-VIDEO-RET** — ¿cuánto vive el partido completo, y qué queda cuando se borra: nada, o los clips? | `VID-5` | El almacenamiento se acumula mes a mes. Sin retención el costo no tiene techo y el addon no se puede tarifar |
| **D-VIDEO-PRECIO** — ¿addon mensual por escuela, o pago por partido de la familia que quiere verlo en vivo? | `VID-5` | Son dos productos distintos: el primero lo paga el club, el segundo cambia el incentivo a transmitir todos los partidos |
| **D1-pagos** — ¿`PAYMENT_TOKENS_ENC_KEY` está seteada en Render (stg y prod)? | `DIN-6` F-C paso 1 | Sin la clave, `getEncKey()` lanza y el checkout muere. **No hay versionado de clave:** rotarla hoy invalidaría todos los secretos guardados → vale añadir `key_version` mientras la tabla está casi vacía |
| **D2-pagos** — el dinero de terceros ya recibido (Porras / MMA Blair): ¿se concilia, se devuelve, o se documenta como histórico cerrado? | `DIN-10` | **Decisión de negocio, no técnica** |
| **D3-pagos** — ¿las credenciales `TEST-` de MP en dev rompen algún flujo que hoy se pruebe contra la cuenta real? | `DIN-9` | Si sí, el fail-fast necesita una excepción explícita en vez de bloquear el arranque |
| **D4-pagos** — ¿qué receptor de webhook tiene Dynasty configurado en su dashboard: la Edge Function `wompi-webhook` o la ruta del BFF? | `DIN-6` F-F | **Hay dos receptores.** Verificar antes de tocar nada de webhooks |
| **D-MD** — ¿de dónde salen los partidos que definen el índice MD: tabla de fixtures nueva, reusar `events`, o marcar el día del microciclo a mano? | `PER-1` | **`competition_results` registra el partido después de jugado**, así que hoy no hay calendario hacia adelante contra el cual contar un MD. Define el DDL de `PER-1`: hay que contestarla **antes** de escribir SQL. Propuesta del spec: marcarlo a mano en el día del microciclo (cuesta cero, el día ya se está creando) y fixtures reales como fase posterior si un club los pide |
| **D-CARGA** — ¿qué unidad mide la carga? sRPE de Foster (RPE de sesión × minutos), o algo que dependa de hardware | `PER-2` | El sRPE no necesita GPS ni presupuesto y sale de un dato que el coach ya tiene al terminar la sesión. Elegir otro modelo **cambia toda la `PER-2`**: monotonía, strain y ACWR se derivan de esa unidad |
| Pricing de M2 en connected accounts; ¿Fase 3 va a agregador? | DIN-6 | |
| Módulos no contratados: ¿se ocultan del menú o se muestran con candado como gancho de upgrade? | UX-3 | |
| ~~Mobile: app unificada vs varias por rol · push provider · versión mínima · build infra~~ | ~~BLQ-3~~ | ✅ **Resueltas de hecho al construir** (verificado en el repo el 2026-08-18): app **unificada** (`co.sportmaps.app`, con flavors reservados para white-label), **FCM** para iOS+Android, **minSdk 26** / target 36, build **local con keystore** en `android/keystore.properties`. Siguen abiertas las 3 de abajo |
| **Mobile: actualización forzada (UI) · localización** | BLQ-3 | Quedan 2 de las 7 originales — **Sentry ya se instaló** (frontend + BFF, `feature/sentry-integration` mergeada 29-ago), cierra la mitad técnica de `SEG-12`; falta confirmar el DSN configurado en los 3 ambientes. El endpoint de versión mínima (N2) también existe (`GET /api/v1/mobile/app-config`), pero la pantalla de bloqueo no se construyó — decisión de producto (no forzar todavía), no deuda |
| ~~**D-IOS** — ¿entra iOS al roadmap, y cuándo?~~ | `MOV-3` · release iOS | ✅ **Resuelta de hecho al construir (verificado 2026-08-29): sí, y ya empezó.** `frontend/ios/` está commiteado (proyecto Xcode + Podfile CocoaPods + `GoogleService-Info.plist` real), `@capacitor/ios ^8.5.0` declarado en `package.json`, y `MOV-3` ya se mergeó (PR #6, 27-ago). La cuenta de Apple Developer **ya se compró** (27-ago, Individual, hasta 2 días hábiles de activación). Lo que queda es registrar `co.sportmaps.app` en App Store Connect, conectar la integración en Codemagic y crear el grupo de testers — los tres pendientes están documentados en `codemagic.yaml` (workflow `ios-testflight`, marcado ahí mismo "NO FUNCIONA TODAVÍA"). Nada de esto es una decisión de producto pendiente; es checklist de cuenta |
| **D-ZOOM** — ¿se quita `user-scalable=no` del viewport? | `MOV-6` | Incumple WCAG 1.4.4 y **Android WebView lo respeta al pie de la letra**, así que con 1.021 textos bajo 12 px el usuario no tiene forma de agrandar lo que no puede leer. Quitarlo es seguro (el auto-zoom de iOS ya lo cubren los 16 px de `Input`), pero **cambia cómo se siente la app** — hay que decidirlo, no colarlo |
| Torneos: ¿qué quedó entregado de inscripción vs bracket? | MOD-7 | Verificar contra el código antes de planear |
| Carnets: ¿el editor de plantillas quedó dentro de las 5 fases? | MOD-14 | Verificar |
| `D9/D11` de `NIV-4` — ¿bloqueo real por día vía grupos de acceso del F22, o solo log/aviso en el BFF? | `NIV-4` | El BFF no controla la puerta; automatizar bloqueo real es proyecto aparte — [spec §8.2](specs/dreamers-niveles-por-horas-y-progresion.md) |
| `D10` de `NIV-4` — migración `program_id → offering_id` de `school_availability`: la premisa ya no es cierta (la tabla real tiene `branch_id`, no `program_id`) | `NIV-4` | Rediagnosticar contra la base viva antes de escribir la migración — [spec §8.4](specs/dreamers-niveles-por-horas-y-progresion.md) |

---

## 6. Documentos y su rol

### Vigentes

| Documento | Rol |
|---|---|
| **este archivo** | Único roadmap. Prioridades y estado. |
| `docs/specs/*.md` | Fuente de verdad de cada módulo. Decisiones de producto resueltas dentro. |
| `docs/plan-*.md` | Plan de migraciones de una fase concreta. Se aprueba antes de escribir SQL. |
| [`architecture/concurrencia-y-reservas.md`](architecture/concurrencia-y-reservas.md) | Doctrina de integridad + diseño de reservas con soft lock. **Aplica a todo el producto**, no solo a reservas. |
| [`specs/pendientes-cxc-cxp-nomina.md`](specs/pendientes-cxc-cxp-nomina.md) | Spec del módulo Pendientes con libro mayor, aterrizado al modelo real. |
| [`specs/periodizacion-microciclos-y-carga.md`](specs/periodizacion-microciclos-y-carga.md) | Spec del track `PER`. Su **§0 conserva el análisis del tablero de Canva** —el microciclo 40 día por día y los tres errores que el formato no puede detectar— porque es la justificación funcional de cada fase, no una anécdota de origen. Su **§1 es el inventario de lo que ya existe en el repo**, con las dos trampas del eje: `training_plans` **sin `school_id`**, y `training_sessions` que es **cupo, no contenido**. |
| `docs/analysis/SUPABASE_LINTER_REMEDIATION_PLAN.md`, `SECURITY_DEFINER_AUDIT.md` | Auditorías con plan de ejecución. Vivas, pero ⚠️ **son del 2026-05-11 y sus conteos ya no cuadran** — el barrido del 12-ago los re-midió contra la base (§2, track `SEG`). El **método** de ambas sigue siendo bueno; las **cifras y la priorización**, no. Y solo cubren Postgres: ninguna ve el BFF. |
| `docs/AUDITORIA_ARQUITECTURA.md` | Retrato del sistema y su deuda. Vive. |
| [`auditoria-frontend-responsive-movil-2026-08-18.md`](auditoria-frontend-responsive-movil-2026-08-18.md) | **Fuente única del track `MOV`.** 40 hallazgos con severidad, evidencia archivo:línea e impacto separado por plataforma. Se midió leyendo el repo, el **CSS compilado** (de ahí sale que los 41 `max-h-[90vh]` están anulados, con los offsets en bytes) y el **manifest Android fusionado**. Su §7 es la tabla priorizada por impacto×alcance÷esfuerzo y su §8 separa las 9 correcciones de una línea del trabajo por fases. Trae también una lista de **lo que ya está bien y no hay que romper** — el edge-to-edge de `MainActivity`, `openExternalUrl`, los guards de plugins nativos, `globIgnores`. |
| `docs/sportmaps-strategic-roadmap.md` | Tesis, mapa competitivo, track D1–D4. **Su §7 queda superseded por este archivo.** |
| `docs/migrations-workflow.md` | Cómo se crea una migración. Obligatorio. |
| [`plan-f3-un-solo-registro-por-atleta.md`](plan-f3-un-solo-registro-por-atleta.md) | Plan de `DIN-13`. Incluye el inventario de lo que **ya está construido** y la validación contra la base del 12-ago. |
| [`plan-fusion-identidades-duplicadas.md`](plan-fusion-identidades-duplicadas.md) | Procedimiento de `DIN-16`. **Estaba huérfano**: escrito y fuera de la cola hasta el 12-ago. |
| [`dynasty-pendientes-2026-08-12.md`](dynasty-pendientes-2026-08-12.md) | Lo que quedó abierto en Dynasty tras la corrección, con cómo regenerar cada lista. |
| `scripts/audit-cobros-duplicados.mjs` · `audit-cobertura-cobros.mjs` · `audit-periodo-vs-fecha-pago.mjs` · `audit-acudientes-desenganchados.mjs` | Los cuatro barridos de cobros. Todos READ-ONLY; sus salidas llevan datos de menores y están en `.gitignore`. |
| `docs/api/openapi.yaml` | 358 rutas del BFF. Importable en Postman. |
| `docs/archived/ROADMAP-v1.3-2026-05-12.md` | Anexos A–F: DDL, RLS, endpoints, RPCs y tests de los bloques sin construir. |

### Candidatos a archivar — hablan de una arquitectura que ya no existe

No los borro: son decisión del dueño del repo.

| Documento | Por qué |
|---|---|
| `docs/analysis/MVP_GAP_ANALYSIS_MULTITENANT.md` | Su GAP 3 es «backend Python/MongoDB» y su GAP 14 es «Flutter embrionario». El stack es Express + Supabase y el mobile es Capacitor. |
| `docs/analysis/MVP_ANALYSIS_MULTITENANT.md` | Misma época y mismo supuesto. |
| `docs/analysis/MIGRATION_BLUEPRINT_FLUTTER_NEXT.md` | Migración a Flutter/Next que no se va a hacer. |
| `docs/architecture/FLUTTER_SAAS_MIGRATION.md` | Igual. |

---

## 7. Arranque inmediato

0. **`SEG-8` + `SEG-9`** — media hora y una sesión. Un `REVOKE` y borrar cuatro handlers de debug.
   Son los dos únicos huecos explotables hoy y no dependen de ninguna decisión abierta. `SEG-10`
   (1–2 d) va detrás, en la misma pasada de seguridad.
0.b **`DIN-9`** — una sesión. Credenciales `TEST-` en dev + guard de arranque. Es lo único con un
   footgun vivo y no depende de ninguna decisión salvo D3-pagos.
1. **Aprobar el plan de `DIN-1`** — es el único bloqueante de producción (§1). Nada de SQL antes.
   Su paso 1 es el preflight que verifica contra la base las tres migraciones del 24-jul.
2. **Aprobar `DIN-4` F0 + F0.5** — F0.5 arregla hoy el síntoma de «prendo el módulo y no se activa»,
   y F3 no se puede construir encima de un status que se puede leer falso.
3. En paralelo, sin dependencias ni decisiones: **`DIN-3`** (4 h) y **`MOD-15`** (4 h).
   ~~`MOV-1` + `MOV-2`~~ **ya mergeados** (PR #6, 27-ago, verificado 2026-08-29) — los nueve arreglos
   de una línea sobre la app que **ya está en Play** (el caret rosa Material de todos los inputs, las
   bandas negras de edge-to-edge, el botón de cerrar de 16 px) y el borrado del código muerto que
   hacía creer que el responsive estaba cubierto. `MOV-2` era además prerrequisito de `UX-1` — ya no
   bloquea empezarlo.
4. Después: **`SEG-1`** Fase −0.5 y **`SEG-7`**, que destraban migraciones y cierran la lectura falsa.
5. **Contestar D-PUC, D-T, D-CORTE y D-MIG** — cuatro decisiones sin código de por medio que bloquean
   las 6–7 semanas de `ERP-2`. Se pueden responder esta semana.
