// Extrae las rutas del menú por rol desde frontend/src/config/navigation.ts
// llamando a la función REAL getNavigationByRole (bundle con esbuild, iconos
// stubeados). Así, cuando el menú cambie, la auditoría cambia sola.
//
//   node scripts/qa-responsive/extract-routes.mjs        → imprime JSON
//   import { extractRoutes } from './extract-routes.mjs'
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../..');
const FRONT = path.join(REPO, 'frontend');
const require = createRequire(path.join(FRONT, 'package.json'));

// Exporta como stub cada icono que importe navigation.ts.
function lucideStub() {
  const names = new Set();
  const src = fs.readFileSync(path.join(FRONT, 'src/config/navigation.ts'), 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g))
    m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((n) => names.add(n));
  return [...names].map((n) => `export const ${n} = () => null;`).join('\n');
}

export async function extractRoutes(roles) {
  const esbuild = require('esbuild');
  const outfile = path.join(os.tmpdir(), `qa-resp-nav-${process.pid}.mjs`);
  await esbuild.build({
    stdin: {
      contents: `export { getNavigationByRole } from '@/config/navigation';`,
      resolveDir: FRONT, loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env': '{}' },
    plugins: [{
      name: 'alias-and-stubs',
      setup(b) {
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'lucide', namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: lucideStub(),
          loader: 'js',
        }));
        b.onResolve({ filter: /^@\// }, (a) => {
          const base = path.join(FRONT, 'src', a.path.slice(2));
          for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
          }
          return { path: base + '.ts' };
        });
      },
    }],
  });
  const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  fs.rmSync(outfile, { force: true });
  const out = {};
  for (const role of roles) {
    // Todo addon/módulo visible (peor caso: auditar todo lo que puede verse);
    // tienda apagada como en el hook real (fail-closed, no desplegada).
    const groups = mod.getNavigationByRole(role, () => true, () => true, false);
    const items = [];
    const walk = (list, group) => list.forEach((it) => {
      if (it.href) items.push({ path: it.href, title: it.title, group });
      if (it.submenu) walk(it.submenu, group);
    });
    groups.forEach((g) => walk(g.items, g.title));
    const seen = new Set();
    out[role] = items.filter((i) => !seen.has(i.path) && seen.add(i.path));
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const roles = ['school', 'school_admin', 'coach', 'parent', 'athlete', 'reporter',
    'wellness_professional', 'store_owner', 'organizer', 'admin', 'super_admin', 'accountant', 'personal_trainer'];
  const r = await extractRoutes(roles);
  for (const [k, v] of Object.entries(r)) console.log(k, v.length);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
}
