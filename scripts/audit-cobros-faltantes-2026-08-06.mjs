/**
 * Auditoría — inscripciones ACTIVAS sin ningún cobro vivo.
 *
 * SOLO LECTURA. No escribe una sola fila: imprime lo que habría que generar para
 * que alguien lo revise antes de tocar la base compartida.
 *
 * Contexto (2026-08-06): el QR "INSCRIPCION DYNASTY (sin pago)" tiene
 * `require_first_payment = false`, así que inscribe sin cobrar — a propósito. El
 * cobro tendría que nacer cuando la escuela asigna el plan, pero si la
 * inscripción YA trae el plan (se lo puso el QR), `students.ts` cae en la rama
 * "mismo plan" y solo hace UPDATE del monto de los cobros pendientes: si no hay
 * ninguno, no crea nada. Y `open_month` de agosto ya había corrido. Resultado:
 * atletas activos, con plan y con cuota, que no le deben nada a nadie.
 *
 * El vencimiento propuesto replica `qr_first_charge_due_date` de la migración
 * 20260804125644:
 *     vence = LEAST( fin de mes, GREATEST( corte del mes, hoy + gracia ) )
 *
 * Uso:
 *     node scripts/audit-cobros-faltantes-2026-08-06.mjs [school_id]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);

const SCHOOL_ID = process.argv[2] || '2d509571-3238-4c04-ac3f-6dfe20539226'; // Dynasty
const HEADERS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

const api = async (q) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: HEADERS });
  const body = await r.json();
  if (body?.code) throw new Error(`${q} → ${body.message}`);
  return body;
};

/** Día de hoy en Colombia, no en UTC. */
const hoyCO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

/** Documento normalizado: sin puntos, guiones ni espacios. Para cruzar identidades. */
const normDoc = (d) => (d ?? '').toString().replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

/**
 * Nombre normalizado para detectar la MISMA persona registrada dos veces.
 *
 * El cruce por documento no basta: los duplicados de Dynasty vienen con el
 * documento vacío o distinto entre las dos filas (una la creó la escuela en el
 * cargue, la otra el padre al auto-registrarse). Lo que sí se repite es el
 * nombre, con tildes y mayúsculas cambiadas — "Anaisabel Mondragón Mejía" vs
 * "ANAISABEL MONDRAGON MEJIA". Se ordenan los tokens porque el orden de nombres
 * y apellidos también varía entre las dos capturas.
 */
