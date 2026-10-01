import { test, expect, devices, type Page, type Locator } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * Pizarra táctica — "Escribir": lápiz libre, texto y borrador (2026-09-30).
 * El coach pidió rayar y anotar sobre la cancha como en una tablet.
 *
 * No guarda nada: dibuja, escribe y borra en memoria y cierra sin guardar.
 * Usa el coach del fixture demo y el primer bloque de sesión con "Tablero
 * táctico" en /training-plans (solo aparece en equipos de fútbol).
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

test.use({ ...devices['Galaxy Tab S4'] });

async function openBoard(page: Page) {
    await loginAs(page, COACH);
    // Los equipos demo no tienen partidos: se inyecta uno ficticio en la
    // lectura de match_results para tener desde dónde abrir el tablero. Nada
    // se escribe (la prueba no guarda).
    await page.route(/\/rest\/v1\/match_results\?/, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        await route.fulfill({
            json: [{
                id: '00000000-0000-4000-8000-0000000e2e01', opponent: 'Rival QA', home_score: null, away_score: null,
                is_home: true, match_date: '2026-10-04', match_type: 'amistoso', notes: null,
            }],
        });
    });
    await page.goto('/training-plans');
    await page.getByRole('combobox').first().click({ timeout: 20_000 });
    await page.getByRole('option', { name: /THUNDER/i }).first().click();
    await page.getByRole('button', { name: 'Fútbol', exact: true }).click();
    const entry = page.getByRole('button', { name: /Tablero táctico/ }).first();
    await expect(entry).toBeVisible({ timeout: 15_000 });
    await entry.click();
    await page.getByRole('button', { name: /^Pizarra/ }).click();
    await expect(page.getByRole('button', { name: 'Lápiz' })).toBeVisible();
}

/** Pestaña de la hoja de celular (<768px) donde vive cada herramienta. En
 *  pantalla ancha no hay pestañas y la herramienta ya está a la vista. */
const TAB_OF: Record<string, string> = { Lápiz: 'Escribir', Texto: 'Escribir', Borrador: 'Escribir', Cono: 'Material' };
async function pick(page: Page, tool: string) {
    const tab = page.getByRole('tab', { name: TAB_OF[tool] });
    if (await tab.isVisible().catch(() => false)) await tab.click();
    await page.getByRole('button', { name: tool, exact: true }).click();
}

/** Capa de dibujo (el <svg> z-40 que intercepta el puntero en modo dibujo). */
const drawLayer = (page: Page) => page.locator('svg.z-40');

async function scribble(page: Page, layer: Locator, from: [number, number], to: [number, number]) {
    const box = (await layer.boundingBox())!;
    const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
    await page.mouse.move(...at(...from));
    await page.mouse.down();
    // Onda: que el trazo tenga forma, no una recta.
    for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const fx = from[0] + (to[0] - from[0]) * t;
        const fy = from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI * 3) * 0.04;
        await page.mouse.move(...at(fx, fy));
    }
    await page.mouse.up();
}

