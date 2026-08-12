// ============================================================================
// SportMaps — barrido de identidades DUPLICADAS en toda la plataforma (READ-ONLY)
//
// Hermano de `check-duplicate-identity.mjs`: ese resuelve UNA persona, este
// barre TODAS las escuelas y saca la lista de personas que existen más de una
// vez como atleta facturable.
//
// Las tres superficies donde nace una identidad de atleta (las tres ramas de la
// vista `school_athletes`):
//   · children                    → menor a cargo de un acudiente
//   · profiles + school_members   → atleta adulto con cuenta propia
//   · unregistered_athletes       → precargado por la escuela (sin cuenta)
//
// Cómo agrupa (union-find sobre señales, NO por nombre exacto):
//   doc:<dígitos>            documento normalizado (≥6 dígitos)
//   name:<tokens ordenados>  nombre sin acentos, ordenado (aguanta el cambio de orden)
//   dob:<fecha>+<2 tokens>   fecha de nacimiento + dos tokens del nombre
// Todo dentro de la MISMA escuela: la misma persona en dos escuelas es legítimo.
// La heurística vive en `lib/athlete-identity.mjs`, compartida con
// `audit-cobros-duplicados.mjs` para que ambos barridos agrupen igual.
//
// Uso:
//   node scripts/audit-duplicate-athletes.mjs
//   node scripts/audit-duplicate-athletes.mjs --school "Dynasty"
//   node scripts/audit-duplicate-athletes.mjs --json salida.json
//   node scripts/audit-duplicate-athletes.mjs --min-signals 2   (solo casos duros)
//
// NO escribe nada. Lee con la service key de bff/.env.
// ============================================================================
import { writeFileSync } from 'node:fs';
import { conectar } from './lib/supabase-rest.mjs';
import { agruparIdentidades, construirIdentidades } from './lib/athlete-identity.mjs';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);
const wantSchool = (arg('school') || '').trim().toLowerCase() || null;
const jsonOut = arg('json');
const minSignals = Number(arg('min-signals') || 1);

const { proyecto, all } = conectar();

console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Barrido  : identidades de atleta duplicadas por escuela (READ-ONLY)');
console.log('='.repeat(78));

// ── carga ───────────────────────────────────────────────────────────────────
const [schools, kids, uas, members, profs, enrs, pays] = await Promise.all([
  all('schools', 'id,name'),
  all('children', 'id,school_id,full_name,doc_number,date_of_birth,parent_id,parent_email_temp,team_id,monthly_fee,is_active,is_demo,created_at'),
  all('unregistered_athletes', 'id,school_id,full_name,doc_number,date_of_birth,email,phone,is_active,linked_profile_id,created_at'),
  all('school_members', 'id,profile_id,school_id,role,status,created_at'),
  all('profiles', 'id,full_name,email,phone,date_of_birth,role,created_at'),
  all('enrollments', 'id,school_id,user_id,child_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee,created_at'),
  all('payments', 'id,school_id,user_id,child_id,unregistered_athlete_id,parent_id,status,amount,due_date,created_at'),
]);
const schoolName = new Map(schools.map((s) => [s.id, s.name]));
const profById = new Map(profs.map((p) => [p.id, p]));
console.log(`\nCargado: ${schools.length} escuelas · ${kids.length} children · ${uas.length} unregistered · ${members.length} school_members · ${enrs.length} inscripciones · ${pays.length} cobros`);

// ── identidades candidatas + agrupación (lib/athlete-identity.mjs) ──────────
const ids = construirIdentidades({ kids, uas, members, profById });
const { grupos, descartados } = agruparIdentidades(ids);

const enrBySubject = new Map();
for (const e of enrs) {
  for (const k of [e.user_id, e.child_id, e.unregistered_athlete_id].filter(Boolean)) {
    if (!enrBySubject.has(k)) enrBySubject.set(k, []);
    enrBySubject.get(k).push(e);
  }
}
const payBySubject = new Map();
for (const p of pays) {
  for (const k of [p.user_id, p.child_id, p.unregistered_athlete_id].filter(Boolean)) {
    if (!payBySubject.has(k)) payBySubject.set(k, []);
    payBySubject.get(k).push(p);
  }
}
const TERMINAL = new Set(['cancelled', 'canceled', 'void', 'rejected', 'failed', 'refunded']);
const DEUDA = new Set(['pending', 'overdue', 'partial', 'awaiting_approval', 'glosado']);

