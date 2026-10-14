/**
 * GET /iclock/getrequest — pollPendingCommands: una sola RPC `adms_poll`
 * (migración 20261014105210) y, si no está aplicada, el camino viejo de 3
 * llamadas PostgREST con la misma semántica.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Llamada = { tabla: string; op: 'select' | 'update'; filtros: Array<[string, string, any]>; valores?: any; order?: string; limit?: number };

const estado = vi.hoisted(() => ({
    rpcCalls: [] as Array<{ fn: string; args: any }>,
    rpc: { data: [] as unknown, error: null as null | { code?: string; message: string } },
    llamadas: [] as Llamada[],
    pendientes: [] as any[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        const ll: Llamada = { tabla, op: 'select', filtros: [] };
        estado.llamadas.push(ll);
        const api: any = {
            select: () => { ll.op = 'select'; return api; },
            update: (v: any) => { ll.op = 'update'; ll.valores = v; return api; },
            eq: (c: string, v: any) => { ll.filtros.push(['eq', c, v]); return api; },
            neq: (c: string, v: any) => { ll.filtros.push(['neq', c, v]); return api; },
            gt: (c: string, v: any) => { ll.filtros.push(['gt', c, v]); return api; },
            lt: (c: string, v: any) => { ll.filtros.push(['lt', c, v]); return api; },
            order: (c: string) => { ll.order = c; return api; },
            limit: (n: number) => { ll.limit = n; return api; },
            then: (ok: any, ko: any) =>
                Promise.resolve({ data: ll.op === 'select' ? estado.pendientes : null, error: null }).then(ok, ko),
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

const { pollPendingCommands, resetAdmsPollState } = await import('./access-adms');

const DEV = { id: 'dev-1', schoolId: 'esc-1', direction: 'entry' as const, ipAddress: null, ipCheckMode: 'off' as const, hasLocalBridge: false };
const DEV_BRIDGE = { ...DEV, hasLocalBridge: true };
const CMD = { id: 'c-1', cmd_seq: 42, command_type: 'enroll_user', metadata: { pin: 7, name: 'X' } };

beforeEach(() => {
    resetAdmsPollState();
    estado.rpcCalls = [];
    estado.llamadas = [];
    estado.pendientes = [CMD];
    estado.rpc = { data: [CMD], error: null };
});

describe('pollPendingCommands', () => {
    it('una sola RPC por sondeo, sin llamadas PostgREST a tablas', async () => {
        const out = await pollPendingCommands('SN1', DEV);
        expect(out).toEqual([CMD]);
        expect(estado.rpcCalls).toEqual([{ fn: 'adms_poll', args: { p_device_id: 'dev-1', p_limit: 5, p_exclude_types: null } }]);
        expect(estado.llamadas).toHaveLength(0);
    });

    it('con bridge local excluye open_door', async () => {
        await pollPendingCommands('SN1', DEV_BRIDGE);
        expect(estado.rpcCalls[0].args.p_exclude_types).toEqual(['open_door']);
    });

    it('RPC devuelve null → lista vacía', async () => {
        estado.rpc = { data: null, error: null };
        expect(await pollPendingCommands('SN1', DEV)).toEqual([]);
    });

    it.each(['PGRST202', '42883'])('RPC inexistente (%s) → camino viejo de 3 llamadas y no reintenta la RPC', async (code) => {
        estado.rpc = { data: null, error: { code, message: 'no existe' } };
        const out = await pollPendingCommands('SN1', DEV_BRIDGE);
        expect(out).toEqual([CMD]);

        const [touch, sel, exp] = estado.llamadas;
        expect(touch).toMatchObject({ tabla: 'turnstile_devices', op: 'update', filtros: [['eq', 'serial_number', 'SN1']] });
        expect(touch.valores).toHaveProperty('last_seen_at');
        expect(sel).toMatchObject({ tabla: 'device_commands', op: 'select', order: 'issued_at', limit: 5 });
        expect(sel.filtros).toEqual(expect.arrayContaining([
            ['eq', 'device_id', 'dev-1'], ['eq', 'status', 'pending'], ['neq', 'command_type', 'open_door'],
        ]));
        expect(sel.filtros.some(([op, c]) => op === 'gt' && c === 'expires_at')).toBe(true);
        expect(exp).toMatchObject({ tabla: 'device_commands', op: 'update', valores: { status: 'expired' } });
        expect(exp.filtros.some(([op, c]) => op === 'lt' && c === 'expires_at')).toBe(true);

        // Segundo sondeo dentro de la ventana: ya no prueba la RPC.
        await pollPendingCommands('SN1', DEV);
        expect(estado.rpcCalls).toHaveLength(1);
        // Sin bridge, el camino viejo no filtra por command_type.
        const sel2 = estado.llamadas[4];
        expect(sel2.filtros.some(([op]) => op === 'neq')).toBe(false);
    });

    it('otro error de la RPC → camino viejo solo para ese sondeo', async () => {
        estado.rpc = { data: null, error: { code: '57014', message: 'timeout' } };
        expect(await pollPendingCommands('SN1', DEV)).toEqual([CMD]);
        estado.rpc = { data: [], error: null };
        expect(await pollPendingCommands('SN1', DEV)).toEqual([]);
        expect(estado.rpcCalls).toHaveLength(2);
    });
});
