# Plan de ejecución del ecosistema SportMaps (olas de desarrollo)

**Fecha:** 2026-10-14 · **Arranque:** jueves 15-oct-2026 · **Horizonte:** 15-oct-2026 a mediados de feb-2027

Este documento convierte los 14 backlogs de `docs/specs/ecosistema/backlog/*.md` en **olas de desarrollo** que se pueden asignar a agentes. No reemplaza los backlogs: cada tarea sigue viviendo en su archivo (criterio de aceptación, tamaño, dependencias). Aquí se decide **en qué orden, en paralelo con quién, con qué archivos exclusivos y con qué lote de migraciones**.

Contexto leído: `plan-maestro-ecosistema-2026-10.md`, `plan-agresivo-canchas-2026-10.md`, los 14 backlogs y los inventarios de tareas de cada uno. **No se consultó la base ni se verificó el código vivo**: todo lo que los backlogs marcan como "por verificar" sigue por verificar, y la primera tarea de cada frente que lo exige queda en la Ola 0.

> Convención de nombres. `02-plataforma` y `06-trainer` usan los dos el prefijo `PT-`; aquí se citan como **PT-PL-xx** (plataforma) y **PT-TR-xx** (entrenador). Los IDs de `09-torneos` (`P0-01`…) se citan como **TOR-Pn-xx**. El resto conserva su prefijo (`CAN-`, `LSC-`, `ESC-`, `COACH-`/`PZ-`, `BW-`, `ORG-`, `FED-`, `FAM-`, `DEP-`, `TPM-`, `MA-`).

---

## 0. Reglas de ejecución (valen para todas las olas)

**Decisiones del dueño ya tomadas (14-oct):** entrenador independiente $59.000/mes; bienestar $59.000/mes (~$119.000 cuando exista el cobro en la app); coach de escuela gratis dentro del plan de la escuela; Canchas Gratis (hasta 2) / $99k / $199k. **Todo piloto es gratis por un mes.** Sin comisión al cliente final; recargos solo si los decide quien cobra. **La mora NO cancela inscripciones.** La landing solo publica lo que corre en la app.

**Cómo se trabaja:**

1. **Un paquete = un agente = una rama = archivos exclusivos.** Ningún archivo aparece en dos paquetes de la misma ola. Si dos tareas necesitan el mismo archivo, van en el **mismo paquete** (o en commits secuenciales del mismo agente).
2. **Ramas:** `wt-<frente>-o<ola>` (con sufijo `-db`, `-bff`, `-front` cuando el frente tiene varios carriles). Se nace desde `develop`, se integra con `--no-ff`, **nunca a `main`** (eso lo hace el dueño). Los worktrees se arman a mano (`wt-*` con junctions): `isolation: worktree` falla en este equipo.
3. **Archivos calientes** (los toca más de un frente; tienen **un solo dueño por ola**, ver §0.1).
4. **Migraciones: un solo carril.** Ningún agente de dominio aplica SQL ni toca `supabase/migrations/`, `migrations_ledger.json` ni `types.ts`. Los agentes dejan **borradores** en `docs/migraciones-para-aplicar-AAAA-MM-DD/NN_<frente>_<slug>.sql` (convención que el repo ya usa) con su plan aprobado. **La sesión de migraciones de la ola** (`O<n>-MIG`) es la única que: crea cada migración con `npm run migrations:new -- <slug>` (reserva la versión), revisa cada policy **línea por línea**, mide el radio, aplica **por CLI** (vía que deja rastro), corre `seguridad:invariantes` y `seguridad:rls-negativas`, y regenera `types.ts` **una sola vez al final del lote**. Una ola = **un lote**. Sin `list_tables`, `get_advisors` ni listados de funciones como sondeo: se consulta `pg_policies`/`pg_proc` por nombre.
5. **Plan antes de SQL.** El plan de migraciones de la ola N+1 lo escribe un agente durante la ola N y **se aprueba en el punto de revisión de cierre de la ola N** (§5). Sin aprobación no se escribe SQL.
6. **Full-stack por feature.** Cada paquete que toca datos cierra con: DB + RLS + RPC + BFF + frontend + QA. Las RPC que crean varias filas son transaccionales, `SECURITY DEFINER`, con `SET search_path = pg_catalog, public, pg_temp`, `GRANT EXECUTE` explícito y `REVOKE` de `anon`/`authenticated` donde corresponda. Estados con `text + CHECK`. Escritura con `user_staff_school_ids()`; lo que otorga permisos con `user_admin_school_ids()`; **nunca** `user_school_ids()` para escribir. Los jobs leen en lote (`.in()`), sin N+1, y son idempotentes entre los 3 BFF.
7. **Prueba real, no solo tests.** Todo paquete declara su prueba real: app corriendo (frontend + BFF local o gemelo Docker) con el recorrido del usuario, o consulta por nombre contra la base viva (solo lectura) cuando el backlog lo pide. Las pruebas de concurrencia, de carga y de RLS corren **en el gemelo local Docker**, no contra la base compartida. Contra la base viva solo `seguridad:invariantes` y `seguridad:rls-negativas`.
8. **Commit no es deploy.** Cada ola cierra con deploy de los 3 BFF y un smoke del chunk o de la ruta viva (no `/health`). **Se commitea solo lo propio**, con índice temporal (`git commit --only` arrastra imports sin trackear: revisar `git status` completo antes de cada commit).
9. **Pushes agrupados** por el cupo de Vercel (4 despliegues por push): máximo **2 pushes de integración por ola** (a mitad y al cierre), salvo hotfix.
10. **Credenciales por ambiente:** las llaves de Mercado Pago de dev son de producción (`APP_USR-`); ningún paquete las usa para pruebas de cobro. Pruebas de pago en sandbox (Wompi/MP) o con credenciales propias del club.

### 0.1 Archivos calientes y su dueño por ola

| Archivo | Quién lo toca (backlogs) | Regla |
|---|---|---|
| `frontend/src/config/saas-plans.ts`, `pages/MiPlanPage.tsx`, `hooks/useEntitlements.ts`, `TrialStatusBanner`, `AdminSubscriptionsPage.tsx` | PT-PL, PT-TR, BW, CAN-P2-14, ESC-P1-07, COACH-P1-07, TOR-P0-16 | Dueño: paquete `O*-APP-PLANES`. Los demás le entregan el cambio como commit en su rama **hacia** esa rama, no editan en paralelo. |
| `config/navigation.ts`, `App.tsx`, `AppSidebar.tsx`, `MobileBottomNav.tsx`, `ProtectedRoute.tsx`, `lib/feature-flags.ts` | PT-PL-P0-10/12, FAM-01/03/13/14, COACH-P0-01, TPM-P0-05, TOR-P0-07, BW-P0-5, DEP-P0-02, FED-P0-04, CAN-P3-07 | Dueño: `O*-APP-NAV`. |
| `pages/DashboardPage.tsx` | COACH-P0-02, COACH-P2-02, FAM-04/12, DEP-P1-04/10 | Dueño: `O*-APP-DASH`; commits secuenciales. |
| `bff/src/routes/events.route.ts` | ORG-P0/P1/P2, TOR-P0/P1/P2, FED-P3 | Dueño: `O*-EVENTOS-BFF` (un solo agente, ORG y TOR en su rama). |
| `pages/school/SchoolTournamentDetailPage.tsx` | TOR-P0/P1/P2, ORG-P1-03/P3, FED-P3 | Dueño: `O*-EVENTOS-FRONT-TOR`. |
| `docs/ROADMAP.md`, `docs/api/openapi.yaml` | casi todos | Dueño: `O*-DOCS`. Los demás entregan su bloque en la descripción del PR; `O*-DOCS` lo integra al cierre de la ola. |
| `supabase/migrations/**`, `migrations_ledger.json`, `types.ts` | todos | Solo `O*-MIG`. |
| Landing (repo aparte `Landing_page/sportmap-maps-landing-page`): `RolePricingSection.tsx`, `role-offers.ts`, `PlansComparisonTable.tsx`, `combos.ts`, `Canchas.tsx`, `mapData.ts`, `llms*.txt` | LSC, CAN-P0-06/P3-09/P4-06, PT-PL-P0-06, PT-TR-P0-11, BW-P0-1, FED-P0-01/02, FAM-05/57, DEP-P0-03/P3-08, MA-P0-01/02/P3-05, TPM-P0-01, ESC-P0-10/11, COACH-P0-07, ORG-P0-18/P2-12 | **Un solo frente edita la landing:** `03-landing`. Los demás frentes le piden el cambio (están listados en su paquete). Es otro repo y otro proyecto de Vercel. |
| `bff/src/jobs/maintenance.job.ts`, `notifications-dispatch.job.ts`, `bff/src/routes/wompi.ts`, `bff/src/index.ts` | PT-PL-P1-03, FAM-30/37, TRN, BW, CAN-P2-01, COACH | Dueño por ola: el paquete de **plataforma-pilotos** (maintenance/dispatch) y el de **Canchas pagos** (wompi.ts). `index.ts`: un commit pequeño por paquete, integrado por `O*-DOCS` al cierre (solo líneas de `app.use`). |

> **Precondición de la Ola 0 (O0-HIGIENE):** hoy `git status` muestra trabajo sin commitear de otra sesión en `App.tsx`, `AppSidebar.tsx`, `ProtectedRoute.tsx`, `saas-plans.ts`, `AuthContext.tsx`, `useSchoolContext.ts`, `MyChildrenPage.tsx`, `MyPaymentsPage.tsx`, `PaymentsAutomationPage.tsx`, `TeamsPage.tsx` y otros, más archivos nuevos sin trackear (`FigureMotion3D.tsx`, manuales, specs). **Ningún agente de esos archivos arranca hasta que esa sesión commitee o apile su trabajo.**

---

## 1. Reconciliaciones entre backlogs (un solo dueño por pieza)

Los 14 backlogs se escribieron por separado y repiten trabajo. Para no construir tres veces lo mismo, **cada pieza tiene un dueño**; las demás tareas se cierran como "consume" o "verifica". Se aprueba junto con el plan en R0.

| # | Pieza repetida | Tareas | Dueño único | Las demás |
|---|---|---|---|---|
| R-01 | **Mecanismo de piloto gratis 1 mes** (columna de fecha + factura + job de avisos) | PT-PL-P1-01/02/03, ESC-P1-01, COACH-P4-01, TPM-P1-03, TOR-P4-01, BW-P1-10, PT-TR-P1-09, FED-P4-01 | **PT-PL-P1-01/02/03** (`school_addons.trial_ends_at` + `admin_start_pilot/convert/end` + job diario) | Consumen. Una sola migración. **Interino Ola 0:** `school_addons.metadata.gratis_hasta` + registro manual de pilotos (como ya propone TOR-P0-14); se migra a la columna en L1. Cada frente aporta su copy de avisos como plantilla. |
| R-02 | **Despachador de notificaciones en producción** | PT-PL-P1-05, FAM-30 | **FAM-30** (con kill-switch) | PT-PL-P1-05 se cierra al cerrarse FAM-30. |
| R-03 | **Explorar en producción: flags por rol** | PT-PL-P0-10, FAM-01, DEP-P0-02 | **FAM-01** (`VITE_SHOW_EXPLORE_PARENT`) y un flag gemelo para atleta; **la decisión es del dueño (D-EJ-01)** | PT-PL-P0-10 y DEP-P0-02 reutilizan el mismo patrón en `feature-flags.ts`. |
| R-04 | **Auditoría de lo que Explorar expone a anon** | PT-PL-P0-11, DEP-P0-01, FAM-02 (parte de categorías) | **PT-PL-P0-11** (seguridad); FAM-02 audita categorías vacías sobre ese resultado | DEP-P0-01 se cierra con el informe de PT-PL-P0-11. |
| R-05 | **Revisión y aplicación de las 3 migraciones de tienda del 13-oct** | ESC-P0-03/05, TPM-P0-07/08 | **ESC-P0-03/05** | TPM-P0-07/08 se cierran con el informe de ESC. |
| R-06 | **Allowlist fail-closed + compra sin cuenta apagada** | ESC-P0-04, TPM-P1-02 | **Una sola migración** `tienda_piloto_allowlist_y_invitado_apagado`, escrita por `O0-TIENDA` | ESC-P0-04 y TPM-P1-02 son la misma tarea. |
| R-07 | **Encender tienda de GYM RM** | ESC-P0-07, TPM-P1-11 | **ESC-P0-07** (21-oct) | TPM-P1-11 se cierra con ESC-P0-07. |
| R-08 | **Frontend de tienda N1/N2/N3, avisos, manual y medición del piloto** | ESC-P1-02/03/04/05/06, ESC-P3-01, TPM-P1-04/05/06/07/13/14 | **Frente Tiendas (13)** | ESC-P1-02…06 y ESC-P3-01 se cierran como "ver TPM". |
| R-09 | **Retirar `store_owner`** | ESC-P3-03, TPM-P2-01/02 | **TPM-P2-01/02** | ESC-P3-03 se cierra. |
| R-10 | **Marcas aliadas v0** (tablas, RPC, BFF, tarjeta, patrocinio, SportPoints premios) | TPM-P3-01…08, MA-P1/P2/P3, FAM-70/71 | **Frente Marcas (14)**; SportPoints F0 solo en **FAM-71** | TPM-P3 completo se cierra como "ver MA". |
| R-11 | **Fixture de torneo como RPC transaccional** | ORG-P1-02, TOR-P1-04, FED-P3-00 | **ORG-P1-02** (liga y copa, en L1: el piloto de organizadores lo necesita) | TOR-P1-04 se cierra; TOR-P2-04 extiende a grupos + llave; FED-P3-00 consume. |
| R-12 | **Partidos programados en cancha** (`tournament_matches` + `facility_id`/`starts_at`/`ends_at` + `schedule_tournament_match`) | ORG-P3-01/02, TOR-P1-02/03/06/07/08, CAN-P4-07, FED-P3-05 | **Frente Torneos (09)** | Los demás consumen; CAN-P4-07 y ORG-P3-01 se cierran. |
| R-13 | **Grupos + eliminatoria, sanciones, carné y página pública del torneo** | ORG-P3-03/04/05/06, TOR-P2/P3, FED-P3-03/04 | **Frente Torneos (09)** | ORG-P3 y FED-P3-03/04 se convierten en QA y en uso desde el contexto de organizador o liga. |
| R-14 | **Toggle "Alquilar mis canchas", planes de Canchas en `/mi-plan`, clases que ocupan cancha, reservas en "Ingresos del mes"** | ESC-P2-01/02/03/04, CAN-P2-04/07/14, CAN-P1-07 | **Frente Canchas (01)** | ESC-P2-01…04 se cierran; ESC-P2-05/06 quedan como QA y piloto hybrid. |
| R-15 | **Canchas por niveles (`plan_variant`) y tope por tier** | PT-PL-P1-06, CAN-P1-03 | **CAN-P1-03** | PT-PL-P1-06 se cierra si CAN-P1-03 lo trae completo (verificar en el plan de L1). |
| R-16 | **Directorio público de la landing** (mapa real, `/clubes/:slug`, `/canchas/:ciudad`) | CAN-P4-05/06, LSC-P2-01…08 | Endpoint público de venues: **CAN-P4-05** (se **adelanta** a la Ola 3); páginas: **LSC-P2** | CAN-P4-06 se cierra. |
| R-17 | **"Reservar cancha" para familia y atleta** | CAN-P4-08, FAM-50/52, DEP-P2-02/03 | **FAM-50/52** (acudiente); atleta adulto en **DEP-P2** sobre lo mismo | CAN-P4-08 se cierra. |
| R-18 | **Cambio de rol coach → entrenador independiente** | COACH-P1-08, PT-PL-P2-10, COACH-P0-02 | **COACH-P1-08** (RPC) | PT-PL-P2-10 solo verifica la pantalla. |
| R-19 | **Precio de Coach Pro / entrenador en `schools`** | PT-PL (D-PT-1), PT-TR-P0-04, PT-TR (D-01) | **Decisión D-EJ-02**; por defecto, puente con `custom_price_cents` (sin migración) | PT-TR-P0-04 (`coach_pro` como `plan_code`) queda **condicionada**. |
| R-20 | **Cuenta de cobro propia (Connected Accounts)** para entrenador, organizador, bienestar, club | PT-TR-P1-03, ORG-P2-04, BW-P2-2, CAN-P0-11 | El frente de Connected Accounts (~85 %, dependencia externa DIN-6) | Ninguno construye una pasarela propia; cada uno **verifica** la suya con su rol. |

