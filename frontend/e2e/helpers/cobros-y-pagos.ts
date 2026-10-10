// frontend/e2e/helpers/cobros-y-pagos.ts
//
// Comun a cobros-y-pagos*.spec.ts (docs/specs/cobros-multiples.md F3, §14).
//
// - SOLO Club Campestre Demo: se fija la escuela activa a su id antes de cargar.
// - Sin credenciales (seed supabase/seed/cobros_y_pagos_test_users.sql) → skip.
// - guard-no-prod: si algo apunta a la base de produccion → skip (nunca corre ahi).
// - Enciende el interruptor de «Cobros y pagos» solo en el navegador de la prueba
//   (localStorage), sin tocar el build.
// - Escribe en la base SOLO con PLAYWRIGHT_COBROS_WRITE=1; si no, llega hasta la
//   vista previa y cancela.

import { test, type Page } from '@playwright/test';
import { loginAs, setActiveSchool, type TestUser } from './auth';
import { findProductionTargets } from './guard-no-prod';

export const CAMPESTRE_SCHOOL_ID = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
export const FLAG_STORAGE_KEY = 'sportmaps:cobros-y-pagos';

export const WRITE = process.env.PLAYWRIGHT_COBROS_WRITE === '1';

/** Credenciales por variables de entorno (seed: qa-cobros-admin/coach/parent@sportmaps.test). Sin ellas, null → skip. */
function user(prefix: 'ADMIN' | 'COACH' | 'PARENT'): TestUser | null {
    const email = process.env[`PLAYWRIGHT_COBROS_${prefix}_EMAIL`] || '';
    const password = process.env[`PLAYWRIGHT_COBROS_${prefix}_PASSWORD`] || '';
    return email && password ? { email, password } : null;
}

export const ADMIN = user('ADMIN');
export const COACH = user('COACH');
export const PARENT = user('PARENT');

/** Atleta y equipo de prueba de Campestre (los crea el seed). */
export const ATHLETE_NAME = process.env.PLAYWRIGHT_COBROS_ATHLETE_NAME || 'QA Cobros Hijo';
export const TEAM_NAME = process.env.PLAYWRIGHT_COBROS_TEAM_NAME || '';

/** Salta la prueba si falta algo para correrla con seguridad. */
export function skipUnlessReady(who: TestUser | null, label: string): void {
    test.skip(!process.env.PLAYWRIGHT_SUPABASE_ANON_KEY, 'Falta PLAYWRIGHT_SUPABASE_ANON_KEY');
    test.skip(!who, `Faltan credenciales PLAYWRIGHT_COBROS_${label}_EMAIL / _PASSWORD (seed cobros_y_pagos_test_users.sql)`);
    const prod = findProductionTargets();
    test.skip(prod.length > 0, `guard-no-prod: ${prod.join('; ')}`);
}

/** Login en Campestre con el interruptor encendido en este navegador. */
export async function openAsCampestre(page: Page, who: TestUser): Promise<void> {
    await setActiveSchool(page, CAMPESTRE_SCHOOL_ID);
    await page.addInitScript((key) => window.localStorage.setItem(key, 'on'), FLAG_STORAGE_KEY);
    await loginAs(page, who);
}
