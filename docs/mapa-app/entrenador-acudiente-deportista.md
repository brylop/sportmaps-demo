# Mapa funcional — entrenador, acudiente y deportista (+ públicas, PWA y WhatsApp)

> Generado el 2026-10-10 a partir de tres extracciones del código hechas hoy (`coach.json`, `parent.json`, `athlete_public.json`), unidas en un solo archivo. El uso viene de `usage.json` (base viva `luebjarufsiadojhvxgi`, solo SELECT, ventana 90 días salvo que diga otra cosa). Es la misma base para todos los ambientes, así que incluye escuelas de prueba.

**Machine-readable:** `docs/mapa-app/entrenador-acudiente-deportista.json`. Forma: `[{role, module, moduleKey, screen, route, file, entry:{sidebar, bottomNav, other}, audience?, screenNotes?, tabs:[{name, actions:[{label, type, file, line, gates, reads, writes, status, notes, usage}]}]}]` más los campos que agrega la unión: `source` (archivo de origen), `group`, `status` (derivado de las acciones, `statusDerived: true`) y `usage` de pantalla `{tag, measures[], users?}`.

## Cómo leer

- **role**: `coach`, `personal_trainer`, `parent`, `athlete`; y `public`, `pwa`, `whatsapp` para lo que el acudiente o el deportista ven fuera del layout autenticado (`audience` dice quién lo usa).
- **Entrada**: `sidebar` (menú lateral de escritorio), `bottomNav` (barra inferior del celular) y `other` (otras vías: banners, botones, correos, notificaciones).
- **status** de acción: `works` · `partial` · `broken` · `hidden` (detrás de una condición que casi nadie cumple o sin entrada) · `dead` (sin efecto o inalcanzable) · `duplicated` (otra pantalla hace lo mismo). El estado de pantalla se **deriva** de sus acciones (todas `dead` → dead; todas rotas o muertas → broken; alguna rota o parcial → partial).
- **uso**: métricas de `usage.json` pegadas a la acción cuando la acción lee o escribe esa tabla (o llama la RPC/BFF que la alimenta), y a la pantalla por su ruta. `usado` = alguna métrica > 0 · `sin uso` = todas en 0 · `no medido` = no hay métrica que mapee. Las extracciones de origen traían `usage: null` en todas las acciones.
- **W / R**: escrituras / lecturas tal como las anotó la extracción (`tabla (detalle)`, `rpc nombre`, `BFF /api/v1/...`).

## Resumen

| Rol | Pantallas | Pestañas | Acciones | works | partial | duplicated | hidden | broken | dead | Pantallas usadas / sin uso / no medidas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| coach | 38 | 61 | 242 | 150 | 28 | 13 | 23 | 20 | 8 | 17 / 4 / 17 |
| personal_trainer | 12 | 19 | 47 | 39 | 7 | 0 | 0 | 1 | 0 | 8 / 0 / 4 |
| parent | 32 | 50 | 151 | 94 | 26 | 8 | 15 | 1 | 7 | 15 / 4 / 13 |
| athlete | 29 | 41 | 122 | 96 | 12 | 1 | 4 | 3 | 6 | 10 / 5 / 14 |
| public | 27 | 30 | 73 | 60 | 6 | 3 | 0 | 3 | 1 | 7 / 1 / 19 |
| pwa | 9 | 9 | 15 | 12 | 2 | 0 | 0 | 0 | 1 | 0 / 0 / 9 |
| whatsapp | 9 | 9 | 21 | 16 | 3 | 0 | 0 | 2 | 0 | 5 / 0 / 4 |
| **Total** | **156** | **219** | **671** | **467** | **84** | **25** | **42** | **30** | **23** | 62 / 14 / 80 |

Acciones con uso medido: 121 de 671. Usuarios (usage.json): coach: 43 perfiles · 14 con login 30 d · 28 en 90 d · personal_trainer: 12 perfiles · 0 con login 30 d · 2 en 90 d · parent: 908 perfiles · 181 con login 30 d · 871 en 90 d · athlete: 176 perfiles · 18 con login 30 d · 76 en 90 d. Menores en `children`: 1.100 (589 sin `parent_id`).

## Índice

