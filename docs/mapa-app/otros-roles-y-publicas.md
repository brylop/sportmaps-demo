# Mapa funcional: otros roles y páginas públicas

> Insumo para el rediseño. Fecha: 2026-10-10. Fuente: el **código** (`frontend/src/App.tsx`, `config/navigation.ts`, páginas, hooks y BFF) más **conteos de solo lectura** en la base viva (`luebjarufsiadojhvxgi`).
> Datos estructurados: [`otros-roles-y-publicas.json`](./otros-roles-y-publicas.json). Forma: `[{role, module, moduleKey, screen, route, file, status, usage, notes, tabs:[{name, actions:[{label, type, file, line, gates, reads, writes, status, usage}]}]}]`.
> Las rutas de archivo son relativas a `frontend/src/` salvo que empiecen por `bff/` o `supabase/`.

**Cubre:** wellness_professional, store_owner (tienda/marketplace), organizer (torneos/eventos), facility_manager (sedes/reservas/acceso), admin/super_admin (plataforma, panel de módulos, facturación SaaS), onboarding, auth, páginas públicas y SportBot/soporte.

**Estados:** `works` funciona · `partial` funciona con huecos · `broken` falla siempre o casi siempre · `hidden` existe pero no hay cómo llegar · `dead` código sin efecto o ruta sin uso · `duplicated` otra pantalla hace lo mismo · `mock` datos falsos o botones sin acción.

---

## 0. Lo urgente antes de rediseñar

1. **SEGURIDAD: cualquiera puede registrarse como admin de plataforma.** El trigger `handle_new_user` (verificado en la base viva) confía en `raw_user_meta_data.role`. Con `signUp({data:{role:'super_admin'}})` el perfil queda con `profiles.role='admin'`. Ese rol pasa las rutas *strict* de admin y `is_super_admin()` (que acepta `admin` y `super_admin`). Además `reporter`, `accountant` y `organizer` entran sin filtro. Hoy no hay ningún perfil con `role='admin'`, así que no hay señales de explotación. La migración `20260910073724_profiles_bloquear_autoasignacion_de_rol.sql` solo cubre UPDATE y dice "NO APLICADA". `complete_role_selection` sí tiene allow-list; el trigger no.
2. **El rol `facility_manager` no existe en ninguna parte:** ni en el enum `user_role`, ni en el CHECK de `school_members`, ni en el frontend o el BFF. Solo aparece en un comentario de migración y en los docs (`CLAUDE.md` lo lista como rol). La operación de sedes, reservas y acceso la hacen owner, admin y school_admin.
3. **La tienda está apagada globalmente:** `platform_config.store_enabled = {"enabled": false}`. Todo lo que tiene `StoreGate` o `requiresStore` está oculto o bloqueado para todos. En la base hay 6 productos y 4 pedidos (último pedido el 2026-10-03). El inventario de GYM RM (73 productos, commit `614b41e0`) **no está cargado**: el script simula por defecto.
4. **El módulo organizer está roto de punta a punta.** El BFF del organizador quedó desincronizado con el esquema (el propio código lo admite en `bff/src/routes/events.route.ts:274`). `event_organizers` tiene 0 filas. El único camino de torneos que funciona es el de la escuela (`/school/tournaments*`).
5. **El módulo clínico está completo pero sin uso:** 0 pacientes, 0 episodios, 0 notas y 1 sola cita (julio). Hay 6 perfiles wellness y 1 inició sesión en los últimos 30 días.

---

## 1. Uso real (conteos de solo lectura, 2026-10-10)

### Perfiles por rol (`profiles` + `auth.users`)

| Rol | Total | Login últimos 30 d | Último login |
|---|---:|---:|---|
| parent | 908 | 181 | 10-10 |
| athlete | 176 | 18 | 10-10 |
| school | 63 | 16 | 10-10 |
| coach | 43 | 14 | 10-10 |
| personal_trainer | 12 | 0 | 09-02 |
| wellness_professional | 6 | 1 | 09-22 |
| external_vendor | 3 | 0 | 05-11 |
| reporter | 2 | 0 | 08-03 |
| organizer | 2 | 0 | 07-02 |
| store_owner | 1 | 0 | 07-02 |
| super_admin | 1 | 1 | 10-09 |
| school_admin | 1 | 1 | 09-30 |
| **facility_manager** | **no existe** | — | — |

- `external_vendor` está en el enum y tiene 3 perfiles, pero ninguna pantalla lo atiende. Cae en `baseNav`.
- `accountant` está en el enum y tiene 0 perfiles.
- En `school_members` (activos): 66 owner, 872 parent, 48 athlete, 37 coach, 5 admin, 2 school_admin, 2 reporter.

### Uso por módulo (tablas que respaldan cada pantalla)

