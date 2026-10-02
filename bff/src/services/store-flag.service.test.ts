/**
 * Flag global de la tienda (spec blindaje-dinero-pagos-tienda-nomina §1.3).
 *
 * Lo que se vigila es el FAIL-CLOSED: la tienda solo se prende con un `true`
 * explícito de `store_enabled()`. Función inexistente (M3 sin aplicar), error
 * de red o un valor raro → 503 STORE_DISABLED.
 *
 * Cero red y cero base: Supabase está moqueado.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const estado = vi.hoisted(() => ({
    /** Respuesta de supabase.rpc('store_enabled'). */
    flag: { data: null as any, error: null as any },
    /** Llamadas a supabase.rpc: [nombre, args]. */
    rpcCalls: [] as Array<[string, any]>,
}));

vi.mock('../config/supabase', () => ({
    supabase: {
        rpc: async (fn: string, args?: any) => {
            estado.rpcCalls.push([fn, args]);
            if (fn === 'store_enabled') return estado.flag;
            if (fn === 'search_marketplace') {
                return { data: { items: [], total: 0, page: 1, pages: 0 }, error: null };
            }
            return { data: null, error: { code: 'PGRST202', message: 'not mocked' } };
        },
        from: () => {
            throw new Error('from() no debería llamarse con la tienda apagada');
        },
    },
}));

vi.mock('../middlewares/authMiddleware', () => ({
    optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

import { isStoreEnabled, requireStoreEnabled, __resetStoreFlagCache } from './store-flag.service';
import marketplaceRouter from '../routes/marketplace.routes';

let server: http.Server;
let base = '';

beforeEach(async () => {
    __resetStoreFlagCache();
    estado.flag = { data: false, error: null };
    estado.rpcCalls = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const app = express();
    app.get('/gated', requireStoreEnabled, (_req, res) => res.json({ ok: true }));
    app.use('/api/v1/marketplace', marketplaceRouter);
    server = app.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((r) => server.close(() => r()));
});

describe('isStoreEnabled', () => {
    it('true solo con un true explícito de la RPC', async () => {
        estado.flag = { data: true, error: null };
        expect(await isStoreEnabled()).toBe(true);
    });

    it('false con la tienda apagada', async () => {
        estado.flag = { data: false, error: null };
        expect(await isStoreEnabled()).toBe(false);
    });

    it('valor raro (null, "true", objeto) → apagada', async () => {
        for (const data of [null, 'true', { enabled: true }]) {
            __resetStoreFlagCache();
            estado.flag = { data, error: null };
            expect(await isStoreEnabled()).toBe(false);
        }
    });

    it('función inexistente (PGRST202 / 42883) → apagada y avisa una sola vez', async () => {
        const warn = console.warn as unknown as ReturnType<typeof vi.fn>;
        estado.flag = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.store_enabled' } };
        expect(await isStoreEnabled()).toBe(false);

        // Vence la caché pero no el aviso: el warning no se repite.
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
        estado.flag = { data: null, error: { code: '42883', message: 'function public.store_enabled() does not exist' } };
        expect(await isStoreEnabled()).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('cachea 60 s: una sola RPC dentro de la ventana', async () => {
        estado.flag = { data: true, error: null };
        await isStoreEnabled();
        estado.flag = { data: false, error: null };
        expect(await isStoreEnabled()).toBe(true);
        expect(estado.rpcCalls.filter(([fn]) => fn === 'store_enabled')).toHaveLength(1);
    });
});

describe('requireStoreEnabled', () => {
    it('tienda apagada → 503 STORE_DISABLED', async () => {
        const r = await fetch(`${base}/gated`);
        expect(r.status).toBe(503);
        expect(await r.json()).toEqual({ error: 'STORE_DISABLED', message: 'La tienda no está disponible por ahora.' });
    });

    it('RPC inexistente → 503', async () => {
        estado.flag = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
        const r = await fetch(`${base}/gated`);
        expect(r.status).toBe(503);
    });

    it('tienda prendida → pasa', async () => {
        estado.flag = { data: true, error: null };
        const r = await fetch(`${base}/gated`);
        expect(r.status).toBe(200);
    });
});

describe('marketplace.routes con la tienda apagada', () => {
    it('/products/:id, /vendor/:slug y /school-store/:id → 503 sin tocar tablas', async () => {
        for (const p of ['/products/x', '/vendor/mmm-team-products', '/school-store/abc']) {
            const r = await fetch(`${base}/api/v1/marketplace${p}`);
            expect(r.status, p).toBe(503);
        }
    });

    it('Explorar type=products → 503', async () => {
        const r = await fetch(`${base}/api/v1/marketplace?type=products`);
        expect(r.status).toBe(503);
    });

    it('Explorar type=all → pide solo servicios', async () => {
        const r = await fetch(`${base}/api/v1/marketplace`);
        expect(r.status).toBe(200);
        const call = estado.rpcCalls.find(([fn]) => fn === 'search_marketplace');
        expect(call?.[1].p_type).toBe('services');
    });

    it('Explorar type=services → no consulta el flag', async () => {
        const r = await fetch(`${base}/api/v1/marketplace?type=services`);
        expect(r.status).toBe(200);
        expect(estado.rpcCalls.some(([fn]) => fn === 'store_enabled')).toBe(false);
    });

    it('tienda prendida: type=all se respeta', async () => {
        estado.flag = { data: true, error: null };
        await fetch(`${base}/api/v1/marketplace`);
        const call = estado.rpcCalls.find(([fn]) => fn === 'search_marketplace');
        expect(call?.[1].p_type).toBe('all');
    });
});
