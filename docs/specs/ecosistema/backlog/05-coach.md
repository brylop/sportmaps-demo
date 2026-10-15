# Backlog final — Frente «Coach de escuela»

> Versión final del 14-oct-2026, con las correcciones del revisor aplicadas (ver §6).
> Decisión del dueño (E4): **el coach de escuela no se vende aparte, va GRATIS dentro del plan de la escuela** y es el argumento para que la academia compre. `saas-plans.ts:452-466` ya dice «coaches ilimitados en todos los tiers».
> Este documento es un backlog. No autoriza a escribir SQL: cada migración necesita su plan aprobado antes (CLAUDE.md del repo).

---

## 1. Resumen y estado actual verificado

El núcleo del coach funciona: sesiones con periodización, asistencia con QR y supervisión, informes, semáforo médico y un Resultados básico. Cinco cosas impiden venderlo como producto terminado:

1. **La pizarra solo se abre para fútbol** (`TrainingPlansPage.tsx:318`, `isFootballTeam`). El multideporte, el 3D, la IA y los paquetes están en la rama `pizarra-tp/integracion` (HEAD `c88f43a3`), que va 11 commits atrás de `develop`. Esa rama trae 5 migraciones sin aplicar, el cupo de IA por coach sin commitear y un e2e en rojo. **Ese trabajo es de la sesión dueña de la pizarra** (`docs/specs/pizarra-m6-retomar.md`). En este backlog aparece solo como dependencia (§2, tabla PZ).
2. **Partidos no tiene BFF.** La F1 de base está en el repo (`20260926131340`, con las RPCs `create_match`, `update_match`, `save_match_roster`, `submit_match_evaluation`, `publish_match_evaluation`, `link_day_to_match` y `seed_school_match_criteria`), pero no existe `bff/src/routes/school/matches*`. Hay **tres** escritores directos sobre `match_results`: `ResultsPage.tsx`, `useFootballData.ts` y `useSchoolData.ts:410-426` (`createMatchResult`).
3. **Hay módulos muertos en el menú del coach.** Mensajes y Anuncios (`navigation.ts:432-433`, grupo «Comunicación») y Resultados (`ResultsOverviewPage.tsx:47` devuelve `[]` fuera de demo). La barra inferior del coach (`MobileBottomNav.tsx:41`) lleva «Chat» a `/messages`, que está vacío. `announcements` solo se escribe: ninguna familia la lee y no dispara notificaciones.
4. **Un coach que se registra sin invitación llega a un dashboard en ceros.** `CoachOnboarding.tsx` es solo el asistente de perfil, y `DashboardPage.tsx` maneja el caso «sin escuela» solo para el rol `school`.
5. **Faltan para la cancha:** asistencia sin señal (no hay IndexedDB en `frontend/src`), la pantalla «Hoy» del coach y la cobertura de un sustituto.

**Permisos.** Hay dos helpers de acceso por equipo que divergen:
- `assertCoachHasTeamAccess`, función **local** de `bff/src/routes/attendance.ts:21-48`, con 3 consultas secuenciales.
- `resolverAccesoEquipo`, de `bff/src/services/team-access.service.ts:36`, que usan `reports.ts` y `school/reports.ts`.

Hay rutas de asistencia abiertas al coach **sin scope de equipo**: `POST /checkin-by-card` (:892), `GET /school-roster` (:2758), `POST /quick-guest` (:2841), y `/walk-in` (:1411) y `/session` (:1630) cuando no llega `teamId`. Las rutas tácticas de `football.ts` y `exercises.ts` solo validan rol y `assertTeamBelongsToSchool`; no comprueban que el equipo sea del coach. Eso aplica a la escritura y también a las lecturas con `STAFF_ROLES` (`football.ts:153,260,295,510,547,610,642,745`). `frontend/src/config/routePermissions.ts` no tiene importadores. `requirePermission` **no existe** en el código.

### Estado por capacidad

| Capacidad | Estado | Evidencia |
|---|---|---|
| Sesiones de entrenamiento con periodización (mesociclo) | Funciona | `App.tsx:581` `training-plans` con `ModuleGate gestion_deportiva_entrenamiento_metricas`; ítem en el menú del coach |
| Asistencia del coach (supervisión + QR de carnet) | Funciona, con huecos de scope | `App.tsx:573-574`; `attendance.ts` usa el helper local `assertCoachHasTeamAccess` (:21-48) en las rutas por equipo; sin scope en :892, :2758, :2841 y en :1411/:1630 sin `teamId` |
| Asistencia sin señal | Solo spec | No hay IndexedDB, `idb` ni `navigator.onLine` en `frontend/src`; `asistencia-rapida-checkin.md §3.H`; ROADMAP V2-5…V2-8 (`ROADMAP.md:60`) |
| Pantalla «Hoy» del coach | Solo spec | ROADMAP UX-10 (`:1365`); `DashboardPage.tsx:492-500` solo tiene el botón «Tomar asistencia»; no hay `GET /attendance/today` |
| Pizarra táctica 2D | Parcial (solo fútbol) | `TrainingPlansPage.tsx:318` compara el literal `futbol`/`fútbol`; 32 equipos de vóley y 13 de básquet no la ven |
| Pizarra multideporte + paquetes + IA + 3D (M0-M4) | Parcial, fuera de develop | `pizarra-tp/integracion` (`c88f43a3`): 5 migraciones (`20261013194057`, `20261013200604`, `20261014111442`, `20261014121142`, `20261014125632`) + cupo por coach `20261014155445` sin commitear; 1 e2e en rojo |
| Pizarra M6 (formaciones, equipos, notas/videos, herramientas, cámaras, ajustes) | Parcial, en otra sesión | Las ramas `pizarra-tp/m6a…m6g` apuntan a `c88f43a3`; el trabajo está en worktrees sin commitear |
| Blindaje de lectura de la pizarra para padres (`20261005173002`) | Sin verificar en la base viva | ROADMAP `:1044` la marcaba «no aplicada» el 05-oct; se verifica en COACH-P0-04 |
| Partidos F1 (DB + RLS + RPCs) | En el repo; **sin verificar en la base viva** | La migración `20260926131340` tiene GRANT explícito; el spec §9 dice «aplicada 09-26»; se verifica en COACH-P0-04 |
| Partidos F2 (BFF) y F3 (UI de evaluación) | No existe | No hay `bff/src/routes/school/matches*` ni `evaluation-criteria`; hay escrituras directas en `ResultsPage.tsx:140-197`, `useFootballData.ts:185-260` y `useSchoolData.ts:423` |
| Resultados del coach | Muerto en la práctica | `ResultsOverviewPage.tsx:47` = `isDemoMode ? demoResults : []`; ROADMAP UX-8 y UX-12 mandan sacarlo del menú |
| Mensajes | Roto | `MessagesPage.tsx` solo lee; el compose no tiene ruta; sigue en `navigation.ts:432` y en `MobileBottomNav.tsx:41` («Chat») |
| Anuncios del coach a familias | Roto | `lib/api/announcements.ts` solo inserta; nadie lo lee; no notifica; 0 filas; `navigation.ts:433` |
| Coach que se registra sin escuela | Roto | `CoachOnboarding.tsx` → `/dashboard` con tarjetas en 0; `DashboardPage.tsx:286-290` solo cubre el rol `school` |
| Informe mensual (el coach escribe, la escuela publica) | Parcial | `/informe-mensual` (`App.tsx:847`) vivo; Besser tiene 32 borradores sin nota del coach |
| Matrices de permisos | Una muerta | `routePermissions.ts` sin importadores; `requirePermission` no existe (grep en `bff/src` y `frontend/src` sin resultados) |
| Ocultar dinero al coach | Parcial | `school_settings.coach_hide_financial_info` (`20260903144504`), default `false`, solo Besser en `true` |
| Precio del coach en la landing | Hecho, **sin commitear** (otra sesión) | `RolePricingSection.tsx:263-299` ya dice «gratis dentro del plan de tu escuela»; `Entrenadores.tsx:91-92` tiene los dos caminos; ya no aparecen «Coach Elite» ni «marketing ads». Queda el combo `coach-tienda` en `lib/combos.ts:48-51` (Marketplace no existe) |

