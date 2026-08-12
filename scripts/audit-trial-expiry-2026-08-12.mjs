// ============================================================================
// Auditoría READ-ONLY — ¿a quién le pegaría el bloqueo por fin de prueba?
//
// Contexto: decisión 2026-08-12 → aviso ahora + bloqueo el 2026-08-20 para las
// escuelas en prueba; Dynasty avisa SOLO al owner y NO se bloquea (está en uso).
//
// Clasifica cada escuela por estado de suscripción y por uso real (atletas,
// inscripciones, cobros, equipos, staff), para separar "dormida" de "en uso"
// antes de cortarle el acceso a nadie.
//
// Uso: node scripts/audit-trial-expiry-2026-08-12.mjs
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const { all, proyecto } = conectar();
const CORTE = new Date('2026-08-20T23:59:59-05:00');
const HOY = new Date('2026-08-12T12:00:00-05:00');

console.log(`Proyecto: ${proyecto} · corte ${CORTE.toISOString().slice(0, 10)}\n`);

const [schools, subs, members, athletes, enrollments, payments, teams, profiles] = await Promise.all([
  all('schools', 'id,name,owner_id,created_at,is_demo,school_type', { order: 'created_at' }),
  all('school_subscriptions', 'school_id,plan_code,tier,status,trial_ends_at,current_period_end,metadata', { order: 'school_id' }),
  all('school_members', 'school_id,profile_id,role,status', { order: 'id' }),
  all('school_athletes', 'school_id,is_active,enrollment_status', { order: 'id' }),
  all('enrollments', 'school_id,status,created_at', { order: 'id' }),
  all('payments', 'school_id,status,amount,created_at', { order: 'id' }),
  all('teams', 'school_id,name', { order: 'id' }),
  all('profiles', 'id,email,full_name,role', { order: 'id' }),
]);

const idx = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {});
const bySchool = {
  subs: Object.fromEntries(subs.map((s) => [s.school_id, s])),
  members: idx(members, 'school_id'),
  athletes: idx(athletes, 'school_id'),
  enrollments: idx(enrollments, 'school_id'),
  payments: idx(payments, 'school_id'),
  teams: idx(teams, 'school_id'),
};
const emailOf = Object.fromEntries(profiles.map((p) => [p.id, p.email]));

const filas = schools.map((s) => {
  const sub = bySchool.subs[s.id];
  const ath = bySchool.athletes[s.id] || [];
  const enr = bySchool.enrollments[s.id] || [];
  const pay = bySchool.payments[s.id] || [];
  const mem = (bySchool.members[s.id] || []).filter((m) => m.status === 'active');
  const pagados = pay.filter((p) => ['paid', 'partial'].includes(p.status));

  // "En uso" = tiene atletas activos con inscripción viva, o movió dinero.
  const atletasActivos = ath.filter((a) => a.is_active && a.enrollment_status === 'active').length;
  const inscActivas = enr.filter((e) => ['active', 'paid'].includes(e.status)).length;
  const enUso = atletasActivos > 0 || inscActivas > 0 || pagados.length > 0;

  return {
    id: s.id,
    nombre: s.name,
    owner: emailOf[s.owner_id] || '(sin owner)',
    creada: (s.created_at || '').slice(0, 10),
    is_demo: s.is_demo,
    plan: sub ? `${sub.plan_code}/${sub.tier}` : '(SIN SUB)',
    status: sub?.status || '(SIN SUB)',
    trial_ends_at: sub?.trial_ends_at ? sub.trial_ends_at.slice(0, 10) : null,
    trialVencido: sub?.trial_ends_at ? new Date(sub.trial_ends_at) < HOY : null,
    atletas: ath.length,
    atletasActivos,
    inscTotal: enr.length,
    inscActivas,
    cobros: pay.length,
    cobrosPagados: pagados.length,
    recaudado: pagados.reduce((a, p) => a + Number(p.amount || 0), 0),
    equipos: (bySchool.teams[s.id] || []).length,
    miembros: mem.length,
    enUso,
  };
});

const n = (x) => x.toLocaleString('es-CO');

