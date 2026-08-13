// ============================================================================
// Catálogo demo — Club Patinaje Veloz (patinaje de velocidad, una sede)
//
// Arquetipo: la escuela chica que acaba de llegar. Una sola sede, pocas
// categorías, cartera manejable. Es la demo para el cliente que hoy lleva todo
// en WhatsApp y un cuaderno — el caso del club de patinaje de Bogotá.
//
// Nota: patinaje no tiene foto verificada en sportImages.ts, así que usa la
// genérica. Cuando haya una verificada (HTTP 200), se cambia acá y en el front.
// ============================================================================
export * from './_comun.mjs';
import { IMG } from './_comun.mjs';

export const CLUB = {
    key: 'club',
    name: 'Club Patinaje Veloz Demo',
    logo_source: IMG.generico,
    cover_image_url: IMG.generico,
    branding: { primary_color: '#c2410c', secondary_color: '#0369a1' },
    slug: 'club-patinaje-veloz-demo',
    school_type: 'hybrid',
    business_model: 'both',
    payment_mode: 'aggregator',
    city: 'Bogotá',
    address: 'Diagonal 61C # 26-36, Parque El Salitre, Bogotá D.C.',
    phone: '+57 601 555 0230',
    email: 'direccion@demo-patinaje.sportmaps.co',
    nit: '901.556.882-4',
    cuota_social: 0,
    description:
        'Club de patinaje de velocidad con escuela de iniciación, categorías federadas y grupo '
        + 'máster de adultos. Entrena en patinódromo propio. Tenant de DEMOSTRACIÓN.',
};

export const DISCIPLINAS = [
    {
        key: 'patinodromo', name: 'Patinódromo El Salitre', sport: 'Patinaje', img: IMG.generico,
        matricula: 80000, mensualidad: 130000,
        facilities: [
            { key: 'pista', name: 'Pista de velocidad 200m', type: 'Pista de Patinaje', capacity: 40 },
            { key: 'circuito', name: 'Circuito de ruta', type: 'Pista de Patinaje', capacity: 30 },
            { key: 'salon', name: 'Salón de preparación física', type: 'Gimnasio', capacity: 20 },
        ],
        categorias: [
            { key: 'iniciacion', name: 'Iniciación', age: [5, 8], fill: 3 },
            { key: 'transicion', name: 'Transición', age: [9, 11], fill: 3 },
            { key: 'prefederado', name: 'Prefederado', age: [12, 14], fill: 3 },
            { key: 'federado', name: 'Federado', age: [15, 18], fill: 2 },
            { key: 'master', name: 'Máster Adultos', age: [19, 55], adult: true, fill: 3 },
        ],
        horarios: [
            { cat: 'iniciacion', days: [2, 4], start: '15:00', end: '16:00', facility: 'pista' },
            { cat: 'transicion', days: [2, 4], start: '16:00', end: '17:30', facility: 'pista' },
            { cat: 'prefederado', days: [1, 3, 5], start: '16:00', end: '18:00', facility: 'pista' },
            { cat: 'federado', days: [1, 3, 5], start: '05:30', end: '07:30', facility: 'circuito' },
            { cat: 'master', days: [2, 4], start: '19:00', end: '20:30', facility: 'circuito' },
        ],
    },
];

export const STAFF = [
    {
        key: 'direccion', email: 'direccion@demo-patinaje.sportmaps.co', full_name: 'Nubia Rodríguez',
        signup_role: 'school', member_role: 'owner', branch: null, is_owner: true,
        phone: '+57 310 558 0101', cargo: 'Dirección y Cartera',
    },
    {
        key: 'auxiliar', email: 'auxiliar@demo-patinaje.sportmaps.co', full_name: 'Camilo Peña',
        signup_role: 'reporter', member_role: 'reporter', branch: null,
        phone: '+57 310 558 0102', cargo: 'Auxiliar administrativo (solo lectura)',
    },
    {
        key: 'porteria', email: 'porteria@demo-patinaje.sportmaps.co', full_name: 'Puesto Patinódromo — Acceso',
        signup_role: 'school_admin', member_role: 'admin', branch: null,
        phone: '+57 310 558 0103', cargo: 'Control de Acceso',
    },
];

export const COACHES = [
    {
        key: 'coach_form', email: 'entrenadora.formativas@demo-patinaje.sportmaps.co', full_name: 'Yeimy Castiblanco',
        signup_role: 'coach', member_role: 'coach', branch: 'patinodromo',
        specialty: 'Patinaje — iniciación y transición', phone: '+57 311 558 0201',
        teams: [{ disciplina: 'patinodromo', cat: 'transicion' }],
    },
    {
        key: 'coach_fed', email: 'entrenador.federado@demo-patinaje.sportmaps.co', full_name: 'Óscar Pinzón',
        signup_role: 'coach', member_role: 'coach', branch: 'patinodromo',
        specialty: 'Patinaje — velocidad federada', phone: '+57 311 558 0202',
        teams: [{ disciplina: 'patinodromo', cat: 'federado' }],
    },
];

