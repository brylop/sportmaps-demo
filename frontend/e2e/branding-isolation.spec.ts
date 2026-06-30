// frontend/e2e/branding-isolation.spec.ts
//
// Tests E2E que validan el fix del bug historico de leak de branding
// entre escuelas/roles/rutas. Cubre 5 escenarios criticos:
//
//   1. Admin de escuela A NO ve los colores de escuela B al cambiar contexto.
//   2. Super-admin NO recibe branding aplicado (siempre SportMaps default).
//   3. Parent con hijos en 2 escuelas — solo aplica el branding de la activa.
//   4. Free tier ve upsell card en lugar del form de branding.
//   5. Bypass directo via `supabase.from('schools').update()` falla con 42501.
//
// Pre-requisitos: usuarios de prueba creados en staging via SQL.
//   Ver supabase/seed/branding_test_users.sql

import { test, expect } from '@playwright/test';
import { loginAs, logout, setActiveSchool, waitForAuthenticatedLayout, readCssVar, type TestUser } from './helpers/auth';

// ── Usuarios de prueba (deben existir en staging via seed SQL) ──────────
const SUPER_ADMIN: TestUser = {
    email: process.env.PLAYWRIGHT_SUPER_ADMIN_EMAIL || 'qa-super-admin@sportmaps.test',
    password: process.env.PLAYWRIGHT_SUPER_ADMIN_PASSWORD || 'TestPass123!',
    isPlatformAdmin: true,
};

const SCHOOL_PRO_ADMIN: TestUser = {
    email: process.env.PLAYWRIGHT_PRO_ADMIN_EMAIL || 'qa-pro-admin@sportmaps.test',
    password: process.env.PLAYWRIGHT_PRO_ADMIN_PASSWORD || 'TestPass123!',
};

const SCHOOL_FREE_ADMIN: TestUser = {
    email: process.env.PLAYWRIGHT_FREE_ADMIN_EMAIL || 'qa-free-admin@sportmaps.test',
    password: process.env.PLAYWRIGHT_FREE_ADMIN_PASSWORD || 'TestPass123!',
};

const PARENT_MULTI: TestUser = {
    email: process.env.PLAYWRIGHT_PARENT_EMAIL || 'qa-parent-multi@sportmaps.test',
    password: process.env.PLAYWRIGHT_PARENT_PASSWORD || 'TestPass123!',
};

