#!/usr/bin/env node
// ============================================================================
// W2 / F-B — Inscripción + seguro de Dreamers (y apagar la inscripción de
// Dojo Fénix antes del deploy). docs/specs/dreamers-reglas-completas-plan.md
//
// DRY-RUN POR DEFECTO. Solo escribe con --apply.
//
// Requiere APLICADA la migración 20261005214248 (offering_plans.insurance_fee).
//
// Qué hace:
//   1. Dreamers (57ba9352-…): registration_fee = 120000, insurance_fee = 150000
//      en los planes cuyo nombre empieza por 'PG' (mensualidades). Quedan fuera:
//        · CPP1x1 / CPG1x2 (clases sueltas — no empiezan por PG),
//        · cualquier plan PG* con registration_fee YA fijado a mano (hoy solo
//          PGP4x1 = 0: dato pendiente con Dreamers, no se pisa).
//      Se espera exactamente 23 planes; si no da 23, aborta sin escribir.
//   2. Dreamers: is_active = false en los planes sueltos 'Inscripcion',
//      'Seguro de accidentes' y 'Banco de Horas — TEST' (y en las offerings de
//      los dos primeros), SOLO si cada plan tiene 0 inscripciones y 0 cobros y
//      la offering no tiene otros planes. Si no, lo salta y lo dice.
//   3. Dojo Fénix (26bfb68e-…, resuelto por prefijo): registration_fee = NULL
//      en todos sus planes. Decisión del usuario 2026-10-05: hoy tiene 50.000
//      configurado y nunca se cobró (bug B1); con F-B empezaría a cobrarse.
//      Los valores previos se imprimen para poder restaurarlos.
//
// Credenciales: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY del entorno; si no
// están, bff/.env (mismo lector que scripts/lib/supabase-rest.mjs).
//
// Uso:
//   node scripts/w2-dreamers-fees.mjs            # dry-run
//   node scripts/w2-dreamers-fees.mjs --apply    # escribe
// ============================================================================
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APPLY = process.argv.slice(2).includes('--apply');
const DREAMERS = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
const FENIX_PREFIX = '26bfb68e';
const REG_FEE = 120000;
const INS_FEE = 150000;
const EXPECTED_PG = 23;
const SUELTOS = ['Inscripcion', 'Seguro de accidentes', 'Banco de Horas — TEST'];
const SUELTOS_CON_OFFERING = ['Inscripcion', 'Seguro de accidentes'];

async function credenciales() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const url = process.env.SUPABASE_URL.replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return { url, H: { apikey: key, Authorization: `Bearer ${key}` } };
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, '../bff/.env');
  if (!existsSync(envPath)) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno y no existe bff/.env');
    process.exit(1);
  }
  const { conectar } = await import('./lib/supabase-rest.mjs');
  const { url, H } = conectar(envPath);
  return { url, H };
}

const { url, H } = await credenciales();

async function get(path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: H });
  const t = await r.text();
  if (!r.ok) { console.error(`ERROR GET ${path}: ${t.slice(0, 300)}`); process.exit(1); }
  return JSON.parse(t);
}

async function count(path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { method: 'HEAD', headers: { ...H, Prefer: 'count=exact' } });
  if (!r.ok) { console.error(`ERROR COUNT ${path}: ${r.status}`); process.exit(1); }
  return Number((r.headers.get('content-range') || '*/0').split('/')[1]);
}

