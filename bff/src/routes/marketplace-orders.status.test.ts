/**
 * marketplace-orders (tienda v2 F0, M-F0-3):
 *  - POST /  → 410 Gone sin tocar la base (creaba órdenes con precios del body).
 *  - PATCH /vendor/:id/status → estado normalizado, transición permitida al
 *    vendedor y dueño por can_manage_store_as (con p_user_id) o legacy.
 *
 * Cero red y cero base: Supabase está moqueado con un builder mínimo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const estado = vi.hoisted(() => ({
    orders: new Map<string, any>(),
    items: [] as Array<{ order_id: string; vendor_id: string }>,
    canManage: false,
    rpcCalls: [] as Array<[string, any]>,
    fromCalls: [] as string[],
    updates: [] as Array<{ table: string; payload: any; filters: Record<string, any> }>,
}));

vi.mock('../config/supabase', () => {
    function builder(table: string) {
        const b: any = {
            op: 'select',
            payload: null,
            filters: {} as Record<string, any>,
            select() { return b; },
            update(p: any) { b.op = 'update'; b.payload = p; return b; },
            insert() { throw new Error('insert no permitido en este test'); },
            delete() { throw new Error('delete no permitido en este test'); },
            eq(c: string, v: any) { b.filters[c] = v; return b; },
            limit() { return b; },
            order() { return b; },
            range() { return b; },
            async resolve() {
                if (table === 'orders') {
                    const o = estado.orders.get(b.filters.id);
                    if (b.op === 'update') {
                        estado.updates.push({ table, payload: b.payload, filters: { ...b.filters } });
                        if (!o || (b.filters.status !== undefined && o.status !== b.filters.status)) {
                            return { data: null, error: null };
                        }
                        Object.assign(o, b.payload);
                        return { data: { ...o }, error: null };
                    }
                    return { data: o ? { ...o } : null, error: null };
                }
                if (table === 'order_items') {
                    const rows = estado.items.filter(
                        (i) => i.order_id === b.filters.order_id && i.vendor_id === b.filters.vendor_id,
                    );
                    return { data: rows.map(() => ({ id: 'it' })), error: null };
                }
                return { data: null, error: null };
            },
            maybeSingle() { return b.resolve(); },
            single() { return b.resolve(); },
            then(res: any, rej: any) { return b.resolve().then(res, rej); },
        };
        return b;
    }
    return {
        supabase: {
            from: (table: string) => { estado.fromCalls.push(table); return builder(table); },
            rpc: async (fn: string, args: any) => {
                estado.rpcCalls.push([fn, args]);
                if (fn === 'can_manage_store_as') return { data: estado.canManage, error: null };
                return { data: null, error: { code: 'PGRST202', message: 'not mocked' } };
            },
        },
    };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireMarketplaceAuth: (req: any, _res: any, next: any) => { req.user = { id: 'u1' }; next(); },
    auditLog: async () => {},
}));

import ordersRouter from './marketplace-orders.routes';

let server: http.Server;
let base = '';

beforeEach(async () => {
    estado.orders = new Map([
        ['o-paid', { id: 'o-paid', status: 'paid', vendor_profile_id: 'vp1' }],
        ['o-legacy', { id: 'o-legacy', status: 'processing', vendor_profile_id: null }],
    ]);
    estado.items = [{ order_id: 'o-legacy', vendor_id: 'u1' }];
    estado.canManage = true;
    estado.rpcCalls = [];
    estado.fromCalls = [];
    estado.updates = [];

    const app = express();
    app.use(express.json());
    app.use('/orders', ordersRouter);
    server = app.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

const patch = (id: string, body: any) => fetch(`${base}/orders/vendor/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

describe('POST /orders', () => {
    it('410 ORDER_ENDPOINT_GONE sin tocar la base', async () => {
        const r = await fetch(`${base}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ product_id: 'p', unit_price: 1, quantity: 1, vendor_id: 'x' }] }),
        });
        expect(r.status).toBe(410);
        expect(await r.json()).toEqual({ ok: false, error: 'ORDER_ENDPOINT_GONE', message: 'Usa el checkout del carrito' });
        expect(estado.fromCalls).toEqual([]);
        expect(estado.rpcCalls).toEqual([]);
    });
});

describe('PATCH /orders/vendor/:id/status', () => {
    it('estado libre → 400 sin escribir', async () => {
        const r = await patch('o-paid', { status: 'enviado-ya' });
        expect(r.status).toBe(400);
        expect(estado.updates).toEqual([]);
    });

    it('paid → cancelled no lo hace el vendedor (409, es un reembolso)', async () => {
        const r = await patch('o-paid', { status: 'cancelled' });
        expect(r.status).toBe(409);
        expect((await r.json()).error).toBe('TRANSITION_NOT_ALLOWED');
        expect(estado.updates).toEqual([]);
    });

    it("paid → 'processing' (legacy) escribe 'preparing' y valida dueño con p_user_id", async () => {
        const r = await patch('o-paid', { status: 'processing', tracking_number: 'G-1' });
        expect(r.status).toBe(200);
        expect(estado.updates).toHaveLength(1);
        expect(estado.updates[0].payload).toEqual({ status: 'preparing', tracking_number: 'G-1' });
        expect(estado.updates[0].filters).toEqual({ id: 'o-paid', status: 'paid' });
        expect(estado.rpcCalls).toContainEqual(['can_manage_store_as', { p_vendor_profile_id: 'vp1', p_user_id: 'u1' }]);
    });

    it('sin permiso de tienda ni items propios → 404', async () => {
        estado.canManage = false;
        const r = await patch('o-paid', { status: 'preparing' });
        expect(r.status).toBe(404);
        expect(estado.updates).toEqual([]);
    });

    it('orden legacy sin vendor_profile_id: dueño por order_items.vendor_id', async () => {
        const r = await patch('o-legacy', { status: 'shipped' });
        expect(r.status).toBe(200);
        expect(estado.updates[0].payload).toEqual({ status: 'shipped' });
    });

    it('orden inexistente → 404', async () => {
        const r = await patch('nope', { status: 'preparing' });
        expect(r.status).toBe(404);
    });
});
