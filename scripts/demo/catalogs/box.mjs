// ============================================================================
// Catálogo demo — Escuela de Boxeo Titanes (boxeo, una sede)
//
// Arquetipo: escuela de combate. Grupos por nivel (no por edad), mezcla de
// menores y adultos en el mismo gimnasio, y una franja de "boxeo fitness" que
// es la que paga las cuentas. Muestra bien el caso de una escuela de barrio
// que factura en efectivo y quiere ordenarse.
//
// Nota: boxeo no tiene foto verificada en sportImages.ts — usa la de gimnasio.
// ============================================================================
export * from './_comun.mjs';
import { IMG } from './_comun.mjs';

export const CLUB = {
    key: 'club',
    name: 'Escuela de Boxeo Titanes Demo',
    logo_source: IMG.gimnasio,
    cover_image_url: IMG.gimnasio,
    branding: { primary_color: '#7f1d1d', secondary_color: '#facc15' },
    slug: 'escuela-boxeo-titanes-demo',
    school_type: 'hybrid',
    business_model: 'both',
    payment_mode: 'aggregator',
    city: 'Bogotá',
    address: 'Carrera 24 # 63-40, Barrio Siete de Agosto, Bogotá D.C.',
    phone: '+57 601 555 0250',
    email: 'direccion@demo-box.sportmaps.co',
    nit: '901.778.315-6',
    cuota_social: 0,
    description:
        'Escuela de boxeo con grupos por nivel, categorías amateur federadas y clases de boxeo '
        + 'fitness para adultos. Dos rings y zona de sacos. Tenant de DEMOSTRACIÓN.',
};

export const DISCIPLINAS = [
    {
        key: 'gimnasio', name: 'Gimnasio Titanes', sport: 'Boxeo', img: IMG.gimnasio,
        matricula: 50000, mensualidad: 120000,
        facilities: [
            { key: 'ring_a', name: 'Ring principal', type: 'Gimnasio', capacity: 12 },
            { key: 'ring_b', name: 'Ring secundario', type: 'Gimnasio', capacity: 10 },
            { key: 'zona_sacos', name: 'Zona de sacos', type: 'Gimnasio', capacity: 20 },
        ],
        categorias: [
            { key: 'iniciacion', name: 'Iniciación', age: [8, 12], fill: 3 },
            { key: 'juvenil', name: 'Juvenil', age: [13, 17], fill: 4 },
            { key: 'amateur', name: 'Amateur Competitivo', age: [16, 30], adult: true, fill: 3 },
            { key: 'fitness', name: 'Boxeo Fitness', age: [18, 55], adult: true, fill: 5 },
        ],
        horarios: [
            { cat: 'iniciacion', days: [2, 4], start: '15:00', end: '16:00', facility: 'zona_sacos' },
            { cat: 'juvenil', days: [1, 3, 5], start: '16:00', end: '17:30', facility: 'ring_b' },
            { cat: 'amateur', days: [1, 2, 3, 4, 5], start: '17:30', end: '19:30', facility: 'ring_a' },
            { cat: 'fitness', days: [1, 3, 5], start: '19:30', end: '20:30', facility: 'zona_sacos' },
            { cat: 'fitness', days: [6], start: '08:00', end: '09:00', facility: 'zona_sacos' },
        ],
    },
];

export const STAFF = [
    {
        key: 'direccion', email: 'direccion@demo-box.sportmaps.co', full_name: 'Jairo "Titán" Mosquera',
        signup_role: 'school', member_role: 'owner', branch: null, is_owner: true,
        phone: '+57 310 560 0101', cargo: 'Entrenador Principal / Propietario',
    },
    {
        key: 'admin', email: 'administracion@demo-box.sportmaps.co', full_name: 'Luz Dary Contreras',
        signup_role: 'reporter', member_role: 'reporter', branch: null,
        phone: '+57 310 560 0102', cargo: 'Administración (solo lectura)',
    },
    {
        key: 'porteria', email: 'entrada@demo-box.sportmaps.co', full_name: 'Entrada Gimnasio',
        signup_role: 'school_admin', member_role: 'admin', branch: null,
        phone: '+57 310 560 0103', cargo: 'Control de Acceso',
    },
];

export const COACHES = [
    {
        key: 'coach_juvenil', email: 'entrenador.juvenil@demo-box.sportmaps.co', full_name: 'Édinson Palomino',
        signup_role: 'coach', member_role: 'coach', branch: 'gimnasio',
        specialty: 'Boxeo — formativas', phone: '+57 311 560 0201',
        teams: [{ disciplina: 'gimnasio', cat: 'juvenil' }],
    },
    {
        key: 'coach_amateur', email: 'entrenador.amateur@demo-box.sportmaps.co', full_name: 'Ronald Cuesta',
        signup_role: 'coach', member_role: 'coach', branch: 'gimnasio',
        specialty: 'Boxeo — amateur federado', phone: '+57 311 560 0202',
        teams: [{ disciplina: 'gimnasio', cat: 'amateur' }],
    },
];

