#!/usr/bin/env node
// ============================================================================
// CAR-1 + CAR-2 — Dejar un club multideporte listo para el trial
//
// Qué hace, sobre una escuela YA CREADA por el onboarding normal:
//   1. school_type = 'hybrid'   → prende Academia Y Reservas a la vez
//   2. billing_enabled = false  → no cobra mensualidades por SportMaps
//   3. account_type = 'real'    → es cliente, entra al régimen de trial
//   4. sport_configs de las disciplinas QUE SE LE PASEN, con las categorías
//      oficiales que el catálogo ya tiene para cada deporte
//
// Lo que NO hace, a propósito:
//
//   · No crea el alta. Que la escuela y su dueño nazcan por el onboarding
//     normal es lo que garantiza que el dueño reciba credenciales, que el
//     trigger le cree la suscripción y que quede igual que cualquier cliente.
//
//   · No crea instalaciones. Canchas, piscinas, carriles y sus tarifas son del
//     club: nosotros no sabemos cuántas tiene, cómo las llama ni qué cobra por
//     ellas. Las crea él desde la app. Una versión anterior de este script las
//     inventaba (2 canchas de tenis, 6 carriles, precios por hora) y eso es
//     exactamente lo que no se debe hacer: inventar datos de un cliente.
//
//   · No inventa categorías. Salen de `sports_categories.categorias_oficiales`
//     (FIFA, IOC, IASF…), que es el catálogo que ya vive en la base.
//
// ── Por qué el eje queda en 'division' ──────────────────────────────────────
// `fn_validate_sport_config_rules` (mig 20260310000001) exige que `rules` NO
// esté vacío cuando el eje no es 'none', y para cada eje pide campos distintos:
//
//     age    → { name, min, max }              belt  → { name, order }
//     weight → { name, min_kg, max_kg }        level → { name, min_rating, max_rating }
//     division → { name }                      none  → rules vacío
//
// El catálogo guarda las categorías como NOMBRES ('Sub-11', 'Senior'). El
// nombre no dice los cortes de edad: FIFA define Sub-11, pero si en este club
// Sub-11 va de 9 a 11 o de 10 a 11 es una decisión del club. Poner un rango
// para satisfacer al validador sería inventarlo.
//
// Así que se entra por 'division' —el único eje que se llena con solo el
// nombre— y el club afina desde «Deportes y categorías» / «Crear equipo», que
// es donde se le puede preguntar el rango a un humano. Con --eje se puede
// forzar otro eje cuando el club ya nos dio los números.
//
// Uso:
//   node scripts/carmel-configurar.mjs --nombre=carmel --deportes=futbol,natacion,golf
//   node scripts/carmel-configurar.mjs --school-id=<uuid> --deportes=futbol --apply
//
// Requiere aplicadas: 20260815141039 (billing_enabled), 20260813170814 (mapeo
// school_type → módulos) y 20260816200007 (slugs del catálogo).
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const arg = (f) => (argv.find((a) => a.startsWith(`${f}=`)) || '').split('=').slice(1).join('=');

const { url, H, all } = conectar();

// ── Qué escuela ─────────────────────────────────────────────────────────────
// Se puede pasar el nombre en vez del uuid: buscar el id a mano en la base para
// correr un script es una fricción tonta y una fuente de equivocarse de escuela.
let SCHOOL_ID = arg('--school-id');
const NOMBRE = arg('--nombre');

if (!SCHOOL_ID && !NOMBRE) {
    console.error('Falta --school-id=<uuid> o --nombre=<parte del nombre>.');
    process.exit(1);
}

const escuelas = await all('schools', 'id,name,school_type,account_type', { order: 'id' });

if (!SCHOOL_ID) {
    const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const cands = escuelas.filter((s) => norm(s.name).includes(norm(NOMBRE)));
    if (cands.length === 0) { console.error(`Ninguna escuela coincide con "${NOMBRE}".`); process.exit(1); }
    if (cands.length > 1) {
        console.error(`"${NOMBRE}" coincide con ${cands.length} escuelas. Usá --school-id:`);
        for (const c of cands) console.error(`   ${c.id}  ${c.name}`);
        process.exit(1);
    }
    SCHOOL_ID = cands[0].id;
}

const esc = escuelas.find((s) => s.id === SCHOOL_ID);
if (!esc) { console.error(`No existe la escuela ${SCHOOL_ID}.`); process.exit(1); }

