// ============================================================================
// CAR-1 — Poblar sport_configs de Club Campestre Demo (ensayo de Carmel)
//
// Por qué acá y no en Carmel: la ÚNICA fila de sport_configs en toda la base es
// de MMA BLAIR TEAM (cuenta test, eje por peso). El camino multideporte, y
// cualquier eje distinto al peso, nunca se ejerció. Club Campestre Demo tiene
// exactamente la forma de Carmel —8 deportes, 9 sedes, atletas en hasta 8
// disciplinas— así que el camino virgen se estrena en una cuenta demo.
//
// El eje NO se inventa: se deriva de las categorías ya sembradas.
//   · Rangos de edad distintos entre categorías        → 'age'
//   · Mismo rango de edad y los nombres marcan nivel   → 'level'
//   · Mismo rango y ni siquiera hay progresión         → 'none'
// Eso da 6 deportes por edad, 1 por nivel (pádel) y 1 sin eje (gimnasio) —
// tres ejes distintos, que es justo lo que hay que probar antes del martes.
//
// Uso:
//   node scripts/car1-sport-configs-club-campestre.mjs           # ensayo
//   node scripts/car1-sport-configs-club-campestre.mjs --apply   # escribe
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';
import { DISCIPLINAS, CLUB } from './demo-club-campestre/catalog.mjs';

const APPLY = process.argv.includes('--apply');
const { url, H, all } = conectar();

// Slug del deporte: lo que va en sport_configs.sport (minúsculas, sin tildes),
// alineado con los slugs de sports_categories.
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Deriva el eje de las categorías ya sembradas.
 *
 * El nivel se evalúa ANTES que la edad, y por MAYORÍA. Si se mira la edad
 * primero, pádel (Recreativo 18-70 · Intermedio 18-70 · Competitivo 18-55) sale
 * 'age' por unos rangos que son incidentales: lo que de verdad separa esas
 * categorías es la destreza. Y si bastara con que UNA categoría suene a nivel,
 * golf saldría 'level' por su «Alto Rendimiento» cuando sus otras tres
 * (Infantil/Juvenil/Adultos) son puramente etarias.
 */
const NIVEL = /recreativ|intermedi|competitiv|avanzad|inicial|principiant|alto rendimiento|nivel/i;
function ejeDe(categorias) {
    const deNivel = categorias.filter((c) => NIVEL.test(c.name)).length;
    if (deNivel * 2 >= categorias.length) return 'level';
    const rangos = new Set(categorias.map((c) => `${c.age[0]}-${c.age[1]}`));
    return rangos.size > 1 ? 'age' : 'none';
}

/**
 * Las categorías en la forma EXACTA que exige el validador
 * `trg_validate_sport_config_rules` (mig 20260310000001, §287-330):
 *
 *   age    → { name, min, max }              ← no min_age/max_age
 *   weight → { name, min_kg, max_kg }
 *   belt   → { name, order }
 *   level  → { name, min_rating, max_rating }
 *   none   → rules VACÍO (con elementos, revienta)
 *
 * El contrato está versionado desde marzo pero solo se había ejercido con
 * `weight`. Los otros cuatro ejes se estrenan acá.
 */
function reglasDe(categorias, eje) {
    if (eje === 'age') {
        return categorias.map((c) => ({ name: c.name, min: c.age[0], max: c.age[1] }));
    }
    if (eje === 'level') {
        // Escala 1-10 repartida entre las categorías, en el orden en que están
        // definidas (van de menor a mayor destreza).
        const paso = Math.floor(10 / categorias.length);
        return categorias.map((c, i) => ({
            name: c.name,
            min_rating: i * paso + 1,
            max_rating: i === categorias.length - 1 ? 10 : (i + 1) * paso,
        }));
    }
    return [];   // axis='none' no admite reglas
}

// ── Resolver la escuela ─────────────────────────────────────────────────────
const schools = await all('schools', 'id,name,school_type', { order: 'id' });
const escuela = schools.find((s) => s.name === CLUB.name);
if (!escuela) { console.error(`No encontré "${CLUB.name}"`); process.exit(1); }

const existentes = await all('sport_configs', 'school_id,sport,categorization_axis,is_active', { order: 'sport' });
const yaTiene = new Set(existentes.filter((x) => x.school_id === escuela.id).map((x) => x.sport));

console.log(`${APPLY ? 'APLICANDO' : 'ENSAYO — usa --apply para escribir'}\n`);
console.log(`${escuela.name}  ·  school_type=${escuela.school_type}  ·  ${escuela.id}`);
console.log(`sport_configs en TODA la base hoy: ${existentes.length}\n`);

const filas = DISCIPLINAS.map((d) => {
    const eje = ejeDe(d.categorias);
    return {
        school_id: escuela.id,
        sport: slug(d.sport),
        categorization_axis: eje,
        rules: reglasDe(d.categorias, eje),
        settings: { display_name: d.name, branch_key: d.key, seeded_by: 'CAR-1' },
        is_active: true,
    };
});

const w = Math.max(...filas.map((f) => f.sport.length));
for (const f of filas) {
    const marca = yaTiene.has(f.sport) ? 'ya existe → se omite' : (APPLY ? 'insertar' : '[dry] insertar');
    console.log(`  ${f.sport.padEnd(w)} | eje ${f.categorization_axis.padEnd(5)} | ${String(f.rules.length).padStart(2)} categorías | ${marca}`);
    console.log(`  ${' '.repeat(w)} | ${f.rules.map((r) => r.name).join(' · ')}`);
}

const porEje = filas.reduce((m, f) => ((m[f.categorization_axis] = (m[f.categorization_axis] || 0) + 1), m), {});
console.log(`\nEjes que se van a ejercer: ${JSON.stringify(porEje)}`);
console.log('(hasta hoy solo se había usado "weight", en una cuenta test)');

const nuevas = filas.filter((f) => !yaTiene.has(f.sport));
if (!nuevas.length) { console.log('\nNada que insertar: ya están las 8.'); process.exit(0); }

if (!APPLY) { console.log(`\nNada escrito. ${nuevas.length} filas listas para insertar.`); process.exit(0); }

const r = await fetch(`${url}/rest/v1/sport_configs`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(nuevas),
});
const t = await r.text();
if (!r.ok) { console.error(`\n✗ ${r.status}: ${t.slice(0, 400)}`); process.exit(1); }
console.log(`\n✓ ${JSON.parse(t).length} sport_configs creados.`);
console.log('  Siguiente: GET /api/v1/school/context debe devolver sports[] con 8 entradas.');