export const PARENTS = [
    {
        key: 'ycardenas', email: 'ycardenas@demo-box.sportmaps.co', full_name: 'Yolanda Cárdenas',
        phone: '+57 320 560 0301', cuota_social: 'paid',
        children: [
            {
                key: 'brayan', full_name: 'Brayan Cárdenas', age: 15, gender: 'M',
                enrollments: [{ disciplina: 'gimnasio', cat: 'juvenil', pay: 'al_dia', method: 'cash' }],
                zk_pin: 6001,
            },
            {
                key: 'karol', full_name: 'Karol Cárdenas', age: 11, gender: 'F',
                enrollments: [{ disciplina: 'gimnasio', cat: 'iniciacion', pay: 'mora_1', method: null }],
                zk_pin: null,
            },
        ],
    },
];

export const ATHLETES = [
    {
        key: 'dmontoya', email: 'dmontoya@demo-box.sportmaps.co', full_name: 'Duván Montoya',
        age: 22, gender: 'M', phone: '+57 320 560 0302', cuota_social: 'paid',
        zk_pin: 6002, autopay: true,
        enrollments: [{ disciplina: 'gimnasio', cat: 'amateur', pay: 'al_dia', method: 'wompi_nequi' }],
    },
    {
        key: 'lgaleano', email: 'lgaleano@demo-box.sportmaps.co', full_name: 'Lorena Galeano',
        age: 34, gender: 'F', phone: '+57 320 560 0303', cuota_social: 'paid',
        zk_pin: 6003, autopay: false,
        enrollments: [{ disciplina: 'gimnasio', cat: 'fitness', pay: 'al_dia', method: 'transfer_ocr' }],
    },
    {
        key: 'jsierra', email: 'jsierra@demo-box.sportmaps.co', full_name: 'Jhon Sierra',
        age: 27, gender: 'M', phone: '+57 320 560 0304', cuota_social: 'overdue',
        zk_pin: 6004, autopay: false,
        enrollments: [{ disciplina: 'gimnasio', cat: 'fitness', pay: 'mora_2', method: null }],
    },
];

export const EXTERNAL = {
    key: 'wcaicedo', email: 'wcaicedo.externo@demo-box.sportmaps.co', full_name: 'Wilmer Caicedo',
    age: 24, gender: 'M', phone: '+57 320 560 0305',
};

export const TORNEO = {
    key: 'torneo_box',
    title: 'Velada Titanes — Boxeo Amateur',
    slug: 'velada-titanes-boxeo-amateur',
    sport: 'Boxeo',
    price: 45000,
    capacity: 20,
    days_ahead: 12,
    start_time: '18:00',
    end_time: '22:00',
};

export const FILLER_PARENTS = [
    { key: 'fp1', email: 'familia.torres@demo-box.sportmaps.co', full_name: 'Blanca Torres', phone: '+57 321 560 0401' },
    { key: 'fp2', email: 'familia.usma@demo-box.sportmaps.co', full_name: 'Hernando Usma', phone: '+57 321 560 0402' },
    { key: 'fp3', email: 'familia.quiroga@demo-box.sportmaps.co', full_name: 'Alba Quiroga', phone: '+57 321 560 0403' },
];

// 7 menores para iniciación + juvenil.
export const FILLER_MINORS = [
    'Kevin Torres', 'Estefanía Torres', 'Anderson Usma', 'Michel Usma',
    'Cristian Quiroga', 'Dayana Quiroga', 'Bryan Zambrano',
];

// 8 adultos para amateur + fitness.
export const FILLER_ADULTS = [
    'Yeison Andrés Mora', 'Katherine Lizarazo', 'Óscar Julián Vera', 'Sandra Milena Pinto',
    'Fabián Alexis Rojas', 'Marcela Zapata', 'Deiby Hernández', 'Ingrid Peláez',
];

export const TARIFAS = {
    ring_a: { hora: 70000, rental: true },
    ring_b: { hora: 50000, rental: true },
    zona_sacos: { hora: 40000, rental: true },
};

export const ARRENDATARIOS = [
    'Liga de Boxeo de Bogotá', 'Club Guerreros MMA', 'Colegio Distrital Manuela Beltrán',
    'Productora audiovisual — grabación', 'Empresa Claro — jornada de bienestar',
];

export const DEVICES = [
    {
        key: 'entry', serial_number: 'DEMOBOXE0001', device_name: 'Gimnasio Titanes — Entrada',
        direction: 'entry', location: 'Entrada Principal', brand: 'ZKTeco',
    },
    {
        key: 'exit', serial_number: 'DEMOBOXE0002', device_name: 'Gimnasio Titanes — Salida',
        direction: 'exit', location: 'Entrada Principal', brand: 'ZKTeco',
    },
];