- **Entrenador**
  - [Inicio › Panel de Entrenador (Dashboard)](#r-coach-dashboard) — `/dashboard` · coach · partial · usado · 12 acciones
  - [Cuenta › Mi Perfil](#r-coach-profile) — `/profile` · coach · partial · no medido · 6 acciones
  - [Comunicacion › Notificaciones](#r-coach-notifications) — `/notifications` · coach · partial · usado · 9 acciones
  - [Cuenta › Configuracion](#r-coach-settings) — `/settings` · coach · partial · no medido · 6 acciones
  - [Comunicacion › Mensajes](#r-coach-messages) — `/messages` · coach · dead · sin uso · 4 acciones
  - [Comunicacion › Anuncios](#r-coach-announcements) — `/announcements` · coach · broken · sin uso · 4 acciones
  - [Onboarding › Onboarding de entrenador](#r-coach-onboarding-coach) — `/onboarding/coach` · coach · partial · usado · 2 acciones
  - [Equipos › Mis Equipos](#r-coach-teams) — `/teams` · coach · partial · no medido · 13 acciones
  - [Deportistas › Mis Deportistas](#r-coach-students) — `/students` · coach · partial · usado · 16 acciones
  - [Deportistas › Subir hoja de matrícula](#r-coach-school-enrollment-intake) — `/school/enrollment-intake` · coach · works · usado · 2 acciones
  - [Comunicación › Invitaciones](#r-coach-invitations) — `/invitations` · coach · partial · no medido · 6 acciones
  - [Asistencias › Asistencias (tomar lista)](#r-coach-coach-attendance) — `/coach-attendance` · coach · partial · usado · 19 acciones
  - [Asistencias › Check-in por carnet](#r-coach-coach-attendance-scan) — `/coach-attendance/scan` · coach · works · usado · 2 acciones
  - [Asistencias › Encuestas de asistencia](#r-coach-dashboard-polls) — `/dashboard/polls` · coach · works · sin uso · 6 acciones
  - [Asistencias › Resultados de encuesta](#r-coach-dashboard-polls-pollid-results) — `/dashboard/polls/:pollId/results` · coach · works · usado · 6 acciones
  - [Resultados › Resultados](#r-coach-results) — `/results` · coach · partial · usado · 9 acciones
  - [Calendario › Mi Calendario](#r-coach-calendar) — `/calendar` · coach · works · no medido · 5 acciones
  - [Entrenamiento › Sesiones de Entrenamiento (Métricas y Rendimiento)](#r-coach-training-plans) — `/training-plans` · coach · partial · usado · 21 acciones
  - [Entrenamiento › Mis Planes y Disponibilidad](#r-coach-coach-plans) — `/coach-plans` · coach · works · usado · 9 acciones
  - [Entrenamiento › Gestión de Rutinas](#r-coach-school-routines) — `/school/routines` · coach · works · usado · 8 acciones
  - [Entrenamiento › Detalle de rutina](#r-coach-school-routines-routineid) — `/school/routines/:routineId` · coach · partial · usado · 5 acciones
  - [Dotación › Mi Dotación](#r-coach-coach-dotacion) — `/coach/dotacion` · coach · partial · usado · 7 acciones
  - [Salud › Disponibilidad médica](#r-coach-disponibilidad-medica) — `/disponibilidad-medica` · coach · works · sin uso · 2 acciones
  - [Entrenamiento › Evaluaciones](#r-coach-evaluations) — `/evaluations` · coach · partial · no medido · 3 acciones
  - [Reportes › Reportes del Equipo](#r-coach-coach-reports) — `/coach-reports` · coach · partial · usado · 8 acciones
  - [Reportes › Evaluación post-entrenamiento — informe de equipo](#r-coach-coach-reports-entreno-equipo) — `/coach-reports/entreno-equipo` · coach · partial · usado · 5 acciones
  - [Reportes › Informe Mensual](#r-coach-informe-mensual) — `/informe-mensual` · coach · partial · usado · 11 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Activar Mi Tienda (onboarding de vendedor)](#r-coach-vendor-onboarding) — `/vendor/onboarding` · coach · works · no medido · 4 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Panel Tienda](#r-coach-vendor-dashboard) — `/vendor/dashboard` · coach · partial · no medido · 7 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Servicios](#r-coach-vendor-services) — `/vendor/services` · coach · works · no medido · 4 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Agenda (citas)](#r-coach-vendor-appointments) — `/vendor/appointments` · coach · broken · no medido · 1 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Productos](#r-coach-vendor-products) — `/vendor/products` · coach · works · no medido · 5 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Pedidos e Inventario (items de menú)](#r-coach-orders-inventory) — `/orders | /inventory` · coach · broken · no medido · 2 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Inbox](#r-coach-vendor-inbox) — `/vendor/inbox` · coach · works · no medido · 4 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Liquidaciones](#r-coach-vendor-payouts) — `/vendor/payouts` · coach · works · no medido · 5 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Envíos](#r-coach-vendor-shipping) — `/vendor/shipping` · coach · works · no medido · 2 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Promociones](#r-coach-vendor-promotions) — `/vendor/promotions` · coach · dead · no medido · 1 acciones
  - [Mi Tienda / Mis Servicios (vendedor) › Suscriptores](#r-coach-vendor-subscribers) — `/vendor/subscribers` · coach · broken · no medido · 1 acciones
  - [Portal del entrenador personal › Onboarding de entrenador](#r-personal-trainer-trainer-onboarding) — `/trainer/onboarding` · personal_trainer · works · no medido · 3 acciones
  - [Portal del entrenador personal › Dashboard del entrenador](#r-personal-trainer-trainer-dashboard) — `/trainer/dashboard` · personal_trainer · partial · usado · 5 acciones
  - [Portal del entrenador personal › Mis Clientes](#r-personal-trainer-trainer-clients) — `/trainer/clients` · personal_trainer · works · usado · 5 acciones
  - [Portal del entrenador personal › Ficha del cliente](#r-personal-trainer-trainer-clients-clientid) — `/trainer/clients/:clientId` · personal_trainer · works · usado · 9 acciones
  - [Portal del entrenador personal › Mis Rutinas](#r-personal-trainer-trainer-routines) — `/trainer/routines` · personal_trainer · works · usado · 4 acciones
  - [Portal del entrenador personal › Detalle de rutina](#r-personal-trainer-trainer-routines-routineid) — `/trainer/routines/:routineId` · personal_trainer · works · usado · 5 acciones
  - [Portal del entrenador personal › Disponibilidad](#r-personal-trainer-trainer-availability) — `/trainer/availability` · personal_trainer · partial · usado · 2 acciones
  - [Portal del entrenador personal › Mis Planes](#r-personal-trainer-trainer-plans) — `/trainer/plans` · personal_trainer · partial · no medido · 3 acciones
  - [Portal del entrenador personal › Pagos](#r-personal-trainer-trainer-payments) — `/trainer/payments` · personal_trainer · partial · usado · 2 acciones
  - [Portal del entrenador personal › Mi Perfil Público (editor)](#r-personal-trainer-trainer-profile) — `/trainer/profile` · personal_trainer · works · no medido · 3 acciones
  - [Portal del entrenador personal › Perfil público del entrenador](#r-personal-trainer-entrenador-userid) — `/entrenador/:userId` · personal_trainer · works · usado · 1 acciones
  - [Compartido con otros roles › Navegación compartida (sidebar + bottom nav)](#r-personal-trainer-enrollments-mi-plan-settings-calendar-messages-profile) — `/enrollments | /mi-plan | /settings | /calendar | /messages | /profile` · personal_trainer · partial · no medido · 5 acciones
- **Acudiente**
  - [Inicio › Panel de Padre/Madre](#r-parent-dashboard) — `/dashboard` · parent · partial · usado · 22 acciones
  - [Hijos › Familia SportMaps (Mis Hijos)](#r-parent-children) — `/children` · parent · partial · usado · 11 acciones
  - [Calendario › Calendario Familiar](#r-parent-calendar) — `/calendar` · parent · partial · no medido · 5 acciones
  - [Explorar › Explorar](#r-parent-explorar) — `/explorar` · parent · hidden · no medido · 1 acciones
  - [Seguimiento › Centro de Alto Rendimiento (Progreso Deportivo)](#r-parent-academic-progress) — `/academic-progress` · parent · works · usado · 8 acciones
  - [Seguimiento › Progreso de hijo (ruta por id)](#r-parent-children-id-progress) — `/children/:id/progress` · parent · duplicated · no medido · 1 acciones
  - [Seguimiento › Registro de Asistencia](#r-parent-parent-attendance) — `/parent-attendance` · parent · works · usado · 3 acciones
  - [Seguimiento › Asistencia de hijo (ruta por id)](#r-parent-children-id-attendance) — `/children/:id/attendance` · parent · duplicated · no medido · 1 acciones
  - [Seguimiento › Informes Mensuales](#r-parent-children-id-reports) — `/children/:id/reports` · parent · works · usado · 2 acciones
  - [Seguimiento › Detalle de informe mensual](#r-parent-children-id-reports-reportid) — `/children/:id/reports/:reportId` · parent · works · usado · 3 acciones
  - [Seguimiento › Evaluación post-entrenamiento (informe grupal)](#r-parent-children-id-post-entreno-informe) — `/children/:id/post-entreno-informe` · parent · hidden · usado · 1 acciones
  - [Pagos › Mis Pagos](#r-parent-my-payments) — `/my-payments` · parent · partial · usado · 24 acciones
  - [Pagos › Estado de Cuenta](#r-parent-estado-cuenta) — `/estado-cuenta` · parent · works · no medido · 2 acciones
  - [Pagos › Checkout de padre (QR de inscripción)](#r-parent-parent-checkout) — `/parent-checkout` · parent · partial · usado · 4 acciones
  - [Pagos › Resultado de pago (Wompi)](#r-parent-payment-result) — `/payment-result` · parent · works · no medido · 2 acciones
  - [Pagos › Confirmación de pago](#r-parent-pagos-confirmacion) — `/pagos/confirmacion` · parent · duplicated · no medido · 1 acciones
  - [Tienda › Tienda (redirección)](#r-parent-mi-tienda) — `/mi-tienda` · parent · hidden · no medido · 1 acciones
  - [Tienda › Mis compras](#r-parent-mis-compras) — `/mis-compras` · parent · works · usado · 2 acciones
  - [Tienda › Detalle de compra](#r-parent-mis-compras-orderid) — `/mis-compras/:orderId` · parent · works · no medido · 5 acciones
  - [Comunicación › Mensajes](#r-parent-messages) — `/messages` · parent · broken · sin uso · 2 acciones
  - [Actividad › Portal Familiar (Mis Inscripciones)](#r-parent-enrollments) — `/enrollments` · parent · partial · usado · 11 acciones
  - [Actividad › Mis Inscripciones a Eventos](#r-parent-my-event-registrations) — `/my-event-registrations` · parent · partial · usado · 2 acciones
  - [Actividad › Inscripción a torneo de la escuela](#r-parent-tournaments-eventid-register) — `/tournaments/:eventId/register` · parent · partial · no medido · 3 acciones
  - [Salud › Mi salud (Salud de mis hijos)](#r-parent-salud) — `/salud` · parent · partial · sin uso · 6 acciones
  - [Salud › Aceptar invitación clínica](#r-parent-salud-invitacion-token) — `/salud/invitacion/:token` · parent · works · no medido · 1 acciones
  - [Salud › Mis citas](#r-parent-wellness-appointments) — `/wellness/appointments` · parent · partial · sin uso · 4 acciones
  - [Documentos › Carnets de mis hijos](#r-parent-my-cards) — `/my-cards` · parent · works · usado · 3 acciones
  - [Documentos › Mis Constancias](#r-parent-my-certificates) — `/my-certificates` · parent · partial · sin uso · 4 acciones
  - [Cuenta › Configuración](#r-parent-settings) — `/settings` · parent · partial · no medido · 5 acciones
  - [Cuenta › Mi Perfil](#r-parent-profile) — `/profile` · parent · works · no medido · 4 acciones
  - [Cuenta › Notificaciones](#r-parent-notifications) — `/notifications` · parent · works · usado · 4 acciones
  - [Cuenta › Onboarding de acudiente](#r-parent-onboarding-parent) — `/onboarding/parent` · parent · works · usado · 3 acciones
- **Deportista**
  - [Inicio › Mi Dashboard (rama atleta)](#r-athlete-dashboard) — `/dashboard` · athlete · partial · usado · 11 acciones
  - [Gestión deportiva › Mi Calendario](#r-athlete-calendar) — `/calendar` · athlete · works · no medido · 4 acciones
  - [Pagos › Mis Pagos (atleta)](#r-athlete-athlete-payments) — `/athlete-payments` · athlete · partial · usado · 9 acciones
  - [Pagos › Mis Pagos (padre) — duplicado](#r-athlete-my-payments) — `/my-payments` · athlete · duplicated · no medido · 1 acciones
  - [Pagos › Estado de cuenta](#r-athlete-estado-cuenta) — `/estado-cuenta` · athlete · works · no medido · 2 acciones
  - [Mi Rendimiento › Estadísticas](#r-athlete-stats) — `/stats` · athlete · works · no medido · 7 acciones
  - [Mi Rendimiento › Objetivos](#r-athlete-goals) — `/goals` · athlete · works · sin uso · 4 acciones
  - [Mi Rendimiento › Entrenamientos](#r-athlete-training) — `/training` · athlete · works · usado · 8 acciones
  - [Actividad deportiva › Mis Inscripciones](#r-athlete-enrollments) — `/enrollments` · athlete · partial · usado · 13 acciones
  - [Actividad deportiva › Mis Eventos](#r-athlete-my-event-registrations) — `/my-event-registrations` · athlete · partial · usado · 4 acciones
  - [Actividad deportiva › Inscripción a torneo](#r-athlete-tournaments-eventid-register) — `/tournaments/:eventId/register` · athlete · works · no medido · 3 acciones
  - [Bienestar › Mi Salud](#r-athlete-salud) — `/salud` · athlete · works · sin uso · 5 acciones
  - [Bienestar › Aceptar invitación clínica](#r-athlete-salud-invitacion-token) — `/salud/invitacion/:token` · athlete · works · no medido · 2 acciones
  - [Bienestar › Mis Citas](#r-athlete-wellness-appointments) — `/wellness/appointments` · athlete · partial · sin uso · 5 acciones
  - [Bienestar › Explorar Bienestar (en realidad: medidas corporales)](#r-athlete-wellness) — `/wellness` · athlete · partial · no medido · 2 acciones
  - [Tienda › Tienda de mi escuela](#r-athlete-mi-tienda) — `/mi-tienda` · athlete · works · no medido · 2 acciones
  - [Tienda › Mis compras](#r-athlete-mis-compras) — `/mis-compras` · athlete · works · usado · 3 acciones
  - [Tienda › Detalle de compra](#r-athlete-mis-compras-orderid) — `/mis-compras/:orderId` · athlete · works · no medido · 7 acciones
  - [Tienda › Tienda SportMaps (catálogo global legado)](#r-athlete-shop) — `/shop` · athlete · dead · no medido · 2 acciones
  - [Documentos › Mis Carnets](#r-athlete-my-cards) — `/my-cards` · athlete · works · usado · 4 acciones
  - [Documentos › Mis Constancias](#r-athlete-my-certificates) — `/my-certificates` · athlete · partial · sin uso · 4 acciones
  - [Cuenta › Mi Perfil](#r-athlete-profile) — `/profile` · athlete · partial · no medido · 5 acciones
  - [Cuenta › Configuración](#r-athlete-settings) — `/settings` · athlete · works · no medido · 5 acciones
  - [Cuenta › Notificaciones](#r-athlete-notifications) — `/notifications` · athlete · partial · usado · 2 acciones
  - [Cuenta › Mensajes](#r-athlete-messages) — `/messages` · athlete · hidden · sin uso · 1 acciones
  - [Onboarding › Onboarding del atleta](#r-athlete-onboarding-athlete) — `/onboarding/athlete` · athlete · partial · no medido · 1 acciones
  - [Evaluación post-entreno › Autoevaluación post-entreno](#r-athlete-post-entreno-sessionid) — `/post-entreno/:sessionId` · athlete · works · usado · 2 acciones
  - [Evaluación post-entreno › Resumen del día post-entreno](#r-athlete-post-entreno-sessionid-resultado) — `/post-entreno/:sessionId/resultado` · athlete · works · usado · 2 acciones
  - [Explorar › Explorar (global)](#r-athlete-explorar) — `/explorar` · athlete · partial · no medido · 2 acciones
- **Páginas públicas (vistas por acudiente/deportista)**
  - [Cobros › Pago de un cobro sin login](#r-public-p-token) — `/p/:token` · public · partial · usado · 9 acciones
  - [Documentos › Carnet público verificado](#r-public-c-qrtoken) — `/c/:qrToken` · public · works · usado · 4 acciones
  - [Documentos › Verificar constancia](#r-public-cert-folio) — `/cert/:folio` · public · works · no medido · 1 acciones
  - [Inscripción › Inscripción por QR de la escuela](#r-public-join-slug) — `/join/:slug` · public · partial · usado · 9 acciones
  - [Inscripción › Unirse a un equipo](#r-public-join-team-teamid) — `/join-team/:teamId` · public · works · no medido · 3 acciones
  - [Inscripción › Unirse a un plan](#r-public-join-plan-planid) — `/join-plan/:planId` · public · partial · no medido · 4 acciones
  - [Prospectos › Formulario de prospecto](#r-public-inscripcion-slug) — `/inscripcion/:slug` · public · works · no medido · 2 acciones
  - [Reservas › Agendar clase de prueba](#r-public-agendar-clase-slug) — `/agendar-clase/:slug` · public · works · no medido · 4 acciones
  - [Reservas › Reservar instalación](#r-public-agendar-slug) — `/agendar/:slug` · public · works · usado · 2 acciones
  - [Asistencia › Encuesta de asistencia pública](#r-public-polls-v-pollid) — `/polls/v/:pollId` · public · works · sin uso · 2 acciones
  - [Pagos › Resultado de pago (Wompi)](#r-public-payment-result) — `/payment-result` · public · works · no medido · 2 acciones
  - [Pagos › Confirmación de pago por link](#r-public-pagos-confirmacion) — `/pagos/confirmacion` · public · duplicated · no medido · 1 acciones
  - [Acceso › Registro](#r-public-register) — `/register` · public · partial · usado · 5 acciones
  - [Acceso › Iniciar sesión](#r-public-login) — `/login` · public · partial · no medido · 4 acciones
  - [Acceso › Restablecer contraseña](#r-public-reset-password) — `/reset-password` · public · works · no medido · 2 acciones
  - [Acceso › Eliminar cuenta (Google Play)](#r-public-eliminar-cuenta) — `/eliminar-cuenta` · public · works · no medido · 1 acciones
  - [Acceso › Elegir rol (OAuth)](#r-public-onboarding-role) — `/onboarding/role` · public · partial · no medido · 1 acciones
  - [Escuela pública › Perfil público de escuela (slug)](#r-public-s-slug) — `/s/:slug` · public · duplicated · no medido · 1 acciones
  - [Escuela pública › Detalle de escuela (explorador)](#r-public-schools-id) — `/schools/:id` · public · duplicated · no medido · 1 acciones
  - [Escuela pública › Perfil de escuela (legado)](#r-public-escuela-id) — `/escuela/:id` · public · dead · no medido · 1 acciones
  - [Eventos › Evento público](#r-public-event-slug) — `/event/:slug` · public · works · no medido · 2 acciones
  - [Eventos › Inscripción individual a evento](#r-public-event-eventid-register) — `/event/:eventId/register` · public · works · usado · 3 acciones
  - [Eventos › Resultados de torneo](#r-public-tournaments-eventid-results) — `/tournaments/:eventId/results` · public · works · no medido · 1 acciones
  - [Tienda › Vitrina de la tienda](#r-public-tienda-slug) — `/tienda/:slug` · public · partial · no medido · 4 acciones
  - [Tienda › Carrito](#r-public-carrito) — `/carrito` · public · works · no medido · 1 acciones
  - [Tienda › Checkout de tienda](#r-public-checkout-tienda-vendorprofileid) — `/checkout/tienda/:vendorProfileId` · public · partial · no medido · 2 acciones
  - [Entrenadores › Perfil público de entrenador](#r-public-entrenador-userid) — `/entrenador/:userId` · public · works · usado · 1 acciones
- **PWA (transversal)**
  - [PWA › Banner «Instalar {escuela}»](#r-pwa) — `*` · pwa · works · no medido · 3 acciones
  - [PWA › Banner «Actualizar ahora»](#r-pwa) — `*` · pwa · works · no medido · 2 acciones
  - [PWA › Banner «Activar notificaciones»](#r-pwa-layout-autenticado) — `(layout autenticado)` · pwa · works · no medido · 2 acciones
  - [PWA › Suscripción push legada](#r-pwa) — `-` · pwa · dead · no medido · 1 acciones
  - [PWA › Marca de la PWA (manifest por escuela)](#r-pwa-app-webmanifest-app-icon-png) — `/app.webmanifest, /app-icon.png` · pwa · works · no medido · 2 acciones
  - [PWA › Registro de dispositivo / modo de visualización](#r-pwa-layout-autenticado) — `(layout autenticado)` · pwa · works · no medido · 1 acciones
  - [PWA › Cierre de sesión por inactividad](#r-pwa) — `*` · pwa · partial · no medido · 1 acciones
  - [PWA › Service worker: push y clic en notificación](#r-pwa-url-de-la-notificaci-n) — `(url de la notificación)` · pwa · partial · no medido · 2 acciones
  - [PWA › Guardia de recarga durante el pago](#r-pwa) — `-` · pwa · works · no medido · 1 acciones
- **Entradas desde WhatsApp, correo y notificaciones**
  - [Cobranza › Pago de un cobro (/p/:token)](#r-whatsapp-p-token) — `/p/:token` · whatsapp · works · usado · 7 acciones
  - [Acceso › Registro con invitación](#r-whatsapp-register-invite-id-email) — `/register?invite={id}&email=` · whatsapp · partial · no medido · 3 acciones
  - [Acceso › Login con marca](#r-whatsapp-login-t-slug) — `/login?t={slug}` · whatsapp · works · no medido · 1 acciones
  - [Inscripción › Inscripción por QR](#r-whatsapp-join-slug) — `/join/{slug}` · whatsapp · partial · usado · 2 acciones
  - [Pagos › Mis Pagos (notificaciones / correos)](#r-whatsapp-my-payments) — `/my-payments` · whatsapp · partial · usado · 3 acciones
  - [Evaluación post-entreno › Autoevaluación post-entreno](#r-whatsapp-post-entreno-sessionid-child-id) — `/post-entreno/{sessionId}[?child_id=]` · whatsapp · works · usado · 1 acciones
  - [Asistencia › Ausencia registrada](#r-whatsapp-my-attendance) — `/my-attendance` · whatsapp · broken · no medido · 1 acciones
  - [Eventos › Torneos: inscripción / resultados](#r-whatsapp-tournaments-id-register-results) — `/tournaments/{id}/register | /results` · whatsapp · works · no medido · 2 acciones
  - [Reservas › Mis Inscripciones (reserva de clase)](#r-whatsapp-enrollments) — `/enrollments` · whatsapp · works · usado · 1 acciones

## Entrenador

### Módulo: Inicio

<a id="r-coach-dashboard"></a>
#### Panel de Entrenador (Dashboard) — `/dashboard`

- **Rol:** coach · **Entrada:** menú lateral + barra inferior · Redirect post-login; /onboarding/coach navega aqui al terminar
- **Archivo:** `pages/DashboardPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas) · Usuarios: coach: 43 perfiles · 14 con login 30 d · 28 en 90 d
- ⚠ Gate de onboarding: si profiles.onboarding_completed=false redirige a /onboarding/coach (DashboardPage.tsx:309). OpenTournamentsCard y PendingEnrollmentModal se montan pero no aplican al coach (parent/athlete). Al cargar corre RPCs que ESCRIBEN (accept_invitation_pro, claim_orphan_children) para cualquier rol. Sin datos demo. Tres accesos a asistencia en la misma pantalla.

##### Pestaña «Principal»

- [read] **Tarjetas: Deportistas Total / Equipos / Proximos Eventos / Asistencia Promedio** — `hooks/useDashboardStatsReal.ts:190` · **partial** · gates: `profile.role === 'coach'` · R: school_staff (by email -> staff id), teams.coach_id + team_coaches, school_athletes (is_active, enrolled_team_id), calendar_events (user_id = coach, start_time >= now), GET /api/v1/attendance/rate/:teamId
  - Asistencia 'Promedio general' solo usa teamIds[0] (primer equipo), no el promedio de todos (useDashboardStatsReal.ts:249). Titulo 'Deportistas Total' pero muestra solo activos. 'Proximos Eventos' cuenta solo calendar_events personales del coach (user_id), no entrenamientos/partidos del equipo. Para coach tambien corre queries de payments pendientes / school_staff count / offerings que no usa (useDashboardStatsReal.ts:128-180). BFF /rate permite coach (attendance.ts:2155).
- [navigate] **Tomar asistencia (acceso rapido)** — `pages/DashboardPage.tsx:493` · **works** · gates: `profile.role === 'coach'`
  - Duplica QuickAction 'Marcar Asistencia' y el item Asistencias > Supervision del sidebar y el bottom nav.
- [navigate] **Sesiones de entrenamiento (acceso rapido)** — `pages/DashboardPage.tsx:512` · **works** · gates: `profile.role === 'coach'`
  - Duplica item de sidebar 'Sesiones de Entrenamiento'.
- [navigate] **Acciones Rapidas: Ver Calendario / Marcar Asistencia / Registrar Resultado** — `hooks/useDashboardConfig.ts:229` · **duplicated** · gates: `dashboardRole === 'coach'`
  - Las 3 duplican sidebar; 'Marcar Asistencia' duplica el boton grande 'Tomar asistencia' de arriba. Editar acciones solo para escuela.
- [navigate] **Activar Mi Tienda (CTA)** — `components/vendor/ActivateStoreCTA.tsx:76` · **works** · gates: `ELIGIBLE_ROLES incluye coach && sin vendor_profile && !preferences.store_cta_dismissed` · R: vendor_profiles
  - Navega a /vendor/onboarding. Marketplace/tiendas NO desplegado segun memoria del proyecto: CTA lleva a un flujo no productivo para coach.
- [update] **Cerrar CTA tienda** — `components/vendor/ActivateStoreCTA.tsx:53` · **works** · gates: `ELIGIBLE_ROLES incluye coach` · W: profiles.preferences.store_cta_dismissed
- [update] **Aceptar invitacion (banner)** — `components/dashboard/InvitationBanner.tsx:114` · **works** · gates: `invitation pendiente por email && rol no escuela` · W: rpc accept_invitation_pro · R: invitations (email, status=pending) · uso: usado (invitations)
  - Ademas el dashboard auto-acepta por ?invite= o localStorage pending_invite_id (DashboardPage.tsx:130).
- [update] **Rechazar invitacion (banner)** — `components/dashboard/InvitationBanner.tsx:126` · **works** · gates: `invitation pendiente por email` · W: invitations.status='rejected' (update directo cliente) · uso: usado (invitations)
  - Toast dice 'puedes aceptarla mas tarde desde tu email' pero queda rejected.
- [navigate] **Checklist: Vincular Academia / Perfil Profesional** — `pages/DashboardPage.tsx:625` · **partial** · gates: `onboardingSteps incompletos && rol no escuela` · R: rpc get_onboarding_status
  - 'Perfil Profesional' abre CoachProfileWizard (ok). 'Vincular Academia' navega a /notifications, que NO muestra invitaciones (solo tabla notifications): el paso no se puede completar alli; la aceptacion real esta en el banner del dashboard.
- [update] **Perfil Profesional (CoachProfileWizard) - Guardar** — `components/coach/CoachProfileWizard.tsx:177` · **partial** · gates: `profile.role === 'coach' && auto-abre si !has_professional_profile` · W: storage avatars/coaches/<uid>, profiles (full_name, phone, avatar_url), coach_profiles upsert, storage coach-certificates, coach_certifications insert (uno por uno) · R: coach_profiles, coach_certifications
  - Escritura multi-tabla sin transaccion: profiles -> coach_profiles -> N inserts de certificados en loop; si falla a mitad queda parcial (viola regla RPC transaccional). Avatar va a un path distinto al de /profile y /settings (3 subidores de avatar).
- [delete] **Eliminar certificado (wizard)** — `components/coach/CoachProfileWizard.tsx:245` · **works** · gates: `profile.role === 'coach'` · W: coach_certifications delete
  - No borra el archivo en storage.
- [read] **Notificaciones recientes (lista)** — `pages/DashboardPage.tsx:692` · **duplicated** · R: notifications (user_id, limit 10 -> top 5) · uso: usado (notifications)
  - Solo lectura, sin click ni link; duplica la campana y /notifications.

### Módulo: Cuenta

<a id="r-coach-profile"></a>
#### Mi Perfil — `/profile`

- **Rol:** coach · **Entrada:** barra inferior · Sin entrada en escritorio (no esta en el sidebar del coach ni en el header). El checklist 'Perfil Profesional' apunta a /profile pero para coach abre el wizard en su lugar.
- **Archivo:** `pages/ProfilePage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Bloque 'Documentos' solo para athlete/parent. Duplica Configuracion > Perfil. Boton 'Eliminar Cuenta' muerto.

##### Pestaña «Principal»

- [read] **Informacion Personal (carga)** — `pages/ProfilePage.tsx:50` · **works** · R: profiles (AuthContext)
  - No muestra nada del perfil profesional del coach (coach_profiles, certificaciones, deporte principal).
- [toggle] **Editar Perfil** — `pages/ProfilePage.tsx:173` · **works**
- [update] **Guardar (nombre, telefono, fecha de nacimiento, foto)** — `pages/ProfilePage.tsx:183` · **duplicated** · W: profiles (updateProfile AuthContext)
  - Duplica Configuracion > Perfil (que ademas tiene bio e intereses, via rpc save_profile_settings).
- [upload] **Cambiar foto (camara)** — `pages/ProfilePage.tsx:212` · **duplicated** · gates: `isEditing` · W: storage avatars/profiles/<id>
  - Solo persiste si luego se pulsa Guardar. Tercer uploader de avatar (wizard y Settings usan otros paths).
- [read] **Estadisticas de la Cuenta (Puntos SportMaps, Nivel de Suscripcion, Miembro desde)** — `pages/ProfilePage.tsx:365` · **partial** · R: profiles.sportmaps_points, subscription_tier
  - Subscription_tier sin sentido para coach (muestra 'Gratis'); fallback hardcodeado '2025' si no hay created_at.
- [delete] **Eliminar Cuenta** — `pages/ProfilePage.tsx:402` · **broken**
  - Boton sin onClick: no hace nada.

### Módulo: Comunicacion

<a id="r-coach-notifications"></a>
#### Notificaciones — `/notifications`

- **Rol:** coach · **Entrada:** sin menú · Campana GlobalNotificationBell en header (AuthLayout.tsx:94) -> 'Ver todas las notificaciones'; checklist 'Vincular Academia'.
- **Archivo:** `pages/NotificationsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas)
- ⚠ Duplicada con la campana y con la lista del dashboard (las tres leen el mismo query limit 10). Tabs importado y sin uso. No muestra invitaciones aunque el checklist del coach manda aqui para 'Vincular Academia'.

##### Pestaña «Principal»

- [read] **Lista de notificaciones** — `hooks/useDashboardStats.ts:240` · **partial** · R: notifications (user_id, order created_at desc, limit 10) · uso: usado (notifications)
  - Limit 10: la pagina 'todas' nunca muestra mas de las ultimas 10; contadores 'Todas (n)' y 'No leidas (n)' topados a 10. Sin paginacion.
- [toggle] **Filtros: Todas / No leidas** — `pages/NotificationsPage.tsx:164` · **works**
  - Filtro en cliente sobre las 10.
- [update] **Marcar todas como leidas** — `pages/NotificationsPage.tsx:148` · **works** · gates: `unreadCount > 0` · W: notifications.read=true (user_id, read=false) · uso: usado (notifications)
- [navigate] **Abrir notificacion (tarjeta / Ver)** — `pages/NotificationsPage.tsx:210` · **works** · gates: `notification.link` · W: notifications.read=true · uso: usado (notifications)
- [update] **Marcar como leida** — `pages/NotificationsPage.tsx:252` · **works** · gates: `!read` · W: notifications.read=true · uso: usado (notifications)
  - Errores solo a console, sin toast.
- [delete] **Eliminar notificacion** — `pages/NotificationsPage.tsx:262` · **works** · W: notifications delete · uso: usado (notifications)
  - Errores silenciosos (console).
- [navigate] **Campana: abrir notificacion** — `components/GlobalNotificationBell.tsx:100` · **works** · W: notifications.read=true · R: notifications (mismo hook, limit 10) · uso: usado (notifications)
  - Badge de no leidas topado a 10.
- [update] **Campana: marcar todas leidas** — `components/GlobalNotificationBell.tsx:81` · **works** · W: notifications.read=true (sin filtro user_id; depende de RLS) · uso: usado (notifications)
  - Sin filtro user_id: si RLS de notifications fuera laxa marcaria las de otros.
- [navigate] **Campana: Ver todas las notificaciones** — `components/GlobalNotificationBell.tsx:143` · **works**

### Módulo: Cuenta

<a id="r-coach-settings"></a>
#### Configuracion — `/settings`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Comunicacion > Configuracion
- **Archivo:** `pages/SettingsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Tabs Escuela/Servicios/Marca/Metricas ocultos para coach (isSchoolAdmin, SettingsPage.tsx:53). Subtitulo dice 'la identidad de tu academia' aunque el coach no la ve. Upsell 'SportMaps Pro' comentado (SettingsPage.tsx:205-230).

##### Pestaña «Perfil»

- [read] **Carga de configuracion** — `hooks/useSettings.ts:61` · **works** · R: rpc get_my_settings
- [update] **Guardar cambios (nombre, WhatsApp, fecha nacimiento, intereses deportivos, biografia)** — `components/settings/ProfileSection.tsx:99` · **duplicated** · W: rpc save_profile_settings, profiles (AuthContext)
  - Duplica /profile (mismos campos basicos). Bio/intereses no se ven en ningun perfil del coach.
- [upload] **Cambiar foto** — `components/settings/ProfileSection.tsx:121` · **duplicated** · W: storage avatars/<id>, profiles.avatar_url
  - Tercer uploader de avatar con path distinto.

##### Pestaña «Notificaciones»

- [update] **Guardar preferencias (Email, Push, Nuevas clases y horarios, Actualizaciones de pedidos, Promociones, Avisos post-entrenamiento)** — `components/settings/NotificationsSection.tsx:35` · **partial** · W: rpc save_notification_preferences (profiles.preferences)
  - Solo push_notifications y marketing_emails se respetan (bff notification.service.ts:106-107); post_training_opt_out lo usan triggers de post-entreno (orientado a atleta). email_notifications, activity_alerts y order_updates no los lee nadie: switches decorativos.

##### Pestaña «Privacidad»

- [update] **Guardar (Perfil publico, Aparecer en busquedas, Mostrar estadisticas)** — `components/settings/PrivacySection.tsx:32` · **dead** · W: rpc save_privacy_preferences (profiles.preferences)
  - Ninguna clave (public_profile, allow_search, show_stats) se consume en frontend, BFF ni migraciones: tab decorativo.

##### Pestaña «Seguridad»

- [update] **Actualizar contrasena** — `components/settings/SecuritySection.tsx:48` · **works** · W: supabase.auth.updateUser

### Módulo: Comunicacion

<a id="r-coach-messages"></a>
#### Mensajes — `/messages`

- **Rol:** coach · **Entrada:** menú lateral + barra inferior · Bottom nav 'Chat'
- **Archivo:** `pages/MessagesPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** dead · **Uso:** sin uso — messages: 0
- ⚠ Modulo muerto pero expuesto en sidebar y en bottom nav del coach (1 de 5 slots). No hay compose. MessagesDetailPage inalcanzable. Duplica funcionalmente WhatsApp/notificaciones como canal real.

##### Pestaña «Principal»

- [read] **Lista de conversaciones** — `pages/MessagesPage.tsx:36` · **dead** · R: messages (sender_id or recipient_id = uid), profiles · uso: sin uso (messages)
  - Ningun codigo (frontend, BFF ni migraciones) inserta en messages salvo MessagesDetailPage, que es inalcanzable: la bandeja siempre esta vacia ('Sin mensajes aun').
- [read] **Buscar conversacion** — `pages/MessagesPage.tsx:155` · **dead** · gates: `hasMessages`
  - Solo visible con mensajes.
- [read] **Seleccionar conversacion** — `pages/MessagesPage.tsx:166` · **dead** · gates: `hasMessages`
  - Hilo solo lectura: no hay campo para responder ni nuevo mensaje, no marca leido.
- [create] **Enviar mensaje (MessagesDetailPage)** — `pages/MessagesDetailPage.tsx:72` · **dead** · W: messages insert · R: messages, profiles · uso: sin uso (messages)
  - Archivo huerfano: no esta importado en App.tsx ni enrutado; unica pieza capaz de escribir mensajes.

<a id="r-coach-announcements"></a>
#### Anuncios — `/announcements`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Comunicacion > Anuncios
- **Archivo:** `pages/AnnouncementsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** broken · **Uso:** sin uso — announcements: 0
- ⚠ Modulo muerto: tabla announcements sin lectores; datos demo hardcodeados (isDemoUser, demoTeams, demoAnnouncements fechados 2024). Existe feature 'announcements' en saas-plans.ts:536 ('Anuncios publicos', minTier starter) pero la ruta no tiene ModuleGate.

##### Pestaña «Principal»

- [read] **Lista de anuncios enviados** — `pages/AnnouncementsPage.tsx:83` · **dead** · R: announcements (coach_id = auth uid) + teams(name) · uso: sin uso (announcements)
  - Nadie lee la tabla announcements fuera de esta pagina (ni padres ni atletas): lo enviado no llega a nadie. Mock demoAnnouncements para emails @demo.sportmaps.com.
- [dialog] **Nuevo Anuncio (abrir dialogo)** — `pages/AnnouncementsPage.tsx:161` · **broken** · R: teams (coach_id = auth uid)
  - teams.coach_id es school_staff.id, no auth uid: la lista de equipos sale vacia para coaches reales (solo mock demoTeams para @demo).
- [toggle] **Equipo (Opcional) - 'Todos mis equipos'** — `pages/AnnouncementsPage.tsx:188` · **broken**
  - <SelectItem value=""> con @radix-ui/react-select 2.2.6 lanza error al abrir el select (value vacio no permitido).
- [create] **Enviar Anuncio** — `pages/AnnouncementsPage.tsx:236` · **broken** · W: announcements insert (coach_id, team_id, subject, message, audience) · uso: sin uso (announcements)
  - Insert no envia school_id y la tabla lo tiene NOT NULL (20260217000001_schema_refactored.sql:687) -> falla y muestra 'No se pudo enviar el anuncio'. Aunque insertara, no hay lector (dead).

### Módulo: Onboarding

<a id="r-coach-onboarding-coach"></a>
#### Onboarding de entrenador — `/onboarding/coach`

- **Rol:** coach · **Entrada:** sin menú · Redirect automatico desde /dashboard cuando profiles.onboarding_completed=false (solo cuentas nuevas)
- **Archivo:** `pages/onboarding/CoachOnboarding.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12
- ⚠ Ruta sin allowedRoles: cualquier rol con onboarding_completed=false puede abrirla y crear coach_profiles. Duplica el CoachProfileWizard que el dashboard auto-abre si !has_professional_profile.

##### Pestaña «Principal»

- [update] **Wizard Perfil Profesional (paso 1 datos, paso 2 certificaciones) - Guardar** — `pages/onboarding/CoachOnboarding.tsx:49` · **partial** · gates: `ProtectedRoute (cualquier rol autenticado) && !profile.onboarding_completed` · W: profiles, coach_profiles, coach_certifications, storage avatars, coach-certificates · R: coach_profiles, coach_certifications
  - Reusa CoachProfileWizard (mismas escrituras no transaccionales). Cerrar/Cancelar reabre el dialogo (obligatorio).
- [update] **Completar onboarding** — `pages/onboarding/CoachOnboarding.tsx:31` · **partial** · W: rpc complete_onboarding (profiles.onboarding_completed)
  - Si complete_onboarding falla igual navega a /dashboard, que vuelve a redirigir aqui (bucle hasta que el RPC funcione; error solo en console).

### Módulo: Equipos

<a id="r-coach-teams"></a>
#### Mis Equipos — `/teams`

- **Rol:** coach · **Entrada:** menú lateral + barra inferior · Sidebar 'Mis Equipos' (navigation.ts:393); bottom nav coach; tarjeta 'Equipos' del dashboard
- **Archivo:** `pages/TeamsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Sin ProtectedRoute de rol. El coach tiene teams:create/edit en lib/permissions.ts y la policy sin versionar 'Teams: manage staff' le deja crear/editar/borrar cualquier equipo de su escuela (salvo Carmel), es decir, es más permisivo de lo que se asumía. La vista 'Deportistas' expone toda la escuela. coach_hide_financial_info no se respeta en CreateTeamModal ni en EnrollTeamStudentModal. Victorias/derrotas casi siempre vacías.

##### Pestaña «Principal»

- [read] **Listado de equipos asignados** — `pages/TeamsPage.tsx:115` · **works** · gates: `ModuleGate gestion_deportiva_equipos_planes && sin ProtectedRoute de rol` · R: school_staff (id por email), teams + school_branches + team_coaches(school_staff), profiles (nombre coach fallback)
  - Trae TODOS los equipos de la escuela y filtra en memoria por school_staff.id resuelto por EMAIL o por profile.id (TeamsPage.tsx:205-218). Coach sin fila en school_staff con su email solo ve equipos con coach_id=profile.id.
- [read] **Tarjeta 'Deportistas' (vista con deportistas)** — `pages/TeamsPage.tsx:266` · **partial** · gates: `statusFilter=with_students` · R: school_athletes (studentsAPI.getSchoolView sin filtro de equipo)
  - Fuga de alcance: lista TODOS los atletas de la escuela con nombre/teléfono/correo del acudiente (TeamsPage.tsx:266-270, 607-680), no solo los de los equipos del coach; /students sí filtra. Además el badge siempre dice 'Activo' fijo.
- [toggle] **Victorias / % Victoria (filtros)** — `pages/TeamsPage.tsx:446` · **partial** · R: teams.wins/losses
  - Depende de teams.wins/losses, que casi nunca se llenan; normalmente muestra 0.
- [toggle] **Buscar / Limpiar Filtros / Actualizar / Archivados / Tabla-Cuadrícula** — `pages/TeamsPage.tsx:420` · **works**
- [create] **Nuevo Equipo / Crear Primer Equipo** — `components/teams/CreateTeamModal.tsx:439` · **works** · gates: `PermissionGate teams:create (coach SÍ lo tiene en lib/permissions.ts:95) && RLS teams 'Teams: manage staff' (sin versionar, user_staff_school_ids) + is_scoped_c` · W: teams insert, team_coaches, team_branches · R: school_staff, school_branches
  - Según mig 20260831191515 cualquier coach puede crear/editar/borrar CUALQUIER equipo de su escuela (policy sin versionar); solo Carmel queda acotado. Más permisivo de lo que se cree (el brief asumía que falla por RLS). Si el coach no se asigna a sí mismo, el equipo creado no le aparece en la lista. El modal muestra 'Precio Mensual' aunque coach_hide_financial_info esté activo.
- [update] **Editar Equipo (lápiz) / 'Gestionar / Editar' (cuadrícula)** — `pages/TeamsPage.tsx:789` · **works** · gates: `PermissionGate teams:edit (solo en tabla; el botón 'Gestionar / Editar' de la cuadrícula, línea 924, NO tiene gate) && RLS teams manage staff` · W: teams update, team_coaches delete+insert, team_branches delete+insert · R: team_coaches, team_branches
  - El coach puede reasignar entrenadores de cualquier equipo (salvo Carmel). Edita precio mensual aunque coach_hide_financial_info. Sync de coaches/sedes = deletes+inserts sueltos sin transacción (CreateTeamModal.tsx:309-350).
- [create] **Gestionar Deportistas (inscribir)** — `components/teams/EnrollTeamStudentModal.tsx:198` · **works** · gates: `BFF requireRole incluye coach (enrollments.ts:92) && coach_can_enroll_paid_teams=false -> 403 si el equipo cobra (enrollments.ts:171-193) && coach no puede asig` · W: POST /api/v1/enrollments · R: school_athletes (toda la escuela), enrollments, teams.price_monthly
  - Muestra la mensualidad del equipo aunque coach_hide_financial_info esté activo (EnrollTeamStudentModal.tsx:388).
- [update] **Mover de equipo (conflicto)** — `components/teams/EnrollTeamStudentModal.tsx:245` · **partial** · gates: `BFF PUT /students/:id: coach solo con coach_can_create_athletes o coach_can_edit_categories (students.ts:668-676)` · W: PUT /api/v1/students/:id
  - Sin ninguno de los dos flags, el BFF rechaza al coach; el botón se ofrece igual.
- [delete] **Quitar del equipo** — `components/teams/EnrollTeamStudentModal.tsx:286` · **broken** · gates: `RLS enrollments solo owner/admin` · W: enrollments update status=cancelled · R: enrollments
  - Update directo a Supabase; RLS solo deja a owner/admin (comentario en EnrollTeamStudentModal.tsx:296-300). Para el coach siempre falla (ahora con toast de error).
- [update] **Archivar / Reactivar** — `pages/TeamsPage.tsx:288` · **works** · gates: `PermissionGate teams:edit && RLS teams manage staff` · W: teams update status
  - El coach archiva cualquier equipo que vea (salvo Carmel).
- [delete] **Eliminar permanente** — `pages/TeamsPage.tsx:325` · **works** · gates: `PermissionGate teams:edit (no teams:delete, que el coach no tiene) && RLS teams manage staff` · W: teams delete · R: enrollments count, children count
  - El gate de UI usa teams:edit en lugar de teams:delete (TeamsPage.tsx:807): el coach ve 'Eliminar permanente' y la RLS sin versionar se lo permite si el equipo está vacío.
- [dialog] **Cobrar a este equipo** — `pages/TeamsPage.tsx:380` · **hidden** · gates: `isCobrosYPagosEnabled && canManageCharges(role) excluye coach`
- [link] **Invitar padres (WhatsApp / Copiar link /join-team)** — `pages/TeamsPage.tsx:938` · **works** · gates: `solo vista cuadrícula`
  - Solo en cuadrícula; no existe en la vista tabla (default).

### Módulo: Deportistas

<a id="r-coach-students"></a>
#### Mis Deportistas — `/students`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar 'Mis Deportistas' (navigation.ts:402)
- **Archivo:** `pages/SchoolStudentsManagementPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas)
- ⚠ El alcance del coach se resuelve con el school_staff por email (frágil). Ocultamientos correctos: CSV, pagos, inactivar y pausa. Rotos para el coach: Invitar (individual y masivo) y Ver estado de cuenta. 'Mis Deportistas' en el menú vs. título 'Atletas'. La vista 'Deportistas' de /teams duplica el listado, pero sin filtrar por equipos.

##### Pestaña «Activos / Inactivos / Todos»

- [read] **Listado de atletas de mis equipos** — `pages/SchoolStudentsManagementPage.tsx:603` · **partial** · gates: `ProtectedRoute incluye coach && sin ModuleGate` · R: school_staff (id por email), teams.coach_id, team_coaches, school_athletes in enrolled_team_id, unregistered_athletes (acudiente)
  - Filtra por enrolled_team_id (equipo principal): los atletas en un 2º equipo del coach (allow_secondary_team_enrollment) no aparecen. Si el coach no tiene fila en school_staff con su email, coachId queda undefined y carga TODA la escuela (línea 623-624).
- [toggle] **Tarjetas de estado de pago (filtro)** — `pages/SchoolStudentsManagementPage.tsx:1495` · **works** · gates: `!coach_hide_financial_info` · R: payments pending/overdue/partial de toda la escuela · uso: usado (payments)
  - Oculto con coach_hide_financial_info (Besser).
- [read] **Banco de horas (saldo)** — `pages/SchoolStudentsManagementPage.tsx:1157` · **works** · gates: `BFF requireRole incluye coach (access-api.ts:889)` · R: GET /api/v1/access/hour-bank-balances
  - Solo aparece en escuelas con banco de horas.
- [read] **Actualizar** — `pages/SchoolStudentsManagementPage.tsx:1386` · **works** · gates: `visible solo si coach tiene algún flag (create/edit/upload)`
  - Un coach sin flags no ve ningún botón del encabezado.
- [upload] **Importar CSV** — `pages/SchoolStudentsManagementPage.tsx:1391` · **hidden** · gates: `canManageStudents (role !== coach)`
- [navigate] **Subir hoja de matrícula** — `pages/SchoolStudentsManagementPage.tsx:1398` · **works** · gates: `coach_can_upload_enrollment_forms`
  - Única entrada del coach a /school/enrollment-intake.
- [create] **Agregar Atleta (menor / adulto)** — `components/students/CreateChildModal.tsx:356` · **works** · gates: `coach_can_create_athletes && BFF students-create-one: coach solo con el flag + audit_logs` · W: POST /api/v1/students/create-one · R: GET /api/v1/trainer/search-profile
  - Oculto si la escuela no activó coach_can_create_athletes. canWaiveFees=false para el coach.
- [create] **Seleccionar + Invitar (masivo)** — `pages/SchoolStudentsManagementPage.tsx:1515` · **broken** · gates: `ninguno en UI (checkbox visible para coach) && RPC create_invitation resuelve escuela solo para owner/admin && BFF /invitations/bulk-send requireRole owner/admi` · W: rpc create_invitation, POST /api/v1/invitations/bulk-send
  - Para el coach el RPC lanza 'No se encontró una escuela administrada por ti.' y el bulk-send da 403 (invitations.routes.ts:97). Los checkboxes y el botón se muestran igual.

##### Pestaña «Acciones por atleta (menú ⋯ y fila)»

- [dialog] **Ver Perfil** — `pages/SchoolStudentsManagementPage.tsx:2249` · **works** · gates: `Mensualidad y deuda ocultas con coach_hide_financial_info` · R: children (talla, sangre, EPS), athlete_documents / storage identity-documents, enrollments
  - Documentos: el coach solo descarga; subir documentos es solo para canManageStudents.
- [upload] **Subir documento (perfil)** — `pages/SchoolStudentsManagementPage.tsx:2559` · **hidden** · gates: `canManageStudents` · W: identity-documents, athlete_documents
- [update] **Editar deportista** — `pages/SchoolStudentsManagementPage.tsx:767` · **works** · gates: `coach_can_create_athletes (edición completa) o coach_can_edit_categories (solo categoría/equipo) && BFF PUT /students/:id con guard por flags + audit COACH_EDIT` · W: PUT /api/v1/students/:id
  - Coach solo-categoría (Besser) no ve cuota ni plan.
- [dialog] **Cobros y pagos / Registrar pago** — `pages/SchoolStudentsManagementPage.tsx:1328` · **hidden** · gates: `canRegisterPayments = no coach`
- [update] **Inactivar / Reactivar; Vacaciones / pausa** — `pages/SchoolStudentsManagementPage.tsx:1333` · **hidden** · gates: `canManageStudents`
- [navigate] **Invitar / Invitar acudiente (menú y botón 'Invitar' de la fila)** — `pages/SchoolStudentsManagementPage.tsx:1355` · **broken** · gates: `sin gate`
  - Lleva a /invitations con el formulario precargado, pero create_invitation rechaza al coach (ver /invitations). También en la fila de escritorio, línea 1742.
- [navigate] **Ver estado de cuenta** — `pages/SchoolStudentsManagementPage.tsx:1358` · **broken** · gates: `sin gate en UI && Ruta /estado-cuenta NO incluye coach (App.tsx:511)`
  - ProtectedRoute bloquea al coach; además contradice coach_hide_financial_info (no está gateado por hideFinancials).
- [dialog] **Equipo de agendamiento** — `pages/SchoolStudentsManagementPage.tsx:1364` · **partial** · gates: `teamSchedulingEnabled && inscripción con offering_plan_id` · W: enrollments (AssignSchedulingTeamModal)
  - Piloto; se le muestra al coach sin gate de rol, y probablemente lo bloquea la RLS de enrollments (solo admin).

<a id="r-coach-school-enrollment-intake"></a>
#### Subir hoja de matrícula — `/school/enrollment-intake`

- **Rol:** coach · **Entrada:** sin menú · Botón 'Subir hoja de matrícula' en /students (SchoolStudentsManagementPage.tsx:1398), solo con coach_can_upload_enrollment_forms; el ítem de menú 'Matrículas por revisar' es solo del menú de escuela (navigation.ts:449/696)
- **Archivo:** `pages/school/EnrollmentIntakeInboxPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — enrollment_form_intake 90 d: app por escuela 10 · WhatsApp 4 · por coach 0
- ⚠ Funciona tal como está diseñado. Una sola entrada para el coach (botón en /students). No le confirma qué subió antes ni el estado de revisión (no hay feedback después del toast).

##### Pestaña «Principal (modo coach)»

- [upload] **Subir hoja de matrícula (foto/PDF, cámara)** — `pages/school/EnrollmentIntakeInboxPage.tsx:440` · **works** · gates: `ProtectedRoute incluye coach && ModuleGate deportistas_matriculas_por_revisar (apagado en Carmel y GYM RM) && coach_can_upload_enrollment_forms (UI y BFF enroll` · W: POST /api/v1/enrollment-intake/upload (OCR, queda en la bandeja de la escuela)
  - Sin el flag ve un aviso: 'Tu escuela no tiene habilitado…'. El coach no ve la bandeja ni lo que subió; no hay historial de sus envíos.
- [update] **Bandeja: crear atleta / vincular / descartar** — `pages/school/EnrollmentIntakeInboxPage.tsx:335` · **hidden** · gates: `esCoach -> no se carga la lista (línea 467)` · R: GET /api/v1/enrollment-intake
  - Solo admin.

### Módulo: Comunicación

<a id="r-coach-invitations"></a>
#### Invitaciones — `/invitations`

- **Rol:** coach · **Entrada:** sin menú · No está en el menú del coach. Solo se llega por 'Invitar' en /students (SchoolStudentsManagementPage.tsx:1355, 1742) o por deep link; routePermissions.ts:113 y App.tsx:680 permiten coach
- **Archivo:** `pages/InvitationsManagementPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Pantalla de admin que se le abrió al coach por la ruta, sin soporte en datos: la RLS de invitations es solo de admin, create_invitation exige admin y el BFF también. El coach no la tiene en el menú y la entrada desde /students termina en error. Hay que decidir: o se saca 'coach' de la ruta y se ocultan los botones 'Invitar' de /students para el coach, o se le da una vía acotada (invitar acudiente de sus equipos). La UI ofrece roles administrativos sin filtro por rol.

##### Pestaña «Principal»

- [read] **Listado 'Invitaciones enviadas' + estadísticas** — `pages/InvitationsManagementPage.tsx:251` · **broken** · gates: `RLS invitations 'manage staff' = user_admin_school_ids() (mig 20260814184457)` · W: invitations update (autocompletar team/plan/fee, línea 355) · R: invitations, profiles, payments
  - La RLS es solo de admin: el coach ve la lista vacía. El auto-parcheo de invitations dentro del queryFn también fallaría (escribe en BD durante una lectura).
- [create] **Estado de envío (banner) / 'Enviar a los que faltan' / 'Reenviar a todas'** — `pages/InvitationsManagementPage.tsx:867` · **hidden** · gates: `BFF send-status y bulk-send requireRole owner/admin/school_admin` · W: POST /api/v1/invitations/bulk-send · R: GET /api/v1/invitations/send-status
  - send-status da 403 al coach, así que el banner no se pinta (aun así se dispara la petición).
- [create] **Nueva Invitación (Acudiente / Entrenador / Atleta 18+ / Administrador / Súper Usuario / Contador / Referencia)** — `pages/InvitationsManagementPage.tsx:926` · **broken** · gates: `sin gate de rol en UI && RPC create_invitation solo resuelve escuela para owner/admin/school_admin` · W: rpc create_invitation, edge function send-email · R: teams, offering_plans, children/school_members (sugerencias)
  - El coach falla con 'No se encontró una escuela administrada por ti.' (20260730000003:70). Riesgo de diseño: la UI le ofrece invitar como Administrador/Contador/Súper Usuario (líneas 1140-1148); hoy lo frena solo el RPC.
- [create] **Referencia (crear referido de escuela)** — `pages/InvitationsManagementPage.tsx:666` · **partial** · gates: `sin gate en UI` · W: rpc create_school_referral
  - create_school_referral no está definida en ninguna migración (deriva sin versionar); no se sabe si acepta al coach. sendReferralWhatsApp y getReferralStatusBadge (686-700) son código muerto: no hay lista de referidos.
- [update] **Editar equipo/plan/mensualidad** — `pages/InvitationsManagementPage.tsx:1038` · **broken** · gates: `!coach_hide_financial_info && RLS invitations admin` · W: invitations update
  - RLS de admin; además la lista llega vacía.
- [link] **Copiar link / Enviar por WhatsApp / Reenviar email / Cancelar invitación** — `pages/InvitationsManagementPage.tsx:1047` · **broken** · gates: `RLS invitations admin (cancelar)` · W: invitations update status=cancelled, functions/v1/send-email
  - Sin filas visibles para el coach no hay sobre qué actuar. Reenviar email es fetch sin revisar la respuesta: siempre muestra éxito (líneas 455-476).

### Módulo: Asistencias

<a id="r-coach-coach-attendance"></a>
#### Asistencias (tomar lista) — `/coach-attendance`

- **Rol:** coach · **Entrada:** menú lateral + barra inferior · Sidebar Gestión > Asistencias > 'Supervisión' (navigation.ts:418); bottom nav 'Asistencias' (MobileBottomNav.tsx:35); botón grande del Dashboard coach (DashboardPage.tsx:493); QuickAction 'Marcar Asistencia' (useDashboardConfig.ts:230); back desde /coach-attendance/scan
- **Archivo:** `pages/CoachAttendancePage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1 ¦ attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)
- ⚠ Sin gate de ruta en App.tsx:569 (routePermissions.ts:94 declara allowedRoles coach + calendar:edit pero ese archivo no se aplica en ningún lado). La pantalla NO tiene pestañas, ni historial, ni exportación ni QR propio de sesión: es solo 'tomar lista' (el historial /history del BFF es solo admin, attendance.ts:2256). Etiqueta del sidebar 'Supervisión' no corresponde a lo que hace la pantalla ('Asistencias — Toma lista rápidamente'). Sección PT (Reservas del día, No asistió, cancelar) es código del entrenador personal inalcanzable para coach. 'Planes' lista todas las offerings de la escuela aunque el BFF solo deja las asignadas. Comentario de relleno en línea ~1484 ('omitted for brevity in this replace, user provided full file').

##### Pestaña «Selección (equipos / planes / clases de hoy)»

- [read] **Equipos Regulares (lista de equipos asignados)** — `pages/CoachAttendancePage.tsx:354` · **works** · gates: `role coach: filtra teams.coach_id o team_coaches = auth.uid / school_staff.id && AvisoFichaStaff si no hay ficha de staff` · R: teams, team_coaches, school_staff (useCoachStaffId)
  - No filtra teams.status/active: equipos inactivos asignados también aparecen.
- [navigate] **Elegir equipo (tarjeta)** — `pages/CoachAttendancePage.tsx:963` · **works** · W: localStorage sm_last_team_weekday_<dow> · R: GET /api/v1/attendance/roster/team/:id, GET /api/v1/attendance/session/:teamId?date= · uso: usado (attendance_records)
- [navigate] **Planes (elegir plan/offering)** — `pages/CoachAttendancePage.tsx:1015` · **partial** · gates: `school_settings.coach_attendance_teams_only = false (oculto en Dynasty)` · R: offerings (TODOS los activos de la escuela), GET /api/v1/attendance/roster/offering/:id · uso: usado (attendance_records)
  - Lista todos los planes de la escuela sin filtrar por offering_coaches; el BFF (assertCoachHasOfferingAccess, bff/src/routes/attendance.ts:58/967) devuelve 403 'No tienes ese plan asignado' para los no asignados -> 'Error cargando roster'.
- [navigate] **Clases Reservadas Hoy (sesiones de plan)** — `pages/CoachAttendancePage.tsx:1203` · **works** · gates: `prop showPlanSessions (true por defecto) && attendance_sessions.coach_id = staffId` · R: attendance_sessions (offering_id not null, hoy, no finalizadas) · uso: usado (attendance_sessions)
- [toggle] **Auto-selección ('Detectamos tu clase/equipo de hoy' / 'Sugerido') + 'No es esta, cambiar'** — `pages/CoachAttendancePage.tsx:462` · **works** · gates: `solo fecha de hoy && una vez por carga` · R: localStorage sm_last_team_weekday_<dow>
- [update] **Reservas del día (PT Sessions): Asistió / No asistió / Cancelar sesión** — `pages/CoachAttendancePage.tsx:1112` · **hidden** · gates: `requireTrainerAuth (solo personal_trainer) en bff/src/index.ts:475` · W: PATCH /api/v1/trainer/availability/session/:id/attendance, PATCH /api/v1/trainer/availability/session/:id/no-show, DELETE /api/v1/trainer/availability/session/:id · R: GET /api/v1/trainer/availability/schedule
  - Para coach el BFF responde 403 (requireTrainerAuth exige profiles.role=personal_trainer o escuela personal_trainer propia); el fetch devuelve null en silencio y la sección nunca aparece. Código muerto para coach (heredado del flujo de entrenador personal).
- [dialog] **Dialog 'No asistió' (devolver crédito / descontar)** — `pages/CoachAttendancePage.tsx:1574` · **hidden** · gates: `solo personal_trainer (ver arriba)` · W: PATCH /api/v1/trainer/availability/session/:id/no-show
  - Inalcanzable para coach.

##### Pestaña «Lista del equipo/plan/sesión»

- [read] **Roster unificado (atletas + reservas, plan, pago, aviso de ausencia, disponibilidad médica)** — `pages/CoachAttendancePage.tsx:519` · **works** · gates: `requireRole coach (bff/src/routes/attendance.ts:950) && assertCoachHasTeamAccess / OfferingAccess && school_settings.coach_hide_financial_info oculta precio y b` · R: GET /api/v1/attendance/roster/:contextType/:contextId, GET /api/v1/attendance/session/:teamId, attendance_sessions + attendance_records (sesión/plan, directo Supabase), useSchoolAthleteAvailability · uso: usado (attendance_records, attendance_sessions)
  - Arranca con TODOS presentes (asistencia por excepción) y excusados quienes avisaron ausencia.
- [navigate] **Volver a la selección** — `pages/CoachAttendancePage.tsx:1230` · **works**
- [toggle] **Día de la lista (fecha retroactiva) / Volver a hoy** — `pages/CoachAttendancePage.tsx:1312` · **partial** · gates: `school_settings.coach_attendance_retro_days (default 7) para coach && BFF revalida`
  - Solo aplica a equipos. En 'Plan' (offering) la sesión se busca siempre con la fecha de hoy (línea ~558) y el guardado por walk-in no envía date: elegir otro día guarda en hoy sin avisar. En 'sesión de plan' el selector se muestra pero la sesión es fija.
- [toggle] **Marcar estado por atleta (Presente / Ausente / Tarde / Excusado)** — `pages/CoachAttendancePage.tsx:1437` · **works** · gates: `no finalizada`
  - Solo estado local hasta 'Guardar asistencia'.
- [toggle] **Clase secundaria (switch)** — `pages/CoachAttendancePage.tsx:1284` · **works**
  - Cambia el descuento a sesiones secundarias del plan.
- [toggle] **Todos presentes** — `pages/CoachAttendancePage.tsx:1292` · **duplicated** · gates: `no finalizada`
  - La lista ya arranca con todos presentes (preset por excepción); el botón solo sirve tras editar.
- [create] **Guardar asistencia** — `pages/CoachAttendancePage.tsx:1470` · **works** · gates: `requireRole coach (attendance.ts:1391 / 1617) && retro_days` · W: POST /api/v1/attendance/session (equipo/sesión, lote único) -> attendance_sessions, attendance_records, descuento de créditos, POST /api/v1/attendance/walk-in (plan: 1 request por atleta) · uso: usado (attendance_records)
  - En planes sigue siendo N requests y los atletas sin enrollment no se registran.
- [update] **Finalizar sesión (+ dialog 'Sí, finalizar')** — `pages/CoachAttendancePage.tsx:1474` · **works** · gates: `sesión existente y no finalizada && requireRole coach (attendance.ts:2105)` · W: PATCH /api/v1/attendance/session/:id/finalize · uso: usado (attendance_records)
  - Dispara trigger post_training_notify_on_finalize y abre el dialog de calificación.
- [update] **Califica el entreno de hoy (dialog post-entreno)** — `components/attendance/CoachPostTrainingRatingDialog.tsx:78` · **works** · gates: `tras finalizar` · W: rpc submit_post_training_coach_rating · R: rpc get_post_training_pending_roster · uso: usado (performance_entries)
- [update] **Reabrir para corregir** — `pages/CoachAttendancePage.tsx:1266` · **works** · gates: `sesión finalizada && requireRole coach (attendance.ts:2054)` · W: PATCH /api/v1/attendance/session/:id/reopen · uso: usado (attendance_records)
- [create] **Walk-in — Registro en Recepción (dialog: buscar y Registrar)** — `pages/CoachAttendancePage.tsx:857` · **partial** · gates: `no finalizada && atleta con enrollment_id` · W: POST /api/v1/attendance/walk-in · R: roster ya cargado (combinedRoster)
  - Busca solo dentro del mismo roster que ya está en pantalla (duplica marcar Presente + Guardar). En contexto 'Plan' no envía offeringId -> BFF 400 'teamId, sessionId, offeringId ... son requeridos' (attendance.ts:1627): roto en planes. No envía date: en lista retroactiva registra hoy.
- [navigate] **Escanear carnet (botón cabecera)** — `pages/CoachAttendancePage.tsx:927` · **works**
  - Lleva a /coach-attendance/scan.

<a id="r-coach-coach-attendance-scan"></a>
#### Check-in por carnet — `/coach-attendance/scan`

- **Rol:** coach · **Entrada:** sin menú · Botón 'Escanear carnet' en /coach-attendance (CoachAttendancePage.tsx:927)
- **Archivo:** `pages/CoachCheckInScanPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_id_cards: 499 activos · 0 impresos · 4 escuelas ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1
- ⚠ Sin gate de ruta (App.tsx:570). Carnets impresos/emitidos son pocos (memoria: 10/1.323), así que el uso real depende de athlete_id_cards emitidos. Sin historial de escaneos en pantalla.

##### Pestaña «Principal»

- [scan] **Escanear carnet** — `pages/CoachCheckInScanPage.tsx:54` · **works** · gates: `requireRole coach (bff/src/routes/attendance.ts:892) && x-school-id activo` · W: POST /api/v1/attendance/checkin-by-card -> checkInPresenceFromEvent (attendance_sessions/attendance_records, check_in_method qr) · R: athlete_id_cards (por qr_token), enrollments activos con team_id · uso: usado (athlete_id_cards)
  - No restringe a equipos del coach: cualquier carnet de la escuela marca presente en su equipo (más reciente). Contador 'escaneados hoy' es solo estado local (se pierde al salir). Depende de @capacitor/barcode-scanner (web: html5-qrcode).
- [navigate] **Volver (flecha)** — `pages/CoachCheckInScanPage.tsx:83` · **works**

<a id="r-coach-dashboard-polls"></a>
#### Encuestas de asistencia — `/dashboard/polls`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Gestión > Asistencias > Encuestas (navigation.ts:419)
- **Archivo:** `pages/polls/PollsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** sin uso — attendance_polls 90 d: 0 (3 históricas)
- ⚠ Para coach es solo lectura: todas las acciones están gateadas por isAdmin en la UI aunque el BFF las permite al coach (inconsistencia UI/BFF). Sin gate de ruta (routePermissions.ts:104 no se aplica).

##### Pestaña «Principal»

- [read] **Lista de encuestas (título, fecha, Abierta/Cerrada, clases con '· N van')** — `pages/polls/PollsPage.tsx:24` · **works** · gates: `requireRole coach (bff/src/routes/polls.ts:8)` · R: GET /api/v1/polls -> attendance_polls + attendance_sessions · uso: sin uso (attendance_polls)
  - Muestra todas las encuestas de la escuela, no solo las del coach.
- [navigate] **Abrir encuesta (tarjeta)** — `pages/polls/PollsPage.tsx:76` · **works**
- [create] **Nueva encuesta / Crear el primero** — `pages/polls/PollsPage.tsx:49` · **hidden** · gates: `UI isAdmin = owner\|admin\|school_admin (excluye coach)` · W: POST /api/v1/polls · uso: sin uso (attendance_polls)
  - El BFF sí permite a coach crear (polls.ts:9) pero la UI lo oculta; la descripción dice 'Crea la encuesta del día y compártela por WhatsApp' y el coach no puede. Vacío: 'No hay encuestas creadas aún' sin acción.
- [link] **Copiar link** — `pages/polls/PollsPage.tsx:118` · **hidden** · gates: `UI isAdmin (excluye coach)`
  - Copia /polls/v/:id; no visible para coach.
- [update] **Cerrar** — `pages/polls/PollsPage.tsx:128` · **hidden** · gates: `UI isAdmin (excluye coach)` · W: PATCH /api/v1/polls/:id/close · uso: sin uso (attendance_polls)
  - BFF lo permite a coach.
- [delete] **Eliminar (¿Eliminar encuesta?)** — `pages/polls/PollsPage.tsx:139` · **hidden** · gates: `UI isAdmin (excluye coach)` · W: DELETE /api/v1/polls/:id · uso: sin uso (attendance_polls)

<a id="r-coach-dashboard-polls-pollid-results"></a>
#### Resultados de encuesta — `/dashboard/polls/:pollId/results`

- **Rol:** coach · **Entrada:** sin menú · Tarjeta de encuesta en /dashboard/polls (PollsPage.tsx:76)
- **Archivo:** `pages/polls/PollResultsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — attendance_polls 90 d: 0 (3 históricas) ¦ attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ session_bookings 90 d: atleta 17 · sin usuario 28
- ⚠ Solo lectura para coach. Las confirmaciones de encuesta (session_bookings) no se cruzan con la lista de /coach-attendance salvo vía roster.bookings.

##### Pestaña «Principal»

- [read] **Confirmados por clase (N confirmados, ocupación, plan/teléfono, hora)** — `pages/polls/PollResultsPage.tsx:26` · **works** · gates: `requireRole coach (polls.ts:10)` · R: GET /api/v1/polls/:id/results -> attendance_polls, attendance_sessions, session_bookings · uso: usado (attendance_polls, attendance_sessions, session_bookings)
  - Capacidad cae a 20 si max_capacity es null.
- [navigate] **Volver** — `pages/polls/PollResultsPage.tsx:57` · **works**
- [link] **Compartir** — `pages/polls/PollResultsPage.tsx:77` · **hidden** · gates: `UI isAdmin (excluye coach)`
- [update] **Cerrar** — `pages/polls/PollResultsPage.tsx:82` · **hidden** · gates: `UI isAdmin (excluye coach)` · W: PATCH /api/v1/polls/:id/close · uso: sin uso (attendance_polls)
- [create] **Agregar manualmente** — `pages/polls/PollResultsPage.tsx:179` · **hidden** · gates: `UI isAdmin (excluye coach)` · W: POST /api/v1/polls/:id/sessions/:sid/confirmations · uso: sin uso (attendance_polls)
  - BFF lo permite a coach (polls.ts:15).
- [delete] **Eliminar confirmación (papelera)** — `pages/polls/PollResultsPage.tsx:164` · **hidden** · gates: `UI isAdmin (excluye coach)` · W: DELETE /api/v1/polls/:id/sessions/:sid/confirmations/:bid · uso: sin uso (attendance_polls)

### Módulo: Resultados

<a id="r-coach-results"></a>
#### Resultados — `/results`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Gestión > Resultados (navigation.ts:422); QuickAction 'Registrar Resultado' del dashboard (useDashboardConfig.ts:231)
- **Archivo:** `pages/ResultsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — match_results 90 d: 34 (4 escuelas)
- ⚠ Sin gate de ruta (App.tsx:576). Dos modelos de resultados en la misma pantalla (match_results directo a Supabase vs competition_results por BFF) con reglas de borrado opuestas para el coach. Lookup de staff por email distinto al resto de pantallas coach. Sidebar del admin apunta a /results-overview (otra pantalla).

##### Pestaña «Principal»

- [read] **Selecciona tu equipo** — `pages/ResultsPage.tsx:62` · **partial** · gates: `role coach: teams.coach_id o team_coaches = school_staff.id` · R: school_staff (por email, sin school_id, .single()), teams (status active), team_coaches
  - El staffId se busca por email sin filtrar escuela y con .single(): un coach con ficha en 2+ escuelas obtiene error -> staffId null -> 'sin equipos'. No usa coach_auth_id ni compara contra auth.uid() (a diferencia de Asistencias/Calendario): equipos con teams.coach_id = auth.uid no aparecen.
- [read] **Historial de Partidos + estadísticas (G/E/P)** — `pages/ResultsPage.tsx:137` · **works** · gates: `deporte sin uses_sets_scoring` · R: match_results, sports_categories.uses_sets_scoring · uso: usado (match_results)
- [create] **Registrar Resultado (partido)** — `components/coach/MatchResultFormDialog.tsx:278` · **works** · gates: `equipo seleccionado && RLS match_results insert incluye coach` · W: match_results (insert directo Supabase, ResultsPage.tsx:151) · uso: usado (match_results)
- [update] **Editar resultado (lápiz)** — `pages/ResultsPage.tsx:371` · **works** · gates: `EDIT_RESULTS_ROLES incluye coach` · W: match_results (update) · uso: usado (match_results)
- [delete] **Eliminar resultado** — `pages/ResultsPage.tsx:380` · **hidden** · gates: `DELETE_RESULTS_ROLES excluye coach (RLS match_results_delete)` · W: match_results (delete)
  - Inconsistente: en deportes por sets el coach SÍ puede borrar (CompetitionResultsList).
- [read] **Resultados por sets (CompetitionResultsList)** — `components/coach/CompetitionResultsList.tsx:53` · **works** · gates: `deporte con uses_sets_scoring && BFF STAFF_ROLES incluye coach` · R: GET /api/v1/school/competition-results?team_id=
- [create] **Registrar Resultado (competencia por sets: Preparatorio / Competencia Oficial, sets)** — `components/coach/CompetitionResultFormDialog.tsx:280` · **works** · gates: `deporte con uses_sets_scoring` · W: POST /api/v1/school/competition-results
- [delete] **Eliminar resultado por sets (papelera)** — `components/coach/CompetitionResultsList.tsx:93` · **works** · gates: `sin gate en UI && BFF STAFF_ROLES incluye coach (bff/src/routes/school/competition-results.ts:325)` · W: DELETE /api/v1/school/competition-results/:id
  - Sin confirmación; borra al primer clic. Política distinta a match_results (coach no puede borrar ahí).
- [create] **Ascensos por puntaje: Registrar puntaje individual** — `components/coach/LevelProgressionPanel.tsx:76` · **works** · gates: `school level_progression_enabled && STAFF_ROLES incluye coach && toggle y elegibilidad solo admin/owner` · W: POST /api/v1/school/competition-results/individual · R: GET /api/v1/school/level-progression/settings, GET /api/v1/school/level-progression/athletes
  - Panel oculto para coach si la escuela no activó la progresión (el switch es solo owner/admin/super_admin).

### Módulo: Calendario

<a id="r-coach-calendar"></a>
#### Mi Calendario — `/calendar`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Principal > Calendario (navigation.ts:405, sin moduleKey en el ítem del coach: si el módulo está apagado el enlace sigue visible y la ruta bloquea); botón en /coach-plans (CoachPlansPage.tsx:380)
- **Archivo:** `pages/CalendarPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Coach ve título 'Mi Calendario' y todos los eventos de la escuela (por RLS staff). Edición inaccesible en táctil por hover-only. Ítem del sidebar del coach sin moduleKey mientras la ruta sí tiene ModuleGate.

##### Pestaña «Principal»

- [read] **Calendario mensual + Próximos Eventos** — `pages/CalendarPage.tsx:312` · **works** · gates: `ModuleGate gestion_deportiva_calendario && RLS calendar_events` · R: calendar_events (school_id = escuela OR user_id = yo) + teams(name), profiles (nombre del creador), coach_profiles.primary_sport (tipos de evento por deporte)
  - Solo muestra calendar_events; no incluye sesiones de entrenamiento/attendance_sessions ni horarios de equipos.
- [toggle] **Mes anterior / Hoy / Mes siguiente / elegir día** — `pages/CalendarPage.tsx:629` · **works**
- [create] **Nuevo Evento / Crear Evento (dialog 'Crear Nuevo Evento')** — `pages/CalendarPage.tsx:611` · **works** · gates: `PermissionGate calendar:create (coach lo tiene, lib/permissions.ts) && 'Para quién *' obligatorio: equipo propio / Toda la escuela / Solo para mí && RLS user_st` · W: calendar_events (insert) · R: school_staff (coach_auth_id), teams (active) + team_coaches
  - El botón 'Crear Evento' del estado vacío (línea 718) no está dentro del PermissionGate. Coach puede publicar para 'Toda la escuela'.
- [update] **Editar evento (lápiz) / Guardar** — `pages/CalendarPage.tsx:775` · **works** · gates: `canEdit: solo eventos creados por el coach` · W: calendar_events (update)
  - Lápiz solo aparece al hover (opacity-0 group-hover): en celular no es visible.
- [delete] **Eliminar (dentro del dialog de edición)** — `pages/CalendarPage.tsx:1071` · **works** · gates: `canEdit (creador)` · W: calendar_events (delete)

### Módulo: Entrenamiento

<a id="r-coach-training-plans"></a>
#### Sesiones de Entrenamiento (Métricas y Rendimiento) — `/training-plans`

- **Rol:** coach · **Entrada:** menú lateral · Título en pantalla dice "Métricas y Rendimiento" aunque el menú dice "Sesiones de Entrenamiento"
- **Archivo:** `pages/TrainingPlansPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — training_sessions 90 d: coach 3 · sin created_by 64 ¦ training_mesocycles histórico: coach 12 (6 coaches, 3 escuelas) · escuela 4 ¦ match_results 90 d: 34 (4 escuelas) ¦ performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1) ¦ training_mesocycle_evaluations: coach 62 (3 coaches) · escuela 26 (2)
- ⚠ Admin ve WeekSessionsPanel y link a /seguimiento-deportivo; coach no. Nombre de pantalla inconsistente con menú. Tablero táctico gigante compartido con otros módulos.

##### Pestaña «Panel de Selección: Equipos»

- [read] **Selector de equipo (solo mis equipos)** — `pages/TrainingPlansPage.tsx:76` · **works** · gates: `ModuleGate gestion_deportiva_entrenamiento_metricas && currentUserRole === coach filtra teams.coach_id/team_coaches` · R: school_staff, teams, team_coaches
- [create] **Crear Sesión** — `pages/TrainingPlansPage.tsx:338` · **works** · gates: `!isAdminRole && filterType=teams && sin mesociclo activo` · W: training_sessions · uso: usado (training_sessions)
  - Oculto si hay mesociclo activo: entonces se crea por día desde MesocycleSection
- [update] **Editar (sesión)** — `pages/TrainingPlansPage.tsx:457` · **works** · W: training_sessions · R: training_sessions · uso: usado (training_sessions)
- [delete] **Eliminar sesión** — `pages/TrainingPlansPage.tsx:459` · **hidden** · gates: `canDeleteSessions (owner/admin/staff/school_admin/super_admin)` · W: training_sessions
  - RLS training_plans_delete excluye coach; botón oculto
- [dialog] **Tablero táctico por bloque** — `pages/TrainingPlansPage.tsx:501` · **works** · gates: `bloques de sesión` · W: training_sessions.session_blocks (id del bloque), POST/PUT /api/v1/school/football/lineups · R: GET /api/v1/school/football/lineups, GET /api/v1/school/performance/roster · uso: usado (training_sessions)
  - TacticalBoard.tsx (3536 líneas) también vive en pizarra/partidos
- [dialog] **Crear/Editar Sesión de Entrenamiento (formulario)** — `components/coach/SessionFormDialog.tsx:350` · **works** · W: training_sessions, rpc insert_exercise_into_session_block · R: training_exercises (biblioteca) · uso: usado (training_sessions)

##### Pestaña «Mesociclo (MesocycleSection)»

- [create] **Crear Mesociclo** — `components/coach/MesocycleSection.tsx:573` · **works** · W: rpc create_mesocycle_with_weeks · R: training_mesocycles, training_microcycles, training_microcycle_days, rpc training_days_md_labels · uso: usado (training_mesocycles)
- [create] **Agregar sesión (por día)** — `components/coach/MesocycleSection.tsx:826` · **works** · W: training_microcycle_days, training_sessions (microcycle_day_id) · uso: usado (training_sessions)
- [create] **Duplicar semana anterior** — `components/coach/MesocycleSection.tsx:873` · **works** · W: rpc duplicate_microcycle_days
- [create] **Nuevo mesociclo** — `components/coach/MesocycleSection.tsx:926` · **works** · W: rpc create_mesocycle_with_weeks
- [update] **Editar mesociclo** — `components/coach/MesocycleSection.tsx:930` · **works** · W: training_mesocycles · uso: usado (training_mesocycles)
- [delete] **Eliminar mesociclo** — `components/coach/MesocycleSection.tsx:935` · **works** · W: rpc delete_mesocycle_cascade
  - Permiso del coach depende de la RPC; no verificado en base
- [update] **Cierre / revisión del mesociclo** — `components/coach/MesocycleSection.tsx:524` · **works** · W: rpc merge_mesocycle_closing_review
- [update] **Editar semana (microciclo)** — `components/coach/MesocycleSection.tsx:507` · **works** · W: training_microcycles

##### Pestaña «Panel de Selección: Planes»

- [read] **Selector de plan** — `pages/TrainingPlansPage.tsx:123` · **partial** · gates: `filterType=plans` · R: offering_plans (todos los activos de la escuela)
  - Lista TODOS los planes activos de la escuela, no solo los asignados al coach; para planificar pide volver a la pestaña Equipos

##### Pestaña «Roster / Evaluación de rendimiento»

- [dialog] **Evaluar Lote** — `pages/TrainingPlansPage.tsx:708` · **works** · gates: `!isAdminRole && roster > 0` · W: POST /api/v1/school/performance/entries · R: GET /api/v1/school/performance/roster
  - BFF requireRole incluye coach (bff/src/routes/school/performance.ts:21)
- [dialog] **Fútbol (Panorama de fútbol)** — `pages/TrainingPlansPage.tsx:721` · **works** · gates: `deporte del equipo = fútbol` · R: match_results, GET /api/v1/school/football/season-stats, GET /api/v1/school/football/tournament-matches · uso: usado (match_results)
- [create] **Programar Partido** — `components/school/FootballDashboardModal.tsx:418` · **duplicated** · gates: `deporte fútbol` · W: match_results · uso: usado (match_results)
  - Mismo dato que /results (ResultsPage): dos entradas para registrar partidos
- [dialog] **Tarjeta (carta del jugador)** — `pages/TrainingPlansPage.tsx:765` · **works** · R: GET /api/v1/school/performance/roster
- [dialog] **Evolución** — `pages/TrainingPlansPage.tsx:775` · **works** · R: GET /api/v1/school/performance/subjects/:type/:id/evolution, GET /api/v1/school/performance/metrics
- [dialog] **Evaluar (individual)** — `pages/TrainingPlansPage.tsx:785` · **duplicated** · W: POST /api/v1/school/performance/entries · R: GET /api/v1/school/performance/metrics
  - Se superpone con /evaluations (CoachEvaluationsPage, escribe academic_progress)

<a id="r-coach-coach-plans"></a>
#### Mis Planes y Disponibilidad — `/coach-plans`

- **Rol:** coach · **Entrada:** menú lateral · Item del menú con moduleKey (apagable por escuela)
- **Archivo:** `pages/CoachPlansPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — session_bookings 90 d: atleta 17 · sin usuario 28 ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1 ¦ coach_availability: 734 filas (18 coaches, 13 escuelas)
- ⚠ AvisoFichaStaff: sin ficha school_staff se pierde todo. El menú dice "Mis Planes" pero no son planes (offering_plans) sino disponibilidad/citas: nombre confuso. Asistencia duplicada con /coach-attendance.

##### Pestaña «Clases Fijas Asignadas»

- [read] **Listado de reservas/clases** — `pages/CoachPlansPage.tsx:43` · **works** · gates: `ModuleGate gestion_deportiva_disponibilidad_coach roles=[coach]` · R: session_bookings, profiles, children, unregistered_athletes, attendance_records · uso: usado (session_bookings, attendance_records)
- [update] **Marcar Presente** — `pages/CoachPlansPage.tsx:278` · **duplicated** · W: POST /api/v1/attendance/session · uso: usado (attendance_records)
  - Toma de asistencia paralela a /coach-attendance
- [update] **Marcar Ausente** — `pages/CoachPlansPage.tsx:287` · **duplicated** · W: POST /api/v1/attendance/session · uso: usado (attendance_records)
  - Igual que arriba

##### Pestaña «Tus Horarios Disponibles (Reservables)»

- [read] **Ver franjas de disponibilidad** — `pages/CoachPlansPage.tsx:156` · **duplicated** · R: coach_availability · uso: usado (coach_availability)
  - Muestra lo mismo que "Configurar Horas Libres" (AvailabilityManager) en la misma pantalla; el texto dice "la escuela te ha configurado" pero el coach la edita abajo

##### Pestaña «Tus Eventos Privados»

- [read] **Listado de eventos propios** — `pages/CoachPlansPage.tsx:180` · **works** · R: calendar_events (user_id = coach)
- [navigate] **Ir al calendario** — `pages/CoachPlansPage.tsx:380` · **works**
  - Los eventos se crean en /calendar, no aquí

##### Pestaña «Configurar Horas Libres (AvailabilityManager: Configurar / Programadas)»

- [create] **Agregar franja** — `components/school/AvailabilityManager.tsx:119` · **works** · gates: `requireStaffAdminOrOwner: coach solo su propio school_staff.id` · W: POST /api/v1/school-staff/:coachId/availability · R: GET /api/v1/school-staff/:coachId/availability
- [delete] **Eliminar franja** — `components/school/AvailabilityManager.tsx:136` · **works** · gates: `requireStaffAdminOrOwner` · W: DELETE /api/v1/school-staff/:coachId/availability/:availId
- [read] **Pestaña Programadas (clases grupales)** — `components/school/AvailabilityManager.tsx:234` · **works** · R: group_class_athletes

<a id="r-coach-school-routines"></a>
#### Gestión de Rutinas — `/school/routines`

- **Rol:** coach · **Entrada:** menú lateral · Compartida con dueño/admin ("Biblioteca compartida entre dueño y coaches")
- **Archivo:** `pages/school/SchoolRoutines.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0
- ⚠ Rutinas de gimnasio (módulo técnico trainer_routines compartido con personal_trainer). Se solapa conceptualmente con sesiones/ejercicios de /training-plans (biblioteca de ejercicios distinta). STAFF_ROLES del BFF no incluye school_admin/super_admin (bff/src/routes/school/routines.ts:7) aunque la ruta los deja entrar.

##### Pestaña «Todas / Personalizadas / Catálogo»

- [read] **Listado de rutinas (+catálogo global)** — `pages/school/SchoolRoutines.tsx:76` · **works** · gates: `ProtectedRoute school/admin/school_admin/super_admin/coach && assertSchoolStaff (school_members role owner/admin/coach/staff)` · R: GET /api/v1/school/routines?include_global=true (trainer_routines)
- [create] **NUEVA RUTINA** — `pages/school/SchoolRoutines.tsx:206` · **works** · W: POST /api/v1/school/routines
- [read] **Filtrar por etiqueta** — `pages/school/SchoolRoutines.tsx:232` · **works**
- [navigate] **Abrir rutina** — `pages/school/SchoolRoutines.tsx:356` · **works**
- [update] **Editar rutina** — `pages/school/SchoolRoutines.tsx:128` · **works** · W: PUT /api/v1/school/routines/:id
- [delete] **Eliminar rutina** — `pages/school/SchoolRoutines.tsx:387` · **works** · W: DELETE /api/v1/school/routines/:id

##### Pestaña «Asignadas»

- [read] **Listado de rutinas asignadas** — `pages/school/SchoolRoutines.tsx:91` · **works** · R: GET /api/v1/school/session-plans
- [delete] **Quitar asignación** — `pages/school/SchoolRoutines.tsx:311` · **works** · W: DELETE /api/v1/school/session-plans/:id

<a id="r-coach-school-routines-routineid"></a>
#### Detalle de rutina — `/school/routines/:routineId`

- **Rol:** coach · **Entrada:** sin menú · Desde tarjeta en /school/routines
- **Archivo:** `pages/trainer/TrainerRoutineDetail.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0
- ⚠ Página del portal personal_trainer reutilizada con isSchoolContext por pathname; copy de "cliente"/"Plantilla" sin adaptar en partes.

##### Pestaña «Principal»

- [read] **Ver rutina** — `pages/trainer/TrainerRoutineDetail.tsx:82` · **works** · gates: `isSchoolContext = pathname empieza por /school` · R: GET /api/v1/school/routines/:id
- [update] **Editar** — `pages/trainer/TrainerRoutineDetail.tsx:186` · **works** · W: PUT /api/v1/school/routines/:id
- [delete] **Eliminar** — `pages/trainer/TrainerRoutineDetail.tsx:195` · **works** · W: DELETE /api/v1/school/routines/:id
- [create] **USAR AHORA (asignar a atleta)** — `pages/trainer/TrainerRoutineDetail.tsx:371` · **partial** · W: POST /api/v1/school/routines/:id/use · R: school_athletes
  - El texto dice "Asigna esta rutina a un cliente" (copy de entrenador personal)
- [read] **Historial de uso** — `pages/trainer/TrainerRoutineDetail.tsx:96` · **hidden** · R: GET /api/v1/trainer/session-plans
  - En contexto escuela se fuerza a [] (endpoint trainer bajo requireTrainerAuth)

### Módulo: Dotación

<a id="r-coach-coach-dotacion"></a>
#### Mi Dotación — `/coach/dotacion`

- **Rol:** coach · **Entrada:** menú lateral
- **Archivo:** `pages/coach/CoachEquipmentPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — equipment_assignments: 4 en total
- ⚠ Botón "Tomar dotación" siempre visible aunque la escuela no tenga autoservicio habilitado.

##### Pestaña «Por aceptar»

- [read] **Listado de mis asignaciones** — `pages/coach/CoachEquipmentPage.tsx:43` · **works** · gates: `ProtectedRoute coach/school/admin/school_admin` · R: rpc equipment_my_assignments
- [update] **Diferencia** — `pages/coach/CoachEquipmentPage.tsx:126` · **partial** · W: rpc equipment_report_difference
  - Usa window.prompt dos veces (cantidad y nota): UX nativa, mala en celular
- [update] **Acepto** — `pages/coach/CoachEquipmentPage.tsx:129` · **works** · W: rpc equipment_accept, POST /api/v1/equipment/assignments/:id/acta-pdf
  - Acta best-effort, falla en silencio

##### Pestaña «Activas»

- [dialog] **Devolver** — `components/equipment/EquipmentReturnModal.tsx:76` · **works** · W: rpc equipment_request_return (foto opcional)
- [export] **Descargar acta** — `pages/coach/CoachEquipmentPage.tsx:90` · **works** · R: GET /api/v1/equipment/assignments/:id/acta-signed-url

##### Pestaña «Encabezado»

- [dialog] **Tomar dotación** — `components/equipment/EquipmentCheckoutModal.tsx:79` · **works** · gates: `self_checkout_enabled por escuela/ítem (lista vacía si está apagado)` · W: rpc equipment_self_checkout · R: rpc equipment_available_for_self_checkout

##### Pestaña «Historial»

- [read] **Historial de asignaciones** — `pages/coach/CoachEquipmentPage.tsx:150` · **works** · R: rpc equipment_my_assignments

### Módulo: Salud

<a id="r-coach-disponibilidad-medica"></a>
#### Disponibilidad médica — `/disponibilidad-medica`

- **Rol:** coach · **Entrada:** menú lateral
- **Archivo:** `pages/clinical/SchoolAvailabilityPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** sin uso — clinical_patients: 0
- ⚠ Sin ModuleGate; vacía salvo en escuelas con profesionales de salud (F3 en prod 10-06). Sin filtro por equipo.

##### Pestaña «Principal»

- [read] **Listado por estado de disponibilidad** — `pages/clinical/SchoolAvailabilityPage.tsx:56` · **works** · gates: `ProtectedRoute school/school_admin/coach/admin/super_admin && RPC: p_school_id = ANY(user_staff_school_ids())` · R: rpc get_school_athlete_availability
  - Solo lectura. El coach ve TODOS los atletas restringidos de la escuela, no solo los de sus equipos
- [read] **Reintentar** — `pages/clinical/SchoolAvailabilityPage.tsx:95` · **works**

### Módulo: Entrenamiento

<a id="r-coach-evaluations"></a>
#### Evaluaciones — `/evaluations`

- **Rol:** coach · **Entrada:** sin menú · Ninguna: solo URL directa (declarada en config/routePermissions.ts:100, que no se aplica)
- **Archivo:** `pages/CoachEvaluationsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Página huérfana con const isDemo=false (línea 24) y comentarios de supuestos. Duplica "Evaluar" de /training-plans (performance_entries). Candidata a borrar.

##### Pestaña «Principal»

- [read] **Seleccionar equipo** — `pages/CoachEvaluationsPage.tsx:37` · **works** · R: teams
- [read] **Seleccionar atleta** — `pages/CoachEvaluationsPage.tsx:68` · **broken** · R: team_members (tabla legada)
  - Lee team_members, no school_athletes/enrollments; el roster probablemente sale vacío
- [create] **Guardar evaluación (habilidad + nivel + comentario)** — `pages/CoachEvaluationsPage.tsx:90` · **dead** · W: academic_progress
  - Inalcanzable; inserta child_id con supuestos ("Assuming player_contact_id...") a partir del id de team_members

### Módulo: Reportes

<a id="r-coach-coach-reports"></a>
#### Reportes del Equipo — `/coach-reports`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Gestión > Reportes (config/navigation.ts:423). Route App.tsx:582 has NO ProtectedRoute and NO ModuleGate: any authenticated role can open it by URL.
- **Archivo:** `pages/CoachReportsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — match_results 90 d: 34 (4 escuelas) ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1 ¦ performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)
- ⚠ No route gate (App.tsx:582): any role can open it. BFF IDOR: GET /api/v1/reports/coach/:teamId (bff/src/routes/reports.ts:661-680) checks school ownership only for school_admin and uses the service role, so a coach (or staff/reporter) can read any team in any school by UUID. The attendance tab says 'current month' but shows all-time data. useToast imported but never used and a 'demo-' guard left over from demo mode. Overlaps: the Resultados tab duplicates /results (pages/ResultsPage.tsx, the coach's CRUD over match_results/competition_results); the Goleadores tab depends on /training-plans performance evaluation (components/school/PerformanceEntryModal.tsx and TeamPerformanceEntryModal.tsx -> lib/school/performanceQueries.ts:104 POST /api/v1/school/performance/entries), not on match results. /evaluations (pages/CoachEvaluationsPage.tsx, App.tsx:584) is an ORPHAN page: not in the sidebar and no links to it (only config/routePermissions.ts:100). It inserts into academic_progress (line 90), which neither this report, /informe-mensual nor the goleadores table reads: it is a third, disconnected 'evaluation' store next to performance_entries and the post-entreno metrics. It has an isDemo=false stub (line 24) and reads team_members as its roster.

##### Pestaña «Principal»

- [read] **Seleccionar Equipo (selector)** — `pages/CoachReportsPage.tsx:197` · **works** · gates: `user.id && schoolId && client-side filter teams.coach_id/team_coaches = user.id\|staffId (useCoachStaffId)` · R: teams (school_id, team_coaches(coach_id))
  - Loads ALL teams of the school then filters in the browser; auto-selects when the coach has only one team. AvisoFichaStaff warns when the staff record is missing (teams lost).
- [read] **Carga del reporte del equipo (KPIs Jugadores/Partidos/Asist. Promedio/Victorias/Empates/Derrotas)** — `pages/CoachReportsPage.tsx:239` · **works** · gates: `selectedTeamId && BFF requireRole(owner,super_admin,admin,auditor,reporter,coach,staff,school_admin)` · R: GET /api/v1/reports/coach/:teamId (bff/src/routes/reports.ts:661): teams, team_members, sports_categories, match_results\|competition_results, attendance_records, children, enrollments, performance_entries · uso: usado (match_results, attendance_records, performance_entries)
  - SECURITY: BFF uses the service-role client and checks school ownership only for role school_admin (reports.ts:678); for coach there is no team-assignment or school check, so a coach can read any team's roster/attendance/results by UUID (IDOR). Leftover demo guard: query disabled when teamId starts with 'demo-' (line 243).
- [navigate] **Informe grupal del mes** — `pages/CoachReportsPage.tsx:478` · **works**
  - Only entry point to /coach-reports/entreno-equipo.
- [export] **Exportar PDF** — `pages/CoachReportsPage.tsx:484` · **works** · gates: `report loaded`
  - Client-side: window.open + document.write + window.print (no server PDF). Fails silently if popups are blocked (returns without toast, line 289).

##### Pestaña «Asistencia»

- [read] **Asistencia General (por jugador, alerta < 70%)** — `pages/CoachReportsPage.tsx:644` · **partial** · gates: `report loaded` · R: GET /api/v1/reports/coach/:teamId -> attendance_records (team_id), children
  - UI labels the data as the current month ('{mes año}', line 652) but the BFF aggregates ALL attendance_records of the team with no date filter (reports.ts ~760). Only children (child_id) are counted; adult athletes / unregistered athletes do not appear.

##### Pestaña «Nómina»

- [read] **Nómina del Equipo** — `pages/CoachReportsPage.tsx:708` · **partial** · gates: `report loaded` · R: team_members (team_id)
  - Reads team_members, which is often empty (code comment line 269); the 'Jugadores' KPI then falls back to the attendance count while the tab shows 'Sin jugadores registrados'. Does not use enrollments, which the rest of the app treats as the roster (BFF uses enrollments for scorers).

##### Pestaña «Resultados»

- [read] **Resultados de Partidos** — `pages/CoachReportsPage.tsx:759` · **duplicated** · gates: `report loaded` · R: match_results (team_id) or competition_results when sports_categories.uses_sets_scoring · uso: usado (match_results)
  - Read-only copy of the /results list (pages/ResultsPage.tsx, which is where the coach creates, edits and deletes match_results/competition_results). Same win/loss rule derived from the score.

##### Pestaña «Goleadores»

- [read] **Tabla de Goleadores** — `pages/CoachReportsPage.tsx:784` · **works** · gates: `report loaded` · R: enrollments (team_id, active), performance_entries (metrics goles/asistencias, latest per athlete) · uso: usado (performance_entries)
  - Fed only by the 'Goles'/'Asistencias' metrics the coach records in /training-plans (PerformanceEntryModal -> POST /api/v1/school/performance/entries). Goals entered on match results in /results are NOT counted, so this is a second scorer source.

<a id="r-coach-coach-reports-entreno-equipo"></a>
#### Evaluación post-entrenamiento — informe de equipo — `/coach-reports/entreno-equipo`

- **Rol:** coach · **Entrada:** sin menú · Only the 'Informe grupal del mes' button on /coach-reports (pages/CoachReportsPage.tsx:478). No ProtectedRoute or ModuleGate (App.tsx:583).
- **Archivo:** `pages/CoachTeamPostTrainingReportPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — team_reports 90 d: 15
- ⚠ Hidden screen: the only entry is a button on /coach-reports, with no sidebar item. 'Publicar informe' is broken for coaches (403 from the BFF's ADMIN_ROLES check at bff/src/routes/school/reports.ts:577) and the button is not hidden. The preview GET creates team_reports drafts as a side effect. Duplication: the monthly team note here (report_section_notes, section 'general') and the 'Nota del equipo' in /informe-mensual (team_report_notes) are two parallel monthly team reports with different publishers and audiences. The parent view of this report (preview-for-parent) exists in the BFF; the file header (line 4) says who receives it is still pending (spec §7 #1).

##### Pestaña «Principal»

- [read] **Equipo / Mes / Año (filtros)** — `pages/CoachTeamPostTrainingReportPage.tsx:116` · **works** · gates: `client-side filter coach_id/team_coaches = user.id\|staffId` · R: teams (school_id, team_coaches)
  - Year selector offers only the current and previous year.
- [read] **Carga del informe (snapshot mensual + notas por bloque)** — `pages/CoachTeamPostTrainingReportPage.tsx:135` · **works** · gates: `BFF requireRole STAFF_ROLES (owner,super_admin,admin,school_admin,coach,staff) && team must belong to req.schoolId` · W: team_reports (find-or-create draft, service role, side effect of the GET) · R: GET /api/v1/school/reports/team/:teamId/preview?year&month (bff/src/routes/school/reports.ts:504): buildTeamReportSnapshot, team_reports, report_section_notes · uso: usado (team_reports)
  - Every team+month the coach browses creates an empty team_reports draft row. BFF does not check that the coach is assigned to the team (only that the school matches).
- [export] **Descargar PDF** — `pages/CoachTeamPostTrainingReportPage.tsx:260` · **works** · gates: `BFF STAFF_ROLES` · R: GET /api/v1/school/reports/team/:teamId/pdf?year&month (bff/src/routes/school/reports.ts:879)
  - Live draft PDF if not published; frozen snapshot once published.
- [update] **Publicar informe** — `pages/CoachTeamPostTrainingReportPage.tsx:267` · **broken** · gates: `snapshot.athlete_count > 0 && BFF requireRole ADMIN_ROLES (owner,super_admin,admin,school_admin)` · W: POST /api/v1/school/reports/team/:teamId/publish -> team_reports, RPC publish_team_report_system
  - The button is shown to the coach with no role check, but the BFF limits publishing to ADMIN_ROLES (bff/src/routes/school/reports.ts:577), so the coach always gets a 403 ('No se pudo publicar'). It also ignores school_settings.reports_release_by, unlike /informe-mensual.
- [update] **Guardar nota (por bloque: Cansancio (BORG), Comprensión de las tareas, Esfuerzo y entrega, Satisfacción y alegría, Aspectos a mejorar, Lo que vio el entrenador, Nota general del periodo)** — `pages/CoachTeamPostTrainingReportPage.tsx:309` · **works** · gates: `preview.report.id && not published && BFF STAFF_ROLES && RLS report_section_notes (staff)` · W: PUT /api/v1/school/reports/team-section-note -> report_section_notes (upsert)
  - Metric blocks only render when there is data (rpe_borg, task_comprehension, self_effort_pct, satisfaction, focus_*, coach_effort_rating); 'Nota general del periodo' always renders. Duplicates the team note on /informe-mensual (team_report_notes): two different monthly team notes in two tables.

<a id="r-coach-informe-mensual"></a>
#### Informe Mensual — `/informe-mensual`

- **Rol:** coach · **Entrada:** menú lateral · Sidebar Gestión > Informe Mensual (config/navigation.ts:424, with no moduleKey on the coach item). Route App.tsx:843 ProtectedRoute allows coach. ModuleGate does NOT apply to coach (components/ModuleGate.tsx GATED_ROLES = school, school_admin), so the coach sees it even when the school turned the module off.
- **Archivo:** `pages/MonthlyReportsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alguna vez 5 · enviados 90 d 23
- ⚠ The coach writes one note per team (team_report_notes) and, optionally, one note per athlete. Publishing and sending depend on school_settings.reports_release_by. ModuleGate gestion_deportiva_informe_mensual only applies to school/school_admin (components/ModuleGate.tsx), and the coach's sidebar item has no moduleKey (config/navigation.ts:424), so turning the module off does not hide it from coaches. Gaps: the team selector shows all school teams (line 136); the saved team note is not shown back (line 211); 'Publicar lote' ignores puedePublicar (line 545). The coach depends on the admin generating drafts. Drafts are only created for athletes WITH measurements in the month (performance_entries from /training-plans PerformanceEntryModal -> POST /api/v1/school/performance/entries), so this report depends on the coach evaluating there; academic_progress written by the orphan /evaluations page (pages/CoachEvaluationsPage.tsx:90) is not used. Duplicates the monthly team note in /coach-reports/entreno-equipo (report_section_notes). Voseo copy at lines 301 and 693.

##### Pestaña «Principal»

- [read] **Mes / Año / Actualizar** — `pages/MonthlyReportsPage.tsx:177` · **works** · gates: `BFF STAFF_ROLES && RLS athlete_reports (coach_can_see_report)` · R: GET /api/v1/school/reports?year&month (bff/src/routes/school/reports.ts:90): athlete_reports, profiles/children/unregistered_athletes, school_settings.reports_release_by, RPC report_coverage
  - release_by comes back in this response because the coach cannot read school_settings under RLS.
- [toggle] **Quién publica y envía** — `pages/MonthlyReportsPage.tsx:362` · **hidden** · gates: `!isCoach` · W: school_settings.reports_release_by
  - Admin only.
- [create] **Generar borradores de {Mes}** — `pages/MonthlyReportsPage.tsx:399` · **hidden** · gates: `!isCoach && BFF ADMIN_ROLES` · W: POST /api/v1/school/reports/generate -> RPC generate_report_drafts
  - Admin only; the coach depends on the school generating drafts first.
- [read] **Cobertura de {Mes} (tabla por equipo)** — `pages/MonthlyReportsPage.tsx:440` · **works** · gates: `cobertura.length > 0` · R: RPC report_coverage (via GET /api/v1/school/reports)
  - Shows Atletas, Con nota, Falta nota, Publicados, Leídos and Sin medir (attended but not measured + not active).
- [update] **Equipo (selector) + Guardar nota (nota del equipo, mín. 20 caracteres)** — `pages/MonthlyReportsPage.tsx:536` · **partial** · gates: `teamId && nota >= 20 && BFF STAFF_ROLES && RLS team_report_notes (coach's teams)` · W: PUT /api/v1/school/teams/:teamId/report-note -> team_report_notes (upsert) · R: teams (school_id) for the selector, line 136
  - The selector lists ALL teams of the school, not just the coach's; saving on another team's note fails through RLS with a generic 500 'No se pudo guardar la nota.'. An existing note is never loaded back: the textarea starts empty and clears after saving (line 211), so the coach cannot see or edit what they wrote, only overwrite it.
- [update] **Publicar {n} informes / Publicar lote** — `pages/MonthlyReportsPage.tsx:545` · **partial** · gates: `teamId && publicables > 0 && BFF STAFF_ROLES && RPC publish_team_reports validates reports_release_by + team note` · W: POST /api/v1/school/reports/publish-team -> RPC publish_team_reports (athlete_reports snapshot)
  - Unlike the per-row 'Publicar' and 'Enviar' buttons, this one is NOT gated by puedePublicar, so a coach sees it even when release_by='school' and the RPC rejects it.
- [update] **Enviar los publicados** — `pages/MonthlyReportsPage.tsx:568` · **works** · gates: `puedeEnviar (!isCoach \|\| release_by='coach') && resumen.publicados > 0 && BFF: coach only if reports_release_by='coach', limited to current_staff_team_ids` · W: POST /api/v1/school/reports/send -> deliverPublishedReports: email (Resend) + notifications, athlete_reports.sent_at · uso: usado (athlete_reports)
  - The email link goes to /children/:childId/reports/:reportId for minors; adult athletes (subject_type='profile') get the generic /stats page (bff/src/services/report-delivery.service.ts:236) because there is no dedicated page yet.

##### Pestaña «Informes de {Mes} {Año} (listado)»

- [update] **Nota individual / Editar nota + Guardar** — `pages/MonthlyReportsPage.tsx:617` · **works** · gates: `status != publicado && BFF STAFF_ROLES && RPC set_athlete_report_note` · W: PUT /api/v1/school/reports/:id/note -> athlete_reports.coach_note (RPC)
  - Voseo in the UI copy ('Dejala vacía', line 693).
- [update] **Publicar (uno)** — `pages/MonthlyReportsPage.tsx:636` · **works** · gates: `status != publicado && puedePublicar && RPC publish_athlete_report (requires team note)` · W: POST /api/v1/school/reports/:id/publish -> athlete_reports
  - Visible to the coach only when release_by='coach'.
- [export] **Ver PDF** — `pages/MonthlyReportsPage.tsx:654` · **works** · gates: `status = publicado && BFF athlete-reports-pdf: coach must be school_staff of the report's school` · R: GET /api/v1/athlete-reports/:id/pdf
- [update] **Enviar (uno)** — `pages/MonthlyReportsPage.tsx:666` · **works** · gates: `status = publicado && !sent_at && recipient_id && puedeEnviar` · W: POST /api/v1/school/reports/send {report_id}
  - Voseo in the failure toast ('Revisá que esté publicado…', line 301).

### Módulo: Mi Tienda / Mis Servicios (vendedor)

<a id="r-coach-vendor-onboarding"></a>
#### Activar Mi Tienda (onboarding de vendedor) — `/vendor/onboarding`

- **Rol:** coach · **Entrada:** menú lateral · CTA 'Activar Mi Tienda' en el Dashboard (components/vendor/ActivateStoreCTA.tsx:76, montado en pages/DashboardPage.tsx:554) solo si store_enabled() y el coach no tiene vendor_profile ni lo descartó (preferences.store_cta_dismissed). VendorGuard redirige aquí a cualquier /vendor/* sin perfil o con perfil inactivo. Con perfil activo el item 'Verificación' del grupo vendedor apunta aquí pero VendorGuard lo reenvía a /vendor/dashboard.
- **Archivo:** `pages/vendor/VendorOnboardingPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Un coach obtiene vendor_profile solo por esta pantalla (rpc enable_vendor_profile). config/routePermissions.ts:159 dice allowedRoles ['wellness_professional','store_owner'] para /vendor/onboarding, pero ese archivo no se importa en ningún lado (config muerta); el gate real es VendorGuard, que acepta cualquier rol. El grupo de sidebar solo aparece después de tener perfil (AppSidebar.tsx:153 showVendorGroup = !isSchoolRole && hasVendorProfile && !isVendorPrimaryRole && (storeEnabled \|\| canSellServices)): antes de activarlo la única entrada es el CTA del Dashboard, que desaparece con la tienda apagada globalmente aunque el coach quiera vender solo servicios.

##### Pestaña «Principal (wizard 3 pasos: Negocio, Pagos, Verificación)»

- [navigate] **Siguiente (paso Negocio: qué vendes productos/servicios/ambos, nombre, ciudad, teléfono)** — `pages/vendor/VendorOnboardingPage.tsx:293` · **works** · gates: `VendorGuard (sin vendor_profile o inactivo)` · R: vendor_profiles
  - vendor_type por rol: coach -> 'coach' (defaultVendorTypeForRole, línea 60)
- [create] **Activar y continuar** — `pages/vendor/VendorOnboardingPage.tsx:293` · **works** · gates: `VendorGuard` · W: rpc enable_vendor_profile (p_vendor_type='coach', p_can_sell_products, p_can_sell_services), PUT /api/v1/vendor/profile/payment
  - El PUT de medios de pago es no bloqueante (.catch con console.warn): si falla, la tienda queda activa sin medios de pago y sin aviso al usuario
- [upload] **Subir documento de verificación y finalizar** — `pages/vendor/VendorOnboardingPage.tsx:307` · **works** · gates: `VendorGuard` · W: storage vendor-docs, PUT /api/v1/vendor/profile/verification
- [navigate] **Omitir por ahora** — `pages/vendor/VendorOnboardingPage.tsx:304` · **works**
  - -> /vendor/dashboard con verification_status='pending'

<a id="r-coach-vendor-dashboard"></a>
#### Panel Tienda — `/vendor/dashboard`

- **Rol:** coach · **Entrada:** menú lateral · Destino tras activar/omitir el onboarding; redirect de VendorGuard cuando un perfil activo entra a /vendor/onboarding
- **Archivo:** `pages/vendor/VendorDashboardPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Pantalla pensada para store_owner/wellness; el coach que vende servicios no tiene vista propia. Dos de los accesos rápidos (Pedidos, Inventario) y las tarjetas Ingresos/Pedidos llevan a rutas que rechazan al coach.

##### Pestaña «Principal»

- [read] **Carga de métricas (Ingresos 30 días, Pedidos pagados, Ticket promedio, Productos activos, Calificación)** — `pages/vendor/VendorDashboardPage.tsx:37` · **partial** · gates: `VendorGuard (vendor_profile activo)` · R: GET /api/v1/vendor/stats, useStoreSalesInsights (orders/order_items 30 días), getMyVendorSummary (vendor_profiles rating)
  - El coach cae en la rama NO-wellness (isWellness solo para wellness_professional, línea 32): ve tarjetas de ventas de productos aunque solo venda servicios; las métricas de servicios/citas no se muestran
- [navigate] **Crear (botón principal) -> /vendor/products** — `pages/vendor/VendorDashboardPage.tsx:111` · **partial** · gates: `StoreGate en destino`
  - Para el coach siempre lleva a productos; si la tienda está apagada o solo vende servicios cae en 'Tienda no disponible'
- [navigate] **Accesos rápidos: Mis productos** — `pages/vendor/VendorDashboardPage.tsx:195` · **works** · gates: `StoreGate`
- [navigate] **Accesos rápidos: Pedidos / Ingresos -> /orders** — `pages/vendor/VendorDashboardPage.tsx:199` · **broken** · gates: `ProtectedRoute ['store_owner','admin','school','school_admin','super_admin'] (App.tsx:976)`
  - Coach no está en allowedRoles -> /unauthorized
- [navigate] **Accesos rápidos: Inventario -> /inventory** — `pages/vendor/VendorDashboardPage.tsx:203` · **broken** · gates: `ProtectedRoute ['store_owner','admin','school','school_admin','super_admin'] (App.tsx:981)`
  - Coach -> /unauthorized
- [navigate] **Accesos rápidos: Promociones** — `pages/vendor/VendorDashboardPage.tsx:207` · **partial** · gates: `StoreGate`
  - Destino es placeholder 'Próximamente'

##### Pestaña «Banner de verificación (VendorGuard)»

- [upload] **Subir documento / Actualizar documento / Subir nuevo documento** — `components/vendor/VendorGuard.tsx:115` · **works** · gates: `verification_status pending\|rejected && vendor_type != 'school'` · W: storage vendor-docs, PUT /api/v1/vendor/profile/verification (VendorDocUploadModal) · R: vendor_profiles
  - Visible en todas las pantallas /vendor/* mientras no esté verificado

<a id="r-coach-vendor-services"></a>
#### Servicios — `/vendor/services`

- **Rol:** coach · **Entrada:** menú lateral · Item 'Servicios' solo si can_sell_services (navigation.ts:135)
- **Archivo:** `pages/vendor/VendorServicesPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Placeholder 'Edicion proximamente'. Los servicios del coach no tienen agenda utilizable (ver Agenda).

##### Pestaña «Principal»

- [read] **Listado de servicios** — `pages/vendor/VendorServicesPage.tsx:45` · **works** · gates: `VendorGuard && BFF requireVendorProfile('can_sell_services') (bff/src/routes/vendor-services.routes.ts:10)` · R: GET /api/v1/vendor/services
- [create] **Crear Servicio (ServiceWizard)** — `pages/vendor/VendorServicesPage.tsx:81` · **works** · gates: `can_sell_services` · W: POST /api/v1/vendor/services (components/vendor/service-wizard/ServiceWizard.tsx:167)
- [update] **Editar servicio** — `pages/vendor/VendorServicesPage.tsx:159` · **hidden**
  - Botón deshabilitado con title 'Edicion proximamente'; el BFF ya tiene PATCH /:id sin UI
- [delete] **Desactivar servicio** — `pages/vendor/VendorServicesPage.tsx:162` · **works** · gates: `can_sell_services` · W: DELETE /api/v1/vendor/services/:id
  - Sin confirmación; no se puede reactivar desde la UI

<a id="r-coach-vendor-appointments"></a>
#### Agenda (citas) — `/vendor/appointments`

- **Rol:** coach · **Entrada:** menú lateral · Item 'Agenda' solo si can_sell_services (navigation.ts:136)
- **Archivo:** `pages/vendor/VendorAppointmentsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** broken · **Uso:** no medido
- ⚠ Archivo de 6 líneas: solo un <Navigate>. Item de menú roto para coach.

##### Pestaña «Principal»

- [navigate] **Abrir agenda -> redirect a /schedule** — `pages/vendor/VendorAppointmentsPage.tsx:5` · **broken** · gates: `VendorGuard && ProtectedRoute ['wellness_professional'] en /schedule (App.tsx:933)`
  - El coach es redirigido a /schedule, que solo admite wellness_professional -> /unauthorized. Un coach que vende servicios no puede ver ni confirmar sus citas

<a id="r-coach-vendor-products"></a>
#### Productos — `/vendor/products`

- **Rol:** coach · **Entrada:** menú lateral · Item 'Productos' si can_sell_products y store_enabled; botón 'Crear'/'Mis productos' del Panel Tienda
- **Archivo:** `pages/vendor/VendorProductsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ El item hermano 'Inventario' (/inventory) del mismo grupo rechaza al coach (App.tsx:981). La gestión de stock del coach solo es posible desde 'Ajustar stock' aquí.

##### Pestaña «Principal»

- [read] **Listado con filtros (búsqueda, estado, categoría, nivel de stock)** — `pages/vendor/VendorProductsPage.tsx:24` · **works** · gates: `VendorGuard && StoreGate (store_enabled) && BFF requireStoreEnabled + requireMarketplaceAuth` · R: useMyStoreProducts (products del vendor)
- [create] **Nuevo producto (ProductWizard)** — `pages/vendor/VendorProductsPage.tsx:60` · **works** · gates: `StoreGate` · W: POST /api/v1/vendor/products
  - Ruta /vendor/products/new
- [dialog] **Ajustar stock** — `pages/vendor/VendorProductsPage.tsx:148` · **works** · gates: `StoreGate` · W: stock vía RPC/BFF de ajuste
- [update] **Editar producto** — `pages/vendor/VendorProductsPage.tsx:151` · **works** · gates: `StoreGate` · W: PUT /api/v1/vendor/products/:id
  - Ruta /vendor/products/:id/edit
- [delete] **Archivar producto** — `pages/vendor/VendorProductsPage.tsx:155` · **works** · gates: `StoreGate` · W: DELETE /api/v1/vendor/products/:id

<a id="r-coach-orders-inventory"></a>
#### Pedidos e Inventario (items de menú) — `/orders | /inventory`

- **Rol:** coach · **Entrada:** menú lateral · Items 'Pedidos' e 'Inventario' del grupo Mi Tienda (navigation.ts:132,138)
- **Archivo:** `pages/StoreOrdersPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** broken · **Uso:** no medido
- ⚠ Mismatch menú vs rutas: getVendorNavGroup ofrece las rutas a cualquier vendor_profile, pero App.tsx solo las abre a store_owner/escuela/admin.

##### Pestaña «Principal»

- [navigate] **Pedidos** — `config/navigation.ts:138` · **broken** · gates: `requiresStore && ProtectedRoute ['store_owner','admin','school','school_admin','super_admin'] (App.tsx:976)`
  - Coach -> /unauthorized: el coach-vendedor no puede ver sus pedidos
- [navigate] **Inventario** — `config/navigation.ts:132` · **broken** · gates: `requiresStore && can_sell_products && ProtectedRoute (App.tsx:981)`
  - Coach -> /unauthorized

<a id="r-coach-vendor-inbox"></a>
#### Inbox — `/vendor/inbox`

- **Rol:** coach · **Entrada:** menú lateral · none
- **Archivo:** `pages/vendor/VendorInboxPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Reseñas/preguntas son de productos del marketplace; los servicios del coach no reciben preguntas por aquí.

##### Pestaña «Reseñas»

- [read] **Reseñas pendientes** — `pages/vendor/VendorInboxPage.tsx:15` · **works** · gates: `VendorGuard && StoreGate` · R: GET /api/v1/vendor/inbox
- [create] **Responder reseña** — `pages/vendor/VendorInboxPage.tsx:137` · **works** · gates: `StoreGate` · W: POST /api/v1/reviews/:id/respond
  - Mínimo 5 caracteres

##### Pestaña «Preguntas»

- [create] **Responder pregunta** — `pages/vendor/VendorInboxPage.tsx:184` · **works** · gates: `StoreGate` · W: POST /api/v1/questions/:id/answer · R: GET /api/v1/vendor/inbox

##### Pestaña «Conversaciones»

- [read] **Conversaciones con compradores (StoreConversationsPanel)** — `pages/vendor/VendorInboxPage.tsx:84` · **works** · gates: `StoreGate` · W: mensajes · R: conversaciones de tienda
  - Duplica parcialmente /messages (Chat del bottom nav)

<a id="r-coach-vendor-payouts"></a>
#### Liquidaciones — `/vendor/payouts`

- **Rol:** coach · **Entrada:** menú lateral · none
- **Archivo:** `pages/vendor/VendorPayoutsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Los ingresos por servicios no pasan por liquidaciones si la tienda está apagada (ítem requiresStore): el coach que vende solo servicios no ve su saldo.

##### Pestaña «Principal»

- [read] **Saldo e historial de liquidaciones** — `pages/vendor/VendorPayoutsPage.tsx:18` · **works** · gates: `VendorGuard && StoreGate` · R: GET /api/v1/vendor/balance, GET /api/v1/vendor/payouts, GET /api/v1/vendor/bank-accounts
- [create] **Solicitar liquidación** — `pages/vendor/VendorPayoutsPage.tsx:108` · **works** · gates: `StoreGate && saldo > mínimo` · W: POST /api/v1/vendor/payouts/request
- [dialog] **Agregar / editar cuenta bancaria** — `pages/vendor/VendorPayoutsPage.tsx:127` · **works** · gates: `StoreGate` · W: POST\|PUT /api/v1/vendor/bank-accounts
- [update] **Marcar cuenta predeterminada** — `pages/vendor/VendorPayoutsPage.tsx:161` · **works** · gates: `StoreGate` · W: POST /api/v1/vendor/bank-accounts/:id/set-default
- [delete] **Eliminar cuenta bancaria** — `pages/vendor/VendorPayoutsPage.tsx:169` · **works** · gates: `StoreGate && confirm()` · W: DELETE /api/v1/vendor/bank-accounts/:id

<a id="r-coach-vendor-shipping"></a>
#### Envíos — `/vendor/shipping`

- **Rol:** coach · **Entrada:** menú lateral · none
- **Archivo:** `pages/vendor/VendorShippingSettingsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Se muestra aunque el coach solo venda servicios (no se filtra por can_sell_products).

##### Pestaña «Principal»

- [read] **Configuración de envíos y transportadoras** — `pages/vendor/VendorShippingSettingsPage.tsx:36` · **works** · gates: `VendorGuard && StoreGate` · R: GET /api/v1/vendor/shipping/settings, GET /api/v1/shipping/carriers
- [update] **Guardar configuración** — `pages/vendor/VendorShippingSettingsPage.tsx:222` · **works** · gates: `StoreGate` · W: PUT /api/v1/vendor/shipping/settings
  - config/routePermissions.ts:167 la limita a store_owner, pero ese archivo no se aplica

<a id="r-coach-vendor-promotions"></a>
#### Promociones — `/vendor/promotions`

- **Rol:** coach · **Entrada:** menú lateral · Acceso rápido del Panel Tienda
- **Archivo:** `pages/vendor/VendorPromotionsPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** dead · **Uso:** no medido
- ⚠ Placeholder 'Próximamente' expuesto en el menú.

##### Pestaña «Principal»

- [navigate] **Volver al panel** — `pages/vendor/VendorPromotionsPage.tsx:14` · **dead** · gates: `VendorGuard && StoreGate`
  - Pantalla placeholder 'Próximamente' (línea 33): no hay funcionalidad

<a id="r-coach-vendor-subscribers"></a>
#### Suscriptores — `/vendor/subscribers`

- **Rol:** coach · **Entrada:** sin menú · No está en el menú del coach; solo enlazado desde TrainerDashboard 'Mis suscriptores' (pages/trainer/TrainerDashboard.tsx:122) o deep link
- **Archivo:** `pages/vendor/VendorSubscribersPage.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** broken · **Uso:** no medido
- ⚠ Pantalla huérfana y rota: motor de recurrentes v1 retirado (reemplazado por /api/v1/autopay).

##### Pestaña «Todos / Activos / Pausados / Suspendidos / Cancelados»

- [read] **Listado de suscriptores recurrentes** — `pages/vendor/VendorSubscribersPage.tsx:55` · **broken** · gates: `VendorGuard` · R: GET /api/v1/recurring/vendor/subscriptions (hooks/useVendorRecurringSubscribers.ts:38)
  - El BFF responde 410 'recurring_v1_retired' a todo /api/v1/recurring (bff/src/index.ts:405); la pantalla siempre muestra error

### Módulo: Portal del entrenador personal

<a id="r-personal-trainer-trainer-onboarding"></a>
#### Onboarding de entrenador — `/trainer/onboarding`

- **Rol:** personal_trainer · **Entrada:** sin menú · RequirePersonalTrainer redirige aquí cualquier /trainer/* mientras trainerOnboardingStatus != 'completed'; fuera del guard (App.tsx:1051)
- **Archivo:** `pages/trainer/TrainerOnboarding.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido
- ⚠ Crea una 'micro-escuela' propia del entrenador; el resto del portal y los módulos compartidos (/enrollments, planes, pagos) dependen de ese school_id.

##### Pestaña «Principal (wizard por pasos: deporte/especialidades, modalidad, tarifa, perfil)»

- [create] **Siguiente / Finalizar** — `pages/trainer/TrainerOnboarding.tsx:568` · **works** · gates: `autenticado && BFF requireTrainerAuth (bff/src/index.ts:472)` · W: POST /api/v1/trainer/onboarding/step (crea schools school_type='personal_trainer', school_settings, trainer_profiles, school_staff), POST /api/v1/trainer/onboarding/complete · R: GET /api/v1/trainer/onboarding/status
- [navigate] **Atrás** — `pages/trainer/TrainerOnboarding.tsx:561` · **works**
- [update] **Elegir tarifa sugerida** — `pages/trainer/TrainerOnboarding.tsx:431` · **works**
  - Estado local hasta el step

<a id="r-personal-trainer-trainer-dashboard"></a>
#### Dashboard del entrenador — `/trainer/dashboard`

- **Rol:** personal_trainer · **Entrada:** menú lateral + barra inferior · /dashboard redirige aquí para profile.role='personal_trainer' (pages/DashboardPage.tsx:256); bottom nav 'Inicio' (rol cae en el default de MobileBottomNav)
- **Archivo:** `pages/trainer/TrainerDashboard.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas) · Usuarios: personal_trainer: 12 perfiles · 0 con login 30 d · 2 en 90 d
- ⚠ Atajo roto a Suscriptores.

##### Pestaña «Principal»

- [read] **KPIs: Clientes activos, Sesiones hoy, Pagos pendientes, Próximas sesiones** — `pages/trainer/TrainerDashboard.tsx:33` · **works** · gates: `RequirePersonalTrainer` · R: enrollments, trainer_session_plans, payments · uso: usado (payments)
  - Consultas Supabase directas por trainerSchoolId (no BFF)
- [navigate] **Gestionar disponibilidad** — `pages/trainer/TrainerDashboard.tsx:120` · **works**
- [navigate] **Ver mis planes** — `pages/trainer/TrainerDashboard.tsx:121` · **works**
- [navigate] **Mis suscriptores -> /vendor/subscribers** — `pages/trainer/TrainerDashboard.tsx:122` · **broken** · gates: `VendorGuard (exige vendor_profile)` · R: GET /api/v1/recurring/vendor/subscriptions
  - Sin vendor_profile VendorGuard manda a /vendor/onboarding; con perfil, el endpoint devuelve 410 (motor recurring v1 retirado)
- [navigate] **Editar mi perfil / Completar perfil** — `pages/trainer/TrainerDashboard.tsx:147` · **works**

<a id="r-personal-trainer-trainer-clients"></a>
#### Mis Clientes — `/trainer/clients`

- **Rol:** personal_trainer · **Entrada:** menú lateral · KPI 'Clientes activos' del dashboard
- **Archivo:** `pages/trainer/TrainerClients.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12
- ⚠ Duplica funcionalidad de /students e /invitations de la escuela con UI propia.

##### Pestaña «Activos»

- [read] **Listado de clientes con búsqueda** — `pages/trainer/TrainerClients.tsx:46` · **works** · gates: `RequirePersonalTrainer && requireTrainerAuth` · R: GET /api/v1/trainer/clients
- [create] **Agregar Cliente (menor / adulto)** — `pages/trainer/TrainerClients.tsx:104` · **works** · gates: `requireTrainerAuth` · W: POST /api/v1/students/create-one · R: teams, offering_plans, school_settings, GET /api/v1/trainer/search-profile
  - Reutiliza StudentTypeSelector/CreateChildModal/CreateAdultAthleteModal del módulo de alumnos de la escuela
- [navigate] **Abrir ficha del cliente** — `pages/trainer/TrainerClients.tsx:142` · **works**

##### Pestaña «Invitaciones»

- [create] **Nueva invitación** — `pages/trainer/tabs/TrainerInvitationsTab.tsx:404` · **works** · W: invitations, edge function send-email · R: invitations, teams, offering_plans · uso: usado (invitations)
  - Inserta directo en invitations desde el cliente
- [link] **Copiar link / Enviar por WhatsApp** — `pages/trainer/tabs/TrainerInvitationsTab.tsx:508` · **works**

<a id="r-personal-trainer-trainer-clients-clientid"></a>
#### Ficha del cliente — `/trainer/clients/:clientId`

- **Rol:** personal_trainer · **Entrada:** sin menú · Desde Mis Clientes
- **Archivo:** `pages/trainer/TrainerClientProfile.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — training_logs: 9 en total

##### Pestaña «Resumen»

- [read] **Datos, agenda de hoy y resumen** — `pages/trainer/TrainerClientProfile.tsx:44` · **works** · gates: `requireTrainerAuth` · R: GET /api/v1/trainer/clients/:id, GET /api/v1/trainer/clients/:id/summary, GET /api/v1/trainer/availability/schedule
- [update] **Editar cliente** — `pages/trainer/TrainerClientProfile.tsx:136` · **works** · W: PUT /api/v1/trainer/clients/:id (EditClientModal)

##### Pestaña «Métricas»

- [create] **Registrar / eliminar métrica** — `pages/trainer/tabs/ClientStatsTab.tsx:427` · **works** · W: POST\|DELETE /api/v1/trainer/clients/:id/stats · R: GET /api/v1/trainer/clients/:id/stats

##### Pestaña «Objetivos»

- [create] **Crear / actualizar / eliminar objetivo** — `pages/trainer/tabs/ClientGoalsTab.tsx:67` · **works** · W: POST\|PATCH\|DELETE /api/v1/trainer/clients/:id/goals · R: GET /api/v1/trainer/clients/:id/goals

##### Pestaña «Sesiones»

- [create] **Planificar sesión desde rutina** — `pages/trainer/tabs/ClientTrainingTab.tsx:147` · **works** · W: POST /api/v1/trainer/routines/:id/use, POST /api/v1/trainer/session-plans · R: GET /api/v1/trainer/clients/:id/training, training_logs · uso: usado (training_logs)
- [update] **Completar sesión** — `pages/trainer/tabs/ClientTrainingTab.tsx:176` · **works** · W: POST /api/v1/trainer/session-plans/:id/complete
- [delete] **Eliminar sesión planificada** — `pages/trainer/tabs/ClientTrainingTab.tsx:195` · **works** · W: DELETE /api/v1/trainer/session-plans/:id

##### Pestaña «Habilidades»

- [read] **Progreso y capturas biomecánicas** — `pages/trainer/tabs/ClientProgressTab.tsx:113` · **works** · W: POST /api/v1/trainer/clients/:id/progress · R: academic_progress, GET /api/v1/trainer/clients/:id/progress, /api/v1/trainer/biomech/captures

##### Pestaña «Plan»

- [read] **Plan y pagos del cliente (solo lectura)** — `pages/trainer/tabs/ClientPlanTab.tsx:96` · **works** · R: enrollment.offering_plans y payments (vienen del GET de la ficha)
  - Sin acciones; plan por defecto 'A demanda'

<a id="r-personal-trainer-trainer-routines"></a>
#### Mis Rutinas — `/trainer/routines`

- **Rol:** personal_trainer · **Entrada:** menú lateral · none
- **Archivo:** `pages/trainer/TrainerRoutines.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0
- ⚠ Módulo técnico compartido: trainer_routines también lo usa /school/routines (SchoolRoutines) vía /api/v1/school/routines.

##### Pestaña «Principal (pestañas por categoría + filtro por etiqueta)»

- [read] **Listado de rutinas** — `pages/trainer/TrainerRoutines.tsx:49` · **works** · gates: `requireTrainerAuth` · R: GET /api/v1/trainer/routines (trainer_routines)
- [create] **Nueva rutina** — `pages/trainer/TrainerRoutines.tsx:131` · **works** · W: POST /api/v1/trainer/routines
  - RoutineFormModal + BlockBuilder + catálogo wger
- [navigate] **Abrir detalle** — `pages/trainer/TrainerRoutines.tsx:208` · **works**
- [delete] **Eliminar rutina** — `pages/trainer/TrainerRoutines.tsx:246` · **works** · W: DELETE /api/v1/trainer/routines/:id

<a id="r-personal-trainer-trainer-routines-routineid"></a>
#### Detalle de rutina — `/trainer/routines/:routineId`

- **Rol:** personal_trainer · **Entrada:** sin menú · Desde Mis Rutinas
- **Archivo:** `pages/trainer/TrainerRoutineDetail.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0
- ⚠ Mismo componente montado en /school/routines/:routineId; decide BFF por window.location.pathname.startsWith('/school') (línea 61). Desde contexto escuela el historial de uso igual pide /api/v1/trainer/session-plans (línea 103), que requiere requireTrainerAuth.

##### Pestaña «Principal»

- [read] **Ver rutina e historial de uso** — `pages/trainer/TrainerRoutineDetail.tsx:84` · **works** · gates: `requireTrainerAuth` · R: GET /api/v1/trainer/routines/:id, GET /api/v1/trainer/session-plans?routine_id=
- [create] **USAR AHORA (asignar a cliente)** — `pages/trainer/TrainerRoutineDetail.tsx:371` · **works** · W: POST /api/v1/trainer/routines/:id/use (QuickUseRoutineModal)
- [update] **Editar rutina** — `pages/trainer/TrainerRoutineDetail.tsx:186` · **works** · W: PUT /api/v1/trainer/routines/:id
- [delete] **Eliminar rutina** — `pages/trainer/TrainerRoutineDetail.tsx:195` · **works** · W: DELETE /api/v1/trainer/routines/:id
- [dialog] **Ver detalle de un uso** — `pages/trainer/TrainerRoutineDetail.tsx:397` · **works**

<a id="r-personal-trainer-trainer-availability"></a>
#### Disponibilidad — `/trainer/availability`

- **Rol:** personal_trainer · **Entrada:** menú lateral · KPIs 'Sesiones hoy' y 'Próximas sesiones' del dashboard
- **Archivo:** `pages/trainer/TrainerAvailability.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — coach_availability: 734 filas (18 coaches, 13 escuelas)

##### Pestaña «Mis Sesiones»

- [read] **Agenda del día (navegar por fecha, Hoy)** — `pages/trainer/TrainerAvailability.tsx:51` · **works** · gates: `requireTrainerAuth` · R: GET /api/v1/trainer/availability/schedule?date=

##### Pestaña «Configurar Horarios»

- [update] **Configurar franjas de disponibilidad (AvailabilityManager)** — `pages/trainer/TrainerAvailability.tsx:256` · **partial** · gates: `requiere staffId (useCoachStaffId)` · W: coach_availability, group_class_athletes · R: coach_availability · uso: usado (coach_availability)
  - Si no se resuelve school_staff muestra 'No se encontró tu perfil de entrenador. Contacta soporte.' Componente compartido con components/school/AvailabilityManager (escuela/coach)

<a id="r-personal-trainer-trainer-plans"></a>
#### Mis Planes — `/trainer/plans`

- **Rol:** personal_trainer · **Entrada:** menú lateral · Dashboard 'Ver mis planes'
- **Archivo:** `pages/trainer/TrainerPlans.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ Wrapper: duplica /offerings (que en App.tsx:473 excluye a personal_trainer y lleva ModuleGate; aquí se salta ambos).

##### Pestaña «Principal»

- [read] **Listado de planes (OfferingsManagement)** — `pages/trainer/TrainerPlans.tsx:20` · **partial** · gates: `RequirePersonalTrainer && trainerSchoolId` · R: offering_plans / schools (por useSchoolContext().schoolId)
  - Wrapper de 21 líneas sobre OfferingsPage de la escuela (no es placeholder, pero no tiene UI propia). OfferingsManagement toma schoolId de useSchoolContext, no de trainerSchoolId: funciona solo si el contexto de escuela resuelve la micro-escuela del entrenador
- [create] **Crear plan** — `components/universal/OfferingsManagement.tsx:846` · **partial** · W: offering_plans
  - Mismo formulario de la escuela (con categorías/equipos de escuela)
- [dialog] **Compartir / Aplicar a todos** — `components/universal/OfferingsManagement.tsx:826` · **partial**

<a id="r-personal-trainer-trainer-payments"></a>
#### Pagos — `/trainer/payments`

- **Rol:** personal_trainer · **Entrada:** menú lateral · KPI 'Pagos pendientes' del dashboard
- **Archivo:** `pages/trainer/TrainerPayments.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas)
- ⚠ Wrapper: duplica /payments-automation (App.tsx:766 excluye personal_trainer y lleva ModuleGate finanzas_pagos; aquí se saltan).

##### Pestaña «Cobros / Equipos y Planes / Glosas / Conciliación / Historial / Cierre / Débito automático / Config»

- [read] **Panel completo de pagos de la escuela (PaymentsAutomationPage)** — `pages/trainer/TrainerPayments.tsx:20` · **partial** · gates: `RequirePersonalTrainer && trainerSchoolId && isAuthorized incluye personal_trainer (PaymentsAutomationPage.tsx:1145)` · R: payments por useSchoolContext().schoolId · uso: usado (payments)
  - Wrapper de 21 líneas: monta la pantalla de pagos de la escuela entera (Glosas, Conciliación, Cierre de mes, Débito) sin adaptar al entrenador; depende de que useSchoolContext resuelva la micro-escuela
- [update] **Aprobar / rechazar comprobante** — `pages/PaymentsAutomationPage.tsx:1150` · **partial** · W: payments · uso: usado (payments)

<a id="r-personal-trainer-trainer-profile"></a>
#### Mi Perfil Público (editor) — `/trainer/profile`

- **Rol:** personal_trainer · **Entrada:** menú lateral · Dashboard 'Editar mi perfil' / 'Completar perfil'
- **Archivo:** `pages/trainer/TrainerProfileEditor.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «General / Tarifas / Contacto»

- [update] **Guardar perfil** — `pages/trainer/TrainerProfileEditor.tsx:171` · **works** · gates: `requireTrainerAuth` · W: PUT /api/v1/trainer/profile · R: trainer_profiles (useTrainerContext)
- [update] **Publicar perfil** — `pages/trainer/TrainerProfileEditor.tsx:166` · **works** · W: POST /api/v1/trainer/profile/publish
- [link] **Copiar enlace / Ver perfil público** — `pages/trainer/TrainerProfileEditor.tsx:511` · **works**
  - Abre /entrenador/:userId

<a id="r-personal-trainer-entrenador-userid"></a>
#### Perfil público del entrenador — `/entrenador/:userId`

- **Rol:** personal_trainer · **Entrada:** sin menú · Ruta pública sin auth (App.tsx:418); enlace desde el editor
- **Archivo:** `pages/trainer/TrainerPublicProfile.tsx` · **Fuente:** `coach.json`
- **Estado (derivado):** works · **Uso:** usado — coach_availability: 734 filas (18 coaches, 13 escuelas)

##### Pestaña «Principal»

- [read] **Ver perfil y disponibilidad** — `pages/trainer/TrainerPublicProfile.tsx:48` · **works** · gates: `público` · R: GET /api/v1/trainer/public/:userId, coach_availability · uso: usado (coach_availability)
  - Lee coach_availability directo con anon

### Módulo: Compartido con otros roles

<a id="r-personal-trainer-enrollments-mi-plan-settings-calendar-messages-profile"></a>
#### Navegación compartida (sidebar + bottom nav) — `/enrollments | /mi-plan | /settings | /calendar | /messages | /profile`

- **Rol:** personal_trainer · **Entrada:** menú lateral + barra inferior · Bottom nav: personal_trainer no tiene case propio en MobileBottomNav.tsx y cae en default (línea 48): Inicio /dashboard, Calendario /calendar, Mensajes /messages, Perfil /profile
- **Archivo:** `config/navigation.ts` · **Fuente:** `coach.json`
- **Estado (derivado):** partial · **Uso:** no medido
- ⚠ El grupo vendedor 'Mi Tienda' nunca se muestra a personal_trainer (isVendorPrimaryRole en AppSidebar.tsx:144), así que /vendor/subscribers (atajo del dashboard) tampoco tiene entrada de menú. BFF /api/v1/trainer/* va detrás de requireTrainerAuth (bff/src/index.ts:472-478), que resuelve schools por owner_id + school_type='personal_trainer' o cae a profiles.role.

##### Pestaña «Principal»

- [navigate] **Mis Inscripciones (/enrollments)** — `config/navigation.ts:890` · **works**
  - Pantalla del atleta/padre; compartida
- [navigate] **Facturación (/mi-plan) y Configuración (/settings)** — `config/navigation.ts:897` · **works**
  - Compartidas con la escuela
- [navigate] **Bottom nav: Inicio** — `components/navigation/MobileBottomNav.tsx:50` · **works**
  - /dashboard redirige a /trainer/dashboard
- [navigate] **Bottom nav: Calendario** — `components/navigation/MobileBottomNav.tsx:51` · **partial** · gates: `ModuleGate gestion_deportiva_calendario (App.tsx:439)`
  - Calendario de la escuela, no la agenda del entrenador (/trainer/availability no está en el bottom nav)
- [navigate] **Bottom nav: Mensajes / Perfil** — `components/navigation/MobileBottomNav.tsx:52` · **works**
  - Genéricos; ni Clientes ni Rutinas llegan al bottom nav

## Acudiente

### Módulo: Inicio

<a id="r-parent-dashboard"></a>
#### Panel de Padre/Madre — `/dashboard`

- **Rol:** parent · **Entrada:** menú lateral + barra inferior · landing tras login; gate redirige a /onboarding/parent si profiles.onboarding_completed=false (DashboardPage.tsx:308)
- **Archivo:** `pages/DashboardPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas) ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1 ¦ notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas) · Usuarios: parent: 908 perfiles · 181 con login 30 d · 871 en 90 d

##### Pestaña «Arranque (efectos automáticos)»

- [link] **Adoptar hijos precargados por la escuela (claim_orphan_children)** — `pages/DashboardPage.tsx:163` · **works** · W: rpc claim_orphan_children
  - Automático en cada carga; sin UI.
- [link] **Aceptar todas las invitaciones pendientes del correo** — `pages/DashboardPage.tsx:176` · **works** · W: rpc accept_invitation_pro (acceptPendingInvitations) · R: rpc get_my_invitations · uso: usado (invitations)
- [read] **Estado de onboarding** — `pages/DashboardPage.tsx:179` · **works** · R: rpc get_onboarding_status, invitations · uso: usado (invitations)

##### Pestaña «Accesos rápidos y banners»

- [navigate] **Tienes N pago(s) pendiente(s) — Toca para pagar ahora** — `pages/DashboardPage.tsx:533` · **partial** · gates: `profile.role==='parent' && upcoming_payments>0` · R: payments (parent_id=yo, status in pending/overdue/partial/awaiting_approval) · uso: usado (payments)
  - Con 1 cobro → /my-payments?pay=auto (abre checkout); con varios → /my-payments. Cuenta solo por payments.parent_id: cobros con parent_id NULL (hijo sin cuenta vinculada al cobro) no suman aquí aunque Mis Pagos sí los lista por child_id.
- [link] **Banner de invitación — Aceptar** — `components/dashboard/InvitationBanner.tsx:67` · **works** · gates: `invitación pending para el correo` · W: rpc accept_invitation_pro · uso: usado (invitations)
  - Recarga la página tras aceptar.
- [update] **Banner de invitación — Rechazar** — `components/dashboard/InvitationBanner.tsx:31` · **works** · W: invitations.status=rejected (update directo) · uso: usado (invitations)
- [navigate] **Torneos abiertos — Inscribir** — `components/dashboard/OpenTournamentsCard.tsx:53` · **works** · gates: `profile.role in parent/athlete && hay torneos abiertos` · R: BFF GET /api/v1/tournaments/my-open-tournaments
- [pay] **Inscripción pendiente (venía de /schools/:id sin sesión) — elegir hijo + pagar** — `components/dashboard/PendingEnrollmentModal.tsx:51` · **partial** · gates: `localStorage pending_enrollment` · W: enrollments insert status=active desde el cliente, transactionsAPI.processPurchase · R: rpc get_school_payment_info
  - PaymentModal simula el procesamiento (setTimeout 1500 ms, PaymentModal.tsx:151) y luego el cliente inserta la inscripción directo como active sin validar pago; viola la regla de RPC transaccional. Solo llega desde SchoolDetailPage → EnrollmentAuthModal (flujo legado).
- [navigate] **Activar Mi Tienda (CTA)** — `components/vendor/ActivateStoreCTA.tsx:70` · **hidden**
  - parent no está en ELIGIBLE_ROLES; nunca se muestra al acudiente.

##### Pestaña «Checklist de onboarding»

- [navigate] **Vincular Hijo → /children** — `hooks/useDashboardConfig.ts:80` · **works**
- [navigate] **Ficha Médica → /children** — `hooks/useDashboardConfig.ts:81` · **duplicated**
  - Mismo destino que Vincular Hijo; no hay pantalla de ficha médica propia (se edita en EditChildDialog).
- [navigate] **Aceptar Invitación → /notifications** — `hooks/useDashboardConfig.ts:82` · **partial**
  - La invitación se acepta en el banner del dashboard, no en /notifications.
- [navigate] **Validar Datos → /profile** — `hooks/useDashboardConfig.ts:83` · **works**
  - Única entrada visible a /profile para el padre.
- [navigate] **Suscripciones → /my-payments** — `hooks/useDashboardConfig.ts:84` · **works**

##### Pestaña «Estadísticas»

- [read] **Hijos inscritos en academias** — `hooks/useDashboardStatsReal.ts:279` · **partial** · R: children (parent_id)
  - Cuenta todos los children del padre, inscritos o no (el texto dice "inscritos").
- [read] **Asistencia promedio (30 días)** — `hooks/useDashboardStatsReal.ts:289` · **works** · R: attendance_records (child_id in hijos) · uso: usado (attendance_records)
- [read] **Mensualidades pendientes** — `hooks/useDashboardStatsReal.ts:306` · **partial** · R: payments (parent_id) · uso: usado (payments)
  - Mismo sesgo parent_id que el banner.
- [read] **Notificaciones sin leer** — `hooks/useDashboardStatsReal.ts:314` · **works** · R: notifications · uso: usado (notifications)

##### Pestaña «Acciones rápidas»

- [navigate] **Mis Pagos** — `hooks/useDashboardConfig.ts:187` · **duplicated**
  - Duplica banner, stat card, sidebar y bottom nav.
- [navigate] **Agregar Hijo → /children** — `hooks/useDashboardConfig.ts:188` · **works**
  - Lleva a la lista, no abre el diálogo.
- [navigate] **Ver Equipos → /explore** — `hooks/useDashboardConfig.ts:189` · **partial**
  - /explore redirige a /explorar (ruta pública fuera del layout); Explorar está oculto del menú en prod (SHOW_EXPLORE=DEV) pero este botón sí lleva ahí.
- [read] **Lista de notificaciones (5 últimas)** — `pages/DashboardPage.tsx:692` · **works** · R: notifications · uso: usado (notifications)

### Módulo: Hijos

<a id="r-parent-children"></a>
#### Familia SportMaps (Mis Hijos) — `/children`

- **Rol:** parent · **Entrada:** menú lateral + barra inferior · checklist dashboard, acción rápida
- **Archivo:** `pages/MyChildrenPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ children: 1.100 menores · 511 con parent_id · 589 sin parent_id

##### Pestaña «Lista de hijos»

- [read] **Listar hijos con equipo/plan activo** — `pages/MyChildrenPage.tsx:39` · **works** · gates: `ProtectedRoute allowedRoles=['parent']` · R: children, schools, teams, enrollments, offering_plans, offerings
- [navigate] **Aviso "{escuela} ya cargó a {hijo}" — Ir a aceptar la invitación** — `pages/MyChildrenPage.tsx:153` · **works** · gates: `invitación pending por correo` · R: invitations · uso: usado (invitations)
- [create] **Registrar Hijo** — `components/children/AddChildDialog.tsx:255` · **partial** · W: children insert (lib/api/parents.ts:86), storage avatars, storage identity-documents
  - Wizard por pasos; exige PDF de documento. Crea el child SIN escuela ni inscripción (queda huérfano hasta que una escuela lo vincule): riesgo de identidades duplicadas con las que la escuela ya cargó.
- [update] **Editar hijo (lápiz)** — `components/children/EditChildDialog.tsx:199` · **works** · W: children update
- [navigate] **Progreso** — `pages/MyChildrenPage.tsx:270` · **works**
  - → /academic-progress?childId=
- [navigate] **Asistencia** — `pages/MyChildrenPage.tsx:276` · **works**
  - → /parent-attendance?childId=
- [navigate] **Informes** — `pages/MyChildrenPage.tsx:282` · **works**
  - → /children/:id/reports. Única entrada a Informes Mensuales.
- [upload] **Subir documentos** — `components/children/UploadChildDocumentsDialog.tsx:116` · **works** · W: storage identity-documents upload · R: storage identity-documents list
- [delete] **Eliminar documento** — `components/children/UploadChildDocumentsDialog.tsx:134` · **works** · W: storage identity-documents remove
- [create] **Solicitar pausa (vacaciones/lesión)** — `hooks/usePauses.ts:74` · **hidden** · gates: `pause_config_for_enrollment.enabled && inscripción activa` · W: rpc request_enrollment_pause · R: rpc pause_config_for_enrollment, enrollment_pause_requests
  - Se autooculta si la escuela no habilitó pausas; enrollment_pause_requests tiene 0 filas.
- [delete] **Retirar solicitud de pausa** — `hooks/usePauses.ts:100` · **hidden** · W: rpc cancel_enrollment_pause_request
  - Igual que solicitar pausa.

### Módulo: Calendario

<a id="r-parent-calendar"></a>
#### Calendario Familiar — `/calendar`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/CalendarPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Mes + próximos eventos»

- [read] **Ver eventos (escuela activa + propios)** — `pages/CalendarPage.tsx:318` · **partial** · gates: `ModuleGate gestion_deportiva_calendario (no aplica a parent: solo gatea roles de escuela)` · R: calendar_events (RLS: equipos de los hijos), profiles
  - Solo eventos de la escuela ACTIVA del contexto; un padre con hijos en dos escuelas ve una a la vez. No muestra horarios de clase/sesiones, solo calendar_events.
- [navigate] **Navegar mes / Hoy** — `pages/CalendarPage.tsx:629` · **works**
- [create] **Nuevo Evento (encabezado)** — `pages/CalendarPage.tsx:611` · **hidden** · gates: `PermissionGate calendar:create`
  - parent no tiene calendar:create (lib/permissions.ts:71).
- [create] **Crear Evento (estado vacío)** — `pages/CalendarPage.tsx:718` · **partial** · W: calendar_events insert (target private)
  - Este botón NO está detrás del PermissionGate: el padre puede crear eventos privados desde el estado vacío aunque el botón principal esté oculto. Inconsistente.
- [update] **Editar / Eliminar evento propio** — `pages/CalendarPage.tsx:523` · **works** · gates: `event.user_id = yo` · W: calendar_events update/delete

### Módulo: Explorar

<a id="r-parent-explorar"></a>
#### Explorar — `/explorar`

- **Rol:** parent · **Entrada:** sin menú · Solo en DEV (SHOW_EXPLORE=import.meta.env.DEV) en sidebar y bottom nav; en prod se llega por /explore desde acción rápida "Ver Equipos" y botones "Buscar equipos/Ver membresías" de Mis Inscripciones, y desde Mis citas "Buscar profesional"
- **Archivo:** `pages/ExplorarGlobalPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** hidden · **Uso:** no medido

##### Pestaña «Explorar»

- [read] **Explorar escuelas/eventos/servicios** — `pages/ExplorarGlobalPage.tsx:1` · **hidden** · gates: `SHOW_EXPLORE (menú)` · R: BFF explorar
  - Oculto del menú en prod pero alcanzable por enlaces internos; ruta pública fuera del layout autenticado (sin sidebar).

### Módulo: Seguimiento

<a id="r-parent-academic-progress"></a>
#### Centro de Alto Rendimiento (Progreso Deportivo) — `/academic-progress`

- **Rol:** parent · **Entrada:** menú lateral · botón Progreso en tarjeta de hijo (?childId=)
- **Archivo:** `pages/AcademicProgressPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)

##### Pestaña «Selector de deportista»

- [navigate] **Elegir deportista** — `pages/AcademicProgressPage.tsx:517` · **works** · R: children (parent_id)

##### Pestaña «🏫 Escuela»

- [read] **Progreso Deportivo (métricas del deporte)** — `components/performance/PerformanceEvolutionSection.tsx:29` · **works** · R: performance_entries / sport_metric_definitions (useAthletePerformanceEvolution) · uso: usado (performance_entries)
- [read] **Evolución de Habilidades** — `pages/AcademicProgressPage.tsx:417` · **dead** · R: academic_progress
  - academic_progress tiene ~5 filas; el propio código dice que "nadie la carga" (línea 604). Muestra "Sin evaluaciones registradas aún".
- [read] **Feedback del entrenador (comentarios)** — `pages/AcademicProgressPage.tsx:672` · **dead** · R: academic_progress.comments
  - Misma tabla vacía.
- [read] **Resumen Global** — `pages/AcademicProgressPage.tsx:696` · **dead**
  - Solo aparece si hay academic_progress.

##### Pestaña «💪 Entrenador PT»

- [dialog] **Historial de sesiones PT + detalle** — `pages/AcademicProgressPage.tsx:773` · **hidden** · gates: `hasPT (trainer_session_plans.client_id=hijo)` · R: trainer_session_plans, trainer_profiles
  - Tab solo visible si el hijo tiene sesiones de entrenador personal (87 filas totales).
- [read] **Progreso por ejercicio** — `pages/AcademicProgressPage.tsx:832` · **hidden** · gates: `hasPT`

##### Pestaña «📏 Bienestar»

- [read] **Módulo de bienestar (WellnessModule, solo lectura)** — `pages/AcademicProgressPage.tsx:876` · **hidden** · gates: `hasPT`

<a id="r-parent-children-id-progress"></a>
#### Progreso de hijo (ruta por id) — `/children/:id/progress`

- **Rol:** parent · **Entrada:** sin menú · sin enlaces entrantes
- **Archivo:** `pages/AcademicProgressPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Igual a /academic-progress»

- [read] **Misma pantalla con :id** — `App.tsx:528` · **duplicated**
  - Mismo componente que /academic-progress; ningún enlace del front apunta a esta ruta (MyChildrenPage usa ?childId=).

<a id="r-parent-parent-attendance"></a>
#### Registro de Asistencia — `/parent-attendance`

- **Rol:** parent · **Entrada:** menú lateral · botón Asistencia en tarjeta de hijo
- **Archivo:** `pages/AttendancePage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1

##### Pestaña «Asistencia»

- [navigate] **Elegir hijo** — `pages/AttendancePage.tsx:17` · **works** · R: children
- [read] **Historial de asistencia** — `pages/AttendancePage.tsx:58` · **works** · R: attendance_records (child_id) · uso: usado (attendance_records)
- [read] **Sesiones PT asistidas** — `pages/AttendancePage.tsx:73` · **hidden** · R: trainer_session_plans
  - Solo con entrenador personal.

<a id="r-parent-children-id-attendance"></a>
#### Asistencia de hijo (ruta por id) — `/children/:id/attendance`

- **Rol:** parent · **Entrada:** sin menú · sin enlaces entrantes
- **Archivo:** `pages/AttendancePage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Igual a /parent-attendance»

- [read] **Misma pantalla con :id** — `App.tsx:533` · **duplicated**
  - Mismo componente que /parent-attendance. Además pages/ChildAttendancePage.tsx (331 líneas) está importado en App.tsx:100 pero no se usa en ninguna ruta: código muerto.

<a id="r-parent-children-id-reports"></a>
#### Informes Mensuales — `/children/:id/reports`

- **Rol:** parent · **Entrada:** sin menú · botón Informes en tarjeta de hijo; correo con enlace
- **Archivo:** `pages/ChildReportsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alguna vez 5 · enviados 90 d 23

##### Pestaña «Lista»

- [read] **Listar informes del hijo** — `pages/ChildReportsPage.tsx:29` · **works** · gates: `allowedRoles=['parent']` · R: athlete_reports (useAthleteReports child), children · uso: usado (athlete_reports)
- [navigate] **Abrir informe** — `pages/ChildReportsPage.tsx:66` · **works**

<a id="r-parent-children-id-reports-reportid"></a>
#### Detalle de informe mensual — `/children/:id/reports/:reportId`

- **Rol:** parent · **Entrada:** sin menú · desde Informes Mensuales / correo
- **Archivo:** `pages/ChildReportDetailPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alguna vez 5 · enviados 90 d 23

##### Pestaña «Detalle»

- [read] **Ver informe (snapshot de métricas, notas por equipo)** — `pages/ChildReportDetailPage.tsx:41` · **works** · W: athlete_reports.viewed_at (probable, vía hook) · R: athlete_reports (useAthleteReportDetail) · uso: usado (athlete_reports)
- [export] **Descargar PDF** — `pages/ChildReportDetailPage.tsx:97` · **works** · R: BFF GET /api/v1/athlete-reports/:id/pdf (403 si no publicado / no dueño)
  - Fallback hardcodeado a sportmaps-bff-prod.onrender.com si falta VITE_BFF_URL (lib/school/reportsQueries.ts:121).
- [navigate] **Volver a informes** — `pages/ChildReportDetailPage.tsx:83` · **works**

<a id="r-parent-children-id-post-entreno-informe"></a>
#### Evaluación post-entrenamiento (informe grupal) — `/children/:id/post-entreno-informe`

- **Rol:** parent · **Entrada:** sin menú · NINGUNO
- **Archivo:** `pages/ChildPostTrainingReportPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** hidden · **Uso:** usado — team_reports 90 d: 15

##### Pestaña «Informe»

- [read] **Ver agregado del equipo con el dato del hijo** — `pages/ChildPostTrainingReportPage.tsx:179` · **hidden** · R: children, enrollments, BFF GET /api/v1/school/reports/team/:teamId/preview-for-parent (gate children.parent_id + inscripción activa)
  - Sin ningún enlace entrante en front ni BFF (grep "post-entreno-informe" solo en App.tsx). Pantalla huérfana.

### Módulo: Pagos

<a id="r-parent-my-payments"></a>
#### Mis Pagos — `/my-payments`

- **Rol:** parent · **Entrada:** menú lateral + barra inferior · banner dashboard ?pay=auto; ?pay=<id> desde correos/WhatsApp; stat card; checklist; acción rápida
- **Archivo:** `pages/MyPaymentsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas) ¦ comprobantes 90 d: app o escuela 486 (266 pagadores, 15 escuelas) · vía WhatsApp 56 (51 pagadores, 2 escuelas)

##### Pestaña «Encabezado y resumen»

- [read] **Carga de cobros (por parent_id O child_id de mis hijos)** — `pages/MyPaymentsPage.tsx:217` · **works** · gates: `allowedRoles parent/athlete; el useEffect redirige athlete→/athlete-payments (l.182) && sidebar: oculto si !hasBilling` · R: children, payments_with_installments, payments, schools, school_settings, enrollments, electronic_invoices, BFF GET /api/v1/payments/glosas/mine · uso: usado (payments)
- [pay] **Atajo ?pay=<id>\|auto abre el checkout** — `pages/MyPaymentsPage.tsx:527` · **works**
  - auto solo actúa con exactamente 1 cobro pagable.
- [navigate] **Estado de cuenta — {hijo}** — `pages/MyPaymentsPage.tsx:670` · **works** · gates: `hijo con inscripción activa`
  - → /estado-cuenta?child_id=
- [read] **Tarjetas Pendientes / Monto pendiente / Pagos realizados** — `pages/MyPaymentsPage.tsx:680` · **works**
- [pay] **Nuevo Pago (¿Para quién es el pago?)** — `pages/MyPaymentsPage.tsx:651` · **partial** · W: payments insert (mode create) · R: enrollments activos · uso: usado (payments)
  - El monto sale de teams.price_monthly (l.776), ignora enrollments.monthly_fee y el plan (fuente correcta: monthly_fee > plan > teams.price_monthly): inscripciones por plan sin equipo quedan en $0. Crea un cobro nuevo en vez de pagar el existente → riesgo de duplicado.

##### Pestaña «Débito automático»

- [toggle] **Sugerencia: activar débito** — `pages/MyPaymentsPage.tsx:658` · **partial** · R: BFF GET /api/v1/autopay/mine
  - Se oculta si el BFF no responde; F2 del BFF sin commitear según memoria.
- [create] **Activar débito automático** — `components/autopay/DebitoAutomaticoCard.tsx:265` · **partial** · W: BFF /api/v1/autopay/*
- [update] **Saltar mes / Cambiar tope / Cambiar medio / Cancelar** — `components/autopay/DebitoAutomaticoCard.tsx:236` · **partial** · W: BFF /api/v1/autopay/*

##### Pestaña «Factura electrónica a mi nombre»

- [update] **Datos de facturación del pagador** — `components/billing/MiFacturaElectronicaCard.tsx:51` · **works** · W: payer_billing_profiles · R: payer_billing_profiles, profiles

##### Pestaña «Todas / Aprobadas / Pendientes»

- [navigate] **Filtrar por pestaña** — `pages/MyPaymentsPage.tsx:733` · **works**
- [pay] **PAGAR (en la tarjeta del cobro)** — `pages/MyPaymentsPage.tsx:1122` · **works**
  - Abre PaymentCheckoutModal mode=update.
- [pay] **Seleccionar tarjeta → barra flotante "Pagar Ahora"** — `pages/MyPaymentsPage.tsx:888` · **duplicated**
  - Segundo camino al mismo checkout (el botón PAGAR ya lo abre en 1 clic).
- [pay] **ABONAR (cobro parcial)** — `pages/MyPaymentsPage.tsx:1108` · **works** · gates: `status='partial'`
  - Reusa el checkout; queda awaiting_approval.
- [dialog] **RECIBO (ver comprobante)** — `pages/MyPaymentsPage.tsx:1094` · **partial** · R: storage payment-receipts signedUrl
  - El visor usa <img>: comprobantes PDF no se ven.
- [navigate] **FACTURA (abrir factura electrónica)** — `pages/MyPaymentsPage.tsx:1079` · **works** · gates: `electronic_invoices accepted/sent` · R: electronic_invoices.public_url
- [update] **RESPONDER glosa** — `components/payment/GlosaRespondModal.tsx:14` · **partial** · gates: `status='glosado' && glosa abierta` · W: BFF POST /api/v1/payments/glosas/:id/respond
  - payment_glosas tiene 2 filas en total.

##### Pestaña «Checkout (PaymentCheckoutModal)»

- [read] **Bloqueo "Pago en espera de validación"** — `components/payment/PaymentCheckoutModal.tsx:1070` · **works** · R: payments awaiting_approval del mismo periodo · uso: usado (payments)
- [create] **Tipo de pago (solo mode create): mensualidad, inscripción, otros + uniformes/torneo** — `components/payment/PaymentCheckoutModal.tsx:1092` · **works** · R: school_settings, school_merchandise_items, school_tournament_items
- [pay] **Pagar online (Wompi)** — `components/payment/PaymentCheckoutModal.tsx:435` · **works** · gates: `school_settings.wompi_enabled && datos DIAN completos si la escuela factura (dianDataOk)` · W: payments insert pending provider=wompi si es create (l.462) · R: BFF POST /api/v1/payments/create-session (IDOR: parent_id/user_id o tutela por children.parent_id) · uso: usado (payments)
  - Recargo online visible como badge.
- [pay] **MercadoPago** — `components/payment/PaymentCheckoutModal.tsx:627` · **dead**
  - Kill switch mpEnabled=false (SEG-23); todo el código del Brick es inalcanzable.
- [read] **Transferencia / Nequi / Daviplata — copiar datos y ver QR** — `components/payment/PaymentCheckoutModal.tsx:1338` · **works** · R: school_settings (bank_*, nequi, daviplata, breb, payment_qr_url, payment_accounts)
- [upload] **Sube tu comprobante (con OCR y veredicto)** — `components/payment/PaymentCheckoutModal.tsx:1385` · **works** · W: storage payment-receipts · R: BFF POST /api/v1/payments/extract-receipt
  - Bloqueo estricto solo en mensualidad/inscripción fija.
- [update] **Enviar comprobante** — `components/payment/PaymentCheckoutModal.tsx:872` · **works** · W: payments update (receipt_url, ocr_*, receipt_verdict*, status=awaiting_approval) o insert (l.884) · uso: usado (payments)
  - Escritura directa desde el cliente a payments (depende de RLS).
- [update] **Auto-evaluación del comprobante (verde/amarillo)** — `components/payment/PaymentCheckoutModal.tsx:911` · **partial** · W: BFF POST /api/v1/payments/glosas/auto-evaluate
  - El BFF exige payments.parent_id = usuario (glosas.routes.ts:~155); cobros con parent_id NULL (pagados por tutela) dan 403 silencioso (fire-and-forget) y nunca se autoaprueban.

<a id="r-parent-estado-cuenta"></a>
#### Estado de Cuenta — `/estado-cuenta`

- **Rol:** parent · **Entrada:** sin menú · botón "Estado de cuenta — {hijo}" en Mis Pagos
- **Archivo:** `pages/AccountStatementPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Estado de cuenta»

- [read] **Ver resumen, meses y movimientos** — `pages/AccountStatementPage.tsx:43` · **works** · gates: `allowedRoles incluye parent; gate real en la RPC (children.parent_id=auth.uid())` · R: rpc get_athlete_account_statement
- [export] **Imprimir** — `pages/AccountStatementPage.tsx:132` · **works**
  - Abre ventana HTML y window.print.

<a id="r-parent-parent-checkout"></a>
#### Checkout de padre (QR de inscripción) — `/parent-checkout`

- **Rol:** parent · **Entrada:** sin menú · solo desde JoinSchoolPublicPage (QR de inscripción) ?payment_id&school_id&child_id&qr_id; fuera del layout
- **Archivo:** `pages/ParentCheckoutPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas)

##### Pestaña «Checkout»

- [pay] **Pagar online (Wompi)** — `pages/ParentCheckoutPage.tsx:507` · **works** · gates: `school_settings.wompi_enabled o payment_settings.allow_online legado` · R: BFF POST /api/v1/payments/create-session
- [upload] **Pago manual con comprobante** — `pages/ParentCheckoutPage.tsx:612` · **duplicated** · W: storage payment-receipts, payments update/insert (l.433/438), rpc notify_user (l.495) · uso: usado (payments)
  - Reimplementa PaymentCheckoutModal (1117 líneas). Además notifica a mano con notify_user, cuando el modal dejó eso al job receipt-review-alerts → aviso doble a la escuela.
- [export] **Descargar recibo** — `pages/ParentCheckoutPage.tsx:725` · **works**
- [read] **Valores por defecto de demo** — `pages/ParentCheckoutPage.tsx:143` · **partial**
  - Sin params: amount=150000 y concept="Mensualidad Octubre 2024" (l.143/148); email fallback demo@sportmaps.co (l.553).

<a id="r-parent-payment-result"></a>
#### Resultado de pago (Wompi) — `/payment-result`

- **Rol:** parent · **Entrada:** sin menú · redirectUrl del widget Wompi (lib/api/wompi.ts:223); pública
- **Archivo:** `pages/PaymentResultPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Resultado»

- [read] **Consultar transacción ?id=** — `pages/PaymentResultPage.tsx:18` · **works** · R: Wompi transaction
- [export] **Descargar comprobante / Volver al inicio** — `pages/PaymentResultPage.tsx:166` · **works**

<a id="r-parent-pagos-confirmacion"></a>
#### Confirmación de pago — `/pagos/confirmacion`

- **Rol:** parent · **Entrada:** sin menú · sin referencias entrantes encontradas
- **Archivo:** `pages/PaymentConfirmationPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Confirmación»

- [read] **Ver estado por ?id o ?token** — `pages/PaymentConfirmationPage.tsx:82` · **duplicated** · R: BFF GET /api/v1/payments/link/:token
  - Hace lo mismo que /payment-result; ningún código del front ni del BFF genera esta URL como redirect.

### Módulo: Tienda

<a id="r-parent-mi-tienda"></a>
#### Tienda (redirección) — `/mi-tienda`

- **Rol:** parent · **Entrada:** menú lateral + barra inferior · botón "Ir a la tienda" en Mis compras
- **Archivo:** `pages/MiTiendaPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** hidden · **Uso:** no medido

##### Pestaña «Entrada»

- [navigate] **Redirige a /tienda/:slug si la tienda de la escuela vende** — `pages/MiTiendaPage.tsx:25` · **hidden** · gates: `StoreGate (store_enabled) && buyerStore=store (useMySchoolStore.showStore)` · R: BFF /marketplace/school-store/:schoolId
  - Visible solo si la escuela activa tiene tienda vendiendo; si no, aviso "La tienda aún no está disponible".

<a id="r-parent-mis-compras"></a>
#### Mis compras — `/mis-compras`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/MisComprasPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — orders 90 d: 3

##### Pestaña «Pedidos»

- [read] **Listar pedidos** — `lib/api/storeApi.ts:227` · **hidden** · gates: `StoreGate && buyerStore=purchases` · R: BFF GET /api/v1/marketplace/orders
  - orders: 4 filas.
- [navigate] **Ver código de retiro** — `pages/MisComprasPage.tsx:91` · **works**

<a id="r-parent-mis-compras-orderid"></a>
#### Detalle de compra — `/mis-compras/:orderId`

- **Rol:** parent · **Entrada:** sin menú · desde Mis compras
- **Archivo:** `pages/MiCompraDetallePage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Pedido»

- [upload] **Subir comprobante** — `pages/MiCompraDetallePage.tsx:335` · **works** · W: BFF POST /api/v1/store/orders/:id/receipt-url + /receipt
- [pay] **Pagar ahora (Wompi)** — `pages/MiCompraDetallePage.tsx:384` · **works**
- [update] **Ya lo recibí** — `pages/MiCompraDetallePage.tsx:387` · **works** · W: BFF POST /api/v1/store/orders/:id/received
- [update] **Cancelar pedido** — `pages/MiCompraDetallePage.tsx:390` · **works** · W: BFF POST /api/v1/store/orders/:id/cancel
- [update] **Generar código de retiro nuevo** — `pages/MiCompraDetallePage.tsx:283` · **works** · W: BFF POST /api/v1/store/orders/:id/pickup-code

### Módulo: Comunicación

<a id="r-parent-messages"></a>
#### Mensajes — `/messages`

- **Rol:** parent · **Entrada:** menú lateral + barra inferior · bottom nav lo rotula "Chat"
- **Archivo:** `pages/MessagesPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** broken · **Uso:** sin uso — messages: 0

##### Pestaña «Conversaciones»

- [read] **Listar conversaciones** — `pages/MessagesPage.tsx:43` · **broken** · R: messages, profiles · uso: sin uso (messages)
  - messages tiene 0 filas; no hay botón para redactar ni responder (solo lectura). Siempre muestra "Sin mensajes aún". Está en el sidebar Y en el bottom nav (1 de 5 slots móviles).
- [read] **Buscar conversaciones** — `pages/MessagesPage.tsx:153` · **dead**

### Módulo: Actividad

<a id="r-parent-enrollments"></a>
#### Portal Familiar (Mis Inscripciones) — `/enrollments`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/MyEnrollmentsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — session_bookings 90 d: atleta 17 · sin usuario 28

##### Pestaña «Selector de hijo»

- [navigate] **Elegir hijo** — `pages/MyEnrollmentsPage.tsx:263` · **works** · R: children

##### Pestaña «Mis Grupos»

- [read] **Equipos y planes activos** — `hooks/useEnrollments.ts:102` · **works** · R: BFF GET /api/v1/enrollments/my-plan?child_id (gate children.parent_id)
- [dialog] **Abrir equipo (detalle)** — `pages/MyEnrollmentsPage.tsx:331` · **works**
- [dialog] **Abrir plan → agendar clases** — `pages/MyEnrollmentsPage.tsx:349` · **works**
- [navigate] **Buscar equipos / Ver membresías → /explore** — `pages/MyEnrollmentsPage.tsx:326` · **partial**
  - Lleva a Explorar, oculto en el menú de prod.

##### Pestaña «Mis Clases»

- [create] **Agendar clase (créditos del plan)** — `pages/MyEnrollmentsPage.tsx:1293` · **works** · W: BFF /api/v1/session-bookings · uso: usado (session_bookings)
- [delete] **Cancelar clase** — `pages/MyEnrollmentsPage.tsx:580` · **works** · W: BFF /api/v1/session-bookings (cancel) · uso: usado (session_bookings)
- [create] **Agendar sesión PT** — `pages/MyEnrollmentsPage.tsx:1612` · **hidden** · R: BFF GET /api/v1/athlete/training/pt-availability
  - Solo con entrenador personal.

##### Pestaña «Mis Reservas»

- [create] **Reservar instalación** — `pages/MyEnrollmentsPage.tsx:495` · **hidden** · R: BFF session-bookings facilities
  - Solo si el plan incluye instalaciones.
- [delete] **Cancelar reserva** — `pages/MyEnrollmentsPage.tsx:2061` · **works**

##### Pestaña «Clase de Prueba»

- [create] **Agendar clase de prueba** — `pages/MyEnrollmentsPage.tsx:517` · **hidden** · gates: `trial-classes-self settings habilitado` · R: BFF /api/v1/trial-classes-self/*
  - Copy con voseo ("¿Querés probar…?", l.513).

<a id="r-parent-my-event-registrations"></a>
#### Mis Inscripciones a Eventos — `/my-event-registrations`

- **Rol:** parent · **Entrada:** menú lateral · tras inscribirse a un evento público (EventIndividualRegisterPage.tsx:164); ruta FUERA del layout (sin sidebar)
- **Archivo:** `pages/events/MyEventRegistrationsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** usado — event_registrations 90 d: 4

##### Pestaña «Lista»

- [read] **Listar inscripciones** — `pages/events/MyEventRegistrationsPage.tsx:81` · **partial** · R: BFF GET /api/v1/events/my-registrations/list (event_registrations.user_id=yo)
  - event_registrations: 6 filas. Filtra por user_id del padre; la ruta está fuera del AuthenticatedLayout, así que el padre pierde el sidebar al entrar desde el menú.
- [navigate] **Explorar eventos → /events** — `pages/events/MyEventRegistrationsPage.tsx:121` · **partial**
  - /events redirige a /explorar (oculto en prod).

<a id="r-parent-tournaments-eventid-register"></a>
#### Inscripción a torneo de la escuela — `/tournaments/:eventId/register`

- **Rol:** parent · **Entrada:** sin menú · tarjeta Torneos abiertos del dashboard
- **Archivo:** `pages/events/TournamentRegisterPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Inscripción»

- [create] **Elegir hijo y categoría — Inscribir** — `pages/events/TournamentRegisterPage.tsx:81` · **partial** · gates: `allowedRoles parent/athlete && hijo matriculado en la escuela` · W: BFF POST /school-tournaments/:id/register · R: BFF GET /school-tournaments/:id/for-participant, children
  - Funciona; copy con voseo ("Elegí un hijo", "Seleccioná", "Ya podés pagar") — usuario colombiano.
- [pay] **Pagar inscripción** — `pages/events/TournamentRegisterPage.tsx:172` · **works**
  - Abre PaymentCheckoutModal con payment_id del registro.
- [navigate] **Ver resultados** — `pages/events/TournamentRegisterPage.tsx:189` · **works**

### Módulo: Salud

<a id="r-parent-salud"></a>
#### Mi salud (Salud de mis hijos) — `/salud`

- **Rol:** parent · **Entrada:** menú lateral · Mis citas "Ver mi plan de salud"; tras aceptar invitación clínica
- **Archivo:** `pages/clinical/MyHealthPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** sin uso — clinical_patients: 0 ¦ health_records: 0

##### Pestaña «Plan por paciente (hijo o yo)»

- [read] **Resumen de salud** — `pages/clinical/MyHealthPage.tsx:472` · **partial** · R: rpc get_my_health_summary
  - Título "Mi salud" y copy en 2ª persona aunque el menú dice "Salud de mis hijos". Vacío salvo que un profesional de salud atienda al hijo.
- [update] **Autorizar consentimientos pendientes** — `pages/clinical/MyHealthPage.tsx:112` · **works** · W: rpc grant_clinical_consents
- [toggle] **Marcar ejercicio hecho / deshacer** — `pages/clinical/MyHealthPage.tsx:224` · **works** · W: rpc log_exercise_done, rpc unlog_exercise_done
- [navigate] **Ver todas mis citas** — `pages/clinical/MyHealthPage.tsx:354` · **works**
- [delete] **Revocar autorización** — `pages/clinical/MyHealthPage.tsx:391` · **works** · W: rpc revoke_clinical_consent
- [navigate] **WhatsApp / llamar al profesional** — `pages/clinical/MyHealthPage.tsx:445` · **works**

<a id="r-parent-salud-invitacion-token"></a>
#### Aceptar invitación clínica — `/salud/invitacion/:token`

- **Rol:** parent · **Entrada:** sin menú · enlace enviado por el profesional
- **Archivo:** `pages/clinical/ClinicalInviteAcceptPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Invitación»

- [link] **Elegir para quién (yo / hijo) y aceptar** — `pages/clinical/ClinicalInviteAcceptPage.tsx:205` · **works** · W: rpc accept_clinical_invite · R: rpc get_clinical_invite

<a id="r-parent-wellness-appointments"></a>
#### Mis citas — `/wellness/appointments`

- **Rol:** parent · **Entrada:** menú lateral · desde Mi salud
- **Archivo:** `pages/wellness/MyAppointmentsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** sin uso — wellness_appointments 90 d: 0

##### Pestaña «Próximas / Pasadas»

- [read] **Listar citas propias y de los hijos** — `pages/wellness/MyAppointmentsPage.tsx:58` · **works** · R: children, citas de servicio (rpc/consulta en lib/clinical)
- [update] **Cancelar cita** — `pages/wellness/MyAppointmentsPage.tsx:292` · **works** · W: rpc cancel_my_appointment
- [navigate] **Buscar profesional → /explorar?category=services** — `pages/wellness/MyAppointmentsPage.tsx:201` · **partial**
  - Explorar oculto en prod.
- [navigate] **Ver mi plan de salud** — `pages/wellness/MyAppointmentsPage.tsx:198` · **works**

### Módulo: Documentos

<a id="r-parent-my-cards"></a>
#### Carnets de mis hijos — `/my-cards`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/MyAthleteCardsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_id_cards: 499 activos · 0 impresos · 4 escuelas

##### Pestaña «Carnets»

- [read] **Listar carnets (propios y de hijos)** — `pages/MyAthleteCardsPage.tsx:63` · **works** · R: rpc my_athlete_id_cards · uso: usado (athlete_id_cards)
  - Sin gate de módulo en el menú: aparece aunque la escuela no use carnets (athlete_id_cards: 513 filas).
- [dialog] **Vista previa del carnet** — `pages/MyAthleteCardsPage.tsx:90` · **works** · R: rpc verify_athlete_id_card_public · uso: usado (athlete_id_cards)
- [export] **Descargar PNG** — `pages/MyAthleteCardsPage.tsx:238` · **works**

<a id="r-parent-my-certificates"></a>
#### Mis Constancias — `/my-certificates`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/MyCertificatesPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** sin uso — athlete_certificates: 0

##### Pestaña «Constancias»

- [read] **Listar constancias** — `pages/MyCertificatesPage.tsx:62` · **dead** · R: rpc my_athlete_certificates
  - athlete_certificates tiene 0 filas; el ítem del menú no está gateado por el módulo documentos_constancias.
- [create] **Solicitar constancia** — `pages/MyCertificatesPage.tsx:100` · **partial** · W: rpc request_athlete_certificate · R: children, school_certificate_templates
  - Nunca usado (0 filas).
- [navigate] **Ver constancia pública (/cert/:folio)** — `pages/MyCertificatesPage.tsx:180` · **works**
- [export] **Descargar PDF** — `pages/MyCertificatesPage.tsx:122` · **works** · R: BFF GET /api/v1/certificates/:id/signed-url

### Módulo: Cuenta

<a id="r-parent-settings"></a>
#### Configuración — `/settings`

- **Rol:** parent · **Entrada:** menú lateral
- **Archivo:** `pages/SettingsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Perfil»

- [update] **Guardar perfil (nombre, WhatsApp, fecha nac., intereses, bio, avatar)** — `hooks/useSettings.ts:100` · **works** · W: rpc save_profile_settings · R: rpc get_my_settings
  - Muestra en solo lectura los documentos de los hijos.

##### Pestaña «Notificaciones»

- [toggle] **Push / post-entrenamiento** — `hooks/useSettings.ts:132` · **works** · W: rpc save_notification_preferences
  - push_notifications y post_training_opt_out sí se respetan en el BFF (notification.service.ts:106).
- [toggle] **Email / nuevas clases / pedidos / promociones** — `components/settings/NotificationsSection.tsx:60` · **partial** · W: rpc save_notification_preferences
  - email_notifications, activity_alerts, order_updates y marketing_emails no los lee ningún código del BFF: interruptores decorativos.

##### Pestaña «Privacidad»

- [toggle] **Perfil público / aparecer en búsquedas / mostrar estadísticas** — `hooks/useSettings.ts:165` · **partial** · W: rpc save_privacy_preferences
  - Pensado para atleta/coach; el padre no tiene perfil público.

##### Pestaña «Seguridad»

- [update] **Cambiar contraseña** — `hooks/useSettings.ts:312` · **works** · W: supabase.auth.updateUser

<a id="r-parent-profile"></a>
#### Mi Perfil — `/profile`

- **Rol:** parent · **Entrada:** sin menú · solo checklist dashboard "Validar Datos"; el bottom nav del padre no tiene Perfil
- **Archivo:** `pages/ProfilePage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Perfil»

- [update] **Editar / Guardar** — `pages/ProfilePage.tsx:183` · **duplicated** · W: profiles (updateProfile)
  - Duplica la pestaña Perfil de /settings.
- [upload] **Cambiar avatar** — `pages/ProfilePage.tsx:122` · **works** · W: storage avatars
- [read] **Documentos de mis hijos** — `pages/ProfilePage.tsx:323` · **works** · R: children
- [delete] **Eliminar Cuenta** — `pages/ProfilePage.tsx:402` · **dead**
  - Botón sin onClick.

<a id="r-parent-notifications"></a>
#### Notificaciones — `/notifications`

- **Rol:** parent · **Entrada:** sin menú · campana del header (GlobalNotificationBell.tsx:143); checklist "Aceptar Invitación"
- **Archivo:** `pages/NotificationsPage.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas)

##### Pestaña «Todas / filtros»

- [navigate] **Abrir notificación (navega al enlace)** — `pages/NotificationsPage.tsx:205` · **works** · R: notifications · uso: usado (notifications)
- [update] **Marcar como leída** — `pages/NotificationsPage.tsx:76` · **works** · W: notifications.read · uso: usado (notifications)
- [update] **Marcar todas como leídas** — `pages/NotificationsPage.tsx:148` · **works** · W: notifications.read · uso: usado (notifications)
- [delete] **Eliminar** — `pages/NotificationsPage.tsx:106` · **works** · W: notifications delete · uso: usado (notifications)

<a id="r-parent-onboarding-parent"></a>
#### Onboarding de acudiente — `/onboarding/parent`

- **Rol:** parent · **Entrada:** sin menú · redirección forzada desde dashboard si onboarding_completed=false
- **Archivo:** `pages/onboarding/ParentOnboarding.tsx` · **Fuente:** `parent.json`
- **Estado (derivado):** works · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12

##### Pestaña «Tus datos → Siguiente paso»

- [update] **Guardar nombre y teléfono** — `pages/onboarding/ParentOnboarding.tsx:61` · **works** · W: profiles (full_name, phone, onboarding_completed=true)
- [navigate] **Ir al inicio** — `pages/onboarding/ParentOnboarding.tsx:99` · **works**
- [navigate] **Registrar hijo → /children** — `pages/onboarding/ParentOnboarding.tsx:102` · **works**
  - Empuja a registrar a mano aunque la escuela ya lo haya cargado (riesgo de duplicado; mitigado por claim_orphan_children y el aviso en Mis Hijos).

## Deportista

### Módulo: Inicio

<a id="r-athlete-dashboard"></a>
#### Mi Dashboard (rama atleta) — `/dashboard`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral + barra inferior · Destino post-login; config en hooks/useDashboardConfig.ts:110-153
- **Archivo:** `pages/DashboardPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas) ¦ invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 · Usuarios: athlete: 176 perfiles · 18 con login 30 d · 76 en 90 d

##### Pestaña «Panel»

- [navigate] **Tarjeta «Entrenamientos» (este mes)** — `hooks/useDashboardConfig.ts:116` · **works** · R: rpc get_athlete_dashboard_stats (hooks/useDashboardStats.ts:217)
- [navigate] **Tarjeta «Nivel actual» → /stats** — `hooks/useDashboardConfig.ts:123` · **partial** · R: rpc get_athlete_dashboard_stats
  - Solo dice Activo/Sin nivel según activeEnrollments>0; no es un nivel real.
- [navigate] **Tarjeta «Próxima sesión» → /enrollments** — `hooks/useDashboardConfig.ts:130` · **works** · R: rpc get_athlete_dashboard_stats
- [navigate] **Tarjeta «Pagos pendientes» → /athlete-payments** — `hooks/useDashboardConfig.ts:137` · **works** · R: rpc get_athlete_dashboard_stats
- [navigate] **Acciones rápidas: Entrenamientos / Mi Calendario / Mis Inscripciones / Estadísticas** — `hooks/useDashboardConfig.ts:145` · **works**
- [navigate] **Checklist «Completar Perfil» → /profile** — `hooks/useDashboardConfig.ts:91` · **works**
- [navigate] **Checklist «Inscribirse en Equipo» → /explore** — `hooks/useDashboardConfig.ts:92` · **partial**
  - /explore redirige a /explorar, que en prod está oculto del menú (SHOW_EXPLORE = import.meta.env.DEV). El atleta adulto no puede autoinscribirse: lo inscribe la escuela.
- [navigate] **Tarjeta «Torneos abiertos» → Inscribirme** — `components/dashboard/OpenTournamentsCard.tsx:53` · **works** · gates: `role parent\|athlete` · R: BFF /api/v1/events (getMyOpenTournaments)
- [create] **Modal de inscripción pendiente (localStorage) → Confirmar** — `components/dashboard/PendingEnrollmentModal.tsx:51` · **partial** · W: enrollments (insert directo desde el cliente)
  - Insert directo de enrollments desde el navegador (sin RPC). Solo aparece si quedó una inscripción pendiente en localStorage.
- [read] **Lista de notificaciones (últimas 5)** — `pages/DashboardPage.tsx:447` · **works** · R: notifications · uso: usado (notifications)
- [update] **Auto-aceptar invitación (?invite= / pending_invite_id)** — `pages/DashboardPage.tsx:126` · **works** · W: rpc accept_invitation_pro · uso: usado (invitations)

### Módulo: Gestión deportiva

<a id="r-athlete-calendar"></a>
#### Mi Calendario — `/calendar`

- **Rol:** athlete · **Lo usan:** athlete, parent, coach · **Entrada:** menú lateral · Acción rápida del dashboard
- **Archivo:** `pages/CalendarPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Mes»

- [read] **Ver eventos del mes (escuela + propios)** — `pages/CalendarPage.tsx:312` · **works** · gates: `ModuleGate gestion_deportiva_calendario && isParentView (parent\|athlete)` · R: calendar_events, teams, profiles
- [navigate] **Mes anterior / Hoy / Mes siguiente** — `pages/CalendarPage.tsx:629` · **works**
- [read] **Seleccionar día** — `pages/CalendarPage.tsx:663` · **works**
- [create] **Nuevo Evento** — `pages/CalendarPage.tsx:611` · **hidden** · gates: `PermissionGate calendar:create` · W: calendar_events
  - El atleta normalmente no tiene calendar:create; botón oculto para él.

### Módulo: Pagos

<a id="r-athlete-athlete-payments"></a>
#### Mis Pagos (atleta) — `/athlete-payments`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral · Tarjeta del dashboard; push/notificación /my-payments redirige aquí (MyPaymentsPage.tsx:183)
- **Archivo:** `pages/AthletePaymentsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas) ¦ athlete_payments: 0

##### Pestaña «Encabezado»

- [navigate] **Mi estado de cuenta → /estado-cuenta?user_id=** — `pages/AthletePaymentsPage.tsx:333` · **works**
- [export] **Exportar (CSV)** — `pages/AthletePaymentsPage.tsx:338` · **works**
- [dialog] **Nuevo Pago → «Selecciona qué deseas pagar»** — `pages/AthletePaymentsPage.tsx:341` · **works** · R: rpc get_athlete_enrollments (lib/athlete/queries.ts:98)

##### Pestaña «Todas / Aprobadas / Pendientes»

- [read] **Listado de cobros** — `pages/AthletePaymentsPage.tsx:387` · **works** · gates: `ProtectedRoute athlete && redirect si role≠athlete (l.108-111)` · R: rpc get_athlete_payments_v2, electronic_invoices
- [pay] **Pagar cobro → PaymentCheckoutModal** — `pages/AthletePaymentsPage.tsx:523` · **partial** · W: payments (insert/update desde el cliente en PaymentCheckoutModal.tsx:462/704), storage payment-receipts · R: school_settings, payments · uso: usado (payments)
  - El modal crea el cobro con parent_id = user.id también para el atleta adulto (el atleta queda como «acudiente» de sí mismo); monto y concepto salen del cliente.
- [link] **Factura electrónica** — `pages/AthletePaymentsPage.tsx:775` · **works** · R: electronic_invoices
- [dialog] **Comprobante (URL firmada)** — `pages/AthletePaymentsPage.tsx:589` · **works** · R: storage payment-receipts
- [dialog] **Responder glosa del comprobante** — `pages/AthletePaymentsPage.tsx:0` · **dead**
  - NO existe en la versión atleta (0 referencias a glosa). MyPaymentsPage sí tiene GlosaRespondModal. Además glosa-notifications.job.ts solo avisa a payments.parent_id.
- [toggle] **Débito automático / factura electrónica preferida / intento fallido** — `pages/MyPaymentsPage.tsx:157` · **dead**
  - Solo en MyPaymentsPage (padre): useMiDebito habilitado únicamente para role parent.

<a id="r-athlete-my-payments"></a>
#### Mis Pagos (padre) — duplicado — `/my-payments`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · allowedRoles parent+athlete; 25 notificaciones SQL, correos y /p/:token («Ver todos tus pagos») apuntan aquí
- **Archivo:** `pages/MyPaymentsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Redirección»

- [navigate] **Atleta entra → window.location a /athlete-payments** — `pages/MyPaymentsPage.tsx:183` · **duplicated**
  - Dos pantallas de pagos con lógica distinta (814 vs 1154 líneas). El atleta recarga la página entera; pierde glosas, débito automático, MiFacturaElectronicaCard y FailedAttemptChip.

<a id="r-athlete-estado-cuenta"></a>
#### Estado de cuenta — `/estado-cuenta`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Botón «Mi estado de cuenta» en /athlete-payments
- **Archivo:** `pages/AccountStatementPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Estado»

- [read] **Ver estado de cuenta** — `pages/AccountStatementPage.tsx:43` · **works** · gates: `ProtectedRoute school\|admin\|parent\|athlete && gate en la RPC` · R: rpc get_athlete_account_statement
- [export] **Imprimir** — `pages/AccountStatementPage.tsx:132` · **works**

### Módulo: Mi Rendimiento

<a id="r-athlete-stats"></a>
#### Estadísticas — `/stats`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral · Tarjeta «Nivel actual» del dashboard
- **Archivo:** `pages/StatsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Selector de fuente»

- [toggle] **Ver: Todo / escuela / entrenador personal** — `pages/StatsPage.tsx:134` · **works** · R: BFF /api/v1/athlete/stats/sources

##### Pestaña «Rendimiento»

- [read] **KPIs unificados** — `pages/StatsPage.tsx:37` · **works** · R: BFF /api/v1/athlete/stats
- [read] **Estadísticas por ejercicio (90 días)** — `pages/StatsPage.tsx:38` · **works** · R: rpc get_athlete_exercise_stats
- [navigate] **Vacío: «Ir a Entrenar»** — `pages/StatsPage.tsx:527` · **works**

##### Pestaña «Físico»

- [read] **Medidas corporales** — `pages/StatsPage.tsx:30` · **works** · R: BFF /api/v1/athlete/training/body-metrics
- [navigate] **«Ir a Mi Bienestar» → /wellness** — `pages/StatsPage.tsx:646` · **works**

##### Pestaña «Historial»

- [read] **Historial 30 días** — `pages/StatsPage.tsx:39` · **works** · R: BFF /api/v1/athlete/training/history

<a id="r-athlete-goals"></a>
#### Objetivos — `/goals`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral
- **Archivo:** `pages/GoalsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** sin uso — athlete_goals: 0

##### Pestaña «Objetivos»

- [read] **Listar objetivos** — `pages/GoalsPage.tsx:41` · **works** · R: athlete_goals · uso: sin uso (athlete_goals)
- [create] **Nuevo Objetivo** — `pages/GoalsPage.tsx:143` · **works** · W: athlete_goals (insert) · uso: sin uso (athlete_goals)
- [update] **Actualizar progreso / completar** — `pages/GoalsPage.tsx:77` · **works** · W: athlete_goals (update) · uso: sin uso (athlete_goals)
- [delete] **Eliminar objetivo** — `pages/GoalsPage.tsx:283` · **works** · W: athlete_goals (delete) · uso: sin uso (athlete_goals)

<a id="r-athlete-training"></a>
#### Entrenamientos — `/training`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral + barra inferior
- **Archivo:** `pages/TrainingPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — training_logs: 9 en total ¦ trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0

##### Pestaña «Sesiones de hoy»

- [read] **Ver sesiones asignadas hoy** — `pages/TrainingPage.tsx:50` · **works** · R: BFF /api/v1/athlete/training/today
- [update] **Iniciar / Continuar sesión → SessionExecution** — `pages/TrainingPage.tsx:344` · **works** · W: BFF POST /api/v1/athlete/training/session/:id/exercise-results, BFF POST /api/v1/athlete/training/session/:id/complete
- [delete] **Eliminar sesión autoasignada** — `pages/TrainingPage.tsx:639` · **works** · W: BFF DELETE /api/v1/athlete/training/session-plans/:id

##### Pestaña «Rutinas visibles»

- [read] **Ver rutinas de la escuela/entrenador** — `components/athlete/AthleteVisibleRoutines.tsx:86` · **works** · R: BFF /api/v1/athlete/training/routines-visible
- [create] **Autoasignarme rutina** — `components/athlete/AthleteVisibleRoutines.tsx:52` · **works** · W: BFF POST /api/v1/athlete/training/routines/:id/self-assign

##### Pestaña «Actividad libre / Historial»

- [create] **Registrar actividad libre** — `pages/TrainingPage.tsx:168` · **works** · W: training_logs (insert directo) · uso: usado (training_logs)
- [dialog] **Ver detalle de sesión del historial** — `pages/TrainingPage.tsx:495` · **works** · R: BFF /api/v1/athlete/training/history
- [delete] **Eliminar registro** — `pages/TrainingPage.tsx:477` · **works** · W: training_logs (delete) · uso: usado (training_logs)

### Módulo: Actividad deportiva

<a id="r-athlete-enrollments"></a>
#### Mis Inscripciones — `/enrollments`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral + barra inferior · Tarjeta «Próxima sesión»; notificación session-bookings (bff routes/session-bookings.ts:54)
- **Archivo:** `pages/MyEnrollmentsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — session_bookings 90 d: atleta 17 · sin usuario 28

##### Pestaña «Mis Grupos»

- [read] **Equipos y planes activos** — `pages/MyEnrollmentsPage.tsx:167` · **works** · R: BFF /api/v1/enrollments/my-plan
- [dialog] **Detalle de equipo** — `pages/MyEnrollmentsPage.tsx:2123` · **works**
- [dialog] **Plan → Gestión de clases (agendar)** — `pages/MyEnrollmentsPage.tsx:716` · **works** · R: BFF /api/v1/session-bookings (disponibles) · uso: usado (session_bookings)
- [create] **Agendar clase del plan (confirmar)** — `pages/MyEnrollmentsPage.tsx:1293` · **works** · W: BFF /api/v1/session-bookings · uso: usado (session_bookings)
- [create] **Agendar sesión con entrenador personal** — `pages/MyEnrollmentsPage.tsx:1612` · **works** · W: BFF /api/v1/athlete/training/book-pt-session · R: BFF /api/v1/athlete/training/pt-availability · uso: usado (session_bookings)
- [create] **Reservar instalación secundaria (gimnasio, máx 2 h)** — `pages/MyEnrollmentsPage.tsx:1858` · **works** · W: BFF /api/v1/session-bookings (secondary) · uso: usado (session_bookings)
- [read] **Banco de horas (saldo)** — `pages/MyEnrollmentsPage.tsx:54` · **works** · gates: `flag banco de horas (HourBankBalanceCard)`
- [navigate] **«Buscar equipos» / «Ver membresías» → /explore** — `pages/MyEnrollmentsPage.tsx:326` · **partial**
  - Lleva a /explorar, oculto del menú en prod.

##### Pestaña «Mis Clases»

- [read] **Clases agendadas** — `pages/MyEnrollmentsPage.tsx:1882` · **works** · R: BFF /api/v1/session-bookings (mis reservas) · uso: usado (session_bookings)
- [delete] **Cancelar clase** — `pages/MyEnrollmentsPage.tsx:2041` · **works** · W: BFF session-bookings cancel, BFF /api/v1/athlete/training/cancel-pt-session

##### Pestaña «Mis Reservas»

- [dialog] **Reservar instalación** — `pages/MyEnrollmentsPage.tsx:2084` · **works** · R: useAthleteFacilities
- [delete] **Cancelar reserva** — `pages/MyEnrollmentsPage.tsx:2061` · **works**

##### Pestaña «Clase de prueba»

- [dialog] **Agendar clase de prueba (autoservicio)** — `pages/MyEnrollmentsPage.tsx:517` · **works** · gates: `selfServiceAvailable (trial-classes-self/settings)` · W: BFF /api/v1/trial-classes-self

<a id="r-athlete-my-event-registrations"></a>
#### Mis Eventos — `/my-event-registrations`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral · Ruta declarada FUERA del layout autenticado (App.tsx:403) sin ProtectedRoute
- **Archivo:** `pages/events/MyEventRegistrationsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — event_registrations 90 d: 4

##### Pestaña «Inscripciones a eventos»

- [read] **Listar mis inscripciones** — `pages/events/MyEventRegistrationsPage.tsx:81` · **partial** · R: BFF /api/v1/events/my-registrations/list
  - Sin ProtectedRoute ni AuthLayout: al entrar desde el menú se pierde la barra lateral; sin sesión el BFF responde 401.
- [navigate] **Volver → /dashboard** — `pages/events/MyEventRegistrationsPage.tsx:113` · **works**
- [navigate] **Buscar eventos → /events (→ /explorar)** — `pages/events/MyEventRegistrationsPage.tsx:121` · **partial**
  - Explorador oculto en el menú de prod.
- [link] **Ver evento (nueva pestaña /event/:slug)** — `pages/events/MyEventRegistrationsPage.tsx:225` · **works**

<a id="r-athlete-tournaments-eventid-register"></a>
#### Inscripción a torneo — `/tournaments/:eventId/register`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · OpenTournamentsCard del dashboard; notificación events.route.ts:508/1123
- **Archivo:** `pages/events/TournamentRegisterPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Inscripción»

- [create] **Inscribirme** — `pages/events/TournamentRegisterPage.tsx:183` · **works** · gates: `ProtectedRoute parent\|athlete` · W: BFF /api/v1/events/:id/register (registerForTournament)
- [pay] **Pagar inscripción existente** — `pages/events/TournamentRegisterPage.tsx:172` · **works**
- [navigate] **Ver resultados** — `pages/events/TournamentRegisterPage.tsx:189` · **works**

### Módulo: Bienestar

<a id="r-athlete-salud"></a>
#### Mi Salud — `/salud`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral
- **Archivo:** `pages/clinical/MyHealthPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** sin uso — clinical_patients: 0 ¦ health_records: 0

##### Pestaña «Mi salud»

- [read] **Resumen de salud / plan** — `pages/clinical/MyHealthPage.tsx:472` · **works** · R: rpc get_my_health_summary
- [update] **Autorizar consentimientos pendientes** — `pages/clinical/MyHealthPage.tsx:112` · **works** · W: rpc grant_clinical_consents
- [toggle] **Marcar ejercicio hecho hoy (con dolor)** — `pages/clinical/MyHealthPage.tsx:290` · **works** · W: rpc log_exercise_done / unlog_exercise_done
- [delete] **Revocar autorización** — `pages/clinical/MyHealthPage.tsx:391` · **works** · W: rpc revoke_clinical_consent
- [link] **WhatsApp al profesional** — `pages/clinical/MyHealthPage.tsx:445` · **works**

<a id="r-athlete-salud-invitacion-token"></a>
#### Aceptar invitación clínica — `/salud/invitacion/:token`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Enlace que comparte el profesional de salud
- **Archivo:** `pages/clinical/ClinicalInviteAcceptPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Invitación»

- [read] **Ver invitación** — `pages/clinical/ClinicalInviteAcceptPage.tsx:32` · **works** · gates: `login requerido && token` · R: rpc get_clinical_invite
- [update] **Aceptar** — `pages/clinical/ClinicalInviteAcceptPage.tsx:208` · **works** · W: rpc accept_clinical_invite

<a id="r-athlete-wellness-appointments"></a>
#### Mis Citas — `/wellness/appointments`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral · Notificaciones con link /wellness/appointments (2 sitios SQL)
- **Archivo:** `pages/wellness/MyAppointmentsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** sin uso — wellness_appointments 90 d: 0

##### Pestaña «Próximas / Pasadas»

- [read] **Listar citas** — `pages/wellness/MyAppointmentsPage.tsx:57` · **works** · R: rpc get_my_appointments, children
- [link] **Entrar a la videollamada** — `pages/wellness/MyAppointmentsPage.tsx:141` · **works**
- [delete] **Cancelar cita** — `pages/wellness/MyAppointmentsPage.tsx:294` · **works** · W: rpc cancel_my_appointment
- [navigate] **Ver mi plan de salud → /salud** — `pages/wellness/MyAppointmentsPage.tsx:198` · **works**
- [navigate] **Buscar profesional → /explorar?category=services** — `pages/wellness/MyAppointmentsPage.tsx:201` · **partial**
  - Explorador oculto del menú en prod.

<a id="r-athlete-wellness"></a>
#### Explorar Bienestar (en realidad: medidas corporales) — `/wellness`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** menú lateral · StatsPage «Ir a Mi Bienestar»
- **Archivo:** `pages/AthleteWellnessPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Evolución / Medidas / Historial»

- [read] **Ver evolución de medidas** — `components/wellness/WellnessModule.tsx:443` · **partial** · R: BFF /api/v1/athlete/training/body-metrics
  - El menú dice «Explorar Bienestar» y StatsPage «Mi Bienestar», pero la pantalla es un registro de medidas corporales (WellnessModule). No explora nada.
- [create] **Nueva medición** — `components/wellness/WellnessModule.tsx:227` · **works** · W: BFF POST /api/v1/athlete/training/body-metrics

### Módulo: Tienda

<a id="r-athlete-mi-tienda"></a>
#### Tienda de mi escuela — `/mi-tienda`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral + barra inferior · Redirige a /tienda/:slug de la escuela activa
- **Archivo:** `pages/MiTiendaPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Redirección»

- [navigate] **Redirigir a la vitrina de la escuela** — `pages/MiTiendaPage.tsx:25` · **works** · gates: `ProtectedRoute parent\|athlete && StoreGate (rpc store_enabled) && sidebar: requiresStore + buyerStore=store && bottomNav: showStore (store_seller_allowed)` · R: BFF /api/v1/marketplace/school-store/:schoolId
- [navigate] **«La tienda aún no está disponible» → Volver al inicio** — `pages/MiTiendaPage.tsx:44` · **works**

<a id="r-athlete-mis-compras"></a>
#### Mis compras — `/mis-compras`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral · Notificación SQL link /mis-compras
- **Archivo:** `pages/MisComprasPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — orders 90 d: 3

##### Pestaña «Pedidos»

- [read] **Listar pedidos** — `pages/MisComprasPage.tsx:28` · **works** · gates: `StoreGate && sidebar buyerStore=purchases` · R: BFF /api/v1/marketplace/orders?limit=50
- [navigate] **Ir a la tienda** — `pages/MisComprasPage.tsx:43` · **works** · gates: `showStore`
- [navigate] **Abrir pedido / ver código de retiro** — `pages/MisComprasPage.tsx:71` · **works**

<a id="r-athlete-mis-compras-orderid"></a>
#### Detalle de compra — `/mis-compras/:orderId`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Desde Mis compras o tras el checkout
- **Archivo:** `pages/MiCompraDetallePage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Pedido»

- [read] **Ver pedido e historial** — `pages/MiCompraDetallePage.tsx:68` · **works** · R: BFF /api/v1/marketplace/orders/:id, historial, pago
- [update] **Generar / regenerar código de retiro** — `pages/MiCompraDetallePage.tsx:285` · **works**
- [read] **Copiar datos de transferencia** — `pages/MiCompraDetallePage.tsx:324` · **works**
- [upload] **Subir comprobante de transferencia** — `pages/MiCompraDetallePage.tsx:335` · **works**
- [pay] **Pagar ahora (Wompi)** — `pages/MiCompraDetallePage.tsx:384` · **works**
- [update] **Ya lo recibí** — `pages/MiCompraDetallePage.tsx:387` · **works**
- [delete] **Cancelar pedido** — `pages/MiCompraDetallePage.tsx:390` · **works**

<a id="r-athlete-shop"></a>
#### Tienda SportMaps (catálogo global legado) — `/shop`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Solo enlazada desde Landing.tsx, SportMapsFooter y DemoQuickLinks
- **Archivo:** `pages/ShopPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** dead · **Uso:** no medido

##### Pestaña «Catálogo»

- [read] **Catálogo global de products** — `pages/ShopPage.tsx:52` · **dead** · gates: `StoreGate` · R: products
  - Quitada del menú del atleta (comentario navigation.ts:320-322: la veían atletas de todas las escuelas). Sigue viva por URL.
- [navigate] **Agregar al carrito / Checkout → carrito global** — `pages/ShopPage.tsx:358` · **dead**

### Módulo: Documentos

<a id="r-athlete-my-cards"></a>
#### Mis Carnets — `/my-cards`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** menú lateral
- **Archivo:** `pages/MyAthleteCardsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_id_cards: 499 activos · 0 impresos · 4 escuelas

##### Pestaña «Carnets»

- [read] **Listar mis carnets** — `pages/MyAthleteCardsPage.tsx:63` · **works** · R: rpc my_athlete_id_cards · uso: usado (athlete_id_cards)
- [dialog] **Vista previa del carnet** — `pages/MyAthleteCardsPage.tsx:177` · **works** · R: rpc verify_athlete_id_card_public · uso: usado (athlete_id_cards)
- [link] **Abrir página pública /c/:token** — `pages/MyAthleteCardsPage.tsx:231` · **works**
- [export] **Descargar PNG** — `pages/MyAthleteCardsPage.tsx:238` · **works**

<a id="r-athlete-my-certificates"></a>
#### Mis Constancias — `/my-certificates`

- **Rol:** athlete · **Lo usan:** parent, athlete · **Entrada:** sin menú · Solo en el menú del padre (navigation.ts:380); notificación SQL /my-certificates
- **Archivo:** `pages/MyCertificatesPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** sin uso — athlete_certificates: 0

##### Pestaña «Constancias»

- [read] **Listar constancias** — `pages/MyCertificatesPage.tsx:62` · **hidden** · R: rpc my_athlete_certificates
  - El atleta no la tiene en el menú; el formulario de solicitud pide elegir un hijo (children), así que el adulto no puede pedir la suya.
- [create] **Solicitar constancia** — `pages/MyCertificatesPage.tsx:144` · **broken** · W: rpc request_athlete_certificate
  - Requiere selectedChild (children.parent_id = usuario): para el atleta adulto la lista sale vacía.
- [link] **Ver /cert/:folio** — `pages/MyCertificatesPage.tsx:180` · **works**
- [export] **Descargar PDF** — `pages/MyCertificatesPage.tsx:184` · **works** · R: BFF /api/v1/certificates/:id/signed-url

### Módulo: Cuenta

<a id="r-athlete-profile"></a>
#### Mi Perfil — `/profile`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** barra inferior · Checklist «Completar Perfil»; solo en la barra inferior (no en el menú lateral)
- **Archivo:** `pages/ProfilePage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Perfil»

- [update] **Editar / Guardar perfil** — `pages/ProfilePage.tsx:183` · **works** · W: profiles (updateProfile)
- [upload] **Cambiar foto** — `pages/ProfilePage.tsx:122` · **works** · W: storage avatars
- [read] **Mi Documento (solo lectura)** — `pages/ProfilePage.tsx:74` · **broken** · R: children where parent_id = atleta
  - Para el atleta busca en children con parent_id = su id: el adulto no está en children, siempre sale «Aún no hay un documento registrado».
- [read] **Estadísticas de la cuenta (Puntos SportMaps, Nivel de suscripción, Miembro desde)** — `pages/ProfilePage.tsx:366` · **partial**
  - Campos legados profiles.sportmaps_points / subscription_tier; fallback año «2025» fijo.
- [delete] **Eliminar Cuenta (Zona de Peligro)** — `pages/ProfilePage.tsx:402` · **dead**
  - Botón sin onClick. La eliminación real está en Configuración › Seguridad (AccountDeletionCard).

<a id="r-athlete-settings"></a>
#### Configuración — `/settings`

- **Rol:** athlete · **Lo usan:** athlete, parent, coach · **Entrada:** menú lateral
- **Archivo:** `pages/SettingsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Perfil»

- [update] **Guardar perfil** — `components/settings/ProfileSection.tsx:1` · **works** · W: rpc save_profile_settings · R: rpc get_my_settings

##### Pestaña «Notificaciones»

- [toggle] **Preferencias de notificación (incl. push)** — `components/settings/NotificationsSection.tsx:77` · **works** · W: rpc save_notification_preferences

##### Pestaña «Privacidad»

- [toggle] **Perfil público / Aparecer en búsquedas / Mostrar estadísticas** — `components/settings/PrivacySection.tsx:51` · **dead** · W: rpc save_privacy_preferences
  - Se guardan public_profile/allow_search/show_stats/show_achievements pero ningún código de frontend ni BFF los lee.

##### Pestaña «Seguridad»

- [update] **Cambiar contraseña** — `components/settings/SecuritySection.tsx:17` · **works**
- [delete] **Solicitar eliminación de cuenta** — `components/settings/AccountDeletionCard.tsx:77` · **works** · W: BFF /api/v1/me/data-deletion-request

<a id="r-athlete-notifications"></a>
#### Notificaciones — `/notifications`

- **Rol:** athlete · **Lo usan:** athlete, parent, coach · **Entrada:** sin menú · Campana del header (GlobalNotificationBell)
- **Archivo:** `pages/NotificationsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leídas)

##### Pestaña «Todas / No leídas»

- [read] **Listar notificaciones** — `pages/NotificationsPage.tsx:76` · **works** · R: notifications · uso: usado (notifications)
- [navigate] **Abrir notificación → navigate(link) crudo** — `pages/NotificationsPage.tsx:205` · **partial** · W: notifications.read · uso: usado (notifications)
  - Navega al link tal cual; lib/notifications/navigation.ts (resolveNotificationLink, que corrige links por rol) está muerto: 0 usos. Links rotos para el atleta: /my-attendance (no existe ruta), /parent-attendance (solo padre).

<a id="r-athlete-messages"></a>
#### Mensajes — `/messages`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** sin menú · Ni en el menú ni en la barra del atleta; solo por URL
- **Archivo:** `pages/MessagesPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** hidden · **Uso:** sin uso — messages: 0

##### Pestaña «Mensajes»

- [read] **Ver conversaciones** — `pages/MessagesPage.tsx:43` · **hidden** · R: messages, profiles · uso: sin uso (messages)
  - Sin entrada en la navegación del atleta (memoria: módulo Mensajes roto 08-31).

### Módulo: Onboarding

<a id="r-athlete-onboarding-athlete"></a>
#### Onboarding del atleta — `/onboarding/athlete`

- **Rol:** athlete · **Lo usan:** athlete · **Entrada:** sin menú · Gate del dashboard (DashboardPage.tsx:308) y OnboardingRolePage (preselecciona «Atleta»)
- **Archivo:** `pages/onboarding/AthleteOnboarding.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Datos»

- [update] **Nombre, teléfono, fecha de nacimiento, foto** — `pages/onboarding/AthleteOnboarding.tsx:77` · **partial** · W: profiles, rpc complete_onboarding
  - Sin gate de edad: con Google OAuth → /onboarding/role (default «athlete») un menor puede quedar como atleta. El gate de 18 años solo vive en RegisterPage.tsx:87.

### Módulo: Evaluación post-entreno

<a id="r-athlete-post-entreno-sessionid"></a>
#### Autoevaluación post-entreno — `/post-entreno/:sessionId`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Notificación in-app + push con link /post-entreno/{id}[?child_id=] (migración 20260911124834:130); fuera del layout
- **Archivo:** `pages/PostTrainingSelfEvalPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 79, torniquete 12, QR 1 ¦ performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)

##### Pestaña «Autoevaluación»

- [read] **Cargar contexto (sesión, sujeto, métricas)** — `pages/PostTrainingSelfEvalPage.tsx:106` · **works** · gates: `ProtectedRoute && sujeto = child_id (padre) o profile (adulto)` · R: attendance_sessions, attendance_records, children, sport_metric_definitions, performance_entries · uso: usado (attendance_sessions, attendance_records, performance_entries)
- [create] **Enviar autoevaluación** — `pages/PostTrainingSelfEvalPage.tsx:204` · **works** · W: rpc submit_post_training_self_eval · uso: usado (performance_entries)

<a id="r-athlete-post-entreno-sessionid-resultado"></a>
#### Resumen del día post-entreno — `/post-entreno/:sessionId/resultado`

- **Rol:** athlete · **Lo usan:** athlete, parent · **Entrada:** sin menú · Tras enviar la autoevaluación
- **Archivo:** `pages/PostTrainingDayRecapPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)

##### Pestaña «Resultado»

- [read] **«Así le fue hoy a …»** — `pages/PostTrainingDayRecapPage.tsx:54` · **works** · R: attendance_sessions, performance_entries, sport_metric_definitions, children · uso: usado (attendance_sessions, performance_entries)
- [navigate] **Volver al inicio** — `pages/PostTrainingDayRecapPage.tsx:199` · **works**

### Módulo: Explorar

<a id="r-athlete-explorar"></a>
#### Explorar (global) — `/explorar`

- **Rol:** athlete · **Lo usan:** athlete, parent, coach · **Entrada:** sin menú · SHOW_EXPLORE = import.meta.env.DEV (lib/feature-flags.ts:5): ítem solo en dev; ruta abierta en prod
- **Archivo:** `pages/ExplorarGlobalPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Explorar»

- [read] **Explorar escuelas / eventos / servicios** — `pages/ExplorarGlobalPage.tsx:1` · **hidden**
  - Oculto del menú en prod pero 6+ botones (checklist, MyEnrollments, MyEventRegistrations, MyAppointments) llevan aquí.
- [navigate] **Acciones que piden login → /login?redirect=/explorar** — `pages/ExplorarGlobalPage.tsx:512` · **broken**
  - LoginPage lee «redirectTo», no «redirect»: tras login cae en /dashboard.

## Páginas públicas (vistas por acudiente/deportista)

### Módulo: Cobros

<a id="r-public-p-token"></a>
#### Pago de un cobro sin login — `/p/:token`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Botón de plantillas WhatsApp de cobranza (sportmaps.co/p/* → app), correos, QR, bot
- **Archivo:** `pages/CobroPublicoPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — enlace público /p/:token 90 d: 929 creados · 211 abiertos · 418 aperturas · 2 escuelas

##### Pestaña «Cobro»

- [read] **Ver cobro (escuela, concepto, monto, vencidos)** — `pages/CobroPublicoPage.tsx:187` · **works** · gates: `token = credencial && rate limit lecturaLimiter` · R: BFF GET /api/v1/public/cobro/:token (rpc cobro_enlace_publico_resolver → open_count++) · uso: usado (p_token)
- [pay] **Pagar $X en línea (Wompi, monto firmado)** — `pages/CobroPublicoPage.tsx:266` · **works** · gates: `pagoLimiter && escuela con pasarela` · W: BFF POST /api/v1/public/cobro/:token/pagar · uso: usado (p_token)
- [link] **Pagar con tarjeta, PSE o Nequi (link de pago de la escuela)** — `pages/CobroPublicoPage.tsx:286` · **works**
- [read] **Copiar número de cuenta** — `pages/CobroPublicoPage.tsx:312` · **works**
- [read] **QR de transferencia** — `pages/CobroPublicoPage.tsx:335` · **works** · R: BFF /api/v1/public/cobro/:token/qr.png · uso: usado (p_token)
- [link] **Enviar comprobante por WhatsApp** — `pages/CobroPublicoPage.tsx:340` · **works**
- [update] **Datos de factura electrónica** — `pages/CobroPublicoPage.tsx:461` · **works** · W: BFF PUT /api/v1/public/cobro/:token/factura · R: BFF GET /api/v1/public/cobro/:token/factura · uso: usado (p_token)
- [link] **WhatsApp de avisos de la escuela** — `pages/CobroPublicoPage.tsx:392` · **works**
- [navigate] **¿Tienes cuenta? Ver todos tus pagos → /my-payments** — `pages/CobroPublicoPage.tsx:416` · **partial**
  - Atleta adulto rebota a /athlete-payments.

### Módulo: Documentos

<a id="r-public-c-qrtoken"></a>
#### Carnet público verificado — `/c/:qrToken`

- **Rol:** public · **Lo usan:** athlete, parent, coach · **Entrada:** sin menú · QR del carnet (MyAthleteCardsPage)
- **Archivo:** `pages/AthleteCardPublicPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — athlete_id_cards: 499 activos · 0 impresos · 4 escuelas

##### Pestaña «Carnet»

- [read] **Verificar carnet** — `pages/AthleteCardPublicPage.tsx:48` · **works** · gates: `token` · R: rpc verify_athlete_id_card_public · uso: usado (athlete_id_cards)
- [export] **Descargar PNG** — `pages/AthleteCardPublicPage.tsx:153` · **works**
- [scan] **Marcar asistencia (staff)** — `pages/AthleteCardPublicPage.tsx:176` · **works** · gates: `sesión de staff; login inline` · W: BFF /api/v1/attendance/checkin-by-card · uso: usado (athlete_id_cards)
- [dialog] **Soy staff: iniciar sesión** — `pages/AthleteCardPublicPage.tsx:206` · **works**

<a id="r-public-cert-folio"></a>
#### Verificar constancia — `/cert/:folio`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · QR/folio impreso en el PDF
- **Archivo:** `pages/CertificateVerifyPublicPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Verificación»

- [read] **Validar folio (válida/revocada/pendiente)** — `pages/CertificateVerifyPublicPage.tsx:33` · **works** · R: rpc verify_athlete_certificate_public

### Módulo: Inscripción

<a id="r-public-join-slug"></a>
#### Inscripción por QR de la escuela — `/join/:slug`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · QR impreso; bot de WhatsApp (whatsapp-bot.service.ts:2873) y cortesía (whatsapp-cortesia-semana.service.ts:164)
- **Archivo:** `pages/JoinSchoolPublicPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — QR de inscripción histórico: 1.727 escaneos · 226 registros · 61 pagados

##### Pestaña «Inicio»

- [read] **Cargar QR** — `pages/JoinSchoolPublicPage.tsx:222` · **works** · gates: `slug activo / no vencido` · R: rpc get_join_qr_public
- [navigate] **Inscribir a un menor de edad** — `pages/JoinSchoolPublicPage.tsx:479` · **works**
- [navigate] **Pagar mensualidad** — `pages/JoinSchoolPublicPage.tsx:495` · **works** · gates: `login`
- [navigate] **¿El atleta es mayor de edad? → /register?role=athlete** — `pages/JoinSchoolPublicPage.tsx:517` · **partial**
  - Callejón para el adulto: crea cuenta y debe pedirle a la escuela que lo inscriba; el QR no inscribe adultos.

##### Pestaña «Cuenta (registro/login inline)»

- [create] **Crear cuenta de acudiente** — `pages/JoinSchoolPublicPage.tsx:323` · **works** · W: supabase.auth.signUp role=parent
- [navigate] **Ya tengo cuenta → /login** — `pages/JoinSchoolPublicPage.tsx:585` · **works**

##### Pestaña «Inscribir / pagar»

- [create] **Enviar inscripción** — `pages/JoinSchoolPublicPage.tsx:397` · **works** · W: rpc submit_qr_signup
- [pay] **Pagar cobro existente → /parent-checkout** — `pages/JoinSchoolPublicPage.tsx:362` · **works** · R: rpc get_qr_pay_targets
- [pay] **Generar mensualidad y pagar** — `pages/JoinSchoolPublicPage.tsx:368` · **works** · W: rpc generate_qr_monthly_charge

<a id="r-public-join-team-teamid"></a>
#### Unirse a un equipo — `/join-team/:teamId`

- **Rol:** public · **Lo usan:** parent · **Entrada:** sin menú · Enlace copiado en TeamsPage.tsx:942
- **Archivo:** `pages/JoinTeamPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Unirse»

- [read] **Info del equipo** — `pages/JoinTeamPage.tsx:95` · **works** · R: rpc get_team_join_info
- [read] **Buscar menor por documento** — `pages/JoinTeamPage.tsx:114` · **works** · R: rpc buscar_menor_por_documento_publico
  - Búsqueda anónima por documento (auditoría linter 10-05 la marcó).
- [create] **Crear cuenta y reclamar menor** — `pages/JoinTeamPage.tsx:164` · **works** · W: auth.signUp role=parent, rpc claim_children_by_document

<a id="r-public-join-plan-planid"></a>
#### Unirse a un plan — `/join-plan/:planId`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Enlace copiado en OfferingsManagement.tsx:879
- **Archivo:** `pages/JoinPlanPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Unirse»

- [read] **Info del plan** — `pages/JoinPlanPage.tsx:67` · **works** · R: rpc get_plan_join_info
- [toggle] **Soy acudiente / Soy el atleta** — `pages/JoinPlanPage.tsx:267` · **works**
- [read] **Validar documento** — `pages/JoinPlanPage.tsx:80` · **works** · R: rpc validate_doc_for_plan_join
- [create] **Crear cuenta y reclamar** — `pages/JoinPlanPage.tsx:110` · **partial** · W: auth.signUp role=parent\|athlete, rpc claim_member_for_plan
  - Registro como atleta sin gate de edad (solo pide CC como placeholder).

### Módulo: Prospectos

<a id="r-public-inscripcion-slug"></a>
#### Formulario de prospecto — `/inscripcion/:slug`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Enlace/QR de captación de la escuela
- **Archivo:** `pages/SchoolLeadFormPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Formulario»

- [read] **Landing de la escuela** — `pages/SchoolLeadFormPage.tsx:74` · **works** · R: rpc get_school_lead_landing_public, rpc list_open_trial_slots_public
- [create] **Enviar** — `pages/SchoolLeadFormPage.tsx:132` · **works** · W: rpc submit_school_lead

### Módulo: Reservas

<a id="r-public-agendar-clase-slug"></a>
#### Agendar clase de prueba — `/agendar-clase/:slug`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Enlace público de la escuela
- **Archivo:** `pages/booking/PublicTrialClassBookingPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Sin cuenta»

- [create] **Enviar código de verificación** — `pages/booking/PublicTrialClassBookingPage.tsx:830` · **works** · W: BFF /api/v1/public/booking/*
- [create] **Agendar sin crear cuenta** — `pages/booking/PublicTrialClassBookingPage.tsx:1161` · **works** · W: BFF /api/v1/public/booking/*
- [delete] **Cancelar una clase sin cuenta** — `pages/booking/PublicTrialClassBookingPage.tsx:1172` · **works**

##### Pestaña «Ya registrado»

- [create] **Login inline + clases del plan** — `pages/booking/PublicTrialClassBookingPage.tsx:835` · **works** · R: children, useAthleteSessionBookings

<a id="r-public-agendar-slug"></a>
#### Reservar instalación — `/agendar/:slug`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Enlace público de la escuela
- **Archivo:** `pages/booking/PublicFacilityBookingPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — session_bookings 90 d: atleta 17 · sin usuario 28

##### Pestaña «Reserva»

- [create] **Enviar código de verificación** — `pages/booking/PublicFacilityBookingPage.tsx:588` · **works** · W: BFF /api/v1/public/booking/*
- [navigate] **Ya registrado → /login?redirectTo=/enrollments** — `pages/booking/PublicFacilityBookingPage.tsx:771` · **works**

### Módulo: Asistencia

<a id="r-public-polls-v-pollid"></a>
#### Encuesta de asistencia pública — `/polls/v/:pollId`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Enlace compartido por la escuela (PollsPage.tsx:33)
- **Archivo:** `pages/polls/PublicPollPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** sin uso — attendance_polls 90 d: 0 (3 históricas)

##### Pestaña «Encuesta»

- [read] **Ver encuesta** — `pages/polls/PublicPollPage.tsx:168` · **works** · R: BFF /api/v1/polls/:id/public · uso: sin uso (attendance_polls)
- [create] **Confirmar asistencia** — `lib/api/polls.api.ts:100` · **works** · gates: `auth opcional + poll token en localStorage` · W: BFF POST /api/v1/polls/:id/confirm · uso: sin uso (attendance_polls)

### Módulo: Pagos

<a id="r-public-payment-result"></a>
#### Resultado de pago (Wompi) — `/payment-result`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · redirectUrl por defecto del widget (lib/api/wompi.ts:223)
- **Archivo:** `pages/PaymentResultPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Resultado»

- [read] **Consultar estado de la transacción (?id=)** — `pages/PaymentResultPage.tsx:25` · **works** · R: checkTransactionStatus (Wompi)
- [navigate] **Volver al inicio** — `pages/PaymentResultPage.tsx:117` · **works**

<a id="r-public-pagos-confirmacion"></a>
#### Confirmación de pago por link — `/pagos/confirmacion`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Redirect configurado fuera del repo (links de pago Wompi); ningún código lo genera
- **Archivo:** `pages/PaymentConfirmationPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Confirmación»

- [read] **Consultar link (?token / ?id)** — `pages/PaymentConfirmationPage.tsx:82` · **duplicated** · R: BFF /api/v1/payments/link/:token
  - Segunda pantalla de resultado de pago junto a /payment-result.

### Módulo: Acceso

<a id="r-public-register"></a>
#### Registro — `/register`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · WhatsApp bot/cola: ?invite=&email= o ?phone=; QR adulto ?role=athlete; invitaciones por correo
- **Archivo:** `pages/RegisterPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12

##### Pestaña «Registro»

- [read] **Precarga de invitación (?invite)** — `pages/RegisterPage.tsx:251` · **works** · R: rpc get_invitation_details
- [create] **Crear cuenta** — `pages/RegisterPage.tsx:364` · **works** · gates: `18+ para personas (no acudiente) && WhatsApp obligatorio acudiente && términos` · W: auth.signUp
- [update] **Aceptar invitación + completar onboarding** — `pages/RegisterPage.tsx:294` · **works** · W: rpc accept_invitation_pro, rpc complete_onboarding · uso: usado (invitations)
- [link] **Continuar con Google** — `components/auth/GoogleSignInButton.tsx:19` · **partial**
  - OAuth salta el gate de edad (→ /onboarding/role).
- [read] **?phone= (bot sin invitación)** — `pages/RegisterPage.tsx:237` · **partial**
  - Solo precarga el teléfono; no vincula hijos (lo dice whatsapp-bot.service.ts:1598-1604).

<a id="r-public-login"></a>
#### Iniciar sesión — `/login`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Bot WhatsApp «ayuda con la app» (whatsapp-bot.service.ts:1410); start_url PWA con marca /login?t=slug
- **Archivo:** `pages/LoginPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Login»

- [update] **Ingresar con correo y contraseña** — `pages/LoginPage.tsx:100` · **works** · gates: `?redirectTo= (solo rutas internas)`
- [create] **Olvidé mi contraseña** — `pages/LoginPage.tsx:122` · **works** · W: auth.resetPasswordForEmail
- [link] **Continuar con Google** — `pages/LoginPage.tsx:344` · **works**
- [navigate] **Redirección post-login con ?redirect=** — `pages/LoginPage.tsx:75` · **broken**
  - Tienda (TiendaPublicaPage.tsx:71), checkout (StoreCheckoutPage.tsx:252), Explorar y Marketplace mandan ?redirect=; Login solo lee ?redirectTo= → cae en /dashboard.

<a id="r-public-reset-password"></a>
#### Restablecer contraseña — `/reset-password`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Correo de recuperación
- **Archivo:** `pages/ResetPasswordPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Nueva contraseña»

- [read] **Canjear token (verifyOtp)** — `pages/ResetPasswordPage.tsx:37` · **works**
- [update] **Guardar contraseña** — `pages/ResetPasswordPage.tsx:107` · **works** · W: auth.updateUser

<a id="r-public-eliminar-cuenta"></a>
#### Eliminar cuenta (Google Play) — `/eliminar-cuenta`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · URL declarada en Play Console
- **Archivo:** `pages/AccountDeletionPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Info»

- [link] **Solicitar por correo (mailto)** — `pages/AccountDeletionPage.tsx:84` · **works**

<a id="r-public-onboarding-role"></a>
#### Elegir rol (OAuth) — `/onboarding/role`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Tras Google OAuth
- **Archivo:** `pages/OnboardingRolePage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Rol»

- [update] **Elegir rol (preseleccionado «Atleta»)** — `pages/OnboardingRolePage.tsx:43` · **partial** · W: rpc complete_role_selection
  - Default athlete y sin gate de edad.

### Módulo: Escuela pública

<a id="r-public-s-slug"></a>
#### Perfil público de escuela (slug) — `/s/:slug`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Botón «Ver» en SchoolPublicProfilePage.tsx:736
- **Archivo:** `pages/PublicSchoolPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Perfil»

- [read] **Ver escuela + sedes** — `pages/PublicSchoolPage.tsx:71` · **duplicated** · R: schoolsAPI, facilities
  - Tres páginas públicas de escuela: /s/:slug, /schools/:id (SchoolDetailPage, enlazada desde el explorador) y /escuela/:id (SchoolProfilePage, 0 enlaces internos).

<a id="r-public-schools-id"></a>
#### Detalle de escuela (explorador) — `/schools/:id`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Explorador/mapa (UnifiedExploreMap.tsx:363)
- **Archivo:** `pages/SchoolDetailPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** duplicated · **Uso:** no medido

##### Pestaña «Detalle»

- [read] **Ver escuela, ofertas, equipos, sedes** — `pages/SchoolDetailPage.tsx:145` · **duplicated** · R: schools, offerings, teams, facilities

<a id="r-public-escuela-id"></a>
#### Perfil de escuela (legado) — `/escuela/:id`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Sin enlaces internos
- **Archivo:** `pages/SchoolProfilePage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** dead · **Uso:** no medido

##### Pestaña «Perfil»

- [read] **Ver perfil** — `pages/SchoolProfilePage.tsx:1` · **dead**
  - 0 enlaces internos; sus botones van a /explore.

### Módulo: Eventos

<a id="r-public-event-slug"></a>
#### Evento público — `/event/:slug`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Enlace compartido; Mis Eventos
- **Archivo:** `pages/events/EventPublicPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Evento»

- [navigate] **Inscribirme al Evento** — `pages/events/EventPublicPage.tsx:61` · **works** · gates: `login (→ /login)`
- [navigate] **Inscribir Delegación (escuela)** — `pages/events/EventPublicPage.tsx:55` · **works**

<a id="r-public-event-eventid-register"></a>
#### Inscripción individual a evento — `/event/:eventId/register`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Desde el evento público
- **Archivo:** `pages/events/EventIndividualRegisterPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — event_registrations 90 d: 4

##### Pestaña «Inscripción»

- [read] **Inscribir a: yo / hijo** — `pages/events/EventIndividualRegisterPage.tsx:238` · **works** · R: events, children
- [upload] **Subir comprobante** — `pages/events/EventIndividualRegisterPage.tsx:130` · **works** · W: storage payment-receipts (getPublicUrl)
  - Usa URL pública del bucket de comprobantes.
- [create] **Inscribirme** — `pages/events/EventIndividualRegisterPage.tsx:158` · **works** · W: BFF POST /api/v1/events/:id/register

<a id="r-public-tournaments-eventid-results"></a>
#### Resultados de torneo — `/tournaments/:eventId/results`

- **Rol:** public · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Notificación events.route.ts:1493
- **Archivo:** `pages/events/TournamentResultsPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Resultados»

- [read] **Ver tabla de resultados** — `pages/events/TournamentResultsPage.tsx:1` · **works**

### Módulo: Tienda

<a id="r-public-tienda-slug"></a>
#### Vitrina de la tienda — `/tienda/:slug`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · /mi-tienda redirige aquí
- **Archivo:** `pages/TiendaPublicaPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Vitrina»

- [create] **Agregar al carrito** — `pages/TiendaPublicaPage.tsx:222` · **works** · gates: `StoreGate && selling_allowed`
- [create] **Escribir a la tienda** — `pages/TiendaPublicaPage.tsx:76` · **works** · W: store_conversations
- [navigate] **Login para escribir → /login?redirect=** — `pages/TiendaPublicaPage.tsx:71` · **broken**
  - Param redirect ignorado por LoginPage.
- [navigate] **Pagar (barra fija)** — `pages/TiendaPublicaPage.tsx:256` · **works**

<a id="r-public-carrito"></a>
#### Carrito — `/carrito`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Barra de la tienda
- **Archivo:** `pages/CarritoPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Carrito»

- [read] **Revisar carrito por tienda** — `pages/CarritoPage.tsx:1` · **works** · gates: `StoreGate`

<a id="r-public-checkout-tienda-vendorprofileid"></a>
#### Checkout de tienda — `/checkout/tienda/:vendorProfileId`

- **Rol:** public · **Lo usan:** parent, athlete · **Entrada:** sin menú · Desde el carrito
- **Archivo:** `pages/StoreCheckoutPage.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Pagar»

- [pay] **Elegir método y pagar** — `pages/StoreCheckoutPage.tsx:235` · **works** · gates: `ProtectedRoute && StoreGate` · R: BFF /api/v1/store/payment-methods/:vp, vendor_profiles, school_branches
- [navigate] **Login → /login?redirect=** — `pages/StoreCheckoutPage.tsx:252` · **broken**
  - Param redirect ignorado por LoginPage.

### Módulo: Entrenadores

<a id="r-public-entrenador-userid"></a>
#### Perfil público de entrenador — `/entrenador/:userId`

- **Rol:** public · **Lo usan:** athlete · **Entrada:** sin menú · Enlace compartido por el entrenador personal
- **Archivo:** `pages/trainer/TrainerPublicProfile.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — coach_availability: 734 filas (18 coaches, 13 escuelas)

##### Pestaña «Perfil»

- [read] **Ver perfil y disponibilidad** — `pages/trainer/TrainerPublicProfile.tsx:48` · **works** · R: BFF /api/v1/trainer/public/:userId, coach_availability · uso: usado (coach_availability)

## PWA (transversal)

### Módulo: PWA

<a id="r-pwa"></a>
#### Banner «Instalar {escuela}» — `*`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Montado en App.tsx:327 sobre todas las rutas
- **Archivo:** `pwa/InstallBanner.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Banner»

- [dialog] **Instalar (Android/escritorio: beforeinstallprompt)** — `pwa/InstallBanner.tsx:119` · **works** · gates: `no cerrado (localStorage sm_install_dismissed)`
- [read] **Instrucciones iOS (Compartir → Añadir a inicio)** — `pwa/InstallBanner.tsx:133` · **works** · gates: `solo con slug de escuela && iOS Safari && display-mode browser`
- [toggle] **Cerrar (X) — permanente** — `pwa/InstallBanner.tsx:85` · **works**
  - Un cierre es para siempre en ese navegador; no hay forma de volver a mostrarlo.

<a id="r-pwa"></a>
#### Banner «Actualizar ahora» — `*`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · Evento pwa:update-available del SW (pwa/register.ts)
- **Archivo:** `pwa/UpdateBanner.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Banner»

- [update] **Actualizar ahora (reload)** — `pwa/UpdateBanner.tsx:36` · **works**
- [toggle] **Descartar** — `pwa/UpdateBanner.tsx:41` · **works**

<a id="r-pwa-layout-autenticado"></a>
#### Banner «Activar notificaciones» — `(layout autenticado)`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · AuthLayout.tsx:143
- **Archivo:** `components/PushPermissionBanner.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Banner»

- [toggle] **Activar** — `components/PushPermissionBanner.tsx:104` · **works** · gates: `Notification.permission = prompt && no descartado` · W: push_subscriptions (upsert, hooks/usePushSubscription.ts:139), nativo: BFF /api/v1/devices/register (FCM/APNs)
- [toggle] **Ahora no (permanente)** — `components/PushPermissionBanner.tsx:112` · **works**

<a id="r-pwa"></a>
#### Suscripción push legada — `-`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · subscribeToPush/unsubscribeFromPush
- **Archivo:** `pwa/notifications.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** dead · **Uso:** no medido

##### Pestaña «-»

- [toggle] **subscribeToPush** — `pwa/notifications.ts:11` · **dead**
  - 0 importaciones; reemplazado por hooks/usePushSubscription.

<a id="r-pwa-app-webmanifest-app-icon-png"></a>
#### Marca de la PWA (manifest por escuela) — `/app.webmanifest, /app-icon.png`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · index.html:16 + vercel.json → BFF /api/v1/pwa/manifest
- **Archivo:** `hooks/usePwaTenantSync.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «-»

- [update] **Sincronizar escuela activa → manifest/iconos/iOS meta** — `hooks/usePwaTenantSync.ts:24` · **works** · gates: `addon pwa_branding (v_school_entitlements.has_pwa_branding)` · R: bff routes/pwa.routes.ts:176 (schools, v_school_entitlements)
- [navigate] **start_url con marca = /login?t={slug}** — `../bff/src/routes/pwa.routes.ts:149` · **works**
  - La app instalada con marca SIEMPRE abre en /login (luego redirige a /dashboard si hay sesión).

<a id="r-pwa-layout-autenticado"></a>
#### Registro de dispositivo / modo de visualización — `(layout autenticado)`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · AuthLayout.tsx:24
- **Archivo:** `hooks/useDeviceContext.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «-»

- [create] **Registrar dispositivo con display_mode browser\|standalone\|native** — `hooks/useDeviceContext.ts:175` · **works** · W: BFF POST /api/v1/devices/register → user_devices (migración 20260814111326)

<a id="r-pwa"></a>
#### Cierre de sesión por inactividad — `*`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · App.tsx:315 (global)
- **Archivo:** `components/auth/IdleTimer.tsx` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Modal»

- [dialog] **Aviso «sesión por expirar» → cerrar sesión a los 10 min** — `components/auth/IdleTimer.tsx:173` · **partial** · gates: `NORMAL_MS 10 min (contexts/IdleConfigContext.tsx:29)`
  - No distingue PWA instalada/celular: la app instalada pide login tras 10 min de inactividad.

<a id="r-pwa-url-de-la-notificaci-n"></a>
#### Service worker: push y clic en notificación — `(url de la notificación)`

- **Rol:** pwa · **Lo usan:** parent, athlete, coach · **Entrada:** sin menú · vite-plugin-pwa injectManifest (src/sw.js)
- **Archivo:** `sw.js` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «-»

- [read] **Mostrar push (url = notifications.link)** — `sw.js:187` · **works** · R: bff services/notification.service.ts:124 (url: n.link)
- [navigate] **Clic → enfocar ventana con esa URL o abrir nueva** — `sw.js:216` · **partial**
  - Si la app ya está abierta en otra ruta, abre una ventana nueva en vez de navegar la existente. Links rotos de notifications también rompen aquí.

<a id="r-pwa"></a>
#### Guardia de recarga durante el pago — `-`

- **Rol:** pwa · **Lo usan:** parent, athlete · **Entrada:** sin menú · PaymentCheckoutModal.tsx:41
- **Archivo:** `pwa/reloadGuard.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «-»

- [toggle] **Bloquear recarga del SW mientras se paga** — `pwa/reloadGuard.ts:27` · **works**

## Entradas desde WhatsApp, correo y notificaciones

### Módulo: Cobranza

<a id="r-whatsapp-p-token"></a>
#### Pago de un cobro (/p/:token) — `/p/:token`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Botón URL de plantillas Meta aprobadas (base https://sportmaps.co/p/)
- **Archivo:** `services/whatsapp-plantillas.service.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — enlace público /p/:token 90 d: 929 creados · 211 abiertos · 418 aperturas · 2 escuelas ¦ comprobantes 90 d: app o escuela 486 (266 pagadores, 15 escuelas) · vía WhatsApp 56 (51 pagadores, 2 escuelas)

##### Pestaña «Emisores»

- [link] **Plantilla de cobranza (botón obligatorio)** — `services/whatsapp-plantillas.service.ts:554` · **works** · gates: `token (sin login)`
  - https://sportmaps.co/p/{token} → redirect de la landing a app.sportmaps.co/p/{token}
- [link] **Recordatorios de cobro (template-renderer paymentLink)** — `utils/template-renderer.ts:151` · **works** · gates: `token`
- [link] **Bot: enlaces de pago por cobro** — `services/whatsapp-enlaces-de-pago.service.ts:147` · **works** · gates: `token`
  - O link Wompi con monto (wompi-link-con-monto.service.ts:94, redirect-url = /p/:token)
- [link] **Bot: medios de pago de la familia** — `services/whatsapp-medios-de-pago.service.ts:167` · **works** · gates: `token`
- [link] **Bot: factura → /p/:token#factura** — `services/whatsapp-factura.service.ts:604` · **works** · gates: `token`
- [link] **Bot: venta de servicios** — `services/whatsapp-venta-servicios.service.ts:431` · **works** · gates: `token`
- [link] **Correo estado de cuenta «Ver y pagar»** — `services/estado-de-cuenta.service.ts:759` · **works** · gates: `token`

### Módulo: Acceso

<a id="r-whatsapp-register-invite-id-email"></a>
#### Registro con invitación — `/register?invite={id}&email=`

- **Rol:** whatsapp · **Lo usan:** parent · **Entrada:** sin menú · Bot y cola de comprobantes a familia sin cuenta
- **Archivo:** `services/whatsapp-bot.service.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** no medido

##### Pestaña «Emisores»

- [link] **Bot: familia conocida sin cuenta** — `services/whatsapp-bot.service.ts:1592` · **works** · gates: `sin login; acepta invitación al registrarse (accept_invitation_pro exige mismo correo)`
- [link] **Cola de comprobantes: «crea tu cuenta y se aplica solo»** — `jobs/whatsapp-queue.job.ts:1233` · **works** · gates: `sin login`
- [link] **Bot: sin invitación → /register?phone=** — `services/whatsapp-bot.service.ts:1604` · **partial**
  - No vincula hijos; queda al buzón de la escuela.

<a id="r-whatsapp-login-t-slug"></a>
#### Login con marca — `/login?t={slug}`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Bot «ayuda con la app» (si ajustes.ayudaApp)
- **Archivo:** `services/whatsapp-bot.service.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Emisores»

- [link] **Texto de ayuda con enlace de login** — `services/whatsapp-bot.service.ts:1410` · **works** · gates: `login`

### Módulo: Inscripción

<a id="r-whatsapp-join-slug"></a>
#### Inscripción por QR — `/join/{slug}`

- **Rol:** whatsapp · **Lo usan:** parent · **Entrada:** sin menú · Bot a prospectos; clase de cortesía
- **Archivo:** `services/whatsapp-bot.service.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — QR de inscripción histórico: 1.727 escaneos · 226 registros · 61 pagados

##### Pestaña «Emisores»

- [link] **Bot: QR abierto/sede más usado** — `services/whatsapp-bot.service.ts:2873` · **works** · gates: `sin login (registro inline)`
- [link] **Cortesía semanal: enlace de inscripción** — `services/whatsapp-cortesia-semana.service.ts:164` · **partial**
  - Usa process.env.FRONTEND_URL (no APP_PUBLICA_PROD/appPublica como el resto): desde el BFF de dev manda dev.sportmaps.co a familias reales.

### Módulo: Pagos

<a id="r-whatsapp-my-payments"></a>
#### Mis Pagos (notificaciones / correos) — `/my-payments`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · notifications.link → in-app + push; correos payment-lifecycle-emails.job.ts:407/485, paymentFailureEmail.service.ts:51
- **Archivo:** `../supabase/migrations (25 sitios)` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** partial · **Uso:** usado — payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_approval 4. Pagados por canal: transferencia con comprobante 506 (266 pagadores) · manual escuela 267 · efectivo 189 · transferencia sin comprobante 102 · Wompi 65 (41 pagadores, 3 escuelas)

##### Pestaña «Emisores»

- [link] **Notificaciones de cobro/abono/rechazo (SQL)** — `../supabase/migrations:0` · **partial** · gates: `login`
  - Atleta adulto rebota (window.location) a /athlete-payments.
- [link] **Glosa de comprobante (in-app + correo)** — `jobs/glosa-notifications.job.ts:63` · **broken** · gates: `login`
  - Solo a payments.parent_id; y /athlete-payments no tiene modal de glosa: el atleta adulto no puede responder.
- [link] **Débito automático: saltar ciclo** — `services/autopay.service.ts:240` · **works** · gates: `login && solo padre`

### Módulo: Evaluación post-entreno

<a id="r-whatsapp-post-entreno-sessionid-child-id"></a>
#### Autoevaluación post-entreno — `/post-entreno/{sessionId}[?child_id=]`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Trigger al cerrar la sesión + recordatorios (jobs/post-training-reminders.job.ts)
- **Archivo:** `../supabase/migrations/20260911124834_post_entreno_disparo_notificacion.sql` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuela 224 · autoevaluación por acudiente 184 (11) · por atleta 21 (1)

##### Pestaña «Emisores»

- [link] **Notificación in-app/push «¿Cómo te fue hoy?»** — `../supabase/migrations/20260911124834_post_entreno_disparo_notificacion.sql:130` · **works** · gates: `login`
  - Padre recibe ?child_id=; atleta adulto sin él. No hay canal WhatsApp.

### Módulo: Asistencia

<a id="r-whatsapp-my-attendance"></a>
#### Ausencia registrada — `/my-attendance`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Notificación al padre o al atleta adulto
- **Archivo:** `../supabase/migrations/20260902112920_mark_session_absences_and_escalation.sql` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** broken · **Uso:** no medido

##### Pestaña «Emisores»

- [link] **Notificación de ausencia** — `../supabase/migrations/20260902112920_mark_session_absences_and_escalation.sql:98` · **broken** · gates: `login`
  - /my-attendance no existe en App.tsx → NotFound (resolveNotificationLink lo corregiría pero está sin usar).

### Módulo: Eventos

<a id="r-whatsapp-tournaments-id-register-results"></a>
#### Torneos: inscripción / resultados — `/tournaments/{id}/register | /results`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Notificaciones al abrir torneo y publicar resultados
- **Archivo:** `routes/events.route.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** no medido

##### Pestaña «Emisores»

- [link] **Torneo abierto** — `routes/events.route.ts:508` · **works** · gates: `login`
- [link] **Resultados publicados** — `routes/events.route.ts:1493` · **works** · gates: `login`

### Módulo: Reservas

<a id="r-whatsapp-enrollments"></a>
#### Mis Inscripciones (reserva de clase) — `/enrollments`

- **Rol:** whatsapp · **Lo usan:** parent, athlete · **Entrada:** sin menú · Notificación de reserva
- **Archivo:** `routes/session-bookings.ts` · **Fuente:** `athlete_public.json`
- **Estado (derivado):** works · **Uso:** usado — session_bookings 90 d: atleta 17 · sin usuario 28

##### Pestaña «Emisores»

- [link] **Reserva confirmada/cancelada** — `routes/session-bookings.ts:54` · **works** · gates: `login`

## Hallazgos

### Seguridad (primero)

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | IDOR en el reporte del equipo del coach: el BFF usa service role y solo valida escuela si el rol es `school_admin`; un coach (o reporter) lee roster, asistencia y resultados de **cualquier equipo de cualquier escuela** por UUID. | `/coach-reports` · `pages/CoachReportsPage.tsx:239` · `bff/src/routes/reports.ts:661-680` |
| 2 | El coach puede crear, editar, reasignar entrenadores, archivar y **borrar** cualquier equipo de su escuela (policy sin versionar «Teams: manage staff»; solo Carmel acotado). El gate de UI usa `teams:edit` para «Eliminar permanente». | `/teams` · `components/teams/CreateTeamModal.tsx:439`, `pages/TeamsPage.tsx:325`, `pages/TeamsPage.tsx:807` |
| 3 | Fuga de alcance en `/teams` vista «Deportistas»: lista **todos** los atletas de la escuela con nombre, teléfono y correo del acudiente, no solo los del coach. | `pages/TeamsPage.tsx:266` |
| 4 | Si el coach no tiene `school_staff` con su email, `coachId` queda indefinido y `/students` carga **toda la escuela**. | `pages/SchoolStudentsManagementPage.tsx:603` (líneas 623-624) |
| 5 | `coach_hide_financial_info` no se respeta al crear o editar equipo (precio mensual) ni en «Ver estado de cuenta». | `pages/TeamsPage.tsx:789`, `pages/SchoolStudentsManagementPage.tsx:1358` |
| 6 | La UI de invitaciones le ofrece al coach invitar como Administrador, Contador o Súper Usuario; hoy solo lo frena la RPC `create_invitation`. | `pages/InvitationsManagementPage.tsx:926` (1140-1148) |
| 7 | `/onboarding/coach` sin `allowedRoles`: cualquier rol con onboarding pendiente crea `coach_profiles`. | `pages/onboarding/CoachOnboarding.tsx` |
| 8 | Sin gate de edad en Google OAuth → `/onboarding/role` (preselecciona «Atleta»), `/onboarding/athlete` y `/join-plan`: un menor puede quedar como atleta. El gate de 18 años solo vive en `RegisterPage.tsx:87`. | `pages/OnboardingRolePage.tsx:43`, `pages/onboarding/AthleteOnboarding.tsx:77`, `pages/JoinPlanPage.tsx:110` |
| 9 | Escrituras de dinero desde el cliente: «Nuevo Pago» del acudiente calcula el monto en el navegador con `teams.price_monthly` y crea un cobro nuevo (riesgo de duplicado); el atleta adulto queda como «acudiente de sí mismo»; `PendingEnrollmentModal` simula el pago (setTimeout) e inserta la inscripción activa sin validar pago. | `pages/MyPaymentsPage.tsx:651`, `pages/AthletePaymentsPage.tsx:523`, `components/dashboard/PendingEnrollmentModal.tsx:51` |
| 10 | El check-in por carnet no restringe a los equipos del coach: cualquier carnet de la escuela marca presente. | `pages/CoachCheckInScanPage.tsx:54` |
| 11 | El enlace de cortesía semanal usa `process.env.FRONTEND_URL`: desde el BFF de dev manda `dev.sportmaps.co` a familias reales. | `services/whatsapp-cortesia-semana.service.ts:164` |
| 12 | El perfil público del entrenador lee `coach_availability` directo con `anon`. | `pages/trainer/TrainerPublicProfile.tsx:48` |

### Duplicados (la misma función en 2+ lugares)

| # | Función | Dónde aparece | Evidencia |
|---|---|---|---|
| 1 | Tomar asistencia (coach) | `/coach-attendance` (menú, barra inferior), botón grande y acción rápida del dashboard, «Marcar Presente/Ausente» en `/coach-plans` | `pages/DashboardPage.tsx:493`, `hooks/useDashboardConfig.ts:229`, `pages/CoachPlansPage.tsx:278` |
| 2 | Registrar resultados de partido | `/results`, «Programar Partido» en `/training-plans`, pestaña Resultados de `/coach-reports`; además dos modelos (`match_results` vs `competition_results`) | `pages/ResultsPage.tsx`, `components/school/FootballDashboardModal.tsx:418`, `pages/CoachReportsPage.tsx:759` |
| 3 | Evaluar deportista | «Evaluar» de `/training-plans` vs `/evaluations` (huérfana, escribe `academic_progress`) | `pages/TrainingPlansPage.tsx:785`, `pages/CoachEvaluationsPage.tsx:90` |
| 4 | Informe mensual del equipo | Nota del equipo en `/informe-mensual` (`team_report_notes`) vs nota general de `/coach-reports/entreno-equipo` (`report_section_notes`) | notas de pantalla de ambas |
| 5 | Perfil propio | `/profile` vs `/settings` › Perfil (mismos campos) y tres subidores de avatar con rutas distintas (`/profile`, `/settings`, `CoachProfileWizard`) | `pages/ProfilePage.tsx:183`, `components/settings/ProfileSection.tsx:99`, `components/coach/CoachProfileWizard.tsx:177` |
| 6 | Notificaciones | Campana, `/notifications` y lista del dashboard leen el mismo query `limit 10` | `hooks/useDashboardStats.ts:240`, `pages/DashboardPage.tsx:692` |
| 7 | Onboarding del coach | `/onboarding/coach` y `CoachProfileWizard` autoabierto en el dashboard | `pages/onboarding/CoachOnboarding.tsx:49` |
| 8 | Mis Pagos | Acudiente: banner, tarjeta, acción rápida, menú y barra inferior; atleta: `/my-payments` redirige con `window.location` a `/athlete-payments` (814 vs 1.154 líneas, sin glosas ni débito) | `pages/MyPaymentsPage.tsx:183`, `hooks/useDashboardConfig.ts:187` |
| 9 | Checkout | `PaymentCheckoutModal` vs `/parent-checkout` (reimplementación, aviso doble a la escuela) vs `/p/:token` | `pages/ParentCheckoutPage.tsx:612` |
| 10 | Resultado de pago | `/payment-result` vs `/pagos/confirmacion` (nadie genera esa URL) | `pages/PaymentConfirmationPage.tsx:82` |
| 11 | Progreso y asistencia del hijo | `/academic-progress` = `/children/:id/progress`; `/parent-attendance` = `/children/:id/attendance`; `ChildAttendancePage.tsx` importado sin ruta | `App.tsx:528`, `App.tsx:533`, `App.tsx:100` |
| 12 | Perfil público de escuela | `/s/:slug`, `/schools/:id`, `/escuela/:id` | `pages/PublicSchoolPage.tsx:71`, `pages/SchoolDetailPage.tsx:145` |
| 13 | Portal del entrenador personal | `/trainer/plans` y `/trainer/payments` son envoltorios de 21 líneas sobre `/offerings` y `/payments-automation` de la escuela (se saltan `ModuleGate`); `/trainer/clients` duplica `/students` + `/invitations` | `pages/trainer/TrainerPlans.tsx:20`, `pages/trainer/TrainerPayments.tsx:20` |
| 14 | Disponibilidad | `/coach-plans` muestra dos veces las franjas; `AvailabilityManager` compartido con `/trainer/availability`, `/staff` y `/facilities` | `pages/CoachPlansPage.tsx:156`, `pages/trainer/TrainerAvailability.tsx:256` |

### Rotas (30 acciones)

| Rol | Pantalla | Acción | Dónde | Nota |
|---|---|---|---|---|
| coach | `/profile` | Eliminar Cuenta | `pages/ProfilePage.tsx:402` | Boton sin onClick: no hace nada. |
| coach | `/announcements` | Nuevo Anuncio (abrir dialogo) | `pages/AnnouncementsPage.tsx:161` | teams.coach_id es school_staff.id, no auth uid: la lista de equipos sale vacia para coaches reales (solo mock demoTeams para @demo). |
| coach | `/announcements` | Equipo (Opcional) - 'Todos mis equipos' | `pages/AnnouncementsPage.tsx:188` | <SelectItem value=""> con @radix-ui/react-select 2.2.6 lanza error al abrir el select (value vacio no permitido). |
| coach | `/announcements` | Enviar Anuncio | `pages/AnnouncementsPage.tsx:236` | Insert no envia school_id y la tabla lo tiene NOT NULL (20260217000001_schema_refactored.sql:687) -> falla y muestra 'No se pudo enviar el anuncio'. Aunque insertara, no hay lector (dead). |
| coach | `/teams` | Quitar del equipo | `components/teams/EnrollTeamStudentModal.tsx:286` | Update directo a Supabase; RLS solo deja a owner/admin (comentario en EnrollTeamStudentModal.tsx:296-300). Para el coach siempre falla (ahora con toast de error). |
| coach | `/students` | Seleccionar + Invitar (masivo) | `pages/SchoolStudentsManagementPage.tsx:1515` | Para el coach el RPC lanza 'No se encontró una escuela administrada por ti.' y el bulk-send da 403 (invitations.routes.ts:97). Los checkboxes y el botón se muestran igual. |
| coach | `/students` | Invitar / Invitar acudiente (menú y botón 'Invitar' de la fila) | `pages/SchoolStudentsManagementPage.tsx:1355` | Lleva a /invitations con el formulario precargado, pero create_invitation rechaza al coach (ver /invitations). También en la fila de escritorio, línea 1742. |
| coach | `/students` | Ver estado de cuenta | `pages/SchoolStudentsManagementPage.tsx:1358` | ProtectedRoute bloquea al coach; además contradice coach_hide_financial_info (no está gateado por hideFinancials). |
| coach | `/invitations` | Listado 'Invitaciones enviadas' + estadísticas | `pages/InvitationsManagementPage.tsx:251` | La RLS es solo de admin: el coach ve la lista vacía. El auto-parcheo de invitations dentro del queryFn también fallaría (escribe en BD durante una lectura). |
| coach | `/invitations` | Nueva Invitación (Acudiente / Entrenador / Atleta 18+ / Administrador / Súper Usuario / Co | `pages/InvitationsManagementPage.tsx:926` | El coach falla con 'No se encontró una escuela administrada por ti.' (20260730000003:70). Riesgo de diseño: la UI le ofrece invitar como Administrador/Contador/Súper Usuario (líneas 1140-1148); hoy lo frena solo el RPC. |
| coach | `/invitations` | Editar equipo/plan/mensualidad | `pages/InvitationsManagementPage.tsx:1038` | RLS de admin; además la lista llega vacía. |
| coach | `/invitations` | Copiar link / Enviar por WhatsApp / Reenviar email / Cancelar invitación | `pages/InvitationsManagementPage.tsx:1047` | Sin filas visibles para el coach no hay sobre qué actuar. Reenviar email es fetch sin revisar la respuesta: siempre muestra éxito (líneas 455-476). |
| coach | `/evaluations` | Seleccionar atleta | `pages/CoachEvaluationsPage.tsx:68` | Lee team_members, no school_athletes/enrollments; el roster probablemente sale vacío |
| coach | `/coach-reports/entreno-equipo` | Publicar informe | `pages/CoachTeamPostTrainingReportPage.tsx:267` | The button is shown to the coach with no role check, but the BFF limits publishing to ADMIN_ROLES (bff/src/routes/school/reports.ts:577), so the coach always gets a 403 ('No se pudo publicar'). It also ignores school_set |
| coach | `/vendor/dashboard` | Accesos rápidos: Pedidos / Ingresos -> /orders | `pages/vendor/VendorDashboardPage.tsx:199` | Coach no está en allowedRoles -> /unauthorized |
| coach | `/vendor/dashboard` | Accesos rápidos: Inventario -> /inventory | `pages/vendor/VendorDashboardPage.tsx:203` | Coach -> /unauthorized |
| coach | `/vendor/appointments` | Abrir agenda -> redirect a /schedule | `pages/vendor/VendorAppointmentsPage.tsx:5` | El coach es redirigido a /schedule, que solo admite wellness_professional -> /unauthorized. Un coach que vende servicios no puede ver ni confirmar sus citas |
| coach | `/orders | /inventory` | Pedidos | `config/navigation.ts:138` | Coach -> /unauthorized: el coach-vendedor no puede ver sus pedidos |
| coach | `/orders | /inventory` | Inventario | `config/navigation.ts:132` | Coach -> /unauthorized |
| coach | `/vendor/subscribers` | Listado de suscriptores recurrentes | `pages/vendor/VendorSubscribersPage.tsx:55` | El BFF responde 410 'recurring_v1_retired' a todo /api/v1/recurring (bff/src/index.ts:405); la pantalla siempre muestra error |
| personal_trainer | `/trainer/dashboard` | Mis suscriptores -> /vendor/subscribers | `pages/trainer/TrainerDashboard.tsx:122` | Sin vendor_profile VendorGuard manda a /vendor/onboarding; con perfil, el endpoint devuelve 410 (motor recurring v1 retirado) |
| parent | `/messages` | Listar conversaciones | `pages/MessagesPage.tsx:43` | messages tiene 0 filas; no hay botón para redactar ni responder (solo lectura). Siempre muestra "Sin mensajes aún". Está en el sidebar Y en el bottom nav (1 de 5 slots móviles). |
| athlete | `/my-certificates` | Solicitar constancia | `pages/MyCertificatesPage.tsx:144` | Requiere selectedChild (children.parent_id = usuario): para el atleta adulto la lista sale vacía. |
| athlete | `/profile` | Mi Documento (solo lectura) | `pages/ProfilePage.tsx:74` | Para el atleta busca en children con parent_id = su id: el adulto no está en children, siempre sale «Aún no hay un documento registrado». |
| athlete | `/explorar` | Acciones que piden login → /login?redirect=/explorar | `pages/ExplorarGlobalPage.tsx:512` | LoginPage lee «redirectTo», no «redirect»: tras login cae en /dashboard. |
| public | `/login` | Redirección post-login con ?redirect= | `pages/LoginPage.tsx:75` | Tienda (TiendaPublicaPage.tsx:71), checkout (StoreCheckoutPage.tsx:252), Explorar y Marketplace mandan ?redirect=; Login solo lee ?redirectTo= → cae en /dashboard. |
| public | `/tienda/:slug` | Login para escribir → /login?redirect= | `pages/TiendaPublicaPage.tsx:71` | Param redirect ignorado por LoginPage. |
| public | `/checkout/tienda/:vendorProfileId` | Login → /login?redirect= | `pages/StoreCheckoutPage.tsx:252` | Param redirect ignorado por LoginPage. |
| whatsapp | `/my-payments` | Glosa de comprobante (in-app + correo) | `jobs/glosa-notifications.job.ts:63` | Solo a payments.parent_id; y /athlete-payments no tiene modal de glosa: el atleta adulto no puede responder. |
| whatsapp | `/my-attendance` | Notificación de ausencia | `../supabase/migrations/20260902112920_mark_session_absences_and_escalation.sql:98` | /my-attendance no existe en App.tsx → NotFound (resolveNotificationLink lo corregiría pero está sin usar). |

### Muertas (23 acciones)

| Rol | Pantalla | Acción | Dónde | Nota |
|---|---|---|---|---|
| coach | `/settings` | Guardar (Perfil publico, Aparecer en busquedas, Mostrar estadisticas) | `components/settings/PrivacySection.tsx:32` | Ninguna clave (public_profile, allow_search, show_stats) se consume en frontend, BFF ni migraciones: tab decorativo. |
| coach | `/messages` | Lista de conversaciones | `pages/MessagesPage.tsx:36` | Ningun codigo (frontend, BFF ni migraciones) inserta en messages salvo MessagesDetailPage, que es inalcanzable: la bandeja siempre esta vacia ('Sin mensajes aun'). |
| coach | `/messages` | Buscar conversacion | `pages/MessagesPage.tsx:155` | Solo visible con mensajes. |
| coach | `/messages` | Seleccionar conversacion | `pages/MessagesPage.tsx:166` | Hilo solo lectura: no hay campo para responder ni nuevo mensaje, no marca leido. |
| coach | `/messages` | Enviar mensaje (MessagesDetailPage) | `pages/MessagesDetailPage.tsx:72` | Archivo huerfano: no esta importado en App.tsx ni enrutado; unica pieza capaz de escribir mensajes. |
| coach | `/announcements` | Lista de anuncios enviados | `pages/AnnouncementsPage.tsx:83` | Nadie lee la tabla announcements fuera de esta pagina (ni padres ni atletas): lo enviado no llega a nadie. Mock demoAnnouncements para emails @demo.sportmaps.com. |
| coach | `/evaluations` | Guardar evaluación (habilidad + nivel + comentario) | `pages/CoachEvaluationsPage.tsx:90` | Inalcanzable; inserta child_id con supuestos ("Assuming player_contact_id...") a partir del id de team_members |
| coach | `/vendor/promotions` | Volver al panel | `pages/vendor/VendorPromotionsPage.tsx:14` | Pantalla placeholder 'Próximamente' (línea 33): no hay funcionalidad |
| parent | `/academic-progress` | Evolución de Habilidades | `pages/AcademicProgressPage.tsx:417` | academic_progress tiene ~5 filas; el propio código dice que "nadie la carga" (línea 604). Muestra "Sin evaluaciones registradas aún". |
| parent | `/academic-progress` | Feedback del entrenador (comentarios) | `pages/AcademicProgressPage.tsx:672` | Misma tabla vacía. |
| parent | `/academic-progress` | Resumen Global | `pages/AcademicProgressPage.tsx:696` | Solo aparece si hay academic_progress. |
| parent | `/my-payments` | MercadoPago | `components/payment/PaymentCheckoutModal.tsx:627` | Kill switch mpEnabled=false (SEG-23); todo el código del Brick es inalcanzable. |
| parent | `/messages` | Buscar conversaciones | `pages/MessagesPage.tsx:153` |  |
| parent | `/my-certificates` | Listar constancias | `pages/MyCertificatesPage.tsx:62` | athlete_certificates tiene 0 filas; el ítem del menú no está gateado por el módulo documentos_constancias. |
| parent | `/profile` | Eliminar Cuenta | `pages/ProfilePage.tsx:402` | Botón sin onClick. |
| athlete | `/athlete-payments` | Responder glosa del comprobante | `pages/AthletePaymentsPage.tsx:0` | NO existe en la versión atleta (0 referencias a glosa). MyPaymentsPage sí tiene GlosaRespondModal. Además glosa-notifications.job.ts solo avisa a payments.parent_id. |
| athlete | `/athlete-payments` | Débito automático / factura electrónica preferida / intento fallido | `pages/MyPaymentsPage.tsx:157` | Solo en MyPaymentsPage (padre): useMiDebito habilitado únicamente para role parent. |
| athlete | `/shop` | Catálogo global de products | `pages/ShopPage.tsx:52` | Quitada del menú del atleta (comentario navigation.ts:320-322: la veían atletas de todas las escuelas). Sigue viva por URL. |
| athlete | `/shop` | Agregar al carrito / Checkout → carrito global | `pages/ShopPage.tsx:358` |  |
| athlete | `/profile` | Eliminar Cuenta (Zona de Peligro) | `pages/ProfilePage.tsx:402` | Botón sin onClick. La eliminación real está en Configuración › Seguridad (AccountDeletionCard). |
| athlete | `/settings` | Perfil público / Aparecer en búsquedas / Mostrar estadísticas | `components/settings/PrivacySection.tsx:51` | Se guardan public_profile/allow_search/show_stats/show_achievements pero ningún código de frontend ni BFF los lee. |
| public | `/escuela/:id` | Ver perfil | `pages/SchoolProfilePage.tsx:1` | 0 enlaces internos; sus botones van a /explore. |
| pwa | `-` | subscribeToPush | `pwa/notifications.ts:11` | 0 importaciones; reemplazado por hooks/usePushSubscription. |

### Ocultas (42 acciones)

| Rol | Pantalla | Acción | Dónde | Nota |
|---|---|---|---|---|
| coach | `/teams` | Cobrar a este equipo | `pages/TeamsPage.tsx:380` | Sin ProtectedRoute de rol. El coach tiene teams:create/edit en lib/permissions.ts y la policy sin versionar 'Teams: manage staff' le deja crear/editar/borrar cualquier equipo de su escuela (salvo Carmel), es decir, es má |
| coach | `/students` | Importar CSV | `pages/SchoolStudentsManagementPage.tsx:1391` | El alcance del coach se resuelve con el school_staff por email (frágil). Ocultamientos correctos: CSV, pagos, inactivar y pausa. Rotos para el coach: Invitar (individual y masivo) y Ver estado de cuenta. 'Mis Deportistas |
| coach | `/students` | Subir documento (perfil) | `pages/SchoolStudentsManagementPage.tsx:2559` | El alcance del coach se resuelve con el school_staff por email (frágil). Ocultamientos correctos: CSV, pagos, inactivar y pausa. Rotos para el coach: Invitar (individual y masivo) y Ver estado de cuenta. 'Mis Deportistas |
| coach | `/students` | Cobros y pagos / Registrar pago | `pages/SchoolStudentsManagementPage.tsx:1328` | El alcance del coach se resuelve con el school_staff por email (frágil). Ocultamientos correctos: CSV, pagos, inactivar y pausa. Rotos para el coach: Invitar (individual y masivo) y Ver estado de cuenta. 'Mis Deportistas |
| coach | `/students` | Inactivar / Reactivar; Vacaciones / pausa | `pages/SchoolStudentsManagementPage.tsx:1333` | El alcance del coach se resuelve con el school_staff por email (frágil). Ocultamientos correctos: CSV, pagos, inactivar y pausa. Rotos para el coach: Invitar (individual y masivo) y Ver estado de cuenta. 'Mis Deportistas |
| coach | `/school/enrollment-intake` | Bandeja: crear atleta / vincular / descartar | `pages/school/EnrollmentIntakeInboxPage.tsx:335` | Solo admin. |
| coach | `/invitations` | Estado de envío (banner) / 'Enviar a los que faltan' / 'Reenviar a todas' | `pages/InvitationsManagementPage.tsx:867` | send-status da 403 al coach, así que el banner no se pinta (aun así se dispara la petición). |
| coach | `/coach-attendance` | Reservas del día (PT Sessions): Asistió / No asistió / Cancelar sesión | `pages/CoachAttendancePage.tsx:1112` | Para coach el BFF responde 403 (requireTrainerAuth exige profiles.role=personal_trainer o escuela personal_trainer propia); el fetch devuelve null en silencio y la sección nunca aparece. Código muerto para coach (heredad |
| coach | `/coach-attendance` | Dialog 'No asistió' (devolver crédito / descontar) | `pages/CoachAttendancePage.tsx:1574` | Inalcanzable para coach. |
| coach | `/dashboard/polls` | Nueva encuesta / Crear el primero | `pages/polls/PollsPage.tsx:49` | El BFF sí permite a coach crear (polls.ts:9) pero la UI lo oculta; la descripción dice 'Crea la encuesta del día y compártela por WhatsApp' y el coach no puede. Vacío: 'No hay encuestas creadas aún' sin acción. |
| coach | `/dashboard/polls` | Copiar link | `pages/polls/PollsPage.tsx:118` | Copia /polls/v/:id; no visible para coach. |
| coach | `/dashboard/polls` | Cerrar | `pages/polls/PollsPage.tsx:128` | BFF lo permite a coach. |
| coach | `/dashboard/polls` | Eliminar (¿Eliminar encuesta?) | `pages/polls/PollsPage.tsx:139` | Para coach es solo lectura: todas las acciones están gateadas por isAdmin en la UI aunque el BFF las permite al coach (inconsistencia UI/BFF). Sin gate de ruta (routePermissions.ts:104 no se aplica). |
| coach | `/dashboard/polls/:pollId/results` | Compartir | `pages/polls/PollResultsPage.tsx:77` | Solo lectura para coach. Las confirmaciones de encuesta (session_bookings) no se cruzan con la lista de /coach-attendance salvo vía roster.bookings. |
| coach | `/dashboard/polls/:pollId/results` | Cerrar | `pages/polls/PollResultsPage.tsx:82` | Solo lectura para coach. Las confirmaciones de encuesta (session_bookings) no se cruzan con la lista de /coach-attendance salvo vía roster.bookings. |
| coach | `/dashboard/polls/:pollId/results` | Agregar manualmente | `pages/polls/PollResultsPage.tsx:179` | BFF lo permite a coach (polls.ts:15). |
| coach | `/dashboard/polls/:pollId/results` | Eliminar confirmación (papelera) | `pages/polls/PollResultsPage.tsx:164` | Solo lectura para coach. Las confirmaciones de encuesta (session_bookings) no se cruzan con la lista de /coach-attendance salvo vía roster.bookings. |
| coach | `/results` | Eliminar resultado | `pages/ResultsPage.tsx:380` | Inconsistente: en deportes por sets el coach SÍ puede borrar (CompetitionResultsList). |
| coach | `/training-plans` | Eliminar sesión | `pages/TrainingPlansPage.tsx:459` | RLS training_plans_delete excluye coach; botón oculto |
| coach | `/school/routines/:routineId` | Historial de uso | `pages/trainer/TrainerRoutineDetail.tsx:96` | En contexto escuela se fuerza a [] (endpoint trainer bajo requireTrainerAuth) |
| coach | `/informe-mensual` | Quién publica y envía | `pages/MonthlyReportsPage.tsx:362` | Admin only. |
| coach | `/informe-mensual` | Generar borradores de {Mes} | `pages/MonthlyReportsPage.tsx:399` | Admin only; the coach depends on the school generating drafts first. |
| coach | `/vendor/services` | Editar servicio | `pages/vendor/VendorServicesPage.tsx:159` | Botón deshabilitado con title 'Edicion proximamente'; el BFF ya tiene PATCH /:id sin UI |
| parent | `/dashboard` | Activar Mi Tienda (CTA) | `components/vendor/ActivateStoreCTA.tsx:70` | parent no está en ELIGIBLE_ROLES; nunca se muestra al acudiente. |
| parent | `/children` | Solicitar pausa (vacaciones/lesión) | `hooks/usePauses.ts:74` | Se autooculta si la escuela no habilitó pausas; enrollment_pause_requests tiene 0 filas. |
| parent | `/children` | Retirar solicitud de pausa | `hooks/usePauses.ts:100` | Igual que solicitar pausa. |
| parent | `/calendar` | Nuevo Evento (encabezado) | `pages/CalendarPage.tsx:611` | parent no tiene calendar:create (lib/permissions.ts:71). |
| parent | `/explorar` | Explorar escuelas/eventos/servicios | `pages/ExplorarGlobalPage.tsx:1` | Oculto del menú en prod pero alcanzable por enlaces internos; ruta pública fuera del layout autenticado (sin sidebar). |
| parent | `/academic-progress` | Historial de sesiones PT + detalle | `pages/AcademicProgressPage.tsx:773` | Tab solo visible si el hijo tiene sesiones de entrenador personal (87 filas totales). |
| parent | `/academic-progress` | Progreso por ejercicio | `pages/AcademicProgressPage.tsx:832` |  |
| parent | `/academic-progress` | Módulo de bienestar (WellnessModule, solo lectura) | `pages/AcademicProgressPage.tsx:876` |  |
| parent | `/parent-attendance` | Sesiones PT asistidas | `pages/AttendancePage.tsx:73` | Solo con entrenador personal. |
| parent | `/children/:id/post-entreno-informe` | Ver agregado del equipo con el dato del hijo | `pages/ChildPostTrainingReportPage.tsx:179` | Sin ningún enlace entrante en front ni BFF (grep "post-entreno-informe" solo en App.tsx). Pantalla huérfana. |
| parent | `/mi-tienda` | Redirige a /tienda/:slug si la tienda de la escuela vende | `pages/MiTiendaPage.tsx:25` | Visible solo si la escuela activa tiene tienda vendiendo; si no, aviso "La tienda aún no está disponible". |
| parent | `/mis-compras` | Listar pedidos | `lib/api/storeApi.ts:227` | orders: 4 filas. |
| parent | `/enrollments` | Agendar sesión PT | `pages/MyEnrollmentsPage.tsx:1612` | Solo con entrenador personal. |
| parent | `/enrollments` | Reservar instalación | `pages/MyEnrollmentsPage.tsx:495` | Solo si el plan incluye instalaciones. |
| parent | `/enrollments` | Agendar clase de prueba | `pages/MyEnrollmentsPage.tsx:517` | Copy con voseo ("¿Querés probar…?", l.513). |
| athlete | `/calendar` | Nuevo Evento | `pages/CalendarPage.tsx:611` | El atleta normalmente no tiene calendar:create; botón oculto para él. |
| athlete | `/my-certificates` | Listar constancias | `pages/MyCertificatesPage.tsx:62` | El atleta no la tiene en el menú; el formulario de solicitud pide elegir un hijo (children), así que el adulto no puede pedir la suya. |
| athlete | `/messages` | Ver conversaciones | `pages/MessagesPage.tsx:43` | Sin entrada en la navegación del atleta (memoria: módulo Mensajes roto 08-31). |
| athlete | `/explorar` | Explorar escuelas / eventos / servicios | `pages/ExplorarGlobalPage.tsx:1` | Oculto del menú en prod pero 6+ botones (checklist, MyEnrollments, MyEventRegistrations, MyAppointments) llevan aquí. |

### Menú lateral vs barra inferior

- **coach** — barra inferior: `/dashboard`, `/profile`, `/messages` (dead), `/teams`, `/coach-attendance`. Solo en la barra (no en el menú lateral): `/profile`.
- **personal_trainer** — barra inferior: `/trainer/dashboard`, `/enrollments | /mi-plan | /settings | /calendar | /messages | /profile`.
- **parent** — barra inferior: `/dashboard`, `/children`, `/my-payments`, `/mi-tienda`, `/messages` (broken).
- **athlete** — barra inferior: `/dashboard`, `/training`, `/enrollments`, `/mi-tienda`, `/profile`. Solo en la barra (no en el menú lateral): `/profile`.
- **Mensajes** ocupa 1 de 5 lugares de la barra del coach y del acudiente («Chat») y la tabla `messages` tiene 0 filas: el módulo no tiene forma de redactar (`MessagesDetailPage` no está enrutada).
- `personal_trainer` no tiene caso propio en `MobileBottomNav.tsx:51`: su «Calendario» es el de la escuela, no su agenda.
- Coach: el ítem «Supervisión» del menú abre «Tomar lista» (`/coach-attendance`); el menú dice «Sesiones de Entrenamiento» y la pantalla «Métricas y Rendimiento»; «Mis Planes» no son planes sino disponibilidad (`/coach-plans`).
- Coach: los ítems de Calendario e Informe Mensual del menú no tienen `moduleKey`, así que apagar el módulo no los oculta al coach (`config/navigation.ts:405`, `:424`).
- Acudiente: `/profile` solo se alcanza desde el checklist; atleta: `/profile` solo desde la barra inferior. `/my-event-registrations` está fuera del layout autenticado y se pierde el menú al entrar.
- Explorar (`/explorar`) está oculto en producción (`SHOW_EXPLORE = import.meta.env.DEV`) pero 6+ botones (checklist, Mis Inscripciones, Mis Eventos, Mis Citas) llevan ahí; tras login `?redirect=` se ignora (`LoginPage.tsx:75` lee `redirectTo`).

### Más y menos usado (de este alcance)

- **Más:** asistencia del coach (2.636 marcas, 17 coaches, 6 escuelas; 163 sesiones creadas), disponibilidad del coach (734 filas, 18 coaches, 13 escuelas), pago por enlace `/p/:token` (929 creados, 211 abiertos), comprobantes del acudiente (486 + 56 por WhatsApp; 266 pagadores), métricas del coach (665 manuales + 271 en sesión), carnets (499 activos), QR de inscripción (1.727 escaneos, 226 registros), autoevaluación post-entreno (184 por acudientes, 21 por atletas).
- **Cero:** mensajes, anuncios, objetivos del atleta, constancias, citas de bienestar en 90 d, pacientes, `health_records`, `athlete_payments`, encuestas en 90 d, subidas de matrícula por coach, rutinas creadas por coach. **Casi cero:** pedidos (3), inscripciones a eventos (4), `training_logs` (9), dotación (4 asignaciones). Informes mensuales: 157 generados y **5** vistos alguna vez. Notificaciones al acudiente: 3.640 y **153** leídas.