const report = [];
for (const { rows, veredicto, razones } of grupos) {
  const sid = rows[0].school_id;
  const sname = schoolName.get(sid) || sid;
  if (wantSchool && !String(sname).toLowerCase().includes(wantSchool)) continue;

  const detail = rows.map((r) => {
    const es = enrBySubject.get(r.id) || [];
    const ps = (payBySubject.get(r.id) || []).filter((p) => p.school_id === sid);
    const activas = es.filter((e) => e.status === 'active');
    const deuda = ps.filter((p) => DEUDA.has(p.status));
    const pagados = ps.filter((p) => p.status === 'paid' || p.status === 'approved');
    return {
      ...r,
      enrollments: es.length, activas: activas.length,
      fee: activas.map((e) => e.monthly_fee).find((v) => v != null) ?? null,
      team: activas.some((e) => e.team_id),
      plan: activas.some((e) => e.offering_plan_id),
      pagos_total: ps.length,
      pagados: pagados.length, pagado_monto: pagados.reduce((a, p) => a + Number(p.amount || 0), 0),
      deuda: deuda.length, deuda_monto: deuda.reduce((a, p) => a + Number(p.amount || 0), 0),
      anulados: ps.filter((p) => TERMINAL.has(p.status)).length,
    };
  });

  const facturables = detail.filter((d) => d.activas > 0);
  const visibles = detail.filter((d) => (d.kind === 'unregistered' ? d.visible && d.is_active : d.is_active));
  // cobros del mismo mes/monto entre identidades distintas del grupo
  const porMes = {};
  for (const d of detail) {
    for (const p of (payBySubject.get(d.id) || [])) {
      if (p.school_id !== sid || TERMINAL.has(p.status)) continue;
      const k = `${(p.due_date || '').slice(0, 7)}|${p.amount}`;
      (porMes[k] ||= new Set()).add(d.id);
    }
  }
  const mesesDobles = Object.entries(porMes).filter(([, v]) => v.size > 1).map(([k]) => k);

  // Sobreviviente sugerido: la identidad que puede entrar, pagar y ya pagó.
  // (memoria: sobrevive la ADULTA; entre children, la que tiene acudiente real,
  // equipo/cuota y plata pagada.)
  const puntaje = (d) => (
    (d.kind === 'adult' ? 1000 : 0) +
    (d.pagado_monto > 0 ? 500 : 0) +
    (d.owner && !String(d.owner).startsWith('❌') ? 200 : 0) +
    (d.team ? 100 : 0) + (d.fee ? 50 : 0) + (d.activas > 0 ? 25 : 0) +
    Math.min(d.pagos_total, 20)
  );
  const orden = [...detail].sort((a, b) => puntaje(b) - puntaje(a));
  const sobrevive = orden[0];
  const absorben = orden.slice(1);

  report.push({
    school_id: sid, school: sname, veredicto, razones,
    sobrevive_id: sobrevive.id, absorben_ids: absorben.map((d) => d.id),
    identidades: detail.length,
    facturables: facturables.length,
    visibles: visibles.length,
    mesesDobles,
    riesgo_mensual: facturables.length > 1
      ? facturables.slice(1).reduce((a, d) => a + Number(d.fee || 0), 0)
      : 0,
    rows: detail,
  });
}

// severidad: confirmado+facturable > confirmado > probable
const sev = (g) => (g.veredicto === 'CONFIRMADO' ? 10 : 0) + (g.facturables > 1 ? 3 : g.visibles > 1 ? 2 : 1) + (g.mesesDobles.length ? 5 : 0);
report.sort((a, b) => sev(b) - sev(a) || b.riesgo_mensual - a.riesgo_mensual || String(a.school).localeCompare(String(b.school)));

// ── salida ──────────────────────────────────────────────────────────────────
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const porEscuela = new Map();
for (const g of report) {
  if (!porEscuela.has(g.school)) porEscuela.set(g.school, []);
  porEscuela.get(g.school).push(g);
}

