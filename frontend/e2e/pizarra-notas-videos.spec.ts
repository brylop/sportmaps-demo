import type { Page } from '@playwright/test';
import { test, expect, openBoardFromMatch, mockWrite } from './helpers/pizarra';

/**
 * Pizarra M6c — notas y videos de la jugada (docs/specs/pizarra-m6-paridad-tacticalpad.md).
 *
 *   · nota con negrita y lista → viaja en el payload de «Guardar jugada»
 *   · nota del cuadro → subtítulo bajo la cancha al reproducir
 *   · pegar un enlace de YouTube con t=90 → vista previa con start=90
 *   · enlace inválido → error; enlace de Veo → tarjeta (sin iframe)
 *
 * NO escribe nada (red de helpers/pizarra.ts) y NO carga YouTube/Vimeo de
 * verdad: los dominios del embed se interceptan y devuelven una página vacía.
 * «Videos guardados» se mockea (el BFF de dev todavía no tiene la ruta).
 */

const SHOTS = process.env.PIZARRA_M6C_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6c';
const EMBEDS = /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//;

async function stubMedia(page: Page) {
    const embeds: string[] = [];
    await page.route(EMBEDS, async (route) => {
        embeds.push(route.request().url());
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title><body style="background:#111"></body>' });
    });
    // Nada de YouTube/Vimeo reales aunque algo se escape del embed.
    await page.route(/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|ytimg\.com|vimeo\.com|vimeocdn\.com|googlevideo\.com)\//, (route) => route.abort('blockedbyclient'));
    await page.route(/\/api\/v1\/school\/tactical\/videos(\?|$)/, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ json: { videos: [], available: true } });
    });
    return embeds;
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('nota con formato + nota de cuadro al reproducir + videos → payload', async ({ page, guard }) => {
        test.setTimeout(240_000);
        const embeds = await stubMedia(page);
        const savedVideos: any[] = [];
        await mockWrite(page, guard, /\/api\/v1\/school\/tactical\/videos(\?|$)/, (req) => {
            const v = req.postDataJSON();
            savedVideos.push(v);
            return { id: '00000000-0000-4000-8000-0000000e2e31', created_by: null, created_at: '2026-10-14T00:00:00Z', ...v };
        }, 201);
        await openBoardFromMatch(page);
        await page.getByRole('button', { name: /^Poner jugadores/ }).click();
        await expect(page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ }).first()).toBeVisible();

        // ── 1. Nota de la jugada con negrita y lista ────────────────────────
        await page.getByRole('button', { name: 'Notas', exact: true }).click();
        const dlg = page.getByRole('dialog', { name: 'Notas' });
        await expect(dlg).toBeVisible();
        const area = dlg.getByRole('textbox', { name: 'Nota de la jugada' });
        await area.fill('Salida por derecha');
        await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 6));
        await dlg.getByRole('button', { name: 'Negrita' }).click();
        await expect(area).toHaveValue('**Salida** por derecha');
        await area.press('Control+End');
        await area.pressSequentially('\nLateral sube');
        await dlg.getByRole('button', { name: 'Lista' }).click();
        await expect(area).toHaveValue('**Salida** por derecha\n- Lateral sube');
        await dlg.getByRole('button', { name: 'presión', exact: true }).click();
        await dlg.getByRole('button', { name: 'ataque organizado', exact: true }).click();
        await dlg.getByRole('button', { name: 'Vista previa' }).click();
        await expect(dlg.locator('strong', { hasText: 'Salida' })).toBeVisible();
        await expect(dlg.getByRole('listitem').filter({ hasText: 'Lateral sube' })).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/m6c-01-notas-desktop.png` });
        await dlg.getByRole('button', { name: 'Listo' }).click();
        await expect(dlg).toBeHidden();

        // ── 2. Cuadro 2 con su nota → subtítulo ─────────────────────────────
        await page.getByRole('button', { name: /^Cuadro$/ }).click();
        await expect(page.getByText('Cuadro 2 de 2')).toBeVisible();
        await page.getByRole('combobox', { name: 'Tiempo para llegar a este cuadro' }).selectOption('5000');
        await page.getByRole('button', { name: 'Notas', exact: true }).click();
        await expect(dlg.getByText('Nota del cuadro 2 de 2')).toBeVisible();
        await dlg.getByRole('textbox', { name: 'Nota del cuadro' }).fill('El **8** ataca el espacio');
        await dlg.getByRole('button', { name: 'Listo' }).click();
        const bar = page.getByTestId('frame-note-bar');
        await expect(bar).toContainText('El 8 ataca el espacio');

        await page.getByRole('button', { name: 'Reproducir cuadros' }).click();
        await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
        await expect(bar).toContainText('El 8 ataca el espacio');
        await expect(bar.locator('strong', { hasText: '8' })).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/m6c-02-subtitulo-reproduciendo.png` });
        await page.getByRole('button', { name: 'Pausa' }).click();
        await page.getByRole('listitem', { name: 'Cuadro 1' }).click();
        await expect(bar).toContainText('Cuadro sin nota');

        // ── 3. Videos: inválido → error; YouTube t=90 → start=90; Veo → tarjeta
        await page.getByRole('button', { name: /^Videos/ }).click();
        const vdlg = page.getByRole('dialog', { name: 'Videos' });
        const url = vdlg.getByRole('textbox', { name: 'Enlace del video' });
        await url.fill('javascript:alert(1)');
        await expect(vdlg.getByTestId('video-url-error')).toBeVisible();
        await url.fill('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ');
        await expect(vdlg.getByTestId('video-url-error')).toContainText('no es de un video');
        await expect(vdlg.getByRole('button', { name: 'Agregar a la jugada' })).toBeDisabled();

        await url.fill('https://youtu.be/dQw4w9WgXcQ?t=90');
        await expect(vdlg.getByTestId('video-url-error')).toHaveCount(0);
        await expect(vdlg.getByRole('textbox', { name: 'Minuto de inicio' })).toHaveValue('1:30');
        const iframe = vdlg.getByTestId('video-embed');
        await expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90&rel=0');
        await expect.poll(() => embeds.some((u) => u.includes('/embed/dQw4w9WgXcQ?start=90'))).toBe(true);
        await vdlg.getByRole('textbox', { name: 'Título del video' }).fill('Salida vs. presión alta');
        await vdlg.getByRole('button', { name: 'Agregar a la jugada' }).click();
        await expect(vdlg.getByText('Salida vs. presión alta')).toBeVisible();
        await expect.poll(() => savedVideos.length).toBe(1);
        expect(savedVideos[0]).toMatchObject({ provider: 'youtube', video_id: 'dQw4w9WgXcQ', start_s: 90 });

        await url.fill('https://app.veo.co/matches/20261012-final-abc/');
        const card = vdlg.getByTestId('video-link-card');
        await expect(card).toBeVisible();
        await expect(vdlg.locator('iframe')).toHaveCount(0);
        const link = card.getByRole('link', { name: /Ver en Veo/ });
        await expect(link).toHaveAttribute('href', 'https://app.veo.co/matches/20261012-final-abc/');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link).toHaveAttribute('target', '_blank');
        await vdlg.getByRole('switch', { name: 'Enlace privado' }).click();
        await vdlg.getByRole('checkbox', { name: 'Guardar también en Videos guardados' }).click();
        await vdlg.getByRole('button', { name: 'Agregar a la jugada' }).click();
        await page.screenshot({ path: `${SHOTS}/m6c-03-videos-desktop.png` });
        await vdlg.getByRole('button', { name: 'Listo' }).click();
        await expect(page.getByRole('button', { name: 'Videos (2)' })).toBeVisible();

        // ── 4. Guardar: notas, nota de cuadro y videos en el payload ────────
        let payload: any = null;
        await mockWrite(page, guard, /\/api\/v1\/school\/football\/lineups(\?|$)/, (req) => {
            payload = req.postDataJSON();
            return { id: '00000000-0000-4000-8000-0000000e2e30', ...payload, players: [] };
        });
        const saveReq = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/v1\/school\/football\/lineups(\?|$)/.test(r.url()));
        await page.getByRole('button', { name: 'Guardar jugada' }).click();
        await saveReq;
        await expect(page.getByText('Jugada guardada').first()).toBeVisible();

        expect(payload.notes).toEqual({ text: '**Salida** por derecha\n- Lateral sube', tags: ['presión', 'ataque organizado'] });
        expect(payload.frames).toHaveLength(2);
        expect(payload.frames[0].note).toBeUndefined();
        expect(payload.frames[1].note).toBe('El **8** ataca el espacio');
        expect(payload.videos).toEqual([
            { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'Salida vs. presión alta', start_s: 90, end_s: null, is_private: false },
            { provider: 'veo', url: 'https://app.veo.co/matches/20261012-final-abc/', title: 'Video de Veo', start_s: 0, end_s: null, is_private: true },
        ]);
        // El de Veo no se guardó en la biblioteca (casilla apagada).
        expect(savedVideos).toHaveLength(1);
    });
});