---

## 2. Calendario maestro

| Ola | Fechas | Tema | Lote de migraciones | Revisión del dueño al cierre | Hitos |
|---|---|---|---|---|---|
| **0** | jue 15 – mié 21 oct | Limpiar, desbloquear y dejar los planes aprobados | **L0** (pases lun 19 / mar 20 / mié 21) | R0a vie 16-oct (planes) y R0b mié 21-oct | H1 Canchas (21-oct) |
| **1** | jue 22 – mié 28 oct | Motor de reservas F1, pilotos como mecanismo, organizador anfitrión, trainer | **L1** (mar 27, paso final mié 28) | R1 mié 28-oct | — |
| **2** | jue 29 oct – vie 6 nov | Cobro y canales de Canchas, familia y Hoy del coach, bienestar con escuela | **L2** (mar 3-nov) | R2 vie 6-nov | H2 (ver riesgo) y H3 piloto cobrando |
| **3** | lun 9 – vie 20 nov | Diferenciales de Canchas, torneos en cancha, organizador v2, directorio | **L3** (jue 12-nov) | R3 vie 20-nov | H4 lanzamiento público (20-nov) |
| **4** | lun 23 nov – vie 4 dic | Operación completa de Canchas, ligas, marcas v0, deportista | **L4** (mar 24-nov) | R4 vie 4-dic | H5 (27-nov) y H6 (4-dic) |
| **5** | lun 7 – vie 18 dic | Torneo serio, bienestar F5, SportPoints, cierre de año | **L5** (mié 9-dic) | R5 vie 18-dic | Congelamiento de despliegues grandes 21-dic a 6-ene |
| **6** | lun 11 ene – vie 12 feb 2027 | Ligas y liga piloto, atleta ID, boletería, marketplace | **L6** (mar 19-ene) y, si hace falta, ajuste (mar 9-feb) | R6 vie 12-feb | — |

Festivos que mueven fechas: lun 2-nov, lun 16-nov, mar 8-dic, vie 25-dic (verificar el calendario oficial).

**Concurrencia recomendada:** máximo **8 agentes de desarrollo en paralelo + 1 sesión de migraciones + 1 agente de docs** por ola. Más que eso rompe la revisión del dueño y satura la integración, no el cómputo.

**Presupuesto de migraciones por lote:** ~15 como techo orientativo. Si un lote se pasa, lo **diferible** (columna "diferibles") se mueve a la ola siguiente según prioridad. Entre pases se mide Disk IO (hay plan Pro desde el 14-oct, pero la base sigue siendo una sola para dev, stg y prod; el plan de optimización sigue vigente).

**Prioridad cuando haya que recortar** (plata que entra rápido y amarres): A = Canchas, planes por rol, organizador P0/P1, tienda piloto, torneos P0, entrenador y bienestar comprables, familia P1. B = Canchas P3, torneos P1, organizador v2, bienestar F4, marcas v0, directorio. C = ligas, deportista P2/P3, tienda P2–P4, SportPoints, boletería.

---

## 3. Ola 0 — jue 15 a mié 21 oct

**Objetivo:** que nadie venda ni prometa lo que no existe, que el organizador y el entrenador dejen de estar bloqueados, que la tienda y la mora queden aplicadas, y que los **planes de migración de la Ola 1 queden aprobados**. Cierra con H1 de Canchas.

### 3.1 Qué entra, por frente

| Frente | Tareas |
|---|---|
| 01 Canchas | CAN-P0-01…11 (P0-05 y P0-11 son del dueño/ventas) |
| 02 Plataforma | PT-PL-P0-01…15 |
| 03 Landing | LSC-P0-00…16 + RM |
| 04 Escuela | ESC-P0-01…13 (más ESC-P1-10 Besser, humano) |
| 05 Coach | COACH-P0-01…07; PZ-01 y PZ-02 (sesión de la pizarra); PZ-03 si llega a tiempo |
| 06 Trainer | PT-TR-P0-01…13 (P0-04 condicionada a D-EJ-02) |
| 07 Bienestar | BW-P0-1…8 |
| 08 Organizador | ORG-P0-00…20 |
| 09 Torneos | TOR-P0-01…09, 11…17 (TOR-P0-10 pasa a la Ola 1, necesita P0-09 aplicada) |
| 10 Federaciones | FED-P0-01…06 |
| 11 Familias | FAM-00…07, FAM-20 |
| 12 Deportista | DEP-P0-01…07 |
| 13 Tiendas | TPM-P0-01…11, TPM-P1-01/02 (≡ R-06) |
| 14 Marcas | MA-P0-01…09 |

### 3.2 Paquetes de trabajo

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O0-HIGIENE** | Plataforma | PT-PL-P0-01. La sesión que tiene trabajo sin commitear lo integra o lo apila; se parte de un `develop` limpio. **Humano / otra sesión.** | (ningún agente edita) | — | `git status` sin modificados en los archivos calientes (§0). Se registra el commit base de la Ola 0. |
| **O0-LAND-A** | Landing | Páginas: LSC-P0-00, 02, 03, 04, 06, 10, 11 y los pedidos de otros frentes: CAN-P0-06 (**8 menciones de "3 meses / primeros 50" y `courts` vacío**), FED-P0-01/02-páginas, BW-P0-1, ORG-P0-18, FAM-05, DEP-P0-03, MA-P0-01/02, TPM-P0-01, ESC-P0-10/11 (parte landing), PT-TR-P0-11 | `src/pages/*` (Escuelas, SobreNosotros, Partners, CasosExito, Bienestar, Organizadores, Eventos, Federaciones, Marcas, Equipamiento, Proveedores, Deportistas, Entrenadores, Canchas), `src/data/mapData.ts`, modales con promesas y código muerto (`ApiDocModal`, `TestimonialsCarousel`, `HomeC…`) | `wt-landing-o0a` | Cada página lista solo lo que corre; sin cifras, personas ni testimonios inventados; "Próximamente (fecha)" donde corresponda. QA en el **preview de Vercel** a 360 px y escritorio (TPM-P0-02). |
| **O0-LAND-B** | Landing | Precios y copy: LSC-P0-05, 07, 08 ("1 mes gratis" en todo el sitio, blog y llms incluidos), 14; PT-PL-P0-06 (verificación), FED-P0-02-componentes, LSC-P0-09 (verificar plazo real de la prueba, solo lectura) | `RolePricingSection.tsx`, `PlansComparisonTable.tsx`, `combos.ts`, `ComboFinder.tsx`, `PricingCard.tsx`, `PricingHeroSection.tsx`, `DemoModal.tsx`, `lib/blog/*`, `public/llms*.txt`, `landing:saas-plans.ts` | `wt-landing-o0b` | Ningún "Comprar" sin SKU; Servicio Pro y Agencia fuera o "Próximamente"; `grep` de "3 meses", "primeros 50", "50+ federaciones", "+10.000" sin resultados. |
| **O0-LAND-C** | Landing | LSC-P0-01 (respaldos `onrender`), 12 (**guardián de promesas**: script + `prebuild` + CI), 13 (robots.txt), 15 (SEO de salida), 16 (QA y **deploy único**), LSC-P0-RM | `scripts/verificar-promesas.mjs` (nuevo), `scripts/promesas-permitidas*`, `public/robots.txt`, `src/hooks/useUpgradeContext.ts`, `vercel.json` (raíz) | `wt-landing-o0c` | El guardián falla en CI si reaparece una promesa vetada. Un solo deploy de la landing al cierre de la ola (integra A, B y C). |
| **O0-APP-PLANES** | Plataforma · Trainer · Bienestar · Torneos | `/mi-plan` por tipo de entidad: PT-PL-P0-02, 03, 04 (texto del aviso "sin cobro dentro de la app todavía", lo aprueba el dueño), 05, 09 (BFF `upgrade-requests` alineado con los CHECK vivos); PT-TR-P0-05…10 (`TRAINER_TIERS`, `useEntitlements` reconoce `personal_trainer`, banner y 402 con vocabulario de entrenador, admin procesa la solicitud y **avisa al super admin**); BW-P0-4 (Free y Wellness Pro $59.000); TOR-P0-16 (descripción honesta del addon Torneos) | `frontend/src/config/saas-plans.ts`, `pages/MiPlanPage.tsx`, `hooks/useEntitlements.ts`, `components/billing/*`, `TrialStatusBanner`, `pages/AdminSubscriptionsPage.tsx`, `bff/src/routes/upgrade-requests.routes.ts`, `bff/src/services/saasInvoicing*` | `wt-plataforma-o0` | Un entrenador y un fisio ven **su** plan (no el grid de academia) y pueden pedirlo; si el `school_type` es desconocido cae al grid de academia. `e2e/mi-plan-entrenador.spec.ts` verde. Se hace **sin** `plan_code coach_pro` salvo que D-EJ-02 lo decida. |
| **O0-APP-NAV** | Plataforma · Familias · Coach · Tiendas · Torneos · Bienestar · Deportista · Federaciones | Navegación y flags: PT-PL-P0-10 y P0-12 (`facility_manager` en `ProtectedRoute` y menú mínimo), FAM-01 y FAM-03 (flag propio de Explorar del acudiente; "Escribir al club" en vez de Chat), COACH-P0-01 (sacar Mensajes, Anuncios y Resultados; "Chat" → "Sesiones"), TPM-P0-05 (rutas duplicadas de `store_owner`), TOR-P0-07 (entrada del addon, parte de menú), BW-P0-5 (Nutrición "Próximamente" sin botones muertos), DEP-P0-02 (flag atleta), FED-P0-04 (borrar `SchoolRegister.tsx` y su ruta) | `config/navigation.ts`, `App.tsx`, `components/AppSidebar.tsx`, `components/navigation/MobileBottomNav.tsx`, `components/ProtectedRoute.tsx`, `lib/feature-flags.ts`, `.env.example`, `pages/NutritionPage.tsx`, `pages/SchoolRegister.tsx` | `wt-nav-o0` | **Explorar no se abre en producción hasta que el dueño cierre D-EJ-01**: queda detrás de flags por rol. Ningún botón muerto en el menú del coach, el acudiente y el fisio. Prueba: recorrido con cuenta de cada rol en la app corriendo. |
| **O0-MORA** | Escuela | ESC-P0-01 (integrar las **3 migraciones de mora** de `wt-mora-integracion` **sin romper el gate del ledger**) y ESC-P0-02 (integrar frontend y avisos de `wt-mora-frontend`, `wt-mora-avisos`, `wt-mora-w…`). **La mora no cancela; solo recargo si `late_fee_enabled`.** | Archivos de las ramas `wt-mora-*` (inventariar con `git diff develop...<rama>`), `PaymentsAutomationPage.tsx`, `bff/src/jobs/` de mora | `wt-escuela-o0-mora` | Una prueba con un cobro vencido: no se cancela inscripción, no se bloquea acceso. `migrations:check` verde. Los SQL entran por `O0-MIG` (pase A). |
| **O0-TIENDA** | Escuela · Tiendas | ESC-P0-03 (revisión línea por línea de `20261013170543`, `…170548`, `…170553`), ESC-P0-04/TPM-P1-02 (**una migración**: allowlist fail-closed — `NULL` o clave ausente cierra todo — y compra sin cuenta apagada por defecto), ESC-P0-06 (Monster listo para cobrar: revisión de su estado), ESC-P0-07 (encender la tienda de **GYM RM** con flag + allowlist en la misma sentencia + adicional gratis 1 mes, vía interina), ESC-P0-08, 09 (plan de apagado), 12 (permisos con sesiones simuladas), 13 (límites del endpoint de invitado); TPM-P0-03, 04, 06, 09 (inventario de las 12 rutas del checkout), 10 (**facturación electrónica**: `autoEmitPendingOrders` solo emite con la tienda dentro del piloto), 11 (índices e IO de `store_income_*`), TPM-P1-01 (plan) | `bff/src/routes/store-guest.routes.ts`, `store-orders.routes.ts`, `marketplace.routes.ts`, `marketplace-checkout.routes.ts`, `vendor.routes.test.ts`, `bff/src/jobs/maintenance.job.ts` (solo el cambio de TPM-P0-10), `frontend/e2e/contabilidad/tienda-ingresos-en-finanzas.spec.ts`, `docs/specs/tienda-piloto-allowlist-y-gratis-1-mes.md`, borradores SQL | `wt-tienda-o0` | Anon no ve pedidos ni cuentas; la compra de invitado respeta límites y allowlist; GYM RM puede vender y **Monster sigue apagada** hasta cerrar ESC-P0-06. Prueba: compra real de invitado y con cuenta en el gemelo local, aprobación desde Pagos. Smoke en producción solo lectura. |
| **O0-EVENTOS-BFF** | Organizador · Torneos | ORG-P0-03 (**apagar `POST /checkout/event`** con 503 legible), 07 (`POST /events` y `/events/school-tournament` llaman a `create_hosted_event`), 08 (vocabulario `published`→`active` y gate unificado), 09 (documentos solo de inscritos del rol), 15 y 16 (parte BFF: `register_for_event`, `review_event_registration`); TOR-P0-03 (fixture por categoría y semilla explícita, `tournamentBracket.service`), 05 (parte BFF: tarjetas), 07 (`requireEntitlement('tournaments')` + solo lectura), 08 (resultados públicos solo de torneos publicados de escuela), 11 (sin recargo a la familia), 12 (idempotencia) | `bff/src/routes/events.route.ts`, `bff/src/routes/organizers.route.ts`, `bff/src/services/tournamentBracket.service.ts`, `tournamentStandings.service.ts`, `bff/src/middleware/requireEntitlement.ts` (extensión; `requireEntitlement` nuevo de Canchas lo cubre `O0-CANCHAS-BASE`: se coordina por commit) | `wt-eventos-o0-bff` | El organizador crea un evento y un torneo de punta a punta contra las RPC aplicadas en L0. `vitest` verde. Prueba real: segunda ronda de QA tras L0 (O1-EVENTOS-QA). **No se despliega antes de L0.** |
| **O0-EVENTOS-FRONT-ORG** | Organizador | ORG-P0-10 (el organizador crea con el formulario de torneo), 11 (retirar escrituras directas de `useEvents`), 13 (bandeja admin "Organizadores por verificar"), 15 y 16 (parte frontend), 17 (parte frontend: rutas privadas de documentos) | `pages/school/CreateTournamentPage.tsx`, `pages/organizer/CreateEventPage.tsx`, `components/organizer/wizard/*`, `hooks/useEvents.ts`, `pages/organizer/EventManagementPage.tsx`, `components/organizer/EventDocumentsTab.tsx`, `pages/admin/AdminOrganizersVerificationPage.tsx`, `pages/events/EventIndividualRegisterPage.tsx`, `MyEventRegistrationsPage.tsx` | `wt-eventos-o0-org` | Cuenta QA `qa.organizador@…`: alta → verificación por admin → crear → publicar → inscribir (ORG-P0-20, tras L0). Sin escrituras directas a `events`. |
| **O0-EVENTOS-FRONT-TOR** | Torneos | TOR-P0-05 (UI de tarjetas), 06 (**tuteo** en todo lo que llega a escuelas y familias), 07/08 (UI de solo lectura y resultados públicos), 12 (dobles clics) | `pages/school/SchoolTournamentDetailPage.tsx`, `pages/events/TournamentRegisterPage.tsx`, `pages/events/TournamentResultsPage.tsx`, `lib/api/tournaments.ts` | `wt-eventos-o0-tor` | Torneo de escuela demo de punta a punta (TOR-P0-13) con tuteo y tarjetas; `e2e/torneos-escuela.spec.ts`. |
| **O0-EVENTOS-SQL** | Organizador · Torneos | Borradores SQL con **plan aprobado en R0a**: ORG-P0-05 (cierre de RLS de `events`; va primero), 06 (`create_hosted_event`), 12 (`verify_event_organizer`), 14 (`register_for_event`), 16 (`review_event_registration`), 17 (buckets privados); TOR-P0-02 (formato por categoría + `seed`), 04 (`save_match_events`), 09 (RLS de lectura de partidos). Previo: ORG-P0-02 y ORG-P0-04, TOR-P0-01 (planes y verificación `events.status` ENUM vs texto) | `docs/migraciones-para-aplicar-2026-10-21/20…29_*.sql`, `docs/specs/organizador-eventos-plan-migraciones.md`, `docs/specs/torneos-canchas-plan-migraciones.md`, `supabase/migrations/_smoke/torneos_eventos_partido_smoke.sql` | `wt-eventos-o0-sql` | Cada policy revisada línea por línea; una sola versión de cada RPC; ningún `FOR ALL` sin `WITH CHECK`; ningún `USING(true)` en lectura de partidos. Smoke en BEGIN…ROLLBACK en el gemelo. |
| **O0-CANCHAS-BASE** | Canchas | CAN-P0-01 (reverificar F0 en vivo, **solo lectura y por nombre**, la ejecuta `O0-MIG`), 02 (**ADR**: tabla de pagos que manda, gating del venue, rol owner del dueño), 03 (plan de migraciones M8–M16 para aprobar), 04 (middlewares `requireIdempotencyKey` y `requireEntitlement`), 08 (contrato OpenAPI, lo integra `O0-DOCS`), 10 (plantillas OTP y recordatorio en Meta); CAN-P0-09 (kit alineado a la oferta única) | `docs/specs/reservas-canchas-f1-adr.md`, `docs/specs/reservas-canchas-f1-plan-migraciones.md`, `docs/specs/reservas-canchas-f0-plan-migraciones.md`, `bff/src/middlewares/requireIdempotencyKey.ts`, `requireEntitlement.ts` y `.test.ts`, `docs/marketing/canchas/*` | `wt-canchas-o0` | ADR y plan **aprobados en R0a (vie 16-oct)**; el plan incluye el gancho de patrocinio pedido por MA-P0-09. Tests de los middlewares verdes. Dos ocupaciones solapadas dan 23P01 (verificado en BEGIN…ROLLBACK). |
| **O0-COACH** | Coach | COACH-P0-03 (un solo helper de acceso por equipo y scope en las rutas del coach), 04 (verificar en la base viva lo que usará el frente, por nombre; **incluye si `20260926131340` y `20261005173002` están aplicadas**), 05 (decidir y aplicar scope de lectura táctica, según D9), 06 (QA línea base del recorrido del coach); coordina PZ-01/PZ-02 con la sesión de la pizarra (no es de este equipo) | `bff/src/services/team-access.service.ts`, `bff/src/routes/attendance.ts`, `bff/src/routes/school/football.ts`, `frontend/e2e/qa-discovery/coach-recorrido.spec.ts` | `wt-coach-o0` | Un coach no lee ni escribe equipos ajenos (prueba con dos coaches). Informe de la base viva escrito. |
| **O0-DASH** | Coach · Familias | COACH-P0-02 (coach sin escuela: panel de salida, no dashboard en ceros), FAM-04 (un solo criterio de "pendiente" y "En revisión"), FAM-20 (línea base de uso reproducible) | `pages/DashboardPage.tsx`, `pages/onboarding/CoachOnboarding*`, `lib/paymentCartera*`, `hooks/useDashboardStatsReal.ts`, `docs/metricas/familias-uso.md` | `wt-dash-o0` | Coach sin escuela ve salida; las cifras de "pendiente" coinciden en Inicio, Pagos y Dashboard. |
| **O0-BIENESTAR** | Bienestar | BW-P0-2 (verificar la base viva: gates I7, etc.; la ejecuta `O0-MIG`), 3 (alinear precio con BLQ-10, texto), 6 (QA real del fisio en la app), 7 (kit comercial "Fisio de la escuela" y **cuenta demo `is_demo`**), 8 (BLQ-5 reemplazado) | `docs/manuales/_src/bienestar-fisio-escuela/`, `docs/specs/facturacion-saas-multirol-comprobantes.md` (solo la fila de precio; lo integra `O0-DOCS`) | `wt-bienestar-o0` | Cuenta demo con datos ficticios marcados; recorrido paciente → consentimiento → cita → historia → lesión sin errores. |
| **O0-SPECS** | Trainer · Marcas · Deportista · Federaciones · Plataforma | PT-TR-P0-01 (medir los 11 entrenadores, solo lectura), 03 y 12 (plan y tarifario); MA-P0-03, 04, 06, 07 (privacidad, `PrivacyPage`/`TermsPage`), 08, 09 (pedir a Canchas el gancho); DEP-P0-01 (cierra con PT-PL-P0-11), 04, 06 (spec y plan de P1), 07; FED-P0-05, 06 (spec "Ligas piloto 2027" y plan para aprobar), 03 (verificar los seis formularios de la edge function); PT-PL-P0-08 (plan de migraciones con **lote único**), 13 (registro de pilotos) | `docs/specs/marcas-aliadas-v0.md`, `marcas-aliadas-plan-migraciones.md`, `deportista-v2.md`, `planes-por-rol-y-pilotos-plan-migraciones.md`, `planes-por-rol-mi-plan.md`, `ligas-piloto-2027.md`, `docs/pilotos/registro-pilotos-2026-10.md`, `docs/marketing/marcas/*`, `frontend/src/pages/PrivacyPage.tsx`, `TermsPage.tsx` | `wt-specs-o0` | Cada spec trae decisiones resueltas o marcadas para el dueño; cada plan de migraciones trae radio, verificación y policies. |
| **O0-QA-BASE** | Plataforma · Torneos · Familias | PT-PL-P0-11 (auditar lo que Explorar expone a anon; ≡ DEP-P0-01), PT-PL-P0-14 (prueba de regresión de factura: total del mes antes y después), FAM-02 (categorías de Explorar contra datos reales) | `bff/src/controllers/explorar.controller.ts` (solo lectura), `bff/src/__tests__/saas-factura-regresion.test.ts`, `hooks/useExplorarGlobal.ts`, `pages/ExplorarGlobalPage.tsx` | `wt-qabase-o0` | Informe de exposición a anon firmado (sin fuga, o con vista pública propuesta). La regresión de factura pasa **antes** de cualquier cambio de precios. |
| **O0-DOCS** | Todos | Integrar al cierre: ROADMAP (CAN-P0-07, ORG-P0-00, FAM-06, DEP-P0-07, BW-P0-8, MA-P0-05, TOR-P0-17, PT-PL-P0-07 [`ROADMAP.md:1717`], LSC-P0-RM, filas FED-*), OpenAPI (CAN-P0-08, ORG-P0-07), y corrección de la línea 98 del ROADMAP ("abre RPCs a anon", TPM) | `docs/ROADMAP.md`, `docs/api/openapi.yaml`, `bff/src/index.ts` (solo `app.use`) | `wt-docs-o0` | Un solo roadmap de reservas apuntando a `CAN-*`; BLQ-1/CONC-4/CAR-3/CAR-6 enlazados. |
| **O0-MIG** | Sesión de migraciones | Lote **L0**: ver 3.3. Además ejecuta las verificaciones en base viva de CAN-P0-01, BW-P0-2, COACH-P0-04, PT-TR-P0-01 y ESC-P0-05, **todas por nombre, una por una, en una sola sesión**. | `supabase/migrations/**`, `migrations_ledger.json`, `types.ts` | `wt-mig-o0` | `migrations:check` verde, invariantes en 0 críticas, `types.ts` regenerado **una vez**. |

