// ============================================================================
// Catálogo demo — Club Voleibol Altura (voleibol, dos sedes)
//
// Arquetipo: el caso Dynasty. Club de voleibol con muchas familias, categorías
// por edad, cartera con mora real y recordatorios. Es la demo que se le muestra
// a un club que hoy lleva la cartera en Excel.
//
// school_type='hybrid' a propósito: 'academy' deja has_reservations en false
// (la vista lo deriva del tipo, no del plan), y sin eso el módulo de Reservas
// no se ve. Ver 20260813170814_mapeo_school_type_a_modulos.sql.
// ============================================================================
export * from './_comun.mjs';
import { IMG } from './_comun.mjs';

export const CLUB = {
    key: 'club',
    name: 'Club Voleibol Altura Demo',
    logo_source: IMG.voleibol,
    cover_image_url: IMG.voleibol,
    branding: { primary_color: '#1d4ed8', secondary_color: '#f59e0b' },
    slug: 'club-voleibol-altura-demo',
    school_type: 'hybrid',
    business_model: 'both',
    payment_mode: 'aggregator',
    city: 'Bogotá',
    address: 'Calle 134 # 45-20, Bogotá D.C.',
    phone: '+57 601 555 0210',
    email: 'direccion@demo-voleibol.sportmaps.co',
    nit: '901.221.334-2',
    cuota_social: 0,
    description:
        'Club de voleibol formativo y competitivo con dos sedes, categorías desde mini-voleibol '
        + 'hasta mayores y equipos en liga departamental. Tenant de DEMOSTRACIÓN.',
};

// ── Sedes ───────────────────────────────────────────────────────────────────
export const DISCIPLINAS = [
    {
        key: 'chapinero', name: 'Sede Chapinero', sport: 'Voleibol', img: IMG.voleibol,
        matricula: 90000, mensualidad: 145000,
        facilities: [
            { key: 'coliseo_a', name: 'Coliseo A', type: 'Cancha de Voleibol', capacity: 40 },
            { key: 'coliseo_b', name: 'Coliseo B', type: 'Cancha de Voleibol', capacity: 40 },
        ],
        categorias: [
            { key: 'mini', name: 'Mini Voleibol', age: [7, 9], fill: 3 },
            { key: 'sub12', name: 'Sub-12', age: [10, 12], fill: 4 },
            { key: 'sub14', name: 'Sub-14', age: [13, 14], fill: 4 },
            { key: 'sub17', name: 'Sub-17', age: [15, 17], fill: 4 },
            { key: 'mayores', name: 'Mayores', age: [18, 40], adult: true, fill: 3 },
        ],
        horarios: [
            { cat: 'mini', days: [2, 4], start: '15:00', end: '16:30', facility: 'coliseo_a' },
            { cat: 'sub12', days: [1, 3, 5], start: '16:00', end: '17:30', facility: 'coliseo_a' },
            { cat: 'sub14', days: [1, 3, 5], start: '17:30', end: '19:00', facility: 'coliseo_b' },
            { cat: 'sub17', days: [2, 4, 6], start: '18:00', end: '20:00', facility: 'coliseo_b' },
            { cat: 'mayores', days: [2, 4], start: '20:00', end: '21:30', facility: 'coliseo_a' },
        ],
    },
    {
        key: 'norte', name: 'Sede Norte', sport: 'Voleibol', img: IMG.voleibol,
        matricula: 90000, mensualidad: 135000,
        facilities: [
            { key: 'cancha_norte', name: 'Cancha cubierta Norte', type: 'Cancha de Voleibol', capacity: 30 },
            { key: 'arena', name: 'Cancha de arena', type: 'Cancha de Voleibol', capacity: 16 },
        ],
        categorias: [
            { key: 'sub12_n', name: 'Sub-12 Norte', age: [10, 12], fill: 3 },
            { key: 'sub17_n', name: 'Sub-17 Norte', age: [15, 17], fill: 3 },
            { key: 'playa', name: 'Voleibol Playa', age: [16, 45], adult: true, fill: 3 },
        ],
        horarios: [
            { cat: 'sub12_n', days: [2, 4], start: '16:00', end: '17:30', facility: 'cancha_norte' },
            { cat: 'sub17_n', days: [1, 3], start: '17:30', end: '19:30', facility: 'cancha_norte' },
            { cat: 'playa', days: [6], start: '09:00', end: '11:00', facility: 'arena' },
        ],
    },
];

