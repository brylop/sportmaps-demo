# Cruce: app actual ↔ rediseño (V1 y V2)

> 2026-10-10. Insumos: los cuatro mapas de `docs/mapa-app/` (escuela, entrenador-acudiente-deportista, otros-roles-y-publicas; 342 entradas de pantalla) y el lienzo «SportMaps — Rediseño global» (`canvas.json` + 49 tableros `*.dc.html`; los `V2*` son la versión 2, el resto la V1). El uso sale de los mapas (base viva, solo lectura, 90 días).

**Cómo leer.** Cada pantalla tiene su lugar en la **V1** (tablero, o entrada del menú en «Navegación por rol» / «Menú lateral» / «Barra inferior» cuando no hay tablero dibujado) y en la **V2** (la V2 solo dibuja 9 tareas en el celular; lo que no toca **hereda la V1**). Destino: *vive en el rediseño* · *se fusiona* (pasa a pestaña o bloque de otra pantalla) · *se elimina* (sin uso o muerta) · ***falta en el rediseño*** (se usa o se necesita y no tiene lugar) · *fuera de alcance* (públicas y de sistema: la regla de Main es «las URL no cambian»).

**Antes de leer: el rediseño se contradice en la navegación de escuela.** «Navegación por rol» define 10 entradas (Hoy · Deportistas · **Deportivo** · Asistencia · Calendario · **Dinero** · Tienda · WhatsApp · Escuela · Configuración) y barra «Hoy · Deportistas · Dinero · Deportivo · Más». El componente «Menú lateral» dibuja Hoy · Deportistas · **Entrenadores** · Asistencia · Calendario · **Cobros** · Tienda · WhatsApp · Escuela · Configuración (sin «Deportivo») y la «Barra inferior» dibuja «Hoy · Deportistas · Cobros · Entrenadores · Más». Hay que decidir cuál manda antes de la Capa 2.

**Resumen de destinos (342 entradas):** vive en el rediseño 130 · se fusiona 62 · se elimina 55 · falta 38 · fuera de alcance 57.

## 1. Cada pantalla actual y dónde vive en el rediseño

### Escuela (owner / school_admin) (69)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| school+school_admin | Shell (encabezado y barra) › Encabezado global (campana, avatar, soporte, banners) | `(todas las rutas autenticadas)` | works | usado: notifications r90=5405 s90=20 tot=5693; support_tickets r90=8 s90=7 tot=8 | **Menú lateral (compartido)** (Componentes); **Varias escuelas y roles** (V1); Mapa del rediseño › soporte dentro de «Más» | — (hereda V1) | vive en el rediseño | Encabezado: campana con avisos de otros espacios (Espacios), selector de espacio y soporte que pasa a «Más». |
| school+school_admin | Principal › Dashboard | `/dashboard` | works | no medido | **Escuela · Hoy** (V1); **Escuela · Hoy (celular)** (V1) | **1 · Hoy: una frase, un botón** (V2); **5 · Lo mismo en el computador** (V2) | vive en el rediseño | Se rehace como «Hoy»: pendientes, dinero del mes, entrenos de hoy. El asistente de arranque (SchoolOnboardingWizard) pasa a V2EscuelaNueva. Acciones rápidas configurables desaparecen. |
| school+school_admin | Principal › Deportistas | `/students` | works | usado: children r90=412 s90=14 tot=1136; enrollments r90=921 s90=18 tot=1929 | **Escuela · Deportistas** (V1) | **4 · Cargar deportistas con una foto** (V2) | vive en el rediseño | Pestaña «Deportistas» con ficha lateral (Resumen · Pagos · Asistencia · Evaluaciones · Documentos). Importar CSV sigue en «Importar». |
| school+school_admin | Principal › Matrículas por revisar | `/school/enrollment-intake` | works | usado: enrollment_form_intake r90=14 s90=2 tot=14 | **Escuela · Deportistas** (V1); Navegación por rol › Deportistas › Matrículas por revisar | **1 · Hoy: una frase, un botón** (V2) | se fusiona con Escuela · Deportistas (V1) | Pasa a pestaña «Matrículas por revisar» de Deportistas; en V2 se llama «solicitudes de ingreso». |
| school+school_admin | Principal › Entrenadores | `/staff` | works | usado: school_staff r90=49 s90=14 tot=90 | Navegación por rol › Escuela › Personal; Menú lateral › school › Entrenadores; Barra inferior › school › Entrenadores | **5 · Lo mismo en el computador** (V2) | vive en el rediseño | Sin tablero propio. Ojo: Navegación lo pone en «Escuela › Personal» y el Sidebar/TabBar lo sacan como entrada «Entrenadores» (el rediseño se contradice). |
| school+school_admin | Principal › Invitaciones | `/invitations` | works | usado: invitations r90=259 s90=14 tot=856 | **Escuela · Deportistas** (V1); Navegación por rol › Deportistas › Invitaciones | **4 · Primera vez: «¿Eres Carolina?»** (V2); **4 · Cargar deportistas con una foto** (V2) | se fusiona con Escuela · Deportistas (V1) | Pestaña «Invitaciones» de Deportistas. V2: se invita por WhatsApp al terminar la carga por foto y el acudiente entra con «¿Eres Carolina?». |
| school+school_admin | Gestión Deportiva › Seguimiento deportivo | `/seguimiento-deportivo` | works | usado: training_sessions r90=67 s90=4 tot=70; match_results r90=34 s90=4 tot=34 | **Escuela · Seguimiento deportivo** (V1) | **5 · Lo mismo en el computador** (V2) | vive en el rediseño | Vista de solo lectura por entrenador (regla 02 de Main: «el dueño mira, el entrenador hace»). |
| school+school_admin | Gestión Deportiva › Mis Equipos | `/teams` | works | usado: teams r90=80 s90=13 tot=156 | Navegación por rol › Deportivo › Equipos y categorías; **Escuela · Seguimiento deportivo** (V1) | — (hereda V1) | se fusiona con Navegación por rol › Deportivo › Equipos y categorías | Pasa a pestaña «Equipos y categorías» de Deportivo; no hay tablero dibujado. El enlace «Ver Equipos» → /programs-management desaparece. |
| school+school_admin | Gestión Deportiva › Deportes y Categorías | `/school-sports` | hidden | usado: school_categories escuelas=3 | Navegación por rol › Deportivo › Equipos y categorías; **Escuela · Configuración** (V1) | — (hereda V1) | se fusiona con Navegación por rol › Deportivo › Equipos y categorías | Sección «Deportes y categorías» de Configuración + pestaña Equipos y categorías. |
| school+school_admin | Gestión Deportiva › Membresías | `/memberships` | hidden | sin uso: memberships r90=0 s90=0 tot=0 | — | — | se elimina (sin uso o muerta) | memberships = 0 filas; solo visible con billing_enabled=false (1 de 371 escuelas). |
| school+school_admin | Gestión Deportiva › Mis Planes (ofertas) | `/offerings` | works | usado: offering_plans r90=72 s90=11 tot=158; offerings r90=41 | — | **3 · Escuela nueva: 3 pasos** (V2) | **falta en el rediseño** | No hay pestaña ni entrada «Planes» en Navegación ni en EscuelaConfig (solo dice «se configuran en cada plan»). V2EscuelaNueva tiene el paso «cuánto cobras» pero no la gestión de planes. offering_plans: 72 filas en 90 d, 11 escuelas. |
| school+school_admin | Gestión Deportiva › Calendario | `/calendar` | works | usado: calendar_events r90=106 s90=5 tot=114 | Navegación por rol › Calendario › Calendario | — (hereda V1) | vive en el rediseño | Sin tablero dibujado. |
| school+school_admin | Gestión Deportiva › Métricas y Rendimiento (sesiones) | `/training-plans` | works | usado: training_sessions r90=67 s90=4 tot=70; training_mesocycles r90=16 s90=4 tot=16; performance_entries r90=1367 s | **Escuela · Seguimiento deportivo** (V1); Navegación por rol › Deportivo › Sesiones y mesociclos | — (hereda V1) | se fusiona con Escuela · Seguimiento deportivo (V1) | Para la escuela pasa a pestaña «Sesiones y mesociclos» del Seguimiento (solo lectura); la edición queda en los tableros del entrenador. |
| school+school_admin | Gestión Deportiva › Gestión de Rutinas | `/school/routines` | works | usado: trainer_routines r90=11 s90=3 tot=36; trainer_session_plans r90=22 s90=6 tot=87 | **Escuela · Seguimiento deportivo** (V1); Navegación por rol › Deportivo › Biblioteca | — (hereda V1) | se fusiona con Escuela · Seguimiento deportivo (V1) | Pestaña «Biblioteca de ejercicios». Hoy hay dos bibliotecas distintas (trainer_routines y ejercicios de sesiones): el rediseño no dice cuál queda. |
| school+school_admin | Gestión Deportiva › Detalle de rutina | `/school/routines/:routineId` | works | usado: trainer_routines r90=11 s90=3 tot=36 | **Escuela · Seguimiento deportivo** (V1); Navegación por rol › Deportivo › Biblioteca | — (hereda V1) | se fusiona con Escuela · Seguimiento deportivo (V1) | Detalle dentro de la Biblioteca. |
| school+school_admin | Gestión Deportiva › Informe Mensual | `/informe-mensual` | works | usado: athlete_reports r90=157 s90=6 tot=157 | **Escuela · Seguimiento deportivo** (V1); Navegación por rol › Deportivo › Evaluaciones e informes | **1 · El cobro llega por WhatsApp** (V2); **6 · La app, para quien quiera más** (V2) | se fusiona con Escuela · Seguimiento deportivo (V1) | Pestaña «Evaluaciones e informes». V2: el informe llega a la familia por WhatsApp. |
| school+school_admin | Gestión Deportiva › Supervisión de asistencias | `/attendance-supervision` | works | usado: attendance_sessions r90=1196 s90=13 tot=3622; attendance_records r90=4981 s90=11 tot=5034 | **Escuela · Asistencia por mes** (V1) | **1 · Hoy: una frase, un botón** (V2) | se fusiona con Escuela · Asistencia por mes (V1) | Pestaña «Supervisión de hoy»; V2 resume «2 profes no tomaron lista ayer». |
| school+school_admin | Gestión Deportiva › Histórico de asistencias | `/attendance-history` | works | usado: attendance_records r90=4981 s90=11 tot=5034 | **Escuela · Asistencia por mes** (V1) | — (hereda V1) | vive en el rediseño | Pestañas «Por mes» y «Por atleta» + CSV. «Por día», «Día por día» y «Plan vs consumo» (AttendanceHistoryPage.tsx:672-681) no están dibujadas. |
| school+school_admin | Gestión Deportiva › Encuestas | `/dashboard/polls` | works | sin uso: attendance_polls r90=0 s90=0 tot=3 | Navegación por rol › Asistencia › Encuestas | — (hereda V1) | vive en el rediseño | El rediseño la mantiene como pestaña aunque attendance_polls = 0 en 90 d (3 históricas). Candidata a quitar. |
| school+school_admin | Gestión Deportiva › Resultados de encuesta | `/dashboard/polls/:pollId/results` | works | sin uso: attendance_polls r90=0 s90=0 tot=3 | Navegación por rol › Asistencia › Encuestas | — (hereda V1) | vive en el rediseño | Igual que Encuestas (0 en 90 d). |
| school+school_admin | Gestión Deportiva › Resultados | `/results-overview` | broken | no medido | Navegación por rol › Calendario › Resultados | — (hereda V1) | se fusiona con Navegación por rol › Calendario › Resultados | Navegación: «Resultados → Calendario y torneos: un resultado es parte del partido». Hoy la pantalla está rota (vacía fuera de demo). |
| school+school_admin | Gestión Deportiva › Mis Torneos | `/school/tournaments` | partial | usado: events r90=8 s90=4 tot=9 | Navegación por rol › Calendario › Torneos y partidos | — (hereda V1) | se fusiona con Navegación por rol › Calendario › Torneos y partidos | Pestaña «Torneos y partidos» de Calendario. Sin tablero. |
| school+school_admin | Gestión Deportiva › Crear torneo | `/school/tournaments/new` | partial | usado: events r90=8 s90=4 tot=9 | Navegación por rol › Calendario › Torneos y partidos | — (hereda V1) | se fusiona con Navegación por rol › Calendario › Torneos y partidos | Pestaña «Torneos y partidos» de Calendario. Sin tablero. |
| school+school_admin | Gestión Deportiva › Detalle de torneo | `/school/tournaments/:id` | partial | usado: events r90=8 s90=4 tot=9 | Navegación por rol › Calendario › Torneos y partidos | — (hereda V1) | se fusiona con Navegación por rol › Calendario › Torneos y partidos | Pestaña «Torneos y partidos» de Calendario. Sin tablero. |
| school+school_admin | Gestión Deportiva › Dotación | `/school/equipment` | works | usado: equipment_items r90=3 s90=2 tot=3; equipment_assignments r90=4 s90=2 tot=4 | — | — (hereda V1) | **falta en el rediseño** | No aparece en el menú de escuela del rediseño (solo en «Más» del entrenador). 3 ítems y 4 asignaciones en 2 escuelas. |
| school+school_admin | Gestión Deportiva › Disponibilidad médica | `/disponibilidad-medica` | works | sin uso: clinical_patients r90=0 s90=0 tot=0; athlete_injuries r90=0 s90=0 tot=0 | **Profesional de salud · Agenda** (V1); Navegación por rol › entrenador › Más (salud) | — (hereda V1) | vive en el rediseño | Para la escuela no hay entrada; SaludAgenda dibuja «Lo que ve el entrenador». clinical_patients = 0. |
| school+school_admin | Finanzas › Pagos (cartera y cobros) | `/payments-automation` | works | usado: payments r90=4960 s90=25 tot=5497; payment_glosas r90=2 s90=2 tot=2; monthly_closes r90=5 s90=2 tot=5; charge_ | **Escuela · Cobros y pagos** (V1) | **2 · Aprobar sin miedo: deshacer** (V2); **1 · Hoy: una frase, un botón** (V2); **5 · Lo mismo en el computador** (V2) | vive en el rediseño | Dinero: Por validar · Cobros del mes · Vencidos · Pagos únicos · Operaciones · Contabilidad · Medios de pago. Glosas, Conciliación, Cierre de mes e Historial no están dibujados. «Cobros y pagos» y «Cobrar a un equipo» dependen del flujo oculto VITE_COBROS_Y_PAGOS (charge_batches = 0). |
| school+school_admin | Finanzas › Modo Recepción (kiosko) | `/recepcion` | works | no medido | Navegación por rol › Dinero › Recepción | — (hereda V1) | se fusiona con Navegación por rol › Dinero › Recepción | Pestaña «Recepción» de Dinero. Sin tablero. |
| school+school_admin | Finanzas › Contabilidad (libro de caja) | `/accounting` | works | usado: expenses r90=20 s90=3 tot=21; electronic_invoices r90=324 s90=2 tot=324 | **Escuela · Cobros y pagos** (V1); Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Escuela · Cobros y pagos (V1) | Navegación: «Contabilidad ×5 → Contabilidad, con pestañas». |
| school+school_admin | Finanzas › Proveedores | `/accounting/suppliers` | works | usado: suppliers r90=4 s90=3 tot=4 | **Escuela · Cobros y pagos** (V1); Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Escuela · Cobros y pagos (V1) | Navegación: «Contabilidad ×5 → Contabilidad, con pestañas». |
| school+school_admin | Finanzas › Nómina | `/accounting/payroll` | works | usado: payroll_runs r90=2 s90=2 tot=2 | **Escuela · Cobros y pagos** (V1); Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Escuela · Cobros y pagos (V1) | Navegación: «Contabilidad ×5 → Contabilidad, con pestañas». |
| school+school_admin | Finanzas › Estado de resultados | `/accounting/reports` | works | no medido | **Escuela · Cobros y pagos** (V1); Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Escuela · Cobros y pagos (V1) | Navegación: «Contabilidad ×5 → Contabilidad, con pestañas». |
| school+school_admin | Finanzas › Presupuesto | `/accounting/budget` | works | usado: budgets r90=12 s90=3 tot=12 | **Escuela · Cobros y pagos** (V1); Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Escuela · Cobros y pagos (V1) | Navegación: «Contabilidad ×5 → Contabilidad, con pestañas». |
| school+school_admin | Finanzas › Facturación electrónica (standalone) | `/facturacion-electronica` | works | usado: electronic_invoices r90=324 s90=2 tot=324 | Navegación por rol › Dinero › Contabilidad o Facturación | — (hereda V1) | se fusiona con Navegación por rol › Dinero › Contabilidad o Facturación | Una sola pestaña «Contabilidad o Facturación» según addon. |
| school+school_admin | Reportes › Finanzas (reporte) | `/finances` | works | no medido | **Escuela · Hoy** (V1); **Escuela · Cobros y pagos** (V1) | **1 · Hoy: una frase, un botón** (V2) | se fusiona con Escuela · Hoy (V1) | Navegación: «Panel, Reportes, Finanzas → Hoy + cada módulo». La antigüedad por atleta y el WhatsApp a deudores (PaymentAgingCard.tsx:250) deben quedar en «Vencidos». |
| school+school_admin | Reportes › Reportes | `/school-reports` | works | no medido | **Escuela · Hoy** (V1) | — (hereda V1) | se fusiona con Escuela · Hoy (V1) | «Cada número vive junto a lo que mide». Los CSV de ReportsPage.tsx:320-565 no tienen destino dibujado. |
| school+school_admin | Reportes › Panel de Reportes (cartera por estado) | `/reporter-dashboard` | works | no medido | **Escuela · Hoy** (V1) | — (hereda V1) | se fusiona con Escuela · Hoy (V1) | Igual que Reportes; 6 exportes CSV (ReporterDashboardPage.tsx:177-832) sin destino dibujado. |
| school+school_admin | Documentos e Identidad › Carnets Digitales (+ Plantillas ?tab=templates) | `/cards` | works | usado: athlete_id_cards r90=508 s90=3 tot=513; athlete_id_card_templates r90=2 s90=2 tot=2 | **Escuela · Deportistas** (V1); Navegación por rol › Deportistas › Carnets y constancias | — (hereda V1) | se fusiona con Escuela · Deportistas (V1) | Navegación: «Constancias, Carnets ×2 → Carnets y constancias». |
| school+school_admin | Documentos e Identidad › Constancias | `/certificates` | works | sin uso: athlete_certificates r90=0 s90=0 tot=0 | **Escuela · Deportistas** (V1); Navegación por rol › Deportistas › Carnets y constancias | — (hereda V1) | se fusiona con Escuela · Deportistas (V1) | athlete_certificates = 0 histórico: se fusiona, pero es candidata a quitar. |
| school+school_admin | Documentos e Identidad › Plantillas de constancias | `/cards/templates/certificates` | works | sin uso: school_certificate_templates r90=0 s90=0 tot=0 | Navegación por rol › Deportistas › Carnets y constancias | — (hereda V1) | se fusiona con Navegación por rol › Deportistas › Carnets y constancias | school_certificate_templates = 0. |
| school+school_admin | Documentos e Identidad › QR de Inscripción | `/qr-signup` | works | usado: school_join_qr_codes r90=7 s90=5 tot=12 | — | **1 · Hoy: una frase, un botón** (V2) | **falta en el rediseño** | Ninguna pestaña lo nombra (Deportistas: Deportistas · Matrículas · Invitaciones · Carnets). V2 solo muestra el resultado («llegaron por el QR»). 1.727 escaneos, 226 registros, 61 pagados. |
| school+school_admin | Comunicación › WhatsApp | `/whatsapp` | works | usado: whatsapp_conversations r90=292 s90=2 tot=292; school_whatsapp_integrations total=2 | Navegación por rol › WhatsApp › Conversaciones; Menú lateral › school › WhatsApp; **Escuela · Configuración** (V1) | **1 · El cobro llega por WhatsApp** (V2); **5 · Autoevaluación en el chat** (V2) | vive en el rediseño | Entrada propia «WhatsApp». V2 dibuja el lado de la familia. |
| school+school_admin | Comunicación › Recordatorios de pago | `/payment-reminders` | works | usado: payment_message_templates r90=1 s90=1 tot=19; payment_reminder_logs r90=4 | Navegación por rol › WhatsApp › Recordatorios; **Escuela · Configuración** (V1) | — (hereda V1) | se fusiona con Navegación por rol › WhatsApp › Recordatorios | Pestaña «Recordatorios» + bloque «Recordatorios automáticos» de Configuración › Cobros. |
| school+school_admin | Comunicación › Plantillas de Mensajes | `/message-templates` | works | usado: payment_message_templates r90=1 s90=1 tot=19 | Navegación por rol › WhatsApp › Avisos y plantillas | — (hereda V1) | se fusiona con Navegación por rol › WhatsApp › Avisos y plantillas | Pestaña «Avisos y plantillas» (que también absorbe Anuncios). |
| school+school_admin | Sedes e Instalaciones › Sedes | `/branches` | works | usado: school_branches r90=24 s90=16 tot=427 | Navegación por rol › Escuela › Sedes e instalaciones | — (hereda V1) | se fusiona con Navegación por rol › Escuela › Sedes e instalaciones | Sin tablero. |
| school+school_admin | Sedes e Instalaciones › Instalaciones (reservas) | `/facilities` | works | usado: facilities r90=22 s90=6 tot=30; facility_reservations r90=34 s90=1 tot=60; session_bookings r90=45 tot=71 | Navegación por rol › Escuela › Sedes e instalaciones | — (hereda V1) | se fusiona con Navegación por rol › Escuela › Sedes e instalaciones | Sin tablero. Incluye clase de prueba y disponibilidad (AvailabilityManager). |
| school+school_admin | Sedes e Instalaciones › Control de Acceso | `/school/access-control` | works | usado: access_events r90=10376 s90=4 tot=14144; turnstile_devices escuelas=3 | Navegación por rol › Escuela › Control de acceso | — (hereda V1) | vive en el rediseño | Sin tablero dibujado pese a ser el módulo con más volumen (access_events 10.376 filas en 90 d). |
| school | Cuenta › Mi Perfil Público | `/school/public-profile` | works | no medido | Navegación por rol › Escuela › Perfil público | — (hereda V1) | vive en el rediseño | Condición por rol, no copia de árbol. |
| school+school_admin | Cuenta › Facturación (plan SaaS) | `/mi-plan` | works | usado: school_subscription_invoices r90=9 s90=4 tot=9 | Navegación por rol › Escuela › Plan; **Super Admin · Consola** (V1) | — (hereda V1) | vive en el rediseño |  |
| school+school_admin | Cuenta › Recibo de factura SaaS | `/facturacion/recibo/:invoiceId` | works | usado: school_subscription_invoices r90=9 s90=4 tot=9 | Navegación por rol › Escuela › Plan | — (hereda V1) | vive en el rediseño |  |
| school+school_admin | Cuenta › Configuración | `/settings` | works | no medido | **Escuela · Configuración** (V1) | Mapa del rediseño › V2 regla 07 (valores por defecto) | vive en el rediseño | 10 secciones con «Guardar por sección». |
| school+school_admin | Cuenta › Notificaciones | `/notifications` | works | usado: notifications r90=5405 s90=20 tot=5693 | **Menú lateral (compartido)** (Componentes); **Varias escuelas y roles** (V1) | — (hereda V1) | vive en el rediseño | Campana. |
| school+school_admin | Cuenta › Perfil personal | `/profile` | works | no medido | Navegación por rol › Más | — (hereda V1) | vive en el rediseño |  |
| school+school_admin | Cuenta › Mensajes (chat) | `/messages` | broken | sin uso: messages r90=0 s90=0 tot=0 | Navegación por rol › Más (Mensajes no se borra) | — (hereda V1) | vive en el rediseño | Main: «Mensajes no se borra: sale de la barra y queda dentro de Más». Hoy está rota y tiene 0 mensajes. |
| school+school_admin | Tu tienda › Ajustes de la tienda (activar / cobros y entrega) | `/tienda-escuela/ajustes` | hidden | usado: school_addons(store) escuelas=7 | Navegación por rol › Tienda (solo con addon); **Varias escuelas y roles** (V1) | — (hereda V1) | vive en el rediseño | Tienda escolar = entrada «Tienda» del menú de la escuela. |
| school+school_admin | Tu tienda › Pedidos | `/orders` | hidden | usado: orders r90=3 s90=1 tot=4 | **Tienda · Pedidos** (V1); Navegación por rol › Tienda › Pedidos | — (hereda V1) | vive en el rediseño | Hoy oculta: store_enabled global = false. |
| school+school_admin | Tu tienda › Productos | `/vendor/products` | hidden | usado: products r90=3 s90=0 tot=6 | Navegación por rol › Tienda › Productos | — (hereda V1) | vive en el rediseño | Hoy oculta. |
| school+school_admin | Tu tienda › Asistente de producto (crear/editar) | `/vendor/products/new \| /vendor/products/:id/edit` | hidden | usado: products r90=3 s90=0 tot=6 | Navegación por rol › Tienda › Productos | — (hereda V1) | vive en el rediseño | Hoy oculta. |
| school+school_admin | Tu tienda › Inventario | `/inventory` | hidden | usado: products r90=3 s90=0 tot=6 | Navegación por rol › Tienda › Inventario | — (hereda V1) | vive en el rediseño | Hoy oculta. |
| school+school_admin | Sin menú (rutas huérfanas) › Gestión de programas | `/programs-management` | dead route | no medido | — | — | se elimina (sin uso o muerta) | Huérfana; duplica /teams. |
| school+school_admin | Sin menú (rutas huérfanas) › Configuración de escuela (vieja) | `/school-config` | dead route | no medido | **Escuela · Configuración** (V1) | — (hereda V1) | se fusiona con Escuela · Configuración (V1) | Navegación: «/school-config sin enlace → Configuración». |
| school | Sin menú (rutas huérfanas) › Monitor de salida segura | `/pickup` | dead code | no medido | — | — | se elimina (sin uso o muerta) | Mock, sin backend. |
| school+school_admin | Sin menú (rutas huérfanas) › Delegaciones | `/school/delegations` | dead route | usado: event_delegations r90=1 s90=1 tot=1 | — | — | se elimina (sin uso o muerta) | Rota, sin menú y 1 delegación histórica. |
| school+school_admin | Sin menú (rutas huérfanas) › Detalle de delegación | `/school/delegations/:id` | dead route | usado: event_delegations r90=1 s90=1 tot=1 | — | — | se elimina (sin uso o muerta) | Rota, sin menú y 1 delegación histórica. |
| school+school_admin | Sin menú (rutas huérfanas) › Inscribir delegación a evento | `/school/enroll/:eventId` | dead route | usado: event_delegations r90=1 s90=1 tot=1 | — | — | se elimina (sin uso o muerta) | Rota, sin menú y 1 delegación histórica. |
| school+school_admin | Sin menú (rutas huérfanas) › Estado de cuenta | `/estado-cuenta` | works | no medido | **Escuela · Deportistas** (V1) | — (hereda V1) | se fusiona con Escuela · Deportistas (V1) | Bloque «Estado de cuenta» en la ficha del deportista. |
| school+school_admin | Sin menú (rutas huérfanas) › Admin: usuarios (rol school permitido) | `/admin/users` | dead route | no medido | — | — | se elimina (sin uso o muerta) | Acceso de escuela por URL a rutas admin sin strictRoleCheck: cerrar. |
| school+school_admin | Sin menú (rutas huérfanas) › Admin: clubes (rol school permitido) | `/admin/clubs` | dead route | no medido | — | — | se elimina (sin uso o muerta) | Acceso de escuela por URL a rutas admin sin strictRoleCheck: cerrar. |
| school+school_admin | Sin menú (rutas huérfanas) › Admin: analítica (rol school permitido) | `/admin/analytics` | dead route | no medido | — | — | se elimina (sin uso o muerta) | Acceso de escuela por URL a rutas admin sin strictRoleCheck: cerrar. |

