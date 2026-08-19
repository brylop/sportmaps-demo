// Genera scripts/demo/seed.mjs a partir del seed de club-campestre, que ya está
// probado. Se cambian SOLO dos acoples: el import estático del catálogo y el
// namespace de IDs deterministas. Generarlo en vez de transcribirlo evita
// introducir errores en 1559 líneas que hoy funcionan.
//
// Uso:  node scripts/demo/_generar-motor.mjs
//
// Se versiona para que el motor sea reproducible: si mañana hay que arreglar
// algo del seed original, se corrige allá, se vuelve a generar y no quedan dos
// copias divergiendo. Los reemplazos fallan ruidosamente si el original cambió
// de forma, que es justo lo que uno quiere saber.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));           // scripts/demo
const SRC = join(AQUI, '..', 'demo-club-campestre', 'seed.mjs');
const DST_DIR = AQUI;
const DST = join(DST_DIR, 'seed.mjs');

let s = readFileSync(SRC, 'utf8');

// ── 1. Quitar el import estático del catálogo ───────────────────────────────
const IMPORT_RE = /import \{\n(?:.*\n)*?\} from '\.\/catalog\.mjs';\n/;
if (!IMPORT_RE.test(s)) throw new Error('No encontré el import de catalog.mjs');
s = s.replace(IMPORT_RE, '');

// ── 2. Insertar la resolución del tenant después del parseo de CLI ──────────
const ANCLA = "const TODAY = val('--today') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });\n";
if (!s.includes(ANCLA)) throw new Error('No encontré el ancla del CLI (TODAY)');

const BLOQUE_TENANT = ANCLA + `
// ─── Tenant ─────────────────────────────────────────────────────────────────
// El catálogo se resuelve en runtime: cada demo es un archivo en catalogs/ que
// exporta la MISMA forma. Así hay un solo motor de seed y cinco catálogos, en
// vez de cinco copias del motor que se van desincronizando.
const TENANT = val('--tenant') || 'club-campestre';
let cat;
try {
    cat = await import(new URL(\`./catalogs/\${TENANT}.mjs\`, import.meta.url));
} catch (e) {
    console.error(\`No pude cargar el catálogo "\${TENANT}": \${e.message}\`);
    console.error('Disponibles: club-campestre, voleibol, futbol, patinaje, crossfit, box');
    process.exit(1);
}
const {
    CLUB, DISCIPLINAS, STAFF, COACHES, PARENTS, ATHLETES, EXTERNAL, TORNEO,
    FILLER_PARENTS, FILLER_MINORS, FILLER_ADULTS, PAY_MIX, METHOD_MIX, METHODS,
    BANCOS, ADDONS, DEVICES, TARIFAS, ARRENDATARIOS, MOTIVOS_CANCELACION,
} = cat;
`;
s = s.replace(ANCLA, BLOQUE_TENANT);

// ── 3. Namespace de IDs por tenant ──────────────────────────────────────────
// Sin esto los cinco tenants derivarían los MISMOS uuid y se pisarían entre sí.
const NS_VIEJO = "const NS = 'sportmaps::demo::club-campestre::';";
if (!s.includes(NS_VIEJO)) throw new Error('No encontré la línea NS');
s = s.replace(
    NS_VIEJO,
    "const NS = `sportmaps::demo::${TENANT}::`;   // por tenant: sin esto los 5 colisionan",
);

