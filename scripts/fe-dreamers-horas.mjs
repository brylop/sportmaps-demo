// ============================================================================
// F-E (docs/specs/dreamers-reglas-completas-plan.md) — prende los cargos por
// horas de más del banco de horas para Dreamers Gymnastics.
//
// Escribe UN dato: school_settings.hour_bank_overage_charges_enabled = true.
// Es configuración por datos (cero school_id en la lógica). Con el flag
// prendido, el cron de las 03:00 deja cargos SUGERIDOS; el owner confirma o
// descarta. Nada se cobra solo.
//
// Prerrequisitos (el script los verifica y se niega si faltan):
//   · migración de F-A aplicada ('excedente' en payments_payment_category_check)
//   · migración 20261005214302_hour_bank_overage_charges aplicada
//
// Uso:
//   node scripts/fe-dreamers-horas.mjs              (dry-run, default)
//   node scripts/fe-dreamers-horas.mjs --apply      (escribe)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, 'bff/.env'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const BASE = (env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const SCHOOL_ID = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
const SCHOOL_NAME = 'Dreamers Gymnastics';

async function rest(method, pathAndQuery, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...HEADERS, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} → ${res.status}: ${text}`);
  return data;
}

async function main() {
  if (!BASE || !KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
  console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (nada se escribe)'}\n`);

  // 1) La columna existe → la migración de F-E está aplicada.
  let settings;
  try {
    [settings] = await rest('GET',
      `school_settings?school_id=eq.${SCHOOL_ID}&select=school_id,hours_plan_enabled,hours_billing_rounding,hour_bank_overage_charges_enabled`);
  } catch (err) {
    throw new Error(`¿Falta aplicar 20261005214302_hour_bank_overage_charges? ${err.message}`);
  }
  if (!settings) throw new Error(`${SCHOOL_NAME}: no tiene fila en school_settings`);
  console.log(`${SCHOOL_NAME} hoy:`, settings);
  if (!settings.hours_plan_enabled) {
    console.log('⚠ hours_plan_enabled = false: el flag no tendrá efecto hasta prender el banco de horas.');
  }

  // 2) Vista previa: periodos cerrados con excedente que el cron sugeriría.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const periods = await rest('GET',
    `hour_bank_periods?school_id=eq.${SCHOOL_ID}&period_end=lt.${today}` +
    '&select=id,enrollment_id,period_start,period_end,included_minutes,consumed_minutes&order=period_start');
  const overage = periods.filter((p) => p.consumed_minutes > p.included_minutes);
  console.log(`\nPeriodos cerrados con excedente: ${overage.length}`);
  for (const p of overage) {
    const extra = p.consumed_minutes - p.included_minutes;
    const hours = settings.hours_billing_rounding === 'hour_up' ? Math.ceil(extra / 60) : +(extra / 60).toFixed(2);
    console.log(`  ${p.period_start}..${p.period_end}  ${p.consumed_minutes}/${p.included_minutes} min → ${extra} min de más → ${hours} h (${settings.hours_billing_rounding})`);
  }

  if (settings.hour_bank_overage_charges_enabled) {
    console.log('\nYa estaba prendido. Nada que hacer.');
    return;
  }
  if (!APPLY) {
    console.log('\n(dry-run) Se pondría hour_bank_overage_charges_enabled = true. Corre con --apply para escribir.');
    return;
  }

  const updated = await rest('PATCH', `school_settings?school_id=eq.${SCHOOL_ID}`,
    { hour_bank_overage_charges_enabled: true }, { Prefer: 'return=representation' });
  console.log('\nAplicado:', updated?.[0]?.hour_bank_overage_charges_enabled === true ? 'OK' : updated);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
