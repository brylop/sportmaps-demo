# Mapa funcional de SportMaps

> Construido el 2026-10-10 desde el código (rutas, menús, páginas, componentes, hooks y BFF) y medido contra la base viva `luebjarufsiadojhvxgi` con consultas de solo lectura (ventana de 90 días salvo que diga otra cosa). Es **una sola base para todos los ambientes**: los conteos incluyen escuelas de prueba. Insumo para el rediseño (V1 y V2).

## Los mapas

| Archivo | Qué cubre | Pantallas | Formato |
|---|---|---:|---|
| [escuela.md](./escuela.md) · [escuela.json](./escuela.json) | Dueño (owner/`school`) y `school_admin`: 11 módulos del menú + shell + tienda + rutas huérfanas | 69 | extractor estático (TypeScript compiler API); uso por tabla principal (s90 / r90 / tot) |
| [entrenador-acudiente-deportista.md](./entrenador-acudiente-deportista.md) · [.json](./entrenador-acudiente-deportista.json) | Entrenador (coach y vendedor), entrenador personal, acudiente, deportista, y lo que ven fuera del layout: públicas, PWA y entradas por WhatsApp/correo/notificación | 156 | revisión manual por agentes; uso de `usage.json` pegado por tabla, RPC o ruta |
| [otros-roles-y-publicas.md](./otros-roles-y-publicas.md) · [.json](./otros-roles-y-publicas.json) | Profesional de salud, tienda/marketplace, organizador, «facility_manager», Super Admin, auth, onboarding, públicas y SportBot | 117 | revisión manual; uso como texto por pantalla y acción |
| [mapa-app.json](./mapa-app.json) | Los tres anteriores en un solo arreglo, **sin repetir pantallas compartidas** (clave = ruta + archivo; `roles[]`, `variants[]` por rol y acciones con `roles[]` y `statusByRole` cuando el estado cambia según el rol) | 226 únicas (85 compartidas) | JSON |
| [cruce-rediseno.md](./cruce-rediseno.md) | Dónde vive cada pantalla en la V1 y la V2, qué necesita cada tablero y las cuatro listas priorizadas | 342 entradas · 49 tableros | — |

Forma común de los JSON: `[{role, module, moduleKey, screen, route, file, tabs:[{name, actions:[{label, type, file, line, gates, reads, writes, status, usage}]}]}]` más campos propios de cada mapa (ver la cabecera de cada .md).

## Totales por rol

Pantallas = entradas del mapa (una ruta puede aparecer en varios roles). Acciones por estado normalizado (ver glosario). En `escuela` las acciones incluyen 146 `ui_control` (chips, paginación) que el .md omite, las pestañas son 160 grupos (93 `TabsTrigger` declarados + cuerpos sin pestaña) y el extractor no marca `partial` por acción (sí por pantalla).

| Mapa | Rol | Pantallas | Pestañas | Acciones | works | partial | duplicated | hidden | broken | dead | mock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| escuela | Escuela: owner / school_admin | 69 | 160 | 2129 | 1757 | 0 | 0 | 294 | 2 | 76 | 0 |
| entrenador-acudiente-deportista | Entrenador (coach) | 38 | 61 | 242 | 150 | 28 | 13 | 23 | 20 | 8 | 0 |
| entrenador-acudiente-deportista | Entrenador personal | 12 | 19 | 47 | 39 | 7 | 0 | 0 | 1 | 0 | 0 |
| entrenador-acudiente-deportista | Acudiente | 32 | 50 | 151 | 94 | 26 | 8 | 15 | 1 | 7 | 0 |
| entrenador-acudiente-deportista | Deportista | 29 | 41 | 122 | 96 | 12 | 1 | 4 | 3 | 6 | 0 |
| entrenador-acudiente-deportista | Públicas (lado familia) | 27 | 30 | 73 | 60 | 6 | 3 | 0 | 3 | 1 | 0 |
| entrenador-acudiente-deportista | PWA (transversal) | 9 | 9 | 15 | 12 | 2 | 0 | 0 | 0 | 1 | 0 |
| entrenador-acudiente-deportista | Entradas por WhatsApp / correo / notificación | 9 | 9 | 21 | 16 | 3 | 0 | 0 | 2 | 0 | 0 |
| otros-roles-y-publicas | Profesional de salud (+ lado paciente) | 19 | 30 | 49 | 35 | 5 | 1 | 1 | 3 | 3 | 1 |
| otros-roles-y-publicas | Escuela (pantallas en otros-roles) | 9 | 9 | 10 | 7 | 1 | 0 | 0 | 2 | 0 | 0 |
| otros-roles-y-publicas | Tienda / marketplace | 21 | 23 | 39 | 27 | 4 | 0 | 0 | 5 | 1 | 2 |
| otros-roles-y-publicas | Super Admin / admin de plataforma | 17 | 30 | 42 | 22 | 8 | 2 | 1 | 3 | 4 | 2 |
| otros-roles-y-publicas | Organizador y eventos | 13 | 22 | 26 | 5 | 4 | 1 | 0 | 15 | 1 | 0 |
| otros-roles-y-publicas | Auth, onboarding, públicas y SportBot | 33 | 33 | 43 | 27 | 8 | 2 | 0 | 2 | 3 | 1 |
| otros-roles-y-publicas | facility_manager (rol inexistente) | 5 | 7 | 19 | 13 | 4 | 0 | 0 | 0 | 1 | 1 |
| **Total** | | **342** | **533** | **3028** | **2360** | **118** | **31** | **338** | **62** | **112** | **7** |

