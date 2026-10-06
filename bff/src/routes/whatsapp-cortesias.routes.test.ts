/**
 * whatsapp-cortesias.routes — solo la administración de ESA escuela ve y marca
 * las clases de cortesía. Router real; el servicio va moqueado para probar la
 * autorización y la validación, no la consulta (eso lo cubre su propio test).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const estado = vi.hoisted(() => ({
    usuario: 'milena',
    tablas: {} as Record<string, Record<string, any>[]>,
    llamadas: [] as any[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        const filtros: ((f: any) => boolean)[] = [];
        const resolver = () => ({ data: (estado.tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f))), error: null });
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filtros.push((f) => f[c] === v); return api; },
            limit: () => api,
            maybeSingle: async () => ({ data: resolver().data[0] ?? null, error: null }),
            then: (ok: any, err: any) => Promise.resolve(resolver()).then(ok, err),
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});
vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { id: estado.usuario }; next(); },
}));
vi.mock('../services/cortesia-reservas.service', () => ({
    listarCortesias: vi.fn(async (schoolId: string, f: any) => {
        estado.llamadas.push({ fn: 'listar', schoolId, f });
        return { reservas: [{ leadId: 'l1' }], sinAgendar: [] };
    }),
    marcarAsistencia: vi.fn(async (schoolId: string, leadId: string, a: any) => {
        estado.llamadas.push({ fn: 'marcar', schoolId, leadId, a });
        return leadId === '99999999-9999-4999-8999-999999999999' ? 'no_encontrado' : 'ok';
    }),
}));

import router from './whatsapp-cortesias.routes';

const ESCUELA = '2d509571-3238-4c04-ac3f-6dfe20539226';
const OTRA = '11111111-1111-4111-8111-111111111111';
const LEAD = '22222222-2222-4222-8222-222222222222';

let server: http.Server;
let base = '';

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/whatsapp', router);
    server = http.createServer(app);
    await new Promise<void>((ok) => server.listen(0, ok));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/whatsapp`;
});
afterAll(() => { server.close(); });

beforeEach(() => {
    estado.usuario = 'milena';
    estado.llamadas = [];
    estado.tablas = {
        platform_admins: [],
        schools: [{ id: ESCUELA, owner_id: 'milena' }, { id: OTRA, owner_id: 'otro' }],
        school_members: [
            { school_id: ESCUELA, profile_id: 'admin-2', role: 'admin', status: 'active' },
            { school_id: ESCUELA, profile_id: 'coach-1', role: 'coach', status: 'active' },
            { school_id: ESCUELA, profile_id: 'papa-1', role: 'parent', status: 'active' },
            { school_id: ESCUELA, profile_id: 'ex-admin', role: 'admin', status: 'inactive' },
        ],
    };
});

const get = (p: string) => fetch(`${base}${p}`);
const patch = (p: string, body: unknown) => fetch(`${base}${p}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('GET /:schoolId/cortesias', () => {
    it('la dueña ve las de su escuela, con el filtro de días', async () => {
        const r = await get(`/${ESCUELA}/cortesias?desde=2026-10-06&hasta=2026-10-07`);
        expect(r.status).toBe(200);
        expect((await r.json()).reservas).toHaveLength(1);
        expect(estado.llamadas[0]).toMatchObject({ fn: 'listar', schoolId: ESCUELA, f: { desde: '2026-10-06', hasta: '2026-10-07' } });
    });
    it('un admin activo también', async () => {
        estado.usuario = 'admin-2';
        expect((await get(`/${ESCUELA}/cortesias`)).status).toBe(200);
    });
    it.each(['coach-1', 'papa-1', 'ex-admin', 'extraño'])('%s: 403 y no se consulta nada', async (u) => {
        estado.usuario = u;
        expect((await get(`/${ESCUELA}/cortesias`)).status).toBe(403);
        expect(estado.llamadas).toHaveLength(0);
    });
    it('la dueña de una escuela no ve las de otra', async () => {
        expect((await get(`/${OTRA}/cortesias`)).status).toBe(403);
    });
    it('fechas mal formadas se ignoran', async () => {
        await get(`/${ESCUELA}/cortesias?desde=ayer`);
        expect(estado.llamadas[0].f).toEqual({ desde: undefined, hasta: undefined });
    });
});

describe('PATCH /:schoolId/cortesias/:leadId/asistencia', () => {
    it('marca asistió / no vino / desmarca', async () => {
        for (const a of ['asistio', 'no_vino', null]) {
            const r = await patch(`/${ESCUELA}/cortesias/${LEAD}/asistencia`, { asistencia: a });
            expect(r.status).toBe(200);
        }
        expect(estado.llamadas.map((l) => l.a)).toEqual(['asistio', 'no_vino', null]);
        expect(estado.llamadas.every((l) => l.schoolId === ESCUELA)).toBe(true);
    });
    it('valor inválido: 400', async () => {
        expect((await patch(`/${ESCUELA}/cortesias/${LEAD}/asistencia`, { asistencia: 'tal vez' })).status).toBe(400);
    });
    it('coach: 403', async () => {
        estado.usuario = 'coach-1';
        expect((await patch(`/${ESCUELA}/cortesias/${LEAD}/asistencia`, { asistencia: 'asistio' })).status).toBe(403);
        expect(estado.llamadas).toHaveLength(0);
    });
    it('lead de otra escuela: 404', async () => {
        const r = await patch(`/${ESCUELA}/cortesias/99999999-9999-4999-8999-999999999999/asistencia`, { asistencia: 'asistio' });
        expect(r.status).toBe(404);
    });
});
