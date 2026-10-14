/**
 * Aviso de puente caído: el cron corre a la vez en los 3 BFF (dev/stg/prod)
 * contra una sola base. Se reclama la fila (UPDATE … WHERE alerted_at IS NULL
 * RETURNING) ANTES de notificar: solo avisa la instancia que la reclamó.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    inserts: {} as Record<string, Record<string, any>[]>,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        let parche: any = null;
        let insertadas: any[] | null = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            is: (c: string, _v: null) => { filas = filas.filter((f) => (f[c] ?? null) === null); return api; },
            lt: (c: string, v: any) => { filas = filas.filter((f) => f[c] != null && f[c] < v); return api; },
            maybeSingle: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
            // Atómico como en Postgres: filtra y parcha en el mismo paso síncrono.
            update: (patch: any) => { parche = patch; return api; },
            insert: (rows: any) => {
                insertadas = Array.isArray(rows) ? rows : [rows];
                (estado.inserts[tabla] ??= []).push(...insertadas);
                return api;
            },
            then: (ok: any, ko: any) => {
                if (parche) {
                    filas = filas.filter((f) => (f.alerted_at ?? null) === null || !('alerted_at' in parche));
                    filas.forEach((f) => Object.assign(f, parche));
                }
                return Promise.resolve({ data: insertadas ?? filas, error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

const { runBridgeHeartbeatCheck } = await import('./bridge-heartbeat-check.job');

const haceMin = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

beforeEach(() => {
    estado.inserts = {};
    estado.tablas = {
        bridge_heartbeats: [
            { id: 'hb-1', school_id: 'esc-1', bridge_name: 'PC gym', last_seen_at: haceMin(30), alerted_at: null },
        ],
        schools: [{ id: 'esc-1', owner_id: 'owner-1', name: 'Gym' }],
    };
});

describe('runBridgeHeartbeatCheck — reclamo antes de avisar', () => {
    it('tres instancias a la vez: una sola notificación', async () => {
        await Promise.all([runBridgeHeartbeatCheck(), runBridgeHeartbeatCheck(), runBridgeHeartbeatCheck()]);
        expect(estado.inserts.notifications ?? []).toHaveLength(1);
        expect(estado.tablas.bridge_heartbeats[0].alerted_at).not.toBeNull();
    });

    it('ya alertado por otra instancia: no vuelve a avisar', async () => {
        await runBridgeHeartbeatCheck();
        await runBridgeHeartbeatCheck();
        expect(estado.inserts.notifications ?? []).toHaveLength(1);
    });

    it('sin owner: sella igual y no notifica', async () => {
        estado.tablas.schools[0].owner_id = null;
        await runBridgeHeartbeatCheck();
        expect(estado.inserts.notifications ?? []).toHaveLength(0);
        expect(estado.tablas.bridge_heartbeats[0].alerted_at).not.toBeNull();
    });

    it('puente que respondió hace poco: ni se sella ni se avisa', async () => {
        estado.tablas.bridge_heartbeats[0].last_seen_at = haceMin(1);
        await runBridgeHeartbeatCheck();
        expect(estado.inserts.notifications ?? []).toHaveLength(0);
        expect(estado.tablas.bridge_heartbeats[0].alerted_at).toBeNull();
    });
});
