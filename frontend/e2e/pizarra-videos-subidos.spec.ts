import type { Page, Route } from '@playwright/test';
import { devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { test, expect, openBoardFromMatch, mockWrite, FAKE_MATCH_ID, type WriteGuard } from './helpers/pizarra';

/**
 * «Videos» de la pizarra — M6h fase 1 (docs/specs/pizarra-m6h-videos-subidos.md).
 *
 *   (a) flag prendido: subir un video del celular con subida reanudable (tus)
 *       — se cae la red a mitad, reintenta, pregunta con HEAD y termina —,
 *       la guía «Importar de Veo / Hudl…», y en «Videos de la escuela» abrir
 *       un video, marcar inicio/fin desde el reproductor y guardar el clip
 *       vinculado a la jugada;
 *   (b) flag apagado: «Disponible pronto» y no se pide nada más;
 *   (c) iPhone 14: lo mismo cabe en la pantalla.
 *
 * TODO lo de videos va MOCKEADO: el BFF (/api/v1/school/videos*, que no está
 * desplegado), el servidor tus del proveedor (video.bunnycdn.com) y su
 * reproductor (iframe.mediadelivery.net, una página falsa que habla player.js).
 * Nada sale a Bunny ni se escribe en la base: la red anti-escrituras de
 * helpers/pizarra.ts aborta cualquier escritura sin mock.
 */

const SHOTS = process.env.M6H_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6h';
mkdirSync(SHOTS, { recursive: true });

const FAKE_LINEUP_ID = '00000000-0000-4000-8000-0000000e2e61';
const READY_ID = '00000000-0000-4000-8000-0000000e2e71';
const NEW_ID = '00000000-0000-4000-8000-0000000e2e72';
const GUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const TUS = 'https://video.bunnycdn.com/tusupload';
const EMBED = `https://iframe.mediadelivery.net/embed/424242/${GUID}?token=e2e&expires=4102444800`;
const CHUNK = 256 * 1024;

const SETTINGS = (enabled: boolean) => ({
    enabled, school_flag: enabled, provider_configured: true, provider: 'bunny',
    quota_seconds: 36000, quota_bytes: 25 * 1024 ** 3, used_seconds: 5400, used_bytes: 2.1 * 1024 ** 3,
    max_upload_bytes: 4 * 1024 ** 3, max_duration_s: 10800,
});

const READY_VIDEO = {
    id: READY_ID, school_id: 's', team_id: null, provider: 'bunny', status: 'ready', duration_s: 5400, size_bytes: 2.1 * 1024 ** 3,
    title: 'Partido vs Rival QA (Veo)', recorded_at: '2026-10-11', source: 'veo', consent_scope: 'staff', created_by: 'x',
    created_at: '2026-10-12T10:00:00Z', updated_at: '2026-10-12T10:00:00Z',
};

/** Un MP4 «de mentira» que pasa por MP4 (caja ftyp) y pesa ~1,2 MB (5 trozos). */
function fakeMp4(size = 5 * CHUNK - 1000): Buffer {
    const b = Buffer.alloc(size, 7);
    b.writeUInt32BE(24, 0);
    b.write('ftypisom', 4, 'ascii');
    return b;
}

interface VideosState {
    videos: any[];
    clips: any[];
    uploadBodies: any[];
    clipBodies: any[];
    tus: { method: string; offset?: string }[];
}

/** BFF de videos (lecturas con page.route, escrituras con mockWrite: quedan registradas). */
async function mockVideosApi(page: Page, guard: WriteGuard, enabled: boolean): Promise<VideosState> {
    const st: VideosState = { videos: [READY_VIDEO], clips: [], uploadBodies: [], clipBodies: [], tus: [] };
    const getOnly = (re: RegExp, body: (url: URL) => unknown) => page.route(re, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ json: body(new URL(route.request().url())) });
    });
    await getOnly(/\/api\/v1\/school\/videos\/settings$/, () => SETTINGS(enabled));
    await getOnly(/\/api\/v1\/school\/videos(\?.*)?$/, () => ({ videos: st.videos }));
    await getOnly(/\/api\/v1\/school\/videos\/[^/]+\/playback(\?.*)?$/, (u) => ({
        kind: 'iframe', url: EMBED, thumbnailUrl: null, expiresAt: '2100-01-01T00:00:00Z', ttl_s: Number(u.searchParams.get('ttl')) || 900, duration_s: 5400,
    }));
    await getOnly(/\/api\/v1\/school\/videos\/[^/]+\/clips$/, () => ({ clips: st.clips }));

    await mockWrite(page, guard, /\/api\/v1\/school\/videos\/uploads$/, (req) => {
        const body = req.postDataJSON();
        st.uploadBodies.push(body);
        st.videos = [{ ...READY_VIDEO, id: NEW_ID, status: 'uploading', title: body.title, source: body.source, duration_s: null }, ...st.videos];
        return {
            video_id: NEW_ID,
            upload: {
                protocol: 'tus', endpoint: TUS, chunkSize: CHUNK, expiresAt: '2100-01-01T00:00:00Z',
                headers: { AuthorizationSignature: 'firma-e2e', AuthorizationExpire: '4102444800', VideoId: GUID, LibraryId: '424242' },
                metadata: { filetype: body.mime_type, title: body.title },
            },
        };
    }, 201);
    await mockWrite(page, guard, /\/api\/v1\/school\/videos\/[^/]+\/sync$/, () => {
        st.videos = st.videos.map((v) => (v.id === NEW_ID ? { ...v, status: 'processing' } : v));
        return { status: 'processing' };
    });
    await mockWrite(page, guard, /\/api\/v1\/school\/videos\/[^/]+\/clips$/, (req) => {
        const body = req.postDataJSON();
        st.clipBodies.push(body);
        const clip = { id: `00000000-0000-4000-8000-0000000e2e8${st.clips.length}`, video_id: READY_ID, preset_id: null, exercise_id: null, created_by: 'x', created_at: '', lineup_id: null, ...body };
        st.clips.push(clip);
        return { clip };
    }, 201);
    return st;
}

