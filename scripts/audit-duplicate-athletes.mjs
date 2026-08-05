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
//
// Uso:
//   node scripts/audit-duplicate-athletes.mjs
//   node scripts/audit-duplicate-athletes.mjs --school "Dynasty"
//   node scripts/audit-duplicate-athletes.mjs --json salida.json
//   node scripts/audit-duplicate-athletes.mjs --min-signals 2   (solo casos duros)
//
// NO escribe nada. Lee con la service key de bff/.env.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);
const wantSchool = (arg('school') || '').trim().toLowerCase() || null;
const jsonOut = arg('json');
const minSignals = Number(arg('min-signals') || 1);

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, '../bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const URL_ = env.SUPABASE_URL.replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// PostgREST corta en 1000 filas: paginamos siempre.
async function all(path, select) {
  const out = [];
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const url = `${URL_}/rest/v1/${path}?select=${select}&limit=${PAGE}&offset=${off}&order=id`;
    const r = await fetch(url, { headers: H });
    const t = await r.text();
    if (!r.ok) { console.error(`ERROR ${path}: ${t.slice(0, 200)}`); process.exit(1); }
    const j = JSON.parse(t);
    out.push(...j);
    if (j.length < PAGE) break;
  }
  return out;
}

// ── normalización ───────────────────────────────────────────────────────────
const noAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normName = (s) => noAccents(s).toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const nameKey = (s) => {
  const toks = normName(s).split(' ').filter((t) => t.length >= 3);
  return toks.length >= 2 ? `name:${[...toks].sort().join('|')}` : null;
};
const docKey = (d) => {
  const n = String(d || '').replace(/\D/g, '');
  return n.length >= 6 ? `doc:${n}` : null;
};
const dobKey = (dob, name) => {
  if (!dob) return null;
  const toks = normName(name).split(' ').filter((t) => t.length >= 3).sort();
  return toks.length >= 2 ? `dob:${String(dob).slice(0, 10)}+${toks.slice(0, 2).join('|')}` : null;
};

console.log('='.repeat(78));
console.log('Proyecto :', URL_.replace('https://', '').split('.')[0]);
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

// ── identidades candidatas ──────────────────────────────────────────────────
const ids = [];
for (const c of kids) {
  ids.push({
    kind: 'child', id: c.id, school_id: c.school_id, name: c.full_name,
    doc: c.doc_number, dob: c.date_of_birth, is_active: c.is_active !== false,
    is_demo: !!c.is_demo, created_at: c.created_at,
    owner: c.parent_id ? (profById.get(c.parent_id)?.email || c.parent_id.slice(0, 8)) : (c.parent_email_temp || '❌ sin acudiente'),
  });
}
for (const u of uas) {
  ids.push({
    kind: 'unregistered', id: u.id, school_id: u.school_id, name: u.full_name,
    doc: u.doc_number, dob: u.date_of_birth, is_active: u.is_active !== false,
    linked: u.linked_profile_id, created_at: u.created_at,
    owner: u.email || u.phone || '-',
    // la vista solo lo muestra si NO está vinculado
    visible: !u.linked_profile_id,
  });
}
for (const m of members) {
  if (m.role !== 'athlete') continue;
  const p = profById.get(m.profile_id);
  if (!p) continue;
  ids.push({
    kind: 'adult', id: m.profile_id, school_id: m.school_id, name: p.full_name,
    doc: null, dob: p.date_of_birth, is_active: m.status !== 'inactive' && m.status !== 'removed',
    created_at: m.created_at, owner: p.email || p.phone || '-',
  });
}

// ── evidencia por pareja ────────────────────────────────────────────────────
// Coincidir por nombre NO alcanza: "VICTORIA GOMEZ" son tres niñas distintas en
// la misma escuela. Se pesa cada pareja y solo las CONFIRMADAS o PROBABLES se
// unen en un grupo; el resto se reporta aparte como homónimos.
const lev = (a, b) => {
  a = String(a || ''); b = String(b || '');
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};
const toks = (s) => new Set(normName(s).split(' ').filter((t) => t.length >= 3));
const digits = (d) => String(d || '').replace(/\D/g, '');
const localPart = (e) => String(e || '').split('@')[0].toLowerCase();

