import { readFile } from 'node:fs/promises';
import type { Download, Locator, Page } from '@playwright/test';
import {
    test, expect, openBoardFromMatch, mockWrite, SHOTS_DIR, SIGNATURES, startsWith, isMp4,
} from './helpers/pizarra';

/**
 * Pizarra táctica — animación por cuadros, exportar y guardar
 * (docs/specs/pizarra-nivel-tacticalpad.md §6: «crear 3 cuadros → reproducir → exportar PNG»).
 *
 * NO escribe nada: el guardado de la jugada (POST /api/v1/school/football/lineups)
 * va mockeado y se revisa su payload; cualquier otra escritura la aborta la red
 * de helpers/pizarra.ts y la prueba falla.
 */

test.use({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });

/** Fichas de jugador en la cancha (modo edición): el contenedor del botón «Quitar a … de la cancha». */
const pins = (page: Page) => page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ });
const pinOf = (removeBtn: Locator) => removeBtn.locator('..');

async function pinPos(removeBtn: Locator): Promise<{ left: string; top: string }> {
    return pinOf(removeBtn).evaluate((el: HTMLElement) => ({ left: el.style.left, top: el.style.top }));
}

/** Arrastra la ficha a (fx, fy) de la cancha (fracciones del contenedor donde
 *  viven los left/top %). dnd-kit necesita varios pasos de puntero para activarse. */
async function dragPinTo(page: Page, removeBtn: Locator, fx: number, fy: number) {
    const pin = pinOf(removeBtn);
    const box = (await pin.boundingBox())!;
    const area = (await pin.locator('..').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2 + 4; // centro de la figura, lejos de la X de quitar
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 6, y + 6, { steps: 3 });
    await page.mouse.move(area.x + area.width * fx, area.y + area.height * fy, { steps: 12 });
    await page.mouse.up();
}

/** Posiciones de las fichas que dibuja la capa de reproducción (aria-hidden, encima de la cancha). */
async function playbackPositions(page: Page): Promise<string[]> {
    return page.getByRole('dialog').evaluate((dlg) =>
        Array.from(dlg.querySelectorAll<HTMLElement>('[aria-hidden="true"] > div[style*="left"]'))
            .filter((el) => el.style.left.endsWith('%') && el.style.top.endsWith('%'))
            .map((el) => `${el.style.left},${el.style.top}`),
    );
}

const frameItems = (page: Page) => page.getByRole('list', { name: 'Cuadros' }).getByRole('listitem');

async function addFrame(page: Page, expected: number) {
    await page.getByRole('button', { name: /^Cuadro$/ }).click();
    await expect(frameItems(page)).toHaveCount(expected);
    await expect(page.getByRole('listitem', { name: `Cuadro ${expected}` })).toHaveAttribute('aria-current', 'true');
}

async function bytesOf(download: Download): Promise<Buffer> {
    return readFile((await download.path())!);
}

type Exported = { name: string; bytes: Buffer };

async function canRecordVideo(page: Page): Promise<boolean> {
    return page.evaluate(() =>
        typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
        && ['video/webm', 'video/mp4'].some((t) => MediaRecorder.isTypeSupported(t)));
}

/** PNG y PDF por firma de bytes; video WebM (EBML 1A45DFA3) o MP4 (ftyp) según lo que grabe Chromium. */
function checkExports({ png, pdf, video }: { png: Exported; pdf: Exported; video: Exported | null }) {
    test.info().annotations.push({
        type: 'exportado',
        description: [png, pdf, video].filter(Boolean).map((f) => `${f!.name} (${f!.bytes.length} B)`).join(' · '),
    });
    expect(png.name).toMatch(/\.png$/);
    expect(png.bytes.length).toBeGreaterThan(1000);
    expect(startsWith(png.bytes, SIGNATURES.png), 'firma PNG').toBe(true);

    expect(pdf.name).toMatch(/\.pdf$/);
    expect(pdf.bytes.length).toBeGreaterThan(1000);
    expect(startsWith(pdf.bytes, SIGNATURES.pdf), 'firma %PDF').toBe(true);

    if (!video) {
        test.info().annotations.push({ type: 'omitido', description: 'Este Chromium no graba video (MediaRecorder).' });
        return;
    }
    expect(video.bytes.length).toBeGreaterThan(1000);
    if (video.name.endsWith('.webm')) expect(startsWith(video.bytes, SIGNATURES.webm), 'firma WebM 1A45DFA3').toBe(true);
    else if (video.name.endsWith('.mp4')) expect(isMp4(video.bytes), 'caja ftyp de MP4').toBe(true);
    else throw new Error(`Video con extensión inesperada: ${video.name}`);
}

