// Configuración de la auditoría responsive. Todo lo que cambia entre corridas
// se puede sobreescribir por env/CLI (ver run.mjs).

// Cuentas del tenant demo "Club Campestre Demo" (school_id 25a123f0-…).
// Contraseña única: scripts/demo-club-campestre/README.md. NUNCA usar cuentas
// de escuelas reales: la auditoría navega con sesión real.
export const PASSWORD = 'Demo2026!';
export const ACCOUNTS = {
  school:       { email: 'gerencia@demo.sportmaps.co',         who: 'Ricardo Mendoza (owner)' },
  school_admin: { email: 'tenis@demo.sportmaps.co',            who: 'Camila Restrepo (coordinadora Tenis, admin con sede)' },
  coach:        { email: 'entrenador.tenis@demo.sportmaps.co', who: 'Felipe Torres (coach Tenis)' },
  parent:       { email: 'mherrera@demo.sportmaps.co',         who: 'Mauricio Herrera (acudiente de Sofía y Tomás)' },
  athlete:      { email: 'vcruz@demo.sportmaps.co',            who: 'Valentina Cruz (atleta adulta)' },
  reporter:     { email: 'finanzas@demo.sportmaps.co',         who: 'Patricia Vargas (Auditora / reporter)' },
};

// Roles del menú SIN cuenta demo en Club Campestre Demo → se saltan y se reportan.
export const ROLES_WITHOUT_ACCOUNT = {
  wellness_professional: 'no hay profesional de salud en el tenant demo',
  store_owner: 'no hay vendedor/tienda en el tenant demo (tienda no desplegada)',
  organizer: 'no hay organizador de eventos en el tenant demo',
  facility_manager: 'rol sin UI ni entrada en navigation.ts (cae al menú base)',
  admin: 'admin de plataforma: no se usa una cuenta real de plataforma (fuera del tenant demo)',
  super_admin: 'super admin de plataforma: idem',
  accountant: 'no hay contador en el tenant demo',
  personal_trainer: 'no hay entrenador personal en el tenant demo',
};

// IDs del tenant demo para rutas de detalle.
const TOMAS = '7167931e-0798-43e8-a286-d4985b0965b6';

// Abrir el perfil del deportista: en móvil por el menú «…», en escritorio por «Ver».
const VER_PERFIL = [
  [{ click: '[aria-label^="Más acciones para"]' }, { click: 'role=menuitem[name="Ver Perfil"]' }],
  [{ click: 'role=button[name="Ver"]' }],
];

