// ============================================================================
// SportMaps — acudientes que no ven a su hijo o no pueden pagar (READ-ONLY)
//
// El caso Giovanny Currea (2026-08-12): la cuenta existía, el correo estaba
// confirmado, había entrado ese mismo día… y no veía a su hija ni podía pagar,
// porque `children.parent_id` estaba en NULL. Lo único que los ligaba era
// `parent_email_temp`, que es texto suelto, no una relación.
//
// Nace de que el acudiente se registra POR SU CUENTA en vez de aceptar la
// invitación: `accept_invitation_pro` nunca corre y nunca ata el `parent_id`.
// Desde el panel de la escuela todo se ve bien —el atleta aparece activo con el
// correo del papá— así que solo se descubre cuando la familia llama a reclamar.
//
// Qué detecta, de más grave a menos:
//
//   A · ADOPTABLE YA — `parent_id` NULL y EXISTE un perfil con ese correo.
//       El papá ya tiene cuenta: basta atarlo. Es el caso de Giovanny y el único
//       que se arregla sin pedirle nada a la familia.
//   B · COBRO IMPAGABLE — cobro vivo de un menor con `parent_id` NULL. El guard
//       anti-IDOR del checkout responde 403 «No tienes permiso para pagar» al
//       propio acudiente. Es deuda que la familia NO puede resolver.
//   C · SIN CUENTA — `parent_id` NULL y no hay perfil con ese correo. Falta que
//       se registre; acá sí hay que escribirle.
//   D · INVITACIÓN COLGADA — el perfil existe pero su invitación sigue
//       'pending'. La escuela la ve abierta y se la reenvía de más.
//   E · PLAN DISTINTO AL DE LA INVITACIÓN — lista de REVISIÓN, no de defectos.
//       Que difieran es normal: la invitación es una propuesta inicial y la
//       escuela puede cambiar el plan después. Medido en Dynasty, las 24
//       diferencias van en AMBAS direcciones (unas suben de precio y otras
//       bajan), que es la firma de cambios legítimos, no de un bug.
//       Vale mirarla igual porque ahí SÍ había un error real: a Isabela Currea
//       le pusieron PLAN PRO $150.000 cuando su plan era PLAN START $90.000, y
//       la generación del mes siguiente habría vuelto a cobrar mal. Pero eso se
//       confirmó preguntándole a la escuela, no deduciéndolo del dato.
//
// Uso:
//   node scripts/audit-acudientes-desenganchados.mjs --school Dynasty
//   node scripts/audit-acudientes-desenganchados.mjs --school Dynasty --json a.json
//   node scripts/audit-acudientes-desenganchados.mjs            (todas)
//
// NO escribe nada. Lee con la service key de bff/.env.
// ============================================================================
import { writeFileSync } from 'node:fs';
import { conectar } from './lib/supabase-rest.mjs';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const wantSchool = (arg('school') || '').trim().toLowerCase() || null;
const jsonOut = arg('json');

const { proyecto, all } = conectar();

const IMPAGO = new Set(['pending', 'overdue', 'awaiting_approval', 'partial', 'glosado']);
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const norm = (s) => String(s || '').trim().toLowerCase();
const normNom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3).sort().join('|');

console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Barrido  : acudientes desenganchados de su hijo (READ-ONLY)');
console.log('='.repeat(78));

const [schools, kids, profs, pays, enrs, invs, plans] = await Promise.all([
    all('schools', 'id,name'),
    all('children', 'id,school_id,full_name,parent_id,parent_email_temp,is_active,created_at'),
    all('profiles', 'id,email,full_name,role,created_at'),
    all('payments', 'id,school_id,child_id,parent_id,status,amount,due_date,period_year,period_month'),
    all('enrollments', 'id,school_id,child_id,status,offering_plan_id,monthly_fee'),
    all('invitations', 'id,school_id,email,status,child_name,monthly_fee,offering_plan_id,created_at'),
    all('offering_plans', 'id,name,price'),
]);
const schoolName = new Map(schools.map((s) => [s.id, s.name]));
const enEscuela = (sid) => !wantSchool || String(schoolName.get(sid) || sid).toLowerCase().includes(wantSchool);
const planById = new Map(plans.map((p) => [p.id, p]));
// Perfil por correo: es el puente que la fila de `children` no tiene.
const profByEmail = new Map();
for (const p of profs) if (p.email) profByEmail.set(norm(p.email), p);