// ── Staff ───────────────────────────────────────────────────────────────────
export const STAFF = [
    {
        key: 'direccion', email: 'direccion@demo-voleibol.sportmaps.co', full_name: 'Marcela Ospina',
        signup_role: 'school', member_role: 'owner', branch: null, is_owner: true,
        phone: '+57 310 556 0101', cargo: 'Dirección General',
    },
    {
        key: 'cartera', email: 'cartera@demo-voleibol.sportmaps.co', full_name: 'Néstor Cifuentes',
        signup_role: 'reporter', member_role: 'reporter', branch: null,
        phone: '+57 310 556 0102', cargo: 'Cartera (solo lectura)',
    },
    {
        key: 'coord_norte', email: 'norte@demo-voleibol.sportmaps.co', full_name: 'Angélica Ramírez',
        signup_role: 'school_admin', member_role: 'admin', branch: 'norte',
        phone: '+57 310 556 0103', cargo: 'Coordinadora Sede Norte',
    },
    {
        key: 'porteria', email: 'porteria@demo-voleibol.sportmaps.co', full_name: 'Puesto Coliseo — Acceso',
        signup_role: 'school_admin', member_role: 'admin', branch: null,
        phone: '+57 310 556 0104', cargo: 'Control de Acceso',
    },
];

export const COACHES = [
    {
        key: 'coach_sub14', email: 'entrenador.sub14@demo-voleibol.sportmaps.co', full_name: 'Iván Betancur',
        signup_role: 'coach', member_role: 'coach', branch: 'chapinero',
        specialty: 'Voleibol — formativas', phone: '+57 311 556 0201',
        teams: [{ disciplina: 'chapinero', cat: 'sub14' }],
    },
    {
        key: 'coach_sub17', email: 'entrenadora.sub17@demo-voleibol.sportmaps.co', full_name: 'Karen Villalobos',
        signup_role: 'coach', member_role: 'coach', branch: 'chapinero',
        specialty: 'Voleibol — competitivo', phone: '+57 311 556 0202',
        teams: [{ disciplina: 'chapinero', cat: 'sub17' }],
    },
];

// ── Familias y deportistas nominales ────────────────────────────────────────
export const PARENTS = [
    {
        key: 'pgomez', email: 'pgomez@demo-voleibol.sportmaps.co', full_name: 'Patricia Gómez',
        phone: '+57 320 556 0301', cuota_social: 'paid',
        children: [
            {
                key: 'lucia', full_name: 'Lucía Gómez', age: 13, gender: 'F',
                enrollments: [{ disciplina: 'chapinero', cat: 'sub14', pay: 'al_dia', method: 'wompi_card' }],
                zk_pin: 2001,
            },
            {
                key: 'martin_g', full_name: 'Martín Gómez', age: 11, gender: 'M',
                enrollments: [{ disciplina: 'chapinero', cat: 'sub12', pay: 'mora_1', method: null }],
                zk_pin: null,
            },
        ],
    },
    {
        key: 'jarias', email: 'jarias@demo-voleibol.sportmaps.co', full_name: 'Jaime Arias',
        phone: '+57 320 556 0302', cuota_social: 'paid',
        children: [
            {
                key: 'daniela', full_name: 'Daniela Arias', age: 16, gender: 'F',
                enrollments: [
                    { disciplina: 'chapinero', cat: 'sub17', pay: 'al_dia', method: 'wompi_nequi' },
                    { disciplina: 'norte', cat: 'playa', pay: 'al_dia', method: 'transfer_ocr' },
                ],
                zk_pin: 2002,
            },
        ],
    },
];

export const ATHLETES = [
    {
        key: 'crestrepo', email: 'crestrepo@demo-voleibol.sportmaps.co', full_name: 'Carolina Restrepo',
        age: 27, gender: 'F', phone: '+57 320 556 0303', cuota_social: 'paid',
        zk_pin: 2003, autopay: true,
        enrollments: [{ disciplina: 'chapinero', cat: 'mayores', pay: 'al_dia', method: 'wompi_card' }],
    },
    {
        key: 'jmurillo', email: 'jmurillo@demo-voleibol.sportmaps.co', full_name: 'Julián Murillo',
        age: 31, gender: 'M', phone: '+57 320 556 0304', cuota_social: 'overdue',
        zk_pin: 2004, autopay: false,
        enrollments: [{ disciplina: 'norte', cat: 'playa', pay: 'mora_2', method: null }],
    },
];

