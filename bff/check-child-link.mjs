// ============================================================
// SportMaps — ¿el hijo quedó bien enganchado al acudiente? (read-only)
//
// Tras aceptar una invitación, accept_invitation busca al niño por
// parent_id y si no, por (parent_email_temp, full_name). Si el correo con
// el que se registró el papá NO coincide con parent_email_temp, la RPC
// crea un children NUEVO y el registro pre-cargado (con su inscripción y
// sus cobros) queda huérfano. Este script detecta ese caso.
//
// Uso:
//   cd bff && node check-child-link.mjs "SEBASTIAN PEREZ PEÑA"
//   cd bff && node check-child-link.mjs --email jennymipe@gmail.com
//
// NO escribe nada.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const emailIdx = argv.indexOf('--email');
const email = emailIdx >= 0 ? argv[emailIdx + 1] : null;
const nombre = argv.find((a) => !a.startsWith('--') && a !== email) || null;
if (!nombre && !email) {
  console.error('Uso: node check-child-link.mjs "NOMBRE DEL NIÑO"');
  console.error('     node check-child-link.mjs --email correo@dominio.com');
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log('Proyecto:', env.SUPABASE_URL.replace('https://', '').split('.')[0], '\n');

// ── Acudiente ─────────────────────────────────────────────────────────────
let parent = null;
if (email) {
  const { data } = await sb.from('profiles').select('id,full_name,email,role').ilike('email', email).maybeSingle();
  parent = data;
  console.log('=== Acudiente ===');
  console.log(parent || '(sin profile con ese correo)');
}

// ── Filas de children ─────────────────────────────────────────────────────
let q = sb.from('children').select('id,full_name,parent_id,parent_email_temp,school_id,team_id,doc_number,created_at');
q = nombre ? q.ilike('full_name', `%${nombre}%`) : q.ilike('parent_email_temp', `%${email}%`);
const { data: kids, error } = await q;
if (error) { console.error('children:', error.message); process.exit(1); }

console.log(`\n=== children (${kids?.length || 0}) ===`);
if (!kids?.length) { console.log('(sin filas)'); process.exit(0); }
console.table(kids.map((k) => ({
  id: k.id,
  nombre: k.full_name,
  parent_id: k.parent_id || '❌ NULL (huérfano)',
  email_temp: k.parent_email_temp,
  doc: k.doc_number,
  creado: (k.created_at || '').slice(0, 19).replace('T', ' '),
})));

// ── Inscripciones y cobros por cada fila ──────────────────────────────────
for (const k of kids) {
  const { data: enr } = await sb.from('enrollments')
    .select('id,status,monthly_fee,team_id,offering_plan_id').eq('child_id', k.id);
  const { data: pays } = await sb.from('payments')
    .select('id,status,amount,due_date,parent_id').eq('child_id', k.id);
  console.log(`\n--- ${k.full_name} (${k.id}) ---`);
  console.log('  inscripciones:', (enr || []).map((e) => `${e.status} $${e.monthly_fee}`).join(', ') || '(ninguna)');
  console.log('  cobros       :', (pays || []).map((p) => `${p.status} $${p.amount} vence ${p.due_date}`).join(', ') || '(ninguno)');
  const sinPagador = (pays || []).filter((p) => !p.parent_id);
  if (sinPagador.length) console.log(`  ⚠️  ${sinPagador.length} cobro(s) con parent_id NULL → el papá verá "No tienes permiso para pagar".`);
}

// ── Veredicto ─────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
const dupes = {};
for (const k of kids) (dupes[k.full_name.trim().toUpperCase()] ||= []).push(k);
const dupeNames = Object.entries(dupes).filter(([, v]) => v.length > 1);
const huerfanos = kids.filter((k) => !k.parent_id);

if (dupeNames.length) {
  console.log('❌ DUPLICADO: el mismo niño aparece en más de una fila de children:');
  for (const [n, v] of dupeNames) console.log(`   - ${n}: ${v.map((x) => x.id).join(', ')}`);
  console.log('   Hay que fusionar: mover inscripciones/cobros a la fila buena y desactivar la otra.');
} else if (huerfanos.length) {
  console.log(`⚠️  ${huerfanos.length} fila(s) con parent_id NULL — el acudiente no está enganchado.`);
} else {
  console.log('✅ Sin duplicados y con parent_id asignado. El enganche quedó bien.');
}
