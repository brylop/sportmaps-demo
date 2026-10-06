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
