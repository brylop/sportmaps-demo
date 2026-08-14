// ============================================================================
// Marcar como account_type='test' todas las cuentas de prueba/basura, dejando
// como 'demo' SOLO los tenants curados que sí se muestran a clientes.
//
// Por qué importa la diferencia (ver docs/plan-limpieza-y-demos-curadas-2026-08-12.md):
//   demo = tenant curado, versionado, se reconstruye con seed. NO se borra.
//   test = cuenta desechable de QA. Se puede borrar sin preguntar.
// Las dos quedan exentas del bloqueo por fin de prueba y fuera de métricas, así
// que este cambio NO altera el comportamiento de ninguna: solo separa lo que
// hay que conservar de lo que se puede tirar.
//
// Uso:
//   node scripts/demo-marcar-cuentas-de-prueba.mjs            # ensayo (default)
//   node scripts/demo-marcar-cuentas-de-prueba.mjs --apply    # escribe
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const APPLY = process.argv.includes('--apply');
const { url, H, all } = conectar();

// Los tenants curados que se conservan como 'demo'.
const CURADOS = [
    'Club Campestre Demo',
    'Escuela Demo SportMaps',
    'Academia Fútbol Demo',
    'Andrés Torres — Entrenamiento Personal (Demo)',
    // Los cinco nuevos: se listan desde ya para que este script sea idempotente
    // aunque se corra después de sembrarlos.
    'Club Voleibol Altura Demo',
    'Academia Fútbol Horizonte Demo',
    'Club Patinaje Veloz Demo',
    'Box CrossFit Forja Demo',
    'Escuela de Boxeo Titanes Demo',
];

const [schools, profiles, enr, pays] = await Promise.all([
    all('schools', 'id,name,account_type,school_type,owner_id', { order: 'id' }),
    all('profiles', 'id,email', { order: 'id' }),
    all('enrollments', 'school_id,status', { order: 'id' }),
    all('payments', 'school_id,status,amount', { order: 'id' }),
]);
const email = Object.fromEntries(profiles.map((p) => [p.id, p.email || '']));
const activas = {}; for (const e of enr) if (['active', 'paid'].includes(e.status)) activas[e.school_id] = (activas[e.school_id] || 0) + 1;
const plata = {}; for (const p of pays) if (['paid', 'partial'].includes(p.status)) plata[p.school_id] = (plata[p.school_id] || 0) + Number(p.amount || 0);

// Candidata a 'test': ya está marcada como nuestra, o el nombre/correo grita prueba.
const esPrueba = (s) => {
    const n = s.name.toLowerCase();
    const e = (email[s.owner_id] || '').toLowerCase();
    return s.account_type !== 'real'
        || /prueba|test|demo|dddd|pollito|academia super|artes sexuales|lópez romero|lopez romero/.test(n)
        || /sportmaps|spoortmaps|^b\d|^br\d|^prueba\d/.test(e);
};

const objetivo = schools.filter((s) => esPrueba(s) && !CURADOS.includes(s.name) && s.account_type !== 'test');

console.log(`${APPLY ? 'APLICANDO' : 'ENSAYO (usa --apply para escribir)'}\n`);
console.log(`Se marcan como 'test': ${objetivo.length}`);
console.log(`Se conservan como 'demo': ${schools.filter((s) => CURADOS.includes(s.name)).length} tenants curados\n`);

const conPlata = objetivo.filter((s) => plata[s.id] > 0 || activas[s.id] > 0);
if (conPlata.length) {
    console.log('⚠  De las que se marcan, estas tienen atletas o dinero adentro:');
    for (const s of conPlata.sort((a, b) => (plata[b.id] || 0) - (plata[a.id] || 0))) {
        console.log(`   ${s.name.slice(0, 38).padEnd(38)} | ${String(s.account_type).padEnd(5)} | insc.act ${String(activas[s.id] || 0).padStart(4)} | $${(plata[s.id] || 0).toLocaleString('es-CO')} | ${email[s.owner_id] || '-'}`);
    }
    console.log('   (ya estaban exentas por ser demo — pasar a test no cambia su comportamiento)\n');
}

console.log('Resto (sin atletas ni dinero):');
for (const s of objetivo.filter((s) => !conPlata.includes(s))) {
    console.log(`   ${s.name.slice(0, 40).padEnd(40)} | ${s.account_type}`);
}

if (!APPLY) { console.log('\nNada escrito. Corre con --apply para aplicar.'); process.exit(0); }

let ok = 0;
for (const s of objetivo) {
    const r = await fetch(`${url}/rest/v1/schools?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ account_type: 'test', updated_at: new Date().toISOString() }),
    });
    if (r.ok) ok++;
    else console.error(`   ✗ ${s.name}: ${(await r.text()).slice(0, 120)}`);
}
console.log(`\n✓ ${ok}/${objetivo.length} escuelas marcadas como 'test'.`);