// ── 1. Panorama por status ──────────────────────────────────────────────────
console.log('== 1. Suscripciones por status ==');
const porStatus = filas.reduce((m, f) => ((m[f.status] ||= { total: 0, enUso: 0, dormidas: 0 }), m[f.status].total++, f.enUso ? m[f.status].enUso++ : m[f.status].dormidas++, m), {});
for (const [st, v] of Object.entries(porStatus).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${st.padEnd(16)} ${String(v.total).padStart(4)}  (en uso: ${v.enUso}, dormidas: ${v.dormidas})`);
}

console.log(`\n  Escuelas totales: ${filas.length} · en uso: ${filas.filter((f) => f.enUso).length} · dormidas: ${filas.filter((f) => !f.enUso).length}`);
console.log(`  is_demo=true: ${filas.filter((f) => f.is_demo).length}`);

// ── 2. Las que están en uso de verdad (candidatas a NO bloquear) ────────────
console.log('\n== 2. Escuelas EN USO (atletas activos, inscripciones vivas o dinero) ==');
const enUso = filas.filter((f) => f.enUso).sort((a, b) => b.recaudado - a.recaudado || b.atletasActivos - a.atletasActivos);
console.log('  escuela | status | trial_ends | atl.act | insc.act | pagados | recaudado | owner');
for (const f of enUso) {
  console.log(`  ${f.nombre.slice(0, 42).padEnd(42)} | ${f.status.padEnd(13)} | ${(f.trial_ends_at || '—').padEnd(10)} | ${String(f.atletasActivos).padStart(7)} | ${String(f.inscActivas).padStart(8)} | ${String(f.cobrosPagados).padStart(7)} | ${n(f.recaudado).padStart(12)} | ${f.owner}`);
}

// ── 3. A quién le pegaría el bloqueo ───────────────────────────────────────
console.log('\n== 3. A quién le pegaría el bloqueo del 2026-08-20 ==');
const bloqueables = filas.filter((f) => !f.is_demo && !f.enUso);
console.log(`  Dormidas y no demo (bloqueo sin daño aparente): ${bloqueables.length}`);
const conMovimiento = filas.filter((f) => !f.enUso && (f.atletas > 0 || f.inscTotal > 0 || f.cobros > 0 || f.equipos > 0));
console.log(`  De esas, con ALGO cargado (atletas/insc/cobros/equipos aunque inactivo): ${conMovimiento.length}`);
console.log('\n  -- Dormidas pero con datos cargados (revisar una por una) --');
for (const f of conMovimiento.sort((a, b) => (b.atletas + b.inscTotal + b.cobros + b.equipos) - (a.atletas + a.inscTotal + a.cobros + a.equipos)).slice(0, 40)) {
  console.log(`  ${f.nombre.slice(0, 40).padEnd(40)} | ${f.status.padEnd(13)} | atl ${String(f.atletas).padStart(4)} | insc ${String(f.inscTotal).padStart(3)} | cobros ${String(f.cobros).padStart(4)} | eq ${String(f.equipos).padStart(3)} | miem ${String(f.miembros).padStart(3)} | ${f.creada} | ${f.owner}`);
}

// ── 4. Dynasty y la escuela de patinaje ────────────────────────────────────
console.log('\n== 4. Casos nombrados ==');
for (const clave of ['dynasty', 'patinaje real bogota']) {
  for (const f of filas.filter((x) => x.nombre.toLowerCase().includes(clave))) {
    console.log(`  ${f.nombre}`);
    console.log(`    id=${f.id} owner=${f.owner} creada=${f.creada}`);
    console.log(`    plan=${f.plan} status=${f.status} trial_ends_at=${f.trial_ends_at} (vencido: ${f.trialVencido})`);
    console.log(`    atletas=${f.atletas} (activos ${f.atletasActivos}) insc=${f.inscTotal} (activas ${f.inscActivas}) cobros=${f.cobros} (pagados ${f.cobrosPagados}) recaudado=${n(f.recaudado)} equipos=${f.equipos} miembros=${f.miembros}`);
  }
}

// ── 5. Cuántos usuarios verían el aviso ────────────────────────────────────
console.log('\n== 5. Alcance del aviso ==');
const owners = members.filter((m) => m.role === 'owner' && m.status === 'active');
console.log(`  school_members role=owner activos: ${owners.length} (perfiles distintos: ${new Set(owners.map((o) => o.profile_id)).size})`);
console.log(`  escuelas sin owner activo en school_members: ${filas.filter((f) => !owners.some((o) => o.school_id === f.id)).length}`);