export const PARENTS = [
    {
        key: 'mbernal', email: 'mbernal@demo-patinaje.sportmaps.co', full_name: 'Marisol Bernal',
        phone: '+57 320 558 0301', cuota_social: 'paid',
        children: [
            {
                key: 'jeronimo', full_name: 'Jerónimo Bernal', age: 10, gender: 'M',
                enrollments: [{ disciplina: 'patinodromo', cat: 'transicion', pay: 'al_dia', method: 'wompi_card' }],
                zk_pin: 4001,
            },
            {
                key: 'antonella', full_name: 'Antonella Bernal', age: 7, gender: 'F',
                enrollments: [{ disciplina: 'patinodromo', cat: 'iniciacion', pay: 'al_dia', method: 'wompi_card' }],
                zk_pin: null,
            },
        ],
    },
    {
        key: 'gsalcedo', email: 'gsalcedo@demo-patinaje.sportmaps.co', full_name: 'Germán Salcedo',
        phone: '+57 320 558 0302', cuota_social: 'paid',
        children: [
            {
                key: 'valeria_s', full_name: 'Valeria Salcedo', age: 16, gender: 'F',
                enrollments: [{ disciplina: 'patinodromo', cat: 'federado', pay: 'mora_1', method: null }],
                zk_pin: 4002,
            },
        ],
    },
];

export const ATHLETES = [
    {
        key: 'pcaicedo', email: 'pcaicedo@demo-patinaje.sportmaps.co', full_name: 'Paola Caicedo',
        age: 35, gender: 'F', phone: '+57 320 558 0303', cuota_social: 'paid',
        zk_pin: 4003, autopay: true,
        enrollments: [{ disciplina: 'patinodromo', cat: 'master', pay: 'al_dia', method: 'wompi_nequi' }],
    },
    {
        key: 'hbarona', email: 'hbarona@demo-patinaje.sportmaps.co', full_name: 'Hugo Barona',
        age: 41, gender: 'M', phone: '+57 320 558 0304', cuota_social: 'overdue',
        zk_pin: 4004, autopay: false,
        enrollments: [{ disciplina: 'patinodromo', cat: 'master', pay: 'mora_2', method: null }],
    },
];

export const EXTERNAL = {
    key: 'dnavarro', email: 'dnavarro.externa@demo-patinaje.sportmaps.co', full_name: 'Daniela Navarro',
    age: 19, gender: 'F', phone: '+57 320 558 0305',
};

export const TORNEO = {
    key: 'torneo_patinaje',
    title: 'Válida Distrital de Patinaje de Velocidad',
    slug: 'valida-distrital-patinaje-velocidad',
    sport: 'Patinaje',
    price: 65000,
    capacity: 60,
    days_ahead: 26,
    start_time: '07:00',
    end_time: '15:00',
};

export const FILLER_PARENTS = [
    { key: 'fp1', email: 'familia.leal@demo-patinaje.sportmaps.co', full_name: 'Esperanza Leal', phone: '+57 321 558 0401' },
    { key: 'fp2', email: 'familia.bautista@demo-patinaje.sportmaps.co', full_name: 'Álvaro Bautista', phone: '+57 321 558 0402' },
    { key: 'fp3', email: 'familia.cely@demo-patinaje.sportmaps.co', full_name: 'Martha Cely', phone: '+57 321 558 0403' },
    { key: 'fp4', email: 'familia.riveros@demo-patinaje.sportmaps.co', full_name: 'Jairo Riveros', phone: '+57 321 558 0404' },
];

// 11 menores para los 11 cupos formativos.
export const FILLER_MINORS = [
    'Sofía Leal', 'Matías Leal', 'Nicolás Bautista', 'Isabella Bautista',
    'Emiliano Cely', 'Camila Cely', 'Andrés Riveros', 'Julieta Riveros',
    'Santiago Amaya', 'Mariana Amaya', 'Felipe Chaparro',
];

// 3 adultos para Máster.
export const FILLER_ADULTS = [
    'Luis Eduardo Poveda', 'Claudia Marcela Ruiz', 'Édison Gallego',
];

export const TARIFAS = {
    pista: { hora: 100000, rental: true },
    circuito: { hora: 80000, rental: true },
    salon: { hora: 45000, rental: false },
};

export const ARRENDATARIOS = [
    'Liga de Patinaje de Bogotá', 'Colegio Distrital Tomás Carrasquilla',
    'Club Los Halcones', 'IDRD — jornada recreativa', 'Empresa Postobón — bienestar',
];

export const DEVICES = [
    {
        key: 'entry', serial_number: 'DEMOPATI0001', device_name: 'Patinódromo — Entrada',
        direction: 'entry', location: 'Patinódromo El Salitre', brand: 'ZKTeco',
    },
    {
        key: 'exit', serial_number: 'DEMOPATI0002', device_name: 'Patinódromo — Salida',
        direction: 'exit', location: 'Patinódromo El Salitre', brand: 'ZKTeco',
    },
];
