// ============================================================================
// Catálogo demo — Academia Fútbol Horizonte (fútbol, dos sedes)
//
// Arquetipo: la academia formativa clásica. Categorías por año de nacimiento,
// dos sedes, alquiler de canchas los fines de semana como ingreso extra.
// Es la demo por defecto para escuelas de fútbol, que son la mayoría.
// ============================================================================
export * from './_comun.mjs';
import { IMG } from './_comun.mjs';

export const CLUB = {
    key: 'club',
    name: 'Academia Fútbol Horizonte Demo',
    logo_source: IMG.futbol,
    cover_image_url: IMG.futbol,
    branding: { primary_color: '#15803d', secondary_color: '#0f172a' },
    slug: 'academia-futbol-horizonte-demo',
    school_type: 'hybrid',
    business_model: 'both',
    payment_mode: 'aggregator',
    city: 'Bogotá',
    address: 'Carrera 68 # 40-15, Bogotá D.C.',
    phone: '+57 601 555 0220',
    email: 'direccion@demo-futbol.sportmaps.co',
    nit: '901.445.117-9',
    cuota_social: 0,
    description:
        'Academia de fútbol formativo con dos sedes, categorías sub-8 a sub-17, equipo de mayores '
        + 'y alquiler de canchas los fines de semana. Tenant de DEMOSTRACIÓN.',
};

export const DISCIPLINAS = [
    {
        key: 'sede_norte', name: 'Sede Norte', sport: 'Fútbol', img: IMG.futbol,
        matricula: 110000, mensualidad: 165000,
        facilities: [
            { key: 'cancha11', name: 'Cancha fútbol 11', type: 'Cancha de Fútbol', capacity: 60 },
            { key: 'sintetica_n', name: 'Sintética Norte', type: 'Cancha de Fútbol', capacity: 30 },
        ],
        categorias: [
            { key: 'sub8', name: 'Sub-8', age: [6, 8], fill: 3 },
            { key: 'sub10', name: 'Sub-10', age: [9, 10], fill: 4 },
            { key: 'sub12', name: 'Sub-12', age: [11, 12], fill: 4 },
            { key: 'sub15', name: 'Sub-15', age: [13, 15], fill: 4 },
            { key: 'sub17', name: 'Sub-17', age: [16, 17], fill: 3 },
        ],
        horarios: [
            { cat: 'sub8', days: [2, 4], start: '15:00', end: '16:30', facility: 'sintetica_n' },
            { cat: 'sub10', days: [2, 4], start: '16:30', end: '18:00', facility: 'sintetica_n' },
            { cat: 'sub12', days: [1, 3, 5], start: '16:00', end: '17:30', facility: 'cancha11' },
            { cat: 'sub15', days: [1, 3, 5], start: '17:30', end: '19:30', facility: 'cancha11' },
            { cat: 'sub17', days: [2, 4, 6], start: '18:00', end: '20:00', facility: 'cancha11' },
        ],
    },
    {
        key: 'sede_sur', name: 'Sede Sur', sport: 'Fútbol', img: IMG.futbol,
        matricula: 100000, mensualidad: 140000,
        facilities: [
            { key: 'sintetica_s', name: 'Sintética Sur', type: 'Cancha de Fútbol', capacity: 30 },
            { key: 'microfutbol', name: 'Cancha de microfútbol', type: 'Cancha de Fútbol', capacity: 20 },
        ],
        categorias: [
            { key: 'sub10_s', name: 'Sub-10 Sur', age: [9, 10], fill: 3 },
            { key: 'sub14_s', name: 'Sub-14 Sur', age: [12, 14], fill: 3 },
            { key: 'mayores', name: 'Mayores', age: [18, 40], adult: true, fill: 4 },
        ],
        horarios: [
            { cat: 'sub10_s', days: [1, 3], start: '15:30', end: '17:00', facility: 'sintetica_s' },
            { cat: 'sub14_s', days: [2, 4], start: '17:00', end: '18:30', facility: 'sintetica_s' },
            { cat: 'mayores', days: [3, 5], start: '20:00', end: '21:30', facility: 'microfutbol' },
        ],
    },
];

