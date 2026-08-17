#!/usr/bin/env node
// ============================================================================
// CAR-1 + CAR-2 — Dejar a Club Carmel listo para el trial
//
// Qué hace, sobre una escuela YA CREADA por el onboarding normal:
//   1. school_type = 'hybrid'      → prende Academia Y Reservas a la vez
//   2. billing_enabled = false     → no cobra mensualidades por SportMaps
//   3. account_type = 'real'       → es cliente, entra al régimen de trial
//   4. sport_configs de sus 8 disciplinas, con el eje correcto por deporte
//   5. Instalaciones, con los carriles de piscina como facilities sueltas
//
// El alta NO se hace acá a propósito: que la escuela y el usuario dueño nazcan
// por el onboarding normal es lo que garantiza que el dueño reciba sus
// credenciales, que el trigger le cree la suscripción y que quede igual que
// cualquier cliente. Este script solo configura lo que el onboarding no pregunta.
//
// Uso:
//   node scripts/carmel-configurar.mjs --school-id=<uuid>            # ensayo
//   node scripts/carmel-configurar.mjs --school-id=<uuid> --apply    # escribe
//
// Requiere aplicadas: 20260815141039 (billing_enabled) y 20260813170814
// (mapeo school_type → módulos).
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const SCHOOL_ID = (argv.find((a) => a.startsWith('--school-id=')) || '').split('=')[1];

if (!SCHOOL_ID) {
    console.error('Falta --school-id=<uuid>.');
    console.error('Sale de: SELECT id, name FROM schools WHERE name ILIKE \'%carmel%\';');
    process.exit(1);
}

const { url, H, all } = conectar();

// ── Las 8 disciplinas, con el eje que le corresponde a cada una ─────────────
//
// El eje NO es cosmético: define cómo el producto agrupa a los deportistas.
// Y cada uno exige una forma distinta en `rules` — lo valida el trigger
// `trg_validate_sport_config_rules` (mig 20260310000001):
//
//     age   → { name, min, max }              (NO min_age/max_age)
//     level → { name, min_rating, max_rating }
//     none  → rules VACÍO (con elementos, revienta)
//
// Golf va por nivel porque se agrupa por hándicap, no por edad. Gimnasio no
// tiene categorías. Esto es lo primero que hay que revisar con ellos.
const DISCIPLINAS = [
    {
        sport: 'futbol', nombre: 'Fútbol', eje: 'age',
        categorias: [
            { name: 'Sub-8', min: 6, max: 8 }, { name: 'Sub-10', min: 9, max: 10 },
            { name: 'Sub-12', min: 11, max: 12 }, { name: 'Sub-15', min: 13, max: 15 },
            { name: 'Sub-17', min: 16, max: 17 }, { name: 'Mayores', min: 18, max: 50 },
        ],
        instalaciones: [
            { name: 'Cancha de fútbol 11', type: 'Cancha de Fútbol', capacity: 60, hora: 240000, rental: true },
            { name: 'Cancha de fútbol 8', type: 'Cancha de Fútbol', capacity: 30, hora: 140000, rental: true },
        ],
    },
    {
        sport: 'voleibol', nombre: 'Voleibol', eje: 'age',
        categorias: [
            { name: 'Infantil', min: 8, max: 12 }, { name: 'Juvenil', min: 13, max: 17 },
            { name: 'Mayores', min: 18, max: 50 },
        ],
        instalaciones: [{ name: 'Cancha de voleibol', type: 'Cancha de Voleibol', capacity: 24, hora: 90000, rental: true }],
    },
    {
        sport: 'baloncesto', nombre: 'Baloncesto', eje: 'age',
        categorias: [
            { name: 'Infantil', min: 8, max: 12 }, { name: 'Juvenil', min: 13, max: 17 },
            { name: 'Mayores', min: 18, max: 50 },
        ],
        instalaciones: [{ name: 'Cancha de baloncesto', type: 'Cancha de Baloncesto', capacity: 24, hora: 90000, rental: true }],
    },
    {
        sport: 'tenis', nombre: 'Tenis', eje: 'age',
        categorias: [
            { name: 'Escuela Formativa', min: 6, max: 12 }, { name: 'Juvenil', min: 13, max: 17 },
            { name: 'Adultos', min: 18, max: 70 },
        ],
        instalaciones: [
            { name: 'Cancha de tenis 1', type: 'Cancha de Tenis', capacity: 6, hora: 60000, rental: true },
            { name: 'Cancha de tenis 2', type: 'Cancha de Tenis', capacity: 6, hora: 60000, rental: true },
        ],
    },
    {
        sport: 'padel', nombre: 'Pádel', eje: 'level',
        categorias: [
            { name: 'Recreativo', min_rating: 1, max_rating: 3 },
            { name: 'Intermedio', min_rating: 4, max_rating: 6 },
            { name: 'Competitivo', min_rating: 7, max_rating: 10 },
        ],
        instalaciones: [
            { name: 'Cancha de pádel 1', type: 'Cancha de Pádel', capacity: 8, hora: 80000, rental: true },
            { name: 'Cancha de pádel 2', type: 'Cancha de Pádel', capacity: 8, hora: 80000, rental: true },
        ],
    },
    {
        sport: 'golf', nombre: 'Golf', eje: 'level',
        categorias: [
            { name: 'Iniciación', min_rating: 1, max_rating: 3 },
            { name: 'Intermedio', min_rating: 4, max_rating: 7 },
            { name: 'Alto Rendimiento', min_rating: 8, max_rating: 10 },
        ],
        instalaciones: [
            { name: 'Campo de golf', type: 'Campo de Golf', capacity: 72, hora: 180000, rental: true },
            { name: 'Tee de práctica', type: 'Campo de Golf', capacity: 20, hora: 45000, rental: false },
        ],
    },
    {
        sport: 'natacion', nombre: 'Natación', eje: 'age',
        categorias: [
            { name: 'Infantil', min: 4, max: 8 }, { name: 'Formativo', min: 9, max: 14 },
            { name: 'Competitivo', min: 12, max: 22 }, { name: 'Adultos', min: 18, max: 70 },
        ],
        // Los CARRILES van como instalaciones sueltas (decisión del plan §5):
        // hoy no existen sub-unidades, así que "carril 3 de 6" solo se puede
        // expresar así. Contrapartida conocida: nada impide reservar la piscina
        // completa y un carril a la vez — se mitiga con el nombre y avisando en
        // la inducción, no con código. Si molesta, se construye facility_units.
        instalaciones: [
            { name: 'Piscina completa (bloquea carriles)', type: 'Piscina', capacity: 48, hora: 150000, rental: true },
            ...Array.from({ length: 6 }, (_, i) => ({
                name: `Piscina — Carril ${i + 1}`, type: 'Piscina', capacity: 8, hora: 35000, rental: true,
            })),
        ],
    },
    {
        sport: 'gimnasio', nombre: 'Gimnasio', eje: 'none',
        categorias: [],   // axis='none' NO admite reglas: el trigger lo rechaza
        instalaciones: [
            { name: 'Sala de máquinas', type: 'Gimnasio', capacity: 40, hora: 0, rental: false },
            { name: 'Salón de clases dirigidas', type: 'Gimnasio', capacity: 25, hora: 60000, rental: true },
        ],
    },
];

