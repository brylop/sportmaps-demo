// Suite e2e de la pizarra táctica, contra un dev server propio en 3017 (no el
// 3001 de playwright.config.ts: así corre aunque haya otro frontend arriba).
//
//   # credenciales de lectura (las mismas del frontend/.env del repo principal)
//   export PLAYWRIGHT_SUPABASE_URL=<VITE_SUPABASE_URL>
//   export PLAYWRIGHT_SUPABASE_ANON_KEY=<VITE_SUPABASE_PUBLISHABLE_KEY>
//   npx playwright test -c playwright.pizarra.config.ts
//
// Levanta `vite --port 3017` si no hay nada en ese puerto (o reutiliza el que
// esté). Si lo levantas a mano, ciérralo al final: en Windows
// `taskkill /T /F /PID <pid>`. Ninguna prueba escribe en la base: la red
// anti-escrituras de e2e/helpers/pizarra.ts aborta y hace fallar cualquier
// escritura sin mock. Otro puerto: PIZARRA_PORT=3018.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PIZARRA_PORT) || 3017;

export default defineConfig({
    testDir: './e2e',
    testMatch: [
        'tactical-board-animacion.spec.ts',
        'tactical-board-biblioteca.spec.ts',
        'tactical-board-escribir.spec.ts',
        'pizarra-por-deporte.spec.ts',
        'pizarra-paquetes.spec.ts',
        'pizarra-ia-3d.spec.ts',
        'pizarra-ajustes.spec.ts',
    ],
    fullyParallel: false,
    workers: 2,
    retries: 0,
    reporter: [['list']],
    timeout: 240_000,
    use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