/** Exporta con el módulo real (servido por Vite) dentro del navegador. Va como
 *  string: si fuera una función, el transform de Playwright podría tocar el import(). */
async function exportViaModule(page: Page, frames: unknown[]): Promise<{ png: Exported; pdf: Exported; video: Exported | null }> {
    const res = await page.evaluate(`(async (frames) => {
        const m = await import('/src/lib/export/tacticalExport.ts');
        const b64 = async (blob) => {
            const u8 = new Uint8Array(await blob.arrayBuffer());
            let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
            return btoa(s);
        };
        const first = m.frameToStatic(frames[0]);
        const title = 'Salida por la derecha';
        const png = await m.exportPng({ players: first.players, arrows: first.arrows, title, teamName: 'THUNDER' });
        const pdf = await m.exportExercisePdf({ title, teamName: 'THUNDER', frames, players: first.players, arrows: first.arrows, objective: 'Prueba e2e' });
        let video = null;
        if (m.canRecordVideo()) {
            const v = await m.exportVideo({ frames });
            video = { name: m.exportFileName(title, v.ext), b64: await b64(v.blob) };
        }
        return {
            png: { name: m.exportFileName(title, 'png'), b64: await b64(png) },
            pdf: { name: m.exportFileName(title, 'pdf', 'ficha'), b64: await b64(pdf) },
            video,
        };
    })(${JSON.stringify(frames)})`) as Record<'png' | 'pdf', { name: string; b64: string }> & { video: { name: string; b64: string } | null };
    const toFile = (f: { name: string; b64: string }): Exported => ({ name: f.name, bytes: Buffer.from(f.b64, 'base64') });
    return { png: toFile(res.png), pdf: toFile(res.pdf), video: res.video ? toFile(res.video) : null };
}

