// ============================================================================
// Auditoría READ-ONLY — regla "prueba = fecha de registro + 2 meses".
//
// Decisión 2026-08-12 (dueño del producto):
//   · La prueba se cuenta desde `schools.created_at` y dura 2 meses.
//     (El default del registro pasa a 1 mes; 2 es lo que se dio hasta hoy.)
//   · Dynasty sigue en pruebas: aviso al owner, NO se bloquea.
//   · Demos no se bloquean.
//   · El resto: aviso mientras le quede tiempo; bloqueo pasados los 2 meses.
//
// Este script NO escribe nada. Sirve para revisar a quién le pega el corte
// antes de aplicarlo, porque hay escuelas con dinero adentro en la cohorte.
//
// Uso: node scripts/audit-trial-2meses-2026-08-12.mjs
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const { all, proyecto } = conectar();
const HOY = new Date('2026-08-12T12:00:00-05:00');
const MESES_PRUEBA = 2;
const DYNASTY = '2d509571-3238-4c04-ac3f-6dfe20539226';

const masMeses = (iso, meses) => {
  const d = new Date(iso);
  const r = new Date(d);
  r.setMonth(r.getMonth() + meses);
  return r;
};
const dias = (a, b) => Math.ceil((a.getTime() - b.getTime()) / 86400000);
const n = (x) => x.toLocaleString('es-CO');

console.log(`Proyecto: ${proyecto} · hoy ${HOY.toISOString().slice(0, 10)} · prueba = registro + ${MESES_PRUEBA} meses\n`);

const [schools, subs, members, athletes, enrollments, payments, teams, profiles] = await Promise.all([
  all('schools', 'id,name,owner_id,created_at,is_demo,school_type', { order: 'created_at' }),
  all('school_subscriptions', 'school_id,plan_code,tier,status,trial_ends_at', { order: 'school_id' }),
  all('school_members', 'school_id,profile_id,role,status', { order: 'id' }),
  all('school_athletes', 'school_id,is_active,enrollment_status', { order: 'id' }),
  all('enrollments', 'school_id,status', { order: 'id' }),
  all('payments', 'school_id,status,amount', { order: 'id' }),
  all('teams', 'school_id', { order: 'id' }),
  all('profiles', 'id,email', { order: 'id' }),
]);

const idx = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {});
const subOf = Object.fromEntries(subs.map((s) => [s.school_id, s]));
const memOf = idx(members, 'school_id');
const athOf = idx(athletes, 'school_id');
const enrOf = idx(enrollments, 'school_id');
const payOf = idx(payments, 'school_id');
const teamOf = idx(teams, 'school_id');
const emailOf = Object.fromEntries(profiles.map((p) => [p.id, p.email]));

const filas = schools.map((s) => {
  const sub = subOf[s.id];
  const ath = athOf[s.id] || [];
  const enr = enrOf[s.id] || [];
  const pay = payOf[s.id] || [];
  const pagados = pay.filter((p) => ['paid', 'partial'].includes(p.status));
  const atletasActivos = ath.filter((a) => a.is_active && a.enrollment_status === 'active').length;
  const inscActivas = enr.filter((e) => ['active', 'paid'].includes(e.status)).length;
  const recaudado = pagados.reduce((a, p) => a + Number(p.amount || 0), 0);

  const fin = masMeses(s.created_at, MESES_PRUEBA);
  const diasRestantes = dias(fin, HOY);
  const enUso = atletasActivos > 0 || inscActivas > 0 || pagados.length > 0;
  const status = sub?.status || '(SIN SUB)';

  // Clasificación bajo la regla acordada.
  let clase;
  if (s.id === DYNASTY) clase = 'EXENTA · dynasty (sigue en pruebas, aviso al owner)';
  else if (s.is_demo) clase = 'EXENTA · demo';
  else if (status === 'grandfathered') clase = 'EXENTA · grandfathered (G-PAGA)';
  else if (diasRestantes <= 0) clase = 'BLOQUEAR';
  else clase = `AVISO (${diasRestantes} d)`;

  return {
    id: s.id, nombre: s.name, owner: emailOf[s.owner_id] || '(sin owner)',
    creada: (s.created_at || '').slice(0, 10), fin: fin.toISOString().slice(0, 10),
    diasRestantes, is_demo: s.is_demo, status, plan: sub ? `${sub.plan_code}/${sub.tier}` : '—',
    atletas: ath.length, atletasActivos, inscActivas, cobros: pay.length,
    cobrosPagados: pagados.length, recaudado, equipos: (teamOf[s.id] || []).length,
    miembros: (memOf[s.id] || []).filter((m) => m.status === 'active').length,
    enUso, clase,
  };
});

