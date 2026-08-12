// ============================================================================
// SportMaps — atletas duplicados y COBROS DUPLICADOS (READ-ONLY)
//
// Responde la pregunta que dejó abierta la auditoría de Dynasty del 8-ago:
// «cada lado del duplicado es facturable por separado; falta cruzar los cobros
// de ambos lados para saber cuántos ya cobraron dos veces».
//
// Tres ejes, porque son fallas DISTINTAS con arreglos distintos:
//
//   EJE A — dos cobros del MISMO periodo sobre la MISMA identidad.
//     Es lo que los índices únicos de `20260724000001_payment_period_dedup_indexes`
//     ya deberían impedir. Si aparece algo acá, o los índices no están aplicados
//     en esta base, o el cobro entró por el hueco de A2.
//
//   EJE A2 — cobros con `period_year/period_month` en NULL.
//     Los índices son PARCIALES (`WHERE period_year IS NOT NULL`): un cobro sin
//     periodo NO está protegido por nada. Se deduplica por mes de `due_date`.
//
//   EJE B — dos cobros del mismo periodo repartidos entre DOS IDENTIDADES de la
//     misma persona. Los índices únicos NO pueden verlo: son claves por
//     `child_id` / `user_id` / `unregistered_athlete_id`, y acá cada cobro cuelga
//     de un sujeto distinto. Es el caso de Dynasty y solo se detecta agrupando
//     identidades primero (misma heurística que `audit-duplicate-athletes.mjs`).
//
//   EJE C — riesgo a futuro: 2+ inscripciones ACTIVAS sobre el mismo atleta o
//     grupo. Todavía no hay cobro doble, pero la próxima apertura de mes lo crea.
//
// A diferencia del barrido de identidades, el cruce de EJE B deduplica por
// PERIODO SOLO, no por periodo+monto: dos identidades con planes distintos
// cobran montos distintos y el test de monto igual se los perdía.
//
// Uso:
//   node scripts/audit-cobros-duplicados.mjs
//   node scripts/audit-cobros-duplicados.mjs --school "Dynasty"
//   node scripts/audit-cobros-duplicados.mjs --school Dynasty --json salida.json
//   node scripts/audit-cobros-duplicados.mjs --desde 2026-08     (periodos >= )
//   node scripts/audit-cobros-duplicados.mjs --solo-plata        (solo lo ya cobrado)
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
const desde = (arg('desde') || '').trim() || null;   // 'YYYY-MM'
const soloPlata = has('solo-plata');
const jsonOut = arg('json');

const { proyecto, all } = conectar();

// Conjunto canónico de estados con obligación VIVA (igual que los índices únicos).
const ACTIVO = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);
const PAGO = new Set(['paid', 'partial']);            // plata que ya entró
const IMPAGO = new Set(['pending', 'overdue', 'glosado', 'awaiting_approval']);