export const STAFF = [
    {
        key: 'direccion', email: 'direccion@demo-futbol.sportmaps.co', full_name: 'Hernán Cardona',
        signup_role: 'school', member_role: 'owner', branch: null, is_owner: true,
        phone: '+57 310 557 0101', cargo: 'Dirección Deportiva',
    },
    {
        key: 'contabilidad', email: 'contabilidad@demo-futbol.sportmaps.co', full_name: 'Sandra Piedrahíta',
        signup_role: 'reporter', member_role: 'reporter', branch: null,
        phone: '+57 310 557 0102', cargo: 'Contabilidad (solo lectura)',
    },
    {
        key: 'coord_sur', email: 'sur@demo-futbol.sportmaps.co', full_name: 'Wilmar Zuluaga',
        signup_role: 'school_admin', member_role: 'admin', branch: 'sede_sur',
        phone: '+57 310 557 0103', cargo: 'Coordinador Sede Sur',
    },
    {
        key: 'porteria', email: 'porteria@demo-futbol.sportmaps.co', full_name: 'Puesto Sede Norte — Acceso',
        signup_role: 'school_admin', member_role: 'admin', branch: null,
        phone: '+57 310 557 0104', cargo: 'Control de Acceso',
    },
];

export const COACHES = [
    {
        key: 'coach_sub12', email: 'entrenador.sub12@demo-futbol.sportmaps.co', full_name: 'Alberto Quiñones',
        signup_role: 'coach', member_role: 'coach', branch: 'sede_norte',
        specialty: 'Fútbol — formativas', phone: '+57 311 557 0201',
        teams: [{ disciplina: 'sede_norte', cat: 'sub12' }],
    },
    {
        key: 'coach_sub15', email: 'entrenador.sub15@demo-futbol.sportmaps.co', full_name: 'Diego Mosquera',
        signup_role: 'coach', member_role: 'coach', branch: 'sede_norte',
        specialty: 'Fútbol — competitivo', phone: '+57 311 557 0202',
        teams: [{ disciplina: 'sede_norte', cat: 'sub15' }],
    },
];

export const PARENTS = [
    {
        key: 'rvargas', email: 'rvargas@demo-futbol.sportmaps.co', full_name: 'Ricardo Vargas',
        phone: '+57 320 557 0301', cuota_social: 'paid',
        children: [
            {
                key: 'juanjo', full_name: 'Juan José Vargas', age: 12, gender: 'M',
                enrollments: [{ disciplina: 'sede_norte', cat: 'sub12', pay: 'al_dia', method: 'wompi_card' }],
                zk_pin: 3001,
            },
            {
                key: 'emilia', full_name: 'Emilia Vargas', age: 9, gender: 'F',
                enrollments: [{ disciplina: 'sede_norte', cat: 'sub10', pay: 'mora_1', method: null }],
                zk_pin: null,
            },
        ],
    },
    {
        key: 'lcorrea', email: 'lcorrea@demo-futbol.sportmaps.co', full_name: 'Liliana Correa',
        phone: '+57 320 557 0302', cuota_social: 'paid',
        children: [
            {
                key: 'samuel_c', full_name: 'Samuel Correa', age: 14, gender: 'M',
                enrollments: [
                    { disciplina: 'sede_norte', cat: 'sub15', pay: 'al_dia', method: 'wompi_nequi' },
                    { disciplina: 'sede_sur', cat: 'sub14_s', pay: 'mora_1', method: null },
                ],
                zk_pin: 3002,
            },
        ],
    },
];

