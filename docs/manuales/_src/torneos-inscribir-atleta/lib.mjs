// Utilidades compartidas de capture.mjs: login programático del owner de
// Club Campestre Demo sin contraseña (generate_link + verify), sin imprimir secretos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
export const { chromium } = require('playwright');

export function readEnv(rel) {
  const env = {};
  const fp = path.join(repo, rel);
  if (!fs.existsSync(fp)) return env;
  for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}
const BFF = readEnv('bff/.env');
const FE = { ...readEnv('frontend/.env'), ...readEnv('frontend/.env.local') };
export const SUPABASE_URL = BFF.SUPABASE_URL;
const SERVICE = BFF.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || FE.VITE_SUPABASE_PUBLISHABLE_KEY || FE.VITE_SUPABASE_ANON_KEY;
export const SCHOOL_ID = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
export const OWNER = 'gerencia@demo.sportmaps.co';
export const BASE_URL = process.env.BASE_URL || 'https://dev.sportmaps.co';

// Lectura (solo SELECT) con la service key, para verificar qué quedó creado.
export async function rest(p) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  return r.json();
}

export async function sessionFor(email) {
  const g = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!g.ok) throw new Error('generate_link ' + g.status);
  const gj = await g.json();
  const token_hash = gj.hashed_token || gj.properties?.hashed_token;
  const v = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash }),
  });
  if (!v.ok) throw new Error('verify ' + v.status);
  return v.json();
}

export async function newSession(browser, { viewport = { width: 1600, height: 1000 } } = {}) {
  const session = await sessionFor(OWNER);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'es-CO' });
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { context, page };
}
