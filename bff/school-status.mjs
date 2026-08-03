// ============================================================
// SportMaps — Foto operativa de una escuela
//
// Un solo comando para ver en qué estado está una escuela HOY: config de cobro,
// atletas, inscripciones, cobros del mes, recaudo online y riesgos abiertos.
// Pensado para correrlo antes y después de un cambio (migración, deploy) y
// comparar: si un número se mueve solo, algo pasó.
//
// Uso:
//   cd bff && node school-status.mjs                        # Dynasty por defecto
//   cd bff && node school-status.mjs --school <uuid>
//   cd bff && node school-status.mjs --period 2026-08        # otro mes
//
// SOLO LEE. No escribe en la BD.
//
// Complemento: wompi-reconcile-school.mjs concilia contra la API de Wompi lo que
// este script reporta desde la BD.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DYNASTY = '2d509571-3238-4c04-ac3f-6dfe20539226';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const schoolId = flag('school') || DYNASTY;
const periodArg = flag('period');

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0));
const num = (n) => String(n).padStart(6);
const h = (t) => console.log(`\n─── ${t} ${'─'.repeat(Math.max(0, 66 - t.length))}`);

/** Corre una query y devuelve [] si falla, reportando el motivo. Así una columna
 *  que cambió de nombre no tumba todo el reporte. */
async function q(label, builder) {
  try {
    const { data, error } = await builder;
    if (error) { console.log(`   ⚠ ${label}: ${error.message}`); return []; }
    return data ?? [];
  } catch (e) {
    console.log(`   ⚠ ${label}: ${e.message}`);
    return [];
  }
}

// Período por defecto: el mes en curso.
const today = periodArg ? new Date(`${periodArg}-01T00:00:00Z`) : new Date();
const pYear = today.getUTCFullYear();
const pMonth = today.getUTCMonth() + 1;

// ══ 1. Identidad y configuración de cobro ══════════════════════════════════
const [school] = await q('schools', sb.from('schools').select('id, name, payment_mode, owner_id, created_at').eq('id', schoolId));
if (!school) { console.error(`No existe la escuela ${schoolId}.`); process.exit(1); }

console.log(`\n══════════════════════════════════════════════════════════════════════`);
console.log(`  ${school.name}`);
console.log(`  período analizado: ${pYear}-${String(pMonth).padStart(2, '0')}`);
console.log(`══════════════════════════════════════════════════════════════════════`);

const [settings] = await q('school_settings', sb.from('school_settings')
  .select('online_fee_pct, fee_payer, wompi_enabled, auto_generate_payments, sportmaps_pay_terms_accepted_at')
  .eq('school_id', schoolId));

h('Configuración de cobro');
console.log(`   payment_mode          ${school.payment_mode}`);
console.log(`   wompi_enabled         ${settings?.wompi_enabled}`);
console.log(`   recargo online        ${settings?.online_fee_pct ?? '(sin fila)'}%  · lo asume: ${settings?.fee_payer ?? '?'}`);
console.log(`   términos aceptados    ${settings?.sportmaps_pay_terms_accepted_at ?? 'NO'}`);
console.log(`   genera cobros auto    ${settings?.auto_generate_payments}`);

const providers = await q('school_payment_providers', sb.from('school_payment_providers')
  .select('provider, enabled, is_default, sandbox, connect_status').eq('school_id', schoolId));
console.log(`   cuentas conectadas    ${providers.length === 0 ? 'ninguna (usa llaves de ENV)' : ''}`);
for (const p of providers) {
  console.log(`     · ${p.provider} enabled=${p.enabled} default=${p.is_default} sandbox=${p.sandbox} status=${p.connect_status ?? '—'}`);
}

// ══ 2. Plan SaaS que la escuela paga ═══════════════════════════════════════
const subs = await q('school_subscriptions', sb.from('school_subscriptions')
  .select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(3));
h('Plan SaaS (lo que la escuela le paga a SportMaps)');
if (!subs.length) console.log('   (sin fila en school_subscriptions)');
for (const s of subs) {
  console.log(`   ${s.plan_code ?? s.tier ?? '?'} · status=${s.status ?? '?'} · trial_ends=${s.trial_ends_at ?? '—'} · period_end=${s.current_period_end ?? '—'}`);
}

// ══ 3. Atletas ═════════════════════════════════════════════════════════════
const athletes = await q('school_athletes', sb.from('school_athletes')
  .select('id, is_active, athlete_type, parent_id, user_id, enrolled_team_id, enrollment_id, offering_plan_id, price_monthly')
  .eq('school_id', schoolId).limit(5000));

const act = athletes.filter((a) => a.is_active);
h('Atletas');
console.log(`   total                 ${num(athletes.length)}`);
console.log(`   activos               ${num(act.length)}   (es la base del plan SaaS)`);
console.log(`   inactivos             ${num(athletes.length - act.length)}`);
console.log(`   menores / adultos     ${num(act.filter((a) => a.athlete_type === 'child').length)} / ${act.filter((a) => a.athlete_type !== 'child').length}`);
console.log(`   activos sin equipo    ${num(act.filter((a) => !a.enrolled_team_id).length)}`);
console.log(`   activos sin plan      ${num(act.filter((a) => !a.offering_plan_id).length)}`);
console.log(`   activos con cuota 0   ${num(act.filter((a) => Number(a.price_monthly) === 0).length)}   ← no se les puede generar cobro`);
const minoresSinPadre = act.filter((a) => a.athlete_type === 'child' && !a.parent_id);
console.log(`   menores sin acudiente ${num(minoresSinPadre.length)}   ← sus cobros nacen sin pagador`);

