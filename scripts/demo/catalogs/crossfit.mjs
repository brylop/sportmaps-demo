// ============================================================================
// Catálogo demo — Box CrossFit Forja (gimnasio, una sede)
//
// Arquetipo: membresía mensual + clases con cupo + control de acceso. Es el
// único tenant donde la operación NO gira alrededor de categorías por edad,
// sino de franjas horarias: el socio paga su plan y reserva el WOD al que va.
// Por eso es la demo donde Reservas y Acceso son el centro, no un extra.
//
// Las "categorías" acá son PLANES de membresía (ilimitado, 3 días, open box) y
// el único grupo por edad es Kids. Las franjas de WOD viven en `horarios`.
// ============================================================================
export * from './_comun.mjs';
import { IMG } from './_comun.mjs';

export const CLUB = {
    key: 'club',
    name: 'Box CrossFit Forja Demo',
    logo_source: IMG.gimnasio,
    cover_image_url: IMG.gimnasio,
    branding: { primary_color: '#18181b', secondary_color: '#dc2626' },
    slug: 'box-crossfit-forja-demo',
    school_type: 'hybrid',
    business_model: 'both',
    payment_mode: 'aggregator',
    city: 'Bogotá',
    address: 'Calle 93B # 17-25, Bogotá D.C.',
    phone: '+57 601 555 0240',
    email: 'admin@demo-crossfit.sportmaps.co',
    nit: '901.667.240-1',
    cuota_social: 0,
    description:
        'Box de CrossFit con membresías mensuales, clases (WOD) con cupo limitado y reserva '
        + 'previa, sala de halterofilia y control de acceso en puerta. Tenant de DEMOSTRACIÓN.',
};

export const DISCIPLINAS = [
    {
        key: 'box', name: 'Box Principal', sport: 'Gimnasio', img: IMG.gimnasio,
        matricula: 60000, mensualidad: 220000,
        facilities: [
            { key: 'box_wod', name: 'Box principal (WOD)', type: 'Gimnasio', capacity: 18 },
            { key: 'sala_halter', name: 'Sala de halterofilia', type: 'Gimnasio', capacity: 10 },
            { key: 'zona_open', name: 'Zona Open Box', type: 'Gimnasio', capacity: 12 },
            { key: 'sala_movilidad', name: 'Sala de movilidad', type: 'Gimnasio', capacity: 15 },
        ],
        // Planes de membresía, no categorías por edad.
        categorias: [
            { key: 'ilimitado', name: 'Membresía Ilimitada', age: [16, 60], adult: true, fill: 5 },
            { key: 'tres_dias', name: 'Plan 3 días / semana', age: [16, 60], adult: true, fill: 4 },
            { key: 'open_box', name: 'Open Box (entrenamiento libre)', age: [18, 60], adult: true, fill: 3 },
            { key: 'kids', name: 'CrossFit Kids', age: [8, 14], fill: 3 },
        ],
        // Las franjas de WOD. Cada una queda como sesión con cupo, que es lo que
        // el socio reserva desde la app.
        horarios: [
            { cat: 'ilimitado', days: [1, 2, 3, 4, 5], start: '05:30', end: '06:30', facility: 'box_wod' },
            { cat: 'ilimitado', days: [1, 2, 3, 4, 5], start: '06:30', end: '07:30', facility: 'box_wod' },
            { cat: 'tres_dias', days: [1, 3, 5], start: '12:00', end: '13:00', facility: 'box_wod' },
            { cat: 'tres_dias', days: [1, 3, 5], start: '17:00', end: '18:00', facility: 'box_wod' },
            { cat: 'ilimitado', days: [1, 2, 3, 4, 5], start: '18:00', end: '19:00', facility: 'box_wod' },
            { cat: 'open_box', days: [1, 2, 3, 4, 5], start: '19:00', end: '20:30', facility: 'zona_open' },
            { cat: 'kids', days: [2, 4], start: '16:00', end: '17:00', facility: 'sala_movilidad' },
            { cat: 'ilimitado', days: [6], start: '09:00', end: '10:30', facility: 'box_wod' },
        ],
    },
];

export const STAFF = [
    {
        key: 'direccion', email: 'admin@demo-crossfit.sportmaps.co', full_name: 'Julián Restrepo',
        signup_role: 'school', member_role: 'owner', branch: null, is_owner: true,
        phone: '+57 310 559 0101', cargo: 'Head Coach / Propietario',
    },
    {
        key: 'recepcion', email: 'recepcion@demo-crossfit.sportmaps.co', full_name: 'Vanessa Lozano',
        signup_role: 'reporter', member_role: 'reporter', branch: null,
        phone: '+57 310 559 0102', cargo: 'Recepción (solo lectura)',
    },
    {
        key: 'porteria', email: 'puerta@demo-crossfit.sportmaps.co', full_name: 'Torniquete Entrada Principal',
        signup_role: 'school_admin', member_role: 'admin', branch: null,
        phone: '+57 310 559 0103', cargo: 'Control de Acceso',
    },
];

