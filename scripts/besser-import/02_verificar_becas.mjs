// ============================================================================
// CLUB DEPORTIVO BESSER — verificar (y reparar) el marcado de becas.
//
// El 01 ya inserta `fee_is_manual = true` en los atletas con MENSUALIDAD = 0,
// así que esto NO es volver a marcarlos: es poder AFIRMARLO. El registro de
// migraciones no dice qué está aplicado y el repo no dice qué se escribió; la
// única fuente de verdad es la base. Este script la interroga y, con
// --confirmar, repara lo que encuentre suelto.
//
//   · POR DEFECTO NO ESCRIBE NADA. Sin --confirmar solo reporta.
//   · Por qué importa el flag: open_month resuelve la cuota con
//     COALESCE(NULLIF(e.monthly_fee,0), op.price, t.price_monthly, c.monthly_fee, 0).
//     NULLIF(0,0) es NULL, así que un becado SIN el flag cae al precio del
//     equipo o del plan el mes siguiente y se le cobra. Con fee_is_manual el
//     monto es COALESCE(e.monthly_fee,0) tal cual (migración 20260827175215).
//   · ALCANCE DELIBERADAMENTE ESTRECHO: solo inscripciones de atletas que
//     creó esta carga (intake_form_data.origen = el Excel) y solo las que NO
//     tienen offering_plan_id. Con plan, el BFF fuerza la cuota del equipo a 0
//     a propósito (la fila de equipo es solo roster, students.ts:1003):
//     marcarla como beca convertiría un 0 estructural en una decisión, que es
//     justo la confusión que el flag existe para evitar.
//   · Cuota > 0 sin flag NO se toca: hoy es correcto, porque su monthly_fee
//     gana en la cascada mientras siga siendo > 0. Se lista aparte porque deja
//     de ser correcto si esos atletas se mueven a un plan.
//
// Uso:
//   node scripts/besser-import/02_verificar_becas.mjs                        # solo reporta
//   node scripts/besser-import/02_verificar_becas.mjs --confirmar
//   node scripts/besser-import/02_verificar_becas.mjs --confirmar --por=<uuid-de-profile>
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const CONFIRMAR = process.argv.includes('--confirmar');
const POR = (process.argv.find((a) => a.startsWith('--por=')) || '').slice('--por='.length) || null;

const SCHOOL_ID = '759eee9d-05cb-4958-b84a-2560f77e3683';
const ORIGEN = 'Excel INFORMACION BESSER _ APP.xlsx';
const MOTIVO = 'Beca / cuota exenta — carga inicial Excel Besser';

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env');
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const get = async (q) => {
  const r = await fetch(`${BASE}/rest/v1/${q}`, { headers: HEADERS });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${q} -> ${t.slice(0, 300)}`);
  return JSON.parse(t);
};
const patch = async (tabla, filtro, cambios) => {
  const r = await fetch(`${BASE}/rest/v1/${tabla}?${filtro}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(cambios),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`PATCH ${tabla}?${filtro} -> ${t.slice(0, 400)}`);
  return JSON.parse(t);
};

