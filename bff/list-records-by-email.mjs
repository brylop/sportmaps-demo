// ============================================================
// SportMaps — Registros creados/asociados a un correo
//
// Uso:
//   cd bff && node list-records-by-email.mjs clubsamguk@gmail.com
//   node list-records-by-email.mjs clubsamguk@gmail.com --json
//
// Busca el profile por email y luego, para un catálogo de tablas y
// columnas candidatas (created_by, user_id, owner_id, coach_id, ...),
// cuenta y muestra las filas donde ese usuario aparece.
//
// Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de bff/.env (service_role
// bypassa RLS). Apunta a STAGING según el .env local. NO imprime claves.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const email = args.find((a) => a.includes('@'));
if (!email) {
  console.error('Falta el email. Uso: node list-records-by-email.mjs correo@dominio.com [--json]');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
  process.exit(1);
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log('Proyecto:', env.SUPABASE_URL.replace('https://', '').split('.')[0]);
console.log('Email objetivo:', email, '\n');

// 1. Resolver el usuario (auth + profile) por email
let authUser = null;
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error('auth.admin.listUsers:', error.message); break; }
  authUser = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (authUser || data.users.length < 200) break;
}

const { data: profByEmail } = await sb.from('profiles').select('*').ilike('email', email).maybeSingle();
const profile = profByEmail || (authUser ? (await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle()).data : null);

if (!authUser && !profile) {
  console.error('❌ No se encontró ningún usuario/perfil con ese correo en este proyecto.');
  process.exit(1);
}

const uid = profile?.id || authUser?.id;
console.log('=== Usuario ===');
console.log({
  id: uid,
  email: authUser?.email || profile?.email,
  full_name: profile?.full_name,
  role: profile?.role,
  created_at: (profile?.created_at || authUser?.created_at || '').slice(0, 19),
  last_sign_in: authUser?.last_sign_in_at || null,
  providers: (authUser?.app_metadata?.providers || [authUser?.app_metadata?.provider]).filter(Boolean).join(','),
});
console.log('');

// 2. Catálogo de (tabla → columnas candidatas que apuntan a un usuario)
//    Sólo se prueban las que existan; errores de columna/tabla se ignoran.
const USER_COLUMNS = [
  'created_by', 'user_id', 'owner_id', 'profile_id', 'creator_id', 'created_by_id',
  'coach_id', 'parent_id', 'athlete_id', 'uploaded_by', 'requested_by', 'assigned_to',
  'seller_id', 'buyer_id', 'vendor_profile_id', 'author_id', 'sender_id', 'reviewer_id',
  'approved_by', 'verified_by', 'recorded_by', 'member_id',
];

const TABLES = [
  'profiles', 'schools', 'school_members', 'events', 'enrollments', 'teams', 'offerings',
  'offering_plans', 'payments', 'recurring_subscriptions', 'expenses', 'cash_ledger',
  'attendance', 'equipment', 'equipment_assignments', 'equipment_custody', 'invoices',
  'marketplace_transactions', 'products', 'orders', 'reviews', 'polls', 'notifications',
  'performance_entries', 'competition_results', 'athlete_id_cards', 'monthly_closes',
  'school_join_qr_codes', 'tournament_matches', 'children', 'audit_logs',
];

const findings = [];
for (const table of TABLES) {
  for (const col of USER_COLUMNS) {
    const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq(col, uid);
    if (error) continue; // tabla/columna inexistente o no aplica
    if ((count || 0) > 0) findings.push({ table, col, count });
  }
}

console.log('=== Registros donde aparece este usuario ===');
if (findings.length === 0) {
  console.log('(sin coincidencias en el catálogo de tablas conocido)');
} else {
  console.table(findings);
}

// 3. Muestra de filas por cada coincidencia (máx 5)
const samples = {};
for (const f of findings) {
  const { data } = await sb.from(f.table).select('*').eq(f.col, uid).order('created_at', { ascending: false }).limit(5);
  samples[`${f.table}.${f.col}`] = data;
}

if (wantJson) {
  const out = new URL('./records_by_email.json', import.meta.url);
  writeFileSync(out, JSON.stringify({ user: { id: uid, email }, findings, samples }, null, 2));
  console.log('\n📄 Detalle completo → bff/records_by_email.json');
} else if (findings.length) {
  console.log('\nPasa --json para volcar hasta 5 filas de ejemplo por tabla a bff/records_by_email.json');
}