**Humano en la Ola 0 (no son paquetes de agente):** CAN-P0-05 y P0-11 (club piloto, pasarela real), ESC-P0-06 (Monster cobrando mensualidades) y ESC-P1-10 (Besser: 14 cobros sin pagador), PT-TR-P0-02 (arrancar el piloto de los entrenadores con `admin_extend_trial`), ORG E8 (nombrar 3 organizadores), FED-P0-05 (elegir la liga), LSC-P1-01 (permisos escritos de clubes nombrados, **urgente: ya salen en el home**), MA-P0-03 (re-medir audiencia), LSC-P0-15 (Search Console).

### 3.3 Lote L0 (una sesión, tres pases, `types.ts` una vez al final)

| Pase | Día | Contenido | Condición |
|---|---|---|---|
| **A** (ya escritas) | lun 19-oct | 3 de mora (ESC-P0-01) + 3 de tienda del 13-oct (ESC-P0-05) + 1 de allowlist/invitado apagado (R-06) = 7 | Revisión de ESC-P0-03 terminada; GYM RM tiene el cron de mora del 17-oct y `06_gymrm_habilitar_ingreso.sql` en `docs/migraciones-para-aplicar-2026-10-14/`: se decide en R0a si entran en el pase A. |
| **B** (lote de la pizarra) | mar 20-oct | 6 migraciones de la pizarra (PZ-03) + `seguridad:rls-pizarra` | **Solo si** PZ-01/PZ-02 cerraron antes del lunes. Si no, pasan a L1. Es otra sesión: se coordina, no se asume. |
| **C** (nuevas, plan aprobado) | mié 21-oct | ORG-P0-05, 06, 12, 14, 16, 17 (6) + TOR-P0-02, 04, 09 (3) + PT-PL-P0-09 (1) + índice de TPM-P0-11 si el IO lo pide = 10 a 11 | Planes aprobados en R0a. **PT-TR-P0-04 (`coach_pro`) no entra** salvo decisión D-EJ-02. |

Total ≈ 23 (13 ya escritas). Entre pases: medir Disk IO. Después: `types.ts` una vez, deploy de los 3 BFF y smoke (jue 22-oct).

**Diferibles (a L1):** el pase B, el índice de TPM-P0-11, y ORG-P0-17 (buckets privados) si el plan de R0a no cierra a tiempo.

### 3.4 Qué se puede desarrollar en paralelo y qué no

- **Paralelo seguro (archivos distintos):** `O0-LAND-A/B/C` (otro repo), `O0-APP-PLANES`, `O0-APP-NAV`, `O0-MORA`, `O0-TIENDA`, `O0-EVENTOS-FRONT-ORG`, `O0-EVENTOS-FRONT-TOR`, `O0-CANCHAS-BASE`, `O0-COACH`, `O0-DASH`, `O0-BIENESTAR`, `O0-SPECS`.
- **Secuencial:** `O0-EVENTOS-BFF` y `O0-EVENTOS-SQL` dependen del plan de R0a; sus BFF **no se despliegan antes de L0 (pase C)**.
- **Bloqueado por decisión:** `O0-APP-PLANES` (D-EJ-02), `O0-APP-NAV` (D-EJ-01), mora/GYM RM (D-EJ-04).

---

## 4. Ola 1 — jue 22 a mié 28 oct

**Objetivo:** que Canchas tenga **motor de reservas** (la base más grande del plan), que el piloto sea un mecanismo formal y no una nota, que el organizador sea un anfitrión completo y que el entrenador tenga negocio propio.

### 4.1 Qué entra, por frente

| Frente | Tareas |
|---|---|
| 01 Canchas | CAN-P1-01…17 (M8–M15, M16 al final, vistas públicas) |
| 02 Plataforma | PT-PL-P1-01…04, 09, 10, 11 (P1-05 se cierra con FAM-30; P1-06 con CAN-P1-03; P1-07 y P1-08 son humano) |
| 03 Landing | LSC-P1-00…14 + RM |
| 04 Escuela | ESC-P1-09 (QA de regresión de cobros tras L0), ESC-P1-11 (E2E de tienda) |
| 05 Coach | COACH-P1-01…05, 07, 09, 10 (P1-06 y P1-08 → L2) |
| 06 Trainer | PT-TR-P1-01…15 |
| 07 Bienestar | BW-P1-0 (plan), borradores de P1-1, 2, 5, 6, 9 |
| 08 Organizador | ORG-P1-01…08, 10; ORG-P1-02 es el RPC de fixtures de **R-11** |
| 09 Torneos | TOR-P0-10 (RLS negativas), 12, 13 (QA real), 14 y 15 (**activar el piloto de torneos en 4 escuelas, ya con P0-06/07/08/09 desplegados**) |
| 11 Familias | FAM-10 (plan), 11 (borrador), 13, 14, 15, 16, 17, 18, 30 (despachador en prod con kill-switch) |
| 13 Tiendas | TPM-P1-04…10, 12, 13 (≡ R-08) |
| 14 Marcas | Plan de migraciones MA-P0-06 ajustado según CAN-P1-05 |

