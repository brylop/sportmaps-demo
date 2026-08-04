// ============================================================
// SportMaps — Cancelar una invitación pendiente
//
// Hace lo mismo que el botón "Cancelar" de InvitationsManagementPage:
// UPDATE invitations SET status = 'cancelled'. NO borra la fila (queda
// el rastro de que existió y quién la creó).
//
// Uso:
//   cd bff && node cancel-invitation.mjs <invitation_id>            # dry-run: solo muestra
//   cd bff && node cancel-invitation.mjs <invitation_id> --yes      # aplica
//   cd bff && node cancel-invitation.mjs --email jennymipi@gmail.com --yes
//
// Sin --yes no escribe nada. Si el filtro por email matchea más de una
// invitación pendiente, aborta y te pide que uses el id explícito.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const apply = argv.includes('--yes');
const emailIdx = argv.indexOf('--email');
const email = emailIdx >= 0 ? argv[emailIdx + 1] : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invId = argv.find((a) => UUID_RE.test(a)) || null;

if (!invId && !email) {
  console.error('Uso: node cancel-invitation.mjs <invitation_id> [--yes]');
  console.error('     node cancel-invitation.mjs --email correo@dominio.com [--yes]');
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

// ── 1. Localizar la invitación ────────────────────────────────────────────
let q = sb.from('invitations').select('*');
q = invId ? q.eq('id', invId) : q.ilike('email', email).eq('status', 'pending');
const { data: rows, error } = await q;
if (error) { console.error('Error consultando invitations:', error.message); process.exit(1); }
if (!rows?.length) { console.error('❌ No se encontró ninguna invitación con ese criterio.'); process.exit(1); }
if (rows.length > 1) {
  console.error(`❌ El filtro matchea ${rows.length} invitaciones. Usá el id explícito:`);
  console.table(rows.map((r) => ({ id: r.id, email: r.email, estado: r.status, nino: r.child_name, creada: (r.created_at || '').slice(0, 19) })));
  process.exit(1);
}

const inv = rows[0];
console.log('=== Invitación objetivo ===');
console.table([{
  id: inv.id, email: inv.email, estado: inv.status, rol: inv.role_to_assign,
  nino: inv.child_name, creada: (inv.created_at || '').slice(0, 19).replace('T', ' '),
  cuota: inv.monthly_fee,
}]);

if (inv.status !== 'pending') {
  console.log(`\n⚠️  Ya está en estado "${inv.status}" — no hay nada que cancelar.`);
  process.exit(0);
}

// ── 2. Contexto: otras invitaciones del mismo niño ────────────────────────
if (inv.child_name) {
  const { data: hermanas } = await sb.from('invitations')
    .select('id,email,status,created_at')
    .ilike('child_name', inv.child_name)
    .order('created_at', { ascending: false });
  console.log(`\n=== Otras invitaciones de "${inv.child_name}" ===`);
  console.table((hermanas || []).map((r) => ({
    id: r.id === inv.id ? `${r.id}  ← esta` : r.id,
    email: r.email, estado: r.status, creada: (r.created_at || '').slice(0, 19).replace('T', ' '),
  })));
  // Solo es riesgoso si no queda NINGUNA otra vía: ni otra pendiente, ni una
  // ya aceptada (si hay aceptada, el acudiente ya está vinculado).
  const otrasVivas = (hermanas || []).filter((r) => r.id !== inv.id && ['pending', 'accepted'].includes(r.status));
  if (!otrasVivas.length) {
    console.log('\n⚠️  OJO: no queda ninguna otra invitación viva de este niño. Si la cancelás,');
    console.log('    el acudiente se queda sin forma de vincularse por correo.');
  } else if (otrasVivas.some((r) => r.status === 'accepted')) {
    console.log('\n✔️  Ya hay una invitación ACEPTADA para este niño — cancelar esta es seguro.');
  }
}

// ── 3. Aplicar ────────────────────────────────────────────────────────────
if (!apply) {
  console.log('\n🔍 DRY-RUN — no se escribió nada. Volvé a correr con --yes para aplicar.');
  process.exit(0);
}

const { error: uErr } = await sb.from('invitations').update({ status: 'cancelled' }).eq('id', inv.id);
console.log('\nUPDATE status=cancelled →', uErr ? `ERROR: ${uErr.message}` : 'OK');
if (uErr) process.exit(1);

const { data: chk } = await sb.from('invitations').select('id,email,status').eq('id', inv.id).maybeSingle();
console.log('Verificación →', chk);
console.log(chk?.status === 'cancelled' ? '\n✅ Invitación cancelada.' : '\n❌ El estado no quedó en cancelled.');
