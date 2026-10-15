import type { Page, Request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test, expect, mockWrite, openBoardFromMatch } from './helpers/pizarra';

/**
 * «Configuración de los equipos» — M6b de docs/specs/pizarra-m6-paridad-tacticalpad.md.
 *
 *   configurar el rival (nombre, colores, rayas) → la cancha cambia;
 *   «Guardar este rival» → POST (mockeado) con el payload correcto;
 *   exportar PNG → la imagen trae los colores configurados;
 *   celular: el diálogo apila las dos columnas.
 *
 * Nada se escribe: el BFF de dev todavía no tiene /tactical-rival-teams (va en
 * esta rama, migración 20261015142003 sin aplicar), así que su LECTURA se
 * responde como la respondería el BFF nuevo (lista vacía) y el POST va
 * mockeado. La red anti-escrituras de helpers/pizarra.ts hace fallar
 * cualquier otra escritura.
 */

const SHOTS = process.env.M6B_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6b';
mkdirSync(SHOTS, { recursive: true });

const RIVAL_PRIMARY = '#123456';
const RIVAL_SECONDARY = '#fde68a';
const HOME_PRIMARY = '#7c3aed';

const drawLayer = (page: Page) => page.locator('svg.z-40');

async function mockRivalTeamsRead(page: Page) {
  await page.route(/\/api\/v1\/school\/tactical-rival-teams(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [] });
  });
}

/** Pone a los jugadores y 3 rivales (uno junto al arco de arriba = su arquero). */
async function setupPitch(page: Page, mobile = false) {
  await page.getByRole('button', { name: /^Poner jugadores/ }).click();
  await page.getByRole('button', { name: /^Dibujar( \(\d+\))?$/ }).click();
  const tab = page.getByRole('tab', { name: 'Material' });
  if (await tab.isVisible().catch(() => false)) await tab.click();
  await page.getByRole('button', { name: 'Rival', exact: true }).click();
  const box = (await drawLayer(page).boundingBox())!;
  for (const [fx, fy] of [[0.5, 0.06], [0.3, 0.3], [0.7, 0.3]] as const) {
    const x = box.x + box.width * fx;
    const y = box.y + box.height * fy;
    if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  }
  await expect(page.getByText(/^3 figuras? · se guardan/)).toBeVisible();
  await page.getByRole('button', { name: /^Dibujar( \(\d+\))?$/ }).click();
}