test('lápiz, texto y borrador sobre la cancha', async ({ page }) => {
    test.setTimeout(120_000);
    await openBoard(page);
    const layer = drawLayer(page);

    // 1. Lápiz: un trazo libre queda como path en la cancha.
    await pick(page, 'Lápiz');
    const figuras = page.getByText(/^\d+ figuras? · se guardan/);
    const countOf = async () => Number((await figuras.textContent())!.match(/^\d+/)![0]);
    const before = await countOf();
    await scribble(page, layer, [0.2, 0.3], [0.8, 0.35]);
    await expect.poll(countOf).toBe(before + 1);
    await page.screenshot({ path: 'e2e/screenshots/pizarra-escribir-01-lapiz.png' });

    // 2. Texto: tocar la cancha abre el campo; Enter deja la nota.
    await pick(page, 'Texto');
    const box = (await layer.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
    const input = page.getByRole('textbox', { name: 'Texto sobre la cancha' });
    await expect(input).toBeFocused();
    await input.fill('Presión alta');
    await input.press('Enter');
    await expect(layer.locator('text', { hasText: 'Presión alta' })).toBeVisible();
    await expect.poll(countOf).toBe(before + 2);
    await page.screenshot({ path: 'e2e/screenshots/pizarra-escribir-02-texto.png' });

    // 3. Editar: tocar el texto lo selecciona, otro toque lo abre para cambiarlo.
    const note = layer.locator('text', { hasText: 'Presión alta' });
    await note.click();
    await note.click();
    await expect(input).toBeFocused();
    await input.fill('Presión alta al 10');
    await input.press('Enter');
    await expect(layer.locator('text', { hasText: 'Presión alta al 10' })).toBeVisible();

    // 4. Borrador: pasar por encima del trazo lo quita; el texto sigue.
    await pick(page, 'Borrador');
    await scribble(page, layer, [0.5, 0.15], [0.5, 0.45]);
    await expect.poll(countOf).toBe(before + 1);
    await expect(layer.locator('text', { hasText: 'Presión alta al 10' })).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/pizarra-escribir-03-borrador.png' });
});

/** Arrastre con el DEDO de verdad: eventos táctiles por CDP (Chrome los
 *  convierte en pointer events con pointerType 'touch'), no mouse. */
async function fingerDrag(page: Page, layer: Locator, from: [number, number], to: [number, number]) {
    const box = (await layer.boundingBox())!;
    const pt = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(...from)] });
    for (let i = 1; i <= 20; i++) {
        const t = i / 20;
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [pt(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI * 2) * 0.03)],
        });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
}

test('con el dedo, encima del material: rayar, escribir y borrar', async ({ page }) => {
    test.setTimeout(120_000);
    await openBoard(page);
    const layer = drawLayer(page);
    const box = (await layer.boundingBox())!;
    const figuras = page.getByText(/^\d+ figuras? · se guardan/);
    const countOf = async () => Number((await figuras.textContent())!.match(/^\d+/)![0]);
    const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

    // Un cono en el centro (toque con el dedo).
    await pick(page, 'Cono');
    await page.touchscreen.tap(at(0.5, 0.4).x, at(0.5, 0.4).y);
    await expect.poll(countOf).toBe(1);

    // Lápiz: el trazo ARRANCA encima del cono y lo cruza. Si el cono capturara
    // el dedo, lo arrastraría en vez de dibujar (y seguiría habiendo 1 figura).
    await pick(page, 'Lápiz');
    await fingerDrag(page, layer, [0.5, 0.4], [0.85, 0.5]);
    await expect.poll(countOf).toBe(2);
    await expect(layer.locator('path[stroke-linejoin="round"]').first()).toBeVisible();

    // Texto: tocar justo encima del cono pone la nota ahí (no selecciona el cono).
    await pick(page, 'Texto');
    await page.touchscreen.tap(at(0.5, 0.4).x, at(0.5, 0.4).y);
    const input = page.getByRole('textbox', { name: 'Texto sobre la cancha' });
    await expect(input).toBeFocused();
    await input.fill('Salida por acá');
    await input.press('Enter');
    await expect(layer.locator('text', { hasText: 'Salida por acá' })).toBeVisible();
    await expect.poll(countOf).toBe(3);
    await page.screenshot({ path: 'e2e/screenshots/pizarra-dedo-01-encima-del-cono.png' });

    // Borrador con el dedo: una pasada por el centro se lleva cono, trazo y nota.
    await pick(page, 'Borrador');
    await fingerDrag(page, layer, [0.35, 0.4], [0.7, 0.42]);
    await expect.poll(countOf).toBe(0);
    await page.screenshot({ path: 'e2e/screenshots/pizarra-dedo-02-borrado.png' });
});