---

## 2. Fases

Reglas para todas las fases:
- Una rama por fase (`coach/p0`, `coach/p1`…) que nace de `develop` y se integra con `--no-ff`.
- Cada migración se crea con `npm run migrations:new -- <slug>` y tiene plan aprobado antes del SQL.
- **Una sola sesión aplica migraciones** (ni Canchas ni la pizarra aplican al mismo tiempo), y `gen types` corre una sola vez, al final del lote.
- Nada de `list_tables` ni `get_advisors` como sondeo. Las RPCs multi-fila son `SECURITY DEFINER` con `search_path = pg_catalog, public, pg_temp` y `GRANT EXECUTE` explícito (revocado de `anon`).
- Para escribir se usa `user_staff_school_ids()`. Lo que otorga permisos usa `user_admin_school_ids()`. Nunca `user_school_ids()` para escribir. Los estados van como `text + CHECK`.
- Después de cada cambio de RLS se corre `npm run seguridad:invariantes`. Los jobs no hacen N+1.
- Los commits llevan solo lo propio (índice temporal) y los pushes van agrupados por el cupo de Vercel.

### Dependencias externas: la pizarra (las hace la sesión dueña de `pizarra-tp/*`)

El frente coach **no** ejecuta estas tareas. Las consume y les hace QA (COACH-P1-09, COACH-P3-04).

| id | Qué | Dueño | Nota obligatoria |
|---|---|---|---|
| PZ-01 | Cerrar `pizarra-tp/integracion`: commitear el cupo de IA por coach (`20261014155445`) y dejar en verde el e2e `tactical-board-animacion` | Sesión de la pizarra | Sin tocar las ramas M6 |
| PZ-02 | Merge de M0-M4 a `develop` (`isFootballTeam` → `hasTacticalBoard(resolveSport(team.sport))`) | Sesión de la pizarra | **Ledger:** el head de `develop` es `20261014153542` (Canchas) y las 5 migraciones de la pizarra son anteriores. **No** se resuelve con `checkout --ours` + `migrations:sync` porque `migrations:check` falla con «Versión fuera de orden» (`scripts/migrations.mjs:388-393`). Hay dos caminos: (a) union-merge del ledger, conservando las entradas de la rama con su sha y recalculando el head, o (b) renumerar las 5 con `npm run migrations:next` antes del merge, que se puede porque no están en `develop`. **Se decide antes de PZ-03**, porque la versión aplicada queda en `schema_migrations` |
| PZ-03 | Aplicar el lote de la pizarra (6 migraciones) + `gen types` una vez | Única sesión de migraciones | Policies revisadas línea por línea; `seguridad:rls-pizarra` y `seguridad:invariantes` sin críticos; padre y anon leen 0 filas de `exercise_packs` y `tactical_ai_*` |
| PZ-04 | M6a formaciones + M6d herramientas (sin migración) | Sesión de la pizarra | Snapshot de compatibilidad M6d antes de tocar el frontend |
| PZ-05 | M6b equipos y M6c notas/videos (migraciones reservadas `20261014162158`, `20261014163705`) + frontend | Sesión de la pizarra | `provider` en text+CHECK; iframe solo para youtube-nocookie y Vimeo |
| PZ-06 | M6e cámaras 3D + M6g ajustes | Sesión de la pizarra | Preferencias en localStorage con clave por usuario, limpiadas en signOut |
| PZ-07 | M5/M6f deportes de cancha (amplía el CHECK de deportes) | Sesión de la pizarra | Depende de la decisión abierta D5 |

### Fase P0 — Higiene, seguridad y primera impresión

