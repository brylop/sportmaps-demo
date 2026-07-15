// ============================================================
// SportMaps — Listado de escuelas creadas (verificación)
//
// Uso:
//   cd bff && node list-schools.mjs              → tabla resumen de escuelas
//   node list-schools.mjs --json                 → además exporta schools_export.json
//   node list-schools.mjs --slug mma-blair-team  → detalle de una escuela + su contenido público
//
// Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de bff/.env (service_role
// bypassa RLS). NO imprime las claves.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const slugFilter = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

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

// 1. Escuelas (todas las columnas)
let q = sb.from('schools').select('*').order('created_at', { ascending: false });
if (slugFilter) q = q.eq('slug', slugFilter);
const { data: schools, error: sErr } = await q;
if (sErr) { console.error('Error leyendo schools:', sErr.message); process.exit(1); }

if (!schools.length) {
  console.log(slugFilter ? `No existe escuela con slug "${slugFilter}".` : 'No hay escuelas registradas.');
  process.exit(0);
}

// 2. Conteos de contenido relacionado por escuela (lo que consume la página pública)
const ids = schools.map((s) => s.id);
async function countBy(table, col = 'school_id') {
  const map = {};
  const { data } = await sb.from(table).select(`${col}`).in(col, ids);
  for (const r of data || []) map[r[col]] = (map[r[col]] || 0) + 1;
  return map;
}
const [teams, staff, facilities, offerings] = await Promise.all([
  countBy('teams'),
  countBy('school_staff'),
  countBy('facilities'),
  countBy('offerings').catch(() => ({})),
]);

// 3. Merge + señales de salud
const rows = schools.map((s) => ({
  ...s,
  n_teams: teams[s.id] || 0,
  n_staff: staff[s.id] || 0,
  n_facilities: facilities[s.id] || 0,
  n_offerings: offerings[s.id] || 0,
}));

console.log('=== Total:', rows.length, 'escuela(s) ===\n');

// 4. Tabla resumen (campos clave para verificar)
console.table(
  rows.map((r) => ({
    name: r.name,
    slug: r.slug || '⚠ SIN SLUG',
    ciudad: r.city || '',
    email: r.email || '',
    equipos: r.n_teams,
    staff: r.n_staff,
    instal: r.n_facilities,
    ofertas: r.n_offerings,
    url_publica: r.slug ? `/s/${r.slug}` : '—',
    creada: (r.created_at || '').slice(0, 10),
  })),
);

// 5. Alertas: escuelas sin slug (rompen la URL pública) o slugs duplicados
const sinSlug = rows.filter((r) => !r.slug);
if (sinSlug.length) console.warn(`\n⚠ ${sinSlug.length} escuela(s) SIN slug → no tienen página pública /s/<slug>.`);
const slugCounts = {};
for (const r of rows) if (r.slug) slugCounts[r.slug] = (slugCounts[r.slug] || 0) + 1;
const dups = Object.entries(slugCounts).filter(([, n]) => n > 1);
if (dups.length) console.warn('⚠ Slugs DUPLICADOS:', dups.map(([s, n]) => `${s} (${n})`).join(', '));

// 6. Detalle completo cuando se filtra por slug
if (slugFilter && rows.length === 1) {
  const s = rows[0];
  console.log('\n=== Detalle de', s.slug, '===');
  console.log(JSON.stringify(
    { id: s.id, name: s.name, slug: s.slug, city: s.city, email: s.email, phone: s.phone,
      logo_url: s.logo_url, cover_image_url: s.cover_image_url,
      n_teams: s.n_teams, n_staff: s.n_staff, n_facilities: s.n_facilities, n_offerings: s.n_offerings },
    null, 2,
  ));
}

// 7. Export completo opcional
if (wantJson) {
  const out = new URL('./schools_export.json', import.meta.url);
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log('\n📄 Export completo (todas las columnas) → bff/schools_export.json');
}
