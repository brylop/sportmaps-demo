import { defineConfig, devices } from '@playwright/test';

/**
 * Config dedicada para post-entreno.spec.ts.
 *
 * No reusa playwright.config.ts porque ese apunta a lo que sea que resuelva
 * `VITE_BFF_URL` del .env compartido (a veces un túnel ngrok para pruebas
 * desde celular), y el test de informe grupal necesita el BFF LOCAL corriendo
 * en :3000 (CORS del túnel no admite localhost como origen).
 *
 * Uso:
 *   1. cd bff && npm run dev                              (dejar corriendo)
 *   2. cd frontend && VITE_BFF_URL=http://localhost:3000 npm run dev -- --port <PUERTO>
 *   3. PLAYWRIGHT_POST_ENTRENO_BASE_URL=http://localhost:<PUERTO> \
 *      PLAYWRIGHT_SUPABASE_URL=... PLAYWRIGHT_SUPABASE_ANON_KEY=... \
 *      PLAYWRIGHT_POST_ENTRENO_SESSION_ID=... PLAYWRIGHT_POST_ENTRENO_CHILD_ID=... \
 *      npx playwright test --config=playwright.postentreno.config.ts
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'post-entreno.spec.ts',
    fullyParallel: false,
    reporter: 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_POST_ENTRENO_BASE_URL || 'http://localhost:3001',
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