**Objetivo:** el coach no ve módulos rotos, nadie llega a un dashboard vacío, se cierran los huecos de scope por equipo en el BFF, se verifica en la base viva lo que se va a construir encima y queda una línea base de QA real. **Sin migraciones.**
**Semanas:** 1 (15-21 oct). **Rama:** `coach/p0`.

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| COACH-P0-01 | Sacar Mensajes, Anuncios y Resultados del menú del coach y cambiar «Chat» por «Sesiones» en su barra inferior (cierra la parte de menú de **UX-8/UX-12**) | frontend | `frontend/src/config/navigation.ts` (:432-433 y el ítem Resultados), `frontend/src/components/navigation/MobileBottomNav.tsx` (:41, solo `case 'coach'`), `MobileBottomNav.test.tsx`, `docs/ROADMAP.md` (marcar UX-12 parcial) | No | — | Con sesión de coach real en dev, el sidebar no muestra Mensajes, Anuncios ni Resultados. En la barra del coach «Chat» pasa a **«Sesiones» → `/training-plans`**; «Asistencias» no se duplica. La barra del padre (:22) **no se toca** (es del frente Familias). Las rutas siguen respondiendo por URL. Resultados vuelve al menú cuando COACH-P2-07 esté vivo, y Avisos cuando COACH-P2-09 lo esté. Vitest en verde. No se borra código sin OK del usuario. | XS |
| COACH-P0-02 | Coach sin escuela: panel de salida en lugar del dashboard en ceros | frontend | `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/onboarding/CoachOnboarding.tsx`, `frontend/src/components/coach/CoachSinEscuelaPanel.tsx` (nuevo) | No | — | Un coach sin `school_members` ni `team_coaches` ve tres salidas: (1) «Tengo una invitación»: sus invitaciones pendientes, o pegar el enlace o código; (2) «Crear mi escuela gratis»; (3) «Trabajo por mi cuenta»: plan de entrenador independiente de **$59.000/mes**, que lleva a soporte mientras no exista COACH-P1-08. Ninguna tarjeta muestra 0. e2e en `frontend/e2e/qa-discovery` con un coach nuevo de prueba, que no se borra (las eliminaciones las hace el usuario). | S |
| COACH-P0-03 | Un solo helper de acceso por equipo y scope en todas las rutas del coach (asistencia + escritura táctica) | bff | `bff/src/services/team-access.service.ts`, `bff/src/routes/attendance.ts` (:21-48, :892, :1411, :1630, :2758, :2841), `bff/src/routes/school/football.ts`, `bff/src/routes/school/exercises.ts`, `bff/src/routes/school/teamAccess.authz.test.ts` (nuevo) | No | — | Se unifica la función local `assertCoachHasTeamAccess` con `resolverAccesoEquipo` en **un único** helper de `team-access.service.ts`; no se crea un tercero. Lo usan `attendance.ts`, `reports.ts`, `school/reports.ts`, `football.ts` y `exercises.ts`. El helper resuelve el acceso con lecturas en lote, no con 3 consultas secuenciales por llamada. Hay bypass solo para owner, admin, school_admin y super_admin. Se cierran `/checkin-by-card`, `/school-roster` y `/quick-guest`, y `/walk-in` y `/session` sin `teamId` quedan limitados a los equipos del coach. Tests: coach del equipo 200; coach de otro equipo de la misma escuela 403; otra escuela 403; padre 403. Suite del BFF en verde. Queda listo para que COACH-P2-06 sume la cobertura en un solo lugar. | M |
| COACH-P0-04 | Verificar en la base viva lo que el frente va a usar (solo lectura, consultas puntuales) | db | `docs/specs/pizarra-m6-retomar.md`, `docs/specs/partidos-registro-y-evaluacion-por-jugador.md` §9 | No | — | La única sesión de migraciones consulta `pg_policies` y `pg_proc` **filtradas por nombre** (sin `list_tables` ni `get_advisors`): (a) si `20260926131340` está viva, con sus 7 RPCs, su `proacl` y la RLS de `match_results`; (b) si `20261005173002` está viva y si un padre todavía lee `match_lineups`, `team_tactical_presets` y los eventos tácticos con `set local role` + `request.jwt.claims`. El resultado queda escrito en los dos specs. Si Partidos F1 no está viva, COACH-P1-01 queda bloqueada. | XS |
| COACH-P0-05 | Decidir y aplicar el scope de **lectura** táctica entre equipos | bff | `bff/src/routes/school/football.ts` (:153, 260, 295, 510, 547, 610, 642, 745), `bff/src/routes/school/exercises.ts` | No | COACH-P0-03, decisión D9 | Según D9, un coach lee solo las alineaciones y jugadas de sus equipos (recomendado) o todas las de su escuela. Lo que se decida queda en tests (200/403) y en `docs/coach-athlete-scoping.md`. La biblioteca de ejercicios de la escuela sigue siendo de lectura para todo el staff. | S |
| COACH-P0-06 | QA real del recorrido del coach: línea base | qa | `frontend/e2e/qa-discovery/coach-recorrido.spec.ts`, `frontend/e2e/coach-attendance-repro-besser.spec.ts`, `docs/capturas/coach-baseline/` | No | — | App levantada (frontend y BFF locales contra dev; el BFF se apaga al terminar), con un coach de Besser y uno de Dynasty, a 390 px y en escritorio. Recorre dashboard, tomar lista, QR, sesión, pizarra de fútbol, resultados e informe mensual. Quedan capturas y una lista de fallas con ruta, paso y captura. | S |
| COACH-P0-07 | Landing: verificar, commitear y desplegar lo que ya hizo la otra sesión + limpiar el combo `coach-tienda` | landing | `Landing_page/.../src/components/common/cards/RolePricingSection.tsx`, `src/pages/Entrenadores.tsx`, `src/components/sections/Pricing/ComboFinder.tsx`, `src/lib/combos.ts:48-51` | No | frente:landing | **No se reescribe.** Coordinado con la sesión que edita la landing (o hecho por ella): se revisa a ojo el «Entrenador de escuela: gratis con tu academia» / «Entrenador independiente $59.000», se commitea y se verifica el chunk desplegado. Se quita o se ajusta el combo «Coach con Tienda Propia» porque Marketplace no existe. «Pizarra táctica (fútbol hoy)» se mantiene hasta que PZ-02 llegue a producción. Sin cifras ni personas inventadas. | XS |

### Fase P1 — Partidos fuera del acceso directo a la base, permisos y QA de la pizarra