Sin repetir pantallas compartidas: **226 pantallas** y **3019 acciones** (`mapa-app.json`; una acción solo se fusiona entre roles cuando coincide archivo, línea y etiqueta, y cada mapa anota las rutas de archivo a su manera). Estado de pantalla (342 entradas): works 175 · partial 83 · duplicated 19 · hidden 19 · broken 22 · dead 21 · mock 3.

Usuarios por rol (perfiles · login en 30 d): acudiente 908 · 181 — deportista 176 · 18 — escuela 63 · 16 — coach 43 · 14 — entrenador personal 12 · 0 — profesional de salud 6 · 1 — external_vendor 3 · 0 — reporter 2 · 0 — organizer 2 · 0 — store_owner 1 · 0 — super_admin 1 · 1 — school_admin 1 · 1. 371 escuelas, 67 con miembros activos, 25 con pagos en 90 días.

## Hallazgos transversales

### 1. Seguridad

| # | Hallazgo | Evidencia | Mapa |
|---|---|---|---|
| 1 | **Cualquiera puede elegir su rol al registrarse.** El trigger `handle_new_user` (verificado en la base viva) confía en `raw_user_meta_data.role` sin lista blanca: `signUp({data:{role:'super_admin'}})` deja `profiles.role='admin'`, y `reporter`, `accountant`, `organizer`, etc. pasan tal cual. **No** pasa `is_super_admin()` (verificado: `is_platform_admin()` usa `app_metadata.platform_admin` y la tabla `platform_admins`, no `profiles.role`), así que la RLS no se salta; el riesgo está en pantallas y rutas del BFF que confíen en `profiles.role` (en revisión por el agente de seguridad). La migración que lo cierra (`20260910073724`) solo cubre UPDATE y no está aplicada. Hoy 0 perfiles con `role='admin'`. | `otros-roles-y-publicas.md` §0.1 | otros |
| 2 | **IDOR en el reporte del equipo:** `GET /api/v1/reports/coach/:teamId` usa service role y solo valida escuela para `school_admin`: un coach lee roster, asistencia y resultados de cualquier equipo de cualquier escuela por UUID. | `bff/src/routes/reports.ts:661-680`, `pages/CoachReportsPage.tsx:239` | EDA |
| 3 | **Owner y school_admin se saltan `allowedRoles`** (`PRIVILEGED_CONTEXT_ROLES`): abren por URL `/admin/users`, `/admin/clubs`, `/admin/analytics`, `/admin/reports`, `/admin/config`, `/admin/logs`, `/admin/payroll-config` y pantallas de otros roles (`/pacientes`). Cada pantalla depende de su RLS o BFF. | `escuela.md` § Hallazgos | escuela |
| 4 | **El coach edita, reasigna, archiva y borra cualquier equipo de su escuela** (policy sin versionar «Teams: manage staff»), y la vista «Deportistas» de `/teams` expone nombre, teléfono y correo de los acudientes de toda la escuela. Sin `school_staff` por email, `/students` carga toda la escuela. | `pages/TeamsPage.tsx:266`, `:325`, `:807`; `SchoolStudentsManagementPage.tsx:603` | EDA |
| 5 | **Dinero calculado o escrito desde el navegador:** «Nuevo Pago» del acudiente toma `teams.price_monthly` y crea un cobro nuevo (duplicados); el atleta adulto queda como su propio acudiente; `PendingEnrollmentModal` simula el pago y activa la inscripción sin validar. | `MyPaymentsPage.tsx:651`, `AthletePaymentsPage.tsx:523`, `PendingEnrollmentModal.tsx:51` | EDA |
| 6 | **Gate de edad saltable:** Google OAuth → `/onboarding/role` (preselecciona «Atleta»), `/onboarding/athlete` y `/join-plan` no validan 18 años; solo `RegisterPage.tsx:87` lo hace. | `OnboardingRolePage.tsx:43`, `AthleteOnboarding.tsx:77` | EDA |
| 7 | **`coach_hide_financial_info` no se respeta** al crear o editar equipo ni en «Ver estado de cuenta» (el rediseño promete que el entrenador nunca ve dinero). | `TeamsPage.tsx:789`, `SchoolStudentsManagementPage.tsx:1358` | EDA |
| 8 | El enlace de cortesía semanal sale con `FRONTEND_URL`: el BFF de dev manda `dev.sportmaps.co` a familias reales. | `whatsapp-cortesia-semana.service.ts:164` | EDA |
| 9 | Roles fantasma: `facility_manager` no existe en el enum, el CHECK ni el código (solo en docs); `external_vendor` tiene 3 perfiles y ninguna pantalla; `reporter`, `accountant` y `organizer` entran por el trigger sin filtro. | `otros-roles-y-publicas.md` §0.2 y §9 | otros |

