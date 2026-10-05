// Vitest de INTEGRACION del BFF: pruebas que tocan una base real (el gemelo
// local, nunca la viva). La guarda test/guard-no-prod.ts corta la corrida si
// SUPABASE_URL apunta a produccion o WOMPI_PUBLIC_KEY es pub_prod_.
//
//   cd bff && npx vitest run -c vitest.integration.config.ts
//
// Las unitarias siguen en vitest.config.ts (src/**/*.test.ts), sin guarda.
// Ver docs/qa-gemelo-local.md.
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/integration/**/*.test.ts'],
        globalSetup: ['./test/guard-no-prod.ts'],
        globals: false,
        passWithNoTests: true,
        // Concurrencia real (dos conexiones con COMMIT): sin paralelismo entre archivos.
        fileParallelism: false,
        testTimeout: 30_000,
    },
});
