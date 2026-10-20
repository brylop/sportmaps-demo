import type { Locator, Page } from '@playwright/test';
import { test, expect, openBoardFromMatch } from './helpers/pizarra';

/**
 * Pizarra táctica — «Ajustes de la pizarra» (M6g, docs/specs/pizarra-m6-paridad-tacticalpad.md §4).
 *
 * Curva lineal + ruta del jugador + trayectoria discontinua + posesión del
 * balón → reproducir: el rastro se dibuja y el balón va pegado a su dueño; en
 * el cambio de dueño se dibuja el pase. Tema claro, recargar y los ajustes
 * siguen (son del coach, en localStorage con su id). En iPhone: el diálogo y
 * la pantalla completa sin Fullscreen API (ventana fija).
 *
 * NO escribe nada en la base: los ajustes viven en el navegador y la jugada no
 * se guarda; la red de helpers/pizarra.ts aborta cualquier escritura.
 */

const SHOTS = process.env.PIZARRA_AJUSTES_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6g';

const pins = (page: Page) => page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ });
const pinOf = (removeBtn: Locator) => removeBtn.locator('..');
const frameItems = (page: Page) => page.getByRole('list', { name: 'Cuadros' }).getByRole('listitem');

async function dragPinTo(page: Page, removeBtn: Locator, fx: number, fy: number) {
    const pin = pinOf(removeBtn);
    const box = (await pin.boundingBox())!;
    const area = (await pin.locator('..').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2 + 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 6, y + 6, { steps: 3 });
    await page.mouse.move(area.x + area.width * fx, area.y + area.height * fy, { steps: 12 });
    await page.mouse.up();
}

async function addFrame(page: Page, expected: number) {
    await page.getByRole('button', { name: /^Cuadro$/ }).click();
    await expect(frameItems(page)).toHaveCount(expected);
    await page.getByRole('combobox', { name: 'Tiempo para llegar a este cuadro' }).selectOption('3000');
}

async function openSettings(page: Page) {
    // En el celular «Ajustes» vive en «Más» (el toolbar no da más).
    const direct = page.getByRole('button', { name: 'Ajustes de la pizarra' });
    if (await direct.isVisible().catch(() => false)) await direct.click();
    else {
        await page.getByRole('button', { name: 'Más opciones' }).click();
        await page.getByRole('menuitem', { name: 'Ajustes de la pizarra' }).click();
    }
    const dlg = page.getByRole('dialog', { name: 'Ajustes de la pizarra' });
    await expect(dlg).toBeVisible();
    return dlg;
}

async function setSwitch(dlg: Locator, name: string, on: boolean) {
    const sw = dlg.getByRole('switch', { name, exact: true });
    if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', String(on));
}

/** Último punto (en el viewBox 300×340) de un rastro de la capa de reproducción. */
async function lastPoint(page: Page, selector: string): Promise<{ x: number; y: number } | null> {
    return page.evaluate((sel) => {
        const lines = document.querySelectorAll<SVGLineElement>(`${sel} line`);
        const l = lines[lines.length - 1];
        return l ? { x: Number(l.getAttribute('x2')), y: Number(l.getAttribute('y2')) } : null;
    }, selector);
}

const settingsKeys = (page: Page) =>
    page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tactical_board_settings:')));

