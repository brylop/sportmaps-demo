// ============================================================================
// Lectura por REST con la service key de bff/.env (READ-ONLY por convención).
//
// Extraído de los scripts de auditoría, que repetían el mismo par de bloques:
// leer el .env a mano y paginar PostgREST (corta en 1000 filas y se come el
// resto en silencio — el bug clásico de estos barridos).
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function conectar(envPath = resolve(here, '../../bff/.env')) {
  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
  );
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
  }
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const proyecto = url.replace('https://', '').split('.')[0];

  // PostgREST corta en 1000 filas: paginamos siempre.
  const all = async (path, select, { order = 'id' } = {}) => {
    const out = [];
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const u = `${url}/rest/v1/${path}?select=${select}&limit=${PAGE}&offset=${off}&order=${order}`;
      const r = await fetch(u, { headers: H });
      const t = await r.text();
      if (!r.ok) { console.error(`ERROR ${path}: ${t.slice(0, 200)}`); process.exit(1); }
      const j = JSON.parse(t);
      out.push(...j);
      if (j.length < PAGE) break;
    }
    return out;
  };

  return { url, key, H, proyecto, all };
}