// Rutas de detalle alcanzables desde el menú (además de las de navigation.ts).
// `steps`: acciones de SOLO LECTURA tras cargar (abrir un diálogo, una pestaña).
export const EXTRA_ROUTES = {
  school: [
    { path: '/students', title: 'Perfil del deportista (diálogo)', id: 'students#perfil',
      stepsAlt: VER_PERFIL },
    { path: '/cards/templates/certificates', title: 'Plantillas de constancias' },
    { path: '/profile', title: 'Mi perfil' },
    { path: '/notifications', title: 'Notificaciones' },
    { path: '/s/club-campestre-demo', title: 'Perfil público de la escuela' },
  ],
  school_admin: [
    { path: '/students', title: 'Perfil del deportista (diálogo)', id: 'students#perfil',
      stepsAlt: VER_PERFIL },
    { path: '/profile', title: 'Mi perfil' },
  ],
  coach: [
    { path: '/students', title: 'Perfil del deportista (diálogo)', id: 'students#perfil',
      stepsAlt: VER_PERFIL },
    { path: '/coach-reports/entreno-equipo', title: 'Reporte de entreno por equipo' },
    { path: '/profile', title: 'Mi perfil' },
    { path: '/notifications', title: 'Notificaciones' },
  ],
  parent: [
    { path: `/children/${TOMAS}/progress`, title: 'Progreso de Tomás' },
    { path: `/children/${TOMAS}/attendance`, title: 'Asistencia de Tomás' },
    { path: `/children/${TOMAS}/reports`, title: 'Informes de Tomás' },
    { path: '/profile', title: 'Mi perfil' },
    { path: '/notifications', title: 'Notificaciones' },
    // Acudiente V2: pestañas internas de Hijos, Calendario y Pagos, y «Más».
    { path: '/mas', title: 'Más' },
    { path: '/children?tab=progreso', title: 'Hijos · Progreso', id: 'children#progreso' },
    { path: `/children?hijo=${TOMAS}&tab=asistencia`, title: 'Hijos · Asistencia (Tomás)', id: 'children#asistencia' },
    { path: '/children?tab=informes', title: 'Hijos · Informes', id: 'children#informes' },
    { path: '/children?tab=ficha', title: 'Hijos · Ficha y salud', id: 'children#ficha' },
    { path: '/calendar', title: 'Calendario · Torneos', id: 'calendar#torneos', steps: [{ click: 'role=tab[name="Torneos"]' }] },
    { path: '/calendar', title: 'Calendario · Mes', id: 'calendar#mes', steps: [{ click: 'role=tab[name="Mes"]' }] },
    { path: '/my-payments', title: 'Pagos · Pagados', id: 'my-payments#pagados', steps: [{ click: 'role=tab[name="Pagados"]' }] },
    // Módulos del menú anterior (regla: el acudiente no pierde ninguno).
    { path: '/academic-progress', title: 'Progreso deportivo (antes)' },
    { path: '/parent-attendance', title: 'Asistencias (antes)' },
    { path: '/messages', title: 'Mensajes' },
    { path: '/enrollments', title: 'Mis inscripciones' },
    { path: '/my-event-registrations', title: 'Mis eventos' },
    { path: '/salud', title: 'Salud de mis hijos' },
    { path: '/wellness/appointments', title: 'Mis citas' },
    { path: '/my-cards', title: 'Carnets' },
    { path: '/my-certificates', title: 'Mis constancias' },
    { path: '/settings', title: 'Configuración' },
    { path: '/estado-cuenta', title: 'Estado de cuenta' },
  ],
  athlete: [
    { path: '/enrollments', title: 'Mis inscripciones' },
    { path: '/profile', title: 'Mi perfil' },
    { path: '/notifications', title: 'Notificaciones' },
  ],
  reporter: [{ path: '/profile', title: 'Mi perfil' }],
};

// Matriz base: layout responsive, captura a 1x.
export const VIEWPORTS = [
  { id: '360',  width: 360,  height: 740,  label: 'Android chico' },
  { id: '390',  width: 390,  height: 844,  label: 'iPhone 14' },
  { id: '430',  width: 430,  height: 932,  label: 'iPhone Pro Max' },
  { id: '768',  width: 768,  height: 1024, label: 'Tablet vertical' },
  { id: '1024', width: 1024, height: 768,  label: 'Tablet horizontal / laptop chico' },
  { id: '1440', width: 1440, height: 900,  label: 'Escritorio' },
];

// Matriz de densidad (pixelado, texto borroso, scrollbars con escala de Windows).
// Escala 125/150 % de Windows = deviceScaleFactor 1.25/1.5; retina = 2.
export const DENSITY = {
  sizes: [
    { id: '1440', width: 1440, height: 900, label: 'Escritorio' },
    { id: '1366', width: 1366, height: 768, label: 'Laptop 1366' },
    { id: '390',  width: 390,  height: 844, label: 'iPhone 14' },
  ],
  scales: [1, 1.25, 1.5, 2],
};

export const MOBILE_MAX = 767; // < 768 = móvil (bottom nav visible, md:hidden)

// Zoom del navegador simulado de forma fiel: a zoom Z sobre una ventana de
// 1440×900 físicos, el layout ve 1440/Z × 900/Z px CSS y cada px CSS mide Z px
// físicos → viewport = (1440/Z, 900/Z), deviceScaleFactor = Z × escala Windows (1).
// Es exactamente lo que hace Chrome con Ctrl +/- (media queries incluidas), a
// diferencia de `body.style.zoom`, que no dispara breakpoints.
export const ZOOM = {
  base: { width: 1440, height: 900 },
  levels: [0.8, 0.9, 1, 1.1, 1.25, 1.5, 2],
};