| Módulo | Tabla(s) | Filas | Actividad reciente |
|---|---|---:|---|
| Control de acceso (ZKTeco) | access_events | 14.144 | 3.438 en 30 d, 4 escuelas, último hoy |
| Sedes | school_branches | 427 | 371 escuelas (Sede Principal automática) |
| Instalaciones | facilities / facility_availability | 30 / 274 | 11 escuelas |
| Reservas de instalación | facility_reservations | 60 | **0 en 30 d**, 3 escuelas, último 08-21 |
| Reservas de cortesía | session_bookings / public_booking_verifications | 72 / 43 | último 09-17 |
| Clase de prueba | trial_class_bookings / school_trial_slots | 2 / 139 | slots generados por cron |
| Prospectos | school_signup_leads | 32 | 28 en 30 d |
| Banco de horas | hour_bank_reservations | 18 | piloto Dreamers |
| Facturación SaaS | school_subscription_invoices | 9 | 3 pagadas, última 10-03 |
| Suscripciones | school_subscriptions | 220 | 176 trial_expired, 27 grandfathered, 9 trialing, 8 active |
| Addons | school_addons | 260 | — |
| Panel de módulos | school_module_overrides | 17 | todos OFF, último 10-09 |
| Integridad de inscripciones | enrollment_integrity_findings | 188 | — |
| Soporte / SportBot | support_tickets / support_messages | 8 / 57 | 27 de usuario, 25 del bot, 5 de agente; 18+18 en 30 d |
| LLM (WhatsApp, OCR) | llm_usage | 116 | ocr 67, bot 41, transcripción 8; **0 con feature `sportbot`** |
| Carnets | athlete_id_cards | 513 | — |
| QR de inscripción | school_join_qr_codes | 12 | — |
| Tienda | products / orders / order_items | 6 / 4 / 5 | último 10-03 |
| Vendedores | vendor_profiles | 34 | 30 pending (14 trainer, 14 school, 2 wellness), 4 verified |
| Checkout de tienda | store_payment_settings | 4 | **todas de escuelas; 0 de vendedores externos** |
| Servicios marketplace | service_listings | 2 | — |
| Liquidaciones | vendor_payouts / vendor_bank_accounts | 0 / 0 | — |
| Reseñas, preguntas y chat de tienda | product_reviews, product_questions, store_messages | 0 | — |
| Eventos | events | 9 | 8 de escuela, 1 seed de organizer |
| Organizadores | event_organizers | **0** | — |
| Inscripciones a eventos | event_registrations / event_delegations | 6 / 1 | — |
| Partidos de torneo | tournament_matches | 5 | — |
| Clínico | clinical_patients, clinical_episodes, clinical_notes, clinical_consents | **0** | — |
| Citas wellness | wellness_appointments | 1 | 07-01 |
| Solicitudes de upgrade | plan_upgrade_requests | 0 | — |
| Telemetría y analítica | event_telemetry / analytics_events / billing_events | 0 / 0 / 0 | inserts bloqueados por RLS |

**Lo más usado:** control de acceso, sedes (automáticas), carnets, prospectos y cortesías, panel de módulos/suscripciones y SportBot.
**Lo menos usado (cero):** módulo clínico, organizer, tienda de vendedores externos, liquidaciones, reseñas, solicitudes de upgrade y telemetría.

---

## 2. wellness_professional (profesional de salud / fisio)

**Menú** (`config/navigation.ts:553-584`): Inicio `/vendor/dashboard` · Agenda `/schedule` · Pacientes `/pacientes` · Seguimientos `/historias` · Disponibilidad `/disponibilidad` · Reportes `/wellness-reports` · Mis Servicios `/vendor/services` · Mi Perfil Público `/vendor/public-profile` · Facturación `/mi-plan` · Configuración `/settings`.

**Gates:** `ProtectedRoute['wellness_professional']` sin strict, así que owners y admins de escuela también entran. El muro real es RLS (`professional_id = auth.uid()`). No hay ModuleGate ni addon. Las rutas `/vendor/*` pasan por `VendorGuard`, que decide por `vendor_profiles` y no por rol.