### 2. Roto (falla siempre o casi siempre)

- Módulo **organizer** de punta a punta (onboarding, crear evento, mis eventos, calendario, finanzas, perfil); el BFF quedó desincronizado con el esquema (`events.route.ts:274`). También inscripción individual a eventos y `/my-event-registrations`.
- **Mensajes** (`/messages`): 0 mensajes, sin forma de redactar (`MessagesDetailPage` sin ruta), y ocupa un lugar en la barra inferior de escuela, coach y acudiente.
- **Anuncios** del coach: el insert falla (`school_id` NOT NULL) y nadie lee la tabla (`AnnouncementsPage.tsx:236`).
- **Resultados** de escuela (`/results-overview`): vacío fuera de demo (`ResultsOverviewPage.tsx:47`).
- El grupo «Mi Tienda» del coach-vendedor lleva a rutas que lo rechazan (`/orders`, `/inventory`, `/vendor/appointments` → `/unauthorized`); `/vendor/subscribers` y «Auto-generar payouts» responden 410; `/store-reports` roto.
- Para el coach: invitar (individual, masivo y la pantalla), «Quitar del equipo», «Publicar informe» post-entreno (403) y «Ver estado de cuenta».
- `?redirect=` se ignora en el login (`LoginPage.tsx:75` lee `redirectTo`): tienda, checkout, Explorar y Marketplace caen en `/dashboard`.
- La notificación de ausencia apunta a `/my-attendance`, que no existe; `resolveNotificationLink` (que lo corregiría) no se usa.
- Progreso del hijo (`/academic-progress`) lee `academic_progress` (≈5 filas; «nadie la carga»): el progreso real está en `performance_entries`.
- Super Admin: `/admin/users` y «Quitar override» de precio; el grupo «Comunicación» no aparece en el panel de módulos (`AdminSubscriptionsPage.tsx:1252`).
- Públicas: `/s/:slug` (CTA de demo) e «Inscribirse» en Explorar.

### 3. Muerto, oculto o sin uso

