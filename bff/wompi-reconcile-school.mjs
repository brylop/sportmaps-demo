// ============================================================
// SportMaps — Conciliación de cobros online contra la API de Wompi
//
// Responde la pregunta que hay que llevarle a la escuela: "¿cuánta plata REAL
// entró a tu cuenta de Wompi, y cuánto de eso es el fee de SportMaps?".
//
// No se cree la BD: por cada transacción registrada le pregunta a Wompi cuánto
// cobró de verdad y en qué estado quedó. Además detecta en qué ambiente vive
// cada transacción (producción vs sandbox), que es lo que separa la plata real
// de las pruebas.
//
// Uso:
//   cd bff && node wompi-reconcile-school.mjs                          # Dynasty por defecto
//   cd bff && node wompi-reconcile-school.mjs --school <uuid>
//   cd bff && node wompi-reconcile-school.mjs --since 2026-07-01
//   cd bff && node wompi-reconcile-school.mjs --json                   # salida cruda
//
// SOLO LEE. No escribe en la BD ni en Wompi.
//
// Contexto: la escuela en `payment_mode='aggregator'` cobra con las llaves
// WOMPI_* del ENV, que son de Dynasty. Todo el bruto (base + fee de SportMaps)
// entra a esa misma cuenta: no hay split en el Widget de Wompi. Por eso el
// `fee_de_sportmaps` que reporta este script es plata que está en la cuenta de
// la escuela y que SportMaps no ha recaudado.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DYNASTY = '2d509571-3238-4c04-ac3f-6dfe20539226';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const schoolId = flag('school') || DYNASTY;
const since = flag('since');
const asJson = argv.includes('--json');

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0));
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
const padL = (s, n) => String(s ?? '').padStart(n);

/**
 * Pregunta por una transacción en los DOS ambientes. El endpoint de consulta de
 * Wompi es público (no lleva llave), así que no depende de qué credenciales
 * tenga cargadas el BFF — importante, porque las de ENV pueden haber rotado.
 */
async function fetchWompiTx(txId) {
  for (const [ambiente, base] of [
    ['produccion', 'https://production.wompi.co/v1'],
    ['sandbox', 'https://sandbox.wompi.co/v1'],
  ]) {
    try {
      const res = await fetch(`${base}/transactions/${txId}`);
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.data?.id) return { ambiente, tx: json.data };
    } catch {
      // Red caída o timeout: se reporta como no encontrada más abajo.
    }
  }
  return { ambiente: 'no_encontrada', tx: null };
}