### 4.2 Paquetes de trabajo

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O1-CAN-DB** | Canchas | Borradores SQL M8…M15 + vistas públicas: CAN-P1-01 (guarda M0 deja pasar las RPC con **GUC local**, nunca `current_user`), 02 (tablas de soporte), 03 (tope por tier y gating del venue según el ADR; ≡ R-15), 04 (`disponibilidad_canchas`), 05 (`reservar_cancha`, con advisory lock y `Idempotency-Key`), 06 (ciclo de vida), 07 (clases escriben ocupación; retiro de trigger e índice viejos **sin banco de horas**), 08 (`expirar_holds` con pg_cron cada minuto), 17 (SQL de vistas), 14 (M16 al final) | `docs/migraciones-para-aplicar-2026-10-27/30…42_canchas_*.sql` | `wt-canchas-o1-db` | Cada RPC con `SET search_path`, `GRANT` explícito y policies línea por línea. En el gemelo: 50 llamadas a la misma franja, gana 1 y 49 reciben `SLOT_TAKEN`; la misma key ×10 crea 1 fila. |
| **O1-CAN-BFF** | Canchas | CAN-P1-10 (endpoints admin y públicos, `SLOT_TAKEN` con 3 alternativas, caché de disponibilidad 60 s con la escuela en la llave), 11 (OTP por WhatsApp con respaldo Resend y anti-abuso), 17 (barrido de seguridad estilo SEG-20), 16 (deploy y smoke) | `bff/src/routes/canchas-admin.routes.ts`, `canchas-publico.routes.ts`, `bff/src/services/canchas.service.ts`, `canchas-otp.service.ts`, `scripts/rls-pruebas-negativas.mjs` (solo casos nuevos) | `wt-canchas-o1-bff` | Cumple el OpenAPI de L0. Sin `debug_code` desplegado. Prueba: contra el gemelo con rate limit, token opaco y sin enumeración. |
| **O1-CAN-FRONT** | Canchas | CAN-P1-12 (**censo completo** de escritores de `facility_reservations` y `submit_facility_booking*` **antes** de M16; pasar `useFacilityReservations.ts:215/264` y `FacilityReservationModal` a RPC), 13 (lectores a la ocupación) | `hooks/useFacilityReservations.ts`, `components/school/FacilityReservationModal.tsx`, `bff/src/routes/reservations-admin.routes.ts`, `session-bookings.ts`, `public-booking.routes.ts`, `pages/AttendanceSupervisionPage.tsx` | `wt-canchas-o1-front` | El censo queda en el PR. Una franja en `hold` se ve ocupada en la UI vieja. **M16 solo se aplica después del deploy de este paquete.** |
| **O1-CAN-QA** | Canchas | CAN-P1-09 (concurrencia y seguridad **en el gemelo Docker**), 15 (cierre del lote y `types.ts`) | `supabase/tests/canchas_f1/concurrencia.sql`, `README.md` | `wt-canchas-o1-qa` | Un `facility_manager` del club A no ve el club B; anon ve 0; pago tardío termina en `confirmed` o `pending_reconciliation`. |
| **O1-PILOTOS** | Plataforma | PT-PL-P1-01 y 02 (piloto por adicional: `school_addons.trial_ends_at`, `trial_kind` text+CHECK; RPC `admin_start_pilot/convert/end`; incluye lo que pedían ESC-P1-01, COACH-P4-01 y TPM-P1-03: factura respeta "gratis hasta"), 03 (job diario: avisos a 7/3/1 días y **al vencer pausar o dejar pendiente, nunca borrar ni cancelar**; apagado con `DISABLE_*` en dev y stg), 04 (BFF `/me/entitlements` con `addon_trials`) | `docs/migraciones-para-aplicar-2026-10-27/50…52_pilotos_*.sql`, `bff/src/jobs/pilot-expiry.job.ts`, `bff/src/jobs/maintenance.job.ts`, `bff/src/routes/me.routes.ts` | `wt-plataforma-o1-pilotos` | Un piloto arranca, avisa, y vence a "Gratis" o a "pendiente" sin cobro ni bloqueo. Los pilotos interinos de la Ola 0 (metadata) se **migran** a la columna. Prueba: concurrencia + invariantes. |
| **O1-APP-PLANES** | Plataforma · Trainer | PT-PL-P1-04 (hook `useEntitlements.isAddonInTrial`), P1-09 (banner "Gratis hasta DD/MM", "Quiero seguir"), PT-TR-P1-15 (qué pasa al vencer el piloto sin pagar: solo lectura con 402) | `saas-plans.ts`, `MiPlanPage.tsx`, `hooks/useEntitlements.ts`, `components/entitlements/TrialStatusBanner.tsx` | `wt-plataforma-o1-front` | Estado visible en `/mi-plan`; nadie pierde datos al vencer. |
| **O1-TRAINER** | Trainer | PT-TR-P1-01…14 (pantallas "Mis paquetes" y "Cobros a clientes", Connected Accounts verificada en micro-escuela, mora que no toca clientes del entrenador, cerrar el router `wger` sin auth, selector de contexto si es coach también, vocabulario "clientes", **auditoría de policies** de las tablas del entrenador) | `pages/trainer/*`, `components/trainer/*`, `bff/src/routes/trainer/*`, `bff/src/routes/payment-providers.routes.ts` (solo verificación), `bff/src/index.ts:477-478` (solo `wger`) | `wt-trainer-o1` | `e2e/entrenador-cobro-cliente.spec.ts`; ningún cliente de otro entrenador visible (7 de los 9 routers llevan `requireTrainerAuth`: cerrar los 2 restantes). |
| **O1-COACH** | Coach | COACH-P1-01 (Partidos F2: rutas `school/matches` sobre las RPC de F1), 02 (criterios de evaluación), 03 (ningún escritor directo de `match_results`), 04 (retirar `routePermissions.ts`, cola de SEG-4), 05 (equipos para el coach sin botones que fallan), 07 (cobro de la IA de la pizarra: cupo gratis + paquete), 09 (QA real de la pizarra en celular real), 10 (permisos con sesión simulada) | `bff/src/routes/school/matches.ts`, `matchShapes.ts`, `school/evaluation-criteria.ts`, `pages/ResultsPage.tsx`, `hooks/useFootball*`, `pages/TeamsPage.tsx`, `bff/src/routes/enrollments.ts`, `supabase/tests/coach/` | `wt-coach-o1` | Partidos se crean y evalúan por BFF; `e2e/tactical-board-*.spec.ts` en celular real. COACH-P1-07 espera PZ-03 y D1. |
| **O1-FAM** | Familias | FAM-13 (barra Inicio · Calendario · Hijos · Pagos · Más), 14, 15 (Mis pagos: Por pagar / En revisión / Pagados), 16, 17 (ficha con pestañas), 18, 30 (**despachador en producción con kill-switch**, ≡ PT-PL-P1-05) | `MobileBottomNav.tsx` (coordina con `O1-APP-NAV`), `components/parent/ParentMoreSheet.tsx`, `pages/MyPaymentsPage.tsx`, `MyChildrenPage.tsx`, `ChildProgressPage.tsx`, `MyEnrollmentsPage.tsx`, `bff/src/jobs/notifications-dispatch.job.ts`, `crons-solo-en-render.ts` | `wt-familias-o1` | Tres perfiles de acudiente (QA FAM-19 en la Ola 2). Kill-switch probado: apagar el despachador no pierde notificaciones. |
| **O1-FAM-SQL** | Familias | FAM-10 (plan de `get_parent_home()`) y borrador de FAM-11 (RPC + pruebas de aislamiento entre hijos de padres distintos) | `docs/specs/familias-inicio-acudiente.md`, `docs/migraciones-para-aplicar-2026-10-27/60_familias_parent_home.sql`, `supabase/tests/familias/` | `wt-familias-o1-sql` | El padre A no ve datos del hijo del padre B (sesión simulada). |
| **O1-EVENTOS-BFF** | Organizador · Torneos | ORG-P1-01 (`requireEventHost` con `can_manage_event` y `userClient`), 04 (finanzas y delegaciones sin N+1), 05 (retirar rutas legacy `POST /:id/enroll`), 07 (eventos públicos en Explorar), 08 (notificaciones por el despachador), ORG-P1-02 (RPC de fixtures: borrador) | `bff/src/routes/events.route.ts`, `organizers.route.ts`, `explorar.routes.ts`, `bff/src/services/notifications/*` | `wt-eventos-o1-bff` | Un organizador ve **solo** sus eventos; sin N+1 (leer con `.in()`). Prueba: 2 organizadores y 2 escuelas invitadas. |
| **O1-EVENTOS-FRONT** | Organizador · Torneos | ORG-P1-03 (`EventManagementPage` reutiliza pestañas de torneo), 06 (RPC sin voseo: borrador SQL), 10 (guía PDF del piloto); TOR-P0-10, 12, 13 (QA real) | `pages/organizer/EventManagementPage.tsx`, `pages/school/SchoolTournamentDetailPage.tsx`, `docs/manuales/_src/organizador/`, `scripts/pruebas-concurrencia-torneos.mjs`, `frontend/e2e/torneos-escuela.spec.ts` | `wt-eventos-o1-front` | ORG-P1-11 en la Ola 2. Piloto de torneos: **4 escuelas activadas** (TOR-P0-14) con el mensaje de TOR-P0-15, solo con lo que corre. |
| **O1-TIENDA** | Tiendas · Escuela | TPM-P1-04 (avisos de tienda desde cero), 05 (N1 `SchoolStorePage` en `/tienda-escuela`), 06 (N2 un solo "Por aprobar"), 07 (N3 vitrina dentro del shell), 08 (`VendorDashboardPage` solo para externos), 09 (QA real en el gemelo), 10 (runbook de apagado), 12 (smoke), 13 (manual con capturas reales y versión Sportbot); ESC-P1-09, 11 | `pages/SchoolStorePage.tsx`, `hooks/usePendingApprovals.ts`, `pages/MiTiendaPage.tsx`, `pages/TiendaPublicaPage.tsx`, `pages/vendor/VendorDashboardPage.tsx`, `bff/src/routes/store-orders.routes.ts`, `docs/runbooks/tienda-piloto.md`, `docs/manuales/_src/tienda/`, `frontend/e2e/tienda/*` | `wt-tienda-o1` | Una venta de GYM RM aparece en "Ingresos del mes" y en "Por aprobar". Runbook probado: sacar una escuela de la allowlist sin borrar datos. |
| **O1-BW-PLAN** | Bienestar | BW-P1-0 (plan de migraciones P1 para aprobar) y borradores de BW-P1-1 (`school_professional_links`), 2 (`create_clinical_patients_from_roster`), 5 (**verificación mínima ReTHUS**), 6 (slug público + `v_wellness_professional_public`), 9 (límite Free y estado del plan) | `docs/specs/profesionales-p1-plan-migraciones.md`, `docs/migraciones-para-aplicar-2026-11-03/70…75_bienestar_*.sql` | `wt-bienestar-o1` | Plan aprobado en R1; el consentimiento del acudiente (Ley 1581) incluido; policies de las tablas clínicas sin lectura cruzada. |
| **O1-LAND-D** | Landing | LSC-P1-00 (reconciliar precios del 14-oct con BLQ-10), 02 (`role-offers.ts` fuente única), 03 (bloque de precios de `llms*.txt` generado), 04, 10 (`Canchas.tsx` solo con funciones con fecha real), 13 (verificar "Soporte humano en español") | `src/config/role-offers.ts` (nuevo), `scripts/generate-llms.mjs`, `RolePricingSection.tsx`, `PlansComparisonTable.tsx`, `Planes.tsx`, `Canchas.tsx`, `lib/comparisons.ts` | `wt-landing-o1a` | Un solo lugar define precio y oferta por rol; el guardián de promesas sigue verde. |
| **O1-LAND-E** | Landing | LSC-P1-05 (`/pilotos`: "Todo piloto es gratis por un mes"), 06 (ruteo de leads con RLS definidos; las edge functions viven en otro proyecto Supabase), 07 (consentimiento y antispam), 08 (`generate_lead`, `contact_whatsapp`, UTM), 09 (verificar que el piloto no dispara cobro ni bloqueo en la app) | `src/pages/Pilotos.tsx`, `components/forms/*`, `hooks/useAnalytics.ts`, `supabase/functions/submit-*/` | `wt-landing-o1b` | Un lead de prueba llega a ventas con consentimiento y UTM; sin bypass. |
| **O1-LAND-F** | Landing | LSC-P1-11 (blog: lo que falta del kit de Canchas y 3 de roles vivos), 12 (calendario de redes 15-oct a 4-dic, grabado en la app real), 14 (QA), LSC-P1-RM | `docs/marketing/canchas/05-blog/*.md`, `src/lib/blog/*`, `docs/marketing/canchas/01-04*.md` | `wt-landing-o1c` | Ninguna pieza sale antes de que su página de la landing esté limpia. |
| **O1-APP-NAV** | Varios | Solo lo que no cupo en la Ola 0 y los cambios que pidan `O1-FAM` y `O1-TRAINER` | los de §0.1 | `wt-nav-o1` | Sin conflictos con `O1-FAM`: si hay duda, `O1-FAM` abre un PR chico contra esta rama. |
| **O1-DOCS** | Todos | ROADMAP, OpenAPI y `index.ts` del cierre; plan de la Ola 2 consolidado | `docs/ROADMAP.md`, `docs/api/openapi.yaml`, `bff/src/index.ts` | `wt-docs-o1` | — |
| **O1-MIG** | Sesión de migraciones | Lote **L1** (3.3b abajo) y verificaciones de L0 | los de migraciones | `wt-mig-o1` | Invariantes en 0 críticas; `types.ts` una vez. |

**Lote L1 (mar 27-oct; paso final mié 28-oct).** Núcleo: CAN M8…M15 + vistas (9) · PT-PL-P1-01/02 (2) · ORG-P1-02 y P1-06 (2) · FAM-11 (1) = **14**, más lo que haya quedado fuera de L0 (pizarra, buckets). **Orden:** primero las de Canchas hasta M15, luego el **deploy de `O1-CAN-FRONT`**, y recién después **M16 (revocar la escritura directa)**; si M16 se aplica antes del deploy, la UI vieja de reservas deja de poder escribir. `types.ts` una vez al final (mié 28-oct). **Diferibles:** FAM-11 (si no cierra la revisión de aislamiento).

**Humano en la Ola 1:** elegir y firmar al club piloto de Canchas (CAN-P0-05), nombrar a los 3 organizadores (E8), conseguir permisos escritos (LSC-P1-01), alta del piloto de bienestar (3 a 5 profesionales, con 1 fisio de escuela cliente).

---

## 5. Ola 2 — jue 29 oct a vie 6 nov

**Objetivo:** que un club pueda **publicar canchas, recibir reservas en `/reservar/:slug`, cobrar por transferencia con IA y por Wompi, y operar la agenda** (H2/H3), y que la familia y el coach tengan su pantalla de "Hoy".

### 5.1 Qué entra, por frente

| Frente | Tareas |
|---|---|
| 01 Canchas | CAN-P2-01…22 (P2-20 activa el piloto) |
| 02 Plataforma | PT-PL-P2-01, 09, 10 (verificación); `CAN-P2-14` lo ejecuta `O2-APP-PLANES` |
| 03 Landing | LSC-P3-00 (plan de atribución), restos de P1 |
| 04 Escuela | ESC-P1-07 (Tienda comprable desde `/mi-plan` con "primer mes gratis"), ESC-P1-08 (restantes de la escuela del 13-oct, ya escritas) |
| 05 Coach | COACH-P1-06 (D2), COACH-P1-08 (cambio de rol), COACH-P2-01…06 |
| 06 Trainer | PT-TR-P2-01…08 (P2-03 y P2-04 son SQL) |
| 07 Bienestar | BW-P1-3, 4, 7, 8, 10, 11, 12; BW-P2-0 (plan F4) |
| 08 Organizador | ORG-P1-11 (QA), ORG-P1-12 (piloto gratis con 3 organizadores); plan de P2 |
| 09 Torneos | TOR-P1-01 (plan del lote M-T2), TOR-P0 restantes |
| 11 Familias | FAM-12, 19, 31…39 (FAM-33 y FAM-36 son SQL) |
| 12 Deportista | DEP-P1 **no entra** (se pasó a L4 por presupuesto) |
| 13 Tiendas | TPM-P1-14 (piloto GYM RM, cortes semanales), TPM-P1-15 (Monster cuando cumpla), TPM-P2-01…03 (preparar) |
| 10 Federaciones | Spec FED-P0-06 aprobada en R2; liga elegida |