// ── 1. Resumen ──────────────────────────────────────────────────────────────
console.log('== 1. Clasificación bajo la regla (registro + 2 meses) ==');
const grupos = filas.reduce((m, f) => ((m[f.clase.split(' (')[0]] ||= []).push(f), m), {});
for (const [g, arr] of Object.entries(grupos).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${g.padEnd(48)} ${String(arr.length).padStart(4)}`);
}

// ── 2. Lo que se bloquearía CON uso real → revisar antes de cortar ──────────
console.log('\n== 2. ⚠  BLOQUEAR pero están EN USO (atletas activos, inscripciones o dinero) ==');
const peligro = filas.filter((f) => f.clase === 'BLOQUEAR' && f.enUso)
  .sort((a, b) => b.recaudado - a.recaudado || b.atletasActivos - a.atletasActivos);
if (!peligro.length) console.log('  (ninguna)');
console.log('  escuela | registro | fin prueba | status | atl.act | insc.act | pagados | recaudado | owner');
for (const f of peligro) {
  console.log(`  ${f.nombre.slice(0, 38).padEnd(38)} | ${f.creada} | ${f.fin} | ${f.status.padEnd(9)} | ${String(f.atletasActivos).padStart(7)} | ${String(f.inscActivas).padStart(8)} | ${String(f.cobrosPagados).padStart(7)} | ${n(f.recaudado).padStart(12)} | ${f.owner}`);
}
console.log(`\n  → ${peligro.length} escuelas · ${n(peligro.reduce((a, f) => a + f.recaudado, 0))} recaudado · ${n(peligro.reduce((a, f) => a + f.atletasActivos, 0))} atletas activos quedarían fuera.`);

// ── 3. Bloqueo sin daño aparente ────────────────────────────────────────────
const dormidasBloqueo = filas.filter((f) => f.clase === 'BLOQUEAR' && !f.enUso);
console.log(`\n== 3. BLOQUEAR y dormidas (sin atletas activos ni dinero): ${dormidasBloqueo.length} ==`);
const conAlgo = dormidasBloqueo.filter((f) => f.atletas || f.cobros || f.equipos || f.miembros > 1);
console.log(`  De esas, con algo cargado (atletas/cobros/equipos/miembros>1): ${conAlgo.length}`);
for (const f of conAlgo.sort((a, b) => b.miembros - a.miembros).slice(0, 25)) {
  console.log(`    ${f.nombre.slice(0, 38).padEnd(38)} | ${f.creada} | ${f.status.padEnd(9)} | atl ${String(f.atletas).padStart(4)} | cobros ${String(f.cobros).padStart(4)} | eq ${String(f.equipos).padStart(2)} | miem ${String(f.miembros).padStart(3)} | ${f.owner}`);
}

// ── 4. Las que verían el contador (aviso) ───────────────────────────────────
console.log('\n== 4. AVISO — les queda tiempo de prueba ==');
const aviso = filas.filter((f) => f.clase.startsWith('AVISO')).sort((a, b) => a.diasRestantes - b.diasRestantes);
console.log('  escuela | registro | fin prueba | días | en uso | status | owner');
for (const f of aviso) {
  console.log(`  ${f.nombre.slice(0, 38).padEnd(38)} | ${f.creada} | ${f.fin} | ${String(f.diasRestantes).padStart(4)} | ${f.enUso ? 'sí ' : 'no '} | ${f.status.padEnd(9)} | ${f.owner}`);
}

// ── 5. Exentas ──────────────────────────────────────────────────────────────
console.log('\n== 5. EXENTAS ==');
for (const f of filas.filter((x) => x.clase.startsWith('EXENTA')).sort((a, b) => b.recaudado - a.recaudado)) {
  console.log(`  ${f.nombre.slice(0, 40).padEnd(40)} | ${f.clase.replace('EXENTA · ', '').padEnd(42)} | reg ${f.creada} | fin ${f.fin} | atl.act ${String(f.atletasActivos).padStart(4)} | recaudado ${n(f.recaudado).padStart(12)}`);
}

// ── 6. Distribución por mes de registro ─────────────────────────────────────
console.log('\n== 6. Registros por mes (para ver el peso del corte) ==');
const porMes = filas.reduce((m, f) => ((m[f.creada.slice(0, 7)] ||= { total: 0, bloquear: 0, aviso: 0 }), m[f.creada.slice(0, 7)].total++, f.clase === 'BLOQUEAR' ? m[f.creada.slice(0, 7)].bloquear++ : f.clase.startsWith('AVISO') && m[f.creada.slice(0, 7)].aviso++, m), {});
for (const [mes, v] of Object.entries(porMes).sort()) {
  console.log(`  ${mes}  total ${String(v.total).padStart(4)} · bloquear ${String(v.bloquear).padStart(4)} · aviso ${String(v.aviso).padStart(3)}`);
}