test('3 cuadros → reproducir, pausa, velocidad, deshacer/rehacer → exportar → guardar', async ({ page, guard }) => {
    test.setTimeout(240_000);
    await openBoardFromMatch(page);

    // ── 1. Jugadores a la cancha (formación por defecto) ────────────────────
    await page.getByRole('button', { name: /^Poner jugadores/ }).click();
    await expect(pins(page).first()).toBeVisible();
    const pinCount = await pins(page).count();
    expect(pinCount).toBeGreaterThan(0);
    const mover = pins(page).first();
    const p1 = await pinPos(mover);

    // Cuadro 1 → mover (sigue siendo la posición inicial del cuadro 1).
    await dragPinTo(page, mover, 0.3, 0.45);
    const p1b = await pinPos(mover);
    expect(p1b).not.toEqual(p1);

    // ── 2. «+ Cuadro» y mover otra vez ──────────────────────────────────────
    await addFrame(page, 2);
    await expect(page.getByText('Cuadro 2 de 2')).toBeVisible();
    await dragPinTo(page, mover, 0.65, 0.3);
    const p2 = await pinPos(mover);
    expect(p2).not.toEqual(p1b);

    // ── 3. Tercer cuadro y otro movimiento ──────────────────────────────────
    await addFrame(page, 3);
    await dragPinTo(page, mover, 0.45, 0.65);
    const p3 = await pinPos(mover);
    expect(p3).not.toEqual(p2);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-01-tres-cuadros.png` });

    // ── 4. Reproducir: las posiciones cambian mientras corre ────────────────
    const progress = page.getByRole('progressbar', { name: 'Avance de la jugada' });
    await page.getByRole('button', { name: 'Reproducir cuadros' }).click();
    const pauseBtn = page.getByRole('button', { name: 'Pausa' });
    await expect(pauseBtn).toBeVisible();
    await expect.poll(async () => (await playbackPositions(page)).length).toBeGreaterThan(0);
    const t0 = await playbackPositions(page);
    await page.waitForTimeout(500);
    const t1 = await playbackPositions(page);
    expect(t1, 'las fichas se mueven durante la reproducción').not.toEqual(t0);
    await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-02-reproduciendo.png` });

    // ── 5. Pausa: el reloj se queda quieto ──────────────────────────────────
    await pauseBtn.click();
    await expect(page.getByRole('button', { name: 'Reproducir cuadros' })).toBeVisible();
    const paused = await progress.getAttribute('aria-valuenow');
    const pausedPos = await playbackPositions(page);
    await page.waitForTimeout(400);
    expect(await progress.getAttribute('aria-valuenow')).toBe(paused);
    expect(await playbackPositions(page)).toEqual(pausedPos);

    // ── 6. Velocidad ────────────────────────────────────────────────────────
    const speeds = page.getByRole('group', { name: 'Velocidad' });
    await speeds.getByRole('button', { name: '2×' }).click();
    await expect(speeds.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true');
    await expect(speeds.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'false');
    // A 2× sigue avanzando y llega al final de la jugada.
    await page.getByRole('button', { name: 'Reproducir cuadros' }).click();
    await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow')), { timeout: 10_000 }).toBe(100);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-03-velocidad-2x-fin.png` });

    // ── 7. Deshacer / rehacer (vuelve a editar el cuadro 3) ─────────────────
    await page.getByRole('listitem', { name: 'Cuadro 3' }).click();
    await expect(pins(page).first()).toBeVisible();
    expect(await pinPos(pins(page).first())).toEqual(p3);
    await page.getByRole('button', { name: /^Dibujar( \(\d+\))?$/ }).click();
    const undoBtn = page.getByRole('button', { name: 'Deshacer', exact: true });
    const redoBtn = page.getByRole('button', { name: 'Rehacer', exact: true });
    await undoBtn.click();
    await expect.poll(() => pinPos(pins(page).first())).toEqual(p2);
    await redoBtn.click();
    await expect.poll(() => pinPos(pins(page).first())).toEqual(p3);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-04-deshacer-rehacer.png` });
    // Cerrar el panel de Dibujar para que la cancha quede libre.
    await page.getByRole('button', { name: /^Dibujar( \(\d+\))?$/ }).click();

    // ── 8. Exportar (Imagen · Ficha PDF · Video) ────────────────────────────
    const exportBtn = page.getByRole('button', { name: 'Exportar la jugada' });
    const menuMounted = (await exportBtn.count()) > 0;
    if (menuMounted) {
        const pick = async (item: RegExp) => {
            await exportBtn.click();
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 60_000 }),
                page.getByRole('menuitem', { name: item }).click(),
            ]);
            return { name: download.suggestedFilename(), bytes: await bytesOf(download) };
        };
        const png = await pick(/Imagen/);
        const pdf = await pick(/Ficha/);
        const video = (await canRecordVideo(page)) ? await pick(/Video/) : null;
        checkExports({ png, pdf, video });
        await page.screenshot({ path: `${SHOTS_DIR}/anim-05-exportado.png` });
    } else {
        test.info().annotations.push({
            type: 'pendiente',
            description: 'La pizarra no monta TacticalExportMenu («Exportar ▾» no está en el toolbar): '
                + 'se exporta llamando a lib/export/tacticalExport con los cuadros guardados.',
        });
    }

    // ── 9. Guardar: payload con 3 cuadros y el cuadro 1 en las columnas viejas
    let payload: any = null;
    await mockWrite(page, guard, /\/api\/v1\/school\/football\/lineups(\?|$)/, (req) => {
        payload = req.postDataJSON();
        return { id: '00000000-0000-4000-8000-0000000e2e10', ...payload, players: [] };
    });
    const saveReq = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/v1\/school\/football\/lineups(\?|$)/.test(r.url()));
    await page.getByRole('button', { name: 'Guardar jugada' }).click();
    await saveReq;
    await expect(page.getByText('Jugada guardada').first()).toBeVisible();

    expect(payload.source_type).toBe('team_match');
    expect(Array.isArray(payload.frames)).toBe(true);
    expect(payload.frames).toHaveLength(3);
    const [f1, f2, f3] = payload.frames;
    expect(f1.players.length).toBe(pinCount);
    // Columnas de siempre (players + arrows) = cuadro 1, aunque el abierto era el 3.
    const starters = payload.players.filter((p: any) => p.role === 'starter');
    expect(starters).toHaveLength(f1.players.length);
    for (const s of starters) {
        const inF1 = f1.players.find((fp: any) => fp.key === `${s.subject_type}:${s.subject_id}`);
        expect(inF1, `${s.subject_type}:${s.subject_id} está en el cuadro 1`).toBeTruthy();
        // Los cuadros se guardan redondeados a 2 decimales; las columnas, completas.
        expect(s.x).toBeCloseTo(inF1.x, 1);
        expect(s.y).toBeCloseTo(inF1.y, 1);
    }
    expect(payload.arrows).toEqual(f1.arrows);
    // Cada cuadro tiene al jugador movido en otro lugar.
    const moved = (f: any) => f.players.map((p: any) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('|');
    expect(new Set([moved(f1), moved(f2), moved(f3)]).size).toBe(3);
    expect(f2.duration_ms).toBeGreaterThan(0);
    expect(f3.duration_ms).toBeGreaterThan(0);
    expect(guard.mocked.some((m) => /^POST .*\/api\/v1\/school\/football\/lineups$/.test(m)), 'el guardado fue al mock').toBe(true);

    // Sin el menú montado, el export real del navegador igual se prueba con la
    // jugada que acaba de salir de la pizarra (los mismos 3 cuadros).
    if (!menuMounted) {
        const out = await exportViaModule(page, payload.frames);
        checkExports(out);
    }
});
