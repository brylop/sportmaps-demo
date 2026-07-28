// Tests de concurrencia / lógica del despachador unificado (F1).
//
// Deterministas: mockean el cliente Supabase (builder encadenable), el emisor
// nativo (push.service) y el web push (webpush.service). No tocan DB real.
//
// Cubren los 6 ajustes del diseño + los 2 escenarios pedidos:
//   - claim por LEASE: una fila con lease vigente (next_attempt_at futuro) NO se
//     re-reclama → simula "crash entre claim y envío": hasta que expira el lease
//     el worker no la retoma (y al expirar, sí).
//   - retry por canal: si web_sent>0 (éxito previo), en el reintento NO se
//     reenvía web → no se duplica en fallos parciales de FCM.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    const state: { resolve: (table: string, ops: [string, any[]][]) => any } = {
        resolve: () => ({ data: null, error: null }),
    };
    function makeBuilder(table: string) {
        const ops: [string, any[]][] = [];
        const b: any = {};
        const chain = (name: string) => (...args: any[]) => { ops.push([name, args]); return b; };
        for (const m of ['select', 'eq', 'in', 'lte', 'order', 'limit', 'update', 'delete', 'is', 'not']) {
            b[m] = chain(m);
        }
        b.maybeSingle = () => { ops.push(['maybeSingle', []]); return Promise.resolve(state.resolve(table, ops)); };
        b.single = () => { ops.push(['single', []]); return Promise.resolve(state.resolve(table, ops)); };
        b.then = (res: any, rej: any) => Promise.resolve(state.resolve(table, ops)).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: { from: (t: string) => makeBuilder(t) },
        sendToUser: vi.fn(),
        sendWebPushToUser: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./push.service', () => ({ sendToUser: h.sendToUser }));
vi.mock('./webpush.service', () => ({ sendWebPushToUser: h.sendWebPushToUser }));

import { claimByNotificationId, dispatchDelivery } from './notification.service';

const baseRow = () => ({
    id: 'd1',
    notification_id: 'n1',
    user_id: 'u1',
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    next_attempt_at: new Date(Date.now() - 1000).toISOString(), // vencido → reclamable
    web_sent: 0,
    web_failed: 0,
    native_sent: 0,
    native_failed: 0,
    revoked: 0,
});

const baseNotif = (over: Record<string, any> = {}) => ({
    user_id: 'u1',
    category: 'payment',
    title: 'Pago aprobado',
    message: 'Tu pago quedó aprobado',
    link: '/my-payments',
    data: { payer_name: 'Ana', amount: 50000 },
    ...over,
});

beforeEach(() => {
    h.sendToUser.mockReset();
    h.sendWebPushToUser.mockReset();
    h.state.resolve = () => ({ data: null, error: null });
    // defaults sanos
    h.sendWebPushToUser.mockResolvedValue({ sent: 0, failed: 0, revoked: 0 });
    h.sendToUser.mockResolvedValue({ enabled: true, sent: 0, failed: 0, revoked: 0 });
});

/** Resolver de outbox que captura la fila devuelta y el patch del update. */
function outboxResolver(row: any) {
    const captured: { updatePatch?: any; updateOps?: [string, any[]][]; updated: boolean } = { updated: false };
    h.state.resolve = (table, ops) => {
        if (table === 'notification_deliveries') {
            const upd = ops.find((o) => o[0] === 'update');
            if (upd) {
                captured.updated = true;
                captured.updatePatch = upd[1][0];
                captured.updateOps = ops;
                return { data: { ...row, ...upd[1][0] }, error: null };
            }
            return { data: row, error: null };
        }
        return { data: null, error: null };
    };
    return captured;
}

describe('claim por lease', () => {
    it('reclama una fila vencida: attempts++ y next_attempt_at al futuro, con guard optimista', async () => {
        const row = baseRow();
        const cap = outboxResolver(row);

        const leased = await claimByNotificationId('n1');

        expect(leased).toBeTruthy();
        expect(cap.updated).toBe(true);
        expect(cap.updatePatch.attempts).toBe(1); // attempts++
        expect(new Date(cap.updatePatch.next_attempt_at).getTime()).toBeGreaterThan(Date.now()); // lease +2min
        // guard optimista: update filtra por attempts previos (0) e id
        const eqs = (cap.updateOps || []).filter((o) => o[0] === 'eq').map((o) => o[1]);
        expect(eqs).toContainEqual(['attempts', 0]);
        expect(eqs).toContainEqual(['id', 'd1']);
    });

    it('NO re-reclama una fila con lease vigente (crash entre claim y envío)', async () => {
        const row = { ...baseRow(), next_attempt_at: new Date(Date.now() + 120_000).toISOString() };
        const cap = outboxResolver(row);

        const leased = await claimByNotificationId('n1');

        expect(leased).toBeNull();     // leased todavía → no se toca
        expect(cap.updated).toBe(false); // no hubo intento de update
    });

    it('reclama de nuevo cuando el lease expiró (worker retoma tras crash)', async () => {
        // Simula: crasheó tras claim con attempts=1; el lease ya venció.
        const row = { ...baseRow(), attempts: 1, next_attempt_at: new Date(Date.now() - 1000).toISOString() };
        const cap = outboxResolver(row);

        const leased = await claimByNotificationId('n1');

        expect(leased).toBeTruthy();
        expect(cap.updatePatch.attempts).toBe(2); // segundo intento
    });

    it('NO reclama si agotó max_attempts', async () => {
        const row = { ...baseRow(), attempts: 5, max_attempts: 5 };
        const cap = outboxResolver(row);

        const leased = await claimByNotificationId('n1');

        expect(leased).toBeNull();
        expect(cap.updated).toBe(false);
    });
});

describe('dispatch: envío por canales', () => {
    it('fila fresca con ambos canales OK → status sent, ambos emisores llamados', async () => {
        h.sendWebPushToUser.mockResolvedValue({ sent: 1, failed: 0, revoked: 0 });
        h.sendToUser.mockResolvedValue({ enabled: true, sent: 1, failed: 0, revoked: 0 });

        const row = baseRow();
        const notif = baseNotif();
        const cap: any = { updated: false };
        h.state.resolve = (table, ops) => {
            if (table === 'notifications') return { data: notif, error: null };
            if (table === 'profiles') return { data: { preferences: {} }, error: null };
            if (table === 'notification_deliveries') {
                const upd = ops.find((o) => o[0] === 'update');
                if (upd) { cap.updated = true; cap.patch = upd[1][0]; }
                return { data: null, error: null };
            }
            return { data: null, error: null };
        };

        await dispatchDelivery(row as any);

        expect(h.sendWebPushToUser).toHaveBeenCalledTimes(1);
        expect(h.sendToUser).toHaveBeenCalledTimes(1);
        expect(cap.patch.status).toBe('sent');
        expect(cap.patch.web_sent).toBe(1);
        expect(cap.patch.native_sent).toBe(1);
    });

    it('retry con web_sent>0 y FCM que falla → NO reenvía web (sin duplicado), status failed con backoff', async () => {
        h.sendToUser.mockResolvedValue({ enabled: true, sent: 0, failed: 1, revoked: 0, reason: 'fcm_down' });

        const row = { ...baseRow(), attempts: 1, web_sent: 1 }; // web ya tuvo éxito antes
        const notif = baseNotif();
        const cap: any = {};
        h.state.resolve = (table, ops) => {
            if (table === 'notifications') return { data: notif, error: null };
            if (table === 'profiles') return { data: { preferences: {} }, error: null };
            if (table === 'notification_deliveries') {
                const upd = ops.find((o) => o[0] === 'update');
                if (upd) cap.patch = upd[1][0];
                return { data: null, error: null };
            }
            return { data: null, error: null };
        };

        await dispatchDelivery(row as any);

        expect(h.sendWebPushToUser).not.toHaveBeenCalled(); // canal web saltado (ya tenía éxito)
        expect(h.sendToUser).toHaveBeenCalledTimes(1);
        expect(cap.patch.status).toBe('failed');
        expect(cap.patch.next_attempt_at).toBeDefined(); // backoff programado
        expect(cap.patch.web_sent).toBe(1);   // no se incrementó
        expect(cap.patch.native_failed).toBe(1);
    });

    it('preferencia push_notifications=false en categoría normal → skipped, sin envíos', async () => {
        const row = baseRow();
        const notif = baseNotif({ category: 'payment' });
        const cap: any = {};
        h.state.resolve = (table, ops) => {
            if (table === 'notifications') return { data: notif, error: null };
            if (table === 'profiles') return { data: { preferences: { push_notifications: false } }, error: null };
            if (table === 'notification_deliveries') {
                const upd = ops.find((o) => o[0] === 'update');
                if (upd) cap.patch = upd[1][0];
                return { data: null, error: null };
            }
            return { data: null, error: null };
        };

        await dispatchDelivery(row as any);

        expect(h.sendWebPushToUser).not.toHaveBeenCalled();
        expect(h.sendToUser).not.toHaveBeenCalled();
        expect(cap.patch.status).toBe('skipped');
    });

    it('categoría system ignora el toggle global de push (seguridad siempre)', async () => {
        h.sendToUser.mockResolvedValue({ enabled: true, sent: 1, failed: 0, revoked: 0 });
        const row = baseRow();
        const notif = baseNotif({ category: 'system' });
        h.state.resolve = (table) => {
            if (table === 'notifications') return { data: notif, error: null };
            if (table === 'profiles') return { data: { preferences: { push_notifications: false } }, error: null };
            return { data: null, error: null };
        };

        await dispatchDelivery(row as any);

        // pese a push_notifications=false, por ser 'system' se intenta enviar
        expect(h.sendToUser).toHaveBeenCalledTimes(1);
        expect(h.sendWebPushToUser).toHaveBeenCalledTimes(1);
    });
});