| Pantalla | Ruta | Archivo | Estado | Notas |
|---|---|---|---|---|
| Panel del Profesional | `/dashboard` | pages/DashboardPage.tsx | duplicated | El login aterriza aquí; el menú "Inicio" va a `/vendor/dashboard` |
| Panel vendor | `/vendor/dashboard` | pages/vendor/VendorDashboardPage.tsx | duplicated | Llama insights de tienda y descarta el resultado (:74) |
| Agenda | `/schedule` | pages/WellnessSchedulePage.tsx | works | Canónica: confirmar, rechazar, reprogramar, no asistió, "marcar pagada" (solo un flag) |
| (redirect) | `/vendor/appointments` | VendorAppointmentsPage.tsx:4 | dead | Solo `Navigate` a `/schedule` |
| Pacientes | `/pacientes` | pages/clinical/PatientsPage.tsx | works | 0 pacientes |
| Historia clínica | `/pacientes/:id` | pages/clinical/PatientDetailPage.tsx | works | Pestañas: Historia, Lesiones, Ejercicios, Citas, Adjuntos, Consentimientos |
| Imprimir historia | `/pacientes/:id/imprimir` | PatientRecordPrintPage.tsx | partial | No imprime lesiones, ejercicios ni adjuntos |
| Seguimientos | `/historias` | pages/clinical/FollowUpsPage.tsx | works | El nombre de la ruta no coincide con la etiqueta |
| Disponibilidad | `/disponibilidad` | pages/clinical/AvailabilityPage.tsx | works | Sin perfil manda a `/vendor/onboarding`, que no pide RETHUS |
| Reportes | `/wellness-reports` | ProfessionalReportsPage.tsx | works | Sin exportar |
| Mis servicios | `/vendor/services` | pages/vendor/VendorServicesPage.tsx | partial | Editar deshabilitado ("próximamente"); Desactivar no revisa la respuesta |
| Perfil público | `/vendor/public-profile` | VendorPublicProfilePage.tsx | partial | **Despublicar** bloquea `/vendor/*` (VendorGuard manda a onboarding). Compartir lleva a `/tienda/:slug`, que no muestra servicios y está apagada |
| Facturación | `/mi-plan` | pages/MiPlanPage.tsx | dead | "Esta sección no es para tu cuenta" |
| Nutrición | `/nutrition` | pages/NutritionPage.tsx | mock / dead | `mockPlans=[]`, 4 botones sin handler, sin menú |
| Suscriptores | `/vendor/subscribers` | VendorSubscribersPage.tsx | broken | El BFF responde 410 `recurring_v1_retired` |
| Onboarding clínico | `/onboarding/wellness` | onboarding/WellnessOnboarding.tsx | works | Guarda licencia, RETHUS y especialidad |
| Onboarding vendor | `/vendor/onboarding` | vendor/VendorOnboardingPage.tsx | duplicated | Lenguaje de tienda, sin campos clínicos |

Lado paciente y escuela: `/wellness/appointments` (Mis citas), `/salud`, `/salud/invitacion/:token` y `/disponibilidad-medica` funcionan, pero sin pacientes no tienen uso. Rutas viejas que redirigen: `/athletes` y `/evaluations/new` → `/pacientes`; `/medical-history` y `/follow-ups` → `/historias`.

Detalle por pestaña de `/pacientes/:id` (en el JSON):
- **Historia:** abrir episodio, editar plan, valoración inicial, nota de evolución, alta, cerrar sin alta, nota aclaratoria, CIE-10.
- **Lesiones:** registrar, editar, marcar resuelta.
- **Ejercicios:** biblioteca y asignación.
- **Citas:** duplica la agenda por paciente.
- **Adjuntos:** se pueden subir **sin consentimiento**; ni la UI ni la RLS lo exigen.
- **Consentimientos:** firma presencial, invitar a la app, revocar.

---

## 3. store_owner y tienda/marketplace

**Menú** (`navigation.ts:586-619`): Dashboard Vendedor · Mis Productos · Pedidos · Stock · Proveedores · Categorías · Clientes · Reportes · Promociones · Perfil Público · Facturación · Configuración. Todo lo de tienda lleva `requiresStore`, así que **hoy el menú del store_owner queda casi vacío** (store_enabled=false).

**4 de los 9 ítems de tienda son alias de otra página:**

| Ítem de menú | Ruta | Renderiza en realidad |
|---|---|---|
| Categorías | `/categories` | lista de productos (VendorProductsPage) |
| Promociones | `/promotions` | lista de productos |
| Proveedores | `/suppliers` | inventario |
| Clientes | `/customers` | pedidos |
| Reportes | `/store-reports` | **ReportsPage de escuela**: spinner infinito sin schoolId (broken) |

- `StoreProductsPage.tsx` es literalmente `export { default } from './vendor/VendorProductsPage'`.
- Los alias saltan `VendorGuard`.

