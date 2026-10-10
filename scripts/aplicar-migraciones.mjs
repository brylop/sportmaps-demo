#!/usr/bin/env node
// ============================================================================
// Aplica migraciones de supabase/migrations EN EL ORDEN DADO, una por una, y
// deja rastro en supabase_migrations.schema_migrations (versión = prefijo del
// archivo). Para cuando no hay psql ni `supabase db push` utilizable.
//
// SIMULA POR DEFECTO: solo lista lo que haría. Escribe con --aplicar.
//
// Uso (PowerShell):
//   $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<clave>@<host>:5432/postgres"
//   node scripts/aplicar-migraciones.mjs 20261009115335 20261010143743 ...            # simula
//   node scripts/aplicar-migraciones.mjs 20261009115335 20261010143743 ... --aplicar  # aplica
//
// Acepta versiones (prefijo) o nombres de archivo. Se detiene en la primera que
// falle; cada archivo trae su BEGIN…COMMIT, así que esa no queda a medias.
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(raiz, 'bff', 'package.json'));
const { Client } = require('pg');

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const pedidos = args.filter((a) => !a.startsWith('--'));
const dir = join(raiz, 'supabase', 'migrations');
const archivos = readdirSync(dir).filter((f) => f.endsWith('.sql'));

if (pedidos.length === 0) {
  console.error('Indica las versiones a aplicar, en orden.');
  process.exit(1);
}

const plan = pedidos.map((p) => {
  const f = archivos.find((a) => a === p || a.startsWith(`${p}_`));
  if (!f) { console.error(`No existe la migración ${p}`); process.exit(1); }
  return { archivo: f, version: f.split('_')[0], nombre: f.replace(/^\d+_/, '').replace(/\.sql$/, '') };
});

console.log(aplicar ? 'APLICANDO:' : 'SIMULACIÓN (agrega --aplicar para escribir):');
plan.forEach((m, i) => console.log(`  ${i + 1}. ${m.archivo}`));
if (!aplicar) process.exit(0);

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error('Falta SUPABASE_DB_URL.'); process.exit(1); }

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  for (const m of plan) {
    const ya = await db.query('select 1 from supabase_migrations.schema_migrations where version = $1', [m.version]);
    if (ya.rowCount > 0) { console.log(`= ${m.archivo}: ya registrada, se salta`); continue; }
    process.stdout.write(`> ${m.archivo} … `);
    const sql = readFileSync(join(dir, m.archivo), 'utf8');
    try {
      await db.query(sql);
    } catch (e) {
      console.log('FALLÓ');
      console.error(`  ${e.code ?? ''} ${e.message}`);
      if (e.detail) console.error(`  detalle: ${e.detail}`);
      try { await db.query('ROLLBACK'); } catch { /* sin transacción abierta */ }
      process.exitCode = 1;
      break;
    }
    await db.query(
      'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing',
      [m.version, m.nombre, [sql]],
    );
    console.log('ok');
  }
} finally {
  await db.end();
}
