# Simplificación de UX — Dashboard y navegación (Padre, Atleta, Escuela, Coach)

Estado: **spec para revisión — nada implementado aún**.
Fecha auditoría: 2026-08-31. Alcance: roles `parent`, `athlete`, `school`/`school_admin`/`owner`, `coach`. El resto de roles (`wellness_professional`, `store_owner`, `organizer`, `admin`) queda para una segunda ronda.

**La prioridad y el orden de ejecución los define `ROADMAP.md`, no este documento** (regla del roadmap: "ninguno de estos documentos define prioridades"). Este spec es el detalle página-por-página detrás de `SEG-24`, `UX-3`, `UX-4`, `UX-6`, `UX-7` y `UX-8`. Confirmado 2026-08-31: se sigue la cola existente del roadmap (dinero → seguridad → UX) — este trabajo entra en la cola en `§4, #12.6` y `#17.5`, no por delante de los P0 de seguridad/dinero abiertos.

## Objetivo

El feedback de origen: la app "debería ser mucho más fácil", el dashboard debería volverse principalmente **Acciones Rápidas** (sin notificaciones apiladas, panel más ajustado), y hay roles/módulos que no se usan y no deberían estar. Esta spec consolida 4 auditorías de código cruzadas contra datos reales de Supabase (no solo lectura de código) en un plan accionable.

## Metodología

Cada página fue leída completa (no solo el inicio) y clasificada en: bien organizada (ya usa Tabs/Accordion), densa/apilada (candidata a refactor), o posiblemente muerta. Para "posiblemente muerta" se verificó contra conteos reales en la base viva (excluyendo tenants `is_demo=true` donde aplica) — nunca se declaró algo muerto solo por lectura de código.

---

## Bugs de un carácter, alto impacto, cero riesgo de diseño

Estos no son decisiones de UX, son errores que hoy rompen flujos activos. En el roadmap: #1-#3 son detalle de `UX-3`/`UX-7`, #4 es `SEG-24` (§4, #12.6).

1. **`frontend/src/lib/feature-flags.ts` — `SHOW_EXPLORE` nunca se activa en producción** (`UX-3`). El código es `export const SHOW_EXPLORE = import.meta.env.DEV;` pero el comentario promete que `VITE_SHOW_EXPLORE` lo controla por ambiente — nunca se lee esa variable. Resultado: el ítem "Explorar" (única forma de descubrir escuelas nuevas, profesionales de bienestar y eventos) **no aparece en ningún ambiente desplegado real**, solo en `npm run dev` local. Esto explica gran parte de la adopción cero de Tienda, Objetivos y Citas de Bienestar más abajo — no es que nadie quiera usarlos, es que hoy es imposible llegar a agendar/comprar en producción.
2. **`frontend/src/config/quickActionsCatalog.ts` — acción "Ver Equipos" del default de escuela apunta a `/programs-management`** (línea ~37, `UX-7`), que es la página muerta de la sección de abajo (`classes` con 0 filas en toda la plataforma). Es la **segunda** acción rápida que ve toda escuela nueva, y no funciona. Corregir el `href` a `/teams`.
3. **`useDashboardConfig.ts:185-189` (padre) — el botón "Ver Equipos" del dashboard de padre navega a `/explorar?category=schools`** (buscador de escuelas nuevas, `UX-7`) en vez de a las inscripciones/equipos donde el hijo ya está. Confuso para el caso normal (padre con hijos ya inscritos). Cambiar a `/enrollments`.
4. **`frontend/src/App.tsx:930-974` — `/admin/analytics` (`AdminAnalyticsPage.tsx`) permite `role='school'` sin `strictRoleCheck` y no filtra por `school_id` en ningún query** (`SEG-24`). Verificado contra RLS real: hoy **no hay fuga** porque `payments`/`enrollments`/`profiles` están scopeados en RLS por `staff_school_ids()`. Pero es punto único de falla (si una policy se afloja, esta página se vuelve una fuga completa de ingresos/matrícula de todas las escuelas) y **ni siquiera está en el menú de escuela** — solo alcanzable adivinando la URL. Acción: agregar `strictRoleCheck` y sacar `'school'` de `allowedRoles` (nadie del lado escuela la necesita).

---

