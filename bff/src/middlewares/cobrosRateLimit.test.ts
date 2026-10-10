/**
 * cobrosRateLimit — cupos del modal «Cobros y pagos» por USUARIO autenticado,
 * separados en lectura / preview / escritura. Sin red externa: express en un
 * puerto efímero con un requireAuth falso que lee `x-test-user`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import {
    COBROS_PREVIEW_LIMIT_PER_MIN, COBROS_READ_LIMIT_PER_MIN, COBROS_WRITE_LIMIT_PER_MIN,
    cobrosRateLimit, cobrosRateLimitKey, createCobrosRateLimit, cupoDeLaRequest,
} from './cobrosRateLimit';

let server: http.Server | null = null;

async function app(opts: { readMax: number; previewMax: number; writeMax: number }) {
    const a = express();
    a.set('trust proxy', 1);
    const limit = createCobrosRateLimit(opts);
    const r = express.Router();
    r.use((req, _res, next) => {
        const u = req.headers['x-test-user'];
        if (u) (req as any).user = { id: String(u) };
        next();
    }, limit.porRequest);
    r.get('/targets', (_req, res) => { res.json({ ok: true }); });
    r.post('/preview', (_req, res) => { res.json({ ok: true }); });
    r.post('/', (_req, res) => { res.json({ ok: true }); });
    a.use('/api/v1/charge-batches', r);
    server = await new Promise<http.Server>((resolve) => { const s = a.listen(0, () => resolve(s)); });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
    if (server) await new Promise((r) => server!.close(r));
    server = null;
});

const H = (user: string | null, ip = '181.63.24.103') => ({
    'Content-Type': 'application/json',
    'cf-connecting-ip': ip,
    ...(user ? { 'x-test-user': user } : {}),
});

describe('presupuestos', () => {
    it('lectura 120/min, preview 60/min, escritura 20/min (más generosos que el viejo paymentLimiter)', () => {
        expect(COBROS_READ_LIMIT_PER_MIN).toBe(120);
        expect(COBROS_PREVIEW_LIMIT_PER_MIN).toBe(60);
        expect(COBROS_WRITE_LIMIT_PER_MIN).toBe(20);
    });
});

describe('cupoDeLaRequest', () => {
    it('GET → lectura; POST /preview → preview; confirmar, anular y quitar descuento → escritura', () => {
        expect(cupoDeLaRequest({ method: 'GET', originalUrl: '/api/v1/charge-batches/targets?kind=team' })).toBe('read');
        expect(cupoDeLaRequest({ method: 'GET', originalUrl: '/api/v1/athletes/child/x/open-charges' })).toBe('read');
        expect(cupoDeLaRequest({ method: 'POST', originalUrl: '/api/v1/charge-batches/preview' })).toBe('preview');
        expect(cupoDeLaRequest({ method: 'POST', originalUrl: '/api/v1/charge-batches/preview/?x=1' })).toBe('preview');
        expect(cupoDeLaRequest({ method: 'POST', originalUrl: '/api/v1/charge-batches' })).toBe('write');
        expect(cupoDeLaRequest({ method: 'POST', originalUrl: '/api/v1/charge-batches/abc/annul' })).toBe('write');
        expect(cupoDeLaRequest({ method: 'POST', originalUrl: '/api/v1/payment-adjustments/abc/revert' })).toBe('write');
    });
});

describe('cobrosRateLimitKey', () => {
    it('usa el id de usuario; sin usuario, la IP REAL (CF-Connecting-IP) y no el borde de Cloudflare', () => {
        expect(cobrosRateLimitKey('read', { headers: {}, ip: '172.68.0.1', user: { id: 'u1' } } as any)).toBe('cobros-read-u:u1');
        expect(cobrosRateLimitKey('read', { headers: { 'cf-connecting-ip': '181.63.24.103' }, ip: '172.68.0.1' } as any))
            .toBe('cobros-read-ip:181.63.24.103');
        expect(cobrosRateLimitKey('write', { headers: {}, ip: '10.0.0.5' } as any)).toBe('cobros-write-ip:10.0.0.5');
    });

    it('las llaves no chocan entre usuarios, entre cupos ni entre un usuario y una IP', () => {
        const ks = new Set([
            cobrosRateLimitKey('read', { headers: {}, user: { id: '1.2.3.4' } } as any),
            cobrosRateLimitKey('read', { headers: { 'cf-connecting-ip': '1.2.3.4' } } as any),
            cobrosRateLimitKey('preview', { headers: {}, user: { id: '1.2.3.4' } } as any),
            cobrosRateLimitKey('read', { headers: {}, user: { id: 'otro' } } as any),
        ]);
        expect(ks.size).toBe(4);
    });
});

describe('middleware', () => {
    it('cada usuario tiene su cupo aunque compartan IP (oficina detrás del mismo NAT)', async () => {
        const base = await app({ readMax: 2, previewMax: 2, writeMax: 2 });
        for (let i = 0; i < 2; i++) expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H('ana') })).status).toBe(200);
        const r = await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H('ana') });
        expect(r.status).toBe(429);
        expect(await r.json()).toMatchObject({ code: 'RATE_LIMITED' });
        expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
        // Misma IP, otro usuario: pasa.
        expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H('beto') })).status).toBe(200);
    });

    it('agotar la vista previa no bloquea lecturas ni confirmar (cupos independientes)', async () => {
        const base = await app({ readMax: 5, previewMax: 2, writeMax: 1 });
        const post = (p: string) => fetch(`${base}/api/v1/charge-batches${p}`, { method: 'POST', headers: H('ana'), body: '{}' });
        expect((await post('/preview')).status).toBe(200);
        expect((await post('/preview')).status).toBe(200);
        expect((await post('/preview')).status).toBe(429);
        expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H('ana') })).status).toBe(200);
        expect((await post('')).status).toBe(200);
        expect((await post('')).status).toBe(429);
    });

    it('sin usuario cae a la IP real: dos clientes detrás del mismo borde de Cloudflare no se pisan', async () => {
        const base = await app({ readMax: 1, previewMax: 1, writeMax: 1 });
        expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H(null, '1.1.1.1') })).status).toBe(200);
        expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H(null, '1.1.1.1') })).status).toBe(429);
        expect((await fetch(`${base}/api/v1/charge-batches/targets`, { headers: H(null, '2.2.2.2') })).status).toBe(200);
    });

    it('reset() vacía los contadores', async () => {
        await cobrosRateLimit.reset();
        const l = createCobrosRateLimit({ readMax: 1 });
        await expect(l.reset()).resolves.toBeUndefined();
    });
});

describe('montaje en index.ts', () => {
    const src = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf-8');
    it('las rutas del modal ya no pasan por paymentLimiter', () => {
        expect(src).toMatch(/app\.use\('\/api\/v1\/charge-batches', chargeBatchesRouter\)/);
        expect(src).toMatch(/app\.use\('\/api\/v1\/payment-adjustments', paymentAdjustmentsRouter\)/);
        expect(src).not.toMatch(/'\/api\/v1\/(charge-batches|payment-adjustments|athletes)',[^\n]*paymentLimiter/);
    });
    it('MercadoPago, glosas y conciliación conservan paymentLimiter', () => {
        expect(src).toMatch(/app\.use\('\/api\/v1\/payments\/mp', paymentLimiter/);
        expect(src).toMatch(/app\.use\('\/api\/v1\/payments\/glosas', paymentLimiter/);
        expect(src).toMatch(/app\.use\('\/api\/v1\/payments\/reconciliation', paymentLimiter/);
    });
});