// ── Qué disciplinas ─────────────────────────────────────────────────────────
// Obligatorio y sin default: cuáles maneja el club es dato del club. Antes
// venían 8 cableadas en el script, que es como se colaron supuestos.
const DEPORTES = (arg('--deportes') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (DEPORTES.length === 0) {
    console.error('Falta --deportes=futbol,natacion,golf (separados por coma).');
    console.error('Se aceptan el slug ("futbol") o el nombre del catálogo ("Fútbol").');
    console.error('\nNo hay lista por defecto a propósito: las disciplinas las dice el club.');
    process.exit(1);
}
const EJE_FORZADO = arg('--eje') || null;
const EJES_VALIDOS = ['age', 'weight', 'belt', 'level', 'division', 'none'];
if (EJE_FORZADO && !EJES_VALIDOS.includes(EJE_FORZADO)) {
    console.error(`--eje debe ser uno de: ${EJES_VALIDOS.join(', ')}`);
    process.exit(1);
}

// ── Resolver cada deporte contra el catálogo ────────────────────────────────
const catalogo = await all(
    'sports_categories',
    'id,name,slug,categorias_oficiales,federacion_internacional,is_active',
    { order: 'name' },
);

const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/_/g, ' ').trim();

/**
 * ¿Este grupo de `categorias_oficiales` es una categoría de EQUIPO?
 *
 * Mismo criterio que `public.is_category_group()` (mig 20260817112153) — acá se
 * repite porque el script lee el catálogo directo y no por la RPC.
 *
 * De los 49 grupos que existen en los 99 deportes, la mayoría NO son categorías:
 * `modalidades` (55 deportes), `pruebas`, `superficies`, `aparatos`, `formatos`,
 * `genero`. Golf ofrecía «72 hoyos stroke play» y tenis «Tierra batida (Clay)»
 * como si fueran categorías de equipo. No lo son: es cómo se juega.
 *
 * Lista blanca, no negra: un grupo nuevo queda fuera. Falta una categoría se
 * arregla a mano; basura en la configuración del cliente, no.
 */
function esGrupoDeCategorias(grupo) {
    return grupo.startsWith('categorias_')
        || grupo.startsWith('kumite_')     // pesos, con el nombre del combate
        || grupo.startsWith('kyorugi_')
        || ['niveles', 'divisiones', 'cinturones',
            // clasificación funcional paralímpica: define contra quién compite
            'clases', 'clasificacion', 'clases_funcionamiento',
            'sistema_puntos', 'handicap'].includes(grupo);
}

/**
 * Las categorías oficiales de un deporte, aplanadas a la forma que pide el
 * validador para el eje 'division' (solo `name`).
 *
 * Se salta lo que no sea una lista de textos: algunos deportes guardan objetos
 * anidados (los programas de cheer, `CHEER_ALL_STAR_*`).
 */
function categoriasOficiales(fila) {
    const oc = fila?.categorias_oficiales ?? {};
    const out = [];
    const descartados = [];
    const vistos = new Set();
    for (const [grupo, lista] of Object.entries(oc)) {
        if (!Array.isArray(lista) || typeof lista[0] !== 'string') continue;
        if (!esGrupoDeCategorias(grupo)) { descartados.push(`${grupo}(${lista.length})`); continue; }
        for (const v of lista) {
            if (typeof v !== 'string') continue;
            const k = v.toLowerCase();
            if (vistos.has(k)) continue;      // el mismo nombre en dos grupos
            vistos.add(k);
            out.push({ name: v, origen: 'oficial', grupo });
        }
    }
    // Se reporta lo que se dejó afuera en vez de recortar en silencio: si un
    // grupo estaba mal clasificado, se ve acá y no seis meses después.
    out.descartados = descartados;
    return out;
}

const resueltos = DEPORTES.map((entrada) => {
    const fila = catalogo.find((c) => c.slug === entrada || norm(c.name) === norm(entrada));
    const cats = categoriasOficiales(fila);
    // Sin categorías no se puede usar un eje que las exija: el validador
    // rechaza `rules` vacío. Queda en 'none', que es lo honesto —el deporte
    // existe para la escuela pero todavía no tiene categorías mapeadas.
    const eje = EJE_FORZADO ?? (cats.length > 0 ? 'division' : 'none');
    return {
        entrada,
        slug: fila?.slug ?? entrada,
        nombre: fila?.name ?? entrada,
        federacion: fila?.federacion_internacional ?? null,
        enCatalogo: !!fila,
        eje,
        categorias: eje === 'none' ? [] : cats,
        descartados: cats.descartados ?? [],
    };
});