### 5.2 Paquetes de trabajo

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O2-CAN-PAGOS** | Canchas | CAN-P2-01 (pagos `RSV-…` en Wompi y MP; **el pago va solo a `payments` con `payment_category 'reserva'`**; MP con `X-Idempotency-Key`; fail-closed a la pasarela de la escuela), 02 (transferencia con comprobante OCR: **leer antes los servicios de recibos**), 03 (conciliación de pagos tardíos y devoluciones registradas), 21 (sin comisión al jugador; recargo solo del club) | `bff/src/services/canchas-pagos.service.ts`, `canchas-comprobante.service.ts`, `canchas-conciliacion.service.ts`, `bff/src/services/wompi.service.ts`, `wompi-link-con-monto.service.ts`, `bff/src/routes/wompi.ts`, `mercadopago.ts` | `wt-canchas-o2-pagos` | Un webhook repetido no duplica (test estilo `wompi.doble-pago`). Prueba real: pago en **sandbox** y transferencia con comprobante real de prueba. |
| **O2-CAN-FRONT-ADMIN** | Canchas · Escuela | CAN-P2-05 (alta "Club / Canchas" con `crear_venue`), 06 (asistente de la sede), 07 (toggle "Alquilar mis canchas" — cubre ESC-P2-02), 08 (agenda en grilla canchas × horas), 12 (bandejas "por conciliar" y Llegó / No llegó) | `pages/canchas/*` (VenueOnboardingPage, TarifasTab, AgendaCanchasPage, BandejaReservasPage), `pages/RegisterPage.tsx` (`INSTITUTION_ROLES`), `pages/SchoolFacilitiesPage.tsx` | `wt-canchas-o2-admin` | Un club nuevo se da de alta, configura y ve su agenda; nadie ve otro club. QA FAM/escuela hybrid en `O4`. |
| **O2-CAN-PUBLICO** | Canchas | CAN-P2-10 (`/reservar/:slug`), 11 (`/r/:token`) | `pages/booking/PublicCourtBookingPage.tsx`, `ReservaEstadoPage.tsx`, `App.tsx` (solo 2 rutas; las integra `O2-APP-NAV`) | `wt-canchas-o2-publico` | Reserva de invitado de punta a punta con OTP; `SLOT_TAKEN` muestra 3 alternativas. |
| **O2-CAN-BOT** | Canchas | CAN-P2-13 (notificaciones de reserva por el despachador), 15 (SQL del CHECK del flujo `reserva`), 16 (flujo determinista del bot y tool `get_court_availability`) | `bff/src/jobs/canchas-recordatorios.job.ts`, `bff/src/services/whatsapp-reserva-canchas.service.ts`, `whatsapp-bot*.ts` | `wt-canchas-o2-bot` | El bot reserva y cobra por WhatsApp contra el gemelo. Si la plantilla de Meta no está aprobada, funciona con el respaldo de correo. |
| **O2-CAN-DB** | Canchas | Borradores: CAN-P2-02 (columnas del comprobante), 04 (`reserva` en las agregaciones: **tres caminos** de ingreso), 05 (`crear_venue`), 09 (cancha fija semanal), 15 | `docs/migraciones-para-aplicar-2026-11-03/10…15_canchas_*.sql` | `wt-canchas-o2-db` | Ingresos de reservas aparecen en `cash_ledger`, `kpis` y `useDashboardStatsReal` sin duplicar. |
| **O2-CAN-QA** | Canchas | CAN-P2-17 (deploy y **webhook RSV en el BFF desplegado**), 18 (QA real extremo a extremo H2/H3), 19 (manual del club con el patrón único de PDFs), 22 (**medición de Disk IO**), 20 (activar el piloto gratis de 1 mes con el club piloto) | `docs/qa/canchas-h2-h3-evidencia.md`, `docs/capturas/canchas/`, `docs/manuales/`, `docs/pilotos/canchas-club-piloto.md` | `wt-canchas-o2-qa` | Una reserva real de prueba: hold → pago → confirmación → recordatorio → asistencia. Disk IO medido antes de abrir al club. |
| **O2-APP-PLANES** | Canchas · Escuela · Plataforma | CAN-P2-14 (planes de Canchas en `/mi-plan` y factura al terminar el piloto), ESC-P1-07 (Tienda comprable desde `/mi-plan`), COACH-P1-07 (IA de la pizarra: paquete como adicional, tras PZ-03) | `saas-plans.ts`, `MiPlanPage.tsx` | `wt-plataforma-o2` | El club ve Gratis/$99k/$199k; la tienda se pide con "primer mes gratis"; nada se cobra solo. |
| **O2-APP-DASH** | Familias · Coach | FAM-12 (`ParentHome` reemplaza las stat cards), COACH-P2-02 (pantalla "Hoy" + barra Hoy · Equipos · Sesiones · Deportistas · Más), COACH-P2-03 (Mis equipos en celular) | `pages/DashboardPage.tsx`, `components/parent/ParentHome.tsx`, `hooks/useParentHome.ts`, `pages/coach/CoachHoyPage.tsx`, `components/teams/*` | `wt-dash-o2` | Familias: FAM-19 (QA tres perfiles). Coach: tomar asistencia en menos de 3 toques en celular. |
| **O2-FAM** | Familias | FAM-31 (tarjeta "Informe listo" y push), 32 (marca de "visto": **verificar y reutilizar `viewed_at` y `mark_report_viewed`**), 33 y 34 (portal por link público; SQL en L2), 35 y 36 (resumen semanal; SQL), 37 (job semanal), 38 (preferencias de notificación), 39 (QA) | `ChildReportDetailPage.tsx`, `reportsQueries.ts`, `AthleteReportPortalPublicPage.tsx`, `bff/src/jobs/familia-resumen-semanal.job.ts`, `SettingsPage.tsx`, `PushPermissionBanner.tsx`, `docs/specs/familias-ciclo-semanal.md` | `wt-familias-o2` | El job semanal no tiene N+1 y es idempotente en los 3 BFF; hora configurable (D6). |
| **O2-COACH** | Coach | COACH-P2-01 (`GET /attendance/today`), 04 (`client_generated_id`: SQL), 05 (lista sin señal: IndexedDB), 06 (`team_coverage`: SQL), P1-06 (default de `coach_hide_financial_info`: SQL), P1-08 (RPC coach → independiente: SQL; ≡ R-18) | `bff/src/routes/attendance.ts`, `attendance.today.test.ts`, `frontend/src/lib/offline/attendanceQueue.ts`, `docs/migraciones-para-aplicar-2026-11-03/20…24_coach_*.sql` | `wt-coach-o2` | La asistencia offline se sincroniza una sola vez (idempotencia) y un sustituto cubre un día sin ver finanzas. |
| **O2-TRAINER** | Trainer | PT-TR-P2-01…08 (`GET /athlete/training/today`, pantalla "Hoy" del cliente, job de recordatorio por WhatsApp con plantilla, toggle del entrenador, plantilla Meta `recordatorio_sesion_entrenador`); SQL de P2-03 (versionar funciones creadas fuera del ledger) y P2-04 (`pt_session_reminders`) | `bff/src/routes/athlete/training.ts`, `pages/athlete/ClientTodayPage.tsx`, `bff/src/jobs/pt-session-reminders.job.ts`, `bff/src/jobs/whatsapp-plantillas-sync.job.ts`, `docs/migraciones-para-aplicar-2026-11-03/30…31_trainer_*.sql` | `wt-trainer-o2` | El recordatorio llega por WhatsApp una sola vez; el job mide su Disk IO (PT-TR-P2-05). |
| **O2-BIENESTAR** | Bienestar | BW-P1-3 (pantalla escuela "Profesionales de salud"), 4 (selector de escuela del fisio), 7 (página pública `/profesional/:slug`), 8 (recordatorio de cita por WhatsApp), 10 (avisos de fin de piloto: día 25 llega la oferta de $59.000), 11 (QA real), 12 (piloto gratis con 3 a 5 profesionales); BW-P2-0 (plan F4: libro propio del profesional sin `school_id`) | `pages/clinical/SchoolProfessionalsPage.tsx`, `PatientsPage.tsx`, `pages/public/ProfessionalPublicPage.tsx`, `bff/src/jobs/wellness-reminders.ts`, `scripts/seguridad/rls-pruebas-clinicas.mjs`, `docs/specs/profesionales-f4-cobro-plan-migraciones.md` | `wt-bienestar-o2` | Escuela → fisio → importar roster (con y sin cuenta) → el acudiente firma consentimiento. **El profesional no se publica sin verificación ReTHUS mínima.** |
| **O2-EVENTOS** | Organizador · Torneos | ORG-P1-11 (QA real: un organizador corre un torneo con 2 escuelas invitadas), 12 (piloto gratis con 3 organizadores reales, alta asistida); plan de migraciones de ORG-P2 y de TOR-P1 (**R-12**) | `docs/qa/organizador-p1-evidencia.md`, `docs/pilotos/organizadores-piloto-2026-10.md`, `docs/specs/torneos-canchas-plan-migraciones.md`, `docs/specs/organizador-eventos-plan-migraciones.md` | `wt-eventos-o2` | Piloto con criterio de salida escrito (soporte incluido). |
| **O2-TIENDA** | Tiendas · Escuela | TPM-P1-14 (piloto GYM RM con cortes semanales), TPM-P1-15 (Monster, cuando cumpla ≥1 cuenta de recaudo y montos), TPM-P2-01…03 (verificar `store_owner` reales; spec y plan del directorio); ESC-P1-08 (aplicar el resto de migraciones del 13-oct ya escritas) | `docs/pilotos/*`, `docs/specs/proveedores-recomendados*.md` | `wt-tienda-o2` | Dos cortes semanales con métricas; Monster solo cobra cuando D-EJ-11 lo habilite. |
| **O2-LAND** | Landing | LSC-P3-00 (plan de atribución), LSC-P1-14 y RM | `docs/specs/atribucion-registro.md` | `wt-landing-o2` | Plan aprobado en R2. |
| **O2-PLAN-L3** | Todos | Planes de migraciones de L3: TOR-P1-01, ORG-P2 (cuenta de cobro: espera D-EJ-13), BW-P2-0, PT-PL-P2-01 (reconciliar BLQ-10), FAM-71 (spec de SportPoints F0), CAN P3 | los `docs/specs/*-plan-migraciones.md` de cada frente | `wt-plan-o2` | Todos listos para R2. |
| **O2-DOCS** y **O2-MIG** | Docs / Migraciones | Integración y lote L2 | los de §0.1 | `wt-docs-o2`, `wt-mig-o2` | — |

**Lote L2 (mar 3-nov).** Núcleo: Canchas (5) · Bienestar P1 (BW-P1-1, 2, 5, 6, 9: 5) · Familias (FAM-33, FAM-36: 2) · Coach (P2-04, P2-06, P1-06, P1-08: 4) · Trainer (P2-03, P2-04: 2) · restantes escuela del 13-oct (≈3 ya escritas) = **≈ 21**. **Diferibles:** COACH-P1-08, ESC-P1-08, FAM-33 (portal público). El resto no se mueve: Canchas y Bienestar son la prioridad A.

**Riesgo de calendario (H2/H3):** el plan de Canchas ubica H2 el 30-oct, pero CAN-P2 depende de que el motor de F1 termine el 28-oct (L1 + M16 + deploy). Se propone a R1: **H2 = viernes 30-oct solo con "publicar canchas + `/reservar/:slug` con transferencia y agenda" y H3 (bot + Wompi + club real cobrando) el 6-nov**; si L1 se atrasa un día, H2 pasa a 6-nov y H3 a 13-nov. Se decide en R1.

---

## 6. Ola 3 — lun 9 a vie 20 nov

**Objetivo:** lanzamiento público de Canchas (H4, 20-nov), torneos que ocupan cancha, organizador vendible, bienestar con cobro y directorio de clubes en la landing.

### 6.1 Qué entra

| Frente | Tareas |
|---|---|
| 01 Canchas | CAN-P3-01…07 (SQL en L3), P3-08 (QA), P3-09 (landing H4), **CAN-P4-05 adelantado** (endpoint público de venues) |
| 02 Plataforma | PT-PL-P2-02 (BLQ-10 F1, SQL L3), P2-04, 05, 06, 08 (menú por rol) |
| 03 Landing | LSC-P2-01…09, LSC-P3-01 (atribución; SQL L3), LSC-P3-02…04 (pauta y Google Business, humano) |
| 05 Coach | COACH-P2-07…10 (Partidos en pantalla), COACH-P3-01…03 |
| 06 Trainer | PT-TR-P3-01 (auditar biomecánica), 02…03 |
| 07 Bienestar | BW-P2-1 (SQL L3), P2-2…5 (pasarela, checkout, UI, página pública de pago) |
| 08 Organizador | ORG-P2-01…12 (SQL: claim_invitation, cuenta de cobro, fix del confirm de pago, roster por Excel, pago por integrante, OCR) |
| 09 Torneos | TOR-P1-02…13 (SQL L3: columnas, `schedule_tournament_match`; BFF y UI) |
| 11 Familias | FAM-50…57, FAM-71 (SQL L3), FAM-72, 73 |
| 14 Marcas | Spec y plan aprobados; **sin SQL aún** (L4) |

### 6.2 Paquetes de trabajo

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O3-CAN-DB** | Canchas | Borradores CAN-P3-01 (combinadas o divisibles; ≡ CAR-6), 02 (reglas por segmento), 03 (pago dividido), 04 (lista de espera), 05 (no-show con strikes), 07 (roles recepción y contador) | `docs/migraciones-para-aplicar-2026-11-12/10…16_canchas_*.sql` | `wt-canchas-o3-db` | Concurrencia en el gemelo: combinadas bloquean las divisibles; pago dividido con plazo configurable y apagable por el club. |
| **O3-CAN-BFF** | Canchas | CAN-P3-03 (servicio de pago dividido), P3-04 (job de lista de espera por turnos de 15 min), P3-06 (aviso inmediato cuando el club bloquea una hora vendida), **CAN-P4-05** (endpoint público de venues con caché) | `bff/src/services/canchas-pago-dividido.service.ts`, `bff/src/jobs/canchas-waitlist.job.ts`, `canchas-bloqueo-aviso.service.ts`, `bff/src/routes/explorar.routes.ts` | `wt-canchas-o3-bff` | Ningún jugador queda sin aviso; el endpoint público cachea y no filtra datos privados (vista pública). |
| **O3-CAN-FRONT** | Canchas | UI de combinadas, reglas por segmento (`ReglasSegmentoTab`), no-show y disputa (`ReservaEstadoPage`), roles de recepción | `pages/canchas/*` (los no tocados por `O2`), `ReservaEstadoPage.tsx` | `wt-canchas-o3-front` | QA CAN-P3-08 en la Ola 4. |
| **O3-LAND-DIR** | Landing | LSC-P2-01…09 (directorio: contrato, snapshot en el build, `/clubes/:slug` con JSON-LD, `/canchas/:ciudad` para 5 ciudades, opt-in "Aparecer en sportmaps.co", reconstrucción diaria por deploy hook), CAN-P3-09 (**H4**) | `src/pages/Club.tsx`, `CanchasCiudad.tsx`, `scripts/fetch-directorio.mjs`, `src/data/directorio.json`, `generate-sitemap.mjs`, `Canchas.tsx`, `vercel.json` (raíz) | `wt-landing-o3` | Solo clubes con el opt-in aparecen; IO del directorio bajo (snapshot, no consulta por visita). |
| **O3-LAND-ATRIB** | Landing · Plataforma | LSC-P3-01 (UTM del primer toque y "¿Cómo nos conociste?"; SQL en L3), LSC-P3-05 (contenido de roles tras la limpieza) | `docs/migraciones-para-aplicar-2026-11-12/20_atribucion_registro.sql`, `RegisterPage.tsx` (solo el campo), `bff/src/routes/auth*` | `wt-landing-o3b` | Un registro nuevo guarda la fuente; sin PII en la URL. |
| **O3-EVENTOS-BFF** | Organizador · Torneos | ORG-P2-03 (roster por Excel con dry-run), 05 (arreglar el confirm de pago de eventos con valores del CHECK), 06 (pago por integrante), 07 (OCR + WhatsApp para eventos), 08 (recordatorios de saldo), TOR-P1-06 (BFF de programación con `userClient`), 07 (huecos libres), 09 (aviso a equipos en lote) | `bff/src/routes/events.route.ts`, `bff/src/services/whatsapp-receipt-matching.service.ts`, `bff/src/routes/internal-notifications.routes.ts` | `wt-eventos-o3-bff` | Doble clic y concurrencia: tres academias suben comprobantes casi a la vez sin duplicar. |
| **O3-EVENTOS-FRONT-TOR** | Torneos | TOR-P1-08 (UI de programación: cancha, fecha y hora; duración por defecto), 10 (la agenda de Canchas pinta los partidos `source_kind='event'`), 12 (QA real: torneo de 4 equipos en 2 canchas del Club Campestre Demo con choque intencional) | `pages/school/SchoolTournamentDetailPage.tsx`, `pages/canchas/AgendaCanchasPage.tsx` (solo la capa de eventos: coordinado con `O3-CAN-FRONT`), `frontend/e2e/torneos-canchas.spec.ts` | `wt-eventos-o3-tor` | Un partido contra un alquiler da choque y muestra alternativas; un solo dueño de la ocupación `event` (TOR-P1-13). |
| **O3-EVENTOS-FRONT-ORG** | Organizador | ORG-P2-02 (aterrizaje `/torneos/invitacion/:token`), 09 (panel de invitaciones), 11 (contenido), 12 (pedido a landing) | `pages/events/TournamentInvitationLandingPage.tsx`, `pages/school/SchoolTournamentDetailPage.tsx` (**solo la pestaña de invitaciones, en una rama que sale de `O3-EVENTOS-FRONT-TOR`**), `docs/contenido/organizadores/` | `wt-eventos-o3-org` | Una academia invitada sin cuenta se registra liviana y entra al torneo. |
| **O3-EVENTOS-SQL** | Organizador · Torneos | Borradores: ORG-P2-01 (`claim_invitation_and_create_school`), 04 (cuenta de cobro del anfitrión: según D-EJ-13), 05, TOR-P1-02, 03 (`schedule_tournament_match`: guarda de columnas, trigger de liberación, `EXCLUDE` contra `facility_occupancy`) | `docs/migraciones-para-aplicar-2026-11-12/30…38_eventos_*.sql` | `wt-eventos-o3-sql` | Concurrencia: 2 sesiones programan la misma cancha y franja a la vez. |
| **O3-FAM-CANCHAS** | Familias | FAM-50 (Reservar cancha en Más e Inicio con gate por addon; ≡ CAN-P4-08), 51 (Explorar › Canchas), 52 (Mis reservas), 53 (precio de socio y tope por familia), 54 (aviso y recordatorio 3 h antes), 55 (QA), 57 (landing, pedido), 72 (contenido), 73 (pieza de venta para la escuela) | `ParentMoreSheet.tsx`, `ParentHome.tsx` (rama de `O2-APP-DASH`), `pages/MisReservasPage.tsx`, `PublicFacilityBookingPage.tsx`, `hooks/useMySchoolReservations*` | `wt-familias-o3` | Una familia reserva con precio de socio y ve su reserva; concurrencia desde la app. |
| **O3-FAM-SQL** | Familias · Marcas | FAM-71 (SportPoints F0: **mide participación, no da premios**), con regla de "a tiempo" y censo de caminos a `paid` (MA-P1-09) | `docs/specs/sportpoints-fidelizacion.md`, `docs/migraciones-para-aplicar-2026-11-12/40_sportpoints_f0.sql` | `wt-familias-o3-sql` | Empieza a medir el 12-nov; **4 semanas** después (10-dic) se decide go/no-go de F1 (MA-P3-01). |
| **O3-PLAT-BLQ10** | Plataforma | PT-PL-P2-02 (BLQ-10 F1: `owner_type`/`owner_id`, columnas de comprobante; SQL L3), P2-04 (BFF `/me/plan` multi-owner y comprobante con `ocr.service`), P2-05 (pago de factura por Wompi), P2-06, P2-08 (menú por rol completo), P2-09, P2-10 | `docs/migraciones-para-aplicar-2026-11-12/50_saas_multirol.sql`, `bff/src/routes/me.routes.ts`, `platform-invoicing.routes.ts`, `bff/src/services/saasInvoicing.service.ts`, `MiPlanPage.tsx` (coordinado con `O3-APP-PLANES`), `lib/roleContexts.ts` | `wt-plataforma-o3` | La regresión de factura de O0-QA-BASE sigue pasando; el entrenador y el fisio ven facturas y comprobante. |
| **O3-BW-F4** | Bienestar | BW-P2-1 (SQL F4: `service_packages`, `patient_package_balances`, `professional_charges`), P2-2…5 (pasarela del profesional **reducida a lo que falta**, checkout, `ProfessionalBillingPage`, `/pago-salud/:token`) | `bff/src/routes/payment-providers.routes.ts:224-320`, `bff/src/routes/marketplace-checkout.routes.ts`, `pages/clinical/ProfessionalBillingPage.tsx`, `pages/public/ProfessionalChargePublicPage.tsx` | `wt-bienestar-o3` | **El libro de cobros del profesional queda fuera de `payments`** (no se abre el camino 14). La mora no bloquea el acceso a historias clínicas. |
| **O3-COACH** | Coach | COACH-P2-07 (Resultados nueva: programados/jugados, convocados, evaluar, publicar), 08 (evaluar tras el entreno), 09 (Avisos del coach), 10 (notificar a la familia), P3-01 (calendario ↔ partido ↔ mesociclo), P3-02 (la familia ve la evaluación), P3-03 (nota del informe mensual) | `pages/ResultsPage.tsx`, `components/matches/*`, `CoachTeamPostTrainingReportPage.tsx`, `CalendarPage.tsx`, `bff/src/services/report-snapshot.service.ts` | `wt-coach-o3` | Una evaluación publicada llega a la familia; el menor no se ve en otro equipo. |
| **O3-TRAINER** | Trainer | PT-TR-P2-08 (QA "Hoy" + recordatorio recibido), P3-01 (auditar el scoping de las 11 rutas de biomecánica), P3-02 y 03 (pestaña "Técnica" y permisos visibles y revocables) | `bff/src/routes/trainer/biomech.ts`, `athlete/biomech.ts`, `TrainerClientProfile.tsx`, `tabs/ClientTechniqueTab.tsx` | `wt-trainer-o3` | Cierra la biomecánica con pantalla solo si D-05 lo decide. |
| **O3-APP-NAV** | Varios | Entradas nuevas de menú (Reservas, Mis reservas, Canchas por rol, recepción) y el flag de `SHOW_EXPLORE_PARENT` ya decidido | los de §0.1 | `wt-nav-o3` | — |
| **O3-DOCS**, **O3-MIG**, **O3-PLAN-L4** | Docs / Migraciones / Planes | Integración, lote L3 y planes de L4 (TOR-P2-01, FED-P1, DEP-P1, TPM-P2-03, MA-P1/P2, PT-PL-P2-03, CAN-P4) | los de §0.1 y `docs/specs/*-plan-migraciones.md` | `wt-docs-o3`, `wt-mig-o3`, `wt-plan-o3` | — |