| Pantalla | Ruta | Estado | Notas |
|---|---|---|---|
| Dashboard vendedor | `/vendor/dashboard` | partial | "Productos activos" cuenta por `vendor_id` legacy y da 0 en tiendas nuevas |
| Productos | `/vendor/products` | works | Ajustar stock, editar, archivar sin confirmación |
| Asistente de producto | `/vendor/products/new`, `/:id/edit` | works | 4 pasos; publicar puede quedar en `pending_review` |
| Inventario | `/inventory` | works | Kárdex, reponer, ajustar |
| Pedidos del vendedor | `/orders` | works | Aprobar o rechazar comprobante, efectivo con código, transiciones, cancelar |
| Promociones | `/vendor/promotions` | mock | "Próximamente" |
| Inbox (reseñas, preguntas, chat) | `/vendor/inbox` | hidden | Sin menú para store_owner (`getVendorNavGroup` no se le muestra) |
| Liquidaciones | `/vendor/payouts` | hidden / partial | Obsoleto bajo D-5 (cada vendedor cobra con sus llaves) |
| Envíos | `/vendor/shipping` | hidden | Funciona pero no hay cómo llegar |
| Facturación | `/mi-plan` | dead | Rechaza al rol |
| Tu tienda (escuela) | `/tienda-escuela/ajustes` | works | Solo escuelas; **no** store_owner |

**Hueco de producto:** el store_owner externo **no tiene pantalla para configurar los métodos de pago del checkout**. Lo que guarda `/vendor/onboarding` no es `store_payment_settings`, que es lo que lee el checkout. En la base, 0 vendedores externos tienen esa configuración, así que una tienda externa no puede cobrar.

**Comprador:**

| Pantalla | Estado | Notas |
|---|---|---|
| `/tienda/:slug` | works | Canónica, con chat |
| `/tienda/:slug/p/:id` | works | — |
| `/checkout/tienda/:vp` | works | Wompi o Mercado Pago |
| `/mis-compras` y `/:orderId` | works | Código de retiro, comprobante, recibido, cancelar |
| `/mi-tienda` | works | Solo redirige a la tienda de la escuela |
| `/carrito` | partial | Ítems que vienen de `/marketplace` o `/shop` no tienen tienda y no se pueden pagar |
| `/marketplace`, `/marketplace/:type/:id` | duplicated / broken | Carrito sin vendedor; "Ver perfil" apunta a `/vendor/:slug`, que no existe |
| `/shop` | duplicated / broken | Legacy, con carrito propio; solo lo enlaza DemoQuickLinks |

**Admin:**
- `/admin/marketplace/moderation` funciona. Lee vendors directo y salta el endpoint BFF existente.
- `/admin/payouts` está parcial. "Auto-generar" responde 410.

---

## 4. organizer (torneos/eventos)

**Menú** (`navigation.ts:800-825`): Dashboard · Crear Evento · Mis Eventos · Calendario · Finanzas · Reportes · Perfil · Facturación · Configuración.

**Cómo alguien se vuelve organizer:**
1. Registro con `?role=organizer` (no hay tarjeta en `/register`) o desde `/onboarding/role`.
2. `/organizer/onboarding` crea la fila en `event_organizers`.
3. `OrganizerGuard` lee `is_verified`, pero **ninguna pantalla ni endpoint permite poner `is_verified=true`**.
4. Si alguien que **no** es organizer abre `/organizer/*`, ve un **spinner infinito** (`OrganizerGuard.tsx:19-21`).

**Causas raíz:**
- **RC1:** el BFF filtra `events.organizer_id = event_organizers.id`, pero la FK apunta a `profiles(id)`, así que nunca coincide.
- **RC2:** el BFF usa el estado `'published'`, que el CHECK prohíbe.
- **RC3:** las columnas de delegación están mal nombradas (`total_amount`/`paid_amount` vs `total_owed`/`total_paid`).
- **RC4:** las columnas de miembros y coaches de equipo están mal.
- **RC5:** `package_choice` no existe.
- **RC6:** el bucket `organizer-docs` no existe, y se usa `getPublicUrl` sobre buckets privados.
- **RC7:** RLS bloquea los inserts en `event_telemetry`.

| Pantalla | Ruta | Estado | Causa |
|---|---|---|---|
| Onboarding | `/organizer/onboarding` | broken | Bucket inexistente; la salida va a `/organizer/home`, que da 404 |
| Dashboard | `/organizer/dashboard` | partial | Usa `creator_id`, mientras Mis Eventos usa `organizer_id` |
| Crear evento (5 pasos) | `/organizer/create-event` | broken | El POST falla siempre (FK, NOT NULL, columnas inexistentes) |
| Mis eventos | `/organizer/events` | broken | RC1, RC2 |
| Gestión de evento | `/organizer/event/:id` | partial | Inscripciones y switch funcionan. Estado, Delegaciones, Editar y Documentos están rotos. Documentos expondría todos los niños de cada escuela |
| Calendario | `/organizer/calendar` | broken | RC1 |
| Finanzas | `/organizer/finances` | broken | RC1, RC3 |
| Reportes | `/organizer/reports` | duplicated | Mismos datos que Finanzas; el CSV sale vacío |
| Perfil | `/organizer/profile` | broken | zod exige `logo_url` (siempre null) y responde 400 |
| Configuración | `/organizer/settings` | partial | Las llaves bancarias difieren del onboarding; el QR Smart no lo lee nadie |
| `/dashboard` del organizer | — | mock | Stats en 0; enlace a `/organizer/home` |

