// ============================================================
// SportMaps — Correos enviados e invitaciones recientes (read-only)
//
// Uso:
//   cd bff && node list-recent-emails.mjs                     # últimos 40 correos + 15 invitaciones
//   cd bff && node list-recent-emails.mjs --to jennymipi      # filtra destinatario (substring)
//   cd bff && node list-recent-emails.mjs --child "PEREZ PE"  # filtra invitaciones por nombre del niño
//   cd bff && node list-recent-emails.mjs --limit 100
//   cd bff && node list-recent-emails.mjs --json              # vuelca a bff/recent_emails.json
//
// Lee `email_sends` (registro de envíos vía Resend) y `invitations`
// (cada invitación dispara un correo). Marca en rojo los envíos fallidos
// y avisa si un mismo niño tiene más de una invitación pendiente.
//
// NO escribe nada. Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de bff/.env.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const toFilter = flag('to');
const childFilter = flag('child');
const limit = Number(flag('limit', 40));
const wantJson = argv.includes('--json');

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
  process.exit(2);
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const short = (s) => (s || '').slice(0, 19).replace('T', ' ');

console.log('Proyecto:', env.SUPABASE_URL.replace('https://', '').split('.')[0]);
if (toFilter) console.log('Filtro destinatario:', toFilter);
if (childFilter) console.log('Filtro niño       :', childFilter);
console.log('');

// ── 1. email_sends ────────────────────────────────────────────────────────
let q = sb.from('email_sends').select('*').order('created_at', { ascending: false }).limit(limit);
if (toFilter) q = q.ilike('to_email', `%${toFilter}%`);
const { data: sends, error: sErr } = await q;
if (sErr) console.error('email_sends:', sErr.message);

console.log(`=== email_sends (${sends?.length || 0}) ===`);
if (sends?.length) {
  console.table(sends.map((r) => ({
    creado: short(r.created_at),
    para: r.to_email,
    tipo: r.email_type,
    estado: r.status,
    error: r.error_message ? String(r.error_message).slice(0, 45) : '',
  })));
  const fallidos = sends.filter((r) => r.status && r.status !== 'sent');
  if (fallidos.length) console.log(`⚠️  ${fallidos.length} envío(s) NO exitosos arriba.`);
} else {
  console.log('(sin registros)');
}

// ── 2. invitations (cada una dispara un correo) ───────────────────────────
let qi = sb.from('invitations')
  .select('id,email,status,child_name,role_to_assign,created_at,expires_at,school_id')
  .order('created_at', { ascending: false })
  .limit(limit);
if (toFilter) qi = qi.ilike('email', `%${toFilter}%`);
if (childFilter) qi = qi.ilike('child_name', `%${childFilter}%`);
const { data: invs, error: iErr } = await qi;
if (iErr) console.error('invitations:', iErr.message);

console.log(`\n=== invitations (${invs?.length || 0}) ===`);
if (invs?.length) {
  console.table(invs.map((r) => ({
    creada: short(r.created_at),
    email: r.email,
    estado: r.status,
    rol: r.role_to_assign,
    nino: r.child_name,
    expira: (r.expires_at || '').slice(0, 10),
  })));

  // Aviso: mismo niño con más de una invitación pendiente → al aceptar una,
  // la otra queda huérfana y puede duplicar el registro del atleta.
  const porNino = {};
  for (const r of invs) {
    if (r.status !== 'pending' || !r.child_name) continue;
    (porNino[r.child_name.trim().toUpperCase()] ||= []).push(r.email);
  }
  const dupes = Object.entries(porNino).filter(([, e]) => e.length > 1);
  if (dupes.length) {
    console.log('\n⚠️  Niños con MÁS DE UNA invitación pendiente:');
    for (const [nino, emails] of dupes) console.log(`   - ${nino} → ${emails.join(' | ')}`);
    console.log('   Al aceptar una, la otra queda huérfana. Conviene cancelar la sobrante.');
  }
} else {
  console.log('(sin registros)');
}

if (wantJson) {
  const out = new URL('./recent_emails.json', import.meta.url);
  writeFileSync(out, JSON.stringify({ sends, invitations: invs }, null, 2));
  console.log('\n📄 Detalle completo → bff/recent_emails.json');
}