### Entrenador (50)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| coach | Inicio › Panel de Entrenador (Dashboard) | `/dashboard` | partial (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ notificatio | **Entrenador · Hoy** (V1) | **1 · Hoy: una sola acción** (V2) | vive en el rediseño | Una sola acción: «Tomar lista». Las 3 entradas a asistencia de hoy se reducen a una. |
| coach | Cuenta › Mi Perfil | `/profile` | partial (derivado) | no medido | Navegación por rol › entrenador › Más | — (hereda V1) | se fusiona con Navegación por rol › entrenador › Más | Se fusiona con Configuración dentro de «Más». |
| coach | Comunicacion › Notificaciones | `/notifications` | partial (derivado) | usado: notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leíd | **Menú lateral (compartido)** (Componentes) | — (hereda V1) | vive en el rediseño | Campana. |
| coach | Cuenta › Configuracion | `/settings` | partial (derivado) | no medido | Navegación por rol › entrenador › Más | — (hereda V1) | se fusiona con Navegación por rol › entrenador › Más |  |
| coach | Comunicacion › Mensajes | `/messages` | dead (derivado) | sin uso: messages: 0 | Navegación por rol › Más (Mensajes no se borra) | — (hereda V1) | vive en el rediseño | Sale de la barra inferior. Hoy muerta (0 mensajes). |
| coach | Comunicacion › Anuncios | `/announcements` | broken (derivado) | sin uso: announcements: 0 | Navegación por rol › WhatsApp › Avisos y plantillas | — (hereda V1) | se fusiona con Navegación por rol › WhatsApp › Avisos y plantillas | Navegación: «Anuncios → Avisos». Hoy rota y sin lector (announcements = 0). |
| coach | Onboarding › Onboarding de entrenador | `/onboarding/coach` | partial (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 | — | — | fuera de alcance (pública/sistema; la URL se conserva) | No dibujada; se conserva. |
| coach | Equipos › Mis Equipos | `/teams` | partial (derivado) | no medido | Navegación por rol › entrenador › Mis equipos; Barra inferior › coach › Equipos | — (hereda V1) | vive en el rediseño | «Tarjetas con lista y roster». Sin tablero. |
| coach | Deportistas › Mis Deportistas | `/students` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | Navegación por rol › entrenador › Mis equipos | — (hereda V1) | se fusiona con Navegación por rol › entrenador › Mis equipos | El roster vive dentro de Mis equipos. |
| coach | Deportistas › Subir hoja de matrícula | `/school/enrollment-intake` | works (derivado) | usado: enrollment_form_intake 90 d: app por escuela 10 · WhatsApp 4 · por coach 0 | — | — (hereda V1) | **falta en el rediseño** | No hay entrada para el coach. Subidas por coach en 90 d: 0 (1 escuela con el permiso). Candidata a quitar para el coach. |
| coach | Comunicación › Invitaciones | `/invitations` | partial (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Rota para el coach (RLS, RPC y BFF son solo de admin). |
| coach | Asistencias › Asistencias (tomar lista) | `/coach-attendance` | partial (derivado) | usado: attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 7 | **Entrenador · Tomar lista** (V1); Navegación por rol › entrenador › Asistencia; Barra inferior › coach › Asistencia | **2 · Lista: todos vinieron, toca al que faltó** (V2) | vive en el rediseño | V2: «todos vinieron, toca al que faltó» y sin señal. |
| coach | Asistencias › Check-in por carnet | `/coach-attendance/scan` | works (derivado) | usado: athlete_id_cards: 499 activos · 0 impresos · 4 escuelas ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6  | — | — (hereda V1) | **falta en el rediseño** | Sin lugar. Uso: 1 marca por QR y 12 por torniquete en 90 d. |
| coach | Asistencias › Encuestas de asistencia | `/dashboard/polls` | works (derivado) | sin uso: attendance_polls 90 d: 0 (3 históricas) | — | — | se elimina (sin uso o muerta) | El menú del entrenador del rediseño no tiene Encuestas; 0 en 90 d y para el coach es solo lectura. |
| coach | Asistencias › Resultados de encuesta | `/dashboard/polls/:pollId/results` | works (derivado) | usado: attendance_polls 90 d: 0 (3 históricas) ¦ attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escue | — | — | se elimina (sin uso o muerta) | El menú del entrenador del rediseño no tiene Encuestas; 0 en 90 d y para el coach es solo lectura. |
| coach | Resultados › Resultados | `/results` | partial (derivado) | usado: match_results 90 d: 34 (4 escuelas) | Navegación por rol › entrenador › Calendario (entrenos y partidos) | — (hereda V1) | se fusiona con Navegación por rol › entrenador › Calendario (entrenos y partidos) | Resultado = parte del partido. |
| coach | Calendario › Mi Calendario | `/calendar` | works (derivado) | no medido | Navegación por rol › entrenador › Calendario | — (hereda V1) | vive en el rediseño |  |
| coach | Entrenamiento › Sesiones de Entrenamiento (Métricas y Rendimiento) | `/training-plans` | partial (derivado) | usado: training_sessions 90 d: coach 3 · sin created_by 64 ¦ training_mesocycles histórico: coach 12 (6 coaches, 3 es | **Entrenador · Sesiones de la semana** (V1); **Entrenador · Mesociclo** (V1); **Entrenador · Pizarra** (V1); **Entrenador · Evaluación rápida** (V1) | **4 · El plan de hoy, en palabras** (V2); **3 · Evaluar el equipo en una pantalla** (V2) | vive en el rediseño | Se parte en cuatro tableros: semana, mesociclo, pizarra y evaluación rápida. |
| coach | Entrenamiento › Mis Planes y Disponibilidad | `/coach-plans` | works (derivado) | usado: session_bookings 90 d: atleta 17 · sin usuario 28 ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuel | — | — (hereda V1) | **falta en el rediseño** | Disponibilidad y citas del coach no aparecen en el menú de 7 entradas ni en «Más». coach_availability: 734 filas, 18 coaches, 13 escuelas. |
| coach | Entrenamiento › Gestión de Rutinas | `/school/routines` | works (derivado) | usado: trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0 | Navegación por rol › entrenador › Más (Rutinas) | — (hereda V1) | vive en el rediseño | Rutinas creadas por coach: 0. |
| coach | Entrenamiento › Detalle de rutina | `/school/routines/:routineId` | partial (derivado) | usado: trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0 | Navegación por rol › entrenador › Más (Rutinas) | — (hereda V1) | vive en el rediseño | Rutinas creadas por coach: 0. |
| coach | Dotación › Mi Dotación | `/coach/dotacion` | partial (derivado) | usado: equipment_assignments: 4 en total | Navegación por rol › entrenador › Más (dotación) | — (hereda V1) | vive en el rediseño | 4 asignaciones en total. |
| coach | Salud › Disponibilidad médica | `/disponibilidad-medica` | works (derivado) | sin uso: clinical_patients: 0 | Navegación por rol › entrenador › Más (salud); **Profesional de salud · Agenda** (V1) | — (hereda V1) | vive en el rediseño | clinical_patients = 0. |
| coach | Entrenamiento › Evaluaciones | `/evaluations` | partial (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Huérfana, roster roto y duplica Evaluar. |
| coach | Reportes › Reportes del Equipo | `/coach-reports` | partial (derivado) | usado: match_results 90 d: 34 (4 escuelas) ¦ attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela  | — | — (hereda V1) | **falta en el rediseño** | Reportes del equipo no está en el menú del entrenador. Tiene un IDOR en el BFF (reports.ts:661-680): arreglar antes de reubicar. |
| coach | Reportes › Evaluación post-entrenamiento — informe de equipo | `/coach-reports/entreno-equipo` | partial (derivado) | usado: team_reports 90 d: 15 | **Entrenador · Evaluación rápida** (V1) | — (hereda V1) | **falta en el rediseño** | Informe grupal post-entreno sin lugar; «Publicar» roto para el coach. team_reports: 15 en 90 d. |
| coach | Reportes › Informe Mensual | `/informe-mensual` | partial (derivado) | usado: athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alg | — | **1 · El cobro llega por WhatsApp** (V2) | **falta en el rediseño** | El menú del entrenador tiene «Evaluar: rápida 1 a 5 y rúbrica», no el informe mensual. 28 informes publicados por coaches en 90 d. |
| coach | Mi Tienda / Mis Servicios (vendedor) › Activar Mi Tienda (onboarding de vendedor) | `/vendor/onboarding` | works (derivado) | no medido | Varias escuelas y roles › Servicios de un profesional → su espacio | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| coach | Mi Tienda / Mis Servicios (vendedor) › Panel Tienda | `/vendor/dashboard` | partial (derivado) | no medido | Menú lateral › trainer › Hoy; **Varias escuelas y roles** (V1) | — (hereda V1) | se fusiona con Menú lateral › trainer › Hoy | Con espacios, el coach que vende tiene su propio espacio «Entrenamiento personal». |
| coach | Mi Tienda / Mis Servicios (vendedor) › Servicios | `/vendor/services` | works (derivado) | no medido | Menú lateral › trainer › Mis servicios | — (hereda V1) | vive en el rediseño | Editar sigue «próximamente». |
| coach | Mi Tienda / Mis Servicios (vendedor) › Agenda (citas) | `/vendor/appointments` | broken (derivado) | no medido | Menú lateral › trainer › Agenda | — (hereda V1) | vive en el rediseño | Hoy rota (redirige a /schedule, que rechaza al coach). |
| coach | Mi Tienda / Mis Servicios (vendedor) › Productos | `/vendor/products` | works (derivado) | no medido | Varias escuelas y roles › Tienda del marketplace → su propio espacio | — (hereda V1) | vive en el rediseño |  |
| coach | Mi Tienda / Mis Servicios (vendedor) › Pedidos e Inventario (items de menú) | `/orders \| /inventory` | broken (derivado) | no medido | Varias escuelas y roles › Tienda del marketplace → su propio espacio | — (hereda V1) | vive en el rediseño | Hoy rota para el coach (/unauthorized). |
| coach | Mi Tienda / Mis Servicios (vendedor) › Inbox | `/vendor/inbox` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar en Sidebar (trainer/tienda) ni en Espacios. |
| coach | Mi Tienda / Mis Servicios (vendedor) › Liquidaciones | `/vendor/payouts` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar en Sidebar (trainer/tienda) ni en Espacios. |
| coach | Mi Tienda / Mis Servicios (vendedor) › Envíos | `/vendor/shipping` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar en Sidebar (trainer/tienda) ni en Espacios. |
| coach | Mi Tienda / Mis Servicios (vendedor) › Promociones | `/vendor/promotions` | dead (derivado) | no medido | Navegación por rol › Tienda › Promociones | — (hereda V1) | vive en el rediseño | Hoy placeholder «Próximamente». |
| coach | Mi Tienda / Mis Servicios (vendedor) › Suscriptores | `/vendor/subscribers` | broken (derivado) | no medido | — | — | se elimina (sin uso o muerta) | BFF responde 410 (motor recurrente v1 retirado). |
| personal_trainer | Portal del entrenador personal › Onboarding de entrenador | `/trainer/onboarding` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| personal_trainer | Portal del entrenador personal › Dashboard del entrenador | `/trainer/dashboard` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | Menú lateral › trainer › Hoy; **Varias escuelas y roles** (V1) | — (hereda V1) | vive en el rediseño |  |
| personal_trainer | Portal del entrenador personal › Mis Clientes | `/trainer/clients` | works (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 | Menú lateral › trainer › Mis clientes | — (hereda V1) | vive en el rediseño |  |
| personal_trainer | Portal del entrenador personal › Ficha del cliente | `/trainer/clients/:clientId` | works (derivado) | usado: training_logs: 9 en total | Menú lateral › trainer › Mis clientes | — (hereda V1) | vive en el rediseño |  |
| personal_trainer | Portal del entrenador personal › Mis Rutinas | `/trainer/routines` | works (derivado) | usado: trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0 | Menú lateral › trainer › Planes y rutinas | — (hereda V1) | vive en el rediseño | trainer_routines de personal_trainer: 26. |
| personal_trainer | Portal del entrenador personal › Detalle de rutina | `/trainer/routines/:routineId` | works (derivado) | usado: trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0 | Menú lateral › trainer › Planes y rutinas | — (hereda V1) | vive en el rediseño | trainer_routines de personal_trainer: 26. |
| personal_trainer | Portal del entrenador personal › Disponibilidad | `/trainer/availability` | partial (derivado) | usado: coach_availability: 734 filas (18 coaches, 13 escuelas) | Menú lateral › trainer › Agenda | — (hereda V1) | vive en el rediseño |  |
| personal_trainer | Portal del entrenador personal › Mis Planes | `/trainer/plans` | partial (derivado) | no medido | Menú lateral › trainer › Planes y rutinas | — (hereda V1) | vive en el rediseño | Hoy envoltorio de /offerings. |
| personal_trainer | Portal del entrenador personal › Pagos | `/trainer/payments` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | Menú lateral › trainer › Cobros | — (hereda V1) | vive en el rediseño | Hoy envoltorio de /payments-automation de escuela. |
| personal_trainer | Portal del entrenador personal › Mi Perfil Público (editor) | `/trainer/profile` | works (derivado) | no medido | Menú lateral › trainer › Mis servicios | — (hereda V1) | vive en el rediseño |  |
| personal_trainer | Portal del entrenador personal › Perfil público del entrenador | `/entrenador/:userId` | works (derivado) | usado: coach_availability: 734 filas (18 coaches, 13 escuelas) | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Pública; se conserva. |
| personal_trainer | Compartido con otros roles › Navegación compartida (sidebar + bottom nav) | `/enrollments \| /mi-plan \| /settings \| /calendar \| /messages \| /profile` | partial (derivado) | no medido | **Varias escuelas y roles** (V1) | — (hereda V1) | se fusiona con Varias escuelas y roles (V1) | La navegación compartida se reemplaza por el menú del espacio «Entrenamiento personal». |

### Acudiente (32)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| parent | Inicio › Panel de Padre/Madre | `/dashboard` | partial (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ payments 90 | **Acudiente · Inicio** (V1) | **6 · La app, para quien quiera más** (V2) | vive en el rediseño | Un cobro, el hijo, el próximo entreno, SportPoints y avisos. |
| parent | Hijos › Familia SportMaps (Mis Hijos) | `/children` | partial (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 ¦ children: 1 | **Acudiente · Ficha del hijo** (V1); Barra inferior › parent › Hijos | — (hereda V1) | vive en el rediseño | Ficha del hijo (Progreso · Asistencia · Informes · Ficha y salud). |
| parent | Calendario › Calendario Familiar | `/calendar` | partial (derivado) | no medido | Barra inferior › parent › Calendario | — (hereda V1) | vive en el rediseño | Sin tablero. |
| parent | Explorar › Explorar | `/explorar` | hidden (derivado) | no medido | Varias escuelas y roles › Explorar, fuera del espacio de la escuela | — | fuera de alcance (pública/sistema; la URL se conserva) | Oculta en producción. |
| parent | Seguimiento › Centro de Alto Rendimiento (Progreso Deportivo) | `/academic-progress` | works (derivado) | usado: performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuel | **Acudiente · Ficha del hijo** (V1) | **6 · La app, para quien quiera más** (V2) | se fusiona con Acudiente · Ficha del hijo (V1) | Pestaña «Progreso». Ojo: hoy lee academic_progress (≈5 filas, muerta); el progreso real está en performance_entries. |
| parent | Seguimiento › Progreso de hijo (ruta por id) | `/children/:id/progress` | duplicated (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Alias sin enlaces entrantes. |
| parent | Seguimiento › Registro de Asistencia | `/parent-attendance` | works (derivado) | usado: attendance_records 90 d: coach 2.636 (17 coaches, 6 escuelas) · escuela 2.239 · método manual 4.889, no_show 7 | **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | se fusiona con Acudiente · Ficha del hijo (V1) | Pestaña «Asistencia». |
| parent | Seguimiento › Asistencia de hijo (ruta por id) | `/children/:id/attendance` | duplicated (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Alias sin enlaces entrantes. |
| parent | Seguimiento › Informes Mensuales | `/children/:id/reports` | works (derivado) | usado: athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alg | **Acudiente · Ficha del hijo** (V1) | **1 · El cobro llega por WhatsApp** (V2); **6 · La app, para quien quiera más** (V2) | se fusiona con Acudiente · Ficha del hijo (V1) | Pestaña «Informes». 157 informes, 5 vistos alguna vez. |
| parent | Seguimiento › Detalle de informe mensual | `/children/:id/reports/:reportId` | works (derivado) | usado: athlete_reports: publicados 90 d por coach 28 (2 coaches, 2 escuelas) · por escuela 2 · total 157 · vistos alg | **Acudiente · Ficha del hijo** (V1) | **1 · El cobro llega por WhatsApp** (V2); **6 · La app, para quien quiera más** (V2) | se fusiona con Acudiente · Ficha del hijo (V1) | Pestaña «Informes». 157 informes, 5 vistos alguna vez. |
| parent | Seguimiento › Evaluación post-entrenamiento (informe grupal) | `/children/:id/post-entreno-informe` | hidden (derivado) | usado: team_reports 90 d: 15 | — | — (hereda V1) | **falta en el rediseño** | Huérfana hoy (sin enlaces) y sin lugar en el rediseño. |
| parent | Pagos › Mis Pagos | `/my-payments` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | **Acudiente · Pagar** (V1); Barra inferior › parent › Pagos | **2 · Pagar sin iniciar sesión** (V2); **1 · El cobro llega por WhatsApp** (V2) | vive en el rediseño | V2: pagar desde el enlace del WhatsApp sin iniciar sesión. |
| parent | Pagos › Estado de Cuenta | `/estado-cuenta` | works (derivado) | no medido | **Acudiente · Pagar** (V1) | — (hereda V1) | se fusiona con Acudiente · Pagar (V1) | La lista de cobros de «Pagar». |
| parent | Pagos › Checkout de padre (QR de inscripción) | `/parent-checkout` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | — | **2 · Pagar sin iniciar sesión** (V2) | se fusiona con 2 · Pagar sin iniciar sesión (V2) | Reimplementación del checkout: se unifica con el enlace /p/:token. |
| parent | Pagos › Resultado de pago (Wompi) | `/payment-result` | works (derivado) | no medido | — | **3 · Pago recibido** (V2) | vive en el rediseño | «Pago recibido». |
| parent | Pagos › Confirmación de pago | `/pagos/confirmacion` | duplicated (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Duplica /payment-result; nadie genera esa URL. |
| parent | Tienda › Tienda (redirección) | `/mi-tienda` | hidden (derivado) | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | Espacios la pone en Inicio y «Más», pero PadreMas no la lista. |
| parent | Tienda › Mis compras | `/mis-compras` | works (derivado) | usado: orders 90 d: 3 | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| parent | Tienda › Detalle de compra | `/mis-compras/:orderId` | works (derivado) | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| parent | Comunicación › Mensajes | `/messages` | broken (derivado) | sin uso: messages: 0 | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | «Mensajes con la escuela» en Más. Hoy rota (0 mensajes, sin redactar). |
| parent | Actividad › Portal Familiar (Mis Inscripciones) | `/enrollments` | partial (derivado) | usado: session_bookings 90 d: atleta 17 · sin usuario 28 | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | «Inscripciones y planes». |
| parent | Actividad › Mis Inscripciones a Eventos | `/my-event-registrations` | partial (derivado) | usado: event_registrations 90 d: 4 | — | — (hereda V1) | **falta en el rediseño** | Sin lugar. event_registrations: 4 en 90 d. Hoy rota/fuera del layout. |
| parent | Actividad › Inscripción a torneo de la escuela | `/tournaments/:eventId/register` | partial (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar (llega por notificación). |
| parent | Salud › Mi salud (Salud de mis hijos) | `/salud` | partial (derivado) | sin uso: clinical_patients: 0 ¦ health_records: 0 | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| parent | Salud › Aceptar invitación clínica | `/salud/invitacion/:token` | works (derivado) | no medido | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| parent | Salud › Mis citas | `/wellness/appointments` | partial (derivado) | sin uso: wellness_appointments 90 d: 0 | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | wellness_appointments 90 d: 0. |
| parent | Documentos › Carnets de mis hijos | `/my-cards` | works (derivado) | usado: athlete_id_cards: 499 activos · 0 impresos · 4 escuelas | **Acudiente · Más** (V1) | **6 · La app, para quien quiera más** (V2) | vive en el rediseño | «Carnets y constancias». |
| parent | Documentos › Mis Constancias | `/my-certificates` | partial (derivado) | sin uso: athlete_certificates: 0 | **Acudiente · Más** (V1) | — (hereda V1) | se fusiona con Acudiente · Más (V1) | Con carnets; 0 constancias. |
| parent | Cuenta › Configuración | `/settings` | partial (derivado) | no medido | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño |  |
| parent | Cuenta › Mi Perfil | `/profile` | works (derivado) | no medido | **Acudiente · Más** (V1) | — (hereda V1) | se fusiona con Acudiente · Más (V1) | Con Configuración. |
| parent | Cuenta › Notificaciones | `/notifications` | works (derivado) | usado: notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leíd | **Acudiente · Inicio** (V1); **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | «Avisos» en Inicio y «Notificaciones» en Más. 3.640 enviadas, 153 leídas. |
| parent | Cuenta › Onboarding de acudiente | `/onboarding/parent` | works (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | se fusiona con 4 · Primera vez: «¿Eres Carolina?» (V2) | «¿Eres Carolina?» reemplaza la ficha de 15 campos. |

### Deportista (29)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| athlete | Inicio › Mi Dashboard (rama atleta) | `/dashboard` | partial (derivado) | usado: notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leíd | **Atleta · Hoy** (V1) | **Deportista · Hoy** (V2) | vive en el rediseño |  |
| athlete | Gestión deportiva › Mi Calendario | `/calendar` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | La barra del atleta (Hoy · Entrenos · Progreso · Carnet · Más) no tiene Calendario y no hay tablero de «Más». |
| athlete | Pagos › Mis Pagos (atleta) | `/athlete-payments` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | — | — (hereda V1) | **falta en el rediseño** | Pagos del atleta adulto no aparecen en la barra ni en tableros (presumiblemente en «Más», no dibujado). |
| athlete | Pagos › Mis Pagos (padre) — duplicado | `/my-payments` | duplicated (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Hoy redirige a /athlete-payments; unificar. |
| athlete | Pagos › Estado de cuenta | `/estado-cuenta` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** |  |
| athlete | Mi Rendimiento › Estadísticas | `/stats` | works (derivado) | no medido | **Atleta · Progreso** (V1); Barra inferior › athlete › Progreso | — (hereda V1) | vive en el rediseño |  |
| athlete | Mi Rendimiento › Objetivos | `/goals` | works (derivado) | sin uso: athlete_goals: 0 | — | — | se elimina (sin uso o muerta) | Navegación: «Objetivos → Progreso / fuera: sin datos reales detrás». athlete_goals = 0. |
| athlete | Mi Rendimiento › Entrenamientos | `/training` | works (derivado) | usado: training_logs: 9 en total ¦ trainer_routines: personal_trainer 26 · escuela 2 · super_admin 8 · coach 0 | Barra inferior › athlete › Entrenos; **Atleta · Hoy** (V1) | — (hereda V1) | vive en el rediseño | «Para practicar en casa» en Hoy. Sin tablero propio de Entrenos. |
| athlete | Actividad deportiva › Mis Inscripciones | `/enrollments` | partial (derivado) | usado: session_bookings 90 d: atleta 17 · sin usuario 28 | — | — (hereda V1) | **falta en el rediseño** | No dibujado (Más). |
| athlete | Actividad deportiva › Mis Eventos | `/my-event-registrations` | partial (derivado) | usado: event_registrations 90 d: 4 | — | — (hereda V1) | **falta en el rediseño** | Sin lugar. event_registrations: 4 en 90 d. Hoy rota/fuera del layout. |
| athlete | Actividad deportiva › Inscripción a torneo | `/tournaments/:eventId/register` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar (llega por notificación). |
| athlete | Bienestar › Mi Salud | `/salud` | works (derivado) | sin uso: clinical_patients: 0 ¦ health_records: 0 | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| athlete | Bienestar › Aceptar invitación clínica | `/salud/invitacion/:token` | works (derivado) | no medido | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| athlete | Bienestar › Mis Citas | `/wellness/appointments` | partial (derivado) | sin uso: wellness_appointments 90 d: 0 | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | wellness_appointments 90 d: 0. |
| athlete | Bienestar › Explorar Bienestar (en realidad: medidas corporales) | `/wellness` | partial (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | Medidas corporales: sin lugar (se nombra mal «Explorar Bienestar»). |
| athlete | Tienda › Tienda de mi escuela | `/mi-tienda` | works (derivado) | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | Espacios la pone en Inicio y «Más», pero PadreMas no la lista. |
| athlete | Tienda › Mis compras | `/mis-compras` | works (derivado) | usado: orders 90 d: 3 | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| athlete | Tienda › Detalle de compra | `/mis-compras/:orderId` | works (derivado) | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| athlete | Tienda › Tienda SportMaps (catálogo global legado) | `/shop` | dead (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Catálogo global legado, quitado del menú. |
| athlete | Documentos › Mis Carnets | `/my-cards` | works (derivado) | usado: athlete_id_cards: 499 activos · 0 impresos · 4 escuelas | **Atleta · Carnet** (V1); Barra inferior › athlete › Carnet | **Deportista · Hoy** (V2) | vive en el rediseño |  |
| athlete | Documentos › Mis Constancias | `/my-certificates` | partial (derivado) | sin uso: athlete_certificates: 0 | — | — | se elimina (sin uso o muerta) | Rota para el adulto y 0 constancias. |
| athlete | Cuenta › Mi Perfil | `/profile` | partial (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | No dibujado (Más). |
| athlete | Cuenta › Configuración | `/settings` | works (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | No dibujado (Más). |
| athlete | Cuenta › Notificaciones | `/notifications` | partial (derivado) | usado: notifications 90 d: acudientes 3.640 (153 leídas, 835 usuarios) · atletas 171 (20 leídas) · coaches 61 (6 leíd | **Menú lateral (compartido)** (Componentes) | — (hereda V1) | vive en el rediseño | Campana. |
| athlete | Cuenta › Mensajes | `/messages` | hidden (derivado) | sin uso: messages: 0 | Navegación por rol › Más (Mensajes no se borra) | — (hereda V1) | vive en el rediseño | Hoy oculta. |
| athlete | Onboarding › Onboarding del atleta | `/onboarding/athlete` | partial (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| athlete | Evaluación post-entreno › Autoevaluación post-entreno | `/post-entreno/:sessionId` | works (derivado) | usado: attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ attendance_ | **Atleta · Autoevaluación** (V1); **Atleta · Hoy** (V1) | **5 · Autoevaluación en el chat** (V2); **Deportista · Hoy** (V2) | vive en el rediseño | V2 la lleva al chat de WhatsApp. Responde el 4 %. |
| athlete | Evaluación post-entreno › Resumen del día post-entreno | `/post-entreno/:sessionId/resultado` | works (derivado) | usado: attendance_sessions 90 d: coach 163 (15 coaches, 5 escuelas) · escuela 330 · cron/open_month 703 ¦ performance | **Atleta · Progreso** (V1) | — (hereda V1) | se fusiona con Atleta · Progreso (V1) | El resumen del día pasa a Progreso. |
| athlete | Explorar › Explorar (global) | `/explorar` | partial (derivado) | no medido | Varias escuelas y roles › Explorar, fuera del espacio de la escuela | — | fuera de alcance (pública/sistema; la URL se conserva) | Oculta en producción. |

### Páginas públicas (vistas por acudiente/deportista) (27)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| public | Cobros › Pago de un cobro sin login | `/p/:token` | partial (derivado) | usado: enlace público /p/:token 90 d: 929 creados · 211 abiertos · 418 aperturas · 2 escuelas | — | **2 · Pagar sin iniciar sesión** (V2); **1 · El cobro llega por WhatsApp** (V2) | vive en el rediseño | Ya existe y funciona; V2 la pone en el centro. |
| public | Documentos › Carnet público verificado | `/c/:qrToken` | works (derivado) | usado: athlete_id_cards: 499 activos · 0 impresos · 4 escuelas | **Atleta · Carnet** (V1) | — (hereda V1) | vive en el rediseño | QR del carnet. |
| public | Documentos › Verificar constancia | `/cert/:folio` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Inscripción › Inscripción por QR de la escuela | `/join/:slug` | partial (derivado) | usado: QR de inscripción histórico: 1.727 escaneos · 226 registros · 61 pagados | — | **1 · Hoy: una frase, un botón** (V2) | fuera de alcance (pública/sistema; la URL se conserva) | Pública; su resultado aparece como «solicitudes de ingreso». |
| public | Inscripción › Unirse a un equipo | `/join-team/:teamId` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Inscripción › Unirse a un plan | `/join-plan/:planId` | partial (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Prospectos › Formulario de prospecto | `/inscripcion/:slug` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Prospectos. |
| public | Reservas › Agendar clase de prueba | `/agendar-clase/:slug` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Reservas › Reservar instalación | `/agendar/:slug` | works (derivado) | usado: session_bookings 90 d: atleta 17 · sin usuario 28 | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Asistencia › Encuesta de asistencia pública | `/polls/v/:pollId` | works (derivado) | sin uso: attendance_polls 90 d: 0 (3 históricas) | — | — | se elimina (sin uso o muerta) | Encuestas sin uso en 90 d. |
| public | Pagos › Resultado de pago (Wompi) | `/payment-result` | works (derivado) | no medido | — | **3 · Pago recibido** (V2) | vive en el rediseño | «Pago recibido». |
| public | Pagos › Confirmación de pago por link | `/pagos/confirmacion` | duplicated (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Duplica /payment-result; nadie genera esa URL. |
| public | Acceso › Registro | `/register` | partial (derivado) | usado: invitations histórico: acudiente 302 aceptadas / 406 pendientes · atleta 45 / 42 · coach 29 / 12 | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2: entrada por invitación sin contraseña. |
| public | Acceso › Iniciar sesión | `/login` | partial (derivado) | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2 propone código por WhatsApp en vez de contraseña. |
| public | Acceso › Restablecer contraseña | `/reset-password` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Acceso › Eliminar cuenta (Google Play) | `/eliminar-cuenta` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Acceso › Elegir rol (OAuth) | `/onboarding/role` | partial (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Escuela pública › Perfil público de escuela (slug) | `/s/:slug` | duplicated (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Duplicado ×3 de perfil público; hoy rota (otros-roles). |
| public | Escuela pública › Detalle de escuela (explorador) | `/schools/:id` | duplicated (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Canónico según otros-roles. |
| public | Escuela pública › Perfil de escuela (legado) | `/escuela/:id` | dead (derivado) | no medido | — | — | se elimina (sin uso o muerta) | Sin enlaces internos. |
| public | Eventos › Evento público | `/event/:slug` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Eventos › Inscripción individual a evento | `/event/:eventId/register` | works (derivado) | usado: event_registrations 90 d: 4 | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Eventos › Resultados de torneo | `/tournaments/:eventId/results` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Tienda › Vitrina de la tienda | `/tienda/:slug` | partial (derivado) | no medido | Varias escuelas y roles › Tienda escolar / marketplace | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Tienda › Carrito | `/carrito` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Tienda › Checkout de tienda | `/checkout/tienda/:vendorProfileId` | partial (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Entrenadores › Perfil público de entrenador | `/entrenador/:userId` | works (derivado) | usado: coach_availability: 734 filas (18 coaches, 13 escuelas) | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Pública; se conserva. |

### PWA (transversal) (9)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| pwa | PWA › Banner «Instalar {escuela}» | `*` | works (derivado) | no medido | **Sistema visual** (V1); **Escuela · Hoy** (V1) | **V2 · Qué cambia y por qué** (V2) | vive en el rediseño | V2Main: «26 % tiene la app instalada»; EscuelaHoy: KPI «Familias con la app instalada». |
| pwa | PWA › Banner «Actualizar ahora» | `*` | works (derivado) | no medido | **Sistema visual** (V1); **Escuela · Hoy** (V1) | **V2 · Qué cambia y por qué** (V2) | vive en el rediseño | V2Main: «26 % tiene la app instalada»; EscuelaHoy: KPI «Familias con la app instalada». |
| pwa | PWA › Banner «Activar notificaciones» | `(layout autenticado)` | works (derivado) | no medido | **Escuela · Hoy** (V1) | — (hereda V1) | vive en el rediseño |  |
| pwa | PWA › Suscripción push legada | `-` | dead (derivado) | no medido | — | — | se elimina (sin uso o muerta) | subscribeToPush legado (0 importaciones) / guardia de recarga: técnica. |
| pwa | PWA › Marca de la PWA (manifest por escuela) | `/app.webmanifest, /app-icon.png` | works (derivado) | no medido | **Sistema visual** (V1) | — (hereda V1) | vive en el rediseño | Marca propia (pwa_branding) en Sistema visual. |
| pwa | PWA › Registro de dispositivo / modo de visualización | `(layout autenticado)` | works (derivado) | no medido | **Escuela · Hoy** (V1) | — (hereda V1) | vive en el rediseño |  |
| pwa | PWA › Cierre de sesión por inactividad | `*` | partial (derivado) | no medido | **Sistema visual** (V1); **Escuela · Hoy** (V1) | **V2 · Qué cambia y por qué** (V2) | vive en el rediseño | V2Main: «26 % tiene la app instalada»; EscuelaHoy: KPI «Familias con la app instalada». |
| pwa | PWA › Service worker: push y clic en notificación | `(url de la notificación)` | partial (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| pwa | PWA › Guardia de recarga durante el pago | `-` | works (derivado) | no medido | — | — | se elimina (sin uso o muerta) | subscribeToPush legado (0 importaciones) / guardia de recarga: técnica. |

### Entradas desde WhatsApp, correo y notificaciones (9)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| whatsapp | Cobranza › Pago de un cobro (/p/:token) | `/p/:token` | works (derivado) | usado: enlace público /p/:token 90 d: 929 creados · 211 abiertos · 418 aperturas · 2 escuelas ¦ comprobantes 90 d: ap | — | **2 · Pagar sin iniciar sesión** (V2); **1 · El cobro llega por WhatsApp** (V2) | vive en el rediseño | Ya existe y funciona; V2 la pone en el centro. |
| whatsapp | Acceso › Registro con invitación | `/register?invite={id}&email=` | partial (derivado) | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2: entrada por invitación sin contraseña. |
| whatsapp | Acceso › Login con marca | `/login?t={slug}` | works (derivado) | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2 propone código por WhatsApp en vez de contraseña. |
| whatsapp | Inscripción › Inscripción por QR | `/join/{slug}` | partial (derivado) | usado: QR de inscripción histórico: 1.727 escaneos · 226 registros · 61 pagados | — | **1 · Hoy: una frase, un botón** (V2) | fuera de alcance (pública/sistema; la URL se conserva) |  |
| whatsapp | Pagos › Mis Pagos (notificaciones / correos) | `/my-payments` | partial (derivado) | usado: payments 90 d: creados paid 1.067 · pending 660 · overdue 570 · cancelled 2.646 · rejected 11 · awaiting_appro | **Acudiente · Pagar** (V1) | **1 · El cobro llega por WhatsApp** (V2) | vive en el rediseño |  |
| whatsapp | Evaluación post-entreno › Autoevaluación post-entreno | `/post-entreno/{sessionId}[?child_id=]` | works (derivado) | usado: performance_entries 90 d: coach manual 665 (4 coaches) · coach en sesión 271 (6 coaches, 56 sesiones) · escuel | **Atleta · Autoevaluación** (V1) | **5 · Autoevaluación en el chat** (V2) | vive en el rediseño |  |
| whatsapp | Asistencia › Ausencia registrada | `/my-attendance` | broken (derivado) | no medido | — | — (hereda V1) | **falta en el rediseño** | La notificación de ausencia apunta a una ruta que no existe. |
| whatsapp | Eventos › Torneos: inscripción / resultados | `/tournaments/{id}/register \| /results` | works (derivado) | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| whatsapp | Reservas › Mis Inscripciones (reserva de clase) | `/enrollments` | works (derivado) | usado: session_bookings 90 d: atleta 17 · sin usuario 28 | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño |  |

### Otros roles y públicas (117)

| Rol | Módulo › Pantalla | Ruta | Estado | Uso | V1 | V2 | Destino | Nota |
|---|---|---|---|---|---|---|---|---|
| wellness_professional | Inicio › Panel del Profesional (dashboard generico) | `/dashboard` | duplicated | usado: login aterriza aqui (LoginPage.tsx:61) | **Profesional de salud · Agenda** (V1); Menú lateral › salud › Agenda | — (hereda V1) | se fusiona con Profesional de salud · Agenda (V1) | El inicio del profesional es la Agenda. |
| wellness_professional | Inicio › Panel profesional (vendor) | `/vendor/dashboard` | duplicated | no medido | Menú lateral › salud › Agenda; Menú lateral › tienda › Pedidos | — (hereda V1) | se fusiona con Menú lateral › salud › Agenda | Profesional: Agenda. Tienda: Pedidos. |
| wellness_professional | Agenda › Agenda semanal | `/schedule` | works | usado: wellness_appointments=1 | **Profesional de salud · Agenda** (V1) | — (hereda V1) | vive en el rediseño |  |
| wellness_professional | Agenda › Redirect agenda vendor | `/vendor/appointments` | dead | no medido | — | — | se elimina (sin uso o muerta) | Solo redirige a /schedule. |
| wellness_professional | Pacientes › Lista de pacientes | `/pacientes` | works | sin uso: 0 pacientes en BD | Menú lateral › salud › Pacientes; **Profesional de salud · Agenda** (V1) | — (hereda V1) | vive en el rediseño | 0 pacientes. |
| wellness_professional | Pacientes › Historia clinica del paciente | `/pacientes/:patientId` | works | sin uso: clinical_patients=0, clinical_episodes=0, clinical_notes=0 (6 perfiles wellness, 1 login 30d) | Menú lateral › salud › Pacientes; **Profesional de salud · Agenda** (V1) | — (hereda V1) | vive en el rediseño | 0 pacientes. |
| wellness_professional | Pacientes › Imprimir historia | `/pacientes/:patientId/imprimir` | partial | no medido | Menú lateral › salud › Pacientes; **Profesional de salud · Agenda** (V1) | — (hereda V1) | vive en el rediseño | 0 pacientes. |
| wellness_professional | Seguimientos › Tratamientos abiertos | `/historias` | works | no medido | Menú lateral › salud › Seguimientos | — (hereda V1) | vive en el rediseño |  |
| wellness_professional | Consulta › Disponibilidad | `/disponibilidad` | works | sin uso: service_availability=0 | **Profesional de salud · Agenda** (V1) | — (hereda V1) | se fusiona con Profesional de salud · Agenda (V1) | Las franjas «Disponible para agendar» viven en la Agenda. |
| wellness_professional | Consulta › Reportes del profesional | `/wellness-reports` | works | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin entrada en Sidebar salud. |
| wellness_professional | Marketplace › Mis servicios | `/vendor/services` | partial | no medido | Menú lateral › salud › Servicios | — (hereda V1) | vive en el rediseño |  |
| wellness_professional\|store_owner | Perfil › Mi perfil publico (vendor) | `/vendor/public-profile` | partial | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin entrada (probable Configuración). |
| wellness_professional | Nutricion › Nutricion | `/nutrition` | dead | no medido | — | — | se elimina (sin uso o muerta) | Mock. |
| wellness_professional | Onboarding › Onboarding profesional de salud | `/onboarding/wellness` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| wellness_professional\|store_owner | Onboarding › Onboarding vendedor generico | `/vendor/onboarding` | duplicated | usado: vendor_profiles: 14 personal_trainer pending, 14 school pending | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Duplicado del onboarding. |
| wellness_professional\|personal_trainer | Suscriptores › Suscriptores recurrentes | `/vendor/subscribers` | broken | no medido | — | — | se elimina (sin uso o muerta) | 410. |
| patient(athlete\|parent) | Salud (lado paciente) › Mis citas | `/wellness/appointments` | works | no medido | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | wellness_appointments 90 d: 0. |
| patient(athlete\|parent) | Salud (lado paciente) › Mi salud | `/salud` | works | no medido | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| patient(athlete\|parent) | Salud (lado paciente) › Aceptar invitacion clinica | `/salud/invitacion/:token` | works | no medido | **Acudiente · Más** (V1); **Acudiente · Ficha del hijo** (V1) | — (hereda V1) | vive en el rediseño | «Salud y citas» / «Ficha y salud». |
| school\|coach | Salud (lado escuela) › Disponibilidad medica de atletas | `/disponibilidad-medica` | works | no medido | **Profesional de salud · Agenda** (V1); Navegación por rol › entrenador › Más (salud) | — (hereda V1) | vive en el rediseño |  |
| store_owner | Tienda › Dashboard vendedor | `/vendor/dashboard` | partial | usado: products=6, orders=4 (ultimo 2026-10-03), store_owner perfiles=1 (ultimo login jul-2026) | Menú lateral › salud › Agenda; Menú lateral › tienda › Pedidos | — (hereda V1) | se fusiona con Menú lateral › salud › Agenda | Profesional: Agenda. Tienda: Pedidos. |
| store_owner\|school | Tienda › Productos | `/vendor/products (+ alias /products, /categories, /promotions)` | duplicated | usado: products=6 | Menú lateral › tienda › Productos; Navegación por rol › Tienda › Productos | — (hereda V1) | vive en el rediseño | Los 3 alias (/products, /categories, /promotions) se eliminan. |
| store_owner\|school | Tienda › Asistente de producto | `/vendor/products/new \| /vendor/products/:id/edit` | works | usado: product_images=0, product_variants=3 | Menú lateral › tienda › Productos; Navegación por rol › Tienda › Productos | — (hereda V1) | vive en el rediseño | Los 3 alias (/products, /categories, /promotions) se eliminan. |
| store_owner\|school | Tienda › Inventario | `/inventory (+ alias /suppliers)` | duplicated | no medido | Navegación por rol › Tienda › Inventario | — (hereda V1) | vive en el rediseño | Sidebar tienda no tiene Inventario; Navegación (escuela) sí. Alias /suppliers se elimina. |
| store_owner\|school | Tienda › Pedidos del vendedor | `/orders (+ alias /customers)` | duplicated | usado: orders=4 | **Tienda · Pedidos** (V1); Menú lateral › tienda › Pedidos; Menú lateral › tienda › Clientes | — (hereda V1) | vive en el rediseño | Alias /customers → «Clientes». |
| store_owner | Tienda › Reportes de tienda | `/store-reports` | broken | no medido | Menú lateral › tienda › Reportes | — (hereda V1) | vive en el rediseño | Hoy rota. |
| store_owner | Tienda › Promociones (placeholder) | `/vendor/promotions` | mock | no medido | Navegación por rol › Tienda › Promociones | — (hereda V1) | vive en el rediseño | Hoy mock. |
| store_owner | Tienda (oculto) › Inbox vendedor | `/vendor/inbox` | hidden | no medido | — | — (hereda V1) | **falta en el rediseño** | Ocultas hoy y sin lugar en el rediseño. |
| store_owner | Tienda (oculto) › Liquidaciones | `/vendor/payouts` | hidden | no medido | — | — (hereda V1) | **falta en el rediseño** | Ocultas hoy y sin lugar en el rediseño. |
| store_owner | Tienda (oculto) › Envios | `/vendor/shipping` | hidden | no medido | — | — (hereda V1) | **falta en el rediseño** | Ocultas hoy y sin lugar en el rediseño. |
| store_owner | Cuenta › Facturacion (Mi plan) | `/mi-plan` | dead | no medido | — | — | se elimina (sin uso o muerta) | La página rechaza al vendedor. |
| school | Tu tienda › Ajustes de la tienda de la escuela | `/tienda-escuela/ajustes` | works | no medido | Navegación por rol › Tienda (solo con addon) | — (hereda V1) | vive en el rediseño |  |
| buyer(any) | Tienda publica › Tienda de un vendedor (canonica) | `/tienda/:slug` | works | usado: store_slug_aliases=7 | Varias escuelas y roles › Tienda escolar / marketplace | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| buyer(any) | Tienda publica › Producto en tienda | `/tienda/:slug/p/:productId` | works | no medido | Varias escuelas y roles › Tienda escolar / marketplace | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| buyer(any) | Tienda publica › Carrito | `/carrito (+ /checkout redirige)` | partial | sin uso: carts=0 | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| buyer(any) | Tienda publica › Checkout de tienda | `/checkout/tienda/:vendorProfileId` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| buyer(any) | Tienda publica › Mis compras | `/mis-compras` | works | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| buyer(any) | Tienda publica › Detalle de compra | `/mis-compras/:orderId` | works | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | orders: 3 en 90 d. |
| parent\|athlete | Tienda publica › Mi tienda (redirector) | `/mi-tienda` | works | no medido | Varias escuelas y roles › Tienda escolar → Inicio y «Más» del acudiente | — (hereda V1) | vive en el rediseño | Espacios la pone en Inicio y «Más», pero PadreMas no la lista. |
| public | Marketplace › Marketplace multi-vendedor (legacy) | `/marketplace` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Vitrinas legadas duplicadas de /tienda/:slug. |
| public | Marketplace › Detalle producto/servicio marketplace | `/marketplace/product/:id \| /marketplace/:type/:id` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Vitrinas legadas duplicadas de /tienda/:slug. |
| any logged | Marketplace › Shop (legacy) | `/shop` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Catálogo global legado, quitado del menú. |
| super_admin | Moderacion › Moderacion marketplace | `/admin/marketplace/moderation` | works | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin entrada en Sidebar admin. |
| super_admin | Moderacion › Pagos a vendors | `/admin/payouts` | partial | no medido | — | — (hereda V1) | **falta en el rediseño** |  |
| organizer | Onboarding › Onboarding organizador | `/organizer/onboarding` | broken | usado: event_organizers=0, organizer perfiles=2 (ultimo login jul-2026), events con creator_role=organizer=1 (seed) | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Principal › Dashboard organizador | `/organizer/dashboard` | partial | usado: event_organizers=0, organizer perfiles=2 (ultimo login jul-2026), events con creator_role=organizer=1 (seed) | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Principal › Crear evento (wizard 5 pasos) | `/organizer/create-event` | broken | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Gestion › Mis eventos | `/organizer/events` | broken | usado: events=9 (8 de escuela) | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Gestion › Gestion de un evento | `/organizer/event/:id` | partial | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Gestion › Calendario | `/organizer/calendar` | broken | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Gestion › Finanzas | `/organizer/finances` | broken | usado: event_delegations=1 | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Gestion › Reportes | `/organizer/reports` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Cuenta › Perfil organizador | `/organizer/profile` | broken | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| organizer | Cuenta › Configuracion organizador | `/organizer/settings` | partial | no medido | — | — | se elimina (sin uso o muerta) | Organizer roto de punta a punta y sin uso (event_organizers = 0). El rediseño no lo dibuja. |
| public | Eventos › Evento publico | `/event/:slug` | partial | usado: events=9 | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| athlete\|parent\|coach | Eventos › Inscripcion individual a evento | `/event/:eventId/register` | broken | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| athlete\|parent | Eventos › Mis inscripciones a eventos | `/my-event-registrations` | broken | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar. event_registrations: 4 en 90 d. Hoy rota/fuera del layout. |
| public | Eventos › Resultados de torneo | `/tournaments/:eventId/results` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| parent\|athlete | Eventos › Inscripcion a liga interna | `/tournaments/:eventId/register` | works | no medido | — | — (hereda V1) | **falta en el rediseño** | Sin lugar (llega por notificación). |
| school | Torneos (escuela) › Torneos de la escuela | `/school/tournaments \| /new \| /:id` | works | no medido | Navegación por rol › Calendario › Torneos y partidos | — (hereda V1) | se fusiona con Navegación por rol › Calendario › Torneos y partidos |  |
| school | Torneos (escuela) › Inscribir delegacion a evento | `/school/enroll/:eventId` | broken | no medido | — | — | se elimina (sin uso o muerta) | Rotas. |
| school | Torneos (escuela) › Mis delegaciones | `/school/delegations \| /:id` | broken | no medido | — | — | se elimina (sin uso o muerta) | Rotas. |
| facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin | Sedes e Instalaciones › Instalaciones | `/facilities` | partial | no medido | Navegación por rol › Escuela › Sedes e instalaciones | — (hereda V1) | se fusiona con Navegación por rol › Escuela › Sedes e instalaciones | El rol facility_manager no existe: lo hacen owner/admin. |
| facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin | Sedes e Instalaciones › Sedes | `/branches` | partial | no medido | Navegación por rol › Escuela › Sedes e instalaciones | — (hereda V1) | se fusiona con Navegación por rol › Escuela › Sedes e instalaciones |  |
| facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin | Sedes e Instalaciones › Control de acceso (ZKTeco) | `/school/access-control` | works | usado: Modulo con mas uso real de este mapa | Navegación por rol › Escuela › Control de acceso | — (hereda V1) | vive en el rediseño |  |
| facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin | Finanzas › Modo Recepcion (kiosko) | `/recepcion` | works | no medido | Navegación por rol › Dinero › Recepción | — (hereda V1) | se fusiona con Navegación por rol › Dinero › Recepción |  |
| facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin | Recogida › Monitor de recogida | `/pickup` | mock | no medido | — | — | se elimina (sin uso o muerta) | Mock. |
| public | Reservas publicas › Reserva de clase de cortesia (nombre engañoso: 'agendar instalacion') | `/agendar/:slug` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Reservas publicas › Clase de prueba publica | `/agendar-clase/:slug` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Reservas publicas › Formulario de prospecto + franja de cortesia | `/inscripcion/:slug` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Prospectos. |
| super_admin | Plataforma › Logs de acceso (global) | `/admin/access-logs` | hidden | no medido | — | — (hereda V1) | **falta en el rediseño** |  |
| admin\|super_admin | Plataforma › Dashboard plataforma | `/admin` | partial | usado: super_admin=1 (login 10-09) | Menú lateral › admin › Escuelas; Menú lateral › admin › Salud de la plataforma | — (hereda V1) | vive en el rediseño |  |
| admin\|super_admin | Plataforma › Logs y actividad | `/admin/activity-logs` | works | no medido | **Super Admin · Consola** (V1) | — (hereda V1) | se fusiona con Super Admin · Consola (V1) | «Últimos cambios» de la consola. |
| admin\|super_admin | Plataforma › Analitica | `/admin/analytics` | mock | no medido | Menú lateral › admin › Salud de la plataforma | — | se elimina (sin uso o muerta) | Mock; «Salud de la plataforma» tendría que construirse de cero. |
| admin\|super_admin | Gestion Global › Escuelas (global) | `/admin/schools` | works | no medido | Menú lateral › admin › Escuelas | — (hereda V1) | vive en el rediseño |  |
| admin\|super_admin | Gestion Global › Integridad de inscripciones | `/admin/enrollment-integrity` | works | no medido | — | — (hereda V1) | **falta en el rediseño** | 188 hallazgos; sin lugar en Sidebar admin. |
| admin\|super_admin | Gestion Global › Suscripciones + PANEL DE MODULOS POR ESCUELA | `/admin/subscriptions` | partial | no medido | **Super Admin · Consola** (V1); Menú lateral › admin › Planes y addons | — (hereda V1) | vive en el rediseño | «Addons y módulos» por escuela. |
| admin\|super_admin | Gestion Global › Usuarios (en realidad: usuarios de la escuela en contexto) | `/admin/users` | broken | no medido | — | — (hereda V1) | **falta en el rediseño** | Rota hoy; sin lugar. |
| admin\|super_admin | Gestion Global › Reportes (alias de ReportsPage de escuela) | `/admin/reports` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Alias o duplicados. |
| admin\|super_admin | Sistema › Configuracion (alias de SettingsPage) | `/admin/config` | duplicated | no medido | — | — | se elimina (sin uso o muerta) | Alias o duplicados. |
| super_admin | Sistema › Parametros de nomina | `/admin/payroll-config` | works | no medido | — | — (hereda V1) | **falta en el rediseño** |  |
| super_admin | Sistema › Bandeja de soporte (SportBot + humano) | `/admin/support` | hidden | no medido | Menú lateral › admin › Soporte | — (hereda V1) | vive en el rediseño | Hoy solo desde /admin. |
| admin\|super_admin | Sin menu › Solicitudes de upgrade | `/admin/upgrade-requests` | hidden | no medido | — | — | se elimina (sin uso o muerta) | 0 solicitudes. |
| admin\|super_admin | Sin menu › Clubes (duplica /branches) | `/admin/clubs` | dead | no medido | — | — | se elimina (sin uso o muerta) | Alias o duplicados. |
| admin\|super_admin | Sin menu › Logs (alias de NotificationsPage) | `/admin/logs` | dead | no medido | — | — | se elimina (sin uso o muerta) | Alias o duplicados. |
| school\|any | Facturacion SaaS › Recibo de factura SaaS | `/facturacion/recibo/:invoiceId` | works | no medido | Navegación por rol › Escuela › Plan | — (hereda V1) | vive en el rediseño |  |
| school | Facturacion SaaS › Mi plan | `/mi-plan` | works | no medido | Navegación por rol › Escuela › Plan | — (hereda V1) | vive en el rediseño |  |
| public | Auth › Login | `/login` | works | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2 propone código por WhatsApp en vez de contraseña. |
| public | Auth › Registro | `/register` | partial | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | vive en el rediseño | V2: entrada por invitación sin contraseña. |
| public | Auth › Restablecer contrasena | `/reset-password` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| any logged | Auth › Elegir rol (OAuth) | `/onboarding/role` | partial | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Auth › No autorizado | `/unauthorized` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| any logged | Auth › Cierre por inactividad | `(global)` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Cierre por inactividad. |
| school | Onboarding › Crear escuela | `/setup/school` | works | no medido | — | **3 · Escuela nueva: 3 pasos** (V2) | se fusiona con 3 · Escuela nueva: 3 pasos (V2) | 3 pasos: foto de la planilla, invitar por WhatsApp, cuánto cobras. |
| school | Onboarding › Asistente de configuracion de escuela | `/onboarding/school` | works | no medido | — | **3 · Escuela nueva: 3 pasos** (V2) | se fusiona con 3 · Escuela nueva: 3 pasos (V2) |  |
| athlete\|parent\|coach | Onboarding › Onboarding atleta / padre / entrenador | `/onboarding/athlete \| /onboarding/parent \| /onboarding/coach` | works | no medido | — | **4 · Primera vez: «¿Eres Carolina?»** (V2) | se fusiona con 4 · Primera vez: «¿Eres Carolina?» (V2) | Solo el del acudiente está dibujado. |
| personal_trainer | Onboarding › Onboarding entrenador personal | `/trainer/onboarding` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Unirse › Unirse a equipo | `/join-team/:teamId` | partial | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Unirse › Unirse a plan | `/join-plan/:planId` | partial | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Unirse › Inscripcion por QR | `/join/:slug` | works | no medido | — | **1 · Hoy: una frase, un botón** (V2) | fuera de alcance (pública/sistema; la URL se conserva) | Pública; su resultado aparece como «solicitudes de ingreso». |
| public | Landing › Inicio / Landing interna | `/` | partial | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Landing. |
| public | Explorar › Explorar global (escuelas, eventos, entrenadores, servicios, productos) | `/explorar (+ /explore, /events)` | hidden | no medido | Varias escuelas y roles › Explorar, fuera del espacio de la escuela | — | fuera de alcance (pública/sistema; la URL se conserva) | Oculta en producción. |
| public | Perfil publico de escuela › Detalle de escuela (canonico) | `/schools/:id` | partial | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Canónico según otros-roles. |
| public | Perfil publico de escuela › Perfil de escuela (BFF explorar) | `/escuela/:id` | dead | no medido | — | — | se elimina (sin uso o muerta) | Sin enlaces internos. |
| public | Perfil publico de escuela › Pagina publica por slug (4 layouts) | `/s/:slug` | broken | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Duplicado ×3 de perfil público; hoy rota (otros-roles). |
| public | Ayuda › Centro de ayuda / articulo | `/ayuda \| /ayuda/:slug` | hidden | no medido | **Acudiente · Más** (V1) | — (hereda V1) | vive en el rediseño | «Centro de ayuda» en Más. Hoy oculta. |
| public | Publicas con token › Carnet digital | `/c/:qrToken` | works | no medido | **Atleta · Carnet** (V1) | — (hereda V1) | vive en el rediseño | QR del carnet. |
| public | Publicas con token › Cobro sin login | `/p/:token` | works | no medido | — | **2 · Pagar sin iniciar sesión** (V2); **1 · El cobro llega por WhatsApp** (V2) | vive en el rediseño | Ya existe y funciona; V2 la pone en el centro. |
| public | Publicas con token › Verificar constancia | `/cert/:folio` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Pagos › Resultado de pago Wompi | `/payment-result` | works | no medido | — | **3 · Pago recibido** (V2) | vive en el rediseño | «Pago recibido». |
| public | Pagos › Confirmacion de pago por link | `/pagos/confirmacion` | dead | no medido | — | — | se elimina (sin uso o muerta) | Duplica /payment-result; nadie genera esa URL. |
| parent | Pagos › Checkout del acudiente | `/parent-checkout` | partial | no medido | — | **2 · Pagar sin iniciar sesión** (V2) | se fusiona con 2 · Pagar sin iniciar sesión (V2) | Reimplementación del checkout: se unifica con el enlace /p/:token. |
| public | Encuestas › Encuesta publica | `/polls/v/:pollId` | works | no medido | — | — | se elimina (sin uso o muerta) | Encuestas sin uso en 90 d. |
| public | Entrenador › Perfil publico del entrenador | `/entrenador/:userId` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | Pública; se conserva. |
| public | Legales › Terminos / Privacidad / Eliminar cuenta | `/terminos-y-condiciones \| /politica-de-privacidad \| /eliminar-cuenta (+ /terms /privacy /delete-account)` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) |  |
| public | Sistema › 404 | `*` | works | no medido | — | — | fuera de alcance (pública/sistema; la URL se conserva) | 404. |
| any logged (AuthLayout) | SportBot / Soporte › Chat de soporte (SportBot) | `(boton flotante en AuthLayout)` | works | no medido | **Acudiente · Más** (V1); Mapa del rediseño › soporte dentro de «Más» | — (hereda V1) | vive en el rediseño | «Hablar con SportBot». |

## 2. Cada tablero del rediseño: qué reemplaza y qué necesita

«Reemplaza» sale del cruce de la sección 1 (pantallas cuyo destino nombra el tablero). «Necesita» lista lo que el tablero da por hecho, con su estado hoy: **existe** · **parcial** · **oculto** (existe detrás de un flag o condición) · **roto hoy** · **no existe**. Los tableros con 🚩 dependen de algo roto, oculto o inexistente.

### V2 · Qué cambia y por qué — `V2Main.dc.html` (V2 · Principios)

- **Reemplaza / absorbe (1):** `*` (pwa)
- **Necesita:**
  - Las 8 reglas de la V2 (WhatsApp primero, deshacer, sin señal, valores por defecto) — **mixto** · ver cada tablero

### V2 · Una palabra por cosa — `V2Palabras.dc.html` (V2 · Principios)

- **Reemplaza / absorbe (0):** — (tablero de fundamentos o pantalla nueva)
- **Necesita:**
  - Una palabra por cosa (deportista, acudiente, profe, mensualidad, inscripción, solicitud de ingreso) — **cambio de copy** · hoy hay voseo en `TournamentRegisterPage.tsx:81` y `MyEnrollmentsPage.tsx:513`; «Mis Deportistas» vs «Atletas» en /students del coach

### 1 · El cobro llega por WhatsApp — `V2WaCobro.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (9):** `/informe-mensual` (school+school_admin), `/whatsapp` (school+school_admin), `/informe-mensual` (coach), `/children/:id/reports` (parent), `/children/:id/reports/:reportId` (parent), `/my-payments` (parent), `/p/:token` (public), `/p/:token` (whatsapp), `/my-payments` (whatsapp)
- **Necesita:**
  - Plantilla de cobro con botón a /p/:token — **existe** · `services/whatsapp-plantillas.service.ts:554`
  - «Ya pagué: enviar comprobante» en el chat — **existe** · comprobantes vía WhatsApp: 56 en 90 d, 51 pagadores, **2 escuelas** (usage.json)
  - Aviso «el informe ya está listo» con botón — **parcial** · el informe se envía hoy por la app/correo (`athlete_reports` enviados 90 d: 23; vistos alguna vez: 5). No hay plantilla de WhatsApp para el informe en los mapas
  - Canal de WhatsApp conectado por escuela — **parcial** · `school_whatsapp_integrations` = 2 (escuela.json, /whatsapp)

### 🚩 2 · Pagar sin iniciar sesión — `V2PagoEnlace.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (4):** `/my-payments` (parent), `/parent-checkout` (parent), `/p/:token` (public), `/p/:token` (whatsapp)
- **Necesita:**
  - Pagar en línea con monto firmado — **existe** · `pages/CobroPublicoPage.tsx:266`
  - «Pagar también inscripción y seguro» en el mismo enlace — **no verificado** · el enlace resuelve un cobro (`CobroPublicoPage.tsx:187`)
  - Con mi banco (Bre-B) — **no existe** · el tablero dice «Pronto»; depende de Factus Pay
  - Subir el comprobante desde el enlace — **parcial** · hoy solo «Enviar comprobante por WhatsApp» (`CobroPublicoPage.tsx:340`)
  - «¿No eres Carolina? Avísanos» — **no existe** · sin acción equivalente en el mapa

### 🚩 3 · Pago recibido — `V2PagoListo.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (2):** `/payment-result` (parent), `/payment-result` (public)
- **Necesita:**
  - Pantalla de pago recibido — **existe** · `/payment-result` (PaymentResultPage)
  - +500 SportPoints — **no existe** · SportPoints no tiene tabla ni código
  - «Sí, activar pago automático» — **parcial** · `recurring_subscriptions` = 0; `DebitoAutomaticoCard.tsx:265` partial

### 🚩 4 · Primera vez: «¿Eres Carolina?» — `V2Bienvenida.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (7):** `/invitations` (school+school_admin), `/onboarding/parent` (parent), `/register` (public), `/login` (public), `/register?invite={id}&email=` (whatsapp), `/login?t={slug}` (whatsapp), `/onboarding/athlete | /onboarding/parent | /onboarding/coach` (athlete|parent|coach)
- **Necesita:**
  - Entrada por invitación con datos precargados — **parcial** · `/register?invite=` existe; 0 / 477 acudientes completaron la ficha (V2Main)
  - Sin contraseña: código por WhatsApp — **no existe** · no hay OTP en BFF ni frontend (solo el componente `components/ui/input-otp.tsx`)
  - Pedir lo que falta «de a una pregunta» — **no existe** · —

### 🚩 5 · Autoevaluación en el chat — `V2WaAutoeval.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (3):** `/whatsapp` (school+school_admin), `/post-entreno/:sessionId` (athlete), `/post-entreno/{sessionId}[?child_id=]` (whatsapp)
- **Necesita:**
  - Autoevaluación post-entreno — **existe (en la app)** · `pages/PostTrainingSelfEvalPage.tsx:204` (`rpc submit_post_training_self_eval`); 184 por acudientes y 21 por atletas en 90 d
  - Responderla dentro del chat de WhatsApp — **no existe** · el disparo actual es notificación in-app + push (`20260911124834_post_entreno_disparo_notificacion.sql`)
  - +200 SportPoints — **no existe** · —

### 🚩 6 · La app, para quien quiera más — `V2PadreInicio.dc.html` (V2 · Acudiente)

- **Reemplaza / absorbe (6):** `/informe-mensual` (school+school_admin), `/dashboard` (parent), `/academic-progress` (parent), `/children/:id/reports` (parent), `/children/:id/reports/:reportId` (parent), `/my-cards` (parent)
- **Necesita:**
  - Frase del profe del informe — **parcial** · `athlete_reports`: 157, vistos 5
  - Pagos «Al día» y Carnet — **existe** · `/my-payments`, `/my-cards`
  - «Falta un dato de Sofía: ¿cuál es su EPS?» — **no existe** · —

### 1 · Hoy: una sola acción — `V2CoachHoy.dc.html` (V2 · Entrenador)

- **Reemplaza / absorbe (1):** `/dashboard` (coach)
- **Necesita:**
  - Próximo entreno y plan de hoy — **existe** · `/training-plans` (64 de 67 sesiones de 90 d sin `created_by`)
  - «Falta evaluar el entreno del martes» — **parcial** · derivable de `performance_entries` + `attendance_sessions`; no existe como pendiente
  - «2 de 3 entrenos con lista tomada» — **parcial** · derivable de `attendance_sessions`

### 🚩 2 · Lista: todos vinieron, toca al que faltó — `V2Lista.dc.html` (V2 · Entrenador)

- **Reemplaza / absorbe (1):** `/coach-attendance` (coach)
- **Necesita:**
  - Todos presentes por defecto — **existe** · `pages/CoachAttendancePage.tsx:1292` (la lista ya arranca presente)
  - Funciona sin señal y sube sola — **no existe** · cero usos de IndexedDB / cola offline / `navigator.onLine` en `frontend/src`
  - Corregir hasta mañana — **parcial** · fecha retroactiva solo en equipos; en planes guarda en hoy (`CoachAttendancePage.tsx:1312`)

### 🚩 3 · Evaluar el equipo en una pantalla — `V2Evaluar.dc.html` (V2 · Entrenador)

- **Reemplaza / absorbe (1):** `/training-plans` (coach)
- **Necesita:**
  - Evaluar al equipo en una pantalla — **parcial** · evaluación rápida 1 a 5 (TeamPerformanceEntryModal); la escala «Bien · Normal · Le costó» no existe
  - Métricas elegidas por la escuela — **no existe** · Main: Capa 4 «métricas por escuela después de PER-0 y MOD-17»; V2Main: Carmel usó 6 de 31

### 🚩 4 · El plan de hoy, en palabras — `V2PlanHoy.dc.html` (V2 · Entrenador)

- **Reemplaza / absorbe (1):** `/training-plans` (coach)
- **Necesita:**
  - Plan del mes y semana — **existe** · MesocycleSection (Plan · Carga · Rúbrica · Cierre · Documentos)
  - Modo cancha (letra grande, pantalla encendida) — **no existe** · —

### 1 · Hoy: una frase, un botón — `V2DuenoHoy.dc.html` (V2 · Dueño)

- **Reemplaza / absorbe (8):** `/dashboard` (school+school_admin), `/school/enrollment-intake` (school+school_admin), `/attendance-supervision` (school+school_admin), `/payments-automation` (school+school_admin), `/finances` (school+school_admin), `/qr-signup` (school+school_admin), `/join/:slug` (public), `/join/{slug}` (whatsapp)
- **Necesita:**
  - «9 coinciden: aprobar los 9» — **existe** · «Aprobar todos los verdes» `components/payment/BulkApproveGreensDialog.tsx:80`, `PaymentsAutomationPage.tsx:1578`
  - Auto-revisión del comprobante — **parcial** · cobros con `parent_id` NULL dan 403 y nunca se autoaprueban (`PaymentCheckoutModal.tsx:911`); 589 menores sin `parent_id`
  - «23 familias deben — recordarles por WhatsApp» — **parcial** · enlace wa.me por deudor (`PaymentAgingCard.tsx:250`) y recordatorios automáticos; no hay envío masivo desde Hoy
  - «4 solicitudes de ingreso» — **existe** · `/school/enrollment-intake` + QR

### 🚩 2 · Aprobar sin miedo: deshacer — `V2Aprobar.dc.html` (V2 · Dueño)

- **Reemplaza / absorbe (1):** `/payments-automation` (school+school_admin)
- **Necesita:**
  - Motivo por comprobante (monto, cuenta destino, foto borrosa) — **existe** · auto-evaluación de comprobantes / glosas (`POST /api/v1/payments/glosas/auto-evaluate`)
  - «Pedir el resto» / «Pedir otra foto» — **existe** · glosas (`payment_glosas`: 2 en 90 d)
  - Deshacer por 8 s en vez de confirmar — **no existe** · «Deshacer» no aparece en ningún componente de pagos (solo facturación, mesociclo y pizarra)

### 3 · Escuela nueva: 3 pasos — `V2EscuelaNueva.dc.html` (V2 · Dueño)

- **Reemplaza / absorbe (3):** `/offerings` (school+school_admin), `/setup/school` (school), `/onboarding/school` (school)
- **Necesita:**
  - Arranque en 3 pasos — **parcial** · hoy `SchoolOnboardingWizard` con sede, modelo, equipo, plan, entrenador, atleta y cuenta (`SchoolOnboardingWizard.tsx:774-1125`)
  - Foto de la planilla — **parcial** · ver V2CargaFoto
  - Subir un Excel — **existe** · importación CSV (`components/students/CSVImportModal.tsx:327`)

### 4 · Cargar deportistas con una foto — `V2CargaFoto.dc.html` (V2 · Dueño)

- **Reemplaza / absorbe (2):** `/students` (school+school_admin), `/invitations` (school+school_admin)
- **Necesita:**
  - Leer 20 deportistas de una foto de planilla — **parcial** · hoy se lee **una hoja de matrícula por deportista** (`/school/enrollment-intake`; 14 en 90 d). La carga masiva por foto no está en los mapas
  - Invitar a los acudientes por WhatsApp al final — **parcial** · invitación masiva por correo/WhatsApp desde /students (`POST /api/v1/invitations/bulk-send`)

### 5 · Lo mismo en el computador — `V2DuenoEscritorio.dc.html` (V2 · Dueño)

- **Reemplaza / absorbe (4):** `/dashboard` (school+school_admin), `/staff` (school+school_admin), `/seguimiento-deportivo` (school+school_admin), `/payments-automation` (school+school_admin)
- **Necesita:**
  - Lo mismo que V2DuenoHoy + «¿Cómo van los profes?» — **existe** · `/seguimiento-deportivo` (resumen por entrenador)

### 🚩 Deportista · Hoy — `V2DeportistaHoy.dc.html` (V2 · Deportista)

- **Reemplaza / absorbe (3):** `/dashboard` (athlete), `/my-cards` (athlete), `/post-entreno/:sessionId` (athlete)
- **Necesita:**
  - Próxima sesión — **existe** · `rpc get_athlete_dashboard_stats`
  - «¿Qué tan duro fue?» de un toque — **parcial** · existe como formulario en `/post-entreno/:sessionId`
  - Racha de entrenos seguidos — **no existe** · —
  - Mostrar mi carnet — **existe** · `/my-cards`

### Mapa del rediseño — `Main.dc.html` (V1 · Fundamentos)

- **Reemplaza / absorbe (0):** — (tablero de fundamentos o pantalla nueva)
- **Necesita:**
  - Plan por capas 0 a 4 — **—** · —

### Sistema visual — `Sistema.dc.html` (V1 · Fundamentos)

- **Reemplaza / absorbe (2):** `*` (pwa), `/app.webmanifest, /app-icon.png` (pwa)
- **Necesita:**
  - Tokens, PageShell, 3 estados (cargando, vacío, error) — **Capa 1** · el tablero mismo dice que hoy un error de red se ve como «no hay datos» (UX-2)

### 🚩 Navegación por rol — `Navegacion.dc.html` (V1 · Fundamentos)

- **Reemplaza / absorbe (71):** `/school/enrollment-intake` (school+school_admin), `/staff` (school+school_admin), `/invitations` (school+school_admin), `/teams` (school+school_admin), `/school-sports` (school+school_admin), `/calendar` (school+school_admin), `/training-plans` (school+school_admin), `/school/routines` (school+school_admin), `/school/routines/:routineId` (school+school_admin), `/informe-mensual` (school+school_admin), `/dashboard/polls` (school+school_admin), `/dashboard/polls/:pollId/results` (school+school_admin), `/results-overview` (school+school_admin), `/school/tournaments` (school+school_admin), `/school/tournaments/new` (school+school_admin), `/school/tournaments/:id` (school+school_admin), `/disponibilidad-medica` (school+school_admin), `/recepcion` (school+school_admin), `/accounting` (school+school_admin), `/accounting/suppliers` (school+school_admin), `/accounting/payroll` (school+school_admin), `/accounting/reports` (school+school_admin), `/accounting/budget` (school+school_admin), `/facturacion-electronica` (school+school_admin), `/cards` (school+school_admin), `/certificates` (school+school_admin), `/cards/templates/certificates` (school+school_admin), `/whatsapp` (school+school_admin), `/payment-reminders` (school+school_admin), `/message-templates` (school+school_admin), `/branches` (school+school_admin), `/facilities` (school+school_admin), `/school/access-control` (school+school_admin), `/school/public-profile` (school), `/mi-plan` (school+school_admin), `/facturacion/recibo/:invoiceId` (school+school_admin), `/profile` (school+school_admin), `/messages` (school+school_admin), `/tienda-escuela/ajustes` (school+school_admin), `/orders` (school+school_admin), `/vendor/products` (school+school_admin), `/vendor/products/new | /vendor/products/:id/edit` (school+school_admin), `/inventory` (school+school_admin), `/profile` (coach), `/settings` (coach), `/messages` (coach), `/announcements` (coach), `/teams` (coach), `/students` (coach), `/coach-attendance` (coach), `/results` (coach), `/calendar` (coach), `/school/routines` (coach), `/school/routines/:routineId` (coach), `/coach/dotacion` (coach), `/disponibilidad-medica` (coach), `/vendor/promotions` (coach), `/messages` (athlete), `/disponibilidad-medica` (school|coach), `/vendor/products (+ alias /products, /categories, /promotions)` (store_owner|school), `/vendor/products/new | /vendor/products/:id/edit` (store_owner|school), `/inventory (+ alias /suppliers)` (store_owner|school), `/vendor/promotions` (store_owner), `/tienda-escuela/ajustes` (school), `/school/tournaments | /new | /:id` (school), `/facilities` (facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin), `/branches` (facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin), `/school/access-control` (facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin), `/recepcion` (facility_manager (NO EXISTE: ni enum user_role, ni CHECK school_members, ni codigo) -> la funcion la hacen owner/admin/school_admin), `/facturacion/recibo/:invoiceId` (school|any), `/mi-plan` (school)
- **Necesita:**
  - 10 entradas, un árbol para school y school_admin — **cambio de config** · `config/navigation.ts` (hoy 45 y 44 ítems)
  - Barra inferior que respeta billing, addons y módulos — **roto hoy** · `MobileBottomNav` ignora `billing_enabled` y usa `profile.role`

### 🚩 Varias escuelas y roles — `Espacios.dc.html` (V1 · Fundamentos)

- **Reemplaza / absorbe (24):** `(todas las rutas autenticadas)` (school+school_admin), `/notifications` (school+school_admin), `/tienda-escuela/ajustes` (school+school_admin), `/vendor/dashboard` (coach), `/trainer/dashboard` (personal_trainer), `/enrollments | /mi-plan | /settings | /calendar | /messages | /profile` (personal_trainer), `/vendor/onboarding` (coach), `/vendor/products` (coach), `/orders | /inventory` (coach), `/explorar` (parent), `/mi-tienda` (parent), `/mis-compras` (parent), `/mis-compras/:orderId` (parent), `/mi-tienda` (athlete), `/mis-compras` (athlete), `/mis-compras/:orderId` (athlete), `/explorar` (athlete), `/tienda/:slug` (public), `/tienda/:slug` (buyer(any)), `/tienda/:slug/p/:productId` (buyer(any)), `/mis-compras` (buyer(any)), `/mis-compras/:orderId` (buyer(any)), `/mi-tienda` (parent|athlete), `/explorar (+ /explore, /events)` (public)
- **Necesita:**
  - Selector de espacio (escuela + rol) — **no existe** · `SchoolSwitcher` apagado desde el 21-abr; `AppSidebar.tsx:60-66` y `useSchoolContext.ts:223` (citados en el tablero)
  - Último espacio guardado en el perfil — **no existe** · requiere columna nueva

### Escuela · Hoy — `EscuelaHoy.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (6):** `/dashboard` (school+school_admin), `/finances` (school+school_admin), `/school-reports` (school+school_admin), `/reporter-dashboard` (school+school_admin), `*` (pwa), `(layout autenticado)` (pwa)
- **Necesita:**
  - Pendientes del día (comprobantes, vencidos, matrículas, profes sin lista) — **parcial** · datos existen en 4 pantallas; no hay agregador
  - KPI «Familias con la app instalada» — **existe** · `hooks/useDeviceContext.ts` (registro de display-mode)
  - Entrenos de hoy con estado — **existe** · `attendance_sessions`

### 🚩 Escuela · Deportistas — `EscuelaDeportistas.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (6):** `/students` (school+school_admin), `/school/enrollment-intake` (school+school_admin), `/invitations` (school+school_admin), `/cards` (school+school_admin), `/certificates` (school+school_admin), `/estado-cuenta` (school+school_admin)
- **Necesita:**
  - Ficha con estado de cuenta, asistencia y última evaluación — **existe repartido** · `/estado-cuenta`, `/attendance-history`, `performance_entries`
  - «Cobros y pagos» desde la ficha — **oculto** · detrás de `VITE_COBROS_Y_PAGOS`; `charge_batches` = 0
  - «Pausa por vacaciones» — **existe sin uso** · `enrollment_pause_requests` = 0
  - Carnets y constancias — **parcial** · constancias = 0

### 🚩 Escuela · Cobros y pagos — `EscuelaDinero.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (7):** `/payments-automation` (school+school_admin), `/accounting` (school+school_admin), `/accounting/suppliers` (school+school_admin), `/accounting/payroll` (school+school_admin), `/accounting/reports` (school+school_admin), `/accounting/budget` (school+school_admin), `/finances` (school+school_admin)
- **Necesita:**
  - Por validar con chequeos (monto, cuenta destino) — **existe** · auto-evaluación de comprobantes
  - Un solo modal «Cobros y pagos» y «Cobrar a un equipo» — **oculto** · `VITE_COBROS_Y_PAGOS`; `charge_batches` = 0 (escuela.json)
  - Pestaña «Operaciones» — **oculto** · `showOperacionesTab` (`PaymentsAutomationPage.tsx:1561`)
  - QR Bre-B — **no existe** · «En espera de Factus»
  - Débito automático como medio — **parcial** · `recurring_subscriptions` = 0
  - Glosas, Conciliación, Cierre de mes, Historial — **existen pero no dibujadas** · `monthly_closes` 5 en 90 d (2 escuelas), `payment_glosas` 2

### Escuela · Seguimiento deportivo — `EscuelaSeguimiento.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (6):** `/seguimiento-deportivo` (school+school_admin), `/teams` (school+school_admin), `/training-plans` (school+school_admin), `/school/routines` (school+school_admin), `/school/routines/:routineId` (school+school_admin), `/informe-mensual` (school+school_admin)
- **Necesita:**
  - Resumen por entrenador, listas y evaluaciones — **existe** · `/seguimiento-deportivo` + `CoachDetailSheet.tsx:89-92`
  - Sesiones atribuidas a cada profe y Documentos — **parcial** · Main Capa 4: «Seguimiento F4–F6 (created_by, documentos)»; 64 de 67 sesiones de 90 d sin `created_by`

### Escuela · Asistencia por mes — `EscuelaAsistencia.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (2):** `/attendance-supervision` (school+school_admin), `/attendance-history` (school+school_admin)
- **Necesita:**
  - Por mes · Por atleta · CSV — **existe** · `AttendanceHistoryPage.tsx:665-770`

### 🚩 Escuela · Configuración — `EscuelaConfig.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (5):** `/school-sports` (school+school_admin), `/whatsapp` (school+school_admin), `/payment-reminders` (school+school_admin), `/settings` (school+school_admin), `/school-config` (school+school_admin)
- **Necesita:**
  - 10 secciones con guardado por sección — **parcial** · hoy repartido entre `/settings`, `/school-sports`, la pestaña Config de `/payments-automation` y `/school-config` (huérfana)
  - «Módulos del menú» por la escuela — **parcial** · hoy el override lo maneja el Super Admin (`school_module_overrides`, 17 filas)
  - Descuento por hermanos — **oculto** · solo en el flujo nuevo (`components/payment/cobros-y-pagos/DiscountTags.tsx`)

### 🚩 Escuela · Hoy (celular) — `EscuelaHoyMovil.dc.html` (V1 · Escuela)

- **Reemplaza / absorbe (1):** `/dashboard` (school+school_admin)
- **Necesita:**
  - Barra inferior que respeta billing y rol de contexto — **roto hoy** · `MobileBottomNav` muestra «Pagos» con billing apagado y usa `profile.role`: un school_admin ve la barra genérica (escuela.md, hallazgos)

### 🚩 Entrenador · Hoy — `CoachHoy.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (1):** `/dashboard` (coach)
- **Necesita:**
  - Próximo entreno, pendientes y semana del mesociclo — **existe** · `/training-plans`, `MesocycleSection`
  - «Agregados por la escuela ayer» — **no existe** · —

### Entrenador · Tomar lista — `CoachLista.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (1):** `/coach-attendance` (coach)
- **Necesita:**
  - Tomar lista — **existe** · `/coach-attendance` (2.636 marcas de coach en 90 d)

### 🚩 Entrenador · Sesiones de la semana — `CoachSesiones.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (1):** `/training-plans` (coach)
- **Necesita:**
  - Semana de sesiones del coach — **oculto para el coach** · `WeekSessionsPanel` solo lo ve el admin (coach.json, /training-plans)

### Entrenador · Pizarra — `CoachPizarra.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (1):** `/training-plans` (coach)
- **Necesita:**
  - Pizarra por bloque — **existe** · `components/school/TacticalBoard.tsx`; Main Capa 0: «la pizarra simple, ya en curso»
  - Exportar / animación — **fuera en V2** · V2Main: «Pizarra animada, exportar video y vista 3D» quedan fuera

### Entrenador · Mesociclo — `CoachMesociclo.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (1):** `/training-plans` (coach)
- **Necesita:**
  - Plan, carga, rúbrica y cierre — **existe** · `MesocycleSection.tsx:976-980`; 12 mesociclos creados por coaches

### 🚩 Entrenador · Evaluación rápida — `CoachEvaluacion.dc.html` (V1 · Entrenador)

- **Reemplaza / absorbe (2):** `/training-plans` (coach), `/coach-reports/entreno-equipo` (coach)
- **Necesita:**
  - Evaluación rápida 1 a 5 — **existe** · 665 manuales + 271 en sesión (coach, 90 d)
  - Métrica «elegida por la escuela» — **no existe** · Capa 4

### 🚩 Acudiente · Inicio — `PadreInicio.dc.html` (V1 · Acudiente)

- **Reemplaza / absorbe (2):** `/dashboard` (parent), `/notifications` (parent)
- **Necesita:**
  - Cobro del mes y «Pagar ahora» — **existe** · `/my-payments?pay=auto` (`DashboardPage.tsx:533`)
  - Débito automático — **parcial** · `recurring_subscriptions` = 0
  - SportPoints — **no existe** · —
  - Avisos — **existe** · 3.640 notificaciones a acudientes, 153 leídas

### 🚩 Acudiente · Pagar — `PadrePagar.dc.html` (V1 · Acudiente)

- **Reemplaza / absorbe (3):** `/my-payments` (parent), `/estado-cuenta` (parent), `/my-payments` (whatsapp)
- **Necesita:**
  - Lista de cobros y total — **existe** · `MyPaymentsPage`
  - Tarjeta, PSE o Nequi — **existe** · Wompi: 65 pagos, 3 escuelas en 90 d
  - QR Bre-B — **no existe** · —
  - Comprobante — **existe** · 486 comprobantes en 90 d

### 🚩 Acudiente · Ficha del hijo — `PadreHijo.dc.html` (V1 · Acudiente)

- **Reemplaza / absorbe (11):** `/children` (parent), `/academic-progress` (parent), `/parent-attendance` (parent), `/children/:id/reports` (parent), `/children/:id/reports/:reportId` (parent), `/salud` (parent), `/salud/invitacion/:token` (parent), `/salud` (athlete), `/salud/invitacion/:token` (athlete), `/salud` (patient(athlete|parent)), `/salud/invitacion/:token` (patient(athlete|parent))
- **Necesita:**
  - Progreso (habilidades 1 a 5) — **roto hoy** · `/academic-progress` lee `academic_progress` (≈5 filas; «nadie la carga», `AcademicProgressPage.tsx:604`). Hay que leer `performance_entries`
  - Asistencia e Informes — **existe** · `/parent-attendance`, `/children/:id/reports`

### 🚩 Acudiente · SportPoints — `PadrePuntos.dc.html` (V1 · Acudiente)

- **Reemplaza / absorbe (0):** — (tablero de fundamentos o pantalla nueva)
- **Necesita:**
  - Tarjeta, puntos, cómo sumar, premios — **no existe** · ni tabla ni código (solo `profiles.sportmaps_points` legado en `ProfilePage.tsx:365`)

### 🚩 Acudiente · Más — `PadreMas.dc.html` (V1 · Acudiente)

- **Reemplaza / absorbe (19):** `/messages` (parent), `/enrollments` (parent), `/salud` (parent), `/salud/invitacion/:token` (parent), `/wellness/appointments` (parent), `/my-cards` (parent), `/my-certificates` (parent), `/settings` (parent), `/profile` (parent), `/notifications` (parent), `/salud` (athlete), `/salud/invitacion/:token` (athlete), `/wellness/appointments` (athlete), `/enrollments` (whatsapp), `/wellness/appointments` (patient(athlete|parent)), `/salud` (patient(athlete|parent)), `/salud/invitacion/:token` (patient(athlete|parent)), `/ayuda | /ayuda/:slug` (public), `(boton flotante en AuthLayout)` (any logged (AuthLayout))
- **Necesita:**
  - Mensajes con la escuela — **roto hoy** · `messages` = 0; no se puede redactar
  - Centro de ayuda — **oculto hoy** · `/ayuda` hidden (otros-roles)
  - Hablar con SportBot — **existe** · botón flotante
  - Invita a otra familia (+5.000) — **no existe** · `create_school_referral` no está en ninguna migración (`InvitationsManagementPage.tsx:666`)
  - Tienda del club — **falta en el tablero** · Espacios la pone en Inicio y «Más»; PadreMas no la lista

### 🚩 Atleta · Hoy — `AtletaHoy.dc.html` (V1 · Atleta)

- **Reemplaza / absorbe (3):** `/dashboard` (athlete), `/training` (athlete), `/post-entreno/:sessionId` (athlete)
- **Necesita:**
  - Hoy entrenas / rutina para la casa — **existe** · `/training` (`AthleteVisibleRoutines.tsx:86`)
  - Racha — **no existe** · —

### 🚩 Atleta · Autoevaluación — `AtletaAutoeval.dc.html` (V1 · Atleta)

- **Reemplaza / absorbe (2):** `/post-entreno/:sessionId` (athlete), `/post-entreno/{sessionId}[?child_id=]` (whatsapp)
- **Necesita:**
  - Autoevaluación — **existe** · `/post-entreno/:sessionId`
  - +200 SportPoints — **no existe** · —

### Atleta · Progreso — `AtletaProgreso.dc.html` (V1 · Atleta)

- **Reemplaza / absorbe (2):** `/stats` (athlete), `/post-entreno/:sessionId/resultado` (athlete)
- **Necesita:**
  - Esfuerzo semanal y «lo que dijo el profe» — **existe** · `/stats` (`BFF /api/v1/athlete/stats`), `performance_entries`

### 🚩 Atleta · Carnet — `AtletaCarnet.dc.html` (V1 · Atleta)

- **Reemplaza / absorbe (2):** `/my-cards` (athlete), `/c/:qrToken` (public)
- **Necesita:**
  - Carnet con QR — **existe** · `rpc my_athlete_id_cards`, `/c/:qrToken`; 499 activos, 0 impresos
  - QR que «se renueva cada minuto» — **no existe** · hoy el token del QR es fijo (`/c/:qrToken`)
  - Agregar a Wallet — **no existe** · sin código de Wallet
  - Guardar imagen — **existe** · «Descargar PNG» `MyAthleteCardsPage.tsx:238`

### Profesional de salud · Agenda — `SaludAgenda.dc.html` (V1 · Otros roles)

- **Reemplaza / absorbe (9):** `/disponibilidad-medica` (school+school_admin), `/disponibilidad-medica` (coach), `/dashboard` (wellness_professional), `/schedule` (wellness_professional), `/pacientes` (wellness_professional), `/pacientes/:patientId` (wellness_professional), `/pacientes/:patientId/imprimir` (wellness_professional), `/disponibilidad` (wellness_professional), `/disponibilidad-medica` (school|coach)
- **Necesita:**
  - Agenda y citas — **existe** · `/schedule` (1 cita histórica)
  - «Lo que ve el entrenador» (restricción sin diagnóstico) — **existe sin uso** · `/disponibilidad-medica` (`clinical_patients` = 0)
  - «Cobros» del profesional (Sidebar salud) — **parcial** · hoy «marcar pagada» es solo un flag (otros-roles, Agenda)

### 🚩 Tienda · Pedidos — `TiendaPedidos.dc.html` (V1 · Otros roles)

- **Reemplaza / absorbe (2):** `/orders` (school+school_admin), `/orders (+ alias /customers)` (store_owner|school)
- **Necesita:**
  - Pedidos y «listo para retirar» — **existe oculto** · `/orders`; `store_enabled` global = false; 3 pedidos en 90 d

### 🚩 Super Admin · Consola — `SuperAdmin.dc.html` (V1 · Otros roles)

- **Reemplaza / absorbe (3):** `/mi-plan` (school+school_admin), `/admin/activity-logs` (admin|super_admin), `/admin/subscriptions` (admin|super_admin)
- **Necesita:**
  - Addons y módulos por escuela — **parcial** · `/admin/subscriptions`: el grupo «Comunicación» no está en `MODULE_GROUPS` (`AdminSubscriptionsPage.tsx:1252`)
  - Cambios con segundo factor — **no existe** · sin MFA en BFF ni frontend
  - Últimos cambios — **existe** · `/admin/activity-logs`
  - «Salud de la plataforma» (Sidebar admin) — **no existe** · `/admin/analytics` es mock

### 🚩 Menú lateral (compartido) — `Sidebar.dc.html` (Componentes)

- **Reemplaza / absorbe (35):** `(todas las rutas autenticadas)` (school+school_admin), `/notifications` (school+school_admin), `/notifications` (coach), `/notifications` (athlete), `/staff` (school+school_admin), `/whatsapp` (school+school_admin), `/vendor/dashboard` (coach), `/vendor/services` (coach), `/vendor/appointments` (coach), `/trainer/dashboard` (personal_trainer), `/trainer/clients` (personal_trainer), `/trainer/clients/:clientId` (personal_trainer), `/trainer/routines` (personal_trainer), `/trainer/routines/:routineId` (personal_trainer), `/trainer/availability` (personal_trainer), `/trainer/plans` (personal_trainer), `/trainer/payments` (personal_trainer), `/trainer/profile` (personal_trainer), `/dashboard` (wellness_professional), `/vendor/dashboard` (wellness_professional), `/pacientes` (wellness_professional), `/pacientes/:patientId` (wellness_professional), `/pacientes/:patientId/imprimir` (wellness_professional), `/historias` (wellness_professional), `/vendor/services` (wellness_professional), `/vendor/dashboard` (store_owner), `/vendor/products (+ alias /products, /categories, /promotions)` (store_owner|school), `/vendor/products/new | /vendor/products/:id/edit` (store_owner|school), `/orders (+ alias /customers)` (store_owner|school), `/store-reports` (store_owner), `/admin` (admin|super_admin), `/admin/analytics` (admin|super_admin), `/admin/schools` (admin|super_admin), `/admin/subscriptions` (admin|super_admin), `/admin/support` (super_admin)
- **Necesita:**
  - Menú por espacio — **no existe** · depende de Espacios
  - Inconsistencia con Navegación — **decidir** · «Entrenadores»/«Cobros» aquí vs «Deportivo»/«Dinero» en Navegación

### Barra inferior (compartida) — `TabBar.dc.html` (Componentes)

- **Reemplaza / absorbe (9):** `/staff` (school+school_admin), `/teams` (coach), `/coach-attendance` (coach), `/children` (parent), `/calendar` (parent), `/my-payments` (parent), `/stats` (athlete), `/training` (athlete), `/my-cards` (athlete)
- **Necesita:**
  - Barra por rol con «Más» al final — **parcial** · hoy Mensajes ocupa un lugar en coach y acudiente; personal_trainer no tiene barra propia (`MobileBottomNav.tsx:51`)

## 3. Listas priorizadas

Orden por uso real (escuelas distintas primero, después volumen). Fuente de cada número entre paréntesis.

### (a) Se usa hoy y no tiene lugar en el rediseño: hay que agregarlo

| # | Función | Uso hoy | Dónde está hoy | Propuesta de lugar |
|---|---|---|---|---|
| 1 | Disponibilidad y citas del entrenador | 734 franjas, **18 coaches, 13 escuelas** (usage.json `coach_availability_mis_planes`) | `/coach-plans` (`pages/CoachPlansPage.tsx`) | Entrada «Agenda» o pestaña en «Hoy»/«Más» del entrenador |
| 2 | Planes y ofertas de la escuela (qué se cobra a quién) | 72 planes nuevos en 90 d, **11 escuelas**; 158 en total (escuela.json `offering_plans`) | `/offerings` (`OfferingsManagement`) | Pestaña «Planes» en Dinero o en Deportivo › Equipos y categorías; V2EscuelaNueva paso 3 |
| 3 | Glosas, Conciliación, Cierre de mes e Historial de pagos | `payments` 25 escuelas; `monthly_closes` 5 (2 escuelas); `payment_glosas` 2; `payment_adjustments` 5 (escuela.json) | pestañas de `/payments-automation` (`PaymentsAutomationPage.tsx:1555-1558`) | Pestañas de Dinero (EscuelaDinero solo dibuja 7) |
| 4 | QR de inscripción | 1.727 escaneos, 226 registros, 61 pagados (usage.json); 7 QR nuevos en 90 d en **5 escuelas** (escuela.json) | `/qr-signup` | Pestaña en Deportistas (junto a Matrículas por revisar) |
| 5 | Pantallas del deportista adulto fuera de la barra: pagos, calendario, inscripciones, ajustes, perfil | 76 atletas con login en 90 d, 18 en 30 d; 17 reservas de clase (usage.json) | `/athlete-payments`, `/calendar`, `/enrollments`, `/settings`, `/profile` | Dibujar el «Más» del atleta (no existe tablero) |
| 6 | Informe mensual del entrenador | 28 informes publicados por coaches en 90 d (**2 escuelas**); 157 en total (usage.json) | `/informe-mensual` (menú del coach) | Pestaña en «Evaluar» del entrenador |
| 7 | Informe grupal post-entreno / reporte del equipo | `team_reports` 15 en 90 d (usage.json) | `/coach-reports`, `/coach-reports/entreno-equipo` | «Evaluar» o «Mis equipos» del entrenador (arreglar antes el IDOR de `reports.ts:661-680`) |
| 8 | Asistencia por día, día por día y plan vs consumo | `attendance_records` 4.981 en 90 d, 11 escuelas (pestañas sin medir por separado) | `/attendance-history` (`AttendanceHistoryPage.tsx:672-681`) | Pestañas extra de Asistencia |
| 9 | Exportes CSV de Reportes, Panel de reportes y Finanzas | no medido (pantallas de solo lectura) | `ReportsPage.tsx:320-565`, `ReporterDashboardPage.tsx:177-832` | «Exportar» en cada módulo (la regla «cada número vive junto a lo que mide» no dice dónde quedan) |
| 10 | Inscripción del acudiente a torneos y sus inscripciones | `event_registrations` 4 en 90 d (usage.json) | `/tournaments/:eventId/register`, `/my-event-registrations` | Calendario del acudiente |
| 11 | Integridad de inscripciones (Super Admin) | 188 hallazgos (otros-roles) | `/admin/enrollment-integrity` | Consola Super Admin |
| 12 | Dotación de la escuela | 3 ítems y 4 asignaciones, 2 escuelas (escuela.json) | `/school/equipment` | Escuela › o Deportivo › |
| 13 | Check-in por carnet del entrenador | 1 marca por QR en 90 d (usage.json) | `/coach-attendance/scan` | Botón dentro de Tomar lista |

**Con entrada en el menú pero sin pantalla dibujada** (riesgo de rehacerlas sin diseño): Control de acceso (`access_events` 10.376 en 90 d, 4 escuelas — el módulo con más volumen), Equipos (80 en 90 d, 13 escuelas), Entrenadores (49, 14), Sedes e instalaciones (24 / 22, 16 / 6), Calendario (106, 5), WhatsApp (292 conversaciones, 2), Contabilidad y Facturación electrónica (324 facturas, 2), Recepción, Torneos y partidos (8 eventos, 4), Biblioteca/rutinas (11 rutinas + 22 planes, 6), Perfil público y Plan.

### (b) Elementos del rediseño sin backend hoy: hay que construirlos

| # | Elemento | Tableros | Estado hoy | Evidencia |
|---|---|---|---|---|
| 1 | Lista que funciona sin señal y sube sola | V2Lista (prueba V2: «tomar lista de 22») | no existe | cero IndexedDB / cola offline / `navigator.onLine` en `frontend/src` |
| 2 | Entrada sin contraseña con código por WhatsApp y «¿Eres Carolina?» precargado | V2Bienvenida, V2PagoListo | no existe | sin OTP en BFF ni frontend; ficha precargada 0 / 477 (V2Main) |
| 3 | Autoevaluación respondida dentro del chat de WhatsApp | V2WaAutoeval | no existe (solo en la app) | `/post-entreno` por notificación; responde el 4 % (V2Main) |
| 4 | SportPoints (puntos, tarjeta, premios, +200 / +500 / +5.000) | PadrePuntos, PadreInicio, PadreMas, AtletaHoy, AtletaAutoeval, V2PagoListo, V2WaAutoeval, SuperAdmin | no existe | sin tabla ni código; solo `profiles.sportmaps_points` legado (`ProfilePage.tsx:365`) |
| 5 | Deshacer 8 s en vez de «¿Seguro?» | V2Aprobar (regla 04 de V2) | no existe | «Aprobar todos los verdes» sí existe (`BulkApproveGreensDialog.tsx:80`) |
| 6 | Carga de una planilla completa por foto | V2CargaFoto, V2EscuelaNueva | parcial | hoy una hoja por deportista (`/school/enrollment-intake`, 14 en 90 d) o CSV |
| 7 | Espacios: selector escuela + rol y último espacio en el perfil | Espacios, Sidebar, Main | no existe | `SchoolSwitcher` apagado; `AppSidebar.tsx:60-66`, `useSchoolContext.ts:223` |
| 8 | QR Bre-B con confirmación automática | PadrePagar, EscuelaDinero, V2PagoEnlace | no existe | depende de que Factus Pay habilite la dispersión |
| 9 | Carnet con QR que se renueva cada minuto y «Agregar a Wallet» | AtletaCarnet | no existe | token fijo `/c/:qrToken`; sin código de Wallet |
| 10 | Consola Super Admin con segundo factor y «Salud de la plataforma» | SuperAdmin, Sidebar (admin) | no existe | sin MFA; `/admin/analytics` es mock |
| 11 | Racha de entrenos | AtletaHoy, V2DeportistaHoy | no existe | — |
| 12 | Escala «Bien · Normal · Le costó» y métricas elegidas por la escuela | V2Evaluar, CoachEvaluacion | no existe | Main Capa 4 (PER-0, MOD-17) |
| 13 | Invitar a otra familia (referidos con puntos) | PadreMas | no existe | `create_school_referral` sin migración (`InvitationsManagementPage.tsx:666`) |
| 14 | Pedir datos faltantes «de a una pregunta» | V2Bienvenida, V2PadreInicio | no existe | — |
| 15 | Modo cancha (letra grande, pantalla encendida) | V2PlanHoy | no existe | — |
| 16 | Subir el comprobante desde el enlace de pago | V2PagoEnlace | parcial | hoy solo «Enviar por WhatsApp» (`CobroPublicoPage.tsx:340`) |

**El rediseño también se apoya en cosas que existen pero están rotas u ocultas** (hay que terminarlas antes de dibujar encima): el modal único «Cobros y pagos», «Cobrar a un equipo» y «Operaciones» (detrás de `VITE_COBROS_Y_PAGOS`, `charge_batches` = 0); el débito automático (`recurring_subscriptions` = 0, BFF F2 sin commitear); «Mensajes con la escuela» (0 mensajes, no se puede redactar); el «Progreso» del hijo (lee `academic_progress`, muerta); «Centro de ayuda» (`/ayuda` oculto); la tienda (apagada global) con Promociones mock y Reportes rotos; la agenda del entrenador-vendedor (`/vendor/appointments` rota); la semana de sesiones del coach (`WeekSessionsPanel` solo admin); y la barra inferior por rol (hoy ignora billing y el rol de contexto).

### (c) Candidatas a quitar (cero uso o muertas)

| # | Función | Uso | Qué hace el rediseño | Recomendación |
|---|---|---|---|---|
| 1 | Mensajes / Chat (`/messages`) | `messages` = 0 histórico; hoy ocupa 1 de 5 lugares de la barra de coach y acudiente | lo conserva en «Más» («no se borra») | Quitar o reconstruir; no dibujar encima de un módulo sin redacción |
| 2 | Anuncios (`/announcements`) | `announcements` = 0; insert falla por `school_id` NOT NULL | «Anuncios → Avisos» | Quitar la pantalla; Avisos = notificaciones + WhatsApp |
| 3 | Módulo organizer (10 pantallas `/organizer/*`) | `event_organizers` = 0; 2 perfiles sin login desde jul | no lo dibuja | Quitar; torneos viven en la escuela |
| 4 | Encuestas (`/dashboard/polls`, `/polls/v/:pollId`) | 0 en 90 d (3 históricas) | la conserva como pestaña de Asistencia | Quitar la pestaña |
| 5 | Constancias (`/certificates`, plantillas, `/my-certificates`) | `athlete_certificates` = 0, plantillas = 0 | la fusiona en «Carnets y constancias» | Dejar solo Carnets |
| 6 | Membresías (`/memberships`) | `memberships` = 0 | no la dibuja | Quitar |
| 7 | Objetivos del atleta (`/goals`) | `athlete_goals` = 0 | «fuera» (UX-6) | Quitar |
| 8 | Disponibilidad médica y módulo clínico | `clinical_patients` = 0, 1 cita histórica, 1 profesional con login en 30 d | lo conserva (SaludAgenda, «Más › salud») | Congelar hasta tener un cliente |
| 9 | Pantallas muertas o duplicadas: `/evaluations`, `/programs-management`, `/school-config`, `/pickup`, `/nutrition`, `/escuela/:id`, `/pagos/confirmacion`, `/shop`, `/marketplace*`, `/children/:id/progress|attendance`, `/vendor/appointments` | sin enlaces o mock | no las dibuja | Borrar rutas y archivos |
| 10 | Suscriptores recurrentes v1 (`/vendor/subscribers`) | BFF 410 | no la dibuja | Borrar |
| 11 | Admin: `/admin/clubs`, `/admin/logs`, `/admin/upgrade-requests`, `/admin/analytics`, alias `/admin/reports|config` | 0 solicitudes; mock; alias | no las dibuja | Borrar |
| 12 | Subir hoja de matrícula como coach | 0 subidas por coach en 90 d | no la dibuja | Quitar el botón al coach |
| 13 | Tienda de vendedores externos: liquidaciones, reseñas, envíos | `vendor_payouts` = 0, reseñas = 0, 0 configuraciones de cobro de vendedores | Espacios la separa en su propio espacio | Postergar |
| 14 | Explorar global (`/explorar`) | oculto en producción | «fuera del espacio de la escuela» | Mantener oculto y quitar los 6 botones que llevan ahí |

### (d) Duplicados que el rediseño resuelve

| # | Duplicado hoy | Cómo lo resuelve | Peso (uso) |
|---|---|---|---|
| 1 | Registrar pago desde `/students`, `/teams` y `/payments-automation` (16 componentes compartidos) | Un solo botón «Cobros y pagos» (Sistema, EscuelaDinero, EscuelaHoy) | `payments` 4.960 en 90 d, **25 escuelas** |
| 2 | Cartera en 4 destinos (`/payments-automation`, `/finances`, `/reporter-dashboard`, `/school-reports`) | «Panel, Reportes, Finanzas → Hoy + cada módulo»; Vencidos en Dinero | 25 escuelas con pagos |
| 3 | Dos árboles de menú (school 45 ítems, school_admin 44) | Un solo árbol de 10 entradas | 67 escuelas con miembros activos |
| 4 | Asistencia del coach en 3-4 entradas (botón, acción rápida, menú «Supervisión», `/coach-plans`) | CoachHoy / V2CoachHoy: una sola acción «Tomar lista» | 2.636 marcas de coach, 17 coaches |
| 5 | Configuración en `/settings`, `/school-config`, `/admin/config` y Config de Pagos | EscuelaConfig: 10 secciones | — |
| 6 | Contabilidad en 5 entradas + Facturación electrónica standalone | «Contabilidad, con pestañas» / «Contabilidad o Facturación» | 324 facturas (2 escuelas), 20 gastos, 12 presupuestos |
| 7 | Invitar en 4 caminos y 2 backends | Deportistas › Invitaciones + invitar por WhatsApp al cargar (V2CargaFoto) | 259 invitaciones en 90 d, 14 escuelas |
| 8 | Resultados en `/results-overview`, `/results`, «Programar Partido» y `/coach-reports` | «Un resultado es parte del partido» → Calendario › Torneos y partidos | 34 resultados, 4 escuelas |
| 9 | Plantillas y recordatorios en `/payment-reminders`, `/message-templates` y Config de Pagos | WhatsApp › Avisos y plantillas · Recordatorios | 1 plantilla en 90 d; 4 recordatorios registrados |
| 10 | Carnets ×2 entradas + Constancias | «Carnets y constancias» | 508 carnets en 90 d, 3 escuelas |
| 11 | Checkout en `PaymentCheckoutModal`, `/parent-checkout` y `/p/:token`; resultado en `/payment-result` y `/pagos/confirmacion` | V2PagoEnlace + V2PagoListo | 929 enlaces creados, 211 abiertos |
| 12 | Perfil propio en `/profile` y `/settings` (3 subidores de avatar) | «Más › Configuración» | — |
| 13 | Inicio del profesional `/dashboard` vs `/vendor/dashboard` | La Agenda es el inicio (SaludAgenda) | 1 profesional activo |
| 14 | Sedes vs Instalaciones vs Clubes | Escuela › Sedes e instalaciones | `school_branches` 24 en 90 d, 16 escuelas |
| 15 | Tres tiendas que se confunden (escolar, marketplace, servicios) | Espacios: cada tienda es su espacio o una entrada | 3 pedidos en 90 d |

**Duplicados que el rediseño NO resuelve:** Mis Pagos del acudiente vs del atleta adulto (`/my-payments` vs `/athlete-payments`, el atleta no tiene tablero de pagos); dos bibliotecas (rutinas `trainer_routines` vs ejercicios de sesión); informe mensual del equipo vs informe post-entreno; perfil público de escuela ×3 (`/s/:slug`, `/schools/:id`, `/escuela/:id`); organizer vs torneos de escuela (se resuelve solo si se quita organizer); y la propia contradicción del rediseño entre Navegación, Menú lateral y Barra inferior para la escuela.
