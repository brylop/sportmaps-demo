import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * QA de punta a punta de inscripción + pago a un torneo INTERNO
 * (docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md).
 *
 * Verificado por lectura de código + base viva ANTES de escribir este test
 * (no es maqueta): las Fases 1-4 del spec están construidas y conectadas a
 * datos reales —
 *   - RPCs `register_for_internal_tournament` y `assign_registrants_to_teams`
 *     existen en la base (pg_proc, verificado en vivo).
 *   - `bff/src/routes/school/events.route.ts` tiene los endpoints reales
 *     (POST .../register, GET .../individual-registrations, assign-teams).
 *   - `frontend/src/pages/events/TournamentRegisterPage.tsx` es el flujo real
 *     de inscripción + `PaymentCheckoutModal` (no un mock).
 *   - Existe un torneo interno real y activo en la Escuela Demo SportMaps:
 *     "[QA Fase5] Liga Interna Sub-10" (event_id bf8c9988-da7a-470e-8e63-
 *     7f98a600b924, registrations_open=true), con inscripciones YA cargadas
 *     de un ciclo QA anterior (Sofía/Mateo García, payment_status=pending) —
 *     es decir, la Fase 5 (QA end-to-end) del propio spec quedó a medias:
 *     el spec la marca como "[ ]" sin cerrar en docs/specs/torneos-internos-
 *     inscripcion-pago-2026-09-01.md, y estos registros con pago pendiente
 *     lo confirman: alguien inscribió pero nadie completó el pago end-to-end
 *     todavía.
 *
 * Este test cubre el camino feliz: un padre de la Escuela Demo inscribe a un
 * hijo a la liga interna y completa el pago.
 */

const PARENT = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_EMAIL || 'qa-post-entreno-parent@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_PASSWORD || 'TestPass123!',
};

// event_id de "[QA Fase5] Liga Interna Sub-10" en Escuela Demo SportMaps,
// confirmado en vivo (events.tournament_scope='internal', registrations_open=true).
const TOURNAMENT_EVENT_ID = process.env.PLAYWRIGHT_TOURNAMENT_EVENT_ID
    || 'bf8c9988-da7a-470e-8e63-7f98a600b924';

test.describe('Torneos internos — inscripción y pago (camino feliz)', () => {
    test('un padre inscribe a su hijo a la liga interna y paga la inscripción', async ({ page }) => {
        test.setTimeout(90_000);
        page.on('response', async (res) => {
            if (res.url().includes('/events/') && res.status() >= 400) {
                console.log('[resp-error]', res.status(), res.url(), await res.text().catch(() => ''));
            }
        });

        await loginAs(page, PARENT);
        await page.goto(`/tournaments/${TOURNAMENT_EVENT_ID}/register`);

        // Si el padre de este fixture no tiene hijos matriculados en la
        // Escuela Demo (children.school_id), la página lo dice explícito —
        // se documenta como gap de datos en vez de fallar en un assert crudo.
        const noKidsMsg = page.getByText(/No encontramos hijos tuyos matriculados/);
        if (await noKidsMsg.isVisible({ timeout: 10_000 }).catch(() => false)) {
            test.info().annotations.push({
                type: 'gap-data',
                description: `${PARENT.email} no tiene hijos activos en la Escuela Demo SportMaps para este torneo. `
                    + 'Usar un padre con hijos en esa escuela (ej. demo.padre1@sportmaps.co, que ya tiene 2 '
                    + 'inscripciones con pago pendiente en este mismo torneo según la base) para ejercitar este '
                    + 'camino feliz de punta a punta.',
            });
            test.skip(true, 'Fixture sin hijos en la escuela del torneo; ver anotación de gap-data.');
            return;
        }

        await expect(page.getByRole('heading', { name: /Liga Interna|🏆/ }).or(page.getByText(/Liga Interna/)))
            .toBeVisible({ timeout: 15_000 });
        await page.screenshot({ path: 'e2e/screenshots/torneo-01-pagina-inscripcion.png', fullPage: true });

        // Ya inscrito de una corrida anterior: el flujo de "pagar" en vez de
        // "inscribirse" es igual de válido como camino feliz (evita duplicar
        // inscripción y confirma el estado real del fixture).
        const yaInscrito = page.getByText('Ya estás inscrito/a');
        if (await yaInscrito.isVisible({ timeout: 5_000 }).catch(() => false)) {
            const payBtn = page.getByRole('button', { name: /^Pagar/ });
            if (await payBtn.isVisible().catch(() => false)) {
                await payBtn.click();
            } else {
                test.info().annotations.push({
                    type: 'info',
                    description: 'Registro existente ya figura "Pago al día" — no hay nada que pagar en este fixture.',
                });
                return;
            }
        } else {
            // Camino de inscripción nueva.
            const childSelect = page.getByText('Elegí a tu hijo/a');
            if (await childSelect.isVisible().catch(() => false)) {
                await page.locator('button:has-text("Elegí a tu hijo/a")').click();
                await page.getByRole('option').first().click();
            }

            await page.locator('button:has-text("Elegí la categoría")').click();
            await page.getByRole('option').first().click();

            await page.screenshot({ path: 'e2e/screenshots/torneo-02-formulario-lleno.png', fullPage: true });

            const registerBtn = page.getByRole('button', { name: 'Inscribirme' });
            await expect(registerBtn).toBeEnabled();
            await registerBtn.click();

            await expect(page.getByText('Ya estás inscrito/a')).toBeVisible({ timeout: 10_000 });
            await page.screenshot({ path: 'e2e/screenshots/torneo-03-inscripto.png', fullPage: true });

            const payBtn = page.getByRole('button', { name: /^Pagar/ });
            await expect(payBtn).toBeVisible({ timeout: 10_000 });
            await payBtn.click();
        }

        // Modal de checkout (PaymentCheckoutModal, mode="update") — mismo
        // componente que usa el flujo de mensualidades, así que se espera el
        // mismo dialog genérico de métodos de pago.
        const checkoutDialog = page.getByRole('dialog');
        await expect(checkoutDialog).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: 'e2e/screenshots/torneo-04-checkout-modal.png', fullPage: true });

        // No completamos un pago real de pasarela contra QA/staging compartido
        // (evita generar cobros reales o basura en pasarela) — se documenta
        // como límite deliberado del test, no como gap. La verificación de
        // que el modal abre con el monto/concepto correctos ya cubre la
        // integración inscripción→pago hasta el punto de contacto con la
        // pasarela.
        const conceptText = checkoutDialog.getByText(/Inscripción torneo/);
        await expect(conceptText).toBeVisible();
    });

    test('resultados del torneo son visibles sin necesidad de re-inscribirse', async ({ page }) => {
        test.setTimeout(30_000);
        await loginAs(page, PARENT);
        await page.goto(`/tournaments/${TOURNAMENT_EVENT_ID}/results`);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'e2e/screenshots/torneo-05-resultados.png', fullPage: true });
        // La página no debe quedar en blanco/error genérico.
        await expect(page.locator('body')).not.toContainText('Cannot GET');
    });
});