**Público y participante:**

| Pantalla | Estado | Notas |
|---|---|---|
| `/event/:slug` | partial | Inscribirse lleva a destinos rotos; "Manual PDF" no tiene onClick. RLS `USING(true)` deja leer borradores |
| `/event/:id/register` | broken | RC2, RC5 |
| `/my-event-registrations` | broken | Error 500 |
| `/tournaments/:id/results` | works | — |
| `/tournaments/:id/register` | works | Liga interna |
| `EventsMapPage` | dead | Importada en App.tsx sin `<Route>` |

**Duplicación con la escuela:** `/school/tournaments`, `/new` y `/:id` funcionan, y cubren todo lo del organizer.
- `/school/enroll/:eventId` está roto: llama al handler legacy `/events/:id/enroll`, que usa `schools.admin_user_id` (no existe). El handler correcto existe y nadie lo llama.
- `/school/delegations` está roto (500).

Hay tres modelos de propiedad sobre la misma tabla `events`: `creator_id` (useEvents directo), `organizer_id` (BFF organizer) y `school_id` (BFF escuela).

---

## 5. facility_manager (sedes, reservas y control de acceso)

**El rol no existe.**
- Si existiera, caería en `baseNav` (`navigation.ts:276-283`: Dashboard, Notificaciones, Configuración).
- No está en `ProtectedRoute`, ni en `UserRole`, ni en `DashboardPage`, ni en el CHECK de `school_members`.
- Tampoco existe un rol de recepcionista.

Hoy operan estas pantallas los roles school, admin, school_admin y super_admin:

| Pantalla | Ruta | moduleKey | Estado | Uso |
|---|---|---|---|---|
| Instalaciones (pestañas Instalaciones, Reservas, Clases de Prueba) | `/facilities` | sedes_instalaciones | partial | 30 instalaciones / 11 escuelas; 60 reservas, 0 en 30 d |
| Sedes | `/branches` | sedes_sedes | partial | 427 sedes |
| Control de acceso ZKTeco | `/school/access-control` | sedes_control_acceso + addon access_control | **works** | **14.144 eventos**; 4 escuelas |
| Modo Recepción | `/recepcion` | finanzas_recepcion | works | Solo anuncios por voz; **no es check-in** |
| Monitor de recogida | `/pickup` | — | mock | MOCK_STUDENTS, sin menú, sin tablas |
| Reserva pública "de instalación" | `/agendar/:slug` | — | works | **En realidad reserva cortesías** (session_bookings), no alquiler |
| Clase de prueba pública | `/agendar-clase/:slug` | — | works | 2 reservas |
| Prospecto + franja | `/inscripcion/:slug` | — | works | 32 prospectos (28 en 30 d) |
| Logs de acceso globales | `/admin/access-logs` | — | hidden | Solo enlazado desde `/admin` |

**Huecos y problemas:**
- El formulario de instalación no tiene `hourly_rate`, `branch_id` ni `status`. Por eso el precio de alquiler es siempre 0 y las instalaciones nunca se vinculan a una sede.
- Con 0 instalaciones no aparecen las pestañas Reservas ni Clases de Prueba.
- No hay acción "Completar" reserva (`completeReservation` está exportada pero ninguna UI la usa).
- El BFF de acceso no valida el addon.
- En "Bloquear ahora", la promesa no tiene `.catch`.
- `SchoolDetailPage` muestra un precio de 15000 pero guarda 0. Además muestra instalaciones demo que fallan al reservar (sus ids no son uuid).

**Hay tres modelos paralelos de cortesía o clase de prueba:**
- (a) `session_bookings` + `unregistered_athletes` (`/agendar`)
- (b) `trial_class_bookings` (`/agendar-clase`)
- (c) `school_signup_leads` + `school_trial_slots` (`/inscripcion` y el bot de WhatsApp)

Cada uno tiene su propia forma de cancelar, reprogramar y notificar.

**Schema drift:** `facility_availability`, `school_courtesy_settings` y `public_booking_verifications` no tienen `CREATE TABLE` en las migraciones.

---

## 6. admin / super_admin (plataforma)

**Menú admin:** Dashboard, Logs y actividad, Analítica, Escuelas, Integridad, Suscripciones, Usuarios, Reportes, Configuración, Notificaciones, Mensajes, Facturación.
**Menú super_admin:** lo mismo sin Mensajes ni Facturación, más Moderación (Marketplace, Pagos a vendors) y Parámetros de Nómina.

