/**
 * Bloqueo automático por mora (F-D). La señal es SOLO payments.status='overdue':
 * un comprobante enviado (awaiting_approval) u objetado (glosado) no bloquea, y
 * si el PIN ya estaba bloqueado se desbloquea. Escuela con el flag apagado: no
 * se toca nada.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    inserts: {} as Record<string, Record<string, any>[]>,
}));

vi.mock('../config/supabase', () => {
    const esPendienteDelJob = (f: any) =>
        f.status === 'pending' && (f.issued_by ?? null) === null
        && ['set_group', 'disable_user', 'enable_user'].includes(f.command_type);
    const claveUnica = (f: any) => `${f.device_id}:${f.command_type}:${f.metadata?.pin}:${f.metadata?.group ?? ''}`;
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        let insertadas: any[] | null = null;
        let parche: any = null;
        let errorInsert: any = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: readonly any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
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
            // Solo lo que usa el job: .not(col, 'is', null), .gte(col, valor) y .gt(col, valor).
            not: (c: string, _op: string, _v: null) => { filas = filas.filter((f) => (f[c] ?? null) !== null); return api; },
            gte: (c: string, v: any) => { filas = filas.filter((f) => f[c] != null && f[c] >= v); return api; },
            gt: (c: string, v: any) => { filas = filas.filter((f) => f[c] != null && f[c] > v); return api; },
            order: (c: string, o?: { ascending?: boolean }) => {
                const asc = o?.ascending ?? true;
                filas = [...filas].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
                return api;
            },
            lt: (c: string, v: any) => { filas = filas.filter((f) => f[c] != null && f[c] < v); return api; },
            is: (c: string, _v: null) => { filas = filas.filter((f) => (f[c] ?? null) === null); return api; },
            maybeSingle: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
            // El UPDATE se aplica al resolverse (después de todos los filtros).
            update: (patch: any) => { parche = patch; return api; },
            insert: (rows: any) => {
                const nuevas = Array.isArray(rows) ? rows : [rows];
                // Simula uq_device_commands_bloqueo_job_pendiente (migración 20261014105326):
                // si alguna fila choca, el INSERT entero falla con 23505 y no entra nada.
                if (tabla === 'device_commands') {
                    const tabla_ = (estado.tablas.device_commands ??= []);
                    const vistas = new Set(tabla_.filter(esPendienteDelJob).map(claveUnica));
                    for (const n of nuevas) {
                        if (!esPendienteDelJob(n)) continue;
                        if (vistas.has(claveUnica(n))) {
                            errorInsert = { code: '23505', message: 'duplicate key value violates unique constraint' };
                            insertadas = [];
                            return api;
                        }
                        vistas.add(claveUnica(n));
                    }
                    tabla_.push(...nuevas.map((n) => ({ ...n })));
                }
                insertadas = nuevas;
                (estado.inserts[tabla] ??= []).push(...insertadas);
                return api;
            },
            then: (ok: any, ko: any) => {
                if (parche) filas.forEach((f) => Object.assign(f, parche));
                return Promise.resolve({ data: insertadas ?? filas, error: errorInsert }).then(ok, ko);
            },
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

const { runAccessAutoBlockCycle } = await import('./access-auto-block.job');
const { invalidateAccessBlockMechanismCache } = await import('../utils/accessBlockMechanism');

const ESCUELA = 'esc-dreamers';
const DEV_IN = 'dev-in';
const DEV_OUT = 'dev-out';

/** disable_user ejecutado en ambos lectores = PIN bloqueado (mecanismo 'disable'). */
const bloqueado = (pin: number, at: string) => [DEV_IN, DEV_OUT].map((device_id) => ({
    school_id: ESCUELA, device_id, command_type: 'disable_user', status: 'executed',
    metadata: { pin }, executed_at: at,
}));

const comandos = (tipo: string) =>
    (estado.inserts.device_commands ?? []).filter((c) => c.command_type === tipo).map((c) => c.metadata.pin);

