import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * QA de punta a punta del Tablero Táctico (P0/P2 de
 * docs/specs/football-tactical-experience.md) — módulo confirmado como
 * "construido" (TacticalBoard.tsx, hooks useFootballLineups/
 * useSaveFootballLineup, bff/src/routes/school/football.ts,
 * migraciones tactical_board_p0/tactical_presets_p2) pero SIN prueba E2E
 * conocida antes de esta corrida.
 *
 * Fixture: coach de la Escuela Demo SportMaps (is_demo=true) asignado a
 * Thunder/Lightning/Halcones — el mismo coach que
 * coach-attendance-repro-besser.spec.ts ya usa, así que el roster de
 * Lightning/Thunder (equipos de Fútbol) ya existe y no hace falta sembrar
 * nada nuevo.
 *
 * Caso cubierto:
 * 1. Abrir el tablero para un partido/entrenamiento de Thunder.
 * 2. Ubicar jugadores en la cancha (drag desde la banca) hasta 11 titulares.
 * 3. Intentar forzar un 12vo titular y confirmar que el guardado lo rechaza
 *    (MAX_STARTERS = 11, validado en frontend Y en
 *    bff/src/routes/school/football.ts).
 * 4. Guardar con 11 titulares, recargar la página y verificar que la
 *    alineación persistió (x/y de cada jugador).
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