// ── 4. Cabecera y ayuda ─────────────────────────────────────────────────────
// Todo lo que va desde el shebang hasta el primer import real es cabecera.
const CAB_VIEJA = /^#!.*\n[\s\S]*?\n(?=import \{ readFileSync)/;
const CAB_NUEVA = `#!/usr/bin/env node
// ============================================================
// SportMaps — Motor de seed de los tenants DEMO.
//
// Un solo motor, un catálogo por demo en catalogs/. Cada catálogo exporta la
// misma forma (CLUB, DISCIPLINAS, STAFF, …) y el motor arma el tenant completo:
// sedes, categorías, tarifas en offerings + offering_plans, staff con alcances,
// familias, cartera con mora realista, asistencia, instalaciones con reservas,
// control de acceso y torneo. Todo marcado is_demo donde la tabla lo soporta.
//
// Uso:
//   node scripts/demo/seed.mjs --tenant=voleibol
//   node scripts/demo/seed.mjs --tenant=crossfit --dry-run
//   node scripts/demo/seed.mjs --tenant=box --only=club,staff
//   node scripts/demo/seed.mjs --tenant=futbol --verify
//   node scripts/demo/seed.mjs --tenant=patinaje --today=2026-08-12
//
// Tenants: club-campestre · voleibol · futbol · patinaje · crossfit · box
// Credenciales de todos los usuarios: Demo2026!
//
// Por qué es seguro re-ejecutarlo:
//   1. Los IDs son DETERMINISTAS (duid(): sha1 del key → UUID). El namespace
//      incluye el tenant, así que dos demos nunca derivan el mismo id.
//   2. Las tablas tipo bitácora (payments, attendance_records, access_events)
//      no se re-escriben si ya hay filas de ese tenant.
//   3. Se apagan los toggles de school_settings que disparan crons, para que
//      ningún job nocturno mueva la cartera sembrada ni mande correos a los
//      buzones falsos @demo.sportmaps.co.
//   4. Nunca borra nada. El rollback es rollback.sql y lo corre una persona.
//
// Aislamiento: solo toca el school_id derivado de CLUB.key del tenant elegido.
// ============================================================
`;
if (!CAB_VIEJA.test(s)) throw new Error('No encontré la cabecera original');
s = s.replace(CAB_VIEJA, CAB_NUEVA);