beforeEach(() => {
    invalidateAccessBlockMechanismCache();
    estado.inserts = {};
    estado.tablas = {
        school_settings: [
            { school_id: ESCUELA, access_auto_block_overdue_enabled: true, access_block_mechanism: 'disable' },
        ],
        schools: [{ id: ESCUELA, owner_id: 'owner-1' }],
        turnstile_devices: [
            { id: DEV_IN, school_id: ESCUELA, direction: 'entry', is_active: true },
            { id: DEV_OUT, school_id: ESCUELA, direction: 'exit', is_active: true },
        ],
        zk_user_mappings: [
            { school_id: ESCUELA, zk_pin: 1, user_id: 'u-moroso', unregistered_athlete_id: null },
            { school_id: ESCUELA, zk_pin: 2, user_id: 'u-comprobante', unregistered_athlete_id: null },
            { school_id: ESCUELA, zk_pin: 3, user_id: null, unregistered_athlete_id: 'a-glosado' },
            { school_id: ESCUELA, zk_pin: 4, user_id: 'u-al-dia', unregistered_athlete_id: null },
        ],
        payments: [
            { school_id: ESCUELA, user_id: 'u-moroso', unregistered_athlete_id: null, status: 'overdue' },
            { school_id: ESCUELA, user_id: 'u-comprobante', unregistered_athlete_id: null, status: 'awaiting_approval' },
            { school_id: ESCUELA, user_id: null, unregistered_athlete_id: 'a-glosado', status: 'glosado' },
            { school_id: ESCUELA, user_id: 'u-al-dia', unregistered_athlete_id: null, status: 'paid' },
        ],
        device_commands: [
            // PIN 2 y 3 quedaron bloqueados cuando debían; ya enviaron comprobante.
            ...bloqueado(2, '2026-10-01T10:00:00Z'),
            ...bloqueado(3, '2026-10-01T10:00:00Z'),
        ],
        notifications: [],
    };
});

describe('runAccessAutoBlockCycle — comprobante pendiente', () => {
    it('bloquea al que está en overdue, en todos los lectores', async () => {
        await runAccessAutoBlockCycle();
        expect(comandos('disable_user')).toEqual([1, 1]);
    });

    it('awaiting_approval y glosado NO se bloquean; si estaban bloqueados se desbloquean', async () => {
        await runAccessAutoBlockCycle();
        const blq = comandos('disable_user');
        expect(blq).not.toContain(2);
        expect(blq).not.toContain(3);
        expect(comandos('enable_user').sort()).toEqual([2, 2, 3, 3]);
    });

    it('al día y sin bloqueo previo: no se emite nada para ese PIN', async () => {
        await runAccessAutoBlockCycle();
        expect([...comandos('disable_user'), ...comandos('enable_user')]).not.toContain(4);
    });

    it('escuela con el flag apagado: no se toca nada', async () => {
        estado.tablas.school_settings[0].access_auto_block_overdue_enabled = false;
        await runAccessAutoBlockCycle();
        expect(estado.inserts.device_commands ?? []).toHaveLength(0);
        expect(estado.inserts.notifications ?? []).toHaveLength(0);
    });
});

/** F0 cobros únicos (migración 20261010143132, I24): solo la mensualidad vencida bloquea. */
describe('runAccessAutoBlockCycle — solo la mensualidad', () => {
    beforeEach(() => {
        estado.tablas.zk_user_mappings.push(
            { school_id: ESCUELA, zk_pin: 5, user_id: 'u-torneo', unregistered_athlete_id: null },
            { school_id: ESCUELA, zk_pin: 6, user_id: 'u-mensualidad', unregistered_athlete_id: null },
            { school_id: ESCUELA, zk_pin: 7, user_id: 'u-torneo-bloqueado', unregistered_athlete_id: null },
        );
        estado.tablas.payments.push(
            { school_id: ESCUELA, user_id: 'u-torneo', unregistered_athlete_id: null, status: 'overdue', payment_category: 'torneo' },
            { school_id: ESCUELA, user_id: 'u-mensualidad', unregistered_athlete_id: null, status: 'overdue', payment_category: 'mensualidad' },
            // Quedó bloqueado por un torneo vencido de antes de F0.
            { school_id: ESCUELA, user_id: 'u-torneo-bloqueado', unregistered_athlete_id: null, status: 'overdue', payment_category: 'articulos' },
        );
        estado.tablas.device_commands.push(...bloqueado(7, '2026-10-01T10:00:00Z'));
    });

    it('un cobro único vencido NO bloquea; una mensualidad (explícita o NULL) sí', async () => {
        await runAccessAutoBlockCycle();
        const blq = comandos('disable_user');
        expect(blq).not.toContain(5);
        expect(blq.filter((p: number) => p === 6)).toHaveLength(2);
        expect(blq.filter((p: number) => p === 1)).toHaveLength(2); // categoría NULL = mensualidad
    });

    it('bloqueado solo por un cobro único vencido → se desbloquea', async () => {
        await runAccessAutoBlockCycle();
        expect(comandos('enable_user').filter((p: number) => p === 7)).toHaveLength(2);
    });
});

