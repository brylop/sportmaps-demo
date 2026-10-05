// scripts/qa-twin/dump-schema.mjs — `npm run qa:dump-schema`
//
// Vuelca SOLO ESQUEMA de la base viva al directorio ignorado
// supabase/qa-twin/dump/, para cargarlo en el gemelo local
// (`npm run qa:twin:up`). Ver docs/qa-gemelo-local.md.
//
// Que se vuelca:
//   00_extensions.sql   extensiones que en la viva viven en el esquema `extensions`
//   01_public.sql       `supabase db dump -s public` (tablas, vistas, funciones,
//                       triggers, policies, grants). Incluye los ~336 objetos
//                       que no estan en supabase/migrations/.
//   02_auth_storage.sql triggers propios sobre auth.* (on_auth_user_created),
//                       buckets de storage (solo su configuracion) y TODAS las
//                       policies de storage.*
//   03_catalogos.sql    filas de catalogos SIN datos personales (lista blanca
//                       CATALOGOS de abajo). Nada de profiles/children/payments.
//   manifest.json       fecha, version de la viva, conteos.
//
// Seguridad:
//   - La conexion de lectura a la viva es READ ONLY (default_transaction_read_only);
//     cualquier escritura fallaria con 25006.
//   - Credenciales: SUPABASE_DB_URL del shell, o el rol temporal que la CLI ya
//     logueada obtiene (cli_login_postgres). Nunca se imprimen ni se guardan.
//   - Se verifica que el volcado de esquema no traiga INSERT/COPY de datos.

import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { DUMP_DIR, RAIZ, run, liveReadOnlyClient, dockerOk } from './lib.mjs';

// Tablas de catalogo que se copian con datos. Todo lo demas: solo esquema.
// `where` acota a filas globales (sin escuela/dueno). Antes de agregar una:
// NINGUNA tabla con personas, escuelas, pagos, documentos o credenciales.
const CATALOGOS = [
    { t: 'roles' },
    { t: 'sports_categories' },
    { t: 'sport_category_templates' },
    { t: 'sport_metric_definitions' },
    { t: 'sport_metric_thresholds' },
    { t: 'product_categories' },
    { t: 'product_brands' },
    { t: 'product_brand_categories' },
    { t: 'shipping_zones' },
    { t: 'marketplace_shipping_zones' },
    { t: 'template_variables' },
    { t: 'exercise_analyzers' },
    { t: 'exercise_analyzer_mappings' },
    { t: 'payroll_config' },
    { t: 'expense_categories', where: 'school_id is null and owner_id is null' },
    // platform_payment_accounts lleva las cuentas bancarias de SportMaps: fuera.
    { t: 'platform_config', where: "key <> 'platform_payment_accounts'" },
];

// Extensiones que el esquema necesita y que en la viva viven fuera de public.
const EXT_EN_EXTENSIONS = ['pgcrypto', 'uuid-ossp', 'pg_trgm', 'unaccent', 'btree_gist', 'pg_stat_statements'];