| Pantalla | Ruta | Gate | Estado | Notas |
|---|---|---|---|---|
| Dashboard | `/admin` | strict | partial | 9 botones sin handler; "Actividad hoy" mal etiquetada; "Sistema Online" fijo en el código |
| Logs y actividad | `/admin/activity-logs` | strict | works | 5 pestañas vía RPC (telemetría y analítica están en 0) |
| Analítica | `/admin/analytics` | **no strict (owners entran)** | mock | Tendencia y % fijos; el período no filtra; Exportar no hace nada |
| Escuelas | `/admin/schools` | strict | works | Solo lectura; sin acceso al panel de módulos |
| Integridad de inscripciones | `/admin/enrollment-integrity` | strict | works | 188 hallazgos |
| **Suscripciones + PANEL DE MÓDULOS** | `/admin/subscriptions` | strict | partial | Ver detalle abajo |
| Usuarios | `/admin/users` | no strict | broken | Depende de la escuela en contexto; spinner infinito sin escuela |
| Reportes | `/admin/reports` | no strict | duplicated | Es ReportsPage de escuela |
| Configuración | `/admin/config` | no strict | duplicated | Es SettingsPage personal |
| Parámetros de nómina | `/admin/payroll-config` | `[super_admin]` **no strict** | partial | Owners entran; RLS les niega escribir y la pantalla muestra "guardado" igual |
| Soporte | `/admin/support` | strict super_admin | hidden / partial | Sin cerrar ni asignar tickets |
| Solicitudes de upgrade | `/admin/upgrade-requests` | strict | hidden | Ruta huérfana; 0 solicitudes |
| Clubes | `/admin/clubs` | no strict | dead | Huérfana; duplica `/branches` |
| Logs | `/admin/logs` | no strict | dead | Huérfana; es NotificationsPage |
| Logs de acceso | `/admin/access-logs` | strict | hidden | — |
| Moderación / Payouts | ver §3 | strict | works / partial | — |
| Facturación | `/mi-plan` | — | dead para admin | — |

**Panel de módulos por escuela** (`pages/AdminSubscriptionsPage.tsx`). Está aquí, **no** en `/admin/schools`.

- **Lista de escuelas:** máximo 25; el resto solo aparece buscando.
- **Plan:** `admin_set_school_plan` siempre manda `p_status:'active'`, así que **cambiar el plan termina el trial sin avisar**.
- **Prueba:** 1/2/3/6/12 meses, fecha exacta, +1 mes, expirar ya, no bloquear, tipo de cuenta. Funciona.
- **Tipo de escuela y cobros a familias:** funciona.
- **Facturación SportMaps:**
  - Activar funciona.
  - Enviar y Marcar pagada son **solo super_admin** en el BFF, así que el rol admin recibe 403.
- **Precio negociado:** Guardar funciona. **"Quitar override" está roto**: lee el borrador viejo y vuelve a guardar el precio anterior (:1110).
- **Add-ons:** 12 switches y precio mensual. Funciona.
- **Módulos del menú (tri-estado):**
  - Escribe en `school_module_overrides` con `admin_set_school_module` (exige `is_super_admin()`).
  - **Falta el grupo "Comunicación" en `MODULE_GROUPS`** (`config/module-catalog.ts:188-195`). Por eso `comunicacion_whatsapp`, `documentos_recordatorios` y `documentos_plantillas_mensajes` no se pueden apagar desde el panel, aunque aparecen en "Valor efectivo".
  - En la base hay 17 overrides, todos OFF.
- **Catálogos piloto** (artículos, banco de horas, cobros de torneo): funciona.
- **Bloqueo por fin de prueba:** lo decide el servidor (`school_is_operational()`, RLS y el middleware del BFF). En el frontend es solo un banner (`TrialStatusBanner`).

**Dos fuentes de verdad para "admin de plataforma":** `profiles.role` (lo usan `is_super_admin()` y `requireRole`) y la tabla `platform_admins` (marketplace, payouts, WhatsApp de plataforma). El router de marketplace-admin está montado en `/api/v1/admin` con un gate `platform_admins` sin alcance. Probablemente intercepta `/admin/access-logs` y `/admin/support`; es una inferencia del código, no se probó.

**Gates no estrictos que dejan entrar a owners de escuela:** admin/users, clubs, reports, analytics, config, logs y payroll-config.

---

## 7. Auth, onboarding y páginas públicas

**Auth:**

| Pantalla | Estado | Notas |
|---|---|---|
| `/login` | works | Mínimo 6 caracteres (registro pide 8); Google OAuth |
| `/register` | partial | 7 roles con tarjeta; organizer solo por `?role=`; lee `roles` sin usarla; el trigger confía en el rol (§0) |
| `/reset-password` | works | Cualquier sesión activa cuenta como enlace válido |
| `/onboarding/role` | partial | 8 roles; la rama organizer termina en 404 |
| `/unauthorized` | works | — |
| IdleTimer | works | 10 o 30 min |

