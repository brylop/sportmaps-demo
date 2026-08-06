// ============================================================================
// SportMaps — EMISIÓN DIRIGIDA de los cobros de agosto que faltan (Dynasty)
//
// Paso 7 del plan P0. Es el ÚNICO script de esta tanda que escribe, y por eso:
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin argumentos hace dry-run y muestra el
//     payload exacto que insertaría, fila por fila.
//   · Para escribir hacen falta DOS cosas a la vez: `--emitir <id...>` con los
//     registros elegidos y `--si-confirmo`. Cualquiera de las dos sola no basta.
//   · No existe un "emitir todo y listo" silencioso: `--emitir todos` también
//     exige `--si-confirmo`, y cada fila se reporta por separado.
//
// DE DÓNDE SALE LA LISTA
// No la reimplementa: corre `triage-sin-cobro-agosto-2026-08-06.mjs --json` como
// subproceso y lee el bucket D. Una sola implementación del matching y de los
// vetos, como manda el spec. Si el triage cambia de opinión, esto cambia con él.
//
// RE-VALIDACIÓN ANTES DE CADA INSERT
// El triage puede haber corrido hace horas. Justo antes de escribir cada fila se
// vuelve a consultar la base y se aborta esa fila si:
//   · la inscripción dejó de estar activa,
//   · apareció un cobro vivo del período (alguien corrió open_month, o el padre
//     pagó, o se emitió por otra vía),
//   · el monto por la cadena canónica ya no es el que aprobó el triage.
// En la duda, se salta la fila. Nunca se "arregla" sola.
//
// QUÉ INSERTA
// Los mismos campos que `open_month` (verificada contra la base viva el
// 2026-08-06), para que un cobro emitido acá sea indistinguible de uno emitido
// por el cierre de mes:
//   school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
//   team_id, offering_plan_id, concept, amount, due_date, status='pending',
//   payment_type='subscription', period_year, period_month
//
// ⚠ CADA INSERT DISPARA UNA NOTIFICACIÓN A LA FAMILIA
// El trigger `trg_notify_on_payment_created` corre AFTER INSERT cuando el estado
// es 'pending'. No hay forma de emitir en silencio: emitir = avisar.
//
// Uso:
//   node scripts/emitir-cobros-agosto-2026-08-06.mjs                 (dry-run)
//   node scripts/emitir-cobros-agosto-2026-08-06.mjs --emitir 1252e927 --si-confirmo
//   node scripts/emitir-cobros-agosto-2026-08-06.mjs --emitir 1252e927,7cbff75a --si-confirmo
//   node scripts/emitir-cobros-agosto-2026-08-06.mjs --emitir todos --si-confirmo
// ============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(AQUI, '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(`--${n}`);

const SELECCION = (arg('emitir') || '').split(',').map((s) => s.trim()).filter(Boolean);
const CONFIRMADO = has('si-confirmo');
const ESCRIBIR = SELECCION.length > 0 && CONFIRMADO;

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