console.log(`\n${'='.repeat(78)}`);
console.log(`RESUMEN — ${report.length} personas con más de una identidad en su escuela`);
console.log('='.repeat(78));
console.log(`  🔴 CONFIRMADO (doc/fecha/acudiente coinciden)   : ${report.filter((g) => g.veredicto === 'CONFIRMADO').length}`);
console.log(`  🟠 PROBABLE (nombre completo igual, datos flojos): ${report.filter((g) => g.veredicto === 'PROBABLE').length}`);
console.log(`  ⛔ de esos, doble FACTURABLE (2+ activas)       : ${report.filter((g) => g.facturables > 1).length}`);
console.log(`  💸 cobro doble YA generado (mismo mes y monto)  : ${report.filter((g) => g.mesesDobles.length).length}`);
console.log(`  📅 riesgo por próxima apertura de mes           : ${fmt(report.reduce((a, g) => a + g.riesgo_mensual, 0))}`);
console.log(`  ⚪ descartados como homónimos / doc repetido    : ${descartados.length} parejas`);

console.log(`\n${'-'.repeat(78)}`);
console.log('POR ESCUELA');
console.log('-'.repeat(78));
for (const [s, gs] of [...porEscuela].sort((a, b) => b[1].length - a[1].length)) {
  const dobles = gs.filter((g) => g.facturables > 1).length;
  console.log(`  ${String(s).slice(0, 40).padEnd(42)} ${String(gs.length).padStart(3)} casos  ${dobles ? `(${dobles} doble facturable)` : ''}`);
}

console.log(`\n${'-'.repeat(78)}`);
console.log('DETALLE');
console.log('-'.repeat(78));
for (const g of report) {
  const marca = g.veredicto === 'CONFIRMADO' ? '🔴' : '🟠';
  console.log(`\n${marca} ${g.veredicto} · ${g.rows[0].name}  ·  ${g.school}`);
  for (const r of g.razones) console.log(`   ↳ ${r}`);
  for (const d of g.rows) {
    const vis = d.kind === 'unregistered' ? (d.visible ? 'en listado' : 'oculto(vinculado)') : (d.is_active ? 'en listado' : 'inactivo');
    console.log(`   · [${d.kind}] ${d.name}${d.id === g.sobrevive_id ? '   ⭐ SOBREVIVE' : '   → absorber'}`);
    console.log(`       id=${d.id}  doc=${d.doc || '-'}  nac=${d.dob || '-'}  ${vis}  dueño=${d.owner}`);
    console.log(`       inscripciones=${d.enrollments} (activas=${d.activas})  cuota=${d.fee ?? '—'}  equipo=${d.team ? 'sí' : 'no'}  plan=${d.plan ? 'sí' : 'no'}`);
    console.log(`       cobros=${d.pagos_total}  pagados=${d.pagados} (${fmt(d.pagado_monto)})  deuda=${d.deuda} (${fmt(d.deuda_monto)})  anulados=${d.anulados}`);
  }
  if (g.mesesDobles.length) console.log(`   💸 cobro doble en: ${g.mesesDobles.join(', ')}`);
  if (g.riesgo_mensual) console.log(`   📅 riesgo por apertura de mes: ${fmt(g.riesgo_mensual)} de más`);
}

if (has('descartados')) {
  console.log(`\n${'-'.repeat(78)}`);
  console.log('DESCARTADOS (no fusionar sin revisar)');
  console.log('-'.repeat(78));
  for (const p of descartados) {
    const sname = schoolName.get(p.a.school_id) || p.a.school_id;
    if (wantSchool && !String(sname).toLowerCase().includes(wantSchool)) continue;
    console.log(`\n⚪ ${p.veredicto} · ${p.a.name} ↔ ${p.b.name}  ·  ${sname}`);
    console.log(`   ${p.razones.join(' | ')}`);
    console.log(`   doc ${p.a.doc || '-'} / ${p.b.doc || '-'}   nac ${p.a.dob || '-'} / ${p.b.dob || '-'}`);
  }
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ duplicados: report, descartados: descartados.map((p) => ({ veredicto: p.veredicto, school: schoolName.get(p.a.school_id), a: p.a.name, b: p.b.name, razones: p.razones })) }, null, 2));
  console.log(`\nJSON → ${jsonOut}`);
}
console.log('\n(READ-ONLY: este script no escribió nada.)');
