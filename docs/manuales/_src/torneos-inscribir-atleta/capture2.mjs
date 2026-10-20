// Capturas complementarias (NO crea datos): formulario de creación y pestaña Info.
import path from 'node:path';
import { chromium, newSession, here, BASE_URL, rest, SCHOOL_ID } from './lib.mjs';
const SHOTS = path.join(here, 'shots');
const settle = (p, ms = 900) => p.waitForTimeout(ms);
const card = (p, texto) => p.getByText(texto, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
const browser = await chromium.launch();
try {
  const { page } = await newSession(browser, { viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE_URL}/school/tournaments/new`);
  await page.getByRole('heading', { name: 'Crear Torneo' }).waitFor({ timeout: 40_000 });
  await settle(page, 1500);
  await card(page, 'Tipo de torneo').screenshot({ path: path.join(SHOTS, 'c-01-tipo.png') });
  await page.locator('select').first().selectOption('internal');
  await settle(page);
  await card(page, 'Tipo de torneo').screenshot({ path: path.join(SHOTS, 'c-02-tipo-interno.png') });
  await card(page, 'Cobro de la inscripción').screenshot({ path: path.join(SHOTS, 'c-03-cobro-con-costo-vacio.png') });
  await page.locator('#price').fill('50000');
  await page.getByText('Efectivo en la escuela').click();
  await settle(page, 500);
  await card(page, 'Cobro de la inscripción').screenshot({ path: path.join(SHOTS, 'c-04-cobro-con-costo.png') });
  await page.locator('#is_paid').click();
  await settle(page, 500);
  await card(page, 'Cobro de la inscripción').screenshot({ path: path.join(SHOTS, 'c-05-cobro-gratis.png') });

  // Info de un torneo con costo ya creado (solo lectura)
  const ev = (await rest(`events?select=id,title&school_id=eq.${SCHOOL_ID}&title=like.Copa%20Con%20Costo*&order=created_at.desc&limit=1`))[0];
  await page.goto(`${BASE_URL}/school/tournaments/${ev.id}`);
  await page.getByRole('heading', { name: ev.title }).waitFor({ timeout: 40_000 });
  await settle(page, 1200);
  await page.getByRole('tab', { name: 'Info' }).click();
  await settle(page, 800);
  await page.getByText('El torneo tiene costo').first().locator('xpath=ancestor::div[contains(@class,"space-y-4")][1]').screenshot({ path: path.join(SHOTS, 'c-06-info-cobro.png') });
  await page.getByRole('tab', { name: /Categorías/ }).click();
  await settle(page, 800);
  await page.screenshot({ path: path.join(SHOTS, 'c-07-categorias-fases.png') });
  console.log('ok');
} catch (e) { console.log('ERROR', e.message); } finally { await browser.close(); }