const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
// Periodo efectivo del cobro: la columna si está, si no el mes del vencimiento.
const periodo = (p) => (
  p.period_year && p.period_month
    ? `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
    : (p.due_date || '').slice(0, 7) || '(sin periodo)'
);
const sujeto = (p) => p.child_id || p.unregistered_athlete_id || p.user_id || null;

console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Barrido  : atletas duplicados + cobros duplicados (READ-ONLY)');
if (wantSchool) console.log('Escuela  :', wantSchool);
if (desde) console.log('Periodos : >=', desde);
console.log('='.repeat(78));

// ── carga ───────────────────────────────────────────────────────────────────
const [schools, kids, uas, members, profs, enrs, pays] = await Promise.all([
  all('schools', 'id,name'),
  all('children', 'id,school_id,full_name,doc_number,date_of_birth,parent_id,parent_email_temp,team_id,monthly_fee,is_active,is_demo,created_at'),
  all('unregistered_athletes', 'id,school_id,full_name,doc_number,date_of_birth,email,phone,is_active,linked_profile_id,created_at'),
  all('school_members', 'id,profile_id,school_id,role,status,created_at'),
  all('profiles', 'id,full_name,email,phone,date_of_birth,role,created_at'),
  all('enrollments', 'id,school_id,user_id,child_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee,created_at'),
  all('payments', 'id,school_id,user_id,child_id,unregistered_athlete_id,parent_id,status,amount,amount_paid,concept,due_date,payment_date,receipt_url,period_year,period_month,payment_type,last_reminder_sent,reminder_sent_at,created_at'),
]);
const schoolName = new Map(schools.map((s) => [s.id, s.name]));
const profById = new Map(profs.map((p) => [p.id, p]));
const enEscuela = (sid) => !wantSchool || String(schoolName.get(sid) || sid).toLowerCase().includes(wantSchool);
console.log(`\nCargado: ${schools.length} escuelas · ${kids.length} children · ${uas.length} unregistered · ${members.length} school_members · ${enrs.length} inscripciones · ${pays.length} cobros`);

// Nombre legible de cualquier sujeto, para reportar sin volver a la base.
const nombreSujeto = new Map();
for (const c of kids) nombreSujeto.set(c.id, c.full_name);
for (const u of uas) nombreSujeto.set(u.id, u.full_name);
for (const p of profs) nombreSujeto.set(p.id, p.full_name);

const activos = pays.filter((p) => ACTIVO.has(p.status));
const paysBySubject = new Map();
for (const p of activos) {
  const s = sujeto(p);
  if (!s) continue;
  if (!paysBySubject.has(s)) paysBySubject.set(s, []);
  paysBySubject.get(s).push(p);
}
const enrBySubject = new Map();
for (const e of enrs) {
  for (const k of [e.child_id, e.unregistered_athlete_id, e.user_id].filter(Boolean)) {
    if (!enrBySubject.has(k)) enrBySubject.set(k, []);
    enrBySubject.get(k).push(e);
  }
}

const pasaDesde = (per) => !desde || (per >= desde && per !== '(sin periodo)');

// Concepto normalizado: sin nombre del atleta, sin fechas, sin cifras ni días.
// Sirve para distinguir un cobro REPETIDO de dos cobros LEGÍTIMOS del mismo mes.
// Un atleta en tres equipos tiene tres cobros mensuales válidos (multi-categoría):
// "Equipo COMBATE MMA", "Equipo GRAPPLING MMA" y "Equipo MMA" NO son duplicados.
const normConcepto = (c) => String(c || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\d+/g, ' ')                                    // montos, días, fechas
  .replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\b/g, ' ')
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\b(de|del|la|el|los|las|y|a|vence|dia|dias|ciclo|mensualidad|mensual|pago|completa)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Cobros de una sola vez: no se comparan contra la mensualidad del mes.
const esUnicaVez = (c) => /matricul|inscripcion|uniforme|torneo|examen|carnet|kit|implement|multa|sancion/
  .test(String(c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
// Clasifica un choque de cobros por dónde está la plata: define el arreglo.
const clasificar = (rows) => {
  const pagados = rows.filter((p) => PAGO.has(p.status));
  const impagos = rows.filter((p) => IMPAGO.has(p.status) && !PAGO.has(p.status));
  if (pagados.length > 1) {
    return { sev: 'CRITICO', accion: `${pagados.length} cobros PAGADOS del mismo periodo → hay plata cobrada de más, revisar devolución`, plata: pagados.slice(1).reduce((a, p) => a + Number(p.amount_paid ?? p.amount ?? 0), 0) };
  }
  if (pagados.length === 1 && impagos.length) {
    return { sev: 'ALTO', accion: `ya pagó uno; los otros ${impagos.length} están vivos → anular los impagos (la familia los ve como deuda)`, plata: 0 };
  }
  const conComprobante = impagos.filter((p) => p.receipt_url || p.status === 'awaiting_approval');
  return {
    sev: 'ALTO',
    accion: conComprobante.length
      ? `${impagos.length} cobros impagos del mismo periodo, ${conComprobante.length} con comprobante → conservar el del comprobante y anular el resto`
      : `${impagos.length} cobros impagos del mismo periodo → conservar el más antiguo y anular el resto`,
    plata: 0,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// EJE A / A2 — misma identidad, mismo periodo
// ════════════════════════════════════════════════════════════════════════════
const ejeA = [];
for (const [subj, rows] of paysBySubject) {
  const porPeriodo = new Map();
  for (const p of rows) {
    // El choque solo existe dentro de la misma escuela.
    const k = `${p.school_id}|${periodo(p)}`;
    if (!porPeriodo.has(k)) porPeriodo.set(k, []);
    porPeriodo.get(k).push(p);
  }
  for (const [k, rs] of porPeriodo) {
    if (rs.length < 2) continue;
    const [sid, per] = k.split('|');
    if (!enEscuela(sid) || !pasaDesde(per)) continue;
    const sinPeriodo = rs.some((p) => !p.period_year || !p.period_month);

    // Dentro del mes, solo es duplicado lo que se REPITE: mismo concepto
    // normalizado o mismo monto. Dos equipos distintos del mismo mes son cobros
    // legítimos (multi-categoría), no un duplicado.
    const choque = new Map();
    for (const p of rs) {
      for (const kk of [`c:${normConcepto(p.concept)}`, `m:${Number(p.amount || 0)}`]) {
        if (!choque.has(kk)) choque.set(kk, []);
        choque.get(kk).push(p);
      }
    }
    const vistos = new Set();
    for (const [kk, grupo] of choque) {
      if (grupo.length < 2) continue;
      const firma = grupo.map((p) => p.id).sort().join(',');
      if (vistos.has(firma)) continue;
      vistos.add(firma);
      const cls = clasificar(grupo);
      ejeA.push({
        eje: sinPeriodo ? 'A2' : 'A',
        school_id: sid, school: schoolName.get(sid) || sid,
        subject_id: subj, nombre: nombreSujeto.get(subj) || subj,
        periodo: per, cobros: grupo, ...cls,
        criterio: kk.startsWith('c:') ? 'mismo concepto' : 'mismo monto',
        // Si el periodo está poblado y aun así hay dos, el índice único no está haciendo su trabajo.
        nota: sinPeriodo
          ? 'periodo en NULL → fuera del índice único parcial, nada lo impedía'
          : 'periodo poblado y duplicado igual → el índice único de F0 no está aplicado en esta base',
      });
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// EJE B / C — identidades distintas de la misma persona
// ════════════════════════════════════════════════════════════════════════════
const ids = construirIdentidades({ kids, uas, members, profById });
const { grupos } = agruparIdentidades(ids);

const ejeB = [], ejeC = [];
for (const { rows, veredicto, razones } of grupos) {
  const sid = rows[0].school_id;
  if (!enEscuela(sid)) continue;
  const sname = schoolName.get(sid) || sid;

  const detalle = rows.map((r) => {
    const es = (enrBySubject.get(r.id) || []).filter((e) => e.school_id === sid);
    const act = es.filter((e) => e.status === 'active');
    const ps = (paysBySubject.get(r.id) || []).filter((p) => p.school_id === sid);
    return {
      ...r,
      activas: act.length,
      fee: act.map((e) => e.monthly_fee).find((v) => v != null) ?? null,
      cobros: ps,
      pagado: ps.filter((p) => PAGO.has(p.status)).reduce((a, p) => a + Number(p.amount_paid ?? p.amount ?? 0), 0),
    };
  });

  // Sobreviviente sugerido: la identidad que puede entrar, pagar y ya pagó.
  const puntaje = (d) => (
    (d.kind === 'adult' ? 1000 : 0) + (d.pagado > 0 ? 500 : 0) +
    (d.owner && !String(d.owner).startsWith('❌') ? 200 : 0) +
    (d.activas > 0 ? 100 : 0) + (d.fee ? 50 : 0) + Math.min(d.cobros.length, 20)
  );
  const orden = [...detalle].sort((a, b) => puntaje(b) - puntaje(a));

  // ── EJE B: un periodo cobrado en 2+ identidades del grupo ─────────────────
  const porPeriodo = new Map();
  for (const d of detalle) {
    for (const p of d.cobros) {
      const per = periodo(p);
      if (!porPeriodo.has(per)) porPeriodo.set(per, new Map());
      const m = porPeriodo.get(per);
      if (!m.has(d.id)) m.set(d.id, []);
      m.get(d.id).push(p);
    }
  }
  const choques = [];
  for (const [per, porId] of porPeriodo) {
    if (porId.size < 2 || !pasaDesde(per)) continue;
    const rs = [...porId.values()].flat();
    choques.push({ periodo: per, porId, ...clasificar(rs) });
  }
  if (choques.length) {
    ejeB.push({
      school_id: sid, school: sname, veredicto, razones,
      nombre: rows[0].name,
      sobrevive: orden[0], absorben: orden.slice(1),
      identidades: detalle, choques,
      plata: choques.reduce((a, c) => a + c.plata, 0),
      cobrado_de_mas: choques.reduce((a, c) => a + [...c.porId.values()].flat().slice(1).reduce((x, p) => x + Number(p.amount || 0), 0), 0),
    });
  }

  // ── EJE C: riesgo a futuro sin cobro doble todavía ────────────────────────
  const facturables = detalle.filter((d) => d.activas > 0);
  if (facturables.length > 1 && !choques.length) {
    ejeC.push({
      school_id: sid, school: sname, veredicto, tipo: 'grupo',
      nombre: rows[0].name, identidades: detalle,
      sobrevive: orden[0], absorben: orden.slice(1),
      riesgo: facturables.slice(1).reduce((a, d) => a + Number(d.fee || 0), 0),
    });
  }
}

// EJE C también sobre una sola identidad: 2+ inscripciones activas = doble cobro
// en la próxima apertura (el bug F0 de multi-categoría por `team_id`).
for (const [subj, es] of enrBySubject) {
  const porEscuela = new Map();
  for (const e of es.filter((x) => x.status === 'active')) {
    if (!porEscuela.has(e.school_id)) porEscuela.set(e.school_id, []);
    porEscuela.get(e.school_id).push(e);
  }
  for (const [sid, act] of porEscuela) {
    if (act.length < 2 || !enEscuela(sid)) continue;
    ejeC.push({
      school_id: sid, school: schoolName.get(sid) || sid, tipo: 'misma-identidad',
      nombre: nombreSujeto.get(subj) || subj, subject_id: subj,
      activas: act,
      riesgo: act.slice(1).reduce((a, e) => a + Number(e.monthly_fee || 0), 0),
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CORREOS INDEBIDOS — el síntoma que reporta la escuela
// ------------------------------------------------------------
// Un cobro impago (pending/overdue) de un PERIODO QUE LA PERSONA YA PAGÓ, sea
// en esta identidad o en la gemela. El recordatorio de mora no sabe que son la
// misma persona: mira el cobro suelto, lo ve impago y le escribe a una familia
// que ya pagó. Es lo que hay que anular primero.
// ════════════════════════════════════════════════════════════════════════════
const personaDe = new Map();       // subject_id → clave de persona
for (const g of grupos) {
  const clave = `grupo:${g.root}`;
  for (const r of g.rows) personaDe.set(r.id, clave);
}
const claveP = (subj) => personaDe.get(subj) || `solo:${subj}`;

const porPersona = new Map();      // persona|escuela|periodo → cobros
for (const p of activos) {
  const s = sujeto(p);
  if (!s || !enEscuela(p.school_id)) continue;
  // Separador '@@': la clave de persona ya contiene '|' (identityKey).
  const k = `${claveP(s)}@@${p.school_id}@@${periodo(p)}`;
  if (!porPersona.has(k)) porPersona.set(k, []);
  porPersona.get(k).push(p);
}

const correos = [];
for (const [k, rs] of porPersona) {
  const [, sid, per] = k.split('@@');
  if (!pasaDesde(per)) continue;
  // La matrícula no cancela la mensualidad ni al revés. OJO: `payment_type` NO
  // sirve para distinguirlas — en Dynasty la mensualidad pagada viene como
  // 'one_time' y la duplicada pendiente como 'subscription'. Se clasifica por
  // concepto, que es lo único fiable.
  const mensual = rs.filter((p) => !esUnicaVez(p.concept));
  const pagados = mensual.filter((p) => PAGO.has(p.status));
  const impagos = mensual.filter((p) => IMPAGO.has(p.status) && !PAGO.has(p.status));
  if (!pagados.length || !impagos.length) continue;

  // Guard de concepto/monto SOLO entre cobros de la misma identidad: ahí dos
  // cobros del mes pueden ser legítimos (dos equipos distintos, multi-categoría).
  // Si el cobro pagado está en OTRA identidad de la misma persona, la colisión de
  // periodo ya es el duplicado: los planes difieren y el concepto lleva el nombre
  // embebido, así que exigir concepto/monto igual los dejaría pasar.
  const sospechosos = impagos.filter((p) => {
    const otros = pagados.filter((q) => sujeto(q) !== sujeto(p));
    if (otros.length) return true;
    const firmas = new Set(pagados.flatMap((q) => [`c:${normConcepto(q.concept)}`, `m:${Number(q.amount || 0)}`]));
    return firmas.has(`c:${normConcepto(p.concept)}`) || firmas.has(`m:${Number(p.amount || 0)}`);
  });
  if (!sospechosos.length) continue;
  for (const p of sospechosos) {
    const subj = sujeto(p);
    correos.push({
      school_id: sid, school: schoolName.get(sid) || sid,
      periodo: per,
      nombre: nombreSujeto.get(subj) || subj,
      subject_id: subj,
      mismaPersonaOtraIdentidad: pagados.some((q) => sujeto(q) !== subj),
      cobro: p,
      pagados,
      recordatorio: p.last_reminder_sent || p.reminder_sent_at || null,
      monto: Number(p.amount || 0),
    });
  }
}
correos.sort((a, b) => (b.recordatorio ? 1 : 0) - (a.recordatorio ? 1 : 0) || b.monto - a.monto);

// ════════════════════════════════════════════════════════════════════════════
// EJE D — cobros que NACIERON VENCIDOS
// ------------------------------------------------------------
// Un cobro creado DESPUÉS de su propia `due_date` entra al mundo en mora: el
// atleta nunca tuvo un día para pagarlo a tiempo. Pasa cuando se asigna el plan
// y el cobro se emite con el vencimiento del mes de inscripción, ya pasado
// (concepto "Plan PLAN X"). La familia recibe «estás en mora» por un cobro que
// ayer no existía — y muchas ya pagaron el mes corriente aparte.
// No es un duplicado: es un cobro legítimo emitido tarde y cobrado como moroso.
// ════════════════════════════════════════════════════════════════════════════
const ejeD = [];
for (const p of activos) {
  if (!p.due_date || !enEscuela(p.school_id)) continue;
  if (!IMPAGO.has(p.status) || PAGO.has(p.status)) continue;
  const creado = (p.created_at || '').slice(0, 10);
  if (!creado || creado <= p.due_date) continue;
  const subj = sujeto(p);
  const per = periodo(p);
  if (!pasaDesde(per)) continue;
  // ¿Ya pagó otro periodo posterior? Entonces está al día y la mora es del cobro retro.
  const otros = (paysBySubject.get(subj) || []).filter((q) => q.school_id === p.school_id && PAGO.has(q.status) && periodo(q) > per);
  const dias = Math.round((new Date(creado) - new Date(p.due_date)) / 86400000);
  ejeD.push({
    school_id: p.school_id, school: schoolName.get(p.school_id) || p.school_id,
    nombre: nombreSujeto.get(subj) || subj, subject_id: subj,
    cobro: p, periodo: per, creado, diasTarde: dias,
    yaPagoPosterior: otros.length > 0, posteriores: otros,
    monto: Number(p.amount || 0),
  });
}
ejeD.sort((a, b) => (b.yaPagoPosterior ? 1 : 0) - (a.yaPagoPosterior ? 1 : 0) || b.diasTarde - a.diasTarde);

// ════════════════════════════════════════════════════════════════════════════
// EJE E — el pago quedó rotulado al mes anterior (REVISAR, no es veredicto)
// ------------------------------------------------------------
// Patrón: existe un cobro PAGADO del periodo M que se creó ya entrado el mes
// M+1, y encima un cobro IMPAGO del periodo M+1 por un monto parecido. Si el
// atleta entró a fin de mes, ese pago era en realidad el de M+1 y el impago de
// M+1 es un recobro (caso María Paula: entró 30-jul, pagó el 5-ago rotulado a
// julio, y el 6-ago la apertura generó agosto otra vez).
//
// OJO: un pago atrasado REAL cargado a mano desde el panel se ve idéntico. Por
// eso esto NO se marca como duplicado: es cola de revisión humana.
// ════════════════════════════════════════════════════════════════════════════
const mesSig = (per) => {
  const [y, m] = per.split('-').map(Number);
  if (!y || !m) return null;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const ejeE = [];
for (const [subj, rows] of paysBySubject) {
  for (const q of rows.filter((x) => PAGO.has(x.status))) {
    if (!enEscuela(q.school_id)) continue;
    const per = periodo(q);
    const sig = mesSig(per);
    if (!sig || !pasaDesde(sig)) continue;
    // el cobro pagado se creó ya dentro del mes siguiente al que dice cubrir
    if ((q.created_at || '').slice(0, 7) <= per) continue;
    const recobro = rows.filter((p) => p.school_id === q.school_id && periodo(p) === sig
      && IMPAGO.has(p.status) && !PAGO.has(p.status) && !esUnicaVez(p.concept));
    if (!recobro.length) continue;
    ejeE.push({
      school_id: q.school_id, school: schoolName.get(q.school_id) || q.school_id,
      nombre: nombreSujeto.get(subj) || subj, subject_id: subj,
      pagado: q, periodoPagado: per, periodoRecobro: sig, recobro,
      monto: recobro.reduce((a, p) => a + Number(p.amount || 0), 0),
    });
  }
}
ejeE.sort((a, b) => b.monto - a.monto);

// ── salida ──────────────────────────────────────────────────────────────────
const SEV = { CRITICO: 2, ALTO: 1 };
ejeA.sort((a, b) => SEV[b.sev] - SEV[a.sev] || b.plata - a.plata || String(a.school).localeCompare(String(b.school)));
ejeB.sort((a, b) => b.plata - a.plata || b.cobrado_de_mas - a.cobrado_de_mas || String(a.school).localeCompare(String(b.school)));
ejeC.sort((a, b) => b.riesgo - a.riesgo);

const totalA = ejeA.reduce((a, x) => a + x.plata, 0);
const totalB = ejeB.reduce((a, x) => a + x.plata, 0);
const deMasB = ejeB.reduce((a, x) => a + x.cobrado_de_mas, 0);
const riesgoC = ejeC.reduce((a, x) => a + x.riesgo, 0);

console.log(`\n${'='.repeat(78)}`);
console.log('RESUMEN');
console.log('='.repeat(78));
console.log(`  EJE A  · misma identidad, mismo periodo, 2+ cobros   : ${ejeA.filter((x) => x.eje === 'A').length}`);
console.log(`  EJE A2 · lo mismo pero con periodo en NULL           : ${ejeA.filter((x) => x.eje === 'A2').length}`);
console.log(`  EJE B  · mismo periodo repartido en 2+ identidades   : ${ejeB.length}  ← el caso de Dynasty`);
console.log(`  EJE C  · doble facturable, sin cobro doble aún       : ${ejeC.length}`);
console.log(`  EJE D  · cobros que NACIERON VENCIDOS (mora falsa)   : ${ejeD.length}  (${ejeD.filter((x) => x.yaPagoPosterior).length} de gente que ya pagó un mes posterior)`);
console.log(`  EJE E  · pago rotulado al mes anterior → recobro     : ${ejeE.length}  (REVISAR: un pago atrasado real se ve igual)`);
console.log(`  ─────────────────────────────────────────────────────`);
console.log(`  📧 cobros impagos de gente que YA PAGÓ ese periodo   : ${correos.length}  ← los correos indebidos`);
console.log(`     de esos, con recordatorio ya enviado              : ${correos.filter((c) => c.recordatorio).length}`);
console.log(`  💸 plata PAGADA dos veces (a devolver)   : ${fmt(totalA + totalB)}`);
console.log(`  🧾 emitido de más en cobros vivos (EJE B): ${fmt(deMasB)}`);
console.log(`  📅 riesgo de la próxima apertura de mes  : ${fmt(riesgoC)}`);

const porEsc = new Map();
for (const x of [...ejeA.map((v) => ({ ...v, _e: v.eje })), ...ejeB.map((v) => ({ ...v, _e: 'B' })), ...ejeC.map((v) => ({ ...v, _e: 'C' }))]) {
  if (!porEsc.has(x.school)) porEsc.set(x.school, { A: 0, A2: 0, B: 0, C: 0 });
  porEsc.get(x.school)[x._e]++;
}
if (porEsc.size) {
  console.log(`\n${'-'.repeat(78)}`);
  console.log('POR ESCUELA                                   EJE A  A2   B(ident)  C(riesgo)');
  console.log('-'.repeat(78));
  for (const [s, c] of [...porEsc].sort((a, b) => (b[1].A + b[1].A2 + b[1].B + b[1].C) - (a[1].A + a[1].A2 + a[1].B + a[1].C))) {
    console.log(`  ${String(s).slice(0, 40).padEnd(42)} ${String(c.A).padStart(4)} ${String(c.A2).padStart(4)} ${String(c.B).padStart(8)} ${String(c.C).padStart(9)}`);
  }
}

const linea = (p) => `      [${p.status}] ${fmt(p.amount)}${p.amount_paid ? ` (pagado ${fmt(p.amount_paid)})` : ''} vence ${p.due_date || '-'} · ${p.concept || 'sin concepto'}${p.receipt_url ? ' · 📎 comprobante' : ''}\n         id=${p.id}  creado=${(p.created_at || '').slice(0, 16)}`;

if (correos.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('📧 COBROS A ANULAR — la persona YA PAGÓ ese periodo y le siguen cobrando');
  console.log('='.repeat(78));
  console.log('Esto es lo que produce el correo de «tienes un pago pendiente» a familias al día.');
  for (const c of correos) {
    console.log(`\n${c.recordatorio ? '🔴' : '🟠'} ${c.nombre}  ·  ${c.school}  ·  periodo ${c.periodo}`);
    console.log(`   COBRO VIVO A ANULAR  [${c.cobro.status}] ${fmt(c.cobro.amount)} vence ${c.cobro.due_date || '-'}`);
    console.log(`      concepto: ${c.cobro.concept || 'sin concepto'}`);
    console.log(`      id=${c.cobro.id}`);
    console.log(`      recordatorio enviado: ${c.recordatorio ? `SÍ · ${String(c.recordatorio).slice(0, 16)}` : 'no registrado'}`);
    console.log(`   YA PAGADO${c.mismaPersonaOtraIdentidad ? ' (en la OTRA identidad de la misma persona)' : ''}:`);
    for (const q of c.pagados) {
      console.log(`      [${q.status}] ${fmt(q.amount_paid ?? q.amount)} el ${(q.payment_date || q.due_date || '').slice(0, 10)} · ${q.concept || 'sin concepto'}`);
      console.log(`         id=${q.id}${sujeto(q) !== c.subject_id ? `  sujeto=${String(sujeto(q)).slice(0, 8)}` : ''}`);
    }
  }
}

if (ejeA.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('EJE A / A2 — DOS COBROS DEL MISMO PERIODO SOBRE LA MISMA IDENTIDAD');
  console.log('='.repeat(78));
  for (const x of ejeA) {
    if (soloPlata && x.sev !== 'CRITICO') continue;
    console.log(`\n${x.sev === 'CRITICO' ? '🔴' : '🟠'} [${x.eje}] ${x.nombre}  ·  ${x.school}  ·  periodo ${x.periodo}`);
    console.log(`   ↳ ${x.accion}`);
    console.log(`   ↳ ${x.nota}`);
    if (x.plata) console.log(`   💸 pagado de más: ${fmt(x.plata)}`);
    for (const p of x.cobros) console.log(linea(p));
  }
}

if (ejeB.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('EJE B — EL MISMO PERIODO COBRADO EN DOS IDENTIDADES DE LA MISMA PERSONA');
  console.log('='.repeat(78));
  for (const g of ejeB) {
    if (soloPlata && !g.plata) continue;
    console.log(`\n${g.plata ? '🔴' : '🟠'} ${g.veredicto} · ${g.nombre}  ·  ${g.school}`);
    for (const r of g.razones) console.log(`   ↳ ${r}`);
    for (const d of g.identidades) {
      const marca = d.id === g.sobrevive.id ? '⭐ SOBREVIVE' : '→ absorber';
      console.log(`   · [${d.kind}] ${d.name}   ${marca}`);
      console.log(`       id=${d.id}  doc=${d.doc || '-'}  nac=${d.dob || '-'}  dueño=${d.owner}`);
      console.log(`       inscripciones activas=${d.activas}  cuota=${d.fee ?? '—'}  cobros vivos=${d.cobros.length}  pagado=${fmt(d.pagado)}`);
    }
    for (const c of g.choques) {
      console.log(`   💥 periodo ${c.periodo} — ${c.accion}`);
      for (const [idd, rs] of c.porId) {
        console.log(`      identidad ${idd.slice(0, 8)} (${nombreSujeto.get(idd) || '?'}):`);
        for (const p of rs) console.log(linea(p));
      }
    }
    if (g.plata) console.log(`   💸 pagado de más: ${fmt(g.plata)}`);
  }
}

if (ejeE.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('EJE E — REVISAR: el pago pudo quedar rotulado al mes anterior y se recobró');
  console.log('='.repeat(78));
  for (const x of ejeE) {
    console.log(`\n🟡 ${x.nombre}  ·  ${x.school}`);
    console.log(`   PAGÓ  [${x.pagado.status}] ${fmt(x.pagado.amount_paid ?? x.pagado.amount)} rotulado a ${x.periodoPagado} (vencía ${x.pagado.due_date})`);
    console.log(`         pero el cobro se creó el ${(x.pagado.created_at || '').slice(0, 10)}, ya en ${(x.pagado.created_at || '').slice(0, 7)} → el pago pudo ser de ${x.periodoRecobro}`);
    console.log(`         id=${x.pagado.id}`);
    console.log(`   Y LE COBRAN ${x.periodoRecobro}:`);
    for (const p of x.recobro) console.log(`      [${p.status}] ${fmt(p.amount)} vence ${p.due_date} · ${(p.concept || '').slice(0, 50)}\n         id=${p.id}`);
  }
}

if (ejeD.length) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('EJE D — COBROS QUE NACIERON VENCIDOS: mora reclamada por un cobro emitido tarde');
  console.log('='.repeat(78));
  for (const x of ejeD) {
    console.log(`\n${x.yaPagoPosterior ? '🔴' : '🟠'} ${x.nombre}  ·  ${x.school}  ·  periodo ${x.periodo}`);
    console.log(`   [${x.cobro.status}] ${fmt(x.cobro.amount)} · vencía ${x.cobro.due_date} pero se creó ${x.creado} → nació con ${x.diasTarde} días de mora`);
    console.log(`      concepto: ${x.cobro.concept || 'sin concepto'}`);
    console.log(`      id=${x.cobro.id}`);
    if (x.yaPagoPosterior) {
      console.log('   ⚠️  ESTA FAMILIA YA PAGÓ UN MES POSTERIOR → está al día y le reclaman mora:');
      for (const q of x.posteriores) console.log(`      [${q.status}] ${fmt(q.amount_paid ?? q.amount)} periodo ${periodo(q)} pagado ${(q.payment_date || '').slice(0, 10)}`);
    }
  }
}

if (ejeC.length && !soloPlata) {
  console.log(`\n${'='.repeat(78)}`);
  console.log('EJE C — DOBLE FACTURABLE: SIN COBRO DOBLE TODAVÍA, LO CREA LA PRÓXIMA APERTURA');
  console.log('='.repeat(78));
  for (const x of ejeC) {
    console.log(`\n🟡 [${x.tipo}] ${x.nombre}  ·  ${x.school}   riesgo/mes ${fmt(x.riesgo)}`);
    if (x.tipo === 'misma-identidad') {
      for (const e of x.activas) {
        console.log(`   · inscripción ${e.id}  equipo=${e.team_id ? e.team_id.slice(0, 8) : '❌'}  plan=${e.offering_plan_id ? e.offering_plan_id.slice(0, 8) : '❌'}  cuota=${e.monthly_fee ?? '—'}  ${(e.created_at || '').slice(0, 16)}`);
      }
      console.log('   ↳ 2+ inscripciones ACTIVAS sobre el mismo atleta: la generación de mes cobra una por cada una');
    } else {
      for (const d of x.identidades) {
        console.log(`   · [${d.kind}] ${d.name}  activas=${d.activas}  cuota=${d.fee ?? '—'}  ${d.id === x.sobrevive.id ? '⭐ SOBREVIVE' : '→ absorber'}`);
      }
      console.log('   ↳ dos identidades facturables de la misma persona, ninguna cobrada doble aún');
    }
  }
}

if (!ejeA.length && !ejeB.length && !ejeC.length) {
  console.log('\n✅ Sin cobros duplicados ni dobles facturables con los filtros dados.');
}

if (jsonOut) {
  const limpiar = (p) => ({ id: p.id, status: p.status, amount: p.amount, amount_paid: p.amount_paid, due_date: p.due_date, periodo: periodo(p), concept: p.concept, receipt_url: p.receipt_url ? true : false, created_at: p.created_at });
  writeFileSync(jsonOut, JSON.stringify({
    generado_para: wantSchool || 'todas las escuelas',
    totales: { pagado_dos_veces: totalA + totalB, emitido_de_mas: deMasB, riesgo_mensual: riesgoC, correos_indebidos: correos.length },
    cobros_a_anular: correos.map((c) => ({
      escuela: c.school, atleta: c.nombre, periodo: c.periodo,
      payment_id: c.cobro.id, status: c.cobro.status, monto: c.cobro.amount,
      concepto: c.cobro.concept, recordatorio_enviado: c.recordatorio,
      otra_identidad: c.mismaPersonaOtraIdentidad,
      ya_pagado_ids: c.pagados.map((q) => q.id),
    })),
    eje_a: ejeA.map((x) => ({ ...x, cobros: x.cobros.map(limpiar) })),
    eje_b: ejeB.map((g) => ({
      school: g.school, nombre: g.nombre, veredicto: g.veredicto, razones: g.razones,
      sobrevive_id: g.sobrevive.id, absorben_ids: g.absorben.map((d) => d.id),
      plata: g.plata, cobrado_de_mas: g.cobrado_de_mas,
      identidades: g.identidades.map((d) => ({ kind: d.kind, id: d.id, name: d.name, doc: d.doc, dob: d.dob, owner: d.owner, activas: d.activas, fee: d.fee, pagado: d.pagado })),
      choques: g.choques.map((c) => ({ periodo: c.periodo, sev: c.sev, accion: c.accion, por_identidad: Object.fromEntries([...c.porId].map(([k, v]) => [k, v.map(limpiar)])) })),
    })),
    eje_c: ejeC.map((x) => ({ school: x.school, tipo: x.tipo, nombre: x.nombre, riesgo: x.riesgo, subject_id: x.subject_id ?? null, inscripciones: (x.activas || []).map((e) => e.id), identidades: (x.identidades || []).map((d) => ({ kind: d.kind, id: d.id, activas: d.activas, fee: d.fee })) })),
  }, null, 2));
  console.log(`\nJSON → ${jsonOut}`);
}
console.log('\n(READ-ONLY: este script no escribió nada.)');
