// Capturas del modal «Inscribir atleta» ya desplegado: «Ya inscrito», adultos y aviso de efectivo.
// Contra dev.sportmaps.co, Club Campestre Demo. ESCRIBE: inscribe 1 atleta adulto en el torneo gratis.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, newSession, here, BASE_URL, rest } from './lib.mjs';
const SHOTS = path.join(here, 'shots');
const out = { checks: [] };
const check = (n, ok, x) => { out.checks.push({ n, ok: !!ok, x }); console.log(ok ? 'OK  ' : 'FAIL', n, x ?? ''); };
const settle = (p, ms = 1000) => p.waitForTimeout(ms);
const dialog = (p) => p.getByRole('dialog');
const evA = '72fd078d-ceb5-4ac7-bb09-5049b3ae21fd';   // gratis, Alejandro Peña ya inscrito
const evB = '91ba5147-5c88-4d84-8e5e-f922236c2cd4';   // con costo, solo efectivo
const browser = await chromium.launch();
try {
  const { page } = await newSession(browser, { viewport: { width: 1400, height: 1000 } });
  async function abrir(ev) {
    await page.goto(`${BASE_URL}/school/tournaments/${ev}`);
    await page.getByRole('tab', { name: 'Inscritos' }).waitFor({ timeout: 60_000 });
    await page.getByRole('tab', { name: 'Inscritos' }).click();
    await settle(page, 1800);
    await page.getByRole('button', { name: 'Inscribir atleta' }).click();
    await dialog(page).waitFor();
    await page.waitForFunction(() => !document.querySelector('[role=dialog] .animate-pulse'), null, { timeout: 20_000 }).catch(() => {});
    await settle(page, 1200);
  }
  // A · gratis
  await abrir(evA);
  const txtA = await dialog(page).innerText();
  check('despliegue nuevo: «Ya inscrito en esta categoría» en quien ya está', /Ya inscrito en esta categor/.test(txtA));
  check('despliegue nuevo: aparece la etiqueta «Adulto»', /Adulto/.test(txtA));
  await dialog(page).screenshot({ path: path.join(SHOTS, 'n-01-modal-ya-inscrito-adultos.png') });
  const ale = dialog(page).locator('div.flex.items-center.justify-between', { hasText: 'Alejandro Peña' }).first();
  check('el botón de quien ya está inscrito queda apagado', await ale.getByRole('button').isDisabled());

  // inscribir un adulto
  const adultoFila = dialog(page).locator('div.flex.items-center.justify-between', { has: page.getByText('Adulto', { exact: true }) }).first();
  const nombreAdulto = (await adultoFila.locator('p').first().innerText()).trim();
  await adultoFila.getByRole('button', { name: 'Inscribir' }).click();
  await page.getByText('Atleta inscrito').first().waitFor({ timeout: 25_000 }).catch(() => {});
  await settle(page, 600);
  const toastTxt = await page.locator('[role=status], li[data-state="open"]').allInnerTexts().catch(() => []);
  check('adulto inscrito: aviso «Se le avisó al atleta»', toastTxt.join(' ').includes('al atleta'), toastTxt.join(' | ').slice(0, 140));
  await page.screenshot({ path: path.join(SHOTS, 'n-02-adulto-inscrito.png') });
  const regs = await rest(`event_registrations?select=participant_name,participant_role,status,payment_status,child_id&event_id=eq.${evA}&participant_name=eq.${encodeURIComponent(nombreAdulto)}`);
  check('en la base: adulto aprobado, sin cobro, sin child_id', regs.length === 1 && regs[0].status === 'approved' && regs[0].payment_status === 'not_required' && regs[0].child_id === null, regs[0]);
  await settle(page, 3500);
  const adultoFila2 = dialog(page).locator('div.flex.items-center.justify-between', { hasText: nombreAdulto }).first();
  check('tras inscribirlo, el modal lo marca «Ya inscrito»', /Ya inscrito/.test(await adultoFila2.innerText()));
  await dialog(page).screenshot({ path: path.join(SHOTS, 'n-03-modal-tras-inscribir.png') });

  // B · con costo, solo efectivo
  await abrir(evB);
  const txtB = await dialog(page).innerText();
  check('torneo solo efectivo: el encabezado avisa que se registra en Pagos', /Solo se acepta efectivo/.test(txtB));
  await dialog(page).screenshot({ path: path.join(SHOTS, 'n-04-modal-solo-efectivo.png') });
  out.adulto = nombreAdulto;
} catch (e) { console.log('ERROR', e.message); out.error = e.message; try { const pg = browser.contexts()[0]?.pages()[0]; if (pg) await pg.screenshot({ path: path.join(SHOTS, 'n-error.png') }); } catch {} }
finally { await browser.close(); fs.writeFileSync(path.join(here, 'resultado3.json'), JSON.stringify(out, null, 2)); }