/** Servidor tus falso del proveedor, con CORS como el real. El 3.er PATCH se cae (red). */
async function mockTusServer(page: Page, st: VideosState, opts: { dropPatch?: number; holdHeadMs?: number } = {}) {
    let offset = 0;
    let patches = 0;
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, HEAD, PATCH, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Location, Upload-Offset, Upload-Length, Tus-Resumable',
        'Tus-Resumable': '1.0.0',
    };
    await page.route(`${TUS}**`, async (route: Route) => {
        const req = route.request();
        const method = req.method();
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const h = req.headers();
        if (h['authorizationsignature'] !== 'firma-e2e' || h['tus-resumable'] !== '1.0.0') {
            return route.fulfill({ status: 401, headers: cors, body: 'sin firma' });
        }
        if (method === 'POST') {
            st.tus.push({ method });
            return route.fulfill({ status: 201, headers: { ...cors, Location: `${TUS}/e2e-upload` } });
        }
        if (method === 'HEAD') {
            st.tus.push({ method, offset: String(offset) });
            if (opts.holdHeadMs) await new Promise((r) => setTimeout(r, opts.holdHeadMs));
            return route.fulfill({ status: 200, headers: { ...cors, 'Upload-Offset': String(offset) } });
        }
        if (method === 'PATCH') {
            patches += 1;
            st.tus.push({ method, offset: h['upload-offset'] });
            if (patches === opts.dropPatch) return route.abort('internetdisconnected');
            if (Number(h['upload-offset']) !== offset) return route.fulfill({ status: 409, headers: cors });
            offset += req.postDataBuffer()?.length ?? 0;
            return route.fulfill({ status: 204, headers: { ...cors, 'Upload-Offset': String(offset) } });
        }
        return route.fulfill({ status: 405, headers: cors });
    });
    return { get offset() { return offset; } };
}