**Objetivo:** Partidos pasa a hablar con el BFF sobre las RPCs de F1, se retira la matriz muerta, se ordenan los permisos del coach en Equipos y en dinero, y se hace QA real de la pizarra multideporte cuando la integre su dueña.
**Semanas:** 2-3. **Rama:** `coach/p1`. **Lote de migraciones del frente:** COACH-P1-06 y COACH-P1-08, aplicadas juntas por la única sesión de migraciones, con `gen types` al final (y nunca en paralelo con PZ-03 ni con Canchas).

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| COACH-P1-01 | Partidos F2: rutas BFF `school/matches` sobre las RPCs de F1 | bff | `bff/src/routes/school/matches.ts` (nuevo), `matchShapes.ts` (nuevo), `matches.authz.test.ts` (nuevo), `bff/src/index.ts`, `docs/api/openapi.yaml` | No | COACH-P0-03, COACH-P0-04 | Rutas para crear y editar partido, convocados, evaluación, publicar y enlazar a un día del mesociclo. Cada handler usa el helper único de COACH-P0-03. Las RPCs se llaman **con el JWT del usuario**, nunca con service_role sin JWT (si no, el gate interno devuelve ceros en silencio). Tests: padre 403, coach de otro equipo 403, otra escuela 403. Test de concurrencia de dos `submit_match_evaluation`: **primero se verifica si ya existe** (era criterio de F1, spec :225) y solo se escribe si falta. OpenAPI actualizado. | M |
| COACH-P1-02 | Partidos F2: criterios de evaluación de la escuela | bff | `bff/src/routes/school/evaluation-criteria.ts` (nuevo), `bff/src/services/metric-catalog.service.ts` (nuevo), `docs/api/openapi.yaml` | No | COACH-P1-01 | CRUD de `school_metric_definitions` solo para quien administra la escuela (owner, admin, school_admin); el coach solo lee. La siembra va por `seed_school_match_criteria`. El catálogo resuelve escuela → global. Tests de autorización. | S |
| COACH-P1-03 | Ningún escritor directo de `match_results` en el frontend | frontend | `frontend/src/pages/ResultsPage.tsx`, `frontend/src/hooks/useFootballData.ts`, `frontend/src/hooks/useSchoolData.ts` (:410-426 `createMatchResult`), `frontend/src/components/school/FootballDashboardModal.tsx` (confirmar si escribe), `frontend/src/lib/api/matches.ts` (nuevo) | No | COACH-P1-01 | `createMatchResult` se migra al BFF o se retira si no tiene consumidores. Un test o un grep en CI asegura que no queda ningún `.from('match_results').insert/update/delete` en `frontend/src`. Los errores del BFF o de RLS muestran un mensaje claro, nunca un toast de éxito. | S |
| COACH-P1-04 | Retirar la matriz muerta `routePermissions.ts` (queda como cola de **SEG-4**, ROADMAP :1240-1249; no abrir ítem paralelo) | frontend | `frontend/src/config/routePermissions.ts`, `docs/coach-athlete-scoping.md` | No | COACH-P0-03, decisión D8 | Con el OK del usuario se retira el archivo; ningún otro archivo dice ser «Single Source of Truth» sin importadores. `coach-athlete-scoping.md` describe el gate real (helper único + `requireRole`). No hay nada que retirar en `authMiddleware.ts`. | XS |
| COACH-P1-05 | Equipos para el coach: sin botones que fallan; agregar y quitar del roster por el mismo gate | frontend | `frontend/src/pages/TeamsPage.tsx`, `bff/src/routes/enrollments.ts`, `frontend/src/components/teams/EnrollTeamStudentModal.tsx` | No | COACH-P0-03 | El coach no ve Crear, Archivar ni Eliminar equipo. Si `coach_can_enroll_paid_teams` lo permite, quitar del roster va por el BFF con el mismo gate que agregar (hoy la RLS lo niega en silencio). e2e: un coach de Besser agrega y quita un atleta y ve el aviso de mensualidad. | S |
| COACH-P1-06 | Ocultar dinero al coach: default genérico + toggle visible | db | `supabase/migrations/<npm run migrations:new -- coach_oculta_dinero_default>`, `frontend/src/pages/PaymentsAutomationPage.tsx`, `frontend/src/hooks/useEntitlements.ts` | **Sí** | Decisión D2 | Antes se mide el radio: cuántas escuelas tienen coaches que hoy ven mensualidades. Si cambia el default, va en una migración **nueva** que no reescribe a Besser. El toggle se ve en la tarjeta «Permisos». Con sesión de coach y el flag en `true`, `GET /attendance/roster` y `SchoolStudentsManagementPage` no muestran montos. | S |
| COACH-P1-07 | Cobro de la IA de la pizarra: cupo gratis + paquete como adicional | frontend | `frontend/src/config/saas-plans.ts`, `frontend/src/pages/MiPlanPage.tsx`, `frontend/src/pages/admin/IaPizarraPage.tsx`, `bff/src/routes/school/tactical-ai.ts` | No | PZ-03, decisión D1, frente:planes-por-rol | Se cierra el modelo (D1) antes de construir. Al agotarse el cupo, el botón sigue visible y ofrece el paquete por el flujo de adicionales existente. Sin cupo ni paquete no se llama al modelo (test con un mock que cuenta llamadas). El admin ve saldo y consumo. Sin comisión al cliente final. | M |
| COACH-P1-08 | Coach → entrenador independiente: cambio de rol seguro | db | `supabase/migrations/<npm run migrations:new -- coach_pasa_a_independiente>`, `frontend/src/components/coach/CoachSinEscuelaPanel.tsx` | **Sí** | COACH-P0-02, decisión D7, frente:entrenador-independiente | RPC `SECURITY DEFINER` con `search_path` fijo, `GRANT EXECUTE` solo a `authenticated` (revocado explícitamente de `anon` y `PUBLIC`), lista blanca coach → personal_trainer solo si no hay membresía activa de staff. No puede escalar a admin. Queda auditada. El conflicto de `AppSidebar.tsx:63-68` lo resuelve el frente de entrenador independiente. | S |
| COACH-P1-09 | QA real de la pizarra multideporte en la app y en celulares reales | qa | `frontend/e2e/tactical-board-*.spec.ts`, `docs/qa/pizarra-tactica-f1-checklist.md`, `docs/capturas/pizarra-multideporte/` | No | PZ-03 | En dev con cuentas reales: vóley y básquet abren su cancha; natación no ve «Pizarra»; fútbol 11 sin regresión (alineación, plantillas, GIF, PDF). «Analizar jugada» se corre **una vez por deporte** (gasta cuota compartida con producción; en CI van respuestas grabadas). La caché no descuenta cupo. El 3D cae a 2D sin WebGL2. Checklist §2.13 en un Android de gama media y en un iPhone. | M |
| COACH-P1-10 | QA de permisos con sesión simulada | qa | `supabase/tests/coach/` (nuevo, solo lectura), `docs/qa/` | No | COACH-P0-03, COACH-P1-01 | Con `set_config('request.jwt.claims', …)`, un coach de otro equipo y un padre consultan `match_results`, `match_lineups` y `attendance_records`: solo ven lo propio. Esto se suma a los tests unitarios del BFF. Va en la ventana de la sesión única de base, sin sondeos de catálogo. | S |

