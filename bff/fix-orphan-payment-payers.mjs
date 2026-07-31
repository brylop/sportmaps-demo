// ============================================================
// SportMaps — Cobros de menores sin pagador (parent_id NULL)
//
// Cuando la escuela genera cobros ANTES de que el acudiente exista, los
// payments quedan con parent_id NULL. Después el papá acepta la invitación:
// accept_invitation engancha children.parent_id pero NO vuelve atrás a
// rellenar los cobros. Resultado: el papá entra a pagar y recibe 403
// "No tienes permiso para pagar".
//
// Este script busca cobros con parent_id NULL cuyo niño YA tiene
// parent_id, y los rellena con ese mismo acudiente.
//
// Uso:
//   cd bff && node fix-orphan-payment-payers.mjs                       # diagnóstico global (dry-run)
//   cd bff && node fix-orphan-payment-payers.mjs --school <uuid>       # acotado a una escuela
//   cd bff && node fix-orphan-payment-payers.mjs --child <uuid>        # un solo niño
//   cd bff && node fix-orphan-payment-payers.mjs --status pending      # solo un estado
//   cd bff && node fix-orphan-payment-payers.mjs --yes                 # APLICA el UPDATE
//
// Sin --yes no escribe nada. NO toca cobros cuyo niño sigue huérfano
// (parent_id NULL): ahí no hay a quién asignar y hace falta resolver
// primero la vinculación del acudiente.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const apply = argv.includes('--yes');
const schoolId = flag('school');
const childId = flag('child');
const statusF = flag('status');

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log('Proyecto:', env.SUPABASE_URL.replace('https://', '').split('.')[0]);
console.log('Modo    :', apply ? '⚠️  APLICAR' : '🔍 dry-run');
console.log('');

// ── 1. Cobros huérfanos ───────────────────────────────────────────────────
const PAGE = 1000;
let cobros = [];
for (let from = 0; ; from += PAGE) {
  let q = sb.from('payments')
    .select('id,child_id,parent_id,school_id,status,amount,due_date')
    .is('parent_id', null)
    .not('child_id', 'is', null)
    .range(from, from + PAGE - 1);
  if (schoolId) q = q.eq('school_id', schoolId);
  if (childId) q = q.eq('child_id', childId);
  if (statusF) q = q.eq('status', statusF);
  const { data, error } = await q;
  if (error) { console.error('payments:', error.message); process.exit(1); }
  cobros.push(...(data || []));
  if (!data || data.length < PAGE) break;
}
console.log(`Cobros con parent_id NULL y child_id no nulo: ${cobros.length}`);
if (!cobros.length) { console.log('✅ Nada que arreglar.'); process.exit(0); }

// ── 2. Resolver el acudiente de cada niño ─────────────────────────────────
const kidIds = [...new Set(cobros.map((p) => p.child_id))];
const kids = {};
for (let i = 0; i < kidIds.length; i += 200) {
  const { data } = await sb.from('children')
    .select('id,full_name,parent_id,parent_email_temp,school_id')
    .in('id', kidIds.slice(i, i + 200));
  for (const k of data || []) kids[k.id] = k;
}

const arreglables = [];
const bloqueados = [];
for (const p of cobros) {
  const k = kids[p.child_id];
  if (k?.parent_id) arreglables.push({ ...p, _kid: k });
  else bloqueados.push({ ...p, _kid: k });
}

// ── 3. Reporte ────────────────────────────────────────────────────────────
const porEstado = (arr) => arr.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
const suma = (arr) => arr.reduce((a, p) => a + Number(p.amount || 0), 0);

console.log(`\n✅ ARREGLABLES (el niño ya tiene acudiente): ${arreglables.length}  —  $${suma(arreglables).toLocaleString('es-CO')}`);
console.log('   por estado:', porEstado(arreglables));
if (arreglables.length) {
  console.table(arreglables.slice(0, 15).map((p) => ({
    cobro: p.id.slice(0, 8), nino: p._kid.full_name, estado: p.status,
    monto: p.amount, vence: p.due_date, nuevo_parent: p._kid.parent_id.slice(0, 8),
  })));
  if (arreglables.length > 15) console.log(`   … y ${arreglables.length - 15} más`);
}

console.log(`\n⛔ BLOQUEADOS (el niño TAMBIÉN está huérfano): ${bloqueados.length}  —  $${suma(bloqueados).toLocaleString('es-CO')}`);
console.log('   por estado:', porEstado(bloqueados));
if (bloqueados.length) {
  console.log('   Estos no se pueden arreglar acá: falta que el acudiente se registre y');
  console.log('   acepte la invitación, o correr claim_orphan_children para su correo.');
  console.table(bloqueados.slice(0, 10).map((p) => ({
    cobro: p.id.slice(0, 8), nino: p._kid?.full_name || '(sin children)',
    email_temp: p._kid?.parent_email_temp, estado: p.status, monto: p.amount,
  })));
  if (bloqueados.length > 10) console.log(`   … y ${bloqueados.length - 10} más`);
}

// ── 4. Aplicar ────────────────────────────────────────────────────────────
if (!apply) {
  console.log('\n🔍 DRY-RUN — no se escribió nada. Corré con --yes para rellenar los arreglables.');
  process.exit(0);
}
if (!arreglables.length) { console.log('\nNada para aplicar.'); process.exit(0); }

let ok = 0; const fallos = [];
// Agrupado por acudiente: un UPDATE por cada parent, filtrando por sus cobros.
const porParent = {};
for (const p of arreglables) (porParent[p._kid.parent_id] ||= []).push(p.id);

for (const [parentId, ids] of Object.entries(porParent)) {
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { error } = await sb.from('payments').update({ parent_id: parentId }).in('id', lote);
    if (error) fallos.push({ parentId, lote: lote.length, error: error.message });
    else ok += lote.length;
  }
}
console.log(`\nUPDATE aplicado a ${ok}/${arreglables.length} cobros.`);
if (fallos.length) { console.log('❌ Fallos:'); console.table(fallos); }

// ── 5. Verificación ───────────────────────────────────────────────────────
const idsArreglados = arreglables.map((p) => p.id);
let restantes = 0;
for (let i = 0; i < idsArreglados.length; i += 200) {
  const { count } = await sb.from('payments')
    .select('id', { count: 'exact', head: true })
    .is('parent_id', null)
    .in('id', idsArreglados.slice(i, i + 200));
  restantes += count || 0;
}
console.log(`Verificación → siguen con parent_id NULL: ${restantes}`);
console.log(restantes === 0 ? '\n✅ Todos los arreglables quedaron con pagador.' : '\n❌ Quedaron cobros sin pagador.');