// ══ 4. Inscripciones ═══════════════════════════════════════════════════════
const enrolls = await q('enrollments', sb.from('enrollments')
  .select('id, status, child_id, user_id, team_id, monthly_fee, offering_plan_id, created_at')
  .eq('school_id', schoolId).limit(5000));
const activas = enrolls.filter((e) => e.status === 'active');

const porAtleta = new Map();
for (const e of activas) {
  const k = e.child_id || e.user_id;
  if (!k) continue;
  porAtleta.set(k, (porAtleta.get(k) ?? 0) + 1);
}
const dupEnroll = [...porAtleta.values()].filter((n) => n > 1).length;

h('Inscripciones');
console.log(`   total                 ${num(enrolls.length)}`);
console.log(`   activas               ${num(activas.length)}`);
console.log(`   atletas con 2+ activas${num(dupEnroll)}   ← causa de cobro doble (bug F0)`);
console.log(`   activas sin cuota     ${num(activas.filter((e) => !e.monthly_fee).length)}`);

// ══ 5. Cobros ══════════════════════════════════════════════════════════════
const pays = await q('payments', sb.from('payments')
  .select('id, status, amount, amount_paid, parent_id, child_id, user_id, period_year, period_month, due_date, payment_date, payment_channel, payment_provider, requires_review, gross_amount, sportmaps_fee, created_at')
  .eq('school_id', schoolId).limit(20000));

const delMes = pays.filter((p) => p.period_year === pYear && p.period_month === pMonth);
const abiertos = pays.filter((p) => ['pending', 'overdue', 'partial', 'awaiting_approval'].includes(p.status));
const sum = (arr, k = 'amount') => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
const byStatus = (arr) => {
  const t = {};
  for (const p of arr) t[p.status] = (t[p.status] ?? 0) + 1;
  return t;
};

h(`Cobros del período ${pYear}-${String(pMonth).padStart(2, '0')}`);
console.log(`   generados             ${num(delMes.length)} · ${cop(sum(delMes))}`);
for (const [s, n] of Object.entries(byStatus(delMes)).sort((a, b) => b[1] - a[1])) {
  const grupo = delMes.filter((p) => p.status === s);
  console.log(`     · ${String(s).padEnd(18)} ${num(n)} · ${cop(sum(grupo))}`);
}

h('Cobros abiertos (todos los períodos)');
console.log(`   total                 ${num(abiertos.length)} · ${cop(sum(abiertos))}`);
const vencidos = abiertos.filter((p) => p.due_date && p.due_date < new Date().toISOString().slice(0, 10));
console.log(`   ya vencidos           ${num(vencidos.length)} · ${cop(sum(vencidos))}`);

// ══ 6. Riesgos abiertos ════════════════════════════════════════════════════
const sinPagador = abiertos.filter((p) => !p.parent_id && p.child_id);
const bloqueados = pays.filter((p) => p.requires_review);
const sinPeriodo = abiertos.filter((p) => !p.period_year || !p.period_month);

const dupPagos = new Map();
for (const p of abiertos) {
  if (!p.child_id || !p.period_year) continue;
  const k = `${p.child_id}|${p.period_year}-${p.period_month}`;
  dupPagos.set(k, (dupPagos.get(k) ?? 0) + 1);
}
const dupCount = [...dupPagos.values()].filter((n) => n > 1).length;

h('Riesgos abiertos');
console.log(`   sin pagador           ${num(sinPagador.length)} · ${cop(sum(sinPagador))}   ← el acudiente recibe 403 al pagar`);
console.log(`   requires_review       ${num(bloqueados.length)}   ← checkout bloqueado (409)`);
console.log(`   duplicados por período${num(dupCount)}   ← mismo menor, mismo mes, 2+ cobros abiertos`);
console.log(`   abiertos sin período  ${num(sinPeriodo.length)}   ← el índice único no los protege`);

// ══ 7. Recaudo online ══════════════════════════════════════════════════════
const links = await q('payment_links', sb.from('payment_links')
  .select('id, status, fee_pct, base_amount, sportmaps_fee, gross_amount, expires_at, created_at, payment_provider')
  .eq('school_id', schoolId).limit(5000));
const pagados = links.filter((l) => l.status === 'paid');
const pendVigentes = links.filter((l) => l.status === 'pending' && l.expires_at > new Date().toISOString());
const feeVigente = Number(settings?.online_fee_pct ?? 0);
const desfasados = pendVigentes.filter((l) => Number(l.fee_pct) !== feeVigente);

h('Recaudo online');
console.log(`   cobros pagados online ${num(pagados.length)}`);
console.log(`     base (mensualidades)       ${cop(sum(pagados, 'base_amount'))}`);
console.log(`     recargo cobrado            ${cop(sum(pagados, 'sportmaps_fee'))}`);
console.log(`     bruto que entró a la cuenta${cop(sum(pagados, 'gross_amount'))}`);
console.log(`   sin recargo (fee_pct=0)${num(pagados.filter((l) => Number(l.fee_pct) === 0).length)} · base ${cop(sum(pagados.filter((l) => Number(l.fee_pct) === 0), 'base_amount'))}`);
console.log(`   links pending vigentes ${num(pendVigentes.length)}`);
console.log(`   con tarifa desfasada   ${num(desfasados.length)}   ← se recrean solos al abrir el checkout`);

h('Siguiente paso');
console.log('   Conciliar contra Wompi:  node wompi-reconcile-school.mjs' + (schoolId !== DYNASTY ? ` --school ${schoolId}` : ''));
console.log('');