### Fase P2 — El coach en la cancha + Partidos en pantalla

**Objetivo:** el coach abre la app y ve qué le toca hoy, toma lista sin señal, cubre a un compañero, evalúa partidos por jugador y la familia se entera.
**Semanas:** 3-5. **Rama:** `coach/p2`.
**Compuerta:** COACH-P2-01, 02, 03, 05 y 08 **son la implementación** de los ítems del ROADMAP **UX-10, UX-11, UX-12 y V2-5…V2-8**, no un backlog paralelo. Se cierran allá. La parte de interfaz respeta la compuerta del ROADMAP: V2 fase 2 va **después de la prueba de usuarios (V2-0c)**. Si V2-0c no está lista en la semana 3, se adelanta solo el backend (COACH-P2-01 y P2-04) y la interfaz espera.
**Lote de migraciones del frente:** COACH-P2-04 y COACH-P2-06, juntas, con la sesión única y `gen types` al final.

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| COACH-P2-01 | `GET /attendance/today` (backend de UX-10) | bff | `bff/src/routes/attendance.ts`, `attendance.today.test.ts` (nuevo), `docs/api/openapi.yaml` | No | COACH-P0-03 | Una sola llamada trae los equipos del coach, el horario de hoy desde `teams.schedule` (hora Bogotá), el roster y las marcas ya recibidas, en lote (`.in`) y sin N+1. En Dynasty (todos los coaches en todos los equipos) no adivina: muestra las sesiones programadas o la última selección del coach. Tests con un coach de 2 equipos y uno de 9. | M |
| COACH-P2-02 | Pantalla «Hoy» + barra Hoy · Equipos · Sesiones · Deportistas · Más (UX-10, UX-12) | frontend | `frontend/src/pages/coach/CoachHoyPage.tsx` (nuevo), `DashboardPage.tsx`, `MobileBottomNav.tsx` (:41), `navigation.ts` | No | COACH-P2-01, COACH-P0-01, V2-0c | Muestra el próximo entreno (equipo, hora, cuántos, «Tomar lista» directo), «Más tarde hoy» y «Por hacer» (calificar el entreno de ayer, deportistas esperando ingreso, informes sin nota). El menú baja de 16 a unas 7 entradas. Capturas a 390 px sin scroll horizontal. | M |
| COACH-P2-03 | «Mis equipos» en celular como tarjetas (UX-11) | frontend | `frontend/src/pages/TeamsPage.tsx`, `frontend/src/components/teams/TeamCard.tsx` (nuevo) | No | COACH-P1-05, V2-0c | A 390 px no hay tabla desbordada. Cada tarjeta muestra deportistas, horario, próximo entreno, el chip «esperando ingreso» y los botones «Ver equipo» y «Tomar lista». El coach no ve «Nuevo equipo» ni el % de victorias. | S |
| COACH-P2-04 | Idempotencia de la asistencia: `client_generated_id` | db | `supabase/migrations/<npm run migrations:new -- asistencia_client_generated_id>`, `bff/src/routes/attendance.ts` | **Sí** | COACH-P2-01 | `attendance_records.client_generated_id` (uuid, nullable) con índice único parcial. **Una sola regla:** idempotencia por `client_generated_id` y **gana el primer escaneo del día** (evita el doble crédito; máximo 1 por atleta por día). Un reenvío de la cola nunca sobrescribe. Las ediciones manuales posteriores van por la ruta de edición, no por el reenvío. Plan aprobado; sesión única. | S |
| COACH-P2-05 | Lista sin señal: roster en caché + cola en IndexedDB (V2-5…V2-8) | frontend | `frontend/src/lib/offline/attendanceQueue.ts` (nuevo), `frontend/src/pages/CoachAttendancePage.tsx`, `frontend/src/contexts/AuthContext.tsx` | No | COACH-P2-04 | En modo avión (e2e con `context.setOffline`) se ve «Guardada en este celular, se enviará al volver la señal». Al reconectar se envía sola y sin duplicados. La cola está ligada al id del usuario y se borra en signOut. Prueba en un Android real dentro de una cancha. | M |
| COACH-P2-06 | Cobertura de un sustituto por un día (`team_coverage`) | db | `supabase/migrations/<npm run migrations:new -- team_coverage>`, `bff/src/services/team-access.service.ts` (helper único), `frontend/src/pages/StaffPage` o `TeamsPage` | **Sí** | COACH-P0-03 | Tabla con estado `text + CHECK`, FKs a `public.profiles(id)` y fecha de expiración. **Otorgar cobertura es otorgar acceso**, así que la RPC `SECURITY DEFINER` valida al que concede con `user_admin_school_ids()` y exige que el destinatario sea staff activo de la misma escuela (`user_staff_school_ids()` evaluado sobre él). La policy es `FOR ALL` **con `WITH CHECK` explícito** y no es recursiva. El helper único valida la expiración. Test: el sustituto toma lista y califica ese día y al siguiente pierde el acceso. `seguridad:invariantes` sin críticos. | M |
| COACH-P2-07 | Partidos F3: Resultados nueva (programados/jugados, convocados, evaluar, publicar) + criterios del admin | frontend | `frontend/src/pages/ResultsPage.tsx`, `frontend/src/components/matches/MatchEvaluationSheet.tsx` (nuevo), `frontend/src/pages/settings/EvaluationCriteriaPage.tsx` (nuevo), `frontend/src/pages/ResultsOverviewPage.tsx`, `docs/ROADMAP.md` | No | COACH-P1-02, COACH-P1-03 | **Sustituye explícitamente** la parte de UX-8/UX-12 que eliminaba Resultados; el ROADMAP se actualiza en ese sentido. El coach registra un partido, convoca, evalúa a cada jugador con los criterios de su escuela en una pantalla de celular y publica. La evaluación para la familia arranca apagada (D7 del spec de Partidos). `ResultsOverviewPage` deja de devolver `[]` para escuelas reales. Resultados vuelve al menú del coach. QA con Besser en dev, con capturas. | L |
| COACH-P2-08 | Evaluar al equipo tras el entreno: «Bien · Normal · Le costó» (V2-7) | frontend | `frontend/src/pages/CoachTeamPostTrainingReportPage.tsx`, `frontend/e2e/post-entreno.spec.ts` | No | COACH-P2-02 | Desde «Por hacer» se califica a todo el equipo en menos de 60 s (medido en el e2e). Usa el modelo de post-entreno existente, sin tabla nueva. El Deshacer de 8 s se agrega si existe el patrón V2-0c. | S |
| COACH-P2-09 | Aviso al equipo: requisitos del coach y reactivar «Avisos» en su menú | frontend | `frontend/src/config/navigation.ts`, `docs/specs/comunicaciones-rediseno-v2.md` (solo la sección del coach, coordinada) | No | frente:comunicaciones, decisión D4 | **Lo construye un solo frente: Comunicaciones** (DB, RLS, BFF, bandeja de la familia, push por el Despachador). El frente coach aporta los requisitos: solo staff del equipo escribe, con scope de equipo; la familia lee solo los avisos de los equipos de sus hijos; flag `coach_can_send_notices` (D4); Ley 2300. «Avisos» vuelve al menú del coach solo cuando eso esté vivo; e2e con coach + `qa.athletic@sportmaps.co`. | XS |
| COACH-P2-10 | Notificar a la familia cuando se publica la evaluación de un partido | bff | `bff/src/routes/school/matches.ts`, Despachador Unificado de notificaciones (existente) | No | COACH-P2-07 | Al publicar, el acudiente del jugador evaluado recibe un aviso in-app y push por el Despachador, solo si el flag de la escuela está encendido. Si se publica dos veces, no se duplica la notificación. Sin N+1: los acudientes se resuelven en lote. | S |