- Rutas sin menú ni enlace: `/programs-management` (pero la acción rápida por defecto lleva ahí), `/school-config`, `/pickup` (mock), `/school/delegations*`, `/evaluations`, `/children/:id/progress|attendance`, `/children/:id/post-entreno-informe`, `/escuela/:id`, `/pagos/confirmacion`, `/shop`, `/marketplace`, `/nutrition`, `/admin/clubs`, `/admin/logs`, `/admin/upgrade-requests`.
- Páginas sin ruta: `AdvancedSearchPage`, `AnalyticsDashboardPage`, `AthletesListPage`, `CalendarAdvancedPage`, `FacilitiesPage`, `MessagesDetailPage`, `ProductDetailPage`, `StorePage`, `StudentsPage`, `UnderConstructionPage`; importadas sin `<Route>`: `EventsMapPage`, `ChildProgressPage`, `ChildAttendancePage`. Config muerta: `config/routePermissions.ts` (nadie lo importa y diverge de `App.tsx`).
- Ocultos que casi nadie tiene: flujo «Cobros y pagos» (`VITE_COBROS_Y_PAGOS`, `charge_batches` = 0), débito automático (`recurring_subscriptions` = 0), tienda (`store_enabled` global = false), Explorar (solo en DEV pero con 6+ botones que llevan ahí), Centro de ayuda.
- Interruptores decorativos: privacidad (`public_profile`, `allow_search`, `show_stats`) y la mayoría de preferencias de notificación no los lee nadie (`PrivacySection.tsx:32`, `NotificationsSection.tsx:35`). «Eliminar cuenta» de `/profile` sin `onClick` (`ProfilePage.tsx:402`).

### 4. Duplicados

- Registrar pago en 3 pantallas de escuela (16 componentes compartidos); cartera en 4 destinos; datos de facturación DIAN en 5 pantallas; facturación electrónica standalone = pestaña de Contabilidad.
- Configuración de escuela en `/settings`, `/school-config`, `/admin/config` y la pestaña Config de Pagos; plantillas de cobro en `/payment-reminders` y `/message-templates` (misma tabla).
- Invitar en 4 caminos con 2 backends; disponibilidad (`AvailabilityManager`) en `/staff`, `/facilities`, `/coach-plans` y `/trainer/availability`.
- Asistencia del coach en 3-4 entradas; resultados de partido en 3 pantallas y 2 modelos (`match_results` vs `competition_results`); evaluar en `/training-plans` y `/evaluations`; dos informes mensuales del equipo.
- Mis Pagos del acudiente vs del atleta (814 vs 1.154 líneas; el atleta pierde glosas y débito); checkout ×3; resultado de pago ×2; perfil propio ×2 con 3 subidores de avatar.
- Perfil público de escuela ×3; vitrinas de tienda ×3; productos servidos en 4 rutas; onboarding y dashboard del profesional ×2; organizer vs torneos de escuela; sedes vs instalaciones vs clubes; el portal del entrenador personal envuelve `/offerings` y `/payments-automation` saltándose `ModuleGate`.

### 5. Navegación inconsistente

- `MobileBottomNav` usa `profile.role` (no el rol de contexto): un `school_admin` ve la barra genérica; muestra «Pagos» con `billing_enabled = false` y «Chat» (roto). `personal_trainer` no tiene barra propia.
- Dos árboles de menú casi iguales (school 45 ítems, school_admin 44); muchos ítems sin `moduleKey` (Seguimiento, Asistencias, Resultados, Torneos, Dotación, Deportistas, Entrenadores, Invitaciones…), así que el Super Admin no los puede apagar; al coach no se le ocultan Calendario e Informe Mensual aunque se apague el módulo.
- Etiqueta del menú ≠ pantalla: «Supervisión» abre «Tomar lista»; «Sesiones de Entrenamiento» abre «Métricas y Rendimiento»; «Mis Planes» del coach es disponibilidad; «Explorar Bienestar» del atleta son medidas corporales; «Seguimientos» del profesional vive en `/historias`.
- `/mi-plan` («Facturación») aparece en el menú de profesional, tienda, organizador y admin, y la página los rechaza. `/profile` del coach y del atleta solo está en la barra inferior; el del acudiente solo en el checklist.
- `/my-event-registrations` y `/explorar` están fuera del layout autenticado: se pierde el menú al entrar.
- El propio rediseño se contradice: Navegación (Hoy · Deportistas · Deportivo · … · Dinero) vs Menú lateral y Barra inferior (Entrenadores, Cobros, sin Deportivo). Ver `cruce-rediseno.md`.