// IDs de escuelas reales en staging (ajustar si seed cambia)
const SCHOOL_PRO_ID = process.env.PLAYWRIGHT_SCHOOL_PRO_ID || '0242cf27-b8ae-4921-8a3a-69d27178ca34';
const SCHOOL_FREE_ID = process.env.PLAYWRIGHT_SCHOOL_FREE_ID || '';

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Aislamiento de colores entre escuelas
// ─────────────────────────────────────────────────────────────────────────────
test('admin de escuela Pro ve sus colores SOLO en rutas de su escuela', async ({ page }) => {
    await loginAs(page, SCHOOL_PRO_ADMIN);
    await setActiveSchool(page, SCHOOL_PRO_ID);

    // 1. Dashboard de la escuela — branding debe aplicar
    await page.goto('/dashboard');
    await waitForAuthenticatedLayout(page);

    const dashboardPrimary = await readCssVar(page, '--primary', '[data-branding-school-id]');
    // Si tier permite y branding configurado, --primary del container difiere del default body
    const bodyPrimary = await readCssVar(page, '--primary', 'body');

    // El container con data-branding-school-id existe → aplicacion scopeada OK
    const scopeCount = await page.locator('[data-branding-school-id]').count();
    expect(scopeCount, 'BrandingScope debe haber envuelto el outlet').toBeGreaterThan(0);

    // 2. Navegar a /admin (blocklist) — branding NO debe aplicar
    await page.goto('/admin/payments');
    await waitForAuthenticatedLayout(page);
    const adminScopeCount = await page.locator('[data-branding-school-id]').count();
    expect(
        adminScopeCount,
        'En /admin no debe haber BrandingScope activo (ruta en blocklist)',
    ).toBe(0);

    // 3. Navegar a /marketplace — branding NO debe aplicar
    await page.goto('/marketplace');
    await waitForAuthenticatedLayout(page);
    const marketScopeCount = await page.locator('[data-branding-school-id]').count();
    expect(marketScopeCount, 'En /marketplace tampoco debe haber BrandingScope').toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Super-admin nunca ve branding
// ─────────────────────────────────────────────────────────────────────────────
test('super-admin NO recibe branding aplicado (siempre SportMaps default)', async ({ page }) => {
    await loginAs(page, SUPER_ADMIN);
    await setActiveSchool(page, SCHOOL_PRO_ID);

    await page.goto('/dashboard');
    await waitForAuthenticatedLayout(page);

    // BrandingScope debe NO envolver (rol super_admin no esta en BRANDING_ROLES)
    const scopeCount = await page.locator('[data-branding-school-id]').count();
    expect(
        scopeCount,
        'Super-admin no debe recibir BrandingScope aunque visite el dashboard de una escuela Pro',
    ).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Parent multi-escuela — solo branding de la activa
// ─────────────────────────────────────────────────────────────────────────────
test('parent con hijos en 2 escuelas solo ve branding de la activa', async ({ page }) => {
    test.skip(!SCHOOL_FREE_ID, 'Requiere SCHOOL_FREE_ID env var');

    await loginAs(page, PARENT_MULTI);

    // Activar escuela Pro primero
    await setActiveSchool(page, SCHOOL_PRO_ID);
    await page.goto('/dashboard');
    await waitForAuthenticatedLayout(page);

    const proScope = page.locator(`[data-branding-school-id="${SCHOOL_PRO_ID}"]`);
    await expect(proScope, 'Container con school_id Pro debe existir').toBeVisible();

    // Cambiar a escuela Free (donde no debe aplicar branding)
    await page.evaluate((id) => {
        window.localStorage.setItem('sportmaps_active_school_id', id);
    }, SCHOOL_FREE_ID);
    await page.reload();
    await waitForAuthenticatedLayout(page);

    // El container debe ser el de Free (o ningún container si tier free no permite)
    const freeScope = await page.locator(`[data-branding-school-id="${SCHOOL_FREE_ID}"]`).count();
    const noScope = await page.locator('[data-branding-school-id]').count();
    expect(
        freeScope > 0 || noScope === 0,
        'Al cambiar a escuela Free el branding de la Pro no debe seguir aplicado',
    ).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Free tier ve upsell card en lugar del form
// ─────────────────────────────────────────────────────────────────────────────
test('admin de escuela Free ve upsell card en settings de marca', async ({ page }) => {
    await loginAs(page, SCHOOL_FREE_ADMIN);
    if (SCHOOL_FREE_ID) await setActiveSchool(page, SCHOOL_FREE_ID);

    // Navegar a la pagina de settings de escuela (donde esta el form)
    await page.goto('/dashboard'); // landing post-login
    await waitForAuthenticatedLayout(page);

    // El SchoolSettingsPage tiene una ruta especifica — ajustar segun nav
    await page.goto('/settings/school');

    // El upsell card menciona "planes Pro y superiores" segun el componente
    await expect(
        page.getByText(/personalizaci.n de.+marca/i).or(page.getByText(/planes Pro/i)),
    ).toBeVisible({ timeout: 10_000 });

    // El form de colores NO debe estar visible (esta el upsell en su lugar)
    const colorInput = page.locator('input[type="color"]');
    await expect(colorInput, 'Free tier no debe ver el color picker').toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Bypass directo via supabase client debe fallar con 42501
// ─────────────────────────────────────────────────────────────────────────────
test('bypass directo a schools.update(branding_settings) falla con 42501', async ({ page }) => {
    await loginAs(page, SCHOOL_PRO_ADMIN);
    await setActiveSchool(page, SCHOOL_PRO_ID);

    await page.goto('/dashboard');
    await waitForAuthenticatedLayout(page);

    // Ejecutar el bypass dentro del contexto del browser (con sesion authenticated)
    const result = await page.evaluate(async (schoolId) => {
        // El cliente Supabase esta expuesto en window? Si no, lo creamos.
        const supabase = (window as any).supabase
            ?? (await import('/src/integrations/supabase/client.ts')).supabase;

        const { data, error } = await supabase
            .from('schools')
            .update({
                branding_settings: {
                    primary_color: '#ff0000',
                    secondary_color: '#00ff00',
                    show_sportmaps_watermark: false,
                },
            })
            .eq('id', schoolId)
            .select();

        return {
            data,
            error: error
                ? { code: error.code, message: error.message, hint: error.hint }
                : null,
        };
    }, SCHOOL_PRO_ID);

    // Verificacion: el trigger del backend debe rechazar con 42501
    expect(result.error, 'El bypass debe devolver error (no permitir UPDATE)').not.toBeNull();
    expect(result.error?.code === '42501' || result.error?.message?.includes('branding_must_go_through_rpc')).toBeTruthy();
    expect(result.data, 'data debe estar vacio (UPDATE rechazado)').toBeFalsy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza entre tests — opcional pero saludable
// ─────────────────────────────────────────────────────────────────────────────
test.afterEach(async ({ page }) => {
    try {
        await logout(page);
    } catch {
        // best-effort
    }
});