### Fase P3 — Partidos completos e informe mensual

**Objetivo:** el partido queda ligado al calendario y al mesociclo, la familia ve la evaluación y el informe mensual deja de quedarse en borrador. La pizarra M6/M5 avanza en paralelo con su dueña (PZ-04…PZ-07).
**Semanas:** 5-8. **Rama:** `coach/p3`. **Sin migraciones propias** (las de M6b, M6c y M5 son de la pizarra).

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| COACH-P3-01 | Partidos F4: calendario ↔ partido ↔ mesociclo | frontend | `frontend/src/pages/CalendarPage.tsx`, `frontend/src/pages/TrainingPlansPage.tsx`, `bff/src/routes/school/matches.ts` | No | COACH-P2-07 | Un partido agendado (rival, local o visitante) aparece en Resultados y como día «partido» del mesociclo sin volver a escribirlo (`link_day_to_match`), y el marcador se ve en el calendario. Si hay cancha asignada, la ocupación sale de `facility_occupancy` (frente Canchas) y no se duplica. | M |
| COACH-P3-02 | Partidos F5: la familia ve la evaluación publicada + partidos en el informe mensual | frontend | `bff/src/services/report-snapshot.service.ts`, `frontend/src/pages/parent/` (vista del hijo), `bff/src/routes/athlete-reports-pdf.ts` | No | COACH-P3-01, COACH-P2-10 | Con el flag encendido, el acudiente QA ve la evaluación de su hijo y no la de otros (sesión simulada). Con el flag apagado no ve nada. El PDF del informe incluye los partidos del mes. | M |
| COACH-P3-03 | Informe mensual: que el coach escriba la nota | frontend | `frontend/src/pages/coach/CoachHoyPage.tsx`, página `/informe-mensual`, `bff/src/jobs` (recordatorio existente) | No | COACH-P2-02 | «Por hacer» muestra «N informes esperan tu nota» con acceso directo. La nota se escribe por atleta en el celular, con siguiente/anterior. **El coach también recibe una notificación** (Despachador) con esos pendientes, una por día como máximo. El job no hace N+1. Métrica: menos del 20 % de borradores sin nota en Besser en el siguiente cierre de mes. | S |
| COACH-P3-04 | QA real de punta a punta del coach (regresión completa) | qa | `frontend/e2e/qa-discovery/coach-recorrido.spec.ts`, `docs/capturas/coach-final/` | No | COACH-P2-05, COACH-P2-07, COACH-P2-09, PZ-04 | Se repite COACH-P0-06 con coaches de Besser (fútbol), Monster Volley (vóley) y Dynasty, en celular real y en escritorio. Recorre Hoy, lista sin señal, pizarra por deporte, IA (una corrida real por deporte), 3D, partido con evaluación, aviso al equipo e informe mensual. Ninguna falla P0/P1 abierta. Capturas comparadas con la línea base. | M |

### Fase P4 — Venta: piloto gratis 1 mes y contenido

**Objetivo:** convertir al coach en argumento de venta de la academia y validar la pizarra (con IA) y Partidos con escuelas reales, **gratis el primer mes**.
**Semanas:** 4-8, en paralelo con P2 y P3. **Rama:** `coach/p4`.

| id | Título | Capa | Archivos | Migración | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|---|---|---|
| COACH-P4-01 | Mecanismo del piloto gratis: cupo ampliado con fecha de fin y sin cobro automático | db | Primero se verifica si el flujo de adicionales ya tiene un periodo de prueba con fecha de fin. Si no lo tiene: `supabase/migrations/<npm run migrations:new -- piloto_gratis_coach_pizarra>`. Además `frontend/src/pages/admin/IaPizarraPage.tsx` y un job de avisos en `bff/src/jobs` | **Sí (condicional)** | COACH-P1-07, PZ-03 | El piloto se activa por escuela con **fecha de inicio y de fin registradas** (reutilizando el mecanismo de prueba de adicionales si existe; si no, con columnas `text + CHECK` y fechas, sin `CREATE TYPE`). Lo activa y lo apaga solo el super_admin, vía RPC `SECURITY DEFINER`. El aviso a los 5 días del fin va por el Despachador. **Al terminar no hay cobro automático ni permanencia**: el cupo vuelve al gratis estándar hasta que la escuela compre. Un job sin N+1 apaga los pilotos vencidos. Test: el día 31 no se llama al modelo por encima del cupo estándar. | S |
| COACH-P4-02 | Piloto GRATIS 1 mes con escuelas reales | ventas | `docs/pilotos/coach-pizarra-piloto-2026-11.md` (nuevo) | No | COACH-P4-01, COACH-P1-09 | Tres escuelas (propuestas en D6: Monster Volley para vóley, Besser para fútbol y Partidos, Club Carmel o Dynasty para la lista en cancha). Se miden T0 y el día 30 (ver §3). Al final hay un reporte con la decisión de precio del paquete de IA, basada en el costo medido en `llm-usage`. | S |
| COACH-P4-03 | Copy de venta: «Tus entrenadores van gratis» | ventas | `docs/marketing/coach/` (nuevo), copy en `frontend/src/config/saas-plans.ts` | No | COACH-P0-07 | Solo se lista lo que corre en la app: periodización, lista con QR, informe mensual, semáforo médico, y la pizarra por deporte cuando esté en producción. En `saas-plans.ts` **solo se toca el copy**; los límites ya dicen coaches ilimitados (:452-466). Sin cifras ni testimonios inventados. | XS |
| COACH-P4-04 | Manual y tutoriales del coach (PDFs con capturas reales) | contenido | `docs/manuales/_src/coach/` (nuevo), `docs/manuales/academias/`, `bff/src/data/help-articles.ts` | No | COACH-P3-04 | Dos versiones (interna y academias) más Sportbot, con capturas reales de dev. Cubre Hoy, lista sin señal, pizarra por deporte, Analizar jugada, partido y evaluación, y aviso al equipo. Más un artículo en el Centro de Ayuda. | M |