const paysByChild = new Map();
for (const p of pays) {
    if (!p.child_id) continue;
    if (!paysByChild.has(p.child_id)) paysByChild.set(p.child_id, []);
    paysByChild.get(p.child_id).push(p);
}
const enrsByChild = new Map();
for (const e of enrs) {
    if (!e.child_id) continue;
    if (!enrsByChild.has(e.child_id)) enrsByChild.set(e.child_id, []);
    enrsByChild.get(e.child_id).push(e);
}
// Invitaciones por correo + nombre del menor, para casar la del hijo correcto
// cuando un acudiente tiene varios.
const invByKey = new Map();
for (const i of invs) {
    if (!i.email) continue;
    const k = `${norm(i.email)}|${normNom(i.child_name)}`;
    if (!invByKey.has(k)) invByKey.set(k, []);
    invByKey.get(k).push(i);
}
const invByEmail = new Map();
for (const i of invs) {
    if (!i.email) continue;
    const k = norm(i.email);
    if (!invByEmail.has(k)) invByEmail.set(k, []);
    invByEmail.get(k).push(i);
}

const filas = [];
for (const c of kids) {
    if (!enEscuela(c.school_id)) continue;
    const correo = norm(c.parent_email_temp);
    const perfil = correo ? profByEmail.get(correo) : null;
    const cobros = (paysByChild.get(c.id) || []).filter((p) => IMPAGO.has(p.status));
    const impagables = cobros.filter((p) => !p.parent_id);
    const activas = (enrsByChild.get(c.id) || []).filter((e) => e.status === 'active');

    // Invitación: primero por correo+nombre, si no por correo suelto.
    const inv = (invByKey.get(`${correo}|${normNom(c.full_name)}`) || invByEmail.get(correo) || [])
        .slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

    // E · el plan de la inscripción no es el que decía la invitación
    const planInv = inv?.offering_plan_id ? planById.get(inv.offering_plan_id) : null;
    const planEnr = activas.map((e) => e.offering_plan_id).find(Boolean);
    const planActual = planEnr ? planById.get(planEnr) : null;
    const planDistinto = !!(planInv && planEnr && planInv.id !== planEnr);

    const sinAtar = !c.parent_id && !!correo;
    const casos = [];
    if (sinAtar && perfil) casos.push('A');
    if (impagables.length) casos.push('B');
    if (sinAtar && !perfil) casos.push('C');
    if (perfil && inv && inv.status === 'pending') casos.push('D');
    if (planDistinto) casos.push('E');
    if (!casos.length) continue;

    filas.push({
        school_id: c.school_id, school: schoolName.get(c.school_id) || c.school_id,
        child_id: c.id, atleta: c.full_name, activa: c.is_active !== false,
        correo, parent_id: c.parent_id,
        perfil_id: perfil?.id || null, perfil_nombre: perfil?.full_name || null,
        casos,
        cobros_vivos: cobros.length,
        impagables: impagables.map((p) => ({ id: p.id, monto: Number(p.amount || 0), status: p.status, due: p.due_date })),
        monto_impagable: impagables.reduce((a, p) => a + Number(p.amount || 0), 0),
        inscripciones_activas: activas.length,
        invitacion: inv ? { id: inv.id, status: inv.status, cuota: inv.monthly_fee } : null,
        plan_invitacion: planInv ? `${planInv.name.trim()} ${fmt(planInv.price)}` : null,
        plan_actual: planActual ? `${planActual.name.trim()} ${fmt(planActual.price)}` : null,
        plan_distinto: planDistinto,
        cuota_actual: activas.map((e) => e.monthly_fee).find((v) => v != null) ?? null,
    });
}

// A y B primero: son los que dejan a una familia sin poder pagar.
const peso = (f) => (f.casos.includes('A') ? 100 : 0) + (f.casos.includes('B') ? 50 : 0)
    + (f.casos.includes('E') ? 10 : 0) + (f.casos.includes('C') ? 5 : 0);
filas.sort((a, b) => peso(b) - peso(a) || b.monto_impagable - a.monto_impagable);