export const COACHES = [
    {
        key: 'coach_wod', email: 'coach.wod@demo-crossfit.sportmaps.co', full_name: 'Mateo Sanabria',
        signup_role: 'coach', member_role: 'coach', branch: 'box',
        specialty: 'CrossFit — WOD y halterofilia', phone: '+57 311 559 0201',
        teams: [{ disciplina: 'box', cat: 'ilimitado' }],
    },
    {
        key: 'coach_kids', email: 'coach.kids@demo-crossfit.sportmaps.co', full_name: 'Tatiana Vergara',
        signup_role: 'coach', member_role: 'coach', branch: 'box',
        specialty: 'CrossFit Kids — movilidad y técnica', phone: '+57 311 559 0202',
        teams: [{ disciplina: 'box', cat: 'kids' }],
    },
];

export const PARENTS = [
    {
        key: 'aparra', email: 'aparra@demo-crossfit.sportmaps.co', full_name: 'Adriana Parra',
        phone: '+57 320 559 0301', cuota_social: 'paid',
        children: [
            {
                key: 'luca', full_name: 'Luca Parra', age: 11, gender: 'M',
                enrollments: [{ disciplina: 'box', cat: 'kids', pay: 'al_dia', method: 'wompi_card' }],
                zk_pin: 5001,
            },
        ],
    },
];

export const ATHLETES = [
    {
        key: 'sgutierrez', email: 'sgutierrez@demo-crossfit.sportmaps.co', full_name: 'Sebastián Gutiérrez',
        age: 30, gender: 'M', phone: '+57 320 559 0302', cuota_social: 'paid',
        zk_pin: 5002, autopay: true,
        enrollments: [{ disciplina: 'box', cat: 'ilimitado', pay: 'al_dia', method: 'wompi_card' }],
    },
    {
        key: 'nmarin', email: 'nmarin@demo-crossfit.sportmaps.co', full_name: 'Natalia Marín',
        age: 26, gender: 'F', phone: '+57 320 559 0303', cuota_social: 'paid',
        zk_pin: 5003, autopay: false,
        enrollments: [{ disciplina: 'box', cat: 'tres_dias', pay: 'al_dia', method: 'wompi_nequi' }],
    },
    {
        key: 'rcastillo', email: 'rcastillo@demo-crossfit.sportmaps.co', full_name: 'Ricardo Castillo',
        age: 38, gender: 'M', phone: '+57 320 559 0304', cuota_social: 'overdue',
        zk_pin: 5004, autopay: false,
        enrollments: [{ disciplina: 'box', cat: 'ilimitado', pay: 'mora_2', method: null }],
    },
];

export const EXTERNAL = {
    key: 'jcamargo', email: 'jcamargo.externo@demo-crossfit.sportmaps.co', full_name: 'Jonathan Camargo',
    age: 28, gender: 'M', phone: '+57 320 559 0305',
};

export const TORNEO = {
    key: 'torneo_crossfit',
    title: 'Forja Games — Competencia Interna de CrossFit',
    slug: 'forja-games-competencia-interna-crossfit',
    sport: 'Gimnasio',
    price: 110000,
    capacity: 40,
    days_ahead: 15,
    start_time: '08:00',
    end_time: '16:00',
};

export const FILLER_PARENTS = [
    { key: 'fp1', email: 'familia.roa@demo-crossfit.sportmaps.co', full_name: 'Sandra Roa', phone: '+57 321 559 0401' },
    { key: 'fp2', email: 'familia.melo@demo-crossfit.sportmaps.co', full_name: 'Julio Melo', phone: '+57 321 559 0402' },
];

// 3 menores para CrossFit Kids.
export const FILLER_MINORS = [
    'Emilia Roa', 'Simón Melo', 'Alicia Vanegas',
];

// 12 adultos: el grueso del box.
export const FILLER_ADULTS = [
    'Camilo Andrés Rincón', 'Laura Sofía Beltrán', 'Mauricio Salas', 'Andrea Carolina Nova',
    'Juan Manuel Prieto', 'Diana Katherine Ruge', 'Esteban Camacho', 'Paula Andrea Delgado',
    'Nicolás Herrera', 'Verónica Lamprea', 'Santiago Bermúdez', 'Ana María Cubillos',
];

export const TARIFAS = {
    box_wod: { hora: 0, rental: false },        // uso de socios, no se alquila
    sala_halter: { hora: 55000, rental: true },  // sesión de halterofilia por hora
    zona_open: { hora: 35000, rental: true },    // pase de día para visitantes
    sala_movilidad: { hora: 45000, rental: true },
};

export const ARRENDATARIOS = [
    'Empresa Rappi — bienestar corporativo', 'Selección de rugby Bogotá',
    'Colegio Gimnasio Moderno — preparación física', 'Grupo Éxito — jornada de salud',
    'Bomberos Bogotá — entrenamiento funcional',
];

export const DEVICES = [
    {
        key: 'entry', serial_number: 'DEMOCROS0001', device_name: 'Entrada Principal — Torniquete',
        direction: 'entry', location: 'Recepción', brand: 'ZKTeco',
    },
    {
        key: 'exit', serial_number: 'DEMOCROS0002', device_name: 'Salida — Torniquete',
        direction: 'exit', location: 'Recepción', brand: 'ZKTeco',
    },
];