test.describe('en celular (iPhone 14)', () => {
    // Pantalla y toque del iPhone en Chromium (el WebKit de Playwright no está
    // instalado). env(safe-area-inset-*) da 0 acá: el notch se valida a mano.
    const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 14'];
    test.use(iphone);

    test('el toolbar se ve, la pizarra abre como hoja inferior y la cancha cabe encima', async ({ page }) => {
        test.setTimeout(120_000);
        await openBoard(page);
        const vp = page.viewportSize()!;

        // "Pizarra" quedó tocable dentro de la pantalla.
        const pizarraBtn = page.getByRole('button', { name: /^Pizarra/ });
        const b = (await pizarraBtn.boundingBox())!;
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width);

        // La hoja va DEBAJO de la cancha y la cancha entera queda visible encima.
        const tools = page.getByRole('button', { name: 'Lápiz' });
        await expect(tools).toBeInViewport();
        // El recuadro verde entero dentro de su área visible (que corta con
        // overflow-hidden): antes la cancha se salía y quedaba sin arcos.
        const pitchEl = drawLayer(page).locator('..');
        const pitch = (await pitchEl.boundingBox())!;
        const area = (await pitchEl.locator('..').boundingBox())!;
        const toolbarBottom = b.y + b.height;
        const sheetTop = (await page.getByRole('button', { name: 'Deshacer' }).boundingBox())!.y;
        expect(pitch.y).toBeGreaterThanOrEqual(area.y);
        expect(pitch.y).toBeGreaterThan(toolbarBottom);
        expect(pitch.y + pitch.height).toBeLessThanOrEqual(area.y + area.height + 0.5);
        expect(pitch.y + pitch.height).toBeLessThanOrEqual(sheetTop);
        expect(pitch.width).toBeGreaterThan(vp.width * 0.4);
        await page.screenshot({ path: 'e2e/screenshots/pizarra-iphone-01-hoja.png' });

        // Rayar con el dedo sobre la cancha visible.
        await tools.click();
        const figuras = page.getByText(/^\d+ figuras? · se guardan/);
        await fingerDrag(page, drawLayer(page), [0.2, 0.3], [0.8, 0.6]);
        await expect(figuras).toHaveText(/^1 figura/);
        await expect(figuras).toBeVisible();
        await page.screenshot({ path: 'e2e/screenshots/pizarra-iphone-02-trazo.png' });

        // Cada pestaña deja sus herramientas DENTRO de la pantalla (antes, todo
        // apilado en la hoja, la mayoría quedaba fuera de vista).
        const tabs: [string, string][] = [
            ['Líneas', 'Flecha'], ['Líneas', 'Penal'],
            ['Material', 'Cono'], ['Material', 'Rival'],
            ['Color', 'Color Rojo'],
            ['Objeto', '+90°'], ['Medir', 'Regla'],
            ['Escribir', 'Borrador'],
        ];
        for (const [tab, tool] of tabs) {
            await page.getByRole('tab', { name: tab }).click();
            await expect(page.getByRole('button', { name: tool }).first(), `${tab} → ${tool}`).toBeInViewport({ ratio: 1 });
        }
        // Las acciones fijas siguen a mano en cualquier pestaña.
        for (const name of ['Deshacer', 'Borrar todo', 'Reproducir jugada']) {
            await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
        }

        // Tocar un objeto puesto abre la pestaña Objeto con sus controles.
        await page.getByRole('tab', { name: 'Material' }).click();
        await pick(page, 'Cono');
        const lb = (await drawLayer(page).boundingBox())!;
        await page.touchscreen.tap(lb.x + lb.width * 0.5, lb.y + lb.height * 0.75);
        await page.getByRole('button', { name: /^Dibujando/ }).click(); // apagar dibujo: tocar = seleccionar
        await page.touchscreen.tap(lb.x + lb.width * 0.5, lb.y + lb.height * 0.75);
        await expect(page.getByText('Seleccionado: Cono')).toBeInViewport();
        await expect(page.getByRole('tab', { name: 'Objeto' })).toHaveAttribute('aria-selected', 'true');
        await page.screenshot({ path: 'e2e/screenshots/pizarra-iphone-03-ajustes.png' });

        // Abrir Plantilla cierra la Pizarra (una sola hoja a la vez).
        await page.getByRole('button', { name: /^Plantilla \(/ }).click();
        await expect(page.getByRole('button', { name: 'Lápiz' })).toHaveCount(0);
    });
});