## Las 15 funciones más usadas

Ordenadas por amplitud (escuelas distintas con actividad en 90 días) y después por volumen.

| # | Función | Pantalla(s) | Uso | Fuente |
|---|---|---|---|---|
| 1 | Cobros, pagos y cartera | `/payments-automation`, `/students` | `payments` 4.960 filas en 90 d, **25 escuelas** | escuela.json |
| 2 | Notificaciones (campana) | todas | 5.405 en 90 d, 20 escuelas; a acudientes 3.640 y solo **153 leídas** | escuela.json, usage.json |
| 3 | Inscripciones y alta de deportistas | `/students`, `/teams` | `enrollments` 921 (18 escuelas), `children` 412 (14) | escuela.json |
| 4 | Sedes | `/branches` | `school_branches` 24 en 90 d, 16 escuelas (la Sede Principal es automática) | escuela.json |
| 5 | Comprobantes de transferencia del acudiente | `/my-payments`, WhatsApp | 486 en 90 d (266 pagadores, **15 escuelas**) + 56 por WhatsApp; 506 pagos por transferencia con comprobante | usage.json |
| 6 | Invitaciones | `/invitations`, `/students` | 259 en 90 d, 14 escuelas; acudientes: 302 aceptadas / 406 pendientes | escuela.json, usage.json |
| 7 | Entrenadores | `/staff` | `school_staff` 49 en 90 d, 14 escuelas | escuela.json |
| 8 | Tomar lista y supervisar asistencia | `/coach-attendance`, `/attendance-supervision`, `/attendance-history` | `attendance_records` 4.981 (11 escuelas); 2.636 marcadas por 17 coaches; 1.196 sesiones (13 escuelas) | escuela.json, usage.json |
| 9 | Disponibilidad del entrenador | `/coach-plans` | 734 franjas, 18 coaches, **13 escuelas** | usage.json |
| 10 | Equipos | `/teams` | 80 en 90 d, 13 escuelas | escuela.json |
| 11 | Planes y ofertas | `/offerings` | `offering_plans` 72 en 90 d, 11 escuelas | escuela.json |
| 12 | Métricas de rendimiento | `/training-plans`, `/post-entreno` | `performance_entries` 1.367 en 90 d, 8 escuelas (coach 665 + 271, escuela 224, autoevaluación 205) | escuela.json, usage.json |
| 13 | Informe mensual del deportista | `/informe-mensual`, `/children/:id/reports` | 157 en 90 d, 6 escuelas; **5 vistos** alguna vez | escuela.json, usage.json |
| 14 | Control de acceso (ZKTeco) | `/school/access-control` | `access_events` **10.376** en 90 d (3.438 en 30 d), 4 escuelas | escuela.json, otros |
| 15 | Pago por enlace sin login | `/p/:token` | 929 enlaces creados, 211 abiertos, 418 aperturas, 2 escuelas | usage.json |

Mucho volumen en pocas escuelas: QR de inscripción (1.727 escaneos, 226 registros, 61 pagados), carnets (508 en 90 d, 3 escuelas; 0 impresos), facturación electrónica (324, 2), WhatsApp (292 conversaciones, 2), calendario (106, 5), prospectos (28 en 30 d), SportBot (36 mensajes en 30 d).

## Las 15 funciones nunca usadas

