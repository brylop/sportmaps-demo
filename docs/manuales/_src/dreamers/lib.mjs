// Utilidades compartidas: SIEMPRE contra el gemelo local (nunca la viva).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
export const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
export const { chromium } = require('playwright');
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3101';
export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) throw new Error('Solo gemelo local');
export const ACC = {
  parent: 'qa-dl-acudiente1@demo.sportmaps.co',
  owner: 'qa-dl-dueno@demo.sportmaps.co',
  coach: 'qa-dl-coach@demo.sportmaps.co',
};
export async function newSession(browser, email, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1600, height: 1000 }, deviceScaleFactor: opts.dpr || 2, locale: 'es-CO', isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: 'Demo2026!' }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status}`);
  const session = await res.json();
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-127-auth-token', JSON.stringify(session)]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 160)));
  return { context, page };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