**Lote L3 (jue 12-nov).** Núcleo (≈ 18): Canchas P3 (CAN-P3-01, 02, 03, 04, 05, 07: 6) · Torneos P1 (TOR-P1-02, 03 y el borrador de grupos: 3) · Organizador P2 (ORG-P2-01, 04, 05 y 2 más según el plan: 5) · Bienestar F4 (1) · Atribución (1) · BLQ-10 F1 (1) · SportPoints F0 (1). **Diferibles:** ORG-P2-04 (si D-EJ-13 sigue abierta), CAN-P3-07 (roles recepción), la última de ORG-P2.

---

## 7. Ola 4 — lun 23 nov a vie 4 dic

**Objetivo:** H5 (27-nov, diferenciales de Canchas) y H6 (4-dic, operación completa); grupos + eliminatoria de torneos; ligas (infraestructura); marcas v0; racha y reto del deportista; directorio de proveedores recomendados.

### 7.1 Qué entra

| Frente | Tareas |
|---|---|
| 01 Canchas | CAN-P3-08 (QA H5), CAN-P4-01…04 (SQL L4), P4-09, P4-10 |
| 02 Plataforma | PT-PL-P2-03 (RPC de comprobante, SQL L4), P2-07 (se espera a F4) |
| 03 Landing | LSC-P3-02…06 (pauta y QA del día H4), LSC-P3-RM |
| 04 Escuela | ESC-P2-05 (QA hybrid en Club Campestre Demo), ESC-P2-06 (piloto hybrid gratis 1 mes) |
| 05 Coach | COACH-P3-04, COACH-P4-02…04 |
| 07 Bienestar | BW-P2-6 (factura electrónica del profesional, opcional), P2-7 (QA F4 en sandbox) |
| 08 Organizador | ORG-P2-10 (QA con concurrencia), ORG-P3-02/07 (verificación; el motor es de Torneos) |
| 09 Torneos | TOR-P2-01…08 (grupos + llave, sanciones, planilla; SQL L4) |
| 10 Federaciones | FED-P1-00…10 (SQL L4: 6) |
| 12 Deportista | DEP-P1-01…13 (SQL L4: 4) |
| 13 Tiendas | TPM-P2-01…09 (directorio de proveedores; SQL L4: 3) |
| 14 Marcas | MA-P1-01…10 (SQL L4: 2), MA-P2-01, 03 (SQL L4: 2) |

### 7.2 Paquetes de trabajo

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O4-CAN-H5** | Canchas | CAN-P3-08 (QA real de diferenciales y regresión del motor), CAN-P4-01 (adicionales desde el catálogo de tienda v2), P4-02 (caja por sede sobre el módulo contable), P4-03 (reportes), P4-04 (tiqueteras de N horas con ocupación propia), P4-09 (QA H6 y revisión de Disk IO), P4-10 (conversión del piloto al vencer el mes) | `canchas-pagos.service.ts`, `pages/canchas/ReportesCanchasPage.tsx`, `docs/qa/canchas-h5-evidencia.md`, `canchas-h6-evidencia.md`, `docs/migraciones-para-aplicar-2026-11-24/10…14_canchas_*.sql` | `wt-canchas-o4` | La regresión del motor pasa tras los diferenciales; las tiqueteras no se apoyan en el banco de horas. Al vencer el mes: pasa a "Gratis" o se convierte, **nunca bloquea reservas hechas**. |
| **O4-TORNEOS-P2** | Torneos | TOR-P2-02 (columnas de grupos y `tournament_standings`), 03 (`tournament_sanctions` y `record_match_result`), 04 (generador de grupos + llave, `close_group_stage`; extiende R-11), 05 (BFF), 06 (UI de grupos y llave), 07 (planilla de juego), 08 (QA: 8 equipos, 2 grupos, una roja que suspende, penales en la final) | `docs/migraciones-para-aplicar-2026-11-24/20…23_torneos_*.sql`, `bff/src/routes/events.route.ts` (rama de `O4-EVENTOS-BFF`), `SchoolTournamentDetailPage.tsx` | `wt-torneos-o4` | La suspensión por roja bloquea al jugador en la planilla; concurrencia de `record_match_result` verificada. |
| **O4-FED-P1** | Federaciones | FED-P1-00 (versionar el trigger vivo si se elige la vía b), 01 (`admin_enable_league`), 02 (`admin_assign_school_admin`), 03 (`league_seasons` y `league_affiliations`), 04 (`user_league_admin_ids()`), 05 (RPC de temporada e invitación), 06 (BFF `league.routes.ts`), 07 (panel), 08 (notificaciones), 09 (cierre del lote), 10 (QA con liga de prueba y 3 clubes, uno sin cuenta) | `docs/migraciones-para-aplicar-2026-11-24/30…36_federaciones_*.sql`, `bff/src/routes/league.routes.ts`, `pages/league/*`, `docs/specs/ligas-piloto-2027.md` | `wt-federaciones-o4` | Un club de una liga **no** ve a otro club (sesión simulada); ningún trigger de entidad de gobierno se rompe. |
| **O4-DEP-P1** | Deportista | DEP-P1-01 (`athlete_weekly_streak`), 02 (`club_challenges`), 03 (BFF), 04 (tarjeta "Tu semana"), 05 (retos para admin o coach), 06 (push del viernes), 07 (`athlete_progress_summary`), 08 ("Mi progreso" fusiona Estadísticas, Objetivos y Entrenamientos), 09 (objetivos ligados a métrica), 10 (adulto sin escuela), 11 (QA), 12 (piloto con Besser y Dynasty), 13 (verificar despliegue) | `docs/migraciones-para-aplicar-2026-11-24/40…43_deportista_*.sql`, `bff/src/routes/athlete/streak.ts`, `school/challenges.ts`, `components/dashboard/AthleteWeekCard.tsx`, `pages/school/ClubChallengesPage.tsx`, `pages/StatsPage.tsx`, `GoalsPage.tsx`, `TrainingPage.tsx` | `wt-deportista-o4` | **Primero verificar `attendance_records` en vivo** (dueño de la racha y fuente de asistencia del adulto). Reto agregado por equipo: sin datos de menores individuales. |
| **O4-MARCAS** | Marcas | MA-P1-01 y 02 (tablas y RPC de Marcas v0), 03 (BFF), 04 (opt-in de la escuela, **apagado por defecto**), 05 (vista del club), 06 (`/admin/marcas`), 07 (`/beneficios`), 08 (tablero de adopción de SportPoints F0), MA-P2-01 (patrocinio de la primera reserva sobre el gancho de Canchas), 03 (reporte agregado con token, k=10 provisional), 02, 04, 10 (QA) | `docs/migraciones-para-aplicar-2026-11-24/50…53_marcas_*.sql`, `bff/src/routes/partner-benefits.routes.ts`, `admin-partner-brands.routes.ts`, `pages/admin/AdminPartnerBrandsPage.tsx`, `hooks/usePartnerBenefits.ts`, `components/AllyBenefitCard.tsx` | `wt-marcas-o4` | **Sin datos de menores en ningún reporte.** Opt-in por escuela. Prueba en el gemelo: opt-in/opt-out, k-anonimato y token del reporte. |
| **O4-TIENDA-P2** | Tiendas | TPM-P2-01 (verificar `store_owner` reales), 02 (retirar `store_owner`; ≡ R-09), 03 (spec y plan: `recommended_suppliers`, `supplier_contacts`), 04 (BFF), 05 (pestaña "Proveedores recomendados"), 06 (formulario de la landing alimenta la cola), 07 (cuota con piloto gratis 1 mes), 08 (QA del gemelo con roles padre, coach, staff, admin y anon), 09 (piloto con 3 confeccionistas) | `docs/migraciones-para-aplicar-2026-11-24/60…62_tienda_*.sql`, `bff/src/routes/suppliers-recommended.routes.ts`, `pages/SchoolStorePage.tsx` | `wt-tienda-o4` | Ninguna escuela ve los contactos de otra; `store_owner` retirado sin romper rutas legadas. |
| **O4-PLAT** | Plataforma · Bienestar | PT-PL-P2-03 (RPC de comprobante y bucket, SQL L4), P2-11 (QA y auditoría de seguridad del cobro multi-rol); BW-P2-6 y 7 (factura electrónica opcional del profesional y QA de F4 en sandbox) | `docs/migraciones-para-aplicar-2026-11-24/70_saas_comprobante_rpc.sql`, `bff/src/services/invoicing.service.ts`, `docs/capturas/bienestar-f4/` | `wt-plataforma-o4` | Concurrencia y RLS negativas del cobro del profesional; el comprobante se aprueba solo por super admin. |
| **O4-ESC-QA** | Escuela · Canchas | ESC-P2-05 (QA hybrid en Club Campestre Demo), ESC-P2-06 (piloto hybrid con 1 o 2 escuelas actuales con canchas), ESC-P1-09 (regresión de cobros) | `frontend/src/pages/SchoolFacilitiesPage.tsx` (solo lectura), `docs/qa/*` | `wt-escuela-o4` | Los entrenamientos bloquean la cancha; las reservas aparecen en "Ingresos del mes". |
| **O4-COACH** | Coach | COACH-P3-04 (QA real extremo a extremo), COACH-P4-02 (piloto de la pizarra: 1 mes gratis con escuelas reales), P4-03 (copy "Tus entrenadores van gratis"), P4-04 (manual del coach) | `docs/pilotos/coach-pizarra-piloto-2026-11.md`, `docs/manuales/_src/coach/`, `docs/marketing/coach/` | `wt-coach-o4` | — |
| **O4-EVENTOS-BFF** | Organizador · Torneos · Federaciones | ORG-P2-10 (QA concurrente), TOR-P2-05 (BFF), tareas de BFF que lleguen de FED-P1-06 si tocan eventos | `bff/src/routes/events.route.ts` | `wt-eventos-o4-bff` | — |
| **O4-LAND** | Landing | LSC-P3-02 (pauta en Meta y Google solo con lo vivo; presupuesto D-LSC-6), 03, 04, 06 (QA del día H4 en producción), RM | `docs/marketing/canchas/07-pauta.md`, `06-ventas-whatsapp.md`, `08-prospeccion.md` | `wt-landing-o4` | La pauta no apunta a nada que no corra. |
| **O4-APP-NAV**, **O4-DOCS**, **O4-MIG**, **O4-PLAN-L5** | Varios | Integración, lote L4 y planes de L5 | los de §0.1 | `wt-*-o4` | — |

**Lote L4 (mar 24-nov).** Núcleo (A): Canchas P4 (4: CAN-P4-01, 02, 03, 04) · Torneos P2 (3) · Marcas v0 (MA-P1-01, 02 + MA-P2-01, 03: 4) · PT-PL-P2-03 (1) = **12**. **Diferibles (B/C, se mueven a L5 si el IO no da):** Federaciones P1 (6) · Deportista P1 (4) · Tienda P2 (3) · tiqueteras (CAN-P4-04). Total si todo entra: ≈ 25; **decisión del dueño en R3** sobre qué diferible se sube.

---

## 8. Ola 5 — lun 7 a vie 18 dic

**Objetivo:** torneo serio (carné, programación automática), bienestar F5, SportPoints F1 solo si hay go, ligas P2, y **cerrar el año sin dejar pilotos huérfanos**. No se hacen despliegues grandes entre el 21-dic y el 6-ene.

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O5-TORNEOS-P3** | Torneos | TOR-P3-01…09 (carné del torneo con QR y edad; página pública completa; familias ven "Próximos partidos"; programador automático `schedule_round`; bloque del fin de semana; torneo en cancha de un tercero), TOR-P4-01…06 (seguimiento y conversión del piloto, manual con capturas reales, contenido y captura de leads) | `docs/migraciones-para-aplicar-2026-12-09/10…13_torneos_*.sql`, `pages/MyAthleteCardsPage.tsx`, `pages/events/TournamentResultsPage.tsx`, `docs/manuales/_src/torneos/` | `wt-torneos-o5` | **Foto del menor en el carné público según D8 (Ley 1581)**; escaneo de carné en celular. |
| **O5-BW-P3** | Bienestar | BW-P3-1…8 (SQL: flag `services_marketplace_enabled`, reseñas atadas a una cita completada, nutrición del profesional, psicología deportiva, consulta virtual simple, verificación ReTHUS completa), P2-8 (subir a ~$119.000 con "Pagos integrados" real) | `docs/migraciones-para-aplicar-2026-12-09/20…25_bienestar_*.sql`, `components/marketplace/ServiceBookingModal.tsx`, `pages/NutritionPage.tsx`, `pages/clinical/*` | `wt-bienestar-o5` | El precio sube **solo para altas posteriores a F4** y sin tocar a los suscritos sin aviso (PT-PL-P2-07). |
| **O5-FED-P2** | Federaciones | FED-P2-00…08 (datos de menores, `league_player_registrations`, carga en lote con dry-run, carné de la liga con tabla puente, bandeja de revisión); FED-P2-05 (cuota por comprobante) **bloqueada** hasta el organizador | `docs/migraciones-para-aplicar-2026-12-09/30…32_federaciones_*.sql` | `wt-federaciones-o5` | Un documento duplicado entre clubes se detecta; el carné se verifica desde el celular. |
| **O5-MARCAS-P3** | Marcas · Familias | MA-P3-01 (go/no-go con 4 semanas de F0, ≥ 10-dic), P3-02…06 (SportPoints F1: saldo y nivel; F2: canje de premios de marcas; retos patrocinados), MA-P2-05 (lanzar piloto gratis de 30 días), P2-06 (salida del piloto) | `docs/migraciones-para-aplicar-2026-12-09/40…42_sportpoints_*.sql`, `bff/src/routes/admin-sportpoints.routes.ts` | `wt-marcas-o5` | **Sin presupuesto propio:** los premios los pone la marca aliada. Si el go/no-go es no-go, las 3 migraciones se difieren. |
| **O5-DEP-P2** | Deportista | DEP-P2-01…11 (categoría Canchas en Explorar, Mis reservas unificado, `player_sport_levels`, `open_matches` y `open_match_players` transaccionales, auto-cancelación, UI, pago dividido tras CAN-P3-03) | `docs/migraciones-para-aplicar-2026-12-09/50…51_deportista_*.sql`, `pages/OpenMatchesPage.tsx`, `bff/src/routes/open-matches.routes.ts`, `bff/src/jobs/open-matches-autocancel.job.ts` | `wt-deportista-o5` | Menores **no** entran a partidos abiertos (propuesta); sin escritura directa a las tablas nuevas. |
| **O5-PLAT-ESC** | Plataforma · Escuela · Canchas | PT-PL-P3-01 (tablero de pilotos), ESC-P3-04 (asientos contables de la tienda y factura electrónica; espera a contabilidad v2 F1 según D-EJ-11), CAN-P5-01 (saldo a favor), P5-02 (check-in QR con auto-liberación) | `AdminSubscriptionsPage.tsx` (rama de `O5-APP-PLANES`), `bff/src/services/invoicing.service.ts`, `bff/src/jobs/canchas-auto-liberar.job.ts` | `wt-plataforma-o5` | Todos los pilotos activos con día de vencimiento visible; ninguno vence sin aviso a 7, 3 y 1 días. |
| **O5-CIERRE-PILOTOS** | Todos | Cierre y conversión (humano + datos): CAN-P4-10, TOR-P4-02, ESC-P1-06, COACH-P4-02, BW-P1-12, ORG-P1-12, MA-P2-06, DEP-P1-12, TPM-P1-14 y P2-09. **Cada piloto se cierra con la cifra que lo decide** (los backlogs definen el umbral). | `docs/pilotos/*` | `wt-pilotos-o5` | Nadie se queda cobrando sin haberlo aceptado; los que no aceptan quedan en Gratis o en solo lectura. |
| **O5-APP-PLANES**, **O5-APP-NAV**, **O5-DOCS**, **O5-MIG**, **O5-PLAN-L6** | Varios | Integración y lote L5; planes de L6 | los de §0.1 | `wt-*-o5` | — |