**Conteo:** P0 7 tareas / 0 migraciones · P1 10 / 2 · P2 10 / 2 · P3 4 / 0 · P4 4 / 1 condicional. Aparte van las migraciones de la pizarra (6 del lote + 2 de M6 + 1 de M5), que son de la sesión dueña.

---

## 3. Piloto gratis 1 mes

| | |
|---|---|
| **Qué** | La pizarra multideporte con cupo de IA ampliado + Partidos (registro, evaluación y publicación) + lista sin señal cuando esté viva. El coach ya es gratis siempre dentro del plan de la escuela; lo que es gratis por 30 días es el **paquete de IA** y el acompañamiento. |
| **A quién** | Tres escuelas (D6): **Monster Volley** (vóley: pizarra fuera del fútbol), **Besser** (fútbol + Partidos; quién valida en Besser está en D6) y **Club Carmel o Dynasty** (lista en cancha y equipos compartidos). |
| **Condiciones** | 30 días con fecha de fin explícita y aviso 5 días antes por el Despachador. Sin cobro automático al terminar, sin permanencia y sin comisión al cliente final. Mecanismo: COACH-P4-01. |
| **Qué se mide (T0 y día 30)** | Aperturas de la pizarra por coach por semana, separadas por deporte · análisis de IA usados y costo real en `llm-usage` · partidos registrados, evaluados y publicados · listas tomadas sin señal y reenviadas sin duplicado · % de informes mensuales con nota del coach · coaches activos por semana sobre coaches con equipo. |
| **Criterio de éxito** | En al menos 2 de las 3 escuelas: ≥ 60 % de los coaches con equipo usan la pizarra o Partidos cada semana durante las semanas 3-4; ≥ 1 partido evaluado y publicado por equipo de competencia; 0 duplicados de asistencia por la cola; informes sin nota < 20 % en Besser; y que el costo de IA por escuela permita fijar el precio del paquete con margen. Además, al menos 1 escuela compra el paquete de IA o declara que lo compraría. |

---

## 4. Decisiones abiertas

| # | Decisión | Bloquea |
|---|---|---|
| D1 | Modelo de cobro de la IA de la pizarra. El spec dice 15 análisis gratis al mes **por escuela** y luego paquetes de 50; el trabajo sin commitear implementa USD 1 **por coach** al mes, con tope de 10× por escuela. Hay que elegir uno. | COACH-P1-07, COACH-P4-01 |
| D2 | Default de `coach_hide_financial_info`: ¿el coach deja de ver mensualidades y estado de pago en todas las escuelas (hoy solo en Besser)? Se mide el radio antes. | COACH-P1-06 |
| D3 | Mensajes 1:1 coach-familia: ¿siguen ocultos (decisión del 08-31) o se reconstruyen dentro de Comunicaciones/WhatsApp? ¿Y `/messages` por URL se deja como está o lleva un banner? | Seguimiento de COACH-P0-01 |
| D4 | `coach_can_send_notices`: ¿encendido o apagado por defecto (el coach avisa a las familias sin aprobación de la dueña)? | COACH-P2-09 |
| D5 | M5/M6f: los deportes nuevos (rugby, tenis, pádel, hockey…) ¿tienen pizarra «completa» o solo de «cancha», con la biblioteca vacía? | PZ-07 |
| D6 | Escuelas del piloto gratis (propuestas: Monster Volley, Besser, Carmel o Dynasty) y quién valida Partidos en Besser. | COACH-P4-02 |
| D7 | ¿Un coach sin escuela pasa solo a entrenador independiente (RPC de cambio de rol), o siempre con soporte? | COACH-P1-08 |
| D8 | ¿Se borra `routePermissions.ts` del repo (recomendado) o se cablea en `ProtectedRoute`? | COACH-P1-04 |
| D9 | Lectura táctica entre equipos: ¿un coach ve las alineaciones y jugadas de **otros** equipos de su escuela? (recomendado: no; la biblioteca de ejercicios sí). | COACH-P0-05 |
| D10 | Ledger de la pizarra: ¿union-merge o renumerar las 5 migraciones con `migrations:next`? La decide la sesión de la pizarra con el usuario. | PZ-02 → PZ-03 → COACH-P1-07, P1-09 |

---

## 5. Riesgos