export const EXTERNAL = {
    key: 'lmoreno', email: 'lmoreno.externa@demo-voleibol.sportmaps.co', full_name: 'Laura Moreno',
    age: 24, gender: 'F', phone: '+57 320 556 0305',
};

export const TORNEO = {
    key: 'torneo_voley',
    title: 'Copa Altura — Torneo Interclubes de Voleibol',
    slug: 'copa-altura-torneo-interclubes-voleibol',
    sport: 'Voleibol',
    price: 120000,
    capacity: 24,
    days_ahead: 21,
    start_time: '08:00',
    end_time: '19:00',
};

// ── Relleno ─────────────────────────────────────────────────────────────────
export const FILLER_PARENTS = [
    { key: 'fp1', email: 'familia.nino@demo-voleibol.sportmaps.co', full_name: 'Gloria Niño', phone: '+57 321 556 0401' },
    { key: 'fp2', email: 'familia.pulido@demo-voleibol.sportmaps.co', full_name: 'Ramiro Pulido', phone: '+57 321 556 0402' },
    { key: 'fp3', email: 'familia.suarez@demo-voleibol.sportmaps.co', full_name: 'Yolanda Suárez', phone: '+57 321 556 0403' },
    { key: 'fp4', email: 'familia.avila@demo-voleibol.sportmaps.co', full_name: 'Édgar Ávila', phone: '+57 321 556 0404' },
    { key: 'fp5', email: 'familia.barrera@demo-voleibol.sportmaps.co', full_name: 'Nubia Barrera', phone: '+57 321 556 0405' },
];

// 21 menores para 21 cupos de categorías infantiles/juveniles.
export const FILLER_MINORS = [
    'Sara Niño', 'Emilio Niño', 'Valentina Pulido', 'Juan David Pulido',
    'Mariana Suárez', 'Samuel Suárez', 'Antonia Ávila', 'Jerónimo Ávila',
    'Isabella Barrera', 'Simón Barrera', 'Paulina Cortés', 'Máximo Cortés',
    'Salomé Ferrer', 'Alejandro Ferrer', 'Amelia Godoy', 'Bruno Godoy',
    'Catalina Hoyos', 'Facundo Hoyos', 'Elena Ibáñez', 'Thiago Ibáñez',
    'Rafaela Jurado',
];

// 9 adultos para mayores + playa.
export const FILLER_ADULTS = [
    'Andrés Camilo Rueda', 'Diana Marcela Pinzón', 'Óscar Leonardo Fajardo',
    'Tatiana Mejía', 'Wilson Cárdenas', 'Lorena Estupiñán',
    'Fabián Duarte', 'Carolina Sandoval', 'Néstor Salamanca',
];

// ── Reservas ────────────────────────────────────────────────────────────────
export const TARIFAS = {
    coliseo_a: { hora: 110000, rental: true },
    coliseo_b: { hora: 110000, rental: true },
    cancha_norte: { hora: 95000, rental: true },
    arena: { hora: 70000, rental: true },
};

export const ARRENDATARIOS = [
    'Colegio Nueva Granada', 'Liga de Voleibol de Bogotá', 'Empresa Sura — torneo interno',
    'Universidad Javeriana', 'Colegio Los Nogales', 'Caja de compensación Compensar',
];

// ── Acceso ──────────────────────────────────────────────────────────────────
export const DEVICES = [
    {
        key: 'entry', serial_number: 'DEMOVOLE0001', device_name: 'Coliseo Chapinero — Entrada',
        direction: 'entry', location: 'Coliseo Chapinero', brand: 'ZKTeco',
    },
    {
        key: 'exit', serial_number: 'DEMOVOLE0002', device_name: 'Coliseo Chapinero — Salida',
        direction: 'exit', location: 'Coliseo Chapinero', brand: 'ZKTeco',
    },
];