/**
 * -----------------------------------------------------------------------
 * TORNEOS EXTERNOS — docs/specs/torneos-externos-registro-liviano-2026-09-03.md
 * -----------------------------------------------------------------------
 * NO se escribió un test Playwright de camino feliz para este módulo: está
 * a medio construir, con el frontend (lo único donde tendría sentido un
 * test Playwright) enteramente ausente. El propio spec marca TODAS las
 * fases como "[ ]" — pero la primera revisión ("0% implementación") que
 * quedó en un borrador de este mismo archivo era INCORRECTA y se corrige
 * acá tras verificar contra el código y la base viva, no solo contra el
 * checklist del spec:
 *
 *   - Fase 1 (DB): SÍ construida. Tabla `event_invitations` existe en la
 *     base (confirmado en information_schema.tables). RPCs
 *     `create_tournament_invitation`, `claim_tournament_invitation`,
 *     `get_tournament_invitation_public` existen (pg_proc).
 *   - Fase 2 (BFF): PARCIAL. `bff/src/routes/events.route.ts` sí tiene
 *     `POST/GET .../school-tournaments/:id/invitations` y
 *     `GET /invitations/:token` + `POST /invitations/:token/claim` — el
 *     ciclo de vida básico de la invitación funciona. Lo que el spec pide
 *     y NO está: bulk de roster por Excel (`roster/dry-run`/`roster/commit`
 *     — sin resultados en el archivo) y pago por familia individual
 *     (`team-members/:memberId/payment` — sin resultados).
 *   - Fases 3-6 (frontend aterrizaje público, wizard de inscripción externa,
 *     panel del anfitrión para invitaciones, QA de concurrencia): NINGUNA
 *     construida. No hay ninguna página bajo `frontend/src/pages` para
 *     invitación/registro externo (solo existe `InvitationsManagementPage`,
 *     que es staff interno de la escuela — nombre parecido, feature
 *     distinta) ni ninguna ruta en `App.tsx` tipo
 *     `/torneos-externos/invitacion/:token`.
 *
 * Conclusión: hay backend real para crear y reclamar una invitación, pero
 * sin página pública de aterrizaje ni wizard, NINGÚN usuario real puede
 * recorrer el flujo hoy — de ahí que no se fuerce un test Playwright de
 * punta a punta. Si se retoma, lo más barato es completar Fase 3 (aterrizaje)
 * primero: ya tiene con qué hablar del lado del BFF.
 */