## Mensajes — NO se elimina (decisión 2026-08-31)

`public.messages` = 0 filas en toda la plataforma, y el compose real (`MessagesDetailPage.tsx`) ni siquiera está registrado en una ruta — inalcanzable desde la UI. Por esa evidencia lo había puesto como candidato a eliminar junto con los módulos muertos de abajo. **Decisión del usuario: no se elimina.** El plan de mayo (`athlete-modules-remediation-plan.md`, F3.3) lo trata como prerrequisito de Reservas/Marketplace, y Reservas **sí tiene uso real en escuelas como Dreamers** — hay riesgo real de necesitarlo pronto. Tampoco se invierten las 6-8 semanas de F1-F3 todavía: queda solo en F0 (esconder botones rotos, ya mayormente aplicado), en backlog sin fecha (`UX-6`, ver `ROADMAP.md §5`).

---

## Roles fantasma / legacy — decisión de negocio, no de diseño

| Rol | Estado | Propuesta |
|---|---|---|
| `store_owner` | `is_visible:false` en DB, 1 solo usuario real, reemplazado por `external_vendor` | Migrar ese único usuario y eliminar el rol del enum |
| `organizer` | Dashboard completo pero `event_organizers` en 0 filas, `events.organizer_id` siempre NULL — torneos se unificó en `events` operado por escuelas | Decidir: ¿eliminar el rol y su dashboard, o hay un plan de negocio para reactivarlo? |
| `facility_manager` | No existe en código ni DB, solo en roadmap | Nada que sacar, solo no presentarlo como si ya rigiera algo |
| `admin` (colisión) | `school_members.role='admin'` (5 usuarios reales) cae en el mismo `case` que el admin de plataforma en `AppSidebar.tsx:60-111` → ven el menú de plataforma en vez del de escuela | Separar el `case` por origen del rol (`school_members` vs `profiles.role` de plataforma), no por el string `'admin'` solo |

---

## Módulos muertos — candidatos a eliminar (verificado en BD real, no solo código) — `UX-8`

