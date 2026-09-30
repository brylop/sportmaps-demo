// Capturas REALES para el manual "WhatsApp del club — guía para familias" (todos los clubes)
// (docs/manuales/README.md, memoria feedback_pdf_manual_template: nunca mockups).
//
//   node docs/manuales/_src/whatsapp-familias/capture.mjs
//
// Las conversaciones de WhatsApp NO se capturan acá (no hay cómo automatizar la
// app de WhatsApp): build.mjs las dibuja con los textos EXACTOS que manda el bot,
// sacados de whatsapp_messages y del código del BFF. Acá solo van las dos
// pantallas de la app a las que el chat manda al papá:
//   01 — crear la cuenta desde el enlace que manda el bot (público, solo lectura)
//   02 — Mis Pagos del acudiente (papá demo de Club Campestre Demo, is_demo=true)
// Viewport de celular: el papá abre estos enlaces desde WhatsApp.
// No crea ni modifica datos.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const APP_URL = process.env.APP_URL || 'https://app.sportmaps.co';   // lo que abre el enlace del bot
const STG_URL = process.env.STG_URL || 'https://stg.sportmaps.co';   // tenant demo
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

function readEnv() {
  const env = {};
  const fp = path.join(repo, 'frontend', '.env');
  for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
  }
  return env;
}
const ENV = readEnv();
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_KEY = ENV.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_ANON_KEY;

async function loginAs(context, email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
}

const MOBILE = { viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, locale: 'es-CO', isMobile: true, hasTouch: true };

const browser = await chromium.launch();
try {
  // 01 — registro desde el enlace del bot (sin sesión)
  if (!fs.existsSync(path.join(SHOTS, '01-registro.png'))) {
    const ctx = await browser.newContext(MOBILE);
    const page = await ctx.newPage();
    await page.goto(`${APP_URL}/register?phone=${encodeURIComponent('+573001234567')}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, '01-registro.png'), fullPage: true });
    await ctx.close();
    console.log('01 ok');
  }

  // 02 — Mis Pagos del acudiente demo
  if (!fs.existsSync(path.join(SHOTS, '02-mis-pagos.png'))) {
    const ctx = await browser.newContext(MOBILE);
    await loginAs(ctx, 'mherrera@demo.sportmaps.co', 'Demo2026!');
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(`${STG_URL}/my-payments`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SHOTS, '02-mis-pagos.png'), fullPage: true });
    await ctx.close();
    console.log('02 ok');
  }
} finally {
  await browser.close();
}