Caso borde de Google: el camino `onAuthStateChange` pone athlete por defecto y se salta la elección de rol (`AuthContext.tsx:278`).

**Onboarding:**

| Pantalla | Estado | Notas |
|---|---|---|
| `/setup/school` → `/onboarding/school` | works | Van en secuencia, no son duplicados. school_admin o admin sin escuela rebotan |
| `/onboarding/athlete`, `/parent`, `/coach`, `/wellness` | works | — |
| `/trainer/onboarding` | works | Sin guard de rol; el BFF da 403 a otros roles |
| `/vendor/onboarding` | partial | No revisa `res.ok` |
| `/organizer/onboarding` | broken | — |
| `/join-team/:id` | partial | Con confirmación de email el reclamo del hijo se pierde |
| `/join-plan/:id` | partial | Mismo caso de confirmación |
| `/join/:slug` (QR) | works | — |
| `/inscripcion/:slug` | works | — |

**Públicas:**

| Ruta | Estado | Notas |
|---|---|---|
| `/` Landing | partial | FAQ y redes con `href="#"`; enlaces a `/shop` y `/wellness` protegidos |
| `/explorar` | hidden | `SHOW_EXPLORE = import.meta.env.DEV`: oculto en todo despliegue. "Inscribirse a evento" va a `/events/:id/register` (404). El redirect de login usa `?redirect=`, pero LoginPage lee `redirectTo` |
| `/schools/:id` | partial | Canónica. Programas, instalaciones y reseñas demo; Compartir y Favorito sin acción |
| `/escuela/:id` | dead | Duplicado huérfano |
| `/s/:slug` | broken | Todos los CTA muestran el toast "Acción Demo". Es la URL que anuncia `PublishedSuccessModal` |
| `/ayuda`, `/ayuda/:slug` | hidden | Contenido estático; solo lo enlaza el SportBot |
| `/c/:qrToken` | works | — |
| `/p/:token` | works | — |
| `/cert/:folio` | works | — |
| `/polls/v/:id` | works | — |
| `/entrenador/:id` | works | — |
| `/payment-result` | works | — |
| `/pagos/confirmacion` | dead | Sin referencias entrantes; duplica `/payment-result` |
| `/parent-checkout` | partial | Monto sale del querystring; por defecto 150000 "Mensualidad Octubre 2024" |
| Legales (`/terminos-y-condiciones`, `/politica-de-privacidad`, `/eliminar-cuenta`) | works | `/eliminar-cuenta` es solo un mailto |
| `*` 404 | works | Texto en inglés |

---

## 8. SportBot / soporte in-app

- **Botón flotante** (`components/support/SupportChatButton.tsx`). Solo está en `AuthLayout`: no aparece en páginas públicas, onboarding, `/recepcion` ni `/login`.
- **BFF:** `bff/src/routes/support.routes.ts` + `services/inapp-support-bot.service.ts`.
  - Usa `support_open_ticket` y `support_post_message`.
  - El bot responde de forma síncrona con hasta 3 llamadas LLM (Groq por defecto).
  - Herramientas: `get_my_state`, `get_payment_status`, `search_help_articles`, `escalate_to_human`.
  - Kill switch: `whatsapp_settings.ai_enabled`, que falla abierto (si falta la fila, el bot queda encendido).
  - El bot se calla cuando un agente humano ya escribió en el hilo.
- **Uso real:** 8 tickets (5 bot_handled, 3 waiting_user) y 57 mensajes (27 de usuario, 25 del bot, 5 de agente), activos hasta el 10-06. En `llm_usage` no aparece ninguna fila con feature `sportbot`; las 41 de `bot` son de WhatsApp. Es probable que el registro de consumo del SportBot no se esté guardando: vale la pena revisarlo.
- **Huecos:**
  - Sin polling: la respuesta del agente humano solo aparece al reabrir el chat.
  - La bandeja `/admin/support` no puede cerrar ni asignar tickets.
  - Si el ticket no tiene `school_id`, `get_payment_status` devuelve `[]` y el bot puede decir que no hay deuda.
- El rediseño del bot por rol está **commiteado** (`ae1f1d98`, 10-07). Siguen sin commitear `bff/src/services/llm.service.ts` (tool_choice 'none', caché de 1 h) y ajustes menores de UI.

---

## 9. Conteos, duplicados, roto/muerto

### Totales del JSON
- **117 pantallas, 228 acciones.**
- **Por estado de pantalla:** works 52 · partial 21 · broken 14 · duplicated 12 · hidden 8 · dead 7 · mock 3.
- **Por estado de acción:** works 136 · partial 34 · broken 30 · dead 13 · mock 7 · duplicated 6 · hidden 2.

