/**
 * storeRateLimit — lecturas y escrituras de la tienda con cupos separados,
 * por IP real del cliente (Cloudflare), contadas una sola vez por request.
 * Sin red externa: un express en un puerto efímero.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { createStoreRateLimit, isStoreRead, storeClientIp } from './storeRateLimit';

let server: http.Server | null = null;

async function app(readMax: number, writeMax: number) {
    const a = express();
    a.set('trust proxy', 1);
    const limit = createStoreRateLimit({ readMax, writeMax });
    // Igual que index.ts: el checkout montado en /api/v1/marketplace ve también
    // las requests de /api/v1/marketplace/orders (que tienen su propio montaje).
    const checkout = express.Router();
    checkout.post('/checkout/cart', (_req, res) => { res.status(201).json({ ok: true }); });
    checkout.post('/checkout/cart/quote', (_req, res) => { res.json({ ok: true }); });
    const orders = express.Router();
    orders.get('/:id', (_req, res) => { res.json({ ok: true }); });
    a.use('/api/v1/marketplace', limit, checkout);
    a.use('/api/v1/marketplace/orders', limit, orders);
    const store = express.Router();
    store.post('/orders/:id/cancel', (_req, res) => { res.json({ ok: true }); });
    a.use('/api/v1/store', limit, store);
    server = await new Promise<http.Server>((resolve) => { const s = a.listen(0, () => resolve(s)); });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
    if (server) await new Promise((r) => server!.close(r));
    server = null;
});

const H = (ip: string) => ({ 'cf-connecting-ip': ip, 'Content-Type': 'application/json' });

describe('isStoreRead / storeClientIp', () => {
    it('GET y la cotización son lecturas; crear, cancelar y regenerar código son escrituras', () => {
        expect(isStoreRead({ method: 'GET', originalUrl: '/api/v1/marketplace/orders/x' })).toBe(true);
        expect(isStoreRead({ method: 'POST', originalUrl: '/api/v1/marketplace/checkout/cart/quote?x=1' })).toBe(true);
        expect(isStoreRead({ method: 'POST', originalUrl: '/api/v1/marketplace/checkout/cart' })).toBe(false);
        expect(isStoreRead({ method: 'POST', originalUrl: '/api/v1/store/orders/x/cancel' })).toBe(false);
        expect(isStoreRead({ method: 'POST', originalUrl: '/api/v1/store/orders/x/pickup-code' })).toBe(false);
    });

    it('usa CF-Connecting-IP (IP real) antes que req.ip (borde de Cloudflare)', () => {
        expect(storeClientIp({ headers: { 'cf-connecting-ip': '181.63.24.103' }, ip: '172.68.175.10' } as any)).toBe('181.63.24.103');
        expect(storeClientIp({ headers: {}, ip: '10.0.0.5' } as any)).toBe('10.0.0.5');
    });
});

describe('storeRateLimit', () => {
    it('leer pedidos no gasta el cupo de escrituras (y viceversa)', async () => {
        const base = await app(5, 2);
        for (let i = 0; i < 2; i++) {
            expect((await fetch(`${base}/api/v1/store/orders/o1/cancel`, { method: 'POST', headers: H('1.1.1.1'), body: '{}' })).status).toBe(200);
        }
        const tercera = await fetch(`${base}/api/v1/store/orders/o1/cancel`, { method: 'POST', headers: H('1.1.1.1'), body: '{}' });
        expect(tercera.status).toBe(429);
        expect(await tercera.json()).toMatchObject({ ok: false, error: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta en un minuto.' });
        // Con las escrituras agotadas, leer el pedido sigue funcionando.
        expect((await fetch(`${base}/api/v1/marketplace/orders/o1`, { headers: H('1.1.1.1') })).status).toBe(200);
        expect((await fetch(`${base}/api/v1/marketplace/checkout/cart/quote`, { method: 'POST', headers: H('1.1.1.1'), body: '{}' })).status).toBe(200);
    });

    it('un GET que atraviesa dos montajes cuenta UNA vez', async () => {
        const base = await app(3, 2);
        for (let i = 0; i < 3; i++) {
            expect((await fetch(`${base}/api/v1/marketplace/orders/o1`, { headers: H('2.2.2.2') })).status).toBe(200);
        }
        const r = await fetch(`${base}/api/v1/marketplace/orders/o1`, { headers: H('2.2.2.2') });
        expect(r.status).toBe(429);
        expect((await r.json()).error).toBe('RATE_LIMITED');
    });

    it('cada cliente (IP real) tiene su cupo aunque Cloudflare entregue todo desde el mismo borde', async () => {
        const base = await app(5, 1);
        expect((await fetch(`${base}/api/v1/marketplace/checkout/cart`, { method: 'POST', headers: H('3.3.3.3'), body: '{}' })).status).toBe(201);
        expect((await fetch(`${base}/api/v1/marketplace/checkout/cart`, { method: 'POST', headers: H('3.3.3.3'), body: '{}' })).status).toBe(429);
        expect((await fetch(`${base}/api/v1/marketplace/checkout/cart`, { method: 'POST', headers: H('4.4.4.4'), body: '{}' })).status).toBe(201);
    });
});