// ── Comprobaciones previas ──────────────────────────────────────────────────
const escuelas = await all('schools', 'id,name,school_type,account_type', { order: 'id' });
const esc = escuelas.find((s) => s.id === SCHOOL_ID);
if (!esc) { console.error(`No existe la escuela ${SCHOOL_ID}.`); process.exit(1); }

const ents = await (await fetch(`${url}/rest/v1/v_school_entitlements?select=*&school_id=eq.${SCHOOL_ID}`, { headers: H })).json();
const ent = ents[0] || {};
if (!('has_billing' in ent)) {
    console.error('La vista no expone has_billing: falta aplicar 20260815141039_billing_enabled_por_escuela.sql');
    process.exit(1);
}

// Seguro contra el school_id equivocado: este script marca la escuela como
// `real` y le apaga los cobros. Apuntado sin querer a una demo o a una cuenta
// de pruebas, la convierte en cliente y le corta la cartera. Lo detectó el
// propio ensayo cuando se probó contra Club Campestre Demo.
if (esc.account_type !== 'real' && !argv.includes('--force')) {
    console.error(`⛔ "${esc.name}" es account_type='${esc.account_type}', no un cliente real.`);
    console.error('   Este script la marcaría como real y le apagaría los cobros.');
    console.error('   Si de verdad es lo que quieres, agrega --force.');
    process.exit(1);
}

const scfg = await all('sport_configs', 'school_id,sport', { order: 'sport' });
const yaTiene = new Set(scfg.filter((x) => x.school_id === SCHOOL_ID).map((x) => x.sport));
const facs = await all('facilities', 'school_id,name', { order: 'id' });
const yaFac = new Set(facs.filter((f) => f.school_id === SCHOOL_ID).map((f) => f.name));

console.log(`${APPLY ? 'APLICANDO' : 'ENSAYO — usa --apply para escribir'}\n`);
console.log(`${esc.name}  ·  ${SCHOOL_ID}`);
console.log(`  school_type   ${esc.school_type}  →  hybrid       ${esc.school_type === 'hybrid' ? '(ya está)' : ''}`);
console.log(`  account_type  ${esc.account_type}  →  real          ${esc.account_type === 'real' ? '(ya está)' : ''}`);
console.log(`  cobros        ${ent.has_billing ? 'ACTIVOS' : 'apagados'}  →  apagados  ${ent.has_billing === false ? '(ya está)' : ''}`);
console.log(`  reservas      ${ent.has_reservations ? 'sí' : 'NO'} · academia ${ent.has_academy ? 'sí' : 'NO'}   (se resuelven con school_type)\n`);