### Duplicados
1. Inicio del profesional: `/dashboard` vs `/vendor/dashboard`.
2. Onboarding del profesional: `/onboarding/wellness` vs `/vendor/onboarding`.
3. Página de productos servida en 4 rutas: `/vendor/products`, `/products`, `/categories`, `/promotions`.
4. Inventario en `/inventory` y `/suppliers`; pedidos en `/orders` y `/customers`.
5. Reportes de escuela reutilizados en `/store-reports` y `/admin/reports`.
6. Vitrinas: `/tienda/:slug` (canónica) vs `/marketplace*` vs `/shop`.
7. Módulo organizer completo vs torneos de escuela (y tres modelos de propiedad sobre `events`).
8. Perfil público de escuela ×3: `/schools/:id`, `/escuela/:id`, `/s/:slug`.
9. Resultado de pago: `/payment-result` vs `/pagos/confirmacion`.
10. Tres modelos de cortesía o clase de prueba (§5).
11. Sedes vs Instalaciones vs Clubes (`/admin/clubs`).
12. `/admin/config` = SettingsPage; `/admin/logs` = NotificationsPage.
13. Backend duplicado sin uso: BFF `/vendor/availability`, `/vendor/profile`, `marketplace-orders /vendor/*`, `/admin/vendors/verification-queue`.

### Rotos (fallan siempre)
- **Organizer:** onboarding, crear evento, mis eventos, calendario, finanzas, reportes, perfil y la mitad de la gestión del evento.
- **Eventos:** inscripción individual, mis inscripciones a eventos.
- **Torneos de escuela:** `/school/enroll/:id` y `/school/delegations`.
- **Tienda:** `/store-reports`, carrito desde `/marketplace` y `/shop`, `/vendor/subscribers` (410), "Auto-generar payouts" (410).
- **Admin:** `/admin/users` para el admin de plataforma; "Quitar override" de precio.
- **Públicas:** `/s/:slug` (CTA de demo); "Inscribirse" en Explorar.
- **Perfil vendor:** "Despublicar" bloquea al dueño fuera de `/vendor/*`.

### Muertos, huérfanos o mock
- **Rutas sin menú ni enlace:** `/admin/clubs`, `/admin/upgrade-requests`, `/admin/logs`, `/nutrition`, `/pickup`, `/escuela/:id`, `/pagos/confirmacion`, `/marketplace`.
- **Ocultas tras otra pantalla:** `/admin/support` y `/admin/access-logs` (solo desde `/admin`); `/vendor/inbox`, `/vendor/payouts`, `/vendor/shipping` (sin menú para store_owner).
- **Importadas en App.tsx sin `<Route>`:** EventsMapPage, ChildProgressPage, ChildAttendancePage.
- **Páginas huérfanas en `pages/`:** AdvancedSearchPage, AnalyticsDashboardPage, AthletesListPage, CalendarAdvancedPage, FacilitiesPage, MessagesDetailPage, ProductDetailPage, StorePage, StudentsPage, UnderConstructionPage.
- **Componentes y config muertos:** `config/routePermissions.ts` (nadie lo importa; lista rutas inexistentes), `components/footer/SportMapsFooter.tsx`, `components/Hero.tsx`, `components/store/ProductFormDialog.tsx`, `hooks/useStoreData.ts`, `hooks/usePaymentCheckout.ts`, `components/checkout/ShippingSelector.tsx`.
- **Enlaces a rutas inexistentes:** `/organizer/home`, `/events/:id/register`, `/vendor/:slug`, `/help`, `/blog`, `/partners`.
- **Mock:** NutritionPage, PickupMonitorPage, VendorPromotionsPage, AdminAnalyticsPage, el `/dashboard` del organizer y los datos demo de SchoolDetailPage.

### Entradas de menú sin destino útil
- `/mi-plan` ("Facturación") para wellness_professional, store_owner, organizer y admin: la página los rechaza.
- `/store-reports`, `/categories`, `/promotions`, `/suppliers` y `/customers` para store_owner: son alias (§3).

### Roles en la base sin pantallas
- **facility_manager:** ni siquiera existe en la base; solo en los docs.
- **external_vendor:** en el enum, 3 perfiles, sin menú propio (cae en `baseNav`).
- **accountant:** 0 perfiles; menú propio, solo lectura de contabilidad (fuera de este mapa).

### Más y menos usado (de este alcance)
- **Más:** control de acceso (3.438 eventos en 30 d), prospectos y franjas de cortesía (28 prospectos en 30 d), SportBot (36 mensajes en 30 d), panel de suscripciones y módulos (última escritura 10-09), carnets (513).
- **Cero o casi cero:** clínico (0), organizer (0 organizadores), tienda externa (0 configuraciones de cobro), liquidaciones (0), reseñas y preguntas (0), solicitudes de upgrade (0), reservas de instalación en 30 d (0), telemetría (0).