| # | Función | Pantalla(s) | Evidencia |
|---|---|---|---|
| 1 | Mensajes / chat | `/messages` (en la barra de 3 roles) | `messages` = 0 histórico |
| 2 | Anuncios | `/announcements` | `announcements` = 0 |
| 3 | Constancias y sus plantillas | `/certificates`, `/cards/templates/certificates`, `/my-certificates` | `athlete_certificates` = 0, `school_certificate_templates` = 0 |
| 4 | Membresías | `/memberships` | `memberships` = 0 |
| 5 | Cobros y pagos v2 (modal único, cobrar a un equipo, Operaciones) | `/payments-automation`, `/students`, `/teams` | `charge_batches` = 0 (detrás de `VITE_COBROS_Y_PAGOS`) |
| 6 | Débito automático | pestaña de Pagos, Mis Pagos | `recurring_subscriptions` = 0 |
| 7 | Objetivos del deportista | `/goals` | `athlete_goals` = 0 |
| 8 | Módulo clínico | `/pacientes`, `/historias`, `/disponibilidad-medica`, `/salud` | `clinical_patients`, `clinical_episodes`, `clinical_notes`, `health_records` = 0; 1 cita histórica |
| 9 | Organizador de eventos | `/organizer/*` | `event_organizers` = 0 |
| 10 | Encuestas de asistencia | `/dashboard/polls`, `/polls/v/:pollId` | 0 en 90 d (3 históricas) |
| 11 | Solicitudes de pausa | bandeja en `/students`, «Solicitar pausa» del acudiente | `enrollment_pause_requests` = 0 |
| 12 | Liquidaciones, reseñas y preguntas de tienda | `/vendor/payouts`, `/vendor/inbox` | `vendor_payouts` = 0, `product_reviews` = 0, `product_questions` = 0 |
| 13 | Solicitudes de upgrade de plan | `/admin/upgrade-requests` | `plan_upgrade_requests` = 0 |
| 14 | Subida de hoja de matrícula por el coach y rutinas creadas por coach | `/school/enrollment-intake`, `/school/routines` | 0 por coach en 90 d; `trainer_routines` de coach = 0 |
| 15 | Telemetría y analítica | (transversal) | `event_telemetry`, `analytics_events`, `billing_events` = 0: los inserts los bloquea la RLS |

Casi sin uso: pedidos de tienda (3 en 90 d), inscripciones a eventos (4), `training_logs` (9 en total), dotación (4 asignaciones), glosas (2), cierre de mes (5), proveedores (4), nómina (2), delegaciones (1), citas de bienestar en 90 d (0) y check-in por QR del carnet (1).

## Glosario

**Estado de pantalla o acción** (cada mapa usa su vocabulario; el README los normaliza a la primera palabra):

| Valor | Significa | Dónde aparece |
|---|---|---|
| `works` | Funciona por el camino por defecto. | los tres |
| `partial` | Funciona con huecos: datos incompletos, un caso que falla, texto engañoso. | los tres |
| `broken` | Falla siempre o casi siempre (error, 403/410, lista vacía por RLS, ruta inexistente). | los tres |
| `hidden` | Existe pero casi nadie llega: detrás de flag, addon, condición o sin entrada de menú. | los tres |
| `hidden (flag VITE_COBROS_Y_PAGOS)` | Parte del flujo nuevo «Cobros y pagos», apagado por variable de entorno (o `localStorage['sportmaps:cobros-y-pagos']`). | escuela |
| `dead` | Código sin efecto, inalcanzable o ruta sin uso. | EDA, otros |
| `dead route` | Ruta en `App.tsx` sin entrada de menú. | escuela |
| `dead code` | Página o componente alcanzable solo por URL y sin backend (p. ej. mock). | escuela |
| `duplicated` | Otra pantalla o acción hace lo mismo. | EDA, otros |
| `mock` | Datos falsos o botones sin acción. | otros |
| `(derivado)` | En el mapa EDA el estado de pantalla se calcula desde sus acciones. | EDA |

**Uso:** `usado` (alguna métrica > 0) · `sin uso` (todas en 0) · `no medido` (no hay tabla que la respalde, p. ej. pantallas de solo lectura). `s90` = escuelas distintas con filas nuevas en 90 días · `r90` = filas nuevas en 90 días · `tot` = histórico.

**Destino en el cruce:** *vive en el rediseño* · *se fusiona* · *se elimina* · *falta en el rediseño* · *fuera de alcance* (públicas y sistema).

**Tipos de acción:** `button`, `menu_item`, `toggle`, `filter` (selector o búsqueda), `dialog` (título de modal), `link`, `navigate`, `read` (dato que la pantalla muestra), `export`, `bulk` / `bulk_select`, `widget`, `ui_control` (control sin efecto de datos).

**Siglas:** EDA = mapa entrenador-acudiente-deportista · RLS = Row Level Security · BFF = backend Express (`bff/`) · V1 / V2 = las dos versiones del lienzo «SportMaps — Rediseño global».