const t0 = Date.now();
mkdirSync(DUMP_DIR, { recursive: true });
const rel = (p) => relative(RAIZ, p).replaceAll('\\', '/');
const limpiar = (s) => s.split('\n').filter((l) => !/PGPASSWORD|postgres(ql)?:\/\//i.test(l)).slice(-15).join('\n');

if (!dockerOk()) {
    console.error('Docker no responde. `supabase db dump` corre pg_dump dentro de un contenedor: abrir Docker Desktop y reintentar.');
    process.exit(1);
}

// ── 01 public ───────────────────────────────────────────────────────────────
const publicFile = resolve(DUMP_DIR, '01_public.sql');
console.log('1/4 Volcando esquema public de la viva (supabase db dump, solo esquema)…');
const args = ['db', 'dump', '-s', 'public', '-f', rel(publicFile)];
if (process.env.SUPABASE_DB_URL) args.push('--db-url', process.env.SUPABASE_DB_URL);
else args.push('--linked');
const d = run('supabase', args);
if (d.code !== 0 || !existsSync(publicFile)) {
    console.error('Fallo supabase db dump:\n' + limpiar(d.stderr));
    process.exit(1);
}
const publicSql = readFileSync(publicFile, 'utf8');
const datos = publicSql.match(/^(INSERT INTO|COPY) /gm);
if (datos) {
    writeFileSync(publicFile, '-- descartado: traia datos\n');
    console.error(`ABORTADO: el volcado de esquema traia ${datos.length} sentencias de datos. Se descarto.`);
    process.exit(1);
}

// ── 00, 02, 03 desde el catalogo (solo lectura) ────────────────────────────
console.log('2/4 Leyendo extensiones, triggers de auth, buckets y policies de storage…');
const c = await liveReadOnlyClient();
await c.query("SET search_path = ''"); // los deparse salen calificados (public.fn())
const version = (await c.query('show server_version')).rows[0].server_version;

const exts = (await c.query(
    `select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      where e.extname = any($1) order by 1`, [EXT_EN_EXTENSIONS])).rows;
writeFileSync(resolve(DUMP_DIR, '00_extensions.sql'), [
    '-- Generado por scripts/qa-twin/dump-schema.mjs. No editar a mano.',
    'CREATE SCHEMA IF NOT EXISTS extensions;',
    ...exts.map((e) => `CREATE EXTENSION IF NOT EXISTS "${e.extname}" WITH SCHEMA "${e.nspname}";`),
    '',
].join('\n'));

const qi = (s) => `"${String(s).replaceAll('"', '""')}"`;
const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const out = ['-- Generado por scripts/qa-twin/dump-schema.mjs. No editar a mano.', ''];

const trg = (await c.query(
    `select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) def
       from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and not t.tgisinternal order by 1,2,3`)).rows;
out.push('-- Triggers propios sobre auth.*');
for (const r of trg) {
    out.push(`DROP TRIGGER IF EXISTS ${qi(r.tgname)} ON ${qi(r.nspname)}.${qi(r.relname)};`);
    out.push(r.def + ';');
}

const buckets = (await c.query(
    'select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id')).rows;
out.push('', '-- Buckets (solo configuracion; ningun objeto)');
for (const b of buckets) {
    const mimes = b.allowed_mime_types ? `ARRAY[${b.allowed_mime_types.map(lit).join(',')}]::text[]` : 'NULL';
    out.push(`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (${lit(b.id)}, ${lit(b.name)}, ${b.public}, ${b.file_size_limit ?? 'NULL'}, ${mimes})
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;`);
}

const pols = (await c.query(
    `select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
       from pg_policies where schemaname = 'storage' order by tablename, policyname`)).rows;
out.push('', '-- Policies de storage.* (todas las de la viva)');
for (const p of pols) {
    const roles = (Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(','))
        .map((r) => (r === 'public' ? 'public' : qi(r))).join(', ');
    out.push(`DROP POLICY IF EXISTS ${qi(p.policyname)} ON ${qi(p.schemaname)}.${qi(p.tablename)};`);
    out.push(`CREATE POLICY ${qi(p.policyname)} ON ${qi(p.schemaname)}.${qi(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}` +
        (p.qual ? `\n  USING (${p.qual})` : '') + (p.with_check ? `\n  WITH CHECK (${p.with_check})` : '') + ';');
}
writeFileSync(resolve(DUMP_DIR, '02_auth_storage.sql'), out.join('\n') + '\n');

console.log('3/4 Copiando catalogos (lista blanca, sin datos personales)…');
const cat = [
    '-- Generado por scripts/qa-twin/dump-schema.mjs. Solo catalogos de la lista blanca.',
    'SET session_replication_role = replica; -- sin triggers ni FKs mientras se carga',
    '',
];
const conteos = {};
for (const { t, where } of CATALOGOS) {
    const exists = (await c.query('select to_regclass($1) r', [`public.${t}`])).rows[0].r;
    if (!exists) { conteos[t] = 'no existe'; continue; }
    const r = (await c.query(
        `select coalesce(json_agg(x), '[]'::json) j, count(*) n from public.${qi(t)} x ${where ? 'where ' + where : ''}`)).rows[0];
    conteos[t] = Number(r.n);
    if (!conteos[t]) continue;
    const json = JSON.stringify(r.j);
    if (json.includes('$qa$')) throw new Error(`El catalogo ${t} contiene el delimitador $qa$`);
    cat.push(`INSERT INTO public.${qi(t)} SELECT * FROM json_populate_recordset(NULL::public.${qi(t)}, $qa$${json}$qa$) ON CONFLICT DO NOTHING;`);
}
cat.push('', 'SET session_replication_role = origin;', '');
writeFileSync(resolve(DUMP_DIR, '03_catalogos.sql'), cat.join('\n'));
await c.end();

console.log('4/4 Manifest…');
const cuenta = (re) => (publicSql.match(re) ?? []).length;
const manifest = {
    generado: new Date().toISOString(),
    origen: 'base viva, solo lectura',
    postgres_viva: version,
    archivos: Object.fromEntries(['00_extensions.sql', '01_public.sql', '02_auth_storage.sql', '03_catalogos.sql']
        .map((f) => [f, statSync(resolve(DUMP_DIR, f)).size])),
    objetos_public: {
        tablas: cuenta(/^CREATE TABLE /gm),
        vistas: cuenta(/^CREATE (OR REPLACE VIEW|MATERIALIZED VIEW) /gm),
        funciones: cuenta(/^CREATE OR REPLACE FUNCTION /gm),
        policies: cuenta(/^CREATE POLICY /gm),
        triggers: cuenta(/^CREATE OR REPLACE TRIGGER /gm),
    },
    auth_triggers: trg.map((r) => `${r.nspname}.${r.relname}:${r.tgname}`),
    buckets: buckets.map((b) => b.id),
    storage_policies: pols.length,
    catalogos: conteos,
};
writeFileSync(resolve(DUMP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest.objetos_public), `storage_policies=${pols.length}`, `buckets=${buckets.length}`);
console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${rel(DUMP_DIR)}/`);
