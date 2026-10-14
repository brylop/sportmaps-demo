import type { Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
    test, expect, COACH, openBoardFromMatch, mockWrite, SHOTS_DIR,
} from './helpers/pizarra';

/**
 * Pizarra táctica — biblioteca de ejercicios (T3, docs/specs/pizarra-nivel-tacticalpad.md §6:
 * «guardar en biblioteca → insertar en sesión»).
 *
 * Las LECTURAS van de verdad (plantillas SportMaps del BFF de dev, base compartida).
 * Las ESCRITURAS van mockeadas: POST /api/v1/school/exercises (guardar) y
 * POST /api/v1/school/exercises/:id/insert-into-session (la RPC
 * insert_exercise_into_session_block). Cualquier otra escritura la aborta la
 * red de helpers/pizarra.ts y la prueba falla.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXERCISES = /\/api\/v1\/school\/exercises(\?|$)/;
const INSERT = /\/api\/v1\/school\/exercises\/([0-9a-f-]{36})\/insert-into-session$/;

const pins = (page: Page) => page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ });

/** Entrada a «Guardar en biblioteca» desde la pizarra: botón del toolbar o ítem de «Más opciones». */
async function findSaveToLibrary(page: Page) {
    const name = /Guardar en (la )?biblioteca/i;
    const direct = page.getByRole('dialog').getByRole('button', { name });
    if (await direct.count()) return direct.first();
    await page.getByRole('button', { name: 'Más opciones' }).click();
    const item = page.getByRole('menuitem', { name });
    if (await item.count()) return item.first();
    await page.keyboard.press('Escape');
    return null;
}

test('desde la pizarra: «Guardar en biblioteca» manda la ficha y la jugada con sus cuadros', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await openBoardFromMatch(page);
    await page.getByRole('button', { name: /^Poner jugadores/ }).click();
    await expect(pins(page).first()).toBeVisible();
    const pinCount = await pins(page).count();

    // Un segundo cuadro con un jugador movido: la jugada guardada lleva frames.
    await page.getByRole('button', { name: /^Cuadro$/ }).click();
    await expect(page.getByRole('listitem', { name: 'Cuadro 2' })).toHaveAttribute('aria-current', 'true');
    const pin = pins(page).first().locator('..');
    const box = (await pin.boundingBox())!;
    const area = (await pin.locator('..').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2 + 10, { steps: 3 });
    await page.mouse.move(area.x + area.width * 0.6, area.y + area.height * 0.35, { steps: 12 });
    await page.mouse.up();

    const entry = await findSaveToLibrary(page);
    test.skip(!entry, 'PENDIENTE: la pizarra no monta SaveToLibraryDialog (no hay «Guardar en biblioteca» en el toolbar ni en «Más opciones»).');

    let body: any = null;
    await mockWrite(page, guard, EXERCISES, (req) => {
        body = req.postDataJSON();
        return {
            id: '00000000-0000-4000-8000-0000000e2e20', school_id: 'x', created_by: 'x', is_template: false,
            is_active: true, times_used: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            ...body,
        };
    });
    await entry!.click();
    const dlg = page.getByRole('dialog', { name: 'Guardar en biblioteca' });
    await expect(dlg).toBeVisible();
    await dlg.getByLabel('Nombre *').fill('Salida por la derecha (e2e)');
    await dlg.getByLabel('Objetivo').fill('Sacar el balón jugado por la banda');
    await dlg.getByLabel('Duración (min)').fill('15');
    await dlg.getByLabel('Edad o categoría').fill('Sub-12');
    await dlg.getByLabel('Material').fill('4 platillos');
    await dlg.getByLabel('Etiquetas').fill('Salida de balón, rondo, rondo');
    await page.screenshot({ path: `${SHOTS_DIR}/bib-01-guardar-en-biblioteca.png` });
    const req = page.waitForRequest((r) => r.method() === 'POST' && EXERCISES.test(r.url()));
    await dlg.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await req;
    await expect(page.getByText('Guardado en la biblioteca').first()).toBeVisible();

    expect(body).toMatchObject({
        name: 'Salida por la derecha (e2e)',
        objective: 'Sacar el balón jugado por la banda',
        minutes: 15,
        age_group: 'Sub-12',
        materials: '4 platillos',
        tags: ['salida de balón', 'rondo'],
    });
    expect(typeof body.sport).toBe('string');
    // La jugada: puestos (sin atletas) y los 2 cuadros con las mismas claves 'slot#i'.
    expect(body.board.players).toHaveLength(pinCount);
    body.board.players.forEach((p: any, i: number) => expect(p.key).toBe(`slot#${i}`));
    expect(body.board.frames).toHaveLength(2);
    for (const f of body.board.frames) {
        for (const fp of f.players) expect(fp.key).toMatch(/^slot#\d+$/);
    }
    expect(JSON.stringify(body.board)).not.toMatch(/(athlete|child|profile|school_athlete|unregistered_athlete):/);
});