- **La pizarra es de otra sesión.** Las ramas `pizarra-tp/*` y los worktrees `wt-pizarra-*` tienen trabajo sin commitear. Tocar `TacticalBoard.tsx` o integrar sin coordinar pisa cambios. Por eso todo lo de la pizarra aparece aquí solo como dependencia (PZ-*).
- **Ledger de migraciones.** Resolver el merge con `checkout --ours` + `migrations:sync` rompe `migrations:check`: las versiones de la pizarra quedan por debajo del head `20261014153542`. Hay que decidir D10 antes de aplicar, porque la versión aplicada queda grabada en `schema_migrations`. M6b, M6c y Canchas también reservaron versiones.
- **Disk IO con una sola base para dev, stg y prod.** El lote de la pizarra (6), M6 (2), M5 (1) y las del frente (P1-06, P1-08, P2-04, P2-06, P4-01 condicional) son muchos DDL. Si se aplican en paralelo con Canchas, se puede caer todo. Una sola sesión aplica y `gen types` corre una vez por lote.
- **Dos helpers de acceso por equipo.** Si COACH-P0-03 no los unifica, la cobertura del sustituto (P2-06) habría que meterla en dos sitios y terminarían divergiendo.
- **Rutas de asistencia sin scope** (`/checkin-by-card`, `/school-roster`, `/quick-guest`, `/walk-in` y `/session` sin `teamId`): hoy un coach puede operar sobre atletas de equipos que no son suyos. Por eso van en P0.
- **Dynasty** tiene a todos los coaches en todos los equipos (9 de 11): cualquier heurística de «Hoy» falla si no hay `teams.schedule` ni sesiones programadas.
- **Costo de LLM.** El QA real de «Analizar jugada» consume la cuota del proveedor que comparte producción (ya pasó con SportBot y Groq). En CI van respuestas grabadas y se hace una corrida real por deporte.
- **RPCs con gate interno.** Si el BFF llama las RPCs de Partidos con service_role sin JWT, el gate devuelve ceros o errores en silencio. El BFF tiene que reenviar el JWT del usuario.
- **Partidos F1 podría no estar viva** aunque el spec diga «aplicada»: lo que se corrió en el SQL editor no deja rastro en el registro de migraciones. COACH-P0-04 lo verifica en la base antes de construir el BFF.
- **Cola sin señal entre usuarios del mismo celular.** Si no se limpia en signOut, se repite la trampa conocida de localStorage.
- **Compuerta V2-0c.** La interfaz de «Hoy», «Mis equipos» y post-entreno depende de la prueba de usuarios. Si se construye antes, se puede terminar rehaciendo.
- **Deploy.** `commit --only` puede arrastrar imports sin trackear y romper Render, y un `/health` 200 no prueba el despliegue. Hay que verificar el chunk desplegado.
- **Landing sin commitear.** El cambio correcto ya existe en el árbol de otra sesión. Si se pierde o se pisa, la landing vuelve a vender Coach Elite y analítica que no existen.

---

## 6. Correcciones del revisor que se aplicaron

| # | Corrección | Cómo quedó |
|---|---|---|
| 1 | Las líneas citadas del menú y de la barra estaban mal | Ahora se cita `navigation.ts:432-433` y `MobileBottomNav.tsx:41` (coach). La línea :22 es del padre: se deja al frente Familias y COACH-P0-01 no la toca. |
| 2 | `assertCoachHasTeamAccess` es una función local de `attendance.ts:21-48`, no de `team-access.service.ts`, y había rutas sin scope | COACH-P0-03 unifica la función local con `resolverAccesoEquipo` en un único helper, cierra `/checkin-by-card`, `/school-roster`, `/quick-guest`, `/walk-in` y `/session` sin `teamId`, y pasa a tamaño M. |
| 3 | `requirePermission` no existe | COACH-P1-04 se reduce a retirar `routePermissions.ts` y actualizar `coach-athlete-scoping.md`. Pasa a XS; ya no lista `authMiddleware.ts`. |
| 4 | Faltaba un tercer escritor de `match_results` (`useSchoolData.ts:423`) | Se agregó a COACH-P1-03, que también obliga a confirmar si `FootballDashboardModal.tsx` escribe. |
| 5 | La landing ya estaba hecha (sin commitear) por otra sesión | COACH-P0-07 (antes P0-06) pasa a verificar, commitear y desplegar en coordinación, más limpiar el combo `coach-tienda` en `combos.ts:48-51`. No se reescribe. Tamaño XS. |
| 6 | La receta del ledger (`--ours` + `migrations:sync`) rompía `migrations:check` | PZ-02 exige union-merge o renumerar con `migrations:next`, decidido antes de aplicar (D10). Se corrigió también en Riesgos. |
| 7 | La cobertura del sustituto usaba `user_staff_school_ids()` para otorgar acceso | COACH-P2-06 valida al que concede con `user_admin_school_ids()` y al destinatario como staff activo; lleva `FOR ALL` + `WITH CHECK` explícito y expiración validada en el helper. |
| 8 | P2-04 tenía dos reglas de conflicto contradictorias | Queda una sola: idempotencia por `client_generated_id` + gana el primer escaneo del día. Las ediciones van por la ruta de edición. |
| 9 | Resultados se mantenía sin reconciliarlo con UX-8/UX-12 | COACH-P0-01 lo esconde del menú. COACH-P2-07 declara que sustituye la parte de UX-8/UX-12 que lo eliminaba, actualiza el ROADMAP y lo devuelve al menú. |
| 10 | Cambiar «Chat» por «Asistencia» duplicaba «Asistencias» | «Chat» pasa a «Sesiones» (`/training-plans`), alineado con la barra objetivo de UX-10. |
| Faltantes | Lectura táctica entre equipos | Nueva COACH-P0-05, con la decisión D9. |
| | Verificar en la base viva Partidos F1 y la RLS de `match_results` | Agregado a COACH-P0-04, que bloquea COACH-P1-01. |
| | QA de permisos con sesión simulada | Nueva COACH-P1-10. |
| | Notificar a la familia al publicar una evaluación y al coach por informes pendientes | Nueva COACH-P2-10; la notificación al coach va en COACH-P3-03. |
| | Mecanismo concreto del piloto gratis sin cobro automático | Nueva COACH-P4-01: fechas registradas, aviso a 5 días, apagado automático y sin cobro. |
| | `saas-plans.ts` ya dice coaches ilimitados | COACH-P4-03 solo toca el copy, no los límites. |
| | `/messages` sigue accesible por URL | Queda como D3. |
| | `requirePermission` ya fue eliminada en SEG-4 (02-sep) | COACH-P1-04 referencia SEG-4 y solo retira la matriz del frontend; la decisión D8 es una sola para todos los frentes. |
| | Falta candado único de migraciones | Cada lote del frente (P1, P2) se aplica en la ventana de la única sesión de migraciones, con dueño nombrado, y nunca en paralelo con PZ-03 ni Canchas. |
| Duplicados | P0-01 y P2-01/02/03/05/08 son UX-10/11/12 y V2-5…8 | Se referencian como implementación de esos ítems y se respeta la compuerta V2-0c. |
| | Las tareas de la pizarra aparecían como propias | Se sacaron del conteo del frente: quedan como dependencias PZ-01…PZ-07. |
| | El test de concurrencia de Partidos ya era criterio de F1 | COACH-P1-01 verifica primero si existe. |
| | El aviso al equipo se solapaba con Comunicaciones | Lo construye Comunicaciones. COACH-P2-09 queda en requisitos + reactivar «Avisos» en el menú; las antiguas P2-09/P2-10 de DB y BFF salen del frente. |
