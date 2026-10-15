import { devices, type Locator, type Page } from '@playwright/test';
import { test, expect, openBoardFromMatch, mockWrite } from './helpers/pizarra';

/**
 * Pizarra M6d — herramientas de dibujo y diálogo «Campo»
 * (docs/specs/pizarra-m6-paridad-tacticalpad.md §2 M6d y §4).
 *
 * Dibuja pase / conducción / disparo, una zona polígono y el foco sobre un
 * jugador; elige plantilla de líneas, media cancha y piso indoor; guarda (POST
 * mockeado) y revisa el payload: figuras con sus campos nuevos, la
 * configuración de cancha en UNA pseudo-figura y las coordenadas de los
 * jugadores intactas (se guardan siempre sobre la cancha completa).
 *
 * No escribe nada: la red anti-escrituras de helpers/pizarra.ts aborta y hace
 * fallar cualquier escritura sin mock.
 */

const SHOTS = process.env.PIZARRA_M6D_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6d';
const pins = (page: Page) => page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ });
const drawLayer = (page: Page) => page.locator('svg.z-40');

async function dragOn(page: Page, layer: Locator, from: [number, number], to: [number, number]) {
    const box = (await layer.boundingBox())!;
    await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
    await page.mouse.up();
}
async function tapOn(page: Page, layer: Locator, at: [number, number]) {
    const box = (await layer.boundingBox())!;
    await page.mouse.click(box.x + box.width * at[0], box.y + box.height * at[1]);
}

/** Posición guardada de cada ficha (left/top en % = x/y en cancha completa). */
async function pinPositions(page: Page): Promise<{ x: number; y: number }[]> {
    const all = await pins(page).all();
    const out: { x: number; y: number }[] = [];
    for (const b of all) {
        out.push(await b.locator('..').evaluate((el: HTMLElement) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) })));
    }
    return out;
}

/** En celular las herramientas viven en pestañas de la hoja inferior. */
async function openTab(page: Page, name: string) {
    const tab = page.getByRole('tab', { name });
    if (await tab.isVisible().catch(() => false)) await tab.click();
}

async function startDrawing(page: Page) {
    await page.getByRole('button', { name: /^Poner jugadores/ }).click();
    await expect(pins(page).first()).toBeVisible();
    await page.getByRole('button', { name: /^Dibujar( \(\d+\))?$/ }).click();
}

async function openCourtDialog(page: Page) {
    await page.getByRole('button', { name: 'Más opciones' }).click();
    await page.getByTestId('tb-open-court').click();
    await expect(page.getByTestId('tb-court-dialog')).toBeVisible();
}