const enLotes = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  console.log(`Modo: ${CONFIRMAR ? 'ESCRITURA' : 'SOLO REPORTE (nada se escribe)'}\n`);

  // 1. Los atletas que creó esta carga, por la huella que el 01 dejó adrede.
  const atletas = await get(
    `unregistered_athletes?school_id=eq.${SCHOOL_ID}` +
    `&intake_form_data->>origen=eq.${encodeURIComponent(ORIGEN)}` +
    `&select=id,full_name,intake_form_data`,
  );
  console.log(`Atletas cargados desde el Excel: ${atletas.length}`);
  if (atletas.length === 0) {
    console.log('\nNinguno. O el 01 nunca corrió con --confirmar, o la huella del origen cambió.');
    return;
  }

  const nombre = new Map(atletas.map((a) => [a.id, a.full_name]));
  const fila = new Map(atletas.map((a) => [a.id, a.intake_form_data?.fila_excel ?? '?']));

  // 2. Sus inscripciones activas. El `in.()` se parte en lotes: 55 UUIDs en una
  //    sola URL es pedirle problemas al límite de longitud.
  const inscripciones = [];
  for (const lote of enLotes(atletas.map((a) => a.id), 40)) {
    inscripciones.push(...await get(
      `enrollments?school_id=eq.${SCHOOL_ID}&status=eq.active` +
      `&unregistered_athlete_id=in.(${lote.join(',')})` +
      `&select=id,unregistered_athlete_id,monthly_fee,fee_is_manual,fee_reason,team_id,offering_plan_id`,
    ));
  }
  console.log(`Inscripciones activas encontradas: ${inscripciones.length}\n`);

  const etiqueta = (e) => `fila ${fila.get(e.unregistered_athlete_id)} — ${nombre.get(e.unregistered_athlete_id)}`;

  const conPlan   = inscripciones.filter((e) => e.offering_plan_id);
  const sinPlan   = inscripciones.filter((e) => !e.offering_plan_id);
  const becaOk    = sinPlan.filter((e) => Number(e.monthly_fee) === 0 && e.fee_is_manual);
  const aReparar  = sinPlan.filter((e) => Number(e.monthly_fee) === 0 && !e.fee_is_manual);
  const pagas     = sinPlan.filter((e) => Number(e.monthly_fee) > 0 && !e.fee_is_manual);
  const parciales = sinPlan.filter((e) => Number(e.monthly_fee) > 0 && e.fee_is_manual);

  console.log(`Becados YA marcados (cuota 0 + fee_is_manual): ${becaOk.length}`);
  for (const e of becaOk) console.log(`  ok  ${etiqueta(e)}`);

  console.log(`\nBecados SIN marcar (cuota 0, se les cobraría el mes siguiente): ${aReparar.length}`);
  for (const e of aReparar) console.log(`  ⚠️  ${etiqueta(e)} (enrollment ${e.id})`);

  console.log(`\nCon cuota individual > 0 y sin flag: ${pagas.length}`);
  console.log('  Correcto hoy: su monthly_fee gana en la cascada. Deja de serlo si');
  console.log('  se los mueve a un plan — ahí la cuota la define el plan.');

  if (parciales.length > 0) {
    console.log(`\nCuota manual > 0 (beca parcial pactada): ${parciales.length}`);
    for (const e of parciales) console.log(`  ·  ${etiqueta(e)} — ${e.monthly_fee} (${e.fee_reason || 'sin motivo'})`);
  }
  if (conPlan.length > 0) {
    console.log(`\nCon plan asignado, NO se tocan: ${conPlan.length}`);
    for (const e of conPlan) console.log(`  ·  ${etiqueta(e)} — plan ${e.offering_plan_id}, cuota ${e.monthly_fee}`);
  }

  if (aReparar.length === 0) {
    console.log('\nNada que reparar: todos los de cuota 0 están marcados como beca.');
    return;
  }
  if (!CONFIRMAR) {
    console.log(`\nCorré con --confirmar para marcar esas ${aReparar.length}.`);
    return;
  }

  console.log(`\nMarcando ${aReparar.length} inscripciones…`);
  const ahora = new Date().toISOString();
  let hechas = 0;
  for (const e of aReparar) {
    // Guarda de última hora contra una lectura vieja: el filtro repite las dos
    // condiciones que definen el caso, así que si la fila cambió entre el SELECT
    // y el PATCH no se toca nada (0 filas) en vez de escribir sobre otro estado.
    const cambios = {
      fee_is_manual: true,
      fee_reason: e.fee_reason || MOTIVO,
      fee_set_at: ahora,
      ...(POR ? { fee_set_by: POR } : {}),
    };
    const filas = await patch('enrollments', `id=eq.${e.id}&monthly_fee=eq.0&fee_is_manual=is.false`, cambios);
    if (filas.length === 0) {
      console.log(`  saltada ${etiqueta(e)}: cambió desde la lectura, revisar a mano`);
      continue;
    }
    console.log(`  OK ${etiqueta(e)}`);
    hechas++;
  }
  console.log(`\nMarcadas: ${hechas} de ${aReparar.length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
