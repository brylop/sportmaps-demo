/**
 * F-D (migración 20261005214253): con school_settings.pending_proof_counts_as_paid,
 * una inscripción con expires_at vencido pero con comprobante en revisión deja
 * pasar en la ENTRADA (nota 'pending_proof'). Sin el flag: 'enrollment_expired'
 * como siempre, y sin llamar a la RPC.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    rpc: { data: false as unknown, error: null as null | { message: string } },
    rpcCalls: [] as Array<{ fn: string; args: any }>,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            // .or('payment_category.is.null,payment_category.eq.mensualidad'): solo is.null / eq.
            or: (expr: string) => {
                const conds = expr.split(',').map((s) => {
                    const [c, op, ...r] = s.split('.');
                    const v = r.join('.');
                    return (f: any) => (op === 'is' && v === 'null' ? (f[c] ?? null) === null : op === 'eq' ? f[c] === v : false);
                });
                filas = filas.filter((f) => conds.some((k) => k(f)));
                return api;
            },
            order: (c: string, o?: { ascending?: boolean }) => {
                const asc = o?.ascending ?? true;
                filas = [...filas].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
                return api;
            },
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            maybeSingle: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
            then: (ok: any, ko: any) => Promise.resolve({ data: filas, error: null }).then(ok, ko),
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: (fn: string, args: any) => {
                estado.rpcCalls.push({ fn, args });
                return Promise.resolve(estado.rpc);
            },
        },
    };
});

vi.mock('./attendance', () => ({ checkInPresenceFromEvent: vi.fn() }));

const { validateAccess, invalidateMappingCache, invalidatePendingProofSettingCache } = await import('./access-adms');

const ESCUELA = 'esc-dreamers';
const ATLETA = 'a-1';
const ENROLLMENT = 'enr-1';
const AYER = '2020-01-01';

beforeEach(() => {
    invalidateMappingCache();
    invalidatePendingProofSettingCache();
    estado.rpcCalls = [];
    estado.rpc = { data: true, error: null };
    estado.tablas = {
        school_settings: [{ school_id: ESCUELA, pending_proof_counts_as_paid: true }],
        zk_user_mappings: [
            { school_id: ESCUELA, zk_pin: 7, user_id: null, unregistered_athlete_id: ATLETA, child_id: null },
        ],
        unregistered_athletes: [{ id: ATLETA, full_name: 'Atleta Prueba' }],
        enrollments: [
            { id: ENROLLMENT, school_id: ESCUELA, status: 'active', expires_at: AYER, unregistered_athlete_id: ATLETA },
        ],
        payments: [
            { school_id: ESCUELA, unregistered_athlete_id: ATLETA, status: 'awaiting_approval', created_at: '2026-10-01T00:00:00Z' },
        ],
    };
});

describe('validateAccess — vencida con comprobante pendiente', () => {
    it('flag ON + comprobante pendiente → entra, con nota pending_proof', async () => {
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(true);
        expect(r.note).toBe('pending_proof');
        expect(r.enrollmentId).toBe(ENROLLMENT);
        expect(estado.rpcCalls).toEqual([{ fn: 'enrollment_has_pending_proof', args: { p_enrollment_id: ENROLLMENT } }]);
    });

    it('flag ON pero sin comprobante pendiente → enrollment_expired', async () => {
        estado.rpc = { data: false, error: null };
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(false);
        expect(r.reason).toBe('enrollment_expired');
    });

    it('flag ON y la RPC falla → se deniega como antes (fail-closed)', async () => {
        estado.rpc = { data: null, error: { message: 'boom' } };
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(false);
        expect(r.reason).toBe('enrollment_expired');
    });

    it('flag ON + comprobante pendiente pero un overdue más reciente → payment_overdue', async () => {
        estado.tablas.payments.push({
            school_id: ESCUELA, unregistered_athlete_id: ATLETA, status: 'overdue', created_at: '2026-10-05T00:00:00Z',
        });
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(false);
        expect(r.reason).toBe('payment_overdue');
    });

    it('flag OFF → enrollment_expired y ni se consulta la RPC', async () => {
        estado.tablas.school_settings[0].pending_proof_counts_as_paid = false;
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(false);
        expect(r.reason).toBe('enrollment_expired');
        expect(r.note).toBeUndefined();
        expect(estado.rpcCalls).toHaveLength(0);
    });

    it('escuela sin fila de settings → como flag OFF', async () => {
        estado.tablas.school_settings = [];
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.reason).toBe('enrollment_expired');
        expect(estado.rpcCalls).toHaveLength(0);
    });

    it('inscripción vigente → entra sin nota ni RPC', async () => {
        estado.tablas.enrollments[0].expires_at = '2999-01-01';
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(true);
        expect(r.note).toBeUndefined();
        expect(estado.rpcCalls).toHaveLength(0);
    });
});

/**
 * F0 cobros únicos (migración 20261010143132, cobros-multiples I23): se niega
 * por CUALQUIER mensualidad 'overdue' (categoría NULL o 'mensualidad'), no por
 * el último cobro creado. Un cobro único vencido no niega.
 */