const nuevasCfg = DISCIPLINAS.filter((d) => !yaTiene.has(d.sport));
const nuevasFac = DISCIPLINAS.flatMap((d) => d.instalaciones.filter((f) => !yaFac.has(f.name)).map((f) => ({ ...f, sport: d.sport })));

console.log('Disciplinas:');
for (const d of DISCIPLINAS) {
    const marca = yaTiene.has(d.sport) ? 'ya existe' : (APPLY ? 'crear' : '[dry] crear');
    console.log(`  ${d.sport.padEnd(11)} eje ${d.eje.padEnd(5)} · ${String(d.categorias.length).padStart(2)} categorías · ${String(d.instalaciones.length).padStart(2)} instalaciones · ${marca}`);
}
console.log(`\nInstalaciones nuevas: ${nuevasFac.length} (incluye ${DISCIPLINAS.find((d) => d.sport === 'natacion').instalaciones.length - 1} carriles de piscina)`);

if (!APPLY) {
    console.log('\nNada escrito.');
    console.log(`Faltaría crear: ${nuevasCfg.length} sport_configs y ${nuevasFac.length} instalaciones.`);
    process.exit(0);
}

// ── 1. Tipo de escuela y tipo de cuenta ─────────────────────────────────────
const patch = async (path, body) => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
    });
    if (!r.ok) { console.error(`✗ ${path}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
};
await patch(`schools?id=eq.${SCHOOL_ID}`, { school_type: 'hybrid', account_type: 'real', updated_at: new Date().toISOString() });
console.log('✓ schools · school_type=hybrid · account_type=real');

// ── 2. Cobros apagados ──────────────────────────────────────────────────────
// Se escribe la columna directamente: la RPC admin_set_billing_enabled exige
// is_super_admin() y con la service key auth.uid() es NULL. El trigger
// enforce_billing_disabled se encarga de apagar los tres sub-toggles.
await patch(`school_settings?school_id=eq.${SCHOOL_ID}`, { billing_enabled: false, updated_at: new Date().toISOString() });
console.log('✓ school_settings · billing_enabled=false (el trigger apaga cobro automático, mora y recordatorios)');

// ── 3. sport_configs ────────────────────────────────────────────────────────
if (nuevasCfg.length) {
    const filas = nuevasCfg.map((d) => ({
        school_id: SCHOOL_ID, sport: d.sport, categorization_axis: d.eje,
        rules: d.eje === 'none' ? [] : d.categorias,
        settings: { display_name: d.nombre, seeded_by: 'CAR-1' }, is_active: true,
    }));
    const r = await fetch(`${url}/rest/v1/sport_configs`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(filas),
    });
    if (!r.ok) { console.error(`✗ sport_configs: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
    console.log(`✓ sport_configs · ${JSON.parse(await r.text()).length} disciplinas`);
}

// ── 4. Instalaciones ────────────────────────────────────────────────────────
if (nuevasFac.length) {
    // Nombres de columna verificados contra la tabla real: es `type` (no
    // facility_type), `rental_enabled` (no is_rentable) y `status='available'`
    // (no is_active). `booking_enabled` es lo que la hace reservable desde la
    // app; sin eso queda listada pero nadie puede pedirla.
    const filas = nuevasFac.map((f) => ({
        school_id: SCHOOL_ID,
        name: f.name,
        type: f.type,
        capacity: f.capacity,
        description: `${f.sport} — ${f.name}`,
        status: 'available',
        hourly_rate: f.hora,
        booking_enabled: true,
        rental_enabled: f.rental,
        rental_rate: f.rental ? f.hora : null,
        available_hours: {
            monday: ['06:00-22:00'], tuesday: ['06:00-22:00'], wednesday: ['06:00-22:00'],
            thursday: ['06:00-22:00'], friday: ['06:00-22:00'],
            saturday: ['07:00-20:00'], sunday: ['08:00-18:00'],
        },
    }));
    const r = await fetch(`${url}/rest/v1/facilities`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(filas),
    });
    if (!r.ok) {
        console.error(`✗ facilities: ${(await r.text()).slice(0, 300)}`);
        process.exit(1);
    }
    console.log(`✓ facilities · ${JSON.parse(await r.text()).length} instalaciones`);
}

// ── 5. Verificación ─────────────────────────────────────────────────────────
const v = (await (await fetch(`${url}/rest/v1/v_school_entitlements?select=*&school_id=eq.${SCHOOL_ID}`, { headers: H })).json())[0];
console.log('\nLo que va a ver Carmel:');
console.log(`  Academia          ${v.has_academy ? '✓' : '✗'}`);
console.log(`  Reservas          ${v.has_reservations ? '✓' : '✗'}`);
console.log(`  Cobros a familias ${v.has_billing ? '✗ SIGUEN ACTIVOS' : '✓ ocultos'}`);
console.log(`  Estado            ${v.subscription_status} · vence ${String(v.trial_ends_at).slice(0, 10)} · operativa=${v.is_operational}`);
console.log('\nFalta: desplegar el frontend para que el menú respete has_billing.');
