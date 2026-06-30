// ============================================================
// SportMaps — Listado de usuarios registrados (rol + info completa)
//
// Uso:
//   cd bff && node list-users.mjs            → tabla resumen + breakdown por rol
//   node list-users.mjs --json              → además exporta users_export.json
//   node list-users.mjs --role school       → filtra por un rol
//
// Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de bff/.env (service_role
// bypassa RLS). NO imprime las claves.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const roleFilter = args.includes('--role') ? args[args.indexOf('--role') + 1] : null;

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
console.log('Proyecto:', env.SUPABASE_URL.replace('https://', '').split('.')[0], '\n');

// 1. Catálogo de roles (id → name) para resolver role_id
const { data: roles } = await sb.from('roles').select('id, name');
const roleNameById = Object.fromEntries((roles || []).map((r) => [r.id, r.name]));

// 2. Perfiles (todas las columnas)
let q = sb.from('profiles').select('*').order('created_at', { ascending: false });
if (roleFilter) q = q.eq('role', roleFilter);
const { data: profiles, error: pErr } = await q;
if (pErr) { console.error('Error leyendo profiles:', pErr.message); process.exit(1); }

// 3. Datos de auth (email confirmado, último login, provider) — paginado
const authById = {};
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error('Error auth.admin.listUsers:', error.message); break; }
  for (const u of data.users) {
    authById[u.id] = {
      email_confirmed: !!u.email_confirmed_at,
      last_sign_in: u.last_sign_in_at,
      providers: (u.app_metadata?.providers || [u.app_metadata?.provider]).filter(Boolean).join(','),
    };
  }
  if (data.users.length < 200) break;
}

// 4. Merge
const rows = profiles.map((p) => ({
  ...p,
  catalog_role: roleNameById[p.role_id] || null,
  ...(authById[p.id] || {}),
}));

// 5. Breakdown por rol
const byRole = {};
for (const r of rows) byRole[r.role] = (byRole[r.role] || 0) + 1;
console.log('=== Total:', rows.length, 'usuarios ===');
console.log('Por rol:', byRole, '\n');

// 6. Tabla resumen (campos clave)
console.table(
  rows.map((r) => ({
    email: r.email,
    nombre: r.full_name,
    role: r.role,
    catalogo: r.catalog_role,
    needs_role_sel: r.needs_role_selection,
    onb_done: r.onboarding_completed,
    tel: r.phone || '',
    provider: r.providers || '',
    confirmado: r.email_confirmed,
    creado: (r.created_at || '').slice(0, 10),
  })),
);

// 7. Export completo opcional
if (wantJson) {
  const out = new URL('./users_export.json', import.meta.url);
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log('\n📄 Export completo (todas las columnas) → bff/users_export.json');
}