// ── 5. Quitar las claves fijas del catálogo del club ────────────────────────
// El motor buscaba por key literal ('gerencia', 'vcruz', 'dospina'), que solo
// existen en club-campestre. Se resuelven por PROPIEDAD para que cualquier
// catálogo funcione: el dueño es quien tenga is_owner, el del token es el que
// tenga autopay, y el de los rechazos biométricos es el moroso con huella.
const REEMPLAZOS = [
    // Dueño
    [/people\.staff\.gerencia\.profileId/g, 'ownerProfile()'],
    // Portería: si el catálogo no define ese puesto, cae en el dueño.
    [/people\.staff\.porteria\.profileId/g, '(people.staff.porteria?.profileId || ownerProfile())'],
    // Token de autopay
    [/const val = people\.athletes\.vcruz;/,
        "const val = Object.values(people.athletes).find((a) => a.autopay);"],
    [/duid\('token:vcruz'\)/, 'duid(`token:${val.key}`)'],
    [/warn\('payment_tokens · token DEMO de Valentina \(Wompi no soporta autopay real todavía\)'\);/,
        'warn(`payment_tokens · token DEMO de ${val.full_name.split(" ")[0]} (Wompi no soporta autopay real todavía)`);'],
    // Moroso del control de acceso
    [/const daniel = people\.athletes\.dospina;/,
        "const daniel = Object.values(people.athletes).find((a) => a.cuota_social === 'overdue' && a.zk_pin)\n        || Object.values(people.athletes).find((a) => a.zk_pin);"],
    [/duid\(`access:daniel:\$\{TODAY\}:\$\{i\}`\)/, 'duid(`access:moroso:${TODAY}:${i}`)'],
    [/ok\(`access_events · \$\{n\} registros \(últimos 3 días \+ 2 rechazos de Daniel hoy\)`\)/,
        'ok(`access_events · ${n} registros (últimos 3 días + 2 rechazos de ${daniel.full_name.split(" ")[0]} hoy)`)'],
    // Zonas del club → instalaciones reales del tenant
    [/const zonas = \['Piscina', 'Gimnasio', 'Canchas de tenis', 'Casa club'\];/,
        'const zonas = DISCIPLINAS.flatMap((d) => d.facilities.map((f) => f.name));'],
    [/zona: 'Casa club'/g, 'zona: zonasAcceso[0]'],
    // Mensaje de huellas: sin nombres propios del club
    [/ok\(`zk_user_mappings · \$\{maps\.length\} huellas mapeadas \(Daniel=[^`]*`\);/,
        'ok(`zk_user_mappings · ${maps.length} huellas mapeadas`);'],
    // Quién no puede reservar a futuro: todos los morosos, no una persona
    [/const morosos = new Set\(\[people\.athletes\.dospina\?\.profileId\]\.filter\(Boolean\)\);/,
        'const morosos = new Set(Object.values(people.athletes)\n            .filter((a) => a.cuota_social === \'overdue\').map((a) => a.profileId));'],
    // Asistencia: los grupos estaban fijados a las disciplinas del club, así que
    // en cualquier otro tenant el roster no casaba y quedaban 0 marcas. Se
    // derivan de los horarios del catálogo: toda categoría que entrena, marca.
    [/    const grupos = \[\n(?:        \{ d: '[a-z_]+', c: '[a-z_0-9]+' \},\n)+    \];/,
        `    const grupos = DISCIPLINAS.flatMap((d) =>
        [...new Set(d.horarios.map((h) => h.cat))].map((c) => ({ d: d.key, c })));`],
    // Título del paso 8: el torneo lo define cada catálogo
    [/head\('8 · Torneo abierto de tenis'\);/, "head(`8 · ${TORNEO.title}`);"],
    // Checklist de verificación: resolver por propiedad, no por email del club
    [/    const daniel = people\.athletes\?\.dospina\?\.profileId\n[\s\S]*?check\(lastV\[0\]\?\.status !== 'overdue', 'Valentina Cruz pasará el torniquete', `\(último cobro: \$\{lastV\[0\]\?\.status\}\)`\);/,
        `    // El moroso con huella queda BLOQUEADO en portería (validateAccess deniega
    // si su cobro más reciente está overdue); el que está al día pasa.
    const moroso = Object.values(people.athletes).find((a) => a.cuota_social === 'overdue' && a.zk_pin);
    if (moroso) {
        const last = await q(\`payments?user_id=eq.\${moroso.profileId}&select=status,concept,created_at&order=created_at.desc&limit=1\`);
        check(last[0]?.status === 'overdue',
            \`\${moroso.full_name} quedará BLOQUEADO en portería\`,
            \`(último cobro: \${last[0]?.status} — \${last[0]?.concept})\`);
    }
    const alDia = Object.values(people.athletes).find((a) => a.cuota_social !== 'overdue' && a.zk_pin);
    if (alDia) {
        const lastV = await q(\`payments?user_id=eq.\${alDia.profileId}&select=status&order=created_at.desc&limit=1\`);
        check(lastV[0]?.status !== 'overdue', \`\${alDia.full_name} pasará el torniquete\`, \`(último cobro: \${lastV[0]?.status})\`);
    }`],
];
for (const [re, to] of REEMPLAZOS) {
    if (!re.test(s)) throw new Error(`No encontré el patrón a reemplazar: ${re}`);
    s = s.replace(re, to);
}

// Helper del dueño + zonas, justo después de duid().
const ANCLA_HELPER = 'function duid(key) {';
s = s.replace(ANCLA_HELPER, `/** El dueño del tenant: quien tenga is_owner en STAFF. */
const ownerProfile = () => Object.values(people.staff).find((x) => x.is_owner)?.profileId ?? null;
/** Zonas para los eventos de acceso: las instalaciones reales del tenant. */
const zonasAcceso = DISCIPLINAS.flatMap((d) => d.facilities.map((f) => f.name));

${ANCLA_HELPER}`);

mkdirSync(`${DST_DIR}/catalogs`, { recursive: true });
writeFileSync(DST, s, 'utf8');

const l = s.split('\n').length;
console.log(`✓ scripts/demo/seed.mjs generado (${l} líneas)`);
console.log('  cambios: import dinámico por --tenant · NS por tenant · cabecera');