test.describe('celular (iPhone)', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

    test('Notas y Videos desde «Más»', async ({ page }) => {
        test.setTimeout(240_000);
        await stubMedia(page);
        await openBoardFromMatch(page);
        await page.getByRole('button', { name: /^Poner jugadores/ }).click();

        await page.getByRole('button', { name: 'Más opciones' }).click();
        await page.getByRole('menuitem', { name: /^Notas/ }).click();
        const dlg = page.getByRole('dialog', { name: 'Notas' });
        await expect(dlg).toBeVisible();
        await dlg.getByRole('textbox', { name: 'Nota de la jugada' }).fill('**Presión** tras pérdida\n- 5 segundos\n- Cerrar pase interior');
        await dlg.getByRole('button', { name: 'transición defensiva', exact: true }).click();
        await page.screenshot({ path: `${SHOTS}/m6c-04-notas-iphone.png` });
        await dlg.getByRole('button', { name: /^Videos/ }).click();

        const vdlg = page.getByRole('dialog', { name: 'Videos' });
        await expect(vdlg).toBeVisible();
        await vdlg.getByRole('textbox', { name: 'Enlace del video' }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s');
        await expect(vdlg.getByTestId('video-embed')).toHaveAttribute('src', /start=90/);
        await page.screenshot({ path: `${SHOTS}/m6c-05-videos-iphone.png` });
        await vdlg.getByRole('checkbox', { name: 'Guardar también en Videos guardados' }).click();
        await vdlg.getByRole('button', { name: 'Listo' }).click();
        await expect(vdlg).toBeHidden();

        // Volvió a Notas guardada (se confirmó al pasar a Videos).
        await page.getByRole('button', { name: 'Más opciones' }).click();
        await expect(page.getByRole('menuitem', { name: 'Videos (1)' })).toBeVisible();
        await page.getByRole('menuitem', { name: /^Notas/ }).click();
        await expect(dlg.getByRole('textbox', { name: 'Nota de la jugada' })).toHaveValue('**Presión** tras pérdida\n- 5 segundos\n- Cerrar pase interior');
        await dlg.getByRole('button', { name: 'Cancelar' }).click();
        await page.screenshot({ path: `${SHOTS}/m6c-06-tablero-iphone.png` });
    });
});
