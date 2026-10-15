/**
 * Compra sin cuenta (mig. 20261013170553) — rutas públicas /api/v1/public/tienda:
 *  - POST /checkout → create_guest_cart_order con la IP REAL (CF-Connecting-IP),
 *    sin precios del cliente; correo SIMULADO en tests; token una sola vez.
 *  - Errores de la base → HTTP (LOGIN_REQUIRED, límites, monto).
 *  - Por token (header, nunca en la URL): sin token / mal formado → 404 sin
 *    llamar a la base; comprobante con ruta dentro de la orden.
 *  - Rate limit propio por IP real.
 *
 * Cero red y cero base: Supabase moqueado.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const estado = vi.hoisted(() => ({
    rpc: [] as Array<[string, any]>,
    rpcResult: {} as Record<string, { data?: any; error?: any }>,
    signedUploadPath: '' as string,
}));

vi.mock('../config/supabase', () => ({
    supabase: {
        from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } }),
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
            }),
        },
    },
}));
vi.mock('../middlewares/authMiddleware', () => ({
    requireMarketplaceAuth: (_req: any, res: any) => res.status(401).json({ error: 'no' }),
    auditLog: async () => {},
}));
vi.mock('../services/store-flag.service', () => ({ requireStoreEnabled: (_req: any, _res: any, next: any) => next() }));

import router from './store-guest.routes';

const TOKEN = 'ab'.repeat(32);
const ORDER = '11111111-2222-4333-8444-555555555555';
let server: http.Server;
let base = '';

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/public/tienda', router);
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/public/tienda`;
});
afterAll(() => server.close());
beforeEach(() => {
    estado.rpc = [];
    estado.rpcResult = {};
});

const body = {
    items: [{ productId: '00000000-0000-4000-d000-00000000f101', quantity: 2, unitPrice: 1 }],
    fulfillment: 'pickup',
    buyer: { name: 'Socio Sin Cuenta', email: 'Socio@GYM.co' },
    paymentMethod: 'transfer',
    idempotencyKey: '0b7f2c1e-1111-4222-8333-444455556666',
};

async function post(path: string, json: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(json) });
    return { status: res.status, body: await res.json() as any };
}

describe('POST /checkout', () => {
    it('crea con la IP real, sin precios, y devuelve el enlace una vez (correo simulado)', async () => {
        estado.rpcResult.create_guest_cart_order = { data: {
            order_id: ORDER, reference: 'CART-X', status: 'pending_payment', payment_method: 'transfer', total: 80000,
            amount_in_cents: 8000000, subtotal: 80000, tax_total: 12773, shipping: 0, fulfillment: 'pickup',
            access_token: TOKEN, guest_email: 'socio@gym.co', idempotent: false, items: [],
        }, error: null };
        estado.rpcResult.guest_order_view = { data: { store: { display_name: 'GYM RM' }, transfer: { accounts: [{ value: '000-1' }] } }, error: null };
        const r = await post('/checkout', body, { 'CF-Connecting-IP': '181.63.24.103', 'X-Forwarded-For': '1.1.1.1' });
        expect(r.status).toBe(201);
        const [fn, args] = estado.rpc[0];
        expect(fn).toBe('create_guest_cart_order');
        expect(args.p_client_ip).toBe('181.63.24.103');
        expect(args.p_buyer.email).toBe('socio@gym.co');
        expect(JSON.stringify(args)).not.toMatch(/unitPrice|unit_price/);
        expect(r.body.data.orderPath).toBe(`/pedido/${TOKEN}`);
        expect(r.body.data.accessToken).toBe(TOKEN);
        expect(r.body.data.transfer.accounts[0].value).toBe('000-1');
        expect(r.body.data.emailSent).toBe('simulated');
    });

    it('reintento idempotente: misma orden, sin token', async () => {
        estado.rpcResult.create_guest_cart_order = { data: { order_id: ORDER, reference: 'CART-X', total: 80000, idempotent: true, access_token: null }, error: null };
        const r = await post('/checkout', body);
        expect(r.status).toBe(200);
        expect(r.body.data.idempotent).toBe(true);
        expect(r.body.data.accessToken).toBeNull();
        expect(estado.rpc.map(([f]) => f)).toEqual(['create_guest_cart_order']);
    });

    it.each([
        ['LOGIN_REQUIRED', 403],
        ['GUEST_RATE_LIMITED', 429],
        ['GUEST_AMOUNT_LIMIT', 422],
        ['GUEST_OPEN_ORDERS_LIMIT', 409],
        ['GUEST_CHECKOUT_DISABLED', 403],
    ])('error de la base %s → %i', async (token, status) => {
        estado.rpcResult.create_guest_cart_order = { data: null, error: { code: 'P0001', message: token } };
        const r = await post('/checkout', body);
        expect(r.status).toBe(status);
        expect(r.body.error).toBe(token);
    });

    it('valida antes de tocar la base: correo, Mercado Pago y la trampa de bots', async () => {
        expect((await post('/checkout', { ...body, buyer: { name: 'X Y' } })).body.error).toBe('GUEST_EMAIL_REQUIRED');
        expect((await post('/checkout', { ...body, paymentMethod: 'mercadopago' })).status).toBe(422);
        expect((await post('/checkout', { ...body, website: 'http://spam' })).status).toBe(400);
        expect(estado.rpc).toEqual([]);
    });
});

describe('por token', () => {
    it('sin token o mal formado → 404 sin llamar a la base', async () => {
        const r1 = await fetch(`${base}/pedido`);
        expect(r1.status).toBe(404);
        const r2 = await fetch(`${base}/pedido`, { headers: { 'X-Pedido-Token': 'x' } });
        expect(r2.status).toBe(404);
        expect(estado.rpc).toEqual([]);
    });

    it('token desconocido → 404 NOT_FOUND', async () => {
        estado.rpcResult.guest_order_view = { data: null, error: { code: 'P0002', message: 'NOT_FOUND' } };
        const r = await fetch(`${base}/pedido`, { headers: { 'X-Pedido-Token': TOKEN } });
        expect(r.status).toBe(404);
        expect(estado.rpc[0]).toEqual(['guest_order_view', { p_token: TOKEN }]);
    });

    it('URL de subida: solo transferencia abierta, carpeta de SU orden', async () => {
        estado.rpcResult.guest_order_view = { data: { order: { id: ORDER, payment_method: 'transfer', status: 'pending_payment' } }, error: null };
        const r = await post('/pedido/receipt-url', { fileName: 'foto.JPEG' }, { 'X-Pedido-Token': TOKEN });
        expect(r.status).toBe(200);
        expect(estado.signedUploadPath).toMatch(new RegExp(`^${ORDER}/[0-9a-f-]{36}\\.jpg$`));
        estado.rpcResult.guest_order_view = { data: { order: { id: ORDER, payment_method: 'transfer', status: 'paid' } }, error: null };
        expect((await post('/pedido/receipt-url', { fileName: 'foto.png' }, { 'X-Pedido-Token': TOKEN })).status).toBe(409);
        estado.rpcResult.guest_order_view = { data: { order: { id: ORDER, payment_method: 'transfer', status: 'pending_payment' } }, error: null };
        expect((await post('/pedido/receipt-url', { fileName: 'virus.exe' }, { 'X-Pedido-Token': TOKEN })).status).toBe(400);
    });

    it('comprobante, código y cancelar van a las RPC por token', async () => {
        await post('/pedido/receipt', { path: `${ORDER}/x.png` }, { 'X-Pedido-Token': TOKEN });
        await post('/pedido/pickup-code', {}, { 'X-Pedido-Token': TOKEN });
        await post('/pedido/cancel', { reason: 'ya no' }, { 'X-Pedido-Token': TOKEN });
        expect(estado.rpc).toEqual([
            ['guest_order_submit_receipt', { p_token: TOKEN, p_receipt_path: `${ORDER}/x.png` }],
            ['guest_order_regenerate_pickup_code', { p_token: TOKEN }],
            ['guest_order_cancel', { p_token: TOKEN, p_reason: 'ya no' }],
        ]);
    });
});

describe('rate limit por IP real', () => {
    it('crear: el 11.º desde la misma CF-Connecting-IP en 10 min → 429 RATE_LIMITED; otra IP pasa', async () => {
        estado.rpcResult.create_guest_cart_order = { data: null, error: { code: 'P0001', message: 'LOGIN_REQUIRED' } };
        const ip = { 'CF-Connecting-IP': '200.9.9.9' };
        for (let i = 0; i < 10; i++) expect((await post('/checkout', body, ip)).status).toBe(403);
        const r = await post('/checkout', body, ip);
        expect(r.status).toBe(429);
        expect(r.body.error).toBe('RATE_LIMITED');
        expect((await post('/checkout', body, { 'CF-Connecting-IP': '200.9.9.10' })).status).toBe(403);
    });
});