function evaluar(a, b) {
  const ta = toks(a.name), tb = toks(b.name);
  const inter = [...ta].filter((t) => tb.has(t));
  const nameSame = ta.size === tb.size && inter.length === ta.size;
  const nameSub = !nameSame && inter.length >= 2 && (inter.length === ta.size || inter.length === tb.size);
  const nameStrong = (nameSame || nameSub) && Math.max(ta.size, tb.size) >= 3; // 3 tokens = mucho más específico
  const da = digits(a.doc), db = digits(b.doc);
  const bothDoc = da.length >= 5 && db.length >= 5;
  const docSame = bothDoc && da === db;
  const docNear = bothDoc && !docSame && lev(da, db) <= 2;
  const docDiff = bothDoc && !docSame && !docNear;
  const bothDob = !!a.dob && !!b.dob;
  const dobSame = bothDob && String(a.dob).slice(0, 10) === String(b.dob).slice(0, 10);
  const dobDiff = bothDob && !dobSame;
  const ea = localPart(a.owner), eb = localPart(b.owner);
  const mailSame = ea && eb && ea === eb;
  const mailNear = ea && eb && !mailSame && ea.length > 4 && lev(ea, eb) <= 2;
  const razones = [];
  let veredicto;

  if (docSame && (nameSame || nameSub)) { veredicto = 'CONFIRMADO'; razones.push('mismo documento + mismo nombre'); }
  else if (docSame) { veredicto = 'DOC_REPETIDO'; razones.push(`mismo documento (${da}) con nombres distintos → documento mal digitado, no fusionar sin revisar`); }
  else if ((nameSame || nameSub) && dobSame) { veredicto = 'CONFIRMADO'; razones.push('mismo nombre + misma fecha de nacimiento'); }
  else if ((nameSame || nameSub) && docNear) { veredicto = 'CONFIRMADO'; razones.push(`documento con dígito de más/menos (${da} vs ${db})`); }
  else if ((nameSame || nameSub) && (mailSame || mailNear)) { veredicto = 'CONFIRMADO'; razones.push(mailSame ? 'mismo nombre + mismo acudiente' : `mismo nombre + correo del acudiente casi igual (${ea} vs ${eb})`); }
  else if (nameStrong) { veredicto = 'PROBABLE'; razones.push('nombre completo idéntico (3+ tokens) pero documento y/o fecha no cuadran → cada acudiente lo cargó a su manera'); }
  else if ((nameSame || nameSub) && !dobDiff && !docDiff) { veredicto = 'PROBABLE'; razones.push('mismo nombre y sin documento/fecha que lo desmienta'); }
  else { veredicto = 'HOMONIMO'; razones.push('mismo nombre pero documento y fecha de nacimiento distintos → personas distintas'); }

  if (docNear && veredicto === 'CONFIRMADO') razones.push('ojo: uno de los dos documentos está mal');
  if (dobDiff) razones.push(`fechas de nacimiento distintas (${String(a.dob).slice(0, 10)} vs ${String(b.dob).slice(0, 10)})`);
  return { veredicto, razones, nameSame, nameSub, docSame, dobSame };
}

const parent = new Map();
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
const key = (r) => `${r.school_id}|${r.kind}|${r.id}`;
for (const r of ids) parent.set(key(r), key(r));

const bySignal = new Map();
for (const r of ids) {
  const sigs = [docKey(r.doc), nameKey(r.name), dobKey(r.dob, r.name)].filter(Boolean);
  // token individual también, para pescar "Sergio Herrera" vs "Sergio Herrera Torres"
  for (const t of toks(r.name)) sigs.push(`tok:${t}`);
  r._sigs = sigs;
  for (const s of sigs) {
    const gk = `${r.school_id}::${s}`;
    if (!bySignal.has(gk)) bySignal.set(gk, []);
    bySignal.get(gk).push(r);
  }
}
const RANK = { CONFIRMADO: 3, PROBABLE: 2, DOC_REPETIDO: 1, HOMONIMO: 0 };
const pares = new Map();
for (const [, rows] of bySignal) {
  if (rows.length < 2) continue;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.id === b.id) continue;
      const pk = [key(a), key(b)].sort().join('##');
      if (pares.has(pk)) continue;
      const ev = evaluar(a, b);
      pares.set(pk, { a, b, ...ev });
      if (RANK[ev.veredicto] >= 2) union(key(a), key(b));
    }
  }
}
const descartados = [...pares.values()].filter((p) => RANK[p.veredicto] < 2);

// ── grupos ──────────────────────────────────────────────────────────────────
const groups = new Map();
for (const r of ids) {
  const root = find(key(r));
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(r);
}

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
for (const [root, rows] of groups) {
  if (rows.length < 2) continue;
  const misPares = [...pares.values()].filter((p) => find(key(p.a)) === root && RANK[p.veredicto] >= 2);
  if (!misPares.length) continue;
  const veredicto = misPares.some((p) => p.veredicto === 'CONFIRMADO') ? 'CONFIRMADO' : 'PROBABLE';
  const razones = [...new Set(misPares.flatMap((p) => p.razones))];
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