const get = async (q) => {
  const r = await fetch(`${BASE}/rest/v1/${q}`, { headers: HEADERS });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${q} → ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const post = async (tabla, fila) => {
  const r = await fetch(`${BASE}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(fila),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${tabla} → ${t.slice(0, 400)}`);
  return JSON.parse(t)[0];
};

const VIVOS = new Set(['pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado']);

/** Cadena canónica de open_month. Igual que en el triage; se recalcula acá para
 *  que la re-validación sea independiente del JSON que venga. */
const montoCanonico = (enr, plan, team, child) =>
  Number(enr?.monthly_fee) || Number(plan?.price) || Number(team?.price_monthly) || Number(child?.monthly_fee) || 0;

const main = async () => {
  // ── 1. Traer el veredicto del triage (única fuente de la decisión) ────────
  const tmp = path.join(os.tmpdir(), `triage-emision-${process.pid}.json`);
  console.log('Corriendo el triage para tener el bucket D fresco…\n');
  execFileSync(process.execPath,
    [path.join(AQUI, 'triage-sin-cobro-agosto-2026-08-06.mjs'), '--json', tmp, '--md', ''],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const triage = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);

  const S = triage.escuela.id;
  const bucketD = triage.casos.filter((c) => c.bucket === 'D');
  const [ajustes] = await get(`school_settings?select=payment_cutoff_day&school_id=eq.${S}`);
  const cutoff = ajustes?.payment_cutoff_day ?? 10;

  const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [ANIO, MES] = HOY.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ANIO, MES, 0)).getUTCDate();
  const DUE = `${ANIO}-${String(MES).padStart(2, '0')}-${String(Math.min(cutoff, ultimoDia)).padStart(2, '0')}`;

  console.log('='.repeat(78));
  console.log(`EMISIÓN DIRIGIDA · ${triage.escuela.name}`);
  console.log(`Período ${ANIO}-${String(MES).padStart(2, '0')} · vence ${DUE} · bucket D: ${bucketD.length} cobros`);
  console.log(`Modo: ${ESCRIBIR ? '⚠️  ESCRITURA REAL' : 'DRY-RUN (no escribe nada)'}`);
  console.log('='.repeat(78));

  if (SELECCION.length && !CONFIRMADO) {
    console.log('\n⛔ Pediste --emitir pero falta --si-confirmo. No se escribió nada.');
    console.log('   Las dos banderas juntas son a propósito: que emitir cueste dos decisiones, no una.\n');
  }

  const elegido = (c) => SELECCION.includes('todos')
    || SELECCION.some((s) => c.principal.id.startsWith(s) || String(c.principal.enrollment_id).startsWith(s));

  let emitidos = 0, saltados = 0, total = 0, enCola = 0;

  for (const c of bucketD) {
    const p = c.principal;
    const marca = SELECCION.length ? (elegido(c) ? '▶' : '·') : '▶';
    console.log(`\n${marca} ${c.buscado} — ${money(p.monto)}`);
    console.log(`   identidad \`${p.id}\` [${p.rama}] · enrollment \`${p.enrollment_id}\``);

    // ── 2. Re-validar contra la base, ahora ─────────────────────────────────
    const [enr] = await get(`enrollments?select=id,child_id,user_id,unregistered_athlete_id,team_id,offering_plan_id,status,monthly_fee&id=eq.${p.enrollment_id}`);
    if (!enr) { console.log('   ⛔ la inscripción ya no existe → saltada'); saltados++; continue; }
    if (enr.status !== 'active') { console.log(`   ⛔ la inscripción pasó a "${enr.status}" → saltada`); saltados++; continue; }

    const sujeto = enr.child_id || enr.user_id || enr.unregistered_athlete_id;
    const cobros = await get(`payments?select=id,status,amount,period_year,period_month&school_id=eq.${S}` +
      `&or=(child_id.eq.${sujeto},user_id.eq.${sujeto},unregistered_athlete_id.eq.${sujeto},parent_id.eq.${sujeto})`);
    const yaTiene = cobros.filter((y) => VIVOS.has(y.status) && y.period_year === ANIO && y.period_month === MES);
    if (yaTiene.length) {
      console.log(`   ⛔ ya apareció un cobro vivo de ${ANIO}-${MES} (${yaTiene.map((y) => `${y.status}/${money(y.amount)}`).join(', ')}) → saltada`);
      console.log('      Alguien emitió por otra vía desde que corrió el triage. Revisar antes de insistir.');
      saltados++; continue;
    }

    const [plan] = enr.offering_plan_id ? await get(`offering_plans?select=id,name,price&id=eq.${enr.offering_plan_id}`) : [null];
    const [team] = enr.team_id ? await get(`teams?select=id,name,price_monthly,branch_id&id=eq.${enr.team_id}`) : [null];
    const [child] = enr.child_id ? await get(`children?select=id,full_name,monthly_fee,parent_id,branch_id&id=eq.${enr.child_id}`) : [null];
    const [prof] = enr.user_id ? await get(`profiles?select=id,full_name&id=eq.${enr.user_id}`) : [null];
    const [unreg] = enr.unregistered_athlete_id ? await get(`unregistered_athletes?select=id,full_name,branch_id&id=eq.${enr.unregistered_athlete_id}`) : [null];

    const monto = montoCanonico(enr, plan, team, child);
    if (monto !== p.monto) {
      console.log(`   ⛔ el monto cambió: el triage aprobó ${money(p.monto)} y la cadena da ${money(monto)} → saltada`);
      saltados++; continue;
    }
    if (!(monto > 0)) { console.log('   ⛔ monto 0 → saltada (violaría payments_amount_positive)'); saltados++; continue; }

    // ── 3. Payload, idéntico al de open_month ───────────────────────────────
    const nombre = (child?.full_name || prof?.full_name || unreg?.full_name || 'Atleta').trim();
    const fila = {
      school_id: S,
      branch_id: child?.branch_id ?? unreg?.branch_id ?? team?.branch_id ?? null,
      parent_id: child?.parent_id ?? null,     // open_month: solo el menor tiene acudiente
      child_id: enr.child_id ?? null,
      user_id: enr.user_id ?? null,
      unregistered_athlete_id: enr.unregistered_athlete_id ?? null,
      team_id: enr.team_id ?? null,
      offering_plan_id: enr.offering_plan_id ?? null,
      concept: `Mensualidad ${String(MES).padStart(2, '0')}/${ANIO} - ${nombre}`,
      amount: monto,
      due_date: DUE,
      status: 'pending',
      payment_type: 'subscription',
      period_year: ANIO,
      period_month: MES,
    };

    if (!ESCRIBIR || !elegido(c)) {
      console.log(`   ${SELECCION.length && !elegido(c) ? 'no seleccionada' : 'insertaría'}: ${JSON.stringify(fila)}`);
      if (!SELECCION.length || elegido(c)) { total += monto; enCola++; }
      continue;
    }

    // ── 4. Escribir ─────────────────────────────────────────────────────────
    try {
      const creado = await post('payments', fila);
      console.log(`   ✅ emitido \`${creado.id}\` · ${money(creado.amount)} · vence ${creado.due_date}`);
      console.log('      (la familia acaba de recibir la notificación: trg_notify_on_payment_created)');
      emitidos++; total += monto;
    } catch (e) {
      console.log(`   ⛔ falló el INSERT: ${e.message}`);
      saltados++;
    }
  }

  console.log(`\n${'='.repeat(78)}`);
  if (ESCRIBIR) {
    console.log(`EMITIDOS: ${emitidos} cobros por ${money(total)} · saltados: ${saltados}`);
  } else {
    console.log(`DRY-RUN: no se escribió nada. Se insertarían ${enCola} cobros por ${money(total)}.` + (saltados ? ` (${saltados} saltada(s) por re-validación.)` : ''));
    console.log('Para emitir: --emitir <id_o_prefijo[,...]> --si-confirmo');
  }
  console.log('='.repeat(78));
};

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