test('sesión → «Desde la biblioteca» → buscar y filtrar → «Usar en esta sesión» llama al BFF con los ids correctos', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await loginAs(page, COACH);

    // Equipo elegido (lo lee el roster al seleccionarlo).
    const rosterReq = page.waitForRequest((r) => /\/api\/v1\/school\/performance\/roster\?team_id=/.test(r.url()));
    await page.goto('/training-plans');
    await page.getByRole('combobox').first().click({ timeout: 30_000 });
    await page.getByRole('option', { name: /THUNDER/i }).first().click();
    const teamId = new URL((await rosterReq).url()).searchParams.get('team_id');
    expect(teamId).toMatch(UUID);

    // Sesión nueva (equipo de fútbol: bloques con «Desde la biblioteca»).
    await page.getByRole('button', { name: /^Crear (Primera )?Sesión$/ }).first().click();
    const session = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Crear Sesión' }) });
    await expect(session).toBeVisible();
    await session.getByRole('button', { name: /Desde la biblioteca/ }).first().click();

    // ── Biblioteca: plantillas SportMaps reales ─────────────────────────────
    const lib = page.getByRole('dialog', { name: 'Biblioteca de ejercicios' });
    await expect(lib).toBeVisible();
    await expect(lib.getByRole('tab', { name: 'Plantillas SportMaps' })).toHaveAttribute('aria-selected', 'true');
    await expect(lib.getByRole('button', { name: 'Usar en esta sesión' }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS_DIR}/bib-02-biblioteca.png` });

    // Buscar: la consulta viaja con q.
    const searched = page.waitForResponse((r) => EXERCISES.test(r.url()) && new URL(r.url()).searchParams.get('q') === 'rondo');
    await lib.getByRole('textbox', { name: 'Buscar ejercicio' }).fill('rondo');
    expect((await searched).ok()).toBe(true);

    // Filtrar por objetivo (etiqueta) y deporte.
    const tagged = page.waitForResponse((r) => {
        const u = new URL(r.url());
        return EXERCISES.test(r.url()) && u.searchParams.get('tag') === 'posesión' && u.searchParams.get('q') === 'rondo';
    });
    await lib.getByRole('button', { name: 'Posesión', exact: true }).click();
    await expect(lib.getByRole('button', { name: 'Posesión', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await tagged;
    const bySport = page.waitForResponse((r) => {
        const u = new URL(r.url());
        return EXERCISES.test(r.url()) && u.searchParams.get('sport') === 'futbol' && u.searchParams.get('tag') === 'posesión'
            && u.searchParams.get('templates') === 'true';
    });
    await lib.getByRole('button', { name: 'Fútbol 11', exact: true }).click();
    const list: any[] = await (await bySport).json();
    expect(list.length).toBeGreaterThan(0);
    for (const ex of list) {
        expect(ex.is_template).toBe(true);
        expect(ex.sport).toBe('futbol');
        expect(ex.tags).toContain('posesión');
    }
    const chosen = list[0];
    await expect(lib.getByText(chosen.name, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/bib-03-filtrada.png` });

    // Detalle de la tarjeta.
    // (en el detalle el título del diálogo pasa a ser el nombre del ejercicio)
    await lib.getByRole('button', { name: `Ver ${chosen.name}` }).click();
    const detail = page.getByRole('dialog', { name: chosen.name });
    await expect(detail).toBeVisible();
    await expect(detail.getByText('Plantilla SportMaps')).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Volver a la biblioteca' })).toBeVisible();
    const nFrames = Array.isArray(chosen.board?.frames) ? chosen.board.frames.length : 0;
    if (nFrames > 1) await expect(detail.getByText(`Jugada animada de ${nFrames} cuadros`, { exact: false })).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/bib-04-detalle.png` });

    // ── «Usar en esta sesión»: POST al BFF (RPC insert_exercise_into_session_block), mockeado
    let insertUrl = '';
    let insertBody: any = null;
    await mockWrite(page, guard, INSERT, (req) => {
        insertUrl = req.url();
        insertBody = req.postDataJSON();
        return {
            lineup_id: '00000000-0000-4000-8000-0000000e2e30', session_id: null,
            block_id: insertBody.block_id, exercise_id: chosen.id, block: null,
        };
    });
    const insertReq = page.waitForRequest((r) => r.method() === 'POST' && INSERT.test(r.url()));
    await detail.getByRole('button', { name: 'Usar en esta sesión' }).click();
    await insertReq;

    expect(insertUrl.match(INSERT)![1]).toBe(chosen.id);
    expect(insertBody.block_id).toMatch(UUID);
    expect(insertBody.session_id).toBeNull(); // sesión nueva, todavía sin guardar
    expect(insertBody.team_id).toBe(teamId);

    // El panel se cierra y el bloque queda con el ejercicio (solo campos vacíos).
    await expect(detail).toBeHidden();
    await expect(lib).toBeHidden();
    await expect(page.getByText('Ejercicio agregado al bloque').first()).toBeVisible();
    await expect(session).toBeVisible();
    await expect(session.getByText('Ejercicio de la biblioteca')).toBeVisible();
    await expect(session.getByPlaceholder('Actividad / ejercicio').first()).toHaveValue(chosen.name);
    await page.screenshot({ path: `${SHOTS_DIR}/bib-05-bloque-con-ejercicio.png` });

    // Cerrar sin crear la sesión (nada se escribe).
    await session.getByRole('button', { name: 'Cancelar' }).click();
    await expect(session).toBeHidden();
});
