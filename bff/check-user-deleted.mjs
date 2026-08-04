// ============================================================
// SportMaps — Verificar que un usuario quedó borrado (read-only)
//
// Uso:
//   cd bff && node check-user-deleted.mjs 68d855cc-affa-483c-878a-e350f441c38d
//   cd bff && node check-user-deleted.mjs jennymipe@gmail.com
//   cd bff && node check-user-deleted.mjs <uuid> <email>   (ambos a la vez)
//
// NO borra nada. Revisa, en este orden:
//   1. auth.users (por UID y/o por email en el listado admin)
//   2. public.profiles (por id y por email)
//   3. Todas las columnas uuid de todas las tablas expuestas por PostgREST
//   4. Todas las columnas de email de todas las tablas (rastros que
//      re-vinculan la cuenta al re-registrarse: invitations, children, etc.)
//   5. storage.objects.owner
//
// Sale con código 0 si NO queda rastro, 1 si encuentra algo.
// Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de bff/.env. No imprime claves.
// ============================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2).filter(Boolean);
if (!args.length) {
  console.error('Uso: node check-user-deleted.mjs <uuid> [email]');
  process.exit(2);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = args.find((a) => UUID_RE.test(a)) || null;
const email = args.find((a) => a.includes('@')) || null;

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

console.log('Proyecto :', env.SUPABASE_URL.replace('https://', '').split('.')[0]);
console.log('UID      :', uid || '(no dado)');
console.log('Email    :', email || '(no dado)');
console.log('');

const rastros = [];
const ok = (msg) => console.log('  ✅', msg);
const bad = (msg) => { console.log('  ❌', msg); rastros.push(msg); };

// ---- 1. auth.users ----
console.log('1) auth.users');
if (uid) {
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) ok(`sin usuario con id ${uid}`);
  else bad(`SIGUE EXISTIENDO auth.users id=${uid} email=${data.user.email}`);
}
if (email) {
  let found = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.log('  ⚠️  listUsers:', error.message); break; }
    found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found || data.users.length < 200) break;
  }
  if (found) bad(`SIGUE EXISTIENDO auth.users email=${email} id=${found.id}`);
  else ok(`sin usuario con email ${email}`);
}

// ---- 2. public.profiles ----
console.log('\n2) public.profiles');
if (uid) {
  const { data } = await sb.from('profiles').select('id,email,full_name').eq('id', uid).maybeSingle();
  if (data) bad(`SIGUE EXISTIENDO profiles.id=${uid} (${data.email})`);
  else ok(`sin profile con id ${uid}`);
}
if (email) {
  const { data } = await sb.from('profiles').select('id,email').ilike('email', email);
  if (data?.length) bad(`SIGUE EXISTIENDO profiles.email=${email} (${data.length} fila/s)`);
  else ok(`sin profile con email ${email}`);
}

// ---- Catálogo real de tablas/columnas vía OpenAPI de PostgREST ----
const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/openapi+json',
  },
});
const spec = await res.json();
const defs = spec.definitions || spec.components?.schemas || {};
const uuidCols = [];
const emailCols = [];
for (const [table, def] of Object.entries(defs)) {
  for (const [col, meta] of Object.entries(def.properties || {})) {
    if (meta.format === 'uuid') uuidCols.push([table, col]);
    if (/e_?mail/i.test(col)) emailCols.push([table, col]);
  }
}

// ---- 3. Referencias por UID en toda la BD ----
console.log(`\n3) Referencias por UID (${uuidCols.length} pares tabla×columna uuid)`);
if (uid) {
  const hits = [];
  const CHUNK = 25;
  for (let i = 0; i < uuidCols.length; i += CHUNK) {
    await Promise.all(uuidCols.slice(i, i + CHUNK).map(async ([t, c]) => {
      const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true }).eq(c, uid);
      if (!error && (count || 0) > 0) hits.push({ tabla: t, columna: c, filas: count });
    }));
  }
  if (hits.length) { bad(`${hits.length} referencia(s) por UID`); console.table(hits.sort((a, b) => b.filas - a.filas)); }
  else ok('ninguna tabla referencia este UID');
} else ok('(sin UID, omitido)');

// ---- 4. Rastros por email (re-vinculan la cuenta al re-registrarse) ----
console.log(`\n4) Rastros por email (${emailCols.length} columnas tipo email)`);
if (email) {
  const hits = [];
  const CHUNK = 25;
  for (let i = 0; i < emailCols.length; i += CHUNK) {
    await Promise.all(emailCols.slice(i, i + CHUNK).map(async ([t, c]) => {
      const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true }).ilike(c, email);
      if (!error && (count || 0) > 0) hits.push({ tabla: t, columna: c, filas: count });
    }));
  }
  if (hits.length) {
    // schools.email suele ser correo de contacto de escuelas de OTROS dueños
    console.table(hits);
    bad(`${hits.length} rastro(s) por email — revisar antes de re-registrar`);
  } else ok('ninguna tabla guarda este email');
} else ok('(sin email, omitido)');

// ---- 5. storage.objects.owner ----
console.log('\n5) storage.objects.owner');
if (uid) {
  const { count, error } = await sb.schema('storage').from('objects').select('id', { count: 'exact', head: true }).eq('owner', uid);
  if (error) console.log('  ⚠️  el esquema storage no está expuesto en PostgREST — verificar en el SQL Editor:\n       select count(*) from storage.objects where owner = \'' + uid + '\';');
  else if (count) bad(`${count} objeto(s) en storage con owner=${uid}`);
  else ok('sin objetos en storage');
} else ok('(sin UID, omitido)');

// ---- Veredicto ----
console.log('\n' + '='.repeat(60));
if (rastros.length === 0) {
  console.log('✅ BORRADO LIMPIO — no queda rastro. El correo puede registrarse de nuevo.');
  process.exit(0);
} else {
  console.log(`❌ QUEDAN ${rastros.length} RASTRO(S):`);
  rastros.forEach((r) => console.log('   -', r));
  process.exit(1);
}