async function main() {
  const { data: school } = await sb.from('schools').select('id, name, payment_mode').eq('id', schoolId).maybeSingle();
  if (!school) {
    console.error(`No existe la escuela ${schoolId} en esta base.`);
    process.exit(1);
  }

  // 1. Links pagados de la escuela — llevan el desglose base / fee / gross.
  let q = sb
    .from('payment_links')
    .select('id, payment_id, wompi_reference, provider_reference, payment_provider, base_amount, sportmaps_fee, gross_amount, fee_pct, paid_at, created_at')
    .eq('school_id', schoolId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: true });
  if (since) q = q.gte('created_at', since);
  const { data: links, error: linkErr } = await q;
  if (linkErr) throw new Error(`payment_links: ${linkErr.message}`);

  // 2. El id de transacción del provider vive en payment_splits.
  const splitsByLink = new Map();
  for (let i = 0; i < (links ?? []).length; i += 200) {
    const chunk = links.slice(i, i + 200).map((l) => l.id);
    const { data: splits, error: splitErr } = await sb
      .from('payment_splits')
      .select('payment_link_id, wompi_transaction_id, provider_transaction_id, gross_amount, school_receives, sportmaps_receives, transfer_status')
      .in('payment_link_id', chunk);
    if (splitErr) throw new Error(`payment_splits: ${splitErr.message}`);
    for (const s of splits ?? []) splitsByLink.set(s.payment_link_id, s);
  }

  // 3. Cobros online SIN link: el autopay recurrente cobra `sub.amount` pelado,
  //    nunca crea payment_link ni aplica fee. Van aparte para que no parezca
  //    que el fee "se perdió" cuando en realidad nunca se calculó.
  let q2 = sb
    .from('payments')
    .select('id, concept, amount, gross_amount, sportmaps_fee, payment_type, payment_provider, payment_date, provider_reference')
    .eq('school_id', schoolId)
    .eq('status', 'paid')
    .eq('payment_channel', 'online');
  if (since) q2 = q2.gte('payment_date', since);
  const { data: onlinePayments } = await q2;
  const linkedPaymentIds = new Set((links ?? []).map((l) => l.payment_id));
  const sinLink = (onlinePayments ?? []).filter((p) => !linkedPaymentIds.has(p.id));

  // 4. Consultar Wompi transacción por transacción.
  const rows = [];
  for (const link of links ?? []) {
    const split = splitsByLink.get(link.id);
    const txId = split?.wompi_transaction_id || split?.provider_transaction_id || null;
    const { ambiente, tx } = txId ? await fetchWompiTx(txId) : { ambiente: 'sin_tx_id', tx: null };
    const cobradoReal = tx ? Number(tx.amount_in_cents) / 100 : null;
    const esperado = Number(link.gross_amount);

    rows.push({
      fecha: (link.paid_at || link.created_at || '').slice(0, 10),
      referencia: link.wompi_reference || link.provider_reference,
      provider: link.payment_provider,
      txId,
      ambiente,
      estadoWompi: tx?.status ?? '—',
      base: Number(link.base_amount),
      fee: Number(link.sportmaps_fee),
      feePct: Number(link.fee_pct),
      esperado,
      cobradoReal,
      cuadra: cobradoReal != null && Math.abs(cobradoReal - esperado) <= 1,
      transferStatus: split?.transfer_status ?? '—',
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ school, rows, sinLink }, null, 2));
    return;
  }

  // ── Reporte ────────────────────────────────────────────────────────────────
  console.log(`\n═══ Conciliación Wompi — ${school.name} (payment_mode: ${school.payment_mode}) ═══`);
  if (since) console.log(`Desde ${since}`);
  console.log('');
  console.log(
    pad('FECHA', 11) + pad('REFERENCIA', 24) + pad('AMBIENTE', 13) + pad('ESTADO', 10) +
    padL('BASE', 12) + padL('FEE', 10) + padL('ESPERADO', 12) + padL('REAL', 12) + '  ✓',
  );
  console.log('─'.repeat(108));
  for (const r of rows) {
    console.log(
      pad(r.fecha, 11) + pad(r.referencia, 24) + pad(r.ambiente, 13) + pad(r.estadoWompi, 10) +
      padL(cop(r.base), 12) + padL(cop(r.fee), 10) + padL(cop(r.esperado), 12) +
      padL(r.cobradoReal == null ? '—' : cop(r.cobradoReal), 12) +
      '  ' + (r.cobradoReal == null ? '?' : r.cuadra ? 'ok' : 'DIF'),
    );
  }

  // Solo lo APROBADO en PRODUCCIÓN es plata real que entró a la cuenta.
  const reales = rows.filter((r) => r.ambiente === 'produccion' && r.estadoWompi === 'APPROVED');
  const pruebas = rows.filter((r) => r.ambiente === 'sandbox');
  const huerfanas = rows.filter((r) => r.ambiente === 'no_encontrada' || r.ambiente === 'sin_tx_id');
  const descuadres = rows.filter((r) => r.cobradoReal != null && !r.cuadra);
  const sum = (arr, k) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);

  console.log('\n─── Plata REAL en la cuenta Wompi de la escuela ───────────────────────');
  console.log(`  Transacciones aprobadas en producción : ${reales.length}`);
  console.log(`  Bruto ingresado                       : ${cop(sum(reales, 'cobradoReal'))}`);
  console.log(`    · de la escuela (mensualidades)     : ${cop(sum(reales, 'base'))}`);
  console.log(`    · recargo cobrado al padre          : ${cop(sum(reales, 'fee'))}`);
  console.log('');
  console.log('  OJO: esto es lo que Wompi COBRÓ, no lo que depositó. La API de transacciones no');
  console.log('  expone ni la comisión de Wompi ni la liquidación. Para saber cuánto llegó de verdad');
  console.log('  a la cuenta hay que mirar Liquidaciones/Dispersiones en el dashboard del comercio.');

  console.log('\n─── Lo que NO es plata real ──────────────────────────────────────────');
  console.log(`  En sandbox (pruebas)                  : ${pruebas.length} · ${cop(sum(pruebas, 'cobradoReal'))}`);
  console.log(`  Sin transacción localizable en Wompi  : ${huerfanas.length} · ${cop(sum(huerfanas, 'esperado'))} esperados`);
  if (descuadres.length) {
    console.log(`  ⚠ Descuadres BD vs Wompi              : ${descuadres.length}`);
    for (const d of descuadres) {
      console.log(`      ${d.referencia}: BD ${cop(d.esperado)} vs Wompi ${cop(d.cobradoReal)} (dif ${cop(d.cobradoReal - d.esperado)})`);
    }
  }

  const sinFee = rows.filter((r) => r.fee === 0);
  if (sinFee.length) {
    console.log('\n─── Cobros que salieron SIN fee ──────────────────────────────────────');
    console.log(`  ${sinFee.length} cobros · base ${cop(sum(sinFee, 'base'))} · fee no cobrado al 5%: ${cop(sum(sinFee, 'base') * 0.05)}`);
    console.log('  (nunca se le pidió al padre: no es plata a reclamar, es ingreso que no se generó)');
  }

  if (sinLink.length) {
    console.log('\n─── Cobros online sin payment_link ───────────────────────────────────');
    console.log(`  ${sinLink.length} cobros · ${cop(sinLink.reduce((a, p) => a + Number(p.amount || 0), 0))}`);
    console.log('  Típicamente autopay recurrente: cobra el monto del plan pelado, sin fee.');
    for (const p of sinLink.slice(0, 20)) {
      console.log(`      ${(p.payment_date || '').slice(0, 10)}  ${pad(p.concept, 30)} ${padL(cop(p.amount), 12)}  ${p.payment_type}`);
    }
  }

  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