/**
 * Crons concurrentes: el mismo job corre a la vez en los 3 BFF (dev/stg/prod)
 * contra una sola base. El índice único parcial (migración 20261014105326) deja
 * entrar un solo comando pendiente por (lector, tipo, PIN, grupo); el job no
 * cuenta ni avisa por lo que no insertó.
 */
describe('runAccessAutoBlockCycle — idempotente entre instancias', () => {
    const notifs = () => estado.inserts.notifications ?? [];
    const pendientes = () => (estado.tablas.device_commands ?? []).filter((c) => c.status === 'pending');

    it('tres instancias a la vez: un solo juego de comandos y una sola notificación', async () => {
        await Promise.all([runAccessAutoBlockCycle(), runAccessAutoBlockCycle(), runAccessAutoBlockCycle()]);
        expect(pendientes().filter((c) => c.command_type === 'disable_user').map((c) => c.metadata.pin)).toEqual([1, 1]);
        expect(pendientes().filter((c) => c.command_type === 'enable_user')).toHaveLength(4);
        expect(notifs()).toHaveLength(1);
        expect(notifs()[0].message).toContain('1 atleta(s) bloqueado(s)');
        expect(notifs()[0].message).toContain('2 desbloqueado(s)');
    });

    it('si otra instancia ya encoló una parte, inserta solo el resto y avisa solo por eso', async () => {
        const viejo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // fuera de la ventana de 30 min
        const venceManana = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
        estado.tablas.device_commands.push(...[DEV_IN, DEV_OUT].map((device_id) => ({
            school_id: ESCUELA, device_id, command_type: 'disable_user', status: 'pending',
            issued_by: null, issued_at: viejo, expires_at: venceManana, claimed_at: null, metadata: { pin: 1 },
        })));
        await runAccessAutoBlockCycle();
        expect(comandos('disable_user')).toEqual([]); // chocó contra el índice: no entró
        expect(comandos('enable_user').sort()).toEqual([2, 2, 3, 3]);
        expect(notifs()).toHaveLength(1);
        expect(notifs()[0].message).toContain('0 atleta(s) bloqueado(s)');
    });

    it('todo ya encolado por otra instancia: no inserta ni notifica', async () => {
        await runAccessAutoBlockCycle();
        estado.inserts = {};
        await runAccessAutoBlockCycle();
        expect(estado.inserts.device_commands ?? []).toHaveLength(0);
        expect(notifs()).toHaveLength(0);
    });

    it('un pendiente del job reclamado hace >30 min y sin confirmar se expira y se reintenta', async () => {
        const hace40 = new Date(Date.now() - 40 * 60 * 1000).toISOString();
        const venceManana = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
        const muerto = {
            school_id: ESCUELA, device_id: DEV_IN, command_type: 'disable_user', status: 'pending',
            issued_by: null, issued_at: hace40, claimed_at: hace40, expires_at: venceManana, metadata: { pin: 1 },
        };
        estado.tablas.device_commands.push(muerto);
        await runAccessAutoBlockCycle();
        expect(muerto.status).toBe('expired');
        expect(comandos('disable_user')).toEqual([1, 1]);
    });

    it('un comando MANUAL pendiente no se expira ni bloquea el índice', async () => {
        const hace40 = new Date(Date.now() - 40 * 60 * 1000).toISOString();
        const manual = {
            school_id: ESCUELA, device_id: DEV_IN, command_type: 'disable_user', status: 'pending',
            issued_by: 'admin-1', issued_at: hace40, claimed_at: hace40,
            expires_at: new Date(Date.now() - 1000).toISOString(), metadata: { pin: 1 },
        };
        estado.tablas.device_commands.push(manual);
        await runAccessAutoBlockCycle();
        expect(manual.status).toBe('pending');
        expect(comandos('disable_user')).toEqual([1, 1]);
    });
});