| Módulo | Rol(es) | Evidencia |
|---|---|---|
| **Anuncios** (`AnnouncementsPage.tsx`) | coach (emisor) | `public.announcements` = 0 filas. Ningún componente de padre/atleta lee la tabla del lado receptor — no vale la pena construir el receptor sin validar antes si algún coach lo usaría. |
| **"Resultados" lado escuela** (`ResultsOverviewPage.tsx:47`) | school | `const results = isDemoMode ? demoResults : [];` — 100% mock, ni siquiera intenta leer `match_results`/`competition_results` (que sí tienen datos reales, consumidos por la página de coach). |
| **`ProgramsManagementPage.tsx`** (`/programs-management`) | school | Tabla `classes` con 0 filas y `class_enrollments` con 0 filas en TODO el proyecto, incluido demo. Modelo de datos abandonado frente a `teams` (136 filas reales). Es el default #2 de Quick Actions de escuela (ver bug #2 arriba). |
| **Catálogo/Tienda del atleta** (`ShopPage.tsx`) | athlete | Los 3 únicos productos de toda la plataforma son literalmente `"... (Demo)"` del vendor `demo.tienda@sportmaps.co`. Ningún vendor real ha listado nunca un producto — pero esto puede ser consecuencia directa del bug de `SHOW_EXPLORE` (bug #1 arriba), revisar después de corregirlo. |
| **Objetivos** (`GoalsPage.tsx`) | athlete | `athlete_goals` = 0 filas. CRUD real y bien construido, cero uso — también puede depender de descubribilidad, no de que la feature esté mal. |
| **Constancias** (`SchoolCertificatesAdminPage.tsx`, `CertificateTemplatesPage.tsx`, `MyCertificatesPage.tsx`) | school, athlete | `school_certificate_templates` = 0, `athlete_certificates` = 0. Nadie ha creado nunca una plantilla ni emitido una constancia, en ningún lado de la cadena. |
| **Membresías** (`MembershipsPage.tsx`) | school | `memberships` = 0 filas. Nicho para escuelas que cobran fuera de SportMaps, nadie lo usa hoy. |
| **CTA "Mi Tienda" → checkout roto en producción** | school, coach | `public.marketplace_transactions` no existe en la base. El BFF ya la referencia activamente (`wompi.ts`, `mercadopago.ts`, `recurring-charges.service.ts`) — cualquier compra real de marketplace fallaría en el webhook de pago. Independiente de si se mantiene el CTA, el checkout de fondo debe arreglarse o el CTA debe quitarse hasta que esté listo. |

**No tocar sin decisión de negocio** (construidas y funcionales, solo con adopción baja/temprana — puede ser timing, no defecto): Resultados del coach (`match_results`, en desarrollo activo hoy), Informe Mensual (`athlete_reports`), Encuestas (`attendance_polls`), Torneos (`events`/`event_delegations`, recién unificado), Carnets digitales (`athlete_id_cards`, rollout en curso), QR de inscripción, Citas de Bienestar (probablemente bloqueada por el mismo bug de `SHOW_EXPLORE`).

---

## Dashboard → Acciones Rápidas (propuesta por rol)

### Escuela — mecanismo ya existe (`quickActionsCatalog.ts`, editable vía `QuickActionsEditDialog`)
Default actual: `students, teams(roto), offerings, payments, staff`. Propuesta (basada en volumen operativo real: 312 pagos vencidos, 116 pendientes, solo 18 recordatorios enviados):
1. Cobros atrasados → `/payments-automation` (filtrado a vencidos)
2. Deportistas → `/students`
3. Equipos y Planes → `/teams` (corrigiendo Fase 0 #2)
4. Invitar/Agregar → `/invitations`
5. Recordatorios de pago → `/payment-reminders` (hoy escondido, hay brecha grande entre cobros vencidos y recordatorios enviados)

### Padre — hoy 3 acciones estáticas, sin catálogo editable
Actual: `Agregar Hijo, Ver Equipos(roto), Mis Pagos`. Propuesta:
1. Pagar cuota pendiente → `/my-payments`
2. Ver próxima clase de mi hijo → `/enrollments`
3. Ver asistencia → `/parent-attendance` (hoy enterrado en el menú, ausente del dashboard)
4. Estado de cuenta/comprobantes → `/estado-cuenta` (página real ya construida, sin ítem de navegación propio ni quick action — hoy solo alcanzable desde dentro de Mis Pagos)
5. Agregar Hijo → mantener solo condicionado a `stats.children === 0`

### Atleta — catálogo real ya wireado a datos reales
Actual: `Entrenamientos, Mi Calendario, Mis Inscripciones, Estadísticas`. Propuesta:
1. Ver mi próxima sesión → `/training` (mantener)
2. Ver mi progreso → `/stats` (mantener)
3. Pagar/Mis pagos → `/athlete-payments` (nuevo, hoy solo pasivo en una stat-card)
4. Ver mi carnet digital → `/my-cards` (nuevo, diferenciador de producto sin visibilidad)
5. Mis inscripciones → `/enrollments` (mantener)
Sacar "Mi Calendario" de quick actions (ya está a un clic en el nav) y el placeholder muerto `activities: []` (`useDashboardConfig.ts:143`, nunca se renderiza para athlete).

### Coach — pendiente de definir en la fase de implementación
No se auditó el catálogo de quick actions de coach en esta ronda. Candidatos evidentes por lo que sí tiene uso real: Tomar asistencia (`attendance_sessions`/`attendance_records`, 2794/863 filas), Ver mis equipos, Gestión de Rutinas. Definir al llegar a esta fase.

---

## Páginas densas → Tabs/Accordion (priorizado por uso real)

**Prioridad alta** (uso real y alto, el refactor mejora una feature que sí importa):
- `AccessControlPage.tsx` (school, 1084 líneas) — 14,162 filas en `access_events`, 13,690 en `adms_device_log`. Tabs: Registro de Accesos / Dispositivos y PINs / Apertura Manual.
- `AttendanceSupervisionPage.tsx` (coach+school, 1698 líneas) — sin tabs, 3 secciones apiladas (Equipos/Planes/Instalaciones).
- `PaymentsAutomationPage.tsx` tab **Config** (school, ~540 líneas dentro de un tab ya existente) — Accordion: Reglas de Cobro / Mora / Validación de comprobantes / Recordatorios / Permisos / Datos de Pago.
- `TrainingPage.tsx` + `AthleteVisibleRoutines` (athlete, ~930 líneas combinadas, sin tabs) — Tabs: Hoy / Rutinas / Historial.

**Prioridad media**:
- `InvitationsManagementPage.tsx` (school, 1519 líneas) — Tabs: Pendientes/Aceptadas/Todas, envío masivo a Accordion.
- `AccountingSuppliersPage.tsx` (school, 503 líneas) — Tabs: Cuentas por Pagar / Proveedores.
- `PaymentRemindersPage.tsx` (school, 732 líneas) — Tabs: Por Revisar / Historial.
- `MyEnrollmentsPage.tsx` (parent+athlete, 2153 líneas) — el tab-bar ya existe pero está hecho a mano; migrar a `Tabs` de shadcn (no es un refactor de estructura, es consistencia).

**Prioridad baja / requiere componente nuevo**:
- `ParentCheckoutPage.tsx` (1071 líneas) — no hay componente Stepper en el repo. El gate `!hasCompleteDianData` ya actúa como paso 1 implícito; construir wizard con Tabs controlados: Datos de facturación → Método de pago → Comprobante (si manual) → Confirmación.
- `OfferingsManagement.tsx` (1450 líneas, modal de crear/editar plan) — no es apilamiento de página sino un modal gigante; necesita wizard por pasos, no tabs de página.
- `MonthlyReportsPage.tsx` (school, 702 líneas) — es un flujo secuencial de 3 pasos, no categorías paralelas; candidato a Accordion/stepper que colapsa el paso completado, no a Tabs.

**Ya bien organizadas, no tocar**: `StatsPage`, `AthletePaymentsPage`, `WellnessModule`, `MyAppointmentsPage`, `SettingsPage`, `CalendarPage`, `MyPaymentsPage`, `AcademicProgressPage` (todas ya usan `Tabs` real de shadcn), `ReportsPage`, `AccountingPage`, `PayrollPage`, `TrainingPlansPage`, `AttendanceHistoryPage`, `SchoolCardsAdminPage`, `SchoolFacilitiesPage`, `ReporterDashboardPage`, `SchoolStudentsManagementPage`.

---

## Orden de ejecución — el que manda es `ROADMAP.md §4`

No hay una numeración de fases propia acá: el orden lo fija la cola priorizada del roadmap, y este trabajo entra en dos puntos de esa cola, no antes:

- **`§4, #12.6` (`SEG-24`)** — junto a la pasada barata de `UX-1+UX-3+ERP-1+MOV-3`. Bug de una línea, sin decisión de diseño.
- **`§4, #17.5` (`UX-7 + UX-8`)** — justo después de `UX-6`, con el mismo criterio (features/roles que no le llegan a nadie hoy). El refactor de Tabs/Accordion (`UX-4`, detalle de páginas en la sección de arriba) sigue en `⚪` en el roadmap — no tiene todavía un lugar asignado en la cola priorizada; entra cuando el roadmap lo suba de `UX-5`/`UX-4`.

Eso significa que antes de tocar código de este spec hay que confirmar contra la base viva qué P0/P1 de seguridad y dinero siguen realmente abiertos (varios items del roadmap resultaron ya cerrados al verificar, y la fecha de este documento no garantiza que sigan vigentes al momento de ejecutar).

Cada fase en su propia rama con revisión antes de la siguiente, como en el resto de módulos grandes del repo.

---

## Decisiones de producto pendientes (necesito tu respuesta antes de avanzar)

1. De los módulos muertos confirmados en `UX-8` (Anuncios, Resultados-escuela, ProgramsManagementPage): ¿los elimino del menú y código, o preferís primero intentar relanzarlos (ej. Anuncios con un receptor del lado padre) antes de borrar? (Mensajes queda fuera de esta pregunta — ya resuelto: no se elimina, ver arriba.)
2. ¿Qué hacemos con el rol `organizer`? ¿Se elimina o hay plan de negocio detrás de torneos organizados por terceros?
3. La colisión de rol `admin` (`school_members.role='admin'` viendo el menú de plataforma) — ¿la separamos ahora como parte de `UX-8`, o esperamos a que alguna de esas 5 cuentas reales reporte el problema?
