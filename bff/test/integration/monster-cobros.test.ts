// Integración contra el GEMELO LOCAL — escuela tipo Monster´s Volley Club
// (supabase/seed/qa_twin_monster_seed.sql; informe docs/qa/monster-prelanzamiento-2026-10-05.md).
//
//   H-06  El aviso de cobro / estado de cuenta de una ficha MENOR va al correo y
//         teléfono del ACUDIENTE (lecturas reales por PostgREST, con las columnas
//         que de verdad pide el código).
//   H-08  Asignar un PLAN desde el editor (PUT /students/:id, ruta real) a una
//         inscripción de solo equipo emite la mensualidad y NO escribe un
//         vencimiento que el cron convierta en cancelación.
//
// Escribe en el gemelo (la ruta usa el cliente service-role, no hay transacción
// que revertir) y deja todo como estaba en afterAll/afterEach.
//
//   cd bff
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<twin> SUPABASE_ANON_KEY=<twin> \
//   WOMPI_PUBLIC_KEY=pub_test_x PUBLIC_API_URL=http://127.0.0.1:3000 \
//     npx vitest run -c vitest.integration.config.ts test/integration/monster-cobros.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { assertNotProduction } from '../guard-no-prod';

const DB_URL = process.env.QA_TWIN_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
assertNotProduction({ ...process.env, QA_TWIN_DB_URL: DB_URL }, null);
if (!/@(127\.0\.0\.1|localhost):/.test(DB_URL)) throw new Error('QA_TWIN_DB_URL debe ser localhost');
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(process.env.SUPABASE_URL ?? '')) {
    throw new Error('SUPABASE_URL debe apuntar al gemelo local (npm run qa:twin:status)');
}

const SCHOOL = '00000000-0000-4000-b000-000000000003';
const OWNER = '00000000-0000-4000-a000-0000000000f1';
const TEAM = '00000000-0000-4000-e000-0000000000f1';
const PLAN = '00000000-0000-4000-e000-0000000000f3';
const ISA = '00000000-0000-4000-c000-0000000000f1';
const ENR_ISA = '00000000-0000-4000-e000-0000000000a1';

vi.mock('../../src/middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.schoolId = SCHOOL;
        req.role = 'owner';
        req.user = { id: OWNER, email: 'owner.monster@qa.sportmaps.test' };
        next();
    },
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const db = new Client({ connectionString: DB_URL });
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

async function limpiarCobrosMonster() {
    await db.query('delete from public.payments where school_id = $1', [SCHOOL]);
}

beforeAll(async () => {
    await db.connect();
    const { rows } = await db.query('select count(*)::int n from public.unregistered_athletes where school_id = $1', [SCHOOL]);
    if (rows[0].n !== 3) throw new Error('Falta la semilla Monster: docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres < supabase/seed/qa_twin_monster_seed.sql');
    await limpiarCobrosMonster();
});

afterEach(async () => {
    await limpiarCobrosMonster();
    await db.query(
        `update public.enrollments
            set offering_plan_id = null, monthly_fee = 145000, expires_at = null, start_date = '2026-08-26',
                status = 'active', end_date = null, fee_is_manual = false, fee_reason = null, discount_type = null,
                fee_set_by = null, fee_set_at = null
          where id = $1`, [ENR_ISA]);
    await db.query(
        `update public.unregistered_athletes
            set email = 'isa.florian.atleta@qa.sportmaps.test', phone = '3001110001',
                guardian_email = 'zr.plata.qa@qa.sportmaps.test', guardian_phone = '3002220001',
                full_name = 'Isabella Florian QA'
          where id = $1`, [ISA]);
});

afterAll(async () => {
    await db.end();
});