export const ATHLETES = [
    {
        key: 'fbedoya', email: 'fbedoya@demo-futbol.sportmaps.co', full_name: 'Felipe Bedoya',
        age: 29, gender: 'M', phone: '+57 320 557 0303', cuota_social: 'paid',
        zk_pin: 3003, autopay: true,
        enrollments: [{ disciplina: 'sede_sur', cat: 'mayores', pay: 'al_dia', method: 'wompi_card' }],
    },
    {
        key: 'aguerrero', email: 'aguerrero@demo-futbol.sportmaps.co', full_name: 'Andrés Guerrero',
        age: 33, gender: 'M', phone: '+57 320 557 0304', cuota_social: 'overdue',
        zk_pin: 3004, autopay: false,
        enrollments: [{ disciplina: 'sede_sur', cat: 'mayores', pay: 'mora_2', method: null }],
    },
];

export const EXTERNAL = {
    key: 'mtorres', email: 'mtorres.externo@demo-futbol.sportmaps.co', full_name: 'Mateo Torres',
    age: 22, gender: 'M', phone: '+57 320 557 0305',
};

export const TORNEO = {
    key: 'torneo_futbol',
    title: 'Copa Horizonte — Torneo Formativo Sub-12',
    slug: 'copa-horizonte-torneo-formativo-sub12',
    sport: 'Fútbol',
    price: 85000,
    capacity: 16,
    days_ahead: 18,
    start_time: '07:30',
    end_time: '17:00',
};

export const FILLER_PARENTS = [
    { key: 'fp1', email: 'familia.tabares@demo-futbol.sportmaps.co', full_name: 'Rubén Tabares', phone: '+57 321 557 0401' },
    { key: 'fp2', email: 'familia.mancera@demo-futbol.sportmaps.co', full_name: 'Ángela Mancera', phone: '+57 321 557 0402' },
    { key: 'fp3', email: 'familia.olarte@demo-futbol.sportmaps.co', full_name: 'Fredy Olarte', phone: '+57 321 557 0403' },
    { key: 'fp4', email: 'familia.espinosa@demo-futbol.sportmaps.co', full_name: 'Rocío Espinosa', phone: '+57 321 557 0404' },
    { key: 'fp5', email: 'familia.trujillo@demo-futbol.sportmaps.co', full_name: 'Iván Trujillo', phone: '+57 321 557 0405' },
];

// 24 menores para los 24 cupos de categorías formativas.
export const FILLER_MINORS = [
    'Santiago Tabares', 'Emmanuel Tabares', 'Jacobo Mancera', 'Luciano Mancera',
    'Miguel Ángel Olarte', 'Dylan Olarte', 'Kevin Espinosa', 'Josué Espinosa',
    'Maximiliano Trujillo', 'Alejandro Trujillo', 'Sebastián Cuadros', 'Damián Cuadros',
    'Gabriel Linares', 'Ezequiel Linares', 'Joaquín Pardo', 'Benjamín Pardo',
    'Cristóbal Uribe', 'Salvador Uribe', 'Ignacio Bohórquez', 'Tomás Bohórquez',
    'Martín Salgado', 'Vicente Salgado', 'Antonia Reyes', 'Mariángel Reyes',
];

// 4 adultos para Mayores.
export const FILLER_ADULTS = [
    'Jhon Freddy Ortega', 'César Augusto Peláez', 'Milton Ospina', 'Yeison Cataño',
];

export const TARIFAS = {
    cancha11: { hora: 220000, rental: true },
    sintetica_n: { hora: 130000, rental: true },
    sintetica_s: { hora: 120000, rental: true },
    microfutbol: { hora: 80000, rental: true },
};

export const ARRENDATARIOS = [
    'Colegio Agustiniano Norte', 'Empresa Alpina — torneo interno', 'Liga de Fútbol de Bogotá',
    'Universidad Nacional', 'Conjunto Residencial Alameda', 'Colegio Champagnat',
];

export const DEVICES = [
    {
        key: 'entry', serial_number: 'DEMOFUTB0001', device_name: 'Sede Norte — Entrada',
        direction: 'entry', location: 'Sede Norte', brand: 'ZKTeco',
    },
    {
        key: 'exit', serial_number: 'DEMOFUTB0002', device_name: 'Sede Norte — Salida',
        direction: 'exit', location: 'Sede Norte', brand: 'ZKTeco',
    },
];