const con = (k) => filas.filter((f) => f.casos.includes(k));
console.log(`\n${'='.repeat(78)}`);
console.log('RESUMEN');
console.log('='.repeat(78));
console.log(`  Atletas con algún problema de enganche          : ${filas.length}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  🔴 A · ADOPTABLE YA (el papá ya tiene cuenta)   : ${con('A').length}   ← se arregla solo atando parent_id`);
console.log(`  🔴 B · con cobro IMPAGABLE (403 al pagar)       : ${con('B').length}   ${fmt(con('B').reduce((a, f) => a + f.monto_impagable, 0))}`);
console.log(`  🟠 C · sin cuenta (falta que se registre)       : ${con('C').length}`);
console.log(`  🟡 D · invitación colgada en 'pending'          : ${con('D').length}`);
console.log(`  ⚪ E · plan distinto al de la invitación        : ${con('E').length}   (REVISIÓN, no defecto: la escuela puede cambiarlo)`);
// El cruce importa más que los totales: si el cobro es impagable PORQUE el
// acudiente nunca se registró, atar `parent_id` no arregla nada — no hay a quién
// atar. Son dos problemas distintos y se resuelven distinto.
const bSinCuenta = filas.filter((f) => f.casos.includes('B') && f.casos.includes('C')).length;
const bAdoptable = filas.filter((f) => f.casos.includes('B') && f.casos.includes('A')).length;
if (con('B').length) {
    console.log(`\n  De los ${con('B').length} con cobro impagable:`);
    console.log(`     ${bAdoptable} se arreglan atando el parent_id (el papá YA tiene cuenta)`);
    console.log(`     ${bSinCuenta} NO: el acudiente nunca se registró, no hay a quién atar.`);
    console.log('       → esos necesitan que la familia cree la cuenta, o que la escuela');
    console.log('         les cobre por fuera. No es un problema de datos que se parchee.');
}

const porEsc = new Map();
for (const f of filas) porEsc.set(f.school, (porEsc.get(f.school) || 0) + 1);
if (porEsc.size > 1) {
    console.log(`\n${'-'.repeat(78)}`);
    console.log('POR ESCUELA');
    console.log('-'.repeat(78));
    for (const [s, n] of [...porEsc].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(s).slice(0, 44).padEnd(46)} ${String(n).padStart(3)}`);
    }
}

console.log(`\n${'-'.repeat(78)}`);
console.log('DETALLE');
console.log('-'.repeat(78));
for (const f of filas) {
    const marca = f.casos.includes('A') || f.casos.includes('B') ? '🔴' : '🟠';
    console.log(`\n${marca} [${f.casos.join('+')}] ${f.atleta}  ·  ${f.school}${f.activa ? '' : '  (INACTIVA)'}`);
    console.log(`   acudiente en la ficha: ${f.correo || '❌ sin correo'}`);
    if (f.casos.includes('A')) {
        console.log(`   ✔ YA TIENE CUENTA: ${f.perfil_nombre} · perfil ${f.perfil_id}`);
        console.log(`     → basta: children.parent_id = '${f.perfil_id}' WHERE id = '${f.child_id}'`);
    }
    if (f.casos.includes('C')) console.log('   ❌ no existe perfil con ese correo → hay que invitarlo / que se registre');
    if (f.impagables.length) {
        console.log(`   💸 ${f.impagables.length} cobro(s) IMPAGABLE(s) — ${fmt(f.monto_impagable)}:`);
        for (const p of f.impagables) console.log(`        [${p.status}] ${fmt(p.monto)} vence ${p.due || '—'}  id=${p.id}`);
    }
    if (f.casos.includes('D')) console.log(`   📨 invitación ${f.invitacion.id} sigue 'pending' aunque ya tiene cuenta`);
    if (f.plan_distinto) {
        console.log(`   ⚠️  PLAN DISTINTO — invitación: ${f.plan_invitacion}   ·   hoy: ${f.plan_actual} (cuota ${f.cuota_actual ?? '—'})`);
    }
    if (f.inscripciones_activas > 1) console.log(`   ⚠️  ${f.inscripciones_activas} inscripciones activas`);
}

if (!filas.length) console.log('\n✅ Ningún acudiente desenganchado con los filtros dados.');

if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({
        escuela: wantSchool || 'todas',
        totales: {
            total: filas.length,
            adoptables: con('A').length,
            con_cobro_impagable: con('B').length,
            monto_impagable: con('B').reduce((a, f) => a + f.monto_impagable, 0),
            sin_cuenta: con('C').length,
            invitacion_colgada: con('D').length,
            plan_distinto: con('E').length,
        },
        atletas: filas,
    }, null, 2));
    console.log(`\nJSON → ${jsonOut}`);
}
console.log('\n(READ-ONLY: este script no escribió nada.)');