describe('H-06 · el aviso de cobro de una ficha menor va al acudiente', () => {
    it('cron del aviso y estado de cuenta: correo/teléfono del acudiente, hermanas en UNA familia', async () => {
        const hoy = hoyBogota();
        await db.query('select public.open_month($1, $2, $3)', [SCHOOL, Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))]);

        const { resolveContacts } = await import('../../src/jobs/payment-lifecycle-emails.job');
        const { familiasConDeuda } = await import('../../src/services/estado-de-cuenta.service');

        const { rows: pagos } = await db.query(
            `select id, school_id, amount, due_date::text, concept, parent_id, child_id, user_id,
                    unregistered_athlete_id, period_year, period_month
               from public.payments where school_id = $1 and status = 'pending'`, [SCHOOL]);
        expect(pagos).toHaveLength(3);

        const contactos = await resolveContacts(pagos as any);
        const porFicha = new Map(pagos.map((p: any) => [p.unregistered_athlete_id, contactos.get(p.id)!]));

        const isa = porFicha.get(ISA)!;
        expect(isa.contactEmail).toBe('zr.plata.qa@qa.sportmaps.test');
        expect(isa.contactPhone).toBe('3002220001');
        expect(isa.contactName).toBe('Zulma Plata QA');
        expect(isa.athleteName).toBe('Isabella Florian QA');

        const salo = porFicha.get('00000000-0000-4000-c000-0000000000f2')!;
        expect(salo.contactEmail).toBe('zr.plata.qa@qa.sportmaps.test');

        // El adulto se paga solo.
        const andres = porFicha.get('00000000-0000-4000-c000-0000000000f3')!;
        expect(andres.contactEmail).toBe('andres.adulto@qa.sportmaps.test');
        expect(andres.contactPhone).toBe('3001110003');

        // Estado de cuenta mensual: las dos hermanas → una familia (la acudiente).
        const { familias, sinContacto } = await familiasConDeuda(SCHOOL, new Date());
        expect(sinContacto).toBe(0);
        const correos = familias.map((f) => f.email).sort();
        expect(correos).toEqual(['andres.adulto@qa.sportmaps.test', 'zr.plata.qa@qa.sportmaps.test']);
        const familiaFlorian = familias.find((f) => f.email === 'zr.plata.qa@qa.sportmaps.test')!;
        expect(familiaFlorian.filas).toHaveLength(2);
        expect(familias.some((f) => (f.email ?? '').includes('atleta'))).toBe(false);
    });
});

describe('H-08 · asignar un plan desde el editor', () => {
    async function put(body: any) {
        const { default: router } = await import('../../src/routes/students');
        const app = express();
        app.use(express.json());
        app.use('/api/v1/students', router);
        const server = http.createServer(app);
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
        const port = (server.address() as AddressInfo).port;
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/${ISA}`, {
                method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            });
            return { status: res.status, json: await res.json() as any };
        } finally {
            server.close();
        }
    }

    it('inscripción de solo equipo + plan → emite la mensualidad del plan y no pone expires_at', async () => {
        const hoy = hoyBogota();
        // Payload EXACTO del editor (SchoolStudentsManagementPage.updateStudentMutation).
        const r = await put({
            athlete_type: 'unregistered',
            profile: { full_name: 'Isabella Florian QA' },
            enrollment: {
                team_id: TEAM, offering_plan_id: PLAN,
                team_start_date: '2026-08-26', plan_start_date: null,
                team_monthly_fee: 0, plan_monthly_fee: null,
                fee_is_manual: false, fee_reason: null, discount_type: null,
            },
        });
        expect(r.status).toBe(200);

        const { rows: enr } = await db.query(
            `select status, offering_plan_id, team_id, expires_at from public.enrollments
              where unregistered_athlete_id = $1 and status = 'active'`, [ISA]);
        expect(enr).toHaveLength(1);
        expect(enr[0].offering_plan_id).toBe(PLAN);
        expect(enr[0].team_id).toBe(TEAM);
        expect(enr[0].expires_at).toBeNull();

        const { rows: cobros } = await db.query(
            `select amount::numeric::int as amount, offering_plan_id, period_year, period_month, due_date::text as due
               from public.payments where unregistered_athlete_id = $1 and status = 'pending'`, [ISA]);
        expect(cobros).toHaveLength(1);
        expect(cobros[0].amount).toBe(145000);
        expect(cobros[0].offering_plan_id).toBe(PLAN);
        expect(cobros[0].period_year).toBe(Number(hoy.slice(0, 4)));
        expect(cobros[0].period_month).toBe(Number(hoy.slice(5, 7)));
        expect(cobros[0].due >= hoy).toBe(true);

        // El cron de vencimiento no la cancela (sin expires_at no hay vencimiento).
        await db.query('select public.fn_expire_overdue_enrollments()');
        const { rows: despues } = await db.query('select status from public.enrollments where id = $1', [ENR_ISA]);
        expect(despues[0].status).toBe('active');
    });

    it('editar el "correo del acudiente" de una ficha menor escribe guardian_*, no el contacto de la niña', async () => {
        const r = await put({
            athlete_type: 'unregistered',
            profile: { full_name: 'Isabella Florian QA', parent_email: 'nuevo.acudiente@qa.sportmaps.test', parent_phone: '3009990000' },
        });
        expect(r.status).toBe(200);
        const { rows } = await db.query(
            'select email, phone, guardian_email, guardian_phone from public.unregistered_athletes where id = $1', [ISA]);
        expect(rows[0].guardian_email).toBe('nuevo.acudiente@qa.sportmaps.test');
        expect(rows[0].guardian_phone).toBe('3009990000');
        expect(rows[0].email).toBe('isa.florian.atleta@qa.sportmaps.test');
        expect(rows[0].phone).toBe('3001110001');
    });
});