const sinCatalogo = resueltos.filter((r) => !r.enCatalogo);

// ── Comprobaciones previas ──────────────────────────────────────────────────
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

// ── Informe ─────────────────────────────────────────────────────────────────
console.log(`${APPLY ? 'APLICANDO' : 'ENSAYO — usa --apply para escribir'}\n`);
console.log(`${esc.name}  ·  ${SCHOOL_ID}`);
console.log(`  school_type   ${esc.school_type}  →  hybrid       ${esc.school_type === 'hybrid' ? '(ya está)' : ''}`);
console.log(`  account_type  ${esc.account_type}  →  real          ${esc.account_type === 'real' ? '(ya está)' : ''}`);
console.log(`  cobros        ${ent.has_billing ? 'ACTIVOS' : 'apagados'}  →  apagados  ${ent.has_billing === false ? '(ya está)' : ''}`);
console.log(`  reservas      ${ent.has_reservations ? 'sí' : 'NO'} · academia ${ent.has_academy ? 'sí' : 'NO'}   (se resuelven con school_type)\n`);

console.log('Disciplinas (categorías tomadas del catálogo, no inventadas):');
for (const r of resueltos) {
    const marca = yaTiene.has(r.slug) ? 'ya existe' : (APPLY ? 'crear' : '[dry] crear');
    const fed = r.federacion ? ` · ${r.federacion}` : '';
    console.log(`  ${r.slug.padEnd(14)} eje ${r.eje.padEnd(9)} ${String(r.categorias.length).padStart(2)} categorías${fed.padEnd(12)} ${marca}`);
    if (r.categorias.length) {
        const muestra = r.categorias.slice(0, 8).map((c) => c.name).join(', ');
        console.log(`     ${muestra}${r.categorias.length > 8 ? ` … (+${r.categorias.length - 8})` : ''}`);
    }
    if (r.descartados.length) {
        console.log(`     no son categorias, se omiten: ${r.descartados.join(', ')}`);
    }
    if (!r.enCatalogo) {
        console.log(`     ⚠ "${r.entrada}" no está en el catálogo: se crea sin categorías (eje none).`);
    }
}

if (sinCatalogo.length) {
    console.log(`\n⚠ ${sinCatalogo.length} disciplina(s) fuera del catálogo: ${sinCatalogo.map((r) => r.entrada).join(', ')}`);
    console.log('  Revisá el nombre, o hay que agregar ese deporte a sports_categories.');
}

console.log('\nInstalaciones: NINGUNA. Canchas, piscinas, carriles y tarifas los crea el club');
console.log('desde la app — no los inventa este script.');

const nuevas = resueltos.filter((r) => !yaTiene.has(r.slug));

if (!APPLY) {
    console.log(`\nNada escrito. Faltaría crear ${nuevas.length} sport_configs.`);
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
if (nuevas.length) {
    const filas = nuevas.map((r) => ({
        school_id: SCHOOL_ID,
        sport: r.slug,
        categorization_axis: r.eje,
        rules: r.categorias,
        settings: { display_name: r.nombre, seeded_by: 'CAR-1', categorias_origen: 'catalogo' },
        is_active: true,
    }));
    const res = await fetch(`${url}/rest/v1/sport_configs`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(filas),
    });
    if (!res.ok) { console.error(`✗ sport_configs: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
    console.log(`✓ sport_configs · ${JSON.parse(await res.text()).length} disciplinas`);
}

// ── 4. Verificación ─────────────────────────────────────────────────────────
const v = (await (await fetch(`${url}/rest/v1/v_school_entitlements?select=*&school_id=eq.${SCHOOL_ID}`, { headers: H })).json())[0];
console.log('\nLo que va a ver el club:');
console.log(`  Academia          ${v.has_academy ? '✓' : '✗'}`);
console.log(`  Reservas          ${v.has_reservations ? '✓' : '✗'}`);
console.log(`  Cobros a familias ${v.has_billing ? '✗ SIGUEN ACTIVOS' : '✓ ocultos'}`);
console.log(`  Estado            ${v.subscription_status} · vence ${String(v.trial_ends_at).slice(0, 10)} · operativa=${v.is_operational}`);

console.log('\nQueda para el club (o para la inducción):');
console.log('  · crear sus instalaciones con sus tarifas reales');
console.log('  · ajustar el eje y los rangos de cada categoría desde «Deportes y categorías»');
console.log('  · el menú respeta has_billing solo si el frontend está desplegado');
