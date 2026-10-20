// Prueba en navegador: catálogo «Cobros sueltos» → «Crear en Torneos» (vínculo ítem ↔ torneo).
//   BASE_URL=http://127.0.0.1:5199 node docs/manuales/_src/torneos-inscribir-atleta/capture-vinculo.mjs
// Tenant Club Campestre Demo. CREA un torneo borrador y VINCULA un ítem (se deshace aparte).
import path from 'node:path';
import { chromium, newSession, here, rest, SCHOOL_ID } from './lib.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const SHOTS = path.join(here, 'shots');
const out = { checks: [] };
const check = (n, ok, x) => { out.checks.push({ n, ok: !!ok, x }); console.log(ok ? 'OK  ' : 'FAIL', n, x ?? ''); };
const settle = (p, ms = 1200) => p.waitForTimeout(ms);

const browser = await chromium.launch({ args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'] });
try {
  const { page } = await newSession(browser, { viewport: { width: 1400, height: 1100 } });
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|Failed to load resource/.test(m.text())) console.log('[console.error]', m.text().slice(0, 160)); });
  await page.goto(`${BASE}/payments-automation`);
  await page.getByRole('tab', { name: 'Config' }).waitFor({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Config' }).click();
  await settle(page, 2500);
  const tarjeta = page.getByText('Cobros sueltos', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg") or contains(@class,"rounded-xl")][1]');
  await tarjeta.scrollIntoViewIfNeeded();
  await settle(page, 1500);
  const fila = page.locator('div.flex.items-center.gap-2.rounded-lg.border.p-2', { hasText: 'Torneo E2E Test' }).first();
  const botones = await fila.getByRole('button').allInnerTexts();
  check('el ítem de torneo muestra «Crear en Torneos»', botones.some((b) => /Crear en Torneos/.test(b)), botones.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, 'v-01-catalogo.png') });

  await fila.getByRole('button', { name: /Crear en Torneos/ }).click();
  await page.getByRole('heading', { name: 'Crear Torneo' }).waitFor({ timeout: 30_000 });
  await settle(page, 2000);
  check('la URL trae from_item', /from_item=/.test(page.url()));
  const titulo = await page.locator('#title').inputValue();
  check('el formulario viene prellenado con el nombre del cobro', titulo === 'Torneo E2E Test', titulo);
  check('aparece el aviso «Creando desde el cobro»', await page.getByText(/Creando desde el cobro/).count() > 0);
  const alcance = await page.locator('select').first().inputValue();
  check('alcance interno', alcance === 'internal', alcance);
  await page.screenshot({ path: path.join(SHOTS, 'v-02-crear-desde-cobro.png') });

  // completar lo que el cobro no trae
  if (!(await page.locator('#sport').inputValue())) await page.locator('#sport').fill('Fútbol');
  if (!(await page.locator('#event_date').inputValue())) await page.locator('#event_date').fill('2026-11-28');
  await page.locator('#address').fill('Cancha principal del club');
  await page.locator('#city').fill('Bogotá');
  // medios de pago si hace falta (si el cobro tiene precio)
  const hayMedios = await page.getByText('Efectivo en la escuela').count();
  if (hayMedios && !(await page.getByRole('checkbox').first().isChecked().catch(() => false))) {
    await page.getByText('Efectivo en la escuela').click();
  }
  await page.getByRole('button', { name: 'Crear torneo' }).click();
  await page.waitForURL(/\/school\/tournaments\/[0-9a-f-]{36}$/, { timeout: 40_000 });
  await settle(page, 1500);
  const evId = page.url().split('/').pop();
  const item = (await rest(`school_tournament_items?select=id,name,event_id&school_id=eq.${SCHOOL_ID}&name=eq.${encodeURIComponent('Torneo E2E Test')}`))[0];
  check('tras crear, el ítem quedó vinculado al torneo nuevo', item?.event_id === evId, { evId, event_id: item?.event_id });
  const ev = (await rest(`events?select=id,title,tournament_scope,status&id=eq.${evId}`))[0];
  check('el torneo es interno y borrador', ev?.tournament_scope === 'internal' && ev?.status === 'draft', ev);
  await page.screenshot({ path: path.join(SHOTS, 'v-03-torneo-creado.png') });

  // el catálogo ahora lo muestra vinculado
  await page.goto(`${BASE}/payments-automation`);
  await page.getByRole('tab', { name: 'Config' }).click();
  await settle(page, 2500);
  const fila2 = page.locator('div.flex.items-center.gap-2.rounded-lg.border.p-2', { hasText: 'Torneo E2E Test' }).first();
  await fila2.scrollIntoViewIfNeeded();
  const t2 = await fila2.innerText();
  check('el catálogo muestra «Torneo vinculado» y «Ver torneo»', /Torneo vinculado/.test(t2) && /Ver torneo/.test(t2), t2.replace(/\s+/g, ' ').slice(0, 120));
  await page.screenshot({ path: path.join(SHOTS, 'v-04-catalogo-vinculado.png') });
  out.ids = { evId, itemId: item?.id };
} catch (e) {
  console.log('ERROR', e.message); out.error = e.message;
  try { const pg = browser.contexts()[0]?.pages()[0]; if (pg) await pg.screenshot({ path: path.join(SHOTS, 'v-error.png') }); } catch {}
} finally {
  await browser.close();
  console.log(JSON.stringify(out.ids ?? {}), out.error ?? '');
}
