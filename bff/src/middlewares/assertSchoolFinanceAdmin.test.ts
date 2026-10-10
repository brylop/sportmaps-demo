/**
 * Gate real del modal «Cobros y pagos» (spec cobros-multiples §9.1, F2).
 *
 * El caso que justifica el archivo: `requireRole` deja pasar SIEMPRE a
 * owner/admin/super_admin por `req.role`, que no dice nada de ESTA escuela.
 * Aquí se prueba el middleware solo, con `req.role = 'admin'` y sin membresía:
 * debe decir 403.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstadoFalso } from '../services/charge-batches.test-helpers';

const estado = vi.hoisted(() => ({ ref: null as unknown as EstadoFalso }));
vi.mock('../config/supabase', async () => {
    const h = await import('../services/charge-batches.test-helpers');
    estado.ref = h.estadoVacio();
    return { supabase: h.supabaseFalso(new Proxy({} as EstadoFalso, { get: (_t, k) => (estado.ref as any)[k] })) };
});

const { assertSchoolFinanceAdmin, assertSchoolFinanceReader, nivelFinanzasEnEscuela } = await import('./assertSchoolFinanceAdmin');

const ESC = 'esc-1';
const OTRA = 'esc-2';

beforeEach(() => {
    estado.ref.erroresTabla = {};
    estado.ref.tablas = {
        schools: [{ id: ESC, owner_id: 'dueno' }, { id: OTRA, owner_id: 'otro' }],
        platform_admins: [{ profile_id: 'plataforma', is_active: true }, { profile_id: 'ex-plataforma', is_active: false }],
        school_members: [
            { school_id: ESC, profile_id: 'adm', role: 'admin', status: 'active' },
            { school_id: ESC, profile_id: 'sadm', role: 'school_admin', status: 'active' },
            { school_id: ESC, profile_id: 'own', role: 'owner', status: 'active' },
            { school_id: ESC, profile_id: 'cont', role: 'accountant', status: 'active' },
            { school_id: ESC, profile_id: 'coach', role: 'coach', status: 'active' },
            { school_id: ESC, profile_id: 'reporter', role: 'reporter', status: 'active' },
            { school_id: ESC, profile_id: 'adm-inactivo', role: 'admin', status: 'inactive' },
            { school_id: OTRA, profile_id: 'adm-otra', role: 'admin', status: 'active' },
        ],
        // Autoasignado: no debe contar para nada.
        profiles: [{ id: 'global-admin', role: 'admin' }, { id: 'global-super', role: 'super_admin' }],
    };
});

async function correr(mw: any, user: string, role = 'admin', schoolId: string = ESC) {
    const req: any = { user: { id: user }, schoolId, role, log: { error: () => { } } };
    let status = 200;
    let body: any = null;
    let paso = false;
    const res: any = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return res; } };
    await mw(req, res, () => { paso = true; });
    return { paso, status, body, nivel: req.nivelFinanzas };
}

describe('nivelFinanzasEnEscuela', () => {
    it.each([
        ['dueno', 'dueno'], ['own', 'dueno'], ['plataforma', 'dueno'],
        ['adm', 'admin'], ['sadm', 'admin'], ['cont', 'lector'],
        ['coach', null], ['reporter', null], ['adm-inactivo', null], ['adm-otra', null],
        ['ex-plataforma', null], ['global-admin', null], ['global-super', null],
    ])('%s → %s', async (u, esperado) => {
        expect(await nivelFinanzasEnEscuela(u, ESC)).toBe(esperado);
    });
});

describe('assertSchoolFinanceAdmin (escritura)', () => {
    it('admin global de profiles.role sin membresía → 403 aunque req.role diga admin', async () => {
        const r = await correr(assertSchoolFinanceAdmin, 'global-admin', 'admin');
        expect(r.paso).toBe(false);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('SIN_PERMISO');
    });

    it('admin de OTRA escuela → 403', async () => {
        expect((await correr(assertSchoolFinanceAdmin, 'adm-otra', 'admin')).status).toBe(403);
    });

    it('contador → 403 en escritura, pasa en lectura', async () => {
        expect((await correr(assertSchoolFinanceAdmin, 'cont', 'accountant')).paso).toBe(false);
        const r = await correr(assertSchoolFinanceReader, 'cont', 'accountant');
        expect(r.paso).toBe(true);
        expect(r.nivel).toBe('lector');
    });

    it('coach → 403 también en lectura', async () => {
        expect((await correr(assertSchoolFinanceReader, 'coach', 'coach')).status).toBe(403);
    });

    it('owner y admin pasan y dejan el nivel', async () => {
        expect(await correr(assertSchoolFinanceAdmin, 'dueno', 'owner')).toMatchObject({ paso: true, nivel: 'dueno' });
        expect(await correr(assertSchoolFinanceAdmin, 'sadm', 'school_admin')).toMatchObject({ paso: true, nivel: 'admin' });
    });

    it('sin escuela → 400; error de base → 500 (fail-closed)', async () => {
        expect((await correr(assertSchoolFinanceAdmin, 'dueno', 'owner', '')).status).toBe(400);
        estado.ref.erroresTabla.school_members = { message: 'timeout' };
        const r = await correr(assertSchoolFinanceAdmin, 'adm', 'admin');
        expect(r.paso).toBe(false);
        expect(r.status).toBe(500);
    });
});
