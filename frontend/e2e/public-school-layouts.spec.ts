// frontend/e2e/public-school-layouts.spec.ts
//
// E2E de docs/specs/perfil-publico-plantillas.md: el perfil público de la
// escuela (/s/:slug) debe renderizar el layout que la escuela eligió
// (schools.public_page_layout) sin romper los datos reales (equipos,
// instalaciones, servicios, entrenadores) que ya consulta
// schoolsAPI.getSchoolBySlug() en cualquiera de los 4 layouts.
//
// Fixture: la escuela demo "Club Campestre Demo" (is_demo=true, slug
// club-campestre-demo) — nunca un tenant real. El valor de
// public_page_layout se cambia vía SQL fuera de este archivo (no hay
// service_role key en el entorno de Playwright) antes de correr el test
// parametrizado; ver PLAYWRIGHT_SCHOOL_LAYOUT.

import { test, expect } from '@playwright/test';

const DEMO_SLUG = process.env.PLAYWRIGHT_DEMO_SCHOOL_SLUG || 'club-campestre-demo';

test('perfil público de la escuela demo carga (layout default = classic)', async ({ page }) => {
    await page.goto(`/s/${DEMO_SLUG}`);

    // Sin sesión: la página debe cargar sin loguearse y sin "Escuela no encontrada".
    await expect(page.getByText('Escuela no encontrada')).not.toBeVisible();
    await expect(page.locator('[data-layout]')).toBeVisible({ timeout: 15_000 });
});

test('el layout configurado en DB se refleja en /s/:slug', async ({ page }) => {
    const expectedLayout = process.env.PLAYWRIGHT_SCHOOL_LAYOUT;
    test.skip(!expectedLayout, 'Requiere PLAYWRIGHT_SCHOOL_LAYOUT (classic|modern|minimal|magazine)');

    await page.goto(`/s/${DEMO_SLUG}`);

    const root = page.locator(`[data-layout="${expectedLayout}"]`);
    await expect(root, `Se esperaba el layout "${expectedLayout}" pero no está en el DOM`).toBeVisible({ timeout: 15_000 });

    // Ningún otro layout debe estar montado a la vez.
    const allLayoutRoots = await page.locator('[data-layout]').count();
    expect(allLayoutRoots, 'Solo un layout debe estar montado').toBe(1);

    // El mismo dato real (nombre de la escuela) debe aparecer sin importar
    // el layout — la "conexión" no cambia entre plantillas.
    await expect(page.getByRole('heading', { name: /Club Campestre/i })).toBeVisible();
});