**Lote L5 (mié 9-dic).** Núcleo (≈ 17): Torneos P3 (TOR-P3-01, 06, 07: 3) · Bienestar P3 (5) · Federaciones P2 (3) · Marcas P3 (3, condicionado al go/no-go) · Deportista P2 (2) · CAN-P5-01 (1) · diferibles de L4 (los que el dueño haya subido en R3). **Diferibles:** Marcas P3 completo, Bienestar P3 (nutrición y psicología).

---

## 9. Ola 6 — lun 11 ene a vie 12 feb 2027

**Objetivo:** ligas con torneo de temporada, Atleta ID portable, boletería con tarifa fija, marketplace global con gate y revisión trimestral de promesas.

| ID | Frente | Objetivo y tareas | Archivos exclusivos | Rama | Aceptación y prueba real |
|---|---|---|---|---|---|
| **O6-FED-P3** | Federaciones | FED-P3-00…09 (`tournament_generate_fixture` consume R-11, `events.league_season_id`, roster restringido a registros `approved`, sanciones, partidos de la liga en canchas con permiso explícito del club, página pública), FED-P4-00…06 (piloto gratis de 1 mes, onboarding asistido, tablero, decisión comercial, landing) | `docs/migraciones-para-aplicar-2027-01-19/10…15_federaciones_*.sql`, `bff/src/routes/league.routes.ts`, `pages/league/*` | `wt-federaciones-o6` | Temporada con 4 clubes, 2 categorías y 3 fechas jugadas (FED-P3-09). Precio por venta asistida, sin precio público. |
| **O6-DEP-P3** | Deportista | DEP-P3-01…10 (UNIQUE parcial por documento, `athlete_passport`, compartir por token revocable, importar a una escuela nueva con consentimiento, nivel por resultado, reto patrocinado, auditoría de privacidad de menores) | `docs/migraciones-para-aplicar-2027-01-19/20…24_deportista_*.sql`, `pages/MyAthleteIdPage.tsx`, `AthletePassportPublicPage.tsx` | `wt-deportista-o6` | **Identidad federada y fichas duplicadas** se resuelven antes (decisión de FED y DEP). |
| **O6-ORG-P4** | Organizador | ORG-P4-01…04 (boletería con tarifa fija: `event_ticket_types`, `event_tickets` con QR de un solo uso; check-in; **nunca porcentaje**), ORG-P3-02/07 si quedó pendiente | `docs/specs/boleteria-tarifa-fija.md`, `docs/migraciones-para-aplicar-2027-01-19/30_boleteria.sql`, `pages/organizer/EventCheckInPage.tsx` | `wt-organizador-o6` | Evento con 50 boletas, venta en sandbox y check-in con 2 celulares a la vez. |
| **O6-TIENDA-P4** | Tiendas | TPM-P4-01…05 (tienda v2: kardex, media; **gate MOD-11 / F-D: `resolveProvider` en toda ruta del checkout**; marketplace global v1 solo con 5 o más tiendas vendiendo) | `docs/migraciones-para-aplicar-2027-01-19/40…42_tienda_v2_*.sql`, `marketplace-checkout.routes.ts`, `pages/MarketplacePage.tsx` | `wt-tienda-o6` | QA E2E en Wompi sandbox: carrito de 2 vendedores con devolución. |
| **O6-PLAT** | Plataforma | PT-PL-P3-02…04 (plan anual, referidos con 1 mes gratis sobre el piloto, motor de combos 16/26/30/33/36/40 % con redondeo a 9.000 — ítem de BLQ-10) | `docs/migraciones-para-aplicar-2027-01-19/50…52_planes_*.sql`, `saas-plans.ts` | `wt-plataforma-o6` | El motor de combos ve el tarifario oficial; ningún precio contradice la landing. |
| **O6-TRAINER-P4** | Trainer · Coach | PT-TR-P4-01…04 (entrenadores en Explorar con reserva de primera sesión, biblioteca de ejercicios con video propio, agente de agenda por WhatsApp — no anunciar hasta que exista), COACH-P3 restantes | `components/trainer/ExerciseSearchInput.tsx`, `bff/src/routes/trainer/*`, `docs/specs/profesionales-independientes-agentes-ia.md` | `wt-trainer-o6` | — |
| **O6-CAN-P5** | Canchas | CAN-P5-03 (acceso o luces por la reserva, ZKTeco BLQ-2), P5-04 (número de plataforma que busca cancha entre clubes) | `bff/src/routes/bridge.routes.ts`, `bff/src/routes/whatsapp-plataforma.routes.ts` | `wt-canchas-o6` | — |
| **O6-LAND-P4** | Landing | LSC-P4-01…06 (reactivar roles cuando cada frente entregue: bienestar ~$119.000, plan por evento, tienda y marcas, Familias y Explorar, referidos si D-LSC-2 lo aprueba, **revisión trimestral de promesas**) | `role-offers.ts`, páginas por rol, `scripts/verificar-promesas.mjs` | `wt-landing-o6` | Cada página pasa de "piloto" a "disponible" **solo** con la prueba real de su frente. |
| **O6-DOCS**, **O6-MIG**, **O6-APP-NAV** | Varios | Integración y lote L6 (≈ 18 si entra todo) | los de §0.1 | `wt-*-o6` | — |

---

## 10. Puntos de revisión del dueño entre olas

| Punto | Cuándo | Qué se revisa y se decide | Sin esto no avanza |
|---|---|---|---|
| **R0a** | vie 16-oct | Aprobar: (1) esta tabla de reconciliaciones (§1); (2) ADR y plan de migraciones M8–M16 de Canchas (incluido el gancho de patrocinio de MA-P0-09); (3) planes de migraciones de organizador y torneos; (4) el plan de lote único de plataforma; (5) D-EJ-01 (Explorar), D-EJ-02 (Coach Pro), D-EJ-04 (mora y GYM RM en el pase A). | Todo SQL de L0. |
| **R0b** | mié 21-oct | Resultado de L0 (invariantes, smoke), landing desplegada con el guardián de promesas, GYM RM encendida, club piloto de Canchas firmado, planes de L1 (FAM-10, BW-P1-0, PT-PL-P1) aprobados. | L1 y deploys de BFF de organizador y torneos. |
| **R1** | mié 28-oct | M16 aplicada; motor de Canchas con concurrencia verde; H2 realista; piloto formal (mecanismo) funcionando; plan de L2 (Canchas P2, BW-P1, FAM, COACH, TRN) aprobado; decisión de Connected Accounts por rol (D-EJ-12). | L2. |
| **R2** | vie 6-nov | H2/H3 con club real cobrando; Disk IO medido; planes de L3 (TOR-P1, ORG-P2, BW-P2, BLQ-10 F1, atribución, SportPoints F0) aprobados; liga piloto elegida (FED). | L3. |
| **R3** | vie 20-nov | H4 en producción; pauta y presupuesto (D-LSC-6); **qué diferibles suben a L4** (Federaciones, Deportista, Tienda P2); organizadores del piloto ya en uso. | L4. |
| **R4** | vie 4-dic | H5 y H6; piloto de torneos y tienda con números; go/no-go preliminar de SportPoints (4 semanas de F0 cumplidas el 10-dic). | L5. |
| **R5** | vie 18-dic | Cierre de pilotos con su cifra; conversión y precios; congelamiento de fin de año. | L6 y cualquier cobro posterior a un piloto. |
| **R6** | vie 12-feb | Balance del ecosistema; qué frentes pasan a "disponible" en la landing; decisión sobre marketplace global. | Siguiente plan. |

---

## 11. Riesgos globales

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| G-01 | **Disk IO** (una sola base para dev, stg y prod; caída de ~14 h el 14-oct). Pro sube el techo, no lo quita. Lo que más quema es leer el catálogo (814 funciones) y recargar el esquema de PostgREST con cada DDL | Se cae todo, login incluido (se ve como CORS, es un 504) | Un solo carril de migraciones por ola; **tope ~15 por lote** con pases y medición entre pases; `types.ts` una vez; sin `list_tables`, `get_advisors` ni listados de funciones; jobs nuevos sin N+1 (3 BFF comparten la base: cada consulta por minuto se triplica); pruebas de concurrencia y carga solo en el gemelo; CAN-P2-22 y CAN-P4-09 miden IO; los jobs nuevos (pilotos, recordatorios, waitlist, resumen semanal) llevan `DISABLE_*` en dev y stg. |
| G-02 | **Varias sesiones editando `develop`** (hay trabajo sin commitear de otras sesiones; el ledger es compartido) | Pérdida de trabajo, `migrations:check` roto, imports sin trackear que rompen Render (ya pasó 11 h el 06-oct) | `O0-HIGIENE`; un paquete por rama con archivos exclusivos; commit con índice temporal; `git status` completo antes de cada commit; el ledger solo lo toca `O*-MIG`; tras cada push, verificar el deploy **en la ruta viva o el chunk**, no en `/health`. |
| G-03 | **Landing compartida** (otro repo, otra sesión, varios frentes piden cambios) | Promesas contradictorias o pisadas | Un solo frente (`03-landing`) la edita; guardián de promesas en CI desde la Ola 0; el resto pide cambios en su paquete; `role-offers.ts` como fuente única de precios. |
| G-04 | **Cupo de despliegues de Vercel** (4 despliegues por push; la landing es otro proyecto) | Cupo agotado el día de un hito | Máximo 2 pushes de integración por ola; el deploy de la landing de la Ola 0 es **único**; ningún deploy automático por commit de docs. |
| G-05 | **Camino crítico de Canchas** (H2/H3 dependen de L1 + M16 + deploy y de un club real) | Hitos públicos que se mueven | Se propone en R1 la versión realista (H2 30-oct reducido, H3 6-nov); plan B documentado (OTP por correo, transferencia sin Wompi). |
| G-06 | **Orden del deploy vs. migración M16** (revocar la escritura directa) | La UI vieja de reservas deja de escribir | Deploy de `O1-CAN-FRONT` **antes** de M16; censo de escritores en el PR. |
| G-07 | **`events.route.ts` y otros archivos monolíticos** tocados por 3 frentes | Conflictos de merge y regresiones silenciosas | Un solo agente de BFF de eventos por ola; considerar dividir el archivo en sub-routers **sin cambio de comportamiento** como primera tarea de `O1-EVENTOS-BFF` si el diff de la Ola 0 se vuelve inmanejable (decisión del dueño). |
| G-08 | **Trampas de seguridad ya vistas:** policies permisivas que suman con `OR`, `FOR ALL` sin `WITH CHECK`, `REVOKE ALL FROM PUBLIC` que no alcanza, RLS que filtra filas y no columnas, helpers de RLS sin envolver | Fugas a anon o entre escuelas | Cada migración con `pg_policies` listadas **por tabla completa** antes de cerrar; `set local role anon` como prueba definitiva; vistas con las columnas publicables; `seguridad:invariantes` tras cada lote. |
| G-09 | **Menores y datos personales** (Ley 1581): carné público, partidos abiertos, reportes de marcas, Atleta ID, historia clínica | Riesgo legal y de confianza | Decisiones D-EJ-14 antes de P3 de torneos y de Deportista; sin datos individuales de menores en reportes de marcas; retención y derechos ARCO de la historia clínica (Res. 1995) definidos antes de bienestar F5. |
| G-10 | **Promesas comerciales y cumplimiento** (cifras inventadas, testimonios, clubes nombrados sin permiso) | Pérdida de credibilidad | Ola 0 limpia todo; LSC-P1-01 permisos escritos; el guardián falla el CI; ningún contenido sale antes de su página limpia. |
| G-11 | **Pasarelas por ambiente** (credenciales de dev de MP son de producción; Dynasty cobra en sandbox hasta el cambio de llaves) | Cobros reales en pruebas | Pruebas de pago en sandbox o con credenciales **propias del club**; verificar webhook y un pago real antes de abrir cualquier cobro. |
| G-12 | **Cuello de migraciones** (~100 migraciones nuevas entre L0 y L6, una sola sesión por ola) | Retrasos en cascada | Prioridad A/B/C (§2); diferibles explícitos por lote; el dueño decide en cada R qué sube. |
| G-13 | **Frentes que dependen de piezas fuera de este plan** (pizarra multideporte de otra sesión, Connected Accounts ~85 %, contabilidad v2, comunicaciones V2, control de acceso) | Bloqueos externos | Se listan como dependencia en cada paquete; no se asume entrega; si no llegan, la tarea pasa a "bloqueada" en el tablero y se avisa en la siguiente R. |
| G-14 | **Pilotos huérfanos** (1 mes gratis sin dueño de cierre) | Cobros no acordados o pilotos que se eternizan | Mecanismo único (R-01); job de avisos a 7/3/1 días; al vencer: pausar o solo lectura, nunca borrar ni cancelar; `O5-CIERRE-PILOTOS`. |

---

## 12. Decisiones abiertas consolidadas

**Cómo leer la tabla:** "Ola límite" es la fecha después de la cual la decisión bloquea trabajo. "Rec." es la recomendación que traen los backlogs o este plan; **no está decidida** hasta que el dueño la confirme.

### 12.1 Decisiones transversales de este plan (nuevas)

| ID | Decisión | Frentes | Rec. | Ola límite |
|---|---|---|---|---|
| D-EJ-01 | Qué se ve de Explorar en producción y para quién (D-PT-8 = FAM D1/D2 = DEP): ¿flag propio por rol (acudiente y atleta) y sin la categoría Escuelas para el acudiente? | 02, 11, 12 | Flag propio por rol; no abrir el global; Escuelas oculta para el acudiente | Ola 0 (R0a) |
| D-EJ-02 | Cobro de Coach Pro (D-PT-1 = PT-TR D-01): `plan_code coach_pro` (A), `custom_price_cents` sin migración (B) o BLQ-10 (C) | 02, 06 | B como puente en la Ola 0; A o C se deciden en R1 junto con BLQ-10 | Ola 0 |
| D-EJ-03 | Aprobar las 20 reconciliaciones de §1 (dueño único por pieza) | todos | Aprobar | Ola 0 |
| D-EJ-04 | ¿Entran al pase A del lote L0 las migraciones de mora pendientes y `06_gymrm_habilitar_ingreso.sql`, dado el cron del 17-oct y el bloqueo total de GYM RM? (la mora **no cancela**) | 04 | Sí, tras revisión de ESC-P0-03 | Ola 0 |
| D-EJ-05 | Hitos H2/H3 de Canchas con la capacidad real (30-oct reducido, 6-nov; o 6-nov y 13-nov) | 01 | Versión reducida de H2 | R1 |
| D-EJ-06 | Tope de migraciones por lote y qué diferibles suben (Federaciones, Deportista, Tienda P2) | todos | Tope ~15; sube primero Federaciones P1 solo si hay liga firmada | R3 |
| D-EJ-07 | Orden de la tienda: GYM RM ya (21-oct), Monster al cerrar ESC-P0-06 | 04, 13 | Sí | Ola 0 |
| D-EJ-08 | ¿Se divide `events.route.ts` en sub-routers sin cambio de comportamiento? | 08, 09, 10 | Sí, si el diff de la Ola 0 lo pide | Ola 1 |

