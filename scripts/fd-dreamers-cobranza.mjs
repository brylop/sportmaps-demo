// ============================================================================
// F-D (docs/specs/dreamers-reglas-completas-plan.md) — datos de Dreamers
// Gymnastics para la cobranza. Requiere la migración 20261005214253 APLICADA
// (columnas auto_cancel_overdue_enabled / pending_proof_counts_as_paid).
//
// Paso normal (tras aplicar la migración):
//   · auto_cancel_overdue_enabled  = false  → el cron no cancela inscripciones
//   · pending_proof_counts_as_paid = true   → comprobante en revisión = pagado;
//                                             rechazado = deuda otra vez
// Paso FINAL de todo el plan (otro momento, lo corre una persona tras el deploy
// del BFF y de las demás fases):
//   · --activar-bloqueo → access_auto_block_overdue_enabled = true
//
// Uso:
//   node scripts/fd-dreamers-cobranza.mjs                      (dry-run, default)
//   node scripts/fd-dreamers-cobranza.mjs --apply              (escribe los 2 flags)
//   node scripts/fd-dreamers-cobranza.mjs --activar-bloqueo    (dry-run del bloqueo)
//   node scripts/fd-dreamers-cobranza.mjs --activar-bloqueo --apply
//
// Credenciales: bff/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) o variables
// de entorno con el mismo nombre. Idempotente: solo escribe si cambia algo.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APPLY = process.argv.includes('--apply');
const ACTIVAR_BLOQUEO = process.argv.includes('--activar-bloqueo');

const SCHOOL_ID = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe'; // Dreamers Gymnastics

function loadEnv() {
  const file = path.join(ROOT, 'bff/.env');
  const fromFile = fs.existsSync(file)
    ? Object.fromEntries(
      fs.readFileSync(file, 'utf8')
        .split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
    )
    : {};
  return {
    url: (process.env.SUPABASE_URL || fromFile.SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || fromFile.SUPABASE_SERVICE_ROLE_KEY,
  };
}

const { url: BASE, key: KEY } = loadEnv();
if (!BASE || !KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (bff/.env o entorno).');
  process.exit(1);
}
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const COLS = [
  'school_id', 'auto_cancel_overdue_enabled', 'pending_proof_counts_as_paid',
  'access_auto_block_overdue_enabled', 'access_block_mechanism', 'payment_grace_days', 'late_fee_enabled',
];

async function leer() {
  const r = await fetch(
    `${BASE}/rest/v1/school_settings?school_id=eq.${SCHOOL_ID}&select=${COLS.join(',')}`,
    { headers: HEADERS },
  );
  const body = await r.json();
  if (!r.ok) {
    throw new Error(`No se pudo leer school_settings (${r.status}): ${JSON.stringify(body)}`
      + '\n¿Ya se aplicó la migración 20261005214253?');
  }
  if (!Array.isArray(body) || body.length !== 1) throw new Error(`Esperaba 1 fila de school_settings, hay ${body.length}`);
  return body[0];
}

async function main() {
  const objetivo = ACTIVAR_BLOQUEO
    ? { access_auto_block_overdue_enabled: true }
    : { auto_cancel_overdue_enabled: false, pending_proof_counts_as_paid: true };

  console.log(`Modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (nada se escribe)'} · paso: ${ACTIVAR_BLOQUEO ? 'activar bloqueo por mora' : 'flags de cobranza'}`);
  const antes = await leer();
  console.log('Antes:', antes);

  const cambios = Object.fromEntries(Object.entries(objetivo).filter(([k, v]) => antes[k] !== v));
  if (!Object.keys(cambios).length) {
    console.log('Nada que cambiar: ya está en el estado objetivo.');
    return;
  }
  console.log('Cambios:', cambios);

  if (ACTIVAR_BLOQUEO && antes.pending_proof_counts_as_paid !== true) {
    console.warn('AVISO: pending_proof_counts_as_paid sigue en false — correr primero el paso sin --activar-bloqueo.');
  }

  if (!APPLY) {
    console.log('(dry-run: agregar --apply para escribir)');
    return;
  }

  const r = await fetch(`${BASE}/rest/v1/school_settings?school_id=eq.${SCHOOL_ID}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(cambios),
  });
  const body = await r.json();
  if (!r.ok || !Array.isArray(body) || body.length !== 1) {
    throw new Error(`PATCH falló (${r.status}): ${JSON.stringify(body)}`);
  }
  console.log('Después:', await leer());
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
