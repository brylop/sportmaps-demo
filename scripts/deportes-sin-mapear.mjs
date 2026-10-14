// scripts/deportes-sin-mapear.mjs
//
// Reporte de los textos de deporte de la base que el catálogo único
// (frontend/src/lib/sports/sportCatalog.ts, M1 de
// docs/specs/pizarra-multideporte-3d-ia.md) NO reconoce, o reconoce solo por
// aproximación ("Fútbol formativo" → Fútbol). Sirve para mapearlos en el
// catálogo en vez de adivinar.
//
// SOLO LECTURA: una sola sentencia SELECT por la CLI de Supabase
// (`supabase db query --linked`, desde la raíz enlazada: supabase/.temp).
// No escribe nada en la base (que es UNA SOLA, compartida con producción).
//
// Uso:
//   npm run deportes:sin-mapear
//   npm run deportes:sin-mapear -- --todos     # también lista los exactos
//
// Sale con código 0 siempre: es un reporte, no un gate (los textos de
// school_staff.sports a veces son cargos, no deportes).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSport } from '../frontend/src/lib/sports/sportCatalog.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODOS = process.argv.includes('--todos');

const SQL = `
select 'teams.sport' as fuente, sport as texto, count(*)::int as filas
  from public.teams where coalesce(trim(sport), '') <> '' group by sport
union all
select 'schools.sports', s, count(*)::int from public.schools, unnest(sports) s group by s
union all
select 'school_staff.sports', s, count(*)::int from public.school_staff, unnest(sports) s group by s
order by 1, 3 desc, 2`;

// Por archivo (-f): en Windows el shell se come los < > de la consulta.
const dir = mkdtempSync(join(tmpdir(), 'deportes-'));
const archivo = join(dir, 'deportes.sql');
writeFileSync(archivo, SQL);
let salida;
try {
  salida = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', archivo, '-o', 'json'], {
    cwd: RAIZ, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  console.error('No se pudo consultar la base (¿supabase/.temp enlazado?):', err.stderr?.toString() || err.message);
  process.exit(2);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const inicio = salida.indexOf('{');
const json = JSON.parse(salida.slice(inicio));
const filas = Array.isArray(json) ? json : json.rows ?? [];

const grupos = { ninguno: [], aproximado: [], exacto: [] };
for (const f of filas) {
  const r = resolveSport(f.texto);
  grupos[r.match].push({ ...f, r });
}

const linea = (f) => {
  const destino = f.r.match === 'ninguno' ? '—' : `${f.r.label} (${f.r.key}, pizarra ${f.r.boardLevel})`;
  return `  ${String(f.filas).padStart(4)}  ${f.fuente.padEnd(20)} ${JSON.stringify(f.texto).padEnd(48)} ${destino}`;
};

console.log(`Textos de deporte en la base: ${filas.length} distintos.`);
console.log(`\nSIN MAPEAR (${grupos.ninguno.length}) — agregar al catálogo o confirmar que no son deportes:`);
for (const f of grupos.ninguno) console.log(linea(f));
console.log(`\nAPROXIMADOS (${grupos.aproximado.length}) — se reconocen por contener un deporte; revisar:`);
for (const f of grupos.aproximado) console.log(linea(f));
if (TODOS) {
  console.log(`\nEXACTOS (${grupos.exacto.length}):`);
  for (const f of grupos.exacto) console.log(linea(f));
} else {
  console.log(`\nEXACTOS: ${grupos.exacto.length} (con --todos se listan).`);
}
const equiposSinMapear = grupos.ninguno.filter((f) => f.fuente === 'teams.sport');
console.log(`\nEquipos (teams.sport) sin mapear: ${equiposSinMapear.reduce((n, f) => n + f.filas, 0)}.`);
