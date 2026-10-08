/**
 * Tienda v2 F0 — rutas del BFF sobre el motor de la orden:
 *  - POST /marketplace/checkout/cart → rpc create_cart_order (comprador de la
 *    sesión, sin precios del cliente) y widget con las llaves DEL VENDEDOR.
 *  - /store/* → RPC con p_actor (comprobante, aprobación, efectivo).
 *  - Webhook Wompi CART-*: monto == orders.total_amount, un solo camino
 *    (confirm_order_payment), sin split_order_payment ni compute suelto,
 *    rechazo → store_order_payment_failed, y 503 sin llaves del vendedor
 *    (nunca valida con las globales).
 *
 * Cero red y cero base: Supabase, pasarela y middlewares moqueados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const estado = vi.hoisted(() => ({
    rpc: [] as Array<[string, any]>,
    rpcResult: {} as Record<string, { data?: any; error?: any }>,
    orders: new Map<string, any>(),
    gatewayThrows: false,
    sellerCreds: null as any,
    checksumCalls: 0,
    signedUploadPath: '' as string,
}));

vi.mock('../config/supabase', () => {
    function builder(table: string) {
        const b: any = {
            filters: {} as Record<string, any>,
            select() { return b; },
            eq(c: string, v: any) { b.filters[c] = v; return b; },
            in() { return b; }, order() { return b; }, limit() { return b; },
            update() { return b; },
            async maybeSingle() {
                if (table === 'orders') {
                    const o = estado.orders.get(b.filters.id) ?? [...estado.orders.values()].find((x) => x.reference === b.filters.reference || x.wompi_reference === b.filters.wompi_reference);
                    return { data: o ?? null, error: null };
                }
                return { data: null, error: null };
            },
            single() { return b.maybeSingle(); },
            then(res: any, rej: any) { return Promise.resolve({ data: null, error: null }).then(res, rej); },
        };
        return b;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (fn: string, args: any) => {
                estado.rpc.push([fn, args]);
                return estado.rpcResult[fn] ?? { data: { ok: true }, error: null };
            },
            storage: {
                from: () => ({
                    createSignedUploadUrl: async (path: string) => {
                        estado.signedUploadPath = path;
                        return { data: { signedUrl: `https://storage.local/${path}?t=1`, token: 'tok', path }, error: null };
                    },
                    createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.local/${path}?r=1` }, error: null }),
                }),
            },
        },
    };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireMarketplaceAuth: (req: any, _res: any, next: any) => { req.user = { id: 'u1' }; next(); },
    auditLog: async () => {},
}));
vi.mock('../services/store-flag.service', () => ({ requireStoreEnabled: (_req: any, _res: any, next: any) => next() }));
vi.mock('../services/store-access', () => ({ canManageStoreAs: async () => true }));

vi.mock('../services/wompi.service', async (orig) => {
    const real: any = await orig();
    return {
        ...real,
        assertUserNotBlocked: async () => {},
        validateWebhookChecksum: () => { estado.checksumCalls++; return true; },
        fetchTransaction: async () => null,
    };
});

vi.mock('../services/store-checkout', async (orig) => {
    const real: any = await orig();
    return {
        ...real,
        gatewayPayloadForOrder: async (o: any) => {
            if (estado.gatewayThrows) throw new real.SellerGatewayError();
            return { provider: o.payment_method, publicKey: 'pub_test_VENDEDOR', sandbox: true, reference: o.reference, amountInCents: Number(o.total_amount) * 100, signature: 'firma-del-vendedor' };
        },
        findStoreOrderByReference: async (ref: string) => [...estado.orders.values()].find((o) => o.reference === ref) ?? null,
        findStoreOrderById: async (id: string) => estado.orders.get(id) ?? null,
        sellerWompiCredsForOrder: async () => estado.sellerCreds,
    };
});

import checkoutRouter from './marketplace-checkout.routes';
import storeRouter from './store-orders.routes';
import wompiRouter, { routeWompiTransaction } from './wompi';

const OID = '0b6c1a4e-1111-4111-8111-000000000001';
let server: http.Server;
let base = '';

beforeEach(async () => {
    estado.rpc = [];
    estado.rpcResult = {};
    estado.gatewayThrows = false;
    estado.sellerCreds = null;
    estado.checksumCalls = 0;
    estado.orders = new Map([[OID, {
        id: OID, reference: 'CART-AAA-BBB', wompi_reference: 'CART-AAA-BBB', total_amount: 178000,
        payment_method: 'transfer', status: 'pending_payment', user_id: 'u1',
        seller_gateway_id: null, seller_gateway_kind: null, vendor_profile_id: 'vp1', receipt_path: null,
    }]]);
    const app = express();
    app.use(express.json());
    app.use('/marketplace', checkoutRouter);
    app.use('/store', storeRouter);
    app.use('/wompi', wompiRouter);
    server = app.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => { await new Promise<void>((r) => server.close(() => r())); });

const post = (path: string, body: any = {}) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

const SUMMARY = {
    order_id: OID, reference: 'CART-AAA-BBB', status: 'pending_payment', payment_method: 'wompi',
    seller_gateway_id: 'gw', seller_gateway_kind: 'vendor', subtotal: 178000, tax_total: 28420, shipping: 0,
    total: 178000, amount_in_cents: 17800000, expires_at: '2026-10-04T12:00:00Z', items: [{}], idempotent: false,
    pickup_code: '123456',
};

describe('POST /marketplace/checkout/cart', () => {
    it('llama create_cart_order con el comprador de la sesión y sin precios; firma del vendedor', async () => {
        estado.rpcResult.create_cart_order = { data: SUMMARY, error: null };
        const r = await post('/marketplace/checkout/cart', {
            items: [{ productId: '00000000-0000-4000-d000-000000000002', quantity: 2, unitPrice: 1 }],
            fulfillment: 'pickup', paymentMethod: 'wompi',
        });
        expect(r.status).toBe(201);
        const body = await r.json();
        const [fn, args] = estado.rpc[0];
        expect(fn).toBe('create_cart_order');
        expect(args.p_buyer_id).toBe('u1');
        expect(JSON.stringify(args.p_items)).not.toMatch(/price/i);
        expect(body.data).toMatchObject({ orderId: OID, signature: 'firma-del-vendedor', publicKey: 'pub_test_VENDEDOR', amountInCents: 17800000, pickupCode: '123456' });
    });

    it('pasarela del vendedor no utilizable → 409 SELLER_GATEWAY_NOT_CONFIGURED (nunca ENV)', async () => {
        estado.rpcResult.create_cart_order = { data: SUMMARY, error: null };
        estado.gatewayThrows = true;
        const r = await post('/marketplace/checkout/cart', { items: [{ productId: '00000000-0000-4000-d000-000000000002', quantity: 1 }], paymentMethod: 'wompi' });
        expect(r.status).toBe(409);
        expect((await r.json()).error).toBe('SELLER_GATEWAY_NOT_CONFIGURED');
    });

    it('INSUFFICIENT_STOCK de la RPC → 409 con el disponible', async () => {
        estado.rpcResult.create_cart_order = {
            data: null,
            error: { code: 'P0001', message: 'INSUFFICIENT_STOCK', details: '[{"product_id":"p","variant_id":null,"requested":2,"available":1}]' },
        };
        const r = await post('/marketplace/checkout/cart', { items: [{ productId: '00000000-0000-4000-d000-000000000006', quantity: 2 }], paymentMethod: 'transfer' });
        expect(r.status).toBe(409);
        const b = await r.json();
        expect(b.error).toBe('INSUFFICIENT_STOCK');
        expect(b.details[0].available).toBe(1);
    });

    it('transferencia: devuelve las cuentas del vendedor (store_transfer_accounts con p_actor)', async () => {
        estado.rpcResult.create_cart_order = { data: { ...SUMMARY, payment_method: 'transfer', seller_gateway_id: null }, error: null };
        estado.rpcResult.store_transfer_accounts = { data: { accounts: [{ value: '123' }] }, error: null };
        const r = await post('/marketplace/checkout/cart', { items: [{ productId: '00000000-0000-4000-d000-000000000002', quantity: 1 }], paymentMethod: 'transfer' });
        expect(r.status).toBe(201);
        expect((await r.json()).data.transfer.accounts[0].value).toBe('123');
        expect(estado.rpc).toContainEqual(['store_transfer_accounts', { p_order_id: OID, p_actor: 'u1' }]);
    });
});

describe('/store (acciones con actor)', () => {
    it('approve-receipt → approve_order_receipt con p_actor; NOT_OWNER → 403', async () => {
        let r = await post(`/store/vendor/orders/${OID}/approve-receipt`);
        expect(r.status).toBe(200);
        expect(estado.rpc).toContainEqual(['approve_order_receipt', { p_order_id: OID, p_actor: 'u1' }]);
        estado.rpcResult.approve_order_receipt = { data: null, error: { code: '42501', message: 'NOT_OWNER' } };
        r = await post(`/store/vendor/orders/${OID}/approve-receipt`);
        expect(r.status).toBe(403);
        expect((await r.json()).error).toBe('NOT_OWNER');
    });

    it('receipt-url: carpeta de la orden y extensión válida; otro comprador 404; formato inválido 400', async () => {
        let r = await post(`/store/orders/${OID}/receipt-url`, { fileName: 'pago.JPG' });
        expect(r.status).toBe(200);
        const b = await r.json();
        expect(b.data.path).toMatch(new RegExp(`^${OID}/[0-9a-f-]{36}\\.jpg$`));
        expect(b.data.bucket).toBe('order-receipts');
        r = await post(`/store/orders/${OID}/receipt-url`, { fileName: 'virus.exe' });
        expect(r.status).toBe(400);
        estado.orders.get(OID).user_id = 'otro';
        r = await post(`/store/orders/${OID}/receipt-url`, { fileName: 'pago.png' });
        expect(r.status).toBe(404);
    });

    it('receipt → submit_order_receipt con p_actor', async () => {
        const r = await post(`/store/orders/${OID}/receipt`, { path: `${OID}/x.jpg` });
        expect(r.status).toBe(200);
        expect(estado.rpc).toContainEqual(['submit_order_receipt', { p_order_id: OID, p_receipt_path: `${OID}/x.jpg`, p_actor: 'u1' }]);
    });

    it('confirm-cash: código que no es de 6 dígitos → 400 sin llamar la RPC', async () => {
        const r = await post(`/store/vendor/orders/${OID}/confirm-cash`, { pickupCode: '12' });
        expect(r.status).toBe(400);
        expect(estado.rpc).toEqual([]);
    });

    it('id que no es uuid → 400', async () => {
        const r = await post('/store/vendor/orders/no-uuid/approve-receipt');
        expect(r.status).toBe(400);
    });

    it('pickup-code → regenerate_my_pickup_code con p_actor de la sesión; tope → 409 PICKUP_CODE_LIMIT', async () => {
        estado.rpcResult.regenerate_my_pickup_code = {
            data: { order_id: OID, pickup_code: '123456', regenerations_used: 1, regenerations_left: 2 }, error: null,
        };
        let r = await post(`/store/orders/${OID}/pickup-code`, { p_actor: 'otro' });
        expect(r.status).toBe(200);
        expect((await r.json()).data.pickup_code).toBe('123456');
        expect(estado.rpc).toContainEqual(['regenerate_my_pickup_code', { p_order_id: OID, p_actor: 'u1' }]);
        estado.rpcResult.regenerate_my_pickup_code = { data: null, error: { code: 'P0001', message: 'PICKUP_CODE_LIMIT' } };
        r = await post(`/store/orders/${OID}/pickup-code`);
        expect(r.status).toBe(409);
        expect((await r.json()).error).toBe('PICKUP_CODE_LIMIT');
        estado.rpcResult.regenerate_my_pickup_code = { data: null, error: { code: 'P0002', message: 'NOT_FOUND' } };
        r = await post(`/store/orders/${OID}/pickup-code`);
        expect(r.status).toBe(404);
    });
});

describe('Webhook Wompi CART-* (D-5 = A, un solo camino)', () => {
    const tx = (status: string, cents: number) => ({
        id: 'tx-1', status, reference: 'CART-AAA-BBB', amount_in_cents: cents, currency: 'COP', payment_method_type: 'CARD',
    });

    beforeEach(() => {
        Object.assign(estado.orders.get(OID), { payment_method: 'wompi', seller_gateway_id: 'gw', seller_gateway_kind: 'vendor' });
    });

    it('monto distinto a orders.total_amount → 400 y NO confirma', async () => {
        const r = await routeWompiTransaction({ realTx: tx('APPROVED', 100) });
        expect(r.status).toBe(400);
        expect(estado.rpc.map(([f]) => f)).not.toContain('confirm_order_payment');
        expect(estado.rpc.map(([f]) => f)).toContain('flag_payment_for_review');
    });

    it('aprobado → confirm_order_payment (5 args) y nada de split_order_payment / compute suelto', async () => {
        estado.rpcResult.confirm_order_payment = { data: { ok: true, status: 'paid' }, error: null };
        const r = await routeWompiTransaction({ realTx: tx('APPROVED', 17800000) });
        expect(r.status).toBe(200);
        expect(estado.rpc).toContainEqual(['confirm_order_payment', {
            p_order_id: OID, p_wompi_reference: 'CART-AAA-BBB', p_wompi_transaction_id: 'tx-1', p_payment_method_type: 'CARD', p_provider: 'wompi',
        }]);
        const fns = estado.rpc.map(([f]) => f);
        expect(fns).not.toContain('split_order_payment');
        expect(fns).not.toContain('compute_settlements_for_order');
    });

    it('pago tardío sin stock (review) → 200 status review', async () => {
        estado.rpcResult.confirm_order_payment = { data: { ok: false, review: true, reason: 'PAID_WITHOUT_STOCK' }, error: null };
        const r = await routeWompiTransaction({ realTx: tx('APPROVED', 17800000) });
        expect(r.body.status).toBe('review');
    });

    it('rechazado → store_order_payment_failed (libera la reserva en la base)', async () => {
        const r = await routeWompiTransaction({ realTx: tx('DECLINED', 17800000) });
        expect(r.status).toBe(200);
        const call = estado.rpc.find(([f]) => f === 'store_order_payment_failed');
        expect(call?.[1]).toMatchObject({ p_order_id: OID, p_provider: 'wompi', p_tx_id: 'tx-1', p_status: 'rejected' });
    });

    it('sin llaves del vendedor → 503 y ni siquiera intenta validar con las globales', async () => {
        estado.sellerCreds = null;
        const r = await post('/wompi/webhook', {
            event: 'transaction.updated', timestamp: Math.floor(Date.now() / 1000),
            data: { transaction: tx('APPROVED', 17800000) }, signature: { checksum: 'x', properties: [] },
        });
        expect(r.status).toBe(503);
        expect(estado.checksumCalls).toBe(0);
    });
});