### 12.2 Decisiones de los frentes (deduplicadas)

| ID | Decisión | Frente(s) | Rec. | Ola límite |
|---|---|---|---|---|
| D-01 | **Canchas ADR CAN-P0-02:** gating del venue, tabla de pagos que manda (`payments` o `reservation_payments`), rol `owner` en `school_members` para el dueño | 01 | `payments` con `payment_category 'reserva'`; degradar a Gratis, nunca bloquear | R0a |
| D-02 | D3: canchas combinadas en P3 o adelantadas a F1 | 01 | P3 | Ola 1 |
| D-03 | D4/D5/D6: franjas de 30 min, hold de 10 min en línea, 15 min para comprobante y hasta 24 h en revisión | 01 | Los de los backlogs | Ola 1 |
| D-04 | D7: invitado sin cuenta solo con pago en línea o abono | 01 | Sí | Ola 1 |
| D-05 | D10/D11: política de cancelación 100/50/0 y devolución como saldo a favor registrado | 01 | Sí | Ola 2 |
| D-06 | D13/D14: plazo del pago dividido y sanción por no-show, configurables y apagables por el club | 01 | Sí | Ola 3 |
| D-07 | D16: plantilla OTP de la cuenta de plataforma o de cada club | 01 | Plataforma, con respaldo por correo | Ola 0 |
| D-08 | D17: lista de espera por turnos de 15 min por WhatsApp o aviso a todos por push | 01 | Turnos de 15 min | Ola 3 |
| D-09 | El plan Gratis incluye `/reservar/:slug` con transferencia y aprobación manual sin OCR | 01 | Sí | Ola 1 |
| D-10 | ¿El banco de horas debe tener cancha y franja algún día? (hoy queda fuera) | 01 | Fuera por ahora (MOD-35) | Ola 4 |
| D-11 | Coach Free: ¿existe? Límites de Coach Free y Coach Pro y descuento del plan anual (D-PT-4, PT-TR D-02) | 02, 06 | No hay Free Coach | R1 |
| D-12 | D-PT-2 combos: descuento del tarifario oficial o precio plano | 02 | Del tarifario | Ola 3 |
| D-13 | D-PT-3 bienestar: `vendor_profiles` o entidad propia | 02, 07 | Entidad propia con vínculo | Ola 2 |
| D-14 | D-PT-5 `store_owner` global: plan ahora o solo tienda escolar como adicional | 02, 13 | Solo tienda escolar | Ola 3 |
| D-15 | D-PT-6 organizador: plan por evento o mensual | 02, 08 | Validar con los 3 organizadores antes de publicar cifras | Ola 3 |
| D-16 | D-PT-7 factura electrónica DIAN (Factus) desde el día 1 y quién emite | 02, 07, 13 | Opcional y por el profesional | Ola 3 |
| D-17 | D-PT-9 texto exacto y aprobador del aviso "sin cobro dentro de la app todavía" | 02 | Lo aprueba el dueño | Ola 0 |
| D-18 | PT-TR D-03: piloto de entrenadores por `admin_extend_trial`, no `blocking_exempt` | 06 | Sí | Ola 0 |
| D-19 | PT-TR D-04: cómo paga Coach Pro al terminar el piloto (transferencia y comprobante por ahora) | 06 | Sí | Ola 2 |
| D-20 | PT-TR D-05: biomecánica incluida en Coach Pro o addon aparte | 06 | Por addon (ya es por addon) | Ola 3 |
| D-21 | PT-TR D-06: número de WhatsApp de los recordatorios y quién paga | 06, 07 | Número de SportMaps | Ola 2 |
| D-22 | PT-TR D-07: `account_type` real del entrenador nuevo | 06 | Verificar en la Ola 0 | Ola 0 |
| D-23 | PT-TR D-08: estado al vencer el piloto sin pagar (solo lectura con 402) | 06 | Sí | Ola 1 |
| D-24 | COACH D1: modelo de cobro de la IA de la pizarra (por escuela o por coach) | 05 | Por escuela con cupo por coach | Ola 1 |
| D-25 | COACH D2: default de `coach_hide_financial_info` | 05 | Oculto por defecto | Ola 2 |
| D-26 | COACH D3/D4: mensajes 1:1 coach-familia; `coach_can_send_notices` por defecto | 05, 11 | 1:1 fuera; avisos con permiso | Ola 3 |
| D-27 | COACH D5: deportes nuevos de la pizarra, completa o solo cancha | 05 | Solo cancha al inicio | Ola 1 |
| D-28 | COACH D6: escuelas del piloto y quién valida Partidos | 05 | Besser y Dynasty | Ola 3 |
| D-29 | COACH D7: coach sin escuela a entrenador independiente por RPC | 05 | Sí (R-18) | Ola 2 |
| D-30 | COACH D8: retirar o cablear `routePermissions.ts` | 05 | Retirar (SEG-4) | Ola 1 |
| D-31 | COACH D9: lectura táctica entre equipos | 05 | Solo lectura por escuela | Ola 0 |
| D-32 | COACH D10: ledger de la pizarra, union-merge o renumerar | 05 | Renumerar (el head es `20261014153542`) | Ola 0 |
| D-33 | Bienestar: actualizar BLQ-10 (xlsx y D-FAC-1) de $149k a $59k y cómo entra Wellness Pro en el descuento por combo | 07, 02 | $59k | Ola 0 |
| D-34 | Bienestar: tarjeta Servicios de la landing y límite Free único (5 pacientes activos o 10 clientes) | 07, 03 | Retirar o fusionar; un solo límite | Ola 0 |
| D-35 | Bienestar: nombre único del plan (Wellness Pro o Bienestar Individual) | 07 | Wellness Pro | Ola 0 |
| D-36 | Bienestar: qué 3-5 profesionales entran al piloto y cuál es el fisio de la escuela cliente (Besser, Dynasty o Monster) | 07 | Los nombra el dueño | Ola 1 |
| D-37 | Bienestar: fisio contratado por la escuela, incluido en Pro/Elite o paga $59k | 07 | Paga sus $59k | Ola 1 |
| D-38 | Bienestar: atletas sin cuenta, consentimiento por enlace al acudiente o por invitación que crea la cuenta | 07 | Enlace al teléfono del acudiente | Ola 1 |
| D-39 | Bienestar F4: efectivo y transferencia desde el día 1 o solo pasarela | 07 | Solo pasarela al inicio | Ola 3 |
| D-40 | Bienestar: nutrición, plan nutricional del profesional primero o registro de comida del atleta | 07 | Plan del profesional | Ola 5 |
| D-41 | Bienestar: retención de la historia clínica (Res. 1995) y derechos ARCO al darse de baja | 07 | Definir con asesoría legal | Ola 4 |
| D-42 | Bienestar: recordatorio por WhatsApp desde el número de SportMaps o esperar el canal propio | 07 | Número de SportMaps | Ola 2 |
| D-43 | Organizador E8: qué 3 organizadores entran al piloto | 08 | Los nombra el dueño | Ola 1 |
| D-44 | Organizador D1: si publicar exige verificación por admin también durante el piloto | 08 | Sí | Ola 0 |
| D-45 | Organizador D2: precio después del piloto (gratis hasta 8 equipos o 100 inscritos, tramo fijo, anual) | 08 | Validar con los 3 | Ola 4 |
| D-46 | Organizador D3: cuenta de cobro propia (owner organizer) o escuela anfitriona mínima | 08 | Escuela anfitriona mínima, en línea con Connected Accounts | Ola 2 |
| D-47 | Organizador D4: paquetes con hotel y kits Platino/Gold | 08 | Descartar | Ola 2 |
| D-48 | Organizador D5: si `payment-receipts` es público, migrar todos los flujos o solo eventos | 08 | Solo eventos | Ola 2 |
| D-49 | D6 / TOR D2: gating de partidos en canchas propias (addon Torneos o plan de Canchas) | 08, 09 | Plan de Canchas | Ola 2 |
| D-50 | Torneos D1: quién programa y carga resultados | 09 | La escuela anfitriona | Ola 2 |
| D-51 | Torneos D3: solo lectura al vencer el piloto | 09, 02 | Sí | Ola 0 |
| D-52 | Torneos D4: resultados públicos de torneos `school_only` | 09 | No públicos | Ola 0 |
| D-53 | Torneos D5: precio del addon Torneos ($49.000 vs $79.000) | 09, 02 | $49.000 | Ola 0 |
| D-54 | Torneos D6/D7: sanciones por defecto y orden de desempate | 09 | Los de la planilla estándar | Ola 3 |
| D-55 | Torneos D8: foto del menor en el carné público (Ley 1581) | 09, 12 | Sin foto pública | Ola 4 |
| D-56 | Torneos D9: `scheduled_at` como espejo de `starts_at` | 09 | Sí | Ola 2 |
| D-57 | Federaciones: ¿qué liga real hace el piloto (deporte, región, número de clubes) y quién la acompaña? | 10 | La nombra el dueño | Ola 2 |
| D-58 | Federaciones: vía técnica de la liga (a) pasar la ficha a club/hybrid con `admin_set_school_type` + addon o (b) conservar `federation` | 10 | (a) | Ola 3 |
| D-59 | Federaciones: ficha OSM existente o fila nueva; cómo se verifica al admin; carné de la liga vs. de escuela; responsable del dato de menores; identidad del jugador entre clubes | 10, 12 | Según FED-P2-00 | Ola 4 |
| D-60 | Federaciones: cuota de afiliación por comprobante o por fuera; reglamento de sanciones; partidos en canchas de clubes afiliados con permiso; precio después del piloto; umbrales de éxito | 10 | Por fuera en el piloto; permiso explícito; venta asistida | Ola 5 |
| D-61 | Familias D3: número de WhatsApp para "Escribir al club" | 11 | Número de la escuela | Ola 1 |
| D-62 | Familias D4: "Nuevo pago" se elimina o queda secundaria | 11 | Secundaria | Ola 1 |
| D-63 | Familias D5: portal de informes, opt-in general o solo Club Carmel | 11 | Solo Club Carmel al inicio | Ola 2 |
| D-64 | Familias D6: hora del resumen semanal | 11 | Domingo 6 p. m. | Ola 2 |
| D-65 | Familias D7/D8/D9/D10: atleta adulto reserva en P3; escuelas del piloto de canchas; qué pasa con las reservas al vencer el addon; cifra que decide el cobro y quién firma | 11, 01 | Sí; las del club piloto; reservas hechas se respetan; el dueño firma | Ola 3 |
| D-66 | Deportista: dueño de la racha y mínimo por semana; reto del club en todos los tiers o solo Pro; escala de nivel 0-7 o 1-5; menores en partidos abiertos; campos del Atleta ID | 12 | Este frente; todos los tiers; 0-7; menores no; mínimos | Ola 4 |
| D-67 | Deportista: marca aliada del primer reto y elegibilidad de menores; club piloto de partidos abiertos; fuente de asistencia del adulto sin ficha | 12, 14, 01 | El mismo club de Canchas; verificar `attendance_records.user_id` | Ola 4 |
| D-68 | Tiendas: compra sin cuenta nace encendida o apagada | 04, 13 | **Apagada** | Ola 0 |
| D-69 | Tiendas: Monster cobra mensualidades en octubre o el 1-nov | 04 | Según ESC-P0-06 | Ola 1 |
| D-70 | Tiendas: trial del plan de la escuela, alinear app y landing al mes de la base (14/14/14/7 días hoy) | 04, 03 | 1 mes en todo | Ola 0 |
| D-71 | Tiendas: contabilidad de la tienda, esperar contabilidad v2 F1 o basta con Ingresos | 04 | Basta con Ingresos primero | Ola 5 |
| D-72 | Tiendas: fin del piloto sin confirmación, pausar o solo lectura | 04, 13, 02 | Solo lectura | Ola 1 |
| D-73 | Tiendas: `/marketplace` y `/shop`, redirigir o "Próximamente" (tras TPM-P0-03) | 13 | Según el resultado de la prueba | Ola 1 |
| D-74 | Tiendas: retirar `store_owner` (migración de usuarios reales y páginas legadas) | 13 | Sí (R-09) | Ola 4 |
| D-75 | Tiendas: precio de la cuota del Proveedor recomendado; quién aprueba comprobantes en GYM RM y SLA; umbral de éxito | 13 | El dueño | Ola 3 |
| D-76 | Tiendas: cuándo se habilita el marketplace global | 13 | 5 o más tiendas vendiendo y gate F-D cerrado | Ola 6 |
| D-77 | Canchas en la escuela: Canchas 3 meses Pro a 50 clubes contra 1 mes para todo piloto | 04, 01, 03 | **1 mes para todo piloto** (ya decidido) | Ola 0 |
| D-78 | Hybrid: escuela con 2 canchas o menos en Gratis siempre o con piloto y precio | 04 | Gratis hasta 2 | Ola 3 |
| D-79 | `Escuelas.tsx`: retirar testimonios ya o reemplazarlos con autorización escrita | 04, 03 | Retirar ya | Ola 0 |
| D-80 | Landing D-LSC-2: Partners, despublicar y posible referido | 03 | Despublicar | Ola 0 |
| D-81 | Landing D-LSC-3/4: Servicio Pro y Agencia sin SKU; permisos escritos de clubes nombrados | 03 | Quitar; pedir permiso hoy | Ola 0 |
| D-82 | Landing D-LSC-5/6/7: destino y buzón de leads; presupuesto de pauta; entidades OSM/IDRD del mapa | 03 | El dueño | Ola 1 |
| D-83 | Landing D-LSC-8/9: una sola fuente de precio frente a BLQ-10 y el tarifario; tres organizadores E8 | 03, 02 | `role-offers.ts` | Ola 1 |
| D-84 | Marcas D-1: opt-in por escuela apagado por defecto | 14 | Sí | Ola 3 |
| D-85 | Marcas D-2/D-6/D-8: patrocinio reembolsado al club sin que pase dinero por SportMaps; documento contable e IVA; precio después del piloto | 14 | Sí; con asesoría contable | Ola 4 |
| D-86 | Marcas D-3/D-4/D-7: qué 3-5 marcas locales y quién las aprueba; qué club de Canchas participa; beneficios solo a acudientes o también adultos y coaches | 14 | Las nombra el dueño | Ola 3 |
| D-87 | Marcas D-5/D-9/D-10: umbral k=10, puntos y vencimiento; premios propios de las escuelas; piloto de marca en `partner_brands` o en el mecanismo formal | 14 | k=10; mecanismo formal (R-01) | Ola 4 |
| D-88 | Marcas (13): reporte por token o rol de marca; quién paga la primera reserva con descuento | 13, 14 | Token; la marca reembolsa al club | Ola 4 |

---

## 13. Cómo se mide el avance

Cada paquete se cierra con: PR hacia `develop` con el criterio de aceptación pegado y marcado, la **prueba real** (captura, log o informe en `docs/qa/` o `docs/capturas/`), `migrations:check` verde si hubo SQL y la línea del ROADMAP actualizada por `O*-DOCS`. Cada ola se cierra con un resumen de una página para el dueño: qué se entregó, qué se movió, qué se bloqueó y qué decisiones necesita en el siguiente punto de revisión.

**Pendiente de verificar antes de confiar (no se consultó la base ni el código vivo en este plan):** estado real de las migraciones del 13-oct y de la pizarra, existencia de `viewed_at` y `mark_report_viewed`, definición viva del trigger de solapamiento de reservas, `attendance_records.user_id`, `events.status` (ENUM o texto), `account_type` del entrenador, líneas citadas del ROADMAP y diffs de `wt-mora-*`. Cada una tiene su tarea de verificación en la Ola 0.