/** Cuenta los píxeles de un color (±8 por canal) en un PNG, dentro del navegador. */
async function countColor(page: Page, png: Buffer, hex: string): Promise<number> {
  return page.evaluate(async ({ b64, hex: h }) => {
    const bin = atob(b64);
    const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - r) <= 8 && Math.abs(d[i + 1] - g) <= 8 && Math.abs(d[i + 2] - b) <= 8) n++;
    }
    return n;
  }, { b64: png.toString('base64'), hex });
}

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('configurar el rival → la cancha cambia; guardar rival → POST; PNG con los colores', async ({ page, guard }) => {
    test.setTimeout(240_000);
    await mockRivalTeamsRead(page);
    const posted: unknown[] = [];
    await mockWrite(page, guard, /\/api\/v1\/school\/tactical-rival-teams$/, (req: Request) => {
      const body = req.postDataJSON();
      posted.push(body);
      return { id: '00000000-0000-4000-8000-0000000e2eb1', school_id: 'x', ...body };
    }, 201);

    await openBoardFromMatch(page);
    await setupPitch(page);
    // Sin configuración: el rival es el disco rojo de siempre.
    await expect(drawLayer(page).locator('text', { hasText: /^R$/ })).toHaveCount(3);

    await page.getByTestId('tb-equipos').click();
    const dlg = page.getByTestId('teams-dialog');
    await expect(dlg.getByRole('heading', { name: 'Configuración de los equipos' })).toBeVisible();

    // Equipo propio: camiseta lisa morada.
    await page.getByTestId('team-home-color-primary').fill(HOME_PRIMARY);
    await page.getByTestId('team-home-style').getByRole('radio', { name: 'Camiseta lisa' }).click();
    // Rival: nombre, colores y rayas verticales; plantilla con un alias.
    await dlg.locator('#team-away-name').fill('Jaguar F.C.');
    await page.getByTestId('team-away-color-primary').fill(RIVAL_PRIMARY);
    await page.getByTestId('team-away-color-secondary').fill(RIVAL_SECONDARY);
    await page.getByTestId('team-away-style').getByRole('radio', { name: 'Rayas verticales' }).click();
    await dlg.getByRole('button', { name: /^Plantilla \(0\)/ }).click();
    await dlg.getByRole('button', { name: /^Agregar/ }).click();
    await dlg.getByRole('textbox', { name: 'Alias del rival 1' }).fill('Muro');
    // Vista previa en vivo.
    await expect(page.getByTestId('team-away-preview').locator('[data-chip="stripes_v"]')).toHaveCount(2);
    await expect(page.getByTestId('team-home-preview').locator('[data-chip="jersey"]')).toHaveCount(2);
    await dlg.screenshot({ path: `${SHOTS}/escritorio-01-dialogo.png` });

    // «Guardar este rival» → POST con el payload correcto.
    await dlg.getByRole('button', { name: 'Guardar este rival' }).click();
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0]).toEqual({
      name: 'Jaguar F.C.',
      short_name: 'RIV',
      color_primary: RIVAL_PRIMARY,
      color_secondary: RIVAL_SECONDARY,
      color_number: '#ffffff',
      crest: { kind: 'generated', shape: 'shield', design: 'plain', initials: 'RIV' },
      chip_style: 'stripes_v',
      roster: [{ number: 1, alias: 'Muro' }],
    });
    await expect(page.getByText('Rival guardado').first()).toBeVisible();

    await dlg.getByRole('button', { name: 'Listo' }).click();
    await expect(dlg).toBeHidden();

    // La cancha cambió: rivales con rayas y colores, propios con camiseta.
    const layer = drawLayer(page);
    await expect(layer.locator('[data-chip="stripes_v"]')).toHaveCount(3);
    await expect(layer.locator(`circle[fill="${RIVAL_PRIMARY}"]`).first()).toBeAttached();
    await expect(layer.locator('text', { hasText: /^R$/ })).toHaveCount(0);
    await expect(layer.locator('text', { hasText: 'Muro' })).toHaveCount(0); // debajo: nada por defecto en el rival
    await expect(page.locator('[data-team-pin="jersey"]').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/escritorio-02-cancha-equipos.png` });

    // Exportar PNG: la imagen trae los colores del rival y del propio.
    await page.getByRole('button', { name: 'Exportar la jugada' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('menuitem', { name: /Imagen/ }).click(),
    ]);
    const png = await readFile((await download.path())!);
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(await countColor(page, png, RIVAL_PRIMARY), 'píxeles del rival').toBeGreaterThan(80);
    expect(await countColor(page, png, RIVAL_SECONDARY), 'rayas del rival').toBeGreaterThan(40);
    expect(await countColor(page, png, HOME_PRIMARY), 'camisetas propias').toBeGreaterThan(80);
  });
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('iPhone: diálogo apilado y cancha con los dos equipos', async ({ page, guard }) => {
    test.setTimeout(240_000);
    void guard;
    await mockRivalTeamsRead(page);
    await openBoardFromMatch(page);
    await setupPitch(page, true);

    await page.getByTestId('tb-equipos').click();
    const dlg = page.getByTestId('teams-dialog');
    await expect(dlg).toBeVisible();
    // Apiladas: la columna del rival va DEBAJO de la propia.
    const home = (await page.getByTestId('team-home').boundingBox())!;
    const away = (await page.getByTestId('team-away').boundingBox())!;
    expect(away.y).toBeGreaterThan(home.y + home.height - 1);
    expect(away.width).toBeLessThanOrEqual(390);
    await page.getByTestId('team-home-style').getByRole('radio', { name: 'Silueta' }).click();
    await page.getByTestId('team-away-color-primary').fill('#f97316');
    await page.getByTestId('team-away-style').getByRole('radio', { name: 'Rayas horizontales' }).click();
    await page.screenshot({ path: `${SHOTS}/iphone-01-dialogo.png` });
    await page.getByTestId('team-away').screenshot({ path: `${SHOTS}/iphone-02-dialogo-rival.png` });
    await dlg.getByRole('button', { name: 'Listo' }).click();
    await expect(dlg).toBeHidden();
    await expect(drawLayer(page).locator('[data-chip="stripes_h"]')).toHaveCount(3);
    await expect(page.locator('[data-team-pin="silhouette"]').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/iphone-03-cancha-equipos.png` });
  });
});