async function patch(path, body) {
  if (!APPLY) return;
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.error(`ERROR PATCH ${path}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
}

console.log(APPLY ? '>>> MODO --apply: SE ESCRIBE EN LA BASE' : '>>> DRY-RUN (nada se escribe; usa --apply)');

// La columna tiene que existir: si no, la migración no está aplicada.
await get(`offering_plans?select=id,insurance_fee&limit=1`);

// ── 1. Dreamers: planes PG* ─────────────────────────────────────────────────
const planes = await get(`offering_plans?select=id,name,price,registration_fee,insurance_fee,is_active,offering_id&school_id=eq.${DREAMERS}&order=name`);
const pg = planes.filter((p) => p.name.startsWith('PG'));
const pgObjetivo = pg.filter((p) => p.registration_fee === null);
const pgSaltados = pg.filter((p) => p.registration_fee !== null);

console.log(`\n[1] Dreamers — planes PG*: ${pg.length}; objetivo: ${pgObjetivo.length} (esperado ${EXPECTED_PG})`);
for (const p of pgSaltados) {
  console.log(`    SALTADO ${p.name}: registration_fee ya fijado (${p.registration_fee}) — dato pendiente con Dreamers`);
}
if (pgObjetivo.length !== EXPECTED_PG) {
  console.error(`ABORTA: se esperaban ${EXPECTED_PG} planes PG* sin inscripción y hay ${pgObjetivo.length}. Revisar antes de escribir.`);
  process.exit(1);
}
for (const p of pgObjetivo) {
  console.log(`    ${p.name.padEnd(12)} reg ${p.registration_fee ?? 'NULL'} → ${REG_FEE} · seguro ${p.insurance_fee ?? 'NULL'} → ${INS_FEE}`);
  await patch(`offering_plans?id=eq.${p.id}&school_id=eq.${DREAMERS}`, { registration_fee: REG_FEE, insurance_fee: INS_FEE });
}

// ── 2. Dreamers: planes sueltos a desactivar ───────────────────────────────
console.log('\n[2] Dreamers — planes sueltos a desactivar');
for (const nombre of SUELTOS) {
  const plan = planes.find((p) => p.name === nombre);
  if (!plan) { console.log(`    ${nombre}: no existe, nada que hacer`); continue; }
  const enr = await count(`enrollments?select=id&offering_plan_id=eq.${plan.id}`);
  const pays = await count(`payments?select=id&offering_plan_id=eq.${plan.id}`);
  if (enr > 0 || pays > 0) {
    console.log(`    SALTADO ${nombre}: ${enr} inscripciones / ${pays} cobros — no se desactiva`);
    continue;
  }
  console.log(`    ${nombre}: 0 inscripciones, 0 cobros → is_active ${plan.is_active} → false`);
  await patch(`offering_plans?id=eq.${plan.id}&school_id=eq.${DREAMERS}`, { is_active: false });

  if (SUELTOS_CON_OFFERING.includes(nombre)) {
    const otros = planes.filter((p) => p.offering_id === plan.offering_id && p.id !== plan.id);
    const enrOff = await count(`enrollments?select=id&offering_id=eq.${plan.offering_id}`);
    if (otros.length > 0 || enrOff > 0) {
      console.log(`      offering ${plan.offering_id}: tiene ${otros.length} plan(es) más / ${enrOff} inscripciones — se deja activa`);
    } else {
      console.log(`      offering ${plan.offering_id}: sin otros planes ni inscripciones → is_active false`);
      await patch(`offerings?id=eq.${plan.offering_id}&school_id=eq.${DREAMERS}`, { is_active: false });
    }
  }
}

// ── 3. Dojo Fénix: inscripción a NULL ──────────────────────────────────────
const escuelas = await get(`schools?select=id,name&id=gte.${FENIX_PREFIX}-0000-0000-0000-000000000000&id=lte.${FENIX_PREFIX}-ffff-ffff-ffff-ffffffffffff`);
console.log(`\n[3] Dojo Fénix — escuelas con prefijo ${FENIX_PREFIX}: ${escuelas.length}`);
if (escuelas.length !== 1) {
  console.error('ABORTA el paso 3: el prefijo no resuelve a exactamente una escuela.');
  process.exit(1);
}
const fenix = escuelas[0];
console.log(`    ${fenix.id} · ${fenix.name.trim()}`);
const planesFenix = await get(`offering_plans?select=id,name,registration_fee&school_id=eq.${fenix.id}&registration_fee=not.is.null&order=name`);
if (planesFenix.length === 0) console.log('    sin planes con registration_fee: nada que hacer');
console.log('    -- Para RESTAURAR (valores previos):');
for (const p of planesFenix) {
  console.log(`    UPDATE public.offering_plans SET registration_fee = ${p.registration_fee} WHERE id = '${p.id}'; -- ${p.name}`);
}
for (const p of planesFenix) {
  await patch(`offering_plans?id=eq.${p.id}&school_id=eq.${fenix.id}`, { registration_fee: null });
}

console.log(APPLY ? '\nListo: cambios aplicados.' : '\nDry-run terminado: no se escribió nada.');