const normNombre = (n) => (n ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .split(/\s+/).filter(Boolean).sort().join(' ');

const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

/** Misma fórmula que `qr_first_charge_due_date` (migración 20260804125644). */
function vencimientoPropuesto(hoy, cutoffDay, graceDays) {
  const [y, m, d] = hoy.split('-').map(Number);
  const finDeMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const corte = Math.min(Math.max(cutoffDay ?? 10, 1), finDeMes);
  const conGracia = d + (graceDays ?? 0);
  const dia = Math.min(finDeMes, Math.max(corte, conGracia));
  return `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const main = async () => {
  const [escuela] = await api(`schools?select=id,name&id=eq.${SCHOOL_ID}`);
  const ajustes = await api(`school_settings?select=payment_cutoff_day,payment_grace_days&school_id=eq.${SCHOOL_ID}`);
  const cutoffDay = ajustes[0]?.payment_cutoff_day ?? 10;
  const graceDays = ajustes[0]?.payment_grace_days ?? 0;

  const [, mesActual] = hoyCO.split('-').map(Number);
  const anioActual = Number(hoyCO.split('-')[0]);
  const dueDate = vencimientoPropuesto(hoyCO, cutoffDay, graceDays);

  console.log(`\nESCUELA: ${escuela?.name} (${SCHOOL_ID})`);
  console.log(`HOY (Colombia): ${hoyCO} · corte día ${cutoffDay} · gracia ${graceDays} días`);
  console.log(`PERÍODO A COBRAR: ${anioActual}-${String(mesActual).padStart(2, '0')} · vencería ${dueDate}\n`);

  // ── Inscripciones activas ───────────────────────────────────────────────────
  const enrollments = await api(
    'enrollments?select=id,child_id,user_id,unregistered_athlete_id,status,monthly_fee,' +
    `offering_plan_id,team_id,start_date,created_at&school_id=eq.${SCHOOL_ID}&status=eq.active&limit=2000`,
  );

  // ── Índice de identidades que YA tienen algún cobro vivo ────────────────────
  // `cancelled` no cuenta: un cobro anulado por las limpiezas de duplicados dejó
  // al atleta sin nada que pagar, que es justo el caso que se busca.
  const payments = await api(
    'payments?select=child_id,user_id,parent_id,unregistered_athlete_id,status,amount,concept,' +
    `period_year,period_month,due_date&school_id=eq.${SCHOOL_ID}&limit=5000`,
  );
  const conCobro = new Set();
  for (const p of payments) {
    if (p.status === 'cancelled') continue;
    if (p.child_id) conCobro.add(`c:${p.child_id}`);
    if (p.unregistered_athlete_id) conCobro.add(`u:${p.unregistered_athlete_id}`);
    if (p.user_id) conCobro.add(`a:${p.user_id}`);
    if (p.parent_id) conCobro.add(`a:${p.parent_id}`);
  }

  const claveDe = (e) =>
    e.child_id ? `c:${e.child_id}`
      : e.unregistered_athlete_id ? `u:${e.unregistered_athlete_id}`
        : `a:${e.user_id}`;

  const huerfanas = enrollments.filter(e => !conCobro.has(claveDe(e)));

  // ── Resolver identidad de cada una ──────────────────────────────────────────
  const idsHijo = [...new Set(huerfanas.map(e => e.child_id).filter(Boolean))];
  const idsAdulto = [...new Set(huerfanas.map(e => e.user_id).filter(Boolean))];
  const idsNoReg = [...new Set(huerfanas.map(e => e.unregistered_athlete_id).filter(Boolean))];

  const hijos = idsHijo.length
    ? await api(`children?select=id,full_name,doc_number,parent_id&id=in.(${idsHijo.join(',')})`) : [];
  const adultos = idsAdulto.length
    ? await api(`profiles?select=id,full_name,document_number&id=in.(${idsAdulto.join(',')})`) : [];
  const noReg = idsNoReg.length
    ? await api(`unregistered_athletes?select=id,full_name,doc_number&id=in.(${idsNoReg.join(',')})`) : [];

  const idxHijo = Object.fromEntries(hijos.map(x => [x.id, x]));
  const idxAdulto = Object.fromEntries(adultos.map(x => [x.id, x]));
  const idxNoReg = Object.fromEntries(noReg.map(x => [x.id, x]));

  // ── Planes, para la cuota de respaldo y el nombre ───────────────────────────
  const idsPlan = [...new Set(huerfanas.map(e => e.offering_plan_id).filter(Boolean))];
  const planes = idsPlan.length
    ? await api(`offering_plans?select=id,name,price&id=in.(${idsPlan.join(',')})`) : [];
  const idxPlan = Object.fromEntries(planes.map(p => [p.id, p]));

  // ── Cruce de identidades duplicadas por documento ───────────────────────────
  // Si el mismo documento existe en otro registro que SÍ tiene cobro, generar acá
  // duplicaría la deuda de una persona que ya está facturada con otra identidad.
  const todosHijos = await api(`children?select=id,full_name,doc_number&school_id=eq.${SCHOOL_ID}&limit=5000`);
  const todosNoReg = await api(`unregistered_athletes?select=id,full_name,doc_number&school_id=eq.${SCHOOL_ID}&limit=5000`);
  const porDoc = new Map();
  const porNombre = new Map();
  for (const x of [...todosHijos, ...todosNoReg]) {
    const d = normDoc(x.doc_number);
    if (d) {
      if (!porDoc.has(d)) porDoc.set(d, []);
      porDoc.get(d).push(x);
    }
    const n = normNombre(x.full_name);
    if (n) {
      if (!porNombre.has(n)) porNombre.set(n, []);
      porNombre.get(n).push(x);
    }
  }

  // ── Reporte ─────────────────────────────────────────────────────────────────
  console.log(`Inscripciones activas: ${enrollments.length}`);
  console.log(`Sin ningún cobro vivo: ${huerfanas.length}\n`);

  const filas = [];
  for (const e of huerfanas) {
    const hijo = e.child_id ? idxHijo[e.child_id] : null;
    const adulto = e.user_id ? idxAdulto[e.user_id] : null;
    const nr = e.unregistered_athlete_id ? idxNoReg[e.unregistered_athlete_id] : null;
    const persona = hijo || adulto || nr;
    const doc = normDoc(hijo?.doc_number ?? adulto?.document_number ?? nr?.doc_number);
    const plan = e.offering_plan_id ? idxPlan[e.offering_plan_id] : null;

    // Fuente del monto: monthly_fee > precio del plan. (La cuota del equipo no se
    // usa acá: con plan asignado el equipo es solo roster.)
    const cuota = Number(e.monthly_fee ?? 0) > 0 ? Number(e.monthly_fee) : Number(plan?.price ?? 0);

    const alertas = [];
    if (cuota <= 0) alertas.push('CUOTA 0 — no se puede cobrar (constraint amount > 0)');
    if (!e.offering_plan_id) alertas.push('sin plan');
    if (hijo && !hijo.parent_id) alertas.push('SIN PAGADOR (parent_id NULL → el padre verá 403)');

    // ¿la misma persona vive en otro registro? Se cruza por documento, por nombre
    // exacto y por nombre CONTENIDO. Las tres hacen falta:
    //   · los documentos vienen con typos ("...373" vs "...393", un dígito de más)
    //   · el nombre se captura completo en una fila y corto en la otra
    //     ("SERGIO HERRERA TORRES" vs "Sergio Herrera")
    const yo = hijo?.id ?? nr?.id;
    const misTokens = normNombre(persona?.full_name).split(' ').filter(Boolean);
    const porNombreParcial = misTokens.length >= 2
      ? [...todosHijos, ...todosNoReg].filter(x => {
        const otros = normNombre(x.full_name).split(' ').filter(Boolean);
        if (otros.length < 2) return false;
        const [corto, largo] = misTokens.length <= otros.length ? [misTokens, otros] : [otros, misTokens];
        return corto.every(t => largo.includes(t));
      })
      : [];

    const gemelos = [
      ...(porDoc.get(doc) || []),
      ...(porNombre.get(normNombre(persona?.full_name)) || []),
      ...porNombreParcial,
    ].filter((x, i, arr) => x.id !== yo && arr.findIndex(y => y.id === x.id) === i);

    for (const gem of gemelos) {
      const facturado = conCobro.has(`c:${gem.id}`) || conCobro.has(`u:${gem.id}`);
      alertas.push(
        `IDENTIDAD DUPLICADA — también existe como "${gem.full_name.trim()}" (doc ${normDoc(gem.doc_number) || '—'}), ` +
        (facturado ? 'y ESA SÍ TIENE COBRO → generar acá sería cobrar dos veces' : 'que tampoco tiene cobro'),
      );
    }

    // ¿ya existe un cobro de este período, aunque esté anulado?
    const delPeriodo = payments.filter(p =>
      ((hijo && p.child_id === hijo.id) || (nr && p.unregistered_athlete_id === nr.id)) &&
      p.period_year === anioActual && p.period_month === mesActual);
    if (delPeriodo.length) {
      alertas.push(`ya hubo cobro de ${anioActual}-${mesActual}: ${delPeriodo.map(p => p.status).join('/')}`);
    }

    filas.push({
      nombre: (persona?.full_name ?? '(sin nombre)').trim(),
      doc: doc || '—',
      plan: plan?.name?.trim() ?? '—',
      cuota,
      equipo: e.team_id ? 'sí' : 'no',
      inscrito: e.start_date,
      alertas,
    });
  }

  filas.sort((a, b) => b.cuota - a.cuota || a.nombre.localeCompare(b.nombre));

  const limpias = filas.filter(f => f.cuota > 0 && !f.alertas.length);
  const conAlerta = filas.filter(f => f.cuota > 0 && f.alertas.length);
  const sinCuota = filas.filter(f => f.cuota <= 0);

  const bloque = (titulo, lista) => {
    if (!lista.length) return;
    console.log(`\n${titulo} (${lista.length})`);
    console.log('─'.repeat(110));
    for (const f of lista) {
      console.log(
        `  ${f.nombre.padEnd(34)} ${money(f.cuota).padStart(10)}  doc ${f.doc.padEnd(12)} ` +
        `plan ${f.plan.padEnd(16)} equipo ${f.equipo.padEnd(3)} desde ${f.inscrito}`,
      );
      for (const a of f.alertas) console.log(`      ⚠ ${a}`);
    }
    console.log(`  ${'TOTAL'.padEnd(34)} ${money(lista.reduce((s, f) => s + f.cuota, 0)).padStart(10)}`);
  };

  bloque('LISTAS PARA GENERAR — sin objeciones', limpias);
  bloque('REVISAR UNA POR UNA — tienen alerta', conAlerta);
  bloque('NO COBRABLES — cuota 0', sinCuota);

  console.log(`\nSi se generaran solo las limpias: ${limpias.length} cobros, ` +
    `${money(limpias.reduce((s, f) => s + f.cuota, 0))}, período ` +
    `${anioActual}-${String(mesActual).padStart(2, '0')}, vencimiento ${dueDate}.`);

  // ── Barrido de duplicados sobre TODA la escuela ─────────────────────────────
  // No es un anexo: mientras haya personas contadas dos veces, "falta un cobro"
  // y "sobra un atleta" son indistinguibles, y generar cobros sobre el lado
  // equivocado le cobra dos veces a una familia que ya pagó.
  const activos = await api(
    'school_athletes?select=id,full_name,payment_status,plan_monthly_fee,plan_name,parent_name' +
    `&school_id=eq.${SCHOOL_ID}&is_active=eq.true&limit=2000`,
  );

  const tokens = (n) => normNombre(n).split(' ').filter(Boolean);
  const grupos = [];
  const yaAgrupado = new Set();
  for (let i = 0; i < activos.length; i++) {
    if (yaAgrupado.has(activos[i].id)) continue;
    const ti = tokens(activos[i].full_name);
    if (ti.length < 2) continue;
    const grupo = [activos[i]];
    for (let j = i + 1; j < activos.length; j++) {
      if (yaAgrupado.has(activos[j].id)) continue;
      const tj = tokens(activos[j].full_name);
      if (tj.length < 2) continue;
      const [corto, largo] = ti.length <= tj.length ? [ti, tj] : [tj, ti];
      if (corto.every(t => largo.includes(t))) grupo.push(activos[j]);
    }
    if (grupo.length > 1) {
      grupo.forEach(x => yaAgrupado.add(x.id));
      grupos.push(grupo);
    }
  }

  const conUnoPagado = grupos.filter(g => g.some(x => x.payment_status === 'paid'));
  const enJuego = grupos
    .flatMap(g => g.filter(x => x.payment_status !== 'paid'))
    .reduce((s, x) => s + Number(x.plan_monthly_fee || 0), 0);

  console.log(`\n\nGRUPOS DE POSIBLES DUPLICADOS — ${grupos.length} grupos, ${grupos.reduce((s, g) => s + g.length, 0)} filas`);
  console.log('─'.repeat(110));
  console.log(`  ${conUnoPagado.length} grupos tienen un lado YA PAGADO y el otro cobrando aparte.`);
  console.log(`  Cuota mensual de los lados no pagados: ${money(enJuego)}\n`);
  for (const g of grupos) {
    console.log('  ' + g.map(x =>
      `${x.full_name.trim()} [${x.payment_status} ${money(x.plan_monthly_fee)} · acud: ${x.parent_name ?? '—'}]`,
    ).join('\n     ↔ '));
    console.log('');
  }
  console.log('  Mismo acudiente en ambos lados = casi seguro la misma persona.');
  console.log('  Acudientes distintos = puede ser papá y mamá, o dos personas reales. Lo confirma la escuela.');

  console.log('\nEste script NO escribió nada.\n');
};

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