/** Reproductor falso: habla player.js (ready + getCurrentTime) como el de Bunny. */
async function mockPlayer(page: Page) {
    await page.route('https://iframe.mediadelivery.net/embed/**', (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#0b1220;color:#cbd5e1;font:14px system-ui;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center"><div style="font-size:42px">▶</div><div id="t">Reproductor del proveedor (simulado) · 0:42</div></div>
<script>
var t = 42;
function send(m){ parent.postMessage(JSON.stringify(Object.assign({context:'player.js',version:'0.0.11'}, m)), '*'); }
window.addEventListener('message', function(e){
  var m; try { m = JSON.parse(e.data); } catch(_) { return; }
  if (!m || m.context !== 'player.js') return;
  if (m.method === 'getCurrentTime') { send({event:'getCurrentTime', listener:m.listener, value:t}); t += 8; }
  if (m.method === 'setCurrentTime') { t = m.value; }
  document.getElementById('t').textContent = 'Reproductor del proveedor (simulado) · ' + Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0');
});
send({event:'ready', value:{src: location.href, events:['ready'], methods:['getCurrentTime','setCurrentTime','play','pause']}});
</script></body></html>`,
    }));
}

/** La jugada del partido ya está guardada (para «Vincular a esta jugada»). Solo LECTURAS. */
async function injectSavedLineup(page: Page) {
    const lineup = {
        id: FAKE_LINEUP_ID, team_id: '00000000-0000-4000-8000-0000000e2e99', source_type: 'team_match', source_id: FAKE_MATCH_ID,
        formation: null, arrows: [], frames: null, created_by: 'x', created_at: '2026-10-12T10:00:00Z', updated_at: '2026-10-12T10:00:00Z',
    };
    await page.route(/\/api\/v1\/school\/football\/lineups\?/, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const u = new URL(route.request().url());
        await route.fulfill({ json: u.searchParams.get('source_id') === FAKE_MATCH_ID ? [lineup] : [] });
    });
    await page.route(new RegExp(`/api/v1/school/football/lineups/${FAKE_LINEUP_ID}$`), async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ json: { ...lineup, players: [] } });
    });
}

/** Un solo botón «Videos» en la pizarra (M6c): los subidos (M6h) son su pestaña «Subir».
 *  En el celular editando, «Videos» vive en «Más opciones». */
async function openVideos(page: Page) {
    const direct = page.getByRole('button', { name: /^Videos/ });
    if (await direct.count()) await direct.first().click();
    else {
        await page.getByRole('button', { name: 'Más opciones' }).click();
        await page.getByRole('menuitem', { name: /^Videos/ }).click();
    }
    const dialog = page.getByRole('dialog', { name: 'Videos' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'Subir', exact: true }).click();
}

test.describe('escritorio', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('subir del celular (se cae la red y sigue), guía de Veo y clip vinculado a la jugada', async ({ page, guard }) => {
        test.setTimeout(240_000);
        const st = await mockVideosApi(page, guard, true);
        const tus = await mockTusServer(page, st, { dropPatch: 3, holdHeadMs: 1500 });
        await mockPlayer(page);
        await injectSavedLineup(page);
        await openBoardFromMatch(page);
        await openVideos(page);

        const dialog = page.getByRole('dialog', { name: 'Videos' });
        await expect(dialog.getByText(/Cupo de la escuela/)).toBeVisible();
        await expect(dialog.getByTestId('video-input-camera')).toHaveAttribute('capture', 'environment');
        await page.screenshot({ path: `${SHOTS}/01-escritorio-subir.png` });

        const file = fakeMp4();
        await dialog.getByTestId('video-input-file').setInputFiles({ name: 'partido_sabado.mp4', mimeType: 'video/mp4', buffer: file });
        await expect(dialog.getByLabel('Título del video')).toHaveValue('partido sabado');
        await dialog.getByLabel('Origen del video').selectOption('veo');
        await dialog.getByRole('button', { name: 'Subir video', exact: true }).click();

        // El 3.er trozo se cae: «reintentando» (el HEAD se demora 1,5 s para verlo).
        await expect(dialog.getByText(/reintentando|Sin conexión/)).toBeVisible({ timeout: 20_000 });
        await page.screenshot({ path: `${SHOTS}/02-escritorio-reintentando.png` });
        await expect(dialog.getByText('Video subido')).toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOTS}/03-escritorio-subido.png` });

        expect(tus.offset).toBe(file.length);
        expect(st.uploadBodies[0]).toMatchObject({ title: 'partido sabado', mime_type: 'video/mp4', size_bytes: file.length, source: 'veo' });
        // Tras la caída se preguntó por dónde iba (HEAD) y se siguió desde ahí, sin repetir lo ya subido.
        const seq = st.tus.map((x) => x.method + (x.offset != null ? `@${x.offset}` : ''));
        expect(seq).toEqual(['POST', `PATCH@0`, `PATCH@${CHUNK}`, `PATCH@${2 * CHUNK}`, `HEAD@${2 * CHUNK}`,
            `PATCH@${2 * CHUNK}`, `PATCH@${3 * CHUNK}`, `PATCH@${4 * CHUNK}`]);
        expect(guard.mocked.some((m) => m.endsWith(`/api/v1/school/videos/${NEW_ID}/sync`))).toBe(true);

        // Guía de importación.
        await dialog.getByRole('tab', { name: /Importar de Veo/ }).click();
        await expect(dialog.getByText(/Download full game/)).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/04-escritorio-importar-veo.png` });

        // Videos de la escuela → abrir el partido listo → marcar clip desde el reproductor.
        await dialog.getByRole('tab', { name: 'Videos de la escuela' }).click();
        await expect(dialog.getByText('partido sabado')).toBeVisible();
        await expect(dialog.getByText('Procesando')).toBeVisible();
        await dialog.getByRole('button', { name: `Abrir ${READY_VIDEO.title}` }).click();
        await expect(dialog.frameLocator('iframe').getByText(/Reproductor del proveedor/)).toBeVisible();
        await dialog.getByRole('button', { name: 'Marcar' }).first().click();
        await expect(dialog.getByLabel('Inicio del clip')).toHaveValue('0:42');
        await dialog.getByRole('button', { name: 'Marcar' }).nth(1).click();
        await expect(dialog.getByLabel('Fin del clip')).toHaveValue('0:50');
        await dialog.getByLabel('Nombre del clip').fill('Presión alta tras pérdida');
        await expect(dialog.getByRole('checkbox')).toBeChecked();
        await dialog.getByRole('button', { name: /Guardar clip/ }).click();
        await expect(dialog.getByText('En esta jugada')).toBeVisible();
        expect(st.clipBodies[0]).toEqual({ title: 'Presión alta tras pérdida', start_s: 42, end_s: 50, lineup_id: FAKE_LINEUP_ID });
        await page.screenshot({ path: `${SHOTS}/05-escritorio-clip-vinculado.png` });
    });

    test('flag apagado: «Disponible pronto» y no se pide nada más', async ({ page, guard }) => {
        test.setTimeout(180_000);
        const st = await mockVideosApi(page, guard, false);
        const asked: string[] = [];
        page.on('request', (r) => { if (/\/api\/v1\/school\/videos/.test(r.url())) asked.push(`${r.method()} ${new URL(r.url()).pathname}`); });
        await openBoardFromMatch(page);
        await openVideos(page);
        const dialog = page.getByRole('dialog', { name: 'Videos' });
        await expect(dialog.getByText('Disponible pronto')).toBeVisible();
        await expect(dialog.getByTestId('video-input-camera')).toHaveCount(0);
        await page.screenshot({ path: `${SHOTS}/06-escritorio-flag-apagado.png` });
        await dialog.getByRole('tab', { name: 'Videos de la escuela' }).click();
        await expect(dialog.getByText('Disponible pronto')).toBeVisible();
        expect(asked.filter((a) => !a.endsWith('/videos/settings'))).toEqual([]);
        expect(st.uploadBodies).toEqual([]);
    });
});

test.describe('celular (iPhone 14)', () => {
    // Pantalla y toque del iPhone en Chromium (el WebKit de Playwright no está instalado).
    const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 14'];
    test.use(iphone);

    test('el diálogo cabe: subir, y reproductor con clips', async ({ page, guard }) => {
        test.setTimeout(240_000);
        const st = await mockVideosApi(page, guard, true);
        await mockTusServer(page, st);
        await mockPlayer(page);
        await injectSavedLineup(page);
        await openBoardFromMatch(page);
        await openVideos(page);
        const vp = page.viewportSize()!;
        const dialog = page.getByRole('dialog', { name: 'Videos' });
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
        await expect(dialog.getByRole('button', { name: /Grabar con la cámara/ })).toBeInViewport();
        await page.screenshot({ path: `${SHOTS}/07-iphone-subir.png` });

        await dialog.getByTestId('video-input-camera').setInputFiles({ name: 'VID_20261011.mp4', mimeType: 'video/mp4', buffer: fakeMp4(3 * CHUNK) });
        await dialog.getByRole('button', { name: 'Subir video', exact: true }).click();
        await expect(dialog.getByText('Video subido')).toBeVisible({ timeout: 30_000 });

        await dialog.getByRole('tab', { name: 'Videos de la escuela' }).click();
        await dialog.getByRole('button', { name: `Abrir ${READY_VIDEO.title}` }).click();
        await expect(dialog.frameLocator('iframe').getByText(/Reproductor del proveedor/)).toBeVisible();
        await dialog.getByLabel('Inicio del clip').fill('12:30');
        await dialog.getByLabel('Fin del clip').fill('12:41');
        await dialog.getByLabel('Nombre del clip').fill('Salida por izquierda');
        await dialog.getByRole('button', { name: /Guardar clip/ }).click();
        await expect(dialog.getByText('En esta jugada')).toBeVisible();
        expect(st.clipBodies[0]).toMatchObject({ start_s: 750, end_s: 761, lineup_id: FAKE_LINEUP_ID });
        await page.screenshot({ path: `${SHOTS}/08-iphone-clips.png` });
    });
});