test.describe('escritorio', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('pase, conducción, disparo, zona polígono, foco, media cancha y piso indoor → payload', async ({ page, guard }) => {
        test.setTimeout(240_000);
        await openBoardFromMatch(page);
        await startDrawing(page);
        const layer = drawLayer(page);

        // Flecha clásica: debe guardarse SIN campos nuevos (formato de siempre).
        await page.getByRole('button', { name: 'Flecha', exact: true }).click();
        await dragOn(page, layer, [0.15, 0.85], [0.3, 0.7]);

        // Estilos con convención de leyenda.
        for (const [style, from, to] of [
            ['pass', [0.2, 0.6], [0.5, 0.45]],
            ['dribble', [0.55, 0.62], [0.8, 0.42]],
            ['shot', [0.5, 0.3], [0.5, 0.06]],
        ] as const) {
            await page.locator(`[data-line-style="${style}"]`).click();
            await dragOn(page, layer, from as unknown as [number, number], to as unknown as [number, number]);
            await expect(layer.locator(`[data-m6d="line"][data-line="${style}"]`)).toHaveCount(1);
        }
        await expect(page.getByTestId('tb-line-legend')).toContainText('Pase');
        await expect(page.getByTestId('tb-line-legend')).toContainText('Conducción');
        await expect(page.getByTestId('tb-line-legend')).toContainText('Disparo');

        // Zona polígono: 4 vértices y tocar el primero la cierra.
        await page.locator('[data-zone-form="polygon"]').click();
        for (const at of [[0.15, 0.2], [0.4, 0.18], [0.42, 0.38], [0.18, 0.4]] as const) await tapOn(page, layer, at as unknown as [number, number]);
        await expect(layer.locator('[data-polygon-draft="4"]')).toBeVisible();
        await tapOn(page, layer, [0.151, 0.201]);
        await expect(layer.locator('[data-m6d="zone"][data-form="polygon"]')).toHaveCount(1);

        // Foco: tocar cerca de un jugador lo centra en él.
        const target = pins(page).nth(1).locator('..');
        const tb = (await target.boundingBox())!;
        await page.getByRole('button', { name: 'Resaltar jugador' }).click();
        await page.mouse.click(tb.x + tb.width / 2 + 6, tb.y + tb.height / 2);
        await expect(layer.locator('[data-m6d="spotlight"]')).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/m6d-01-escritorio-herramientas.png` });

        // Posiciones de los jugadores en cancha completa, ANTES de la cámara.
        const before = await pinPositions(page);

        // «Campo»: plantilla, media cancha (arco abajo), piso indoor.
        await openCourtDialog(page);
        await page.screenshot({ path: `${SHOTS}/m6d-02-escritorio-dialogo-campo.png` });
        await page.getByTestId('tb-tpl-lanes_thirds').click();
        await page.getByTestId('tb-cam-half_bottom').click();
        await page.getByTestId('tb-surface-wood').click();
        await page.getByRole('button', { name: 'Listo' }).click();
        await expect(page.getByTestId('tb-court-dialog')).toBeHidden();
        await expect(page.locator('[data-court-template="lanes_thirds"]').first()).toBeAttached();
        await page.screenshot({ path: `${SHOTS}/m6d-03-escritorio-media-cancha-madera.png` });

        // Guardar: payload.
        let payload: any = null;
        await mockWrite(page, guard, /\/api\/v1\/school\/football\/lineups(\?|$)/, (req) => {
            payload = req.postDataJSON();
            return { id: '00000000-0000-4000-8000-0000000e2e20', ...payload, players: [] };
        });
        const saveReq = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/v1\/school\/football\/lineups(\?|$)/.test(r.url()));
        await page.getByRole('button', { name: 'Guardar jugada' }).click();
        await saveReq;
        await expect(page.getByText('Jugada guardada').first()).toBeVisible();

        const arrows: any[] = payload.arrows;
        const classic = arrows.find((a) => a.type === 'arrow' && !a.line);
        expect(Object.keys(classic).sort()).toEqual(['color', 'type', 'x1', 'x2', 'y1', 'y2']);
        expect(arrows.filter((a) => a.line).map((a) => a.line).sort()).toEqual(['dribble', 'pass', 'shot']);
        const poly = arrows.find((a) => a.type === 'zone');
        expect(poly.form).toBe('polygon');
        expect(poly.points).toHaveLength(8);
        for (const n of poly.points) expect(n).toBeGreaterThanOrEqual(0);
        const spot = arrows.find((a) => a.type === 'spotlight');
        expect(spot).toBeTruthy();
        const court = arrows.filter((a) => a.type === 'court');
        expect(court).toHaveLength(1);
        expect(court[0].court).toEqual({ tpl: 'lanes_thirds', cam: 'half_bottom', surface: 'wood' });

        // Coordenadas intactas: lo guardado es la cancha completa, no la ventana.
        const starters = payload.players.filter((p: any) => p.role === 'starter');
        expect(starters.length).toBe(before.length);
        const saved = starters.map((p: any) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).sort();
        expect(saved).toEqual(before.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).sort());
        // El foco quedó centrado en un jugador.
        expect(starters.some((p: any) => Math.abs(p.x - spot.x1) < 0.01 && Math.abs(p.y - spot.y1) < 0.01)).toBe(true);

        // Exportación real (PNG) de lo guardado: vertical con media cancha y la
        // misma jugada en horizontal con pizarra blanca. Se revisan a ojo.
        const players = starters.map((p: any) => ({ x: p.x, y: p.y, label: p.slot_label, jersey: p.jersey_number }));
        const horizontal = arrows.map((a2: any) => (a2.type === 'court' ? { ...a2, court: { tpl: 'positional', orient: 'h', surface: 'whiteboard' } } : a2));
        const pngs = await page.evaluate(`(async (input) => {
            const m = await import('/src/lib/export/tacticalExport.ts');
            const b64 = async (blob) => {
                const u8 = new Uint8Array(await blob.arrayBuffer());
                let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
                return btoa(s);
            };
            const out = [];
            for (const arrows of [input.a, input.b]) out.push(await b64(await m.exportPng({ players: input.players, arrows, title: 'M6d', teamName: 'THUNDER', sport: 'futbol7' })));
            return out;
        })(${JSON.stringify({ players, a: arrows, b: horizontal })})`) as string[];
        const { writeFile } = await import('node:fs/promises');
        await writeFile(`${SHOTS}/m6d-07-export-media-cancha.png`, Buffer.from(pngs[0], 'base64'));
        await writeFile(`${SHOTS}/m6d-08-export-horizontal-pizarra-blanca.png`, Buffer.from(pngs[1], 'base64'));
        expect(Buffer.from(pngs[1], 'base64').subarray(1, 4).toString('ascii')).toBe('PNG');
    });
});

test.describe('iPhone', () => {
    // Sin defaultBrowserType: corre en el Chromium del proyecto con la pantalla y el toque del iPhone 14.
    const iphone: Partial<typeof devices['iPhone 14']> = { ...devices['iPhone 14'] };
    delete iphone.defaultBrowserType;
    test.use(iphone);

    test('celular: pase + plantilla + pizarra blanca se leen y no tapan a los jugadores', async ({ page }) => {
        test.setTimeout(240_000);
        await openBoardFromMatch(page);
        await startDrawing(page);
        const layer = drawLayer(page);
        await openTab(page, 'Líneas');
        await page.locator('[data-line-style="pass"]').click();
        await dragOn(page, layer, [0.25, 0.75], [0.6, 0.5]);
        await page.locator('[data-line-style="dribble"]').click();
        await dragOn(page, layer, [0.7, 0.7], [0.75, 0.4]);
        await page.locator('[data-zone-form="ellipse"]').click();
        await dragOn(page, layer, [0.3, 0.25], [0.7, 0.4]);
        await expect(layer.locator('[data-m6d="zone"][data-form="ellipse"]')).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/m6d-04-iphone-lineas.png` });

        await openCourtDialog(page);
        await page.getByTestId('tb-tpl-positional').click();
        await page.getByTestId('tb-surface-whiteboard').click();
        await page.screenshot({ path: `${SHOTS}/m6d-05-iphone-dialogo-campo.png` });
        await page.getByRole('button', { name: 'Listo' }).click();
        await expect(page.locator('[data-court-template="positional"]').first()).toBeAttached();
        await page.screenshot({ path: `${SHOTS}/m6d-06-iphone-pizarra-blanca.png` });
    });
});