test.describe('escritorio', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('curva lineal, rutas, trayectoria discontinua y posesión → reproducir; tema claro; recargar', async ({ page }) => {
        test.setTimeout(300_000);
        await openBoardFromMatch(page);
        await page.evaluate(() => {
            for (const k of Object.keys(localStorage)) if (k.startsWith('tactical_board_settings:')) localStorage.removeItem(k);
        });

        // ── 1. Ajustes ──────────────────────────────────────────────────────
        let dlg = await openSettings(page);
        await dlg.getByRole('radio', { name: /Lineal/ }).click();
        await expect(dlg.getByRole('radio', { name: /Lineal/ })).toHaveAttribute('aria-checked', 'true');
        await setSwitch(dlg, 'Ruta del jugador · equipo local', true);
        await setSwitch(dlg, 'Trayectoria del balón', true);
        await setSwitch(dlg, 'Trayectoria del balón discontinua', true);
        await setSwitch(dlg, 'Definir la posesión del balón', true);
        await setSwitch(dlg, 'Nombre del jugador siempre visible', true);
        await page.screenshot({ path: `${SHOTS}/ajustes-01-dialogo-escritorio.png` });
        await page.keyboard.press('Escape');
        await expect(dlg).toBeHidden();

        // Guardado con el id del usuario (una sola clave, la de este coach).
        const keys = await settingsKeys(page);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatch(/^tactical_board_settings:[0-9a-f-]{36}$/);

        // ── 2. Jugadores + posesión del cuadro 1 ────────────────────────────
        await page.getByRole('button', { name: /^Poner jugadores/ }).click();
        await expect(pins(page).first()).toBeVisible();
        await expect(page.getByTestId('pin-name-tag').first()).toBeVisible();
        const owner = page.getByRole('combobox', { name: 'Quién tiene el balón en este cuadro' });
        await expect(owner).toBeVisible();
        const options = await owner.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
        expect(options.length).toBeGreaterThan(1);
        const [keyA, keyB] = options;
        await owner.selectOption(keyA);
        // Las opciones salen en el mismo orden que las fichas (Object.entries(placed)).
        const pinA = () => pins(page).nth(0);
        const pinB = () => pins(page).nth(1);

        // ── 3. Cuadro 2: A avanza con el balón ──────────────────────────────
        await addFrame(page, 2);
        await expect(owner).toHaveValue(keyA); // el cuadro nuevo hereda el dueño
        await dragPinTo(page, pinA(), 0.35, 0.3);
        // ── 4. Cuadro 3: pase a B, que se desmarca ──────────────────────────
        await addFrame(page, 3);
        await owner.selectOption(keyB);
        await dragPinTo(page, pinB(), 0.7, 0.25);
        await page.screenshot({ path: `${SHOTS}/ajustes-02-cuadros-con-posesion.png` });

        // ── 5. Reproducir y pausar en medio del cuadro 1→2 ──────────────────
        await page.getByRole('listitem', { name: 'Cuadro 1' }).click();
        const progress = page.getByRole('progressbar', { name: 'Avance de la jugada' });
        await page.getByRole('button', { name: 'Reproducir cuadros' }).click();
        await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), { timeout: 15_000 }).toBeGreaterThan(20);
        await page.getByRole('button', { name: 'Pausa' }).click();
        await expect(page.getByTestId('route-home').first()).toBeVisible();
        await expect(page.getByTestId('ball-trail-dashed')).toHaveCount(1);
        // El balón va pegado al dueño: el final de su trayectoria está a sus pies
        // (desfase fijo BALL_OFFSET = 3,2 % × 1,4 % → 9,6 × 4,76 en el viewBox).
        const ballEnd = await lastPoint(page, '[data-testid="ball-trail-dashed"]');
        const ownerEnd = await lastPoint(page, `[data-testid="route-home"][data-key="${keyA}"]`);
        await page.screenshot({ path: `${SHOTS}/ajustes-03-rastro-y-balon-con-el-jugador.png` });
        expect(ballEnd && ownerEnd, 'rastro del balón y del dueño').toBeTruthy();
        test.info().annotations.push({ type: 'balón vs dueño', description: JSON.stringify({ ballEnd, ownerEnd }) });
        expect(Math.abs(ballEnd!.x - ownerEnd!.x - 9.6)).toBeLessThan(0.6);
        expect(Math.abs(ballEnd!.y - ownerEnd!.y - 4.76)).toBeLessThan(0.6);

        // ── 6. Seguir hasta el pase (cuadro 2→3) ────────────────────────────
        await page.getByRole('button', { name: 'Reproducir cuadros' }).click();
        await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), { timeout: 15_000 }).toBeGreaterThan(70);
        await page.getByRole('button', { name: 'Pausa' }).click();
        await expect(page.getByTestId('pass-line')).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/ajustes-04-pase.png` });

        // ── 7. Tema claro ───────────────────────────────────────────────────
        dlg = await openSettings(page);
        await dlg.getByRole('radio', { name: /Claro/ }).click();
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-board-theme="claro"]')).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/ajustes-05-tema-claro.png` });

        // ── 8. Recargar: los ajustes siguen ─────────────────────────────────
        await page.reload();
        await openBoardFromMatch(page);
        await expect(page.locator('[data-board-theme="claro"]')).toHaveCount(1);
        dlg = await openSettings(page);
        await expect(dlg.getByRole('radio', { name: /Lineal/ })).toHaveAttribute('aria-checked', 'true');
        await expect(dlg.getByRole('switch', { name: 'Ruta del jugador · equipo local' })).toHaveAttribute('aria-checked', 'true');
        await expect(dlg.getByRole('switch', { name: 'Trayectoria del balón discontinua' })).toHaveAttribute('aria-checked', 'true');
        await expect(dlg.getByRole('switch', { name: 'Definir la posesión del balón' })).toHaveAttribute('aria-checked', 'true');
        await page.screenshot({ path: `${SHOTS}/ajustes-06-tras-recargar.png` });
        await page.keyboard.press('Escape');
        expect(await settingsKeys(page)).toEqual(keys);
    });
});

test.describe('iPhone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

    test('diálogo usable con el dedo, tema claro y pantalla completa sin Fullscreen API', async ({ page }) => {
        test.setTimeout(240_000);
        // Safari de iPhone no expone la Fullscreen API fuera de <video>.
        await page.addInitScript(() => {
            Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
        });
        await openBoardFromMatch(page);
        const dlg = await openSettings(page);
        // Filas de al menos 44 px de alto.
        for (const name of ['Ruta del jugador · equipo local', 'Definir la posesión del balón']) {
            const row = dlg.getByRole('switch', { name }).locator('..');
            expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await dlg.getByRole('radio', { name: /Rápida al inicio/ }).click();
        await setSwitch(dlg, 'Nombre del jugador siempre visible', true);
        await dlg.getByRole('radio', { name: /Claro/ }).click();
        await page.screenshot({ path: `${SHOTS}/ajustes-07-dialogo-iphone.png` });

        await dlg.getByRole('button', { name: /Pantalla completa/ }).click();
        await expect(dlg).toBeHidden();
        const board = page.locator('[data-board-theme="claro"]');
        await expect(board).toHaveCount(1);
        // Ventana fija: el diálogo se pega a la vista visible (100dvh) arriba a la izquierda.
        const box = (await board.boundingBox())!;
        expect(box.x).toBe(0);
        expect(box.y).toBe(0);
        expect(Math.round(box.height)).toBe(844);
        await page.getByRole('button', { name: /^Poner jugadores/ }).click();
        await expect(page.getByTestId('pin-name-tag').first()).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/ajustes-08-iphone-claro-pantalla-completa.png` });

        const dlg2 = await openSettings(page);
        await expect(dlg2.getByRole('button', { name: /Volver a ventana/ })).toBeVisible();
    });
});
