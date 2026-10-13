# Mapa funcional — roles de escuela (owner/school y school_admin)

> Generado el 2026-10-10 desde el código de `develop`/`main` local (fuente de verdad) con un extractor estático (TypeScript compiler API) que recorre cada pantalla → componentes que renderiza → pestañas (`TabsTrigger`/`TabsContent`) → acciones (Button, DropdownMenuItem, Switch, Select/Input de búsqueda, títulos de Dialog/Sheet/AlertDialog, Link). Lecturas/escrituras se resuelven siguiendo el handler (`onClick`, `onSubmit` del form, props `on*` del padre, hooks y `lib/api`). Uso medido en la base viva con SELECT de solo lectura (ventana 90 días).

**Machine-readable:** `docs/mapa-app/escuela.json` (misma data, forma `[{role, module, moduleKey, screen, route, file, tabs:[{name, actions:[{label, type, file, line, gates, reads, writes, status, usage}]}]}]` + campos extra: `roles`, `menu`, `entryPoints`, `gates`, `orphan`, `status`, `usage`, `notes`, `reads`, `writes`, `componentFiles`, y por acción `navigates`, `opens`, `sharedComponent`, `via`).

## Cómo leer

- **role**: `school+school_admin` cuando ambos árboles de menú lo muestran. Owner (`currentUserRole = owner`) usa el árbol `school`. Los dos árboles son idénticos salvo que `school_admin` NO tiene «Mi Perfil Público».
- **gates**: condiciones JSX que envuelven la acción (`cond && <X/>`, ternarios) + `disabled`. A nivel pantalla: `ProtectedRoute allowedRoles`, `ModuleGate moduleKey` (override del Super Admin, `school_module_overrides`, y addon si el módulo lo exige), gates extra de menú (addon, `billing_enabled`, multideporte, `store_enabled()`), flags en código.
- **OJO con allowedRoles**: `ProtectedRoute` deja pasar SIEMPRE a `currentUserRole ∈ {owner, admin, super_admin, school_admin}` salvo rutas con `strictRoleCheck` (solo 10 rutas /admin/*). O sea: para owner y school_admin, `allowedRoles` no restringe casi nada; el gate real es el menú + `ModuleGate` + la base (RLS/BFF).
- **type**: `button`, `menu_item`, `toggle`, `filter` (Select/búsqueda), `dialog` (título de modal/sheet), `link`, `export`, `bulk`/`bulk_select`, `ui_control` (control sin texto ni efecto de datos: chips, días, paginación de iconos). En el .md se omiten los `ui_control`; están en el JSON.
- **W / R**: escrituras / lecturas: `tabla.op`, `rpc:nombre`, `METHOD /api/v1/...` (BFF), `storage:bucket.op`, `edge:función`.
- **status**: `works` (camino activo por defecto) · `partial` · `broken` · `hidden` (detrás de flag/addon/condición que casi nadie tiene) · `dead route` (ruta sin menú) · `dead code`.
- **usage**: `usado` / `sin uso` / `no medido` con conteos `s90` (escuelas con filas en 90 días) · `r90` (filas en 90 días) · `tot` (histórico). Base compartida para todos los ambientes: incluye escuelas de prueba. 371 escuelas, 67 con miembros activos, 25 con pagos en 90 días.
- Componentes compartidos (mismo archivo en 2+ pantallas) se detallan la primera vez y luego se referencian.

## Resumen

| Métrica | Valor |
|---|---|
| Módulos (grupos de menú + shell + tienda + huérfanas) | 11 |
| Pantallas (rutas) | 69 |
| Pestañas declaradas (TabsTrigger) | 93 |
| Acciones (todas, contando componentes compartidos en cada pantalla) | 2129 |
| Acciones únicas (archivo:línea) | 1737 |
| Acciones con significado (sin ui_control) | 1983 |
| Acciones que escriben datos | 277 |
| Archivos de componente compartidos entre pantallas | 53 |

Por tipo: button 1274 · filter 249 · dialog 172 · ui_control 146 · toggle 109 · link 66 · menu_item 52 · export 41 · bulk_select 13 · bulk 7

## Índice

- **Shell (encabezado y barra)**
  - [Encabezado global (campana, avatar, soporte, banners)](#-todas-las-rutas-autenticadas-) — `(todas las rutas autenticadas)` · works · usado · 19 acciones
- **Principal**
  - [Dashboard](#-dashboard) — `/dashboard` · works · no medido · 52 acciones
  - [Deportistas](#-students) — `/students` · works · usado · 184 acciones
  - [Matrículas por revisar](#-school-enrollment-intake) — `/school/enrollment-intake` · works · usado · 5 acciones
  - [Entrenadores](#-staff) — `/staff` · works · usado · 25 acciones
  - [Invitaciones](#-invitations) — `/invitations` · works · usado · 26 acciones
- **Gestión Deportiva**
  - [Seguimiento deportivo](#-seguimiento-deportivo) — `/seguimiento-deportivo` · works · usado · 65 acciones
  - [Mis Equipos](#-teams) — `/teams` · works · usado · 132 acciones
  - [Deportes y Categorías](#-school-sports) — `/school-sports` · hidden · usado · 1 acciones
  - [Membresías](#-memberships) — `/memberships` · hidden · sin uso · 10 acciones
  - [Mis Planes (ofertas)](#-offerings) — `/offerings` · works · usado · 59 acciones
  - [Calendario](#-calendar) — `/calendar` · works · usado · 12 acciones
  - [Métricas y Rendimiento (sesiones)](#-training-plans) — `/training-plans` · works · usado · 181 acciones
  - [Gestión de Rutinas](#-school-routines) — `/school/routines` · works · usado · 41 acciones
  - [Detalle de rutina](#-school-routines-routineid) — `/school/routines/:routineId` · works · usado · 40 acciones
  - [Informe Mensual](#-informe-mensual) — `/informe-mensual` · works · usado · 15 acciones
  - [Supervisión de asistencias](#-attendance-supervision) — `/attendance-supervision` · works · usado · 19 acciones
  - [Histórico de asistencias](#-attendance-history) — `/attendance-history` · works · usado · 15 acciones
  - [Encuestas](#-dashboard-polls) — `/dashboard/polls` · works · sin uso · 11 acciones
  - [Resultados de encuesta](#-dashboard-polls-pollid-results) — `/dashboard/polls/:pollId/results` · works · sin uso · 9 acciones
  - [Resultados](#-results-overview) — `/results-overview` · broken · no medido · 0 acciones
  - [Mis Torneos](#-school-tournaments) — `/school/tournaments` · partial · usado · 2 acciones
  - [Crear torneo](#-school-tournaments-new) — `/school/tournaments/new` · partial · usado · 5 acciones
  - [Detalle de torneo](#-school-tournaments-id) — `/school/tournaments/:id` · partial · usado · 20 acciones
  - [Dotación](#-school-equipment) — `/school/equipment` · works · usado · 48 acciones
  - [Disponibilidad médica](#-disponibilidad-medica) — `/disponibilidad-medica` · works · sin uso · 1 acciones
- **Finanzas**
  - [Pagos (cartera y cobros)](#-payments-automation) — `/payments-automation` · works · usado · 212 acciones
  - [Modo Recepción (kiosko)](#-recepcion) — `/recepcion` · works · no medido · 5 acciones
  - [Contabilidad (libro de caja)](#-accounting) — `/accounting` · works · usado · 68 acciones
  - [Proveedores](#-accounting-suppliers) — `/accounting/suppliers` · works · usado · 26 acciones
  - [Nómina](#-accounting-payroll) — `/accounting/payroll` · works · usado · 16 acciones
  - [Estado de resultados](#-accounting-reports) — `/accounting/reports` · works · no medido · 2 acciones
  - [Presupuesto](#-accounting-budget) — `/accounting/budget` · works · usado · 2 acciones
  - [Facturación electrónica (standalone)](#-facturacion-electronica) — `/facturacion-electronica` · works · usado · 51 acciones
- **Reportes**
  - [Finanzas (reporte)](#-finances) — `/finances` · works · no medido · 20 acciones
  - [Reportes](#-school-reports) — `/school-reports` · works · no medido · 18 acciones
  - [Panel de Reportes (cartera por estado)](#-reporter-dashboard) — `/reporter-dashboard` · works · no medido · 22 acciones
- **Documentos e Identidad**
  - [Carnets Digitales (+ Plantillas ?tab=templates)](#-cards) — `/cards` · works · usado · 41 acciones
  - [Constancias](#-certificates) — `/certificates` · works · sin uso · 8 acciones
  - [Plantillas de constancias](#-cards-templates-certificates) — `/cards/templates/certificates` · works · sin uso · 9 acciones
  - [QR de Inscripción](#-qr-signup) — `/qr-signup` · works · usado · 20 acciones
- **Comunicación**
  - [WhatsApp](#-whatsapp) — `/whatsapp` · works · usado · 77 acciones
  - [Recordatorios de pago](#-payment-reminders) — `/payment-reminders` · works · usado · 13 acciones
  - [Plantillas de Mensajes](#-message-templates) — `/message-templates` · works · usado · 9 acciones
- **Sedes e Instalaciones**
  - [Sedes](#-branches) — `/branches` · works · usado · 8 acciones
  - [Instalaciones (reservas)](#-facilities) — `/facilities` · works · usado · 96 acciones
  - [Control de Acceso](#-school-access-control) — `/school/access-control` · works · usado · 24 acciones
- **Cuenta**
  - [Mi Perfil Público](#-school-public-profile) — `/school/public-profile` · works · no medido · 22 acciones
  - [Facturación (plan SaaS)](#-mi-plan) — `/mi-plan` · works · usado · 9 acciones
  - [Recibo de factura SaaS](#-facturacion-recibo-invoiceid) — `/facturacion/recibo/:invoiceId` · works · usado · 1 acciones
  - [Configuración](#-settings) — `/settings` · works · no medido · 39 acciones
  - [Notificaciones](#-notifications) — `/notifications` · works · usado · 6 acciones
  - [Perfil personal](#-profile) — `/profile` · works · no medido · 4 acciones
  - [Mensajes (chat)](#-messages) — `/messages` · broken · sin uso · 2 acciones
- **Tu tienda**
  - [Ajustes de la tienda (activar / cobros y entrega)](#-tienda-escuela-ajustes) — `/tienda-escuela/ajustes` · hidden · usado · 27 acciones
  - [Pedidos](#-orders) — `/orders` · hidden · usado · 12 acciones
  - [Productos](#-vendor-products) — `/vendor/products` · hidden · usado · 16 acciones
  - [Asistente de producto (crear/editar)](#-vendor-products-new-vendor-products-id-edit) — `/vendor/products/new \| /vendor/products/:id/edit` · hidden · usado · 15 acciones
  - [Inventario](#-inventory) — `/inventory` · hidden · usado · 17 acciones
- **Sin menú (rutas huérfanas)**
  - [Gestión de programas](#-programs-management) — `/programs-management` · dead route · no medido · 17 acciones
  - [Configuración de escuela (vieja)](#-school-config) — `/school-config` · dead route · no medido · 12 acciones
  - [Monitor de salida segura](#-pickup) — `/pickup` · dead code · no medido · 4 acciones
  - [Delegaciones](#-school-delegations) — `/school/delegations` · dead route · usado · 5 acciones
  - [Detalle de delegación](#-school-delegations-id) — `/school/delegations/:id` · dead route · usado · 4 acciones
  - [Inscribir delegación a evento](#-school-enroll-eventid) — `/school/enroll/:eventId` · dead route · usado · 5 acciones
  - [Estado de cuenta](#-estado-cuenta) — `/estado-cuenta` · works · no medido · 1 acciones
  - [Admin: usuarios (rol school permitido)](#-admin-users) — `/admin/users` · dead route · no medido · 13 acciones
  - [Admin: clubes (rol school permitido)](#-admin-clubs) — `/admin/clubs` · dead route · no medido · 5 acciones
  - [Admin: analítica (rol school permitido)](#-admin-analytics) — `/admin/analytics` · dead route · no medido · 3 acciones

## Shell (encabezado y barra)

<a id="-todas-las-rutas-autenticadas-"></a>
### Encabezado global (campana, avatar, soporte, banners) — `(todas las rutas autenticadas)`

- **Rol:** school+school_admin · **Menú:** (siempre visible)
- **Archivo:** `frontend/src/layouts/AuthLayout.tsx` (+8 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** usado — notifications s90=20 r90=5405 tot=5693; support_tickets s90=7 r90=8 tot=8
- **Escribe:** POST /api/v1/support/messages, POST /api/v1/support/open, notifications.update, push_subscriptions.upsert
- **Lee:** GET /api/v1/support/thread, GET /api/v1/vendor/products/insights, children.select, clinical_episodes.select, clinical_patients.select, enrollments.select, notifications.select, payments.select, products.select, push_subscriptions.select, rpc:get_athlete_dashboard_stats, rpc:get_school_dashboard_stats, school_staff.select, team_coaches.select, teams.select, wellness_appointments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **9+** — `components/GlobalNotificationBell.tsx:50`
- [button] **Marcar todas** — `components/GlobalNotificationBell.tsx:77` · gates: `unreadCount > 0` · W: notifications.update
- [button] **Ver todas las notificaciones** — `components/GlobalNotificationBell.tsx:139` · gates: `notifications.length > 0` · → /notifications
- [button] **Cambiar tema** — `components/ThemeToggle.tsx:17`
- [menu_item] **Claro** — `components/ThemeToggle.tsx:24`
- [menu_item] **Oscuro** — `components/ThemeToggle.tsx:31`
- [menu_item] **Sistema** — `components/ThemeToggle.tsx:38`
- [button] **Hablar con el equipo** — `components/entitlements/TrialStatusBanner.tsx:171` · gates: `contenido.conAcciones`
- [link] **Hablar con el equipo → {enlaceWa}** — `components/entitlements/TrialStatusBanner.tsx:172` · gates: `contenido.conAcciones`
- [button] **Ver mi plan** — `components/entitlements/TrialStatusBanner.tsx:180` · gates: `contenido.conAcciones`
- [link] **Ver mi plan → /mi-plan** — `components/entitlements/TrialStatusBanner.tsx:181` · gates: `contenido.conAcciones`
- [button] **Ocultar aviso** — `components/entitlements/TrialStatusBanner.tsx:188` · gates: `contenido.descartable`
- [button] **Activando… / Activar** — `components/PushPermissionBanner.tsx:97` · gates: `disabled: {status === 'loading'}` · W: POST /api/v1/devices/register, push_subscriptions.upsert
- [button] **Ahora no** — `components/PushPermissionBanner.tsx:106`
- [button] **Cerrar** — `components/PushPermissionBanner.tsx:118`
- [button] **Abrir chat de soporte** — `components/support/SupportChatButton.tsx:14` · abre: setIsOpen
- [link] **Ver el paso a paso completo → → {part}** — `components/support/SupportChatModal.tsx:36`
- [dialog] **Soporte SportMaps Un solo chat, siempre la misma conversación** — `components/support/SupportChatModal.tsx:174`
- [button] **(send)** — `components/support/SupportChatModal.tsx:250` · gates: `disabled: {!input.trim() \|\| sending}` · W: POST /api/v1/support/open, POST /api/v1/support/messages

## Principal

<a id="-dashboard"></a>
### Dashboard — `/dashboard`

- **Rol:** school+school_admin · **Menú:** Principal > Dashboard
- **Archivo:** `frontend/src/pages/DashboardPage.tsx` (+20 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** no medido
- ⚠ Acciones rápidas configurables (quickActionsCatalog.ts): la acción por defecto «Ver Equipos» apunta a /programs-management (ruta huérfana), no a /teams.
- **Escribe:** POST /api/v1/enrollments, POST /api/v1/events/school-tournaments/:p/categories/:p/assign-teams, POST /api/v1/events/school-tournaments/:p/register, POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, POST /api/v1/vendor/shipments/:p/cancel, POST /api/v1/vendor/shipments/:p/label, POST /api/v1/vendor/shipments/:p/pickup, PUT /api/v1/vendor/shipping/settings, children.delete, children.insert, children.update, coach_certifications.delete, coach_certifications.insert, coach_profiles.upsert, edge:send-email, enrollments.insert, enrollments.update, invitations.update, offering_plans.insert, offering_plans.update, offerings.insert, offerings.update, rpc:store_enabled, school_branches.update, school_members.update, school_settings.upsert, school_staff.insert, schools.update, teams.delete, teams.insert, teams.update, unregistered_athletes.update, wellness_appointments.insert
- **Lee:** GET /api/v1/attendance/rate/:p, GET /api/v1/events/my-open-tournaments, GET /api/v1/events/school-tournaments/:p/for-participant, GET /api/v1/events/school-tournaments/:p/individual-registrations, GET /api/v1/events/school-tournaments/:p/public-results:p` : ''}, GET /api/v1/shipping/carriers, GET /api/v1/shipping/tracking/:p, GET /api/v1/vendor/products/insights, GET /api/v1/vendor/shipping/settings, POST /api/v1/shipping/quote, attendance_records.select, calendar_events.select, children.select, clinical_episodes.select, clinical_patients.select, coach_certifications.select, coach_profiles.select, enrollments.select, invitations.select, notifications.select, offering_plans.select, offerings.select, payments.select, products.select, rpc:finance_income_summary, rpc:get_athlete_dashboard_stats, rpc:get_school_dashboard_stats, rpc:get_school_payment_info, school_athletes.select, school_branches.select, school_settings.select, school_staff.select, schools.select, team_coaches.select, teams.select, vendor_profiles.select, wellness_appointments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **(handleActivate)** — `components/vendor/ActivateStoreCTA.tsx:95` · gates: `disabled: {activating}` · → /vendor/onboarding
- [button] **Cerrar** — `components/vendor/ActivateStoreCTA.tsx:107` · W: profiles.update · R: profiles.select
- [button] **Cerrar** — `components/vendor/ActivateStoreCTA.tsx:120` · W: profiles.update · R: profiles.select
- [button] **(handleActivate)** — `components/vendor/ActivateStoreCTA.tsx:144` · gates: `disabled: {activating}` · → /vendor/onboarding
- [button] **Inscribirme** — `components/dashboard/OpenTournamentsCard.tsx:50` · → /tournaments/${t.id}/register
- [button] **Aceptar Invitación** — `components/dashboard/InvitationBanner.tsx:113` · gates: `invitation && !['school', 'school_admin', 'admin', 'super_admin', 'owner'].incl… && disabled: {isAccepting \|\| !invitation?.id}` · R: invitations.select
- [button] **Rechazar invitación** — `components/dashboard/InvitationBanner.tsx:125` · gates: `invitation && !['school', 'school_admin', 'admin', 'super_admin', 'owner'].incl… && disabled: {isRejecting}` · W: invitations.update · R: invitations.select
- [button] **Confirmar Sede** — `components/onboarding/SchoolOnboardingWizard.tsx:774` · gates: `disabled: {saving}` · W: school_branches.update · R: invitations.select
- [button] **(() => handleChooseModel(m.key))** — `components/onboarding/SchoolOnboardingWizard.tsx:797` · gates: `disabled: {saving}` · W: schools.update · R: invitations.select
- [filter] **Selector: Seleccionar** — `components/onboarding/SchoolOnboardingWizard.tsx:837`
- [button] **Crear Equipo** — `components/onboarding/SchoolOnboardingWizard.tsx:858` · gates: `disabled: {saving}` · W: teams.update, teams.insert · R: school_branches.select, invitations.select
- [filter] **Selector: {planBilling}** — `components/onboarding/SchoolOnboardingWizard.tsx:891`
- [button] **Crear Plan** — `components/onboarding/SchoolOnboardingWizard.tsx:910` · gates: `disabled: {saving}` · W: offerings.update, offerings.insert, offering_plans.update, offering_plans.insert · R: invitations.select
- [button] **Invitar Entrenador** — `components/onboarding/SchoolOnboardingWizard.tsx:942` · gates: `disabled: {saving}` · W: school_staff.insert, edge:send-email · R: invitations.select
- [button] **Registrar Atleta** — `components/onboarding/SchoolOnboardingWizard.tsx:993` · gates: `disabled: {saving}` · W: children.insert, edge:send-email · R: teams.select, invitations.select
- [filter] **Selector: {accountType}** — `components/onboarding/SchoolOnboardingWizard.tsx:1049`
- [button] **Guardar y Finalizar** — `components/onboarding/SchoolOnboardingWizard.tsx:1067` · gates: `disabled: {saving}` · W: school_settings.upsert, schools.update · R: invitations.select
- [button] **Siguiente** — `components/onboarding/SchoolOnboardingWizard.tsx:1094` · gates: `disabled: {currentStep >= STEPS.length - 1}`
- [button] **Anterior** — `components/onboarding/SchoolOnboardingWizard.tsx:1110` · gates: `disabled: {currentStep === 0}`
- [button] **Saltar** — `components/onboarding/SchoolOnboardingWizard.tsx:1115` · gates: `currentStepDef && !currentStepDef.required && !isCurrentDone`
- [button] **Terminar después** — `components/onboarding/SchoolOnboardingWizard.tsx:1120` · gates: `allRequiredDone` · W: schools.update · R: invitations.select
- [button] **Siguiente** — `components/onboarding/SchoolOnboardingWizard.tsx:1125` · gates: `!isLastStep && disabled: {!canAdvance}`
- [button] **(() => onStepClick(step))** — `components/dashboard/DashboardChecklist.tsx:68` · gates: `onboardingSteps.length > 0 && !onboardingSteps.every(s => s.completed) && onboa…` · → step.href
- [button] **(() => onStepClick(step))** — `components/dashboard/DashboardChecklist.tsx:93` · gates: `onboardingSteps.length > 0 && !onboardingSteps.every(s => s.completed) && onboa…` · → step.href
- [link] ** → {href}** — `components/dashboard/StatCard.tsx:42`
- [link] ** → {href}** — `components/dashboard/StatCard.tsx:91`
- [button] **Personalizar accesos rápidos** — `components/dashboard/QuickActions.tsx:23` · gates: `config.quickActions && config.quickActions.length > 0 && onEdit`
- [link] ** → {action.href}** — `components/dashboard/QuickActions.tsx:44` · gates: `config.quickActions && config.quickActions.length > 0`
- [dialog] **Personalizar Acciones Rápidas** — `components/dashboard/QuickActionsEditDialog.tsx:50` · gates: `config.quickActions && config.quickActions.length > 0 && isSchoolDashboard`
- [button] **Cancelar** — `components/dashboard/QuickActionsEditDialog.tsx:75` · gates: `config.quickActions && config.quickActions.length > 0 && isSchoolDashboard`
- [button] **Guardar** — `components/dashboard/QuickActionsEditDialog.tsx:76` · gates: `config.quickActions && config.quickActions.length > 0 && isSchoolDashboard && disabled: {saving \|\| selected.length === 0}`
- [button] **Ver** — `components/dashboard/ActivityList.tsx:60` · gates: `config.activities && config.activities.length > 0 && showDetails`
- [button] **(onClick)** — `components/vendor/SchoolStoreActivationCard.tsx:102` · gates: `disabled: {activating}` · R: GET /api/v1/me/entitlements · → STORE_ADDON_UPSELL_PATH, SCHOOL_STORE_SETTINGS_PATH
- [button] **Cerrar** — `components/vendor/SchoolStoreActivationCard.tsx:107` · gates: `onDismiss` · W: profiles.update · R: profiles.select
- [button] **Cerrar** — `components/vendor/SchoolStoreActivationCard.tsx:118` · gates: `onDismiss` · W: profiles.update · R: profiles.select
- [button] **(onClick)** — `components/vendor/SchoolStoreActivationCard.tsx:131` · gates: `disabled: {activating}` · R: GET /api/v1/me/entitlements · → STORE_ADDON_UPSELL_PATH, SCHOOL_STORE_SETTINGS_PATH
- [dialog] **¿Quién se inscribe?** — `components/enrollment/ChildSelectorModal.tsx:267`
- [filter] **Selector: {selectedChildId \|\| ''}** — `components/enrollment/ChildSelectorModal.tsx:302` · gates: `!(isLoading \|\| isLoadingInvitations) && children.length > 0 && !showNewChildForm` · abre: setSelectedChildId
- [button] **Cancelar** — `components/enrollment/ChildSelectorModal.tsx:390` · gates: `!(isLoading \|\| isLoadingInvitations) && showNewChildForm && (children.length > 0 \|\| pendingInvitations.length > 0) && disabled: {createChildMutation.isPending}`
- [button] **Guardando...** — `components/enrollment/ChildSelectorModal.tsx:400` · gates: `!(isLoading \|\| isLoadingInvitations) && showNewChildForm && disabled: {createChildMutation.isPending \|\| !!nombreTomado}` · W: children.insert
- [button] **Agregar otro hijo/a** — `components/enrollment/ChildSelectorModal.tsx:421` · gates: `!(isLoading \|\| isLoadingInvitations) && !showNewChildForm && (children.length > 0 \|\| pendingInvitations.length > 0)`
- [button] **Continuar inscripción** — `components/enrollment/ChildSelectorModal.tsx:435` · gates: `disabled: {!selectedChildId \|\| showNewChildForm \|\| isLoading \|\| isLoa…`
- [dialog] **¡Comprobante Enviado! / ¡Pago Exitoso!** — `components/payment/PaymentModal.tsx:223`
- [button] **Comprobante** — `components/payment/PaymentModal.tsx:248` · gates: `!isManual` · R: GET /api/v1/me/entitlements
- [button] **Continuar** — `components/payment/PaymentModal.tsx:253` · W: enrollments.insert · → /calendar
- [dialog] **Realizar Pago** — `components/payment/PaymentModal.tsx:271` · gates: `!(step === 'success')`
- [filter] **Selector: {paymentMethod}** — `components/payment/PaymentModal.tsx:304` · gates: `!(step === 'success')`
- [button] **Ocultar / Mostrar** — `components/payment/PaymentModal.tsx:376` · gates: `!(step === 'success') && paymentMethod === 'manual'`
- [button] **Cambiar archivo** — `components/payment/PaymentModal.tsx:447` · gates: `!(step === 'success') && paymentMethod === 'manual' && proofUploaded`
- [button] **Seleccionar Archivo** — `components/payment/PaymentModal.tsx:455` · gates: `!(step === 'success') && paymentMethod === 'manual' && !(proofUploaded)`
- [button] **Procesando...** — `components/payment/PaymentModal.tsx:464` · gates: `!(step === 'success') && disabled: {processing \|\| (paymentMethod === 'manual' && !proofUploade…` · W: rpc:notify_user, enrollments.insert · → /calendar
- [link] ** → {url}** — `components/payment/PaymentLinkButton.tsx:26` · gates: `!(step === 'success') && paymentMethod === 'manual' && !(loadingBank) && paymentLink`

<a id="-students"></a>
### Deportistas — `/students`

- **Rol:** school+school_admin · **Menú:** Principal > Deportistas
- **Otras entradas:** MobileBottomNav (school): Alumnos · Acción rápida: Gestionar Deportistas
- **Archivo:** `frontend/src/pages/SchoolStudentsManagementPage.tsx` (+36 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=— · flags en código: VITE_COBROS_Y_PAGOS, billing_enabled
- **Estado:** works · **Uso:** usado — children s90=14 r90=412 tot=1136; enrollments s90=18 r90=921 tot=1929
- ⚠ Las pestañas Activos/Inactivos/Todos son filtros (sin TabsContent).
- ⚠ «Cobros y pagos» abre CobrosYPagosModal solo con VITE_COBROS_Y_PAGOS; si no, RegisterCashPaymentModal (charge_batches = 0 filas: el flujo nuevo no se usa en prod).
- **Escribe:** PATCH /api/v1/enrollments/:p, POST /api/v1/charge-batches, POST /api/v1/charge-batches/:p/annul, POST /api/v1/enrollments, POST /api/v1/enrollments/plan-change-preview, POST /api/v1/invitations/bulk-send, POST /api/v1/payment-adjustments/:p/revert, POST /api/v1/payments/extract-receipt, POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, POST /api/v1/students/create-one, POST /api/v1/students/first-payment-preview, PUT /api/v1/students/:p, athlete_documents.delete, athlete_documents.insert, children.delete, children.insert, children.update, edge:send-email, payments.insert, payments.update, profiles.update, rpc:admin_set_payer_billing_details, rpc:school_memberships_listado, rpc:school_set_membership, school_members.update, storage:avatars.upload, storage:identity-documents.remove, storage:identity-documents.upload, unregistered_athletes.update
- **Lee:** GET /api/bffClient, GET /api/v1/access/hour-bank-balance/:p, GET /api/v1/access/hour-bank-balances, GET /api/v1/access/hour-bank-periods/:p, GET /api/v1/access/student-report/:p, GET /api/v1/athletes/:p/:p/charge-suggestions, GET /api/v1/athletes/:p/:p/open-charges, GET /api/v1/charge-batches/:p, GET /api/v1/charge-batches/athlete-search:p, GET /api/v1/charge-batches/targets:p)}, GET /api/v1/charge-batches:p)}, GET /api/v1/payment-adjustments:p, GET /api/v1/trainer/search-profile, POST /api/v1/charge-batches/preview, athlete_documents.select, children.select, enrollment_pause_requests.select, enrollments.select, offering_plans.select, payments.select, profiles.select, school_athletes.select, school_branches.select, school_categories.select, school_settings.select, school_staff.select, storage:avatars.getPublicUrl, storage:identity-documents.createSignedUrl, storage:identity-documents.list, team_coaches.select, teams.select, unregistered_athletes.select, v_enrollment_pauses_effective.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [menu_item] **Editar deportista** — `pages/SchoolStudentsManagementPage.tsx:1299` · R: children.select
- [menu_item] **Editar estado de cuenta** — `pages/SchoolStudentsManagementPage.tsx:1302` · abre: setAccountStudentId
- [button] **{`Más acciones para ${student.full_name}`}** — `pages/SchoolStudentsManagementPage.tsx:1314`
- [menu_item] **Ver Perfil** — `pages/SchoolStudentsManagementPage.tsx:1324`
- [menu_item] **Editar deportista** — `pages/SchoolStudentsManagementPage.tsx:1326` · gates: `canCreateOrEditStudents` · R: children.select
- [menu_item] **Cobros y pagos / Registrar pago** — `pages/SchoolStudentsManagementPage.tsx:1329` · gates: `canRegisterPayments && student.status !== 'inactive'` · abre: setAccountStudentId
- [menu_item] **Reactivar / Inactivar** — `pages/SchoolStudentsManagementPage.tsx:1334` · gates: `canManageStudents` · W: children.insert, payments.insert, rpc:invite_parent_to_school, edge:send-email · R: teams.select, children.select, unregistered_athletes.select
- [menu_item] **Reactivar de la pausa** — `pages/SchoolStudentsManagementPage.tsx:1344` · gates: `pauseEnabled && canManageStudents && student.status !== 'inactive'`
- [menu_item] **🏖️ Vacaciones / pausa** — `pages/SchoolStudentsManagementPage.tsx:1349` · gates: `pauseEnabled && canManageStudents && student.status !== 'inactive'`
- [menu_item] **(() => navigate(`/invitations?${buildInviteParams(student)}`))** — `pages/SchoolStudentsManagementPage.tsx:1355` · → /invitations?${buildInviteParams(student)}
- [menu_item] **Ver estado de cuenta** — `pages/SchoolStudentsManagementPage.tsx:1358` · → /estado-cuenta?${buildAccountStatementParams(student)}
- [menu_item] **Equipo de agendamiento** — `pages/SchoolStudentsManagementPage.tsx:1364` · gates: `teamSchedulingEnabled && student.enrollment_id && student.offering_plan_id`
- [button] **Actualizar** — `pages/SchoolStudentsManagementPage.tsx:1386` · gates: `(canManageStudents \|\| canCreateOrEditStudents \|\| coachUploadsEnrollmentForms) && disabled: {isFetching}`
- [export] **Importar CSV CSV** — `pages/SchoolStudentsManagementPage.tsx:1392` · gates: `(canManageStudents \|\| canCreateOrEditStudents \|\| coachUploadsEnrollmentForms) && canManageStudents` · abre: setShowImportModal
- [button] **Subir hoja de matrícula Hoja** — `pages/SchoolStudentsManagementPage.tsx:1399` · gates: `(canManageStudents \|\| canCreateOrEditStudents \|\| coachUploadsEnrollmentForms) && coachUploadsEnrollmentForms` · → /school/enrollment-intake
- [button] **Agregar Atleta Agregar** — `pages/SchoolStudentsManagementPage.tsx:1406` · gates: `(canManageStudents \|\| canCreateOrEditStudents \|\| coachUploadsEnrollmentForms) && canCreateStudents`
- [filter] **Buscar: Buscar por nombre o acudiente...** — `pages/SchoolStudentsManagementPage.tsx:1446`
- [filter] **Selector: Equipo** — `pages/SchoolStudentsManagementPage.tsx:1451`
- [filter] **Selector: Plan** — `pages/SchoolStudentsManagementPage.tsx:1466`
- [button] **Limpiar filtro s** — `pages/SchoolStudentsManagementPage.tsx:1485` · gates: `activeFilterCount > 0`
- [button] **Invitar** — `pages/SchoolStudentsManagementPage.tsx:1520` · gates: `selectedStudentIds.length > 0 && disabled: {bulkInviteMutation.isPending}` · W: POST /api/v1/invitations/bulk-send · R: GET /api/bffClient
- [button] **Cancelar** — `pages/SchoolStudentsManagementPage.tsx:1524` · gates: `selectedStudentIds.length > 0 && disabled: {bulkInviteMutation.isPending}` · abre: setSelectedStudentIds
- [bulk_select] **Nombre** — `pages/SchoolStudentsManagementPage.tsx:1638` · gates: `!(filteredStudents.length === 0 && tabStudents.length > 0)`
- [button] **Ver** — `pages/SchoolStudentsManagementPage.tsx:1720` · gates: `!(filteredStudents.length === 0 && tabStudents.length > 0)`
- [button] **{student.status === 'inactive' ? 'Reactivar atleta' : 'Inactivar: canc…}** — `pages/SchoolStudentsManagementPage.tsx:1727` · gates: `!(filteredStudents.length === 0 && tabStudents.length > 0) && canManageStudents && disabled: {toggleStatusMutation.isPending}` · W: children.insert, payments.insert, rpc:invite_parent_to_school, edge:send-email · R: teams.select, children.select, unregistered_athletes.select
- [button] **Invitar** — `pages/SchoolStudentsManagementPage.tsx:1739` · gates: `!(filteredStudents.length === 0 && tabStudents.length > 0)` · → /invitations?${buildInviteParams(student)}
- [dialog] **Agregar Nuevo Atleta** — `pages/SchoolStudentsManagementPage.tsx:1783`
- [button] **Seleccionar fecha** — `pages/SchoolStudentsManagementPage.tsx:1805` · gates: `!isCategoryOnlyCoach`
- [filter] **Selector: Seleccionar** — `pages/SchoolStudentsManagementPage.tsx:1853` · gates: `!isCategoryOnlyCoach && (!editingStudent \|\| editingAthleteType === 'child')`
- [filter] **Selector: Seleccionar** — `pages/SchoolStudentsManagementPage.tsx:1868` · gates: `!isCategoryOnlyCoach && (!editingStudent \|\| editingAthleteType === 'child')`
- [filter] **Selector: Sin equipo** — `pages/SchoolStudentsManagementPage.tsx:1947` · gates: `disabled: {editingIsInactive}`
- [button] **Seleccionar fecha** — `pages/SchoolStudentsManagementPage.tsx:1971`
- [filter] **Selector: Sin plan** — `pages/SchoolStudentsManagementPage.tsx:2022` · gates: `!isCategoryOnlyCoach && disabled: {editingIsInactive}`
- [button] **Seleccionar fecha** — `pages/SchoolStudentsManagementPage.tsx:2056` · gates: `!isCategoryOnlyCoach`
- [button] **Quitar descuento / Aplicar 10%** — `pages/SchoolStudentsManagementPage.tsx:2105` · gates: `!isCategoryOnlyCoach && militaryDiscountEnabled && disabled: {editingIsInactive \|\| !!form.watch('fee_is_manual')}`
- [button] **Corregir los datos** — `pages/SchoolStudentsManagementPage.tsx:2216` · gates: `!editingStudent && dupAviso`
- [button] **Es otra persona — crear igual** — `pages/SchoolStudentsManagementPage.tsx:2219` · gates: `!editingStudent && dupAviso && disabled: {createStudentMutation.isPending}` · W: POST /api/v1/enrollments, children.insert, payments.insert, rpc:invite_parent_to_school, edge:send-email · R: GET /api/bffClient, teams.select, children.select, unregistered_athletes.select
- [button] **Cancelar** — `pages/SchoolStudentsManagementPage.tsx:2233` · abre: setDialogOpen
- [button] **Guardando...** — `pages/SchoolStudentsManagementPage.tsx:2234` · gates: `disabled: {createStudentMutation.isPending \|\| updateStudentMutation.i…` · W: POST /api/v1/enrollments/plan-change-preview, PUT /api/v1/students/:p, POST /api/v1/enrollments, children.insert, payments.insert, rpc:invite_parent_to_school, edge:send-email · R: GET /api/bffClient, teams.select, children.select, unregistered_athletes.select
- [dialog] **(sin etiqueta)** — `pages/SchoolStudentsManagementPage.tsx:2294` · gates: `viewingStudent`
- [button] **Ocultar / Ver reporte de ingresos/salidas** — `pages/SchoolStudentsManagementPage.tsx:2462` · gates: `viewingStudent && s.enrollment_id && hourBankByEnrollment.has(s.enrollment_id)`
- [link] ** → {doc.url}** — `pages/SchoolStudentsManagementPage.tsx:2551` · gates: `viewingStudent && !(loadingDocs) && doc`
- [link] ** → {doc.url}** — `pages/SchoolStudentsManagementPage.tsx:2594` · gates: `viewingStudent && !(loadingDocs)`
- [button] **Cerrar** — `pages/SchoolStudentsManagementPage.tsx:2612` · gates: `viewingStudent`
- [button] **Editar** — `pages/SchoolStudentsManagementPage.tsx:2616` · gates: `viewingStudent && canCreateOrEditStudents` · R: children.select
- [button] **Aprobar** — `components/students/PauseRequestsInbox.tsx:75` · gates: `pauseEnabled && canManageStudents && disabled: {isBusy}`
- [button] **Rechazar** — `components/students/PauseRequestsInbox.tsx:82` · gates: `pauseEnabled && canManageStudents && disabled: {isBusy}`
- [button] **Información médica importante** — `components/common/MedicalAlertBadge.tsx:48` · gates: `!(filteredStudents.length === 0 && tabStudents.length > 0)`
- [button] **Actualizar** — `components/common/TableRefreshBar.tsx:65` · gates: `disabled: {loading}`
- [dialog] **Cambio de plan** — `components/students/PlanChangeDialog.tsx:93`
- [filter] **Selector: {mode}** — `components/students/PlanChangeDialog.tsx:113`
- [button] **Esperar al día 1 / Cancelar** — `components/students/PlanChangeDialog.tsx:147` · gates: `disabled: {submitting}`
- [button] **Cambiando… / Cambiar de plan** — `components/students/PlanChangeDialog.tsx:150` · gates: `disabled: {submitting}` · W: PUT /api/v1/students/:p · R: GET /api/bffClient
- [button] **Ver histórico de meses** — `components/access/HourBankBalanceCard.tsx:170` · gates: `viewingStudent && s.enrollment_id && hourBankByEnrollment.has(s.enrollment_id) && showHistory` · abre: setHistoryOpen
- [dialog] **🏖️ Poner en pausa a** — `components/students/PauseAthleteDialog.tsx:77`
- [filter] **Selector: {reason}** — `components/students/PauseAthleteDialog.tsx:95` · gates: `!(sinInscripcion)`
- [filter] **Selector: {monthFrom}** — `components/students/PauseAthleteDialog.tsx:108` · gates: `!(sinInscripcion)`
- [filter] **Selector: {monthTo}** — `components/students/PauseAthleteDialog.tsx:117` · gates: `!(sinInscripcion)`
- [button] **Cancelar** — `components/students/PauseAthleteDialog.tsx:171`
- [button] **Confirmar pausa** — `components/students/PauseAthleteDialog.tsx:172` · gates: `disabled: {sinInscripcion \|\| isSubmitting \|\| loadingPreview \|\| !!prev…`
- [dialog] **Importar deportistas desde CSV** — `components/students/CSVImportModal.tsx:327`
- [export] **Exportar deportistas (CSV) / Descargar plantilla** — `components/students/CSVImportModal.tsx:347`
- [button] **Cambiar archivo** — `components/students/CSVImportModal.tsx:396` · gates: `file && !uploading && !result`
- [export] **Seleccionar archivo CSV** — `components/students/CSVImportModal.tsx:417` · gates: `!(file) && disabled: {uploading}` · abre: openFilePicker
- [export] **📋 Formato esperado del CSV** — `components/students/CSVImportModal.tsx:564` · gates: `!file && !uploading`
- [button] **Cerrar / Cancelar** — `components/students/CSVImportModal.tsx:600`
- [button] **Procesando... Importar deportistas** — `components/students/CSVImportModal.tsx:609` · gates: `!result && disabled: {parsedStudents.length === 0 \|\| uploading}` · W: POST /api/v1/students/bulk
- [dialog] **Equipo de agendamiento** — `components/teams/AssignSchedulingTeamModal.tsx:94` · gates: `teamSchedulingEnabled`
- [filter] **Selector: Seleccionar equipo...** — `components/teams/AssignSchedulingTeamModal.tsx:105` · gates: `teamSchedulingEnabled && disabled: {isLoading}` · abre: setSelectedTeamId
- [button] **Cancelar** — `components/teams/AssignSchedulingTeamModal.tsx:121` · gates: `teamSchedulingEnabled`
- [button] **Guardando... / Guardar** — `components/teams/AssignSchedulingTeamModal.tsx:122` · gates: `teamSchedulingEnabled && disabled: {saveMutation.isPending \|\| !enrollmentId}` · W: PATCH /api/v1/enrollments/:p
- [dialog] **Nuevo Atleta** — `components/students/StudentTypeSelector.tsx:17`
- [button] **Menor de Edad Requiere acudiente** — `components/students/StudentTypeSelector.tsx:23`
- [button] **Atleta Adulto Más de 18 años** — `components/students/StudentTypeSelector.tsx:34`
- [dialog] **(sin etiqueta)** — `components/payment/CobrosYPagosModal.tsx:537` · gates: `canRegisterPayments` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Un atleta** — `components/payment/CobrosYPagosModal.tsx:547` · gates: `canRegisterPayments && !result && !locked` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Varios atletas** — `components/payment/CobrosYPagosModal.tsx:548` · gates: `canRegisterPayments && !result && !locked` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cancelar** — `components/payment/CobrosYPagosModal.tsx:729` · gates: `canRegisterPayments && !(result) && disabled: {submitting}` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **[cyp-primary]** — `components/payment/CobrosYPagosModal.tsx:730` · gates: `canRegisterPayments && !(result) && disabled: {button.disabled}` · W: POST /api/v1/charge-batches · R: GET /api/v1/athletes/:p/:p/open-charges, GET /api/v1/athletes/:p/:p/charge-suggestions · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **📱 Abrir WhatsApp** — `components/students/CreateChildModal.tsx:381` · W: POST /api/v1/students/create-one
- [dialog] **Registrar Menor de Edad** — `components/students/CreateChildModal.tsx:407`
- [filter] **Selector: {docType}** — `components/students/CreateChildModal.tsx:423`
- [button] **Seleccionar fecha** — `components/students/CreateChildModal.tsx:449`
- [filter] **Selector: Seleccionar** — `components/students/CreateChildModal.tsx:490`
- [button] **Información médica (opcional)** — `components/students/CreateChildModal.tsx:512`
- [filter] **Selector: {medicalHasAllergies}** — `components/students/CreateChildModal.tsx:521` · gates: `showMedical`
- [filter] **Selector: Selecciona una sede *** — `components/students/CreateChildModal.tsx:636` · gates: `branches.length > 0` · abre: setBranchId
- [filter] **Selector: Sin equipo** — `components/students/CreateChildModal.tsx:651` · abre: setTeamId
- [filter] **Selector: Sin plan** — `components/students/CreateChildModal.tsx:671` · gates: `hasBilling`
- [button] **Seleccionar fecha** — `components/students/CreateChildModal.tsx:691`
- [button] **Cancelar** — `components/students/CreateChildModal.tsx:770` · gates: `disabled: {submitting}`
- [button] **Guardando... Registrar Menor** — `components/students/CreateChildModal.tsx:773` · gates: `disabled: {submitting \|\| checkingParentEmail}` · W: POST /api/v1/students/create-one · R: children.select, GET /api/v1/me/entitlements, GET /api/v1/trainer/search-profile
- [button] **📱 Abrir WhatsApp** — `components/students/CreateAdultAthleteModal.tsx:172` · W: POST /api/v1/students/create-one
- [dialog] **Inscribir Atleta Adulto** — `components/students/CreateAdultAthleteModal.tsx:415`
- [filter] **Selector: {uDocType}** — `components/students/CreateAdultAthleteModal.tsx:477` · gates: `disabled: {!!emailExists}`
- [button] **Seleccionar fecha** — `components/students/CreateAdultAthleteModal.tsx:503` · gates: `disabled: {!!emailExists}`
- [filter] **Selector: Seleccionar** — `components/students/CreateAdultAthleteModal.tsx:546` · gates: `disabled: {!!emailExists}`
- [filter] **Selector: Selecciona una sede *** — `components/students/CreateAdultAthleteModal.tsx:622` · gates: `branches.length > 0` · abre: setBranchId
- [filter] **Selector: Sin equipo** — `components/students/CreateAdultAthleteModal.tsx:638` · abre: setTeamId
- [filter] **Selector: Sin plan** — `components/students/CreateAdultAthleteModal.tsx:654`
- [button] **Seleccionar fecha** — `components/students/CreateAdultAthleteModal.tsx:674`
- [button] **Cancelar** — `components/students/CreateAdultAthleteModal.tsx:761` · gates: `disabled: {submitting}`
- [button] **Guardando... Inscribir Atleta Registrar Atleta** — `components/students/CreateAdultAthleteModal.tsx:764` · gates: `disabled: {submitting \|\| checkingEmail}` · W: POST /api/v1/students/create-one
- [dialog] **Registrar pago manual** — `components/payment/RegisterCashPaymentModal.tsx:624` · gates: `canRegisterPayments`
- [button] **Efectivo** — `components/payment/RegisterCashPaymentModal.tsx:637` · gates: `canRegisterPayments`
- [button] **Transferencia** — `components/payment/RegisterCashPaymentModal.tsx:664` · gates: `canRegisterPayments`
- [button] **Quitar** — `components/payment/RegisterCashPaymentModal.tsx:706` · gates: `canRegisterPayments && paymentMethod === 'transfer' && receiptUrl`
- [button] **Usar monto** — `components/payment/RegisterCashPaymentModal.tsx:715` · gates: `canRegisterPayments && paymentMethod === 'transfer' && receiptUrl && (ocrResult?.extractedAmount != null \|\| ocrResult?.extractedDate) && ocrResult?.extractedAmo`
- [button] **Usar fecha** — `components/payment/RegisterCashPaymentModal.tsx:726` · gates: `canRegisterPayments && paymentMethod === 'transfer' && receiptUrl && (ocrResult?.extractedAmount != null \|\| ocrResult?.extractedDate) && ocrResult?.extractedDat`
- [button] **Selecciona a quién aplica ▼** — `components/payment/RegisterCashPaymentModal.tsx:778` · gates: `canRegisterPayments`
- [filter] **Buscar: Buscar deportista...** — `components/payment/RegisterCashPaymentModal.tsx:796` · gates: `canRegisterPayments`
- [button] **Padre:** — `components/payment/RegisterCashPaymentModal.tsx:809` · gates: `canRegisterPayments && !(filteredAthletes.length === 0)` · abre: setSelectedAthleteId, setAthletePopoverOpen
- [filter] **Selector: {loadingPending ? 'Cargando...' : 'Selecciona un pago pendiente'}** — `components/payment/RegisterCashPaymentModal.tsx:839` · gates: `canRegisterPayments && selectedAthleteId && disabled: {loadingPending}`
- [button] **Cerrar / Corregir** — `components/payment/RegisterCashPaymentModal.tsx:901` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && !(!payerProfileId)`
- [button] **Cerrar / Completar** — `components/payment/RegisterCashPaymentModal.tsx:917` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && !(!payerProfileId)`
- [toggle] **¿Desea factura electrónica?** — `components/payment/RegisterCashPaymentModal.tsx:928` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && !(!payerProfileId)`
- [filter] **Selector: Selecciona el tipo de cobro** — `components/payment/RegisterCashPaymentModal.tsx:968` · gates: `canRegisterPayments && selectedPaymentId === 'new'`
- [filter] **Selector: {loadingPeriod ? 'Calculando...' : 'Selecciona el mes'}** — `components/payment/RegisterCashPaymentModal.tsx:1000` · gates: `canRegisterPayments && periodApplies && disabled: {loadingPeriod}`
- [button] **Seleccionar fecha** — `components/payment/RegisterCashPaymentModal.tsx:1044` · gates: `canRegisterPayments`
- [button] **Registrando... / Confirmar Registro** — `components/payment/RegisterCashPaymentModal.tsx:1069` · gates: `canRegisterPayments && disabled: {loading}` · W: payments.update, payments.insert, rpc:notify_user, edge:send-email · R: payments.select
- [button] **Ver operación** — `components/payment/cobros-y-pagos/ResultScreen.tsx:36` · gates: `canRegisterPayments && result && onViewOperation` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Anular lote** — `components/payment/cobros-y-pagos/ResultScreen.tsx:37` · gates: `canRegisterPayments && result && onAnnul && created > 0` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Otra operación** — `components/payment/cobros-y-pagos/ResultScreen.tsx:38` · gates: `canRegisterPayments && result && onAnother` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cerrar** — `components/payment/cobros-y-pagos/ResultScreen.tsx:39` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [dialog] **Anular lote** — `components/payment/OperacionesTab.tsx:112` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cancelar** — `components/payment/OperacionesTab.tsx:132` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Anular** — `components/payment/OperacionesTab.tsx:133` · gates: `canRegisterPayments && result && disabled: {!detail \|\| annullableCount === 0 \|\| !reasonOk \|\| saving}` · W: POST /api/v1/charge-batches/:p/annul · R: GET /api/v1/charge-batches/:p · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [dialog] **Quitar descuento** — `components/payment/OperacionesTab.tsx:173` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cancelar** — `components/payment/OperacionesTab.tsx:184` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Quitar descuento** — `components/payment/OperacionesTab.tsx:185` · gates: `canRegisterPayments && result && disabled: {!ok \|\| saving}` · W: POST /api/v1/payment-adjustments/:p/revert · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [toggle] **Con descuentos** — `components/payment/OperacionesTab.tsx:288` · gates: `canRegisterPayments && result` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **(() => load(true, null))** — `components/payment/OperacionesTab.tsx:291` · gates: `canRegisterPayments && result && disabled: {loading}` · R: GET /api/v1/charge-batches/:p · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Ver detalle** — `components/payment/OperacionesTab.tsx:320` · gates: `canRegisterPayments && result` · R: GET /api/v1/charge-batches/:p, GET /api/v1/payment-adjustments:p · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Anular lote** — `components/payment/OperacionesTab.tsx:324` · gates: `canRegisterPayments && result && canManage && b.status !== 'annulled' && b.rows_created > 0` · abre: setAnnulId · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Quitar descuento** — `components/payment/OperacionesTab.tsx:342` · gates: `canRegisterPayments && result && expanded === b.id && !(!d) && canManage && a.id && a.origin === 'modal' && ANNULLABLE.concat('partial').inclu…` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cargar más** — `components/payment/OperacionesTab.tsx:356` · gates: `canRegisterPayments && result && cursor && disabled: {loading}` · R: GET /api/v1/charge-batches/:p · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cargando… / Informe de descuentos de este mes** — `components/payment/OperacionesTab.tsx:362` · gates: `canRegisterPayments && result && disabled: {reportLoading}` · R: GET /api/v1/payment-adjustments:p · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cancelar atleta nuevo** — `components/payment/cobros-y-pagos/NewAthleteForm.tsx:75` · gates: `canRegisterPayments && !(result) && mode === 'single' && newAthleteOn` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {d.kind}** — `components/payment/cobros-y-pagos/NewAthleteForm.tsx:79` · gates: `canRegisterPayments && !(result) && mode === 'single' && newAthleteOn` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {d.doc_type}** — `components/payment/cobros-y-pagos/NewAthleteForm.tsx:91` · gates: `canRegisterPayments && !(result) && mode === 'single' && newAthleteOn` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Usar este** — `components/payment/cobros-y-pagos/NewAthleteForm.tsx:131` · gates: `canRegisterPayments && !(result) && mode === 'single' && newAthleteOn && realDups.length > 0` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Se creará igual (queda registrado) / Es otra persona: crear igual** — `components/payment/cobros-y-pagos/NewAthleteForm.tsx:136` · gates: `canRegisterPayments && !(result) && mode === 'single' && newAthleteOn && realDups.length > 0` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Atleta** — `components/payment/cobros-y-pagos/AthletePicker.tsx:49` · gates: `canRegisterPayments && !(result) && mode === 'single' && !(newAthleteOn)` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Atleta nuevo** — `components/payment/cobros-y-pagos/AthletePicker.tsx:75` · gates: `canRegisterPayments && !(result) && mode === 'single' && !(newAthleteOn) && filtered.length === 0 && onNewAthlete` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **(() => { onSelect(a.id); setOpen(false); setQ(''); })** — `components/payment/cobros-y-pagos/AthletePicker.tsx:81` · gates: `canRegisterPayments && !(result) && mode === 'single' && !(newAthleteOn) && !(filtered.length === 0)` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Atleta nuevo** — `components/payment/cobros-y-pagos/AthletePicker.tsx:103` · gates: `canRegisterPayments && !(result) && mode === 'single' && !(newAthleteOn) && onNewAthlete && !locked` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {value.kind}** — `components/payment/cobros-y-pagos/MultiTargetPicker.tsx:99` · gates: `canRegisterPayments && !(result) && !(mode === 'single')` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {value.kind === 'team' ? 'Elige el equipo' : value.kind === 'category'…}** — `components/payment/cobros-y-pagos/MultiTargetPicker.tsx:115` · gates: `canRegisterPayments && !(result) && !(mode === 'single') && value.kind !== 'list'` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Buscar: Buscar atleta…** — `components/payment/cobros-y-pagos/MultiTargetPicker.tsx:158` · gates: `canRegisterPayments && !(result) && !(mode === 'single') && !(value.kind !== 'list')` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [bulk_select] **{`Incluir ${c.concept}`}** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:88` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && disabled: {!!blocked}` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Todo el saldo** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:146` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && paymentOn && !d.exonerate && d.payAmount != nu` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {d.closeMode}** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:153` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && partialPay && calc` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: ¿Por qué se cierra por menos?** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:177` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && partialPay && d.closeMode === 'cerrar' && !d.d` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Descuento** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:201` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && !showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Recargo condonado** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:206` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && late > 0 && !d.exonerate` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Sugerencia: pronto pago % · Usar** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:218` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && canSuggestPronto && pronto` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **¿Descuento por pagar varios meses juntos?** — `components/payment/cobros-y-pagos/PendingChargesSection.tsx:284` · gates: `canRegisterPayments && !(result) && mode === 'single' && !newAthleteOn && athleteRef && canDiscount && severalMonthsMin != null && monthsMarked >= severalMonths` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {l.category}** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:99` · gates: `canRegisterPayments && !(result)` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: Mes** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:106` · gates: `canRegisterPayments && !(result) && isMonthly` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Quitar línea** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:150` · gates: `canRegisterPayments && !(result)` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: ¿De cuál plan?** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:159` · gates: `canRegisterPayments && !(result) && isMonthly && mode === 'single' && (suggestions?.enrollments?.length ?? 0) > 1` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Usar** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:180` · gates: `canRegisterPayments && !(result) && isMonthly && mode === 'single' && suggestedMonthly != null && l.amount !== suggestedMonthly` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: {(suggestions?.overages?.length ?? 0) > 0 ? 'Elige el período' : 'No h…}** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:196` · gates: `canRegisterPayments && !(result) && l.category === 'excedente' && mode === 'single'` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Descuento** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:231` · gates: `canRegisterPayments && !(result) && canDiscount && !showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Agregar cobro** — `components/payment/cobros-y-pagos/NewChargeLines.tsx:266` · gates: `canRegisterPayments && !(result)` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [toggle] **Descuento para todos / Descuento general** — `components/payment/cobros-y-pagos/GlobalDiscount.tsx:36` · gates: `canRegisterPayments && !(result) && canDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [toggle] **Ya lo pagaron** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:81` · gates: `canRegisterPayments && !(result) && mode === 'single'` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **(() => { set({ method: m }); if (m === 'cash') clearReceipt(); })** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:88` · gates: `canRegisterPayments && !(result) && mode === 'single' && p.on` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Quitar** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:121` · gates: `canRegisterPayments && !(result) && mode === 'single' && p.on && p.method === 'transfer' && p.receiptUrl` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Usar fecha** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:129` · gates: `canRegisterPayments && !(result) && mode === 'single' && p.on && p.method === 'transfer' && p.receiptUrl && p.ocr?.extractedDate && p.ocr.extractedDate !== p.da` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [toggle] **Factura electrónica** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:176` · gates: `canRegisterPayments && !(result) && mode === 'single' && p.on && invoicingEnabled && !(!payerProfileId)` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Cerrar / Completar datos** — `components/payment/cobros-y-pagos/PaymentBlock.tsx:182` · gates: `canRegisterPayments && !(result) && mode === 'single' && p.on && invoicingEnabled && !(!payerProfileId) && dian && dian !== 'complete'` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Actualizar** — `components/payment/cobros-y-pagos/PreviewSummary.tsx:65` · gates: `canRegisterPayments && !(result) && disabled: {loading}` · R: POST /api/v1/charge-batches/preview · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Detalle por atleta** — `components/payment/cobros-y-pagos/PreviewSummary.tsx:138` · gates: `canRegisterPayments && !(result) && mode === 'multi' && p?.athletes && p.athletes.length > 0` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Leyendo comprobante... Subiendo archivo... Cambiar archivo / Seleccio…** — `components/common/FileUpload.tsx:214` · gates: `canRegisterPayments && paymentMethod === 'transfer' && !(receiptUrl) && disabled: {busy}`
- [filter] **Selector: Tipo** — `components/billing/BillingDetailsForm.tsx:431` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && wantsEInvoice && payerProfileId`
- [button] **Guardar datos de facturación / Guardar y Continuar al Pago** — `components/billing/BillingDetailsForm.tsx:510` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && wantsEInvoice && payerProfileId && disabled: {isSubmitting}` · W: rpc:admin_set_payer_billing_details, profiles.update
- [button] **Quitar** — `components/payment/cobros-y-pagos/DiscountControl.tsx:52` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **%** — `components/payment/cobros-y-pagos/DiscountControl.tsx:89` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **$** — `components/payment/cobros-y-pagos/DiscountControl.tsx:90` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [filter] **Selector: Motivo** — `components/payment/cobros-y-pagos/DiscountControl.tsx:92` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **No cobrar** — `components/payment/cobros-y-pagos/DiscountControl.tsx:120` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount && onExonerateChange` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Quitar descuento** — `components/payment/cobros-y-pagos/DiscountControl.tsx:124` · gates: `!(result) && mode === 'single' && !newAthleteOn && athleteRef && d.selected && !blocked && canDiscount && showDiscount` · **hidden (flag VITE_COBROS_Y_PAGOS)**
- [button] **Busca tu municipio** — `components/billing/MunicipalitySelect.tsx:83` · gates: `canRegisterPayments && selectedAthleteId && hasAddon('invoicing') && wantsEInvoice && payerProfileId`

#### Pestaña «Activos» (`active`) — SchoolStudentsManagementPage.tsx:1436

_(sin acciones; 0 controles menores)_

#### Pestaña «Inactivos» (`inactive`) — SchoolStudentsManagementPage.tsx:1437

_(sin acciones; 0 controles menores)_

#### Pestaña «Todos» (`todos`) — SchoolStudentsManagementPage.tsx:1438

_(sin acciones; 0 controles menores)_

<a id="-school-enrollment-intake"></a>
### Matrículas por revisar — `/school/enrollment-intake`

- **Rol:** school+school_admin · **Menú:** Principal > Matrículas por revisar
- **Archivo:** `frontend/src/pages/school/EnrollmentIntakeInboxPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=deportistas_matriculas_por_revisar
- **Estado:** works · **Uso:** usado — enrollment_form_intake s90=2 r90=14 tot=14
- ⚠ Apagado por override en 2 escuelas (Carmel, GYM RM).
- **Escribe:** POST /api/v1/enrollment-intake/:p/link, POST /api/v1/enrollment-intake/:p/mark-approved, POST /api/v1/enrollment-intake/:p/reject, POST /api/v1/enrollment-intake/upload, POST /api/v1/students/create-one
- **Lee:** GET /api/v1/enrollment-intake

#### Sin pestaña (cuerpo, encabezado y modales)

- [link] ** → {item.photoUrl}** — `pages/school/EnrollmentIntakeInboxPage.tsx:218` · gates: `item.photoUrl`
- [button] **Crear atleta** — `pages/school/EnrollmentIntakeInboxPage.tsx:335` · gates: `disabled: {working \|\| camposObligatoriosFaltan \|\| Boolean(item.duplic…` · W: POST /api/v1/students/create-one, POST /api/v1/enrollment-intake/:p/mark-approved
- [button] **Vincular a** — `pages/school/EnrollmentIntakeInboxPage.tsx:340` · gates: `item.duplicateOfChildId && disabled: {working}` · W: POST /api/v1/enrollment-intake/:p/link
- [button] **Descartar** — `pages/school/EnrollmentIntakeInboxPage.tsx:344` · gates: `disabled: {working}` · W: POST /api/v1/enrollment-intake/:p/reject
- [button] **Leyendo la hoja… / Subir hoja de matrícula** — `pages/school/EnrollmentIntakeInboxPage.tsx:440` · gates: `disabled: {subiendo}`

<a id="-staff"></a>
### Entrenadores — `/staff`

- **Rol:** school+school_admin · **Menú:** Principal > Entrenadores
- **Otras entradas:** Acción rápida: Agregar Entrenador
- **Archivo:** `frontend/src/pages/StaffPage.tsx` (+9 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** works · **Uso:** usado — school_staff s90=14 r90=49 tot=90
- ⚠ «Gestionar disponibilidad» (AvailabilityManager) es el mismo componente que en /facilities.
- **Escribe:** DELETE /api/v1/school-staff/:p, PATCH /api/v1/school-staff/:p, POST /api/v1/invitations/bulk-send, POST /api/v1/school-staff, coach_availability.update, facilities.delete, facilities.insert, facilities.update, group_class_athletes.delete, group_class_athletes.insert, match_results.insert, school_branches.delete, school_branches.insert, school_branches.update, training_sessions.insert
- **Lee:** GET /api/bffClient, GET /api/v1/school-staff, facilities.select, group_class_athletes.select, match_results.select, school_branches.select, teams.select, training_sessions.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Actualizar** — `pages/StaffPage.tsx:137` · gates: `disabled: {isFetching}`
- [button] **Contratar Entrenador** — `pages/StaffPage.tsx:141` · abre: setDialogOpen
- [button] **Gestionar disponibilidad** — `pages/StaffPage.tsx:229` · gates: `!(filteredStaff.length === 0)`
- [button] **Editar información** — `pages/StaffPage.tsx:238` · gates: `!(filteredStaff.length === 0)`
- [button] **{member.status === 'active' ? "Inactivar" : "Reactivar"}** — `pages/StaffPage.tsx:247` · gates: `!(filteredStaff.length === 0)` · W: PATCH /api/v1/school-staff/:p
- [button] **Eliminar permanentemente** — `pages/StaffPage.tsx:259` · gates: `!(filteredStaff.length === 0)` · abre: setDeleteId
- [dialog] **¿Eliminar entrenador?** — `pages/StaffPage.tsx:308`
- [button] **Eliminar** — `pages/StaffPage.tsx:315` · W: DELETE /api/v1/school-staff/:p
- [dialog] **Editar Entrenador / Contratar Entrenador** — `components/school/StaffFormDialog.tsx:193`
- [filter] **Selector: Sin sede asignada** — `components/school/StaffFormDialog.tsx:336` · gates: `hasBranches && disabled: {busy}`
- [toggle] **Enviar invitación por correo Recibirá un correo para crear …** — `components/school/StaffFormDialog.tsx:403` · gates: `!isEditing && disabled: {busy}`
- [button] **Cancelar** — `components/school/StaffFormDialog.tsx:424` · gates: `disabled: {busy}`
- [button] **Guardando...** — `components/school/StaffFormDialog.tsx:427` · gates: `disabled: {busy}` · W: PATCH /api/v1/school-staff/:p, POST /api/v1/school-staff, POST /api/v1/invitations/bulk-send
- [dialog] **Disponibilidad -** — `components/school/AvailabilityModal.tsx:32` · gates: `selectedCoach`
- [button] **Cerrar** — `components/school/AvailabilityModal.tsx:46` · gates: `selectedCoach`
- [button] **{`Quitar ${nombre}`}** — `components/common/SportMultiCombobox.tsx:154` · gates: `selected.length > 0 && !disabled`
- [button] **Agregar** — `components/common/TagInput.tsx:75` · gates: `disabled: {disabled \|\| atLimit \|\| !draft.trim()}`
- [button] **{`Quitar ${tag}`}** — `components/common/TagInput.tsx:90` · gates: `value.length > 0 && disabled: {disabled}`
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Configurar» (`config`) — AvailabilityManager.tsx:233

- [filter] **Selector: Inicio** — `components/school/AvailabilityManager.tsx:298` · gates: `selectedCoach && selectedDays.length > 0`
- [filter] **Selector: Fin** — `components/school/AvailabilityManager.tsx:323` · gates: `selectedCoach && selectedDays.length > 0 && disabled: {!currentWindow.start}`
- [button] **Añadir a la Lista** — `components/school/AvailabilityManager.tsx:388` · gates: `selectedCoach && selectedDays.length > 0 && disabled: {!currentWindow.start \|\| !currentWindow.end \|\| currentWindo…`
- [button] **Guardando... Agregar Horarios** — `components/school/AvailabilityManager.tsx:523` · gates: `selectedCoach && disabled: {!canSave \|\| isCreating}` · R: GET /api/bffClient

#### Pestaña «Registrados ( )» (`scheduled`) — AvailabilityManager.tsx:234

- [button] **(e => { e.stopPropagation(); handleDeleteDay(dayIndex); })** — `components/school/AvailabilityManager.tsx:585` · gates: `selectedCoach && !(availability.length === 0) && disabled: {isDeleting}` · R: GET /api/bffClient
- [button] **Eliminar este rango** — `components/school/AvailabilityManager.tsx:639` · gates: `selectedCoach && !(availability.length === 0) && isOpen && disabled: {isDeleting}` · R: GET /api/bffClient

<a id="-invitations"></a>
### Invitaciones — `/invitations`

- **Rol:** school+school_admin · **Menú:** Principal > Invitaciones
- **Otras entradas:** Acción rápida: Invitaciones
- **Archivo:** `frontend/src/pages/InvitationsManagementPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=—
- **Estado:** works · **Uso:** usado — invitations s90=14 r90=259 tot=856
- ⚠ Invitar también existe en /students (masivo y por fila), en el alta de entrenador (/staff, send_invitation) y en /admin/users (create_invitation). Vencimiento de invitaciones decorativo (memoria).
- **Escribe:** POST /api/v1/invitations/bulk-send
- **Lee:** GET /api/bffClient, GET /api/v1/invitations/send-status, children.select, invitations.select, offering_plans.select, payments.select, profiles.select, school_branches.select, school_members.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Enviar a los que faltan ( )** — `pages/InvitationsManagementPage.tsx:867` · gates: `!!sendStatus && sendStatus.pendientes > 0 && disabled: {bulkSendMutation.isPending \|\| (sendStatus.fallidas + sendS…` · W: POST /api/v1/invitations/bulk-send · R: GET /api/bffClient
- [button] **Reenviar a todas** — `pages/InvitationsManagementPage.tsx:875` · gates: `!!sendStatus && sendStatus.pendientes > 0 && disabled: {bulkSendMutation.isPending}` · W: POST /api/v1/invitations/bulk-send · R: GET /api/bffClient
- [filter] **Buscar: Buscar por nombre, email, teléfono...** — `pages/InvitationsManagementPage.tsx:891`
- [filter] **Selector: Ordenar** — `pages/InvitationsManagementPage.tsx:907`
- [button] **Limpiar filtros** — `pages/InvitationsManagementPage.tsx:918` · gates: `(searchTerm \|\| statusFilter !== 'all')`
- [button] **Actualizar** — `pages/InvitationsManagementPage.tsx:922` · gates: `disabled: {isFetching}`
- [button] **Nueva Invitación** — `pages/InvitationsManagementPage.tsx:926` · abre: setDialogOpen
- [button] **{inv.monthly_fee == null ? 'Asignar equipo/plan/mensualidad' : 'Editar…}** — `pages/InvitationsManagementPage.tsx:1038` · gates: `!hideFinancials && ['parent', 'athlete'].includes(inv.role_to_assign \|\| '')` · abre: openEditDialog
- [button] **Copiar link** — `pages/InvitationsManagementPage.tsx:1047`
- [button] **Enviar por WhatsApp** — `pages/InvitationsManagementPage.tsx:1050`
- [button] **Reenviar email** — `pages/InvitationsManagementPage.tsx:1056` · gates: `inv.status === 'pending'`
- [button] **Cancelar invitación** — `pages/InvitationsManagementPage.tsx:1061` · gates: `inv.status === 'pending' && disabled: {cancelInvitationMutation.isPending}` · R: invitations.select
- [dialog] **Nueva Invitación** — `pages/InvitationsManagementPage.tsx:1109`
- [filter] **Selector: Seleccionar sede** — `pages/InvitationsManagementPage.tsx:1331` · gates: `!(formData.role === 'referral') && branches.length > 1`
- [filter] **Selector: Seleccionar equipo** — `pages/InvitationsManagementPage.tsx:1351` · gates: `!(formData.role === 'referral') && ['parent', 'athlete', 'coach'].includes(formData.role)`
- [filter] **Selector: Seleccionar plan** — `pages/InvitationsManagementPage.tsx:1370` · gates: `!(formData.role === 'referral') && !hideFinancials && ['parent', 'athlete'].includes(formData.role)`
- [button] **Cancelar** — `pages/InvitationsManagementPage.tsx:1415` · abre: setDialogOpen
- [button] **Creando... / Crear & Copiar Link** — `pages/InvitationsManagementPage.tsx:1420` · gates: `formData.role === 'referral' && disabled: {!formData.parentEmail \|\| createReferralMutation.isPending}`
- [button] **Creando... / Crear & Copiar Link** — `pages/InvitationsManagementPage.tsx:1433` · gates: `!(formData.role === 'referral') && disabled: {sendInvitationMutation.isPending \|\| !hasValidContact()}`
- [button] **Creando... / Crear & Enviar WA** — `pages/InvitationsManagementPage.tsx:1440` · gates: `formData.parentPhone.replace(/\D/g, '').length >= 7 && formData.role !== 'refer… && disabled: {sendInvitationMutation.isPending \|\| !hasValidContact()}`
- [dialog] **Asignar equipo y mensualidad** — `pages/InvitationsManagementPage.tsx:1459`
- [filter] **Selector: Seleccionar equipo** — `pages/InvitationsManagementPage.tsx:1475`
- [filter] **Selector: Seleccionar plan** — `pages/InvitationsManagementPage.tsx:1489`
- [button] **Cancelar** — `pages/InvitationsManagementPage.tsx:1518`
- [button] **Guardando... / Guardar** — `pages/InvitationsManagementPage.tsx:1521` · gates: `disabled: {updateInvitationMutation.isPending}` · R: invitations.select
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

## Gestión Deportiva

<a id="-seguimiento-deportivo"></a>
### Seguimiento deportivo — `/seguimiento-deportivo`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Seguimiento deportivo
- **Archivo:** `frontend/src/pages/CoachActivityPage.tsx` (+11 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** works · **Uso:** usado — training_sessions s90=4 r90=67 tot=70; match_results s90=4 r90=34 tot=34
- ⚠ Solo lectura. Reusa SessionViewer/TacticalBoard de /training-plans.
- **Escribe:** DELETE /api/v1/school/football/events/:p, DELETE /api/v1/school/football/lineups/:p, DELETE /api/v1/school/football/tactical-presets/:p, DELETE /api/v1/school/performance/entries/:p, POST /api/v1/school/football/events, POST /api/v1/school/football/lineups, POST /api/v1/school/football/tactical-presets, POST /api/v1/school/performance/entries, PUT /api/v1/school/football/tactical-presets/:p, PUT /api/v1/school/performance/entries/:p, match_results.delete, match_results.insert, match_results.update
- **Lee:** GET /api/v1/athlete/performance/entries:p, GET /api/v1/athlete/performance/evolution, GET /api/v1/school/coach-activity, GET /api/v1/school/football/events, GET /api/v1/school/football/lineups, GET /api/v1/school/football/lineups/:p, GET /api/v1/school/football/season-stats, GET /api/v1/school/football/tactical-presets, GET /api/v1/school/football/tournament-matches, GET /api/v1/school/performance/entries, GET /api/v1/school/performance/metrics, GET /api/v1/school/performance/roster, GET /api/v1/school/performance/subjects/:p/:p/evolution, match_results.select, training_sessions.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Semana anterior** — `pages/CoachActivityPage.tsx:58`
- [button] **Volver a esta semana** — `pages/CoachActivityPage.tsx:66` · gates: `!(week === thisWeek)`
- [button] **Semana siguiente** — `pages/CoachActivityPage.tsx:71` · gates: `disabled: {week >= thisWeek}`
- [button] **Reintentar** — `pages/CoachActivityPage.tsx:84` · gates: `!(isLoading) && disabled: {isFetching}`
- [link] **Entrenadores → /staff** — `pages/CoachActivityPage.tsx:88` · gates: `!(isLoading)`
- [link] **Ver las sesiones por equipo en Métricas y Rendimiento → /training-plans** — `pages/CoachActivityPage.tsx:111` · gates: `!(isLoading)`
- [button] **Titular: Apoya: Sin equipos asignados No tiene cuenta en la app: sus …** — `components/coach-activity/CoachCard.tsx:34` · gates: `!(isLoading)`
- [dialog] **(sin etiqueta)** — `components/coach-activity/CoachDetailSheet.tsx:47` · gates: `coach`
- [dialog] **(sin etiqueta)** — `components/school/SessionViewer.tsx:169`
- [button] **Ver jugada** — `components/school/SessionViewer.tsx:235` · gates: `!(isLoading) && blocks.length > 0 && drawing && block.id`
- [button] **Quitar marcador** — `components/school/TacticalBoard.tsx:228` · gates: `boardBlock`
- [button] **{`Quitar a ${subject.full_name} de la cancha`}** — `components/school/TacticalBoard.tsx:1050` · gates: `boardBlock && !readOnly`
- [dialog] **Tablero táctico —** — `components/school/TacticalBoard.tsx:2594` · gates: `boardBlock`
- [button] **Formación** — `components/school/TacticalBoard.tsx:2634` · gates: `boardBlock && !loading && !viewing`
- [menu_item] **jugadores** — `components/school/TacticalBoard.tsx:2643` · gates: `boardBlock && !loading && !viewing`
- [button] **Jugadores ( )** — `components/school/TacticalBoard.tsx:2655` · gates: `boardBlock && !loading && !viewing`
- [button] **Dibujar** — `components/school/TacticalBoard.tsx:2667` · gates: `boardBlock && !loading && !viewing`
- [button] **Material** — `components/school/TacticalBoard.tsx:2679` · gates: `boardBlock && !loading && !viewing` · abre: openMaterial
- [button] **Más** — `components/school/TacticalBoard.tsx:2692` · gates: `boardBlock && !loading && !viewing`
- [menu_item] **(() => handleLoadPreset(p.id))** — `components/school/TacticalBoard.tsx:2725` · gates: `boardBlock && !loading && !viewing`
- [menu_item] **Actualizar « »** — `components/school/TacticalBoard.tsx:2733` · gates: `boardBlock && !loading && !viewing && loadedPresetId && disabled: {updatePreset.isPending}` · W: PUT /api/v1/school/football/tactical-presets/:p
- [menu_item] **Volver a cargar « »** — `components/school/TacticalBoard.tsx:2736` · gates: `boardBlock && !loading && !viewing && loadedPresetId`
- [menu_item] **Eliminar « »** — `components/school/TacticalBoard.tsx:2739` · gates: `boardBlock && !loading && !viewing && loadedPresetId` · W: DELETE /api/v1/school/football/tactical-presets/:p
- [menu_item] **Guardar como jugada nueva… / Guardar en Mis jugadas…** — `components/school/TacticalBoard.tsx:2744` · gates: `boardBlock && !loading && !viewing`
- [button] **Guardar** — `components/school/TacticalBoard.tsx:2789` · gates: `boardBlock && !loading && !viewing && savingName !== null && disabled: {createPreset.isPending}` · W: POST /api/v1/school/football/tactical-presets
- [button] **✕** — `components/school/TacticalBoard.tsx:2792` · gates: `boardBlock && !loading && !viewing && savingName !== null`
- [button] **Detener / Reproducir** — `components/school/TacticalBoard.tsx:2805` · gates: `boardBlock && viewing && !loading && hasAnimation && liveFrames.length &lt; 2`
- [button] **Editar** — `components/school/TacticalBoard.tsx:2817` · gates: `boardBlock && viewing && !loading && roleCanEdit`
- [button] **Cerrar** — `components/school/TacticalBoard.tsx:2826` · gates: `boardBlock && viewing`
- [button] **Cancelar** — `components/school/TacticalBoard.tsx:2834` · gates: `boardBlock && !(viewing)`
- [button] **Guardar jugada** — `components/school/TacticalBoard.tsx:2837` · gates: `boardBlock && !(viewing) && disabled: {saveLineup.isPending \|\| loading \|\| playingSequence}` · W: POST /api/v1/school/football/lineups
- [button] **Poner jugadores ( F7 2-3-1 )** — `components/school/TacticalBoard.tsx:3001` · gates: `boardBlock && !(loading) && canEdit && pitchIsEmpty && !emptyHintDismissed && !tacticsOpen && !rosterOpen &…`
- [button] **Dibujar un ejercicio** — `components/school/TacticalBoard.tsx:3008` · gates: `boardBlock && !(loading) && canEdit && pitchIsEmpty && !emptyHintDismissed && !tacticsOpen && !rosterOpen &…` · abre: openDrawingFromHint
- [button] **Prefiero arrastrarlos yo** — `components/school/TacticalBoard.tsx:3016` · gates: `boardBlock && !(loading) && canEdit && pitchIsEmpty && !emptyHintDismissed && !tacticsOpen && !rosterOpen &…` · abre: setRosterOpen, setTacticsOpen
- [button] **Dibujando / Activar dibujo** — `components/school/TacticalBoard.tsx:3065` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && isMobile`
- [button] **{playingSequence ? 'Detener reproducción' : 'Reproducir jugada'}** — `components/school/TacticalBoard.tsx:3072` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && isMobile`
- [button] **Deshacer** — `components/school/TacticalBoard.tsx:3079` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && isMobile && disabled: {!canUndo}`
- [button] **Rehacer** — `components/school/TacticalBoard.tsx:3084` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && isMobile && disabled: {!canRedo}`
- [button] **Borrar todo** — `components/school/TacticalBoard.tsx:3089` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && isMobile && disabled: {arrows.length === 0}`
- [button] **Detener / Reproducir jugada** — `components/school/TacticalBoard.tsx:3116` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **Dibujando… / Modo dibujo** — `components/school/TacticalBoard.tsx:3126` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **{OBJECT_LABEL[type]}** — `components/school/TacticalBoard.tsx:3224` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **{`Color ${COLOR_LABEL[c]}`}** — `components/school/TacticalBoard.tsx:3251` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **+90°** — `components/school/TacticalBoard.tsx:3302` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **Duplicar** — `components/school/TacticalBoard.tsx:3313` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && selectedIsObject`
- [bulk] **Quitar el objeto seleccionado** — `components/school/TacticalBoard.tsx:3322` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && selectedIsObject`
- [button] **Deshacer** — `components/school/TacticalBoard.tsx:3344` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && disabled: {!canUndo}`
- [button] **Rehacer** — `components/school/TacticalBoard.tsx:3354` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && disabled: {!canRedo}`
- [button] **Borrar** — `components/school/TacticalBoard.tsx:3365` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing && disabled: {arrows.length === 0}`
- [button] **Midiendo… / Regla** — `components/school/TacticalBoard.tsx:3381` · gates: `boardBlock && !(loading) && tacticsOpen && !viewing`
- [button] **Sugerir XI** — `components/school/TacticalBoard.tsx:3417` · gates: `boardBlock && !(loading) && rosterOpen && !viewing && disabled: {!canSuggestXI}`
- [button] **+ a banca** — `components/school/TacticalBoard.tsx:3463` · gates: `boardBlock && !(loading) && rosterOpen && !viewing && availableSubjects.length > 0`
- [button] **Quitar de la banca** — `components/school/TacticalBoard.tsx:3490` · gates: `boardBlock && !(loading) && rosterOpen && !viewing`
- [dialog] **(sin etiqueta)** — `components/school/TacticalBoard.tsx:3517` · gates: `boardBlock`
- [button] **{playing ? 'Pausa' : 'Reproducir cuadros'}** — `components/school/TacticalTimeline.tsx:126` · gates: `boardBlock && disabled: {n &lt; 2}`
- [button] **{`Cuadro ${i + 1}`}** — `components/school/TacticalTimeline.tsx:167` · gates: `boardBlock`
- [button] **Cuadro** — `components/school/TacticalTimeline.tsx:190` · gates: `boardBlock && disabled: {n >= MAX_FRAMES \|\| locked}`
- [button] **Mover el cuadro a la izquierda** — `components/school/TacticalTimeline.tsx:211` · gates: `boardBlock && n > 1 && disabled: {locked \|\| currentIndex === 0}`
- [button] **Mover el cuadro a la derecha** — `components/school/TacticalTimeline.tsx:215` · gates: `boardBlock && n > 1 && disabled: {locked \|\| currentIndex >= n - 1}`
- [button] **Quitar este cuadro** — `components/school/TacticalTimeline.tsx:236` · gates: `boardBlock && n > 1 && disabled: {locked}`
- [button] **Repetir** — `components/school/TacticalTimeline.tsx:249` · gates: `boardBlock && n > 1`
- [dialog] **(sin etiqueta)** — `components/school/PlayerCard.tsx:56` · gates: `boardBlock && cardSubject && roster`

#### Pestaña «Sesiones» (`sesiones`) — CoachDetailSheet.tsx:89 · gate: coach

- [button] **Mesociclo** — `components/coach-activity/CoachDetailSheet.tsx:99` · gates: `coach && !(coach.sessions.length === 0)`

#### Pestaña «Asistencia» (`asistencia`) — CoachDetailSheet.tsx:90 · gate: coach

- [link] **Ver el histórico de asistencia → /attendance-history** — `components/coach-activity/CoachDetailSheet.tsx:138` · gates: `coach`

#### Pestaña «Documentos» (`documentos`) — CoachDetailSheet.tsx:92 · gate: coach

- [link] **Abrir el mesociclo de → /training-plans** — `components/coach-activity/CoachDetailSheet.tsx:182` · gates: `coach && coach.mesocycles.length > 0`

#### Pestaña «Evaluaciones» (`evaluaciones`) — CoachDetailSheet.tsx:91 · gate: coach

_(sin acciones; 0 controles menores)_

<a id="-teams"></a>
### Mis Equipos — `/teams`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Equipos y Planes > Mis Equipos
- **Archivo:** `frontend/src/pages/TeamsPage.tsx` (+24 componentes)
- **Gates:** allowedRoles=[autenticado (teams:view)] · ModuleGate=gestion_deportiva_equipos_planes · flags en código: VITE_COBROS_Y_PAGOS
- **Estado:** works · **Uso:** usado — teams s90=13 r90=80 tot=156
- ⚠ Duplicado funcional con /programs-management (ruta huérfana con su propia gestión de equipos).
- ⚠ «Cobrar al equipo» solo con VITE_COBROS_Y_PAGOS.
- **Escribe:** POST /api/v1/charge-batches, POST /api/v1/charge-batches/:p/annul, POST /api/v1/enrollments, POST /api/v1/payment-adjustments/:p/revert, POST /api/v1/payments/extract-receipt, POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, PUT /api/v1/students/:p, children.delete, children.insert, children.update, edge:send-email, enrollments.update, payments.insert, payments.update, profiles.update, rpc:admin_set_payer_billing_details, rpc:school_add_sport_category, rpc:school_sport_categories, school_members.update, team_branches.delete, team_branches.insert, team_coaches.delete, team_coaches.insert, teams.delete, teams.insert, teams.update, unregistered_athletes.update
- **Lee:** GET /api/bffClient, GET /api/v1/athletes/:p/:p/charge-suggestions, GET /api/v1/athletes/:p/:p/open-charges, GET /api/v1/charge-batches/:p, GET /api/v1/charge-batches/athlete-search:p, GET /api/v1/charge-batches/targets:p)}, GET /api/v1/charge-batches:p)}, GET /api/v1/payment-adjustments:p, POST /api/v1/charge-batches/preview, children.select, enrollments.select, offering_plans.select, payments.select, profiles.select, school_athletes.select, school_branches.select, school_categories.select, school_staff.select, sports_categories.select, team_branches.select, team_coaches.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Más acciones** — `pages/TeamsPage.tsx:375`
- [menu_item] **Cobrar a este equipo** — `pages/TeamsPage.tsx:381` · gates: `canChargeTeam && team.status !== 'inactive'` · abre: setChargeTeamId
- [menu_item] **Reactivar** — `pages/TeamsPage.tsx:387` · gates: `team.status === 'inactive'` · W: teams.update
- [menu_item] **Archivar** — `pages/TeamsPage.tsx:392` · gates: `!(team.status === 'inactive')`
- [menu_item] **Eliminar permanente** — `pages/TeamsPage.tsx:397`
- [button] **Limpiar Filtros** — `pages/TeamsPage.tsx:421` · gates: `(searchTerm \|\| statusFilter !== 'all')`
- [button] **Actualizar** — `pages/TeamsPage.tsx:434`
- [button] **Nuevo Equipo** — `pages/TeamsPage.tsx:439` · abre: setIsModalOpen
- [filter] **Buscar: Buscar por nombre, deporte o programa...** — `pages/TeamsPage.tsx:465`
- [filter] **Selector: Ordenar por** — `pages/TeamsPage.tsx:484`
- [button] **Ver activos** — `pages/TeamsPage.tsx:496`
- [button] **Crear Primer Equipo** — `pages/TeamsPage.tsx:557` · gates: `!(isLoading)` · abre: setIsModalOpen
- [button] **Gestionar Deportistas** — `pages/TeamsPage.tsx:781` · gates: `!(isLoading)` · abre: setIsEnrollModalOpen
- [button] **Editar Equipo** — `pages/TeamsPage.tsx:789` · gates: `!(isLoading)` · abre: setIsModalOpen
- [button] **Gestionar Deportistas** — `pages/TeamsPage.tsx:843` · gates: `!(isLoading)` · abre: setIsEnrollModalOpen
- [button] **Editar Equipo** — `pages/TeamsPage.tsx:856` · gates: `!(isLoading)` · abre: setIsModalOpen
- [button] **Gestionar / Editar** — `pages/TeamsPage.tsx:925` · gates: `!(isLoading)` · abre: setIsModalOpen
- [button] **Invitar padres** — `pages/TeamsPage.tsx:936` · gates: `!(isLoading)`
- [link] **WhatsApp → {`https://wa.me/?text=${waText}`}** — `pages/TeamsPage.tsx:948` · gates: `!(isLoading)`
- [button] **Copiar** — `pages/TeamsPage.tsx:957` · gates: `!(isLoading)`
- [dialog] **¿Archivar " "?** — `pages/TeamsPage.tsx:1035`
- [button] **Archivando... / Archivar** — `pages/TeamsPage.tsx:1043` · gates: `disabled: {actionLoading}` · W: teams.update
- [dialog] **¿Eliminar " " permanentemente?** — `pages/TeamsPage.tsx:1057`
- [button] **Eliminando... / Eliminar permanente** — `pages/TeamsPage.tsx:1065` · gates: `disabled: {actionLoading}` · W: teams.delete · R: enrollments.select, children.select
- [dialog] **Editar Equipo / Nuevo Equipo** — `components/teams/CreateTeamModal.tsx:510`
- [filter] **Selector: Seleccionar deporte** — `components/teams/CreateTeamModal.tsx:552`
- [button] **Cancelar / + Nueva categoria** — `components/teams/CreateTeamModal.tsx:590` · gates: `esMonodeporte && slugDeporte && ejeDeporte && ejeDeporte !== 'none'`
- [filter] **Selector: {!slugDeporte ? 'Elige un deporte primero' : cargandoCategorias ? 'Car…}** — `components/teams/CreateTeamModal.tsx:599` · gates: `disabled: {!slugDeporte}`
- [button] **Agregar** — `components/teams/CreateTeamModal.tsx:669` · gates: `creandoCategoria && disabled: {!catNombre.trim() \|\| agregarCategoria.isPending}` · W: rpc:school_add_sport_category, rpc:school_sport_categories
- [filter] **Selector: Seleccione un entrenador para agregar...** — `components/teams/CreateTeamModal.tsx:724` · gates: `!(loadingInitialData)`
- [filter] **Selector: {formData.status}** — `components/teams/CreateTeamModal.tsx:819`
- [filter] **Selector: Seleccione una sede para agregar...** — `components/teams/CreateTeamModal.tsx:850` · gates: `!(loadingInitialData)`
- [button] **Cancelar** — `components/teams/CreateTeamModal.tsx:928` · gates: `disabled: {creating}`
- [button] **Guardando... Guardar Cambios / Crear Equipo** — `components/teams/CreateTeamModal.tsx:936` · gates: `disabled: {creating}` · W: teams.update, teams.insert, team_coaches.delete, team_coaches.insert, team_branches.delete, team_branches.insert · R: teams.select
- [dialog] **Inscribir Deportistas** — `components/teams/EnrollTeamStudentModal.tsx:369`
- [filter] **Buscar: Buscar deportista por nombre, email o grado...** — `components/teams/EnrollTeamStudentModal.tsx:416`
- [button] **Remover** — `components/teams/EnrollTeamStudentModal.tsx:492` · gates: `!(loading) && !(pending) && disabled: {isCurrentlyEnrolling}` · W: enrollments.update, POST /api/v1/students/children-by-ids · R: enrollments.select, school_athletes.select
- [button] **Inscribir +** — `components/teams/EnrollTeamStudentModal.tsx:509` · gates: `!(loading) && !(pending) && disabled: {isCurrentlyEnrolling \|\| isFull}` · W: POST /api/v1/enrollments · R: GET /api/bffClient
- [button] **Cerrar** — `components/teams/EnrollTeamStudentModal.tsx:543`
- [dialog] **ya tiene equipo** — `components/teams/EnrollTeamStudentModal.tsx:569`
- [button] **Agregarlo también a Queda en los dos equipos. Este equipo no le gener…** — `components/teams/EnrollTeamStudentModal.tsx:581` · gates: `allowSecondaryTeamEnrollment && disabled: {!!pendingAction}` · W: POST /api/v1/enrollments · R: GET /api/bffClient
- [button] **Moverlo a Sale de . Sus cobros pendientes de ese equipo se anulan.** — `components/teams/EnrollTeamStudentModal.tsx:604` · gates: `!conflict?.hasPlan && disabled: {!!pendingAction}` · W: PUT /api/v1/students/:p · R: GET /api/bffClient
- [button] **Subir** — `components/common/ImageUpload.tsx:106` · gates: `!(preview) && disabled: {uploading}`
- [button] **Subiendo imagen... / Haz clic o arrastra una imagen JPG, PNG o WebP. …** — `components/common/ImageUpload.tsx:194` · gates: `!(preview) && disabled: {uploading}`
- ↪ componente compartido `components/common/MedicalAlertBadge.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/CobrosYPagosModal.tsx` (5 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/RegisterCashPaymentModal.tsx` (17 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/ResultScreen.tsx` (4 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/OperacionesTab.tsx` (13 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/NewAthleteForm.tsx` (5 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/AthletePicker.tsx` (4 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/MultiTargetPicker.tsx` (3 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PendingChargesSection.tsx` (8 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/NewChargeLines.tsx` (8 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/GlobalDiscount.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PaymentBlock.tsx` (6 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PreviewSummary.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/common/FileUpload.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/BillingDetailsForm.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/DiscountControl.tsx` (6 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/MunicipalitySelect.tsx` (1 acciones) — detallado en `/students`

<a id="-school-sports"></a>
### Deportes y Categorías — `/school-sports`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Equipos y Planes > Deportes y Categorías
- **Archivo:** `frontend/src/pages/SchoolSportsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=gestion_deportiva_equipos_planes · menú: solo escuelas multideporte (useIsMultiSport)
- **Estado:** hidden · **Uso:** usado — school_categories escuelas=3
- ⚠ Menú solo para escuelas multideporte (useIsMultiSport); las de un deporte gestionan categorías dentro de «Crear equipo».
- **Escribe:** rpc:school_add_sport_category, rpc:school_sport_categories
- **Lee:** sports_categories.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Agregar** — `pages/SchoolSportsPage.tsx:165` · gates: `disabled: {!nombre.trim() \|\| agregar.isPending}` · W: rpc:school_add_sport_category, rpc:school_sport_categories · **hidden**

#### Pestaña «{s.sport}» (`{s.sport}`) — SchoolSportsPage.tsx:229

_(sin acciones; 0 controles menores)_

<a id="-memberships"></a>
### Membresías — `/memberships`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Equipos y Planes > Membresías
- **Archivo:** `frontend/src/pages/MembershipsPage.tsx` (+1 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=gestion_deportiva_equipos_planes · menú: solo si billing_enabled = false (CAR-4)
- **Estado:** hidden · **Uso:** sin uso — memberships s90=0 r90=0 tot=0
- ⚠ Menú solo cuando billing_enabled = false: 1 de 371 escuelas. 0 filas en memberships → sin uso.
- **Escribe:** rpc:school_memberships_listado, rpc:school_set_membership
- **Lee:** children.select, profiles.select, school_athletes.select, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Cargar desde archivo** — `pages/MembershipsPage.tsx:151` · **hidden**
- [filter] **Selector: {filtro}** — `pages/MembershipsPage.tsx:196` · **hidden**
- [button] **Editar / Registrar** — `pages/MembershipsPage.tsx:246` · gates: `!(visibles.length === 0)` · **hidden**
- [dialog] **Editar membresía / Registrar membresía** — `pages/MembershipsPage.tsx:302` · **hidden**
- [filter] **Selector: {status}** — `pages/MembershipsPage.tsx:309` · **hidden**
- [button] **Cancelar** — `pages/MembershipsPage.tsx:351` · gates: `disabled: {guardando}` · **hidden**
- [button] **Guardar** — `pages/MembershipsPage.tsx:352` · gates: `disabled: {guardando}` · **hidden**
- [dialog] **Cargar membresías desde archivo** — `pages/MembershipsPage.tsx:471` · **hidden**
- [button] **Cancelar** — `pages/MembershipsPage.tsx:533` · gates: `disabled: {cargando}` · **hidden**
- [button] **Cargando…** — `pages/MembershipsPage.tsx:534` · gates: `disabled: {cargando \|\| listas.length === 0}` · **hidden**

<a id="-offerings"></a>
### Mis Planes (ofertas) — `/offerings`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Equipos y Planes > Mis Planes
- **Otras entradas:** Acción rápida: Ver Planes
- **Archivo:** `frontend/src/pages/OfferingsPage.tsx` (+7 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=gestion_deportiva_equipos_planes
- **Estado:** works · **Uso:** usado — offering_plans s90=11 r90=72 tot=158; offerings r90=41
- ⚠ Incluye clases de prueba (trial-classes-self) que también se comparten desde /facilities (ShareTrialLinkDialog).
- **Escribe:** DELETE /api/v1/offerings/:p, DELETE /api/v1/offerings/:p/coaches/:p, DELETE /api/v1/offerings/:p/plans/:p, DELETE /api/v1/school-staff/:p, PATCH /api/v1/offerings/:p, PATCH /api/v1/offerings/:p/plans/:p, PATCH /api/v1/school-staff/:p, PATCH /api/v1/trial-classes-self/:p/cancel, PATCH /api/v1/trial-classes-self/:p/reschedule, POST /api/v1/enrollments, POST /api/v1/enrollments/plan-change-preview, POST /api/v1/invitations/bulk-send, POST /api/v1/offerings, POST /api/v1/offerings/:p/coaches, POST /api/v1/offerings/:p/plans, POST /api/v1/offerings/one-time-fees/apply, POST /api/v1/school-staff, POST /api/v1/school/competition-results/individual, POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, POST /api/v1/trial-classes-self, PUT /api/v1/school/level-progression/settings, PUT /api/v1/trial-classes-self/settings, children.delete, children.insert, children.update, facilities.delete, facilities.insert, facilities.update, match_results.insert, school_members.update, training_sessions.insert, unregistered_athletes.update
- **Lee:** GET /api/bffClient, GET /api/v1/offerings/:p/coaches, GET /api/v1/offerings:p, GET /api/v1/school-staff, GET /api/v1/school/level-progression/athletes, GET /api/v1/school/level-progression/eligibility, GET /api/v1/school/level-progression/settings, GET /api/v1/trial-classes-self, GET /api/v1/trial-classes-self/categories, GET /api/v1/trial-classes-self/is-first, GET /api/v1/trial-classes-self/settings, GET /api/v1/trial-classes-self/slots, children.select, enrollments.select, facilities.select, match_results.select, school_athletes.select, schools.select, sports_categories.select, team_coaches.select, teams.select, training_sessions.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [filter] **Selector: {selectedTime}** — `components/universal/OfferingsManagement.tsx:240`
- [button] **Agregar** — `components/universal/OfferingsManagement.tsx:251`
- [filter] **Buscar: {values.length > 0 ? 'Cambiar deporte...' : 'Buscar deporte (ej: Fútbo…}** — `components/universal/OfferingsManagement.tsx:380`
- [button] **Compartir link** — `components/universal/OfferingsManagement.tsx:825` · gates: `ssSettings?.self_service_enabled && disabled: {!schoolSlug}` · abre: setShareOpen
- [button] **Inscripción y seguro** — `components/universal/OfferingsManagement.tsx:836` · gates: `tarifasMensuales.length > 0` · R: GET /api/v1/offerings:p
- [button] **Nuevo Plan** — `components/universal/OfferingsManagement.tsx:846`
- [button] **Crear primer plan** — `components/universal/OfferingsManagement.tsx:861` · gates: `offerings.length === 0`
- [link] **WhatsApp → {`https://wa.me/?text=${waText}`}** — `components/universal/OfferingsManagement.tsx:885` · gates: `!(offerings.length === 0)`
- [button] **Copiar** — `components/universal/OfferingsManagement.tsx:894` · gates: `!(offerings.length === 0)`
- [dialog] **✏️ Editar Plan / ✨ Nuevo Plan** — `components/universal/OfferingsManagement.tsx:914`
- [filter] **Selector: Seleccionar tipo** — `components/universal/OfferingsManagement.tsx:938`
- [filter] **Selector: Seleccionar instalación...** — `components/universal/OfferingsManagement.tsx:991` · gates: `bookingModeToggleEnabled && newOffering.booking_mode !== 'coach'`
- [button] **Cancelar** — `components/universal/OfferingsManagement.tsx:1036`
- [button] **(handleSaveOffering)** — `components/universal/OfferingsManagement.tsx:1037` · gates: `disabled: {!newOffering.name \|\| isSavingOffering \|\| (newOffering.book…` · W: PATCH /api/v1/offerings/:p, POST /api/v1/offerings
- [dialog] **✏️ Editar Tarifa / 💰 Nueva Tarifa** — `components/universal/OfferingsManagement.tsx:1056`
- [button] **Ir a Inscripción y Seguro** — `components/universal/OfferingsManagement.tsx:1073` · gates: `bloquearNombreDePlan(newPlan.name, editingPlanId ? planOriginalName : null)`
- [button] **Quitar los dos (no cobrar inscripción ni seguro)** — `components/universal/OfferingsManagement.tsx:1174` · gates: `(newPlan.registration_fee \|\| newPlan.insurance_fee)`
- [filter] **Selector: Seleccionar duración** — `components/universal/OfferingsManagement.tsx:1188`
- [toggle] **Plan por horas (banco de horas) En vez de contar clases, cu…** — `components/universal/OfferingsManagement.tsx:1237`
- [button] **General / Específico** — `components/universal/OfferingsManagement.tsx:1360`
- [button] **Cancelar** — `components/universal/OfferingsManagement.tsx:1397`
- [button] **(() => showCreatePlan && handleSavePlan(showCreatePlan))** — `components/universal/OfferingsManagement.tsx:1398` · gates: `disabled: {!newPlan.name \|\| !newPlan.price \|\| isSavingPlan}` · W: PATCH /api/v1/offerings/:p/plans/:p, POST /api/v1/offerings/:p/plans
- [dialog] **No se puede guardar con ese nombre** — `components/universal/OfferingsManagement.tsx:1442`
- [button] **Ir a Inscripción y Seguro / Configurar inscripción y seguro** — `components/universal/OfferingsManagement.tsx:1447`
- [dialog] **Pagos únicos al inscribirse** — `components/universal/OfferingsManagement.tsx:1458`
- [button] **Cancelar** — `components/universal/OfferingsManagement.tsx:1521`
- [button] **Aplicando...** — `components/universal/OfferingsManagement.tsx:1522` · gates: `disabled: {bulkPlanIds.length === 0 \|\| applyOneTimeFees.isPending}` · W: POST /api/v1/offerings/one-time-fees/apply
- [dialog] **¿Eliminar tarifa?** — `components/universal/OfferingsManagement.tsx:1539`
- [button] **Eliminando... / Eliminar Tarifa** — `components/universal/OfferingsManagement.tsx:1547` · gates: `disabled: {isDeletingPlan}` · W: DELETE /api/v1/offerings/:p/plans/:p
- [dialog] **¿Eliminar plan completo?** — `components/universal/OfferingsManagement.tsx:1561`
- [button] **Eliminando... / Eliminar Plan** — `components/universal/OfferingsManagement.tsx:1569` · gates: `disabled: {isDeletingOffering}` · W: DELETE /api/v1/offerings/:p · R: GET /api/v1/offerings:p
- [button] **Eliminar plan** — `components/universal/OfferingsManagement.tsx:1647` · gates: `onDeleteOffering`
- [button] **Editar configuración** — `components/universal/OfferingsManagement.tsx:1660`
- [button] **Inscribir** — `components/universal/OfferingsManagement.tsx:1757` · gates: `plans.length > 0 && onEnroll`
- [button] **Invitar** — `components/universal/OfferingsManagement.tsx:1769` · gates: `plans.length > 0 && onCopyJoinLink`
- [button] **Editar tarifa** — `components/universal/OfferingsManagement.tsx:1781` · gates: `plans.length > 0 && onEditPlan`
- [button] **Eliminar tarifa** — `components/universal/OfferingsManagement.tsx:1792` · gates: `plans.length > 0 && onDeletePlan`
- [button] **Agregar Tarifa** — `components/universal/OfferingsManagement.tsx:1810`
- [filter] **Selector: Seleccionar de la escuela...** — `components/universal/OfferingCoachesPanel.tsx:63` · gates: `editingOfferingId && available.length > 0`
- [button] **Autorizar** — `components/universal/OfferingCoachesPanel.tsx:81` · gates: `editingOfferingId && available.length > 0 && disabled: {!selectedCoach \|\| isAssigning}` · W: POST /api/v1/offerings/:p/coaches
- [filter] **Buscar: Buscar por nombre...** — `components/universal/OfferingCoachesPanel.tsx:101` · gates: `editingOfferingId && assigned.length > 4`
- [button] **Revocar acceso** — `components/universal/OfferingCoachesPanel.tsx:148` · gates: `editingOfferingId && !(assigned.length === 0) && disabled: {isRemoving}` · W: DELETE /api/v1/offerings/:p/coaches/:p
- [filter] **Selector: {value.min_level \|\| 'any'}** — `components/universal/PlanLevelRulesSection.tsx:130` · gates: `progressionEnabled`
- [dialog] **Inscribir en Plan** — `components/enrollment/EnrollPlanStudentModal.tsx:299`
- [filter] **Buscar: Buscar por nombre o email...** — `components/enrollment/EnrollPlanStudentModal.tsx:322`
- [button] **Remover** — `components/enrollment/EnrollPlanStudentModal.tsx:391` · gates: `!(loading) && plan && alreadyEnrolled.length > 0 && disabled: {isCurrentlyEnrolling}` · R: enrollments.select
- [button] **Inscribir** — `components/enrollment/EnrollPlanStudentModal.tsx:441` · gates: `!(loading) && availableStudents.length > 0 && disabled: {isCurrentlyEnrolling}` · W: POST /api/v1/enrollments/plan-change-preview, POST /api/v1/enrollments · R: GET /api/bffClient
- [button] **Cerrar** — `components/enrollment/EnrollPlanStudentModal.tsx:477`
- [dialog] **Compartir link de clases de prueba** — `components/school/ShareTrialLinkDialog.tsx:70` · gates: `trialPublicUrl`
- [button] **Copiado / Copiar** — `components/school/ShareTrialLinkDialog.tsx:84` · gates: `trialPublicUrl`
- [export] **Descargar QR** — `components/school/ShareTrialLinkDialog.tsx:97` · gates: `trialPublicUrl`
- [button] **WhatsApp** — `components/school/ShareTrialLinkDialog.tsx:103` · gates: `trialPublicUrl`
- [link] **WhatsApp → {waHref}** — `components/school/ShareTrialLinkDialog.tsx:104` · gates: `trialPublicUrl`
- [button] **Compartir** — `components/school/ShareTrialLinkDialog.tsx:108` · gates: `trialPublicUrl`
- ↪ componente compartido `components/common/MedicalAlertBadge.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/students/PlanChangeDialog.tsx` (4 acciones) — detallado en `/students`

<a id="-calendar"></a>
### Calendario — `/calendar`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Calendario
- **Otras entradas:** Acción rápida: Calendario
- **Archivo:** `frontend/src/pages/CalendarPage.tsx` (+3 componentes)
- **Gates:** allowedRoles=[autenticado (calendar:view)] · ModuleGate=gestion_deportiva_calendario
- **Estado:** works · **Uso:** usado — calendar_events s90=5 r90=106 tot=114
- **Escribe:** calendar_events.delete, calendar_events.insert, calendar_events.update
- **Lee:** calendar_events.select, coach_profiles.select, profiles.select, school_staff.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nuevo Evento** — `pages/CalendarPage.tsx:611`
- [button] **Hoy** — `pages/CalendarPage.tsx:632`
- [button] **+** — `pages/CalendarPage.tsx:661`
- [button] **Crear Evento** — `pages/CalendarPage.tsx:718` · gates: `upcomingEvents.length === 0`
- [dialog] **Editar Evento / Crear Nuevo Evento** — `pages/CalendarPage.tsx:871`
- [filter] **Selector: Elige el equipo** — `pages/CalendarPage.tsx:911` · gates: `isStaff && schoolId`
- [filter] **Selector: {formData.event_type}** — `pages/CalendarPage.tsx:937`
- [button] **Seleccionar fecha** — `pages/CalendarPage.tsx:968`
- [button] **Seleccionar fecha** — `pages/CalendarPage.tsx:1012`
- [button] **Eliminar** — `pages/CalendarPage.tsx:1071` · gates: `editingEvent && disabled: {isSaving \|\| deleteMutation.isPending}` · W: calendar_events.delete
- [button] **Cancelar** — `pages/CalendarPage.tsx:1082`
- [button] **Guardar Cambios / Crear Evento** — `pages/CalendarPage.tsx:1083` · gates: `disabled: {isSaving \|\| !formData.startDate \|\| !formData.endDate \|\| (i…` · W: calendar_events.update, calendar_events.insert

<a id="-training-plans"></a>
### Métricas y Rendimiento (sesiones) — `/training-plans`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Entrenamiento > Métricas y Rendimiento
- **Archivo:** `frontend/src/pages/TrainingPlansPage.tsx` (+34 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=gestion_deportiva_entrenamiento_metricas
- **Estado:** works · **Uso:** usado — training_sessions s90=4 r90=67 tot=70; training_mesocycles s90=4 r90=16 tot=16; performance_entries s90=8 r90=1367 tot=1393
- ⚠ La pantalla más grande del área deportiva (13 pestañas). Para el coach se llama «Sesiones de Entrenamiento»; para la escuela «Métricas y Rendimiento».
- **Escribe:** DELETE /api/v1/school/exercises/:p, DELETE /api/v1/school/football/events/:p, DELETE /api/v1/school/football/lineups/:p, DELETE /api/v1/school/football/tactical-presets/:p, DELETE /api/v1/school/performance/entries/:p, POST /api/v1/school/exercises, POST /api/v1/school/exercises/:p/insert-into-session, POST /api/v1/school/football/events, POST /api/v1/school/football/lineups, POST /api/v1/school/football/tactical-presets, POST /api/v1/school/performance/entries, PUT /api/v1/school/exercises/:p, PUT /api/v1/school/football/tactical-presets/:p, PUT /api/v1/school/performance/entries/:p, match_results.delete, match_results.insert, match_results.update, performance_entries.insert, rpc:athlete_weekly_load, rpc:create_mesocycle_with_weeks, rpc:delete_mesocycle_cascade, rpc:duplicate_microcycle_days, rpc:merge_mesocycle_closing_review, rpc:training_days_md_labels, training_mesocycle_documents.delete, training_mesocycle_documents.insert, training_mesocycle_evaluations.upsert, training_mesocycles.update, training_microcycle_days.insert, training_microcycles.update, training_sessions.delete, training_sessions.insert, training_sessions.update
- **Lee:** GET /api/v1/athlete/performance/entries:p, GET /api/v1/athlete/performance/evolution, GET /api/v1/school/exercises/:p, GET /api/v1/school/football/events, GET /api/v1/school/football/lineups, GET /api/v1/school/football/lineups/:p, GET /api/v1/school/football/season-stats, GET /api/v1/school/football/tactical-presets, GET /api/v1/school/football/tournament-matches, GET /api/v1/school/performance/entries, GET /api/v1/school/performance/metrics, GET /api/v1/school/performance/roster, GET /api/v1/school/performance/subjects/:p/:p/evolution, match_results.select, offering_plans.select, performance_entries.select, rpc:training_load_summary, school_athletes.select, school_staff.select, teams.select, training_mesocycle_documents.select, training_mesocycle_evaluations.select, training_mesocycles.select, training_microcycle_days.select, training_microcycles.select, training_sessions.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Seguimiento deportivo** — `pages/TrainingPlansPage.tsx:322` · gates: `isAdminRole`
- [link] **Seguimiento deportivo → /seguimiento-deportivo** — `pages/TrainingPlansPage.tsx:323` · gates: `isAdminRole`
- [button] **Crear Sesión** — `pages/TrainingPlansPage.tsx:338` · gates: `!isAdminRole && filterType === 'teams' && selectedTeamId && !currentMesocycle` · abre: setDialogOpen
- [filter] **Selector: {isAdminRole ? 'Selecciona un equipo' : 'Selecciona tu equipo'}** — `pages/TrainingPlansPage.tsx:379` · gates: `filterType === 'teams'` · abre: setSelectedTeamId
- [filter] **Selector: {isAdminRole ? 'Selecciona un plan' : 'Selecciona tu plan'}** — `pages/TrainingPlansPage.tsx:394` · gates: `!(filterType === 'teams')` · abre: setSelectedPlanId
- [button] **Editar** — `pages/TrainingPlansPage.tsx:457` · gates: `filterType === 'teams' && selectedTeamId && !currentMesocycle && sessions && sessions.length > 0` · abre: setDialogOpen
- [button] **Tablero táctico** — `pages/TrainingPlansPage.tsx:501` · gates: `filterType === 'teams' && selectedTeamId && !currentMesocycle && sessions && sessions.length > 0 && blocks.length > 0 && isFootballTeam` · W: training_sessions.update · abre: openBlockTacticalBoard
- [button] **Crear Primera Sesión** — `pages/TrainingPlansPage.tsx:638` · gates: `filterType === 'teams' && selectedTeamId && !currentMesocycle && sessions && sessions.length === 0 && !isLoading && !isAdminRole` · abre: setDialogOpen
- [button] **Evaluar Lote** — `pages/TrainingPlansPage.tsx:708` · gates: `activeId && !isAdminRole && disabled: {roster.length === 0}` · abre: setPerformanceDialogOpen
- [button] **Fútbol** — `pages/TrainingPlansPage.tsx:721` · gates: `activeId` · abre: setFootballDialogOpen
- [button] **Tarjeta** — `pages/TrainingPlansPage.tsx:765` · gates: `activeId && !(loadingRoster) && performanceSubjectById.get(student.id)`
- [button] **Evolución** — `pages/TrainingPlansPage.tsx:775` · gates: `activeId && !(loadingRoster)`
- [button] **Evaluar** — `pages/TrainingPlansPage.tsx:785` · gates: `activeId && !(loadingRoster) && !isAdminRole`
- [dialog] **¿Eliminar sesión?** — `pages/TrainingPlansPage.tsx:893`
- [button] **Eliminar** — `pages/TrainingPlansPage.tsx:900` · W: training_sessions.delete
- [button] **Semana anterior** — `components/school/WeekSessionsPanel.tsx:148` · gates: `isAdminRole && schoolId`
- [button] **Esta semana** — `components/school/WeekSessionsPanel.tsx:151` · gates: `isAdminRole && schoolId && disabled: {weekOffset === 0}`
- [button] **Semana siguiente** — `components/school/WeekSessionsPanel.tsx:154` · gates: `isAdminRole && schoolId`
- [button] **· Mesociclo bloque s** — `components/school/WeekSessionsPanel.tsx:188` · gates: `isAdminRole && schoolId && !(isLoading)`
- [button] **Ir al equipo** — `components/school/WeekSessionsPanel.tsx:212` · gates: `isAdminRole && schoolId && !(isLoading)`
- [button] **Crear Mesociclo** — `components/coach/MesocycleSection.tsx:571` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !(readOnly)` · abre: setFormOpen
- [button] **Enganchar** — `components/coach/MesocycleSection.tsx:675` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly && disabled: {linkLooseSession.isPending}` · W: training_microcycle_days.insert, training_sessions.update
- [button] **Elegir** — `components/coach/MesocycleSection.tsx:753` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [filter] **Selector: {newDay.day_type}** — `components/coach/MesocycleSection.tsx:777` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Guardar** — `components/coach/MesocycleSection.tsx:807` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly && disabled: {!newDay.day_date \|\| createDay.isPending}` · W: training_microcycle_days.insert
- [button] **Cancelar** — `components/coach/MesocycleSection.tsx:815` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Agregar sesión** — `components/coach/MesocycleSection.tsx:824` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly && disabled: {createDayForSession.isPending}`
- [button] **(() => addSessionOn(mc, date))** — `components/coach/MesocycleSection.tsx:836` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly` · W: training_microcycle_days.insert
- [button] **Más** — `components/coach/MesocycleSection.tsx:857` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [menu_item] **Planificar un día (partido, descanso…)** — `components/coach/MesocycleSection.tsx:863` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [menu_item] **Duplicar semana anterior** — `components/coach/MesocycleSection.tsx:868` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly && idx > 0 && disabled: {duplicatePreviousWeek.isPending}` · W: rpc:duplicate_microcycle_days
- [filter] **Selector: {mesocycle.id}** — `components/coach/MesocycleSection.tsx:900` · gates: `filterType === 'teams' && selectedTeamId && schoolId && (mesocycles?.length ?? 0) > 1` · abre: setSelectedMesoId
- [button] **Acciones del mesociclo** — `components/coach/MesocycleSection.tsx:919` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [menu_item] **Nuevo mesociclo** — `components/coach/MesocycleSection.tsx:924` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly` · abre: setFormOpen
- [menu_item] **Editar** — `components/coach/MesocycleSection.tsx:928` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly` · abre: setFormOpen
- [menu_item] **Eliminar** — `components/coach/MesocycleSection.tsx:933` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Ver menos** — `components/coach/MesocycleSection.tsx:955` · gates: `filterType === 'teams' && selectedTeamId && schoolId && objectiveIsLong`
- [dialog] **¿Eliminar este mesociclo?** — `components/coach/MesocycleSection.tsx:1137` · gates: `filterType === 'teams' && selectedTeamId && schoolId`
- [button] **Eliminar** — `components/coach/MesocycleSection.tsx:1145` · gates: `filterType === 'teams' && selectedTeamId && schoolId && disabled: {deleteMesocycle.isPending}` · W: rpc:delete_mesocycle_cascade
- [dialog] **Editar Sesión de Entrenamiento / Crear Sesión de Entrenamiento** — `components/coach/SessionFormDialog.tsx:350` · gates: `filterType === 'teams' && selectedTeamId`
- [button] **Selecciona una fecha** — `components/coach/SessionFormDialog.tsx:368` · gates: `filterType === 'teams' && selectedTeamId`
- [button] **Agregar Bloque** — `components/coach/SessionFormDialog.tsx:454` · gates: `filterType === 'teams' && selectedTeamId && isFootball`
- [button] **Abrir tablero táctico para este bloque** — `components/coach/SessionFormDialog.tsx:476` · gates: `filterType === 'teams' && selectedTeamId && isFootball` · abre: openBlockTacticalBoard
- [filter] **Selector: Componente** — `components/coach/SessionFormDialog.tsx:503` · gates: `filterType === 'teams' && selectedTeamId && isFootball`
- [button] **Desde la biblioteca** — `components/coach/SessionFormDialog.tsx:518` · gates: `filterType === 'teams' && selectedTeamId && isFootball` · abre: openBlockLibrary
- [button] **Agregar Ejercicio** — `components/coach/SessionFormDialog.tsx:552` · gates: `filterType === 'teams' && selectedTeamId && !(isFootball)`
- [filter] **Selector: Selecciona una opción** — `components/coach/SessionFormDialog.tsx:618` · gates: `filterType === 'teams' && selectedTeamId && isFootball`
- [button] **{`${n} estrellas`}** — `components/coach/SessionFormDialog.tsx:637` · gates: `filterType === 'teams' && selectedTeamId && isFootball`
- [filter] **Selector: Sin registrar** — `components/coach/SessionFormDialog.tsx:661` · gates: `filterType === 'teams' && selectedTeamId && isFootball`
- [button] **Cancelar** — `components/coach/SessionFormDialog.tsx:699` · gates: `filterType === 'teams' && selectedTeamId`
- [button] **Guardando...** — `components/coach/SessionFormDialog.tsx:702` · gates: `filterType === 'teams' && selectedTeamId && disabled: {isLoading}` · W: training_sessions.update, training_sessions.insert
- [dialog] **Evaluación rápida del equipo** — `components/school/TeamPerformanceEntryModal.tsx:197` · gates: `activeId`
- [button] **Seleccionar fecha** — `components/school/TeamPerformanceEntryModal.tsx:240` · gates: `activeId && !(isLoading)`
- [button] **Evaluación completa ( más)** — `components/school/TeamPerformanceEntryModal.tsx:291` · gates: `activeId && !(isLoading) && !((showFull \|\| quickMetrics.length === 0) && subcategoryKeys.length > 0) && fullMetrics.length > 0`
- [button] **Cancelar** — `components/school/TeamPerformanceEntryModal.tsx:400` · gates: `activeId && disabled: {createEntries.isPending}`
- [button] **Guardando...** — `components/school/TeamPerformanceEntryModal.tsx:403` · gates: `activeId && disabled: {createEntries.isPending \|\| nothingToCapture \|\| subjects.le…` · W: POST /api/v1/school/performance/entries
- [dialog] **Panorama de fútbol** — `components/school/FootballDashboardModal.tsx:131` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId`
- [dialog] **Programar Partido** — `components/school/FootballDashboardModal.tsx:418` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId`
- [filter] **Selector: {matchType}** — `components/school/FootballDashboardModal.tsx:448` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId`
- [filter] **Selector: {isHome}** — `components/school/FootballDashboardModal.tsx:466` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId`
- [button] **Cancelar** — `components/school/FootballDashboardModal.tsx:519` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && disabled: {isPending}`
- [button] **Creando...** — `components/school/FootballDashboardModal.tsx:522` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && disabled: {isPending \|\| !opponent.trim()}`
- [dialog] **Evaluación rápida** — `components/school/PerformanceEntryModal.tsx:162` · gates: `individualStudent`
- [button] **Seleccionar fecha** — `components/school/PerformanceEntryModal.tsx:200` · gates: `individualStudent && !(loadingMetrics)`
- [button] **Evaluación completa ( métricas más) · con valor** — `components/school/PerformanceEntryModal.tsx:254` · gates: `individualStudent && !(loadingMetrics) && fullMetrics.length > 0`
- [button] **Cancelar** — `components/school/PerformanceEntryModal.tsx:340` · gates: `individualStudent && disabled: {createEntries.isPending}`
- [button] **Guardando...** — `components/school/PerformanceEntryModal.tsx:343` · gates: `individualStudent && disabled: {createEntries.isPending \|\| nothingToCapture \|\| filledCount…` · W: POST /api/v1/school/performance/entries
- [dialog] **Historial y Evolución** — `components/school/AthleteEvolutionModal.tsx:70` · gates: `evolutionStudent`
- [button] **Crear sesión / Agregar otra** — `components/coach/StandaloneMicrocyclesPanel.tsx:183` · gates: `filterType === 'teams' && selectedTeamId && schoolId && day.day_type !== 'descanso' && !readOnly` · abre: setSessionDialogDay
- [dialog] **Editar Mesociclo / Crear Mesociclo** — `components/coach/MesocycleFormDialog.tsx:127` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Selecciona fecha** — `components/coach/MesocycleFormDialog.tsx:146` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Selecciona fecha** — `components/coach/MesocycleFormDialog.tsx:182` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [filter] **Selector: {form.watch('evaluation_mode')}** — `components/coach/MesocycleFormDialog.tsx:238` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Cancelar** — `components/coach/MesocycleFormDialog.tsx:257` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly`
- [button] **Guardando...** — `components/coach/MesocycleFormDialog.tsx:260` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !readOnly && disabled: {isLoading}` · W: rpc:create_mesocycle_with_weeks
- [export] **Exportar PDF** — `components/coach/MesocycleExportButton.tsx:725` · gates: `filterType === 'teams' && selectedTeamId && schoolId && disabled: {isGenerating}` · R: training_mesocycles.select, training_microcycles.select, training_microcycle_days.select, training_sessions.select, training_mesocycle_evaluations.select, GET /api/v1/school/football/lineups
- [dialog] **Biblioteca de ejercicios** — `components/school/ExerciseLibraryPanel.tsx:99` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id`
- [filter] **Buscar: Buscar por nombre u objetivo (ej: rondo, presión)** — `components/school/ExerciseLibraryPanel.tsx:141` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id && !(viewing)`
- [button] **Reintentar** — `components/school/ExerciseLibraryPanel.tsx:175` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id && !(viewing) && !(isLoading)`
- [button] **{`Ver ${exercise.name}`}** — `components/school/ExerciseLibraryPanel.tsx:256` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id`
- [button] **Ver** — `components/school/ExerciseLibraryPanel.tsx:266` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id`
- [button] **Aplicando…** — `components/school/ExerciseLibraryPanel.tsx:268` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id && onPick && disabled: {picking}` · W: POST /api/v1/school/exercises/:p/insert-into-session
- [button] **Volver a la biblioteca** — `components/school/ExerciseLibraryPanel.tsx:291` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id`
- [button] **Aplicando…** — `components/school/ExerciseLibraryPanel.tsx:320` · gates: `filterType === 'teams' && selectedTeamId && libraryBlockIndex !== null && blocks[libraryBlockIndex]?.id && onPick && disabled: {picking}` · W: POST /api/v1/school/exercises/:p/insert-into-session
- [button] **{c.label}** — `components/school/QuickMetricInput.tsx:72` · gates: `activeId && !(isLoading) && onQuickTab`
- [dialog] **Editar Resultado / Registrar Resultado** — `components/coach/MatchResultFormDialog.tsx:141` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && editingMatch`
- [filter] **Selector: Selecciona** — `components/coach/MatchResultFormDialog.tsx:199` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && editingMatch`
- [filter] **Selector: {form.watch('is_home')}** — `components/coach/MatchResultFormDialog.tsx:228` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && editingMatch`
- [button] **Cancelar** — `components/coach/MatchResultFormDialog.tsx:275` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && editingMatch`
- [button] **Guardando...** — `components/coach/MatchResultFormDialog.tsx:278` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && editingMatch && disabled: {isLoading}` · W: match_results.update
- [button] **Ubicar en la cancha** — `components/school/LineupModal.tsx:276` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [button] **Banco (suplente)** — `components/school/LineupModal.tsx:297` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [button] **{`Quitar a ${subject.full_name} de la cancha`}** — `components/school/LineupModal.tsx:358` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [button] **Al banco** — `components/school/LineupModal.tsx:418` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [button] **Quitar** — `components/school/LineupModal.tsx:421` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [dialog] **Alineación** — `components/school/LineupModal.tsx:788` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch`
- [filter] **Selector: Elegir formación** — `components/school/LineupModal.tsx:834` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && !(isLoading) && !(customFormation)`
- [button] **Presets / Otra** — `components/school/LineupModal.tsx:846` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && !(isLoading)`
- [button] **Jugadores: disponibles · en banco** — `components/school/LineupModal.tsx:905` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && !(isLoading)` · abre: setRosterPanelOpen
- [filter] **Buscar: Buscar jugador...** — `components/school/LineupModal.tsx:920` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && !(isLoading)`
- [button] **Cancelar** — `components/school/LineupModal.tsx:1064` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && disabled: {saveLineup.isPending}`
- [button] **Guardando...** — `components/school/LineupModal.tsx:1067` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && lineupMatch && disabled: {saveLineup.isPending \|\| subjects.length === 0}` · W: POST /api/v1/school/football/lineups
- [dialog] **Eventos del partido** — `components/school/MatchEventsModal.tsx:92` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch`
- [button] **(() => deleteEvent.mutate(e.id))** — `components/school/MatchEventsModal.tsx:122` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch && !(players.length === 0) && !(isLoading) && disabled: {deleteEvent.isPending}` · W: DELETE /api/v1/school/football/events/:p
- [filter] **Selector: Jugador** — `components/school/MatchEventsModal.tsx:138` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch && !(players.length === 0)`
- [filter] **Selector: {draftType}** — `components/school/MatchEventsModal.tsx:151` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch && !(players.length === 0)`
- [button] **Cancelar** — `components/school/MatchEventsModal.tsx:199` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch && disabled: {createEvents.isPending}`
- [button] **Guardando...** — `components/school/MatchEventsModal.tsx:202` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && eventsMatch && disabled: {createEvents.isPending \|\| staged.length === 0}` · W: POST /api/v1/school/football/events
- [bulk] **· seleccionada** — `components/performance/MetricSparklineGrid.tsx:100` · gates: `evolutionStudent && !(isLoading)`
- [button] **= 1 medición** — `components/performance/MetricSparklineGrid.tsx:137` · gates: `evolutionStudent && !(isLoading) && isSectionOpen`
- ↪ componente compartido `components/school/TacticalBoard.tsx` (44 acciones) — detallado en `/seguimiento-deportivo`
- ↪ componente compartido `components/school/PlayerCard.tsx` (1 acciones) — detallado en `/seguimiento-deportivo`
- ↪ componente compartido `components/school/SessionViewer.tsx` (2 acciones) — detallado en `/seguimiento-deportivo`
- ↪ componente compartido `components/school/TacticalTimeline.tsx` (7 acciones) — detallado en `/seguimiento-deportivo`

#### Pestaña «Plan» (`plan`) — MesocycleSection.tsx:976

_(sin acciones; 1 controles menores)_

#### Pestaña «Carga» (`carga`) — MesocycleSection.tsx:977

- [button] **Semana** — `components/coach/MesocycleSection.tsx:1033` · gates: `filterType === 'teams' && selectedTeamId && schoolId && loadWeek` · abre: setLoadWeekId

#### Pestaña «Partidos de Club» (`matches`) — FootballDashboardModal.tsx:137

- [button] **Programar Partido** — `components/school/FootballDashboardModal.tsx:151` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId` · abre: setShowCreateDialog
- [button] **Alineación** — `components/school/FootballDashboardModal.tsx:193` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingMatches)`
- [button] **Tablero táctico** — `components/school/FootballDashboardModal.tsx:201` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingMatches)`
- [button] **Eventos** — `components/school/FootballDashboardModal.tsx:209` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingMatches)`
- [button] **Editar resultado** — `components/school/FootballDashboardModal.tsx:218` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingMatches) && canEditResults`
- [button] **(() => handleDeleteMatch(m.id))** — `components/school/FootballDashboardModal.tsx:229` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingMatches) && canDeleteResults && disabled: {deleteMatch.isPending}` · W: match_results.delete

#### Pestaña «Torneos Oficiales» (`tournaments`) — FootballDashboardModal.tsx:140

- [button] **Alineación** — `components/school/FootballDashboardModal.tsx:286` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingTournamentMatches)`
- [button] **Tablero táctico** — `components/school/FootballDashboardModal.tsx:294` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingTournamentMatches)`
- [button] **Eventos** — `components/school/FootballDashboardModal.tsx:302` · gates: `footballDialogOpen && filterType === 'teams' && selectedTeamId && !(loadingTournamentMatches)`

#### Pestaña «Rúbrica» (`rubrica`) — MesocycleSection.tsx:978

- [filter] **Selector: Selecciona un atleta** — `components/coach/MesocycleRubricTable.tsx:195` · gates: `filterType === 'teams' && selectedTeamId && schoolId && evaluationMode === 'individual'` · abre: setSelectedAthleteId

#### Pestaña «Cierre» (`cierre`) — MesocycleSection.tsx:979

- [button] **Guardar** — `components/coach/MesocycleClosingForms.tsx:103` · gates: `filterType === 'teams' && selectedTeamId && schoolId && disabled: {!dirty \|\| saving}` · W: rpc:merge_mesocycle_closing_review

#### Pestaña «Documentos» (`documentos`) — MesocycleSection.tsx:980

- [button] **·** — `components/coach/MesocycleDocuments.tsx:246` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !(isLoading) && disabled: {openingId === doc.id}` · abre: openDoc
- [export] **Descargar** — `components/coach/MesocycleDocuments.tsx:259` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !(isLoading) && disabled: {openingId === doc.id}` · abre: openDoc
- [button] **{`Eliminar ${doc.file_name}`}** — `components/coach/MesocycleDocuments.tsx:269` · gates: `filterType === 'teams' && selectedTeamId && schoolId && !(isLoading) && canDelete`
- [dialog] **¿Eliminar este documento?** — `components/coach/MesocycleDocuments.tsx:288` · gates: `filterType === 'teams' && selectedTeamId && schoolId`
- [button] **Eliminar** — `components/coach/MesocycleDocuments.tsx:295` · gates: `filterType === 'teams' && selectedTeamId && schoolId && disabled: {remove.isPending}` · W: training_mesocycle_documents.delete

#### Pestaña «👥 Equipos» (`teams`) — TrainingPlansPage.tsx:372

_(sin acciones; 0 controles menores)_

#### Pestaña «🎟️ Planes» (`plans`) — TrainingPlansPage.tsx:373

_(sin acciones; 0 controles menores)_

#### Pestaña «Evaluación rápida ( )» (`{QUICK_TAB}`) — TeamPerformanceEntryModal.tsx:274 · gate: !(isLoading) && (showFull \|\| quickMetrics.length === 0) && subcategoryKeys.length > 0 && quickMetrics.length > 0

_(sin acciones; 0 controles menores)_

#### Pestaña «( )» (`{key}`) — TeamPerformanceEntryModal.tsx:279 · gate: !(isLoading) && (showFull \|\| quickMetrics.length === 0) && subcategoryKeys.length > 0

_(sin acciones; 0 controles menores)_

#### Pestaña «Temporada» (`stats`) — FootballDashboardModal.tsx:143

_(sin acciones; 0 controles menores)_

<a id="-school-routines"></a>
### Gestión de Rutinas — `/school/routines`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Entrenamiento > Gestión de Rutinas
- **Archivo:** `frontend/src/pages/school/SchoolRoutines.tsx` (+5 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=gestion_deportiva_entrenamiento_rutinas
- **Estado:** works · **Uso:** usado — trainer_routines s90=3 r90=11 tot=36; trainer_session_plans s90=6 r90=22 tot=87
- ⚠ Reusa componentes del entrenador personal (components/trainer/*) y su BFF /api/v1/trainer/*.
- **Escribe:** DELETE /api/v1/school/routines/:p, DELETE /api/v1/school/session-plans/:p
- **Lee:** GET /api/v1/school/routines, GET /api/v1/school/session-plans, GET /api/v1/trainer/clients, GET /api/v1/trainer/exercises/search, school_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **NUEVA RUTINA** — `pages/school/SchoolRoutines.tsx:205` · abre: setIsModalOpen
- [filter] **Buscar: Buscar por nombre...** — `pages/school/SchoolRoutines.tsx:218`
- [button] **×** — `pages/school/SchoolRoutines.tsx:231` · gates: `selectedTag`
- [button] **Configurar mi primera rutina** — `pages/school/SchoolRoutines.tsx:340` · gates: `!(activeTab === 'asignadas') && activeTab !== 'catalogo'` · abre: setIsModalOpen
- [dialog] **¿Eliminar esta rutina?** — `pages/school/SchoolRoutines.tsx:387`
- [button] **Sí, eliminar rutina** — `pages/school/SchoolRoutines.tsx:395` · W: DELETE /api/v1/school/routines/:p · R: GET /api/v1/school/routines
- [dialog] **¿Desasociar esta sesión?** — `pages/school/SchoolRoutines.tsx:408`
- [button] **Sí, desasociar** — `pages/school/SchoolRoutines.tsx:418` · W: DELETE /api/v1/school/session-plans/:p · R: GET /api/v1/school/routines
- [button] **Eliminar rutina** — `components/trainer/RoutineCard.tsx:64` · gates: `!(activeTab === 'asignadas') && onDelete`
- [button] **USAR RUTINA** — `components/trainer/RoutineCard.tsx:122` · gates: `!(activeTab === 'asignadas')`
- [dialog] **Editar Rutina / Nueva Rutina** — `components/trainer/RoutineFormModal.tsx:213`
- [filter] **Selector: Selecciona categoría** — `components/trainer/RoutineFormModal.tsx:240` · gates: `step === 1`
- [filter] **Selector: Selecciona dificultad** — `components/trainer/RoutineFormModal.tsx:268` · gates: `step === 1`
- [button] **Agregar** — `components/trainer/RoutineFormModal.tsx:321` · gates: `step === 1`
- [button] **×** — `components/trainer/RoutineFormModal.tsx:327` · gates: `step === 1`
- [toggle] **Guardar como plantilla Estará disponible en tu biblioteca p…** — `components/trainer/RoutineFormModal.tsx:340` · gates: `step === 1 && !isSchoolContext`
- [toggle] **Visible para atletas El atleta podrá verla en su perfil (si…** — `components/trainer/RoutineFormModal.tsx:361` · gates: `step === 1 && isSchoolContext`
- [toggle] **Captura activa / Sin captura** — `components/trainer/RoutineFormModal.tsx:472` · gates: `!(step === 1) && ent.addons?.biomech && formData.blocks.length > 0`
- [filter] **Selector: {block.analyzer_code ?? 'hack_squat'}** — `components/trainer/RoutineFormModal.tsx:497` · gates: `!(step === 1) && ent.addons?.biomech && formData.blocks.length > 0 && block.analyzer_required`
- [button] **Cancelar** — `components/trainer/RoutineFormModal.tsx:578` · gates: `disabled: {isLoading}`
- [button] **Continuar al Diseño** — `components/trainer/RoutineFormModal.tsx:582` · gates: `step === 1 && disabled: {!formData.name.trim()}`
- [button] **Atrás Volver a Info** — `components/trainer/RoutineFormModal.tsx:592` · gates: `!(step === 1)`
- [button] **Guardar Cambios / Crear Rutina Total** — `components/trainer/RoutineFormModal.tsx:597` · gates: `!(step === 1) && disabled: {isLoading \|\| formData.blocks.length === 0}` · R: GET /api/v1/school/routines
- [dialog] **Usar Rutina Ahora** — `components/trainer/QuickUseRoutineModal.tsx:156`
- [filter] **Buscar: Buscar atleta...** — `components/trainer/QuickUseRoutineModal.tsx:168` · gates: `!selectedClient`
- [button] **Menor** — `components/trainer/QuickUseRoutineModal.tsx:187` · gates: `!selectedClient && !(loadingClients)`
- [button] **Cambiar** — `components/trainer/QuickUseRoutineModal.tsx:227` · gates: `!(!selectedClient)`
- [button] **Cancelar** — `components/trainer/QuickUseRoutineModal.tsx:254` · gates: `disabled: {isSubmitting}`
- [button] **Confirmar Asignación** — `components/trainer/QuickUseRoutineModal.tsx:256` · gates: `selectedClient && disabled: {isSubmitting}` · R: GET /api/v1/school/routines, GET /api/v1/trainer/clients
- [filter] **Selector: {block.type}** — `components/trainer/BlockBuilder.tsx:290` · gates: `!(step === 1)` · R: GET /api/v1/me/entitlements
- [button] **Subir ejercicio** — `components/trainer/BlockBuilder.tsx:310` · gates: `!(step === 1) && disabled: {index === 0}` · R: GET /api/v1/me/entitlements
- [button] **Bajar ejercicio** — `components/trainer/BlockBuilder.tsx:313` · gates: `!(step === 1) && disabled: {index === blocks.length - 1}` · R: GET /api/v1/me/entitlements
- [button] **Eliminar ejercicio** — `components/trainer/BlockBuilder.tsx:316` · gates: `!(step === 1)` · R: GET /api/v1/me/entitlements
- [filter] **Selector: {block.weight_unit \|\| 'kg'}** — `components/trainer/BlockBuilder.tsx:419` · gates: `!(step === 1) && Config.fields.includes('weight') && !isAdvanced` · R: GET /api/v1/me/entitlements
- [toggle] **Personalizar por serie Permite configurar reps, peso y drop…** — `components/trainer/BlockBuilder.tsx:488` · gates: `!(step === 1) && supportsAdvancedSets`
- [bulk_select] **{`Serie ${setIdx + 1}: drop set`}** — `components/trainer/BlockBuilder.tsx:563` · gates: `!(step === 1) && isAdvanced && block.set_config` · R: GET /api/v1/me/entitlements
- [button] **×** — `components/trainer/BlockBuilder.tsx:619` · gates: `!(step === 1) && isAdvanced && block.set_config && setRow.is_drop_set` · R: GET /api/v1/me/entitlements
- [button] **+ drop** — `components/trainer/BlockBuilder.tsx:632` · gates: `!(step === 1) && isAdvanced && block.set_config && setRow.is_drop_set` · R: GET /api/v1/me/entitlements
- [button] **Agregar Ejercicio** — `components/trainer/BlockBuilder.tsx:664` · gates: `!(step === 1)` · R: GET /api/v1/me/entitlements
- [button] **Desvincular de wger** — `components/trainer/ExerciseSearchInput.tsx:197` · gates: `!(step === 1) && !(loading)`
- [button] **💪 · compound ↵** — `components/trainer/ExerciseSearchInput.tsx:240` · gates: `!(step === 1) && showDropdown && suggestions.length > 0`

#### Pestaña «Todas ( )» (`todas`) — SchoolRoutines.tsx:246

_(sin acciones; 0 controles menores)_

#### Pestaña «Personalizadas ( )» (`personalizadas`) — SchoolRoutines.tsx:249

_(sin acciones; 0 controles menores)_

#### Pestaña «Catálogo ( )» (`catalogo`) — SchoolRoutines.tsx:252

_(sin acciones; 0 controles menores)_

#### Pestaña «Asignadas» (`asignadas`) — SchoolRoutines.tsx:255

_(sin acciones; 0 controles menores)_

<a id="-school-routines-routineid"></a>
### Detalle de rutina — `/school/routines/:routineId`

- **Rol:** school+school_admin · **Menú:** (desde Gestión de Rutinas)
- **Archivo:** `frontend/src/pages/trainer/TrainerRoutineDetail.tsx` (+5 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=gestion_deportiva_entrenamiento_rutinas
- **Estado:** works · **Uso:** usado — trainer_routines s90=3 r90=11 tot=36
- **Lee:** GET /api/v1/trainer/clients, GET /api/v1/trainer/exercises/search, GET /api/v1/trainer/session-plans, school_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **VOLVER VOLVER AL PANEL** — `pages/trainer/TrainerRoutineDetail.tsx:170` · → isSchoolContext ? /school/routines : /trainer/routines
- [button] **Editar** — `pages/trainer/TrainerRoutineDetail.tsx:182` · gates: `routine.scope !== 'global'` · abre: setIsModalOpen
- [button] **Eliminar** — `pages/trainer/TrainerRoutineDetail.tsx:191` · gates: `routine.scope !== 'global'` · → isSchoolContext ? /school/routines : /trainer/routines
- [button] **USAR AHORA** — `pages/trainer/TrainerRoutineDetail.tsx:369` · abre: setIsUseModalOpen
- [button] **Ver historial completo** — `pages/trainer/TrainerRoutineDetail.tsx:428` · gates: `!isSchoolContext && usageHistory.length > 5`
- [button] **USAR AHORA** — `pages/trainer/TrainerRoutineDetail.tsx:454` · abre: setIsUseModalOpen
- [dialog] **(sin etiqueta)** — `components/trainer/SessionUsageDetailModal.tsx:88`
- [button] **Cerrar** — `components/trainer/SessionUsageDetailModal.tsx:255`
- [button] **Ver perfil del cliente** — `components/trainer/SessionUsageDetailModal.tsx:258` · → /trainer/clients/${plan.client_id}?type=${plan.client_type}
- ↪ componente compartido `components/trainer/RoutineFormModal.tsx` (13 acciones) — detallado en `/school/routines`
- ↪ componente compartido `components/trainer/QuickUseRoutineModal.tsx` (6 acciones) — detallado en `/school/routines`
- ↪ componente compartido `components/trainer/BlockBuilder.tsx` (10 acciones) — detallado en `/school/routines`
- ↪ componente compartido `components/trainer/ExerciseSearchInput.tsx` (2 acciones) — detallado en `/school/routines`

<a id="-informe-mensual"></a>
### Informe Mensual — `/informe-mensual`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Informe Mensual
- **Archivo:** `frontend/src/pages/MonthlyReportsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, coach] · ModuleGate=gestion_deportiva_informe_mensual
- **Estado:** works · **Uso:** usado — athlete_reports s90=6 r90=157 tot=157
- **Escribe:** DELETE /api/v1/school/performance/entries/:p, POST /api/v1/school/performance/entries, POST /api/v1/school/reports/:p/publish, POST /api/v1/school/reports/generate, POST /api/v1/school/reports/publish-team, POST /api/v1/school/reports/send, PUT /api/v1/school/performance/entries/:p, PUT /api/v1/school/reports/:p/note, PUT /api/v1/school/teams/:p/report-note, rpc:mark_report_viewed, school_settings.upsert
- **Lee:** GET /api/v1/athlete-reports/:p/pdf, GET /api/v1/athlete/performance/entries:p, GET /api/v1/athlete/performance/evolution, GET /api/v1/school/performance/entries, GET /api/v1/school/performance/metrics, GET /api/v1/school/performance/roster, GET /api/v1/school/performance/subjects/:p/:p/evolution, GET /api/v1/school/reports, GET /api/v1/school/reports/team/:p/pdf, athlete_reports.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [filter] **Selector: {String(month)}** — `pages/MonthlyReportsPage.tsx:338`
- [filter] **Selector: {String(year)}** — `pages/MonthlyReportsPage.tsx:349`
- [button] **Actualizar** — `pages/MonthlyReportsPage.tsx:358` · gates: `disabled: {isLoading}`
- [filter] **Selector: {releaseBy}** — `pages/MonthlyReportsPage.tsx:365` · gates: `!isCoach` · W: school_settings.upsert
- [button] **Generar borradores de** — `pages/MonthlyReportsPage.tsx:399` · gates: `!isCoach && disabled: {ocupado}` · W: POST /api/v1/school/reports/generate
- [filter] **Selector: Elegir equipo** — `pages/MonthlyReportsPage.tsx:509` · abre: setTeamId
- [button] **Guardar nota** — `pages/MonthlyReportsPage.tsx:536` · gates: `disabled: {ocupado \|\| !teamId \|\| nota.trim().length &lt; 20}` · W: PUT /api/v1/school/teams/:p/report-note
- [button] **Publicar lote** — `pages/MonthlyReportsPage.tsx:545` · gates: `disabled: {ocupado \|\| !teamId \|\| publicables === 0}` · W: POST /api/v1/school/reports/publish-team
- [button] **Enviar los publicados** — `pages/MonthlyReportsPage.tsx:568` · gates: `puedeEnviar && disabled: {ocupado \|\| !resumen \|\| resumen.publicados === 0}` · W: POST /api/v1/school/reports/send
- [button] **Editar nota / Nota individual** — `pages/MonthlyReportsPage.tsx:617` · gates: `reports.length > 0 && editable`
- [button] **Publicar** — `pages/MonthlyReportsPage.tsx:636` · gates: `reports.length > 0 && editable && puedePublicar && disabled: {ocupado}` · W: POST /api/v1/school/reports/:p/publish
- [export] **Ver PDF** — `pages/MonthlyReportsPage.tsx:654` · gates: `reports.length > 0 && r.status === 'publicado'` · R: GET /api/v1/athlete-reports/:p/pdf
- [button] **Enviar** — `pages/MonthlyReportsPage.tsx:666` · gates: `reports.length > 0 && r.status === 'publicado' && !r.sent_at && r.recipient_id && puedeEnviar && disabled: {ocupado}` · W: POST /api/v1/school/reports/send
- [button] **Guardar** — `pages/MonthlyReportsPage.tsx:696` · gates: `reports.length > 0 && editando && disabled: {ocupado}` · W: PUT /api/v1/school/reports/:p/note
- [button] **Cancelar** — `pages/MonthlyReportsPage.tsx:706` · gates: `reports.length > 0 && editando`

<a id="-attendance-supervision"></a>
### Supervisión de asistencias — `/attendance-supervision`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Asistencias > Supervisión
- **Archivo:** `frontend/src/pages/AttendanceSupervisionPage.tsx` (+1 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** works · **Uso:** usado — attendance_sessions s90=13 r90=1196 tot=3622; attendance_records s90=11 r90=4981 tot=5034
- **Escribe:** PATCH /api/v1/attendance/session/:p/finalize, POST /api/v1/attendance/quick-guest, POST /api/v1/attendance/session, POST /api/v1/attendance/walk-in
- **Lee:** GET /api/v1/attendance/roster/:p/:p, GET /api/v1/attendance/school-roster, GET /api/v1/attendance/session/:p, attendance_records.select, attendance_sessions.select, children.select, facilities.select, facility_availability.select, facility_reservations.select, offerings.select, profiles.select, session_bookings.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Hoy** — `pages/AttendanceSupervisionPage.tsx:960`
- [button] **(() => handleBookingAttendance(b, s))** — `pages/AttendanceSupervisionPage.tsx:1069` · gates: `!(loadingBookings) && disabled: {isSaving}` · W: POST /api/v1/attendance/session · R: GET /api/v1/attendance/school-roster
- [dialog] **(sin etiqueta)** — `pages/AttendanceSupervisionPage.tsx:1265`
- [filter] **Buscar: Buscar deportista por nombre...** — `pages/AttendanceSupervisionPage.tsx:1282`
- [toggle] **Clase secundaria** — `pages/AttendanceSupervisionPage.tsx:1291` · gates: `!isFinalized && modalCtx?.type === 'offering'`
- [button] **Crear Invitado Rápido** — `pages/AttendanceSupervisionPage.tsx:1320` · gates: `!isFinalized && modalCtx?.type === 'facility_session'` · abre: setGuestDialogOpen
- [filter] **Buscar: Escribe nombre para buscar en toda la escuela...** — `pages/AttendanceSupervisionPage.tsx:1331` · gates: `!isFinalized && modalCtx?.type === 'facility_session'`
- [button] **{STATUS_CFG[s].label}** — `pages/AttendanceSupervisionPage.tsx:1466` · gates: `!(loadingRoster) && !isFinalized`
- [button] **Cerrar** — `pages/AttendanceSupervisionPage.tsx:1500` · gates: `!isFinalized && disabled: {isBusy}`
- [button] **Guardando...** — `pages/AttendanceSupervisionPage.tsx:1502` · gates: `!isFinalized && disabled: {markedCount === 0 \|\| isBusy}` · W: POST /api/v1/attendance/walk-in, POST /api/v1/attendance/session · R: GET /api/v1/attendance/school-roster
- [button] **Finalizando... / Finalizar** — `pages/AttendanceSupervisionPage.tsx:1506` · gates: `!isFinalized && session && disabled: {isBusy}` · W: PATCH /api/v1/attendance/session/:p/finalize · R: GET /api/v1/attendance/school-roster
- [button] **Cerrar** — `pages/AttendanceSupervisionPage.tsx:1520` · gates: `!(!isFinalized)`
- [dialog] **Bloques de** — `pages/AttendanceSupervisionPage.tsx:1530`
- [button] **Cerrar** — `pages/AttendanceSupervisionPage.tsx:1617`
- [dialog] **Crear Invitado Rápido** — `pages/AttendanceSupervisionPage.tsx:1628`
- [button] **Cancelar** — `pages/AttendanceSupervisionPage.tsx:1663` · abre: setGuestDialogOpen
- [button] **Creando... / Crear** — `pages/AttendanceSupervisionPage.tsx:1664` · gates: `disabled: {!guestName.trim() \|\| createGuestMutation.isPending}` · W: POST /api/v1/attendance/quick-guest · R: GET /api/v1/attendance/school-roster
- [dialog] **Horarios de** — `pages/AttendanceSupervisionPage.tsx:1677`
- [button] **Cancelar** — `pages/AttendanceSupervisionPage.tsx:1703`

<a id="-attendance-history"></a>
### Histórico de asistencias — `/attendance-history`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Asistencias > Histórico
- **Archivo:** `frontend/src/pages/AttendanceHistoryPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** works · **Uso:** usado — attendance_records s90=11 r90=4981 tot=5034
- **Escribe:** POST /api/v1/attendance/facturar-fuera-de-plan
- **Lee:** GET /api/v1/attendance/history, offerings.select, school_staff.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Mes anterior** — `pages/AttendanceHistoryPage.tsx:541` · gates: `mode === 'month'`
- [button] **Mes siguiente** — `pages/AttendanceHistoryPage.tsx:562` · gates: `mode === 'month' && disabled: {isCurrentMonth}`
- [button] **Mes actual** — `pages/AttendanceHistoryPage.tsx:571` · gates: `mode === 'month' && !isCurrentMonth`
- [filter] **Selector: Todos los equipos y planes** — `pages/AttendanceHistoryPage.tsx:577`
- [filter] **Selector: Todos los entrenadores** — `pages/AttendanceHistoryPage.tsx:595`
- [button] **Actualizar** — `pages/AttendanceHistoryPage.tsx:607` · gates: `disabled: {isFetching}`
- [button] **Reintentar** — `pages/AttendanceHistoryPage.tsx:621` · gates: `isError`

#### Pestaña «Por mes» (`mes`) — AttendanceHistoryPage.tsx:665 · gate: !isLoading && !isError && totals && !(totals.records === 0) && isRangeMode

- [export] **CSV** — `pages/AttendanceHistoryPage.tsx:703` · gates: `!isLoading && !isError && totals && !(totals.records === 0) && isRangeMode`

#### Pestaña «Por atleta» (`atleta`) — AttendanceHistoryPage.tsx:669 · gate: !isLoading && !isError && totals && !(totals.records === 0)

- [filter] **Buscar: Buscar atleta...** — `pages/AttendanceHistoryPage.tsx:767` · gates: `!isLoading && !isError && totals && !(totals.records === 0)`
- [export] **CSV** — `pages/AttendanceHistoryPage.tsx:770` · gates: `!isLoading && !isError && totals && !(totals.records === 0)`

#### Pestaña «Por día» (`dia`) — AttendanceHistoryPage.tsx:672 · gate: !isLoading && !isError && totals && !(totals.records === 0)

- [export] **CSV** — `pages/AttendanceHistoryPage.tsx:863` · gates: `!isLoading && !isError && totals && !(totals.records === 0)`

#### Pestaña «Día por día» (`matriz`) — AttendanceHistoryPage.tsx:676 · gate: !isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode

- [filter] **Buscar: Buscar atleta...** — `pages/AttendanceHistoryPage.tsx:921` · gates: `!isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode`
- [export] **CSV** — `pages/AttendanceHistoryPage.tsx:924` · gates: `!isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode`

#### Pestaña «Plan vs consumo» (`plan`) — AttendanceHistoryPage.tsx:681 · gate: !isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode

- [button] **Facturar** — `pages/AttendanceHistoryPage.tsx:1057` · gates: `!isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode && !(desfases === 0) && !(cubo.clases === 0) && disabled: {!pl.precio_clase \|\| factu` · W: POST /api/v1/attendance/facturar-fuera-de-plan
- [button] **Emitiendo…** — `pages/AttendanceHistoryPage.tsx:1081` · gates: `!isLoading && !isError && totals && !(totals.records === 0) && !isRangeMode && desfases > 0 && disabled: {facturar.isPending}` · W: POST /api/v1/attendance/facturar-fuera-de-plan

<a id="-dashboard-polls"></a>
### Encuestas — `/dashboard/polls`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Asistencias > Encuestas
- **Archivo:** `frontend/src/pages/polls/PollsPage.tsx` (+1 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** sin uso — attendance_polls s90=0 r90=0 tot=3
- ⚠ 0 encuestas en 90 días (3 históricas) → sin uso.
- **Escribe:** DELETE /api/v1/offerings/:p, DELETE /api/v1/offerings/:p/plans/:p, DELETE /api/v1/polls/:p, DELETE /api/v1/polls/:p/sessions/:p/confirmations/:p, PATCH /api/v1/offerings/:p, PATCH /api/v1/offerings/:p/plans/:p, PATCH /api/v1/polls/:p/close, PATCH /api/v1/polls/:p/sessions/:p/confirmations/:p, POST /api/v1/offerings, POST /api/v1/offerings/:p/plans, POST /api/v1/offerings/one-time-fees/apply, POST /api/v1/polls, POST /api/v1/polls/:p/confirm, POST /api/v1/polls/:p/sessions/:p/confirmations
- **Lee:** GET /api/v1/offerings:p, GET /api/v1/polls/:p/public, GET /api/v1/polls/:p/results, GET /api/v1/polls:p` : ''}

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nueva encuesta** — `pages/polls/PollsPage.tsx:50` · gates: `isAdmin`
- [button] **Crear el primero** — `pages/polls/PollsPage.tsx:62` · gates: `!polls?.length && isAdmin`
- [button] **Copiar link** — `pages/polls/PollsPage.tsx:114` · gates: `isAdmin`
- [button] **Cerrar** — `pages/polls/PollsPage.tsx:124` · gates: `isAdmin && poll.status === 'open'`
- [dialog] **¿Eliminar encuesta?** — `pages/polls/PollsPage.tsx:159`
- [button] **Eliminar** — `pages/polls/PollsPage.tsx:166`
- [dialog] **Nueva encuesta de asistencia** — `pages/polls/components/CreatePollDialog.tsx:82` · gates: `isAdmin`
- [button] **Agregar** — `pages/polls/components/CreatePollDialog.tsx:108` · gates: `isAdmin`
- [filter] **Selector: Selecciona...** — `pages/polls/components/CreatePollDialog.tsx:157` · gates: `isAdmin`
- [button] **Cancelar** — `pages/polls/components/CreatePollDialog.tsx:224` · gates: `isAdmin`
- [button] **Creando... / Crear encuesta** — `pages/polls/components/CreatePollDialog.tsx:227` · gates: `isAdmin && disabled: {isPending}`

<a id="-dashboard-polls-pollid-results"></a>
### Resultados de encuesta — `/dashboard/polls/:pollId/results`

- **Rol:** school+school_admin · **Menú:** (desde Encuestas)
- **Archivo:** `frontend/src/pages/polls/PollResultsPage.tsx` (+1 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** sin uso — attendance_polls s90=0 r90=0 tot=3
- **Escribe:** DELETE /api/v1/polls/:p, DELETE /api/v1/polls/:p/sessions/:p/confirmations/:p, PATCH /api/v1/polls/:p/close, PATCH /api/v1/polls/:p/sessions/:p/confirmations/:p, POST /api/v1/polls, POST /api/v1/polls/:p/confirm, POST /api/v1/polls/:p/sessions/:p/confirmations
- **Lee:** GET /api/v1/polls/:p/public, GET /api/v1/polls/:p/results, GET /api/v1/polls:p` : ''}

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **(() => navigate(-1))** — `pages/polls/PollResultsPage.tsx:57` · → -1
- [button] **Compartir** — `pages/polls/PollResultsPage.tsx:77` · gates: `isAdmin`
- [button] **Cerrar** — `pages/polls/PollResultsPage.tsx:82` · gates: `isAdmin && poll.status === 'open'`
- [button] **Agregar manualmente** — `pages/polls/PollResultsPage.tsx:175` · gates: `isAdmin`
- [dialog] **¿Eliminar confirmación?** — `pages/polls/PollResultsPage.tsx:207`
- [button] **Eliminar** — `pages/polls/PollResultsPage.tsx:219`
- [dialog] **Agregar asistencia manual** — `pages/polls/components/AddConfirmationDialog.tsx:43` · gates: `addToSession`
- [button] **Cancelar** — `pages/polls/components/AddConfirmationDialog.tsx:66` · gates: `addToSession`
- [button] **Registrando... / Registrar** — `pages/polls/components/AddConfirmationDialog.tsx:69` · gates: `addToSession && disabled: {isPending \|\| !guestName.trim()}`

<a id="-results-overview"></a>
### Resultados — `/results-overview`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Resultados
- **Archivo:** `frontend/src/pages/ResultsOverviewPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** broken · **Uso:** no medido
- ⚠ Datos hardcodeados de demo (cheerleading 2025): fuera de sessionStorage.demo_mode muestra la lista VACÍA siempre. Los resultados reales (match_results) viven en /training-plans y /seguimiento-deportivo. Entrada de menú que no muestra nada.

<a id="-school-tournaments"></a>
### Mis Torneos — `/school/tournaments`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Mis Torneos
- **Archivo:** `frontend/src/pages/school/SchoolTournamentsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=— · menú: addon tournaments (la URL NO lo exige)
- **Estado:** partial · **Uso:** usado — events s90=4 r90=8 tot=9
- ⚠ El addon tournaments solo oculta el ítem de menú; la URL (y /new, /:id) no tiene ModuleGate ni chequeo de addon. events cuenta todos los eventos, no solo torneos. 30 escuelas con addon tournaments.
- **Lee:** GET /api/v1/events/school-tournaments

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Crear torneo** — `pages/school/SchoolTournamentsPage.tsx:77` · → /school/tournaments/new
- [button] **Crear mi primer torneo** — `pages/school/SchoolTournamentsPage.tsx:94` · gates: `!(loading)` · → /school/tournaments/new

<a id="-school-tournaments-new"></a>
### Crear torneo — `/school/tournaments/new`

- **Rol:** school+school_admin · **Menú:** (desde Mis Torneos)
- **Archivo:** `frontend/src/pages/school/CreateTournamentPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=— · addon tournaments solo en menú
- **Estado:** partial · **Uso:** usado — events s90=4 r90=8 tot=9
- **Escribe:** POST /api/v1/events/school-tournament

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Volver** — `pages/school/CreateTournamentPage.tsx:88` · → -1
- [button] **Ir a Mi Plan** — `pages/school/CreateTournamentPage.tsx:89` · → /mi-plan
- [button] **Volver** — `pages/school/CreateTournamentPage.tsx:145` · → -1
- [button] **Cancelar** — `pages/school/CreateTournamentPage.tsx:275` · gates: `disabled: {submitting}` · → -1
- [button] **Creando… / Crear torneo** — `pages/school/CreateTournamentPage.tsx:276` · gates: `disabled: {submitting}` · W: POST /api/v1/events/school-tournament · → /school/tournaments

<a id="-school-tournaments-id"></a>
### Detalle de torneo — `/school/tournaments/:id`

- **Rol:** school+school_admin · **Menú:** (desde Mis Torneos)
- **Archivo:** `frontend/src/pages/school/SchoolTournamentDetailPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=—
- **Estado:** partial · **Uso:** usado — events s90=4 r90=8 tot=9
- **Escribe:** PATCH /api/v1/events/school-tournaments/:p, PATCH /api/v1/events/school-tournaments/:p/delegations/:p, PATCH /api/v1/events/school-tournaments/:p/delegations/:p/payments/:p, PATCH /api/v1/events/school-tournaments/:p/matches/:p, POST /api/v1/events/school-tournaments/:p/categories/:p/assign-teams, POST /api/v1/events/school-tournaments/:p/categories/:p/generate-fixtures, POST /api/v1/events/school-tournaments/:p/delegations/:p/record-payment, POST /api/v1/events/school-tournaments/:p/publish, POST /api/v1/events/school-tournaments/:p/register, PUT /api/v1/events/school-tournaments/:p/categories, PUT /api/v1/events/school-tournaments/:p/price-phases
- **Lee:** GET /api/v1/events/category-templates, GET /api/v1/events/my-open-tournaments, GET /api/v1/events/school-tournaments/:p, GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p/for-participant, GET /api/v1/events/school-tournaments/:p/individual-registrations, GET /api/v1/events/school-tournaments/:p/matches, GET /api/v1/events/school-tournaments/:p/matches/:p/rosters, GET /api/v1/events/school-tournaments/:p/public-results:p` : ''}, GET /api/v1/events/school-tournaments/:p/standings

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Volver a Mis Torneos** — `pages/school/SchoolTournamentDetailPage.tsx:270` · → /school/tournaments
- [button] **Volver a Mis Torneos** — `pages/school/SchoolTournamentDetailPage.tsx:292` · → /school/tournaments
- [button] **Publicando… / Publicar** — `pages/school/SchoolTournamentDetailPage.tsx:310` · gates: `isDraft && disabled: {publishing \|\| !canPublish}` · W: POST /api/v1/events/school-tournaments/:p/publish · R: GET /api/v1/events/school-tournaments/:p, GET /api/v1/events/category-templates
- [button] **Compartir** — `pages/school/SchoolTournamentDetailPage.tsx:314` · gates: `isShareable`

#### Pestaña «Info» (`info`) — SchoolTournamentDetailPage.tsx:336

- [button] **Guardando… / Guardar cambios** — `pages/school/SchoolTournamentDetailPage.tsx:361` · gates: `disabled: {savingInfo}` · W: PATCH /api/v1/events/school-tournaments/:p · R: GET /api/v1/events/school-tournaments/:p, GET /api/v1/events/category-templates

#### Pestaña «Categorías y Precios» (`cats`) — SchoolTournamentDetailPage.tsx:337

- [button] **Agregar** — `pages/school/SchoolTournamentDetailPage.tsx:370`
- [button] **+** — `pages/school/SchoolTournamentDetailPage.tsx:377` · gates: `tpls.length > 0` · R: GET /api/v1/events/category-templates, GET /api/v1/events/school-tournaments/:p
- [button] **Agregar** — `pages/school/SchoolTournamentDetailPage.tsx:409`
- [button] **Guardando… / Guardar categorías y precios** — `pages/school/SchoolTournamentDetailPage.tsx:425` · gates: `disabled: {savingCats}` · W: PUT /api/v1/events/school-tournaments/:p/categories, PUT /api/v1/events/school-tournaments/:p/price-phases · R: GET /api/v1/events/school-tournaments/:p, GET /api/v1/events/category-templates

#### Pestaña «Inscritos» (`inscritos`) — SchoolTournamentDetailPage.tsx:338

- [button] **Armando… / Crear equipo** — `pages/school/SchoolTournamentDetailPage.tsx:493` · gates: `isInternal && unassigned.length > 0 && disabled: {creatingTeam === cat.id}` · W: POST /api/v1/events/school-tournaments/:p/categories/:p/assign-teams · R: GET /api/v1/events/school-tournaments/:p/individual-registrations
- [link] **ver → {p.proof_url}** — `pages/school/SchoolTournamentDetailPage.tsx:537` · gates: `!(isInternal) && !(!delsLoaded) && p.proof_url`
- [button] **✓** — `pages/school/SchoolTournamentDetailPage.tsx:538` · gates: `!(isInternal) && !(!delsLoaded)` · W: PATCH /api/v1/events/school-tournaments/:p/delegations/:p/payments/:p · R: GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p
- [button] **✕** — `pages/school/SchoolTournamentDetailPage.tsx:539` · gates: `!(isInternal) && !(!delsLoaded)` · W: PATCH /api/v1/events/school-tournaments/:p/delegations/:p/payments/:p · R: GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p
- [button] **Pago** — `pages/school/SchoolTournamentDetailPage.tsx:544` · gates: `!(isInternal) && !(!delsLoaded) && ['submitted', 'draft', 'pending_payment'].includes(d.status)` · W: POST /api/v1/events/school-tournaments/:p/delegations/:p/record-payment · R: GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p
- [button] **Aprobar** — `pages/school/SchoolTournamentDetailPage.tsx:545` · gates: `!(isInternal) && !(!delsLoaded) && ['submitted', 'draft', 'pending_payment'].includes(d.status)` · W: PATCH /api/v1/events/school-tournaments/:p/delegations/:p · R: GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p
- [button] **Rechazar** — `pages/school/SchoolTournamentDetailPage.tsx:546` · gates: `!(isInternal) && !(!delsLoaded) && ['submitted', 'draft', 'pending_payment'].includes(d.status)` · W: PATCH /api/v1/events/school-tournaments/:p/delegations/:p · R: GET /api/v1/events/school-tournaments/:p/delegations, GET /api/v1/events/school-tournaments/:p

#### Pestaña «Resultados» (`resultados`) — SchoolTournamentDetailPage.tsx:339

- [button] **Generar calendario** — `pages/school/SchoolTournamentDetailPage.tsx:582` · gates: `!(savedCats.length === 0)` · W: POST /api/v1/events/school-tournaments/:p/categories/:p/generate-fixtures · R: GET /api/v1/events/school-tournaments/:p/matches, GET /api/v1/events/school-tournaments/:p/standings, GET /api/v1/events/school-tournaments/:p/individual-registrations
- [button] **⚽** — `pages/school/SchoolTournamentDetailPage.tsx:645` · gates: `!(savedCats.length === 0) && !(matches.length === 0)` · R: GET /api/v1/events/school-tournaments/:p/matches/:p/rosters, GET /api/v1/events/school-tournaments/:p/individual-registrations
- [button] **Guardar** — `pages/school/SchoolTournamentDetailPage.tsx:646` · gates: `!(savedCats.length === 0) && !(matches.length === 0)` · W: PATCH /api/v1/events/school-tournaments/:p/matches/:p · R: GET /api/v1/events/school-tournaments/:p/matches, GET /api/v1/events/school-tournaments/:p/standings
- [button] **+ gol** — `pages/school/SchoolTournamentDetailPage.tsx:662` · gates: `!(savedCats.length === 0) && !(matches.length === 0) && openGoals === m.id && !(!r)`

<a id="-school-equipment"></a>
### Dotación — `/school/equipment`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Dotación
- **Otras entradas:** Alias /school/dotacion (misma página)
- **Archivo:** `frontend/src/pages/school/SchoolEquipmentPage.tsx` (+7 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=—
- **Estado:** works · **Uso:** usado — equipment_items s90=2 r90=3 tot=3; equipment_assignments s90=2 r90=4 tot=4
- ⚠ Alias duplicado /school/dotacion → misma página.
- **Escribe:** POST /api/v1/equipment/assignments/:p/acta-pdf, POST /api/v1/payments/extract-receipt
- **Lee:** GET /api/v1/equipment/assignments/:p/acta-signed-url, equipment_settings.select, school_branches.select, storage:equipment-photos.createSignedUrl

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Aprobaciones** — `pages/school/SchoolEquipmentPage.tsx:109` · abre: setQueueOpen
- [button] **Ajustes** — `pages/school/SchoolEquipmentPage.tsx:114` · abre: setSettingsOpen
- [button] **Nuevo ítem** — `pages/school/SchoolEquipmentPage.tsx:117` · abre: setItemModal
- [filter] **Selector: {branchId}** — `pages/school/SchoolEquipmentPage.tsx:128` · abre: setBranchId
- [filter] **Selector: {status}** — `pages/school/SchoolEquipmentPage.tsx:138`
- [button] **Asignar** — `pages/school/SchoolEquipmentPage.tsx:186` · gates: `!(loading) && disabled: {it.quantity_available === 0}` · abre: setAssignModal
- [button] **Editar** — `pages/school/SchoolEquipmentPage.tsx:191` · gates: `!(loading)` · abre: setItemModal
- [button] **Archivar** — `pages/school/SchoolEquipmentPage.tsx:195` · gates: `!(loading)`
- [dialog] **Editar ítem / Nuevo ítem de dotación** — `components/equipment/EquipmentItemFormModal.tsx:80`
- [filter] **Selector: {branchId}** — `components/equipment/EquipmentItemFormModal.tsx:107` · abre: setBranchId
- [filter] **Selector: {condition}** — `components/equipment/EquipmentItemFormModal.tsx:117`
- [filter] **Selector: {override}** — `components/equipment/EquipmentItemFormModal.tsx:129`
- [button] **Cancelar** — `components/equipment/EquipmentItemFormModal.tsx:152` · gates: `disabled: {saving}`
- [button] **Guardar / Crear ítem** — `components/equipment/EquipmentItemFormModal.tsx:153` · gates: `disabled: {saving}`
- [dialog] **Asignar:** — `components/equipment/EquipmentAssignModal.tsx:99`
- [filter] **Selector: {loadingCoaches ? 'Cargando…' : 'Selecciona un entrenador'}** — `components/equipment/EquipmentAssignModal.tsx:106` · gates: `disabled: {loadingCoaches}` · abre: setCoachId
- [filter] **Selector: {branchId}** — `components/equipment/EquipmentAssignModal.tsx:131` · abre: setBranchId
- [button] **Cancelar** — `components/equipment/EquipmentAssignModal.tsx:157` · gates: `disabled: {saving}`
- [button] **Asignar** — `components/equipment/EquipmentAssignModal.tsx:158` · gates: `disabled: {saving \|\| coaches.length === 0}`
- [link] ** → {url}** — `components/equipment/EquipmentApprovalQueue.tsx:35` · gates: `url`
- [dialog] **Cola de aprobación** — `components/equipment/EquipmentApprovalQueue.tsx:98`
- [button] **Rechazar** — `components/equipment/EquipmentApprovalQueue.tsx:124` · gates: `!(loading) && deliveries.length > 0 && disabled: {busyId === d.id}`
- [button] **Aprobar** — `components/equipment/EquipmentApprovalQueue.tsx:132` · gates: `!(loading) && deliveries.length > 0 && disabled: {busyId === d.id}` · W: POST /api/v1/equipment/assignments/:p/acta-pdf
- [filter] **Selector: {condById[r.id] ?? r.condition}** — `components/equipment/EquipmentApprovalQueue.tsx:170` · gates: `!(loading) && returns.length > 0` · abre: setCondById
- [button] **Disputar** — `components/equipment/EquipmentApprovalQueue.tsx:180` · gates: `!(loading) && returns.length > 0 && disabled: {busyId === r.id}`
- [button] **Aprobar** — `components/equipment/EquipmentApprovalQueue.tsx:188` · gates: `!(loading) && returns.length > 0 && disabled: {busyId === r.id}`
- [dialog] **Ajustes de Dotación** — `components/equipment/EquipmentSettingsDialog.tsx:64`
- [toggle] **Habilitar autoservicio de entrenadores Permite que el entre…** — `components/equipment/EquipmentSettingsDialog.tsx:77` · gates: `!(loading)`
- [toggle] **Exigir foto también en entregas por admin Obliga a adjuntar…** — `components/equipment/EquipmentSettingsDialog.tsx:84` · gates: `!(loading)`
- [button] **Cancelar** — `components/equipment/EquipmentSettingsDialog.tsx:95` · gates: `disabled: {saving}`
- [button] **Guardar** — `components/equipment/EquipmentSettingsDialog.tsx:96` · gates: `disabled: {saving \|\| loading}`
- [dialog] **Actualiza tu método de pago** — `components/entitlements/UpgradeModal.tsx:129`
- [button] **Actualizar pago →** — `components/entitlements/UpgradeModal.tsx:148` · → /mi-plan
- [button] **Hablar con soporte** — `components/entitlements/UpgradeModal.tsx:157`
- [dialog] **Tu período de prueba terminó** — `components/entitlements/UpgradeModal.tsx:174`
- [button] **Activar mi plan →** — `components/entitlements/UpgradeModal.tsx:198`
- [button] **Hablar con ventas** — `components/entitlements/UpgradeModal.tsx:201`
- [dialog] **Activa el módulo** — `components/entitlements/UpgradeModal.tsx:218`
- [button] **Hablar con ventas →** — `components/entitlements/UpgradeModal.tsx:251` · gates: `addonDef.salesLed`
- [button] **Activar →** — `components/entitlements/UpgradeModal.tsx:256` · gates: `!(addonDef.salesLed)` · → /mi-plan?activate=${key}
- [button] **Hablar con ventas** — `components/entitlements/UpgradeModal.tsx:262` · gates: `!(addonDef.salesLed)`
- [dialog] **Llegaste al límite de tu plan** — `components/entitlements/UpgradeModal.tsx:292`
- [button] **Actualizar mi plan →** — `components/entitlements/UpgradeModal.tsx:322`
- [button] **No por ahora** — `components/entitlements/UpgradeModal.tsx:325`
- [dialog] **Función no disponible en tu plan** — `components/entitlements/UpgradeModal.tsx:346`
- [button] **Actualizar mi plan →** — `components/entitlements/UpgradeModal.tsx:386`
- [button] **Ver comparativa** — `components/entitlements/UpgradeModal.tsx:389`
- ↪ componente compartido `components/common/FileUpload.tsx` (1 acciones) — detallado en `/students`

<a id="-disponibilidad-medica"></a>
### Disponibilidad médica — `/disponibilidad-medica`

- **Rol:** school+school_admin · **Menú:** Gestión Deportiva > Disponibilidad médica
- **Archivo:** `frontend/src/pages/clinical/SchoolAvailabilityPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, school_admin, coach, admin, super_admin] · ModuleGate=—
- **Estado:** works · **Uso:** sin uso — clinical_patients s90=0 r90=0 tot=0; athlete_injuries s90=0 r90=0 tot=0
- ⚠ 0 pacientes / 0 lesiones en la base → sin uso todavía.
- **Escribe:** athlete_injuries.insert, athlete_injuries.update, clinical_attachments.insert, clinical_diagnoses.insert, clinical_diagnoses.update, clinical_episodes.insert, clinical_episodes.update, clinical_notes.insert, clinical_patients.insert, clinical_patients.update, exercise_assignments.insert, exercise_assignments.update, exercise_library.insert, rpc:accept_clinical_invite, rpc:cancel_my_appointment, rpc:create_clinical_invite, rpc:grant_clinical_consents, rpc:log_clinical_access, rpc:log_exercise_done, rpc:record_clinical_consent_presencial, rpc:request_service_appointment, rpc:revoke_clinical_consent, rpc:unlog_exercise_done, service_availability.delete, service_availability.upsert, service_availability_exceptions.delete, service_availability_exceptions.insert, storage:clinical-files.upload, wellness_appointments.insert, wellness_appointments.update
- **Lee:** athlete_injuries.select, athlete_injury_events.select, cie10_codes.select, clinical_attachments.select, clinical_consent_texts.select, clinical_consents.select, clinical_diagnoses.select, clinical_episodes.select, clinical_notes.select, clinical_patients.select, exercise_assignments.select, exercise_library.select, exercise_logs.select, rpc:get_available_slots, rpc:get_clinical_invite, rpc:get_my_health_summary, rpc:get_school_athlete_availability, service_availability.select, service_availability_exceptions.select, storage:clinical-files.createSignedUrl, vendor_profiles.select, wellness_appointments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/clinical/SchoolAvailabilityPage.tsx:95` · gates: `error && !isLoading` · R: rpc:get_school_athlete_availability, vendor_profiles.select

## Finanzas

<a id="-payments-automation"></a>
### Pagos (cartera y cobros) — `/payments-automation`

- **Rol:** school+school_admin · **Menú:** Finanzas > Pagos
- **Otras entradas:** MobileBottomNav (school): Pagos · Acción rápida: Cobros y Pagos
- **Archivo:** `frontend/src/pages/PaymentsAutomationPage.tsx` (+35 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=finanzas_pagos · menú: billing_enabled (RUTAS_DE_COBRO) · flags en código: VITE_COBROS_Y_PAGOS, billing_enabled · acepta ?tab=
- **Estado:** works · **Uso:** usado — payments s90=25 r90=4960 tot=5497; payment_glosas s90=2 r90=2 tot=2; monthly_closes s90=2 r90=5 tot=5; charge_batches s90=0 r90=0 tot=0; recurring_subscriptions s90=0 r90=0 tot=0; payment_adjustments s90=5 r90=5 tot=5
- ⚠ Pestaña Operaciones y modal «Cobros y pagos» solo con VITE_COBROS_Y_PAGOS (charge_batches = 0).
- ⚠ Débito automático: 0 suscripciones.
- ⚠ Config incluye toggles de recordatorios y de permisos del coach que se solapan con /payment-reminders y con Configuración.
- ⚠ MobileBottomNav (school) muestra «Pagos» aunque billing_enabled = false (el sidebar sí lo oculta).
- **Escribe:** DELETE /api/v1/payment-providers/:p, PATCH /api/v1/autopay/subscriptions/:p, PATCH /api/v1/payment-providers/:p, POST /api/v1/autopay/cards, POST /api/v1/autopay/cycles/:p/skip, POST /api/v1/autopay/nequi, POST /api/v1/autopay/school/:p/incidents/:p/resolve, POST /api/v1/autopay/school/:p/settings, POST /api/v1/autopay/school/:p/subscriptions/:p/cancel, POST /api/v1/autopay/subscriptions, POST /api/v1/autopay/subscriptions/:p/cancel, POST /api/v1/charge-batches, POST /api/v1/charge-batches/:p/annul, POST /api/v1/payment-adjustments/:p/revert, POST /api/v1/payments/extract-receipt, POST /api/v1/payments/glosas, POST /api/v1/payments/glosas/:p/conciliate, POST /api/v1/payments/glosas/:p/reopen, POST /api/v1/payments/glosas/:p/resolve, POST /api/v1/payments/glosas/:p/respond, POST /api/v1/payments/glosas/auto-evaluate, POST /api/v1/payments/reconciliation/upload/:p, POST /api/v1/students/children-by-ids, POST /api/v1/templates/render, edge:send-email, enrollments.update, payment_reminder_logs.insert, payments.insert, payments.update, profiles.update, rpc:admin_set_payer_billing_details, rpc:close_month, rpc:mark_overdue_payments, rpc:open_month, rpc:reject_payment_receipt, rpc:reopen_month, school_settings.update, school_settings.upsert
- **Lee:** GET /api/v1/athletes/:p/:p/charge-suggestions, GET /api/v1/athletes/:p/:p/open-charges, GET /api/v1/autopay/mine, GET /api/v1/autopay/school/:p/panel, GET /api/v1/autopay/setup, GET /api/v1/autopay/tokens/:p, GET /api/v1/charge-batches/:p, GET /api/v1/charge-batches/athlete-search:p, GET /api/v1/charge-batches/targets:p)}, GET /api/v1/charge-batches:p)}, GET /api/v1/payment-adjustments:p, GET /api/v1/payment-providers/school/:p, GET /api/v1/payments/glosas/mine, GET /api/v1/payments/reconciliation/dashboard/:p:p, GET /api/v1/whatsapp/:p/notas-de-comprobantes, POST /api/v1/charge-batches/preview, children.select, enrollments.select, monthly_closes.select, offering_plans.select, payment_reminder_logs.select, payments.select, profiles.select, rpc:get_athlete_payment_timeline, rpc:get_athletes_without_payment, rpc:get_payment_aging_report, rpc:get_school_payment_history_grid, rpc:get_school_year_closes_report, rpc:preview_close_month, rpc:preview_open_month, rpc:school_payment_kpis, school_athletes.select, school_categories.select, school_settings.select, schools.select, storage:payment-receipts.createSignedUrl, teams.select, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Cobros y pagos / Registrar pago Cobros / Pago** — `pages/PaymentsAutomationPage.tsx:1488` · gates: `showRegisterButton` · abre: setShowCashModal
- [button] **Actualizar** — `pages/PaymentsAutomationPage.tsx:1500` · gates: `disabled: {loading}` · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [export] **Exportar Reporte Exportar** — `pages/PaymentsAutomationPage.tsx:1504`
- [dialog] **Comprobante de Pago** — `pages/PaymentsAutomationPage.tsx:2965`
- [link] **Abrir en pestaña nueva → {viewingProof.url}** — `pages/PaymentsAutomationPage.tsx:2985` · gates: `viewingProof.url`
- [button] **Cerrar** — `pages/PaymentsAutomationPage.tsx:2996`
- [button] **Calculando... Ver vista previa del mes a abrir** — `pages/PaymentsAutomationPage.tsx:3126` · gates: `!showPreview && disabled: {loading}` · R: rpc:preview_open_month
- [button] **Generando... Confirmar y generar pago(s)** — `pages/PaymentsAutomationPage.tsx:3168` · gates: `!(!showPreview) && disabled: {generating}` · W: rpc:open_month
- [button] **Cancelar** — `pages/PaymentsAutomationPage.tsx:3173` · gates: `!(!showPreview)`
- [dialog] **Aprobar cobro** — `components/payment/ApprovePaymentMethodSheet.tsx:170`
- [button] **Ver comprobante** — `components/payment/ApprovePaymentMethodSheet.tsx:243` · gates: `payment?.receipt_url && disabled: {viewingReceipt}`
- [button] **Completar saldo / Pago completo** — `components/payment/ApprovePaymentMethodSheet.tsx:277` · gates: `canAbono`
- [button] **Registrar abono** — `components/payment/ApprovePaymentMethodSheet.tsx:284` · gates: `canAbono`
- [button] **Procesando...** — `components/payment/ApprovePaymentMethodSheet.tsx:317` · gates: `disabled: {loading \|\| allowInstallments === null \|\| (mode === 'full' …` · W: payments.update, enrollments.update, rpc:notify_user · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [dialog] **Rechazar comprobante** — `components/payment/RejectReceiptDialog.tsx:73`
- [button] **Cancelar** — `components/payment/RejectReceiptDialog.tsx:124` · gates: `disabled: {saving}`
- [button] **Rechazar comprobante** — `components/payment/RejectReceiptDialog.tsx:125` · gates: `disabled: {saving \|\| !!validation}` · W: rpc:reject_payment_receipt · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [dialog] **Aprobar todos los verdes** — `components/payment/BulkApproveGreensDialog.tsx:80`
- [button] **Cancelar** — `components/payment/BulkApproveGreensDialog.tsx:119` · gates: `disabled: {running}`
- [button] **Aprobar ·** — `components/payment/BulkApproveGreensDialog.tsx:120` · gates: `disabled: {running \|\| eligible.length === 0 \|\| !userId \|\| !schoolId}` · W: payments.update, enrollments.update, rpc:notify_user · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [dialog] **Abrir aclaración (glosa)** — `components/payment/CreateGlosaDialog.tsx:73`
- [filter] **Selector: {reason}** — `components/payment/CreateGlosaDialog.tsx:81` · gates: `disabled: {submitting}`
- [button] **Cancelar** — `components/payment/CreateGlosaDialog.tsx:92` · gates: `disabled: {submitting}`
- [button] **Abrir glosa** — `components/payment/CreateGlosaDialog.tsx:93` · gates: `disabled: {submitting}` · W: POST /api/v1/payments/glosas · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [dialog] **Conciliar aclaración** — `components/payment/GlosaConciliationDialog.tsx:95`
- [link] ** → {imgUrl}** — `components/payment/GlosaConciliationDialog.tsx:127` · gates: `imgUrl`
- [button] **Soporte** — `components/payment/GlosaConciliationDialog.tsx:157` · gates: `files.length > 0` · R: storage:payment-receipts.createSignedUrl
- [button] **Cerrar** — `components/payment/GlosaConciliationDialog.tsx:188` · gates: `disabled: {!!submitting}`
- [button] **Ratificar (sigue pendiente)** — `components/payment/GlosaConciliationDialog.tsx:189` · gates: `disabled: {!!submitting}` · W: POST /api/v1/payments/glosas/:p/resolve · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- [button] **Aceptar (aprobar pago)** — `components/payment/GlosaConciliationDialog.tsx:198` · gates: `disabled: {!!submitting}` · W: POST /api/v1/payments/glosas/:p/resolve · R: payments.select, unregistered_athletes.select, GET /api/v1/whatsapp/:p/notas-de-comprobantes, rpc:school_payment_kpis
- ↪ componente compartido `components/payment/CobrosYPagosModal.tsx` (5 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/RegisterCashPaymentModal.tsx` (17 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/ResultScreen.tsx` (4 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/NewAthleteForm.tsx` (5 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/AthletePicker.tsx` (4 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/MultiTargetPicker.tsx` (3 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PendingChargesSection.tsx` (8 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/NewChargeLines.tsx` (8 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/GlobalDiscount.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PaymentBlock.tsx` (6 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/PreviewSummary.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/BillingDetailsForm.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/payment/cobros-y-pagos/DiscountControl.tsx` (6 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/MunicipalitySelect.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Cobros» (`recurrent`) — PaymentsAutomationPage.tsx:1553

- [bulk] **Aprobar todos los verdes ( )** — `pages/PaymentsAutomationPage.tsx:1578` · gates: `greenSelection.eligible.length > 0` · abre: setBulkGreensOpen
- [filter] **Buscar: Buscar alumno, padre o equipo...** — `pages/PaymentsAutomationPage.tsx:1587`
- [button] **Comprobante** — `pages/PaymentsAutomationPage.tsx:1656` · gates: `!(loading) && payment.receipt_url` · R: storage:payment-receipts.createSignedUrl
- [button] **Aprobar** — `pages/PaymentsAutomationPage.tsx:1660` · gates: `!(loading)`
- [button] **Rechazar** — `pages/PaymentsAutomationPage.tsx:1664` · gates: `!(loading) && disabled: {!(payment.status === 'awaiting_approval' \|\| ((payment.stat…`
- [button] **Glosar** — `pages/PaymentsAutomationPage.tsx:1668` · gates: `!(loading)`
- [button] **Ver** — `pages/PaymentsAutomationPage.tsx:1756` · gates: `!(loading) && payment.receipt_url` · R: storage:payment-receipts.createSignedUrl
- [button] **Aprobar** — `pages/PaymentsAutomationPage.tsx:1767` · gates: `!(loading)`
- [button] **Rechazar** — `pages/PaymentsAutomationPage.tsx:1771` · gates: `!(loading) && disabled: {!(payment.status === 'awaiting_approval' \|\| ((payment.stat…`
- [button] **Glosar** — `pages/PaymentsAutomationPage.tsx:1774` · gates: `!(loading)`
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Equipos y Planes» (`teams`) — PaymentsAutomationPage.tsx:1554

- [filter] **Buscar: Buscar alumno, equipo o plan...** — `pages/PaymentsAutomationPage.tsx:1813`
- [button] **Anterior** — `pages/PaymentsAutomationPage.tsx:2019` · gates: `subsTotalPages > 1 && disabled: {subsPage &lt;= 1}`
- [button] **Siguiente** — `pages/PaymentsAutomationPage.tsx:2021` · gates: `subsTotalPages > 1 && disabled: {subsPage >= subsTotalPages}`

#### Pestaña «Glosas» (`glosas`) — PaymentsAutomationPage.tsx:1555

- [button] **Conciliar / Ver** — `pages/PaymentsAutomationPage.tsx:2074` · gates: `!(glosas.length === 0)`

#### Pestaña «Historial» (`history`) — PaymentsAutomationPage.tsx:1557

- [filter] **Buscar: Buscar alumno, padre o concepto...** — `pages/PaymentsAutomationPage.tsx:2103`
- [button] **Ver** — `pages/PaymentsAutomationPage.tsx:2256` · gates: `!(historyPayments.length === 0) && payment.receipt_url` · R: storage:payment-receipts.createSignedUrl
- [button] **(() => handleShowProof(payment))** — `pages/PaymentsAutomationPage.tsx:2349` · gates: `!(historyPayments.length === 0) && payment.receipt_url` · R: storage:payment-receipts.createSignedUrl
- [button] **Anterior** — `pages/PaymentsAutomationPage.tsx:2372` · gates: `historyTotalPages > 1 && disabled: {historyPage &lt;= 1}`
- [button] **Siguiente** — `pages/PaymentsAutomationPage.tsx:2374` · gates: `historyTotalPages > 1 && disabled: {historyPage >= historyTotalPages}`

#### Pestaña «Config» (`config`) — PaymentsAutomationPage.tsx:1560

- [button] **Guardar Cambios** — `pages/PaymentsAutomationPage.tsx:2411` · gates: `disabled: {billingSaving}` · W: school_settings.upsert
- [toggle] **Alta a mitad de mes por clases restantes Con mensualidad fi…** — `pages/PaymentsAutomationPage.tsx:2482` · gates: `billing && (currentUserRole === 'owner' \|\| currentUserRole === 'super_admin') && remaining…`
- [toggle] **Generar cobros automáticos Crear pagos pendientes cada mes** — `pages/PaymentsAutomationPage.tsx:2505` · gates: `billing`
- [toggle] **Descuento por pronto pago Premia a quien paga apenas se gen…** — `pages/PaymentsAutomationPage.tsx:2513` · gates: `billing`
- [toggle] **Descuento por hermanos Se aplica solo, desde el 2do hijo ac…** — `pages/PaymentsAutomationPage.tsx:2553` · gates: `billing`
- [toggle] **Habilitar mora Recargo después del período de gracia** — `pages/PaymentsAutomationPage.tsx:2617` · gates: `billing`
- [toggle] **🏖️ Permitir pausa por vacaciones Durante la pausa no se le…** — `pages/PaymentsAutomationPage.tsx:2645` · gates: `billing`
- [toggle] **El acudiente puede solicitarla La solicita desde su app y l…** — `pages/PaymentsAutomationPage.tsx:2672` · gates: `billing && billing.pause_enabled`
- [toggle] **Exigir comprobante Los padres deben subir foto del recibo** — `pages/PaymentsAutomationPage.tsx:2684` · gates: `billing`
- [toggle] **Auto-aprobar comprobantes verdes Un comprobante nítido, del…** — `pages/PaymentsAutomationPage.tsx:2702` · gates: `billing`
- [toggle] **Abrir glosa automática Si un comprobante tiene inconsistenc…** — `pages/PaymentsAutomationPage.tsx:2733` · gates: `billing`
- [toggle] **Enviar recordatorios Notificar antes del vencimiento** — `pages/PaymentsAutomationPage.tsx:2748` · gates: `billing`
- [toggle] **Avisar cobros nuevos y vencidos por correo Envía un correo …** — `pages/PaymentsAutomationPage.tsx:2772` · gates: `billing`
- [toggle] **Coaches pueden enviar mensajes Comunicación directa coach →…** — `pages/PaymentsAutomationPage.tsx:2787` · gates: `billing`
- [toggle] **Coaches pueden inscribir en equipos con cobro Inscribir a u…** — `pages/PaymentsAutomationPage.tsx:2799` · gates: `billing`
- [toggle] **Coaches pueden subir hojas de matrícula El entrenador toma …** — `pages/PaymentsAutomationPage.tsx:2813` · gates: `billing`
- [toggle] **Coaches pueden subir planillas de asistencia Foto de la pla…** — `pages/PaymentsAutomationPage.tsx:2827` · gates: `billing`
- [button] **Ocultar / Mostrar** — `pages/PaymentsAutomationPage.tsx:2858` · gates: `billing`
- [button] **Eliminar QR** — `pages/PaymentsAutomationPage.tsx:2905` · gates: `billing && billing.payment_qr_url`
- [toggle] **Vender por WhatsApp El asistente responde precio, fecha y c…** — `components/settings/SellableCatalogCard.tsx:260` · gates: `billing && schoolId && !(!enabled) && showService && waSales !== null && disabled: {saving}` · W: school_settings.update
- [button] **(() => toggleActive(item))** — `components/settings/SellableCatalogCard.tsx:286` · gates: `billing && schoolId && !(!enabled) && items.length > 0 && disabled: {saving}` · R: school_settings.select
- [button] **Cancelar** — `components/settings/SellableCatalogCard.tsx:298` · gates: `billing && schoolId && !(!enabled) && editingId`
- [toggle] **Se cobra por deportista** — `components/settings/SellableCatalogCard.tsx:334` · gates: `billing && schoolId && !(!enabled) && showService`
- [button] **Guardar cambios / Agregar** — `components/settings/SellableCatalogCard.tsx:340` · gates: `billing && schoolId && !(!enabled) && disabled: {saving}` · R: school_settings.select
- [toggle] **Mostrar esta llave a los acudientes** — `components/payment/PaymentAccountsEditor.tsx:129` · gates: `billing && !(accounts.length === 0)`
- [button] **Eliminar llave** — `components/payment/PaymentAccountsEditor.tsx:139` · gates: `billing && !(accounts.length === 0)`
- [button] **Agregar llave** — `components/payment/PaymentAccountsEditor.tsx:185` · gates: `billing`
- [toggle] **Activar pagos online Habilita el botón "Pagar online" en la…** — `components/settings/SportMapsPaySettings.tsx:297` · gates: `billing && disabled: {!cuentaLista && !settings.wompi_enabled}`
- [filter] **Selector: {settings.fee_payer}** — `components/settings/SportMapsPaySettings.tsx:364` · gates: `billing && (settings.wompi_enabled \|\| settings.sportmaps_pay_terms_accepted_at)`
- [button] **Guardando... Guardar configuración de pagos** — `components/settings/SportMapsPaySettings.tsx:441` · gates: `billing && disabled: {saving \|\| (settings.wompi_enabled && !cuentaLista) \|\| (set…` · W: school_settings.update · R: school_settings.select, schools.select, GET /api/v1/payment-providers/school/:p
- [button] **Agregar pasarela** — `components/admin/PaymentProvidersAdmin.tsx:113` · gates: `billing && schoolId && esPlatformAdmin` · abre: setEditingId
- [toggle] **Activo** — `components/admin/PaymentProvidersAdmin.tsx:145` · gates: `billing && schoolId && esPlatformAdmin` · W: PATCH /api/v1/payment-providers/:p
- [toggle] **Default** — `components/admin/PaymentProvidersAdmin.tsx:153` · gates: `billing && schoolId && esPlatformAdmin` · W: PATCH /api/v1/payment-providers/:p
- [button] **Editar** — `components/admin/PaymentProvidersAdmin.tsx:159` · gates: `billing && schoolId && esPlatformAdmin` · abre: setEditingId
- [button] **Eliminar** — `components/admin/PaymentProvidersAdmin.tsx:166` · gates: `billing && schoolId && esPlatformAdmin` · W: DELETE /api/v1/payment-providers/:p
- [dialog] **Editar / Agregar pasarela** — `components/admin/PaymentProvidersAdmin.tsx:310` · gates: `billing && schoolId && esPlatformAdmin`
- [toggle] **Sandbox** — `components/admin/PaymentProvidersAdmin.tsx:407` · gates: `billing && schoolId && esPlatformAdmin`
- [toggle] **Marcar como default** — `components/admin/PaymentProvidersAdmin.tsx:412` · gates: `billing && schoolId && esPlatformAdmin`
- [button] **Cancelar** — `components/admin/PaymentProvidersAdmin.tsx:417` · gates: `billing && schoolId && esPlatformAdmin && disabled: {submitting}`
- [button] **Guardando... / Guardar** — `components/admin/PaymentProvidersAdmin.tsx:418` · gates: `billing && schoolId && esPlatformAdmin && disabled: {submitting}` · W: PATCH /api/v1/payment-providers/:p
- [toggle] **Permitir abonos Los padres pueden pagar parcialmente** — `components/payment/InstallmentsConfigCard.tsx:96` · gates: `billing`
- [toggle] **Exigir comprobante en abonos El padre debe subir foto del r…** — `components/payment/InstallmentsConfigCard.tsx:145` · gates: `billing`
- ↪ componente compartido `components/common/FileUpload.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Conciliación» (`conciliacion`) — PaymentsAutomationPage.tsx:1556

- [filter] **Selector: {bank}** — `components/payment/ReconciliationTab.tsx:103` · gates: `schoolId`
- [button] **Conciliar movimientos** — `components/payment/ReconciliationTab.tsx:134` · gates: `schoolId && parsed && parsed.lines.length > 0 && disabled: {uploading}` · W: POST /api/v1/payments/reconciliation/upload/:p · R: GET /api/v1/payments/reconciliation/dashboard/:p:p

#### Pestaña «Operaciones» (`operaciones`) — PaymentsAutomationPage.tsx:1561 · gate: showOperacionesTab

- ↪ componente compartido `components/payment/OperacionesTab.tsx` (13 acciones) — detallado en `/students`

#### Pestaña «Cierre» (`cierre`) — PaymentsAutomationPage.tsx:1558

- [button] **Reabrir** — `components/finances/MonthCloseTab.tsx:258` · gates: `status === 'cerrado'` · abre: setReopenOpen
- [button] **Volver a cerrar / Cerrar mes** — `components/finances/MonthCloseTab.tsx:260` · abre: setConfirmOpen
- [button] **Ver en Historial** — `components/finances/MonthCloseTab.tsx:289`
- [link] **Ver en Historial → /payments-automation?tab=history** — `components/finances/MonthCloseTab.tsx:290`
- [dialog] **Volver a cerrar / Cerrar** — `components/finances/MonthCloseTab.tsx:358`
- [button] **Cancelar** — `components/finances/MonthCloseTab.tsx:365` · abre: setConfirmOpen
- [button] **Confirmar** — `components/finances/MonthCloseTab.tsx:366` · gates: `disabled: {closing}` · W: rpc:close_month
- [dialog] **Reabrir** — `components/finances/MonthCloseTab.tsx:377`
- [button] **Cancelar** — `components/finances/MonthCloseTab.tsx:382` · abre: setReopenOpen
- [button] **Confirmar reapertura** — `components/finances/MonthCloseTab.tsx:383` · gates: `disabled: {reopening \|\| !reopenReason.trim()}` · W: rpc:reopen_month
- [dialog] **Ver estado de cuenta completo →** — `components/finances/MonthCloseTab.tsx:394`
- [button] **Ver estado de cuenta completo →** — `components/finances/MonthCloseTab.tsx:397` · gates: `timelineTarget`
- [link] **Ver estado de cuenta completo → → {`/estado-cuenta?${new URLSearchParams({ ...(timelineTarget.child_id ?…}** — `components/finances/MonthCloseTab.tsx:398` · gates: `timelineTarget`
- [link] ** → {`https://wa.me/${wa}`}** — `components/finances/PaymentAgingCard.tsx:250` · gates: `!(item.canal_automatico) && item.contacto_manual?.telefono`
- [button] **Anterior** — `components/finances/PaymentAgingCard.tsx:295` · gates: `agingTotalPages > 1 && disabled: {agingCurrentPage &lt;= 1}`
- [button] **Siguiente** — `components/finances/PaymentAgingCard.tsx:297` · gates: `agingTotalPages > 1 && disabled: {agingCurrentPage >= agingTotalPages}`

#### Pestaña «Débito automático» (`debito`) — PaymentsAutomationPage.tsx:1559

- [button] **Reintentar** — `components/autopay/DebitoAutomaticoPanel.tsx:168` · gates: `schoolId` · R: GET /api/v1/autopay/school/:p/panel
- [button] **Invitar a las familias** — `components/autopay/DebitoAutomaticoPanel.tsx:188` · gates: `schoolId && disabled: {!gatewayReady \|\| !ajustes.offered}`
- [button] **Pedí la devolución** — `components/autopay/DebitoAutomaticoPanel.tsx:213` · gates: `schoolId && inc.state === 'open' && disabled: {busyRow === inc.id}` · W: POST /api/v1/autopay/school/:p/incidents/:p/resolve · R: GET /api/v1/autopay/school/:p/panel
- [button] **Devolución hecha** — `components/autopay/DebitoAutomaticoPanel.tsx:215` · gates: `schoolId && disabled: {busyRow === inc.id}` · W: POST /api/v1/autopay/school/:p/incidents/:p/resolve · R: GET /api/v1/autopay/school/:p/panel
- [button] **Dejar como saldo a favor** — `components/autopay/DebitoAutomaticoPanel.tsx:216` · gates: `schoolId && disabled: {busyRow === inc.id}` · W: POST /api/v1/autopay/school/:p/incidents/:p/resolve · R: GET /api/v1/autopay/school/:p/panel
- [button] **Descartar** — `components/autopay/DebitoAutomaticoPanel.tsx:217` · gates: `schoolId && disabled: {busyRow === inc.id}` · W: POST /api/v1/autopay/school/:p/incidents/:p/resolve · R: GET /api/v1/autopay/school/:p/panel
- [button] **Sí** — `components/autopay/DebitoAutomaticoPanel.tsx:337` · gates: `schoolId && !(rows.length === 0) && !(r.status === 'cancelled') && disabled: {busyRow === r.subscriptionId}` · W: POST /api/v1/autopay/school/:p/subscriptions/:p/cancel, POST /api/v1/autopay/school/:p/settings · R: GET /api/v1/autopay/school/:p/panel
- [button] **No** — `components/autopay/DebitoAutomaticoPanel.tsx:340` · gates: `schoolId && !(rows.length === 0) && !(r.status === 'cancelled')`
- [button] **Cancelar débito** — `components/autopay/DebitoAutomaticoPanel.tsx:343` · gates: `schoolId && !(rows.length === 0) && !(r.status === 'cancelled')` · W: POST /api/v1/autopay/school/:p/settings
- [toggle] **Ofrecer débito automático a las familias Si lo apagas, nadi…** — `components/autopay/DebitoAutomaticoPanel.tsx:369` · gates: `schoolId && disabled: {!gatewayReady \|\| saving}`
- [toggle] **Pausar los débitos Mientras esté pausado no debitamos a nad…** — `components/autopay/DebitoAutomaticoPanel.tsx:383` · gates: `schoolId && disabled: {!gatewayReady \|\| saving}`
- [button] **Pausar y avisar** — `components/autopay/DebitoAutomaticoPanel.tsx:399` · gates: `schoolId && confirmarPausa && disabled: {saving}` · W: POST /api/v1/autopay/school/:p/settings · R: GET /api/v1/autopay/school/:p/panel
- [button] **Cancelar** — `components/autopay/DebitoAutomaticoPanel.tsx:403` · gates: `schoolId && confirmarPausa && disabled: {saving}`
- [filter] **Selector: {ajustes.surchargeMode}** — `components/autopay/DebitoAutomaticoPanel.tsx:412` · gates: `schoolId && disabled: {!gatewayReady \|\| saving}`
- [filter] **Selector: {String(ajustes.daysBeforeDue)}** — `components/autopay/DebitoAutomaticoPanel.tsx:431` · gates: `schoolId && disabled: {!gatewayReady \|\| saving}`
- [button] **Guardar ajustes** — `components/autopay/DebitoAutomaticoPanel.tsx:450` · gates: `schoolId && disabled: {!gatewayReady \|\| !dirty \|\| saving}` · W: POST /api/v1/autopay/school/:p/settings · R: GET /api/v1/autopay/school/:p/panel

<a id="-recepcion"></a>
### Modo Recepción (kiosko) — `/recepcion`

- **Rol:** school+school_admin · **Menú:** Finanzas > Modo Recepción
- **Archivo:** `frontend/src/pages/recepcion/RecepcionPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, reporter] · ModuleGate=finanzas_recepcion
- **Estado:** works · **Uso:** no medido
- ⚠ Kiosko sin chrome; escucha payments/notifications en tiempo real. Sin tabla propia: uso no medible por filas. Apagado por override en 1 escuela.
- **Lee:** notifications.select, payments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Activar recepción** — `pages/recepcion/RecepcionPage.tsx:237`
- [button] **Ajustes** — `pages/recepcion/RecepcionPage.tsx:279`
- [button] **Solo tono** — `pages/recepcion/RecepcionPage.tsx:372`
- [button] **Probar anuncio** — `pages/recepcion/RecepcionPage.tsx:426`
- [button] **Salir de recepción** — `pages/recepcion/RecepcionPage.tsx:430`

<a id="-accounting"></a>
### Contabilidad (libro de caja) — `/accounting`

- **Rol:** school+school_admin · **Menú:** Finanzas > Contabilidad > Contabilidad
- **Otras entradas:** Acción rápida: Contabilidad
- **Archivo:** `frontend/src/pages/AccountingPage.tsx` (+9 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, accountant] · ModuleGate=finanzas_contabilidad · addon accounting
- **Estado:** works · **Uso:** usado — expenses s90=3 r90=20 tot=21; electronic_invoices s90=2 r90=324 tot=324
- ⚠ Addon accounting: 7 escuelas; apagado por override en 3. La pestaña de facturación es el mismo InvoicingTab que /facturacion-electronica.
- **Escribe:** DELETE /api/v1/invoicing/providers/:p, PATCH /api/v1/invoicing/providers/:p/enabled, POST /api/v1/invoicing/backfill/:p/:p, POST /api/v1/invoicing/credit-note/:p, POST /api/v1/invoicing/emit/:p, POST /api/v1/invoicing/providers/:p/:p, expense_attachments.insert, expenses.insert, profiles.update, rpc:admin_set_payer_billing_details, rpc:finance_ledger_page, rpc:finance_ledger_totals, rpc:void_expense, storage:accounting-receipts.upload
- **Lee:** GET /api/v1/invoicing/active/school/:p, GET /api/v1/invoicing/by-payment/:p, GET /api/v1/invoicing/invoices/:p/:p, GET /api/v1/invoicing/providers/:p/:p, children.select, electronic_invoices.select, expense_attachments.select, expense_categories.select, expenses.select, payments.select, profiles.select, rpc:can_manage_finances, rpc:finance_income_summary, storage:accounting-receipts.createSignedUrl, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/AccountingPage.tsx:369` · W: rpc:finance_ledger_page, rpc:finance_ledger_totals
- [link] **Ver planes y activar → /admin/mi-plan** — `pages/AccountingPage.tsx:390`
- [dialog] **Anular gasto** — `pages/AccountingPage.tsx:677`
- [button] **Cancelar** — `pages/AccountingPage.tsx:697` · gates: `disabled: {voidMutation.isPending}` · abre: setVoidTarget
- [button] **Anular gasto** — `pages/AccountingPage.tsx:698` · gates: `disabled: {voidMutation.isPending \|\| voidReason.trim().length &lt; MIN_V…` · W: rpc:void_expense
- [button] **Registrar gasto** — `pages/AccountingPage.tsx:782` · gates: `disabled: {disabled}`
- [dialog] **Registrar gasto** — `pages/AccountingPage.tsx:788`
- [filter] **Selector: Selecciona categoría** — `pages/AccountingPage.tsx:794` · abre: setCategoryId
- [filter] **Selector: {paymentMethod}** — `pages/AccountingPage.tsx:823`
- [button] **Cancelar** — `pages/AccountingPage.tsx:854` · gates: `disabled: {mutation.isPending}`
- [button] **Guardar gasto** — `pages/AccountingPage.tsx:855` · gates: `disabled: {mutation.isPending}`

#### Pestaña «Libro de caja» (`ledger`) — AccountingPage.tsx:466

- [export] **Exportar libro (CSV)** — `pages/AccountingPage.tsx:482` · gates: `disabled: {exporting \|\| !schoolId}` · W: rpc:finance_ledger_page · R: expenses.select, payments.select, expense_categories.select
- [button] **Ver comprobante** — `pages/AccountingPage.tsx:591` · gates: `!(ledgerQuery.isLoading) && r.direction === 'expense' && hasReceipt(r.id)` · R: expense_attachments.select, storage:accounting-receipts.createSignedUrl
- [button] **Anular** — `pages/AccountingPage.tsx:616` · gates: `!(ledgerQuery.isLoading) && canManage && r.source === 'expense'` · abre: setVoidTarget
- [button] **Cargar más** — `pages/AccountingPage.tsx:634` · gates: `ledgerQuery.hasNextPage && disabled: {ledgerQuery.isFetchingNextPage}` · W: rpc:finance_ledger_page
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Facturación electrónica» (`einvoicing`) — AccountingPage.tsx:467

- [link] **Ver planes y activar → /admin/mi-plan** — `pages/AccountingPage.tsx:664` · gates: `!hasAddon('invoicing')`
- [filter] **Selector: {estadoFiltro}** — `components/accounting/InvoicingTab.tsx:384` · gates: `!(!hasAddon('invoicing'))`
- [button] **Quitar filtros** — `components/accounting/InvoicingTab.tsx:420` · gates: `!(!hasAddon('invoicing')) && hayFiltros`
- [button] **Ver rechazadas** — `components/accounting/InvoicingTab.tsx:454` · gates: `!(!hasAddon('invoicing')) && rechazadas.count > 0 && estadoFiltro !== 'rejected'`
- [button] **Reintentar** — `components/accounting/InvoicingTab.tsx:496` · gates: `!(!hasAddon('invoicing')) && invoicesQuery.isError` · R: GET /api/v1/invoicing/invoices/:p/:p
- [button] **Anterior** — `components/accounting/InvoicingTab.tsx:546` · gates: `!(!hasAddon('invoicing')) && !(invoicesQuery.isError) && disabled: {page &lt;= 1 \|\| invoicesQuery.isFetching}`
- [button] **Siguiente** — `components/accounting/InvoicingTab.tsx:554` · gates: `!(!hasAddon('invoicing')) && !(invoicesQuery.isError) && disabled: {page >= totalPaginas \|\| invoicesQuery.isFetching}`
- [button] **Editar / Configurar** — `components/accounting/InvoicingTab.tsx:584` · gates: `!(!hasAddon('invoicing'))` · abre: setConfigOpen
- [toggle] **Facturador activo** — `components/accounting/InvoicingTab.tsx:606` · gates: `!(!hasAddon('invoicing')) && !(providersQuery.isLoading) && disabled: {cambiandoEstado}` · W: PATCH /api/v1/invoicing/providers/:p/enabled · R: GET /api/v1/invoicing/providers/:p/:p
- [button] **Ver** — `components/accounting/InvoicingTab.tsx:865` · gates: `!(!hasAddon('invoicing')) && inv.public_url`
- [link] **Ver → {inv.public_url}** — `components/accounting/InvoicingTab.tsx:866` · gates: `!(!hasAddon('invoicing')) && inv.public_url`
- [button] **Anular** — `components/accounting/InvoicingTab.tsx:872` · gates: `!(!hasAddon('invoicing')) && puedeAnular`
- [link] **ver la nota crédito → {notaCredito.public_url}** — `components/accounting/InvoicingTab.tsx:947` · gates: `!(!hasAddon('invoicing')) && mostrarDetalle && anulada && notaCredito && notaCredito.public_url`
- [button] **Emitir facturas del rango** — `components/accounting/InvoicingTab.tsx:1302` · gates: `!(!hasAddon('invoicing')) && disabled: {!puedeEmitir \|\| mutation.isPending}` · abre: setConfirmOpen
- [dialog] **¿Emitir factura(s) por ?** — `components/accounting/InvoicingTab.tsx:1320` · gates: `!(!hasAddon('invoicing'))`
- [button] **Cancelar** — `components/accounting/InvoicingTab.tsx:1389` · gates: `!(!hasAddon('invoicing')) && disabled: {mutation.isPending}` · abre: setConfirmOpen
- [button] **Sí, emitir** — `components/accounting/InvoicingTab.tsx:1392` · gates: `!(!hasAddon('invoicing')) && disabled: {!entendido \|\| mutation.isPending}` · W: POST /api/v1/invoicing/backfill/:p/:p · R: GET /api/v1/invoicing/invoices/:p/:p
- [dialog] **Configurar facturador electrónico** — `components/accounting/InvoicingTab.tsx:1616` · gates: `!(!hasAddon('invoicing'))`
- [filter] **Selector: {provider}** — `components/accounting/InvoicingTab.tsx:1627` · gates: `!(!hasAddon('invoicing'))`
- [toggle] **Modo pruebas** — `components/accounting/InvoicingTab.tsx:1638` · gates: `!(!hasAddon('invoicing'))`
- [toggle] **Facturador activo Inactivo = no se emite ninguna factura (n…** — `components/accounting/InvoicingTab.tsx:1719` · gates: `!(!hasAddon('invoicing'))`
- [toggle] **Servicios excluidos de IVA Típico en servicios deportivos/e…** — `components/accounting/InvoicingTab.tsx:1727` · gates: `!(!hasAddon('invoicing'))`
- [button] **Cancelar** — `components/accounting/InvoicingTab.tsx:1732` · gates: `!(!hasAddon('invoicing')) && disabled: {mutation.isPending}`
- [button] **Guardar** — `components/accounting/InvoicingTab.tsx:1733` · gates: `!(!hasAddon('invoicing')) && disabled: {mutation.isPending}` · W: POST /api/v1/invoicing/backfill/:p/:p · R: GET /api/v1/invoicing/invoices/:p/:p
- [dialog] **Factura anulada** — `components/accounting/VoidInvoiceDialog.tsx:308` · gates: `!(!hasAddon('invoicing'))`
- [button] **Ver la nota crédito** — `components/accounting/VoidInvoiceDialog.tsx:329` · gates: `!(!hasAddon('invoicing')) && nc?.publicUrl`
- [link] **Ver la nota crédito → {nc.publicUrl}** — `components/accounting/VoidInvoiceDialog.tsx:330` · gates: `!(!hasAddon('invoicing')) && nc?.publicUrl`
- [button] **Listo** — `components/accounting/VoidInvoiceDialog.tsx:338` · gates: `!(!hasAddon('invoicing'))`
- [dialog] **(sin etiqueta)** — `components/accounting/VoidInvoiceDialog.tsx:385` · gates: `!(!hasAddon('invoicing'))`
- [button] **Cerrar** — `components/accounting/VoidInvoiceDialog.tsx:418` · gates: `!(!hasAddon('invoicing'))`
- [button] **Ir a la configuración** — `components/accounting/VoidInvoiceDialog.tsx:420` · gates: `!(!hasAddon('invoicing')) && bloqueo.config && onConfigurarFacturador`
- [dialog] **¿Anular la factura ?** — `components/accounting/VoidInvoiceDialog.tsx:433` · gates: `!(!hasAddon('invoicing'))`
- [filter] **Selector: {concepto}** — `components/accounting/VoidInvoiceDialog.tsx:460` · gates: `!(!hasAddon('invoicing'))`
- [button] **Cancelar** — `components/accounting/VoidInvoiceDialog.tsx:583` · gates: `!(!hasAddon('invoicing')) && disabled: {mutation.isPending}`
- [button] **Sí, anular** — `components/accounting/VoidInvoiceDialog.tsx:586` · gates: `!(!hasAddon('invoicing')) && disabled: {!entendido \|\| !motivoValido \|\| mutation.isPending}` · W: POST /api/v1/invoicing/credit-note/:p
- [button] **{`Copiar ${label}`}** — `components/accounting/InvoiceIdentifiers.tsx:43` · gates: `!(!hasAddon('invoicing')) && inv.cufe`
- [button] **Emitir la factura electrónica de este pago** — `components/accounting/EmitPaymentInvoiceButton.tsx:78` · gates: `!(!hasAddon('invoicing')) && puedeReintentar && inv.payment_id && disabled: {mutation.isPending}`
- [dialog] **¿Emitir la factura de este pago?** — `components/accounting/EmitPaymentInvoiceButton.tsx:93` · gates: `!(!hasAddon('invoicing')) && puedeReintentar && inv.payment_id`
- [button] **Emitir factura** — `components/accounting/EmitPaymentInvoiceButton.tsx:102` · gates: `!(!hasAddon('invoicing')) && puedeReintentar && inv.payment_id && disabled: {mutation.isPending}` · W: POST /api/v1/invoicing/emit/:p

#### Pestaña «Datos fiscales faltantes» (`faltantes`) — InvoicingTab.tsx:673 · gate: esEscuela

- [button] **Actualizar** — `components/accounting/MissingBillingDataPanel.tsx:524` · gates: `!(!hasAddon('invoicing')) && esEscuela && disabled: {query.isFetching}` · R: electronic_invoices.select, profiles.select, children.select, unregistered_athletes.select, payments.select
- [button] **Reintentar** — `components/accounting/MissingBillingDataPanel.tsx:543` · gates: `!(!hasAddon('invoicing')) && esEscuela && query.isError` · R: electronic_invoices.select, profiles.select, children.select, unregistered_athletes.select, payments.select
- [toggle] **Incluir municipio sin código DANE ( )** — `components/accounting/MissingBillingDataPanel.tsx:564` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError)`
- [button] **Ver y corregir** — `components/accounting/MissingBillingDataPanel.tsx:591` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && !incluirMunicipio && soloMunicipio.length > 0`
- [button] **Emitir por rango** — `components/accounting/MissingBillingDataPanel.tsx:613` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && rezagados > 0 && onIrABackfill`
- [button] **Emitir por rango** — `components/accounting/MissingBillingDataPanel.tsx:702` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && visibles.length === 0 && rezagados > 0 && onIrABackfill`
- [link] ** → {`tel:${row.phone}`}** — `components/accounting/MissingBillingDataPanel.tsx:780` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && !(visibles.length === 0) && row.phone`
- [link] ** → {`mailto:${row.email}`}** — `components/accounting/MissingBillingDataPanel.tsx:785` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && !(visibles.length === 0) && row.email`
- [button] **Completar datos** — `components/accounting/MissingBillingDataPanel.tsx:796` · gates: `!(!hasAddon('invoicing')) && esEscuela && !(query.isError) && !(visibles.length === 0) && row.missing.some((m) => m === 'document' \|\| m === 'address' \|\| m === '`
- [dialog] **Datos de facturación de** — `components/accounting/MissingBillingDataPanel.tsx:820` · gates: `!(!hasAddon('invoicing')) && esEscuela`
- ↪ componente compartido `components/billing/BillingDetailsForm.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/MunicipalitySelect.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Facturas emitidas» (`emitidas`) — InvoicingTab.tsx:672 · gate: esEscuela

_(sin acciones; 0 controles menores)_

<a id="-accounting-suppliers"></a>
### Proveedores — `/accounting/suppliers`

- **Rol:** school+school_admin · **Menú:** Finanzas > Contabilidad > Proveedores
- **Archivo:** `frontend/src/pages/AccountingSuppliersPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, accountant] · ModuleGate=finanzas_contabilidad · addon accounting
- **Estado:** works · **Uso:** usado — suppliers s90=3 r90=4 tot=4
- **Escribe:** rpc:pay_supplier_bill, rpc:update_supplier_bill, rpc:void_supplier_bill, supplier_bills.insert, suppliers.insert
- **Lee:** expense_categories.select, rpc:can_manage_finances, supplier_bills.select, suppliers.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/AccountingSuppliersPage.tsx:138` · R: suppliers.select, supplier_bills.select
- [button] **Proveedor** — `pages/AccountingSuppliersPage.tsx:157` · gates: `canManage && disabled: {!schoolId}` · abre: setSupplierOpen
- [button] **Factura** — `pages/AccountingSuppliersPage.tsx:160` · gates: `canManage && disabled: {!schoolId \|\| (suppliersQuery.data ?? []).length === 0}` · abre: setBillOpen
- [button] **Pagar** — `pages/AccountingSuppliersPage.tsx:230` · gates: `!(billsQuery.isLoading) && canManage && b.status !== 'paid' && b.status !== 'void'`
- [button] **Editar factura** — `pages/AccountingSuppliersPage.tsx:238` · gates: `!(billsQuery.isLoading) && canManage && sinPagos(b)`
- [button] **Anular factura** — `pages/AccountingSuppliersPage.tsx:241` · gates: `!(billsQuery.isLoading) && canManage && sinPagos(b)`
- [dialog] **Nuevo proveedor** — `pages/AccountingSuppliersPage.tsx:356`
- [button] **Cancelar** — `pages/AccountingSuppliersPage.tsx:373` · gates: `disabled: {mutation.isPending}`
- [button] **Guardar** — `pages/AccountingSuppliersPage.tsx:374` · gates: `disabled: {mutation.isPending}` · W: suppliers.insert
- [dialog] **Nueva factura por pagar** — `pages/AccountingSuppliersPage.tsx:424`
- [filter] **Selector: Selecciona proveedor** — `pages/AccountingSuppliersPage.tsx:428` · abre: setSupplierId
- [filter] **Selector: Sin categoría** — `pages/AccountingSuppliersPage.tsx:440` · abre: setCategoryId
- [button] **Cancelar** — `pages/AccountingSuppliersPage.tsx:451` · gates: `disabled: {mutation.isPending}`
- [button] **Guardar** — `pages/AccountingSuppliersPage.tsx:452` · gates: `disabled: {mutation.isPending}` · W: suppliers.insert
- [dialog] **Registrar pago** — `pages/AccountingSuppliersPage.tsx:502`
- [filter] **Selector: {method}** — `pages/AccountingSuppliersPage.tsx:518`
- [button] **Cancelar** — `pages/AccountingSuppliersPage.tsx:533` · gates: `disabled: {mutation.isPending}`
- [button] **Pagar** — `pages/AccountingSuppliersPage.tsx:534` · gates: `disabled: {mutation.isPending}` · W: suppliers.insert
- [dialog] **Editar factura** — `pages/AccountingSuppliersPage.tsx:584`
- [filter] **Selector: Selecciona proveedor** — `pages/AccountingSuppliersPage.tsx:590` · abre: setSupplierId
- [filter] **Selector: Sin categoría** — `pages/AccountingSuppliersPage.tsx:602` · abre: setCategoryId
- [button] **Cancelar** — `pages/AccountingSuppliersPage.tsx:614` · gates: `disabled: {mutation.isPending}`
- [button] **Guardar cambios** — `pages/AccountingSuppliersPage.tsx:615` · gates: `disabled: {mutation.isPending}` · W: suppliers.insert
- [dialog] **Anular factura** — `pages/AccountingSuppliersPage.tsx:646`
- [button] **Cancelar** — `pages/AccountingSuppliersPage.tsx:661` · gates: `disabled: {mutation.isPending}`
- [button] **Anular factura** — `pages/AccountingSuppliersPage.tsx:662` · gates: `disabled: {mutation.isPending \|\| !ok}` · W: suppliers.insert

<a id="-accounting-payroll"></a>
### Nómina — `/accounting/payroll`

- **Rol:** school+school_admin · **Menú:** Finanzas > Contabilidad > Nómina
- **Archivo:** `frontend/src/pages/PayrollPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, accountant] · ModuleGate=finanzas_contabilidad · addon accounting
- **Estado:** works · **Uso:** usado — payroll_runs s90=2 r90=2 tot=2
- **Escribe:** payroll_employees.insert, payroll_employees.update, rpc:post_payroll_run, rpc:run_payroll
- **Lee:** payroll_employees.select, payroll_items.select, payroll_runs.select, rpc:can_manage_finances

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/PayrollPage.tsx:194` · R: payroll_employees.select, payroll_runs.select
- [dialog] **Editar empleado / Nuevo empleado** — `pages/PayrollPage.tsx:501`
- [filter] **Selector: {contract}** — `pages/PayrollPage.tsx:518`
- [filter] **Selector: {arl}** — `pages/PayrollPage.tsx:538`
- [toggle] **Aplica auxilio de transporte** — `pages/PayrollPage.tsx:544`
- [button] **Cancelar** — `pages/PayrollPage.tsx:554` · gates: `disabled: {mutation.isPending}`
- [button] **Guardar** — `pages/PayrollPage.tsx:555` · gates: `disabled: {mutation.isPending}` · W: payroll_employees.update, payroll_employees.insert

#### Pestaña «Nómina» (`nomina`) — PayrollPage.tsx:225

- [filter] **Selector: {String(month)}** — `pages/PayrollPage.tsx:236`
- [button] **Calcular nómina** — `pages/PayrollPage.tsx:245` · gates: `canManage && disabled: {runMutation.isPending \|\| (employeesQuery.data ?? []).lengt…` · W: rpc:run_payroll
- [export] **PDF** — `pages/PayrollPage.tsx:267` · gates: `selected` · R: payroll_runs.select, payroll_items.select
- [button] **Pagar (caja )** — `pages/PayrollPage.tsx:271` · gates: `selected && canManage && selected.status !== 'paid' && disabled: {payMutation.isPending}` · W: rpc:post_payroll_run · R: payroll_runs.select
- [button] **Ver** — `pages/PayrollPage.tsx:359` · gates: `!(runsQuery.isLoading)`
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Empleados» (`empleados`) — PayrollPage.tsx:226

- [button] **Empleado** — `pages/PayrollPage.tsx:382` · gates: `canManage && disabled: {!schoolId}` · abre: setEmpOpen
- [button] **Editar** — `pages/PayrollPage.tsx:412` · gates: `!(employeesQuery.isLoading) && canManage`
- [button] **Inactivar** — `pages/PayrollPage.tsx:413` · gates: `!(employeesQuery.isLoading) && canManage && disabled: {inactivateMutation.isPending}` · W: payroll_employees.update

<a id="-accounting-reports"></a>
### Estado de resultados — `/accounting/reports`

- **Rol:** school+school_admin · **Menú:** Finanzas > Contabilidad > Estado de resultados
- **Archivo:** `frontend/src/pages/AccountingReportsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, accountant] · ModuleGate=finanzas_contabilidad · addon accounting
- **Estado:** works · **Uso:** no medido
- ⚠ Solo lectura (rpc finance_pnl_monthly) + export CSV.
- **Escribe:** rpc:finance_pnl_monthly
- **Lee:** expense_categories.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/AccountingReportsPage.tsx:126` · W: rpc:finance_pnl_monthly
- [export] **Exportar CSV** — `pages/AccountingReportsPage.tsx:147` · gates: `disabled: {rows.length === 0}` · W: rpc:finance_pnl_monthly · R: expense_categories.select

<a id="-accounting-budget"></a>
### Presupuesto — `/accounting/budget`

- **Rol:** school+school_admin · **Menú:** Finanzas > Contabilidad > Presupuesto
- **Archivo:** `frontend/src/pages/AccountingBudgetPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, accountant] · ModuleGate=finanzas_contabilidad · addon accounting
- **Estado:** works · **Uso:** usado — budgets s90=3 r90=12 tot=12
- **Escribe:** budgets.upsert
- **Lee:** budgets.select, expense_categories.select, expenses.select, rpc:can_manage_finances

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/AccountingBudgetPage.tsx:128` · R: expense_categories.select, budgets.select
- [button] **Guardar** — `pages/AccountingBudgetPage.tsx:157` · gates: `canManage && disabled: {saveMutation.isPending}` · W: budgets.upsert · R: expense_categories.select

<a id="-facturacion-electronica"></a>
### Facturación electrónica (standalone) — `/facturacion-electronica`

- **Rol:** school+school_admin · **Menú:** Finanzas > Facturación electrónica
- **Archivo:** `frontend/src/pages/InvoicingStandalonePage.tsx` (+7 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=finanzas_facturacion_electronica · addon invoicing · menú oculto si addon accounting (vive como pestaña en /accounting)
- **Estado:** works · **Uso:** usado — electronic_invoices s90=2 r90=324 tot=324
- ⚠ DUPLICADO intencional de la pestaña Facturación de /accounting (InvoicingTab). Menú oculto si hay addon accounting. Addon invoicing: 3 escuelas.
- **Escribe:** DELETE /api/v1/invoicing/providers/:p, PATCH /api/v1/invoicing/providers/:p/enabled, POST /api/v1/invoicing/backfill/:p/:p, POST /api/v1/invoicing/credit-note/:p, POST /api/v1/invoicing/emit/:p, POST /api/v1/invoicing/providers/:p/:p, profiles.update, rpc:admin_set_payer_billing_details
- **Lee:** GET /api/v1/invoicing/active/school/:p, GET /api/v1/invoicing/by-payment/:p, GET /api/v1/invoicing/invoices/:p/:p, GET /api/v1/invoicing/providers/:p/:p, children.select, electronic_invoices.select, payments.select, profiles.select, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- ↪ componente compartido `components/accounting/InvoicingTab.tsx` (23 acciones) — detallado en `/accounting`
- ↪ componente compartido `components/accounting/VoidInvoiceDialog.tsx` (11 acciones) — detallado en `/accounting`
- ↪ componente compartido `components/accounting/InvoiceIdentifiers.tsx` (1 acciones) — detallado en `/accounting`
- ↪ componente compartido `components/accounting/EmitPaymentInvoiceButton.tsx` (3 acciones) — detallado en `/accounting`

#### Pestaña «Datos fiscales faltantes» (`faltantes`) — InvoicingTab.tsx:673 · gate: esEscuela

- ↪ componente compartido `components/accounting/MissingBillingDataPanel.tsx` (10 acciones) — detallado en `/accounting`
- ↪ componente compartido `components/billing/BillingDetailsForm.tsx` (2 acciones) — detallado en `/students`
- ↪ componente compartido `components/billing/MunicipalitySelect.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Facturas emitidas» (`emitidas`) — InvoicingTab.tsx:672 · gate: esEscuela

_(sin acciones; 0 controles menores)_

## Reportes

<a id="-finances"></a>
### Finanzas (reporte) — `/finances`

- **Rol:** school+school_admin · **Menú:** Reportes > Finanzas
- **Otras entradas:** Acción rápida: Finanzas
- **Archivo:** `frontend/src/pages/FinancesPage.tsx` (+12 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=reportes_finanzas · menú: billing_enabled
- **Estado:** works · **Uso:** no medido
- ⚠ Solo lectura. Cartera/aging (PaymentAgingCard) duplicada con /payments-automation; cartera por estado también en /reporter-dashboard.
- **Escribe:** POST /api/v1/templates/render, PUT /api/v1/reports/school/cartera/ajuste, payment_reminder_logs.insert, rpc:mark_overdue_payments
- **Lee:** GET /api/v1/reports/school/cartera, GET /api/v1/reports/school/cartera/ajuste, children.select, offering_plans.select, payment_reminder_logs.select, payments.select, profiles.select, rpc:get_athletes_without_payment, rpc:get_payment_aging_report, rpc:get_school_payment_history_grid, rpc:preview_open_month, teams.select, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/FinancesPage.tsx:113`
- [button] **Actualizar** — `pages/FinancesPage.tsx:131` · gates: `disabled: {isFetching}`
- [button] **Ver Historial de Recordatorios** — `pages/FinancesPage.tsx:135` · abre: setShowHistoryModal
- [dialog] **Historial de Recordatorios Enviados** — `components/finances/ReminderHistoryModal.tsx:38`

#### Pestaña «Cartera» (`cartera`) — FinancesPage.tsx:161

- [toggle] **Informe de cartera por correo los lunes Morosos, pendientes…** — `components/finances/CarteraInformeBar.tsx:69` · gates: `disabled: {!ajuste \|\| guardando \|\| !ajuste.columnaDisponible}` · W: PUT /api/v1/reports/school/cartera/ajuste · R: GET /api/v1/reports/school/cartera
- [export] **Descargar informe** — `components/finances/CarteraInformeBar.tsx:85` · gates: `disabled: {descargando \|\| !schoolId}` · R: GET /api/v1/reports/school/cartera
- [button] **Enviando... Reenviar Enviar WhatsApp** — `components/finances/OverdueAccountsCard.tsx:388` · gates: `disabled: {sendingReminder === account.id}` · W: POST /api/v1/templates/render
- [button] **Anterior** — `components/finances/OverdueAccountsCard.tsx:433` · gates: `odTotalPages > 1 && disabled: {odCurrentPage &lt;= 1}`
- [button] **Siguiente** — `components/finances/OverdueAccountsCard.tsx:435` · gates: `odTotalPages > 1 && disabled: {odCurrentPage >= odTotalPages}`
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Antigüedad por atleta» (`antiguedad`) — FinancesPage.tsx:165

- ↪ componente compartido `components/finances/PaymentAgingCard.tsx` (3 acciones) — detallado en `/payments-automation`

#### Pestaña «Historial de pagos» (`historial`) — FinancesPage.tsx:169

- [button] **Anterior** — `components/finances/PaymentHistoryGridCard.tsx:170` · gates: `historyTotalPages > 1 && disabled: {historyCurrentPage &lt;= 1}`
- [button] **Siguiente** — `components/finances/PaymentHistoryGridCard.tsx:172` · gates: `historyTotalPages > 1 && disabled: {historyCurrentPage >= historyTotalPages}`

#### Pestaña «Próximo cierre de mes» (`proximo-cierre`) — FinancesPage.tsx:173

- [button] **Abrir el mes en Gestión de Pagos** — `components/finances/NextMonthCloseCard.tsx:60` · gates: `!(nextMonthLoading)`
- [link] **Abrir el mes en Gestión de Pagos → /payments-automation?tab=config** — `components/finances/NextMonthCloseCard.tsx:64` · gates: `!(nextMonthLoading)`

#### Pestaña «Transacciones» (`transacciones`) — FinancesPage.tsx:174

- [filter] **Buscar: Buscar deportista, acudiente o concepto...** — `components/finances/TransactionsCard.tsx:141`
- [button] **Anterior** — `components/finances/TransactionsCard.tsx:259` · gates: `txTotalPages > 1 && disabled: {txPage &lt;= 1}`
- [button] **Siguiente** — `components/finances/TransactionsCard.tsx:261` · gates: `txTotalPages > 1 && disabled: {txPage >= txTotalPages}`

<a id="-school-reports"></a>
### Reportes — `/school-reports`

- **Rol:** school+school_admin · **Menú:** Reportes > Reportes
- **Otras entradas:** Acción rápida: Reportes
- **Archivo:** `frontend/src/pages/ReportsPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=reportes_reportes · flags en código: billing_enabled
- **Estado:** works · **Uso:** no medido
- ⚠ Mismo componente ReportsPage que /admin/reports y /store-reports.
- **Lee:** GET /api/v1/attendance/history, GET /api/v1/reports/school/documents:p, GET /api/v1/reports/school/summary:p, enrollments.select, offering_plans.select, payments.select, storage:identity-documents.createSignedUrl, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [export] **Exportar CSV** — `pages/ReportsPage.tsx:320`
- [export] **Imprimir** — `pages/ReportsPage.tsx:329`
- [button] **Actualizar** — `pages/ReportsPage.tsx:338` · R: GET /api/v1/reports/school/summary:p, teams.select, enrollments.select, payments.select

#### Pestaña «Resumen» (`resumen`) — ReportsPage.tsx:366

- [button] **Barras horizontales** — `pages/ReportsPage.tsx:437`
- [button] **Barras verticales** — `pages/ReportsPage.tsx:444`
- [button] **% de ocupación** — `pages/ReportsPage.tsx:451`
- [export] **Descargar CSV** — `pages/ReportsPage.tsx:459` · gates: `disabled: {occupancyData.length === 0}`
- [export] **Descargar CSV** — `pages/ReportsPage.tsx:516` · gates: `hasBilling && disabled: {revenueData.length === 0}`
- [export] **Descargar CSV** — `pages/ReportsPage.tsx:565` · gates: `disabled: {!growthData.some((m) => m.nuevos > 0 \|\| m.retiros > 0)}`
- [button] **Mes anterior** — `components/reports/AttendanceMonthCard.tsx:94`
- [button] **Mes siguiente** — `components/reports/AttendanceMonthCard.tsx:97` · gates: `disabled: {isCurrent}`
- [button] **Histórico** — `components/reports/AttendanceMonthCard.tsx:100` · → /attendance-history

#### Pestaña «Documentos» (`documentos`) — ReportsPage.tsx:370

- [filter] **Selector: Todos los equipos** — `components/reports/DocumentsReportTab.tsx:267`
- [filter] **Selector: Todos los planes** — `components/reports/DocumentsReportTab.tsx:282`
- [button] **Generando ZIP...** — `components/reports/DocumentsReportTab.tsx:295` · gates: `disabled: {selected.size === 0 \|\| downloading}` · R: storage:identity-documents.createSignedUrl
- [bulk_select] **Seleccionar todos** — `components/reports/DocumentsReportTab.tsx:329` · gates: `!(loading)`
- [bulk_select] **{`Seleccionar ${student.full_name}`}** — `components/reports/DocumentsReportTab.tsx:349` · gates: `!(loading) && disabled: {!student.has_document}`
- [button] **(() => downloadSingle(student))** — `components/reports/DocumentsReportTab.tsx:391` · gates: `!(loading) && student.has_document && disabled: {downloadingSingle === student.id}` · R: storage:identity-documents.createSignedUrl

<a id="-reporter-dashboard"></a>
### Panel de Reportes (cartera por estado) — `/reporter-dashboard`

- **Rol:** school+school_admin · **Menú:** Reportes > Panel de Reportes
- **Otras entradas:** Acción rápida: Panel de Reportes
- **Archivo:** `frontend/src/pages/ReporterDashboardPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[reporter, school, school_admin, admin, super_admin] · ModuleGate=reportes_panel
- **Estado:** works · **Uso:** no medido
- ⚠ Cartera por estado con CSV; solapa con /finances.
- **Lee:** GET /api/v1/reports/reporter/dashboard

#### Sin pestaña (cuerpo, encabezado y modales)

- [link] ** → {linkTo}** — `pages/ReporterDashboardPage.tsx:173` · gates: `linkTo`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:177` · gates: `onExport`
- [filter] **Selector: {dateRange}** — `pages/ReporterDashboardPage.tsx:520`
- [filter] **Selector: Equipo** — `pages/ReporterDashboardPage.tsx:533`
- [filter] **Selector: Plan** — `pages/ReporterDashboardPage.tsx:543`
- [export] **Generando… / PDF Ejecutivo** — `pages/ReporterDashboardPage.tsx:553` · gates: `disabled: {loading \|\| generatingPdf}`
- [export] **Generando… / Exportar Excel** — `pages/ReporterDashboardPage.tsx:556` · gates: `disabled: {loading \|\| generatingXlsx}`

#### Pestaña «Finanzas» (`finances`) — ReporterDashboardPage.tsx:586

- [button] **Ver Finanzas** — `pages/ReporterDashboardPage.tsx:613`
- [link] **Ver Finanzas → /finances** — `pages/ReporterDashboardPage.tsx:614`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:616` · gates: `disabled: {loading}`

#### Pestaña «Deportistas» (`students`) — ReporterDashboardPage.tsx:589

- [button] **Ver Deportistas** — `pages/ReporterDashboardPage.tsx:681`
- [link] **Ver Deportistas → /students** — `pages/ReporterDashboardPage.tsx:682`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:684` · gates: `disabled: {loading}`

#### Pestaña «Sedes» (`sedes`) — ReporterDashboardPage.tsx:592

- [button] **Ver Sedes** — `pages/ReporterDashboardPage.tsx:734`
- [link] **Ver Sedes → /branches** — `pages/ReporterDashboardPage.tsx:735`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:737` · gates: `disabled: {loading}`

#### Pestaña «Equipos» (`teams`) — ReporterDashboardPage.tsx:595

- [button] **Ver Equipos** — `pages/ReporterDashboardPage.tsx:786`
- [link] **Ver Equipos → /teams** — `pages/ReporterDashboardPage.tsx:787`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:789` · gates: `disabled: {loading}`

#### Pestaña «Entrenadores» (`coaches`) — ReporterDashboardPage.tsx:598

- [button] **Ver Staff** — `pages/ReporterDashboardPage.tsx:829`
- [link] **Ver Staff → /staff** — `pages/ReporterDashboardPage.tsx:830`
- [export] **CSV** — `pages/ReporterDashboardPage.tsx:832` · gates: `disabled: {loading}`

## Documentos e Identidad

<a id="-cards"></a>
### Carnets Digitales (+ Plantillas ?tab=templates) — `/cards`

- **Rol:** school+school_admin · **Menú:** Documentos e Identidad > Carnets > Carnets Digitales \| Plantillas de Carnets (/cards?tab=templates)
- **Otras entradas:** Acción rápida: Carnets Digitales
- **Archivo:** `frontend/src/pages/SchoolCardsAdminPage.tsx` (+5 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_carnets · acepta ?tab=
- **Estado:** works · **Uso:** usado — athlete_id_cards s90=3 r90=508 tot=513; athlete_id_card_templates s90=2 r90=2 tot=2
- ⚠ Menú tiene 2 ítems (Carnets Digitales y Plantillas de Carnets) que abren la MISMA página; el segundo con ?tab=templates.
- **Escribe:** athlete_id_card_templates.delete, athlete_id_card_templates.insert, athlete_id_card_templates.update, rpc:issue_athlete_id_card, rpc:revoke_athlete_id_card, rpc:verify_athlete_id_card_public
- **Lee:** athlete_id_card_templates.select, rpc:list_athlete_id_cards, rpc:list_school_athletes_for_card_issue_v2, schools.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [dialog] **Emitir carnet** — `pages/SchoolCardsAdminPage.tsx:896`
- [filter] **Selector: Plantilla** — `pages/SchoolCardsAdminPage.tsx:917` · gates: `templates.length > 0`
- [button] **Cancelar** — `pages/SchoolCardsAdminPage.tsx:939` · abre: setIssueOpen
- [button] **Emitir** — `pages/SchoolCardsAdminPage.tsx:940` · gates: `disabled: {issuing}` · W: rpc:issue_athlete_id_card, rpc:verify_athlete_id_card_public · R: rpc:list_school_athletes_for_card_issue_v2
- [dialog] **Revocar carnet** — `pages/SchoolCardsAdminPage.tsx:952`
- [button] **Cancelar** — `pages/SchoolCardsAdminPage.tsx:969` · gates: `disabled: {revoking}` · abre: setRevokeTarget
- [button] **Revocar carnet** — `pages/SchoolCardsAdminPage.tsx:970` · gates: `disabled: {revoking}` · W: rpc:revoke_athlete_id_card · R: rpc:list_athlete_id_cards
- [dialog] **Vista previa del carnet** — `pages/SchoolCardsAdminPage.tsx:982`
- [button] **Ver reverso / Ver frente** — `pages/SchoolCardsAdminPage.tsx:997` · gates: `previewData`
- [button] **Abrir** — `pages/SchoolCardsAdminPage.tsx:1010` · gates: `disabled: {!previewToken}`
- [button] **Enviar al padre** — `pages/SchoolCardsAdminPage.tsx:1019` · gates: `disabled: {!previewToken}`
- [export] **Descargar PNG** — `pages/SchoolCardsAdminPage.tsx:1029` · gates: `disabled: {downloading \|\| !previewData}`
- [button] **Anterior** — `pages/SchoolCardsAdminPage.tsx:1068` · gates: `disabled: {busy \|\| offset === 0}`
- [button] **Siguiente** — `pages/SchoolCardsAdminPage.tsx:1078` · gates: `disabled: {busy \|\| to >= total}`

#### Pestaña «Emitir nuevo» (`athletes`) — SchoolCardsAdminPage.tsx:562

- [filter] **Buscar: Buscar por nombre o documento…** — `pages/SchoolCardsAdminPage.tsx:587`
- [filter] **Selector: Equipo** — `pages/SchoolCardsAdminPage.tsx:594`
- [filter] **Selector: Sede** — `pages/SchoolCardsAdminPage.tsx:601`
- [button] **Seleccionar esta página ( )** — `pages/SchoolCardsAdminPage.tsx:638` · gates: `(pageSelectable.length > 0 \|\| selectedCount > 0) && pageSelectable.length > 0`
- [button] **Buscando…** — `pages/SchoolCardsAdminPage.tsx:643` · gates: `(pageSelectable.length > 0 \|\| selectedCount > 0) && page.without_card > 0 && disabled: {selectingAll}` · R: rpc:list_school_athletes_for_card_issue_v2
- [button] **Limpiar** — `pages/SchoolCardsAdminPage.tsx:652` · gates: `(pageSelectable.length > 0 \|\| selectedCount > 0) && selectedCount > 0`
- [bulk] **(bulkIssue)** — `pages/SchoolCardsAdminPage.tsx:660` · gates: `(pageSelectable.length > 0 \|\| selectedCount > 0) && disabled: {bulkIssuing \|\| selectedCount === 0}` · W: rpc:issue_athlete_id_card · R: rpc:list_school_athletes_for_card_issue_v2
- [button] **Reemitir** — `pages/SchoolCardsAdminPage.tsx:733` · gates: `!(loadingAthletes) && disabled: {!a.issuable}` · abre: openIssueDialog
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Carnets emitidos» (`cards`) — SchoolCardsAdminPage.tsx:563

- [filter] **Buscar: Buscar atleta…** — `pages/SchoolCardsAdminPage.tsx:778`
- [filter] **Selector: Equipo** — `pages/SchoolCardsAdminPage.tsx:788`
- [export] **Descargar PDF** — `pages/SchoolCardsAdminPage.tsx:795` · gates: `disabled: {pdfBusy}` · W: rpc:verify_athlete_id_card_public · R: rpc:list_athlete_id_cards
- [button] **Ver** — `pages/SchoolCardsAdminPage.tsx:845` · gates: `!(loadingCards)` · W: rpc:verify_athlete_id_card_public · abre: openPreview
- [button] **Enviar** — `pages/SchoolCardsAdminPage.tsx:850` · gates: `!(loadingCards) && c.status === 'active'`
- [button] **Revocar** — `pages/SchoolCardsAdminPage.tsx:856` · gates: `!(loadingCards) && c.status === 'active'`

#### Pestaña «Plantillas» (`templates`) — SchoolCardsAdminPage.tsx:564

- [button] **Nueva** — `components/cards/CardTemplatesManager.tsx:271`
- [button] **Editar** — `components/cards/CardTemplatesManager.tsx:297` · gates: `!(loading)`
- [button] **Aplica colores, disposición y textura de golpe** — `components/cards/CardTemplatesManager.tsx:315`
- [button] **derivar del principal** — `components/cards/CardTemplatesManager.tsx:373` · gates: `form.secondary_color`
- [button] **Cancelar** — `components/cards/CardTemplatesManager.tsx:465` · gates: `form.id`
- [button] **Guardar cambios / Crear plantilla** — `components/cards/CardTemplatesManager.tsx:466` · gates: `disabled: {saving}` · W: athlete_id_card_templates.update, athlete_id_card_templates.insert · R: athlete_id_card_templates.select
- [button] **Ver reverso / Ver frente** — `components/cards/CardTemplatesManager.tsx:483`
- [dialog] **Eliminar plantilla** — `components/cards/CardTemplatesManager.tsx:494`
- [button] **Cancelar** — `components/cards/CardTemplatesManager.tsx:500` · abre: setDeleteTarget
- [button] **Eliminar** — `components/cards/CardTemplatesManager.tsx:501` · W: athlete_id_card_templates.delete · R: athlete_id_card_templates.select
- ↪ componente compartido `components/common/ImageUpload.tsx` (2 acciones) — detallado en `/teams`

<a id="-certificates"></a>
### Constancias — `/certificates`

- **Rol:** school+school_admin · **Menú:** Documentos e Identidad > Constancias
- **Otras entradas:** Acción rápida: Constancias
- **Archivo:** `frontend/src/pages/SchoolCertificatesAdminPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_constancias
- **Estado:** works · **Uso:** sin uso — athlete_certificates s90=0 r90=0 tot=0
- ⚠ 0 constancias emitidas → sin uso.
- **Escribe:** POST /api/v1/certificates/:p/generate-pdf, rpc:issue_athlete_certificate, rpc:revoke_athlete_certificate
- **Lee:** GET /api/v1/certificates/:p/signed-url, rpc:list_athlete_certificates

#### Sin pestaña (cuerpo, encabezado y modales)

- [link] **Plantillas → /cards/templates/certificates** — `pages/SchoolCertificatesAdminPage.tsx:155`
- [button] **Plantillas** — `pages/SchoolCertificatesAdminPage.tsx:156`
- [filter] **Buscar: Buscar folio o atleta…** — `pages/SchoolCertificatesAdminPage.tsx:169`
- [button] **Emitir** — `pages/SchoolCertificatesAdminPage.tsx:229` · gates: `!(loading) && (r.status === 'pending_review') && disabled: {busyId === r.id}` · W: rpc:issue_athlete_certificate, POST /api/v1/certificates/:p/generate-pdf · R: rpc:list_athlete_certificates
- [export] **PDF** — `pages/SchoolCertificatesAdminPage.tsx:235` · gates: `!(loading) && r.status === 'issued' && r.pdf_url && disabled: {busyId === r.id}` · W: POST /api/v1/certificates/:p/generate-pdf · R: GET /api/v1/certificates/:p/signed-url
- [export] **(() => regeneratePdf(r))** — `pages/SchoolCertificatesAdminPage.tsx:241` · gates: `!(loading) && r.status === 'issued' && disabled: {busyId === r.id}` · W: POST /api/v1/certificates/:p/generate-pdf · R: rpc:list_athlete_certificates
- [button] **(() => revoke(r))** — `pages/SchoolCertificatesAdminPage.tsx:246` · gates: `!(loading) && r.status !== 'revoked'` · W: rpc:revoke_athlete_certificate · R: rpc:list_athlete_certificates
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

<a id="-cards-templates-certificates"></a>
### Plantillas de constancias — `/cards/templates/certificates`

- **Rol:** school+school_admin · **Menú:** (desde Constancias)
- **Archivo:** `frontend/src/pages/CertificateTemplatesPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_constancias
- **Estado:** works · **Uso:** sin uso — school_certificate_templates s90=0 r90=0 tot=0
- ⚠ Ruta bajo /cards pero gateada por documentos_constancias. 0 plantillas.
- **Escribe:** school_certificate_templates.delete, school_certificate_templates.insert, school_certificate_templates.update
- **Lee:** school_certificate_templates.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nueva plantilla** — `pages/CertificateTemplatesPage.tsx:127`
- [button] **((e) => { e.stopPropagation(); remove(t); })** — `pages/CertificateTemplatesPage.tsx:160` · gates: `!(loading)` · W: school_certificate_templates.delete · R: school_certificate_templates.select
- [dialog] **Editar plantilla / Nueva plantilla** — `pages/CertificateTemplatesPage.tsx:176`
- [filter] **Selector: {editing.kind}** — `pages/CertificateTemplatesPage.tsx:193` · gates: `editing`
- [toggle] **Cobra esta constancia** — `pages/CertificateTemplatesPage.tsx:239` · gates: `editing`
- [toggle] **Default para este tipo** — `pages/CertificateTemplatesPage.tsx:266` · gates: `editing`
- [toggle] **Activa** — `pages/CertificateTemplatesPage.tsx:270` · gates: `editing`
- [button] **Cancelar** — `pages/CertificateTemplatesPage.tsx:278`
- [button] **Guardar** — `pages/CertificateTemplatesPage.tsx:279` · gates: `disabled: {saving}` · W: school_certificate_templates.insert, school_certificate_templates.update · R: school_certificate_templates.select

<a id="-qr-signup"></a>
### QR de Inscripción — `/qr-signup`

- **Rol:** school+school_admin · **Menú:** Documentos e Identidad > QR de Inscripción
- **Otras entradas:** Acción rápida: QR de Inscripción
- **Archivo:** `frontend/src/pages/SchoolJoinQRsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_qr_inscripcion
- **Estado:** works · **Uso:** usado — school_join_qr_codes s90=5 r90=7 tot=12
- **Escribe:** rpc:create_school_join_qr, school_join_qr_codes.delete, school_join_qr_codes.update
- **Lee:** rpc:list_school_join_qrs, rpc:list_school_plans, school_branches.select, schools.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nuevo QR** — `pages/SchoolJoinQRsPage.tsx:299`
- [button] **Ver QR** — `pages/SchoolJoinQRsPage.tsx:353` · gates: `!(loading)`
- [export] **Poster PDF** — `pages/SchoolJoinQRsPage.tsx:357` · gates: `!(loading)`
- [button] **Pausar / Activar** — `pages/SchoolJoinQRsPage.tsx:364` · gates: `!(loading)` · W: school_join_qr_codes.update · R: rpc:list_school_join_qrs
- [button] **(() => remove(qr))** — `pages/SchoolJoinQRsPage.tsx:367` · gates: `!(loading)` · W: school_join_qr_codes.delete · R: rpc:list_school_join_qrs
- [dialog] **Nuevo código QR** — `pages/SchoolJoinQRsPage.tsx:383`
- [filter] **Selector: {form.target_type}** — `pages/SchoolJoinQRsPage.tsx:403`
- [filter] **Selector: Elige** — `pages/SchoolJoinQRsPage.tsx:422` · gates: `form.target_type === 'team'`
- [filter] **Selector: Elige** — `pages/SchoolJoinQRsPage.tsx:433` · gates: `form.target_type === 'plan'`
- [filter] **Selector: Elige** — `pages/SchoolJoinQRsPage.tsx:448` · gates: `form.target_type === 'branch'`
- [toggle] **Exigir primer pago al inscribirse** — `pages/SchoolJoinQRsPage.tsx:496`
- [toggle] **Aceptar pagos online** — `pages/SchoolJoinQRsPage.tsx:500`
- [button] **Cancelar** — `pages/SchoolJoinQRsPage.tsx:510`
- [button] **Crear** — `pages/SchoolJoinQRsPage.tsx:511` · gates: `disabled: {saving \|\| !form.name}` · W: rpc:create_school_join_qr · R: rpc:list_school_join_qrs
- [dialog] **(sin etiqueta)** — `pages/SchoolJoinQRsPage.tsx:523`
- [button] **PNG** — `pages/SchoolJoinQRsPage.tsx:560` · gates: `previewQr`
- [button] **SVG** — `pages/SchoolJoinQRsPage.tsx:564` · gates: `previewQr`
- [button] **Poster** — `pages/SchoolJoinQRsPage.tsx:568` · gates: `previewQr`
- [button] **Abrir landing** — `pages/SchoolJoinQRsPage.tsx:579`
- [button] **Copiar link** — `pages/SchoolJoinQRsPage.tsx:583`

## Comunicación

<a id="-whatsapp"></a>
### WhatsApp — `/whatsapp`

- **Rol:** school+school_admin · **Menú:** Comunicación > WhatsApp
- **Archivo:** `frontend/src/pages/WhatsAppPage.tsx` (+9 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=comunicacion_whatsapp · acepta ?tab=
- **Estado:** works · **Uso:** usado — whatsapp_conversations s90=2 r90=292 tot=292; school_whatsapp_integrations total=2
- ⚠ Solo 2 escuelas con integración conectada; addon whatsapp en 30.
- **Escribe:** PATCH /api/v1/whatsapp/:p/conversaciones/:p/tipo, PATCH /api/v1/whatsapp/:p/cortesias/:p/asistencia, PATCH /api/v1/whatsapp/:p/settings, POST /api/v1/whatsapp/:p/bandeja/:p/cerrar, POST /api/v1/whatsapp/:p/borradores/:p/:p, POST /api/v1/whatsapp/:p/conectar, POST /api/v1/whatsapp/:p/conversaciones/:p/:p, POST /api/v1/whatsapp/:p/conversaciones/:p/cerrar, POST /api/v1/whatsapp/:p/conversaciones/:p/responder, POST /api/v1/whatsapp/:p/plantillas, POST /api/v1/whatsapp/:p/plantillas/catalogo/:p, POST /api/v1/whatsapp/:p/ponerse-al-dia, school_settings.upsert, teams.update
- **Lee:** GET /api/v1/whatsapp/:p, GET /api/v1/whatsapp/:p/bandeja, GET /api/v1/whatsapp/:p/conversaciones, GET /api/v1/whatsapp/:p/conversaciones/:p, GET /api/v1/whatsapp/:p/cortesias, GET /api/v1/whatsapp/:p/importar-chat/analizar, GET /api/v1/whatsapp/:p/metricas, GET /api/v1/whatsapp/:p/plantillas, GET /api/v1/whatsapp/:p/plantillas/catalogo, school_branches.select, school_settings.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/WhatsAppPage.tsx:254` · R: GET /api/v1/whatsapp/:p
- [button] **Actualizar** — `pages/WhatsAppPage.tsx:284` · gates: `disabled: {cargando}` · R: GET /api/v1/whatsapp/:p
- [button] **Prender el asistente** — `pages/WhatsAppPage.tsx:311` · gates: `estado?.ajustes && estado.ajustes.ai_enabled === false && disabled: {guardando}` · W: PATCH /api/v1/whatsapp/:p/settings · R: GET /api/v1/whatsapp/:p, GET /api/v1/whatsapp/:p/plantillas
- [button] **Enviar todos** — `pages/WhatsAppPage.tsx:358` · gates: `estado?.ajustes?.mode === 'auto' && (estado.borradores_huerfanos?.borradores ??… && disabled: {respondiendo}` · W: POST /api/v1/whatsapp/:p/ponerse-al-dia · R: GET /api/v1/whatsapp/:p
- [button] **Revisar** — `pages/WhatsAppPage.tsx:362` · gates: `estado?.ajustes?.mode === 'auto' && (estado.borradores_huerfanos?.borradores ??…`
- [button] **Nueva plantilla** — `pages/WhatsAppPage.tsx:618`
- [button] **Enviar a Meta para aprobación** — `pages/WhatsAppPage.tsx:652` · gates: `abriendo && disabled: {enviando \|\| !nombre \|\| texto.length &lt; 10 \|\| listaEjemplos.…` · W: POST /api/v1/whatsapp/:p/plantillas, POST /api/v1/whatsapp/:p/plantillas/catalogo/:p
- [button] **Enviar a Meta** — `pages/WhatsAppPage.tsx:676` · gates: `faltantes.length > 0 && disabled: {registrando !== null}` · W: POST /api/v1/whatsapp/:p/plantillas/catalogo/:p
- [toggle] **Escuchar las notas de voz de familias e interesados El asis…** — `pages/WhatsAppPage.tsx:778` · gates: `disabled: {guardando \|\| valor === null \|\| !disponible}` · W: school_settings.upsert
- [toggle] **Responder automáticamente Si lo apagas, el bot prepara las …** — `pages/WhatsAppPage.tsx:822` · gates: `disabled: {guardando}`
- [toggle] **Asistente encendido Apagado, el asistente no responde nada …** — `pages/WhatsAppPage.tsx:838` · gates: `disabled: {guardando}`
- [toggle] **Responder también a números que no son familias Si está apa…** — `pages/WhatsAppPage.tsx:856` · gates: `disabled: {guardando \|\| ajustes?.ai_enabled === false}`
- [toggle] **Responder a quienes piden información para inscribirse Aunq…** — `pages/WhatsAppPage.tsx:876` · gates: `disabled: {guardando \|\| ajustes?.ai_enabled === false \|\| ajustes?.res…`
- [toggle] **{() => alternarDia(num)}** — `pages/WhatsAppPage.tsx:901`
- [button] **Guardar horario** — `pages/WhatsAppPage.tsx:915` · gates: `disabled: {guardando}`
- [button] **Abriendo… Conectar WhatsApp** — `components/whatsapp/ConectarNumero.tsx:196` · gates: `ALTA_CONFIGURADA && disabled: {abriendo}`

#### Pestaña «Métricas» (`metricas`) — WhatsAppPage.tsx:387

- [button] **días** — `components/whatsapp/Metricas.tsx:118` · gates: `schoolId`
- [button] **Actualizar** — `components/whatsapp/Metricas.tsx:124` · gates: `schoolId && disabled: {cargando}` · R: GET /api/v1/whatsapp/:p/metricas
- [button] **Reintentar** — `components/whatsapp/Metricas.tsx:153` · gates: `schoolId` · R: GET /api/v1/whatsapp/:p/metricas

#### Pestaña «Conversaciones» (`conversaciones`) — WhatsAppPage.tsx:390

- [button] **Acciones de la conversación** — `components/whatsapp/Conversaciones.tsx:616`
- [menu_item] **Abrir** — `components/whatsapp/Conversaciones.tsx:623` · R: GET /api/v1/whatsapp/:p/conversaciones/:p, GET /api/v1/whatsapp/:p/conversaciones
- [menu_item] **Soltar la conversación** — `components/whatsapp/Conversaciones.tsx:628` · gates: `tomaDisponible && disabled: {accionando}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones
- [menu_item] **Tomar la conversación** — `components/whatsapp/Conversaciones.tsx:632` · gates: `tomaDisponible && disabled: {accionando}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones
- [menu_item] **Quitar marca de personal** — `components/whatsapp/Conversaciones.tsx:640` · gates: `clasificacion && c.contact_kind === 'personal' && disabled: {accionando}` · W: PATCH /api/v1/whatsapp/:p/conversaciones/:p/tipo · R: GET /api/v1/whatsapp/:p/conversaciones
- [menu_item] **Marcar como personal** — `components/whatsapp/Conversaciones.tsx:644` · gates: `clasificacion && !(c.contact_kind === 'personal') && disabled: {accionando}`
- [button] **Cargar más ( restantes)** — `components/whatsapp/Conversaciones.tsx:657`
- [filter] **Buscar: Buscar nombre, teléfono o mensaje** — `components/whatsapp/Conversaciones.tsx:671`
- [button] **Limpiar búsqueda** — `components/whatsapp/Conversaciones.tsx:679` · gates: `busqueda`
- [button] **Actualizar** — `components/whatsapp/Conversaciones.tsx:685` · gates: `disabled: {cargandoLista}` · R: GET /api/v1/whatsapp/:p/conversaciones
- [button] **sin resp.** — `components/whatsapp/Conversaciones.tsx:697` · gates: `!q`
- [button] **Ver todas las conversaciones** — `components/whatsapp/Conversaciones.tsx:769` · gates: `!(cargandoLista && !lista.length) && !filtradas.length && !q && bandeja !== 'todas'`
- [button] **Ventana cerrada · solo plantilla ( )** — `components/whatsapp/Conversaciones.tsx:782` · gates: `cerradas.length > 0`
- [button] **Ocultar las conversaciones sin mensajes de la persona** — `components/whatsapp/Conversaciones.tsx:803` · gates: `!q && !cargandoLista && (ocultas > 0 \|\| (total !== null && total > lista.length… && ocultas > 0`
- [button] **Volver a la lista** — `components/whatsapp/Conversaciones.tsx:823` · gates: `abierta`
- [button] **Soltar** — `components/whatsapp/Conversaciones.tsx:841` · gates: `abierta && abierta.toma && disabled: {accionando \|\| !tomaDisponible}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones
- [button] **Tomar** — `components/whatsapp/Conversaciones.tsx:846` · gates: `abierta && !(abierta.toma) && disabled: {accionando \|\| !tomaDisponible}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones
- [button] **Quitar personal Es personal** — `components/whatsapp/Conversaciones.tsx:853` · gates: `abierta && disabled: {accionando}` · W: PATCH /api/v1/whatsapp/:p/conversaciones/:p/tipo · R: GET /api/v1/whatsapp/:p/conversaciones
- [button] **Cerrada / Dar por atendida** — `components/whatsapp/Conversaciones.tsx:861` · gates: `abierta && disabled: {accionando \|\| abierta.status === 'closed'}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/cerrar · R: GET /api/v1/whatsapp/:p/conversaciones
- [button] **Aprobar y enviar** — `components/whatsapp/Conversaciones.tsx:931` · gates: `abierta && disabled: {enviando}` · W: POST /api/v1/whatsapp/:p/borradores/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones/:p, GET /api/v1/whatsapp/:p/conversaciones
- [button] **Descartar** — `components/whatsapp/Conversaciones.tsx:938` · gates: `abierta && disabled: {enviando}` · W: POST /api/v1/whatsapp/:p/borradores/:p/:p · R: GET /api/v1/whatsapp/:p/conversaciones/:p, GET /api/v1/whatsapp/:p/conversaciones
- [button] **Enviar** — `components/whatsapp/Conversaciones.tsx:957` · gates: `abierta && abierta.ventana_abierta && disabled: {enviando \|\| !texto.trim()}` · W: POST /api/v1/whatsapp/:p/conversaciones/:p/responder · R: GET /api/v1/whatsapp/:p/conversaciones/:p, GET /api/v1/whatsapp/:p/conversaciones
- [dialog] **¿Marcar como personal?** — `components/whatsapp/Conversaciones.tsx:988`
- [button] **Marcar como personal** — `components/whatsapp/Conversaciones.tsx:997` · gates: `disabled: {accionando}` · W: PATCH /api/v1/whatsapp/:p/conversaciones/:p/tipo · R: GET /api/v1/whatsapp/:p/conversaciones

#### Pestaña «Clases de cortesía» (`cortesias`) — WhatsAppPage.tsx:393

- [link] ** → {waMe}** — `components/whatsapp/ClasesCortesia.tsx:85` · gates: `schoolId && waMe`
- [link] **Ver chat → {enlaceChat(conversationId)}** — `components/whatsapp/ClasesCortesia.tsx:90` · gates: `schoolId && conversationId`
- [button] **Asistió** — `components/whatsapp/ClasesCortesia.tsx:165` · gates: `schoolId && (pasada \|\| r.fecha === hoy) && disabled: {guardando === r.leadId}` · W: PATCH /api/v1/whatsapp/:p/cortesias/:p/asistencia
- [button] **No vino** — `components/whatsapp/ClasesCortesia.tsx:170` · gates: `schoolId && (pasada \|\| r.fecha === hoy) && disabled: {guardando === r.leadId}` · W: PATCH /api/v1/whatsapp/:p/cortesias/:p/asistencia
- [bulk] **Todos los días** — `components/whatsapp/ClasesCortesia.tsx:196` · gates: `schoolId && dia`
- [button] **Actualizar** — `components/whatsapp/ClasesCortesia.tsx:198` · gates: `schoolId && disabled: {cargando}` · R: GET /api/v1/whatsapp/:p/cortesias

#### Pestaña «Bandeja» (`bandeja`) — WhatsAppPage.tsx:399

- [export] **Importar chat exportado** — `components/whatsapp/ImportarChatExportado.tsx:162` · gates: `schoolId`
- [dialog] **Importar comprobantes de un chat** — `components/whatsapp/ImportarChatExportado.tsx:168` · gates: `schoolId`
- [button] **· archivo s** — `components/whatsapp/ImportarChatExportado.tsx:206` · gates: `schoolId && analisis && analisis.remitentes.length > 0 && disabled: {trabajando}`
- [button] **Cambiar** — `components/whatsapp/ImportarChatExportado.tsx:232` · gates: `schoolId && remitente && analisis && acudienteElegido && disabled: {trabajando}`
- [button] **(() => setAcudiente(a.id))** — `components/whatsapp/ImportarChatExportado.tsx:245` · gates: `schoolId && remitente && analisis && !(acudienteElegido)` · R: GET /api/v1/whatsapp/:p/importar-chat/analizar
- [button] **Importando …** — `components/whatsapp/ImportarChatExportado.tsx:269` · gates: `schoolId && remitente && acudiente && disabled: {trabajando \|\| !analisis?.conectado}`
- [link] ** → {f.archivo_url}** — `components/whatsapp/BandejaComprobantes.tsx:144` · gates: `schoolId && f.archivo_url && esImagen`
- [link] **PDF → {f.archivo_url}** — `components/whatsapp/BandejaComprobantes.tsx:148` · gates: `schoolId && !(f.archivo_url && esImagen)`
- [button] **Ver chat** — `components/whatsapp/BandejaComprobantes.tsx:171` · gates: `schoolId && f.conversacion_id`
- [button] **Marcar resuelto** — `components/whatsapp/BandejaComprobantes.tsx:175` · gates: `schoolId`
- [button] **Descartar** — `components/whatsapp/BandejaComprobantes.tsx:178` · gates: `schoolId`
- [button] **Actualizar** — `components/whatsapp/BandejaComprobantes.tsx:192` · gates: `schoolId && disabled: {cargando}` · R: GET /api/v1/whatsapp/:p/bandeja
- [dialog] **Marcar resuelto / Descartar** — `components/whatsapp/BandejaComprobantes.tsx:246` · gates: `schoolId`
- [button] **Cancelar** — `components/whatsapp/BandejaComprobantes.tsx:263` · gates: `schoolId && disabled: {guardando}`
- [button] **Confirmar** — `components/whatsapp/BandejaComprobantes.tsx:264` · gates: `schoolId && disabled: {guardando \|\| motivo.trim().length &lt; 3}` · W: POST /api/v1/whatsapp/:p/bandeja/:p/cerrar

#### Pestaña «Horarios» (`horarios`) — WhatsAppPage.tsx:403

- [button] **Guardar** — `components/whatsapp/HorariosDeEntrenamiento.tsx:191` · gates: `schoolId && disabled: {guardando === equipo.id}` · W: teams.update
- [toggle] **Recibe atletas nuevos** — `components/whatsapp/HorariosDeEntrenamiento.tsx:208` · gates: `schoolId`
- [filter] **Selector: {String(f.day)}** — `components/whatsapp/HorariosDeEntrenamiento.tsx:231` · gates: `schoolId`
- [button] **{`Quitar ${nombreDia(f.day)}`}** — `components/whatsapp/HorariosDeEntrenamiento.tsx:292` · gates: `schoolId`
- [button] **Agregar día** — `components/whatsapp/HorariosDeEntrenamiento.tsx:302` · gates: `schoolId`

#### Pestaña «Configuración» (`config`) — WhatsAppPage.tsx:406

- [button] **Activar** — `components/whatsapp/AvisosSportMaps.tsx:155` · gates: `schoolId && estado.escuela_habilitada && !s && disabled: {guardando \|\| telefono.replace(/\D/g, '').length &lt; 10}`
- [button] **Confirmar desde mi WhatsApp** — `components/whatsapp/AvisosSportMaps.tsx:169` · gates: `schoolId && s?.estado === 'pendiente' && s.enlace_confirmar`
- [link] **Confirmar desde mi WhatsApp → {s.enlace_confirmar}** — `components/whatsapp/AvisosSportMaps.tsx:170` · gates: `schoolId && s?.estado === 'pendiente' && s.enlace_confirmar`
- [button] **Ya lo envié** — `components/whatsapp/AvisosSportMaps.tsx:175` · gates: `schoolId && s?.estado === 'pendiente'`
- [button] **Cancelar** — `components/whatsapp/AvisosSportMaps.tsx:176` · gates: `schoolId && s?.estado === 'pendiente' && disabled: {guardando}`
- [toggle] **{`avisos-sm-${e.clave}`}** — `components/whatsapp/AvisosSportMaps.tsx:190` · gates: `schoolId && s?.estado === 'activa' && disabled: {guardando}`
- [toggle] **Casos urgentes también de noche Solo lesiones, seguridad o …** — `components/whatsapp/AvisosSportMaps.tsx:204` · gates: `schoolId && s?.estado === 'activa' && disabled: {guardando}`
- [button] **Dejar de recibir** — `components/whatsapp/AvisosSportMaps.tsx:212` · gates: `schoolId && s?.estado === 'activa' && disabled: {guardando}`

#### Pestaña «Resumen» (`resumen`) — WhatsAppPage.tsx:386

_(sin acciones; 0 controles menores)_

#### Pestaña «Plantillas» (`plantillas`) — WhatsAppPage.tsx:396

_(sin acciones; 0 controles menores)_

<a id="-payment-reminders"></a>
### Recordatorios de pago — `/payment-reminders`

- **Rol:** school+school_admin · **Menú:** Comunicación > Recordatorios
- **Otras entradas:** Acción rápida: Recordatorios
- **Archivo:** `frontend/src/pages/PaymentRemindersPage.tsx` (+3 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_recordatorios · menú: billing_enabled
- **Estado:** works · **Uso:** usado — payment_message_templates s90=1 r90=1 tot=19; payment_reminder_logs r90=4
- ⚠ Comparte tabla payment_message_templates con /message-templates. 4 envíos registrados en 90 días.
- **Escribe:** POST /api/v1/templates/render, edge:payment-reminders-cron, edge:send-email, payment_reminder_logs.insert, rpc:mark_overdue_payments
- **Lee:** children.select, offering_plans.select, payment_message_templates.select, payment_reminder_logs.select, payments.select, profiles.select, rpc:get_athletes_without_payment, teams.select, unregistered_athletes.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Actualizar** — `pages/PaymentRemindersPage.tsx:286` · W: rpc:mark_overdue_payments · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- [button] **Enviando... Enviar todos por email** — `pages/PaymentRemindersPage.tsx:290` · gates: `disabled: {sendingAuto \|\| !batch \|\| batch.totalReminders === 0}` · W: edge:payment-reminders-cron, rpc:mark_overdue_payments · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- [button] **Enviando... Enviar ( )** — `pages/PaymentRemindersPage.tsx:302` · gates: `disabled: {selectedIds.size === 0 \|\| sending}` · W: edge:send-email
- [button] **Historial** — `pages/PaymentRemindersPage.tsx:312`
- [filter] **Selector: Plan** — `pages/PaymentRemindersPage.tsx:427` · gates: `planOptions.length > 0`
- [filter] **Selector: Plantilla** — `pages/PaymentRemindersPage.tsx:443` · abre: setSelectedTemplateId
- [button] **Reintentar** — `pages/PaymentRemindersPage.tsx:506` · gates: `loadError` · W: rpc:mark_overdue_payments · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- [bulk_select] **Padre / Acudiente** — `pages/PaymentRemindersPage.tsx:525` · gates: `!(loadError)`
- [button] **{first.parentPhone ? `WhatsApp: ${first.parentPhone}` : 'Sin telefono'}** — `pages/PaymentRemindersPage.tsx:591` · gates: `!(loadError) && disabled: {!first.parentPhone \|\| sendingWA === first.id}` · W: POST /api/v1/templates/render · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- [button] **{first.parentPhone ? `WhatsApp: ${first.parentPhone}` : 'Sin telefono'}** — `pages/PaymentRemindersPage.tsx:652` · gates: `!(loadError) && disabled: {!first.parentPhone \|\| sendingWA === first.id}` · W: POST /api/v1/templates/render · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- [button] **(() => sendWhatsApp(r))** — `pages/PaymentRemindersPage.tsx:699` · gates: `!(loadError) && isExpanded && disabled: {!r.parentPhone \|\| sendingWA === r.id}` · W: POST /api/v1/templates/render · R: payments.select, profiles.select, children.select, unregistered_athletes.select, teams.select, offering_plans.select
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`
- ↪ componente compartido `components/finances/ReminderHistoryModal.tsx` (1 acciones) — detallado en `/finances`

<a id="-message-templates"></a>
### Plantillas de Mensajes — `/message-templates`

- **Rol:** school+school_admin · **Menú:** Comunicación > Plantillas de Mensajes
- **Archivo:** `frontend/src/pages/MessageTemplatesPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=documentos_plantillas_mensajes
- **Estado:** works · **Uso:** usado — payment_message_templates s90=1 r90=1 tot=19
- **Escribe:** payment_message_templates.delete, payment_message_templates.insert, payment_message_templates.update
- **Lee:** payment_message_templates.select, template_variables.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Restaurar** — `pages/MessageTemplatesPage.tsx:292` · gates: `!(loading) && tpl.school_id !== null && disabled: {saving === tpl.id}` · W: payment_message_templates.delete · R: payment_message_templates.select, template_variables.select
- [toggle] **📱 WhatsApp / 📧 Email Personalizada** — `pages/MessageTemplatesPage.tsx:303` · gates: `!(loading) && disabled: {saving === tpl.id}` · W: payment_message_templates.insert, payment_message_templates.update · R: payment_message_templates.select, template_variables.select
- [button] **Editar** — `pages/MessageTemplatesPage.tsx:318` · gates: `!(loading)`
- [dialog] **Editar Plantilla** — `pages/MessageTemplatesPage.tsx:375`
- [button] **Editar** — `pages/MessageTemplatesPage.tsx:384`
- [button] **Vista Previa** — `pages/MessageTemplatesPage.tsx:393`
- [button] **{v.description}** — `pages/MessageTemplatesPage.tsx:431` · gates: `!(previewMode) && editing`
- [button] **Cancelar** — `pages/MessageTemplatesPage.tsx:449`
- [button] **Guardar** — `pages/MessageTemplatesPage.tsx:452` · gates: `disabled: {saving === editing?.id}` · W: payment_message_templates.insert, payment_message_templates.update · R: payment_message_templates.select, template_variables.select

## Sedes e Instalaciones

<a id="-branches"></a>
### Sedes — `/branches`

- **Rol:** school+school_admin · **Menú:** Sedes e Instalaciones > Sedes
- **Otras entradas:** Acción rápida: Sedes
- **Archivo:** `frontend/src/pages/SchoolBranchesManagementPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=sedes_sedes
- **Estado:** works · **Uso:** usado — school_branches s90=16 r90=24 tot=427
- **Escribe:** school_branches.delete, school_branches.insert, school_branches.update
- **Lee:** school_branches.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [toggle] **Sede Principal Marcada como la sede principal de la academia** — `pages/SchoolBranchesManagementPage.tsx:196`
- [button] **Cancelar** — `pages/SchoolBranchesManagementPage.tsx:217` · abre: setIsCreateModalOpen
- [button] **Nueva Sede** — `pages/SchoolBranchesManagementPage.tsx:241`
- [dialog] **Crear Nueva Sede** — `pages/SchoolBranchesManagementPage.tsx:248`
- [button] **Crear primera sede** — `pages/SchoolBranchesManagementPage.tsx:310` · gates: `!(loading)` · abre: setIsCreateModalOpen
- [button] **Editar** — `pages/SchoolBranchesManagementPage.tsx:353` · gates: `!(loading)` · abre: openEditModal
- [button] **(() => handleDelete(branch.id, branch.name))** — `pages/SchoolBranchesManagementPage.tsx:358` · gates: `!(loading) && !branch.is_main` · W: school_branches.delete · R: school_branches.select
- [dialog] **Editar Sede** — `pages/SchoolBranchesManagementPage.tsx:377`

<a id="-facilities"></a>
### Instalaciones (reservas) — `/facilities`

- **Rol:** school+school_admin · **Menú:** Sedes e Instalaciones > Instalaciones
- **Archivo:** `frontend/src/pages/SchoolFacilitiesPage.tsx` (+12 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=sedes_instalaciones
- **Estado:** works · **Uso:** usado — facilities s90=6 r90=22 tot=30; facility_reservations s90=1 r90=34 tot=60; session_bookings r90=45 tot=71
- **Escribe:** DELETE /api/v1/school-staff/:p, PATCH /api/v1/reservations-admin/courtesy/:p/reschedule, PATCH /api/v1/reservations-admin/facility/:p/reschedule, PATCH /api/v1/school-staff/:p, PATCH /api/v1/trial-classes-self/:p/cancel, PATCH /api/v1/trial-classes-self/:p/reschedule, PATCH /api/v1/trial-classes/:p/reschedule, PATCH /api/v1/trial-classes/:p/status, PATCH /api/v1/trial-classes/categories/:p/active, PATCH /api/v1/trial-classes/categories/:p/repeat-pricing, POST /api/v1/invitations/bulk-send, POST /api/v1/school-staff, POST /api/v1/trial-classes, POST /api/v1/trial-classes-self, POST /api/v1/trial-classes/:p/resend-confirmation, POST /api/v1/trial-classes/categories, PUT /api/v1/trial-classes-self/settings, PUT /api/v1/trial-classes/categories/:p, PUT /api/v1/trial-classes/settings, coach_availability.update, facilities.delete, facilities.insert, facilities.update, facility_reservations.insert, facility_reservations.update, group_class_athletes.delete, group_class_athletes.insert, match_results.insert, session_bookings.update, training_sessions.insert
- **Lee:** GET /api/bffClient, GET /api/v1/reservations-admin/courtesy/slots, GET /api/v1/school-staff, GET /api/v1/trial-classes-self, GET /api/v1/trial-classes-self/categories, GET /api/v1/trial-classes-self/is-first, GET /api/v1/trial-classes-self/settings, GET /api/v1/trial-classes-self/slots, GET /api/v1/trial-classes/categories, GET /api/v1/trial-classes/settings, GET /api/v1/trial-classes/slots, GET /api/v1/trial-classes:p` : ''}, facilities.select, facility_reservations.select, group_class_athletes.select, match_results.select, schools.select, session_bookings.select, teams.select, training_sessions.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [menu_item] **Marcar realizada** — `pages/SchoolFacilitiesPage.tsx:142` · gates: `booking.status === 'agendada'`
- [menu_item] **Marcar no-show** — `pages/SchoolFacilitiesPage.tsx:145` · gates: `booking.status === 'agendada'`
- [menu_item] **Reprogramar** — `pages/SchoolFacilitiesPage.tsx:148` · gates: `booking.status === 'agendada'`
- [menu_item] **Cancelar** — `pages/SchoolFacilitiesPage.tsx:152` · gates: `booking.status === 'agendada'`
- [menu_item] **Marcar convertida** — `pages/SchoolFacilitiesPage.tsx:158` · gates: `booking.status === 'realizada'`
- [menu_item] **Reenviar correo** — `pages/SchoolFacilitiesPage.tsx:162`
- [dialog] **Detalle de Reserva** — `pages/SchoolFacilitiesPage.tsx:189`
- [button] **Aprobar** — `pages/SchoolFacilitiesPage.tsx:249` · gates: `reservation.status === 'pending'`
- [button] **Rechazar** — `pages/SchoolFacilitiesPage.tsx:255` · gates: `reservation.status === 'pending'`
- [button] **Cerrar** — `pages/SchoolFacilitiesPage.tsx:265` · gates: `reservation.status !== 'pending'`
- [button] **Agregar Primera Instalación** — `pages/SchoolFacilitiesPage.tsx:466` · abre: setFacilityDialogOpen
- [dialog] **¿Eliminar reserva?** — `pages/SchoolFacilitiesPage.tsx:931`
- [button] **Sí, eliminar registro** — `pages/SchoolFacilitiesPage.tsx:938`
- [dialog] **¿Eliminar instalación?** — `pages/SchoolFacilitiesPage.tsx:952`
- [button] **Eliminar espacio** — `pages/SchoolFacilitiesPage.tsx:960` · W: facilities.delete
- [dialog] **¿Cancelar clase de prueba?** — `pages/SchoolFacilitiesPage.tsx:988`
- [button] **Sí, cancelar clase** — `pages/SchoolFacilitiesPage.tsx:995` · abre: setCancelingTrialId
- [dialog] **Correo enviado / No se pudo enviar el correo** — `pages/SchoolFacilitiesPage.tsx:1022`
- [button] **Copiar mensaje** — `pages/SchoolFacilitiesPage.tsx:1032`
- [button] **Abrir WhatsApp** — `pages/SchoolFacilitiesPage.tsx:1042` · gates: `trialNotice?.whatsapp_link`
- [dialog] **Editar Instalación / Agregar Instalación** — `components/school/FacilityFormDialog.tsx:117`
- [filter] **Selector: Selecciona el tipo** — `components/school/FacilityFormDialog.tsx:141`
- [button] **Cancelar** — `components/school/FacilityFormDialog.tsx:209`
- [button] **Guardando...** — `components/school/FacilityFormDialog.tsx:212` · gates: `disabled: {isLoading}` · W: facilities.insert
- [dialog] **Editar Reserva Nueva Reserva** — `components/school/OwnerReservationModal.tsx:214`
- [filter] **Selector: Selecciona una instalación…** — `components/school/OwnerReservationModal.tsx:273` · gates: `step === 'details'` · abre: setSelectedFacilityId
- [button] **Continuar** — `components/school/OwnerReservationModal.tsx:307` · gates: `step === 'details' && disabled: {!selectedFacilityId}`
- [button] **Atrás** — `components/school/OwnerReservationModal.tsx:370` · gates: `step === 'datetime'`
- [button] **Confirmar Horario** — `components/school/OwnerReservationModal.tsx:371` · gates: `step === 'datetime' && disabled: {!selectedDate \|\| selectedSlots.length === 0}`
- [button] **Revisar** — `components/school/OwnerReservationModal.tsx:430` · gates: `step === 'confirm' && selectedFacility && selectedDate && selectedSlots.length …`
- [button] **Actualizar Reserva** — `components/school/OwnerReservationModal.tsx:431` · gates: `step === 'confirm' && selectedFacility && selectedDate && selectedSlots.length … && disabled: {isLoading}`
- [dialog] **Reprogramar Reserva** — `components/school/CourtesyBookingRescheduleModal.tsx:63`
- [button] **Cancelar** — `components/school/CourtesyBookingRescheduleModal.tsx:108`
- [button] **Confirmar nuevo horario** — `components/school/CourtesyBookingRescheduleModal.tsx:109` · gates: `disabled: {!selectedSlot \|\| isRescheduling}`
- [dialog] **Agendar Clase de Prueba** — `components/school/TrialClassBookingModal.tsx:142`
- [filter] **Selector: Selecciona una categoría…** — `components/school/TrialClassBookingModal.tsx:155` · gates: `step === 'select'` · abre: setCategoryId
- [filter] **Selector: Selecciona una instalación…** — `components/school/TrialClassBookingModal.tsx:182` · gates: `step === 'select'` · abre: setFacilityId
- [filter] **Selector: Selecciona un entrenador…** — `components/school/TrialClassBookingModal.tsx:201` · gates: `step === 'select'` · abre: setCoachId
- [button] **Ver horarios disponibles** — `components/school/TrialClassBookingModal.tsx:216` · gates: `step === 'select' && disabled: {!categoryId \|\| !facilityId \|\| !coachId \|\| loadingSlots}` · R: GET /api/v1/trial-classes/slots
- [button] **Atrás** — `components/school/TrialClassBookingModal.tsx:273` · gates: `step === 'slots'`
- [button] **Continuar** — `components/school/TrialClassBookingModal.tsx:274` · gates: `step === 'slots' && disabled: {!selectedSlot}`
- [button] **Menor de Edad Requiere acudiente** — `components/school/TrialClassBookingModal.tsx:306` · gates: `step === 'prospect' && selectedSlot`
- [button] **Mayor de Edad Más de 18 años** — `components/school/TrialClassBookingModal.tsx:319` · gates: `step === 'prospect' && selectedSlot`
- [button] **Atrás** — `components/school/TrialClassBookingModal.tsx:359` · gates: `step === 'prospect' && selectedSlot`
- [button] **Agendar** — `components/school/TrialClassBookingModal.tsx:360` · gates: `step === 'prospect' && selectedSlot && disabled: {isMinor === null \|\| !prospectName \|\| !prospectEmail \|\| !pr…`
- [button] **Copiado / Copiar mensaje** — `components/school/TrialClassBookingModal.tsx:395` · gates: `step === 'success' && result`
- [button] **Abrir WhatsApp** — `components/school/TrialClassBookingModal.tsx:399` · gates: `step === 'success' && result`
- [button] **Cerrar** — `components/school/TrialClassBookingModal.tsx:407` · gates: `step === 'success' && result`
- [dialog] **Clases de Prueba** — `components/school/TrialClassSettingsModal.tsx:131`
- [toggle] **Habilitar clases de prueba Permite agendarlas desde este mó…** — `components/school/TrialClassSettingsModal.tsx:154` · gates: `!form`
- [toggle] **Agendar desde Mis Inscripciones Un padre/atleta con cuenta …** — `components/school/TrialClassSettingsModal.tsx:168` · gates: `!form`
- [filter] **Selector: {ssForm.payment_mode}** — `components/school/TrialClassSettingsModal.tsx:191` · gates: `!form && ssForm.self_service_enabled`
- [button] **Guardar cambios** — `components/school/TrialClassSettingsModal.tsx:216` · gates: `!form && ssForm.self_service_enabled && disabled: {isSavingSs}`
- [button] **Compartir link** — `components/school/TrialClassSettingsModal.tsx:221` · gates: `!form && ssForm.self_service_enabled && ssSettings?.self_service_enabled && disabled: {!schoolSlug}` · abre: setShareOpen
- [button] **Guardar** — `components/school/TrialClassSettingsModal.tsx:229` · gates: `!form && !ssForm.self_service_enabled && disabled: {isSavingSs}`
- [button] **Nueva categoría** — `components/school/TrialClassSettingsModal.tsx:239` · gates: `!form` · abre: openNewCategory
- [toggle] **Inactiva Sin costo Repetir: $ COP** — `components/school/TrialClassSettingsModal.tsx:270` · gates: `!form && !(isLoadingCategories)`
- [toggle] **Permitir repetir esta prueba Solo desde Mis Inscripciones. …** — `components/school/TrialClassSettingsModal.tsx:330` · gates: `!(!form)`
- [toggle] **Activa** — `components/school/TrialClassSettingsModal.tsx:351` · gates: `!(!form)`
- [button] **Atrás** — `components/school/TrialClassSettingsModal.tsx:359` · gates: `form`
- [button] **Guardar categoría** — `components/school/TrialClassSettingsModal.tsx:360` · gates: `form && disabled: {isSavingCategory \|\| !form.name.trim()}`
- [button] **Cerrar** — `components/school/TrialClassSettingsModal.tsx:366` · gates: `!(form)`
- [dialog] **Reprogramar Clase de Prueba** — `components/school/TrialClassRescheduleModal.tsx:65`
- [button] **Cancelar** — `components/school/TrialClassRescheduleModal.tsx:111`
- [button] **Confirmar nuevo horario** — `components/school/TrialClassRescheduleModal.tsx:112` · gates: `disabled: {!selectedSlot \|\| isRescheduling}`
- [dialog] **Configurar Disponibilidad de** — `components/school/FacilityAvailabilityModal.tsx:23` · gates: `availabilityFacility`
- ↪ componente compartido `components/school/ShareTrialLinkDialog.tsx` (6 acciones) — detallado en `/offerings`

#### Pestaña «Instalaciones» (`facilities`) — SchoolFacilitiesPage.tsx:484

- [button] **¡Copiado! / Copiar Link Público** — `pages/SchoolFacilitiesPage.tsx:516` · gates: `schoolSlug`
- [button] **Agregar Instalación** — `pages/SchoolFacilitiesPage.tsx:521`
- [button] **Configurar disponibilidad** — `pages/SchoolFacilitiesPage.tsx:539`

#### Pestaña «Reservas» (`reservations`) — SchoolFacilitiesPage.tsx:485

- [button] **Actualizar** — `pages/SchoolFacilitiesPage.tsx:592` · gates: `disabled: {reservationsFetching}`
- [button] **Nueva Reserva** — `pages/SchoolFacilitiesPage.tsx:601`
- [button] **Crear primera reserva** — `pages/SchoolFacilitiesPage.tsx:642` · gates: `!(reservationsLoading) && !statusFilter`
- [button] **Limpiar filtros** — `pages/SchoolFacilitiesPage.tsx:647` · gates: `!(reservationsLoading) && statusFilter`
- [menu_item] **Ver detalle** — `pages/SchoolFacilitiesPage.tsx:705` · gates: `!(reservationsLoading)`
- [menu_item] **Editar** — `pages/SchoolFacilitiesPage.tsx:713` · gates: `!(reservationsLoading) && !res.isSessionBooking && (res.status === 'pending' \|\| res.status === 'confirmed…`
- [menu_item] **Reprogramar** — `pages/SchoolFacilitiesPage.tsx:720` · gates: `!(reservationsLoading) && (res.status === 'pending' \|\| res.status === 'confirmed')`
- [menu_item] **Aprobar** — `pages/SchoolFacilitiesPage.tsx:729` · gates: `!(reservationsLoading) && res.status === 'pending'`
- [menu_item] **Cancelar** — `pages/SchoolFacilitiesPage.tsx:739` · gates: `!(reservationsLoading) && (res.status === 'pending' \|\| res.status === 'confirmed')`
- [menu_item] **Eliminar** — `pages/SchoolFacilitiesPage.tsx:748` · gates: `!(reservationsLoading)` · abre: setDeleteReservationId
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

#### Pestaña «Clases de Prueba» (`trial-classes`) — SchoolFacilitiesPage.tsx:493

- [button] **Configurar** — `pages/SchoolFacilitiesPage.tsx:783` · abre: setTrialSettingsModalOpen
- [button] **Actualizar** — `pages/SchoolFacilitiesPage.tsx:786` · gates: `disabled: {trialFetching}`
- [button] **Agendar Clase de Prueba** — `pages/SchoolFacilitiesPage.tsx:795` · abre: setTrialBookingModalOpen
- [button] **Agendar primera clase de prueba** — `pages/SchoolFacilitiesPage.tsx:835` · gates: `!(trialLoading) && !trialStatusFilter` · abre: setTrialBookingModalOpen

#### Pestaña «Configurar» (`config`) — AvailabilityManager.tsx:233

- ↪ componente compartido `components/school/AvailabilityManager.tsx` (4 acciones) — detallado en `/staff`

#### Pestaña «Registrados ( )» (`scheduled`) — AvailabilityManager.tsx:234

- ↪ componente compartido `components/school/AvailabilityManager.tsx` (2 acciones) — detallado en `/staff`

<a id="-school-access-control"></a>
### Control de Acceso — `/school/access-control`

- **Rol:** school+school_admin · **Menú:** Sedes e Instalaciones > Control de Acceso
- **Otras entradas:** Acción rápida: Control de Acceso
- **Archivo:** `frontend/src/pages/school/AccessControlPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=sedes_control_acceso · addon access_control
- **Estado:** works · **Uso:** usado — access_events s90=4 r90=10376 tot=14144; turnstile_devices escuelas=3
- ⚠ Addon access_control en 31 escuelas pero solo 3-4 tienen torniquetes/eventos.
- **Escribe:** PATCH /api/v1/access/devices/:p, PATCH /api/v1/access/hour-bank-overage-settings, PATCH /api/v1/access/hour-bank-visits/:p/correct, POST /api/v1/access/assign-user, POST /api/v1/access/devices, POST /api/v1/access/hour-bank-overage-charges/:p/confirm, POST /api/v1/access/hour-bank-overage-charges/:p/dismiss, POST /api/v1/access/manual-open, POST /api/v1/access/set-access-group
- **Lee:** GET /api/v1/access/devices, GET /api/v1/access/events, GET /api/v1/access/hour-bank-overage-charges, GET /api/v1/access/hour-bank-overage-settings, GET /api/v1/access/hour-bank-visits, GET /api/v1/access/members:p` : ''}, GET /api/v1/access/occupancy, GET /api/v1/access/overdue, GET /api/v1/access/stats

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Actualizar** — `pages/school/AccessControlPage.tsx:544` · R: GET /api/v1/access/stats, GET /api/v1/access/events, GET /api/v1/access/devices, GET /api/v1/access/overdue
- [button] **Configurar** — `pages/school/AccessControlPage.tsx:553` · abre: setManageOpen
- [button] **Vencidos** — `pages/school/AccessControlPage.tsx:562` · R: GET /api/v1/access/overdue, GET /api/v1/access/stats · abre: setOverdueOpen
- [button] **Abrir Entrada** — `pages/school/AccessControlPage.tsx:701` · gates: `disabled: {openingEntry}` · W: POST /api/v1/access/manual-open · R: GET /api/v1/access/stats, GET /api/v1/access/events
- [button] **Abrir Salida** — `pages/school/AccessControlPage.tsx:712` · gates: `disabled: {openingExit}` · W: POST /api/v1/access/manual-open · R: GET /api/v1/access/stats, GET /api/v1/access/events
- [button] **Asignar** — `pages/school/AccessControlPage.tsx:802` · gates: `!(loadingLog) && isUnknownEvent(event)` · abre: openAssign
- [button] **Bloquear ahora** — `pages/school/AccessControlPage.tsx:813` · gates: `!(loadingLog) && !event.access_granted && event.denial_reason === 'payment_overdue' && event.zk_…` · W: POST /api/v1/access/set-access-group
- [dialog] **Asignar usuario al PIN** — `pages/school/AccessControlPage.tsx:844`
- [filter] **Buscar: Buscar miembro por nombre…** — `pages/school/AccessControlPage.tsx:851`
- [button] **Sin Login** — `pages/school/AccessControlPage.tsx:869` · gates: `!(loadingMembers) && disabled: {assigningId !== null}` · W: POST /api/v1/access/assign-user · R: GET /api/v1/access/events, GET /api/v1/access/stats
- [dialog] **Dispositivos de acceso** — `pages/school/AccessControlPage.tsx:898`
- [button] **Agregar dispositivo** — `pages/school/AccessControlPage.tsx:923` · abre: openNewDevice
- [dialog] **Editar dispositivo / Nuevo dispositivo** — `pages/school/AccessControlPage.tsx:934`
- [button] **Guardar cambios / Crear dispositivo** — `pages/school/AccessControlPage.tsx:1024` · gates: `deviceForm && disabled: {savingDevice}` · W: PATCH /api/v1/access/devices/:p, POST /api/v1/access/devices · R: GET /api/v1/access/devices, GET /api/v1/access/stats
- [dialog] **Atletas con pago vencido** — `pages/school/AccessControlPage.tsx:1038`
- [filter] **Buscar: Buscar por nombre o PIN...** — `pages/school/AccessControlPage.tsx:1048` · gates: `!loadingOverdue && overdue.length > 0`
- [button] **Restaurar** — `pages/school/AccessControlPage.tsx:1080` · gates: `!(loadingOverdue) && o.blocked && disabled: {actingPin === o.zk_pin}` · W: POST /api/v1/access/set-access-group
- [button] **Bloquear** — `pages/school/AccessControlPage.tsx:1088` · gates: `!(loadingOverdue) && !(o.blocked) && disabled: {actingPin === o.zk_pin}` · W: POST /api/v1/access/set-access-group
- [button] **Confirmar salida** — `components/access/HourBankSchoolSection.tsx:88` · gates: `disabled: {saving}` · W: PATCH /api/v1/access/hour-bank-visits/:p/correct
- [toggle] **Cargos por horas de más** — `components/access/HourBankOverageCharges.tsx:155` · gates: `disabled: {toggle.isPending}` · W: PATCH /api/v1/access/hour-bank-overage-settings
- [button] **Confirmar** — `components/access/HourBankOverageCharges.tsx:187` · gates: `disabled: {decide.isPending}`
- [button] **Descartar** — `components/access/HourBankOverageCharges.tsx:190` · gates: `disabled: {decide.isPending}`
- [dialog] **Confirmar cobro por horas de más / Descartar cargo sugerido** — `components/access/HourBankOverageCharges.tsx:200`
- [button] **Crear cobro / Descartar** — `components/access/HourBankOverageCharges.tsx:221` · gates: `disabled: {decide.isPending}` · W: POST /api/v1/access/hour-bank-overage-charges/:p/confirm, POST /api/v1/access/hour-bank-overage-charges/:p/dismiss

## Cuenta

<a id="-school-public-profile"></a>
### Mi Perfil Público — `/school/public-profile`

- **Rol:** school · **Menú:** Cuenta > Mi Perfil Público (solo árbol school; school_admin entra por URL)
- **Archivo:** `frontend/src/pages/school/SchoolPublicProfilePage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=cuenta_perfil_publico
- **Estado:** works · **Uso:** no medido
- ⚠ No está en el árbol school_admin (solo school); el school_admin entra por URL. Apagado por override en 1 escuela.
- **Escribe:** school_settings.upsert
- **Lee:** offerings.select, public_staff.select, school_settings.select, schools.select, teams.select, v_school_settings_publico.select, v_school_staff_publico.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Despublicar / Publicar perfil** — `pages/school/SchoolPublicProfilePage.tsx:329` · gates: `disabled: {publishing}` · W: school_settings.upsert
- [button] **Guardar** — `pages/school/SchoolPublicProfilePage.tsx:338` · gates: `disabled: {saving}` · R: school_settings.select, schools.select, offerings.select
- [button] **Copiado / COPIAR** — `components/settings/PublishedSuccessModal.tsx:54`
- [button] **Ver Perfil** — `components/settings/PublishedSuccessModal.tsx:61`
- [link] **Ver Perfil → {viewUrl}** — `components/settings/PublishedSuccessModal.tsx:62`
- [button] **Listo** — `components/settings/PublishedSuccessModal.tsx:67`
- [link] ** → {exploreHint.href}** — `components/settings/PublishedSuccessModal.tsx:76` · gates: `exploreHint`

#### Pestaña «General» (`general`) — SchoolPublicProfilePage.tsx:348

- [button] **Copiar enlace** — `pages/school/SchoolPublicProfilePage.tsx:378` · gates: `disabled: {!isPublished \|\| !publicUrl}`
- [button] **Ver Sitio** — `pages/school/SchoolPublicProfilePage.tsx:387` · gates: `disabled: {!isPublished \|\| !publicUrl}`
- [button] **Subir logo** — `pages/school/SchoolPublicProfilePage.tsx:422` · gates: `disabled: {uploading}`
- [button] **Cambiar** — `pages/school/SchoolPublicProfilePage.tsx:441` · gates: `form.cover_image_url && disabled: {uploading}`
- [toggle] **{v => set(row.k, v)}** — `pages/school/SchoolPublicProfilePage.tsx:540`

#### Pestaña «Planes» (`planes`) — SchoolPublicProfilePage.tsx:349

- [button] **Gestionar planes** — `pages/school/SchoolPublicProfilePage.tsx:562`
- [link] **Gestionar planes → /offerings** — `pages/school/SchoolPublicProfilePage.tsx:563`
- [button] **Crear plan** — `pages/school/SchoolPublicProfilePage.tsx:576` · gates: `offerings.length === 0`
- [link] **Crear plan → /offerings** — `pages/school/SchoolPublicProfilePage.tsx:577` · gates: `offerings.length === 0`
- [link] **(Aplican T&C) → {footnoteUrl}** — `components/explore/PlanCard.tsx:105` · gates: `!(offerings.length === 0) && f.highlight && footnoteUrl`
- [filter] **Selector: {selectedKey}** — `components/explore/PlanCard.tsx:118` · gates: `!(offerings.length === 0) && durations.length > 1`
- [button] **Obsequiar plan** — `components/explore/PlanCard.tsx:146` · gates: `!(offerings.length === 0) && showGift && onGift && !disabled`

#### Pestaña «Contacto» (`contacto`) — SchoolPublicProfilePage.tsx:350

- [link] **Sedes → /branches** — `pages/school/SchoolPublicProfilePage.tsx:664`
- [toggle] **Horarios de Atención Este horario se muestra en tu perfil p…** — `pages/school/SchoolPublicProfilePage.tsx:685`
- [toggle] **{v => setDayHours(row.day, { closed: !v, open: !v ? null : (row.open ?…}** — `pages/school/SchoolPublicProfilePage.tsx:696` · gates: `form.business_hours_enabled`

<a id="-mi-plan"></a>
### Facturación (plan SaaS) — `/mi-plan`

- **Rol:** school+school_admin · **Menú:** Cuenta > Facturación
- **Archivo:** `frontend/src/pages/MiPlanPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, wellness_professional, store_owner, organizer, reporter, personal_trainer] · ModuleGate=—
- **Estado:** works · **Uso:** usado — school_subscription_invoices s90=4 r90=9 tot=9
- **Escribe:** POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, children.delete, children.insert, children.update, school_members.update, unregistered_athletes.update
- **Lee:** children.select, enrollments.select, school_athletes.select, team_coaches.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/MiPlanPage.tsx:284` · R: GET /api/v1/me/entitlements
- [button] **Ver planes** — `pages/MiPlanPage.tsx:354` · R: GET /api/v1/me/entitlements
- [button] **Agregar el adicional Tienda** — `pages/MiPlanPage.tsx:380` · gates: `upsellStore` · R: GET /api/v1/me/entitlements · abre: openExternalUrl
- [button] **Actualizar pago** — `pages/MiPlanPage.tsx:405` · gates: `ent.inGracePeriod` · R: GET /api/v1/me/entitlements
- [button] **Activar mi plan** — `pages/MiPlanPage.tsx:426` · gates: `ent.isTrialExpired && !ent.inGracePeriod` · R: GET /api/v1/me/entitlements
- [button] **Mensual / Anual** — `pages/MiPlanPage.tsx:489`
- [button] **Plan actual** — `pages/MiPlanPage.tsx:595` · gates: `disabled: {esActual \|\| insuficiente}` · R: GET /api/v1/me/entitlements
- [button] **Habla con ventas** — `pages/MiPlanPage.tsx:636` · R: GET /api/v1/me/entitlements
- [button] **Ver planes y precios** — `pages/MiPlanPage.tsx:714` · R: GET /api/v1/me/entitlements

<a id="-facturacion-recibo-invoiceid"></a>
### Recibo de factura SaaS — `/facturacion/recibo/:invoiceId`

- **Rol:** school+school_admin · **Menú:** (desde Facturación)
- **Archivo:** `frontend/src/pages/SaasInvoiceReceiptPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** usado — school_subscription_invoices s90=4 r90=9 tot=9
- **Lee:** GET /api/v1/platform/invoices/:p/pdf-url, school_subscription_invoices.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [export] **Ver / descargar PDF con cómo pagar** — `pages/SaasInvoiceReceiptPage.tsx:155` · gates: `disabled: {openingPdf}` · R: GET /api/v1/platform/invoices/:p/pdf-url · abre: openPdf

<a id="-settings"></a>
### Configuración — `/settings`

- **Rol:** school+school_admin · **Menú:** Cuenta > Configuración
- **Otras entradas:** MobileBottomNav (school): Config
- **Archivo:** `frontend/src/pages/SettingsPage.tsx` (+10 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** no medido
- ⚠ Duplicado parcial con /school-config (BrandingSettingsForm en las dos) y con /admin/config (misma SettingsPage).
- **Escribe:** DELETE /api/v1/me/data-deletion-request, DELETE /api/v1/school/performance/entries/:p, POST /api/v1/me/data-deletion-request, POST /api/v1/school/performance/entries, PUT /api/v1/school/performance/entries/:p, PUT /api/v1/school/performance/metric-settings, PUT /api/v1/schools/:p/branding
- **Lee:** GET /api/v1/athlete/performance/entries:p, GET /api/v1/athlete/performance/evolution, GET /api/v1/me/data-deletion-request, GET /api/v1/school/performance/entries, GET /api/v1/school/performance/metric-settings, GET /api/v1/school/performance/metrics, GET /api/v1/school/performance/roster, GET /api/v1/school/performance/subjects/:p/:p/evolution, children.select

#### Pestaña «Perfil» (`profile`) — SettingsPage.tsx:116

- [button] **Límite alcanzado (5 deportes) / Añadir deporte...** — `components/settings/ProfileSection.tsx:198` · gates: `disabled: {formData.sports_interests && formData.sports_interests.len…`
- [button] **Guardar Cambios** — `components/settings/ProfileSection.tsx:262` · gates: `disabled: {saving \|\| uploading}` · W: rpc:save_profile_settings, profiles.update · R: profiles.select

#### Pestaña «Notificaciones» (`notifications`) — SettingsPage.tsx:125

- [toggle] **Notificaciones por Email Recibe alertas, resúmenes y actual…** — `components/settings/NotificationsSection.tsx:60`
- [toggle] **Notificaciones Push Alertas inmediatas en tu navegador o di…** — `components/settings/NotificationsSection.tsx:76`
- [toggle] **Nuevas clases y horarios Avisarme cuando mis escuelas publi…** — `components/settings/NotificationsSection.tsx:91`
- [toggle] **Actualizaciones de pedidos Sobre tus compras en la tienda o…** — `components/settings/NotificationsSection.tsx:102`
- [toggle] **Promociones y novedades Descuentos exclusivos y nuevas func…** — `components/settings/NotificationsSection.tsx:113`
- [toggle] **Avisos de evaluación post-entrenamiento Te preguntamos cómo…** — `components/settings/NotificationsSection.tsx:132`
- [button] **Actualizar Preferencias** — `components/settings/NotificationsSection.tsx:149` · gates: `disabled: {saving}`

#### Pestaña «Información Academia» (`school-info`) — SettingsPage.tsx:142 · gate: isSchoolAdmin

- [button] **Guardando... / Guardar Cambios** — `components/settings/SchoolInfoSection.tsx:73` · gates: `isSchoolAdmin && disabled: {isSaving}` · W: rpc:save_school_info

#### Pestaña «Servicios» (`services`) — SettingsPage.tsx:151 · gate: isSchoolAdmin

- [button] **Nuevo Servicio** — `components/settings/ServicesSection.tsx:26` · gates: `isSchoolAdmin`
- [button] **Gestionar** — `components/settings/ServicesSection.tsx:60` · gates: `isSchoolAdmin && services.length > 0`
- [button] **Crear Servicio** — `components/settings/ServicesSection.tsx:74` · gates: `isSchoolAdmin && !(services.length > 0)`
- [button] **Suscripción Pro** — `components/settings/ServicesSection.tsx:96` · gates: `isSchoolAdmin`

#### Pestaña «Marca» (`branding`) — SettingsPage.tsx:160 · gate: isSchoolAdmin

- [button] **Ver planes y actualizar** — `components/settings/BrandingSettingsForm.tsx:89` · gates: `isSchoolAdmin`
- [link] **Ver planes y actualizar → /mi-plan** — `components/settings/BrandingSettingsForm.tsx:90` · gates: `isSchoolAdmin`
- [button] **Subiendo... / Cambiar Logo** — `components/settings/BrandingSettingsForm.tsx:270` · gates: `isSchoolAdmin && disabled: {uploading}`
- [button] **Botón Principal** — `components/settings/BrandingSettingsForm.tsx:346` · gates: `isSchoolAdmin`
- [button] **Botón Secundario** — `components/settings/BrandingSettingsForm.tsx:347` · gates: `isSchoolAdmin`
- [button] **Outline** — `components/settings/BrandingSettingsForm.tsx:348` · gates: `isSchoolAdmin`
- [toggle] **Marca de agua de SportMaps Mostrar discretamente "Powered b…** — `components/settings/BrandingSettingsForm.tsx:367` · gates: `isSchoolAdmin && disabled: {!puedeApagarWatermark}`
- [button] **Restablecer a SportMaps** — `components/settings/BrandingSettingsForm.tsx:376` · gates: `isSchoolAdmin`
- [button] **Guardando... / Guardar Identidad Visual** — `components/settings/BrandingSettingsForm.tsx:389` · gates: `isSchoolAdmin && disabled: {saving \|\| !schoolId}` · W: PUT /api/v1/schools/:p/branding · R: schools.select

#### Pestaña «Métricas de evaluación» (`evaluation-metrics`) — SettingsPage.tsx:169 · gate: isSchoolAdmin

- [button] **Usar las recomendadas** — `components/settings/SchoolMetricsSettings.tsx:178` · gates: `isSchoolAdmin && !(isLoading) && disabled: {sameList(selected, data.default_keys)}`
- [bulk_select] **{`Quitar ${title}`}** — `components/settings/SchoolMetricsSettings.tsx:197` · gates: `isSchoolAdmin && !(isLoading)`
- [button] **Subir** — `components/settings/SchoolMetricsSettings.tsx:210` · gates: `isSchoolAdmin && !(isLoading) && disabled: {i === 0}`
- [button] **Bajar** — `components/settings/SchoolMetricsSettings.tsx:213` · gates: `isSchoolAdmin && !(isLoading) && disabled: {i === selected.length - 1}`
- [button] **Descartar cambios** — `components/settings/SchoolMetricsSettings.tsx:293` · gates: `isSchoolAdmin && !(isLoading) && disabled: {!dirty \|\| save.isPending}`
- [button] **Guardar** — `components/settings/SchoolMetricsSettings.tsx:296` · gates: `isSchoolAdmin && !(isLoading) && disabled: {!dirty \|\| save.isPending}` · W: PUT /api/v1/school/performance/metric-settings
- ↪ componente compartido `components/school/QuickMetricInput.tsx` (1 acciones) — detallado en `/training-plans`

#### Pestaña «Privacidad» (`privacy`) — SettingsPage.tsx:186

- [toggle] **Manten mi perfil público Otras personas podrán ver tus dato…** — `components/settings/PrivacySection.tsx:55`
- [toggle] **Aparecer en búsquedas Permitir que otros te encuentren por …** — `components/settings/PrivacySection.tsx:70`
- [toggle] **Mostrar estadísticas de rendimiento Visible solo para tus e…** — `components/settings/PrivacySection.tsx:84`
- [button] **Guardar Privacidad** — `components/settings/PrivacySection.tsx:93` · gates: `disabled: {saving}`

#### Pestaña «Seguridad» (`security`) — SettingsPage.tsx:195

- [button] **Actualizar Contraseña** — `components/settings/SecuritySection.tsx:108` · gates: `disabled: {saving \|\| !passwords.new}`
- [button] **Cancelar la eliminación** — `components/settings/AccountDeletionCard.tsx:170` · gates: `!(loading) && disabled: {submitting}` · W: DELETE /api/v1/me/data-deletion-request · R: GET /api/v1/me/data-deletion-request
- [button] **Eliminar Cuenta** — `components/settings/AccountDeletionCard.tsx:184` · gates: `!(loading)` · abre: setConfirmOpen
- [dialog] **¿Eliminar tu cuenta de SportMaps?** — `components/settings/AccountDeletionCard.tsx:198`
- [button] **Sí, eliminar mi cuenta** — `components/settings/AccountDeletionCard.tsx:231` · gates: `disabled: {submitting}` · W: POST /api/v1/me/data-deletion-request · R: GET /api/v1/me/data-deletion-request

<a id="-notifications"></a>
### Notificaciones — `/notifications`

- **Rol:** school+school_admin · **Menú:** (campana del encabezado; no está en el menú lateral de escuela)
- **Archivo:** `frontend/src/pages/NotificationsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** usado — notifications s90=20 r90=5405 tot=5693
- ⚠ Misma página que /admin/logs. No está en el menú lateral de escuela (solo campana).
- **Escribe:** notifications.delete, notifications.update
- **Lee:** GET /api/v1/vendor/products/insights, children.select, clinical_episodes.select, clinical_patients.select, enrollments.select, notifications.select, payments.select, products.select, rpc:get_athlete_dashboard_stats, rpc:get_school_dashboard_stats, school_staff.select, team_coaches.select, teams.select, wellness_appointments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Marcar todas como leídas** — `pages/NotificationsPage.tsx:148` · gates: `unreadCount > 0` · W: notifications.update
- [button] **Todas ( )** — `pages/NotificationsPage.tsx:161`
- [button] **No leídas ( )** — `pages/NotificationsPage.tsx:168`
- [button] **Ver** — `pages/NotificationsPage.tsx:243` · gates: `!(filteredNotifications.length === 0) && link` · W: notifications.update · → link
- [button] **Marcar como leída** — `pages/NotificationsPage.tsx:249` · gates: `!(filteredNotifications.length === 0) && !notification.read` · W: notifications.update
- [button] **Eliminar** — `pages/NotificationsPage.tsx:259` · gates: `!(filteredNotifications.length === 0)` · W: notifications.delete

<a id="-profile"></a>
### Perfil personal — `/profile`

- **Rol:** school+school_admin · **Menú:** (avatar / MobileBottomNav de school_admin)
- **Archivo:** `frontend/src/pages/ProfilePage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[autenticado] · ModuleGate=—
- **Estado:** works · **Uso:** no medido
- **Lee:** children.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Editar Perfil** — `pages/ProfilePage.tsx:173` · gates: `!isEditing` · abre: setIsEditing
- [button] **Cancelar** — `pages/ProfilePage.tsx:179` · gates: `!(!isEditing) && disabled: {loading}`
- [button] **Guardar** — `pages/ProfilePage.tsx:183` · gates: `!(!isEditing) && disabled: {loading}` · W: profiles.update · R: profiles.select
- [button] **Eliminar Cuenta** — `pages/ProfilePage.tsx:402`

<a id="-messages"></a>
### Mensajes (chat) — `/messages`

- **Rol:** school+school_admin · **Menú:** (solo MobileBottomNav: Chat; no está en el menú lateral)
- **Archivo:** `frontend/src/pages/MessagesPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[autenticado (messages:view)] · ModuleGate=—
- **Estado:** broken · **Uso:** sin uso — messages s90=0 r90=0 tot=0
- ⚠ 0 mensajes en toda la base. Solo accesible por la barra móvil («Chat»). La memoria lo registra como módulo roto (auditoría 08-31).
- **Lee:** messages.select, profiles.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [filter] **Buscar: Buscar conversaciones...** — `pages/MessagesPage.tsx:152` · gates: `!isLoading && hasMessages` · **broken**
- [button] **•** — `pages/MessagesPage.tsx:164` · gates: `!isLoading && hasMessages` · **broken**

## Tu tienda

<a id="-tienda-escuela-ajustes"></a>
### Ajustes de la tienda (activar / cobros y entrega) — `/tienda-escuela/ajustes`

- **Rol:** school+school_admin · **Menú:** Tu tienda > Activar tienda \| Cobros y entrega
- **Archivo:** `frontend/src/pages/school/SchoolStoreSettingsPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=— · addon store · store_enabled() global
- **Estado:** hidden · **Uso:** usado — school_addons(store) escuelas=7
- ⚠ Grupo «Tu tienda» exige addon store (7 escuelas) Y store_enabled() global. Tienda no desplegada en general (memoria).
- **Escribe:** rpc:store_enabled

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Reintentar** — `pages/school/SchoolStoreSettingsPage.tsx:146` · **hidden**
- [link] **Ir a Mi plan → /mi-plan?upsell=store** — `pages/school/SchoolStoreSettingsPage.tsx:181` · gates: `status.tone === 'action' && admin!.status.addon === false` · **hidden**
- [toggle] **Transferencia El comprador transfiere y sube el comprobante…** — `pages/school/SchoolStoreSettingsPage.tsx:203` · gates: `disabled: {eligibleAccounts.length === 0}` · **hidden**
- [link] **Agregar una cuenta → {SCHOOL_PAYMENTS_CONFIG_PATH}** — `pages/school/SchoolStoreSettingsPage.tsx:214` · gates: `eligibleAccounts.length === 0` · **hidden**
- [filter] **Selector: {form.allAccounts ? 'all' : 'some'}** — `pages/school/SchoolStoreSettingsPage.tsx:218` · gates: `!(eligibleAccounts.length === 0)` · **hidden**
- [bulk_select] **{`Mostrar ${a.label \|\| ACCOUNT_TYPE_LABEL[a.type] \|\| a.type}`}** — `pages/school/SchoolStoreSettingsPage.tsx:238` · gates: `!(eligibleAccounts.length === 0) && disabled: {form.allAccounts}` · **hidden**
- [bulk_select] **{`${a.label \|\| a.type} no disponible`}** — `pages/school/SchoolStoreSettingsPage.tsx:254` · gates: `!(eligibleAccounts.length === 0) && disabled: true` · **hidden**
- [link] **Pagos → Configuración → {SCHOOL_PAYMENTS_CONFIG_PATH}** — `pages/school/SchoolStoreSettingsPage.tsx:263` · gates: `!(eligibleAccounts.length === 0)` · **hidden**
- [toggle] **Efectivo al retirar El comprador paga en tu sede al recoger…** — `pages/school/SchoolStoreSettingsPage.tsx:289` · **hidden**
- [link] **Conectarla → {SCHOOL_PAYMENTS_CONFIG_PATH}** — `pages/school/SchoolStoreSettingsPage.tsx:310` · gates: `!connected` · **hidden**
- [toggle] **No está conectada. Conectarla** — `pages/school/SchoolStoreSettingsPage.tsx:314` · gates: `disabled: {!connected}` · **hidden**
- [filter] **Selector: {form.allowShipping ? 'shipping' : 'pickup'}** — `pages/school/SchoolStoreSettingsPage.tsx:328` · **hidden**
- [bulk_select] **Todas las sedes** — `pages/school/SchoolStoreSettingsPage.tsx:353` · gates: `admin!.branches.length > 1` · **hidden**
- [button] **Ver mi tienda** — `pages/school/SchoolStoreSettingsPage.tsx:389` · gates: `publicUrl` · **hidden**
- [link] **Ver mi tienda → {publicUrl}** — `pages/school/SchoolStoreSettingsPage.tsx:390` · gates: `publicUrl` · **hidden**
- [button] **Guardar cambios** — `pages/school/SchoolStoreSettingsPage.tsx:393` · gates: `disabled: {saving}` · **hidden**
- [button] **Compartir tienda** — `pages/school/SchoolStoreSettingsPage.tsx:162` · abre: setShareOpen · **hidden**
- [dialog] **Compartir tienda** — `components/vendor/ShareStoreDialog.tsx:70` · gates: `publicUrl` · **hidden**
- [button] **Copiado / Copiar** — `components/vendor/ShareStoreDialog.tsx:85` · gates: `publicUrl` · **hidden**
- [export] **Descargar QR** — `components/vendor/ShareStoreDialog.tsx:100` · gates: `publicUrl` · **hidden**
- [button] **WhatsApp** — `components/vendor/ShareStoreDialog.tsx:107` · gates: `publicUrl` · **hidden**
- [link] **WhatsApp → {waHref}** — `components/vendor/ShareStoreDialog.tsx:108` · gates: `publicUrl` · **hidden**
- [button] **Compartir** — `components/vendor/ShareStoreDialog.tsx:112` · gates: `publicUrl` · **hidden**
- ↪ componente compartido `components/vendor/SchoolStoreActivationCard.tsx` (4 acciones) — detallado en `/dashboard`

<a id="-orders"></a>
### Pedidos — `/orders`

- **Rol:** school+school_admin · **Menú:** Tu tienda > Pedidos
- **Archivo:** `frontend/src/pages/StoreOrdersPage.tsx` (+3 componentes)
- **Gates:** allowedRoles=[store_owner, admin, school, school_admin, super_admin] · ModuleGate=— · addon store · store_enabled() · StoreGate · tienda activada
- **Estado:** hidden · **Uso:** usado — orders s90=1 r90=3 tot=4
- **Escribe:** POST /api/v1/marketplace/checkout/cart, POST /api/v1/store/orders/:p/cancel, POST /api/v1/store/orders/:p/pickup-code, POST /api/v1/store/orders/:p/receipt, POST /api/v1/store/orders/:p/receipt-url, POST /api/v1/store/orders/:p/received, POST /api/v1/store/vendor/orders/:p/approve-receipt, POST /api/v1/store/vendor/orders/:p/confirm-cash, POST /api/v1/store/vendor/orders/:p/reject-receipt, POST /api/v1/store/vendor/orders/:p/transition, rpc:quote_cart
- **Lee:** GET /api/v1/marketplace/orders, GET /api/v1/marketplace/orders/:p, GET /api/v1/marketplace/vendor/:p, GET /api/v1/store/orders/:p/payment, GET /api/v1/store/payment-methods/:p, GET /api/v1/store/vendor/orders/:p/receipt-url, order_status_history.select, orders.select, product_variants.select, school_branches.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Actualizar** — `pages/StoreOrdersPage.tsx:179` · gates: `disabled: {ordersQ.isFetching}` · R: orders.select, product_variants.select · **hidden**
- [filter] **Buscar: Buscar por referencia o cliente** — `pages/StoreOrdersPage.tsx:200` · **hidden**
- [button] **Reintentar** — `pages/StoreOrdersPage.tsx:208` · gates: `!(ordersQ.isLoading)` · R: orders.select, product_variants.select · **hidden**
- [button] **producto / productos · ·** — `pages/StoreOrdersPage.tsx:223` · gates: `!(ordersQ.isLoading)` · abre: setOpenId · **hidden**
- [button] **(() => startAction(o, main))** — `pages/StoreOrdersPage.tsx:241` · gates: `!(ordersQ.isLoading) && main && disabled: {busy}` · W: POST /api/v1/store/vendor/orders/:p/approve-receipt, POST /api/v1/store/vendor/orders/:p/reject-receipt, POST /api/v1/store/vendor/orders/:p/confirm-cash, POST /api/v1/store/vendor/orders/:p/transition · **hidden**
- [button] **Ver detalle** — `pages/StoreOrdersPage.tsx:243` · gates: `!(ordersQ.isLoading)` · abre: setOpenId · **hidden**
- [dialog] **(sin etiqueta)** — `pages/StoreOrdersPage.tsx:257` · gates: `open` · **hidden**
- [button] **Ver comprobante** — `pages/StoreOrdersPage.tsx:304` · gates: `open && open.receipt_path` · R: GET /api/v1/store/vendor/orders/:p/receipt-url, orders.select, product_variants.select · **hidden**
- [button] **(() => startAction(open, a))** — `pages/StoreOrdersPage.tsx:313` · gates: `open && sellerActions(open).length > 0 && disabled: {busy}` · W: POST /api/v1/store/vendor/orders/:p/approve-receipt, POST /api/v1/store/vendor/orders/:p/reject-receipt, POST /api/v1/store/vendor/orders/:p/confirm-cash, POST /api/v1/store/vendor/orders/:p/transition · R: orders.select, product_variants.select · **hidden**
- [dialog] **(sin etiqueta)** — `pages/StoreOrdersPage.tsx:344` · gates: `pending` · **hidden**
- [button] **Volver** — `pages/StoreOrdersPage.tsx:372` · gates: `pending` · **hidden**
- [button] **Confirmar** — `pages/StoreOrdersPage.tsx:373` · gates: `pending && disabled: {!dialogValid \|\| busy}` · W: POST /api/v1/store/vendor/orders/:p/approve-receipt, POST /api/v1/store/vendor/orders/:p/reject-receipt, POST /api/v1/store/vendor/orders/:p/confirm-cash, POST /api/v1/store/vendor/orders/:p/transition · **hidden**

<a id="-vendor-products"></a>
### Productos — `/vendor/products`

- **Rol:** school+school_admin · **Menú:** Tu tienda > Productos
- **Otras entradas:** Alias /products (StoreProductsPage re-exporta VendorProductsPage)
- **Archivo:** `frontend/src/pages/vendor/VendorProductsPage.tsx` (+1 componentes)
- **Gates:** allowedRoles=[VendorGuard (vendor_profile; escuela vía useSchoolStore)] · ModuleGate=— · addon store · store_enabled() · StoreGate · VendorGuard
- **Estado:** hidden · **Uso:** usado — products s90=0 r90=3 tot=6
- ⚠ Pasa por VendorGuard (vendor_profile); /products, /categories y /promotions renderizan la misma página.
- **Escribe:** DELETE /api/v1/vendor/products/:p

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nuevo producto** — `pages/vendor/VendorProductsPage.tsx:60` · → /vendor/products/new · **hidden**
- [filter] **Buscar: Buscar…** — `pages/vendor/VendorProductsPage.tsx:69` · gates: `products.length > 0` · **hidden**
- [filter] **Selector: {status}** — `pages/vendor/VendorProductsPage.tsx:71` · gates: `products.length > 0` · **hidden**
- [filter] **Selector: {category}** — `pages/vendor/VendorProductsPage.tsx:80` · gates: `products.length > 0` · **hidden**
- [filter] **Selector: {level}** — `pages/vendor/VendorProductsPage.tsx:87` · gates: `products.length > 0` · **hidden**
- [button] **Crear producto** — `pages/vendor/VendorProductsPage.tsx:109` · gates: `!(isLoading)` · → /vendor/products/new · **hidden**
- [button] **{`Ajustar stock de ${product.name}`}** — `pages/vendor/VendorProductsPage.tsx:148` · gates: `!(isLoading)` · **hidden**
- [button] **{`Editar ${product.name}`}** — `pages/vendor/VendorProductsPage.tsx:151` · gates: `!(isLoading)` · → /vendor/products/${product.id}/edit · **hidden**
- [button] **{`Archivar ${product.name}`}** — `pages/vendor/VendorProductsPage.tsx:155` · gates: `!(isLoading) && product.status !== 'archived'` · W: DELETE /api/v1/vendor/products/:p · **hidden**
- [dialog] **Ajustar stock** — `components/store/inventory/StockAdjustDialog.tsx:90` · **hidden**
- [filter] **Selector: Elige la variante** — `components/store/inventory/StockAdjustDialog.tsx:98` · gates: `hasVariants` · **hidden**
- [button] **Sumar / restar** — `components/store/inventory/StockAdjustDialog.tsx:117` · **hidden**
- [button] **Fijar cantidad** — `components/store/inventory/StockAdjustDialog.tsx:120` · **hidden**
- [filter] **Selector: {motive}** — `components/store/inventory/StockAdjustDialog.tsx:141` · **hidden**
- [button] **Cancelar** — `components/store/inventory/StockAdjustDialog.tsx:157` · **hidden**
- [button] **Guardar ajuste** — `components/store/inventory/StockAdjustDialog.tsx:158` · gates: `disabled: {!valid \|\| saving}` · **hidden**

<a id="-vendor-products-new-vendor-products-id-edit"></a>
### Asistente de producto (crear/editar) — `/vendor/products/new \| /vendor/products/:id/edit`

- **Rol:** school+school_admin · **Menú:** (desde Productos)
- **Archivo:** `frontend/src/components/vendor/product-wizard/ProductWizard.tsx` (+3 componentes)
- **Gates:** allowedRoles=[VendorGuard] · ModuleGate=— · StoreGate
- **Estado:** hidden · **Uso:** usado — products s90=0 r90=3 tot=6
- **Escribe:** PATCH /api/v1/vendor/products/:p, POST /api/v1/vendor/products, POST /api/v1/vendor/products/:p/publish
- **Lee:** product_brand_categories.select, product_brands.select, product_categories.select, products.select, vendor_profiles.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **👕 atributos** — `components/vendor/product-wizard/ProductWizard.tsx:397` · gates: `step === 1 && !(catsLoading)` · **hidden**
- [filter] **Selector: Elige marca** — `components/vendor/product-wizard/ProductWizard.tsx:467` · gates: `step === 2 && category` · **hidden**
- [toggle] **Este producto tiene variantes** — `components/vendor/product-wizard/ProductWizard.tsx:578` · gates: `step === 3 && category && disabled: {state.existing_variants.length > 0}` · **hidden**
- [filter] **Selector: {state.visibility}** — `components/vendor/product-wizard/ProductWizard.tsx:635` · gates: `step === 4 && category` · **hidden**
- [button] **Cancelar / Atrás** — `components/vendor/product-wizard/ProductWizard.tsx:660` · → /vendor/products · **hidden**
- [button] **Siguiente** — `components/vendor/product-wizard/ProductWizard.tsx:666` · gates: `step &lt; 4 && disabled: {(step === 1 && !canGoStep2) \|\| (step === 2 && !canGoStep3)…` · **hidden**
- [button] **Guardar cambios / Guardar borrador** — `components/vendor/product-wizard/ProductWizard.tsx:675` · gates: `!(step &lt; 4) && disabled: {saving \|\| !canSave}` · W: POST /api/v1/vendor/products, PATCH /api/v1/vendor/products/:p, POST /api/v1/vendor/products/:p/publish · → /vendor/products/${createdProductId}/edit, /vendor/products · **hidden**
- [button] **Publicar ahora** — `components/vendor/product-wizard/ProductWizard.tsx:680` · gates: `!(step &lt; 4) && !isActiveProduct && disabled: {saving \|\| !canPublish}` · W: POST /api/v1/vendor/products, PATCH /api/v1/vendor/products/:p, POST /api/v1/vendor/products/:p/publish · → /vendor/products/${createdProductId}/edit, /vendor/products · **hidden**
- [button] **Hacer principal** — `components/vendor/product-wizard/ProductGalleryUploader.tsx:119` · gates: `step === 2 && category && idx !== 0` · **hidden**
- [button] **Eliminar** — `components/vendor/product-wizard/ProductGalleryUploader.tsx:125` · gates: `step === 2 && category` · **hidden**
- [filter] **Selector: {`Selecciona ${field.label.toLowerCase()}`}** — `components/vendor/product-wizard/DynamicAttributeField.tsx:24` · gates: `step === 2 && category && productSchema.length > 0` · **hidden**
- [button] **Aplicar** — `components/vendor/product-wizard/VariantMatrixBuilder.tsx:101` · gates: `step === 3 && category && !(!state.has_variants) && rows.length > 0 && disabled: {bulk === '' \|\| Number(bulk) &lt; 0}` · **hidden**
- [toggle] **{`${r.is_active ? 'Desactivar' : 'Activar'} ${r.label}`}** — `components/vendor/product-wizard/VariantMatrixBuilder.tsx:133` · gates: `step === 3 && category && !(!state.has_variants) && rows.length > 0` · **hidden**
- [button] **{`Quitar ${v}`}** — `components/vendor/product-wizard/VariantMatrixBuilder.tsx:215` · gates: `step === 3 && category && !(!state.has_variants) && values.filter(v => !(field.options \|\| []).includes(v)).length > 0` · **hidden**
- [button] **{`Agregar ${field.label.toLowerCase()}`}** — `components/vendor/product-wizard/VariantMatrixBuilder.tsx:238` · gates: `step === 3 && category && !(!state.has_variants) && (field.type === 'text' \|\| field.type === 'number' \|\| field.type === 'color' \|\| …` · **hidden**

<a id="-inventory"></a>
### Inventario — `/inventory`

- **Rol:** school+school_admin · **Menú:** Tu tienda > Inventario
- **Archivo:** `frontend/src/pages/StoreInventoryPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[store_owner, admin, school, school_admin, super_admin] · ModuleGate=— · addon store · store_enabled() · StoreGate
- **Estado:** hidden · **Uso:** usado — products s90=0 r90=3 tot=6

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nuevo producto** — `pages/StoreInventoryPage.tsx:66` · → /vendor/products/new · **hidden**
- [button] **Reponer** — `pages/StoreInventoryPage.tsx:128` · gates: `!(lowList.length === 0)` · **hidden**
- [filter] **Buscar: Buscar producto o talla…** — `pages/StoreInventoryPage.tsx:171` · **hidden**
- [filter] **Selector: {category}** — `pages/StoreInventoryPage.tsx:173` · **hidden**
- [filter] **Selector: {level}** — `pages/StoreInventoryPage.tsx:180` · **hidden**
- [button] **Sin variantes** — `pages/StoreInventoryPage.tsx:214` · gates: `!(filtered.length === 0) && disabled: {!p.has_variants}` · **hidden**
- [button] **Ajustar** — `pages/StoreInventoryPage.tsx:240` · gates: `!(filtered.length === 0)` · **hidden**
- [button] **Historial** — `pages/StoreInventoryPage.tsx:243` · gates: `!(filtered.length === 0)` · **hidden**
- [button] **{`Ajustar ${v.name}`}** — `pages/StoreInventoryPage.tsx:264` · gates: `!(filtered.length === 0) && open && v.is_active !== false` · **hidden**
- [dialog] **Historial de stock** — `components/store/inventory/KardexDialog.tsx:30` · **hidden**
- ↪ componente compartido `components/store/inventory/StockAdjustDialog.tsx` (7 acciones) — detallado en `/vendor/products`

## Sin menú (rutas huérfanas)

<a id="-programs-management"></a>
### Gestión de programas — `/programs-management`

- **Rol:** school+school_admin · **Menú:** (sin menú) — Acción rápida por defecto «Ver Equipos» apunta aquí
- **Archivo:** `frontend/src/pages/ProgramsManagementPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** no medido
- ⚠ Sin ítem de menú, pero la acción rápida por defecto del dashboard («Ver Equipos») lleva aquí. Duplica /teams.
- **Escribe:** POST /api/v1/enrollments, POST /api/v1/students/bulk, POST /api/v1/students/children-by-ids, children.delete, children.insert, children.update, enrollments.update, school_members.update, teams.delete, teams.insert, teams.update, unregistered_athletes.update
- **Lee:** children.select, enrollments.select, school_athletes.select, school_staff.select, team_coaches.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Actualizar** — `pages/ProgramsManagementPage.tsx:152` · gates: `disabled: {refreshing}` · W: POST /api/v1/enrollments · R: teams.select · **dead route**
- [button] **Nueva Clase** — `pages/ProgramsManagementPage.tsx:166` · abre: setShowCreateModal · **dead route**
- [filter] **Buscar: Buscar por nombre, deporte o entrenador...** — `pages/ProgramsManagementPage.tsx:224` · **dead route**
- [button] **Crear Primera Clase** — `pages/ProgramsManagementPage.tsx:242` · gates: `filteredClasses.length === 0 && !searchQuery` · abre: setShowCreateModal · **dead route**
- [button] **Inscribir deportista** — `pages/ProgramsManagementPage.tsx:262` · gates: `!(filteredClasses.length === 0)` · **dead route**
- [button] **(() => handleDelete(classItem.id))** — `pages/ProgramsManagementPage.tsx:274` · gates: `!(filteredClasses.length === 0)` · W: teams.delete, POST /api/v1/enrollments · R: teams.select · **dead route**
- [dialog] **Crear Nueva Clase** — `components/classes/CreateClassModal.tsx:137` · **dead route**
- [filter] **Selector: {formData.level}** — `components/classes/CreateClassModal.tsx:173` · **dead route**
- [filter] **Selector: {loadingStaff ? "Cargando..." : "Seleccionar entrenador"}** — `components/classes/CreateClassModal.tsx:205` · **dead route**
- [filter] **Selector: {formData.status}** — `components/classes/CreateClassModal.tsx:298` · **dead route**
- [button] **Cancelar** — `components/classes/CreateClassModal.tsx:313` · gates: `disabled: {creating}` · **dead route**
- [button] **Creando... Crear Clase** — `components/classes/CreateClassModal.tsx:321` · gates: `disabled: {creating}` · W: teams.insert, POST /api/v1/enrollments · R: teams.select · **dead route**
- [dialog] **Inscribir Deportistas** — `components/classes/EnrollStudentModal.tsx:133` · **dead route**
- [filter] **Buscar: Buscar deportista por nombre, email o grado...** — `components/classes/EnrollStudentModal.tsx:160` · **dead route**
- [button] **Remover** — `components/classes/EnrollStudentModal.tsx:215` · gates: `!(loading) && enrolled && disabled: {isCurrentlyEnrolling}` · W: enrollments.update, POST /api/v1/enrollments · R: teams.select · **dead route**
- [button] **Inscribir** — `components/classes/EnrollStudentModal.tsx:232` · gates: `!(loading) && !(enrolled) && disabled: {isCurrentlyEnrolling \|\| isFull}` · W: POST /api/v1/enrollments · R: teams.select · **dead route**
- [button] **Cerrar** — `components/classes/EnrollStudentModal.tsx:264` · **dead route**

<a id="-school-config"></a>
### Configuración de escuela (vieja) — `/school-config`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/SchoolSettingsPage.tsx` (+2 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** no medido
- ⚠ Configuración vieja de escuela; duplica /settings (pestañas de escuela).
- **Escribe:** PUT /api/v1/schools/:p/branding, schools.update, storage:avatars.upload
- **Lee:** schools.select, storage:avatars.getPublicUrl

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Guardando... / Guardar Cambios** — `pages/SchoolSettingsPage.tsx:144` · gates: `disabled: {saving}` · W: schools.update · **dead route**
- [button] **Gestionar Sedes Configurar sucursales y ubicaciones** — `pages/SchoolSettingsPage.tsx:280` · → /branches · **dead route**
- [button] **Gestionar Instalaciones Canchas, espacios y equipamiento** — `pages/SchoolSettingsPage.tsx:291` · → /facilities · **dead route**
- ↪ componente compartido `components/settings/BrandingSettingsForm.tsx` (9 acciones) — detallado en `/settings`

<a id="-pickup"></a>
### Monitor de salida segura — `/pickup`

- **Rol:** school · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/school/PickupMonitorPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin] · ModuleGate=—
- **Estado:** dead code · **Uso:** no medido
- ⚠ Monitor de salida con datos MOCK; sin backend. Solo profile.role school/admin (y privilegiados por contexto).

#### Sin pestaña (cuerpo, encabezado y modales)

- [bulk] **Detener Simulación / Simular Llegada Masiva** — `pages/school/PickupMonitorPage.tsx:132` · **dead code**
- [filter] **Buscar: Buscar por deportista, acudiente o placa...** — `pages/school/PickupMonitorPage.tsx:186` · **dead code**
- [button] **Marcar en Puerta** — `pages/school/PickupMonitorPage.tsx:226` · **dead code**
- [button] **Confirmar Entrega** — `pages/school/PickupMonitorPage.tsx:265` · **dead code**

<a id="-school-delegations"></a>
### Delegaciones — `/school/delegations`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/school/SchoolDelegationsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** usado — event_delegations s90=1 r90=1 tot=1
- ⚠ 1 delegación histórica. Sin menú.
- **Lee:** GET /api/v1/school/delegations

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **(() => navigate('/dashboard'))** — `pages/school/SchoolDelegationsPage.tsx:109` · → /dashboard · **dead route**
- [button] **Explorar Eventos** — `pages/school/SchoolDelegationsPage.tsx:117` · → /events · **dead route**
- [button] **Explorar Eventos** — `pages/school/SchoolDelegationsPage.tsx:175` · gates: `delegations.length === 0` · → /events · **dead route**
- [button] **Ver Detalle** — `pages/school/SchoolDelegationsPage.tsx:249` · gates: `!(delegations.length === 0)` · → /school/delegations/${del.id} · **dead route**
- [button] **Ver Evento** — `pages/school/SchoolDelegationsPage.tsx:255` · gates: `!(delegations.length === 0) && ev?.slug` · **dead route**

<a id="-school-delegations-id"></a>
### Detalle de delegación — `/school/delegations/:id`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/school/SchoolDelegationDetailPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** usado — event_delegations s90=1 r90=1 tot=1
- **Escribe:** POST /api/v1/events/:p/delegations/mine/payment, storage:identity-documents.upload
- **Lee:** GET /api/v1/school/delegations/:p, storage:identity-documents.getPublicUrl

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Volver a Delegaciones** — `pages/school/SchoolDelegationDetailPage.tsx:191` · → /school/delegations · **dead route**
- [button] **(() => navigate('/school/delegations'))** — `pages/school/SchoolDelegationDetailPage.tsx:206` · → /school/delegations · **dead route**
- [button] **Ver Evento** — `pages/school/SchoolDelegationDetailPage.tsx:217` · gates: `ev?.slug` · **dead route**
- [button] **Enviando… / Registrar pago** — `pages/school/SchoolDelegationDetailPage.tsx:307` · gates: `disabled: {paying}` · W: storage:identity-documents.upload, POST /api/v1/events/:p/delegations/mine/payment · R: storage:identity-documents.getPublicUrl, GET /api/v1/school/delegations/:p · **dead route**

#### Pestaña «Equipos y Atletas» (`equipos`) — SchoolDelegationDetailPage.tsx:314

_(sin acciones; 0 controles menores)_

#### Pestaña «Documentos ( / )» (`documentos`) — SchoolDelegationDetailPage.tsx:318

_(sin acciones; 0 controles menores)_

<a id="-school-enroll-eventid"></a>
### Inscribir delegación a evento — `/school/enroll/:eventId`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/school/EventEnrollmentPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** usado — event_delegations s90=1 r90=1 tot=1
- **Escribe:** POST /api/v1/events/:p/enroll
- **Lee:** GET /api/v1/events/:p/enroll-info

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Volver** — `pages/school/EventEnrollmentPage.tsx:91` · → -1 · **dead route**
- [button] **Volver** — `pages/school/EventEnrollmentPage.tsx:99` · → -1 · **dead route**
- [button] **Agregar atleta** — `pages/school/EventEnrollmentPage.tsx:169` · **dead route**
- [button] **Agregar otro equipo** — `pages/school/EventEnrollmentPage.tsx:187` · **dead route**
- [button] **Enviando… / Enviar inscripción** — `pages/school/EventEnrollmentPage.tsx:197` · gates: `disabled: {submitting \|\| notOpen}` · W: POST /api/v1/events/:p/enroll · → /school/delegations · **dead route**

<a id="-estado-cuenta"></a>
### Estado de cuenta — `/estado-cuenta`

- **Rol:** school+school_admin · **Menú:** (sin menú; enlaces internos)
- **Archivo:** `frontend/src/pages/AccountStatementPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[school, admin, school_admin, super_admin, parent, athlete] · ModuleGate=—
- **Estado:** works · **Uso:** no medido
- ⚠ Sin menú propio; se llega desde Deportistas > «Ver estado de cuenta».
- **Lee:** rpc:get_athlete_account_statement

#### Sin pestaña (cuerpo, encabezado y modales)

- [export] **Imprimir** — `pages/AccountStatementPage.tsx:132`

<a id="-admin-users"></a>
### Admin: usuarios (rol school permitido) — `/admin/users`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/AdminUsersPage.tsx` (+3 componentes)
- **Gates:** allowedRoles=[admin, school, super_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** no medido
- ⚠ Ruta admin sin strictRoleCheck: allowedRoles incluye school y ProtectedRoute deja pasar a cualquier owner/admin/school_admin de contexto. Gestión de miembros e invitaciones duplicada con /staff e /invitations.
- **Escribe:** invitations.insert, rpc:create_invitation
- **Lee:** GET /api/v1/admin/support/user-state, school_branches.select, school_members.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Diagnosticar cuenta** — `pages/AdminUsersPage.tsx:261` · gates: `canDiagnose` · **dead route**
- [button] **Invitar Usuario** — `pages/AdminUsersPage.tsx:268` · **dead route**
- [dialog] **Invitar Nuevo Usuario** — `pages/AdminUsersPage.tsx:275` · **dead route**
- [filter] **Selector: {inviteForm.role}** — `pages/AdminUsersPage.tsx:302` · **dead route**
- [filter] **Selector: Selecciona una sede...** — `pages/AdminUsersPage.tsx:319` · gates: `inviteForm.role === 'school_admin' && branches.length > 0` · **dead route**
- [button] **Cancelar** — `pages/AdminUsersPage.tsx:336` · abre: setDialogOpen · **dead route**
- [button] **Enviar Invitación** — `pages/AdminUsersPage.tsx:343` · gates: `disabled: {inviting}` · W: rpc:create_invitation, invitations.insert · R: school_members.select · **dead route**
- [filter] **Buscar: Buscar por nombre o email...** — `pages/AdminUsersPage.tsx:386` · **dead route**
- [filter] **Selector: {roleFilter}** — `pages/AdminUsersPage.tsx:393` · **dead route**
- [button] **Diagnosticar cuenta** — `pages/AdminUsersPage.tsx:472` · gates: `!(loading) && canDiagnose && disabled: {!m.email}` · **dead route**
- [dialog] **Diagnóstico de la cuenta** — `components/admin/UserStateDialog.tsx:199` · gates: `canDiagnose` · **dead route**
- [button] **Diagnosticar** — `components/admin/UserStateDialog.tsx:216` · gates: `canDiagnose && disabled: {loading \|\| !email.trim()}` · R: GET /api/v1/admin/support/user-state · **dead route**
- ↪ componente compartido `components/common/TableRefreshBar.tsx` (1 acciones) — detallado en `/students`

<a id="-admin-clubs"></a>
### Admin: clubes (rol school permitido) — `/admin/clubs`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/AdminClubsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[admin, school, super_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** no medido
- ⚠ Sin strictRoleCheck; resumen por sede que duplica /branches.
- **Escribe:** school_branches.insert
- **Lee:** children.select, payments.select, school_branches.select, school_members.select, teams.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [button] **Nueva Sede** — `pages/AdminClubsPage.tsx:160` · **dead route**
- [dialog] **Crear Nueva Sede** — `pages/AdminClubsPage.tsx:167` · **dead route**
- [button] **Cancelar** — `pages/AdminClubsPage.tsx:205` · abre: setDialogOpen · **dead route**
- [button] **Crear Sede** — `pages/AdminClubsPage.tsx:208` · gates: `disabled: {creating}` · W: school_branches.insert · R: school_branches.select, children.select, school_members.select, payments.select, teams.select · **dead route**
- [button] **Crear primera sede** — `pages/AdminClubsPage.tsx:250` · gates: `!(loading)` · abre: setDialogOpen · **dead route**

<a id="-admin-analytics"></a>
### Admin: analítica (rol school permitido) — `/admin/analytics`

- **Rol:** school+school_admin · **Menú:** (sin menú)
- **Archivo:** `frontend/src/pages/AdminAnalyticsPage.tsx` (+0 componentes)
- **Gates:** allowedRoles=[admin, school, super_admin] · ModuleGate=—
- **Estado:** dead route · **Uso:** no medido
- ⚠ Sin strictRoleCheck; analítica de plataforma visible a una escuela por URL.
- **Lee:** enrollments.select, orders.select, payments.select, profiles.select, schools.select, wellness_appointments.select

#### Sin pestaña (cuerpo, encabezado y modales)

- [filter] **Selector: {period}** — `pages/AdminAnalyticsPage.tsx:190` · **dead route**
- [button] **Actualizar** — `pages/AdminAnalyticsPage.tsx:201` · R: enrollments.select, payments.select, orders.select, wellness_appointments.select, profiles.select, schools.select · **dead route**
- [export] **Exportar** — `pages/AdminAnalyticsPage.tsx:205` · **dead route**

---

## Hallazgos transversales

### Duplicaciones (la misma función alcanzable desde 2+ lugares)

| # | Función | Dónde aparece | Evidencia |
|---|---|---|---|
| 1 | **Registrar pago / Cobros y pagos** | `/students` (menú de fila y diálogo), `/teams` (cobrar al equipo), `/payments-automation` (botón principal). Los tres montan `RegisterCashPaymentModal` y, con el flag, `CobrosYPagosModal` + `OperacionesTab` | 16 archivos de `components/payment/*` compartidos por las 3 pantallas |
| 2 | **Datos de facturación del pagador (DIAN)** | `BillingDetailsForm` + `MunicipalitySelect` en `/students`, `/teams`, `/payments-automation`, `/accounting`, `/facturacion-electronica` | 5 pantallas |
| 3 | **Facturación electrónica** | `/facturacion-electronica` (standalone, addon invoicing) = pestaña «Facturación» de `/accounting` (`InvoicingTab`, `VoidInvoiceDialog`, `EmitPaymentInvoiceButton`…) | Duplicado intencional; el menú esconde el standalone si hay addon accounting |
| 4 | **Cartera / antigüedad de saldos** | `/payments-automation` (aging, grilla de historial, KPIs), `/finances` (`PaymentAgingCard`, `ReminderHistoryModal`), `/reporter-dashboard` (cartera por estado + CSV), `/school-reports` | 4 destinos para mirar lo que se debe |
| 5 | **Configuración de la escuela** | `/settings` (pestañas Academia/Marca/Métricas), `/school-config` (huérfana, `BrandingSettingsForm` otra vez), `/admin/config` (misma `SettingsPage`), pestaña «Config» de `/payments-automation` (permisos del coach, recordatorios, mora, pausas) | Ajustes repartidos en 3 sitios + 1 alias |
| 6 | **Gestión de equipos** | `/teams` (menú) y `/programs-management` (sin menú, pero es el destino de la acción rápida por defecto «Ver Equipos») | `quickActionsCatalog.ts:37` |
| 7 | **Invitar a una persona** | `/invitations`, `/students` (masivo y por fila → `POST /api/v1/invitations/bulk-send`), `/staff` (switch `send_invitation` al crear entrenador), `/admin/users` (`rpc:create_invitation`, huérfana) | 4 caminos, 2 backends distintos |
| 8 | **Plantillas y recordatorios de cobro** | `/payment-reminders` y `/message-templates` escriben la misma tabla `payment_message_templates`; el toggle «Enviar recordatorios» vive además en Config de `/payments-automation` | |
| 9 | **Disponibilidad / clases de prueba** | `AvailabilityManager` en `/staff` y `/facilities`; `ShareTrialLinkDialog` + `trial-classes-self` en `/offerings` y `/facilities` | |
| 10 | **Visor de sesión / pizarra táctica** | `SessionViewer`, `TacticalBoard`, `PlayerCard`… en `/seguimiento-deportivo` y `/training-plans` | 9 archivos compartidos |
| 11 | **Resultados deportivos** | `/results-overview` (menú «Resultados», vacío) vs resultados reales (`match_results`) dentro de `/training-plans` y `/seguimiento-deportivo` | |
| 12 | **Carnets** | Dos ítems de menú («Carnets Digitales», «Plantillas de Carnets») abren la misma página `/cards` (el segundo con `?tab=templates`) | `navigation.ts:515-516` |
| 13 | **Alias de ruta** | `/school/dotacion` = `/school/equipment`; `/products`, `/categories`, `/promotions` = `VendorProductsPage`; `ReportsPage` en `/school-reports`, `/admin/reports`, `/store-reports`; `NotificationsPage` en `/notifications` y `/admin/logs`; `SettingsPage` en `/settings` y `/admin/config` | `App.tsx` |

### Rotas, muertas u ocultas

**Rotas o vacías**
- `/results-overview` («Resultados», en el menú): datos de demo hardcodeados; fuera de `demo_mode` la lista sale **siempre vacía** (`ResultsOverviewPage.tsx:47`).
- `/messages` (solo en la barra móvil como «Chat»): **0 mensajes** en toda la base; la memoria lo marca como módulo roto.
- `/pickup`: monitor de salida con datos **mock**, sin backend (código muerto alcanzable por URL).
- Panel del Super Admin: `MODULE_GROUPS` (`module-catalog.ts`) **no incluye «Comunicación»**, y `AdminSubscriptionsPage.tsx:1252` itera esa lista. Los overrides de `comunicacion_whatsapp`, `documentos_recordatorios` y `documentos_plantillas_mensajes` existen en el catálogo pero no se pueden activar ni desactivar desde el panel.

**Rutas sin entrada de menú (alcanzables por URL)**
- `/programs-management` (la acción rápida por defecto lleva aquí), `/school-config`, `/school/delegations`, `/school/delegations/:id`, `/school/enroll/:eventId`, `/estado-cuenta` (se llega desde Deportistas), `/pickup`.
- Rutas admin sin `strictRoleCheck` que una escuela abre por URL: `/admin/users`, `/admin/clubs`, `/admin/analytics`, `/admin/reports`, `/admin/config`, `/admin/logs` y también `/admin/payroll-config`. `ProtectedRoute` deja pasar a cualquier owner, admin o school_admin de contexto: `PRIVILEGED_CONTEXT_ROLES` salta `allowedRoles`.
- Lo mismo pasa con pantallas de otros roles (p. ej. `/pacientes`, solo para wellness): para owner y school_admin, `allowedRoles` casi nunca bloquea. Cada pantalla depende de su RLS o BFF.

**Ítems de menú sin ruta:** ninguno. Todos los `href` de los dos árboles de escuela (45 en `school`, 44 en `school_admin`) tienen ruta en `App.tsx`.

**Páginas sin ruta (código muerto):** `AdvancedSearchPage`, `AnalyticsDashboardPage`, `AthletesListPage`, `CalendarAdvancedPage`, `FacilitiesPage`, `MessagesDetailPage`, `ProductDetailPage`, `StorePage`, `StudentsPage`, `UnderConstructionPage` (en `frontend/src/pages/`, nadie las importa).

**Config muerta:** `config/routePermissions.ts` no lo importa nadie. Sus reglas ya divergen de `App.tsx`: por ejemplo, dice que `/announcements` y `/results` son solo para coach, pero en `App.tsx` esas rutas no tienen `allowedRoles`.

**Gates que casi nadie tiene prendidos**
| Gate | Qué esconde | Alcance real |
|---|---|---|
| `VITE_COBROS_Y_PAGOS` (o `localStorage['sportmaps:cobros-y-pagos']`) | Modal «Cobros y pagos», pestaña Operaciones, cobrar al equipo | `charge_batches` = 0 filas: no se usa en ninguna escuela |
| addon `store` + `store_enabled()` global | Grupo «Tu tienda» (Pedidos, Productos, Inventario, Ajustes) | 7 escuelas con addon; 3 pedidos en 90 días |
| `billing_enabled = false` | Ítem «Membresías» (y oculta Pagos/Finanzas/Recordatorios) | 1 de 371 escuelas; `memberships` = 0 filas |
| `useIsMultiSport()` | «Deportes y Categorías» | `school_categories` en 3 escuelas |
| addon `tournaments` (solo menú) | «Mis Torneos» | 30 escuelas con addon, pero la URL no lo exige |
| addon `accounting` | Contabilidad completa | 7 escuelas (3 la tienen apagada por override) |
| addon `invoicing` (+ oculto si accounting) | Facturación electrónica standalone | 3 escuelas |
| addon `access_control` | Control de Acceso | 31 con addon, 3 con torniquetes |
| Débito automático (pestaña de Pagos) | Autopay | `recurring_subscriptions` = 0 |

**Inconsistencias de gates**
- `MobileBottomNav` (rol `school`) muestra «Pagos» aunque `billing_enabled = false` (el sidebar sí lo oculta) y muestra «Chat» (`/messages`, que está roto). Además usa `profile.role`, no el rol de contexto: un `school_admin` ve la barra genérica (Inicio/Calendario/Mensajes/Perfil).
- Varios ítems del menú de escuela no tienen `moduleKey`, así que el Super Admin no los puede apagar: Seguimiento deportivo, Asistencias (Supervisión/Histórico/Encuestas), Resultados, Mis Torneos, Dotación, Disponibilidad médica, Deportistas, Entrenadores, Invitaciones, Facturación (`/mi-plan`).
- `/school/public-profile` solo está en el árbol `school`; el `school_admin` la abre por URL (la ruta lo permite).

## Uso: las 10 funciones más usadas y las 10 nunca usadas

Base viva, solo lectura, 2026-10-10. Ventana de 90 días. «Escuelas» = escuelas distintas con filas nuevas.

**Más usadas** (ordenadas por amplitud y volumen)
| # | Función (pantalla) | Tabla | Escuelas 90 d | Filas 90 d |
|---|---|---|---|---|
| 1 | Registrar y aprobar pagos, cartera (`/payments-automation`, `/students`) | `payments` | 25 | 4.960 |
| 2 | Notificaciones (campana) | `notifications` | 20 | 5.405 |
| 3 | Inscripciones / alta de deportista (`/students`, `/teams`) | `enrollments` / `children` | 18 / 14 | 921 / 412 |
| 4 | Sedes (`/branches`) | `school_branches` | 16 | 24 |
| 5 | Invitaciones (`/invitations`, `/students`) | `invitations` | 14 | 259 |
| 6 | Entrenadores (`/staff`) | `school_staff` | 14 | 49 |
| 7 | Asistencia, supervisión e histórico (`/attendance-supervision`, `/attendance-history`) | `attendance_sessions` / `attendance_records` | 13 / 11 | 1.196 / 4.981 |
| 8 | Equipos (`/teams`) | `teams` | 13 | 80 |
| 9 | Planes y ofertas (`/offerings`) | `offering_plans` | 11 | 72 |
| 10 | Métricas de rendimiento (`/training-plans`) | `performance_entries` | 8 | 1.367 |

Mucho volumen en pocas escuelas: Control de Acceso (`access_events`, 10.376 filas en 4 escuelas), Carnets (508 en 3), Facturación electrónica (324 en 2), WhatsApp (292 conversaciones en 2), Informe mensual (157 en 6), Calendario (106 en 5).

**Nunca usadas** (0 filas en 90 días)
| # | Función (pantalla) | Evidencia |
|---|---|---|
| 1 | Membresías (`/memberships`) | `memberships` = 0 histórico |
| 2 | Constancias (`/certificates`) | `athlete_certificates` = 0 histórico |
| 3 | Plantillas de constancias (`/cards/templates/certificates`) | `school_certificate_templates` = 0 |
| 4 | Cobros y pagos v2 + Operaciones (`/payments-automation`, `/students`, `/teams`) | `charge_batches` = 0 (detrás de flag) |
| 5 | Débito automático (pestaña de Pagos) | `recurring_subscriptions` = 0 |
| 6 | Mensajes / chat (`/messages`) | `messages` = 0 histórico |
| 7 | Encuestas (`/dashboard/polls`) | `attendance_polls`: 0 en 90 d (3 históricas) |
| 8 | Disponibilidad médica (`/disponibilidad-medica`) | `clinical_patients` = 0, `athlete_injuries` = 0 |
| 9 | Solicitudes de pausa (bandeja en `/students`) | `enrollment_pause_requests` = 0 |
| 10 | Resultados (`/results-overview`) y Monitor de salida (`/pickup`) | Mock / demo, sin datos reales |

Casi sin uso: Plantillas de mensajes (1 en 90 d), Dotación (3 ítems y 4 asignaciones en 2 escuelas), Delegaciones (1 histórica), Tienda (3 pedidos), Glosas (2), Cierre de mes (5), Proveedores (4), Nómina (2).

## Método y límites

- Extractor: `scripts` temporales (no versionados) con la TypeScript compiler API. Recorre el grafo de render hasta 4 niveles desde el archivo de la ruta, excluye `components/ui`, layouts y contextos, y resuelve handlers a través de funciones locales, hooks desestructurados, `lib/api/*` (incluidas constantes `BASE`) y props `on*` del padre.
- Las lecturas y escrituras **por acción** son estáticas. Pueden faltar: datos que pasan por estado o efectos, o callbacks muy indirectos. También pueden sobrar: un handler grande que hace varias cosas se atribuye completo. Las de **pantalla** (`reads`/`writes`) suman el render y los hooks/lib importados (2 niveles).
- Las RPC se clasifican como lectura o escritura por el nombre (`get_*`, `*_kpis`, `preview_*`… = lectura).
- Las acciones condicionadas a otros roles (`role === 'coach'`, `isParent`…) se descartaron. Las condicionadas a la escuela quedan con su gate.
- `status` por acción hereda el de la pantalla cuando esta es `hidden`, `dead route`, `dead code` o `broken`, y se marca `hidden (flag VITE_COBROS_Y_PAGOS)` para todo lo que vive en el flujo «Cobros y pagos».
- El uso se mide por la tabla principal de cada módulo. Las pantallas de solo lectura (Finanzas, Reportes, Panel, Recepción, Configuración) quedan como «no medido».