describe('validateAccess — pago vencido: solo la mensualidad', () => {
    beforeEach(() => {
        estado.tablas.enrollments[0].expires_at = '2999-01-01';
        estado.tablas.payments = [];
    });
    const cobro = (status: string, created_at: string, payment_category: string | null) => ({
        school_id: ESCUELA, unregistered_athlete_id: ATLETA, status, created_at, payment_category,
    });

    it('mensualidad vencida vieja + torneo pendiente creado hoy → payment_overdue (antes el torneo la escondía)', async () => {
        estado.tablas.payments.push(
            cobro('overdue', '2026-09-01T00:00:00Z', 'mensualidad'),
            cobro('pending', '2026-10-10T00:00:00Z', 'torneo'),
        );
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(false);
        expect(r.reason).toBe('payment_overdue');
    });

    it('mismo caso en el otro orden (torneo viejo, mensualidad vencida reciente) → payment_overdue', async () => {
        estado.tablas.payments.push(
            cobro('pending', '2026-09-01T00:00:00Z', 'torneo'),
            cobro('overdue', '2026-10-10T00:00:00Z', 'mensualidad'),
        );
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.reason).toBe('payment_overdue');
    });

    it('solo un cobro único vencido (torneo) → entra', async () => {
        estado.tablas.payments.push(cobro('overdue', '2026-10-10T00:00:00Z', 'torneo'));
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.granted).toBe(true);
        expect(r.reason).toBeUndefined();
    });

    it.each(['inscripcion', 'seguro', 'articulos', 'viaje', 'otro', 'categoria_futura'])(
        'cobro único %s vencido → entra', async (cat) => {
            estado.tablas.payments.push(cobro('overdue', '2026-10-10T00:00:00Z', cat));
            expect((await validateAccess(ESCUELA, '7', 'entry')).granted).toBe(true);
        },
    );

    it('mensualidad con categoría NULL (fila vieja) vencida → payment_overdue', async () => {
        estado.tablas.payments.push(cobro('overdue', '2026-08-01T00:00:00Z', null));
        const r = await validateAccess(ESCUELA, '7', 'entry');
        expect(r.reason).toBe('payment_overdue');
    });

    it('mensualidad vencida aunque la última creada esté pagada → payment_overdue', async () => {
        estado.tablas.payments.push(
            cobro('overdue', '2026-09-01T00:00:00Z', 'mensualidad'),
            cobro('paid', '2026-10-01T00:00:00Z', 'mensualidad'),
        );
        expect((await validateAccess(ESCUELA, '7', 'entry')).reason).toBe('payment_overdue');
    });

    it('mensualidad con comprobante enviado (awaiting_approval) → entra', async () => {
        estado.tablas.payments.push(cobro('awaiting_approval', '2026-09-01T00:00:00Z', 'mensualidad'));
        expect((await validateAccess(ESCUELA, '7', 'entry')).granted).toBe(true);
    });

    it('la salida nunca se niega, aunque haya mensualidad vencida', async () => {
        estado.tablas.payments.push(cobro('overdue', '2026-09-01T00:00:00Z', 'mensualidad'));
        expect((await validateAccess(ESCUELA, '7', 'exit')).granted).toBe(true);
    });
});