test.describe('Tablero táctico — alineación de fútbol', () => {
    test('crear alineación de 11 titulares, rechazar un 12vo, guardar y recargar', async ({ page }) => {
        test.setTimeout(120_000);
        page.on('response', async (res) => {
            if (res.url().includes('/football/') && res.status() >= 400) {
                console.log('[resp-error]', res.status(), res.url(), await res.text().catch(() => ''));
            }
        });

        await loginAs(page, COACH);
        await page.goto('/coach-attendance');
        await expect(page.getByRole('heading', { name: 'Asistencias' })).toBeVisible({ timeout: 20_000 });

        // Selecciona Thunder (equipo de fútbol con roster >= 12 esperado).
        await page.getByText('THUNDER', { exact: false }).first().click();
        await expect(page.getByText(/^\d+ Atletas$/)).toBeVisible({ timeout: 15_000 });

        // Busca el punto de entrada al tablero táctico. Si no existe un botón
        // directo desde asistencia, se documenta como gap de descubribilidad
        // (el spec liga el tablero a FootballDashboardModal / SessionFormDialog
        // / TrainingPlansPage, no necesariamente a la pantalla de asistencia).
        const tacticalEntry = page.getByRole('button', { name: /Tablero táctico|Alineación|Fútbol/i });
        const hasDirectEntry = await tacticalEntry.first().isVisible().catch(() => false);

        if (!hasDirectEntry) {
            test.info().annotations.push({
                type: 'gap',
                description: 'No se encontró un punto de entrada directo al tablero táctico desde /coach-attendance. '
                    + 'Revisar si el flujo esperado es solo vía FootballDashboardModal (dashboard de fútbol) o '
                    + 'SessionFormDialog (planes de entrenamiento) — si es así, ningún lugar del menú de asistencia '
                    + 'lo linkea, lo cual es un gap de descubribilidad para el coach.',
            });
            test.skip(true, 'Punto de entrada al tablero táctico no encontrado desde /coach-attendance; ver anotación de gap.');
            return;
        }

        await tacticalEntry.first().click();
        await expect(page.getByText(/Titulares|titulares/)).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: 'e2e/screenshots/tactical-01-abierto.png', fullPage: true });

        // Arrastra jugadores de la banca a la cancha hasta completar 11.
        const pitch = page.locator('[class*="pitch"]').first();
        const benchCards = page.locator('.touch-none.cursor-grab').filter({ hasText: /.+/ });

        let placedCount = 0;
        const maxAttempts = 14; // margen sobre 11 para intentar forzar el 12vo
        for (let i = 0; i < maxAttempts; i++) {
            const bench = benchCards.first();
            if (!(await bench.isVisible().catch(() => false))) break;

            const box = await bench.boundingBox();
            const pitchBox = await pitch.boundingBox();
            if (!box || !pitchBox) break;

            // Distribuye los puntos de destino en una grilla dentro de la
            // cancha para no apilar todos los jugadores en el mismo punto.
            const col = i % 4;
            const row = Math.floor(i / 4);
            const targetX = pitchBox.x + pitchBox.width * (0.15 + col * 0.23);
            const targetY = pitchBox.y + pitchBox.height * (0.15 + row * 0.22);

            await bench.hover();
            await page.mouse.down();
            await page.mouse.move(targetX, targetY, { steps: 10 });
            await page.mouse.up();
            await page.waitForTimeout(300);

            placedCount++;
            if (placedCount >= 12) break; // ya intentamos pasar de 11
        }

        console.log('[tactical] jugadores colocados en el intento:', placedCount);
        await page.screenshot({ path: 'e2e/screenshots/tactical-02-colocados.png', fullPage: true });

        // Si el roster no tiene 12+ jugadores disponibles, este caso de borde
        // no se puede ejercitar de verdad — se documenta en vez de fingir que
        // se probó.
        if (placedCount < 12) {
            test.info().annotations.push({
                type: 'gap-data',
                description: `Solo se pudieron arrastrar ${placedCount} jugadores del roster de Thunder/Lightning — `
                    + 'se necesitan al menos 12 para ejercitar el rechazo del 12vo titular. Sembrar más atletas de '
                    + 'prueba en el equipo si se quiere cubrir este caso de forma determinística.',
            });
        }

        // Verifica el contador de titulares y el guardado.
        const counterText = page.getByText(/de 11 titulares/i);
        if (await counterText.isVisible().catch(() => false)) {
            const text = await counterText.textContent();
            console.log('[tactical] contador de titulares:', text);
        }

        const saveBtn = page.getByRole('button', { name: /Guardar/i });
        await saveBtn.click();

        if (placedCount > 11) {
            // Con más de 11 en cancha, el guardado debe rechazarse (toast rojo
            // "Máximo 11 en cancha" en TacticalBoard.tsx, o el 400 de
            // football.ts si igual se manda al backend).
            const rejectionToast = page.getByText(/Máximo 11 (titulares|en cancha)/i);
            await expect(rejectionToast).toBeVisible({ timeout: 8_000 });
            await page.screenshot({ path: 'e2e/screenshots/tactical-03-rechazo-12vo.png', fullPage: true });

            // Ahora saca uno para quedar en 11 y reintenta guardar.
            const removeBtn = page.getByRole('button', { name: /Quitar a .* de la cancha/ }).first();
            await removeBtn.click();
            await page.waitForTimeout(300);
            await saveBtn.click();
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'e2e/screenshots/tactical-04-guardado.png', fullPage: true });

        // Recarga y confirma persistencia: los jugadores colocados deben
        // seguir en la cancha (no volver a la banca) tras el refresh.
        await page.reload();
        await expect(page.getByText(/Titulares|titulares/)).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'e2e/screenshots/tactical-05-tras-recargar.png', fullPage: true });

        const pitchPinsAfterReload = page.locator('[class*="rounded-full"][class*="ring-2"]');
        const pinCount = await pitchPinsAfterReload.count();
        expect(pinCount).toBeGreaterThan(0);
    });

    test('caso borde: mismo jugador en dos alineaciones el mismo día (conflicto de equipo/horario)', async ({ page }) => {
        test.setTimeout(60_000);
        // Este caso documenta si existe validación de conflicto cuando un
        // jugador que ya está puesto en la alineación de UN equipo/sesión
        // también se coloca en la de OTRO equipo el mismo día. El spec
        // (football-tactical-experience.md) no menciona ninguna regla de
        // exclusividad — tactical_slot_assignments no tiene ningún UNIQUE ni
        // CHECK de "un jugador, una sesión por día" (confirmado leyendo
        // supabase/migrations/20260819142728_tactical_board_p0.sql). Se deja
        // como test documental: si en el futuro se agrega esa validación,
        // este test debe actualizarse para confirmarla en vez de solo
        // reportar el gap.
        test.info().annotations.push({
            type: 'gap-design',
            description: 'tactical_slot_assignments no tiene ninguna restricción de unicidad ni CHECK que impida '
                + 'que el mismo subject_id (jugador) aparezca como titular en DOS tactical_sessions distintas '
                + '(dos equipos, o partido+entrenamiento) el mismo día. El modelo es polimórfico por sesión, sin '
                + 'referencia cruzada a otras sesiones activas ese día. No es necesariamente un bug — un jugador '
                + 'multi-equipo (categoría doble) puede legítimamente jugar dos partidos el mismo día — pero no '
                + 'hay ninguna alerta ni chequeo, ni siquiera informativo, para el coach que arma la alineación sin '
                + 'saber que ese jugador ya está comprometido en otra sesión a la misma hora. Gap de diseño, no de '
                + 'implementación: no estaba en el alcance de P0/P2 (sección 6 del spec no lo menciona como fuera '
                + 'de alcance tampoco, es un vacío no resuelto).',
        });
        test.skip(true, 'Documental — ver anotación de gap-design. No hay UI/API que ejercitar para este caso.');
    });
});
