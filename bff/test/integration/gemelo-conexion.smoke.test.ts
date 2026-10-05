// Humo de integracion: el BFF llega al GEMELO LOCAL y la semilla QA esta cargada.
// Plantilla para las pruebas de concurrencia de tienda v2 §8.3 / contabilidad v2 §8.5
// (dos conexiones `pg` reales con COMMIT, solo posibles en el gemelo).
//
//   cd bff && npx vitest run -c vitest.integration.config.ts
//
// La guarda test/guard-no-prod.ts ya corrio como globalSetup; aca se repite
// sobre la cadena que se va a usar, por si alguien la cambia en el test.
import { describe, it, expect, afterAll } from 'vitest';
import { Client } from 'pg';
import { assertNotProduction } from '../guard-no-prod';

const DB_URL = process.env.QA_TWIN_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

describe('gemelo local', () => {
    assertNotProduction({ ...process.env, QA_TWIN_DB_URL: DB_URL }, null);
    if (!/@(127\.0\.0\.1|localhost):/.test(DB_URL)) throw new Error('QA_TWIN_DB_URL debe ser localhost');

    const db = new Client({ connectionString: DB_URL });
    afterAll(() => db.end());

    it('responde y tiene la semilla QA', async () => {
        await db.connect();
        const meta = await db.query('select count(*)::int n from qa_twin.meta');
        expect(meta.rows[0].n).toBeGreaterThan(0);
        const actores = await db.query('select count(*)::int n from qa_twin.actores');
        // 10 de la semilla base; las semillas adicionales (p. ej. qa_twin_monster_seed.sql)
        // suman actores propios, así que se exige la base, no el total exacto.
        expect(actores.rows[0].n).toBeGreaterThanOrEqual(10);
    });
});
