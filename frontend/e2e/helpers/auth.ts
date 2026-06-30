// frontend/e2e/helpers/auth.ts
//
// Helpers de auth para tests E2E. Permite hacer login programatico sin
// pasar por el form (mas rapido y robusto contra cambios de UI).
//
// La estrategia: hacer POST a Supabase /auth/v1/token directamente,
// guardar la session en localStorage en la forma que el cliente Supabase
// espera. Asi el primer page.goto() ya esta logueado.

import { Page, expect } from '@playwright/test';

export interface TestUser {
    email: string;
    password: string;
    /** Schools donde el usuario es miembro y rol esperado */
    memberships?: Array<{ schoolId: string; role: string }>;
    /** Si es super_admin / admin global (sin schools) */
    isPlatformAdmin?: boolean;
}

const SUPABASE_URL = process.env.PLAYWRIGHT_SUPABASE_URL
    || 'https://kbgwjkbqsabnsajdmgxn.supabase.co'; // staging por default
const SUPABASE_ANON_KEY = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY || '';

/**
 * Login programatico. Obtiene un JWT de Supabase y lo planta en localStorage.
 * Usa el formato que @supabase/supabase-js v2 espera para auto-restaurar
 * la sesion al cargar la pagina.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
    if (!SUPABASE_ANON_KEY) {
        throw new Error(
            'PLAYWRIGHT_SUPABASE_ANON_KEY no esta seteado. Exportalo antes de correr los tests:\n' +
            '  export PLAYWRIGHT_SUPABASE_ANON_KEY="eyJ..."',
        );
    }

    // 1. Auth con Supabase (password grant)
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: user.email, password: user.password }),
    });

    if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new Error(`Login failed for ${user.email}: ${tokenRes.status} ${body}`);
    }

    const tokenData = await tokenRes.json();

    // 2. Plantar session en localStorage (formato Supabase v2)
    const projectRef = new URL(SUPABASE_URL).host.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;

    await page.addInitScript(
        ([key, value]) => {
            window.localStorage.setItem(key, value);
        },
        [storageKey, JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            expires_at: tokenData.expires_at,
            token_type: 'bearer',
            user: tokenData.user,
        })],
    );
}

/**
 * Logout — limpia localStorage del cliente Supabase.
 */
export async function logout(page: Page): Promise<void> {
    await page.evaluate(() => {
        Object.keys(window.localStorage)
            .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
            .forEach((k) => window.localStorage.removeItem(k));
        window.localStorage.removeItem('sportmaps_active_school_id');
    });
}

/**
 * Fuerza el contexto de escuela activa (para users multi-school).
 */
export async function setActiveSchool(page: Page, schoolId: string): Promise<void> {
    await page.addInitScript(
        (id) => window.localStorage.setItem('sportmaps_active_school_id', id),
        schoolId,
    );
}

/**
 * Espera que el header del layout autenticado este montado (proxy a "estoy logueado").
 */
export async function waitForAuthenticatedLayout(page: Page): Promise<void> {
    // El sidebar trigger aparece solo si AuthLayout esta montado.
    await expect(page.locator('[data-sidebar="trigger"]').or(page.locator('.sidebar-trigger'))).toBeVisible({
        timeout: 15_000,
    });
}

/**
 * Lee el valor actual del CSS var --primary de un elemento (o del body).
 * Devuelve formato HSL string como lo planta jsPDF (ej. "119 60% 32%")
 * o el formato que aplique BrandingScope.
 */
export async function readCssVar(page: Page, varName: string, selector = 'body'): Promise<string> {
    return page.evaluate(
        ({ v, sel }) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return '';
            return getComputedStyle(el).getPropertyValue(v).trim();
        },
        { v: varName, sel: selector },
    );
}
