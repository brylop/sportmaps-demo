import { defineConfig, devices } from '@playwright/test';

// Config standalone para QA exploratorio: apunta al dev server YA levantado
// en :3004 y NO intenta levantar uno propio (a diferencia de playwright.config.ts).
export default defineConfig({
    testDir: './e2e/qa-discovery',
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3004',
        trace: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
